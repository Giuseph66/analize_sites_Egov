# Teste de avaliação por HTML baixado

Executado em: 2026-09-21T20:18:56-04:00

Lista testada: 51 URLs previamente classificadas como bloqueio Cloudflare.

## Resultado

- **32 URLs**: download HTTP 200, HTML não vazio e avaliação concluída.
- **19 URLs**: download HTTP 403; servidor entregou apenas resposta de acesso negado.
- **0 URLs**: outro resultado.

Interpretação: o fluxo HTML consegue contornar a navegação do navegador nos casos HTTP 200 e avaliar o documento baixado. Nos casos HTTP 403, o servidor bloqueia antes de entregar o HTML do portal; o AccessMonitor só consegue avaliar a mensagem de bloqueio (nota geralmente 3,0).

## HTML baixado com sucesso (HTTP 200)

- `https://arenapolis.mt.leg.br/` — nota **3.5** — Câmara Municipal de Arenápolis
- `https://cindvale.com.br` — nota **5.6** — Página inicial
- `https://curvelandia.mt.leg.br/` — nota **8.1** — Câmara Municipal de Curvelândia
- `https://figueiropolisdoeste.mt.leg.br/` — nota **5.4** — Câmara Municipal de Figueirópolis d´Oeste
- `https://lambaridoeste.mt.leg.br/` — nota **8.1** — Câmara Municipal de Lambari D‘Oeste
- `https://portodosgauchos.mt.leg.br/#/home` — nota **5.8** — Câmara Municipal de Porto dos Gaúchos
- `https://primaveradoleste.mt.gov.br/` — nota **8.9** — Página Inicial - Prefeitura de Primavera do Leste Primavera do Leste - MT
- `https://tesouro.mt.leg.br/` — nota **7.3** — Câmara Municipal de Tesouro - MT
- `https://santaterezinha.mt.gov.br/` — nota **8.0** — Administração - Prefeitura de Santa Terezinha / MT
- `https://www.boaesperancadonorte.mt.gov.br/` — nota **5.4** — Prefeitura Municipal de Boa Esperança do Norte
- `https://www.cotriguacu.mt.gov.br/` — nota **8.3** — Prefeitura Municipal de Cotriguaçu
- `https://www.castanheira.mt.leg.br/` — nota **5.5** — Câmara de Castanheira - Poder Legislativo Municipal
- `https://www.denise.mt.gov.br/` — nota **3.8** — Prefeitura Municipal de Denise
- `https://www.gloriadoeste.mt.leg.br/` — nota **7.9** — Câmara Municipal de Glória d'Oeste
- `https://www.mirassoldoeste.mt.gov.br/` — nota **4.9** — Prefeitura de Mirassol D Oeste - MT
- `https://www.juruena.mt.gov.br/` — nota **9.0** — Prefeitura Municipal
- `https://www.pocone.mt.gov.br/` — nota **9.2** — Prefeitura de Poconé - MT
- `https://www.ribeiraozinho.mt.gov.br` — nota **9.2** — Prefeitura Municipal de Ribeirãozinho - MT
- `https://www.santaterezinha.mt.leg.br/` — nota **7.3** — Câmara Municipal de Santa Terezinha - MT
- `https://www.serranovadourada.mt.leg.br/` — nota **7.1** — Câmara Municipal - Início
- `https://www.sinop.mt.gov.br/` — nota **9.5** — Prefeitura Municipal de Sinop - MT
- `https://acessoainformacao.pontaldoaraguaia.mt.gov.br/cidadao/ouvidoria/solicitacaoservico` — nota **7.3** — Solicitação - Prefeitura de Pontal do Araguaia - MT
- `https://cartadeservicos.primaveradoleste.mt.gov.br/Carta-Servicos/Servico/Ouvidoria-municipal-3272` — nota **7.5** — Carta de Serviços - Prefeitura Municipal de Primavera do Leste
- `https://mirassoldoeste.flowdocs.com.br:2053/public/home/subject/3` — nota **6.1** — FlowDocs
- `https://ouvidoria.santaterezinha.mt.gov.br/ouvidoria/form` — nota **9.0** — Nova manifestação · Ouvidoria
- `https://www.aguaboa.mt.gov.br/servicos/ouvidoria` — nota **6.6** — Ouvidoria | Prefeitura Municipal de Água Boa - MT
- `https://www.boaesperancadonorte.mt.gov.br/ouvidoria/nova/17/denuncia` — nota **5.5** — Ouvidoria
- `https://www.cotriguacu.mt.gov.br/portal/carta-servicos/34/` — nota **7.8** — Prefeitura Municipal de Cotriguaçu - Carta de Serviços
- `https://www.denise.mt.gov.br/ouvidoria/manifestacao` — nota **4.8** — Ouvidoria | Manifestações | Prefeitura Municipal de Denise
- `https://www.juruena.mt.gov.br/portal/ouvidoria/cadastro/1` — nota **8.1** — Prefeitura Municipal
- `https://www.pocone.mt.gov.br/portal/ouvidoria/cadastro/1` — nota **8.6** — Prefeitura de Poconé - MT
- `https://www.ribeiraozinho.mt.gov.br/portal/ouvidoria/cadastro/1` — nota **8.6** — Prefeitura Municipal de Ribeirãozinho - MT

## Bloqueio mantido (HTTP 403)

- `https://lambaridoeste.mt.gov.br` — nota **3.0** — corpo baixado: 14 bytes
- `https://reservadocabacal.mt.leg.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://riobranco.mt.gov.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://riobranco.mt.leg.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://saltodoceu.mt.gov.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://saltodoceu.mt.leg.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://valedesaodomingos.mt.gov.br` — nota **3.0** — corpo baixado: 14 bytes
- `https://valedesaodomingos.mt.leg.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://www.curvelandia.mt.gov.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://www.gloriadoeste.mt.gov.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://www.nascentesdopantanal.org.br` — nota **3.0** — corpo baixado: 14 bytes
- `https://www.reservadocabacal.mt.gov.br/` — nota **3.0** — corpo baixado: 14 bytes
- `https://curvelandia.mt.gov.br/ouvidoria/formulario-on-line?tipo=den` — nota **3.0** — corpo baixado: 14 bytes
- `https://gloriadoeste.mt.gov.br/ouvidoria/formulario-on-line` — nota **3.0** — corpo baixado: 14 bytes
- `https://lambaridoeste.mt.gov.br/ouvidoria/formulario-on-line` — nota **3.0** — corpo baixado: 14 bytes
- `https://reservadocabacal.mt.gov.br/ouvidoria/formulario-on-line` — nota **3.0** — corpo baixado: 14 bytes
- `https://saltodoceu.mt.gov.br/ouvidoria/formulario-on-line` — nota **3.0** — corpo baixado: 14 bytes
- `https://www.riobranco.mt.gov.br/ouvidoria/formulario-on-line` — nota **3.0** — corpo baixado: 14 bytes
- `https://www.valedesaodomingos.mt.gov.br/ouvidoria/formulario-on-line` — nota **3.0** — corpo baixado: 14 bytes

## Arquivos

- CSV completo: `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/teste_html_lote/2026-09-21/20-11-10/resultados_html.csv`
- HTMLs, JSONs, PDFs e evidências: `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_accessmonitor/teste_html_lote/2026-09-21/20-11-10`
