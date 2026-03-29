# Life OS

## Project Overview

Life OS is a personal command-center full-stack application for daily planning, habits, health basics, finances, and reflection.

The project is structured as a TypeScript monorepo using npm workspaces:
- **`client/`**: The frontend web application, built with React, Vite, React Router, and React Query.
- **`server/`**: The backend API server, built with Fastify, Prisma (ORM), and Zod (validation).
- **`packages/contracts/`**: Shared API contracts and types used by both the client and server.

## Building and Running

The project includes convenient scripts at the root level to manage the workspaces.

### Development

To start both the frontend and backend development servers simultaneously:
```bash
npm run dev
```
- Client dev server runs on port `5174`.
- Server API runs on port `3004`.

You can also run them individually:
- Frontend only: `npm run dev:client`
- Backend only: `npm run dev:server`

### Building

To build all workspaces (contracts, server, and client) for production:
```bash
npm run build
```

### Type Checking

To run TypeScript type checking across all workspaces:
```bash
npm run typecheck
```

### Testing

The backend includes a test suite using Vitest. You can run it from the server directory or via npm workspace commands:
```bash
npm test -w server
# or for coverage
npm run test:coverage -w server
```

### Database Management (Prisma)

The backend uses Prisma. Before running the dev server or tests for the first time, you may need to generate the Prisma client (though `npm install` should handle this via `postinstall`):
```bash
npm run prisma:generate -w server
```
To run migrations during development:
```bash
npm run prisma:migrate -w server
```

## Development Conventions

- **Monorepo Structure**: Ensure any shared types or API definitions are placed in `packages/contracts/` so both the client and server can utilize them.
- **Documentation**: Active product, architecture, operating, and user documentation lives in the `docs/` directory. Refer to `docs/prd/README.md` as the starting point for product details.
- **Archived Prompts**: Historical prompt material is kept in `docs/archive/agent-prompts/` for reference.
- **Database**: The server uses Prisma. Schema modifications should be made in `server/prisma/schema.prisma` followed by running migration commands.

## AI Agent Behavior Rules

- **DO NOT RUN `npm run dev`**: Never attempt to start the server or start development mode (`npm run dev`, `npm run dev:client`, `npm run dev:server`). The server and client dev environment is already running and managed by the user.
- **NO BROWSER TESTING**: Never use the `browser_subagent` tool or any browser-based testing tools. Do not attempt to validate the application via the browser.
- **VALIDATION METHODS**: Validate all changes using only:
  - TypeScript type checks (`npm run typecheck`)
  - Server-side tests (`npm run test -w server`)
  - Production builds (`npm run build`)
  - Manual code review and compilation checks.

