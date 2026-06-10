# Cagibi Dashboard — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la landing http://cagipi.local/ par un dashboard {CagiPi} complet : mails, agenda, notes Trilium, digest IA, cartes outils — généré par cron `claude -p` sur cagipi, servi statique par nginx.

**Architecture:** Frontend vanilla (index.html + style.css + app.js) qui rend `data.json` ; générateur shell sur cagipi (`generate.sh` → `claude -p` + curl Trilium ETAPI → écriture atomique) ; déploiement rsync depuis le PC ; cron 07:00 (digest complet) + */30 06–23 h (refresh).

**Tech Stack:** HTML/CSS/JS vanilla (zéro framework), bash, jq, claude CLI 2.1.170 (headless), nginx existant (config inchangée), cron.

**Spec:** `docs/superpowers/specs/2026-06-10-cagibi-dashboard-design.md`

---

## Structure de fichiers

```
Cagibi Dashboard/                    (dépôt local, source de vérité)
├── site/
│   ├── index.html                   page unique, sections sémantiques
│   ├── style.css                    identité {CagiPi}, mobile-first, breakpoints 880/1280
│   ├── app.js                       fetch data.json, rendu, horloge, badge fraîcheur, refresh 60s
│   └── data.sample.json             données de dev (schéma de référence)
├── generator/
│   ├── generate.sh                  orchestrateur (flock, trilium curl, claude -p, jq validate, mv atomique)
│   ├── prompt-full.md               prompt digest complet (07:00)
│   └── prompt-refresh.md            prompt refresh sans digest (*/30)
├── deploy.sh                        backup ancien site dans son .git + rsync site/ + generator/
└── kiosk/cagibi-kiosk.service       service systemd user Chromium kiosk (préparé, activé au branchement écran)
```

Sur cagipi : `generator/` → `~/cagibi-dashboard/`, `site/` → `/var/www/landing-page/`, logs → `~/cagibi-dashboard/logs/`.

---

### Task 1: De-risk — vérifier accès sources depuis claude headless sur cagipi

**Files:** aucun (smoke tests ssh)

- [x] **Step 1 : Gmail + Agenda via connecteurs claude.ai** — ✅ 2026-06-10. Headless OK avec `--allowedTools "mcp__claude_ai_Gmail__*" "mcp__claude_ai_Google_Calendar__*"`. ⚠️ `mcp__*` global REFUSÉ par claude 2.1.170 (« An allow pattern must name the scope it widens ») → generate.sh doit scoper par serveur.

Run: `ssh cagipi.local '~/.local/bin/claude -p "Liste mes 2 derniers mails non lus (expéditeur+objet) et mon prochain événement agenda. Si tu n'as pas accès, dis ACCES-MANQUANT:<quoi>"'`
Attendu : données réelles. Si `ACCES-MANQUANT` → vérifier `claude mcp list` sur cagipi, brancher connecteurs, STOP et informer Thomas.

- [x] **Step 2 : Trilium ETAPI local** — ✅ 2026-06-10. Token copié, ETAPI répond sur `127.0.0.1:8080/etapi` (titres réels).

Copier le token : `scp ~/.trilium-token cagipi.local:~/.trilium-token && ssh cagipi.local 'chmod 600 ~/.trilium-token'`
Run: `ssh cagipi.local 'curl -s -H "Authorization: $(cat ~/.trilium-token)" "http://127.0.0.1:8080/etapi/notes?search=*&orderBy=dateModified&orderDirection=desc&limit=3"' | jq ".results[].title"`
Attendu : 3 titres de notes. (Adapter chemin `/etapi` si Trilium derrière préfixe.)

- [x] **Step 3 : M365 (mails pro)** — ✅ 2026-06-10. `claude mcp list` sur cagipi : « claude.ai Microsoft 365 … Needs authentication » → `status: partial`, on continue sans bloquer.

### Task 2: Schéma de données + maquette data.sample.json

**Files:** Create: `site/data.sample.json`

- [x] **Step 1 : écrire data.sample.json** — schéma exact du spec, peuplé de données plausibles (3 mails perso dont 1 important, 2 mails pro, 3 événements, 3 notes, digest markdown 4-5 lignes, `status: "ok"`, `generated_at` récent). C'est le contrat frontend↔générateur.
- [x] **Step 2 : valider** `jq . site/data.sample.json` → parse OK. Commit.

### Task 3: index.html — structure

**Files:** Create: `site/index.html`

