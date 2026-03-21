# Frontend Expert Prompt: Notification Action System

You are implementing the frontend for the notification action system in the Life OS repository.

Objective:
- Turn the current notifications page from a passive inbox into a real action surface.
- Add notification behavior controls inside Settings.
- Keep the visual and interaction quality high for a productivity app, but make design decisions yourself. Prioritize operational clarity, speed, and low cognitive load over decorative UI.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work for this feature is already complete
- Do not change backend files, contracts, schema, or tests
- Ignore unrelated dirty changes if any appear while you work

Editable frontend paths likely involved:
- `client/src/features/notifications/NotificationsPage.tsx`
- `client/src/features/settings/SettingsPage.tsx`
- `client/src/shared/lib/api.ts`
- `client/src/app/shell/AppShell.tsx`
- `client/src/styles.css`

Do not touch:
- `server/`
- `packages/contracts/`
- Prisma migrations or schema
- unrelated files outside the notification/settings frontend scope

## Backend APIs now available

### `GET /api/settings/profile`
Response now includes `preferences.notificationPreferences` in addition to the existing settings fields.

Shape:
```ts
type NotificationCategory = "review" | "finance" | "health" | "habit" | "routine";
type NotificationMinSeverity = "info" | "warning" | "critical";
type NotificationRepeatCadence = "off" | "hourly" | "every_3_hours";

type NotificationCategoryPreference = {
  enabled: boolean;
  minSeverity: NotificationMinSeverity;
  repeatCadence: NotificationRepeatCadence;
};

type NotificationCategoryPreferences = Record<
  NotificationCategory,
  NotificationCategoryPreference
>;
```

`preferences` now contains:
```ts
{
  timezone: string;
  currencyCode: string;
  weekStartsOn: number;
  dailyWaterTargetMl: number;
  dailyReviewStartTime: string | null;
  dailyReviewEndTime: string | null;
  notificationPreferences: NotificationCategoryPreferences;
}
```

Backend defaults when the user has never configured this:
- `review`: enabled `true`, minSeverity `"info"`, repeatCadence `"hourly"`
- `finance`: enabled `true`, minSeverity `"warning"`, repeatCadence `"every_3_hours"`
- `health`: enabled `true`, minSeverity `"warning"`, repeatCadence `"off"`
- `habit`: enabled `true`, minSeverity `"warning"`, repeatCadence `"off"`
- `routine`: enabled `true`, minSeverity `"warning"`, repeatCadence `"off"`

### `PUT /api/settings/profile`
This endpoint still updates normal settings fields, and now also accepts partial notification preference updates:

```ts
{
  notificationPreferences?: Partial<{
    review: Partial<NotificationCategoryPreference>;
    finance: Partial<NotificationCategoryPreference>;
    health: Partial<NotificationCategoryPreference>;
    habit: Partial<NotificationCategoryPreference>;
    routine: Partial<NotificationCategoryPreference>;
  }>
}
```

Important:
- The frontend may send a full notification preferences object for simplicity.
- The backend merges partial updates safely.
- Response returns the normalized full preferences object.

### `GET /api/notifications`
Response item shape is now:
```ts
type NotificationItem = {
  id: string;
  notificationType: "review" | "finance" | "health" | "habit" | "routine";
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  ruleKey: string;
  visibleFrom: string | null;
  expiresAt: string | null;
  read: boolean;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};
```

### Existing mutations
- `POST /api/notifications/:notificationId/read`
- `POST /api/notifications/:notificationId/dismiss`

### New mutation
- `POST /api/notifications/:notificationId/snooze`

Request body:
```ts
{ preset: "one_hour" | "tonight" | "tomorrow" }
```

Behavior:
- `one_hour`: snooze until one hour from now
- `tonight`: snooze until 18:00 in the user’s configured timezone
- `tomorrow`: snooze until 09:00 tomorrow in the user’s configured timezone
- Backend rejects `tonight` if it is already 18:00 or later in the user’s timezone
- Snoozing makes the notification unread again and updates its visibility time

