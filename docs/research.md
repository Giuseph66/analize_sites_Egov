# Pesquisa técnica — AMAWeb, AccessMonitor, QualWeb

Data da pesquisa: **2026-09-04**. Todas as versões abaixo foram lidas do registry do npm
e do código-fonte nos repositórios oficiais na data indicada.

---

## 1. AMAWeb (UNIFESP + IFRS)

| Item | Achado |
|---|---|
| Nome | AMAWeb — Avaliação e Monitoramento de Acessibilidade na Web |
| Instituições | IFRS (Centro Tecnológico de Acessibilidade — CTA) + UNIFESP, financiamento MPF |
| Início / lançamento | Projeto iniciado em 2022, lançamento oficial em agosto de 2024 |
| Endereço | `https://amaweb.unifesp.br` |
| Módulos | avaliador automático, checklist manual, manuais de orientação, observatório de acessibilidade |
| Código-fonte | **Não foi localizado repositório público.** Não há evidência de código aberto do avaliador. |
| Motor de avaliação | **Não declarado publicamente.** Não confirmamos qual engine usa. |

**Consequência para este projeto:** o AMAWeb é usado apenas como *referência funcional*
(o formato de relatório que queremos reproduzir: nota, contagem de erros/avisos/aprovados,
agrupamento por nível WCAG, detalhe por elemento). Nada de código do AMAWeb foi copiado,
nem poderia ser — não é público.

O ecossistema brasileiro anterior é o **ASES** (avaliador do eMAG, Software Público Brasileiro).
Ele avalia contra o eMAG, não contra WCAG/ACT diretamente, e não foi adotado aqui.

---

## 2. AccessMonitor (AMA, Portugal) — o modelo arquitetural real

O AccessMonitor é o validador do Observatório Português da Acessibilidade Web, mantido pela
Agência para a Modernização Administrativa (AMA), com algoritmo originado na FCUL.
**Todo o ecossistema é aberto sob licença MIT**, e é a fonte de referência arquitetural
mais útil que existe, porque ele *é* um wrapper de QualWeb.

| Repositório | Papel | Licença | Última atualização |
|---|---|---|---|
| `amagovpt/AccessMonitor` | front-end do validador (JavaScript) | MIT | 2026-07-04 |
| `amagovpt/accessmonitor-docker` | **serviço NestJS que executa o QualWeb** | MIT | 2026-06-05 |
| `amagovpt/accessmonitor-rulesets` | metadados das regras (`@a12e/accessmonitor-rulesets`) | MIT | 2026-06-30 |
| `amagovpt/monitor-server` | back-end do Observatório (NestJS + MySQL) | MIT | 2026-04-29 |
| `amagovpt/MyMonitor`, `study-monitor`, `admin-monitor-suite` | apps do Observatório | MIT | — |

### O que é reaproveitável para o nosso MVP

* **`accessmonitor-docker/src/util/qualweb.ts`** — mostra exatamente como um serviço de produção
  instancia o QualWeb: quais módulos, quais flags do Chromium, qual `waitUntil`, qual `maxConcurrency`.
  Adotamos as flags do Chromium e o `waitUntil: ['load', 'networkidle2']`.
* **`accessmonitor-docker/src/util/middleware.ts`** — contém o **algoritmo de score 0–10** e o
  cálculo de conformidade A/AA/AAA. Ver [`scoring.md`](./scoring.md).
* **`accessmonitor-docker/src/util/mapping.ts`** (2133 linhas) — mapeia asserções do QualWeb
  para os contadores de elementos (`data.elems`) que o score consome.
* **Atualização (2026-09-17):** o pacote `@a12e/accessmonitor-rulesets@2.0.0` passou a
  embutir esse mapeamento e o score inteiro em `processEvaluation(qualwebReport)`. É o que
  usamos hoje — ver [`scoring.md`](./scoring.md). A comparação contra o AMAWeb num site real
  deu erros e avisos por nível idênticos, o que confirma que o AMAWeb usa esta metodologia.
