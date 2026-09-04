import type { Prisma, PrismaClient } from "@prisma/client";

const cyclePriorityGoalSummaryInclude = {
  domain: true,
} as const;

const planningCycleInclude = {
  priorities: {
    orderBy: {
      slot: "asc",
    },
    include: {
      goal: {
        include: cyclePriorityGoalSummaryInclude,
      },
    },
  },
  dailyReview: true,
  dailyScore: true,
  weeklyReview: true,
  monthlyReview: true,
} satisfies Prisma.PlanningCycleInclude;

const isPrismaErrorCode = (error: unknown, code: string) => (
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === code
);

export const ensureCycle = async (
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    userId: string;
    cycleType: "DAY" | "WEEK" | "MONTH";
    cycleStartDate: Date;
    cycleEndDate: Date;
  },
) => {
  const where = {
    userId_cycleType_cycleStartDate: {
      userId: input.userId,
      cycleType: input.cycleType,
      cycleStartDate: input.cycleStartDate,
    },
  } satisfies Prisma.PlanningCycleWhereUniqueInput;

  try {
    return await prisma.planningCycle.upsert({
      where,
      update: {
        cycleEndDate: input.cycleEndDate,
      },
      create: input,
      include: planningCycleInclude,
    });
  } catch (error) {
    if (!isPrismaErrorCode(error, "P2002")) {
      throw error;
    }

    const existingCycle = await prisma.planningCycle.findUnique({
      where,
      include: planningCycleInclude,
    });

    if (!existingCycle) {
      throw error;
    }

    if (existingCycle.cycleEndDate.getTime() === input.cycleEndDate.getTime()) {
      return existingCycle;
    }

    return prisma.planningCycle.update({
      where,
      data: {
        cycleEndDate: input.cycleEndDate,
      },
      include: planningCycleInclude,
    });
  }
};
