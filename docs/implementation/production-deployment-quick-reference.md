# Production Deployment Quick Reference

Use this when you need the shortest reliable path to update `https://personal.daycommand.online`.

## Main deploy

Run on the production server:

```bash
cd /home/ubuntu/apps/life-os-prod
npm run deploy:prod
```

`npm run deploy:prod` fails if the production checkout is not clean, then pulls the latest code, restarts itself when the checkout changed, installs dependencies, builds the app, stops the API service, applies pending checked-in Prisma migrations, publishes the frontend files, refreshes the nginx static cache policy, starts the API service, and checks the health endpoint.
If the only local change is `package-lock.json`, the deploy script restores it automatically before continuing. Any other local changes still stop the deploy.

`client/.env.production` is now the source of truth for the frontend CSRF cookie name during production builds. It must match `server/.env.production`.
`npx prisma migrate deploy --schema server/prisma/schema.prisma` is included in `npm run deploy:prod` and is safe to run on every deploy because it only applies pending migrations.

Manual fallback:

```bash
cd /home/ubuntu/apps/life-os-prod
git pull
grep '^CSRF_COOKIE_NAME=' server/.env.production
cat client/.env.production
npm ci
npm run build
sudo systemctl stop life-os.service
npx prisma migrate deploy --schema server/prisma/schema.prisma
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
sudo install -m 644 deploy/nginx/personal.daycommand.online.conf /etc/nginx/sites-available/personal.daycommand.online
sudo ln -sfn /etc/nginx/sites-available/personal.daycommand.online /etc/nginx/sites-enabled/personal.daycommand.online
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl start life-os.service
```

## Quick checks

```bash
systemctl is-active life-os.service
systemctl list-timers 'life-os-worker*' 'life-os-postgres-backup*' --no-pager
curl -fsS http://127.0.0.1:3104/healthz
curl -I https://personal.daycommand.online
curl -I https://personal.daycommand.online/release.json
```

## If something is wrong

```bash
sudo journalctl -u life-os.service -n 80 --no-pager
sudo journalctl -u 'life-os-worker@every-15-minutes.service' -n 80 --no-pager
sudo journalctl -u life-os-postgres-backup.service -n 80 --no-pager
```

## Worker and backup timers

Production must have these timers enabled:

```bash
sudo systemctl enable --now life-os-worker-every-15-minutes.timer
sudo systemctl enable --now life-os-worker-daily.timer
sudo systemctl enable --now life-os-worker-weekly.timer
sudo systemctl enable --now life-os-postgres-backup.timer
```

Backfill missed score history after a timer outage:

```bash
cd /home/ubuntu/apps/life-os-prod/server
NODE_ENV=production npm run scores:finalize
```

`/etc/life-os/backup.env` must define `RCLONE_REMOTE` for encrypted off-server backups.

## Fast paths

Frontend only:

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

Backend only:

```bash
cd /home/ubuntu/apps/life-os-prod
sudo systemctl stop life-os.service
npx prisma migrate deploy --schema server/prisma/schema.prisma
npm run build:server
sudo systemctl start life-os.service
```

## Important locations

- App checkout: `/home/ubuntu/apps/life-os-prod`
- API service: `/etc/systemd/system/life-os.service`
- Frontend files: `/var/www/personal.daycommand.online`
- Nginx config: `/etc/nginx/sites-available/personal.daycommand.online`
- Production env file: `/home/ubuntu/apps/life-os-prod/server/.env.production`

## Full runbook

For the complete version with extra notes and dev-service setup, see `docs/implementation/production-deployment.md`.
