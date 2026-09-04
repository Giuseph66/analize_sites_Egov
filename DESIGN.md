# Design

## Theme

Light. Tema único (sem alternância clara/escura) — decisão consciente, não
padrão. Referência funcional: AMAWeb (amaweb.unifesp.br/avaliador). Cenário
físico que motivou a escolha: auditor de acessibilidade num escritório, horário
comercial, monitor grande, com o AMAWeb frequentemente aberto em aba paralela
para comparação — tema claro combina com esse contexto e com a referência.

## Color

Estratégia **restrained**: neutros tingidos + vocabulário semântico rico para
estado (product register). Todas as cores em OKLCH, matiz de base 165°
(teal-esverdeado), nenhum neutro em cinza puro.

```css
/* Neutros — tingidos para o matiz da marca (165°) */
--bg: oklch(97.3% 0.006 165);
--surface: oklch(99.4% 0.003 165);
--surface-2: oklch(95.3% 0.008 165);
--border: oklch(88% 0.011 165);
--border-strong: oklch(78% 0.015 165);
--text: oklch(23% 0.015 165);
--text-muted: oklch(45% 0.016 165);
--text-faint: oklch(53% 0.013 165);

/* Marca */
--brand: oklch(51% 0.10 173);
--brand-strong: oklch(41% 0.11 173);

/* Semântica de severidade — cada par *-strong/*-tint valida ≥4.5:1 */
--danger: oklch(50% 0.19 25);    /* erro */
--warn: oklch(54% 0.15 55);      /* revisar manualmente */
--success: oklch(50% 0.13 148);  /* aceito */
--info: oklch(48% 0.13 255);     /* painel de técnica/critério WCAG */
--neutral-badge: oklch(50% 0.012 165); /* sem nível WCAG associado */

/* Foco — matiz próprio (300°), distinto de todos os semânticos acima */
--focus: oklch(52% 0.21 300);
```

Todos os pares texto/fundo usados no produto foram medidos (fórmula WCAG
oficial, conversão OKLCH → sRGB própria, não a resolução do navegador — ver
nota abaixo) e ficam ≥ 4.5:1:

| Par | Razão |
|---|---|
| `--text` / `--bg` | 15.6:1 |
| `--text-muted` / `--surface` | 7.3:1 |
| `--text-faint` / `--surface` | 5.2:1 |
| `--danger-strong` / `--danger-tint` | 8.2:1 |
| `--warn-strong` / `--warn-tint` | 7.0:1 |
| `--success-strong` / `--success-tint` | 7.6:1 |
| `--info-strong` / `--info-tint` | 8.9:1 |
| `--brand-ink` / `--brand` (texto de botão) | 5.3:1 |
| `--brand` / `--surface` (link) | 5.4:1 |
| `--neutral-badge` / `--neutral-badge-tint` | 4.9:1 |

> Nota técnica: `getComputedStyle(...).color` no Chromium devolve a cor ainda
> em `oklch(...)`, não convertida para `rgb()` — um script ingênuo de checagem
> de contraste que faz `match(/\d+/g)` nessa string quebra silenciosamente
> (casa `0`, `23`, `0` em vez dos componentes reais). A verificação real
> precisa converter OKLCH → sRGB linear → sRGB antes de aplicar a fórmula de
> luminância relativa do WCAG.

O papel de cada matiz é fixo e não se sobrepõe: 165° (neutros/UI), 173°
(marca), 25° (erro), 55°/75° (aviso), 148° (aceito), 255° (informação/painel
de critério), 300° (foco).

## Typography

