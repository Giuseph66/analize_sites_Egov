/**
 * Motor de avaliacao: executa o QualWeb sobre uma URL e devolve o relatorio bruto
 * mais todo o diagnostico coletado durante a execucao.
 *
 * Decisao de projeto: uma instancia de QualWeb por avaliacao (maxConcurrency 1 no
 * cluster interno), com o paralelismo controlado pela nossa fila. Custa ~250 ms de
 * inicializacao do Chromium por avaliacao, e em troca cada avaliacao fica isolada:
 * PID proprio, plugin de diagnostico proprio, headless/screenshot configuraveis por
 * execucao e nenhuma ambiguidade sobre a qual avaliacao pertence cada pagina.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  PuppeteerDriver,
  QualWeb,
  type Driver,
  type DriverContext,
  type DriverPool,
  type EvaluationJobData,
  type ModuleType,
  type QualwebOptions,
} from '@qualweb/core';
import { ACTRules } from '@qualweb/act-rules';
import { WCAGTechniques } from '@qualweb/wcag-techniques';
import { BestPractices } from '@qualweb/best-practices';
import { Counter } from '@qualweb/counter';
import type { ConsoleMessage, HTTPRequest, HTTPResponse, Page } from 'puppeteer';

import type { Logger } from '@lae/logger';
import type { ConsoleEntry, EvaluationDiagnostics, NetworkFailure, RedirectHop } from '@lae/shared-types';

import { InstrumentedModule } from './instrumented-module';

// ClusterOptions nao e reexportado no index publico do @qualweb/core; derivamos da
// assinatura do proprio Driver para nao depender de um caminho interno do pacote.
type ClusterOptions = Parameters<Driver['launchPool']>[0];

export interface EngineRunOptions {
  resolvedUrl: string;
  headless: boolean;
  browserExecutablePath: string | null;
  pageTimeout: number;
  evaluationTimeout: number;
  maxRedirects: number;
  captureScreenshot: boolean;
  saveHtml: boolean;
  /** Janela sem mutações (ms) para considerar o DOM assentado. Ver docs/qualweb.md. */
  spaSettleQuietMs: number;
  /** Teto da espera de assentamento. 0 desativa o recurso. */
  spaSettleMaxMs: number;
  /** Diretorio data/evaluations/<id>/ onde screenshot.png e page.html sao gravados. */
  artifactDir: string;
  onStage(stage: 'browser-launched' | 'page-loaded' | ModuleType | 'normalizing'): void;
}

export interface EngineResult {
  raw: unknown;
  diagnostics: EvaluationDiagnostics;
  timings: {
    browserLaunchMs: number;
    navigationMs: number | null;
    qualwebMs: number;
    modulesMs: Record<string, number>;
    page: Record<string, number> | null;
  };
  finalUrl: string | null;
}

