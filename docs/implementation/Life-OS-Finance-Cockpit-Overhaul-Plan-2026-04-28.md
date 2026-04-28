# Life OS Finance Cockpit Overhaul Plan

Date: 2026-04-28

## 1. Product Direction

Finance in Life OS should not become a full accounting product. It should become a daily money command center that helps the user answer one practical question:

> Can I safely live this month with the money I have, the money I expect, and the commitments I already made?

The current Finance screen has many useful pieces: accounts, bills, expenses, transactions, credit cards, loans, goals, reviews, and monthly planning. The problem is not only missing features. The larger product gap is that these pieces are scattered and do not yet form a clear monthly workflow.

The target product loop is:

1. Plan money.
2. Salary or income arrives.
3. User spends, pays dues, and handles bills.
4. Finance shows what is safe to spend.
5. User reviews the month.
6. The next month starts smarter.

This document defines the implementation plan for turning Finance into a coherent monthly cockpit.

## 2. Product Promise

The Finance screen should make this promise:

> Open this screen and know exactly where your money stands this month.

That means the first screen should immediately answer:

- How much cash do I have right now?
- Has my salary or expected income arrived?
- What bills, EMIs, card dues, and subscriptions are coming?
- What have I already spent?
- What is actually safe to spend?
- Which money action needs attention next?

## 2.1 Chosen Design Direction: Variant B

The chosen redesign direction is Variant B from the generated visual exploration.

Variant B should guide the implementation because it is closer to the Life OS product idea: a monthly money command center, not a finance dashboard full of disconnected cards.

Core design decisions from Variant B:

- Lead with one central `Safe this month` cockpit panel.
- Make safe-to-spend the primary answer, not one metric among many equal boxes.
- Show the month as a left-to-right money journey.
- Use `Today's money actions` as the operational rail for what the user should do next.
- Keep setup available but do not make setup the main experience.
- Present data through compact rows, lanes, chips, and dividers instead of nested cards.
- Use less explanatory copy and let hierarchy, status, and actions explain the workflow.

Variant A remains useful as a practical implementation reference for tabs, row density, and safe-to-spend breakdown, but Variant B is the target product layout.

## 3. Current Gaps

### 3.1 Income Workflow Is Incomplete

Current behavior:

- User can add salary or recurring income from setup.
- The app confirms that the income plan was added.
- The setup step turns green.
- The added income plan is not visible on the main Finance screen.
- The added income plan is not visible as a reviewable list in setup.
- The top `Income` number only shows received/logged income, not expected income.

Product problem:

- The user cannot verify what income plans exist.
- The user does not know whether salary is expected, overdue, or received.
- The app does not give a clear action to mark salary as received.

Required fix:

- Show income plans after creation.
- Separate expected income from received income.
- Add a simple `Mark received` workflow.

### 3.2 Finance Pieces Are Useful But Scattered

Current screen areas are individually useful but not arranged as a user journey:

- Setup is where accounts/income/cards/loans/categories/bills are configured.
- Overview shows some dashboard state.
- Transactions show money entries.
- Bills manage due items.
- Accounts show balances.
- Debt shows cards and loans.

Product problem:

- The screen has data but lacks a central narrative.
- The user does not see the month as a flow of income, obligations, spending, and remaining money.

Required fix:

- Add a monthly timeline that brings salary, bills, EMIs, card dues, and spending milestones together.
- Make the overview the command center, not just a collection of sections.

### 3.3 Safe-to-Spend Needs Stronger Trust

Safe-to-spend is the most important user-facing number, but it must be explainable.

It should account for:

- Cash available.
- Upcoming bills.
- Credit card dues.
- Loan EMIs.
- Planned expenses.
- Savings or goal commitments.
- Expected income that has not arrived yet should be shown, but not treated as cash unless explicitly received.

Product problem:

- If safe-to-spend is wrong or unclear, the user will stop trusting Finance.

Required fix:

