import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  type EvaluationService,
  type EvaluatorConfig,
  QueueFullError,
  UrlPolicyError,
  resolveUrl,
} from '@lae/evaluator';
import type { Logger, MemorySink } from '@lae/logger';
import type {
  CreateEvaluationRequest,
  CreateEvaluationResponse,
  DebugResponse,
  EvaluationEvent,
} from '@lae/shared-types';

import type { HealthProbe } from './health';

export interface RouteDeps {
  service: EvaluationService;
  config: EvaluatorConfig;
  health: HealthProbe;
  logger: Logger;
  memory: MemorySink;
  startedAt: Date;
}

interface IdParams {
  id: string;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { service, config, health, memory, startedAt } = deps;

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  app.get('/api/health', async (request, reply) => {
    const force = (request.query as { deep?: string }).deep === '1';
    const result = await health.check(force);
    reply.code(result.status === 'ok' ? 200 : 503);
    return result;
  });

  // -------------------------------------------------------------------------
  // Avaliacoes
  // -------------------------------------------------------------------------

  app.post('/api/evaluations', async (request: FastifyRequest<{ Body: CreateEvaluationRequest }>, reply) => {
    const url = request.body?.url;
    if (typeof url !== 'string' || url.trim() === '') {
      return reply.code(400).send({ error: 'Campo "url" e obrigatorio.' });
    }

    // Valida antes de enfileirar: erro de URL deve virar 400, nao uma avaliacao falha.
    try {
      resolveUrl(url, {
        allowLocalNetwork: config.allowLocalNetwork,
        allowFileProtocol: config.allowFileProtocol,
        localhostAlias: config.localhostAlias,
      });
    } catch (error) {
      if (error instanceof UrlPolicyError) {
        return reply.code(error.kind === 'invalid-url' ? 400 : 403).send({ error: error.message, kind: error.kind });
      }
      throw error;
    }

    try {
      const metadata = await service.create(url, request.id);
      const body: CreateEvaluationResponse = { evaluationId: metadata.id, status: metadata.status };
      return reply.code(202).send(body);
    } catch (error) {
      if (error instanceof QueueFullError) return reply.code(429).send({ error: error.message });
      throw error;
    }
  });

  app.get('/api/evaluations', async (request) => {
    const limit = Number((request.query as { limit?: string }).limit ?? 50);
    return service.list(Number.isFinite(limit) ? limit : 50);
  });

