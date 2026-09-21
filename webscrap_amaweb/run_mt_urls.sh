#!/usr/bin/env bash
# Executa a lista MT no AMAWeb. Flags extras são repassadas ao amaweb.py.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LIST_FILE="${AMAWEB_URL_LIST:-/home/jesus/Downloads/mt_urls_amaweb.txt}"
UNIQUE_LIST="$SCRIPT_DIR/mt_urls_amaweb_unicas.txt"
OUTPUT_DIR="${AMAWEB_OUTPUT_DIR:-$SCRIPT_DIR/saida_mt}"

if [[ ! -f "$LIST_FILE" ]]; then
  echo "Lista não encontrada: $LIST_FILE" >&2
  exit 1
fi

awk '
  {
    gsub(/\r/, "")
    sub(/^[[:space:]]+/, "")
    sub(/[[:space:]]+$/, "")
  }
  NF && !seen[$0]++ { print }
' "$LIST_FILE" > "$UNIQUE_LIST"

TOTAL="$(awk 'NF { count++ } END { print count + 0 }' "$LIST_FILE")"
UNIQUE="$(awk 'END { print NR + 0 }' "$UNIQUE_LIST")"

if [[ "$UNIQUE" -eq 0 ]]; then
  echo "Lista sem URLs válidas." >&2
  exit 1
fi

URLS="$(paste -sd, "$UNIQUE_LIST")"
echo "Lista: $TOTAL entradas -> $UNIQUE URLs únicas"
echo "Saída: $OUTPUT_DIR"

exec python3 "$SCRIPT_DIR/amaweb.py" "$URLS" --output-dir "$OUTPUT_DIR" "$@"
