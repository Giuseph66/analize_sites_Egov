/**
 * Camada AccessMonitor sobre o relatorio bruto do QualWeb.
 *
 * Usa o pacote oficial @a12e/accessmonitor-rulesets (AMA, Portugal — MIT), cujo
 * processEvaluation() e o mesmo pipeline do validador AccessMonitor: contadores de
 * elementos, mapeamento QualWeb -> testes, conformidade por nivel e nota 1-10.
 *
 * Por que isso importa: o AMAWeb usa essa metodologia. Comparando contra o site
 * real altoboavista/altogarcas, erros e avisos por nivel coincidiram exatamente
 * (5/0/0 e 4/0/2); aceitos diferiram em um teste (38 vs 37), e a nota em 0.4.
 * Ver docs/scoring.md.
 *
 * Limites do pacote (2.0.0), documentados e nao contornados por invencao:
 *  - DOMAIN_MAPPING e parcial: parte das regras tem `hasCustomHandler` sem chave
 *    declarada. Para essas, ligamos teste <-> regra pelo codigo W3C que ambos
 *    citam (ruleset[key].ref vs technique/actRule da regra), marcando linkKind.
 *    Quando nem isso coincide (ex.: img_01b cita F65 e QW-ACT-R17 cita a ACT
 *    23a2a8), a pratica fica sem regra ligada — e sem elementos. Nao inventamos
 *    a ligacao por semelhanca de criterio.
 *  - assertionEvidence vem vazio: o pacote le results[].pointer (formato 0.8), e o
 *    QualWeb 0.9 entrega results[].elements[]. Os elementos vem das regras ligadas.
 *  - Testes que dependem do validador W3C (w3c_validator_*) nao aparecem: nao
 *    configuramos validador.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  DOMAIN_MAPPING,
  processEvaluation,
  ruleset,
  successCriteria,
  techniques,
  testColors,
  translations,
} from '@a12e/accessmonitor-rulesets';
import type {
  AccessMonitorColor,
  AccessMonitorPractice,
  AccessMonitorSummary,
  AccessibilityResult,
  ResultElement,
  WcagLevel,
} from '@lae/shared-types';

import type { RawQualwebReport } from './qualweb-shapes';

// Versao do pacote, para o relatorio registrar com que ruleset a nota foi
// calculada (importante para comparar avaliacoes futuras). O pacote declara
// "exports" sem "./package.json", entao lemos o arquivo a partir do caminho do
// modulo resolvido em vez de require('.../package.json').
const PACKAGE_VERSION: string = ((): string => {
  try {
    const entry = require.resolve('@a12e/accessmonitor-rulesets');
    let dir = dirname(entry);
    for (let depth = 0; depth < 4; depth += 1) {
      const candidate = join(dir, 'package.json');
      if (existsSync(candidate)) {
        const parsed = JSON.parse(readFileSync(candidate, 'utf-8')) as { name?: string; version?: string };
        if (parsed.name === '@a12e/accessmonitor-rulesets' && parsed.version) return parsed.version;
      }
      dir = dirname(dir);
    }
  } catch {
    /* cai no desconhecido abaixo */
  }
  return 'unknown';
})();

/**
 * Rotulos em portugues para os grupos de teste (prefixo da chave). Os grupos sao
 * do proprio AccessMonitor; os rotulos sao nossos, para a interface.
 */
const GROUP_LABELS: Record<string, string> = {
  a: 'Links',
  abbr: 'Abreviações',
  area: 'Mapas de imagem',
  aria: 'ARIA',
  audio_video: 'Áudio e vídeo',
  autocomplete: 'Autocompletar',
  blink: 'Conteúdo piscante',
  br: 'Estrutura com <br>',
  button: 'Botões',
  color: 'Cores',
  css: 'CSS',
  ehandler: 'Manipuladores de evento',
  element: 'Elementos e foco',
  field: 'Fieldset',
  focus: 'Foco',
  font: 'Fontes',
  form: 'Formulários',
  frame: 'Frames',
  headers: 'Cabeçalhos de tabela',
  heading: 'Cabeçalhos',
  hx: 'Cabeçalhos',
  id: 'Atributos id',
  iframe: 'Iframes',
  img: 'Imagens',
  inp_img: 'Botões gráficos',
  input: 'Campos de formulário',
  justif_txt: 'Texto justificado',
  label: 'Rótulos',
  landmark: 'Landmarks',
  lang: 'Idioma',
  layout: 'Layout',
  letter: 'Espaçamento de letras',
  link: 'Elementos link',
  list: 'Listas',
  listitem: 'Listas',
  menuItem: 'Itens de menu',
  meta: 'Meta',
  object: 'Objetos',
  orientation: 'Orientação',
  role: 'Roles',
  scope: 'Escopo de tabela',
  scrollable: 'Rolagem',
  svg: 'SVG',
  table: 'Tabelas',
  textC: 'Contraste de texto',
  title: 'Título da página',
  values: 'Medidas',
  video: 'Vídeo',
  w3c_validator: 'Validação HTML',
  win: 'Janelas pop-up',
  word: 'Espaçamento de palavras',
};

