import type { PrismaClient } from "@prisma/client";
import type { HomeNotificationItem } from "@life-os/contracts";

type HomeNotificationsPrisma = Pick<PrismaClient, "notification">;

export async function loadHomeNotifications(
  prisma: HomeNotificationsPrisma,
  input: {
    userId: string;
    now: Date;
  },
): Promise<HomeNotificationItem[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId: input.userId,
      dismissedAt: null,
      OR: [{ visibleFrom: null }, { visibleFrom: { lte: input.now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }] }],
    },
    orderBy: [{ createdAt: "desc" }],
    take: 5,
  });

  return notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  }));
}
