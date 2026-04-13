import type {
  GoalDomainInput,
  GoalDomainSystemKey,
  GoalHorizonInput,
  GoalHorizonSystemKey,
} from "@life-os/contracts";
import type { PrismaClient, Prisma } from "@prisma/client";

import {
  toPrismaGoalDomainSystemKey,
  toPrismaGoalHorizonSystemKey,
} from "./planning-mappers.js";

type Tx = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_GOAL_DOMAINS: Array<{
  systemKey: GoalDomainSystemKey;
  name: string;
}> = [
  { systemKey: "unassigned", name: "Unassigned" },
  { systemKey: "health", name: "Health" },
  { systemKey: "money", name: "Money" },
  { systemKey: "work_growth", name: "Work & Growth" },
  { systemKey: "home_admin", name: "Home & Admin" },
  { systemKey: "discipline", name: "Discipline" },
  { systemKey: "other", name: "Other" },
];

export const DEFAULT_GOAL_HORIZONS: Array<{
  systemKey: GoalHorizonSystemKey;
  name: string;
  spanMonths: number | null;
}> = [
  { systemKey: "life_vision", name: "Life Vision", spanMonths: null },
  { systemKey: "five_year", name: "5-Year", spanMonths: 60 },
  { systemKey: "one_year", name: "1-Year", spanMonths: 12 },
  { systemKey: "quarter", name: "Quarter", spanMonths: 3 },
  { systemKey: "month", name: "Month", spanMonths: 1 },
];

export function normalizeGoalConfigName(name: string) {
  return name.trim();
}

export async function ensureGoalConfigSeeded(prisma: Tx, userId: string) {
  const [existingDomains, existingHorizons] = await Promise.all([
    prisma.goalDomainConfig.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.goalHorizonConfig.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (existingDomains.length === 0) {
    await prisma.goalDomainConfig.createMany({
      data: DEFAULT_GOAL_DOMAINS.map((domain, index) => ({
        userId,
        systemKey: toPrismaGoalDomainSystemKey(domain.systemKey),
        name: domain.name,
        sortOrder: index + 1,
      })),
    });
  } else {
    const missingDomains = DEFAULT_GOAL_DOMAINS.filter((domain) =>
      !existingDomains.some((existingDomain) => existingDomain.systemKey === toPrismaGoalDomainSystemKey(domain.systemKey)));

    if (missingDomains.length > 0) {
      const nextSortOrder = existingDomains.reduce(
        (maxSortOrder, domain) => Math.max(maxSortOrder, domain.sortOrder),
        0,
      ) + 1;

      await prisma.goalDomainConfig.createMany({
        data: missingDomains.map((domain, index) => ({
          userId,
          systemKey: toPrismaGoalDomainSystemKey(domain.systemKey),
          name: domain.name,
          sortOrder: nextSortOrder + index,
        })),
      });
    }
  }

  if (existingHorizons.length === 0) {
    await prisma.goalHorizonConfig.createMany({
      data: DEFAULT_GOAL_HORIZONS.map((horizon, index) => ({
        userId,
        systemKey: toPrismaGoalHorizonSystemKey(horizon.systemKey),
        name: horizon.name,
        sortOrder: index + 1,
        spanMonths: horizon.spanMonths,
      })),
    });
  } else {
    const missingHorizons = DEFAULT_GOAL_HORIZONS.filter((horizon) =>
      !existingHorizons.some((existingHorizon) => existingHorizon.systemKey === toPrismaGoalHorizonSystemKey(horizon.systemKey)));

    if (missingHorizons.length > 0) {
      const nextSortOrder = existingHorizons.reduce(
        (maxSortOrder, horizon) => Math.max(maxSortOrder, horizon.sortOrder),
        0,
      ) + 1;

      await prisma.goalHorizonConfig.createMany({
        data: missingHorizons.map((horizon, index) => ({
          userId,
          systemKey: toPrismaGoalHorizonSystemKey(horizon.systemKey),
          name: horizon.name,
          sortOrder: nextSortOrder + index,
          spanMonths: horizon.spanMonths,
        })),
      });
    }
  }
}

export function normalizeGoalDomainInputs(domains: GoalDomainInput[]) {
  return domains.map((domain) => ({
    ...domain,
    name: normalizeGoalConfigName(domain.name),
    isArchived: domain.isArchived ?? false,
    systemKey: domain.systemKey ?? null,
  }));
}

export function normalizeGoalHorizonInputs(horizons: GoalHorizonInput[]) {
  return horizons.map((horizon) => ({
    ...horizon,
    name: normalizeGoalConfigName(horizon.name),
    isArchived: horizon.isArchived ?? false,
    systemKey: horizon.systemKey ?? null,
    spanMonths: horizon.spanMonths ?? null,
  }));
}
