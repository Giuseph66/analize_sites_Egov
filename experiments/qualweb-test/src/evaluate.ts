/**
 * FASE 1 - Prova de conceito isolada do motor QualWeb.
 *
 * Executa uma avaliacao completa (ACT Rules + WCAG Techniques + Best Practices
 * + Counter) sobre uma URL, imprimindo progresso real e gravando o JSON bruto
 * produzido pelo QualWeb em data/raw/.
 *
 * Uso:
 *   npm run evaluate -- https://example.com
 *   npm run evaluate -- http://localhost:5173 --headful
 */

import { mkdir, writeFile } from 'node:fs/promises';
// NOTA: nao importar 'node:perf_hooks'. O esbuild (tsx) reescreve o identificador
// `performance` tambem dentro das funcoes passadas a page.evaluate(), que rodam no
// contexto do browser, causando "ReferenceError: import_node_perf_hooks is not defined".
// Node >= 18 expoe `performance` como global, entao o import e desnecessario.
import { resolve } from 'node:path';

import {
  ExecutableModuleContext,
  QualWeb,
  type CounterReport,
  type EvaluationReport,
  type ModuleOptions,
  type ModuleType,
  type QualwebOptions,
  type QualwebReport,
  type TestingData,
} from '@qualweb/core';

// @qualweb/core nao reexporta QualwebPage nem TranslationOptions no index publico,
// mas ambos aparecem na assinatura de ExecutableModuleContext.execute().
type ExecuteArgs = Parameters<ExecutableModuleContext['execute']>;
type QualwebPage = ExecuteArgs[0];
type TranslationOptions = ExecuteArgs[1];
import { ACTRules } from '@qualweb/act-rules';
import { WCAGTechniques } from '@qualweb/wcag-techniques';
import { BestPractices } from '@qualweb/best-practices';
import { Counter } from '@qualweb/counter';
import type { ConsoleMessage, HTTPRequest, HTTPResponse, Page } from 'puppeteer';

// --------------------------------------------------------------------------
// Logger minimo (a versao definitiva vive em packages/logger)
// --------------------------------------------------------------------------

const startedAtWallclock = Date.now();

type Source = 'APP' | 'BROWSER' | 'TARGET PAGE' | 'QUALWEB';

function stamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function log(source: Source, message: string, extra?: unknown): void {
  const line = `[${stamp()}] [${source.padEnd(11)}] ${message}`;
  if (extra === undefined) {
    console.log(line);
  } else {
    console.log(line, typeof extra === 'string' ? extra : JSON.stringify(extra));
  }
}

