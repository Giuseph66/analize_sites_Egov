import type { AccessibilityResult, ScoreInfo, WcagLevel } from '@lae/shared-types';

export interface ScoringStrategy {
  readonly id: string;
  readonly label: string;
  /** Texto exibido junto ao score quando ele nao e uma metrica oficial. */
  readonly disclaimer: string | null;
  compute(results: AccessibilityResult[]): ScoreInfo;
}

const LEVEL_WEIGHT: Record<WcagLevel, number> = { A: 3, AA: 2, AAA: 1 };
const UNMAPPED_WEIGHT = 1;

/**
 * Score experimental v1 — ver docs/scoring.md.
 *
 * NAO e a formula do AMAWeb (nao publica) nem a do AccessMonitor (publica, mas
 * depende de metadados que o QualWeb nao fornece). Serve para comparar execucoes
 * do mesmo avaliador entre si.
 */
export class ExperimentalScoreV1 implements ScoringStrategy {
  readonly id = 'experimental-v1';
  readonly label = 'Score experimental v1';
  readonly disclaimer =
    'Score experimental — não representa a pontuação oficial do AMAWeb nem do AccessMonitor.';

  compute(results: AccessibilityResult[]): ScoreInfo {
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

const REGISTRY = new Map<string, ScoringStrategy>();
function register(strategy: ScoringStrategy): void {
  REGISTRY.set(strategy.id, strategy);
}
register(new ExperimentalScoreV1());

export function getScoringStrategy(id?: string): ScoringStrategy {
  if (id) {
    const found = REGISTRY.get(id);
    if (found) return found;
  }
  return REGISTRY.get('experimental-v1')!;
}

export function listScoringStrategies(): string[] {
  return [...REGISTRY.keys()];
}
