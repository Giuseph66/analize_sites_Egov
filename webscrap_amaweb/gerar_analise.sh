#!/usr/bin/env bash
# Consolida os JSON AMAWeb e gera tabelas/figuras atualizadas para o artigo.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INPUT_DIR="${AMAWEB_OUTPUT_DIR:-$SCRIPT_DIR/saida_mt}"
ANALYSIS_DIR="${AMAWEB_ANALYSIS_DIR:-$SCRIPT_DIR/analise_atual}"
CATALOG="${AMAWEB_CATALOGO:-/home/jesus/Downloads/mato_grosso_sites_amaweb.xlsx}"

ARGS=(--entrada "$INPUT_DIR" --saida "$ANALYSIS_DIR")
if [[ -f "$CATALOG" ]]; then
  ARGS+=(--catalogo "$CATALOG")
else
  echo "Aviso: catálogo não encontrado; município, poder e URLs sem JSON não serão incluídos." >&2
fi

exec python3 "$SCRIPT_DIR/analisar_resultados.py" "${ARGS[@]}" "$@"
