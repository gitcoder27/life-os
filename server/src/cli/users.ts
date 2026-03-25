import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { assertDatabaseSeparation, getEnv } from "../app/env.js";
import { ensureDatabaseExists, ensureDatabaseMigrations } from "../app/db-bootstrap.js";
import {
  createAuditEvent,
  createUserAccount,
  listUserAccounts,
  setUserPassword,
  updateUserAccountStatus,
} from "../modules/auth/service.js";

interface CliIo {
  info: (message: string) => void;
  error: (message: string) => void;
}

interface CliDependencies {
  prisma: PrismaClient;
  io?: CliIo;
}

type CliFlags = Record<string, string>;

function getIo(io?: CliIo): CliIo {
  return io ?? console;
}

function parseFlags(argv: string[]) {
  const flags: CliFlags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] = value;
    index += 1;
  }

  return flags;
}

function requireFlag(flags: CliFlags, key: string) {
  const value = flags[key];

  if (!value) {
    throw new Error(`Missing required flag --${key}`);
  }

  return value;
}

function formatNullable(value: string | null) {
  return value ?? "-";
}

function printUsage(io: CliIo) {
  io.info("Usage:");
  io.info("  npm run users -w server -- list");
  io.info("  npm run users -w server -- create --email user@example.com --password secret123 --display-name \"User\"");
  io.info("  npm run users -w server -- set-password --email user@example.com --password new-secret123");
  io.info("  npm run users -w server -- disable --email user@example.com");
  io.info("  npm run users -w server -- enable --email user@example.com");
}

async function handleListUsers(prisma: PrismaClient, io: CliIo) {
  const users = await listUserAccounts(prisma);

  if (users.length === 0) {
    io.info("No users found.");
    return 0;
  }

  io.info("id\temail\tstatus\tdisplayName\tonboardedAt\tlastLoginAt");

  for (const user of users) {
    io.info(
      [
        user.id,
        user.email,
        user.status,
        formatNullable(user.displayName),
        formatNullable(user.onboardedAt?.toISOString() ?? null),
        formatNullable(user.lastLoginAt?.toISOString() ?? null),
      ].join("\t"),
    );
  }

  return 0;
}

async function handleCreateUser(prisma: PrismaClient, flags: CliFlags, io: CliIo) {
  const user = await createUserAccount(prisma, {
    email: requireFlag(flags, "email"),
    password: requireFlag(flags, "password"),
    displayName: flags["display-name"] ?? null,
  });

  await createAuditEvent(prisma, {
    userId: user.id,
    eventType: "auth.user_created_admin",
    eventPayloadJson: {
      email: user.email,
    },
  });

  io.info(`Created user ${user.email} (${user.id}).`);
  return 0;
}

async function handleSetPassword(prisma: PrismaClient, flags: CliFlags, io: CliIo) {
  const { user, revokedSessions } = await setUserPassword(prisma, {
    email: requireFlag(flags, "email"),
    password: requireFlag(flags, "password"),
  });

  await createAuditEvent(prisma, {
    userId: user.id,
    eventType: "auth.password_reset_admin",
    eventPayloadJson: {
      email: user.email,
      revokedSessions,
    },
  });

  io.info(`Updated password for ${user.email}; revoked ${revokedSessions} session(s).`);
  return 0;
}

async function handleSetStatus(
  prisma: PrismaClient,
  flags: CliFlags,
  io: CliIo,
  status: "ACTIVE" | "DISABLED",
) {
  const { user, revokedSessions } = await updateUserAccountStatus(prisma, {
    email: requireFlag(flags, "email"),
    status,
  });

  await createAuditEvent(prisma, {
    userId: user.id,
    eventType: status === "DISABLED" ? "auth.user_disabled_admin" : "auth.user_enabled_admin",
    eventPayloadJson: {
      email: user.email,
      revokedSessions,
    },
  });

  io.info(`Updated ${user.email} to ${status}; revoked ${revokedSessions} session(s).`);
  return 0;
}

export async function runUserCli(argv: string[], dependencies: CliDependencies) {
  const io = getIo(dependencies.io);
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help") {
    printUsage(io);
    return 0;
  }

  const flags = parseFlags(rest);

  switch (command) {
    case "list":
      return handleListUsers(dependencies.prisma, io);
    case "create":
      return handleCreateUser(dependencies.prisma, flags, io);
    case "set-password":
      return handleSetPassword(dependencies.prisma, flags, io);
    case "disable":
      return handleSetStatus(dependencies.prisma, flags, io, "DISABLED");
    case "enable":
      return handleSetStatus(dependencies.prisma, flags, io, "ACTIVE");
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function main() {
  const env = getEnv();
  assertDatabaseSeparation(env);
  await ensureDatabaseExists(env);
  await ensureDatabaseMigrations(env);

  const prisma = new PrismaClient();

  try {
    const exitCode = await runUserCli(process.argv.slice(2), {
      prisma,
    });

    process.exit(exitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const currentEntryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (currentEntryPoint === import.meta.url) {
  void main();
}
