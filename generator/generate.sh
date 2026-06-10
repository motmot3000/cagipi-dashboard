#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-refresh}"                                  # full | refresh
DIR="$HOME/cagibi-dashboard"; OUT="/var/www/landing-page/data.json"
LOG="$DIR/logs/$(date +%F).log"; mkdir -p "$DIR/logs"
exec >>"$LOG" 2>&1; echo "=== $(date -Is) mode=$MODE"
exec 9>"$DIR/.lock"; flock -n 9 || { echo "déjà en cours, skip"; exit 0; }

# Trilium direct (déterministe, sans IA)
curl -sf -H "Authorization: $(cat "$HOME/.trilium-token")" \
  "http://127.0.0.1:8080/etapi/notes?search=*&orderBy=dateModified&orderDirection=desc&limit=5" \
  > "$DIR/trilium_raw.json" || echo '{"results":[]}' > "$DIR/trilium_raw.json"

PROMPT="$DIR/prompt-$MODE.md"
TMP="$DIR/data.tmp.json"
"$HOME/.local/bin/claude" -p "$(cat "$PROMPT")" \
  --allowedTools "Read" "mcp__claude_ai_Gmail__*" "mcp__claude_ai_Google_Calendar__*" "mcp__claude_ai_Microsoft_365__*" \
  --output-format text > "$TMP.raw"
# extraire le JSON (claude peut entourer de ```)
sed -n '/^{/,$p' "$TMP.raw" | sed 's/^```.*//' > "$TMP"
jq -e '.generated_at and .kpis and (.mail_perso|type=="array")' "$TMP" >/dev/null

if [ "$MODE" = refresh ] && [ -f "$OUT" ]; then
  jq --slurpfile old "$OUT" '.digest_md = ($old[0].digest_md // "")' "$TMP" > "$TMP.2" && mv "$TMP.2" "$TMP"
fi
mv "$TMP" "$OUT"; echo "OK $(date -Is)"
find "$DIR/logs" -name '*.log' -mtime +14 -delete