function groupOf(key: string): string {
  // "audio_video_01" -> "audio_video"; "hx_01a" -> "hx"; "inp_img_01b" -> "inp_img"
  return key.replace(/_\d+[a-z]?$/, '');
}

function isLevel(value: unknown): value is WcagLevel {
  return value === 'A' || value === 'AA' || value === 'AAA';
}

/** Remove as marcas HTML dos textos do pacote (<mark>, <code>, entidades). */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Indice teste AccessMonitor -> regras QualWeb.
 * 1) pelo DOMAIN_MAPPING declarado (passed/failed/warning -> key);
 * 2) para o que sobra, pelo codigo de tecnica W3C citado dos dois lados.
 */
function buildLinks(results: AccessibilityResult[]): Map<string, { rules: Set<string>; kind: 'mapping' | 'technique' }> {
  const links = new Map<string, { rules: Set<string>; kind: 'mapping' | 'technique' }>();
  const add = (key: string, rule: string, kind: 'mapping' | 'technique'): void => {
    const entry = links.get(key);
    if (entry) {
      entry.rules.add(rule);
      if (kind === 'mapping') entry.kind = 'mapping';
    } else {
      links.set(key, { rules: new Set([rule]), kind });
    }
  };

  const mapping = DOMAIN_MAPPING as Record<string, { passed?: { key: string }; failed?: { key: string }; warning?: { key: string } }>;
  for (const [rule, config] of Object.entries(mapping)) {
    for (const slot of ['passed', 'failed', 'warning'] as const) {
      const key = config[slot]?.key;
      if (key) add(key, rule, 'mapping');
    }
  }

  // `ref` do ruleset cita ora uma tecnica WCAG (H37, F65), ora uma regra ACT
  // (23a2a8). Os dois lados citam o mesmo codigo W3C, entao a juncao e exata.
  const byReference = new Map<string, string[]>();
  for (const result of results) {
    for (const code of [result.technique, result.actRule]) {
      if (!code) continue;
      const list = byReference.get(code) ?? [];
      list.push(result.ruleId);
      byReference.set(code, list);
    }
  }
  const definitions = ruleset as Record<string, { ref?: string }>;
  for (const [key, definition] of Object.entries(definitions)) {
    if (links.has(key) || !definition.ref) continue;
    for (const rule of byReference.get(definition.ref) ?? []) add(key, rule, 'technique');
  }

  return links;
}

/** Caminho da tecnica no site do W3C, pelo prefixo do codigo. */
const TECHNIQUE_PATHS: Record<string, string> = {
  H: 'html',
  C: 'css',
  G: 'general',
  F: 'failures',
  ARIA: 'aria',
  SCR: 'client-side-script',
  T: 'text',
  SVR: 'server-side-script',
  SM: 'smil',
  PDF: 'pdf',
  FLASH: 'flash',
  SL: 'silverlight',
};

/**
 * O campo `ref` do ruleset cita ora uma tecnica WCAG (H24, G141), ora uma regra
 * ACT (id hexadecimal de 6 caracteres, ex.: 5c01ea). O pacote so tem nomes para
 * as tecnicas; para as regras ACT montamos nome e link a partir do id.
 */
function describeReference(
  ref: string,
  techniqueNames: Record<string, string>,
  texts: Record<string, string>,
): AccessMonitorPractice['technique'] {
  const description = plainText(texts[ref] ?? '');
  if (/^[0-9a-f]{6}$/i.test(ref)) {
    return {
      code: ref,
      kind: 'act-rule',
      name: `Regra ACT ${ref}`,
      description,
      url: `https://www.w3.org/WAI/standards-guidelines/act/rules/${ref}/`,
    };
  }
  const prefix = /^[A-Z]+/.exec(ref)?.[0] ?? '';
  const path = TECHNIQUE_PATHS[prefix] ?? 'general';
  return {
    code: ref,
    kind: 'wcag-technique',
    name: techniqueNames[ref] ?? ref,
    description,
    url: `https://www.w3.org/WAI/WCAG21/Techniques/${path}/${ref}`,
  };
}

export interface AccessMonitorOutcome {
  summary: AccessMonitorSummary | null;
  error?: string;
}

