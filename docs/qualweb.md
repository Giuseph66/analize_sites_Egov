# QualWeb — notas de uso, armadilhas e defeitos encontrados

Versões usadas neste projeto (fixadas exatas no `package.json`):

```
@qualweb/core             0.9.5
@qualweb/act-rules        0.8.5    (68 regras)
@qualweb/wcag-techniques  0.4.8    (34 técnicas)
@qualweb/best-practices   0.7.13   (27 boas práticas)
@qualweb/counter          0.3.5
@qualweb/earl-reporter    0.5.19
puppeteer                 22.15.0  → Chrome 127.0.6533.88
```

Contagem total observada numa página real: **129 regras** executadas por avaliação.

---

## 1. A API mudou entre 0.8 e 0.9

No 0.8 os módulos eram strings. No 0.9 são **instâncias de classe**:

```ts
// 0.9.x — correto
const reports = await qualweb.evaluate({
  url,
  modules: [new ACTRules(), new WCAGTechniques(), new BestPractices(), new Counter()],
});
```

O `amagovpt/accessmonitor-docker` ainda está em `@qualweb/core ^0.8.11`. Código
copiado de lá precisa ser adaptado.

---

## 2. Defeito: os plugins não são aguardados

`packages/core/src/lib/PluginManager.object.ts` (0.9.5):

```ts
public async executeBeforePageLoad(page, url): Promise<void> {
  this.plugins.forEach(async (plugin) => await plugin.beforePageLoad?.(page, url || 'customHtml'));
}
```

`Array.prototype.forEach` **descarta a promise devolvida pelo callback**. A função
`async` retorna imediatamente, e o core segue para `page.goto()` enquanto o plugin
ainda está executando. `executeAfterPageLoad` tem o mesmo problema.

### Como isso apareceu aqui

Nossa primeira versão do hook fazia:

```ts
async beforePageLoad(page, url) {
  const browser = page.nativePage.browser();
  diag.browserVersion = await browser.version();   // <-- dois awaits antes
  diag.userAgent = await browser.userAgent();      // <-- de registrar listeners
  attachPageDiagnostics(page.nativePage, url, diag);
}
```

Resultado observado: em `https://example.com` funcionava (a rede é lenta o
suficiente), mas em `http://localhost:5173` o `HTTP status` saía como `n/a`. A
resposta do documento principal chegava em ~1 ms, antes de os listeners existirem.
Os 404 das subrequisições apareciam normalmente — o que tornava o sintoma confuso.

### Correção adotada

Registrar os listeners **de forma síncrona, como primeira coisa do hook**, e só
depois fazer awaits. Ver `packages/evaluator/src/engine.ts`.

```ts
beforePageLoad(driverPage, url) {
  const page = driverPage.nativePage as Page;
  attachDiagnostics(page, diagnostics, logger, maxRedirects);   // síncrono
  return (async () => { /* metadados do browser */ })();        // depois
}
```

### Consequência residual (não corrigível do nosso lado)

O `afterPageLoad` também não é aguardado, então o QualWeb começa a injetar
`qw-page`, `util` e `locale` na página enquanto capturamos screenshot e HTML.
O `page.html` salvo **pode conter os scripts injetados pelo QualWeb** — é por isso
que uma página de teste com 42 elementos gera um `page.html` de ~500 KB. O
screenshot não é afetado (os scripts não alteram a renderização).

---

## 3. Armadilha: `response.frame() === page.mainFrame()`

Forma intuitiva de identificar o documento principal, e errada: durante a primeira
navegação o frame pode ainda não estar associado à página, e a resposta é
descartada. Use:

```ts
const request = response.request();
const frame = request.frame();
const isMainDocument =
  request.resourceType() === 'document' &&
  request.isNavigationRequest() &&
  (frame === null || frame.parentFrame() === null);
```

---

## 4. Armadilha: `page.evaluate` + bundlers

Funções passadas a `page.evaluate()` são serializadas e executadas **no browser**.
O esbuild (usado pelo `tsx`) reescreve identificadores de módulo *dentro* delas.

Com `import { performance } from 'node:perf_hooks'` no topo do arquivo, isto
quebra dentro da página:

```
ReferenceError: import_node_perf_hooks is not defined
```

Node ≥ 18 expõe `performance` como global — não importe. Segunda armadilha na
mesma linha: `const f = performance.getEntriesByType; f('navigation')` produz
`TypeError: Illegal invocation` porque o método perde o `this`.

**Terceira armadilha, mais sutil:** o `tsx` roda com `keep-names` do esbuild
ativado. Se o callback declarar uma função local nomeada —
`const check = () => { ...; setTimeout(check, 100); }`, por exemplo — o esbuild
transforma isso em `const check = __name(() => {...}, "check")` para preservar
`.name` em stack traces. O helper `__name` só existe no bundle do Node; quando o
texto do callback é serializado e reexecutado no browser, ele não existe:

```
__name is not defined
```

O sintoma pode ser confundido com outra coisa — no nosso caso (função de espera
de assentamento do DOM, ver seção 11), o erro batia dentro de um `try/catch` que
também captura "execution context destroyed" (navegação real em andamento), e
o log dizia "contexto destruído" quando na verdade era este bug do bundler.
Sempre inspecione `error.message`, não confie no `catch` genérico. Correção:
não declarar função local nomeada dentro do callback — usar `setInterval` com
arrow function anônima em vez de recursão via `const` nomeada.

---

## 5. README do core está desatualizado

O README documenta os resultados assim:

```jsonc
"results": [ { "verdict": "...", "pointer": "...", "htmlCode": "..." } ]
```

No 0.9.5 (`packages/core/src/lib/evaluation/TestResult.ts`) é:

```ts
type TestResult = {
  verdict: Verdict;
  description: string;
  resultCode: string;
  elements: EvaluationElement[];   // <-- pointer e htmlCode estão AQUI
  attributes: string[];
};
```

O normalizador lê `results[].elements[]`. Confirmado no código-fonte e na execução.

---

## 6. `@qualweb/counter` é publicado sem tipos

O pacote entrega apenas `dist/counter.bundle.js`. Declaração mínima em
`packages/evaluator/types/qualweb-counter.d.ts`, referenciada pelo `index.ts` do
pacote para que os consumidores também a recebam.

---

## 7. Nem toda regra tem critério WCAG

Parte das best practices (`QW-BP12`, por exemplo) não traz `success-criteria`.
O normalizador tolera a ausência: `wcag` fica `undefined` e a falha entra em
`wcagFailures.unmapped`. Não inventamos um nível.

---

## 8. Uma regra pode devolver o documento inteiro como elemento

`QW-ACT-R75` aponta o próprio `<html>`, e `htmlCode` traz o `outerHTML` completo —
com os scripts que o QualWeb injetou. Sem recorte, o relatório *normalizado* de uma
página de teste ficou **2,34 MB**, maior que o bruto (1,88 MB).

Limites em `packages/report-normalizer/src/index.ts`:

```ts
export const MAX_ELEMENTS_PER_RESULT = 25;
export const MAX_ELEMENT_HTML_LENGTH = 4000;
```

Resultado: 160 KB. `elementsTotal` guarda quantos elementos existiam antes do corte,
e `raw-qualweb.json` continua íntegro.

---

## 9. `@qualweb/types` está obsoleto

Não instale. Os tipos vêm de `@qualweb/core`. `QualwebPage` e `TranslationOptions`,
porém, **não** são reexportados no index público; derive-os da assinatura:

```ts
type ExecuteArgs = Parameters<ExecutableModuleContext['execute']>;
type QualwebPage = ExecuteArgs[0];
type TranslationOptions = ExecuteArgs[1];
```

---

## 10. Flags do Chromium

Herdadas do `accessmonitor-docker` (MIT), que roda QualWeb em produção:

```
--no-sandbox  --disable-setuid-sandbox  --disable-dev-shm-usage  --disable-gpu
--disable-accelerated-2d-canvas  --ignore-certificate-errors  --no-first-run
--no-zygote  --disable-extensions  --disable-blink-features=AutomationControlled
```

No container, além disso, `shm_size: 1gb` — o `/dev/shm` padrão de 64 MB derruba
abas do Chromium.

---

