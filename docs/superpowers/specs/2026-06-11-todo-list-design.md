# Todo liste — remplace les tuiles KPI (2026-06-11)

## Besoin

Les 4 tuiles « Indicateurs » n'apportaient rien (doublons des cartes mails/agenda/notes).
À la place : une todo liste où l'on peut **ajouter**, **cocher** et **supprimer** des éléments,
visible et modifiable depuis n'importe quel appareil (kiosk inclus).

## Décision de stockage

Serveur (choisi par Thomas) plutôt que localStorage : une tâche ajoutée depuis le PC
doit apparaître sur l'écran kiosk. nginx du cagipi n'a ni module DAV ni PHP → mini-serveur
Python stdlib.

## Architecture

- `todo/todo-server.py` — `ThreadingHTTPServer` sur 127.0.0.1:8765.
  - `GET /todos` → liste JSON `[{id, text, done}]`.
  - `PUT /todos` → remplace la liste entière (last-write-wins), assainissement
    (types forcés, text ≤ 500 car., 200 items max, body ≤ 256 Ko), écriture atomique
    tmp+rename dans `~/cagibi-dashboard/todos.json`.
- `todo/cagibi-todo.service` — unit systemd **user**, `WantedBy=default.target`,
  linger activé pour démarrer au boot.
- nginx : `location /todos { proxy_pass http://127.0.0.1:8765; }` (ajouté à
  `/etc/nginx/sites-enabled/landing-page`).
- Frontend (`site/`) : section `#todo` à la place de `#kpis` (grid-area `todo`),
  formulaire + liste ; coche = texte barré (l'item reste), ✕ = suppression.
  Optimistic update puis PUT ; re-fetch toutes les 60 s pour la synchro inter-appareils.
- `renderKpis` supprimé ; le générateur produit toujours `kpis` dans data.json
  (validation jq inchangée), simplement plus affiché.
- `deploy.sh` : rsync `todo-server.py` + unit, `systemctl --user enable --now + restart`.

## Limites assumées

- Pas d'auth : même modèle de confiance que le reste du dashboard (LAN seulement).
- Conflit d'édition simultanée : last-write-wins, acceptable pour un usage personnel.

## Vérifié le 2026-06-11

GET/PUT roundtrip curl OK ; add/coche/suppression testés au navigateur (Playwright),
état serveur conforme après chaque action, 0 erreur console, layout OK aux 3 breakpoints
implicites (screenshot 1280px).
