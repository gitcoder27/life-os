---
name: frontend-copilot-cli
description: Delegate all frontend implementation, editing, debugging, refactoring, and UI/UX design work in this repository to GitHub Copilot CLI. Use whenever a task touches client code, React components, routes, CSS, frontend state, accessibility, visual design, or mixed frontend/backend changes where Codex should complete backend work locally and then hand the frontend scope to Copilot CLI.
---

# Frontend Copilot CLI

Use this skill to force all frontend execution through `copilot-cli`. Codex still owns task decomposition, backend changes, review, integration, and validation.

## Workflow

1. Separate the task into backend scope and frontend scope.
2. Implement backend or shared non-frontend changes locally first when the task is mixed.
3. Gather only the frontend context Copilot needs:
   - exact files or directories it may edit
   - current behavior and target behavior
   - visual or UX constraints
   - validation commands
   - files it must not touch
4. Read [references/prompt-template.md](references/prompt-template.md) and write a concrete prompt file.
5. Run [scripts/run_frontend_copilot.sh](scripts/run_frontend_copilot.sh) from the repo root.
6. Review Copilot's diff yourself. Reject unnecessary backend changes, broad refactors, or changes outside the scoped frontend area.
7. Run validation locally and finish any non-frontend integration yourself.

## Hard Rules

- Do not hand-write frontend changes when `copilot-cli` is available. Delegate them.
- Do not send vague prompts. Name target files, target behavior, constraints, and validation commands.
- Do not let Copilot discover the entire repository if the change is narrower. Scope editable paths tightly.
- Do not ask Copilot to perform backend work when the task is mixed. Finish backend work locally, then delegate only the frontend slice.
- Do not let Copilot overwrite unrelated dirty worktree changes. Mention existing edits that must be preserved.
- Do not accept changes blindly. Review the diff and verify behavior yourself.

## Prompt Requirements

Every prompt file should include:

- objective
- repo and feature context
- exact editable paths
- files or areas to avoid
- current behavior
- target behavior
- design constraints or UI expectations
- validation commands
- output expectations:
  - apply code changes directly
  - summarize changed files
  - report remaining risks or blockers

When the task includes design work, pair this skill with `frontend-design` for visual direction, then pass the chosen design direction into the Copilot prompt.

## Command Pattern

Default invocation:

```bash
bash agents/skills/frontend-copilot-cli/scripts/run_frontend_copilot.sh \
  --prompt-file /tmp/frontend-copilot-prompt.md \
  --workdir /home/ubuntu/Development/life-os
```

Typical mixed-task invocation with extra allowed directories:

```bash
bash agents/skills/frontend-copilot-cli/scripts/run_frontend_copilot.sh \
  --prompt-file /tmp/frontend-copilot-prompt.md \
  --workdir /home/ubuntu/Development/life-os \
  --add-dir /home/ubuntu/Development/life-os/client \
  --add-dir /home/ubuntu/Development/life-os/packages/contracts
```

Use `--dry-run` first if you want to inspect the generated command without calling Copilot.

## References

- Read [references/prompt-template.md](references/prompt-template.md) before drafting the prompt.
- Use [scripts/run_frontend_copilot.sh](scripts/run_frontend_copilot.sh) instead of rebuilding the CLI command by hand.
- The project-level Copilot CLI notes that informed this skill live in `docs/copilot-cli/quickstart.md` and `docs/copilot-cli/run-cli-programmatically.md`.