export class EngineError extends Error {
  constructor(
    message: string,
    readonly kind: 'navigation' | 'timeout' | 'browser' | 'qualweb' | 'internal',
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

const CHROMIUM_ARGS = [
  // Mesmo conjunto usado pelo accessmonitor-docker (MIT), que roda QualWeb em producao.
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-accelerated-2d-canvas',
  '--ignore-certificate-errors',
  '--no-first-run',
  '--no-zygote',
  '--disable-extensions',
  '--disable-blink-features=AutomationControlled',
];

/**
 * Driver que apenas repassa tudo para o driver real, mas registra um listener
 * em `onTaskError` do pool.
 *
 * Por que isso é necessário: quando a tarefa do puppeteer-cluster falha (timeout
 * de navegação, crash de aba, erro dentro do QualWeb), o erro NÃO chega a quem
 * chamou `qualweb.evaluate()`. O cluster o emite como evento `taskerror`, e o
 * único consumidor é o `ErrorManager` interno do core — que apenas escreve num
 * arquivo `qualweb-errors-*.log` no CWD, se `log.file` estiver ligado. O
 * `evaluate()` então retorna normalmente, com o dicionário de relatórios VAZIO.
 *
 * O sintoma disso era a mensagem inútil que víamos:
 *   "QualWeb nao devolveu relatorio para <url>. Chaves recebidas: (nenhuma)"
 *
 * `PuppeteerDriverPool.onTaskError` registra via `cluster.on('taskerror', ...)`,
 * ou seja, um EventEmitter — nosso listener convive com o do ErrorManager sem
 * substituí-lo.
 */
class TaskErrorCapturingDriver implements Driver {
  constructor(
    private readonly inner: Driver,
    private readonly onTaskError: (error: Error, data: EvaluationJobData) => void,
  ) {}

  public async launchPool(clusterOptions?: ClusterOptions, browserOptions?: unknown): Promise<DriverPool> {
    const pool = await this.inner.launchPool(clusterOptions, browserOptions);
    pool.onTaskError(this.onTaskError);
    return pool;
  }

  public launchContext(): Promise<DriverContext> {
    return this.inner.launchContext();
  }
}

/** Classifica o erro real numa das causas que a interface sabe explicar. */
function classifyFailure(message: string): EngineError['kind'] {
  if (/timeout|timed out|exceeded/i.test(message)) return 'timeout';
  if (/net::|ERR_|dns|ECONNREFUSED|ENOTFOUND|certificate/i.test(message)) return 'navigation';
  if (/target closed|session closed|protocol error|crash/i.test(message)) return 'browser';
  return 'qualweb';
}

export async function runEvaluation(options: EngineRunOptions, logger: Logger): Promise<EngineResult> {
  const diagnostics: EvaluationDiagnostics = {
    browserExecutable: options.browserExecutablePath,
    browserVersion: null,
    browserPid: null,
    userAgent: null,
    httpStatus: null,
    redirects: [],
    consoleMessages: [],
    pageErrors: [],
    networkFailures: [],
    screenshotPath: null,
    htmlPath: null,
  };

  const modulesMs: Record<string, number> = {};
  let pageTiming: Record<string, number> | null = null;
  let finalUrl: string | null = null;
  let navigationStartedAt: number | null = null;
  let navigationMs: number | null = null;

  // Capturas feitas dentro de afterPageLoad. O core nao aguarda o hook (ver
  // docs/qualweb.md), entao guardamos as promessas e as aguardamos antes de fechar
  // o browser, em vez de confiar na ordem de execucao do plugin.
  const pendingCaptures: Promise<void>[] = [];

  // Guardado num objeto (e nao em `let`) porque as atribuicoes acontecem dentro de
  // callbacks: com variaveis soltas o TypeScript estreita o tipo para `never` no
  // ponto de leitura, ja que nao ve nenhuma atribuicao no fluxo linear.
  const failure: { task: Error | null; navigation: Error | null } = { task: null, navigation: null };

  const driver = new TaskErrorCapturingDriver(
    new PuppeteerDriver({ plugins: { adBlock: false, stealth: false } }),
    (error, data) => {
      failure.task = error;
      logger.error('QUALWEB', `Tarefa do cluster falhou para ${data.url ?? '(html)'}`, error);
    },
  );

  // O 1o argumento (plugins) e ignorado quando passamos um driver proprio — os
  // plugins do puppeteer-extra sao configurados no PuppeteerDriver acima.
  const qualweb = new QualWeb(undefined, driver);

  qualweb.use({
    beforePageLoad(driverPage, url) {
      const page = driverPage.nativePage as Page;

      // Os listeners precisam ser registrados ANTES de qualquer await: o
      // PluginManager do @qualweb/core 0.9.5 usa forEach(async ...) e nao espera o
      // hook terminar, entao um await aqui faz perder a resposta do documento
      // principal. Ver docs/qualweb.md.
      attachDiagnostics(page, diagnostics, logger, options.maxRedirects);
      navigationStartedAt = performance.now();
      logger.info('APP', `Navigating to page: ${url}`);

      diagnostics.browserPid = page.browser().process()?.pid ?? null;

      // Espera de assentamento do DOM, para SPAs client-side-rendered (§ redirects
      // por hash router que so populam o conteudo real segundos depois do `load`).
      //
      // Isso so funciona porque interceptamos aqui, de forma SINCRONA:
      // `PuppeteerDriverPage.goto()` (o metodo que o core realmente chama) delega
      // direto para este mesmo objeto Page, entao substituir `page.goto` agora, antes
      // de qualquer await, garante que a versao interceptada esteja em vigor quando
      // `navigateToPage()` for chamado logo em seguida. Diferente dos hooks
      // beforePageLoad/afterPageLoad — cuja conclusao o core NAO aguarda, por um bug
      // documentado em docs/qualweb.md — a chamada real a goto() ocorre dentro de um
      // Promise.all que É aguardado por getTestingData(), entao atrasar o retorno de
      // goto() atrasa de fato a execucao dos modulos do QualWeb.
      // A interceptacao tambem serve para ver o erro de navegacao: se goto() falha,
      // a excecao sobe pelo Promise.all interno do core e vira um `taskerror` do
      // cluster, longe de quem chamou evaluate(). Registrando aqui, temos a causa
      // exata (ex.: timeout de PAGE_TIMEOUT) em vez de um relatorio vazio sem
      // explicacao.
      {
        type GotoFn = Page['goto'];
        const originalGoto: GotoFn = page.goto.bind(page);
        page.goto = (async (...args: Parameters<GotoFn>) => {
          let response: Awaited<ReturnType<GotoFn>>;
          try {
            response = await originalGoto(...args);
          } catch (error) {
            failure.navigation = error instanceof Error ? error : new Error(String(error));
            logger.error('BROWSER', `Navegação falhou para ${args[0]}`, error);
            throw error;
          }
          if (options.spaSettleMaxMs > 0) {
            await waitForDomSettle(page, options.spaSettleQuietMs, options.spaSettleMaxMs, logger);
          }
          return response;
        }) as GotoFn;
      }

      return (async () => {
        const browser = page.browser();
        diagnostics.browserVersion = await browser.version();
        diagnostics.userAgent = await browser.userAgent();
        logger.info('BROWSER', `Browser version: ${diagnostics.browserVersion}`);
        logger.info('BROWSER', `Chromium PID: ${diagnostics.browserPid ?? 'unknown'}`);
        logger.info('BROWSER', `User-Agent: ${diagnostics.userAgent}`);
      })();
    },

    afterPageLoad(driverPage) {
      const page = driverPage.nativePage as Page;
      navigationMs = navigationStartedAt === null ? null : performance.now() - navigationStartedAt;
      finalUrl = page.url();

      options.onStage('page-loaded');
      logger.info('APP', 'DOM loaded', { finalUrl, navigationMs: navigationMs && Math.round(navigationMs) });

      const viewport = page.viewport();
      if (viewport) logger.info('BROWSER', `Viewport: ${viewport.width}x${viewport.height}`);

      const work = (async () => {
        try {
          pageTiming = await readNavigationTiming(page);
          logger.info('TARGET PAGE', 'Navigation timing', pageTiming ?? {});
        } catch (error) {
          logger.error('TARGET PAGE', 'Could not read navigation timing', error);
        }

        if (options.captureScreenshot) {
          try {
            const path = `${options.artifactDir}/screenshot.png`;
            await mkdir(dirname(path), { recursive: true });
            await page.screenshot({ path: path as `${string}.png`, fullPage: true });
            diagnostics.screenshotPath = path;
            logger.info('APP', `Screenshot saved: ${path}`);
          } catch (error) {
            logger.error('APP', 'Screenshot failed', error);
          }
        }

        if (options.saveHtml) {
          try {
            const path = `${options.artifactDir}/page.html`;
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, await page.content(), 'utf-8');
            diagnostics.htmlPath = path;
            logger.info('APP', `Page HTML saved: ${path}`);
          } catch (error) {
            logger.error('APP', 'Saving page HTML failed', error);
          }
        }
      })();

      pendingCaptures.push(work);
      return work;
    },
  });

  const hooks = {
    onStart: (moduleName: ModuleType) => {
      options.onStage(moduleName);
      logger.info('QUALWEB', `${moduleName} started`);
    },
    onEnd: (moduleName: ModuleType, durationMs: number, report: unknown) => {
      modulesMs[moduleName] = Math.round(durationMs);
      const metadata = (report as { metadata?: Record<string, number> } | undefined)?.metadata;
      logger.info('QUALWEB', `${moduleName} completed in ${Math.round(durationMs)} ms`, metadata ?? {});
    },
    onError: (moduleName: ModuleType, durationMs: number, error: unknown) => {
      logger.error('QUALWEB', `${moduleName} failed after ${Math.round(durationMs)} ms`, error);
    },
  };

  const qualwebOptions: QualwebOptions = {
    url: options.resolvedUrl,
    modules: [
      new InstrumentedModule(new ACTRules(), hooks),
      new InstrumentedModule(new WCAGTechniques(), hooks),
      new InstrumentedModule(new BestPractices(), hooks),
      new InstrumentedModule(new Counter(), hooks),
    ],
    waitUntil: ['load', 'networkidle2'],
    timeout: options.pageTimeout,
    translate: 'en',
  };

  logger.info('BROWSER', 'Launching Chromium');
  const launchStartedAt = performance.now();

  try {
    await qualweb.start(
      {
        maxConcurrency: 1,
        // O timeout do cluster precisa cobrir toda a tarefa (navegacao + regras),
        // senao ele mata a avaliacao antes do nosso proprio timeout.
        timeout: options.evaluationTimeout,
        monitor: false,
      },
      {
        headless: options.headless,
        ...(options.browserExecutablePath ? { executablePath: options.browserExecutablePath } : {}),
        args: CHROMIUM_ARGS,
      },
    );
  } catch (error) {
    throw new EngineError('Falha ao iniciar o Chromium.', 'browser', error);
  }

  const browserLaunchMs = performance.now() - launchStartedAt;
  options.onStage('browser-launched');
  logger.info('BROWSER', `Chromium ready in ${Math.round(browserLaunchMs)} ms`);

  const evaluationStartedAt = performance.now();
  let reports: Record<string, unknown>;

  try {
    logger.info('QUALWEB', 'Starting QualWeb');
    reports = (await qualweb.evaluate(qualwebOptions)) as unknown as Record<string, unknown>;
  } catch (error) {
    await settle(pendingCaptures);
    await safeStop(qualweb, logger);
    const message = error instanceof Error ? error.message : String(error);
    throw new EngineError(`QualWeb falhou: ${message}`, classifyFailure(message), error);
  }

  const qualwebMs = performance.now() - evaluationStartedAt;
  logger.info('QUALWEB', `QualWeb finished in ${Math.round(qualwebMs)} ms`);

  await settle(pendingCaptures);
  await safeStop(qualweb, logger);

  const raw = reports[options.resolvedUrl];
  if (!raw) {
    // Relatorio vazio quase sempre significa que a tarefa do cluster morreu. O erro
    // real foi capturado no `taskerror` (ou no goto interceptado); usa-lo aqui e a
    // diferenca entre "Chaves recebidas: (nenhuma)" e uma causa acionavel.
    const underlying: Error | null = failure.navigation ?? failure.task;

    if (underlying) {
      const message = underlying.message;
      const kind = classifyFailure(message);
      const hint =
        kind === 'timeout'
          ? ` A página não terminou de carregar dentro de PAGE_TIMEOUT=${options.pageTimeout} ms` +
            ` (aguardando 'load' e 'networkidle2'). Aumente PAGE_TIMEOUT — e EVALUATION_TIMEOUT` +
            ` junto, pois ele precisa cobrir a avaliação inteira.`
          : '';

      throw new EngineError(`A avaliação de ${options.resolvedUrl} falhou: ${message}.${hint}`, kind, underlying);
    }

    throw new EngineError(
      `QualWeb nao devolveu relatorio para ${options.resolvedUrl}, e nenhum erro foi reportado pelo cluster. ` +
        `Chaves recebidas: ${Object.keys(reports).join(', ') || '(nenhuma)'}. ` +
        `Verifique logs/error.log e docs/debugging.md.`,
      'qualweb',
    );
  }

  return {
    raw,
    diagnostics,
    finalUrl,
    timings: {
      browserLaunchMs: Math.round(browserLaunchMs),
      navigationMs: navigationMs === null ? null : Math.round(navigationMs),
      qualwebMs: Math.round(qualwebMs),
      modulesMs,
      page: pageTiming,
    },
  };
}

async function safeStop(qualweb: QualWeb, logger: Logger): Promise<void> {
  try {
    logger.info('BROWSER', 'Closing Chromium');
    await qualweb.stop();
    logger.info('BROWSER', 'Chromium closed');
  } catch (error) {
    logger.error('BROWSER', 'Failed to close Chromium', error);
  }
}

async function settle(promises: Promise<void>[]): Promise<void> {
  await Promise.allSettled(promises);
}

async function readNavigationTiming(page: Page): Promise<Record<string, number> | null> {
  return page.evaluate((): Record<string, number> => {
    // `performance` aqui e o global do browser. Nao importar node:perf_hooks neste
    // arquivo com o nome `performance` sem cuidado: o esbuild reescreveria tambem
    // esta referencia. Ver docs/qualweb.md.
    const perf = performance as unknown as { getEntriesByType(type: string): PerformanceEntry[] };
    const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return {};
    return {
      dnsMs: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
      connectMs: Math.round(nav.connectEnd - nav.connectStart),
      ttfbMs: Math.round(nav.responseStart - nav.requestStart),
      responseMs: Math.round(nav.responseEnd - nav.responseStart),
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadMs: Math.round(nav.loadEventEnd - nav.startTime),
    };
  });
}

/**
 * Espera o DOM parar de sofrer mutações por `quietMs`, com um teto de `maxMs`.
 *
 * Motivo: aplicações client-side-rendered antigas (ex.: AngularJS + UI-Router)
 * costumam fazer, DEPOIS do evento `load`, uma cadeia de redirecionamento via hash
 * + chamada assíncrona + nova renderização — o QualWeb, avaliando logo após o
 * `load`/`networkidle2`, captura uma casca quase vazia. Um caso real observado:
 * `https://.../ouvidoria/sinop/#/portal/1/home` só populava o conteúdo ~4 s depois
 * do load (a app roteia primeiro para `#/carregarUg`, busca dados, e só então
 * redireciona para a rota final). Ver docs/qualweb.md.
 *
 * A heurística é genérica (MutationObserver), sem depender de seletores de nenhum
 * framework específico, e o teto evita espera indefinida em páginas com atividade
 * contínua (carrosséis, relógios, anúncios).
 */
async function waitForDomSettle(page: Page, quietMs: number, maxMs: number, logger: Logger): Promise<void> {
  const deadline = performance.now() + maxMs;
  let attempts = 0;
  let sawIntermediateNavigation = false;

  while (true) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) break;
    attempts += 1;

