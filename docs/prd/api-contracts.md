# API Contracts

This document defines the MVP API surface between the frontend and backend. It is intentionally small and should stay stable enough for parallel development.

## Contract principles

- Backend is authoritative for business logic
- Frontend should not reimplement scoring or review rules
- Endpoints should be resource-oriented and easy to cache
- Response payloads should include only what the screen needs
- Shared schemas should live in `packages/contracts`

## Authentication

### `POST /api/auth/login`

Purpose: create a session.

Request:

```json
{
  "email": "owner@example.com",
  "password": "string"
}
```

Response:

```json
{
  "user": {
    "id": "usr_123",
    "email": "owner@example.com",
    "displayName": "Owner"
  }
}
```

### `POST /api/auth/logout`

Purpose: destroy the current session.

### `GET /api/auth/session`

Purpose: return current session user and auth status.

## Onboarding

### `GET /api/onboarding/state`

Purpose: return whether onboarding is complete and any existing first-run defaults.

### `POST /api/onboarding/complete`

Purpose: submit the first-run setup payload and mark onboarding complete.

## Dashboard and home

### `GET /api/home/overview?date=YYYY-MM-DD`

Purpose: fetch the Home screen summary.

Response shape:

```json
{
  "date": "2026-03-14",
  "greeting": "Good evening",
  "dailyScore": {
    "value": 78,
    "label": "Solid Day",
    "earnedPoints": 70,
    "possiblePoints": 90
  },
  "weeklyMomentum": 74,
  "topPriorities": [],
  "tasks": [],
  "routineSummary": {},
  "habitSummary": {},
  "healthSummary": {},
  "financeSummary": {},
  "attentionItems": [],
  "notifications": []
}
```

### `GET /api/home/overview/history/:date`

Purpose: fetch a specific day summary for review or history.

## Priorities and tasks

### `GET /api/planning/days/:date`

Purpose: fetch the Today screen model.

### `PUT /api/planning/days/:date/priorities`

Purpose: save the ordered top 3 priorities for a date.

### `GET /api/planning/weeks/:startDate`

Purpose: fetch weekly planning context.

### `PUT /api/planning/weeks/:startDate/priorities`

Purpose: save next-week priorities and related weekly planning choices.

### `GET /api/planning/months/:startDate`

Purpose: fetch monthly planning context.

### `POST /api/tasks`

Purpose: create a lightweight task or reminder.

### `PATCH /api/tasks/:taskId`

Purpose: edit status, date, title, or scheduling fields.

### `POST /api/tasks/:taskId/carry-forward`

Purpose: move an incomplete task to a new date.

## Habits and routines

### `GET /api/habits`

Purpose: fetch habits, routines, and due-state for the current day.

### `POST /api/habits`

Purpose: create a habit.

### `PATCH /api/habits/:habitId`

Purpose: edit a habit.

### `POST /api/habits/:habitId/checkins`

Purpose: mark a due habit complete for a specific date.

### `GET /api/routines`

Purpose: fetch morning and evening routine definitions plus daily completion state.

### `POST /api/routine-items/:itemId/checkins`

Purpose: mark a routine item complete.

## Health

### `GET /api/health/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Purpose: fetch health summary for the requested range, including current-day use.

### `POST /api/health/water-logs`

Purpose: log water intake.

### `POST /api/health/meal-logs`

Purpose: log a meal entry.

### `PUT /api/health/workout-days/:date`

Purpose: log workout outcome for the day.

### `POST /api/health/weight-logs`

Purpose: log body weight.

## Finance

### `GET /api/finance/summary?month=YYYY-MM`

Purpose: fetch spending summary, category totals, and upcoming bills.

### `POST /api/finance/expenses`

Purpose: create an expense.

### `PATCH /api/finance/expenses/:expenseId`

Purpose: edit an expense.

### `GET /api/finance/recurring-expenses`

Purpose: fetch recurring expense templates.

### `POST /api/finance/recurring-expenses`

Purpose: create a recurring expense or bill reminder.

## Goals and planning

### `GET /api/goals`

Purpose: fetch goals and current planning context.

### `POST /api/goals`

Purpose: create a goal.

### `PATCH /api/goals/:goalId`

Purpose: update a goal.

### `PUT /api/planning/months/:startDate/focus`

Purpose: save monthly theme and top outcomes.

## Reviews

### `GET /api/reviews/daily/:date`

Purpose: fetch the daily review model and prefilled summary.

### `POST /api/reviews/daily/:date`

Purpose: submit and finalize a daily review.

### `GET /api/reviews/weekly/:startDate`

Purpose: fetch the weekly review model and prefilled summary.

### `POST /api/reviews/weekly/:startDate`

Purpose: submit and finalize a weekly review.

### `GET /api/reviews/monthly/:startDate`

Purpose: fetch the monthly review model and prefilled summary.

### `POST /api/reviews/monthly/:startDate`

Purpose: submit and finalize a monthly review.

## Scores

### `GET /api/scores/daily/:date`

Purpose: fetch detailed Daily Score breakdown for a date.

### `GET /api/scores/weekly-momentum?endingOn=YYYY-MM-DD`

Purpose: fetch current Weekly Momentum and related trend metadata.

## Notifications

### `GET /api/notifications`

Purpose: fetch active in-app notifications.

### `POST /api/notifications/:notificationId/read`

Purpose: mark a notification as read.

### `POST /api/notifications/:notificationId/dismiss`

Purpose: dismiss a notification.

## Settings

### `GET /api/settings/profile`

Purpose: fetch the owner profile and core preferences.

### `PUT /api/settings/profile`

Purpose: update profile and app preferences.

### `PUT /api/settings/security/password`

Purpose: change the password for the owner account.

## Common response conventions

### Success envelope

Use plain JSON resource responses for reads and writes. Do not wrap every response in redundant nested `data` fields unless needed consistently by the backend framework.

### Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Water amount must be greater than zero",
    "fieldErrors": {
      "amountMl": "Required"
    }
  }
}
```

## Contract ownership rules

- Backend owns endpoint behavior and schema evolution.
- Frontend may request additions but should not assume undeclared fields.
- Contract-breaking changes require coordinated updates to the contract package and both implementation tracks.
