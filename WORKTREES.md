# Worktree Commands

Use the main checkout at `/home/ubuntu/Development/life-os` as the stable base.
Do feature work inside the three worktrees:

- `agent-a`: `/home/ubuntu/Development/life-os-worktrees/agent-a`
- `agent-b`: `/home/ubuntu/Development/life-os-worktrees/agent-b`
- `agent-c`: `/home/ubuntu/Development/life-os-worktrees/agent-c`

## Start Each Worktree

Run these from the matching worktree directory.

```bash
cd /home/ubuntu/Development/life-os-worktrees/agent-a
ENV_FILE=server/.env.agent-a npm run dev
```

```bash
cd /home/ubuntu/Development/life-os-worktrees/agent-b
ENV_FILE=server/.env.agent-b npm run dev
```

```bash
cd /home/ubuntu/Development/life-os-worktrees/agent-c
ENV_FILE=server/.env.agent-c npm run dev
```

Ports currently configured:

- `agent-a`: frontend `5176`, backend `3006`
- `agent-b`: frontend `5175`, backend `3005`
- `agent-c`: frontend `5177`, backend `3007`

## Important Rule

Do not edit tracked shared config for local ports.
Keep local worktree settings only in these ignored files:

- `client/.env.development.local`
- `server/.env.agent-a`
- `server/.env.agent-b`
- `server/.env.agent-c`

Those files are local-only and should not be committed.

## Before You Commit

Run:

```bash
git status
```

Safe result:

- your feature files show up
- local worktree files like `server/.env.agent-a` do not show up

Unsafe result:

- `client/.env.development`
- shared tracked config changed only for local ports

If you see shared config changed just for local ports, move that change back into the local ignored files first.

## Merge Flow

1. Finish the feature in one worktree.
2. Test that worktree.
3. Commit that branch.
4. Update `main`.
5. Bring latest `main` into the worktree branch.
6. Fix conflicts and test again.
7. Merge that branch into `main`.
8. Test `main`.

Useful commands:

```bash
cd /home/ubuntu/Development/life-os
git checkout main
git pull
```

```bash
cd /home/ubuntu/Development/life-os-worktrees/agent-a
git merge main
```

```bash
cd /home/ubuntu/Development/life-os
git checkout main
git merge agent-a
```

Repeat the same pattern for `agent-b` and `agent-c`.