    let settled: boolean;
    try {
      // Sem funcao local nomeada (nada de `const check = () => {...}`) neste callback:
      // o esbuild do tsx injeta uma chamada a um helper `__name(...)` para preservar
      // nomes de funcao (keep-names), mas o texto do callback e enviado como STRING
      // para o contexto do browser via page.evaluate() — onde esse helper nao existe.
      // Sintoma visto aqui: "__name is not defined" tratado (erroneamente) como
      // contexto destruido. So variaveis e um setInterval anonimo, nunca uma const
      // de funcao. Mesma familia de armadilha documentada em docs/qualweb.md secao 4.
      settled = await page.evaluate(
        ({ quietMs: quiet, maxMs: max, minFloorMs: floor }): Promise<boolean> => {
          return new Promise<boolean>((resolve) => {
            if (!document.documentElement) {
              resolve(true);
              return;
            }
            let lastMutationAt = Date.now();
            const startedAtInPage = Date.now();
            const observer = new MutationObserver(() => {
              lastMutationAt = Date.now();
            });
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true,
            });
            const interval = setInterval(() => {
              const now = Date.now();
              const elapsedTotal = now - startedAtInPage;
              const quietFor = now - lastMutationAt;
              // O piso minimo existe para nao confiar num silencio precoce: uma SPA
              // pode ficar visualmente parada por uns instantes ANTES de disparar o
              // fetch/redirect que traz o conteudo de verdade (o caso real que
              // motivou este recurso tinha ~1-4s de silencio inicial). So aceitamos
              // "quieto" depois de observar por pelo menos `floor` ms.
              if (elapsedTotal >= floor && quietFor >= quiet) {
                clearInterval(interval);
                observer.disconnect();
                resolve(true);
              } else if (elapsedTotal >= max) {
                clearInterval(interval);
                observer.disconnect();
                resolve(false);
              }
            }, 100);
          });
        },
        { quietMs, maxMs: remaining, minFloorMs: Math.min(Math.max(quietMs * 2, 1000), remaining) },
      );
    } catch (error) {
      // O contexto de execucao foi destruido: uma nova navegacao comecou NO MEIO da
      // espera. E o caso do exemplo real que motivou este recurso — a app faz um
      // primeiro redirect via hash, busca dados, e so ENTAO navega de fato para a
      // rota final (nao um simples hashchange, uma navegacao completa que derruba o
      // execution context do evaluate() em andamento). Isso nao e falha: e o sinal
      // de que ainda ha conteudo relevante por vir. Aguarda o documento se
      // reestabilizar e tenta assentar de novo, dentro do orcamento restante.
      sawIntermediateNavigation = true;
      logger.debug('APP', `SPA settle: contexto destruído por navegação intermediária (tentativa ${attempts})`, {
        error: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }

    if (settled) {
      logger.info(
        'APP',
        `SPA settle: DOM quieto (limiar ${quietMs} ms, tentativa ${attempts})${
          sawIntermediateNavigation ? ' — após navegação intermediária' : ''
        }`,
      );
      return;
    }

    break;
  }

  logger.warn(
    'APP',
    `SPA settle: limite de ${maxMs} ms atingido sem o DOM ficar quieto definitivamente${
      sawIntermediateNavigation ? ' (após navegação(ões) intermediária(s))' : ''
    } — página pode ainda estar renderizando, ou atualiza continuamente`,
  );
}

