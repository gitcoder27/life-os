# Prisma Migration History Notes

Applied migrations are immutable in shared environments. Do not rename or rewrite
historical migration directories after they may have been applied.

Known low-risk history debris:

- `20260402094100_goals_hq` is an intentional no-op. It was created before
  `Routine.sortOrder` existed and is kept in place so later migrations retain a
  stable history.
- `20260417203901_weekly_capacity_planning` is misnamed. Its SQL updates the
  `FinanceMonthPlanCategoryWatch` foreign key behavior and renames its unique
  index; the actual weekly capacity columns were added by
  `20260418120000_weekly_capacity_planning`.

Future migration directory names should describe the actual schema change.