- Add a visible breakdown of safe-to-spend.
- Make every deduction traceable to a bill, debt item, plan, or goal.

### 3.4 Setup Is Configuration, Not Management

Setup currently helps add items, but it does not fully help users review and manage what they added.

Required fix:

- Each setup tab should include both creation and management:
  - Accounts: add, view balances, archive.
  - Income: add, view, mark received, pause/archive.
  - Cards: add, view dues, archive.
  - Loans: add, view EMI and outstanding, archive.
  - Bills: add recurring dues and review them.
  - Categories: add/edit/archive.

## 4. Target User Workflows

### 4.1 First-Time Setup

Goal: get the user from empty Finance to a useful monthly cockpit in under five minutes.

Flow:

1. Add at least one bank/cash/wallet account.
2. Add salary or recurring income.
3. Add known monthly dues:
   - Rent.
   - Utilities.
   - Subscriptions.
   - EMIs.
   - Credit card dues.
4. Optional: add credit cards and loans.
5. Finance immediately shows expected month picture.

Screen behavior:

- Setup checklist should show:
  - Account added.
  - Income plan added.
  - Dues added.
  - Debt optional.
- User should never wonder where a newly added item went.

### 4.2 Monthly Salary Flow

Goal: make salary the anchor of the month.

Flow:

1. User has an active salary income plan.
2. Finance shows salary under `Expected income`.
3. On or after expected date, Finance shows `Due today` or `Overdue`.
4. User clicks `Mark received`.
5. App creates an income transaction against the selected account.
6. Dashboard updates:
   - Income received increases.
   - Cash available increases.
   - Safe-to-spend recalculates.
   - Recent money shows the salary entry.
   - Income plan moves next expected date forward.

Required states:

- Expected.
- Due soon.
- Due today.
- Overdue.
- Received this month.
- Paused.

### 4.3 Spending Flow

Goal: make daily expense logging quick and tied to account balances.

Flow:

1. User clicks `Add money entry`.
2. User chooses expense.
3. User selects account, amount, category, date, and optional note.
4. App records the transaction.
5. Dashboard updates:
   - Account balance decreases.
   - Spent increases.
   - Safe-to-spend decreases.
   - Recent money updates.

Enhancement:

- Keep the current form compact.
- Add common quick categories later if needed.

### 4.4 Bill Payment Flow

Goal: bills should be actionable, not just reminders.

Flow:

1. Bill appears in monthly timeline and Bills tab.
2. User chooses:
   - Pay and log.
   - Mark paid only.
   - Reschedule.
   - Drop.
3. If pay and log:
   - User selects payment account.
   - App creates linked expense/ledger transaction.
   - Bill status updates.
   - Dashboard totals update without double counting.

### 4.5 Credit Card Flow

Goal: credit cards should help users understand available credit and upcoming payment pressure.

Flow:

1. User adds card:
   - Card name.
   - Issuer.
   - Limit.
   - Outstanding.
   - Minimum due.
   - Due day.
   - Payment account.
2. Finance shows:
   - Outstanding.
   - Utilization.
   - Due this month.
   - Payment account.
3. User clicks `Pay due`.
4. App logs payment from account and reduces outstanding/minimum due.

Future:

- Total due vs minimum due.
- Statement date.
- Purchase tracking per card.
- Card payment history.

### 4.6 Loan Flow

Goal: loans should be part of monthly obligations, not hidden notes.

Flow:

1. User adds loan:
   - Lender.
   - Outstanding.
   - EMI.
   - Due day.
   - Payment account.
2. Finance shows:
   - Outstanding.
   - Monthly EMI.
   - Progress paid.
   - Due timing.
3. User clicks `Pay EMI`.
4. App logs expense from account and reduces outstanding.

Future:

- Interest/principal split.
- Loan payoff estimate.
- Prepayment support.

### 4.7 Monthly Review Flow

Goal: close the money loop.

Flow:

1. At month end, Finance review summarizes:
   - Income received.
   - Expected income missed.
   - Total spent.
   - Bills paid/missed.
   - Debt paid.
   - Goal contributions.
   - Safe-to-spend trend.
2. User confirms or adjusts next month plan.
3. Review insights feed the next month.

## 5. Target Screen Structure

### 5.1 Page Layout: Safe This Month Cockpit

The target page should use the Variant B layout.

Primary zones:

- Left navigation: unchanged Life OS module navigation.
- Top page bar: Finance title, month switcher, and compact actions.
- Main cockpit: large `Safe this month` panel with the key money answer.
- Month journey: horizontal timeline lanes for income, bills, debt, and goals.
- Right rail: `Today's money actions` and safe-to-spend math.
- Lower workspace: tabs for deeper review and management.

This layout should feel like a control room, not a report page. The user should see one main answer, one next-action list, and one month flow.

### 5.2 Safe This Month Panel

The old equal-width metric strip should evolve into a central cockpit panel.

Hero value:

- Safe to spend.

Recommended metrics:

- Cash available.
- Income received.
- Expected income.
- Spent.
- Upcoming obligations.
- Debt due.

Rules:

- Use `Safe to spend` as the strongest number.
- Keep supporting metrics compact and secondary.
- Avoid long explanatory text.
- Let users click into a number for details.
- `Income received` and `Expected income` must be visually distinct.
- Do not use many same-weight statistic boxes.
- Do not create nested cards inside the hero panel.

### 5.3 Today Money Actions Rail

The right rail should answer: what should I do next?

Examples:

- Mark salary received.
- Pay bill.
- Pay EMI.
- Pay card due.
- Add first bill.
- Review safe-to-spend.

Rules:

- Show only the most relevant actions.
- Prefer two to five action rows, not a long feed.
- Each row should include item, amount/date if useful, and one direct action.
- Empty state should be quiet, such as `No money actions today`.

### 5.4 Main Navigation

Recommended tabs:

- `Overview`
- `Timeline`
- `Transactions`
- `Bills`
- `Accounts`
- `Debt`

Why add Timeline:

- Overview answers status.
- Timeline answers what happens next.
- Transactions answer what already happened.

### 5.5 Overview

Purpose: the daily command center.

Sections:

- Setup progress, only when setup is incomplete.
- Safe this month cockpit.
- Today's money actions.
- Month journey lanes.
- Expected income.
- Upcoming obligations.
- Recent money.
- Debt summary.

Design rules:

- No large educational blocks.
- No repeated nested cards.
- Use rows, compact bands, dividers, and clear actions.
- Put actions next to the relevant item.

### 5.6 Month Journey Lanes

The Variant B screen should include a compact visual month journey before the detailed timeline tab.

Recommended lanes:

- Income.
- Bills.
- Debt.
- Goals.

Each lane should show the current month state in one row or a small cluster:

- Income: salary expected or received.
- Bills: next due or clear.
- Debt: next EMI/card due or clear.
- Goals: planned contribution or goal chips.

Rules:

- Keep lanes shallow.
- Avoid full cards inside each lane.
- Use status dots, chips, and compact buttons.
- Make `Mark received`, `Pay`, or `Open` available directly when relevant.

### 5.7 Timeline

Purpose: show the month as money events.

Items:

- Expected salary/income.
- Received income.
- Bills.
- Recurring dues.
- Credit card dues.
- Loan EMIs.
- Large planned expenses.
- Goal contributions.

Rows should show:

- Date.
- Item name.
- Amount.
- Status.
- Primary action.

Example actions:

- `Mark received`
- `Pay`
- `Reschedule`
- `Open`

Timeline grouping:

- Overdue.
- Today.
- Next 7 days.
- Later this month.
- Completed.

### 5.8 Transactions

Purpose: audit trail and corrections.

Capabilities:

- Show all money entries.
- Filter by account/type/category/month.
- Add income, expense, transfer, adjustment.
- Later: edit/delete transactions.

Rules:

