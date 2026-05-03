import type { FastifyPluginAsync } from "fastify";
import type {
  Notification,
  NotificationSeverity as PrismaNotificationSeverity,
} from "@prisma/client";
import type {
  HomeAction,
  NotificationCategory,
  NotificationItem,
  NotificationMutationResponse,
  NotificationsResponse,
  NotificationSnoozeRequest,
} from "@life-os/contracts";
import { notificationSnoozeRequestSchema } from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  buildFinanceRoute,
  extractFinanceBillDueOn,
  extractFinanceBillId,
} from "../finance/finance-navigation.js";
import { generateRuleNotificationsForUser } from "./service.js";
import {
  notificationCategories,
  resolveNotificationSnoozeTime,
  resolveSnoozedNotificationExpiry,
} from "./policy.js";

function toNotificationCategory(value: string): NotificationCategory {
  if (notificationCategories.includes(value as NotificationCategory)) {
    return value as NotificationCategory;
  }

  throw new Error(`Unsupported notification category: ${value}`);
}

function fromPrismaNotificationSeverity(
  severity: PrismaNotificationSeverity,
): NotificationItem["severity"] {
  switch (severity) {
    case "INFO":
      return "info";
    case "WARNING":
      return "warning";
    case "CRITICAL":
      return "critical";
  }

  throw new Error(`Unsupported notification severity: ${severity satisfies never}`);
}

function resolveNotificationAction(notification: Notification): HomeAction | null {
  if (notification.entityType === "admin_item") {
    const billId = extractFinanceBillId(notification.entityId);
    const dueOn = extractFinanceBillDueOn(notification.entityId);

    return {
      type: "open_route",
      route: buildFinanceRoute({
        billId,
        dueOn,
        intent: "pay",
        section: "due_now",
      }),
    };
  }

  if (notification.entityType === "inbox_zero") {
    return {
      type: "open_route",
      route: "/inbox",
    };
  }

  if (notification.entityType === "task") {
    return {
      type: "open_route",
      route: "/today",
    };
  }

  if (notification.entityType === "health_day" || notification.entityType === "workout_day") {
    return {
      type: "open_route",
      route: "/health",
    };
  }

  if (notification.entityType === "habit" || notification.entityType === "routine_day") {
    return {
      type: "open_route",
      route: "/habits",
    };
  }

  if (notification.entityType === "daily_review" && notification.entityId) {
    const datePart = notification.entityId.includes(":")
      ? notification.entityId.split(":").pop()
      : notification.entityId;

    return {
      type: "open_route",
      route: `/reviews/daily?date=${datePart}`,
    };
  }

  if (notification.entityType === "weekly_review" && notification.entityId) {
    const datePart = notification.entityId.includes(":")
      ? notification.entityId.split(":").pop()
      : notification.entityId;

    return {
      type: "open_route",
      route: `/reviews/weekly?date=${datePart}`,
    };
  }

  if (notification.entityType === "monthly_review" && notification.entityId) {
    const datePart = notification.entityId.includes(":")
      ? notification.entityId.split(":").pop()
      : notification.entityId;

    return {
      type: "open_route",
      route: `/reviews/monthly?date=${datePart}`,
    };
  }

  return null;
}

function serializeNotification(notification: Notification): NotificationItem {
  return {
    id: notification.id,
    notificationType: toNotificationCategory(notification.notificationType),
    severity: fromPrismaNotificationSeverity(notification.severity),
    title: notification.title,
    body: notification.body,
    action: resolveNotificationAction(notification),
    entityType: notification.entityType,
    entityId: notification.entityId,
    ruleKey: notification.ruleKey,
    visibleFrom: notification.visibleFrom?.toISOString() ?? null,
    expiresAt: notification.expiresAt?.toISOString() ?? null,
    read: Boolean(notification.readAt),
    readAt: notification.readAt?.toISOString() ?? null,
    dismissedAt: notification.dismissedAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

type NotificationBulkDismissResponse = {
  generatedAt: string;
  dismissedCount: number;
};

async function findOwnedNotification(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  notificationId: string,
) {
  const notification = await app.prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Notification not found",
    });
  }

  return notification;
}

export const registerNotificationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const now = new Date();

    try {
      await generateRuleNotificationsForUser(app.prisma, user.id, now);
    } catch (error) {
      request.log.warn(
        { err: error, userId: user.id },
        "notification sync failed before serving notification center",
      );
    }

    const notifications = await app.prisma.notification.findMany({
      where: {
        userId: user.id,
        dismissedAt: null,
        OR: [
          { visibleFrom: null },
          { visibleFrom: { lte: now } },
        ],
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    });

    const response: NotificationsResponse = withGeneratedAt({
      notifications: notifications.map(serializeNotification),
    });

    return reply.send(response);
  });

  app.post("/:notificationId/snooze", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { notificationId } = request.params as { notificationId: string };
    const payload = parseOrThrow(
      notificationSnoozeRequestSchema,
      request.body as NotificationSnoozeRequest,
    );
    const notification = await findOwnedNotification(app, user.id, notificationId);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        timezone: true,
      },
    });

    if (notification.dismissedAt) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Dismissed notifications cannot be snoozed",
      });
    }

    const now = new Date();
    const visibleFrom = resolveNotificationSnoozeTime({
      now,
      timezone: preferences?.timezone,
      preset: payload.preset,
    });

    if (!visibleFrom) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Tonight snooze is only available before 18:00 in the user's timezone",
      });
    }

    const updatedNotification = await app.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        visibleFrom,
        readAt: null,
        expiresAt: resolveSnoozedNotificationExpiry({
          currentExpiresAt: notification.expiresAt,
          visibleFrom,
          timezone: preferences?.timezone,
        }),
      },
    });

    const response: NotificationMutationResponse = withGeneratedAt({
      notification: serializeNotification(updatedNotification),
    });

    return reply.send(response);
  });

  app.post("/:notificationId/read", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { notificationId } = request.params as { notificationId: string };

    await findOwnedNotification(app, user.id, notificationId);

    const notification = await app.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        readAt: new Date(),
      },
    });

    const response: NotificationMutationResponse = withGeneratedAt({
      notification: serializeNotification(notification),
    });

    return reply.send(response);
  });

  app.post("/:notificationId/dismiss", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { notificationId } = request.params as { notificationId: string };

    await findOwnedNotification(app, user.id, notificationId);

    const notification = await app.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        dismissedAt: new Date(),
      },
    });

    const response: NotificationMutationResponse = withGeneratedAt({
      notification: serializeNotification(notification),
    });

    return reply.send(response);
  });

  app.post("/dismiss-all", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const now = new Date();

    const result = await app.prisma.notification.updateMany({
      where: {
        userId: user.id,
        dismissedAt: null,
        OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      data: {
        dismissedAt: now,
      },
    });

    const response: NotificationBulkDismissResponse = withGeneratedAt({
      dismissedCount: result.count,
    });

    return reply.send(response);
  });
};
