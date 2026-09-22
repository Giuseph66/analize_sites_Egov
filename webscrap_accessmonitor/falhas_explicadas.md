# Falhas das avaliações AccessMonitor

Gerado em: 2026-09-21T20:02:27-04:00

Foram analisados todos os `resultados.csv` das rodadas AccessMonitor: **143 falhas em URLs únicas**.

## Resumo

| Categoria | Quantidade | Motivo |
|---|---:|---|
| HTTP 500 — relatório QualWeb vazio | 79 | O QualWeb não produziu relatório para a página. |
| HTTP 500 — navegador | 1 | Chromium/QualWeb não iniciou. |
| HTTP 400 — validação URL/DNS | 14 | Backend rejeitou URL ou não resolveu DNS durante a validação. |
| Timeout de 120s | 26 | API não respondeu no limite da primeira rodada. |
| Timeout de 45s | 23 | API não respondeu no limite usado na retomada. |
| PDF | 0 | Avaliação pode existir, mas PDF falhou. |
| Outro | 0 | Mensagem sem classificação específica. |

Por contexto: **125 MT** e **18 ouvidorias**.

### Limites da explicação

- HTTP 400 é uma mensagem genérica do backend; o serviço não registra no CSV se a causa foi parsing ou DNS.
- HTTP 500 “relatório vazio” significa falha do motor de avaliação; não equivale automaticamente a site fora do ar ou bloqueio Cloudflare.
- Timeout indica que o limite da coleta venceu; não prova indisponibilidade permanente.

## Detalhamento por falha

### 1. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://araguaiana.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 2. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://araguainha.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 3. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://baraodemelgaco.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 4. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camaraacorizal.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 5. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camaraaripuanamt.com.br/index.php
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 6. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camaraguarantadonorte.mt.gov.br
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 7. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camaraplanaltodaserra.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 8. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camaraportoestrela.com.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 9. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camararibeiraocascalheira.com.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 10. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://canabravadonorte.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 11. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://cidesa.com.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 12. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://cisrnm.com.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 13. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://colniza.mt.gov.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 14. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://guiratinga.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 15. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://jangada.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 16. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://juara.mt.gov.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 17. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://matupa.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 18. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://nortelandia.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 19. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://novamarilandia.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 20. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.acorizal.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 21. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.al.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 22. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.altafloresta.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 23. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.altoboavista.mt.gov.br
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 24. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.altogarcas.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 25. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.altotaquari.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 26. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.araguaiana.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 27. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.aripuana.mt.gov.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 28. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.baraodemelgaco.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 29. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.bomjesusdoaraguaia.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 30. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.caceres.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 31. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camarachapadadosguimaraes.mt.gov.br
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 32. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camaradealtoparaguai.com.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 33. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camarajaciara.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 34. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camarajauru.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 35. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camaranovabandeirantes.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 36. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camarasaojosedoxingu.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 37. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.campoverde.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 38. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.ciscn.com.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 39. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.cisva.com.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 40. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.cisvarc.com.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 41. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.confresa.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 42. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.consorcioaltotapajos.com.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 43. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.consprev.com.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 44. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.cuiaba.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 45. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.defensoria.mt.def.br/dpmt/portal/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 46. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.feliznatal.mt.gov.br/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 47. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.generalcarneiro.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 48. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.indiavai.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 49. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.ipirangadonorte.mt.gov.br
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 50. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.jaciara.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 51. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.juruena.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 52. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.juscimeira.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 53. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.lucasdorioverde.mt.gov.br/site/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 54. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.luciara.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 55. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.luciara.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 56. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.mti.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 57. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novabrasilandia.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 58. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novacanaadonorte.mt.gov.br/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 59. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novalacerda.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 60. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novaubirata.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 61. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novaubirata.mt.leg.br/#/home
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 62. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novohorizontedonorte.mt.gov.br/transparencia
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 63. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novomundo.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 64. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.planaltodaserra.mt.gov.br
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 65. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.portoalegredonorte.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 66. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.prefeituradepontebranca-mt.com.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 67. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.ribeiraocascalheira.mt.gov.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 68. HTTP_500_RELATORIO_VAZIO

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.uniaodosul.mt.leg.br/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 69. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://araguaiana.mt.gov.br/ouvidoria-identificada
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 70. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://canarana.mt.gov.br/portal/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 71. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://gws-sistemas.com.br/ouvidoria.pm.acorizal/novo-protocolo
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 72. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://gws-sistemas.com.br/ouvidoria.pm.bomjesusdoaraguaia/novo-protocolo
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 73. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://gws-sistemas.com.br/ouvidoria.pm.indiavai/novo-protocolo
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 74. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://gws-sistemas.com.br/ouvidoria.pm.luciara
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 75. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://gws-sistemas.com.br/ouvidoria.pm.ribeiraocascalheira/novo-protocolo
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 76. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://ouvidoria.cuiaba.mt.gov.br/new
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 77. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://prefeitura-de-planalto-da-serra.webnode.page/ouvidoria/
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 78. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://rondolandia.mt.gov.br/ouvidoria?tipo=1
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 79. HTTP_500_RELATORIO_VAZIO

