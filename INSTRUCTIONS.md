# Cagibi Dashboard — http://cagipi.local/

Poste de pilotage {CagiPi} : mails, agenda, notes Trilium, digest IA, cartes outils.
Remplace l'ancienne landing (sauvegardée dans le `.git` de `/var/www/landing-page`, commit `223477b`).

## Architecture

```
PC (ce dépôt = source de vérité)  ──push──► GitHub git@github.com:motmot3000/cagipi-dashboard.git (privé)
 └─ ./deploy.sh ──rsync──► cagipi
      ├─ site/ (index.html, style.css, app.js) → /var/www/landing-page/
      └─ generator/ → ~/cagibi-dashboard/

cagibot (Pi Hermes, 24/7) ──ssh via Tailscale──► cagipi (gestion complète du dashboard)
 ├─ clone ~/cagipi-dashboard (clé ~/.ssh/id_ed25519_github)
 └─ deploy : cd ~/cagipi-dashboard && git pull && CAGIPI_HOST=cagipi ./deploy.sh
      (clé ~/.ssh/id_ed25519_cagipi → authorized_keys cagipi ; Host cagipi = 100.107.29.65 Tailscale)

cagipi (cron, user motmot3000)
 ├─ 07:00        generate.sh full     (digest IA du matin)
 └─ */30 6-23 h  generate.sh refresh  (données, digest réinjecté)
      └─ claude -p headless (connecteurs Gmail + Agenda) + himalaya IMAP Infomaniak
         + curl Trilium ETAPI → écrit data.json (atomique tmp+mv)

nginx → sert la page + data.json, proxys /trilium /drive /greenlight
 └─ /todos → 127.0.0.1:8765 (todo-server.py, unit user cagibi-todo.service)
      └─ GET/PUT liste JSON → ~/cagibi-dashboard/todos.json (jamais touché par generate.sh)
```

Frontend : vanilla HTML/CSS/JS, fetch `data.json` toutes les 60 s, horloge 1 s,
badge fraîcheur (rouge si données > 2 h). Contrat de données : `site/data.sample.json`.
Carte « À faire » (remplace les tuiles KPI) : ajout/coche/suppression, stockage serveur
via `/todos` (sync tous appareils, resynchro 60 s). Le champ `kpis` de data.json est
toujours généré mais plus affiché.

## État des sources

| Source | État |
|---|---|
| Gmail perso | ✅ live — 5 derniers `category:primary` (lus ou non, filtre low-noise), badge si non-lu |
| Google Agenda | ✅ live (aujourd'hui + 7 j) |
| Trilium | ✅ live (ETAPI local, notes < 3 mois) |
| Mails pro info@lecagibi.ch | ✅ live — Himalaya IMAP Infomaniak, 5 derniers (Hermes marque tout `Seen`) |
| Digest IA | ✅ live — mis à jour à chaque refresh 30 min, plus génération complète le matin |

## Opérations courantes

- **Déployer une modif** : `./deploy.sh`  (depuis cagibot : `CAGIPI_HOST=cagipi ./deploy.sh`)
- **Forcer une génération** : `ssh cagipi.local '~/cagibi-dashboard/generate.sh refresh'` (ou `full` pour une génération complète)
- **Logs** : `ssh cagipi.local 'tail ~/cagibi-dashboard/logs/$(date +%F).log'` (rotation 14 j)
- **Données courantes** : `ssh cagipi.local 'jq .status /var/www/landing-page/data.json'`
- **Piloter le cron (timers systemd user)** : `ssh cagipi 'systemctl --user list-timers cagibi-*'`,
  `start`/`stop`/`restart cagibi-full.timer cagibi-refresh.timer`

## Accès cagibot (Pi Hermes)

cagibot gère le dashboard via SSH Tailscale (`Host cagipi` → `100.107.29.65`). Secrets jamais
dans git/kDrive : clés privées restent sur cagibot (`~/.ssh/id_ed25519_cagipi` pour cagipi,
`id_ed25519_github` pour le repo), chmod 600. `.gitignore` exclut `.env`, `id_ed25519*`, `*.key`, tokens.

## Activer le kiosk (au branchement de l'écran portrait)

Unit déjà copié dans `~/.config/systemd/user/cagibi-kiosk.service` sur cagipi (désactivé).

```bash
ssh cagipi.local 'wlr-randr --output HDMI-A-1 --transform 90'   # rotation portrait (adapter la sortie)
ssh cagipi.local 'systemctl --user enable --now cagibi-kiosk.service'
```

(Si session Wayland labwc pas encore ouverte au boot : activer l'autologin + `loginctl enable-linger motmot3000`.)

## Notes techniques

- `--allowedTools "mcp__*"` refusé par claude CLI 2.1.170 → scoper par serveur
  (`mcp__claude_ai_Gmail__*`, etc.) — déjà fait dans `generate.sh`.
- `generated_at` est posé par `generate.sh` (le modèle se trompe d'heure).
- Le mode `refresh` met aussi à jour `digest_md` : ne pas réinjecter l'ancien digest, sinon la carte agenda peut sembler obsolète même quand `agenda` est à jour.
- Recherche Trilium : `note.dateModified >= MONTH-3` (`search=*` ne renvoie qu'une note).
- Token Trilium : `~/.trilium-token` sur cagipi (chmod 600).
- Spec : `docs/superpowers/specs/2026-06-10-cagibi-dashboard-design.md` ·
  Plan : `docs/superpowers/plans/2026-06-10-cagibi-dashboard.md`
- Carte Drive Syncthing retirée (le proxy `/drive` répondait 502, backend down) → remplacée par NAS `smb://cagipi.local/nas/`. NB : Chromium n'ouvre pas `smb://` ; le lien sert d'adresse à copier (les gestionnaires de fichiers Linux/macOS l'ouvrent).
- Section Agents : Monsieur Hermes Lecagibot → https://web.telegram.org/a/#8812981866
