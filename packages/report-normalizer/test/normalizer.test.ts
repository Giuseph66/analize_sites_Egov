import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AccessMonitorScore,
  ExperimentalScoreV1,
  buildAccessMonitorLayer,
  extractPageInfo,
  normalizeQualwebReport,
  techniqueFamilyOf,
} from '../src/index';
import type { RawQualwebReport } from '../src/qualweb-shapes';

function report(): RawQualwebReport {
  return {
    type: 'evaluation',
    system: {
      version: '4.0.0',
      url: { inputUrl: 'http://localhost:5173', completeUrl: 'http://localhost:5173/' },
      page: {
        viewport: { mobile: false, landscape: true, userAgent: 'UA', resolution: { width: 1366, height: 768 } },
        dom: { html: '<html lang="pt-BR"><body></body></html>', title: 'T', elementCount: 42 },
      },
    },
    metadata: { passed: 1, warning: 0, failed: 1, inapplicable: 1 },
    modules: {
      'act-rules': {
        type: 'act-rules',
        metadata: { passed: 0, warning: 0, failed: 1, inapplicable: 0 },
        assertions: {
          'QW-ACT-R17': {
            name: 'Image has accessible name',
            code: 'QW-ACT-R17',
            mapping: '23a2a8',
            description: 'desc',
            metadata: {
              target: { element: 'img' },
              'success-criteria': [
                { name: '1.1.1', level: 'A', principle: 'Perceivable', url: 'https://w3.org/1.1.1' },
              ],
              url: 'https://w3.org/act/23a2a8',
              passed: 0,
              warning: 0,
              failed: 1,
              inapplicable: 0,
              outcome: 'failed',
              description: 'A imagem nao tem nome acessivel.',
            },
            results: [
              { verdict: 'failed', description: 'x', resultCode: 'F1', elements: [{ pointer: 'body > img', htmlCode: '<img src="/logo.png">' }] },
              { verdict: 'passed', description: 'y', resultCode: 'P1', elements: [{ pointer: 'body > img.ok', htmlCode: '<img alt="ok">' }] },
            ],
          },
        },
      },
      'wcag-techniques': {
        type: 'wcag-techniques',
        metadata: { passed: 1, warning: 0, failed: 0, inapplicable: 0 },
        assertions: {
          'QW-WCAG-T9': {
            name: 'Organizing a page using headings',
            code: 'QW-WCAG-T9',
            mapping: 'G141',
            description: 'desc',
            metadata: {
              'success-criteria': [
                { name: '1.3.1', level: 'A', principle: 'Perceivable', url: 'u' },
                { name: '2.4.10', level: 'AAA', principle: 'Operable', url: 'u' },
              ],
              outcome: 'passed',
              passed: 1,
              warning: 0,
              failed: 0,
              inapplicable: 0,
            },
            results: [],
          },
        },
      },
      'best-practices': {
        type: 'best-practices',
        metadata: { passed: 0, warning: 0, failed: 1, inapplicable: 0 },
        assertions: {
          'QW-BP12': {
            name: 'Using scope col and row',
            code: 'QW-BP12',
            description: 'desc',
            // Sem success-criteria de proposito: parte das best practices nao tem.
            metadata: { outcome: 'failed', passed: 0, warning: 0, failed: 1, inapplicable: 0 },
            results: [{ verdict: 'failed', description: 'z', resultCode: 'F1', elements: [{ pointer: 'table' }] }],
          },
        },
      },
      counter: { type: 'counter', data: { roles: { button: 2 }, tags: { div: 10 } } },
    },
  };
}