- Received salary should appear here as income.
- Bill payments should appear here without double counting.
- Card/loan payments should appear here as outgoing payments.

### 5.9 Bills

Purpose: manage one-off and recurring due items.

Capabilities:

- Add bill.
- Add recurring bill.
- Pay and log.
- Mark paid only.
- Reschedule.
- Drop.
- Link existing expense.

Enhancement:

- Move recurring bill management into Setup but keep operational bill actions here.

### 5.10 Accounts

Purpose: show where cash lives.

Capabilities:

- Add account.
- View current balance.
- View account activity.
- Archive account.
- Later: edit opening balance and account metadata.

### 5.11 Debt

Purpose: credit card and loan command center.

Capabilities:

- View credit cards.
- View loans.
- Pay card due.
- Pay EMI.
- Archive.
- Later: edit and payment history.

### 5.12 Right Inspector

Purpose: contextual detail and planning.

Recommended content:

- Today's money actions.
- Safe-to-spend breakdown.
- Monthly plan.
- Goals impacted by finance.
- Reviews.
- Selected item details when the user clicks an item.

Rule:

- The inspector should explain the selected item or the key monthly plan, not duplicate the whole main screen.

## 6. Data and Domain Model Plan

### 6.1 Existing Foundations To Preserve

Keep and build on:

- Finance accounts.
- Finance transactions.
- Recurring income templates.
- Bills/admin items.
- Expenses.
- Recurring expense templates.
- Credit cards.
- Loans.
- Month plan.
- Goals and reviews.

### 6.2 Income Plan Enhancements

Required additions:

- Recurring income should be manageable in the UI.
- Recurring income should support `mark received`.
- Mark received should create a finance transaction.
- Mark received should advance `nextExpectedOn`.

Backend behavior:

- Endpoint: `POST /api/finance/recurring-income/:id/receive`
- Input:
  - `accountId`
  - `amountMinor`
  - `receivedOn`
  - optional `description`
- Output:
  - updated recurring income plan.
  - created finance transaction.
  - dashboard invalidation target.

Important rule:

- An income plan is expected money.
- A transaction is received money.
- Do not count expected income as cash.

### 6.3 Monthly Timeline API

Add a dedicated timeline shape to the dashboard or a separate endpoint.

Recommended endpoint:

- `GET /api/finance/timeline?month=YYYY-MM`

Timeline item fields:

- `id`
- `sourceType`
- `sourceId`
- `date`
- `title`
- `amountMinor`
- `currencyCode`
- `direction`
- `status`
- `primaryAction`
- `accountId`
- `metadata`

Source types:

- `income_plan`
- `income_transaction`
- `bill`
- `recurring_bill`
- `credit_card_due`
- `loan_emi`
- `planned_expense`
- `goal_contribution`

Statuses:

- `expected`
- `due_soon`
- `due_today`
- `overdue`
- `completed`
- `skipped`
- `paused`

### 6.4 Safe-to-Spend Calculation

Safe-to-spend should be calculated as:

```text
cash available
- unpaid bills due this month
- unpaid debt dues this month
- planned expenses not yet spent
- goal commitments not yet funded
= safe-to-spend
```

Rules:

- Do not add expected salary until it is marked received.
- Show a separate optimistic number only if needed later, such as `projected after salary`.
- Every deduction should be traceable.

### 6.5 Ledger Integrity Rules

Finance trust depends on clean accounting rules:

- Income transaction increases account balance and income received.
- Expense transaction decreases account balance and spend.
- Transfer moves money between accounts and does not affect spend or income.
- Adjustment changes account balance and does not affect spend or income.
- Bill payment must not double count spend.
- Credit card due payment should reduce card outstanding and reduce payment account balance.
- Loan EMI should reduce loan outstanding and reduce payment account balance.

## 7. Frontend Implementation Plan

### 7.1 Component Split

The Finance page should be split by workflow boundaries.

Suggested files:

- `client/src/features/finance/FinancePage.tsx`
- `client/src/features/finance/components/SafeThisMonthPanel.tsx`
- `client/src/features/finance/components/TodayMoneyActions.tsx`
- `client/src/features/finance/components/MonthJourneyLanes.tsx`
- `client/src/features/finance/components/FinanceOverview.tsx`
- `client/src/features/finance/components/FinanceTimeline.tsx`
- `client/src/features/finance/components/IncomePlansPanel.tsx`
- `client/src/features/finance/components/TransactionsPanel.tsx`
- `client/src/features/finance/components/BillsPanel.tsx`
- `client/src/features/finance/components/AccountsPanel.tsx`
- `client/src/features/finance/components/DebtPanel.tsx`
- `client/src/features/finance/components/MoneySetupDrawer.tsx`
- `client/src/features/finance/lib/finance-formatters.ts`
- `client/src/features/finance/lib/finance-view-model.ts`

Reason:

- The current page is doing too much in one file.
- The next finance work will be safer if each workflow is isolated.
- Variant B has clear zones that map naturally to small components.

### 7.2 UI Design Rules

Use the existing Life OS dark style, but make Finance feel sharper and more operational.

Rules:

- Keep text short.
- Avoid explanatory cards.
- Use rows over boxes where possible.
- Use tabular numbers.
- Place actions next to the data they affect.
- Avoid hiding newly added data.
- Use quiet labels and strong money values.
- Make empty states useful but brief.
- Use one hero cockpit area instead of a row of equal-weight metric cards.
- Use the right rail for action priority, not duplicate summaries.
- Use the month journey lanes to show workflow state without extra text.

### 7.3 Income UI Requirements

Setup > Income should include:

- Add income form.
- Existing income plans list.
- Status.
- Next expected date.
- Account.
- Amount.
- Actions:
  - `Mark received`
  - `Edit`
  - `Pause`
  - `Archive`

Overview should include:

- Expected income row or section.
- Salary status.
- Mark received action if expected income is due or this month.

Timeline should include:

- Expected salary event.
- Received salary event after completion.

### 7.4 Mobile Requirements

Mobile should preserve the workflow:

- Snapshot scrolls horizontally or stacks cleanly.
- Primary action remains reachable.
- Tabs should be horizontally scrollable.
- Timeline rows should not overlap.
- Right inspector should move below main content.

## 8. Backend Implementation Plan

### 8.1 Routes

Add or enhance:

- `GET /api/finance/dashboard`
- `GET /api/finance/timeline`
- `GET /api/finance/recurring-income`
- `POST /api/finance/recurring-income`
- `PATCH /api/finance/recurring-income/:id`
- `POST /api/finance/recurring-income/:id/receive`
- Existing bill, account, transaction, card, and loan routes remain.

### 8.2 Services

Move complex dashboard logic out of a large route file.

Suggested services:

- `finance-dashboard-service.ts`
- `finance-timeline-service.ts`
- `finance-ledger-service.ts`
- `finance-income-service.ts`
- `finance-debt-service.ts`

Reason:

- Safe-to-spend and timeline logic will become business-critical.
- Tests should target services without needing every route.

### 8.3 Contracts

Extend contracts with:

- `FinanceTimelineResponse`
- `FinanceTimelineItem`
- `FinanceTodayActionItem`
- `FinanceSafeToSpendBreakdown`
- `ReceiveRecurringIncomeRequest`
- `ReceiveRecurringIncomeResponse`
- income plan status metadata.
- safe-to-spend breakdown metadata.

Today action item fields:

- `id`
- `sourceType`
- `sourceId`
- `title`
- `amountMinor`
- `date`
- `priority`
- `actionType`
- `status`

Action types:

- `mark_income_received`
- `pay_bill`
- `pay_card_due`
- `pay_emi`
- `add_bill`
- `review_plan`

### 8.4 Tests

Server tests:

- Creating income plan shows in dashboard/setup response.
- Mark salary received creates income transaction.
- Mark salary received advances next expected date.
- Received salary updates account balance.
- Received salary updates income received.
- Expected salary does not update cash before received.
- Timeline shows income, bills, loans, cards, and completed items.
- Safe-to-spend subtracts obligations correctly.
- Bill payments do not double count.
- Card and loan payments update outstanding and account balances.

Client tests or manual verification:

- Income plan appears immediately after adding.
- Mark received updates snapshot.
- Timeline renders empty and populated states.
- Mobile layout does not overlap.
- Setup drawer manages existing items.

## 9. Phased Delivery Plan

### Phase 0: Variant B Layout Shell

Goal:

- Move the screen toward the chosen command-center layout before adding deeper behavior.

Scope:

- Replace the equal metric-strip feel with the `Safe this month` cockpit.
- Add the right rail structure for `Today's money actions`.
- Add month journey lanes for Income, Bills, Debt, and Goals.
- Keep existing tabs and workflows functional.
- Avoid nested-card sprawl while reusing existing data.

Why first:

- It gives the rest of the work the correct UX frame.
- It prevents new features from being added into the old scattered layout.

### Phase 1: Income Visibility and Mark Received

Goal:

- Fix the most confusing current user gap.

Scope:

- Show existing income plans in Setup > Income.
- Show expected income inside the cockpit and month journey.
- Add salary/income action to `Today's money actions`.
- Add `Mark received`.
- Create backend endpoint for receiving income.
- Update dashboard after receive.
- Add tests.

Why first:

- Salary is the anchor of monthly money.
- The user just experienced this gap directly.

### Phase 2: Monthly Timeline

Goal:

- Bring scattered finance events into one monthly flow.

Scope:

- Add timeline endpoint/service.
- Add Timeline tab.
- Include income plans, received income, bills, card dues, loan EMIs.
- Add row-level actions.

Why second:

- The timeline creates the missing product loop.

### Phase 3: Safe-to-Spend Breakdown

Goal:

- Make the hero metric trustworthy.

Scope:

- Add breakdown data.
- Show inspector breakdown.
- Include bills, debt, planned expenses, and goal commitments.
- Add tests for edge cases.

Why third:

- Safe-to-spend only works when the inputs are visible and complete.

### Phase 4: Setup Becomes Management

Goal:

- Make setup a place to review and maintain finance structure.

Scope:

- Manage accounts.
- Manage income plans.
- Manage recurring bills.
- Manage cards and loans.
- Edit/pause/archive flows.

Why fourth:

- Creation without management causes user doubt.

### Phase 5: Reviews and Cross-App Integration

Goal:

- Connect Finance to the rest of Life OS.

Scope:

- Finance actions in Today.
- Finance capture parsing.
- Goal contribution commitments.
- Weekly/monthly money review.
- Missed due reminders.

Why fifth:

- This is where Finance becomes a Life OS behavior loop, not an isolated money page.

## 10. Out of Scope For This Overhaul

Do not prioritize yet:

- Bank sync.
- CSV import.
- Investment tracking.
- Tax reporting.
- Advanced accounting categories.
- Complex multi-currency reconciliation.
- Credit card purchase-level statements.
- Loan amortization schedules.

These may matter later, but the immediate product risk is workflow coherence, not feature breadth.

## 11. Development Checklist

### Product and UX

- [ ] Confirm final Finance product promise.
- [x] Choose Variant B as the target design direction.
- [ ] Confirm `Safe this month` cockpit metrics.
- [ ] Confirm `Today's money actions` priority rules.
- [ ] Confirm month journey lanes.
- [ ] Confirm Timeline tab addition.
- [ ] Confirm safe-to-spend calculation rules.
- [ ] Confirm income plan states.
- [ ] Confirm mobile behavior.

### Phase 0: Variant B Layout Shell

