# Documentation Cleanup Review

Date: 2026-03-26

Reviewed: all 45 Markdown files under `docs/`

## Recommended long-term keep set

- Keep `docs/user/life-os-user-guide.md`. This is the best end-user reference and matches the current product shape better than most planning docs.
- Keep `docs/implementation/production-deployment.md`, `docs/implementation/production-deployment-quick-reference.md`, and `docs/implementation/user-account-management.md`. These are real operating docs, not temporary build artifacts.
- Keep `docs/prd/PRD.md`, `docs/prd/product-vision.md`, `docs/prd/technical-architecture.md`, `docs/prd/api-contracts.md`, `docs/prd/data-model.md`, `docs/prd/authentication-and-security.md`, `docs/prd/scoring-system.md`, `docs/prd/review-templates.md`, and `docs/prd/success-metrics.md`. These are the core product and system references.

## Keep, but trim or update

- Keep `docs/prd/README.md` and `docs/implementation/README.md`, but rewrite them after cleanup. Both still describe the repo in planning/agent-execution terms.
- Keep `docs/prd/screen-specs.md` only if you still want a screen-level product reference. It is already stale in places: it still treats onboarding as required and does not include the shipped Inbox route.
- Keep `docs/prd/frontend-architecture.md` and `docs/prd/backend-architecture.md` only if you want separate frontend/backend reference docs. Otherwise merge their useful parts into `docs/prd/technical-architecture.md` and remove them.

## Safe to remove or archive

- Remove/archive all prompt docs: everything in `docs/agent-prompts/` and `docs/prompts/`.
- Remove/archive development execution docs in `docs/implementation/`: `backend-checklist.md`, `backend-implementation-plan.md`, `dashboard-audit-report.md`, `frontend-checklist.md`, `frontend-implementation-plan.md`, `inbox-product-review.md`, `today-day-planner-production-plan.md`, and `today-page-redesign-review.md`.
- Remove/archive all historical review docs in `docs/review/`. They were useful during iteration, but they are not living product docs now.
- Remove/archive historical planning docs in `docs/prd/`: `myRequirement.md`, `requirement-review.md`, `open-questions.md`, `features-by-module.md`, `screen-breakdown.md`, `frontend-workstream.md`, `backend-workstream.md`, `parallel-workstreams.md`, and `roadmap.md`.

## Bottom line

- Keep: 13 docs
- Keep but update/consolidate: 5 docs
- Remove/archive: 27 docs

If you want the cleanest setup, keep the 13 long-term docs, update the 5 borderline docs, and move the other 27 into an `archive/` folder or remove them entirely.
