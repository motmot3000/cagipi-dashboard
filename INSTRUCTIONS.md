# Cagibi Dashboard — Plan du projet

Tableau de bord central ("poste de pilotage") regroupant mails, agenda, agents et outils.

## Fichiers

- `cagibi-dashboard.html` — le tableau de bord (version sauvegardée, figée).
- Version **live** (mise à jour avec les données réelles) : artifact `cagibi-dashboard` dans le panneau latéral de Cowork.

> La copie HTML dans ce dossier est statique. Seul l'artifact se rafraîchit avec les données des connecteurs.

## Contenu actuel du dashboard

| Section | État | Source |
|---|---|---|
| Boîte mail — onglet **Perso** | ✅ live | Gmail (thomas.walter.wunsche@gmail.com) |
| Boîte mail — onglet **Pro** | ⏳ en attente | info@lecagibi.ch — nécessite connexion Outlook |
| **Agenda** | ✅ live | Google Agenda |
| **Mes agents** | ✅ statique | Claude (terminal) · Mr. Hermes-Lecagibot |
| **Tâches planifiées** | ✅ live (vide) | Scheduled tasks |
| **Cagipi** (apps centrales) | ✅ lien | http://cagipi.local/ (réseau local) |
| **Outils connectés** | ✅ statique | Gmail, Agenda, Firecrawl, Figma, Canva |

## Agents

- **Claude (terminal)** — travail & développement (CLI).
- **Mr. Hermes-Lecagibot** — tâches administratives (bot).

## Contraintes techniques

- L'artifact tourne dans un environnement **sandboxé** : accès réseau bloqué sauf quelques CDN.
  → Impossible d'incruster `cagipi.local` ou de lire une boîte non connectée depuis la page.
- Les liens (Cagipi, mails) s'ouvrent dans le **vrai navigateur**, hors sandbox.
- La boîte pro `info@lecagibi.ch` sera lisible une fois le connecteur **Microsoft 365 / Outlook** branché.

## Prochaines étapes possibles

1. Connecter **Microsoft 365 (Outlook)** → activer l'onglet Pro en direct.
2. Ajouter des **tuiles d'accès direct** aux apps de Cagipi (fournir nom + URL de chaque app).
3. Créer des **tâches planifiées** confiées aux agents
   (ex. Hermes : résumé des mails admin chaque matin ; veille web quotidienne via Firecrawl).
4. Ajouter des **boutons de lancement** sur les agents (commande terminal / URL de déclenchement de Hermes).

## Connecteurs disponibles

- Connectés : Gmail, Google Agenda, Firecrawl, Figma, Canva.
- À connecter : Microsoft 365 / Outlook (pour la boîte pro).
