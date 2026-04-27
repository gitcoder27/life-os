import { describe, expect, it, vi } from "vitest";

import {
  replaceGoalDomainConfigs,
  replaceGoalHorizonConfigs,
} from "../../../src/modules/planning/planning-repository.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";

describe("goal config repository", () => {
  it("moves existing domains to temporary sort orders before final reorder", async () => {
    const prisma = createMockPrisma();
    const now = new Date("2026-04-09T00:00:00.000Z");
    const existingDomains = [
      {
        id: "domain-a",
        userId: USER_ID,
        systemKey: null,
        name: "A",
        sortOrder: 1,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "domain-b",
        userId: USER_ID,
        systemKey: null,
        name: "B",
        sortOrder: 2,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    prisma.goalDomainConfig.findMany
      .mockResolvedValueOnce(existingDomains)
      .mockResolvedValueOnce(existingDomains)
      .mockResolvedValueOnce([...existingDomains].reverse());
    prisma.goalHorizonConfig.findMany.mockResolvedValueOnce([{ id: "horizon-seeded", sortOrder: 1 }]);

    await replaceGoalDomainConfigs({ prisma } as any, USER_ID, [
      { id: "domain-b", name: "B" },
      { id: "domain-a", name: "A" },
    ]);

    const updateCalls = prisma.goalDomainConfig.update.mock.calls.map(([args]) => args);
    expect(updateCalls).toEqual([
      expect.objectContaining({
        where: { id: "domain-b" },
        data: { sortOrder: 5 },
      }),
      expect.objectContaining({
        where: { id: "domain-a" },
        data: { sortOrder: 6 },
      }),
      expect.objectContaining({
        where: { id: "domain-b" },
        data: expect.objectContaining({ name: "B", sortOrder: 1 }),
      }),
      expect.objectContaining({
        where: { id: "domain-a" },
        data: expect.objectContaining({ name: "A", sortOrder: 2 }),
      }),
    ]);
  });

  it("moves existing horizons to temporary sort orders before final reorder", async () => {
    const prisma = createMockPrisma();
    const now = new Date("2026-04-09T00:00:00.000Z");
    const existingHorizons = [
      {
        id: "horizon-a",
        userId: USER_ID,
        systemKey: null,
        name: "A",
        sortOrder: 1,
        spanMonths: 12,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "horizon-b",
        userId: USER_ID,
        systemKey: null,
        name: "B",
        sortOrder: 2,
        spanMonths: 3,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    prisma.goalDomainConfig.findMany.mockResolvedValueOnce([{ id: "domain-seeded", sortOrder: 1 }]);
    prisma.goalHorizonConfig.findMany
      .mockResolvedValueOnce(existingHorizons)
      .mockResolvedValueOnce(existingHorizons)
      .mockResolvedValueOnce([...existingHorizons].reverse());

    await replaceGoalHorizonConfigs({ prisma } as any, USER_ID, [
      { id: "horizon-b", name: "B", spanMonths: 3 },
      { id: "horizon-a", name: "A", spanMonths: 12 },
    ]);

    const updateCalls = prisma.goalHorizonConfig.update.mock.calls.map(([args]) => args);
    expect(updateCalls).toEqual([
      expect.objectContaining({
        where: { id: "horizon-b" },
        data: { sortOrder: 5 },
      }),
      expect.objectContaining({
        where: { id: "horizon-a" },
        data: { sortOrder: 6 },
      }),
      expect.objectContaining({
        where: { id: "horizon-b" },
        data: expect.objectContaining({ name: "B", spanMonths: 3, sortOrder: 1 }),
      }),
      expect.objectContaining({
        where: { id: "horizon-a" },
        data: expect.objectContaining({ name: "A", spanMonths: 12, sortOrder: 2 }),
      }),
    ]);
  });
});
