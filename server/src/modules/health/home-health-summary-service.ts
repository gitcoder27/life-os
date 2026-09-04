import type { PrismaClient } from "@prisma/client";
import type { HealthSummary } from "@life-os/contracts";

type HomeHealthPrisma = Pick<PrismaClient, "waterLog" | "mealLog" | "workoutDay">;

export async function loadHomeHealthSummary(
  prisma: HomeHealthPrisma,
  input: {
    userId: string;
    targetDate: Date;
    dayWindow: {
      start: Date;
      end: Date;
    };
    waterTargetMl: number;
  },
): Promise<HealthSummary> {
  const [waterLogs, mealLogs, workoutDay] = await Promise.all([
    prisma.waterLog.findMany({
      where: {
        userId: input.userId,
        occurredAt: {
          gte: input.dayWindow.start,
          lt: input.dayWindow.end,
        },
      },
    }),
    prisma.mealLog.findMany({
      where: {
        userId: input.userId,
        occurredAt: {
          gte: input.dayWindow.start,
          lt: input.dayWindow.end,
        },
      },
    }),
    prisma.workoutDay.findUnique({
      where: {
        userId_date: {
          userId: input.userId,
          date: input.targetDate,
        },
      },
    }),
  ]);

  return {
    waterMl: waterLogs.reduce((sum, log) => sum + log.amountMl, 0),
    waterTargetMl: input.waterTargetMl,
    mealsLogged: mealLogs.length,
    workoutStatus:
      workoutDay?.actualStatus === "COMPLETED"
        ? "completed"
        : workoutDay?.actualStatus === "RECOVERY_RESPECTED"
          ? "recovery_respected"
          : workoutDay?.actualStatus === "FALLBACK"
            ? "fallback"
            : workoutDay?.actualStatus === "MISSED"
              ? "missed"
              : "none",
  };
}