Um único family, stack de sistema (permitido e recomendado em product
register):

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Inter", sans-serif;
--font-mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;
```

Escala fixa em rem (não fluida — usuários veem em DPI consistente):

```
--text-xs: 0.75rem     (12px)  rótulos, badges, timestamps
--text-sm: 0.8125rem   (13px)  UI secundária, filtros, tabelas
--text-base: 0.9375rem (15px)  corpo
--text-md: 1.0625rem   (17px)  título de regra, wordmark
--text-lg: 1.25rem     (20px)  h2
--text-xl: 1.625rem    (26px)  "Avaliação concluída"
--text-2xl: 2.75rem    (44px)  número da nota (gauge)
```

`--font-mono` para tudo que é literal técnico (URL, seletor CSS, HTML
capturado, ID de regra) — nunca para texto de leitura corrida.

## Layout

`--wrap`: 68rem de largura máxima, centralizado. Painéis (`.panel`) usam
`--radius-lg` (16px) e sombra suave (`--shadow-sm`), não apenas borda —
diferencia do fundo `--bg` sem depender só de contraste de cinza.

Grid responsivo em `.summary-grid` (donut + tabela A/AA/AAA) colapsa para
coluna única abaixo de 40rem.

## Components

### Gauge de nota

Anel SVG (`stroke-dasharray` sobre círculo de raio 52, `stroke-linecap:
round`), preenchido proporcionalmente a `score.value / score.scale[1]`, cor
`--brand`. Transição de 400ms ao trocar de relatório (`cubic-bezier(0.16, 1,
0.3, 1)` — ease-out-quint, sem bounce). `role="img"` com `aria-label`
descrevendo o valor por extenso, para quem usa leitor de tela.

### Donut de resumo

`conic-gradient` de 3 segmentos (erro/revisar/aceito), furo central via
`::after`. O número central troca com a aba ativa (Erros/Revisar/Aceito/Não se
aplica) — o mesmo padrão do AMAWeb, onde o centro do gráfico muda conforme a
aba selecionada.

### Abas de status

Segue o padrão APG de tabs: `role="tablist"`/`role="tab"`/`aria-selected`,
navegação por `ArrowLeft`/`ArrowRight`/`Home`/`End` com roving `tabIndex`, não
apenas clique do mouse. Cor de cada aba (`data-tone`) reaproveita a semântica
de severidade.

### Cartão de resultado — o "flag" de nível

Bloco sólido à esquerda do item (≈4.25rem de largura, altura total da linha),
cor de fundo = severidade (`--danger-tint`/`--warn-tint`/`--success-tint`),
letra = nível WCAG (A/AA/AAA, ou "—" quando a regra não declara critério).

Isto **não é** a borda-lateral decorativa proibida pelas regras compartilhadas
de design: é um bloco de conteúdo genuíno (carrega informação real — o nível —
e tem largura de ícone/rótulo, não de traço decorativo de poucos pixels).
Inspirado diretamente no card de resultado do AMAWeb, que usa o mesmo padrão.

### Painel de técnica (expandido)

Fundo `--info-tint`, mostra a regra ACT / técnica WCAG relacionada, chip de
critério com "level tag" e link de documentação. Equivalente funcional ao
painel azul do AMAWeb ("Técnica do WCAG relacionada" + "Ver no Manual
AMAWeb"), com nossos próprios dados (o QualWeb tem catálogo de regras
diferente do motor por trás do AMAWeb).

## Motion

150–400ms, sempre `ease-out`. Nenhuma animação de propriedade de layout
(largura/altura/posição) — só `stroke-dasharray` (gauge), cor e transform de
2px (chevron, active state). `prefers-reduced-motion: reduce` zera todas as
durações globalmente.

## O que este produto explicitamente NÃO faz

- Não usa gradiente em texto.
- Não usa glassmorphism.
- Não usa modal como afirmação — tudo é inline/expansível (`<details>`).
- Não usa borda-lateral decorativa (ver nota do "flag" de nível acima).
- Não replica a marca/identidade visual do AMAWeb (logotipo, tipografia
  exata, paleta exata) — replica a *estrutura* de informação (nota em anel,
  abas por status, tabela A/AA/AAA, item expansível com critério), que é o
  que o usuário pediu. Ver anti-references em PRODUCT.md.
