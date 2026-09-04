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

import { QualWeb, type ModuleType, type QualwebOptions } from '@qualweb/core';
import { ACTRules } from '@qualweb/act-rules';
import { WCAGTechniques } from '@qualweb/wcag-techniques';
import { BestPractices } from '@qualweb/best-practices';
import { Counter } from '@qualweb/counter';
import type { ConsoleMessage, HTTPRequest, HTTPResponse, Page } from 'puppeteer';

import type { Logger } from '@lae/logger';
import type { ConsoleEntry, EvaluationDiagnostics, NetworkFailure, RedirectHop } from '@lae/shared-types';

import { InstrumentedModule } from './instrumented-module';

export interface EngineRunOptions {
  resolvedUrl: string;
  headless: boolean;
  browserExecutablePath: string | null;
  pageTimeout: number;
  evaluationTimeout: number;
  maxRedirects: number;
  captureScreenshot: boolean;
  saveHtml: boolean;
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

  const qualweb = new QualWeb({ adBlock: false, stealth: false });

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
    const kind = /timeout|timed out/i.test(message) ? 'timeout' : 'qualweb';
    throw new EngineError(`QualWeb falhou: ${message}`, kind, error);
  }

  const qualwebMs = performance.now() - evaluationStartedAt;
  logger.info('QUALWEB', `QualWeb finished in ${Math.round(qualwebMs)} ms`);

  await settle(pendingCaptures);
  await safeStop(qualweb, logger);

  const raw = reports[options.resolvedUrl];
  if (!raw) {
    throw new EngineError(
      `QualWeb nao devolveu relatorio para ${options.resolvedUrl}. Chaves recebidas: ${
        Object.keys(reports).join(', ') || '(nenhuma)'
      }`,
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