## 11. SPAs client-side-rendered: o QualWeb avalia cedo demais

Caso real que motivou este recurso: `https://www.gp.srv.br/ouvidoria/sinop/#/portal/1/home`,
uma SPA legada em AngularJS + UI-Router com roteamento por hash. Ao avaliar essa
URL, o relatório vinha com **84 elementos, título vazio e quase tudo
`inapplicable`** — comparado a um relatório de referência (gerado por outra
ferramenta contra a mesma URL) que via 81 elementos, 21 cabeçalhos, 5 tabelas e
título preenchido. A diferença não era de catálogo de regras: era que **estávamos
avaliando uma casca vazia**.

Investigação: o `waitUntil: ['load', 'networkidle2']` do QualWeb dispara antes de
a aplicação terminar de rotear. Essa SPA faz, DEPOIS do `load`: navega para
`#/carregarUg`, busca a "unidade gestora" via XHR, e só então redireciona para a
rota final e renderiza. Confirmado navegando manualmente com Playwright — o
`<ui-view>` (contêiner de rota do AngularJS) ficava vazio logo após o load, e só
~1–4 s depois aparecia o conteúdo real (h1/h4/h5/h6, tabelas, links).

### Por que não dava para resolver via hook de plugin

A primeira tentativa foi atrasar a avaliação dentro de `afterPageLoad`. Não
funciona: como documentado na seção 2, o core não aguarda a conclusão do hook —
qualquer `await` feito lá dentro corre em paralelo com o resto do fluxo, sem
atrasar a execução real dos módulos.

### A solução: interceptar `goto()`, não os hooks

`PuppeteerDriverPage.goto()` (o que o core efetivamente chama) é um repasse
direto: `return this.page.goto(url, options)`, guardando a MESMA referência de
`Page` desde o construtor. Isso significa que sobrescrever `page.goto` — de
forma síncrona, dentro de `beforePageLoad`, antes de qualquer `await` — troca o
método que o core vai chamar em seguida, sem depender de o hook ser aguardado:

```ts
const originalGoto = page.goto.bind(page);
page.goto = (async (...args) => {
  const response = await originalGoto(...args);
  await waitForDomSettle(page, quietMs, maxMs);   // so agora retorna
  return response;
}) as typeof page.goto;
```

A chamada real a `goto()` acontece dentro de um `Promise.all(...)` em
`getTestingData()`, que **é** aguardado corretamente por `EvaluationManager`.
Atrasar o retorno de `goto()` atrasa de fato o início dos módulos.

### A heurística de assentamento

Genérica, sem depender de seletor de nenhum framework: um `MutationObserver` no
`documentElement`, resolvido quando não houver mutação por `quietMs` (padrão
500 ms), com teto `maxMs` (padrão 4000 ms, `SPA_SETTLE_MAX_MS=0` desativa). Um
piso mínimo de observação (`max(quietMs × 2, 1000)` ms) evita confiar num
silêncio precoce — a app do exemplo fica visivelmente parada por um instante
antes de disparar o fetch que traz o conteúdo real.

Como a navegação real (`#/carregarUg` → `#/portal/1/home`) destrói o
`execution context` do `page.evaluate()` em andamento, a função **tolera e
tenta de novo**: um erro do tipo "execution context destroyed" no meio da
espera é tratado como sinal de que ainda há conteúdo relevante por vir, não como
falha — ela espera um instante e reobserva, dentro do orçamento total de `maxMs`.

### Resultado medido

| | antes | depois |
|---|---|---|
| elementos no DOM | 84 | 1329 |
| título | `""` | `"Portal Ouvidoria \| PREFEITURA MUNICIPAL DE SINOP MT"` |
| regras com falha | 7 | 14 |

Cinco das regras que passaram a disparar bateram, **contagem de ocorrências
idêntica**, com um relatório de referência gerado independentemente contra a
mesma URL: hierarquia de heading (n=7), `<br>` usado como lista (n=4), remoção
de foco via script (n=12), tabela sem `<caption>` (n=5), elementos HTML
obsoletos de apresentação (n=29).

### Limitação residual, documentada com honestidade

