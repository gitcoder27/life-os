# User Account Management

Use this when you need to create or manage accounts without a UI.

## Important

- There is no public sign-up screen in this app.
- Account creation is admin-only.
- On the production server, always run these commands with `NODE_ENV=production`.

## Production location

Run from the production checkout:

```bash
cd /home/ubuntu/apps/life-os-prod
```

## Create the first account on a brand-new install

Set these values in `server/.env.production` before the first start:

```bash
BOOTSTRAP_USER_EMAIL=owner@example.com
BOOTSTRAP_USER_PASSWORD=change-me-please
BOOTSTRAP_USER_DISPLAY_NAME=Primary User
```

Important:

- This first-boot account creation only works when the database has no users yet.
- It is for the initial account only.

## Create an additional user

```bash
cd /home/ubuntu/apps/life-os-prod
NODE_ENV=production npm run users -w server -- create --email user@example.com --password change-me-please --display-name "User"
```

## List users

```bash
cd /home/ubuntu/apps/life-os-prod
NODE_ENV=production npm run users -w server -- list
```

## Reset a user's password

```bash
cd /home/ubuntu/apps/life-os-prod
NODE_ENV=production npm run users -w server -- set-password --email user@example.com --password new-password-123
```

This also revokes that user's existing sessions.

## Disable a user

```bash
cd /home/ubuntu/apps/life-os-prod
NODE_ENV=production npm run users -w server -- disable --email user@example.com
```

## Re-enable a user

```bash
cd /home/ubuntu/apps/life-os-prod
NODE_ENV=production npm run users -w server -- enable --email user@example.com
```

## Full references

- User CLI commands live in `server/src/cli/users.ts`
- Bootstrap account settings are shown in `server/.env.example`
- Product-level auth rules are described in `docs/prd/authentication-and-security.md`
