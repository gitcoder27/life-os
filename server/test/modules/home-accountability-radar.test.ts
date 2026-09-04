import { describe, expect, it } from "vitest";

import { buildAccountabilityRadar } from "../../src/modules/home/home-accountability-radar.js";

describe("home accountability radar", () => {
  it("serializes overdue and stale inbox tasks with labels and overflow counts", () => {
    const radar = buildAccountabilityRadar({
      targetIsoDate: "2026-03-14",
      timezone: "UTC",
      overdueTasks: [
        {
          id: "task-1",
          title: "Pay invoice",
          scheduledForDate: new Date("2026-03-12T00:00:00.000Z"),
          createdAt: new Date("2026-03-10T08:00:00.000Z"),
          notes: "Vendor A",
          kind: "TASK",
          reminderAt: null,
          originType: "MANUAL",
        },
      ],
      staleInboxTasks: Array.from({ length: 5 }, (_, index) => ({
        id: `inbox-${index + 1}`,
        title: `Inbox item ${index + 1}`,
        scheduledForDate: null,
        createdAt: new Date("2026-03-11T08:00:00.000Z"),
        notes: null,
        kind: "NOTE" as const,
        reminderAt: null,
        originType: "QUICK_CAPTURE" as const,
      })),
    });

    expect(radar).toMatchObject({
      overdueTaskCount: 1,
      staleInboxCount: 5,
      totalCount: 6,
      overflowCount: 1,
    });
    expect(radar.items).toHaveLength(5);
    expect(radar.items[0]).toMatchObject({
      id: "task-1",
      kind: "overdue_task",
      label: "Overdue by 2 days",
      route: "/today",
      taskKind: "task",
      originType: "manual",
    });
    expect(radar.items[1]).toMatchObject({
      id: "inbox-1",
      kind: "stale_inbox",
      label: "Inbox for 3 days",
      route: "/inbox",
      taskKind: "note",
      originType: "quick_capture",
    });
  });
});