* Padrão de módulos NestJS: `amp` (avaliação), `core/health` (healthcheck via `@nestjs/terminus`),
  `core/guard` (throttling), `common/restricted-network.exception.ts` + `invalid-url.exception.ts`
  (defesa SSRF). Confirma que nosso conjunto de requisitos §21/§26 é o mesmo de um serviço real.

### O que NÃO precisamos para o MVP

Banco MySQL e entidades do Observatório, crawling de sites inteiros, multiusuário/autenticação,
declarações de acessibilidade, back-office administrativo, estudos setoriais, i18n completo,
integração com `monitor-server`.

---

## 3. QualWeb — estado atual (o ponto mais importante)

### 3.1 Migração para monorepo

O repositório `qualweb/core` **foi arquivado em 30/12/2024** e está somente-leitura, junto com
`act-rules`, `wcag-techniques`, `best-practices`, `util`, `qw-page`, `qw-element`, `counter`,
`crawler`, `locale`, `earl-reporter`, `types`, `dom`.

O desenvolvimento atual acontece em **`https://github.com/qualweb/qualweb`** (monorepo, branch
`master`), com os pacotes em `packages/`:

```
act-rules  best-practices  cli  core  counter  crawler  cui-checks
earl-reporter  locale  playwright-driver  qw-element  qw-page  types  util  wcag-techniques
```

`packages/playwright-driver` e `packages/cui-checks` são novidades do monorepo que não existiam
como repositórios separados.

### 3.2 Versões atuais (npm, 2026-09-04)

| Pacote | Versão | Mantido | Observação |
|---|---|---|---|
| `@qualweb/core` | **0.9.5** | sim | `engines.node >= 18`; depende de `puppeteer ^22.12.1` |
| `@qualweb/act-rules` | **0.8.5** | sim | 68 regras carregadas em runtime |
| `@qualweb/wcag-techniques` | **0.4.8** | sim | 34 técnicas carregadas em runtime |
| `@qualweb/best-practices` | **0.7.13** | sim | 27 boas práticas carregadas em runtime |
| `@qualweb/counter` | **0.3.5** | sim | **publicado sem arquivo de tipos** |
| `@qualweb/earl-reporter` | **0.5.19** | sim | conversão para EARL |
| `@qualweb/cli` | 0.7.31 | sim | CLI oficial |
| `@qualweb/util`, `qw-page`, `qw-element`, `locale`, `crawler` | 0.7.4 / 0.3.8 / 0.3.6 / 0.2.3 / 0.5.0 | sim | dependências transitivas do core |
| `@qualweb/types` | 0.7.27 (12/2024) | **NÃO** | **obsoleto** — os tipos hoje vêm de `@qualweb/core` |
| `@qualweb/dom` | 0.2.11 (12/2024) | **NÃO** | obsoleto |

> O `accessmonitor-docker` ainda está preso em `@qualweb/core ^0.8.11`. Nós usamos **0.9.5**,
> que tem API diferente (ver 3.4). Não copiar código do AccessMonitor sem adaptar.

### 3.3 Requisitos de sistema

* **Node** ≥ 18 (declarado). Testado aqui com **Node v24.12.0**, sem problemas.
* **Chromium/Chrome**: o `puppeteer@22.15.0` baixa o próprio Chrome no `npm install`
  (`~/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome`).
  É a versão que o Puppeteer 22 fixa e a mais segura de usar.
  O Chromium do sistema (147 no Kali) é muito mais novo que o pino do Puppeteer 22 — usável via
  `executablePath`, mas fora da matriz testada do Puppeteer. Preferimos o Chrome baixado localmente
  e o Chromium do sistema apenas no container (onde a versão é fixada pela imagem).
* Bibliotecas nativas do Chromium no container (fontes, nss, libdrm etc.) — ver `docker/`.

### 3.4 Como o QualWeb 0.9.x é usado (API atual)

