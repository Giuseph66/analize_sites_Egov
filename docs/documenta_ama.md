DOCUMENTAÇÃO E REFERÊNCIAS — AMAWeb
Atualizado em: 21/09/2026

1. PLATAFORMA

AMAWeb é uma plataforma de avaliação e monitoramento de acessibilidade na web,
desenvolvida pela Universidade Federal de São Paulo (UNIFESP) e pelo Instituto
Federal do Rio Grande do Sul (IFRS). A página institucional declara que a
plataforma é gratuita e financiada com recursos obtidos pelo Ministério Público
Federal (MPF), em acordos e ações civis públicas.

Fonte oficial:
https://amaweb.unifesp.br/

2. AVALIADOR AUTOMÁTICO

O avaliador aceita URL, código HTML ou arquivo de página e produz avaliação
automática baseada nas Web Content Accessibility Guidelines (WCAG), com
relatório e nota de desempenho.

Fonte oficial:
https://amaweb.unifesp.br/avaliador/

3. CRITÉRIOS E APOIO À INTERPRETAÇÃO

O Manual AMAWeb explica critérios de acessibilidade associados às WCAG. Ele é
adequado para interpretar erros e recomendações retornados pela avaliação.

Fonte oficial:
https://amaweb.unifesp.br/manual/conteudo

O Checklist AMAWeb contém requisitos e recomendações associados à ABNT NBR
17225 e critérios WCAG. Serve como apoio para revisão manual complementar.

Fonte oficial:
https://amaweb.unifesp.br/checklist/

4. OBSERVATÓRIO

O Observatório apresenta resultados agregados de páginas avaliadas, incluindo
notas, distribuição de pontuações e práticas de acessibilidade.

Exemplo oficial:
https://amaweb.unifesp.br/observatorio/1/3

5. ENDPOINT UTILIZADO PELO SCRIPT

O script amaweb.py envia cada URL ao endpoint abaixo, com a URL de destino
codificada para uso em caminho HTTP:

https://amaweb.unifesp.br/server/amp/eval/{URL-codificada}

Exemplo conceitual:
https://amaweb.unifesp.br/server/amp/eval/https%3A%2F%2Fwww.gov.br%2F

O endpoint devolve JSON com metadados da página, nota AMAWeb, resultados das
práticas e informações de conformidade. O script preserva esse JSON sem
alterar a resposta original e gera um PDF local para leitura.

6. LIMITE METODOLÓGICO

Não foi localizada documentação pública formal para esse endpoint, como
OpenAPI, Swagger, política de uso, chave de acesso, cota de requisições ou SLA.
Ele foi identificado pelo comportamento do avaliador web e utilizado sem
autenticação. Portanto, no artigo, a referência metodológica deve citar a
página institucional e o avaliador AMAWeb; o endpoint técnico não deve ser
apresentado como API formalmente documentada.

7. FORMA SUGERIDA DE CITAÇÃO NO TEXTO

"As páginas foram avaliadas com o AMAWeb, plataforma gratuita de avaliação de
acessibilidade digital desenvolvida pela UNIFESP e pelo IFRS, baseada nas
diretrizes WCAG (AMAWeb, 2026)."

REFERÊNCIAS WEB

AMAWEB. Plataforma de avaliação e monitoramento de acessibilidade na web.
Disponível em: <https://amaweb.unifesp.br/>. Acesso em: 21 set. 2026.

AMAWEB. Avaliador. Disponível em:
<https://amaweb.unifesp.br/avaliador/>. Acesso em: 21 set. 2026.

AMAWEB. Manual. Disponível em:
<https://amaweb.unifesp.br/manual/conteudo>. Acesso em: 21 set. 2026.

AMAWEB. Checklist. Disponível em:
<https://amaweb.unifesp.br/checklist/>. Acesso em: 21 set. 2026.

AMAWEB. Observatório. Disponível em:
<https://amaweb.unifesp.br/observatorio/1/3>. Acesso em: 21 set. 2026.
