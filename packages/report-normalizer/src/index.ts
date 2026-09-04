/**
 * Converte o relatorio bruto do QualWeb no formato interno (§9).
 *
 * Principio: nao inventar dados. Se o QualWeb nao fornece um campo, ele fica
 * ausente ou null — nunca preenchido com um valor plausivel.
 */

import type {
  AccessibilityResult,
  QualwebModuleName,
  ReportSummary,
  ResultElement,
  ResultOutcome,
  WcagCriterion,
  WcagLevel,
  WcagLevelSummary,
} from '@lae/shared-types';

import type { RawAssertion, RawEvaluationModule, RawQualwebReport, RawTestResult } from './qualweb-shapes';

export * from './qualweb-shapes';
export * from './scoring';

const EVALUATION_MODULES: QualwebModuleName[] = ['act-rules', 'wcag-techniques', 'best-practices'];

/**
 * Limites de recorte dos elementos.
 *
 * Sem eles o relatorio normalizado fica MAIOR que o bruto do QualWeb: algumas regras
 * (QW-ACT-R75, por exemplo) apontam o proprio <html> como elemento e carregam o
 * documento inteiro em htmlCode — 2,4 MB numa pagina de teste de 40 elementos.
 * O JSON bruto continua intacto em raw-qualweb.json para quem precisar do original.
 */
export const MAX_ELEMENTS_PER_RESULT = 25;
export const MAX_ELEMENT_HTML_LENGTH = 4000;

function truncateHtml(html: string): string {
  if (html.length <= MAX_ELEMENT_HTML_LENGTH) return html;
  return `${html.slice(0, MAX_ELEMENT_HTML_LENGTH)}\n<!-- ... truncado: ${html.length - MAX_ELEMENT_HTML_LENGTH} caracteres a mais. HTML completo em raw-qualweb.json -->`;
}
const LEVEL_SEVERITY: Record<WcagLevel, number> = { A: 3, AA: 2, AAA: 1 };

function isWcagLevel(value: unknown): value is WcagLevel {
  return value === 'A' || value === 'AA' || value === 'AAA';
}

/**
 * QualWeb (Verdict) so produz passed | warning | failed | inapplicable.
 * Nao existe verdict 'manual'. Mantemos 'manual' no tipo porque o formato interno
 * preve motores futuros, mas o normalizador do QualWeb nunca o emite.
 */
function toOutcome(verdict: string | undefined): ResultOutcome {
  switch (verdict) {
    case 'passed':
    case 'failed':
    case 'warning':
    case 'inapplicable':
      return verdict;
    default:
      return 'inapplicable';
  }
}

function extractCriteria(assertion: RawAssertion): WcagCriterion[] {
  const raw = assertion.metadata?.['success-criteria'] ?? [];
  const criteria: WcagCriterion[] = [];
  for (const sc of raw) {
    if (!sc?.name || !isWcagLevel(sc.level)) continue;
    criteria.push({
      criterion: sc.name,
      level: sc.level,
      ...(sc.principle ? { principle: sc.principle } : {}),
      ...(sc.url ? { url: sc.url } : {}),
    });
  }
  return criteria;
}

/** Criterio "principal": o de nivel mais severo (A > AA > AAA). */
function primaryCriterion(criteria: WcagCriterion[]): WcagCriterion | undefined {
  let best: WcagCriterion | undefined;
  for (const criterion of criteria) {
    if (!best || LEVEL_SEVERITY[criterion.level] > LEVEL_SEVERITY[best.level]) best = criterion;
  }
  return best;
}

function toElement(raw: { pointer?: string; htmlCode?: string; accessibleName?: string; attributes?: string | string[] }): ResultElement {
  const element: ResultElement = {};
  if (raw.htmlCode) element.html = truncateHtml(raw.htmlCode);
  if (raw.pointer) element.selector = raw.pointer;
  if (raw.accessibleName) element.accessibleName = raw.accessibleName;
  if (raw.attributes) element.attributes = Array.isArray(raw.attributes) ? raw.attributes : [raw.attributes];
  return element;
}

/**
 * Elementos exibidos para a regra: apenas os dos testes cujo verdict coincide com
 * o desfecho da regra. Mostrar elementos "passed" numa regra que falhou confunde.
 */
function extractElements(assertion: RawAssertion, outcome: ResultOutcome): { elements: ResultElement[]; total: number } {
  const tests: RawTestResult[] = assertion.results ?? [];
  const matching = tests.filter((test) => toOutcome(test.verdict) === outcome);
  const source = matching.length > 0 ? matching : tests;

  const elements: ResultElement[] = [];
  let total = 0;
  for (const test of source) {
    for (const rawElement of test.elements ?? []) {
      const element = toElement(rawElement);
      if (Object.keys(element).length === 0) continue;
      total += 1;
      if (elements.length < MAX_ELEMENTS_PER_RESULT) elements.push(element);
    }
  }
  return { elements, total };
}