```ts
import { QualWeb } from '@qualweb/core';
import { ACTRules } from '@qualweb/act-rules';

const qualweb = new QualWeb({ adBlock: false, stealth: false }); // plugins puppeteer-extra
await qualweb.start(
  { maxConcurrency: 1, timeout: 240000, monitor: false },   // ClusterOptions
  { headless: true, args: ['--no-sandbox', ...] },          // PuppeteerLaunchOptions
);
const reports = await qualweb.evaluate({
  url,
  modules: [new ACTRules(), new WCAGTechniques(), new BestPractices(), new Counter()],
  waitUntil: ['load', 'networkidle2'],
  timeout: 60000,
  translate: 'en',
});
await qualweb.stop();
const report = reports[url];   // POJO indexado pela URL de entrada
```

Diferença central em relação ao 0.8.x: os módulos deixaram de ser strings em
`options.modules` e passaram a ser **instâncias de classes** (`ExecutableModuleContext`).

### 3.5 Como o navegador é instanciado

`QualWeb` → `PuppeteerDriver.launchPool()` → **`puppeteer-cluster`** (`puppeteer-cluster@0.24`).
O cluster abre o browser e distribui uma página por tarefa. Consequências práticas:

* Não recebemos a instância de `Browser` diretamente. Chegamos nela via
  `driverPage.nativePage.browser()` dentro de um plugin (é assim que obtemos PID e versão).
* `qualweb.stop()` fecha o pool inteiro.
* `maxConcurrency` do cluster é o limite real de avaliações simultâneas.

### 3.6 Ponto de extensão: plugins

```ts
qualweb.use({
  beforePageLoad(page /* DriverPage */, url) { /* antes do goto */ },
  afterPageLoad(page /* DriverPage */)       { /* depois do load, antes das regras */ },
});
```

`DriverPage.nativePage` é a `Page` do Puppeteer (tipada como `unknown`; requer cast).
É por aqui que capturamos console, erros JS, falhas de rede, screenshot e HTML.

**Bug encontrado em `@qualweb/core@0.9.5`** — `packages/core/src/lib/PluginManager.object.ts`:

```ts
public async executeBeforePageLoad(page, url) {
  this.plugins.forEach(async (plugin) => await plugin.beforePageLoad?.(page, url || 'customHtml'));
}
```

`Array.prototype.forEach` descarta a promise do callback: **o core não espera o plugin terminar**
antes de navegar. Sintoma observado aqui: a resposta HTTP do documento principal era perdida
(`HTTP status: n/a`) porque nossos listeners eram anexados depois de dois `await`.
Mesmo defeito em `executeAfterPageLoad`. Mitigação adotada: registrar listeners **de forma
síncrona, antes de qualquer `await`** dentro do hook. Detalhes em [`qualweb.md`](./qualweb.md).

### 3.7 Não há eventos de progresso por módulo

`EvaluationManager.evaluate()` percorre `options.modules` num laço `for` e não emite eventos.
Para conseguir os logs por módulo exigidos em §4 sem alterar o core, envolvemos cada módulo
num decorador (`InstrumentedModule extends ExecutableModuleContext`) que delega para o módulo
real e cronometra a chamada. Isso mede tempo real de execução, não estimativa.

### 3.8 Estrutura do relatório do QualWeb

```
QualwebReport
├── type: 'evaluation'
├── system: { name, description, version: '4.0.0', homepage, date, hash,
│             url: { inputUrl, protocol, domainName, domain, uri, completeUrl },
│             page: { viewport: {...}, dom: { html, title, elementCount } } }
├── metadata: { passed, warning, failed, inapplicable }   // agregado
└── modules: {
      'act-rules':       { type, metadata:{...}, assertions: { QW-ACT-R1: Assertion, ... } },
      'wcag-techniques': { ... assertions: { QW-WCAG-T1: ... } },
      'best-practices':  { ... assertions: { QW-BP1: ... } },
      'counter':         { type, data: { roles: {...}, tags: {...} } }
    }
```

`Assertion`:

