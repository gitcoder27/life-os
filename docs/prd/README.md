# Life OS Product Docs

This folder holds the active long-lived product and system references for Life OS.

Historical planning material that is no longer part of the main doc set lives in [`../archive/prd/`](../archive/prd/).

## Reading order

1. [`PRD.md`](./PRD.md)
2. [`product-vision.md`](./product-vision.md)
3. [`technical-architecture.md`](./technical-architecture.md)
4. [`api-contracts.md`](./api-contracts.md)
5. [`data-model.md`](./data-model.md)
6. [`authentication-and-security.md`](./authentication-and-security.md)
7. [`scoring-system.md`](./scoring-system.md)
8. [`review-templates.md`](./review-templates.md)
9. [`success-metrics.md`](./success-metrics.md)
10. [`screen-specs.md`](./screen-specs.md)

## What each file does

- `PRD.md`: the main product definition and scope reference.
- `product-vision.md`: product promise, audience, jobs to be done, and design principles.
- `technical-architecture.md`: current system topology, module boundaries, routes, and repository layout.
- `api-contracts.md`: canonical frontend/backend contract surface.
- `data-model.md`: database design and persistence model.
- `authentication-and-security.md`: authentication model and security baseline.
- `scoring-system.md`: scoring rules, weighting, and anti-gaming constraints.
- `review-templates.md`: daily, weekly, and monthly review structure.
- `success-metrics.md`: launch readiness and adoption metrics.
- `screen-specs.md`: route-level UX reference for the shipped product surfaces.

## Usage notes

- Use this folder as the source of truth for the current product and system shape.
- Use [`../implementation/`](../implementation/) for operating procedures.
- Use [`../user/life-os-user-guide.md`](../user/life-os-user-guide.md) for end-user instructions.
- Use [`../archive/`](../archive/) only when you need historical context.
