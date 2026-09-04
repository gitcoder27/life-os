import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { materializeRecurringTasksInRange } from "../../src/lib/recurrence/tasks.js";
import { registerFinanceBillRoutes } from "../../src/modules/finance/finance-bill-routes.js";
import { payCreditCardDebt, payLoanDebt } from "../../src/modules/finance/finance-debt-service.js";
import { ensureGeneratedNotification } from "../../src/modules/notifications/service.js";
import { normalizeNotificationPreferences } from "../../src/modules/notifications/policy.js";
import { registerOnboardingRoutes } from "../../src/modules/onboarding/routes.js";
import { isPlannerBlockOverlapConstraintError } from "../../src/modules/planning/planning-repository.js";
import { resetWorkspaceData } from "../../src/modules/settings/workspace-reset.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runIntegrationTests = Boolean(testDatabaseUrl);

let prisma: PrismaClient;

function getDatabaseName(databaseUrl: string) {
  return new URL(databaseUrl).pathname.replace(/^\//, "");
}

function assertSafeTestDatabase(databaseUrl: string) {
  const databaseName = getDatabaseName(databaseUrl);

  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run integration tests against non-test database "${databaseName}". Set TEST_DATABASE_URL to an isolated test database.`,
    );
  }
}

async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "RecurrenceRule" RESTART IDENTITY CASCADE');
}

async function createUser(emailPrefix = randomUUID()) {
  return prisma.user.create({
    data: {
      email: `${emailPrefix}@example.com`,
      passwordHash: "test-password-hash",
      preferences: {
        create: {
          timezone: "UTC",
          weekStartsOn: 1,
        },
      },
    },
  });
}

async function createTask(userId: string, title = "Integration task") {
  return prisma.task.create({
    data: {
      userId,
      title,
      kind: "TASK",
      originType: "MANUAL",
      scheduledForDate: new Date("2026-05-19T00:00:00.000Z"),
    },
  });
}

async function createAuthenticatedApp(user: Awaited<ReturnType<typeof createUser>>) {
  const app = Fastify({ logger: false });

  app.decorate("prisma", prisma);
  app.decorateRequest("auth", null);
  app.addHook("onRequest", async (request) => {
    request.auth = {
      sessionToken: "integration-session-token",
      sessionId: "integration-session-id",
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
      },
    };
  });

  return app;
}

async function closeApp(app: FastifyInstance | null) {
  if (!app) {
    return;
  }

  await app.close();
}

describe.skipIf(!runIntegrationTests)("database-backed invariants", () => {
  beforeAll(async () => {
    assertSafeTestDatabase(testDatabaseUrl!);
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testDatabaseUrl,
        },
      },
    });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await resetDatabase();
    await prisma.$disconnect();
  });

  it("keeps recurring task materialization idempotent under overlapping runs", async () => {
    const user = await createUser();
    const ruleId = randomUUID();
    const prototypeTaskId = randomUUID();

    await prisma.recurrenceRule.create({
      data: {
        id: ruleId,
        ownerType: "TASK",
        ownerId: prototypeTaskId,
        ruleJson: {
          frequency: "daily",
          startsOn: "2026-05-20",
          end: {
            type: "never",
          },
        },
        legacyRuleText: "db-invariants-test",
      },
    });
    await prisma.task.create({
      data: {
        id: prototypeTaskId,
        userId: user.id,
        title: "Recurring planning block",
        kind: "TASK",
        originType: "RECURRING",
        scheduledForDate: new Date("2026-05-19T00:00:00.000Z"),
        recurrenceRuleId: ruleId,
      },
    });

    const materializationCounts = await Promise.all([
      materializeRecurringTasksInRange(
        prisma,
        user.id,
        new Date("2026-05-20T00:00:00.000Z"),
        new Date("2026-05-20T00:00:00.000Z"),
      ),
      materializeRecurringTasksInRange(
        prisma,
        user.id,
        new Date("2026-05-20T00:00:00.000Z"),
        new Date("2026-05-20T00:00:00.000Z"),
      ),
    ]);

    expect(materializationCounts.reduce((sum, count) => sum + count, 0)).toBe(1);
    await expect(
      prisma.task.create({
        data: {
          userId: user.id,
          title: "Duplicate recurring planning block",
          kind: "TASK",
          originType: "RECURRING",
          scheduledForDate: new Date("2026-05-20T00:00:00.000Z"),
          recurrenceRuleId: ruleId,
        },
      }),
    ).rejects.toMatchObject({
      code: "P2002",
    });
    await expect(prisma.task.count({
      where: {
        userId: user.id,
        recurrenceRuleId: ruleId,
        scheduledForDate: new Date("2026-05-20T00:00:00.000Z"),
      },
    })).resolves.toBe(1);
  });

  it("enforces one active focus session per user while allowing completed history", async () => {
    const user = await createUser();
    const firstTask = await createTask(user.id, "First focus task");
    const secondTask = await createTask(user.id, "Second focus task");

    await prisma.focusSession.create({
      data: {
        userId: user.id,
        taskId: firstTask.id,
        depth: "DEEP",
        plannedMinutes: 25,
        startedAt: new Date("2026-05-19T09:00:00.000Z"),
      },
    });

    await expect(
      prisma.focusSession.create({
        data: {
          userId: user.id,
          taskId: secondTask.id,
          depth: "SHALLOW",
          plannedMinutes: 15,
          startedAt: new Date("2026-05-19T09:05:00.000Z"),
        },
      }),
    ).rejects.toMatchObject({
      code: "P2002",
    });

    await expect(
      prisma.focusSession.create({
        data: {
          userId: user.id,
          taskId: secondTask.id,
          depth: "SHALLOW",
          plannedMinutes: 15,
          startedAt: new Date("2026-05-19T10:00:00.000Z"),
          endedAt: new Date("2026-05-19T10:15:00.000Z"),
          status: "COMPLETED",
        },
      }),
    ).resolves.toMatchObject({
      status: "COMPLETED",
    });
  });

  it("makes generated notifications idempotent with the delivery-key unique constraint", async () => {
    const user = await createUser();
    const notificationInput = {
      userId: user.id,
      notificationType: "finance" as const,
      severity: "WARNING" as const,
      title: "Bill due",
      body: "Rent is due soon.",
      entityType: "bill",
      entityId: "rent",
      ruleKey: "bill_due",
      timezone: "UTC",
      now: new Date("2026-05-19T10:15:00.000Z"),
      notificationPreferences: normalizeNotificationPreferences({
        finance: {
          enabled: true,
          minSeverity: "warning",
          repeatCadence: "hourly",
        },
      }),
    };

    const results = await Promise.all([
      ensureGeneratedNotification(prisma, notificationInput),
      ensureGeneratedNotification(prisma, notificationInput),
    ]);
    const createdNotification = await prisma.notification.findFirstOrThrow({
      where: {
        userId: user.id,
        ruleKey: "bill_due",
        entityType: "bill",
        entityId: "rent",
      },
    });

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(prisma.notification.count({
      where: {
        userId: user.id,
        deliveryKey: createdNotification.deliveryKey,
      },
    })).resolves.toBe(1);
    await expect(
      prisma.notification.create({
        data: {
          userId: user.id,
          notificationType: "finance",
          severity: "WARNING",
          title: "Duplicate bill due",
          body: "Rent is due soon.",
          entityType: "bill",
          entityId: "rent",
          ruleKey: "bill_due",
          deliveryKey: createdNotification.deliveryKey,
        },
      }),
    ).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("rejects overlapping planner blocks in the same planning cycle", async () => {
    const user = await createUser();
    const cycle = await prisma.planningCycle.create({
      data: {
        userId: user.id,
        cycleType: "DAY",
        cycleStartDate: new Date("2026-05-19T00:00:00.000Z"),
        cycleEndDate: new Date("2026-05-19T00:00:00.000Z"),
      },
    });

    await prisma.dayPlannerBlock.create({
      data: {
        planningCycleId: cycle.id,
        title: "Deep work",
        startsAt: new Date("2026-05-19T09:00:00.000Z"),
        endsAt: new Date("2026-05-19T10:00:00.000Z"),
        sortOrder: 1,
      },
    });

    const createOverlappingBlock = () => prisma.dayPlannerBlock.create({
      data: {
        planningCycleId: cycle.id,
        title: "Overlapping admin",
        startsAt: new Date("2026-05-19T09:30:00.000Z"),
        endsAt: new Date("2026-05-19T10:30:00.000Z"),
        sortOrder: 2,
      },
    });

    await expect(createOverlappingBlock()).rejects.toThrow(/DayPlannerBlock_no_overlap_per_cycle/);

    try {
      await createOverlappingBlock();
    } catch (error) {
      expect(isPlannerBlockOverlapConstraintError(error)).toBe(true);
      return;
    }

    throw new Error("Expected overlapping planner block insert to fail.");
  });

  it("resets workspace data while preserving account, preferences, sessions, and audit history", async () => {
    const user = await createUser();
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        onboardedAt: new Date("2026-05-18T08:00:00.000Z"),
      },
    });
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionTokenHash: `session-${randomUUID()}`,
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    });
    const task = await createTask(user.id, "Reset me task");
    const habit = await prisma.habit.create({
      data: {
        userId: user.id,
        title: "Reset me habit",
        targetPerDay: 1,
        scheduleRuleJson: {
          cadence: "daily",
        },
      },
    });
    await prisma.recurrenceRule.createMany({
      data: [
        {
          ownerType: "TASK",
          ownerId: task.id,
          ruleJson: {
            frequency: "daily",
            startsOn: "2026-05-19",
          },
        },
        {
          ownerType: "HABIT",
          ownerId: habit.id,
          ruleJson: {
            frequency: "daily",
            startsOn: "2026-05-19",
          },
        },
      ],
    });
    const account = await prisma.financeAccount.create({
      data: {
        userId: user.id,
        name: "Checking",
        currencyCode: "USD",
      },
    });
    await prisma.financeTransaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        transactionType: "EXPENSE",
        amountMinor: 1200,
        currencyCode: "USD",
        occurredOn: new Date("2026-05-19T00:00:00.000Z"),
        description: "Reset me transaction",
      },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        notificationType: "planning",
        severity: "INFO",
        title: "Reset me notification",
        body: "Workspace reset should clear this.",
        ruleKey: "integration_reset_seed",
        deliveryKey: `integration-reset:${user.id}`,
      },
    });

    await prisma.$transaction((tx) =>
      resetWorkspaceData(tx, {
        userId: user.id,
        resetAt: "2026-05-19T12:00:00.000Z",
      }),
    );

    await expect(prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
      include: {
        preferences: true,
        sessions: true,
      },
    })).resolves.toMatchObject({
      id: user.id,
      onboardedAt: null,
      preferences: {
        userId: user.id,
      },
      sessions: [
        {
          userId: user.id,
        },
      ],
    });
    await expect(prisma.task.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.habit.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.recurrenceRule.count()).resolves.toBe(0);
    await expect(prisma.financeTransaction.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.notification.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.auditEvent.findFirst({
      where: {
        userId: user.id,
        eventType: "settings.workspace_reset",
      },
    })).resolves.toMatchObject({
      eventType: "settings.workspace_reset",
    });
  });

  it("completes onboarding with real database writes across seeded domains", async () => {
    const user = await createUser();
    const app = await createAuthenticatedApp(user);

    try {
      await app.register(registerOnboardingRoutes);
      await app.ready();

      const response = await app.inject({
        method: "POST",
        url: "/complete",
        payload: {
          displayName: "Integration Owner",
          timezone: "UTC",
          currencyCode: "USD",
          weekStartsOn: 1,
          dailyWaterTargetMl: 2800,
          dailyReviewStartTime: "8pm",
          dailyReviewEndTime: "10:00",
          lifePriorities: ["Build stable routines"],
          goals: [
            {
              title: "Ship the stabilization pass",
              domain: "work_growth",
              targetDate: "2026-06-30",
            },
          ],
          habits: [
            {
              title: "Hydrate",
              targetPerDay: 2,
              scheduleRuleJson: {
                cadence: "daily",
              },
            },
          ],
          routines: [
            {
              name: "Morning Reset",
              period: "morning",
              items: [
                {
                  title: "Review plan",
                  isRequired: true,
                },
              ],
            },
          ],
          expenseCategories: [
            {
              name: "Utilities",
              color: "#3366ff",
            },
          ],
          mealTemplates: [
            {
              name: "Protein breakfast",
              mealSlot: "breakfast",
              description: "Eggs and fruit",
            },
          ],
          firstRecurringBill: {
            title: "Internet",
            categoryName: "Utilities",
            defaultAmountMinor: 5500,
            cadence: "monthly",
            nextDueOn: "2026-05-25",
            remindDaysBefore: 2,
          },
          firstWeekStartDate: "2026-05-18",
          firstMonthStartDate: "2026-05-01",
        },
      });

      expect(response.statusCode).toBe(202);
      await expect(prisma.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },
        include: {
          preferences: true,
        },
      })).resolves.toMatchObject({
        displayName: "Integration Owner",
        preferences: {
          timezone: "UTC",
          currencyCode: "USD",
          dailyWaterTargetMl: 2800,
          dailyReviewStartTime: "20:00",
        },
      });
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(prisma.habit.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(prisma.routineItem.count({
        where: {
          routine: {
            userId: user.id,
          },
        },
      })).resolves.toBe(1);
      await expect(prisma.expenseCategory.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(prisma.recurringExpenseTemplate.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(prisma.adminItem.count({
        where: {
          userId: user.id,
          itemType: "BILL",
          title: "Internet",
        },
      })).resolves.toBe(1);
      await expect(prisma.mealTemplate.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(prisma.planningCycle.count({ where: { userId: user.id } })).resolves.toBe(2);
      await expect(prisma.auditEvent.findFirst({
        where: {
          userId: user.id,
          eventType: "onboarding.completed",
        },
      })).resolves.toMatchObject({
        eventType: "onboarding.completed",
      });
    } finally {
      await closeApp(app);
    }
  });

  it("updates credit-card and loan balances from repeated payments without stale reads", async () => {
    const user = await createUser();
    const account = await prisma.financeAccount.create({
      data: {
        userId: user.id,
        name: "Checking",
        currencyCode: "USD",
      },
    });
    const creditCard = await prisma.creditCard.create({
      data: {
        userId: user.id,
        paymentAccountId: account.id,
        name: "Travel Card",
        currencyCode: "USD",
        creditLimitMinor: 100000,
        outstandingBalanceMinor: 10000,
        minimumDueMinor: 4000,
      },
    });
    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        paymentAccountId: account.id,
        name: "Laptop Loan",
        currencyCode: "USD",
        outstandingBalanceMinor: 10000,
        emiAmountMinor: 3500,
      },
    });

    await Promise.all([
      payCreditCardDebt(prisma, creditCard.id, {
        userId: user.id,
        amountMinor: 2000,
        paidOn: "2026-05-19",
      }),
      payCreditCardDebt(prisma, creditCard.id, {
        userId: user.id,
        amountMinor: 3000,
        paidOn: "2026-05-19",
      }),
      payLoanDebt(prisma, loan.id, {
        userId: user.id,
        amountMinor: 3500,
        paidOn: "2026-05-19",
      }),
      payLoanDebt(prisma, loan.id, {
        userId: user.id,
        amountMinor: 3500,
        paidOn: "2026-05-19",
      }),
    ]);

    await expect(prisma.creditCard.findUniqueOrThrow({
      where: {
        id: creditCard.id,
      },
    })).resolves.toMatchObject({
      outstandingBalanceMinor: 5000,
      minimumDueMinor: 0,
    });
    await expect(prisma.loan.findUniqueOrThrow({
      where: {
        id: loan.id,
      },
    })).resolves.toMatchObject({
      outstandingBalanceMinor: 3000,
      status: "ACTIVE",
    });
    await expect(prisma.financeTransaction.count({
      where: {
        userId: user.id,
        accountId: account.id,
      },
    })).resolves.toBe(4);
  });

  it("pays and logs a bill once while keeping repeated submissions idempotent", async () => {
    const user = await createUser();
    const app = await createAuthenticatedApp(user);
    const category = await prisma.expenseCategory.create({
      data: {
        userId: user.id,
        name: "Utilities",
        color: "#3366ff",
      },
    });
    const account = await prisma.financeAccount.create({
      data: {
        userId: user.id,
        name: "Checking",
        currencyCode: "USD",
      },
    });
    const bill = await prisma.adminItem.create({
      data: {
        userId: user.id,
        title: "Electricity",
        itemType: "BILL",
        dueOn: new Date("2026-05-20T00:00:00.000Z"),
        amountMinor: 6400,
        expenseCategoryId: category.id,
      },
    });

    try {
      await app.register(registerFinanceBillRoutes);
      await app.ready();

      const payload = {
        paidOn: "2026-05-19",
        amountMinor: 6400,
        currencyCode: "USD",
        expenseCategoryId: category.id,
        accountId: account.id,
        description: "Electricity payment",
      };
      const firstResponse = await app.inject({
        method: "POST",
        url: `/bills/${bill.id}/pay-and-log`,
        payload,
      });
      const secondResponse = await app.inject({
        method: "POST",
        url: `/bills/${bill.id}/pay-and-log`,
        payload,
      });

      expect(firstResponse.statusCode).toBe(200);
      expect(secondResponse.statusCode).toBe(200);
      await expect(prisma.adminItem.findUniqueOrThrow({
        where: {
          id: bill.id,
        },
        include: {
          linkedExpense: true,
        },
      })).resolves.toMatchObject({
        status: "DONE",
        completionMode: "PAY_AND_LOG",
        amountMinor: 6400,
        linkedExpense: {
          amountMinor: 6400,
          billId: bill.id,
        },
      });
      await expect(prisma.expense.count({
        where: {
          userId: user.id,
          billId: bill.id,
        },
      })).resolves.toBe(1);
      await expect(prisma.financeTransaction.count({
        where: {
          userId: user.id,
          billId: bill.id,
        },
      })).resolves.toBe(1);
    } finally {
      await closeApp(app);
    }
  });
});
