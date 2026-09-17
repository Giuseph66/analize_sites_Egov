# Depuração

## Onde olhar primeiro

| Sintoma | Comece por |
|---|---|
| avaliação falha | `GET /api/evaluations/:id` → `error.kind` |
| página não é avaliada | `logs/browser.log` e `diagnostics.networkFailures` |
| algo travou | `GET /debug` → `queue` e `evaluations.running` |
| motor não sobe | `GET /api/health?deep=1` → `details` |
| dúvida sobre um resultado | `data/evaluations/<id>/raw-qualweb.json` |

## Arquivos de log

```
logs/application.log   tudo, JSON Lines
logs/evaluations.log   apenas linhas com evaluationId
logs/browser.log       apenas source BROWSER e TARGET PAGE
logs/error.log         apenas level=error
data/evaluations/<id>/logs.txt     legível, só desta avaliação
data/evaluations/<id>/logs.jsonl   estruturado, só desta avaliação
```

```bash
npm run logs                              # tail -f de application.log
docker compose logs -f evaluator          # o mesmo, no container
tail -f logs/error.log | jq -r '.message'
jq -r 'select(.source=="TARGET PAGE") | .message' logs/application.log
```

## As quatro origens de log (§29)

| Origem | Significado |
|---|---|
| `APP` | nosso código: ciclo de vida, fila, normalização, gravação |
| `BROWSER` | Chromium: lançamento, versão, PID, HTTP, redirects, falhas de rede |
| `TARGET PAGE` | a página avaliada: `console.*`, erros JS não capturados, navigation timing |
| `QUALWEB` | o motor: início/fim de cada módulo, contagens, erros |

## `error.kind`

| kind | Causa provável | O que fazer |
|---|---|---|
| `invalid-url` | URL malformada ou sem host | conferir o que foi digitado |
| `blocked-url` | esquema proibido, ou rede local com `ALLOW_LOCAL_NETWORK=false` | ajustar a política |
| `navigation` | host inexistente, conexão recusada, DNS | ver "servidor não alcançável" abaixo |
| `timeout` | página não terminou de carregar | aumentar `PAGE_TIMEOUT` / `EVALUATION_TIMEOUT` |
| `browser` | Chromium não subiu | `GET /api/health?deep=1`; no container, checar `shm_size` |
| `qualweb` | motor terminou com erro ou não devolveu relatório | ler `logs/error.log`; comparar com `npm run evaluate` |
| `internal` | defeito nosso | stack em `error.stack` |

## Servidor local não alcançável a partir do container

O sintoma é `net::ERR_CONNECTION_REFUSED` em `logs/browser.log`, com a URL já
reescrita para `host.docker.internal`.

1. Confirme a reescrita nos logs:
   ```
   User URL:     http://localhost:5173/
   Resolved URL: http://host.docker.internal:5173/ (host reescrito para o container)
   ```
2. O seu servidor precisa escutar em `0.0.0.0`, não apenas em `127.0.0.1`:
   ```bash
   vite --host
   ng serve --host 0.0.0.0
   ```
   Verifique com `ss -ltnp | grep 5173` — deve aparecer `0.0.0.0:5173`, não `127.0.0.1:5173`.
3. Teste de dentro do container:
   ```bash
   docker compose exec evaluator curl -sI http://host.docker.internal:5173/
   ```
4. Firewall: no Linux o tráfego chega pela interface `docker0`. Com firewall ativo,
   libere a faixa do bridge.

## Depurar o Chromium

```bash
# Fora do container, com ambiente gráfico: abre uma janela real
BROWSER_HEADLESS=false npm run dev

# Prova de conceito isolada, sem API nem frontend no caminho
npm run evaluate -- http://localhost:5173 --headful
npm run evaluate -- https://example.com --timeout=120000

# Ver todas as respostas HTTP que o navegador recebeu
DEBUG_RESPONSES=1 npm run evaluate -- http://localhost:5173

# Usar outro binário
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run evaluate -- https://example.com
```

