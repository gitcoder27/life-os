# Life OS

Life OS is a personal command-center product for daily planning, habits, health basics, finances, and reflection.

## Repo structure

- [`docs/prd/README.md`](./docs/prd/README.md): active product, architecture, and system reference docs
- [`docs/implementation/README.md`](./docs/implementation/README.md): active operating and deployment docs
- [`docs/user/life-os-user-guide.md`](./docs/user/life-os-user-guide.md): end-user guide
- [`docs/archive/`](./docs/archive): historical planning, review, and prompt material kept for reference
- [`client/`](./client): frontend app workspace
- [`server/`](./server): backend app workspace
- [`packages/contracts/`](./packages/contracts): shared API contracts and types

## Current state

This repo contains the working product plus a trimmed documentation set. The main `docs/` folders now focus on long-lived product, operating, and user references; superseded planning and review docs live under `docs/archive/`.

Start with:

1. [`docs/prd/README.md`](./docs/prd/README.md)
2. [`docs/user/life-os-user-guide.md`](./docs/user/life-os-user-guide.md)
3. [`docs/implementation/README.md`](./docs/implementation/README.md)

## Bootstrap commands

- `npm install`
- `npm run typecheck`
- `npm run build`
- `npm run dev`
- `npm run dev:client`
- `npm run dev:server`

`npm run dev` starts both the frontend and backend in one terminal.

Default local ports:

- client dev server: `5174`
- server API: `3004`
