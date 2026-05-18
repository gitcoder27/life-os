import { afterEach, describe, expect, it, vi } from "vitest";

import type { NotificationItem } from "../../shared/lib/api";
import { setPreferredTimezone } from "../../shared/lib/date";
import {
  formatNotificationTime,
  groupBySeverity,
  isTonightAvailable,
  resolveActionLabel,
  resolveNotificationTarget,
} from "./notification-center-model";

const makeNotification = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: "notification-1",
  notificationType: "task",
  severity: "info",
  title: "Notification",
  body: "Body",
  action: null,
  entityType: null,
  entityId: null,
  ruleKey: "rule",
  visibleFrom: null,
  expiresAt: null,
  read: false,
  readAt: null,
  dismissedAt: null,
  createdAt: "2026-05-03T12:00:00.000Z",
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  setPreferredTimezone("");
});

describe("notification center model", () => {
  it("groups notifications by severity in attention order", () => {
    const groups = groupBySeverity([
      makeNotification({ id: "info", severity: "info" }),
      makeNotification({ id: "critical", severity: "critical" }),
      makeNotification({ id: "warning", severity: "warning" }),
    ]);

    expect(groups.map((group) => group.severity)).toEqual(["critical", "warning", "info"]);
    expect(groups[0]?.config.label).toBe("Needs attention");
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["critical"]);
  });

  it("resolves action and legacy entity navigation targets", () => {
    expect(resolveNotificationTarget(makeNotification({
      action: {
        type: "open_route",
        route: "/finance",
      },
    }))).toEqual({ to: "/finance" });
    expect(resolveNotificationTarget(makeNotification({
      entityType: "daily_review",
      entityId: "daily_review:2026-05-03",
    }))).toEqual({
      to: "/reviews/daily?date=2026-05-03",
    });
    expect(resolveNotificationTarget(makeNotification({
      entityType: "unknown",
    }))).toBeNull();
  });

  it("formats labels and relative times defensively", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:30:00.000Z"));

    expect(resolveActionLabel(null)).toBe("Open");
    expect(resolveActionLabel("admin_item")).toBe("Open bill");
    expect(resolveActionLabel("weekly_review")).toBe("Open review");
    expect(formatNotificationTime("2026-05-03T12:30:00.000Z")).toBe("just now");
    expect(formatNotificationTime("2026-05-03T12:00:00.000Z")).toBe("30m ago");
    expect(formatNotificationTime("2026-05-02T12:00:00.000Z")).toBe("1d ago");
  });

  it("uses preferred timezone to determine whether tonight snooze is still available", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:30:00.000Z"));
    setPreferredTimezone("UTC");
    expect(isTonightAvailable()).toBe(true);

    setPreferredTimezone("Asia/Kolkata");
    expect(isTonightAvailable()).toBe(false);

    setPreferredTimezone("Invalid/Timezone");
    expect(isTonightAvailable()).toBe(true);
  });
});
