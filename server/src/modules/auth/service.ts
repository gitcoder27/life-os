import { randomBytes, createHash } from "node:crypto";

import argon2 from "argon2";
import type { Prisma, PrismaClient, User } from "@prisma/client";
import type { SessionUser } from "@life-os/contracts";

import type { AppEnv } from "../../app/env.js";

const SESSION_BYTES = 32;

export function hashSessionToken(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function toSessionUser(user: Pick<User, "id" | "email" | "displayName">): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? "Owner",
  };
}

export async function ensureOwnerAccount(prisma: PrismaClient, env: AppEnv, logger: Console) {
  if (!env.OWNER_EMAIL || !env.OWNER_PASSWORD) {
    logger.warn(
      "[auth] OWNER_EMAIL and OWNER_PASSWORD are not fully configured; owner bootstrap skipped",
    );
    return;
  }

  const existingByEmail = await prisma.user.findUnique({
    where: {
      email: env.OWNER_EMAIL,
    },
  });

  if (existingByEmail) {
    return;
  }

  const existingUserCount = await prisma.user.count();

  if (existingUserCount > 0) {
    logger.warn(
      `[auth] owner bootstrap skipped because ${existingUserCount} user record(s) already exist`,
    );
    return;
  }

  const passwordHash = await argon2.hash(env.OWNER_PASSWORD, {
    type: argon2.argon2id,
  });

  await prisma.user.create({
    data: {
      email: env.OWNER_EMAIL,
      passwordHash,
      displayName: env.OWNER_DISPLAY_NAME,
      preferences: {
        create: {},
      },
    },
  });

  logger.info(`[auth] bootstrapped owner account for ${env.OWNER_EMAIL}`);
}

export async function validateOwnerCredentials(
  prisma: PrismaClient,
  email: string,
  password: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  const passwordMatches = await argon2.verify(user.passwordHash, password);

  if (!passwordMatches) {
    return null;
  }

  return user;
}

export async function createUserSession(
  prisma: PrismaClient,
  env: AppEnv,
  userId: string,
  metadata: {
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  const sessionToken = randomBytes(SESSION_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: hashSessionToken(sessionToken),
      expiresAt,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
      lastSeenAt: new Date(),
    },
  });

  return {
    session,
    sessionToken,
    expiresAt,
  };
}

export async function getAuthenticatedSession(
  prisma: PrismaClient,
  sessionToken: string,
) {
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: {
      sessionTokenHash: hashSessionToken(sessionToken),
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.revokedAt || session.expiresAt <= now || session.user.status !== "ACTIVE") {
    return null;
  }

  return session;
}

export async function touchSession(
  prisma: PrismaClient,
  env: AppEnv,
  sessionId: string,
) {
  await prisma.session.update({
    where: {
      id: sessionId,
    },
    data: {
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
}

export async function revokeSessionByToken(prisma: PrismaClient, sessionToken: string) {
  await prisma.session.updateMany({
    where: {
      sessionTokenHash: hashSessionToken(sessionToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function createAuditEvent(
  prisma: PrismaClient,
  input: {
    userId?: string | null;
    eventType: string;
    eventPayloadJson: Prisma.InputJsonValue;
  },
) {
  await prisma.auditEvent.create({
    data: {
      userId: input.userId ?? null,
      eventType: input.eventType,
      eventPayloadJson: input.eventPayloadJson,
    },
  });
}
