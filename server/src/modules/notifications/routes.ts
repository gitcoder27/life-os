import type { FastifyPluginAsync } from "fastify";
import type {
  Notification,
  NotificationSeverity as PrismaNotificationSeverity,
} from "@prisma/client";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";

interface NotificationItem {
  id: string;
  notificationType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  ruleKey: string;
  visibleFrom: string | null;
  expiresAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  generatedAt: string;
  notifications: NotificationItem[];
}

interface NotificationMutationResponse {
  generatedAt: string;
  notification: NotificationItem;
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

function serializeNotification(notification: Notification): NotificationItem {
  return {
    id: notification.id,
    notificationType: notification.notificationType,
    severity: fromPrismaNotificationSeverity(notification.severity),
    title: notification.title,
    body: notification.body,
    entityType: notification.entityType,
    entityId: notification.entityId,
    ruleKey: notification.ruleKey,
    visibleFrom: notification.visibleFrom?.toISOString() ?? null,
    expiresAt: notification.expiresAt?.toISOString() ?? null,
    readAt: notification.readAt?.toISOString() ?? null,
    dismissedAt: notification.dismissedAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

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
};
