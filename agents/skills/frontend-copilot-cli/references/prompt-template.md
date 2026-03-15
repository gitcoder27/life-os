# Frontend Copilot Prompt Template

Use this structure when delegating frontend work to `copilot-cli`.

## Required sections

```md
You are editing the frontend of the Life OS repository through GitHub Copilot CLI.

Objective:
- <one sentence describing the user-visible outcome>

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work, if any, has already been handled outside this prompt

Editable paths:
- client/src/features/...
- client/src/shared/...

Do not touch:
- server/
- database schema
- unrelated files with existing dirty changes

Current behavior:
- <what the UI does today>

Target behavior:
- <what the UI must do after the change>

Constraints:
- Preserve existing patterns unless the prompt explicitly calls for a redesign
- Keep behavior accessible and responsive
- Do not revert unrelated local changes
- If a required backend API is missing, stop and report the blocker instead of inventing it

Validation:
- cd client && npm run build
- <additional test or lint command if relevant>

Deliverables:
- Apply the code changes directly
- At the end, list the files changed
- Summarize any follow-up work or risks in 3 bullets or fewer
```

## Guidance

- Include exact component, route, and style file paths whenever you know them.
- Call out existing worktree changes if the target files are already dirty.
- For design-heavy tasks, specify the intended visual direction in plain language before the implementation requirements.
- For mixed frontend/backend tasks, mention the backend contract or API behavior Copilot can rely on.
- Prefer one focused prompt over a large multi-feature batch unless the changes are tightly coupled.
