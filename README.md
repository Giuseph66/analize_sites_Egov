# Local Accessibility Evaluator

Laboratório local de análise de acessibilidade web. Você informa uma URL — inclusive
`http://localhost:5173` — e o sistema abre a página num Chromium controlado, executa
o **QualWeb** (ACT Rules + WCAG Techniques + Best Practices) e devolve um relatório
navegável, com o processo inteiro visível em log.

Não é um clone do [AMAWeb](https://amaweb.unifesp.br) — é uma reconstrução do
*processo* de avaliação, feita para ser observada e modificada. O AMAWeb não tem
código público; nada dele foi copiado. Ver [`docs/research.md`](docs/research.md).

```
URL → Chromium → QualWeb → JSON bruto → Normalizador → Relatório + Logs
```

## O que dá para fazer

* avaliar qualquer URL, incluindo aplicações rodando na sua máquina
* acompanhar a execução ao vivo (SSE): cada etapa e cada linha de log
* ver, por regra: critério WCAG, resultado, elemento, seletor CSS e descrição
* filtrar por status, nível WCAG, módulo, critério, ACT rule, técnica ou texto
* baixar o JSON normalizado, o JSON original do QualWeb e o relatório EARL
* capturar screenshot e HTML da página avaliada
* inspecionar recursos que falharam, `console.*` e erros JS da página analisada
* comparar a saída do QualWeb com a nossa normalização — e, opcionalmente, com axe-core

---

## Pré-requisitos

**Com Docker** (recomendado): Docker 20.10+ e Docker Compose v2.
**Sem Docker**: Node.js ≥ 20 (testado em 22 e 24). O `npm install` baixa o Chrome do
Puppeteer (~150 MB) automaticamente.

## Instalação e execução

### Docker

```bash
git clone <projeto>
cd <projeto>
docker compose up --build
```

Abra **http://localhost:3000**.

Para subir também as páginas de teste em `:5173` (ruim) e `:5174` (boa):

```bash
docker compose --profile test-sites up --build
```

### Sem Docker

```bash
npm install
npm run dev          # API em :3001, interface em :3000
```

Em outro terminal, se quiser as páginas de teste:

```bash
npm run test-sites:bad    # http://localhost:5173
npm run test-sites:good   # http://localhost:5174
```

---

## Como analisar uma aplicação em localhost

Digite `http://localhost:5173` no campo e clique em **Analisar**. Dentro do Docker,
`localhost` seria o próprio container, então o sistema reescreve o host de forma
transparente e registra as duas URLs:

```
[14:25:16] [APP] [Evaluation 6f8123eb] User URL:     http://localhost:5173/
[14:25:16] [APP] [Evaluation 6f8123eb] Resolved URL: http://host.docker.internal:5173/ (host reescrito para o container)
```

> **Importante:** o seu servidor de desenvolvimento precisa escutar em `0.0.0.0`,
> não apenas em `127.0.0.1`. Use `vite --host`, `ng serve --host 0.0.0.0` etc.
> Detalhes e diagnóstico em [`docs/architecture.md`](docs/architecture.md) §12.

Endereços de rede privada (`192.168.x.y`, `10.x.y.z`) **não** são reescritos: já são
alcançáveis do container.

---

## Comandos

```bash
npm run dev                 # API (:3001) + interface (:3000)
npm run build               # typecheck de tudo + build do frontend
npm run test                # unitários + integração (executam QualWeb de verdade)
npm run lint                # typecheck
npm run evaluate -- <url>   # prova de conceito isolada do motor, sem API
npm run compare -- <url>    # QualWeb bruto vs formato normalizado
npm run logs                # tail -f de logs/application.log
npm run clean               # limpa data/ e logs/
npm run test-sites:bad      # serve test-sites/bad em :5173
npm run test-sites:good     # serve test-sites/good em :5174
```

---

## Logs

Aparecem em `docker compose logs -f`, em arquivo e na interface.

```
logs/application.log   tudo (JSON Lines)
logs/evaluations.log   apenas linhas de avaliações
logs/browser.log       apenas Chromium e página avaliada
logs/error.log         apenas erros

data/evaluations/<id>/logs.txt     legível, só desta avaliação
data/evaluations/<id>/logs.jsonl   estruturado
```

Cada linha traz a origem — `APP`, `BROWSER`, `TARGET PAGE` ou `QUALWEB` — e o
`evaluationId`. Exemplo real:

```
[14:25:16.055] [APP        ] [Evaluation 6f8123eb] Resolved URL: http://host.docker.internal:5173/
[14:25:16.302] [BROWSER    ] [Evaluation 6f8123eb] Chromium ready in 245 ms
[14:25:16.503] [BROWSER    ] [Evaluation 6f8123eb] HTTP 200 http://host.docker.internal:5173/
[14:25:16.505] [BROWSER    ] [Evaluation 6f8123eb] Chromium PID: 157
[14:25:17.157] [APP        ] [Evaluation 6f8123eb] DOM loaded {"finalUrl":"...","navigationMs":681}
[14:25:17.383] [QUALWEB    ] [Evaluation 6f8123eb] act-rules started
[14:25:17.586] [QUALWEB    ] [Evaluation 6f8123eb] act-rules completed in 203 ms {"passed":7,"warning":6,"failed":13,"inapplicable":42}
```

---

## Configuração

Copie `.env.example` para `.env` — o arquivo é lido na subida da API, e o que já
estiver definido no ambiente (docker-compose, linha de comando) tem precedência
sobre ele. Confira o que está valendo de fato em `/api/debug` → `config`.

As opções que mais importam:

| Variável | Padrão | Para quê |
|---|---|---|
| `BROWSER_HEADLESS` | `true` | `false` abre janela real (fora do container, com ambiente gráfico) |
| `PAGE_TIMEOUT` | `30000` | teto de carregamento da página |
| `EVALUATION_TIMEOUT` | `60000` | teto da avaliação inteira; precisa cobrir `PAGE_TIMEOUT + SPA_SETTLE_MAX_MS` |
| `SPA_SETTLE_MAX_MS` | `4000` | espera extra para SPAs renderizarem após o load (`0` desativa) |
| `CAPTURE_SCREENSHOT` | `false` | grava `data/evaluations/<id>/screenshot.png` |
| `SAVE_HTML` | `false` | grava `data/evaluations/<id>/page.html` |
| `MAX_CONCURRENT_EVALUATIONS` | `2` | Chromiums simultâneos |
| `MAX_QUEUE_SIZE` | `20` | acima disso a API responde 429 |
| `ALLOW_LOCAL_NETWORK` | `true` | avaliar localhost é o propósito da ferramenta |
| `ALLOW_FILE_PROTOCOL` | `false` | libera `file://` |
| `BROWSER_EXECUTABLE_PATH` | — | usar outro Chromium |
| `SCORING_STRATEGY` | `experimental-v1` | algoritmo de nota |

```bash
CAPTURE_SCREENSHOT=true SAVE_HTML=true npm run dev
BROWSER_HEADLESS=false npm run dev
PAGE_TIMEOUT=120000 EVALUATION_TIMEOUT=180000 npm run dev
```

---

## Como interpretar os resultados

O QualWeb produz quatro vereditos por regra:

| Veredito | Significado |
|---|---|
| `failed` | barreira detectada automaticamente |
| `warning` | precisa de verificação humana — não é falha comprovada |
| `passed` | a regra se aplica e foi satisfeita |
| `inapplicable` | a regra não se aplica a esta página |

`inapplicable` costuma ser a maioria e **não** significa problema.
`summary.manual` é sempre `0`: o QualWeb não tem esse veredito — o que exige
verificação humana vem como `warning`.

**Erros por nível WCAG:** cada regra com falha é contada **uma vez**, no nível mais
severo a que ela responde (A > AA > AAA). Regras sem critério de sucesso — parte das
best practices — aparecem em "sem critério".

**Nota:** o score é **experimental** e está marcado como tal na interface. Não é a
fórmula do AMAWeb (não pública) nem a do AccessMonitor (pública, mas depende de
metadados que o QualWeb não fornece). O algoritmo do AccessMonitor está documentado
e o contrato permite trocar a estratégia — ver [`docs/scoring.md`](docs/scoring.md).

Nenhum campo é inventado: o que o QualWeb não fornece fica ausente ou `null`.

---

## Testes

```bash
npm run test
```

* **unitários** — política de URL (SSRF, esquemas, reescrita de localhost),
  leitura do `.env`, normalizador e score.
* **integração** — sobem um servidor HTTP real e rodam o **QualWeb de verdade**
  contra ele: HTML simples, página com barreiras, redirect 302, 404, 500, resposta
  vazia, DOM construído por JavaScript, recursos que falham, URL inválida, esquema
  bloqueado, host inexistente e timeout de navegação (verificando que a mensagem
  de erro diz a causa real, e não uma genérica).

Verificação de que o motor realmente diferencia páginas:

```
test-sites/bad   → 24 regras com verdict failed  (WCAG A=16 · AA=4 · AAA=1)
test-sites/good  →  1 regra  com verdict failed
```

---

## Verificação de integridade

```bash
npm run compare -- http://localhost:5173
```

```
outcome         bruto   normalizado   diferenca
passed             24            24           0
warning             8             8           0
failed             24            24           0
inapplicable       73            73           0

regras no bruto        : 129
regras no normalizado  : 129
perdidas na conversao  : 0
inventadas             : 0

OK: a normalizacao corresponde exatamente ao bruto.
```

Com `--with-axe`, roda também o axe-core como **motor secundário**. Cada resultado
carrega o campo `engine` — o axe nunca substitui o QualWeb silenciosamente.

---

## Observabilidade

`http://localhost:3000/debug` mostra status da API, do QualWeb e do Chromium,
versões, memória, PID, fila, avaliações em execução, última concluída e tempo médio.

---

## Estrutura

```
apps/
  api/                  Fastify: REST, SSE, health, /debug
  frontend/             React + TypeScript + Vite
packages/
  evaluator/            motor, fila, política de URL, repositório
  report-normalizer/    QualWeb bruto → formato interno; score
  shared-types/         contratos
  logger/               log estruturado com fan-out
experiments/
  qualweb-test/         prova de conceito isolada do motor
scripts/                comparação, servidor de test-sites, dev, clean
test-sites/good|bad/    páginas de referência
data/                   raw/ reports/ evaluations/
logs/
docs/                   research · architecture · qualweb · scoring · debugging · api
docker/                 Dockerfile e imagem das páginas de teste
```

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/research.md`](docs/research.md) | AMAWeb, AccessMonitor e QualWeb: versões, o que é mantido, o que é reaproveitável |
| [`docs/architecture.md`](docs/architecture.md) | decisões de projeto, localhost dentro do Docker, segurança, limites |
| [`docs/qualweb.md`](docs/qualweb.md) | uso do motor, armadilhas e defeitos encontrados |
| [`docs/scoring.md`](docs/scoring.md) | algoritmo do AccessMonitor documentado; nosso score experimental |
| [`docs/debugging.md`](docs/debugging.md) | logs, `error.kind`, Chromium, timeouts, problemas conhecidos |
| [`docs/api.md`](docs/api.md) | todos os endpoints |

---

## Problemas conhecidos

* `page.html` inclui os scripts injetados pelo QualWeb (~500 KB mesmo em páginas
  pequenas) — o core não aguarda o hook `afterPageLoad`. Ver `docs/qualweb.md` §2.
* `elements` é recortado em 25 por regra, com HTML truncado em 4000 caracteres; o
  conjunto completo está em `raw-qualweb.json`.
* `summary.manual` é sempre `0` — o QualWeb não tem esse veredito.
* `PAGE_TIMEOUT` maior que `EVALUATION_TIMEOUT` faz o `puppeteer-cluster` encerrar a
  tarefa antes da hora, e a avaliação falha. A API avisa disso na subida.
* SPAs client-side-rendered: o sistema espera o DOM ficar quieto antes de avaliar
  (`SPA_SETTLE_MAX_MS`, padrão 4 s), mas é uma heurística — em raras execuções,
  numa mesma SPA com redirecionamento assíncrono, `page.title`/`elementCount` podem
  ficar um instante atrás do conteúdo real (as regras de acessibilidade em si não
  são afetadas). Ver `docs/qualweb.md` §11.
* Uma avaliação abre e fecha um Chromium (~250 ms). É deliberado, para isolamento.
* O backend roda com `tsx`, sem etapa de compilação própria.
* Se o `docker compose up` falhar com *"all predefined address pools have been fully
  subnetted"*, o pool de redes do seu Docker acabou — problema do ambiente, não deste
  projeto. Ver `docs/debugging.md`.

---

## Licenças

Este projeto: MIT. Dependências relevantes:

| Projeto | Licença | Papel |
|---|---|---|
| [QualWeb](https://github.com/qualweb/qualweb) | ISC | motor de avaliação |
| [AccessMonitor](https://github.com/amagovpt/accessmonitor-docker) (AMA, Portugal) | MIT | referência arquitetural; flags do Chromium; algoritmo de score documentado |
| [axe-core](https://github.com/dequelabs/axe-core) | MPL-2.0 | motor secundário opcional, apenas no `npm run compare` |

O AMAWeb (UNIFESP/IFRS) é referência **funcional**. Nenhum código dele foi utilizado.
