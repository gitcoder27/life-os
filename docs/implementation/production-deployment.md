# Production Deployment Steps

Use this for updating `https://personal.daycommand.online` after each release.

If a release includes Prisma migration files, production also needs the database migration applied. Use `npx prisma migrate deploy --schema server/prisma/schema.prisma` on the production server. That command only applies checked-in pending migrations, so it is the right production command and is safe to include in the normal deploy flow.

## Checked-in service templates

- Production template: `deploy/systemd/life-os.service`
- Development template: `deploy/systemd/life-os-dev.service`
- Copy the appropriate template into `/etc/systemd/system/` before enabling or restarting the service.

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

# 0) Confirm backend and frontend production cookie names match before building
grep '^CSRF_COOKIE_NAME=' server/.env.production
cat client/.env.production

# 1) Update source
git pull

# 2) Reinstall deps if package-lock changed
npm ci

# 3) Apply pending production database migrations
npx prisma migrate deploy --schema server/prisma/schema.prisma

# 4) Build server/client/contracts
npm run build

# 5) Deploy frontend bundle to nginx doc root
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/

# 6) Restart API service so updated server code is loaded
sudo systemctl restart life-os.service
```

The production client build now reads `client/.env.production` via `vite build --mode production`.
Keep `server/.env.production` `CSRF_COOKIE_NAME` and `client/.env.production` `VITE_CSRF_COOKIE_NAME` set to the same production value before every deploy.

## Safer schema-change deploy order

If the release includes database schema changes, avoid leaving the API running while the migration is changing tables or constraints. Use this order instead:

```bash
cd /home/ubuntu/apps/life-os-prod

grep '^CSRF_COOKIE_NAME=' server/.env.production
cat client/.env.production
git pull
npm ci
sudo systemctl stop life-os.service
npx prisma migrate deploy --schema server/prisma/schema.prisma
npm run build
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
sudo systemctl start life-os.service
```

This is the safer path for releases like the Goals HQ backend change because the app and the database are changing together.

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
cat client/.env.production
npm run build:client
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
```

No service restart needed when only static files changed.

## Backend-only update (no UI change)

If only server logic changed:

```bash
cd /home/ubuntu/apps/life-os-prod
npx prisma migrate deploy --schema server/prisma/schema.prisma
npm run build:server
sudo systemctl restart life-os.service
```

## Notes

- `npm run build` currently runs contracts + server + client build.
- `npx prisma migrate deploy --schema server/prisma/schema.prisma` should be run in production whenever there are pending migrations.
- `npm run build:client` uses `vite build --mode production`, so the shipped bundle reads `client/.env.production`.
- Nginx only proxies `/api/*` to the backend; everything else is static frontend files.
- Keep `server/.env.production` in place as it contains `PORT=3104` and production DB/secret values.
- Keep `client/.env.development` on the dev CSRF cookie and `client/.env.production` on the prod CSRF cookie; do not swap them.
- If `life-os.service` fails with `Failed to load environment files` or `Failed to spawn 'start' task`, verify that `WorkingDirectory` and `EnvironmentFile` point to `/home/ubuntu/apps/life-os-prod/server` and `/home/ubuntu/apps/life-os-prod/server/.env.production`.

## Development service setup

Use this when validating backend changes from the dev checkout without touching production.

1. Copy `server/.env.production.dev.example` to `server/.env.production` and fill in the real secrets for the dev environment.
2. Copy `deploy/systemd/life-os-dev.service` to `/etc/systemd/system/life-os-dev.service`.
3. Build the backend from the dev checkout:

```bash
cd /home/ubuntu/Development/life-os
npm install
npm run build
```

4. Reload systemd and restart the dev service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable life-os-dev.service
sudo systemctl restart life-os-dev.service
```

5. Verify the dev service:

```bash
sudo systemctl status life-os-dev.service --no-pager
curl -fsS http://127.0.0.1:3105/healthz
sudo journalctl -u life-os-dev.service -n 80 --no-pager
```

If you point the local Vite frontend at the dev service backend, override the frontend cookie name to match `server/.env.production` before starting the client:

```bash
cd /home/ubuntu/Development/life-os
VITE_API_PROXY_TARGET=http://127.0.0.1:3105 \
VITE_CSRF_COOKIE_NAME=life_os_csrf_dev_service \
npm run dev:client
```

The default local frontend env (`client/.env.development`) stays on `life_os_csrf_dev`, which is correct for the normal local backend on port `3004`.
