# Arquitetura

## Visão geral

```
                       ┌─────────────────┐
                       │     Browser     │
                       │ localhost:3000  │
                       └────────┬────────┘
                                │
                       ┌────────▼────────┐
                       │    Frontend     │   React + TS + Vite
                       │  (SPA estática) │   servida pela API em produção
                       └────────┬────────┘
                                │ REST + SSE
                       ┌────────▼────────┐
                       │      API        │   Fastify 5
                       │   apps/api      │
                       └────────┬────────┘
                                │
                       ┌────────▼────────┐
                       │ EvaluationService│  fila em memória, limites,
                       │ packages/evaluator│ ciclo de vida, persistência
                       └────────┬────────┘
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
          ┌─────────────────┐       ┌────────────────┐
          │  engine.ts      │──────▶│ Chromium       │
          │  (QualWeb)      │◀──────│ (Puppeteer)    │
          └────────┬────────┘       └────────────────┘
                   │
        ACT Rules · WCAG Techniques · Best Practices · Counter
                   │
                   ▼
           raw-qualweb.json ──▶ report-normalizer ──▶ report.json
                                        │
                                        ▼
                                  ScoringStrategy
```

## Pacotes

| Pacote | Responsabilidade | Depende de |
|---|---|---|
| `packages/shared-types` | contratos entre todas as camadas | — |
| `packages/logger` | log estruturado com fan-out (stdout, arquivos, memória, eventos) | shared-types |
| `packages/report-normalizer` | QualWeb bruto → formato interno; estratégias de score | shared-types |
| `packages/evaluator` | config, política de URL, motor, repositório, fila | logger, normalizer, QualWeb |
| `apps/api` | HTTP, SSE, healthcheck, /debug, estáticos | evaluator |
| `apps/frontend` | interface | shared-types |
| `experiments/qualweb-test` | prova de conceito isolada do motor | QualWeb |

A dependência aponta sempre para dentro: o `evaluator` não conhece HTTP, o
`report-normalizer` não conhece Puppeteer, o `shared-types` não depende de nada.

## Decisões e por quê

### Uma instância de QualWeb por avaliação

`QualWeb.start()` abre um `puppeteer-cluster`. Poderíamos manter um único cluster
vivo com `maxConcurrency = N`, mas os plugins (`qualweb.use`) são registrados na
instância, não na página: com avaliações concorrentes não há como saber com
segurança a qual avaliação pertence cada página (o hook recebe apenas a URL, e
duas avaliações da mesma URL colidiriam).

Optamos por uma instância por avaliação, com `maxConcurrency: 1`, e o paralelismo
controlado pela nossa fila (`MAX_CONCURRENT_EVALUATIONS`). Custo medido: **~250 ms**
de inicialização do Chromium por avaliação. Em troca, cada avaliação tem PID
próprio, plugin próprio e configuração própria de headless/screenshot.

### Sem etapa de compilação no backend

O backend roda com `tsx`, em desenvolvimento e no container. Para um laboratório
cujo objetivo é ser lido e modificado, os stack traces apontando para o TypeScript
original valem mais que o ganho de partida de um `dist/`. O `npm run build` faz
typecheck de tudo e compila apenas o frontend.

### Persistência em arquivos, atrás de uma interface

`EvaluationRepository` (em `packages/evaluator/src/repository.ts`) é a única parte
do sistema que conhece caminhos de arquivo. Trocar para PostgreSQL é implementar a
interface e injetar outra classe em `apps/api/src/main.ts` — nada mais muda.

```
data/evaluations/<uuid>/
  metadata.json      ciclo de vida
  raw-qualweb.json   JSON íntegro do QualWeb
  report.json        formato normalizado
  logs.txt           legível
  logs.jsonl         estruturado (fonte do endpoint /logs)
  screenshot.png     se CAPTURE_SCREENSHOT=true
  page.html          se SAVE_HTML=true
```

Além disso, cópias com nome legível vão para `data/raw/` e `data/reports/`.

### Fila em memória

`MAX_CONCURRENT_EVALUATIONS` limita Chromiums simultâneos; `MAX_QUEUE_SIZE` faz a
API responder **429** em vez de acumular trabalho. A fila não sobrevive a reinícios
— e não precisa: nenhum Redis no MVP (§32).

### Progresso por módulo sem alterar o QualWeb