- **Contexto:** Ouvidorias
- **URL:** https://www.novaubirata.mt.gov.br/ouvidoria
- **Explicação:** O backend iniciou o QualWeb, mas recebeu um relatório vazio e devolveu HTTP 500. Isso normalmente ocorre quando a página não pôde ser carregada/interpretada pelo navegador, ficou inacessível, falhou em scripts ou retornou conteúdo que o QualWeb não conseguiu transformar em relatório. A coleta não tem evidência suficiente para apontar uma causa única do site.
- **Detalhe técnico:** `QualWeb: Invalid resource: QualWeb returned an empty report.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 80. HTTP_500_BROWSER

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.cocalinho.mt.gov.br/
- **Explicação:** O backend não conseguiu iniciar o navegador Chromium/QualWeb para essa avaliação. É uma falha de ambiente/recurso durante a execução, não um resultado de acessibilidade da página.
- **Detalhe técnico:** `QualWeb: Unable to launch browser.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 81. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://aguaboa.mt.leg.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 82. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://amaramirassoldoeste.mt.gov.br
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 83. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camaradevarzeagrande.com.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 84. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://camaravilarica.mt.gov.br/parlamentar/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 85. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://novo.camponovodoparecis.mt.gov.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 86. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.aguaboa.mt.gov.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 87. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camaracamposdejulio.mt.gov.br/home
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 88. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camarapontebranca.com.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 89. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camaravilabela.mt.gov.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 90. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.cismasaude.com.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 91. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.varzeagrande.mt.gov.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 92. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.vilabeladasantissimatrindade.mt.gov.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 93. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.vilarica.mt.gov.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 94. HTTP_400_VALIDACAO_URL_DNS

- **Contexto:** Ouvidorias
- **URL:** https://ouvidoria.pm.altoboavista.gws-sistemas.com.br/
- **Explicação:** O backend rejeitou a URL antes da avaliação. A validação local executa parsing HTTP/HTTPS e consulta DNS; qualquer falha nessa etapa produz a mensagem genérica “The URL provided is invalid.”. O motivo interno (URL inválida ou DNS sem resolução naquele momento) não é exposto pela API.
- **Detalhe técnico:** `API: HTTP 400 — The URL provided is invalid.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 95. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** http://www.camarageneralcarneiro.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 96. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://cocalinho.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 97. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://domaquino.oxy.elotech.com.br/portaltransparencia/3/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 98. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://indiavai.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 99. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://novamutum.mt.leg.br/#/home
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 100. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://novosantoantonio.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 101. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://portal.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 102. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://rondolandia.mt.gov.br
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 103. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.altotaquari.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 104. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camarajuscimeira.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 105. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camaranovacanaa.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 106. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.campinapolis.mt.gov.br/#/home
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 107. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.cidesasul.com.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 108. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.cisrga.com.br/#/home
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 109. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.claudia.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 110. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.conquistadoeste.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 111. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.guarantadonorte.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 112. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.itanhanga.mt.gov.br/#/home
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 113. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.metamat.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 114. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.novamutum.mt.gov.br/home
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 115. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.portoestrela.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 116. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.querencia.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 117. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.rondonopolis.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 118. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.rondonopolis.mt.leg.br/principal
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 119. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.rosariooeste.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-17-54/resultados.csv`

### 120. TIMEOUT_120S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.tce.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 120 segundos. O navegador/QualWeb pode ter ficado aguardando carregamento, rede, scripts ou uma página que não responde. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 120s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/17-04-38/resultados.csv`

### 121. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://santacruzdoxingu.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 122. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://santaritadotrivelato.mt.leg.br/home
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 123. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://santoafonso.mt.leg.br/index.php
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 124. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://serranovadourada.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 125. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://site.sorriso.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 126. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://sorriso.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 127. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://tangaradaserra.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 128. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://torixoreu.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 129. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.camaraleverger.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 130. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.leverger.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 131. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.santaritadotrivelato.mt.gov.br/home
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 132. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.santoafonso.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 133. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.santoantoniodoleste.mt.gov.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 134. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.santoantoniodoleste.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-29-03/resultados.csv`

### 135. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.saojosedorioclaro.mt.gov.br/home
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 136. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.sapezal.mt.leg.br
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 137. TIMEOUT_45S

- **Contexto:** MT (prefeituras/câmaras)
- **URL:** https://www.terranovadonorte.mt.leg.br/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_mt/2026-09-21/19-32-40/resultados.csv`

### 138. TIMEOUT_45S

- **Contexto:** Ouvidorias
- **URL:** https://ouvidoria.guiratinga.mt.gov.br/Manifestacao/
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 139. TIMEOUT_45S

- **Contexto:** Ouvidorias
- **URL:** https://saofelixdoaraguaia.centi.com.br/ouvidoria
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 140. TIMEOUT_45S

- **Contexto:** Ouvidorias
- **URL:** https://www.canabravadonorte.org/transparencia/ouvidoria/cadastrar-manifestacao
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 141. TIMEOUT_45S

- **Contexto:** Ouvidorias
- **URL:** https://www.gp.srv.br/adm_altafloresta/ouvidoria/#/home
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 142. TIMEOUT_45S

- **Contexto:** Ouvidorias
- **URL:** https://www.gws-sistemas.com.br/cartadeservico.pm.generalcarneiro/geral/ouvidoria-municipal
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`

### 143. TIMEOUT_45S

- **Contexto:** Ouvidorias
- **URL:** https://www.jauru.mt.gov.br/ouvidoria-identificada
- **Explicação:** A API local não devolveu o relatório dentro de 45 segundos. Esse limite foi usado na retomada para evitar que portais lentos travassem o lote. Não é confirmação de que o site esteja offline.
- **Detalhe técnico:** `Cliente encerrou a espera em 45s.`
- **CSV de origem:** `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/saida_ouvidorias_mt/2026-09-21/19-37-51/resultados.csv`
