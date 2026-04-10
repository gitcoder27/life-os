# Setup Discoverability And Management Plan

Date: 2026-04-09

Source: `docs/implementation/application-gap-analysis-2026-04-07.md`

Priority: P1

Scope: make recurring setup and durable system configuration easier to find, easier to understand, and clearly owned by the right part of the product.

---

## Why This Plan Exists

Life OS already has meaningful setup structures, but several of the important ones are too buried to support confident long-term use.

The clearest example is finance recurring setup:

- it exists
- it matters
- it is easy to miss

This plan exists to promote setup and recurring-system management into a deliberate part of the product instead of leaving it as hidden secondary admin.

## Problem Statement

Important durable configuration is currently scattered across:

- onboarding
- domain pages
- collapsed setup sections
- settings-adjacent flows

That makes the product harder to learn and harder to trust.

Users should not have to guess:

- where a domain is configured
- whether a feature is missing or merely buried
- whether a structure belongs in onboarding, settings, or the domain page itself

## Target User Outcome

After this enhancement, a user should be able to say:

- "I know where to manage recurring structures."
- "Settings is for app preferences, not hidden feature setup."
- "Each domain page has a clear place to manage the structures that power that domain."
- "Onboarding gave me a baseline, but I can rediscover setup later when I need it."

## Product Decisions

These decisions should guide the implementation:

### 1. Settings owns global preferences

Examples:

- locale
- notification preferences
- account-level behavior

### 2. Domain pages own domain structures

Examples:

- finance categories
- recurring bills
- future recurring or reusable domain objects in other modules

### 3. Onboarding seeds, but does not hide

Onboarding can create starter categories and initial structures, but it must not be the only moment where important setup is introduced.

### 4. Recurring setup is a first-class workflow

Recurring structures are not edge-case admin tools. They are part of the operating model and should be treated as such.

## Implementation Scope

In scope:

- clearer `Manage` entry points on domain pages
- finance recurring bills and finance category management discoverability
- empty-state guidance for missing recurring structures
- onboarding updates that introduce recurring setup intentionally
- clearer boundary between `Settings` and per-domain management

Out of scope:

- full onboarding redesign
- major global navigation rewrite
- broad permissions or admin-role configuration systems

## Information Architecture Direction

The app should establish a durable rule:

- `Settings` = app-wide preferences
- domain page = domain operations plus domain structure management
- onboarding = starter baseline and first-use education

Recommended product behavior:

- if a structure powers daily workflow in a domain, it should be discoverable from that domain page
- if a user lands on an empty domain state, the page should explain the first setup step directly
- if management is secondary, it can live behind disclosure, but the entry point must stay visible

## Finance As The First Implementation Target

Finance should be the proving ground for this pattern.

Recommended changes:

- replace or supplement the hidden recurring setup block with a visible `Manage` entry point
- make recurring bills and categories discoverable without requiring scrolling to the bottom of the page
- add empty-state prompts when no recurring bills exist
- let onboarding introduce the first recurring bill setup as an optional but visible step

## Frontend Plan

Frontend work should make setup discoverable without turning pages into admin dashboards.

Expected UX moves:

- visible `Manage` or `Setup` entry points near the top-level domain action lane
- lighter management surfaces that can live in drawers, tabs, sections, or dedicated routes
- empty states that explain why the setup matters and what the first action is
- wording that distinguishes daily actions from durable setup

Design rule:

- do not hide critical setup behind collapsed sections by default when the feature materially affects daily workflow

## Backend And Contract Plan

Most of this work is frontend and product architecture, but backend and contracts may still need support for:

- lightweight management summaries
- counts or statuses that help empty states explain what is missing
- onboarding flows that seed first-run defaults more intentionally

Backend changes should remain small and supportive unless domain management flows reveal a missing primitive.

## Delivery Phases

### Phase 1: Architecture and copy decisions

- lock the product boundary between `Settings`, onboarding, and domain management
- define where finance recurring setup and category management live

### Phase 2: Finance discoverability pass

- surface recurring bills and category management clearly on `Finance`
- improve empty states and first-run guidance

### Phase 3: Onboarding follow-through

- update onboarding so it introduces durable finance setup as a discoverable baseline, not hidden one-time config

### Phase 4: Pattern reuse

- apply the same management-entry approach to other domains that have durable structures

## Acceptance Criteria

- A user can find finance recurring bill management without scanning to a hidden collapsed block.
- A user can distinguish global preferences from finance-specific setup.
- Empty states tell the user what setup is missing and why it matters.
- Onboarding introduces important recurring setup without becoming the only place that exposes it.
- The finance page feels more deliberate without becoming overloaded.

## Risks And Watchouts

- If every domain gets large visible setup panels, pages will become mixed-role again.
- If setup is moved into separate routes without clear entry points, discoverability will still fail.
- If onboarding becomes too heavy, first-run friction will rise instead of falling.

## Success Metrics

- higher rate of users opening finance management surfaces
- faster time from first finance use to first recurring bill setup
- fewer empty long-term finance states after onboarding
- reduced support confusion around where recurring setup lives
