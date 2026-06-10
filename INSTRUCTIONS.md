# Cagibi Dashboard — http://cagipi.local/

Poste de pilotage {CagiPi} : mails, agenda, notes Trilium, digest IA, cartes outils.
Remplace l'ancienne landing (sauvegardée dans le `.git` de `/var/www/landing-page`, commit `223477b`).

## Architecture

```
PC (ce dépôt = source de vérité)
 └─ ./deploy.sh ──rsync──► cagipi
      ├─ site/ (index.html, style.css, app.js) → /var/www/landing-page/
      └─ generator/ → ~/cagibi-dashboard/

cagipi (cron, user motmot3000)
 ├─ 07:00        generate.sh full     (digest IA du matin)
 └─ */30 6-23 h  generate.sh refresh  (données, digest réinjecté)
      └─ claude -p headless (connecteurs Gmail + Agenda + M365)
         + curl Trilium ETAPI → écrit data.json (atomique tmp+mv)

nginx (config inchangée) → sert la page + data.json, proxys /trilium /drive /greenlight
```

Frontend : vanilla HTML/CSS/JS, fetch `data.json` toutes les 60 s, horloge 1 s,
badge fraîcheur (rouge si données > 2 h). Contrat de données : `site/data.sample.json`.

## État des sources

| Source | État |
|---|---|
| Gmail perso | ✅ live (filtre low-noise) |
| Google Agenda | ✅ live (aujourd'hui + 7 j) |
| Trilium | ✅ live (ETAPI local, notes < 3 mois) |
| Mails pro info@lecagibi.ch | ⏳ `status: partial` — brancher connecteur Microsoft 365 sur claude.ai puis `claude` sur cagipi |
| Digest IA | ✅ généré à 07:00 |

## Opérations courantes

- **Déployer une modif** : `./deploy.sh`
- **Forcer une génération** : `ssh cagipi.local '~/cagibi-dashboard/generate.sh full'` (ou `refresh`)
- **Logs** : `ssh cagipi.local 'tail ~/cagibi-dashboard/logs/$(date +%F).log'` (rotation 14 j)
- **Données courantes** : `ssh cagipi.local 'jq .status /var/www/landing-page/data.json'`

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
- Recherche Trilium : `note.dateModified >= MONTH-3` (`search=*` ne renvoie qu'une note).
- Token Trilium : `~/.trilium-token` sur cagipi (chmod 600).
- Spec : `docs/superpowers/specs/2026-06-10-cagibi-dashboard-design.md` ·
  Plan : `docs/superpowers/plans/2026-06-10-cagibi-dashboard.md`
- Carte Drive Syncthing retirée (le proxy `/drive` répondait 502, backend down) → remplacée par NAS `smb://cagipi.local/nas/`. NB : Chromium n'ouvre pas `smb://` ; le lien sert d'adresse à copier (les gestionnaires de fichiers Linux/macOS l'ouvrent).
- Section Agents : Monsieur Hermes Lecagibot → https://web.telegram.org/a/#8812981866