function logError(source: Source, message: string, error?: unknown): void {
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : error !== undefined ? String(error) : '';
  console.error(`[${stamp()}] [${source.padEnd(11)}] ERROR ${message}${detail ? ' | ' + detail : ''}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
}

// --------------------------------------------------------------------------
// Instrumentacao dos modulos QualWeb
//
// O core executa os modulos num laco interno (EvaluationManager.evaluate) e nao
// emite eventos de progresso. Para saber quando cada modulo comeca/termina sem
// alterar o core, embrulhamos cada modulo num decorador que delega para o
// modulo real e cronometra a chamada.
// --------------------------------------------------------------------------

class InstrumentedModule extends ExecutableModuleContext {
  public readonly name: ModuleType;

  constructor(private readonly inner: ExecutableModuleContext) {
    super(inner.options);
    this.name = inner.name;
  }

  public override async execute(
    page: QualwebPage,
    translate: TranslationOptions,
    data: TestingData,
  ): Promise<EvaluationReport | CounterReport> {
    log('QUALWEB', `module ${this.name} started`);
    const t0 = performance.now();
    try {
      const report = await this.inner.execute(page, translate, data);
      const ms = performance.now() - t0;
      const meta = (report as EvaluationReport).metadata;
      if (meta) {
        log(
          'QUALWEB',
          `module ${this.name} completed in ${ms.toFixed(0)} ms | ` +
            `passed=${meta.passed} warning=${meta.warning} failed=${meta.failed} inapplicable=${meta.inapplicable}`,
        );
      } else {
        log('QUALWEB', `module ${this.name} completed in ${ms.toFixed(0)} ms`);
      }
      moduleTimings[this.name] = ms;
      return report;
    } catch (error) {
      logError('QUALWEB', `module ${this.name} failed after ${(performance.now() - t0).toFixed(0)} ms`, error);
      throw error;
    }
  }

  // Nunca alcancados: execute() e sobrescrito acima e delega ao modulo interno.
  protected getModulePackage(): string {
    throw new Error('InstrumentedModule.getModulePackage should never be called');
  }

  protected runModule(
    _page: QualwebPage,
    _options: ModuleOptions,
    _translate: TranslationOptions,
    _data: TestingData,
  ): Promise<EvaluationReport | CounterReport> {
    throw new Error('InstrumentedModule.runModule should never be called');
  }
}

const moduleTimings: Record<string, number> = {};

// --------------------------------------------------------------------------
// Diagnostico da pagina alvo
// --------------------------------------------------------------------------

interface NetworkFailure {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  errorText?: string;
}

interface Diagnostics {
  browserVersion?: string;
  browserPid?: number;
  userAgent?: string;
  viewport?: { width: number; height: number } | null;
  initialUrl: string;
  finalUrl?: string;
  httpStatus?: number;
  redirects: Array<{ from: string; status: number; to: string }>;
  consoleMessages: Array<{ type: string; text: string }>;
  pageErrors: string[];
  networkFailures: NetworkFailure[];
  navigationTiming?: Record<string, number>;
}

function attachPageDiagnostics(nativePage: Page, url: string, diag: Diagnostics): void {
  nativePage.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    const text = msg.text();
    diag.consoleMessages.push({ type, text });
    log('TARGET PAGE', `console.${type}: ${text.slice(0, 500)}`);
  });

  nativePage.on('pageerror', (error: Error) => {
    diag.pageErrors.push(`${error.name}: ${error.message}`);
    logError('TARGET PAGE', 'uncaught javascript error', error);
  });

  nativePage.on('requestfailed', (request: HTTPRequest) => {
    const failure: NetworkFailure = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText,
    };
    diag.networkFailures.push(failure);
    log('BROWSER', `request failed ${failure.method} ${failure.url} (${failure.errorText})`);
  });

  nativePage.on('response', (response: HTTPResponse) => {
    if (process.env.DEBUG_RESPONSES) {
      const rq = response.request();
      const fr = rq.frame();
      console.log('DBG RESP', response.status(), rq.resourceType(), 'nav=', rq.isNavigationRequest(), 'frame=', fr === null ? 'null' : fr.parentFrame() === null ? 'top' : 'child', response.url().slice(0, 70));
    }
    const status = response.status();
    const request = response.request();
    const frame = request.frame();
    // Nao usar `response.frame() === page.mainFrame()`: durante a primeira navegacao
    // o frame pode ainda nao estar associado, e o documento principal era descartado
    // silenciosamente (HTTP status aparecia como "n/a" em http://localhost).
    const isMainDocument =
      request.resourceType() === 'document' && request.isNavigationRequest() && (frame === null || frame.parentFrame() === null);

    if (isMainDocument) {
      if (status >= 300 && status < 400) {
        const location = response.headers()['location'] ?? '';
        diag.redirects.push({ from: response.url(), status, to: location });
        log('BROWSER', `HTTP ${status} redirect ${response.url()} -> ${location}`);
      } else {
        diag.httpStatus = status;
        log('BROWSER', `HTTP ${status} ${response.url()}`);
      }
    } else if (status >= 400) {
      diag.networkFailures.push({
        url: response.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status,
      });
      log('BROWSER', `HTTP ${status} on subresource ${response.url()}`);
    }
  });

  log('APP', `diagnostics attached for ${url}`);
}

// --------------------------------------------------------------------------
// Execucao
// --------------------------------------------------------------------------

interface CliArgs {
  url: string;
  headful: boolean;
  timeout: number;
}

function parseArgs(argv: string[]): CliArgs {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = argv.filter((a) => a.startsWith('--'));

  if (positional.length === 0) {
    throw new Error('Uso: npm run evaluate -- <url> [--headful] [--timeout=60000]');
  }

  const timeoutFlag = flags.find((f) => f.startsWith('--timeout='));

  return {
    url: positional[0],
    headful: flags.includes('--headful'),
    timeout: timeoutFlag ? Number(timeoutFlag.split('=')[1]) : 60_000,
  };
}

function summarize(report: QualwebReport): void {
  console.log('');
  console.log('================= RESUMO =================');
  console.log(`URL de entrada : ${report.system.url?.inputUrl ?? '(html)'}`);
  console.log(`URL final      : ${report.system.url?.completeUrl ?? '-'}`);
  console.log(`Titulo         : ${report.system.page.dom.title}`);
  console.log(`Elementos DOM  : ${report.system.page.dom.elementCount}`);
  console.log(`QualWeb version: ${report.system.version}`);
  console.log('');
  console.log('Totais agregados:');
  console.log(`  passed        : ${report.metadata.passed}`);
  console.log(`  warning       : ${report.metadata.warning}`);
  console.log(`  failed        : ${report.metadata.failed}`);
  console.log(`  inapplicable  : ${report.metadata.inapplicable}`);
  console.log('');

  for (const [moduleName, moduleReport] of Object.entries(report.modules)) {
    if (!moduleReport) continue;
    if ('assertions' in moduleReport) {
      const assertions = Object.keys(moduleReport.assertions).length;
      const m = moduleReport.metadata;
      console.log(
        `  ${moduleName.padEnd(16)} regras=${String(assertions).padStart(3)} ` +
          `passed=${m.passed} warning=${m.warning} failed=${m.failed} inapplicable=${m.inapplicable} ` +
          `(${(moduleTimings[moduleName] ?? 0).toFixed(0)} ms)`,
      );
    } else {
      console.log(`  ${moduleName.padEnd(16)} (counter module)`);
    }
  }

  console.log('');
  console.log('Regras com verdict "failed":');
  let printed = 0;
  for (const moduleReport of Object.values(report.modules)) {
    if (!moduleReport || !('assertions' in moduleReport)) continue;
    for (const assertion of Object.values(moduleReport.assertions)) {
      if (assertion.metadata.outcome !== 'failed') continue;
      const criteria = (assertion.metadata['success-criteria'] ?? [])
        .map((sc) => `${sc.name} (${sc.level})`)
        .join(', ');
      console.log(`  - ${assertion.code} ${assertion.name}`);
      if (criteria) console.log(`      criterios: ${criteria}`);
      const firstFail = assertion.results.find((r) => r.verdict === 'failed');
      const element = firstFail?.elements?.[0];
      if (element?.pointer) console.log(`      seletor  : ${element.pointer}`);
      if (element?.htmlCode) console.log(`      html     : ${element.htmlCode.replace(/\s+/g, ' ').slice(0, 160)}`);
      printed++;
    }
  }
  if (printed === 0) console.log('  (nenhuma)');
  console.log('==========================================');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const repoRoot = resolve(__dirname, '../../..');
  const rawDir = resolve(repoRoot, 'data/raw');

  log('APP', `node ${process.version} | platform ${process.platform} ${process.arch}`);
  log('APP', `target url: ${args.url}`);
  log('APP', `headless: ${!args.headful} | timeout: ${args.timeout} ms`);

  const diag: Diagnostics = {
    initialUrl: args.url,
    redirects: [],
    consoleMessages: [],
    pageErrors: [],
    networkFailures: [],
  };

  const qualweb = new QualWeb({ adBlock: false, stealth: false });

  qualweb.use({
    async beforePageLoad(page, url) {
      const nativePage = page.nativePage as Page;
      const browser = nativePage.browser();

      // IMPORTANTE: anexar os listeners ANTES de qualquer await.
      //
      // @qualweb/core 0.9.5 tem um bug em PluginManager.executeBeforePageLoad:
      //   this.plugins.forEach(async (plugin) => await plugin.beforePageLoad?.(...))
      // `Array.prototype.forEach` ignora a promise devolvida pelo callback, logo o
      // core NAO espera o plugin terminar e ja inicia page.goto(). Se fizermos
      // qualquer await antes de registrar os handlers, perdemos a resposta HTTP do
      // documento principal (o status aparecia como "n/a" em http://localhost).
      attachPageDiagnostics(nativePage, url, diag);
      log('APP', `navigating to ${url}`);

      diag.browserPid = browser.process()?.pid;
      diag.browserVersion = await browser.version();
      diag.userAgent = await browser.userAgent();

      log('BROWSER', `browser version: ${diag.browserVersion}`);
      log('BROWSER', `browser pid: ${diag.browserPid ?? 'unknown'}`);
      log('BROWSER', `user-agent: ${diag.userAgent}`);
    },

    async afterPageLoad(page) {
      const nativePage = page.nativePage as Page;
      diag.finalUrl = nativePage.url();
      diag.viewport = nativePage.viewport();

      log('APP', `DOM loaded | final url: ${diag.finalUrl}`);
      log('BROWSER', `viewport: ${diag.viewport?.width}x${diag.viewport?.height}`);

      try {
        diag.navigationTiming = await nativePage.evaluate((): Record<string, number> => {
          const perf = performance as unknown as { getEntriesByType(t: string): PerformanceEntry[] };
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
        log('TARGET PAGE', 'navigation timing', diag.navigationTiming);
      } catch (error) {
        logError('TARGET PAGE', 'could not read navigation timing', error);
      }
    },
  });

  const options: QualwebOptions = {
    url: args.url,
    modules: [
      new InstrumentedModule(new ACTRules()),
      new InstrumentedModule(new WCAGTechniques()),
      new InstrumentedModule(new BestPractices()),
      new InstrumentedModule(new Counter()),
    ],
    waitUntil: ['load', 'networkidle2'],
    timeout: args.timeout,
    translate: 'en',
  };

  const tStart = performance.now();

  log('APP', 'launching chromium (QualWeb puppeteer-cluster pool)');
  const tLaunch = performance.now();

  await qualweb.start(
    { maxConcurrency: 1, timeout: args.timeout * 4, monitor: false },
    {
      headless: !args.headful,
      executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--ignore-certificate-errors',
        '--no-first-run',
      ],
    },
  );

  log('BROWSER', `chromium pool ready in ${(performance.now() - tLaunch).toFixed(0)} ms`);

  let reports: Record<string, QualwebReport>;
  const tEval = performance.now();
  try {
    log('QUALWEB', 'starting evaluation');
    reports = await qualweb.evaluate(options);
    log('QUALWEB', `evaluation finished in ${(performance.now() - tEval).toFixed(0)} ms`);
  } finally {
    log('BROWSER', 'closing chromium');
    await qualweb.stop();
    log('BROWSER', 'chromium closed');
  }

  const report = reports[args.url];
  if (!report) {
    throw new Error(
      `QualWeb nao retornou relatorio para "${args.url}". Chaves recebidas: ${Object.keys(reports).join(', ') || '(nenhuma)'}`,
    );
  }

  const durationMs = performance.now() - tStart;

  await mkdir(rawDir, { recursive: true });
  const host = (() => {
    try {
      return new URL(args.url).host.replace(/[^a-zA-Z0-9._-]/g, '_');
    } catch {
      return 'unknown-host';
    }
  })();
  const fileStamp = new Date(startedAtWallclock).toISOString().replace(/[:.]/g, '').replace(/-/g, '-');
  const rawPath = resolve(rawDir, `${fileStamp}-${host}.json`);

  await writeFile(
    rawPath,
    JSON.stringify(
      {
        _experiment: {
          tool: 'experiments/qualweb-test',
          node: process.version,
          durationMs: Math.round(durationMs),
          moduleTimings,
          diagnostics: diag,
        },
        report,
      },
      null,
      2,
    ),
    'utf-8',
  );

  log('APP', `raw report saved: ${rawPath}`);

  summarize(report);

  console.log('');
  console.log('--------------- DIAGNOSTICO --------------');
  console.log(`HTTP status        : ${diag.httpStatus ?? 'n/a'}`);
  console.log(`Redirects          : ${diag.redirects.length}`);
  console.log(`Console messages   : ${diag.consoleMessages.length}`);
  console.log(`Page JS errors     : ${diag.pageErrors.length}`);
  console.log(`Network failures   : ${diag.networkFailures.length}`);
  console.log(`Browser            : ${diag.browserVersion}`);
  console.log(`Duracao total      : ${(durationMs / 1000).toFixed(1)} s`);
  console.log('------------------------------------------');
}

main().catch((error) => {
  logError('APP', 'evaluation aborted', error);
  process.exitCode = 1;
});