/**
 * Executa o pipeline do AccessMonitor e monta a camada para o relatorio.
 * Nunca lanca: uma falha aqui nao pode derrubar a avaliacao do QualWeb.
 */
export function buildAccessMonitorLayer(raw: RawQualwebReport, results: AccessibilityResult[]): AccessMonitorOutcome {
  let processed: ReturnType<typeof processEvaluation>;
  try {
    // O pacote tipa a entrada como o relatorio 0.8; o 0.9 e superconjunto no que ele le.
    processed = processEvaluation(raw as unknown as Parameters<typeof processEvaluation>[0]);
  } catch (error) {
    return { summary: null, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }

  const links = buildLinks(results);
  const resultsById = new Map(results.map((result) => [result.ruleId, result]));
  const pt = translations.pt.translation;
  const colors = testColors as Record<string, AccessMonitorColor>;
  const definitions = ruleset as Record<
    string,
    { level: string; score: number; trust: string; ref?: string; scs?: string[] }
  >;
  const criteriaTable = successCriteria as Record<string, { name: string; level: string }>;
  const techniqueNames = techniques as Record<string, string>;

  const byColor: AccessMonitorSummary['byColor'] = {
    R: { A: 0, AA: 0, AAA: 0 },
    Y: { A: 0, AA: 0, AAA: 0 },
    G: { A: 0, AA: 0, AAA: 0 },
  };

  const practices: AccessMonitorPractice[] = [];

  for (const key of Object.keys(processed.conformanceResults)) {
    const definition = definitions[key];
    const color = colors[key];
    if (!definition || !color || !isLevel(definition.level)) continue;

    const level = definition.level;
    byColor[color][level] += 1;

    const occurrences = processed.rulesOccurrences[key] ?? 0;
    const text = pt.TESTS_RESULTS[key as keyof typeof pt.TESTS_RESULTS];
    const template = text ? (occurrences === 1 ? text.s : text.p) : '';
    const description = plainText(template.replace(/\{\{value\}\}/g, String(occurrences)));

    const link = links.get(key);
    const qualwebRules = link ? [...link.rules] : [];
    const elements: ResultElement[] = [];
    for (const rule of qualwebRules) {
      const linked = resultsById.get(rule);
      if (linked) elements.push(...linked.elements);
      if (elements.length >= 25) break;
    }

    const technique = definition.ref ? describeReference(definition.ref, techniqueNames, pt.TXT_TECHNIQUES) : null;

    const criteria = (definition.scs ?? [])
      .map((criterion) => {
        const entry = criteriaTable[criterion];
        return entry && isLevel(entry.level) ? { criterion, level: entry.level, name: entry.name } : null;
      })
      .filter((entry): entry is { criterion: string; level: WcagLevel; name: string } => entry !== null);

    const weighted = processed.conformanceResults[key];
    const group = groupOf(key);

    practices.push({
      key,
      group,
      groupLabel: GROUP_LABELS[group] ?? group,
      color,
      level,
      title: text ? plainText(text.title) : key,
      description,
      occurrences,
      technique,
      criteria,
      score: definition.score,
      trust: definition.trust,
      weighted: weighted ? weighted : null,
      qualwebRules,
      linkKind: link?.kind ?? null,
      elements: elements.slice(0, 25),
    });
  }

  // Erros primeiro, depois revisar, depois aceito; dentro de cada cor, A > AA > AAA.
  const colorOrder: Record<AccessMonitorColor, number> = { R: 0, Y: 1, G: 2 };
  const levelOrder: Record<WcagLevel, number> = { A: 0, AA: 1, AAA: 2 };
  practices.sort(
    (a, b) => colorOrder[a.color] - colorOrder[b.color] || levelOrder[a.level] - levelOrder[b.level] || a.key.localeCompare(b.key),
  );

  const [confA = '0', confAA = '0', confAAA = '0'] = processed.scoreDetails.conform.split('@');

  return {
    summary: {
      packageVersion: PACKAGE_VERSION,
      totalTests: processed.scoreDetails.totalTests,
      score: Number(processed.scoreDetails.score),
      conform: { A: Number(confA), AA: Number(confAA), AAA: Number(confAAA) },
      byColor,
      elementCounters: processed.elementCounters,
      practices,
    },
  };
}

/** Reverso: chaves AccessMonitor por regra QualWeb, para o campo accessmonitorKeys. */
export function accessMonitorKeysByRule(results: AccessibilityResult[]): Map<string, string[]> {
  const links = buildLinks(results);
  const byRule = new Map<string, string[]>();
  for (const [key, { rules }] of links) {
    for (const rule of rules) {
      const list = byRule.get(rule) ?? [];
      list.push(key);
      byRule.set(rule, list);
    }
  }
  return byRule;
}
