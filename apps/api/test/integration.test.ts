/**
 * Testes de integracao: sobem um servidor HTTP real, executam o QualWeb de
 * verdade contra ele e conferem o relatorio. Nada e simulado — se o motor
 * quebrar, estes testes quebram.
 *
 * Cada avaliacao abre um Chromium, entao a suite leva alguns segundos.
 */

import assert from 'node:assert/strict';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { EvaluationService, FilesystemEvaluationRepository, loadConfig } from '@lae/evaluator';
import { EmitterSink, Logger, MemorySink } from '@lae/logger';
import type { EvaluationMetadata } from '@lae/shared-types';

const GOOD_PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pagina simples</title></head>
<body><main><h1>Titulo</h1><p>Conteudo.</p><img src="/a.png" alt="Imagem"></main></body></html>`;

const BAD_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Ruim</title></head>
<body><img src="/a.png"><input type="text"><a href="/x"></a></body></html>`;

// Reproduz, no minimo, a poluicao de prototipos que quebra o act-rules em sites
// Joomla com MooTools: bisseccao contra um site real mostrou que `Array.prototype.min`
// sozinho basta para o colorjs.io (dentro do bundle) falhar em "oklch" e o bundle
// morrer antes de definir ACTRulesRunner. `Array.from` e `Object.values` sao
// sobrescritos como o MooTools faz, para cobrir a restauracao de estaticos.
const POLLUTED_PROTOTYPES_PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>MooTools-like</title>
<script>
  Array.prototype.min = function () { return Math.min.apply(null, this); };
  Array.prototype.each = function (fn) { for (var i = 0; i < this.length; i++) fn(this[i], i); };
  Array.from = function (item) { return item == null ? [] : Array.isArray(item) ? item : [item]; };
  Object.values = function (o) { var r = []; for (var k in o) r.push(o[k]); return r; };
</script></head>
<body><main><h1>Pagina com protótipos poluídos</h1><p>Conteudo.</p><img src="/a.png" alt="Imagem"></main></body></html>`;

const HEAVY_JS_PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>JS pesado</title></head>
<body><div id="app"></div><script>
  const app = document.getElementById('app');
  for (let i = 0; i < 3000; i++) { const d = document.createElement('div'); d.textContent = 'linha ' + i; app.appendChild(d); }
  const h = document.createElement('h1'); h.textContent = 'Gerado por script'; app.prepend(h);
</script></body></html>`;

let server: Server;
let baseUrl: string;
let service: EvaluationService;
let impatientService: EvaluationService;
let noRestoreService: EvaluationService;
let workDir: string;

function respond(res: ServerResponse, status: number, body: string, type = 'text/html; charset=utf-8'): void {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

before(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'lae-test-'));

  server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    switch (path) {
      case '/good':
        return respond(res, 200, GOOD_PAGE);
      case '/bad':
        return respond(res, 200, BAD_PAGE);
      case '/empty':
        return respond(res, 200, '');
      case '/heavy':
        return respond(res, 200, HEAVY_JS_PAGE);
      case '/polluted':
        return respond(res, 200, POLLUTED_PROTOTYPES_PAGE);
      case '/redirect':
        res.writeHead(302, { location: '/good' });
        return res.end();
      case '/redirect-loop':
        res.writeHead(302, { location: '/redirect-loop' });
        return res.end();
      case '/notfound':
        return respond(res, 404, '<!doctype html><html lang="pt-BR"><head><title>404</title></head><body><h1>Nao encontrado</h1></body></html>');
      case '/error':
        return respond(res, 500, '<!doctype html><html lang="pt-BR"><head><title>500</title></head><body><h1>Erro</h1></body></html>');
      case '/slow':
        // Nunca responde: usado para provocar timeout de navegacao.
        return;
      default:
        return respond(res, 404, 'not found', 'text/plain');
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('endereco do servidor de teste invalido');
  baseUrl = `http://127.0.0.1:${address.port}`;

  const config = {
    ...loadConfig({}, workDir),
    dataDir: join(workDir, 'data'),
    logsDir: join(workDir, 'logs'),
    pageTimeout: 15_000,
    evaluationTimeout: 45_000,
    maxConcurrentEvaluations: 1,
  };

  const memory = new MemorySink();
  const emitter = new EmitterSink();
  const logger = new Logger([memory, emitter], {}, 'debug');

  service = new EvaluationService(config, new FilesystemEvaluationRepository(config.dataDir), logger, emitter);
  service.memorySink = memory;

  // Serviço separado, com timeout curto, para exercitar o caminho de falha por
  // timeout de navegação sem tornar a suíte lenta.
  const impatientConfig = { ...config, pageTimeout: 2_000, evaluationTimeout: 30_000 };
  const impatientMemory = new MemorySink();
  const impatientEmitter = new EmitterSink();
  impatientService = new EvaluationService(
    impatientConfig,
    new FilesystemEvaluationRepository(impatientConfig.dataDir),
    new Logger([impatientMemory, impatientEmitter], {}, 'debug'),
    impatientEmitter,
  );
  impatientService.memorySink = impatientMemory;

  // Servico com a restauracao de prototipos DESLIGADA, para documentar o que o
  // QualWeb faz sozinho diante de uma pagina que polui Array.prototype.
  const rawConfig = { ...config, restoreNativePrototypes: false };
  const rawMemory = new MemorySink();
  const rawEmitter = new EmitterSink();
  noRestoreService = new EvaluationService(
    rawConfig,
    new FilesystemEvaluationRepository(rawConfig.dataDir),
    new Logger([rawMemory, rawEmitter], {}, 'debug'),
    rawEmitter,
  );
  noRestoreService.memorySink = rawMemory;
});

