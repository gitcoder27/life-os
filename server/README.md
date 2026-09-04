# Server Workspace

This workspace contains the backend API, worker jobs, and CLI tooling.

Primary references:

- [`../docs/prd/technical-architecture.md`](../docs/prd/technical-architecture.md)
- [`../docs/prd/data-model.md`](../docs/prd/data-model.md)
- [`../docs/prd/api-contracts.md`](../docs/prd/api-contracts.md)
- [`../docs/prd/authentication-and-security.md`](../docs/prd/authentication-and-security.md)

## Environment setup

The backend automatically loads one env file:
- `ENV_FILE` if set. The file must exist. Values from the file fill missing variables only.
- Otherwise `server/.env.<NODE_ENV>` from the server workspace
- Falls back to `server/.env`

Inherited process variables win over env-file values by default. Set
`ENV_FILE_OVERRIDE=true` only for an explicit local/admin workflow where the
selected env file should replace inherited variables.

For local dev/prod separation:
- Keep `/home/ubuntu/Development/life-os/server/.env` (or `.env.development`) on dev DB, e.g. `life_os_dev`.
- Keep `/home/ubuntu/apps/life-os-prod/server/.env.production` on prod DB, e.g. `life_os`.
- Use different session/csrf cookie names to avoid cross-login interference if both environments are tested on same host.
- Set `AUTO_CREATE_DATABASE=true` in local `.env` if you want the app to auto-create a missing `DATABASE_URL` database on boot.
- Set `AUTO_APPLY_MIGRATIONS=true` in local `.env` to auto-run `prisma migrate deploy` on startup after DB creation.
- Production API and worker startup reject `AUTO_CREATE_DATABASE=true` and
  `AUTO_APPLY_MIGRATIONS=true`; run production database creation and migrations
  as explicit deploy/admin steps.
- Production requires `DATABASE_SEPARATION_STRICT=true` and a strong
  `SESSION_SECRET`.
- Set `TRUST_PROXY=true` for the nginx deployment so login rate limits use the
  forwarded client IP from the trusted local proxy hop.
- Production bootstrap user creation requires
  `ALLOW_PRODUCTION_BOOTSTRAP=true` and a strong non-example bootstrap password.
  Disable it again after the first owner account exists.

Common bootstrap commands:
- Create databases separately: `createdb life_os_dev` (development) and `createdb life_os` (production).
- Run schema migrations against each environment URL:
  - Development: `npm run prisma:migrate`
  - Production: `npx prisma migrate deploy`
- Optional real-DB integration tests require an isolated database whose name
  includes `test`, for example `life_os_integration_test`:
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_os_integration_test npx prisma migrate deploy --schema prisma/schema.prisma`
  - `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_os_integration_test npm run test:integration`
- Manage users:
  - Interactive menu from repo root: `npm run users:interactive`
  - Interactive menu from the server workspace: `npm run users:interactive`
  - The interactive menu auto-selects development in `/home/ubuntu/Development/life-os` and production in `/home/ubuntu/apps/life-os-prod`.
  - Production-safe example: `ENV_FILE=/home/ubuntu/apps/life-os-prod/server/.env.production NODE_ENV=production npm run users -w server -- list`
  - From the server workspace: `npm run users -- list`
  - From the server workspace: `npm run users -- create --email user@example.com --password change-me-please --display-name "User"`
  - From the server workspace: `npm run users -- set-password --email user@example.com --password new-password-123`
  - From the server workspace: `npm run users -- disable --email user@example.com`