O relatório e os logs registram o executável, a versão, o PID, o User-Agent e o
viewport de cada execução.

> Aviso de compatibilidade: o `puppeteer@22` fixa o Chrome 127. Apontar
> `BROWSER_EXECUTABLE_PATH` para um Chromium muito mais novo (147, por exemplo)
> costuma funcionar, mas está fora da matriz testada do Puppeteer. Se aparecerem
> erros estranhos de protocolo CDP, é o primeiro suspeito.

## Screenshot e HTML

```bash
CAPTURE_SCREENSHOT=true SAVE_HTML=true npm run dev
```

```
data/evaluations/<id>/screenshot.png
data/evaluations/<id>/page.html
```

Também por HTTP: `/api/evaluations/:id/screenshot` e `/api/evaluations/:id/page.html`.

> O `page.html` pode conter os scripts que o QualWeb injeta na página, porque o core
> não aguarda o hook `afterPageLoad`. Ver `docs/qualweb.md`, seção 2.
> `SAVE_HTML` grava o conteúdo da página em disco: não habilite ao avaliar páginas
> com dados sensíveis.

## Conferir o motor sem passar pela aplicação

```bash
# 1. prova de conceito isolada
npm run evaluate -- http://localhost:5173

# 2. a normalização perde ou inventa algo?
npm run compare -- http://localhost:5173

# 3. segunda opinião de outro motor (axe-core, rotulado como tal)
npm run compare -- http://localhost:5173 --with-axe
```

O `compare` falha explicitamente se as contagens do bruto e do normalizado
divergirem, ou se alguma regra sumir ou aparecer do nada.

## A configuração do `.env` não está sendo aplicada

Primeiro confirme o que está **efetivamente** valendo — não o que está escrito no
arquivo:

```bash
curl -s localhost:3000/api/debug | jq .config
```

Na subida, a API registra o que carregou:

```
[APP] .env carregado de /caminho/do/projeto/.env {"aplicadas":20,"ignoradasPorJaExistiremNoAmbiente":["PORT"]}
```

Variáveis **já presentes no ambiente têm precedência** sobre o arquivo (é a mesma
semântica do dotenv). Isso é o que mantém o `docker-compose.yml` no comando e
permite ajustes pontuais na linha de comando:

```bash
PAGE_TIMEOUT=120000 npm run dev
```

Se uma chave aparece em `ignoradasPorJaExistiremNoAmbiente`, o arquivo não vai
mudá-la — é preciso alterar quem a define (o compose, o `scripts/dev.mjs`, ou o
shell).

> Atenção: editar `.env.example` não tem efeito nenhum. Ele é só um modelo;
> copie para `.env`.

## Timeouts

| Variável | Cobre |
|---|---|
| `PAGE_TIMEOUT` | `page.goto()` — página que não termina de carregar |
| `EVALUATION_TIMEOUT` | a tarefa inteira no `puppeteer-cluster` |
| `BROWSER_TIMEOUT` | lançamento do navegador |
| `SPA_SETTLE_MAX_MS` | espera extra pós-load para SPAs client-side-rendered (§ abaixo) |

Páginas pesadas de JavaScript: comece por `PAGE_TIMEOUT=120000 EVALUATION_TIMEOUT=180000`.

**Os dois precisam subir juntos.** `EVALUATION_TIMEOUT` vira o timeout da tarefa no
`puppeteer-cluster` e engloba navegação + assentamento + execução dos módulos. Se
ele for menor que `PAGE_TIMEOUT + SPA_SETTLE_MAX_MS`, o cluster encerra a tarefa
antes de a navegação sequer esgotar o próprio limite — e o sintoma é uma avaliação
que falha com relatório vazio. A API avisa disso na subida:

