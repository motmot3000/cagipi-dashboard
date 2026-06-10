#!/usr/bin/env bash
set -euo pipefail
H=cagipi.local
# backup ancien site dans SON dépôt git (une fois ; commit no-op ensuite)
ssh $H 'cd /var/www/landing-page && git -c user.name=deploy -c user.email=deploy@cagipi add -A && git -c user.name=deploy -c user.email=deploy@cagipi commit -m "backup avant dashboard" || true'
rsync -av site/index.html site/style.css site/app.js $H:/var/www/landing-page/
rsync -av generator/ $H:~/cagibi-dashboard/
ssh $H 'chmod +x ~/cagibi-dashboard/generate.sh'
echo "Déployé → http://cagipi.local/"
