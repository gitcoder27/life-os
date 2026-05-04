# Production Deployment Steps

Use this for updating `https://personal.daycommand.online` after each release.

If a release includes Prisma migration files, production also needs the database migration applied. Use `npx prisma migrate deploy --schema server/prisma/schema.prisma` on the production server. That command only applies checked-in pending migrations, so it is the right production command and is safe to include in the normal deploy flow.

## Checked-in service templates

- Production template: `deploy/systemd/life-os.service`
- Development template: `deploy/systemd/life-os-dev.service`
- Nginx site template: `deploy/nginx/personal.daycommand.online.conf`
- Worker service template: `deploy/systemd/life-os-worker@.service`
- Worker timers:
  - `deploy/systemd/life-os-worker-every-15-minutes.timer`
  - `deploy/systemd/life-os-worker-daily.timer`
  - `deploy/systemd/life-os-worker-weekly.timer`
- Backup templates:
  - `deploy/systemd/life-os-postgres-backup.service`
  - `deploy/systemd/life-os-postgres-backup.timer`
- Copy the appropriate template into `/etc/systemd/system/` before enabling or restarting the service.

## Current production wiring

- API service: `life-os.service` (`/etc/systemd/system/life-os.service`)
  - Starts `npm run start` in `/home/ubuntu/apps/life-os-prod/server`
  - Listens on `127.0.0.1:3104`
- Worker timers:
  - `life-os-worker-every-15-minutes.timer` runs reminder and notification evaluator jobs every 15 minutes.
  - `life-os-worker-daily.timer` runs daily maintenance jobs at 02:15.
  - `life-os-worker-weekly.timer` runs weekly cleanup jobs at 03:15 on Sunday.
- Backup timer: `life-os-postgres-backup.timer` runs an encrypted off-server PostgreSQL dump at 02:45.
- Frontend static files: served by nginx from `/var/www/personal.daycommand.online`
- Nginx config: `/etc/nginx/sites-available/personal.daycommand.online`, refreshed from `deploy/nginx/personal.daycommand.online.conf`

## Standard deploy (code + API + frontend)

Run on the server from a privileged shell:

```bash
cd /home/ubuntu/apps/life-os-prod
npm run deploy:prod
```

The deploy script runs the full production flow for you:

- restores `package-lock.json` first when that is the only local change
- fails if the production checkout still has any other local git changes
- runs `git pull --ff-only`
- restarts the deploy script if the pull updated the checkout
- confirms the server and client production CSRF cookie names match
- runs `npm ci`
- runs `npm run build`
- stops `life-os.service`
- runs `npx prisma migrate deploy --schema server/prisma/schema.prisma`
- syncs `client/dist/` into `/var/www/personal.daycommand.online/`
- refreshes the nginx static cache policy and reloads nginx
- starts `life-os.service`
- verifies `http://127.0.0.1:3104/healthz`

If you need the manual fallback, use:

```bash
cd /home/ubuntu/apps/life-os-prod

# 0) Confirm backend and frontend production cookie names match before building
grep '^CSRF_COOKIE_NAME=' server/.env.production
cat client/.env.production

# 1) Update source
git pull

# 2) Reinstall deps if package-lock changed
npm ci

# 3) Build server/client/contracts
npm run build

# 4) Stop the API before applying schema changes
sudo systemctl stop life-os.service

# 5) Apply pending production database migrations
npx prisma migrate deploy --schema server/prisma/schema.prisma

# 6) Deploy frontend bundle to nginx doc root
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/

# 7) Refresh nginx cache policy
sudo install -m 644 deploy/nginx/personal.daycommand.online.conf /etc/nginx/sites-available/personal.daycommand.online
sudo ln -sfn /etc/nginx/sites-available/personal.daycommand.online /etc/nginx/sites-enabled/personal.daycommand.online
sudo nginx -t
sudo systemctl reload nginx

# 8) Start the API service
sudo systemctl start life-os.service
```

The production client build now reads `client/.env.production` via `vite build --mode production`.
Keep `server/.env.production` `CSRF_COOKIE_NAME` and `client/.env.production` `VITE_CSRF_COOKIE_NAME` set to the same production value before every deploy.
If `npm install` or another command rewrites only `package-lock.json` on the server, `npm run deploy:prod` now resets that file back to `HEAD` automatically before pulling.

## Optional but recommended verification

```bash
systemctl is-active life-os.service
systemctl list-timers 'life-os-worker*' 'life-os-postgres-backup*' --no-pager
systemctl status life-os.service --no-pager
curl -fsS http://127.0.0.1:3104/healthz
curl -I https://personal.daycommand.online
curl -I https://personal.daycommand.online/release.json
```

If the API is not healthy, check logs:

