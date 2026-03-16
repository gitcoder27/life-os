# Server Workspace

This workspace is owned by the backend implementation agent.

Primary references:

- [`../docs/prd/backend-architecture.md`](../docs/prd/backend-architecture.md)
- [`../docs/prd/data-model.md`](../docs/prd/data-model.md)
- [`../docs/prd/api-contracts.md`](../docs/prd/api-contracts.md)
- [`../docs/prd/backend-workstream.md`](../docs/prd/backend-workstream.md)

## Environment setup

The backend automatically loads one env file:
- `ENV_FILE` if set
- `server/.env.<NODE_ENV>` (or `.env.<NODE_ENV>` from the current working directory)
- falls back to `.env`

For local dev/prod separation:
- Keep `/home/ubuntu/Development/life-os/server/.env` (or `.env.development`) on dev DB, e.g. `life_os_dev`.
- Keep `/home/ubuntu/apps/life-os-prod/life-os/server/.env` on prod DB, e.g. `life_os`.
- Use different session/csrf cookie names to avoid cross-login interference if both environments are tested on same host.
- Set `AUTO_CREATE_DATABASE=true` in local `.env` if you want the app to auto-create a missing `DATABASE_URL` database on boot.
- Set `AUTO_APPLY_MIGRATIONS=true` in local `.env` to auto-run `prisma migrate deploy` on startup after DB creation.

Common bootstrap commands:
- Create databases separately: `createdb life_os_dev` (development) and `createdb life_os` (production).
- Run schema migrations against each environment URL:
  - Development: `npm run prisma:migrate`
  - Production: `npx prisma migrate deploy`
