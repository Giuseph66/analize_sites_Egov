# API

Base: `http://localhost:3000`. Todas as respostas são JSON, exceto onde indicado.

---

## `GET /api/health`

Checagem real: carrega os módulos do QualWeb e **abre um Chromium**. O resultado é
cacheado por 30 s; `?deep=1` força nova verificação.

`200` quando tudo está ok, `503` quando algo está degradado.

```json
{
  "status": "ok",
  "api": "ok",
  "qualweb": "ok",
  "browser": "ok",
  "versions": {
    "app": "0.1.0",
    "node": "v22.23.2",
    "chromium": "Chrome/127.0.6533.88",
    "qualwebCore": "0.9.5",
    "qualwebActRules": "0.8.5",
    "qualwebWcagTechniques": "0.4.8",
    "qualwebBestPractices": "0.7.13",
    "qualwebCounter": "0.3.5",
    "qualwebSystem": null
  },
  "checkedAt": "2026-09-04T14:24:51.802Z",
  "details": { "browserExecutable": "/opt/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome" }
}
```

---

## `POST /api/evaluations`

```json
{ "url": "http://localhost:5173" }
```

`202 Accepted`:

```json
{ "evaluationId": "6f8123eb-f782-4dbc-8285-08d99f88409f", "status": "queued" }
```

| Código | Quando |
|---|---|
| 400 | corpo sem `url`, ou URL malformada (`kind: invalid-url`) |
| 403 | esquema ou rede bloqueada pela política (`kind: blocked-url`) |
| 429 | fila cheia (`MAX_QUEUE_SIZE`) |

---

## `GET /api/evaluations/:id`

```json
{
  "id": "...", "requestId": "req-2",
  "url": "http://localhost:5173",
  "resolvedUrl": "http://host.docker.internal:5173/",
  "status": "completed",
  "stage": "completed",
  "createdAt": "...", "startedAt": "...", "finishedAt": "...",
  "durationMs": 1769,
  "error": null
}
```

`status`: `queued` · `running` · `completed` · `failed`
`stage`: `created` · `queued` · `url-resolved` · `browser-launched` · `page-loaded` ·
`act-rules` · `wcag-techniques` · `best-practices` · `normalizing` · `saving` ·
`completed` · `failed`

Em falha, `error` traz `{ message, kind, stack? }` com `kind` ∈
`invalid-url` · `blocked-url` · `navigation` · `timeout` · `browser` · `qualweb` · `internal`.

---

## `GET /api/evaluations`

Lista as avaliações mais recentes. `?limit=50`.

---

## `GET /api/evaluations/:id/report`

Relatório no formato normalizado (§9). `409` se a avaliação ainda não terminou.

Campos principais: `score`, `summary`, `wcagFailures`, `rulesByModule`, `page`,
`versions`, `timings`, `diagnostics`, `results[]`.

Cada item de `results[]`:

```json
{
  "ruleId": "QW-ACT-R17",
  "title": "Image has accessible name",
  "description": "This rule checks that each image has an accessible name.",
  "result": "failed",
  "module": "act-rules",
  "engine": "qualweb",
  "engineVersion": "0.9.5",
  "wcag": { "criterion": "1.1.1", "level": "A" },
  "wcagCriteria": [{ "criterion": "1.1.1", "level": "A", "principle": "Perceivable", "url": "..." }],
  "actRule": "23a2a8",
  "url": "https://www.w3.org/WAI/standards-guidelines/act/rules/23a2a8/",
  "element": { "html": "<img src=\"/logo.png\">", "selector": "html > body > header > img" },
  "elements": [ ... ],
  "elementsTotal": 1,
  "outcomeDescription": "The image has no accessible name.",
  "counts": { "passed": 0, "warning": 0, "failed": 1, "inapplicable": 0 }
}
```

`technique` aparece em vez de `actRule` no módulo `wcag-techniques`.
Campos que o QualWeb não fornece são **omitidos** — nunca preenchidos com um palpite.

---

## `GET /api/evaluations/:id/report/raw`

JSON íntegro do QualWeb, como veio do motor. Enviado com `content-disposition: attachment`.

## `GET /api/evaluations/:id/report/earl`

Conversão para [EARL](https://www.w3.org/WAI/standards-guidelines/act/report/earl/)
via `@qualweb/earl-reporter` (suporte oficial do projeto).

---

## `GET /api/evaluations/:id/logs`

Array de `LogEntry`:

```json
[{ "ts": "2026-09-04T14:25:16.052Z", "level": "info", "source": "APP",
   "message": "CREATED", "evaluationId": "6f8123eb-...", "requestId": "req-2" }]
```

`source` ∈ `APP` · `BROWSER` · `TARGET PAGE` · `QUALWEB` (§29).

---

## `GET /api/evaluations/:id/events` — Server-Sent Events

```
event: log
data: {"type":"log","entry":{...}}

event: stage
data: {"type":"stage","stage":"act-rules","at":"..."}

event: status
data: {"type":"status","status":"running","at":"..."}

event: done
data: {"type":"done","status":"completed","at":"..."}
```

Ao conectar, o servidor **reenvia os logs já produzidos** e o status atual, então
conectar tarde não perde histórico. Um comentário `: keep-alive` a cada 15 s evita
que proxies fechem a conexão ociosa. O stream encerra em `done`.

```bash
curl -N http://localhost:3000/api/evaluations/<id>/events
```

---

## `GET /api/evaluations/:id/screenshot`

PNG, quando `CAPTURE_SCREENSHOT=true`. `404` caso contrário.

## `GET /api/evaluations/:id/page.html`

HTML capturado, quando `SAVE_HTML=true`. Servido como `text/plain` de propósito,
para não executar o conteúdo no navegador.

---

## `GET /api/debug` (também em `/debug`)

Estado do processo, fila, versões e configuração efetiva. Ver §28.

## `GET /api/logs`

Últimas linhas do log global (padrão 500). `?limit=N`.