- [ ] **Step 1 : écrire le HTML** — `<main class="container">` avec, dans l'ordre : `<header>` (ASCII {CagiPi} compact via `<pre class="ascii">`, horloge `#clock`, date `#date`, badge `#freshness`) ; `<section id="kpis">` (4 tuiles) ; `<section id="digest">` ; `<section id="mail-perso">` ; `<section id="mail-pro">` ; `<section id="agenda">` ; `<section id="trilium">` ; `<section id="tools">` (cartes : Greenlight `/greenlight`, Trilium `/trilium`, Drive `/drive`, Uptime Kuma `http://cagipi:3001`) ; `<footer>`. Conteneurs de listes vides remplis par JS ; états vides/erreur en HTML (`.empty`, masqués par défaut). Fonte JetBrains Mono (Google Fonts comme l'actuel). `lang="fr"`.
- [ ] **Step 2 : vérifier** — servir localement `python3 -m http.server 5500 -d site`, ouvrir http://localhost:5500 : structure visible sans CSS. Commit.

### Task 4: style.css — identité {CagiPi}, mobile-first

**Files:** Create: `site/style.css`

- [ ] **Step 1 : base portrait (défaut, ~480px)** — variables reprises de l'existant (`--bg:#1b1d1f; --panel:#2a2d30; --neon:#00ff9c; --neon-soft; --text:#d0d0d0; --muted:#9aa0a6`), radial-gradient fond, colonne unique, espacement système 8px (16 intra-groupe / 32 inter-groupes), ASCII `font-size: clamp(7px,2.2vw,18px)`, KPIs grid 2×2, cartes panel + hover néon (copie de l'effet existant), listes mails/agenda compactes (13-14px, line-height 1.5), badge fraîcheur (`.fresh` néon / `.stale` rouge `#ff5555`), pas de scroll horizontal (`overflow-x:hidden`, `min-width:0` sur items).
- [ ] **Step 2 : breakpoints** — `@media (min-width:880px)` : grille 2 colonnes (`grid-template-columns: 1.2fr 1fr`), max-width 1000px ; `@media (min-width:1280px)` : 3 colonnes, max-width 1280px, KPIs 4×1, sections compactes pour tout-visible-sans-scroll.
- [ ] **Step 3 : vérifier aux 3 largeurs** (480×800, 1024×768, 1920×1080) via navigateur/playwright screenshots. Squint test : hiérarchie néon = titres/valeurs seulement. Commit.

### Task 5: app.js — rendu + horloge + refresh

**Files:** Create: `site/app.js`

- [ ] **Step 1 : écrire app.js** — fonctions pures : `renderKpis`, `renderMail(list, elId)`, `renderAgenda`, `renderTrilium`, `renderDigest` (markdown minimal : titres `##`, gras, listes `-` → HTML ; pas de lib) ; `loadData()` = `fetch('data.json', {cache:'no-store'})` avec fallback `data.sample.json` si 404 (dev) ; `updateFreshness(generated_at)` = "il y a X min", classe `.stale` si > 2 h ; horloge `setInterval` 1 s ; data refresh `setInterval` 60 s ; échappement HTML systématique des champs (`textContent` / helper `esc()`) — les snippets mails sont du contenu non fiable.
- [ ] **Step 2 : vérifier sur data.sample.json** — http://localhost:5500 : toutes sections peuplées, horloge vivante, badge OK ; modifier `generated_at` à -3 h → badge rouge. Tester un sujet de mail contenant `<script>` → affiché en texte. Commit.

### Task 6: Générateur — prompts + generate.sh

**Files:** Create: `generator/generate.sh`, `generator/prompt-full.md`, `generator/prompt-refresh.md`

- [ ] **Step 1 : prompt-full.md** — instructions : lire mails non lus Gmail perso (filtre low-noise : admin/officiel/action requise ; ignorer promos/newsletters/notifs sociales), mails pro M365 si dispo sinon omettre, agenda du jour + 7 jours, lire `~/cagibi-dashboard/trilium_raw.json` (fourni par le script), rédiger `digest_md` (résumé matinal FR, 5-8 lignes, priorités), répondre UNIQUEMENT avec le JSON conforme au schéma (schéma data.sample.json inclus dans le prompt), `status` = `ok`/`partial`. Liens : Gmail `https://mail.google.com/mail/u/0/#search/...`, Outlook `https://outlook.office.com/mail/`, Trilium `/trilium/#root/<noteId>`.
- [ ] **Step 2 : prompt-refresh.md** — idem sans digest : champ `digest_md` = chaîne vide (le script réinjecte l'ancien).
- [ ] **Step 3 : generate.sh** :

```bash
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
# NB: wildcard global "mcp__*" refusé par claude 2.1.170 — scoper par serveur obligatoire.
# extraire le JSON (claude peut entourer de ```)
sed -n '/^{/,$p' "$TMP.raw" | sed 's/^```.*//' > "$TMP"
jq -e '.generated_at and .kpis and (.mail_perso|type=="array")' "$TMP" >/dev/null

