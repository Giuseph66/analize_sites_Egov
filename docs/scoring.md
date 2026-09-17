# Score e classificação

## Situação atual (2026-09-17)

A nota padrão é a do **algoritmo do AccessMonitor** (AMA, Portugal), calculada pelo
pacote oficial [`@a12e/accessmonitor-rulesets`](https://github.com/amagovpt/accessmonitor-rulesets)
(MIT) sobre o relatório bruto do QualWeb. Não é um port nosso: a versão 2.0.0 do
pacote expõe `processEvaluation(qualwebReport)`, que é o mesmo pipeline do
validador — contadores de elementos, mapeamento QualWeb → testes, conformidade
por nível e nota 1–10.

O que isto substitui: a versão anterior deste documento dizia que implementar o
AccessMonitor exigiria portar `mapping.ts` (2133 linhas) e reconstruir os
contadores. Isso era verdade para o pacote 1.x; o 2.0.0 embute tudo.

### Evidência de que o AMAWeb usa esta metodologia

Comparação contra `https://www.altogarcas.mt.gov.br/`, na mesma tarde:

| | AMAWeb | AccessMonitor sobre nosso raw |
|---|---|---|
| Erros A / AA / AAA | 5 / 0 / 0 | **5 / 0 / 0** |
| Revisar A / AA / AAA | 4 / 0 / 2 | **4 / 0 / 2** |
| Aceito A / AA / AAA | 15 / 10 / 1 | 16 / 10 / 1 |
| Testes | 37 | 38 |
| Nota | 8.3 | 8.7 |

Erros e avisos idênticos por nível. Um teste aceito a mais (38 vs 37) explica
os 0.4 de nota — versões do ruleset, do QualWeb e o instante da captura podem
diferir. Os textos do relatório do AMAWeb ("Encontrei N casos…", "Localizei…",
"Identifiquei…") são, palavra por palavra, as strings `translations.pt` deste
pacote.

Por isso a interface diz **"mesmo algoritmo, não a execução oficial"** — e
continua não afirmando que reproduz o AMAWeb.

## O algoritmo (referência)

Reconstituído do código MIT; hoje executado pelo pacote, não por nós.

```
rel = 0 ; pon = 0
para cada teste t com resultado:
    v = ruleset[t]
    se v.result == 'warning': ignora
    se calculável (depende de v.type e dos contadores elems[v.elem], elems[v.test]):
        s = pontuação do teste:
            prop : max(1, v.score - (v.score / elems[v.elem]) * elems[v.test])
            decr : max(1, v.score - round(max(0, elems[v.test] - v.top) / v.steps))
            true/fals : v.score
        p = Σ (v.trust * w) para cada w em v.dis com w > 1
        rel += s * (p / 5) ; pon += (p / 5)
nota = (rel / pon).toFixed(1)
```

Conformidade (`conform`): erros por nível, contando os testes de cor vermelha
(`testColors[t] === 'R'`), no formato `"A@AA@AAA"`.

## O que a camada AccessMonitor acrescenta ao relatório

Por avaliação (`report.accessmonitor`):

- `totalTests` — o "práticas identificadas" do AMAWeb
- `score`, `conform {A, AA, AAA}`
- `byColor` — tabela Aceito / Revisar / Erros × A / AA / AAA, a mesma do resumo do AMAWeb
- `elementCounters` — img, a, button, table, hx… usados pelo algoritmo
- `practices[]` — cada teste que disparou, com:
  - `key` (`hx_03`), `group` (`hx`) e `groupLabel` ("Cabeçalhos") — 50 categorias
  - `color` R/Y/G e `level` A/AA/AAA — **inclusive para o que no QualWeb é best
    practice sem critério** (é o ruleset que atribui o nível)
  - `title` e `description` em português, com a contagem aplicada, sem HTML
  - `technique` (técnica WCAG ou regra ACT, com link W3C) e `criteria`
  - `score`, `trust`, `weighted` (o `score@peso` atribuído)
  - `qualwebRules` + `linkKind` — regras QualWeb ligadas, e como

Por regra QualWeb (`results[]`), facetas derivadas dos dados que o QualWeb já dá:

- `principle` (Perceptível / Operável / Compreensível / Robusto)
- `guideline` + `guidelineName` (`1.3` → "Adaptável"; tabela estática da WCAG 2.1)
- `techniqueFamily` (H → HTML, C → CSS, G → Geral, F → Falha comum, ARIA, SCR…)
- `targets` (elementos-alvo declarados pela regra: `img`, `a`, `table`…)
- `accessmonitorKeys` (testes AccessMonitor ligados)

## Limites, sem maquiagem

1. **Ligação teste ↔ regra é parcial.** `DOMAIN_MAPPING` declara a chave para
   ~97 regras; outras têm `hasCustomHandler` com lógica interna ao pacote. Para
   essas, ligamos pelo código W3C que ambos citam (técnica ou id ACT). Quando nem
   isso coincide — `img_01b` cita F65, `QW-ACT-R17` cita a ACT 23a2a8 — a prática
   fica **sem regra ligada e sem elementos**. Não inventamos ligação por
   semelhança de critério.
2. **Evidência não vem do pacote.** `assertionEvidence` sai vazio porque o pacote
   lê `results[].pointer` (formato QualWeb 0.8) e o 0.9 entrega
   `results[].elements[]`. Os elementos mostrados vêm das regras QualWeb ligadas.
3. **Testes que dependem do validador W3C** (`w3c_validator_*`) não disparam:
   não configuramos validador.
4. **Textos do ruleset têm quirks.** Ex.: `heading_04` diz "Identifiquei 1
   cabeçalhos de nível 1. Devia haver um." — a contagem que o texto exibe não é
   a que o teste avalia. Reproduzimos o que o pacote entrega; o AMAWeb mostra o
   mesmo.
5. **Sem afiliação.** Ferramenta independente; usa o algoritmo publicado sob
   MIT. Não é a execução oficial do AMAWeb nem da AMA.

## Score experimental (mantido, opcional)

`SCORING_STRATEGY=experimental-v1`. Fórmula própria, 0–10:

```
considera apenas passed / failed / warning (inapplicable fora)
peso por nível do critério principal: A=3, AA=2, AAA=1, sem critério=1
crédito: passed=1, warning=0.5, failed=0
score = 10 * Σ(peso * crédito) / Σ(peso)
```

Continua rotulado como experimental na interface. Serve para comparar execuções
entre si; não corresponde a nenhuma ferramenta externa. Também é o fallback
automático quando o pipeline do AccessMonitor falha — e o rótulo diz isso.

## Contrato de extensão

```ts
export interface ScoringStrategy {
  readonly id: string;
  readonly label: string;
  readonly disclaimer: string | null;
  compute(input: { results: AccessibilityResult[]; accessmonitor: AccessMonitorSummary | null }): ScoreInfo;
}
```

Registrar em `packages/report-normalizer/src/scoring/index.ts` e selecionar por
`SCORING_STRATEGY`.

## Fontes

- `@a12e/accessmonitor-rulesets` — https://github.com/amagovpt/accessmonitor-rulesets (MIT)
- `generateScore` / `calculateConform` originais — https://github.com/amagovpt/accessmonitor-docker/blob/main/src/util/middleware.ts (MIT)
- AMAWeb — https://amaweb.unifesp.br/avaliador