```ts
{
  name, code, mapping, description,
  metadata: {
    target, 'success-criteria': [{ name, level: 'A'|'AA'|'AAA', principle, url }],
    related: string[], url, results: {passed,warning,failed,inapplicable},
    passed, warning, failed, inapplicable,
    type?: string[], a11yReq?: string[],
    outcome: 'passed'|'warning'|'failed'|'inapplicable',
    description
  },
  results: TestResult[]
}
```

`TestResult`:

```ts
{ verdict, description, resultCode, elements: EvaluationElement[], attributes: string[] }
```

`EvaluationElement`: `{ pointer?, htmlCode?, accessibleName?, attributes?, cssCode?, property?, stylesheetFile?, additional? }`

> **Atenção — README desatualizado.** O README do `packages/core` ainda documenta os resultados
> com `pointer` e `htmlCode` *no nível do `TestResult`*. No 0.9.5 isso está dentro do array
> `elements[]`. Confirmado lendo `packages/core/src/lib/evaluation/TestResult.ts` e validado na
> execução real. O normalizador deve ler `results[].elements[]`.

### 3.9 Representações

* **ACT Rules** — `QW-ACT-Rn`, campo `mapping` traz o ID ACT do W3C (ex.: `QW-ACT-R17` → `23a2a8`).
  `metadata.url` aponta para a página oficial da regra. Nível WCAG vem de `success-criteria[].level`.
* **WCAG Techniques** — `QW-WCAG-Tn`, `mapping` traz o código da técnica W3C (`H24`, `F30`, `G141`…).
* **Best Practices** — `QW-BPn`. Não têm `mapping` obrigatório e **algumas não têm
  `success-criteria`** (ex.: QW-BP12). O normalizador precisa tolerar ausência de nível WCAG.
* **EARL** — `@qualweb/earl-reporter` expõe `generateEARLReport(reports)` e devolve um objeto
  indexado por URL, no contexto `https://act-rules.github.io/earl-context.json`. Suportado
  oficialmente, então mantemos a exportação EARL.

### 3.10 Contagem real de regras (medida, não estimada)

Execução em `https://example.com` com os quatro módulos:

| Módulo | Asserções retornadas |
|---|---|
| act-rules | 68 |
| wcag-techniques | 34 |
| best-practices | 27 |
| **total** | **129** |

---

## 4. Conjunto mínimo de componentes para reproduzir o processo de avaliação

Determinado experimentalmente na FASE 1 — bastam estes:

```
@qualweb/core  +  @qualweb/act-rules  +  @qualweb/wcag-techniques
               +  @qualweb/best-practices  +  @qualweb/counter
               +  Chrome do puppeteer
```

`@qualweb/counter` só é necessário se quisermos as contagens de tags/roles (úteis para score
no estilo AccessMonitor). `@qualweb/earl-reporter` é opcional (exportação).
`@qualweb/cli`, `@qualweb/crawler`, `monitor-server`, MySQL e front-end do AccessMonitor
**não** são necessários.

---

## 5. Licenças

| Projeto | Licença | Uso aqui |
|---|---|---|
| QualWeb (todos os pacotes) | ISC | dependência npm |
| AccessMonitor / accessmonitor-docker / rulesets / monitor-server | MIT | referência arquitetural e algoritmo de score (com atribuição) |
| AMAWeb | não público | somente referência funcional; nenhum código utilizado |

---

## Fontes

- QualWeb monorepo — https://github.com/qualweb/qualweb
- `@qualweb/core` no npm — https://www.npmjs.com/package/@qualweb/core
- Repositório arquivado — https://github.com/qualweb/core
- AccessMonitor Docker — https://github.com/amagovpt/accessmonitor-docker
- AccessMonitor rulesets — https://github.com/amagovpt/accessmonitor-rulesets
- monitor-server — https://github.com/amagovpt/monitor-server
- AMAWeb — https://amaweb.unifesp.br
- AMAWeb / CTA-IFRS — https://cta.ifrs.edu.br/2578-2/
- ACT Rules — https://www.w3.org/WAI/standards-guidelines/act/rules/
- EARL — https://www.w3.org/WAI/standards-guidelines/act/report/earl/
