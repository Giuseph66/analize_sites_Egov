/**
 * EvaluationService: recebe URLs, enfileira, executa e persiste.
 *
 * A fila e em memoria de proposito (§22): o objetivo e limitar Chromiums
 * simultaneos, nao sobreviver a reinicios. Nada de Redis no MVP.
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { EmitterSink, type Logger, MemorySink } from '@lae/logger';
import {
  buildAccessMonitorLayer,
  extractPageInfo,
  getScoringStrategy,
  normalizeQualwebReport,
  type RawQualwebReport,
} from '@lae/report-normalizer';
import type {
  EvaluationEvent,
  EvaluationFailure,
  EvaluationMetadata,
  EvaluationReport,
  EvaluationStage,
  LogEntry,
  VersionInfo,
} from '@lae/shared-types';

import type { EvaluatorConfig } from './config';
import { EngineError, runEvaluation } from './engine';
import type { EvaluationRepository } from './repository';
import { UrlPolicyError, resolveUrl } from './url-policy';
import { appVersion, qualwebVersions } from './versions';

export class QueueFullError extends Error {
  constructor(readonly maxQueueSize: number) {
    super(`Fila cheia (MAX_QUEUE_SIZE=${maxQueueSize}). Tente novamente em instantes.`);
    this.name = 'QueueFullError';
  }
}

interface QueueItem {
  id: string;
  requestId: string;
  url: string;
}

export class EvaluationService extends EventEmitter {
  private readonly queue: QueueItem[] = [];
  private readonly running = new Set<string>();
  private readonly durations: number[] = [];
  private lastCompleted: EvaluationMetadata | null = null;
  private totalCreated = 0;
  private shuttingDown = false;

  constructor(
    private readonly config: EvaluatorConfig,
    private readonly repository: EvaluationRepository,
    private readonly logger: Logger,
    private readonly emitterSink: EmitterSink,
  ) {
    super();
    this.setMaxListeners(0);
  }

  // -------------------------------------------------------------------------
  // API publica
  // -------------------------------------------------------------------------

  async create(url: string, requestId: string): Promise<EvaluationMetadata> {
    if (this.queue.length >= this.config.maxQueueSize) throw new QueueFullError(this.config.maxQueueSize);

    const id = randomUUID();
    const now = new Date().toISOString();

    const metadata: EvaluationMetadata = {
      id,
      requestId,
      url,
      resolvedUrl: null,
      status: 'queued',
      stage: 'created',
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      error: null,
    };

    await this.repository.create(metadata);
    this.totalCreated += 1;

    const log = this.logger.child({ evaluationId: id, requestId });
    log.info('APP', 'CREATED');
    log.info('APP', `URL: ${url}`);
    log.info('APP', `Queue position: ${this.queue.length + 1} | running: ${this.running.size}/${this.config.maxConcurrentEvaluations}`);

    this.queue.push({ id, requestId, url });
    this.emitStage(id, 'queued');
    queueMicrotask(() => void this.drain());

    return metadata;
  }

  get(id: string): Promise<EvaluationMetadata | null> {
    return this.repository.get(id);
  }

  getReport(id: string): Promise<EvaluationReport | null> {
    return this.repository.getReport(id);
  }

  getRawReport(id: string): Promise<unknown | null> {
    return this.repository.getRawReport(id);
  }

  list(limit?: number): Promise<EvaluationMetadata[]> {
    return this.repository.list(limit);
  }

  async getLogs(id: string): Promise<LogEntry[]> {
    const persisted = await this.repository.getLogs(id);
    if (persisted.length > 0) return persisted;
    // Avaliacao ainda em andamento: os logs so existem em memoria.
    return this.memorySink?.forEvaluation(id) ?? [];
  }

  /**
   * Chamado pelo handler de SIGTERM/SIGINT antes de fechar o servidor. Uma avaliacao
   * em andamento vai falhar porque o Chromium cai junto com o processo — e, sem este
   * sinal, o erro que chega ao usuario e um "Navigating frame was detached" opaco.
   * Com `tsx watch`, salvar qualquer arquivo dispara exatamente isso.
   */
  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  /** Sink em memoria usado para servir logs de avaliacoes ainda em execucao. */
  memorySink: MemorySink | null = null;

  /** Assina os eventos de uma avaliacao (usado pelo SSE). */
  subscribe(id: string, listener: (event: EvaluationEvent) => void): () => void {
    const onLog = (entry: LogEntry): void => listener({ type: 'log', entry });
    const onEvent = (event: EvaluationEvent): void => listener(event);

    this.emitterSink.on(`log:${id}`, onLog);
    this.on(`event:${id}`, onEvent);

    return () => {
      this.emitterSink.off(`log:${id}`, onLog);
      this.off(`event:${id}`, onEvent);
    };
  }

  stats(): {
    running: string[];
    queued: number;
    total: number;
    averageDurationMs: number | null;
    lastCompleted: EvaluationMetadata | null;
  } {
    const average =
      this.durations.length === 0
        ? null
        : Math.round(this.durations.reduce((sum, value) => sum + value, 0) / this.durations.length);
    return {
      running: [...this.running],
      queued: this.queue.length,
      total: this.totalCreated,
      averageDurationMs: average,
      lastCompleted: this.lastCompleted,
    };
  }

  versions(chromium: string | null): VersionInfo {
    const qw = qualwebVersions();
    return {
      app: appVersion(),
      node: process.version,
      chromium,
      qualwebCore: qw.core,
      qualwebActRules: qw.actRules,
      qualwebWcagTechniques: qw.wcagTechniques,
      qualwebBestPractices: qw.bestPractices,
      qualwebCounter: qw.counter,
      qualwebSystem: null,
    };
  }

  // -------------------------------------------------------------------------
  // Execucao
  // -------------------------------------------------------------------------

  private async drain(): Promise<void> {
    while (this.running.size < this.config.maxConcurrentEvaluations && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;
      this.running.add(item.id);
      void this.execute(item).finally(() => {
        this.running.delete(item.id);
        void this.drain();
      });
    }
  }

  private async execute(item: QueueItem): Promise<void> {
    const log = this.logger.child({ evaluationId: item.id, requestId: item.requestId });
    const startedAt = new Date();
    const startedMs = performance.now();

    await this.repository.update(item.id, { status: 'running', startedAt: startedAt.toISOString() });
    this.emitStatus(item.id, 'running');

    try {
      const resolved = resolveUrl(item.url, {
        allowLocalNetwork: this.config.allowLocalNetwork,
        allowFileProtocol: this.config.allowFileProtocol,
        localhostAlias: this.config.localhostAlias,
      });

      log.info('APP', `User URL: ${resolved.inputUrl}`);
      log.info('APP', `Resolved URL: ${resolved.resolvedUrl}${resolved.rewritten ? ' (host reescrito para o container)' : ''}`);

      await this.repository.update(item.id, { resolvedUrl: resolved.resolvedUrl });
      this.emitStage(item.id, 'url-resolved');

      const engineResult = await runEvaluation(
        {
          resolvedUrl: resolved.resolvedUrl,
          headless: this.config.browserHeadless,
          browserExecutablePath: this.config.browserExecutablePath,
          pageTimeout: this.config.pageTimeout,
          evaluationTimeout: this.config.evaluationTimeout,
          maxRedirects: this.config.maxRedirects,
          spaSettleQuietMs: this.config.spaSettleQuietMs,
          spaSettleMaxMs: this.config.spaSettleMaxMs,
          restoreNativePrototypes: this.config.restoreNativePrototypes,
          captureScreenshot: this.config.captureScreenshot,
          saveHtml: this.config.saveHtml,
          artifactDir: this.repository.artifactDir(item.id),
          onStage: (stage) => {
            if (stage === 'counter') return; // counter nao e uma etapa visivel na UI
            this.emitStage(item.id, stage as EvaluationStage);
          },
        },
        log,
      );

      log.info('APP', 'Normalizing results');
      this.emitStage(item.id, 'normalizing');
      const normalizationStartedAt = performance.now();

      const raw = engineResult.raw as RawQualwebReport;
      const versions = this.versions(engineResult.diagnostics.browserVersion);
      const normalized = normalizeQualwebReport(raw, versions.qualwebCore);
      versions.qualwebSystem = normalized.qualwebSystemVersion;

      // Camada AccessMonitor: mesmo pipeline do validador da AMA (e do AMAWeb),
      // sobre o relatorio bruto. Falha aqui nao derruba a avaliacao: fica null e
      // o motivo vai para o relatorio e para o log.
      const accessmonitor = buildAccessMonitorLayer(raw, normalized.results);
      if (accessmonitor.summary) {
        const s = accessmonitor.summary;
        log.info('APP', `AccessMonitor: ${s.totalTests} testes, nota ${s.score}, erros A/AA/AAA ${s.conform.A}/${s.conform.AA}/${s.conform.AAA} (ruleset ${s.packageVersion})`);
      } else {
        log.warn('APP', `AccessMonitor indisponível nesta avaliação: ${accessmonitor.error ?? 'motivo desconhecido'}`);
      }

      const score = getScoringStrategy(this.config.scoringStrategy).compute({
        results: normalized.results,
        accessmonitor: accessmonitor.summary,
      });
      const normalizationMs = Math.round(performance.now() - normalizationStartedAt);

      const finishedAt = new Date();
      const duration = Math.round(performance.now() - startedMs);

      const report: EvaluationReport = {
        id: item.id,
        url: resolved.inputUrl,
        resolvedUrl: resolved.resolvedUrl,
        finalUrl: engineResult.finalUrl,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        duration,
        score,
        summary: normalized.summary,
        wcagFailures: normalized.wcagFailures,
        rulesByModule: normalized.rulesByModule,
        page: extractPageInfo(raw, engineResult.diagnostics.documentSizeBytes),
        versions,
        timings: {
          browserLaunchMs: engineResult.timings.browserLaunchMs,
          navigationMs: engineResult.timings.navigationMs,
          qualwebMs: engineResult.timings.qualwebMs,
          normalizationMs,
          totalMs: duration,
          modulesMs: engineResult.timings.modulesMs,
          page: engineResult.timings.page,
        },
        diagnostics: engineResult.diagnostics,
        results: normalized.results,
        accessmonitor: accessmonitor.summary,
        ...(accessmonitor.error ? { accessmonitorError: accessmonitor.error } : {}),
      };

      log.info('APP', 'Saving report', {
        passed: report.summary.passed,
        failed: report.summary.failed,
        warning: report.summary.warning,
        inapplicable: report.summary.inapplicable,
        rules: normalized.results.length,
        score: score.value,
      });
      this.emitStage(item.id, 'saving');

      await this.repository.saveRawReport(item.id, resolved.inputUrl, raw);
      await this.repository.saveReport(item.id, resolved.inputUrl, report);

      const updated = await this.repository.update(item.id, {
        status: 'completed',
        stage: 'completed',
        finishedAt: finishedAt.toISOString(),
        durationMs: duration,
      });

      this.durations.push(duration);
      if (this.durations.length > 100) this.durations.shift();
      this.lastCompleted = updated;

      log.info('APP', `Evaluation completed. Duration: ${(duration / 1000).toFixed(1)} s`);
      this.emitStage(item.id, 'completed');
      this.emitStatus(item.id, 'completed');
      this.emitDone(item.id, 'completed');
    } catch (error) {
      const failure = this.shuttingDown
        ? {
            kind: 'internal' as const,
            message:
              'A API recebeu SIGTERM/SIGINT durante a avaliação e o Chromium caiu junto (reinício do ' +
              'servidor — com `tsx watch`, salvar um arquivo faz isso). Não é um problema da página: ' +
              'rode a avaliação de novo. Erro original: ' +
              (error instanceof Error ? error.message : String(error)),
          }
        : toFailure(error);
      log.error('APP', `Evaluation failed (${failure.kind}): ${failure.message}`, error);

      const finishedAt = new Date();
      await this.repository.update(item.id, {
        status: 'failed',
        stage: 'failed',
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.round(performance.now() - startedMs),
        error: failure,
      });

      this.emitStage(item.id, 'failed');
      this.emitStatus(item.id, 'failed');
      this.emitDone(item.id, 'failed');
    } finally {
      // Persiste os logs da avaliacao (data/evaluations/<id>/logs.txt e .jsonl).
      const entries = this.memorySink?.forEvaluation(item.id) ?? [];
      if (entries.length > 0) {
        try {
          await this.repository.saveLogs(item.id, entries);
        } catch (error) {
          this.logger.error('APP', `Could not persist logs for evaluation ${item.id}`, error);
        }
      }
    }
  }

  // -------------------------------------------------------------------------

  private emitStage(id: string, stage: EvaluationStage): void {
    void this.repository.update(id, { stage }).catch(() => undefined);
    this.emit(`event:${id}`, { type: 'stage', stage, at: new Date().toISOString() } satisfies EvaluationEvent);
  }

  private emitStatus(id: string, status: EvaluationMetadata['status']): void {
    this.emit(`event:${id}`, { type: 'status', status, at: new Date().toISOString() } satisfies EvaluationEvent);
  }

  private emitDone(id: string, status: EvaluationMetadata['status']): void {
    this.emit(`event:${id}`, { type: 'done', status, at: new Date().toISOString() } satisfies EvaluationEvent);
  }
}

function toFailure(error: unknown): EvaluationFailure {
  if (error instanceof UrlPolicyError) {
    return { message: error.message, kind: error.kind, ...(error.stack ? { stack: error.stack } : {}) };
  }
  if (error instanceof EngineError) {
    return { message: error.message, kind: error.kind, ...(error.stack ? { stack: error.stack } : {}) };
  }
  if (error instanceof Error) {
    return { message: error.message, kind: 'internal', ...(error.stack ? { stack: error.stack } : {}) };
  }
  return { message: String(error), kind: 'internal' };
}
