/**
 * Contratos compartilhados entre API, frontend e pacotes internos.
 *
 * Regra: nao inventar dados que o QualWeb nao fornece. Campos ausentes ficam
 * `undefined` (omitidos no JSON) ou `null` quando a ausencia e significativa.
 */

// ---------------------------------------------------------------------------
// Resultado normalizado
// ---------------------------------------------------------------------------

export type ResultOutcome = 'passed' | 'failed' | 'warning' | 'inapplicable' | 'manual';

export type WcagLevel = 'A' | 'AA' | 'AAA';

export type EngineId = 'qualweb';

export type QualwebModuleName = 'act-rules' | 'wcag-techniques' | 'best-practices' | 'counter';

export interface WcagCriterion {
  /** Numero do criterio, ex.: "1.1.1". */
  criterion: string;
  level: WcagLevel;
  /** Principio WCAG conforme reportado pelo QualWeb. */
  principle?: string;
  url?: string;
}

export interface ResultElement {
  html?: string;
  selector?: string;
  accessibleName?: string;
  attributes?: string[];
}

export interface AccessibilityResult {
  /** Identificador da regra no QualWeb, ex.: "QW-ACT-R17". */
  ruleId: string;
  title: string;
  description: string;
  result: ResultOutcome;
  /** Modulo do QualWeb que produziu o resultado. */
  module: QualwebModuleName;
  engine: EngineId;
  engineVersion: string;
  /** Criterio WCAG "principal" (o de nivel mais severo). Ausente em regras sem mapeamento. */
  wcag?: { criterion?: string; level?: WcagLevel };
  /** Todos os criterios de sucesso associados a regra. */
  wcagCriteria: WcagCriterion[];
  /** Codigo da tecnica WCAG (H24, F30, G141...). Somente no modulo wcag-techniques. */
  technique?: string;
  /** Identificador da regra ACT do W3C (ex.: "23a2a8"). Somente no modulo act-rules. */
  actRule?: string;
  /** URL de documentacao da regra. */
  url?: string;
  /** Primeiro elemento associado ao resultado, para exibicao rapida. */
  element?: ResultElement;
  /**
   * Elementos apontados pelos testes que produziram o veredito da regra, limitados
   * a MAX_ELEMENTS_PER_RESULT e com o HTML truncado. O conjunto completo esta em
   * data/evaluations/<id>/raw-qualweb.json.
   */
  elements: ResultElement[];
  /** Quantos elementos existiam antes do corte. */
  elementsTotal: number;
  /** Descricao textual do desfecho, vinda do QualWeb. */
  outcomeDescription?: string;
  /** Contagens internas da regra reportadas pelo QualWeb. */
  counts: { passed: number; warning: number; failed: number; inapplicable: number };
}

export interface ReportSummary {
  passed: number;
  failed: number;
  warning: number;
  inapplicable: number;
  manual: number;
}

export interface WcagLevelSummary {
  A: number;
  AA: number;
  AAA: number;
  /** Regras com falha sem criterio WCAG associado (ex.: algumas best practices). */
  unmapped: number;
}

export interface ScoreInfo {
  value: number;
  scale: [number, number];
  strategy: string;
  label: string;
  /** Texto obrigatorio na interface quando o score nao e oficial. */
  disclaimer: string | null;
}

export interface VersionInfo {
  app: string;
  node: string;
  chromium: string | null;
  qualwebCore: string;
  qualwebActRules: string;
  qualwebWcagTechniques: string;
  qualwebBestPractices: string;
  qualwebCounter: string;
  /** Versao que o proprio relatorio do QualWeb declara em system.version. */
  qualwebSystem: string | null;
}

export interface PageInfo {
  title: string | null;
  elementCount: number | null;
  lang: string | null;
  viewport: { width: number; height: number; mobile: boolean; landscape: boolean } | null;
  userAgent: string | null;
  /**
   * Bytes do HTML capturado pelo QualWeb (system.page.dom.html), NAO o tamanho da
   * resposta de rede: o QualWeb ja injetou seus proprios scripts nesse HTML antes de
   * o lermos, entao o valor e maior que o peso real transferido pela pagina.
   */
  htmlSizeBytes: number | null;
}

export interface NetworkFailure {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  errorText?: string;
}

export interface ConsoleEntry {
  type: string;
  text: string;
  at: string;
}

