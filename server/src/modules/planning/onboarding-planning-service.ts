import type { Prisma, PrismaClient } from "@prisma/client";

import { ensureGoalConfigSeeded } from "./goal-config.js";

type Tx = PrismaClient | Prisma.TransactionClient;

export async function ensureOnboardingGoalConfigSeeded(prisma: Tx, userId: string) {
  await ensureGoalConfigSeeded(prisma, userId);
}