after(async () => {
  // A rota /slow nunca responde de proposito, entao fica uma conexao aberta.
  // Sem derrubar as conexoes, server.close() espera por ela para sempre e a suite
  // termina com "Promise resolution is still pending but the event loop has
  // already resolved".
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(workDir, { recursive: true, force: true });
});

/** Cria a avaliacao e espera ela terminar, seja com sucesso ou com falha. */
async function evaluate(
  url: string,
  timeoutMs = 90_000,
  using: () => EvaluationService = () => service,
): Promise<EvaluationMetadata> {
  const target = using();
  const created = await target.create(url, `test-${Date.now()}`);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const current = await target.get(created.id);
    if (current && (current.status === 'completed' || current.status === 'failed')) return current;
    if (Date.now() > deadline) throw new Error(`Avaliacao ${created.id} nao terminou em ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

describe('avaliacao ponta a ponta com QualWeb real', () => {
  it('avalia uma pagina HTML simples e produz relatorio completo', async () => {
    const metadata = await evaluate(`${baseUrl}/good`);
    assert.equal(metadata.status, 'completed', metadata.error?.message);

    const report = await service.getReport(metadata.id);
    assert.ok(report);
    assert.equal(report.page.title, 'Pagina simples');
    assert.equal(report.page.lang, 'pt-BR');
    assert.equal(report.diagnostics.httpStatus, 200);
    assert.ok(report.results.length > 50, `esperava dezenas de regras, veio ${report.results.length}`);
    assert.ok(report.rulesByModule['act-rules']! > 0);
    assert.ok(report.rulesByModule['wcag-techniques']! > 0);
    assert.ok(report.rulesByModule['best-practices']! > 0);
    assert.equal(report.score.strategy, 'accessmonitor');
    assert.ok((report.timings.qualwebMs ?? 0) > 0);
    assert.ok(report.versions.chromium?.length);
    assert.equal(report.versions.qualwebCore, '0.9.5');
  });

  it('detecta mais erros numa pagina ruim do que numa boa', async () => {
    const good = await evaluate(`${baseUrl}/good`);
    const bad = await evaluate(`${baseUrl}/bad`);

    const goodReport = await service.getReport(good.id);
    const badReport = await service.getReport(bad.id);
    assert.ok(goodReport && badReport);

    assert.ok(
      badReport.summary.failed > goodReport.summary.failed,
      `bad=${badReport.summary.failed} deveria ser maior que good=${goodReport.summary.failed}`,
    );
    // A pagina ruim tem imagem sem alt: a regra ACT correspondente precisa falhar.
    const imageRule = badReport.results.find((r) => r.ruleId === 'QW-ACT-R17');
    assert.equal(imageRule?.result, 'failed');
    assert.match(imageRule?.element?.html ?? '', /<img/);
  });

  it('segue redirect e registra a URL final', async () => {
    const metadata = await evaluate(`${baseUrl}/redirect`);
    assert.equal(metadata.status, 'completed', metadata.error?.message);

    const report = await service.getReport(metadata.id);
    assert.ok(report);
    assert.equal(report.finalUrl, `${baseUrl}/good`);
    assert.ok(report.diagnostics.redirects.length >= 1);
    assert.equal(report.diagnostics.redirects[0]?.status, 302);
  });

  it('avalia paginas com status 404 e 500 sem tratar como falha do avaliador', async () => {
    for (const [path, status] of [['/notfound', 404], ['/error', 500]] as const) {
      const metadata = await evaluate(`${baseUrl}${path}`);
      assert.equal(metadata.status, 'completed', `${path}: ${metadata.error?.message}`);
      const report = await service.getReport(metadata.id);
      assert.equal(report?.diagnostics.httpStatus, status, path);
    }
  });

  it('avalia uma resposta vazia sem quebrar', async () => {
    const metadata = await evaluate(`${baseUrl}/empty`);
    assert.equal(metadata.status, 'completed', metadata.error?.message);
    const report = await service.getReport(metadata.id);
    assert.ok(report);
    assert.ok(report.results.length > 0, 'mesmo numa pagina vazia o QualWeb aplica regras de documento');
  });

  it('avalia uma pagina que constroi o DOM por JavaScript', async () => {
    const metadata = await evaluate(`${baseUrl}/heavy`);
    assert.equal(metadata.status, 'completed', metadata.error?.message);
    const report = await service.getReport(metadata.id);
    assert.ok(report);
    assert.ok(
      (report.page.elementCount ?? 0) > 1000,
      `o DOM gerado por script deve ser contado; veio ${report.page.elementCount}`,
    );
  });

  it('registra recursos que falharam durante a analise', async () => {
    const metadata = await evaluate(`${baseUrl}/bad`);
    const report = await service.getReport(metadata.id);
    // /a.png nao existe no servidor de teste.
    assert.ok(
      report?.diagnostics.networkFailures.some((failure) => failure.url.endsWith('/a.png')),
      'a imagem inexistente deveria aparecer entre as falhas de rede',
    );
  });

  it('falha com kind "invalid-url" para URL malformada', async () => {
    const metadata = await evaluate('http://');
    assert.equal(metadata.status, 'failed');
    assert.equal(metadata.error?.kind, 'invalid-url');
  });

  it('falha com kind "blocked-url" para javascript:', async () => {
    const metadata = await evaluate('javascript:alert(1)');
    assert.equal(metadata.status, 'failed');
    assert.equal(metadata.error?.kind, 'blocked-url');
  });

  it('falha com erro de navegacao quando o host nao existe', async () => {
    const metadata = await evaluate('http://host-que-nao-existe.invalid');
    assert.equal(metadata.status, 'failed');
    assert.ok(['navigation', 'qualweb', 'timeout'].includes(metadata.error?.kind ?? ''), metadata.error?.kind);
    assert.ok(metadata.error?.message.length);
  });

  it('reporta a causa real quando a navegacao estoura o PAGE_TIMEOUT', async () => {
    // /slow nunca responde. Antes, o timeout matava a tarefa do puppeteer-cluster,
    // o erro era engolido pelo core, e o usuario recebia apenas
    // "QualWeb nao devolveu relatorio ... Chaves recebidas: (nenhuma)".
    const metadata = await evaluate(`${baseUrl}/slow`, 60_000, () => impatientService);

    assert.equal(metadata.status, 'failed');
    assert.equal(metadata.error?.kind, 'timeout', `veio: ${metadata.error?.kind} — ${metadata.error?.message}`);

    const message = metadata.error?.message ?? '';
    assert.match(message, /timeout|exceeded/i, 'a causa real precisa aparecer na mensagem');
    assert.match(message, /PAGE_TIMEOUT/, 'a mensagem precisa dizer qual ajuste resolve');
    assert.doesNotMatch(message, /Chaves recebidas/, 'a mensagem generica nao deve mais ser usada quando ha causa conhecida');
  });

  it('avalia uma pagina que polui os prototipos nativos (caso MooTools)', async () => {
    const metadata = await evaluate(`${baseUrl}/polluted`);
    assert.equal(metadata.status, 'completed', metadata.error?.message);

    const report = await service.getReport(metadata.id);
    assert.ok(report);
    assert.ok(report.rulesByModule['act-rules']! > 0, 'o act-rules precisa ter rodado');

    const restore = report.diagnostics.prototypeRestore;
    assert.ok(restore, 'o diagnostico da restauracao precisa estar presente');
    assert.ok(restore.removed['Array.prototype']?.includes('min'), 'Array.prototype.min deveria ter sido removido');
    assert.ok(restore.removed['Array.prototype']?.includes('each'));
    assert.ok(restore.restored['Array']?.includes('from'), 'Array.from sobrescrito deveria ter sido restaurado');
    assert.ok(restore.restored['Object']?.includes('values'), 'Object.values sobrescrito deveria ter sido restaurado');
  });

  it('sem a restauracao, o QualWeb 0.9.5 falha nessa mesma pagina (documenta o motivo do recurso)', async () => {
    // Se este teste comecar a falhar porque a avaliacao passou a COMPLETAR, o
    // upstream corrigiu a sensibilidade a Array.prototype.min e a restauracao
    // pode virar opcional por padrao.
    const metadata = await evaluate(`${baseUrl}/polluted`, 90_000, () => noRestoreService);
    assert.equal(metadata.status, 'failed');
    assert.match(metadata.error?.message ?? '', /ACTRulesRunner is not defined/);
  });

  it('nao mexe em nada numa pagina limpa', async () => {
    const metadata = await evaluate(`${baseUrl}/good`);
    const report = await service.getReport(metadata.id);
    const restore = report?.diagnostics.prototypeRestore;
    assert.ok(restore);
    assert.deepEqual(restore.removed, {});
    assert.deepEqual(restore.restored, {});
  });

  it('produz a camada AccessMonitor coerente com as regras do QualWeb', async () => {
    const metadata = await evaluate(`${baseUrl}/bad`);
    const report = await service.getReport(metadata.id);
    assert.ok(report);

    const am = report.accessmonitor;
    assert.ok(am, `camada AccessMonitor ausente: ${report.accessmonitorError ?? 'sem motivo'}`);
    assert.ok(am.totalTests > 0);
    assert.ok(Number.isFinite(am.score));

    // A tabela 3x3 precisa fechar com o total de testes.
    const sum = (['R', 'Y', 'G'] as const).reduce((n, c) => n + am.byColor[c].A + am.byColor[c].AA + am.byColor[c].AAA, 0);
    assert.equal(sum, am.totalTests);
    assert.equal(am.practices.length, am.totalTests);

    // conform = erros por nivel, igual a linha R da tabela.
    assert.deepEqual(am.conform, am.byColor.R);

    // A pagina "bad" tem imagem sem alt: o teste do AccessMonitor para isso e img_01b,
    // ligado por mapeamento a QW-ACT-R17, com elementos vindos da regra.
    const missingAlt = am.practices.find((p) => p.key === 'img_01b');
    assert.ok(missingAlt, 'img_01b deveria ter disparado');
    assert.equal(missingAlt.color, 'R');
    assert.equal(missingAlt.level, 'A');
    assert.match(missingAlt.description, /imagem|imagens/i);
    assert.doesNotMatch(missingAlt.description, /<[a-z]+>/, 'descricao sem HTML');
    // img_01b cita F65 e o QualWeb detecta via ACT 23a2a8 (handler interno do
    // pacote): nao ha juncao honesta, e a pratica fica sem regra ligada. Outras
    // praticas se ligam por mapeamento declarado ou por codigo W3C em comum.
    assert.equal(missingAlt.technique?.code, 'F65');
    const linked = am.practices.filter((p) => p.qualwebRules.length > 0);
    assert.ok(linked.length > 0, 'alguma pratica precisa estar ligada a regras QualWeb');
    assert.ok(linked.some((p) => p.linkKind === 'mapping'));
    assert.ok(linked.some((p) => p.elements.length > 0), 'elementos vem das regras QualWeb ligadas');

    // Nota padrao agora e a do AccessMonitor.
    assert.equal(report.score.strategy, 'accessmonitor');
    assert.equal(report.score.value, am.score);

    // Facetas derivadas presentes nas regras do QualWeb.
    const withGuideline = report.results.find((r) => r.guideline);
    assert.ok(withGuideline?.guidelineName);
    assert.ok(report.results.some((r) => r.targets.length > 0));
    assert.ok(report.results.some((r) => r.accessmonitorKeys.length > 0));

    // Tamanho real do documento, lido da rede.
    assert.ok((report.page.documentSizeBytes ?? 0) > 0);
    assert.ok((report.page.documentSizeBytes ?? 0) < (report.page.htmlSizeBytes ?? 0), 'HTML capturado e maior que a resposta (scripts injetados)');
  });

  it('grava logs por avaliacao com todas as origens', async () => {
    const metadata = await evaluate(`${baseUrl}/good`);
    const logs = await service.getLogs(metadata.id);
    const sources = new Set(logs.map((entry) => entry.source));
    assert.ok(sources.has('APP'));
    assert.ok(sources.has('BROWSER'));
    assert.ok(sources.has('QUALWEB'));
    assert.ok(logs.some((entry) => entry.message.includes('Chromium PID')));
    assert.ok(logs.some((entry) => entry.message.includes('act-rules completed')));
  });
});