export interface RedirectHop {
  from: string;
  status: number;
  to: string;
}

export interface EvaluationTimings {
  browserLaunchMs: number | null;
  navigationMs: number | null;
  qualwebMs: number | null;
  normalizationMs: number | null;
  totalMs: number;
  /** Tempo por modulo do QualWeb, medido pelo decorador de instrumentacao. */
  modulesMs: Record<string, number>;
  /** PerformanceNavigationTiming lido dentro da pagina. */
  page: Record<string, number> | null;
}

export interface EvaluationDiagnostics {
  browserExecutable: string | null;
  browserVersion: string | null;
  browserPid: number | null;
  userAgent: string | null;
  httpStatus: number | null;
  redirects: RedirectHop[];
  consoleMessages: ConsoleEntry[];
  pageErrors: string[];
  networkFailures: NetworkFailure[];
  screenshotPath: string | null;
  htmlPath: string | null;
}

export interface EvaluationReport {
  id: string;
  /** URL exatamente como o usuario digitou. */
  url: string;
  /** URL efetivamente carregada pelo Chromium (pode diferir dentro do Docker). */
  resolvedUrl: string;
  /** URL final apos redirects. */
  finalUrl: string | null;
  startedAt: string;
  finishedAt: string;
  /** Duracao total em milissegundos. */
  duration: number;
  score: ScoreInfo;
  summary: ReportSummary;
  /** Regras com falha, agrupadas por nivel WCAG. */
  wcagFailures: WcagLevelSummary;
  /** Total de regras executadas por modulo. */
  rulesByModule: Record<string, number>;
  page: PageInfo;
  versions: VersionInfo;
  timings: EvaluationTimings;
  diagnostics: EvaluationDiagnostics;
  results: AccessibilityResult[];
}

// ---------------------------------------------------------------------------
// Ciclo de vida da avaliacao
// ---------------------------------------------------------------------------

export type EvaluationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type EvaluationStage =
  | 'created'
  | 'queued'
  | 'url-resolved'
  | 'browser-launched'
  | 'page-loaded'
  | 'act-rules'
  | 'wcag-techniques'
  | 'best-practices'
  | 'counter'
  | 'normalizing'
  | 'saving'
  | 'completed'
  | 'failed';

export interface EvaluationFailure {
  message: string;
  /** Categoria para a interface distinguir causa provavel. */
  kind: 'invalid-url' | 'blocked-url' | 'navigation' | 'timeout' | 'browser' | 'qualweb' | 'internal';
  stack?: string;
}

export interface EvaluationMetadata {
  id: string;
  requestId: string;
  url: string;
  resolvedUrl: string | null;
  status: EvaluationStatus;
  stage: EvaluationStage;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  error: EvaluationFailure | null;
}

// ---------------------------------------------------------------------------
// Logs e eventos
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Origem do log — exigido em §29 para separar o que vem de onde. */
export type LogSource = 'APP' | 'BROWSER' | 'TARGET PAGE' | 'QUALWEB';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  evaluationId?: string;
  requestId?: string;
  data?: Record<string, unknown>;
}

export type EvaluationEvent =
  | { type: 'log'; entry: LogEntry }
  | { type: 'stage'; stage: EvaluationStage; at: string }
  | { type: 'status'; status: EvaluationStatus; at: string }
  | { type: 'done'; status: EvaluationStatus; at: string };

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface CreateEvaluationRequest {
  url: string;
}

export interface CreateEvaluationResponse {
  evaluationId: string;
  status: EvaluationStatus;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  api: 'ok';
  qualweb: 'ok' | 'error';
  browser: 'ok' | 'error';
  versions: VersionInfo;
  checkedAt: string;
  details?: Record<string, string>;
}

export interface DebugResponse {
  api: 'ok';
  qualweb: 'ok' | 'error';
  browser: 'ok' | 'error';
  versions: VersionInfo;
  process: {
    pid: number;
    uptimeSeconds: number;
    memory: NodeJS.MemoryUsage;
    cwd: string;
  };
  queue: {
    running: number;
    queued: number;
    maxConcurrent: number;
    maxQueueSize: number;
  };
  evaluations: {
    total: number;
    running: string[];
    lastCompleted: EvaluationMetadata | null;
    averageDurationMs: number | null;
  };
  config: Record<string, string>;
}