O core executa os módulos num laço interno sem emitir eventos. `InstrumentedModule`
(`packages/evaluator/src/instrumented-module.ts`) estende `ExecutableModuleContext`,
sobrescreve `execute()`, delega ao módulo real e cronometra. Os tempos no relatório
são medidos, não estimados.

---

## §12 — Avaliar localhost estando dentro do Docker

O problema: dentro do container, `localhost` é o próprio container.

### Alternativas consideradas

| Opção | Veredito |
|---|---|
| `network_mode: host` | Funciona em Linux, mas quebra em Docker Desktop (macOS/Windows), elimina o isolamento de rede e faz o mapeamento de portas do compose deixar de valer. **Rejeitada.** |
| Pedir ao usuário o IP do host (`172.17.0.1`) | Funciona, mas contraria §12: o usuário deve poder digitar `localhost:5173`. **Rejeitada.** |
| `extra_hosts: host.docker.internal:host-gateway` + reescrita transparente | Um único nome funciona em Linux, macOS e Windows. **Adotada.** |

### Como está implementado

1. `docker-compose.yml` declara `extra_hosts: ["host.docker.internal:host-gateway"]`.
   Em Linux, `host-gateway` é resolvido pelo Docker (20.10+) para o IP do host.
2. `LOCALHOST_ALIAS=host.docker.internal` no ambiente do container.
3. `resolveUrl()` (`packages/evaluator/src/url-policy.ts`) troca **apenas o hostname
   de loopback** (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`, `*.localhost`),
   preservando esquema, porta, caminho e query.
4. Endereços de rede privada (`192.168.x.y`, `10.x.y.z`, `172.16–31.x.y`) **não** são
   reescritos: já são alcançáveis do container, e reescrevê-los quebraria o alvo.
5. As duas URLs vão para o log e para o relatório:

```
[14:25:16] [APP] [Evaluation 6f8123eb] User URL: http://localhost:5173/
[14:25:16] [APP] [Evaluation 6f8123eb] Resolved URL: http://host.docker.internal:5173/ (host reescrito para o container)
```

### Armadilha conhecida

Se o seu servidor de desenvolvimento escutar apenas em `127.0.0.1`, o container não
o alcança mesmo com o alias correto — o pacote chega pelo IP do gateway, não pelo
loopback. Faça o servidor escutar em `0.0.0.0`:

```bash
vite --host          # Vite
ng serve --host 0.0.0.0   # Angular
python -m http.server --bind 0.0.0.0 8080
```

---

## §21 — Segurança

Esta ferramenta abre URLs arbitrárias num navegador real. As proteções vivem em
`url-policy.ts` e são aplicadas **duas vezes**: na rota (para devolver 400/403 antes
de enfileirar) e no serviço (para o caso de a fila ser alimentada por outro caminho).

| Risco | Tratamento |
|---|---|
| `file://` | bloqueado; `ALLOW_FILE_PROTOCOL=true` libera |
| `data:`, `javascript:`, `blob:`, qualquer outro esquema | bloqueado, sem opção de liberar |
| URL malformada / sem host | rejeitada com `kind: invalid-url` |
| SSRF para rede local | `ALLOW_LOCAL_NETWORK` (padrão `true`, porque avaliar localhost é o propósito da ferramenta) |
| Loop de redirect | `MAX_REDIRECTS` registra o estouro; o timeout de navegação encerra |
| Página gigante / download infinito | `PAGE_TIMEOUT` e `EVALUATION_TIMEOUT` |
| Certificado inválido | `--ignore-certificate-errors` (deliberado: é um laboratório para avaliar ambientes de desenvolvimento) |

Limite explícito: não fazemos resolução de DNS antes de navegar, então um nome
público que resolve para IP privado não é barrado por `ALLOW_LOCAL_NETWORK=false`.
Como o padrão é permitir rede local, isso não muda nada na configuração de fábrica;
se você endurecer a política, saiba que essa lacuna existe.

---

## §22 — Limites

| Variável | Padrão | Efeito |
|---|---|---|
| `EVALUATION_TIMEOUT` | 60000 | teto da tarefa no `puppeteer-cluster` |
| `PAGE_TIMEOUT` | 30000 | teto de `page.goto()` |
| `MAX_CONCURRENT_EVALUATIONS` | 2 | Chromiums simultâneos |
| `MAX_QUEUE_SIZE` | 20 | acima disso a API responde 429 |
