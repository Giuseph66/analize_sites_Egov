# Webscrap AMAWeb

CLI Python separado para avaliar URL pública no AMAWeb e salvar:

- JSON bruto retornado pelo AMAWeb;
- PDF local c/ nota, metadados, resumo e práticas identificadas.

Requisitos: Python 3.10+ e Chromium/Google Chrome instalado. Não há dependências Python externas.

```bash
cd webscrap_amaweb
python3 amaweb.py 'https://www.gov.br'
```

Saída padrão, organizada por ciclo:

```text
saida/
└── 2026-09-20/
    └── 14-35-08/
        ├── amaweb_site1.gov.br_001.json
        ├── amaweb_site1.gov.br_001.pdf
        ├── amaweb_site2.gov.br_002.json
        └── amaweb_site2.gov.br_002.pdf
```

```bash
python3 amaweb.py 'https://www.gov.br,https://www.unifesp.br,https://www.ifrs.edu.br'
python3 amaweb.py 'https://site1.gov.br,https://site2.gov.br' --workers 5
python3 amaweb.py 'https://site1.gov.br,https://site2.gov.br' --interval 3600
python3 amaweb.py 'https://site1.gov.br,https://site2.gov.br' --interval 1800 --duration-hours 8
python3 amaweb.py 'https://www.gov.br' --output-dir ./relatorios
python3 amaweb.py 'https://www.gov.br' --keep-html
python3 amaweb.py 'https://www.gov.br' --browser /caminho/para/chromium
```

URLs executam em paralelo (`--workers 3` padrão). Cada URL recebe JSON + PDF próprios. Se uma falhar, demais continuam.

`--interval` repete lote em segundos; `--duration-hours` encerra automaticamente após N horas. Sem `--duration-hours`, rode até `Ctrl+C`.

## Lista MT

Para executar `/home/jesus/Downloads/mt_urls_amaweb.txt`, use:

```bash
./run_mt_urls.sh --workers 3 --interval 1800 --duration-hours 8
```

O launcher remove URLs repetidas antes de executar e cria `mt_urls_amaweb_unicas.txt`. Saída padrão: `saida_mt/AAAA-MM-DD/HH-MM-SS/`. Para usar outra lista: `AMAWEB_URL_LIST=/caminho/lista.txt ./run_mt_urls.sh`.

O JSON preserva resposta completa oficial. PDF serve leitura rápida da nota e achados. AMAWeb avalia apenas páginas alcançáveis publicamente; não substitui revisão manual WCAG.

## Análise reproduzível para o artigo

Depois de qualquer nova rodada, execute:

```bash
./gerar_analise.sh
```

O comando relê **todos** os JSON de `saida_mt`, deduplica cada URL usando a avaliação mais recente e atualiza `analise_atual/` com:

- `base_consolidada.csv`, incluindo URLs ainda sem resultado;
- tabelas gerais, por poder, erros frequentes e comparação pareada;
- tabelas `.tex` para inclusão no artigo;
- figuras em PNG (300 dpi) e PDF vetorial;
- `RELATORIO_AUTOMATICO.md` com números e alertas atualizados.

Bloqueios Cloudflare são preservados como resultado da coleta. A nota retornada para a página de bloqueio fica em `nota_amaweb`, mas `nota_conteudo_institucional` permanece vazia para não atribuir ao portal a nota do bloqueio.

Para trocar entradas sem editar o script:

```bash
AMAWEB_OUTPUT_DIR=/caminho/saidas \
AMAWEB_CATALOGO=/caminho/catalogo.xlsx \
AMAWEB_ANALYSIS_DIR=/caminho/analise \
./gerar_analise.sh
```

Também é possível gerar apenas as tabelas: `./gerar_analise.sh --sem-graficos`.
