# Product

## Register

product

## Users

Desenvolvedores, designers e gestores de equipes de TI de instituições públicas
brasileiras (municipais, estaduais) avaliando a acessibilidade de sites e
sistemas que eles próprios mantêm — incluindo aplicações rodando localmente em
desenvolvimento (`localhost:5173` etc.). Também usado por pesquisadores
comparando este avaliador local com ferramentas de referência como o AMAWeb
(UNIFESP/IFRS) e o AccessMonitor (AMA, Portugal).

Contexto de uso: escritório, horário comercial, monitor grande, muitas vezes
com o AMAWeb ou outro avaliador aberto em aba paralela para comparação direta.
Sessões de trabalho, não uma visita única — o usuário roda várias avaliações
seguidas, revisita relatórios antigos, exporta dados.

## Product Purpose

Laboratório local de avaliação de acessibilidade web: recebe uma URL, executa
o motor QualWeb (ACT Rules + WCAG Techniques + Best Practices) num Chromium
controlado, e devolve um relatório navegável — com todo o processo visível em
log, para quem quer entender e modificar o motor, não só rodar um checkup.

Sucesso é: um relatório que um auditor de acessibilidade brasileiro reconhece
de imediato — mesma linguagem visual de nota/score, erros/avisos/aceitos,
tabela A/AA/AAA, item expansível com critério WCAG e código-fonte — mas com
transparência total do processo (logs em tempo real, JSON bruto do motor,
diagnóstico de rede) que ferramentas de produção como o AMAWeb não expõem.

## Brand Personality

Técnico, direto, institucional-mas-vivo. Três palavras: **claro, confiável,
auditável**. Não é uma ferramenta de marketing — é uma bancada de trabalho.

Referência principal: **AMAWeb** (amaweb.unifesp.br/avaliador) — tema claro,
verde/teal como cor de marca, vermelho para erro, laranja para revisão manual,
verde para aceito, gráfico de rosca para a nota, abas Erros/Revisar/Aceito,
item expansível com painel azul-claro mostrando a técnica WCAG e o critério.
O usuário pediu explicitamente para a interface se aproximar visualmente
dessa referência, em vez do visual genérico "dashboard escuro" atual.

## Anti-references

- O que a interface tinha até agora: um dashboard escuro genérico, cards
  soltos, sem hierarquia visual clara entre erro/aviso/aceito além da cor do
  texto. O usuário descreveu como "muito jogável" (solto, sem coesão).
- Dashboards SaaS genéricos com métrica grande + gradiente + cards idênticos
  em grid.
- Qualquer coisa que pareça um produto de marketing — este é um instrumento
  de auditoria técnica, não uma landing page.

## Design Principles

1. **A hierarquia de severidade é a hierarquia visual.** Erro, aviso e aceito
   precisam ser instantaneamente distinguíveis — cor, ícone, agrupamento —
   sem depender só do texto do badge.
2. **Familiaridade sobre originalidade.** Um auditor que já usa o AMAWeb deve
   reconhecer os mesmos conceitos (nota, tabela A/AA/AAA, abas por status,
   item expansível com critério) sem precisar reaprender a interface.
3. **Nada esconde o processo.** Ao contrário de ferramentas de produção, esta
   interface pode e deve mostrar log ao vivo, JSON bruto, diagnóstico —
   "auditável" não é só sobre o site avaliado, é sobre a própria ferramenta.
4. **Pratique o que prega.** A interface do próprio avaliador segue WCAG 2.1
   AA: contraste mínimo 4.5:1 para texto normal, foco sempre visível,
   navegável por teclado, marcos semânticos corretos.

## Accessibility & Inclusion

Meta formal: **WCAG 2.1 nível AA** para a interface do avaliador em si.
Contraste de texto ≥ 4.5:1 (≥ 3:1 para texto grande), indicador de foco visível
em todo elemento interativo, estrutura de heading correta (sem pular níveis),
`prefers-reduced-motion` respeitado, toda informação transmitida por cor tem
também um indicador não-cromático (ícone, texto, padrão).