function attachDiagnostics(
  page: Page,
  diagnostics: EvaluationDiagnostics,
  logger: Logger,
  maxRedirects: number,
): void {
  page.on('console', (message: ConsoleMessage) => {
    const entry: ConsoleEntry = { type: message.type(), text: message.text(), at: new Date().toISOString() };
    diagnostics.consoleMessages.push(entry);
    logger.debug('TARGET PAGE', `console.${entry.type}: ${entry.text.slice(0, 500)}`);
  });

  page.on('pageerror', (error: Error) => {
    diagnostics.pageErrors.push(`${error.name}: ${error.message}`);
    logger.error('TARGET PAGE', 'Uncaught JavaScript error on evaluated page', error);
  });

  page.on('requestfailed', (request: HTTPRequest) => {
    const failure: NetworkFailure = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      ...(request.failure()?.errorText ? { errorText: request.failure()!.errorText } : {}),
    };
    diagnostics.networkFailures.push(failure);
    logger.warn('BROWSER', `Request failed: ${failure.method} ${failure.url}`, { error: failure.errorText });
  });

  page.on('response', (response: HTTPResponse) => {
    const status = response.status();
    const request = response.request();
    const frame = request.frame();

    // Documento principal: requisicao de navegacao num frame sem pai.
    // Nao comparar `response.frame() === page.mainFrame()`: durante a primeira
    // navegacao o frame pode ainda nao estar associado e o documento e perdido.
    const isMainDocument =
      request.resourceType() === 'document' &&
      request.isNavigationRequest() &&
      (frame === null || frame.parentFrame() === null);

    if (isMainDocument) {
      if (status >= 300 && status < 400) {
        const hop: RedirectHop = { from: response.url(), status, to: response.headers()['location'] ?? '' };
        diagnostics.redirects.push(hop);
        logger.info('BROWSER', `HTTP ${status} redirect`, { from: hop.from, to: hop.to });
        if (diagnostics.redirects.length > maxRedirects) {
          logger.warn('BROWSER', `Redirect limit exceeded (MAX_REDIRECTS=${maxRedirects})`);
        }
      } else {
        diagnostics.httpStatus = status;
        logger.info('BROWSER', `HTTP ${status} ${response.url()}`);
      }
    } else if (status >= 400) {
      diagnostics.networkFailures.push({
        url: response.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status,
      });
      logger.warn('BROWSER', `HTTP ${status} on subresource ${response.url()}`);
    }
  });
}
