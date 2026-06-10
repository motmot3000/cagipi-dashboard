# Cagibi Dashboard — Spec v1

Date : 2026-06-10 · Statut : validé en brainstorming, en attente relecture Thomas

## Objectif

Refonte de **http://cagipi.local/** (landing {CagiPi} actuelle) en poste de pilotage complet : la page d'accueil du serveur devient LE dashboard. Cagipi servait déjà de tableau de bord des outils — on garde cette adresse comme élément central, on connecte les données (mails, agenda, notes) et on ajoute la couche IA (digest). Consultation passive uniquement — pas de chat intégré (hors scope v1).

## Identité visuelle

Conserver l'identité {CagiPi} existante : fond sombre `#1b1d1f`, néon vert `#00ff9c` (glow), JetBrains Mono, cartes panel `#2a2d30` avec hover néon. Header ASCII art conservé (version compacte sur écran portrait). Le style indigo du prototype `cagibi-dashboard.html` est abandonné ; sa structure de sections (mails, agenda, KPIs) est reprise et réhabillée.

## Affichage — 3 contextes, 1 seule page

| Contexte | Largeur | Layout |
|---|---|---|
| Écran Pi portrait (8,5×15 cm, branché sur cagipi, kiosk) | ~480–720 px | Colonne unique : header ASCII compact + horloge → KPIs 2×2 → digest IA → mails perso → mails pro → agenda → notes Trilium → outils. Pas de scroll horizontal. Texte/targets lisibles à bout de bras. |
| PC classique | ≥ 880 px | Grille 2 colonnes. |
| Grand écran PC | ≥ 1280 px | Grille 3 colonnes, densité plus forte, tout visible sans scroll si possible. |

Sections de la page :
1. **Header** — ASCII {CagiPi} + horloge/date + badge fraîcheur données.
2. **KPIs** — mails non lus, mails pro, événements du jour, notes récentes.
3. **Digest IA** — résumé matinal généré par Claude.
4. **Mails perso / Mails pro / Agenda / Notes Trilium** — listes live depuis `data.json`.
5. **Outils** — cartes existantes conservées : Greenlight, Trilium, Drive (Syncthing), Uptime Kuma. Extensible (apps Hermes v1.1, tuiles supplémentaires).

- CSS media queries, mobile-first (portrait = base).
- Auto-refresh JS : refetch `data.json` toutes les 60 s sans recharger la page ; horloge mise à jour chaque seconde.
- Kiosk : Chromium plein écran lancé au boot de cagipi (service systemd ou autostart labwc/wayfire), pointé sur `http://localhost/`. Rotation portrait configurée côté OS.
- Résolution exacte de l'écran Pi inconnue (pas encore branché) — design fluide, calage final au branchement.

## Architecture (tout sur cagipi)

```
cron
 ├─ 07:00 : génération complète (digest IA du matin)
 └─ */30 06:00–23:00 : refresh données
      └─ ~/cagibi-dashboard/generate.sh
           └─ claude -p (headless, abonnement Thomas)
                ├─ Gmail perso (connecteur claude.ai)
                ├─ Google Agenda (connecteur claude.ai)
                ├─ Outlook pro info@lecagibi.ch (connecteur M365 — à brancher)
                ├─ Trilium ETAPI → http://127.0.0.1:8080 (local au Pi)
                └─ écrit /var/www/landing-page/data.json (atomique : tmp + mv)
nginx
 └─ config INCHANGÉE : root /var/www/landing-page, proxys /trilium/, /drive/, /greenlight/api/
      → http://cagipi.local/ sur tout le LAN (+ Tailscale)
```

- Frontend : remplace `index.html` + `style.css` dans `/var/www/landing-page/`, ajoute `app.js` + `data.json`.
- **À préserver** dans ce dossier : `greenlight/` (assets servis sous /greenlight), `favicon.ico`, `.git` (dépôt existant, user `loulou26`) — commit de l'ancienne version dans ce `.git` avant remplacement.
- Aucun backend applicatif. Aucun secret côté nginx.
- Déploiement depuis le PC de Thomas via ssh/rsync (clé en place) ; source de vérité = dépôt local `Cagibi Dashboard`.

## Format `data.json`

```json
{
  "generated_at": "ISO-8601",
  "status": "ok | partial | error",
  "digest_md": "résumé matinal markdown",
  "kpis": { "mails_non_lus": 0, "mails_pro": 0, "events_aujourdhui": 0, "notes_recentes": 0 },
  "mail_perso": [ { "from": "", "subject": "", "snippet": "", "when": "", "important": false, "link": "" } ],
  "mail_pro":   [ ...idem ],
  "agenda":     [ { "title": "", "start": "ISO", "end": "ISO", "location": "" } ],
  "trilium":    [ { "title": "", "modified": "ISO", "link": "http://cagipi/trilium/..." } ]
}
```

- Filtrage mails « low-noise » (règle existante Hermes) : admin / officiel / action requise en avant ; promos, newsletters, notifications sociales ignorées.
- Liens mails → Gmail/Outlook web ; liens notes → Trilium via nginx.

## Gestion d'erreurs

- `claude -p` échoue → ancien `data.json` conservé (écriture atomique), `status` inchangé.
- Page affiche âge des données : badge « il y a X min », rouge si > 2 h.
- Source indisponible (ex. M365 pas connecté) → `status: partial`, section affiche « en attente », le reste vit normalement.
- Logs : `~/cagibi-dashboard/logs/` sur cagipi, rotation simple (garder 14 jours).

## Hors scope v1 / extensions prévues

- **v1.1 — tuiles apps Hermes** : Hermes tourne sur un autre Pi (isolé volontairement). Thomas fournira des clés API des apps qu'il gère → tuiles statut sur le dashboard. Section « Outils » du layout prévue extensible dès v1.
- Chat interactif avec agents — non.
- Veille Firecrawl — non (plus tard, simple section digest en plus).

## Étapes manuelles (Thomas)

1. `claude login` sur cagipi (en cours).
2. Connecter Microsoft 365 sur claude.ai → active mails pro.
3. Brancher l'écran portrait sur cagipi → calage kiosk.
4. Plus tard : clés API apps Hermes.
