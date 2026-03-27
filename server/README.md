# Server Workspace

This workspace contains the backend API, worker jobs, and CLI tooling.

Primary references:

- [`../docs/prd/technical-architecture.md`](../docs/prd/technical-architecture.md)
- [`../docs/prd/data-model.md`](../docs/prd/data-model.md)
- [`../docs/prd/api-contracts.md`](../docs/prd/api-contracts.md)
- [`../docs/prd/authentication-and-security.md`](../docs/prd/authentication-and-security.md)

## Environment setup

The backend automatically loads one env file:
- `ENV_FILE` if set. The file must exist, and its values override inherited env vars for this process.
- Otherwise `server/.env.<NODE_ENV>` from the server workspace
- Falls back to `server/.env`

For local dev/prod separation:
- Keep `/home/ubuntu/Development/life-os/server/.env` (or `.env.development`) on dev DB, e.g. `life_os_dev`.
- Keep `/home/ubuntu/apps/life-os-prod/server/.env.production` on prod DB, e.g. `life_os`.
- Use different session/csrf cookie names to avoid cross-login interference if both environments are tested on same host.
- Set `AUTO_CREATE_DATABASE=true` in local `.env` if you want the app to auto-create a missing `DATABASE_URL` database on boot.
- Set `AUTO_APPLY_MIGRATIONS=true` in local `.env` to auto-run `prisma migrate deploy` on startup after DB creation.

Common bootstrap commands:
- Create databases separately: `createdb life_os_dev` (development) and `createdb life_os` (production).
- Run schema migrations against each environment URL:
  - Development: `npm run prisma:migrate`
  - Production: `npx prisma migrate deploy`
- Manage users:
  - Production-safe example: `ENV_FILE=/home/ubuntu/apps/life-os-prod/server/.env.production NODE_ENV=production npm run users -w server -- list`
  - From the server workspace: `npm run users -- list`
  - From the server workspace: `npm run users -- create --email user@example.com --password change-me-please --display-name "User"`
  - From the server workspace: `npm run users -- set-password --email user@example.com --password new-password-123`
  - From the server workspace: `npm run users -- disable --email user@example.com`
