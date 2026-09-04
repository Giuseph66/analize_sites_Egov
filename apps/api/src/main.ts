import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { EvaluationService, FilesystemEvaluationRepository, loadConfig, loadEnvFile } from '@lae/evaluator';
import { createRootLogger } from '@lae/logger';

import { HealthProbe } from './health';
import { registerRoutes } from './routes';

// A raiz do repositorio, para que data/ e logs/ nao dependam de onde o processo subiu.
const repoRoot = resolve(__dirname, '../../..');

async function main(): Promise<void> {
  // Antes de qualquer leitura de configuracao: o README manda copiar
  // .env.example para .env, entao esse arquivo precisa de fato valer.
  const envFile = loadEnvFile(repoRoot);

  const config = loadConfig(process.env, repoRoot);
  const { logger, memory, emitter } = createRootLogger(config.logsDir);

  if (envFile) {
    logger.info('APP', `.env carregado de ${envFile.path}`, {
      aplicadas: envFile.applied.length,
      ignoradasPorJaExistiremNoAmbiente: envFile.skipped,
    });
  } else {
    logger.debug('APP', `Nenhum .env encontrado em ${repoRoot} (usando apenas variáveis de ambiente e padrões)`);
  }

  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '0.0.0.0';

  logger.info('APP', `Local Accessibility Evaluator API starting`);
  logger.info('APP', `node ${process.version} | pid ${process.pid} | ${process.platform} ${process.arch}`);
  logger.info('APP', `repoRoot=${repoRoot}`);
  logger.info('APP', `dataDir=${config.dataDir} logsDir=${config.logsDir}`);
  logger.info('APP', `runningInContainer=${config.runningInContainer} localhostAlias=${config.localhostAlias ?? '(nenhum)'}`);
  logger.info('APP', `headless=${config.browserHeadless} maxConcurrent=${config.maxConcurrentEvaluations} maxQueue=${config.maxQueueSize}`);
  logger.info(
    'APP',
    `pageTimeout=${config.pageTimeout} evaluationTimeout=${config.evaluationTimeout} spaSettleMax=${config.spaSettleMaxMs}`,
  );

  // O EVALUATION_TIMEOUT vira o timeout da tarefa no puppeteer-cluster, que engloba
  // navegacao + espera de assentamento + execucao dos modulos. Se ele for menor que
  // o PAGE_TIMEOUT, o cluster mata a tarefa antes de a navegacao sequer estourar —
  // e o sintoma e um relatorio vazio, dificil de relacionar com a configuracao.
  const minimumEvaluationTimeout = config.pageTimeout + config.spaSettleMaxMs;
  if (config.evaluationTimeout <= minimumEvaluationTimeout) {
    logger.warn(
      'APP',
      `EVALUATION_TIMEOUT (${config.evaluationTimeout} ms) não cobre PAGE_TIMEOUT + SPA_SETTLE_MAX_MS ` +
        `(${minimumEvaluationTimeout} ms). O puppeteer-cluster vai encerrar a tarefa antes de a navegação ` +
        `esgotar o próprio limite, e a avaliação falha com relatório vazio. ` +
        `Aumente EVALUATION_TIMEOUT para pelo menos ${minimumEvaluationTimeout + 15_000} ms.`,
    );
  }

  const repository = new FilesystemEvaluationRepository(config.dataDir);
  const service = new EvaluationService(config, repository, logger, emitter);
  service.memorySink = memory;

  const health = new HealthProbe({
    browserExecutablePath: config.browserExecutablePath,
    ttlMs: 30_000,
    versions: (chromium) => service.versions(chromium),
  });

  const app = Fastify({
    // O Fastify tem logger proprio; usamos o nosso para tudo, entao desligamos o dele
    // e registramos as requisicoes num hook, com o mesmo formato do resto do sistema.
    logger: false,
    disableRequestLogging: true,
    bodyLimit: 1_048_576,
  });

  await app.register(cors, { origin: true });

  app.addHook('onRequest', async (request) => {
    logger.debug('APP', `${request.method} ${request.url}`, { requestId: request.id });
  });

  app.addHook('onResponse', async (request, reply) => {
    logger.debug('APP', `${request.method} ${request.url} -> ${reply.statusCode} (${Math.round(reply.elapsedTime)} ms)`, {
      requestId: request.id,
    });
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    logger.error('APP', `Unhandled error on ${request.method} ${request.url}`, error);
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Erro interno.';
    reply.code(statusCode).send({ error: message });
  });

  await registerRoutes(app, { service, config, health, logger, memory, startedAt: new Date() });

  // Em producao (container) a API serve o frontend compilado no mesmo host:porta.
  const frontendDist = resolve(repoRoot, 'apps/frontend/dist');
  if (existsSync(frontendDist)) {
    await app.register(fastifyStatic, { root: frontendDist });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'Rota nao encontrada.' });
      return reply.sendFile('index.html');
    });
    logger.info('APP', `Serving frontend from ${frontendDist}`);
  } else {
    logger.warn('APP', `Frontend nao compilado (${frontendDist} nao existe). Use o Vite em modo dev.`);
  }

  await app.listen({ port, host });
  logger.info('APP', `API listening on http://${host}:${port}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('APP', `Received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('APP', 'Unhandled promise rejection', reason);
  });
}

main().catch((error) => {
  process.stderr.write(`Falha fatal ao iniciar a API: ${String(error)}\n`);
  if (error instanceof Error && error.stack) process.stderr.write(error.stack + '\n');
  process.exit(1);
});
