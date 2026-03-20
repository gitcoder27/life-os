# Production Deployment Steps

Use this for updating `https://personal.daycommand.online` after each release.

## Current production wiring

- API service: `life-os.service` (`/etc/systemd/system/life-os.service`)
  - Starts `npm run start` in `/home/ubuntu/apps/life-os-prod/server`
  - Listens on `127.0.0.1:3104`
- Frontend static files: served by nginx from `/var/www/personal.daycommand.online`
- Nginx config: `/etc/nginx/sites-available/personal.daycommand.online`

## Standard deploy (code + API + frontend)

Run on the server from a privileged shell:

```bash
cd /home/ubuntu/apps/life-os-prod

# 1) Update source
git pull

# 2) Reinstall deps if package-lock changed
npm ci

# 3) Build server/client contracts
npm run build

# 4) Deploy frontend bundle to nginx doc root
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/

# 5) Restart API service so updated server code is loaded
sudo systemctl restart life-os.service
```

## Optional but recommended verification

```bash
systemctl is-active life-os.service
systemctl status life-os.service --no-pager
curl -fsS http://127.0.0.1:3104/healthz
curl -I https://personal.daycommand.online
```

If the API is not healthy, check logs:

```bash
sudo journalctl -u life-os.service -n 80 --no-pager
```

## Frontend-only quick update (only if backend unchanged)

If only client files changed, you can skip `npm ci` and still run:

```bash
cd /home/ubuntu/apps/life-os-prod
npm run build:client
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
```

No service restart needed when only static files changed.

## Backend-only update (no UI change)

If only server logic changed:

```bash
cd /home/ubuntu/apps/life-os-prod
npm run build:server
sudo systemctl restart life-os.service
```

## Notes

- `npm run build` currently runs contracts + server + client build.
- Nginx only proxies `/api/*` to the backend; everything else is static frontend files.
- Keep `server/.env.production` in place as it contains `PORT=3104` and production DB/secret values.