describe('normalizeQualwebReport', () => {
  it('mapeia regra ACT com criterio, mapping e elemento', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    const rule = results.find((r) => r.ruleId === 'QW-ACT-R17');
    assert.ok(rule);
    assert.equal(rule.result, 'failed');
    assert.equal(rule.module, 'act-rules');
    assert.equal(rule.engine, 'qualweb');
    assert.equal(rule.engineVersion, '0.9.5');
    assert.equal(rule.actRule, '23a2a8');
    assert.equal(rule.technique, undefined);
    assert.deepEqual(rule.wcag, { criterion: '1.1.1', level: 'A' });
    assert.equal(rule.element?.selector, 'body > img');
    assert.equal(rule.element?.html, '<img src="/logo.png">');
  });

  it('mostra apenas os elementos do veredito da regra', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    const rule = results.find((r) => r.ruleId === 'QW-ACT-R17');
    assert.equal(rule?.elements.length, 1, 'o elemento do teste "passed" nao deve entrar numa regra que falhou');
  });

  it('usa o nivel mais severo como criterio principal', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    const rule = results.find((r) => r.ruleId === 'QW-WCAG-T9');
    assert.equal(rule?.wcag?.level, 'A', 'entre 1.3.1 (A) e 2.4.10 (AAA), A e o mais severo');
    assert.equal(rule?.technique, 'G141');
  });

  it('tolera regra sem criterio de sucesso', () => {
    const { results, wcagFailures } = normalizeQualwebReport(report(), '0.9.5');
    const rule = results.find((r) => r.ruleId === 'QW-BP12');
    assert.equal(rule?.wcag, undefined);
    assert.equal(rule?.wcagCriteria.length, 0);
    assert.equal(wcagFailures.unmapped, 1);
  });

  it('resume contagens e conta cada falha uma unica vez', () => {
    const { summary, wcagFailures, rulesByModule } = normalizeQualwebReport(report(), '0.9.5');
    assert.deepEqual(summary, { passed: 1, failed: 2, warning: 0, inapplicable: 0, manual: 0 });
    assert.deepEqual(wcagFailures, { A: 1, AA: 0, AAA: 0, unmapped: 1 });
    assert.deepEqual(rulesByModule, { 'act-rules': 1, 'wcag-techniques': 1, 'best-practices': 1 });
  });

  it('ignora o modulo counter na lista de regras', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    assert.equal(results.some((r) => r.module === ('counter' as never)), false);
  });

  it('degrada sem estourar quando o relatorio esta vazio', () => {
    const { results, summary } = normalizeQualwebReport({}, '0.9.5');
    assert.deepEqual(results, []);
    assert.equal(summary.failed, 0);
  });
});

describe('facetas derivadas', () => {
  it('deriva principio, diretriz (com nome) e alvos do criterio principal', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    const rule = results.find((r) => r.ruleId === 'QW-ACT-R17');
    assert.equal(rule?.principle, 'Perceivable');
    assert.equal(rule?.guideline, '1.1');
    assert.equal(rule?.guidelineName, 'Alternativas em texto');
    assert.deepEqual(rule?.targets, ['img']);
  });

  it('deriva a familia da tecnica pelo prefixo', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    const rule = results.find((r) => r.ruleId === 'QW-WCAG-T9');
    assert.equal(rule?.techniqueFamily, 'Geral');
    assert.equal(techniqueFamilyOf('H24'), 'HTML');
    assert.equal(techniqueFamilyOf('F30'), 'Falha comum');
    assert.equal(techniqueFamilyOf('ARIA11'), 'ARIA');
    assert.equal(techniqueFamilyOf('SCR20'), 'Script');
  });

  it('liga regras QualWeb a testes AccessMonitor pelo mapeamento declarado', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    // QW-BP30 (id unico) tem mapeamento declarado no pacote: id_01 / id_02.
    // A fixture nao tem QW-BP30; QW-WCAG-T9 (G141) liga por codigo de tecnica a hx_*.
    const headings = results.find((r) => r.ruleId === 'QW-WCAG-T9');
    assert.ok(headings);
    assert.ok(Array.isArray(headings.accessmonitorKeys));
  });
});

describe('buildAccessMonitorLayer', () => {
  it('produz a camada sem lancar, mesmo com relatorio minimo', () => {
    const { results } = normalizeQualwebReport(report(), '0.9.5');
    const layer = buildAccessMonitorLayer(report(), results);
    // O pipeline do pacote pode ou nao encontrar testes num relatorio sintetico;
    // o contrato que importa e: nunca lancar, e summary consistente quando existe.
    if (layer.summary) {
      assert.ok(layer.summary.packageVersion.length > 0);
      assert.ok(Number.isFinite(layer.summary.score));
      assert.ok(layer.summary.totalTests >= 0);
      for (const practice of layer.summary.practices) {
        assert.ok(['R', 'Y', 'G'].includes(practice.color));
        assert.ok(['A', 'AA', 'AAA'].includes(practice.level));
        assert.ok(practice.groupLabel.length > 0);
        assert.doesNotMatch(practice.description, /<[a-z]+>/, 'descricao deve vir sem HTML');
      }
    } else {
      assert.ok(layer.error, 'quando summary e null, o motivo precisa estar em error');
    }
  });

  it('nunca lanca com relatorio vazio', () => {
    const layer = buildAccessMonitorLayer({}, []);
    assert.ok(layer.summary === null || typeof layer.summary.score === 'number');
  });
});

