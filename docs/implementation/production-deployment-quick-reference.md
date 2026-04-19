# Production Deployment Quick Reference

Use this when you need the shortest reliable path to update `https://personal.daycommand.online`.

## Main deploy

Run on the production server:

```bash
cd /home/ubuntu/apps/life-os-prod
npm run deploy:prod
```

`npm run deploy:prod` fails if the production checkout is not clean, then pulls the latest code, installs dependencies, builds the app, stops the API service, applies pending checked-in Prisma migrations, publishes the frontend files, starts the API service, and checks the health endpoint.
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
sudo systemctl start life-os.service
```

## Quick checks

```bash
systemctl is-active life-os.service
curl -fsS http://127.0.0.1:3104/healthz
curl -I https://personal.daycommand.online
```

## If something is wrong

```bash
sudo journalctl -u life-os.service -n 80 --no-pager
```

## Fast paths

Frontend only:

```bash
cd /home/ubuntu/apps/life-os-prod
cat client/.env.production
npm run build:client
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
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
- Production env file: `/home/ubuntu/apps/life-os-prod/server/.env.production`

## Full runbook

For the complete version with extra notes and dev-service setup, see `docs/implementation/production-deployment.md`.
