#!/usr/bin/env bash
set -euo pipefail
# Hôte cagipi : cagipi.local en LAN (PC) ; override CAGIPI_HOST=cagipi sur cagibot (Tailscale).
H="${CAGIPI_HOST:-cagipi.local}"
# backup ancien site dans SON dépôt git (une fois ; commit no-op ensuite)
ssh $H 'cd /var/www/landing-page && git -c user.name=deploy -c user.email=deploy@cagipi add -A && git -c user.name=deploy -c user.email=deploy@cagipi commit -m "backup avant dashboard" || true'
rsync -av site/index.html site/style.css site/app.js $H:/var/www/landing-page/
rsync -av generator/ todo/todo-server.py $H:~/cagibi-dashboard/
ssh $H 'chmod +x ~/cagibi-dashboard/generate.sh'
# serveur todos (unit user — nécessite linger pour démarrer au boot)
rsync -av todo/cagibi-todo.service $H:~/.config/systemd/user/
ssh $H 'systemctl --user daemon-reload && systemctl --user enable --now cagibi-todo.service && systemctl --user restart cagibi-todo.service'
echo "Déployé → http://cagipi.local/"
