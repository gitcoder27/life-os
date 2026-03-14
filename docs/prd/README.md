# Life OS Product Docs

This folder turns the brainstorm in [`../myRequirement.md`](../myRequirement.md) into an initial planning set for product discovery and PRD work.

## Reading order

1. [`requirement-review.md`](./requirement-review.md)
2. [`product-vision.md`](./product-vision.md)
3. [`PRD.md`](./PRD.md)
4. [`technical-architecture.md`](./technical-architecture.md)
5. [`api-contracts.md`](./api-contracts.md)
6. [`data-model.md`](./data-model.md)
7. [`scoring-system.md`](./scoring-system.md)
8. [`review-templates.md`](./review-templates.md)
9. [`authentication-and-security.md`](./authentication-and-security.md)
10. [`success-metrics.md`](./success-metrics.md)
11. [`screen-specs.md`](./screen-specs.md)
12. [`frontend-architecture.md`](./frontend-architecture.md)
13. [`backend-architecture.md`](./backend-architecture.md)
14. [`parallel-workstreams.md`](./parallel-workstreams.md)
15. [`frontend-workstream.md`](./frontend-workstream.md)
16. [`backend-workstream.md`](./backend-workstream.md)
17. [`features-by-module.md`](./features-by-module.md)
18. [`screen-breakdown.md`](./screen-breakdown.md)
19. [`roadmap.md`](./roadmap.md)
20. [`open-questions.md`](./open-questions.md)

## What each file does

- `requirement-review.md`: evaluates the original idea, highlights strengths, risks, and missing decisions.
- `product-vision.md`: captures the product promise, target user, jobs to be done, and design principles.
- `PRD.md`: the main draft product requirements document for the first version.
- `technical-architecture.md`: defines the system topology, recommended stack, repo layout, and shared frontend/backend boundaries.
- `api-contracts.md`: defines the canonical MVP API surface between frontend and backend.
- `data-model.md`: defines the PostgreSQL-first backend schema plan and migration order.
- `scoring-system.md`: defines the Daily Score, Weekly Momentum, streak logic, and anti-gaming rules.
- `review-templates.md`: defines the exact daily, weekly, and monthly review flows.
- `authentication-and-security.md`: defines the simple-login decision and MVP security baseline.
- `success-metrics.md`: defines launch readiness and first-30-day success thresholds.
- `screen-specs.md`: gives wireframe-level specs for all MVP routes and surfaces.
- `frontend-architecture.md`: defines the frontend stack, app shell, route structure, state model, and UI behavior rules.
- `backend-architecture.md`: defines the backend module design, jobs, scoring responsibilities, and deployment model.
- `parallel-workstreams.md`: defines how frontend and backend agents work in parallel without contract drift.
- `frontend-workstream.md`: gives the milestone-based execution plan for the frontend agent.
- `backend-workstream.md`: gives the milestone-based execution plan for the backend agent.
- `features-by-module.md`: organizes capabilities by Life OS module and by release phase.
- `screen-breakdown.md`: maps product modules to screens, components, and screen-level behaviors.
- `roadmap.md`: outlines MVP, next phases, and release goals.
- `open-questions.md`: acts as the decision summary and reference map for resolved planning questions.

## Current status

- This is a draft v0.3 planning baseline.
- The core product-definition and implementation-planning gaps are now resolved, including scoring, reviews, simple auth, data model, architecture, screen specs, and parallel workstreams.
- The recommended build target for MVP in these docs is a responsive single-user web app with simple login, fast manual input, transparent scoring, and limited automation.