## Current frontend gaps to fix

- Notifications page is still a simple read/dismiss/open list
- Settings page has no notification controls
- App shell notification entry has no unread count/badge
- Frontend API helpers in `client/src/shared/lib/api.ts` do not yet understand the new notification/settings shapes

## Target frontend behavior

### 1. Notifications page becomes an action workspace
- Keep the page route at `/notifications`
- Preserve loading, empty, and error states
- Rework the content into a more operational layout instead of a plain grouped inbox
- Add at least these filters:
  - `All`
  - `Needs action`
  - `Read`
- `Needs action` should prioritize unread items
- Each notification row/card should clearly show:
  - category
  - severity
  - title
  - body
  - relative time
  - action buttons

Required actions per notification:
- `Open` when a destination route can be resolved
- `Mark read`
- `Dismiss`
- snooze affordance using the new backend mutation

Snooze requirements:
- Expose presets:
  - `1 hour`
  - `Tonight`
  - `Tomorrow`
- Do not offer `Tonight` when local time in the user’s configured timezone is already 18:00 or later
- You may implement snooze as inline buttons, a compact action menu, segmented controls, or another clean pattern
- Avoid modal-heavy UX unless clearly justified

### 2. Settings page gets a notification behavior section
- Add a new section inside the existing Settings page
- Position it as a serious behavior-control surface, not a marketing explainer
- One row/block per category:
  - Review
  - Finance
  - Health
  - Habit
  - Routine
- Each category should show:
  - category label
  - short purpose/description
  - enabled toggle
  - minimum severity control
- Repeat cadence controls:
  - show editable repeat cadence only for `review` and `finance`
  - do not expose repeat cadence editing for `health`, `habit`, or `routine`
  - if you render those categories consistently, show repeat as fixed/off but non-editable

Settings save behavior:
- Continue using the existing page-level save model
- Notification preference edits should participate in the same dirty-state and save flow as other settings
- Keep the current save button pattern unless you find a materially better inline approach that still feels consistent with the page

### 3. App shell shows notification state
- Add an unread count badge or similarly compact status indicator to the shell Notifications button
- Use `GET /api/notifications`
- Do not make the shell noisy; the badge should be visible but restrained

## UX requirements

- This is a productivity tool, so the page should feel like a control surface, not a social inbox
- Prioritize:
  - fast scanning
  - clear urgency
  - one-step action
  - low visual noise
- Avoid:
  - generic card grids
  - over-decorated dashboards
  - overly playful alert UI
- Design decisions are yours, but the result should feel intentional and premium
- Preserve responsive behavior on mobile and desktop
- Keep accessibility in mind for toggles, menus, action buttons, and filter controls

## Data and interaction details

- Use the user’s configured timezone from settings when deciding whether `Tonight` should be offered
- Notification categories map directly to backend values:
  - `review`
  - `finance`
  - `health`
  - `habit`
  - `routine`
- Severity values map directly to backend values:
  - `info`
  - `warning`
  - `critical`
- The backend now also returns `read` and `readAt`; use `read` for UI state
- Keep existing `Open` route resolution behavior working
- After read/dismiss/snooze actions, the notification list and any unread badge should refresh correctly
- After saving settings, the settings query and any dependent UI should refresh correctly

## Implementation expectations

- Update `client/src/shared/lib/api.ts` types and React Query hooks for:
  - notification item `read`
  - notification category typing
  - notification snooze mutation
  - settings `notificationPreferences`
- Add any small helper functions needed for category labels, severity labels, or timezone-aware snooze availability
- Keep the implementation aligned with the existing frontend architecture and query invalidation patterns
- Do not invent backend behavior that is not described above

## Validation

Run:
```bash
cd client && npm run build
```

## Deliverables

- Apply the frontend changes directly
- At the end, list the files changed
- Call out any blockers, assumptions, or follow-up risks in 3 bullets or fewer