function normalizeAssertion(
  assertion: RawAssertion,
  moduleName: QualwebModuleName,
  engineVersion: string,
): AccessibilityResult | null {
  const ruleId = assertion.code;
  if (!ruleId) return null;

  const outcome = toOutcome(assertion.metadata?.outcome);
  const criteria = extractCriteria(assertion);
  const primary = primaryCriterion(criteria);
  const { elements, total: elementsTotal } = extractElements(assertion, outcome);

  const result: AccessibilityResult = {
    ruleId,
    title: assertion.name ?? ruleId,
    description: assertion.description ?? '',
    result: outcome,
    module: moduleName,
    engine: 'qualweb',
    engineVersion,
    wcagCriteria: criteria,
    elements,
    elementsTotal,
    counts: {
      passed: assertion.metadata?.passed ?? 0,
      warning: assertion.metadata?.warning ?? 0,
      failed: assertion.metadata?.failed ?? 0,
      inapplicable: assertion.metadata?.inapplicable ?? 0,
    },
  };

  if (primary) result.wcag = { criterion: primary.criterion, level: primary.level };
  if (moduleName === 'act-rules' && assertion.mapping) result.actRule = assertion.mapping;
  if (moduleName === 'wcag-techniques' && assertion.mapping) result.technique = assertion.mapping;
  if (assertion.metadata?.url) result.url = assertion.metadata.url;
  if (assertion.metadata?.description) result.outcomeDescription = assertion.metadata.description;
  if (elements[0]) result.element = elements[0];

  return result;
}

export interface NormalizedResults {
  results: AccessibilityResult[];
  summary: ReportSummary;
  wcagFailures: WcagLevelSummary;
  rulesByModule: Record<string, number>;
  /** Versao declarada pelo proprio QualWeb em system.version. */
  qualwebSystemVersion: string | null;
}

export function normalizeQualwebReport(raw: RawQualwebReport, engineVersion: string): NormalizedResults {
  const results: AccessibilityResult[] = [];
  const rulesByModule: Record<string, number> = {};

  for (const moduleName of EVALUATION_MODULES) {
    const moduleReport: RawEvaluationModule | undefined = raw.modules?.[moduleName];
    if (!moduleReport?.assertions) continue;

    let count = 0;
    for (const assertion of Object.values(moduleReport.assertions)) {
      const normalized = normalizeAssertion(assertion, moduleName, engineVersion);
      if (!normalized) continue;
      results.push(normalized);
      count++;
    }
    rulesByModule[moduleName] = count;
  }

  const summary: ReportSummary = { passed: 0, failed: 0, warning: 0, inapplicable: 0, manual: 0 };
  const wcagFailures: WcagLevelSummary = { A: 0, AA: 0, AAA: 0, unmapped: 0 };

  for (const result of results) {
    summary[result.result] += 1;

    if (result.result !== 'failed') continue;
    // Uma regra que falha conta uma vez, no nivel mais severo a que ela responde.
    const level = result.wcag?.level;
    if (level) wcagFailures[level] += 1;
    else wcagFailures.unmapped += 1;
  }

  return {
    results,
    summary,
    wcagFailures,
    rulesByModule,
    qualwebSystemVersion: raw.system?.version ?? null,
  };
}

export function extractPageInfo(raw: RawQualwebReport): {
  title: string | null;
  elementCount: number | null;
  lang: string | null;
  viewport: { width: number; height: number; mobile: boolean; landscape: boolean } | null;
  userAgent: string | null;
  htmlSizeBytes: number | null;
} {
  const dom = raw.system?.page?.dom;
  const viewport = raw.system?.page?.viewport;
  const resolution = viewport?.resolution;

  return {
    title: dom?.title ?? null,
    elementCount: dom?.elementCount ?? null,
    lang: extractLang(dom?.html),
    viewport:
      resolution?.width !== undefined && resolution?.height !== undefined
        ? {
            width: resolution.width,
            height: resolution.height,
            mobile: viewport?.mobile ?? false,
            landscape: viewport?.landscape ?? true,
          }
        : null,
    userAgent: viewport?.userAgent ?? null,
    // Bytes do HTML que o QualWeb capturou, ja com seus proprios scripts injetados —
    // nao e o peso real da resposta de rede. Ver comentario em PageInfo.
    htmlSizeBytes: dom?.html ? Buffer.byteLength(dom.html, 'utf-8') : null,
  };
}

function extractLang(html: string | undefined): string | null {
  if (!html) return null;
  const match = /<html[^>]*\slang\s*=\s*["']([^"']*)["']/i.exec(html);
  return match?.[1] ?? null;
}