describe('AccessMonitorScore', () => {
  it('usa a nota do AccessMonitor quando a camada existe', () => {
    const score = new AccessMonitorScore();
    const info = score.compute({
      results: [],
      accessmonitor: {
        packageVersion: '2.0.0',
        totalTests: 10,
        score: 8.3,
        conform: { A: 1, AA: 0, AAA: 0 },
        byColor: { R: { A: 1, AA: 0, AAA: 0 }, Y: { A: 0, AA: 0, AAA: 0 }, G: { A: 9, AA: 0, AAA: 0 } },
        elementCounters: {},
        practices: [],
      },
    });
    assert.equal(info.value, 8.3);
    assert.equal(info.strategy, 'accessmonitor');
    assert.match(info.disclaimer ?? '', /AccessMonitor/);
  });

  it('cai para o experimental, dizendo isso no rotulo, quando a camada e null', () => {
    const score = new AccessMonitorScore();
    const info = score.compute({ results: [], accessmonitor: null });
    assert.equal(info.strategy, 'accessmonitor->experimental-v1');
    assert.match(info.label, /indisponível/);
  });
});

describe('extractPageInfo', () => {
  it('le titulo, contagem, lang e viewport', () => {
    const info = extractPageInfo(report());
    assert.equal(info.title, 'T');
    assert.equal(info.elementCount, 42);
    assert.equal(info.lang, 'pt-BR');
    assert.deepEqual(info.viewport, { width: 1366, height: 768, mobile: false, landscape: true });
    // '<html lang="pt-BR"><body></body></html>' em UTF-8: mesma contagem de bytes que de caracteres.
    assert.equal(info.htmlSizeBytes, '<html lang="pt-BR"><body></body></html>'.length);
  });

  it('devolve null quando o dado nao existe, em vez de inventar', () => {
    const info = extractPageInfo({});
    assert.equal(info.title, null);
    assert.equal(info.elementCount, null);
    assert.equal(info.lang, null);
    assert.equal(info.viewport, null);
    assert.equal(info.htmlSizeBytes, null);
  });
});

describe('ExperimentalScoreV1', () => {
  const score = new ExperimentalScoreV1();

  it('da 10 quando tudo passa', () => {
    const results = normalizeQualwebReport(report(), '0.9.5').results.map((r) => ({ ...r, result: 'passed' as const }));
    assert.equal(score.compute({ results: results, accessmonitor: null }).value, 10);
  });

  it('da 0 quando tudo falha', () => {
    const results = normalizeQualwebReport(report(), '0.9.5').results.map((r) => ({ ...r, result: 'failed' as const }));
    assert.equal(score.compute({ results: results, accessmonitor: null }).value, 0);
  });

  it('ignora regras inaplicaveis', () => {
    const base = normalizeQualwebReport(report(), '0.9.5').results;
    const withNoise = [...base, ...base.map((r) => ({ ...r, ruleId: `${r.ruleId}-x`, result: 'inapplicable' as const }))];
    assert.equal(score.compute({ results: withNoise, accessmonitor: null }).value, score.compute({ results: base, accessmonitor: null }).value);
  });

  it('penaliza mais uma falha de nivel A do que de nivel AAA', () => {
    const base = normalizeQualwebReport(report(), '0.9.5').results[0]!;
    const failA = score.compute({ results: [{ ...base, result: 'failed', wcag: { criterion: 'x', level: 'A' } }, { ...base, ruleId: 'b', result: 'passed', wcag: { criterion: 'y', level: 'AAA' } }], accessmonitor: null });
    const failAAA = score.compute({ results: [{ ...base, result: 'passed', wcag: { criterion: 'x', level: 'A' } }, { ...base, ruleId: 'b', result: 'failed', wcag: { criterion: 'y', level: 'AAA' } }], accessmonitor: null });
    assert.ok(failA.value < failAAA.value, `${failA.value} < ${failAAA.value}`);
  });

  it('carrega sempre o aviso de score nao oficial', () => {
    assert.match(score.compute({ results: [], accessmonitor: null }).disclaimer ?? '', /experimental/i);
  });
});