- [x] Replace equal metric strip with `Safe this month` cockpit panel.
- [x] Add compact supporting metrics inside the cockpit.
- [x] Add right rail section for `Today's money actions`.
- [x] Add month journey lanes for Income, Bills, Debt, and Goals.
- [x] Keep existing Overview, Transactions, Bills, Accounts, and Debt workflows reachable.
- [x] Remove or reduce redundant nested cards.
- [x] Ensure empty states are short and action-oriented.
- [ ] Verify desktop visual hierarchy against Variant B.
- [ ] Verify mobile stacking behavior.

### Phase 1: Income Visibility and Mark Received

- [x] Show existing income plans in Setup > Income.
- [x] Add income plan empty state.
- [x] Add income plan row with title, amount, account, next date, and status.
- [x] Add `Mark received` action.
- [x] Add pause/archive actions for income plans.
- [x] Add expected income to the cockpit and month journey.
- [x] Add salary due action to `Today's money actions`.
- [x] Add backend receive-income endpoint.
- [x] Create income transaction when salary is marked received.
- [x] Advance income plan next expected date after receive.
- [x] Update dashboard invalidation after receive.
- [x] Add server tests for receive-income.
- [ ] Manually verify adding salary, reviewing it, and marking it received.

### Phase 2: Monthly Timeline

- [ ] Define `FinanceTimelineItem` contract.
- [ ] Add finance timeline service.
- [ ] Add timeline endpoint.
- [ ] Include expected income plans.
- [ ] Include received income transactions.
- [ ] Include open bills.
- [ ] Include paid bills.
- [ ] Include credit card dues.
- [ ] Include loan EMIs.
- [ ] Add Timeline tab.
- [ ] Add grouped timeline UI.
- [ ] Add row-level actions from timeline.
- [ ] Add empty timeline state.
- [ ] Add server tests for timeline ordering and statuses.
- [ ] Manually verify timeline on desktop and mobile.

### Phase 3: Safe-to-Spend

- [ ] Define safe-to-spend breakdown contract.
- [ ] Include unpaid bills in breakdown.
- [ ] Include card dues in breakdown.
- [ ] Include loan EMIs in breakdown.
- [ ] Include planned expenses in breakdown.
- [ ] Include goal commitments in breakdown.
- [ ] Exclude expected income from cash until received.
- [ ] Add inspector breakdown UI.
- [ ] Add explanation-free but traceable rows.
- [ ] Add safe-to-spend tests for empty and populated states.

### Phase 4: Setup Management

- [ ] Split setup drawer into smaller components.
- [ ] Add account management rows.
- [ ] Add income plan management rows.
- [ ] Add recurring bill management rows.
- [ ] Add credit card management rows.
- [ ] Add loan management rows.
- [ ] Add category management rows.
- [ ] Add edit flows where needed.
- [ ] Add archive/pause flows where needed.
- [ ] Ensure newly created items appear immediately.

### Phase 5: Reviews and Cross-App Integration

- [ ] Add Finance due items to Today when actionable.
- [ ] Add Capture to finance conversion for bills/expenses.
- [ ] Add goal contribution commitments to Finance.
- [ ] Add weekly finance review summary.
- [ ] Add monthly finance review summary.
- [ ] Add missed salary/bill/debt alerts.
- [ ] Add review-driven next month adjustments.

### Technical Quality

- [ ] Split large Finance page into workflow components.
- [ ] Split finance route logic into services.
- [ ] Keep contracts as the source of shared types.
- [ ] Add route tests for every new endpoint.
- [ ] Add service tests for calculations.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run focused server finance tests.
- [ ] Verify mobile layout manually.
- [ ] Verify no dashboard double counting.

## 12. Success Criteria

This overhaul is successful when:

- The screen clearly leads with `Safe this month`.
- The right rail tells the user what money action to take next.
- Income, bills, debt, and goals read as one monthly journey.
- A user can add salary and immediately see it.
- A user can mark salary received and see all money numbers update.
- A user can see the month ahead in one timeline.
- A user can understand safe-to-spend without trusting magic.
- A user can manage accounts, income, bills, cards, and loans from one Finance screen.
- Finance feels like a Life OS command center, not a scattered accounting form.
