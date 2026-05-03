import { describe, expect, it, vi } from "vitest";

import { recordInboxZeroIfEarned } from "../../../src/modules/planning/inbox-zero.js";

describe("inbox zero tracking", () => {
  it("records an audit event and inbox notification when stale count reaches zero", async () => {
    const prisma = {
      task: {
        count: vi.fn().mockResolvedValue(0),
      },
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({
          timezone: "UTC",
          notificationPreferences: {
            inbox: {
              enabled: true,
              minSeverity: "info",
              repeatCadence: "off",
            },
          },
        }),
      },
      auditEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const created = await recordInboxZeroIfEarned(prisma, {
      userId: "user-1",
      targetDate: new Date("2026-03-14T12:00:00.000Z"),
      timezone: "UTC",
      staleCountBefore: 2,
      mutationSource: "task_bulk_schedule",
      affectedTaskIds: ["task-1", "task-2"],
    });

    expect(created).toBe(true);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "inbox.zero_achieved",
          eventPayloadJson: expect.objectContaining({
            localDate: "2026-03-14",
            staleCountBefore: 2,
            staleCountAfter: 0,
            mutationSource: "task_bulk_schedule",
            affectedTaskIds: ["task-1", "task-2"],
          }),
        }),
      }),
    );
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            notificationType: "inbox",
            severity: "INFO",
            entityType: "inbox_zero",
            entityId: "2026-03-14",
            ruleKey: "inbox_zero_achieved",
            deliveryKey: "inbox_zero_achieved|inbox_zero|2026-03-14",
          }),
        ],
      }),
    );
  });

  it("does nothing when stale items remain after the mutation", async () => {
    const prisma = {
      task: {
        count: vi.fn().mockResolvedValue(1),
      },
      userPreference: {
        findUnique: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      notification: {
        findFirst: vi.fn(),
        createMany: vi.fn(),
      },
    } as any;

    const created = await recordInboxZeroIfEarned(prisma, {
      userId: "user-1",
      targetDate: new Date("2026-03-14T12:00:00.000Z"),
      timezone: "UTC",
      staleCountBefore: 1,
      mutationSource: "task_update",
      affectedTaskIds: ["task-1"],
    });

    expect(created).toBe(false);
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
