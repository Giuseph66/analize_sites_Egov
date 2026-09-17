import type { AccessMonitorSummary, AccessibilityResult, ScoreInfo, WcagLevel } from '@lae/shared-types';

export interface ScoringInput {
  results: AccessibilityResult[];
  /** Camada AccessMonitor, quando o pipeline rodou; null se falhou. */
  accessmonitor: AccessMonitorSummary | null;
}

export interface ScoringStrategy {
  readonly id: string;
  readonly label: string;
  /** Texto exibido junto ao score quando ele nao e uma metrica oficial. */
  readonly disclaimer: string | null;
  compute(input: ScoringInput): ScoreInfo;
}

const LEVEL_WEIGHT: Record<WcagLevel, number> = { A: 3, AA: 2, AAA: 1 };
const UNMAPPED_WEIGHT = 1;

/**
 * Score experimental v1 — ver docs/scoring.md.
 *
 * Formula nossa, simples e documentada. Serve para comparar execucoes do mesmo
 * avaliador entre si; nao corresponde a nenhuma ferramenta externa.
 */
export class ExperimentalScoreV1 implements ScoringStrategy {
  readonly id = 'experimental-v1';
  readonly label = 'Score experimental v1';
  readonly disclaimer =
    'Score experimental — não representa a pontuação oficial do AMAWeb nem do AccessMonitor.';

  compute({ results }: ScoringInput): ScoreInfo {
    let weighted = 0;
    let totalWeight = 0;

    for (const result of results) {
      // Regras inaplicaveis nao dizem nada sobre a pagina; ficam fora da conta.
      if (result.result === 'inapplicable') continue;

      const level = result.wcag?.level;
      const weight = level ? LEVEL_WEIGHT[level] : UNMAPPED_WEIGHT;

      let credit: number;
      if (result.result === 'passed') credit = 1;
      else if (result.result === 'warning' || result.result === 'manual') credit = 0.5;
      else credit = 0;

      weighted += weight * credit;
      totalWeight += weight;
    }

    const value = totalWeight === 0 ? 0 : Math.round((10 * weighted) / totalWeight * 10) / 10;

    return {
      value,
      scale: [0, 10],
      strategy: this.id,
      label: this.label,
      disclaimer: this.disclaimer,
    };
  }
}

/**
 * Nota pelo algoritmo do AccessMonitor (AMA, Portugal — MIT), calculada pelo
 * pacote oficial @a12e/accessmonitor-rulesets sobre o relatorio bruto do QualWeb.
 *
 * E a metodologia que o AMAWeb usa: nos sites comparados, erros e avisos por
 * nivel coincidiram exatamente; a nota ficou a 0.4 de distancia por um teste
 * aceito a mais (38 vs 37). Por isso o disclaimer continua: e o MESMO algoritmo,
 * nao a MESMA execucao — versao do ruleset, do QualWeb e o instante da pagina
 * podem diferir. Ver docs/scoring.md.
 *
 * Quando o pipeline falha, cai para o experimental-v1 e diz isso no rotulo.
 */
export class AccessMonitorScore implements ScoringStrategy {
  readonly id = 'accessmonitor';
  readonly label = 'Nota — algoritmo AccessMonitor';
  readonly disclaimer =
    'Mesmo algoritmo do AccessMonitor (AMA, MIT), que o AMAWeb utiliza. Não é a execução oficial do AMAWeb: ' +
    'versões do ruleset e do motor, e o instante em que a página foi capturada, podem diferir.';

  private readonly fallback = new ExperimentalScoreV1();

  compute(input: ScoringInput): ScoreInfo {
    const summary = input.accessmonitor;
    if (!summary || !Number.isFinite(summary.score)) {
      const fallback = this.fallback.compute(input);
      return {
        ...fallback,
        strategy: `${this.id}->${fallback.strategy}`,
        label: `${fallback.label} (AccessMonitor indisponível nesta avaliação)`,
      };
    }
    return {
      value: summary.score,
      scale: [1, 10],
      strategy: this.id,
      label: `${this.label} (ruleset ${summary.packageVersion})`,
      disclaimer: this.disclaimer,
    };
  }
}

const REGISTRY = new Map<string, ScoringStrategy>();
function register(strategy: ScoringStrategy): void {
  REGISTRY.set(strategy.id, strategy);
}
register(new ExperimentalScoreV1());
register(new AccessMonitorScore());

export const DEFAULT_SCORING_STRATEGY = 'accessmonitor';

export function getScoringStrategy(id?: string): ScoringStrategy {
  if (id) {
    const found = REGISTRY.get(id);
    if (found) return found;
  }
  return REGISTRY.get(DEFAULT_SCORING_STRATEGY)!;
}

export function listScoringStrategies(): string[] {
  return [...REGISTRY.keys()];
}
