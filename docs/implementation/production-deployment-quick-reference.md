# Production Deployment Quick Reference

Use this when you need the shortest reliable path to update `https://personal.daycommand.online`.

## Main deploy

Run on the production server:

```bash
cd /home/ubuntu/apps/life-os-prod
git pull
npm ci
npm run build
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
sudo systemctl restart life-os.service
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
npm run build:client
sudo rsync -a --delete client/dist/ /var/www/personal.daycommand.online/
```

Backend only:

```bash
cd /home/ubuntu/apps/life-os-prod
npm run build:server
sudo systemctl restart life-os.service
```

## Important locations

- App checkout: `/home/ubuntu/apps/life-os-prod`
- API service: `/etc/systemd/system/life-os.service`
- Frontend files: `/var/www/personal.daycommand.online`
- Production env file: `/home/ubuntu/apps/life-os-prod/server/.env.production`

## Full runbook

For the complete version with extra notes and dev-service setup, see `docs/implementation/production-deployment.md`.