  app.get('/api/evaluations/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const metadata = await service.get(request.params.id);
    if (!metadata) return reply.code(404).send({ error: 'Avaliacao nao encontrada.' });
    return metadata;
  });

  app.get('/api/evaluations/:id/report', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const report = await service.getReport(request.params.id);
    if (!report) {
      const metadata = await service.get(request.params.id);
      if (!metadata) return reply.code(404).send({ error: 'Avaliacao nao encontrada.' });
      return reply.code(409).send({ error: `Relatorio indisponivel: avaliacao esta "${metadata.status}".`, status: metadata.status });
    }
    return report;
  });

  app.get('/api/evaluations/:id/report/raw', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const raw = await service.getRawReport(request.params.id);
    if (!raw) return reply.code(404).send({ error: 'Relatorio bruto do QualWeb nao encontrado.' });
    reply.header('content-disposition', `attachment; filename="qualweb-${request.params.id}.json"`);
    return raw;
  });

  app.get('/api/evaluations/:id/report/earl', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const raw = await service.getRawReport(request.params.id);
    if (!raw) return reply.code(404).send({ error: 'Relatorio bruto do QualWeb nao encontrado.' });

    const metadata = await service.get(request.params.id);
    const key = metadata?.resolvedUrl ?? metadata?.url ?? 'report';

    try {
      // Import tardio: o earl-reporter puxa o core inteiro.
      const { generateEARLReport } = require('@qualweb/earl-reporter') as {
        generateEARLReport: (reports: Record<string, unknown>) => unknown;
      };
      const earl = generateEARLReport({ [key]: raw });
      reply.header('content-disposition', `attachment; filename="earl-${request.params.id}.json"`);
      return earl;
    } catch (error) {
      deps.logger.error('APP', 'EARL generation failed', error);
      return reply.code(500).send({
        error: 'Falha ao gerar o relatorio EARL.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/evaluations/:id/logs', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const metadata = await service.get(request.params.id);
    if (!metadata) return reply.code(404).send({ error: 'Avaliacao nao encontrada.' });
    return service.getLogs(request.params.id);
  });

  app.get('/api/evaluations/:id/screenshot', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const path = join(config.dataDir, 'evaluations', request.params.id, 'screenshot.png');
    if (!existsSync(path)) {
      return reply.code(404).send({ error: 'Screenshot nao disponivel. Habilite CAPTURE_SCREENSHOT=true.' });
    }
    return reply.type('image/png').send(require('node:fs').createReadStream(path));
  });

  app.get('/api/evaluations/:id/page.html', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const path = join(config.dataDir, 'evaluations', request.params.id, 'page.html');
    if (!existsSync(path)) {
      return reply.code(404).send({ error: 'HTML nao disponivel. Habilite SAVE_HTML=true.' });
    }
    return reply.type('text/plain; charset=utf-8').send(require('node:fs').createReadStream(path));
  });

  // -------------------------------------------------------------------------
  // Server-Sent Events (§8)
  // -------------------------------------------------------------------------

  app.get('/api/evaluations/:id/events', async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const { id } = request.params;
    const metadata = await service.get(id);
    if (!metadata) return reply.code(404).send({ error: 'Avaliacao nao encontrada.' });

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    const send = (event: EvaluationEvent): void => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    // Reenvia o que ja aconteceu, para quem conecta depois do inicio.
    for (const entry of await service.getLogs(id)) send({ type: 'log', entry });
    send({ type: 'status', status: metadata.status, at: new Date().toISOString() });

    const unsubscribe = service.subscribe(id, (event) => {
      send(event);
      if (event.type === 'done') {
        clearInterval(keepAlive);
        unsubscribe();
        reply.raw.end();
      }
    });

    // Comentario SSE periodico: impede proxies de fecharem a conexao ociosa.
    const keepAlive = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15_000);

    request.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });

    // Se a avaliacao ja terminou, encerra o stream imediatamente.
    if (metadata.status === 'completed' || metadata.status === 'failed') {
      send({ type: 'done', status: metadata.status, at: new Date().toISOString() });
      clearInterval(keepAlive);
      unsubscribe();
      reply.raw.end();
    }

    return reply;
  });

  // -------------------------------------------------------------------------
  // Observabilidade do desenvolvedor (§28)
  // -------------------------------------------------------------------------

  const debugHandler = async (): Promise<DebugResponse> => {
    const healthResult = await health.check();
    const stats = service.stats();

    return {
      api: 'ok',
      qualweb: healthResult.qualweb,
      browser: healthResult.browser,
      versions: healthResult.versions,
      process: {
        pid: process.pid,
        uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
        memory: process.memoryUsage(),
        cwd: process.cwd(),
      },
      queue: {
        running: stats.running.length,
        queued: stats.queued,
        maxConcurrent: config.maxConcurrentEvaluations,
        maxQueueSize: config.maxQueueSize,
      },
      evaluations: {
        total: stats.total,
        running: stats.running,
        lastCompleted: stats.lastCompleted,
        averageDurationMs: stats.averageDurationMs,
      },
      config: {
        BROWSER_HEADLESS: String(config.browserHeadless),
        BROWSER_TIMEOUT: String(config.browserTimeout),
        PAGE_TIMEOUT: String(config.pageTimeout),
        EVALUATION_TIMEOUT: String(config.evaluationTimeout),
        MAX_CONCURRENT_EVALUATIONS: String(config.maxConcurrentEvaluations),
        MAX_QUEUE_SIZE: String(config.maxQueueSize),
        CAPTURE_SCREENSHOT: String(config.captureScreenshot),
        SAVE_HTML: String(config.saveHtml),
        ALLOW_LOCAL_NETWORK: String(config.allowLocalNetwork),
        ALLOW_FILE_PROTOCOL: String(config.allowFileProtocol),
        MAX_REDIRECTS: String(config.maxRedirects),
        SPA_SETTLE_QUIET_MS: String(config.spaSettleQuietMs),
        SPA_SETTLE_MAX_MS: String(config.spaSettleMaxMs),
        RESTORE_NATIVE_PROTOTYPES: String(config.restoreNativePrototypes),
        LOCALHOST_ALIAS: config.localhostAlias ?? '(nenhum)',
        RUNNING_IN_DOCKER: String(config.runningInContainer),
        SCORING_STRATEGY: config.scoringStrategy,
        DATA_DIR: config.dataDir,
        LOGS_DIR: config.logsDir,
      },
    };
  };

  app.get('/api/debug', debugHandler);
  app.get('/debug', debugHandler);

  app.get('/api/logs', async (request) => {
    const limit = Number((request.query as { limit?: string }).limit ?? 500);
    const all = memory.all();
    return all.slice(-(Number.isFinite(limit) ? limit : 500));
  });
}