```
[APP] WARN EVALUATION_TIMEOUT (60000 ms) não cobre PAGE_TIMEOUT + SPA_SETTLE_MAX_MS (103999 ms). ...
```

## `ACTRulesRunner is not defined` / `No color space found with id = "oklch"`

A página poluiu os protótipos nativos (MooTools, Prototype.js, Sugar) e o bundle
do act-rules — que roda no realm da página — morreu na inicialização. A
restauração de protótipos deveria ter tratado isso; confira nos logs:

```
[APP] WARN Página poluiu protótipos nativos; 356 chave(s) removida(s) e 6 restaurada(s) antes de injetar o QualWeb — Array.prototype: -28 · ...
```

Se a linha não aparece, `RESTORE_NATIVE_PROTOTYPES` está em `false`, ou a
página polui algo fora dos alvos cobertos (`Object`, `Array`, `String`,
`Number`, `Boolean`, `Function`, `RegExp`, `Date`, `Math`, `JSON` e seus
protótipos). Para investigar o que a página muda, compare com um iframe limpo:

```js
// no console da página avaliada
const f = document.createElement('iframe'); document.body.appendChild(f);
const clean = new Set(Object.getOwnPropertyNames(f.contentWindow.Array.prototype));
Object.getOwnPropertyNames(Array.prototype).filter(k => !clean.has(k));
```

Causa, bissecção e desenho da mitigação em `docs/qualweb.md`, seção 13.

## Página avaliada parece incompleta (SPA que renderiza depois do load)

Sintoma: `page.elementCount` baixo, título vazio, quase tudo `inapplicable` numa
página que — vista no navegador — claramente tem conteúdo. Comum em SPAs com
roteador client-side (Angular, React, Vue) que buscam dados e renderizam a rota
real DEPOIS do evento `load`.

1. Confira nos logs se `SPA settle` aparece:
   ```
   [APP] SPA settle: DOM quieto (limiar 500 ms, tentativa 1)
   ```
   Se aparecer `contexto destruído por navegação intermediária`, o sistema
   detectou um redirect client-side em andamento e está tentando de novo — normal.
   Se terminar em `limite de Xms atingido sem o DOM ficar quieto definitivamente`,
   a espera não foi suficiente.
2. Aumente `SPA_SETTLE_MAX_MS` (padrão 4000). Para apps particularmente lentos:
   ```bash
   SPA_SETTLE_MAX_MS=10000 npm run dev
   ```
3. `SPA_SETTLE_MAX_MS=0` desativa o recurso inteiramente (volta ao comportamento
   de avaliar logo após `load`/`networkidle2`).
4. Esse recurso é uma heurística (silêncio de mutações no DOM), não uma garantia.
   Detalhes, o caso real que motivou sua criação, e uma limitação residual
   conhecida estão em `docs/qualweb.md`, seção 11.

## Problemas conhecidos

* **`page.html` inflado** — inclui os scripts injetados pelo QualWeb (~500 KB mesmo
  em páginas pequenas). Causa em `docs/qualweb.md` §2.
* **`elements` recortado** — no máximo 25 elementos por regra, HTML truncado em
  4000 caracteres. O conjunto completo está em `raw-qualweb.json`. Motivo em §8 do
  mesmo documento.
* **`summary.manual` é sempre 0** — o QualWeb não tem veredito `manual`; o que exige
  verificação humana vem como `warning`. O campo existe para motores futuros.
* **`versions.qualwebSystem` é `4.0.0`** — string fixa dentro do core, não a versão
  do pacote. A versão real está em `versions.qualwebCore`.
* **Chromium 147 do sistema vs Chrome 127 do Puppeteer** — usamos o do Puppeteer.
* **Docker: "all predefined address pools have been fully subnetted"** — não é deste
  projeto. Significa que o pool de endereços do Docker acabou por excesso de redes
  ociosas. Liste com `docker network ls` e remova as que não usa
  (`docker network prune` remove **todas** as redes sem containers — confira antes).
