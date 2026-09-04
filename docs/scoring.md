# Score

## Situação

O AMAWeb apresenta uma "nota geral". **Não localizamos documentação pública da fórmula
usada pelo AMAWeb**, nem seu código-fonte. Portanto não afirmamos, em lugar nenhum da
interface ou do relatório, que nosso score reproduz o do AMAWeb.

O que **existe** publicamente é o algoritmo do **AccessMonitor** (AMA, Portugal),
licença MIT, em `amagovpt/accessmonitor-docker/src/util/middleware.ts`. O AccessMonitor
usa QualWeb como motor, então a fórmula é aplicável a relatórios do QualWeb — mas depende
de metadados que não estão no QualWeb.

---

## Algoritmo do AccessMonitor (documentado, não implementado ainda)

Escala 1–10. Reconstituído da leitura de `middleware.ts` (função `generateScore`):

```
rel = 0 ; pon = 0
para cada teste t presente no relatório:
    v = ruleset[t]                      # metadados de @a12e/accessmonitor-rulesets
    se v.result == 'warning': ignora
    decide se o teste é "calculável" conforme v.type:
        'true' | 'decr' : precisa de elems[v.elem] e elems[v.test]
        'fals'          : precisa de elems[v.elem] (ou v.elem == 'all')
        'prop'          : precisa de elems[v.elem] e elems[v.test]
    se calculável:
        s = pontuação do teste, conforme v.type:
            prop : s = max(1, v.score - (v.score / elems[v.elem]) * elems[v.test])
            decr : s = max(1, v.score - round(max(0, elems[v.test] - v.top) / v.steps))
            true/fals : s = v.score
        p = Σ ( v.trust * w )  para cada w em v.dis com w > 1
        rel += s * (p / 5)
        pon += (p / 5)
score = (rel / pon).toFixed(1)
```

Conformidade A/AA/AAA (`calculateConform`) conta, por nível, os testes marcados como
vermelho (`testColors[t] === 'R'`) e devolve `"nA@nAA@nAAA"`.

### Por que não implementamos agora

1. Depende de `@a12e/accessmonitor-rulesets` para `score`, `trust`, `type`, `elem`, `test`,
   `top`, `steps`, `dis`, `level` de cada regra. É um pacote npm MIT — instalável.
2. Depende de `report.data.elems`, um dicionário de contadores de elementos que **não existe
   no relatório do QualWeb**. Ele é produzido por `mapping.ts` (2133 linhas) + varredura do
   HTML com `htmlparser2`/`css-select`. Portar isso é um projeto próprio.
3. O `accessmonitor-docker` ainda roda `@qualweb/core ^0.8.11`; os IDs e o formato de
   `results[].elements[]` mudaram no 0.9.5 — o mapeamento precisaria ser revalidado.

Está registrado como trabalho futuro. A arquitetura já permite trocar o algoritmo:
ver `packages/report-normalizer/src/scoring/`.

---

## Score experimental (o que está implementado)

Rotulado na interface e no JSON como **`"experimental"`**, com a mensagem:

> Score experimental — não representa a pontuação oficial do AMAWeb nem do AccessMonitor.

Fórmula, escala 0–10:

```
Considera apenas asserções cujo outcome ∈ {passed, failed, warning}.
(inapplicable é descartado: uma regra que não se aplica à página não diz nada sobre ela.)

peso por nível WCAG mais severo da asserção:
    A   -> 3
    AA  -> 2
    AAA -> 1
    sem critério WCAG (ex.: best practices sem success-criteria) -> 1

crédito por outcome:
    passed  -> 1.0
    warning -> 0.5      (precisa de verificação manual; não é falha comprovada)
    failed  -> 0.0

score = 10 * Σ(peso * crédito) / Σ(peso)
```

Propriedades: 10 quando nada falha e nada exige verificação; 0 quando tudo falha;
falhas de nível A pesam o triplo de falhas AAA; regras inaplicáveis não inflam a nota.

**Limitações honestas:** não pondera por quantidade de elementos afetados (uma página com
1 imagem sem alt e outra com 200 recebem a mesma penalização nessa regra), não usa confiança
por regra, e a escolha dos pesos 3/2/1 é arbitrária. É um indicador comparativo entre
execuções do mesmo avaliador, não uma medida de conformidade.

---

## Contrato de extensão

```ts
export interface ScoringStrategy {
  readonly id: string;          // 'experimental-v1'
  readonly label: string;
  readonly disclaimer: string | null;
  compute(report: NormalizedInput): { value: number; scale: [number, number]; detail?: unknown };
}
```

Registrar uma nova estratégia e selecioná-la por `SCORING_STRATEGY` no `.env`.

## Fontes

- `generateScore` / `calculateConform` — https://github.com/amagovpt/accessmonitor-docker/blob/main/src/util/middleware.ts (MIT)
- `@a12e/accessmonitor-rulesets` — https://github.com/amagovpt/accessmonitor-rulesets (MIT)