Em ~1 de cada 3 execuções contra essa mesma URL, `system.page.dom.title` e
`elementCount` (lidos por `EvaluationManager.getSystemData()`, ANTES da
execução dos módulos) ainda vêm vazios/desatualizados — mesmo quando os
**resultados das regras** (lidos DURANTE a execução dos módulos, um instante
depois) já refletem corretamente o conteúdo completo. Ou seja: o achado de
acessibilidade sai certo, mas a metadata de página (título, contagem de
elementos) pode ficar presa a um instante ligeiramente anterior, indicando uma
navegação residual dentro dessa SPA específica que continua além da nossa
janela de espera. Não é um problema introduzido por nós — é o limite de uma
heurística de "silêncio do DOM" contra uma aplicação com timing assíncrono
variável. Para esses casos, aumentar `SPA_SETTLE_MAX_MS` reduz a chance, sem
eliminá-la por completo.

---

## 12. O erro real da avaliação não chega a quem chamou `evaluate()`

Sintoma observado, avaliando um site real:

```
[QUALWEB] QualWeb finished in 30164 ms
[APP] Evaluation failed (qualweb): QualWeb nao devolveu relatorio para <url>.
      Chaves recebidas: (nenhuma)
```

Uma mensagem que não diz absolutamente nada sobre a causa.

### O que acontece

`QualWeb.evaluate()` não propaga falhas da tarefa. O fluxo é:

```ts
await this.pool?.task(async (page, { url, html }) => {
  reports[url ?? 'customHtml'] = await evaluationManager.evaluate(options);  // se isto lança...
});
this.addUrlsToEvaluate(urls);
await this.pool?.idle();
return reports;   // ...`reports` simplesmente fica vazio, e evaluate() retorna normalmente
```

O `puppeteer-cluster` captura a exceção da tarefa e a emite como evento
`taskerror`. O único consumidor é o `ErrorManager` interno do core, que apenas
grava num arquivo `qualweb-errors-<timestamp>.log` **no diretório de trabalho**,
e somente se `options.log.file` estiver ligado. Quem chamou `evaluate()` recebe
um dicionário vazio, sem erro.

### Como capturamos a causa

Duas fontes, complementares:

1. **`onTaskError` do pool.** `QualWeb` aceita um `Driver` customizado no
   construtor. Envolvemos o `PuppeteerDriver` real num decorador que registra um
   listener no pool assim que ele é criado:

   ```ts
   class TaskErrorCapturingDriver implements Driver {
     async launchPool(clusterOptions, browserOptions) {
       const pool = await this.inner.launchPool(clusterOptions, browserOptions);
       pool.onTaskError(this.onTaskError);
       return pool;
     }
     launchContext() { return this.inner.launchContext(); }
   }
   ```

   Funciona sem conflito porque `PuppeteerDriverPool.onTaskError` faz
   `cluster.on('taskerror', handler)` — um EventEmitter. Nosso listener convive
   com o do `ErrorManager` em vez de substituí-lo.

2. **O `goto()` interceptado.** Como já substituímos `page.goto` (seção 11), um
   `try/catch` ali dá a causa mais específica ainda: o erro exato da navegação.

Com isso, um relatório vazio deixa de ser um beco sem saída:

```
A avaliação de http://.../slow falhou: Navigation timeout of 2000 ms exceeded.
A página não terminou de carregar dentro de PAGE_TIMEOUT=2000 ms (aguardando
'load' e 'networkidle2'). Aumente PAGE_TIMEOUT — e EVALUATION_TIMEOUT junto,
pois ele precisa cobrir a avaliação inteira.
```

E `error.kind` passa a ser classificado a partir da mensagem real
(`timeout` · `navigation` · `browser` · `qualweb`), em vez de cair sempre em
`qualweb`.

### Nota sobre `ClusterOptions`

`ClusterOptions` não é reexportado no index público do `@qualweb/core` (só
`QualwebOptions`, `LoadEvent`, `./lib/driver`, `./lib/evaluation` e `./lib/i18n`).
Para tipar o decorador sem depender de um caminho interno do pacote, derivamos da
própria interface:

```ts
type ClusterOptions = Parameters<Driver['launchPool']>[0];
```
