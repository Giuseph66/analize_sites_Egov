# Webscrap AMAWeb

CLI Python separado para avaliar URL pública no AMAWeb e salvar:

- JSON bruto retornado pelo AMAWeb;
- PDF local c/ nota, metadados, resumo e práticas identificadas.

Requisitos: Python 3.9+ e Chromium/Google Chrome instalado. Não há dependências Python externas.

```bash
cd webscrap_amaweb
python3 amaweb.py 'https://www.gov.br'
```

Saída padrão: `webscrap_amaweb/saida/`.

```bash
python3 amaweb.py 'https://www.gov.br,https://www.unifesp.br,https://www.ifrs.edu.br'
python3 amaweb.py 'https://www.gov.br' --output-dir ./relatorios
python3 amaweb.py 'https://www.gov.br' --keep-html
python3 amaweb.py 'https://www.gov.br' --browser /caminho/para/chromium
```

Cada URL recebe JSON + PDF próprios. Se uma falhar, demais continuam.

O JSON preserva resposta completa oficial. PDF serve leitura rápida da nota e achados. AMAWeb avalia apenas páginas alcançáveis publicamente; não substitui revisão manual WCAG.
