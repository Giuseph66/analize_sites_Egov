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
  if (raw.htmlCode) element.html = raw.htmlCode;
  if (raw.pointer) element.selector = raw.pointer;
  if (raw.accessibleName) element.accessibleName = raw.accessibleName;
  if (raw.attributes) element.attributes = Array.isArray(raw.attributes) ? raw.attributes : [raw.attributes];
  return element;
}

/**
 * Elementos exibidos para a regra: apenas os dos testes cujo verdict coincide com
 * o desfecho da regra. Mostrar elementos "passed" numa regra que falhou confunde.
 */
function extractElements(assertion: RawAssertion, outcome: ResultOutcome): ResultElement[] {
  const tests: RawTestResult[] = assertion.results ?? [];
  const matching = tests.filter((test) => toOutcome(test.verdict) === outcome);
  const source = matching.length > 0 ? matching : tests;

  const elements: ResultElement[] = [];
  for (const test of source) {
    for (const rawElement of test.elements ?? []) {
      const element = toElement(rawElement);
      if (Object.keys(element).length > 0) elements.push(element);
    }
  }
  return elements;
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
  const elements = extractElements(assertion, outcome);

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
  };
}

function extractLang(html: string | undefined): string | null {
  if (!html) return null;
  const match = /<html[^>]*\slang\s*=\s*["']([^"']*)["']/i.exec(html);
  return match?.[1] ?? null;
}