if [ "$MODE" = refresh ] && [ -f "$OUT" ]; then
  jq --slurpfile old "$OUT" '.digest_md = ($old[0].digest_md // "")' "$TMP" > "$TMP.2" && mv "$TMP.2" "$TMP"
fi
mv "$TMP" "$OUT"; echo "OK $(date -Is)"
find "$DIR/logs" -name '*.log' -mtime +14 -delete
```

- [ ] **Step 4 : shellcheck local** `shellcheck generator/generate.sh` → 0 erreur. Commit.

### Task 7: deploy.sh

**Files:** Create: `deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
H=cagipi.local
# backup ancien site dans SON dépôt git (une fois ; commit no-op ensuite)
ssh $H 'cd /var/www/landing-page && git -c user.name=deploy -c user.email=deploy@cagipi add -A && git -c user.name=deploy -c user.email=deploy@cagipi commit -m "backup avant dashboard" || true'
rsync -av site/index.html site/style.css site/app.js $H:/var/www/landing-page/
rsync -av generator/ $H:~/cagibi-dashboard/
ssh $H 'chmod +x ~/cagibi-dashboard/generate.sh'
echo "Déployé → http://cagipi.local/"
```

- [ ] **Step 1 : écrire + exécuter** `./deploy.sh`. Attendu : backup commité, fichiers copiés, `greenlight/` et `favicon.ico` intacts (`ssh cagipi.local 'ls /var/www/landing-page'`). Commit.

### Task 8: Première génération réelle + vérif bout-en-bout

- [ ] **Step 1 :** `ssh cagipi.local '~/cagibi-dashboard/generate.sh full'` puis `ssh cagipi.local 'jq .status /var/www/landing-page/data.json'` → `"ok"` ou `"partial"`. Si échec : lire `~/cagibi-dashboard/logs/$(date +%F).log`, corriger (boucle).
- [ ] **Step 2 :** ouvrir http://cagipi.local/ depuis le PC — vraies données visibles, proxys /trilium /drive /greenlight toujours fonctionnels. Screenshots 480 px + 1920 px. Commit fixes éventuels.

### Task 9: Cron

- [ ] **Step 1 :** installer :

```bash
ssh cagipi.local 'crontab -l 2>/dev/null | grep -v cagibi-dashboard > /tmp/ct || true
echo "0 7 * * *    $HOME/cagibi-dashboard/generate.sh full"    >> /tmp/ct
echo "*/30 6-23 * * * $HOME/cagibi-dashboard/generate.sh refresh" >> /tmp/ct
crontab /tmp/ct && crontab -l'
```

(flock dans generate.sh gère le chevauchement 07:00/07:00.)
- [ ] **Step 2 :** attendre/forcer un tick (`generate.sh refresh` manuel), vérifier `generated_at` avance et badge fraîcheur passe au vert sur la page. Commit.

### Task 10: Kiosk (préparé, activation au branchement écran)

**Files:** Create: `kiosk/cagibi-kiosk.service`

- [ ] **Step 1 :** unit systemd user : `chromium-browser --kiosk --noerrdialogs --disable-session-crashed-bubble http://localhost/` + `Restart=always`, cible graphique Wayland (labwc). Copier sur cagipi, NE PAS enable (écran pas branché ; rotation portrait à régler au branchement, cf. `wlr-randr --transform`).
- [ ] **Step 2 :** documenter activation dans INSTRUCTIONS.md (2 commandes). Commit final + mise à jour INSTRUCTIONS.md (remplacer contenu obsolète artifact Cowork par l'archi réelle).

---

## Self-review

- Couverture spec : identité visuelle (T4), 3 layouts (T4), sections (T3), data.json (T2), génération+low-noise (T6), erreurs/atomicité/stale badge (T5/T6), cron+rotation logs (T6/T9), préservation greenlight/favicon/.git (T7), kiosk (T10), M365 partial (T1/T6). ✓
- Échappement HTML des données mails = couvert T5 (sécurité injection).
- Types cohérents : schéma défini une fois (T2), réutilisé dans prompts (T6) et rendu (T5). ✓
