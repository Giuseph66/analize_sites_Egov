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