```bash
sudo journalctl -u life-os.service -n 80 --no-pager
sudo journalctl -u 'life-os-worker@every-15-minutes.service' -n 80 --no-pager
sudo journalctl -u life-os-postgres-backup.service -n 80 --no-pager
```

## Worker timers

The worker entrypoint is one-shot by design. Production scheduling is owned by systemd timers, and each timer passes a schedule filter into `npm run worker`:

- `life-os-worker@every-15-minutes.service`: runs only jobs registered with `schedule: "every-15-minutes"`.
- `life-os-worker@daily.service`: runs only jobs registered with `schedule: "daily"`.
- `life-os-worker@weekly.service`: runs only jobs registered with `schedule: "weekly"`.

Install or refresh the production worker timers:

```bash
cd /home/ubuntu/apps/life-os-prod
sudo cp deploy/systemd/life-os-worker@.service /etc/systemd/system/life-os-worker@.service
sudo cp deploy/systemd/life-os-worker-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now life-os-worker-every-15-minutes.timer
sudo systemctl enable --now life-os-worker-daily.timer
sudo systemctl enable --now life-os-worker-weekly.timer
systemctl list-timers 'life-os-worker*' --no-pager
```

To run a schedule manually:

```bash
cd /home/ubuntu/apps/life-os-prod/server
NODE_ENV=production npm run worker -- --schedule every-15-minutes
NODE_ENV=production npm run worker -- --schedule daily
NODE_ENV=production npm run worker -- --schedule weekly
```

To backfill missed daily score history without running every daily maintenance job:

```bash
cd /home/ubuntu/apps/life-os-prod/server
NODE_ENV=production npm run scores:finalize
```

## Backups

Production backups require `pg_dump`, `rclone`, an encrypted rclone remote, and `/etc/life-os/backup.env` with `RCLONE_REMOTE` set. The backup script fails if `RCLONE_REMOTE` is missing so production does not silently fall back to local-only backups.

Install or refresh the backup timer:

```bash
sudo install -d -m 700 /etc/life-os
sudo install -d -m 700 -o ubuntu -g ubuntu /var/backups/life-os/postgres
sudo editor /etc/life-os/backup.env
# Required line:
# RCLONE_REMOTE=life-os-crypt:postgres

cd /home/ubuntu/apps/life-os-prod
sudo cp deploy/systemd/life-os-postgres-backup.service /etc/systemd/system/life-os-postgres-backup.service
sudo cp deploy/systemd/life-os-postgres-backup.timer /etc/systemd/system/life-os-postgres-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now life-os-postgres-backup.timer
sudo systemctl start life-os-postgres-backup.service
systemctl list-timers 'life-os-postgres-backup*' --no-pager
sudo journalctl -u life-os-postgres-backup.service -n 80 --no-pager
```

Monthly restore test:

```bash
createdb life_os_restore_test
pg_restore --dbname life_os_restore_test --clean --if-exists /var/backups/life-os/postgres/<backup-file>.dump
dropdb life_os_restore_test
```

## Frontend-only quick update (only if backend unchanged)

If only client files changed, you can skip `npm ci` and still run:

```bash
cd /home/ubuntu/apps/life-os-prod
cat client/.env.production
npm run build:client
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
sudo install -m 644 deploy/nginx/personal.daycommand.online.conf /etc/nginx/sites-available/personal.daycommand.online
sudo ln -sfn /etc/nginx/sites-available/personal.daycommand.online /etc/nginx/sites-enabled/personal.daycommand.online
sudo nginx -t
sudo systemctl reload nginx
```

No service restart needed when only static files changed.

## Backend-only update (no UI change)

If only server logic changed:

```bash
cd /home/ubuntu/apps/life-os-prod
sudo systemctl stop life-os.service
npx prisma migrate deploy --schema server/prisma/schema.prisma
npm run build:server
sudo systemctl start life-os.service
```

## Notes

- `npm run build` currently runs contracts + server + client build.
- `npx prisma migrate deploy --schema server/prisma/schema.prisma` should be run in production whenever there are pending migrations.
- `npm run build:client` uses `vite build --mode production`, so the shipped bundle reads `client/.env.production`.
- `index.html`, route fallbacks, and `release.json` are served with `Cache-Control: no-store`; `/assets/*` files are served as immutable because Vite fingerprints their filenames.
- The client checks `release.json` on load, focus, reconnect, and every minute in production, then reloads once when a newer deployed bundle is available.
- Nginx only proxies `/api/*` to the backend; everything else is static frontend files.
- Keep `server/.env.production` in place as it contains `PORT=3104` and production DB/secret values.
- Keep `/etc/life-os/backup.env` outside git. It contains the encrypted off-server backup destination.
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
