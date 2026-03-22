import { randomBytes, createHash } from "node:crypto";

import argon2 from "argon2";
import type { Prisma, PrismaClient, User, UserStatus } from "@prisma/client";
import type { SessionUser } from "@life-os/contracts";

import type { AppEnv } from "../../app/env.js";

const SESSION_BYTES = 32;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getBootstrapAccountConfig(env: AppEnv) {
  const email = env.BOOTSTRAP_USER_EMAIL ?? env.OWNER_EMAIL;
  const password = env.BOOTSTRAP_USER_PASSWORD ?? env.OWNER_PASSWORD;
  const displayName = env.BOOTSTRAP_USER_DISPLAY_NAME ?? env.OWNER_DISPLAY_NAME ?? "User";

  return {
    email: email ? normalizeEmail(email) : undefined,
    password,
    displayName,
  };
}

export function hashSessionToken(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function toSessionUser(user: Pick<User, "id" | "email" | "displayName">): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? "User",
  };
}

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function ensureBootstrapUserAccount(
  prisma: PrismaClient,
  env: AppEnv,
  logger: Pick<Console, "info" | "warn">,
) {
  const bootstrapAccount = getBootstrapAccountConfig(env);

  if (!bootstrapAccount.email || !bootstrapAccount.password) {
    logger.warn(
      "[auth] bootstrap user credentials are not fully configured; bootstrap skipped",
    );
    return;
  }

  const existingByEmail = await prisma.user.findUnique({
    where: {
      email: bootstrapAccount.email,
    },
  });

  if (existingByEmail) {
    return;
  }

  const existingUserCount = await prisma.user.count();

  if (existingUserCount > 0) {
    logger.warn(
      `[auth] bootstrap user skipped because ${existingUserCount} user record(s) already exist`,
    );
    return;
  }

  const passwordHash = await hashPassword(bootstrapAccount.password);

  await prisma.user.create({
    data: {
      email: bootstrapAccount.email,
      passwordHash,
      displayName: bootstrapAccount.displayName,
      preferences: {
        create: {},
      },
    },
  });

  logger.info(`[auth] bootstrapped user account for ${bootstrapAccount.email}`);
}

export async function validateUserCredentials(
  prisma: PrismaClient,
  email: string,
  password: string,
) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
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

export async function createUserAccount(
  prisma: PrismaClient,
  input: {
    email: string;
    password: string;
    displayName?: string | null;
    status?: UserStatus;
  },
) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizeEmail(input.email),
    },
  });

  if (existingUser) {
    throw new Error(`User with email ${normalizeEmail(input.email)} already exists`);
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      email: normalizeEmail(input.email),
      passwordHash,
      displayName: input.displayName ?? null,
      status: input.status ?? "ACTIVE",
      preferences: {
        create: {},
      },
    },
    include: {
      preferences: true,
    },
  });
}

export async function setUserPassword(
  prisma: PrismaClient,
  input: {
    email: string;
    password: string;
  },
) {
  const user = await prisma.user.findUnique({
    where: {
      email: normalizeEmail(input.email),
    },
  });

  if (!user) {
    throw new Error(`User with email ${normalizeEmail(input.email)} was not found`);
  }

  const passwordHash = await hashPassword(input.password);

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash,
    },
  });

  const revokedSessions = await revokeAllUserSessions(prisma, user.id);

  return {
    user: updatedUser,
    revokedSessions,
  };
}

export async function updateUserAccountStatus(
  prisma: PrismaClient,
  input: {
    email: string;
    status: UserStatus;
  },
) {
  const user = await prisma.user.findUnique({
    where: {
      email: normalizeEmail(input.email),
    },
  });

  if (!user) {
    throw new Error(`User with email ${normalizeEmail(input.email)} was not found`);
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      status: input.status,
    },
  });

  const revokedSessions = input.status === "DISABLED"
    ? await revokeAllUserSessions(prisma, user.id)
    : 0;

  return {
    user: updatedUser,
    revokedSessions,
  };
}

export async function listUserAccounts(prisma: PrismaClient) {
  return prisma.user.findMany({
    orderBy: [
      { createdAt: "asc" },
      { email: "asc" },
    ],
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      createdAt: true,
      onboardedAt: true,
      lastLoginAt: true,
    },
  });
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

export async function revokeAllUserSessions(prisma: PrismaClient, userId: string) {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count;
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
