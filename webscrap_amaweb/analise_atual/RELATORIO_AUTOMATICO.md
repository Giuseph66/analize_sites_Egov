# Relatório automático dos resultados AMAWeb

Gerado em: 2026-09-20T15:04:23-04:00
Entrada: `/home/jesus/faculdade/grupo-pesquisa/Egov/analize_sites_Egov/webscrap_amaweb/saida_mt`
Catálogo: `/home/jesus/Downloads/mato_grosso_sites_amaweb.xlsx`

## Cobertura da coleta

- Universo: **313 URLs**.
- Conteúdo institucional avaliado: **231**.
- Bloqueio Cloudflare: **35**.
- Sem resultado AMAWeb: **47**.

Cloudflare é contabilizado como resultado da coleta e como barreira de avaliabilidade. Sua nota AMAWeb é preservada na base, mas não entra nas estatísticas do conteúdo institucional.

## Estatísticas principais

- Conteúdo institucional: média **7,61**, mediana **7,70**, n = **231**.
- Todas as páginas retornadas, inclusive Cloudflare: média **7,88**, n = **266**.
- Pares Executivo–Legislativo: **81 municípios**; diferença média Executivo − Legislativo = **-0,11**.
- Transparência × acessibilidade: Pearson r = **-0,018** e Spearman ρ = **-0,088** (n = 231).

## Erros mais frequentes

| Prática | Sites | Prevalência |
|---|---:|---:|
| `textContrastHNot` | 222 | 96,1% |
| `colorContrast` | 193 | 83,5% |
| `linkNotAName` | 181 | 78,4% |
| `aImgAltNo` | 134 | 58,0% |
| `idAttNot` | 121 | 52,4% |
| `aSkipFirstNo` | 110 | 47,6% |
| `imgAltNo` | 101 | 43,7% |
| `aTitleMatch` | 96 | 41,6% |
| `hxSkip` | 87 | 37,7% |
| `imgAltLong` | 86 | 37,2% |

## Arquivos gerados

- `base_consolidada.csv`: uma linha por URL do universo.
- `falhas_por_site.csv`: uma linha por prática falha em cada portal.
- `tabela_*.csv`: tabelas completas para conferência.
- `tabela_*.tex`: tabelas prontas para inclusão no LaTeX.
- `figuras/*.png`: imagens em 300 dpi.
- `figuras/*.pdf`: figuras vetoriais para o artigo.
- Figuras produzidas: `figura_01_resultados_coleta`, `figura_02_distribuicao_notas`, `figura_03_notas_por_poder`, `figura_04_erros_frequentes`, `figura_05_transparencia_acessibilidade`, `figura_06_executivo_legislativo`.
