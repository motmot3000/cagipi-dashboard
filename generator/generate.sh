#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-refresh}"                                  # full | refresh
DIR="$HOME/cagibi-dashboard"; OUT="/var/www/landing-page/data.json"
LOG="$DIR/logs/$(date +%F).log"; mkdir -p "$DIR/logs"
exec >>"$LOG" 2>&1; echo "=== $(date -Is) mode=$MODE"
exec 9>"$DIR/.lock"; flock -n 9 || { echo "déjà en cours, skip"; exit 0; }

# Trilium direct (déterministe, sans IA)
# search=* ne renvoie qu'une note ; note.dateModified >= MONTH-3 = "notes récentes"
curl -sf -H "Authorization: $(cat "$HOME/.trilium-token")" \
  "http://127.0.0.1:8080/etapi/notes?search=note.dateModified%20%3E%3D%20MONTH-3&orderBy=dateModified&orderDirection=desc&limit=5" \
  > "$DIR/trilium_raw.json" || { echo "WARN trilium ETAPI KO (token/service ?)"; echo '{"results":[]}' > "$DIR/trilium_raw.json"; }

# Mails pro via Himalaya (IMAP Infomaniak, déterministe, sans IA)
"$HOME/.local/bin/himalaya" envelope list --account infomaniak --folder INBOX \
  --output json > "$DIR/mailpro_raw.json" 2>/dev/null \
  || { echo "WARN himalaya KO (mot de passe ~/.infomaniak-pass posé ?)"; echo '[]' > "$DIR/mailpro_raw.json"; }

PROMPT="$DIR/prompt-$MODE.md"
TMP="$DIR/data.tmp.json"
"$HOME/.local/bin/claude" -p "$(cat "$PROMPT")" \
  --allowedTools "Read" "mcp__claude_ai_Gmail__*" "mcp__claude_ai_Google_Calendar__*" \
  --output-format text < /dev/null > "$TMP.raw"
# extraire le JSON (claude peut entourer de ```)
sed -n '/^{/,$p' "$TMP.raw" | sed 's/^```.*//' > "$TMP"
jq -e '.generated_at and .kpis and (.mail_perso|type=="array")' "$TMP" >/dev/null
# generated_at posé par le script (le modèle peut se tromper d'heure)
jq --arg now "$(date -Is)" '.generated_at = $now' "$TMP" > "$TMP.ts" && mv "$TMP.ts" "$TMP"

# LEDs outils : checks locaux déterministes, injectés par le script
up_tcp()  { timeout 2 bash -c ">/dev/tcp/127.0.0.1/$1" 2>/dev/null && echo true || echo false; }
up_http() { curl -sf -o /dev/null -m 3 "$1" && echo true || echo false; }
TOOLS=$(printf '{"greenlight":%s,"trilium":%s,"nas":%s,"kuma":%s}' \
  "$(up_http http://127.0.0.1/greenlight)" "$(up_tcp 8080)" "$(up_tcp 445)" "$(up_tcp 3001)")
jq --argjson tools "$TOOLS" '.tools = $tools' "$TMP" > "$TMP.tl" && mv "$TMP.tl" "$TMP"

mv "$TMP" "$OUT"; echo "OK $(date -Is)"
find "$DIR/logs" -name '*.log' -mtime +14 -delete
