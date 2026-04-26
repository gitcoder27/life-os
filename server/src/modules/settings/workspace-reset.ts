import type { Prisma } from "@prisma/client";

import { createAuditEvent } from "../auth/service.js";

type Tx = Prisma.TransactionClient;

function buildRecurrenceTargets(
  ownerType: "TASK" | "HABIT" | "RECURRING_EXPENSE",
  ownerIds: string[],
) {
  return ownerIds.map((ownerId) => ({
    ownerType,
    ownerId,
  }));
}

export async function resetWorkspaceData(
  tx: Tx,
  input: {
    userId: string;
    resetAt: string;
  },
) {
  const { userId, resetAt } = input;

  const [tasks, habits, recurringExpenses] = await Promise.all([
    tx.task.findMany({
      where: { userId },
      select: { id: true },
    }),
    tx.habit.findMany({
      where: { userId },
      select: { id: true },
    }),
    tx.recurringExpenseTemplate.findMany({
      where: { userId },
      select: { id: true },
    }),
  ]);

  const recurrenceTargets = [
    ...buildRecurrenceTargets("TASK", tasks.map((task) => task.id)),
    ...buildRecurrenceTargets("HABIT", habits.map((habit) => habit.id)),
    ...buildRecurrenceTargets("RECURRING_EXPENSE", recurringExpenses.map((expense) => expense.id)),
  ];

  if (recurrenceTargets.length > 0) {
    await tx.recurrenceRule.deleteMany({
      where: {
        OR: recurrenceTargets,
      },
    });
  }

  await tx.notification.deleteMany({ where: { userId } });
  await tx.taskTemplate.deleteMany({ where: { userId } });

  await tx.waterLog.deleteMany({ where: { userId } });
  await tx.mealLog.deleteMany({ where: { userId } });
  await tx.mealPlanWeek.deleteMany({ where: { userId } });
  await tx.mealTemplate.deleteMany({ where: { userId } });
  await tx.workoutDay.deleteMany({ where: { userId } });
  await tx.weightLog.deleteMany({ where: { userId } });

  await tx.financeMonthPlan.deleteMany({ where: { userId } });
  await tx.recurringIncomeTemplate.deleteMany({ where: { userId } });
  await tx.creditCard.deleteMany({ where: { userId } });
  await tx.loan.deleteMany({ where: { userId } });
  await tx.financeTransaction.deleteMany({ where: { userId } });
  await tx.financeAccount.deleteMany({ where: { userId } });
  await tx.expense.deleteMany({ where: { userId } });
  await tx.adminItem.deleteMany({ where: { userId } });
  await tx.recurringExpenseTemplate.deleteMany({ where: { userId } });
  await tx.expenseCategory.deleteMany({ where: { userId } });

  await tx.routine.deleteMany({ where: { userId } });
  await tx.habit.deleteMany({ where: { userId } });
  await tx.task.deleteMany({ where: { userId } });
  await tx.planningCycle.deleteMany({ where: { userId } });

  await tx.goal.deleteMany({ where: { userId } });
  await tx.goalDomainConfig.deleteMany({ where: { userId } });
  await tx.goalHorizonConfig.deleteMany({ where: { userId } });

  await tx.user.update({
    where: { id: userId },
    data: { onboardedAt: null },
  });

  await createAuditEvent(tx, {
    userId,
    eventType: "settings.workspace_reset",
    eventPayloadJson: {
      resetAt,
      preserved: ["account", "preferences", "sessions", "audit_history"],
    },
  });
}
