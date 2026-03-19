# Life OS

Life OS is a personal command-center product for daily planning, habits, health basics, finances, and reflection.

## Repo structure

- [`docs/prd/README.md`](./docs/prd/README.md): product, architecture, API, and workstream docs
- [`client/`](./client): frontend app workspace
- [`server/`](./server): backend app workspace
- [`packages/contracts/`](./packages/contracts): shared API contracts and types
- [`docs/implementation/`](./docs/implementation): implementation plans and checklist trackers created by the frontend and backend agents
- [`docs/agent-prompts/`](./docs/agent-prompts): reusable prompt docs for the frontend and backend AI agents

## Current state

This repo is scaffolded for parallel frontend and backend development.

Start with:

1. [`docs/prd/README.md`](./docs/prd/README.md)
2. [`docs/agent-prompts/frontend-agent-prompt.md`](./docs/agent-prompts/frontend-agent-prompt.md)
3. [`docs/agent-prompts/backend-agent-prompt.md`](./docs/agent-prompts/backend-agent-prompt.md)

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
