import { existsSync } from "node:fs";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import {
  createAuditEvent,
  createUserAccount,
  listUserAccounts,
  setUserPassword,
  updateUserAccountStatus,
} from "../modules/auth/service.js";

type RuntimeEnvironment = "development" | "production";
type Prompt = (message: string) => Promise<string>;

interface InteractiveIo {
  info: (message: string) => void;
  error: (message: string) => void;
  prompt: Prompt;
  promptSecret: Prompt;
}

interface RuntimeConfig {
  nodeEnv: RuntimeEnvironment;
  envFile: string | null;
  serverRootDir: string;
  appRootDir: string;
  detectedFrom: string;
}

interface InteractiveContext {
  nodeEnv: RuntimeEnvironment;
  envFile: string | null;
  databaseName?: string;
}

interface InteractiveDependencies {
  prisma: PrismaClient;
  io: InteractiveIo;
  context: InteractiveContext;
}

type UserAccount = Awaited<ReturnType<typeof listUserAccounts>>[number];

const PRODUCTION_APP_ROOT = "/home/ubuntu/apps/life-os-prod";

function normalizePath(value: string) {
  return path.resolve(value);
}

function isServerRoot(candidate: string) {
  return (
    existsSync(path.join(candidate, "package.json")) &&
    existsSync(path.join(candidate, "src", "cli", "users.ts")) &&
    path.basename(candidate) === "server"
  );
}

function resolveServerRootDir(cwd = process.cwd()) {
  let current = normalizePath(cwd);

  while (true) {
    if (isServerRoot(current)) {
      return current;
    }

    const nestedServerRoot = path.join(current, "server");
    if (isServerRoot(nestedServerRoot)) {
      return nestedServerRoot;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function resolveEnvFile(serverRootDir: string, nodeEnv: RuntimeEnvironment) {
  const candidates =
    nodeEnv === "production"
      ? [path.join(serverRootDir, ".env.production")]
      : [path.join(serverRootDir, ".env.development"), path.join(serverRootDir, ".env")];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function detectEnvironment(appRootDir: string): RuntimeEnvironment {
  const normalizedAppRoot = normalizePath(appRootDir);
  if (
    normalizedAppRoot === PRODUCTION_APP_ROOT ||
    (path.basename(normalizedAppRoot) === "life-os-prod" &&
      path.basename(path.dirname(normalizedAppRoot)) === "apps")
  ) {
    return "production";
  }

  if (normalizedAppRoot.includes(`${path.sep}Development${path.sep}`)) {
    return "development";
  }

  return "development";
}

function parseEnvironmentOverride(argv: string[]): RuntimeEnvironment | null {
  const envFlagIndex = argv.findIndex((arg) => arg === "--env");
  if (envFlagIndex === -1) {
    return null;
  }

  const value = argv[envFlagIndex + 1];
  if (value === "development" || value === "production") {
    return value;
  }

  throw new Error("--env must be either development or production");
}

export function detectRuntimeConfig(argv = process.argv.slice(2), cwd = process.cwd()): RuntimeConfig {
  const serverRootDir = resolveServerRootDir(cwd);
  const appRootDir = path.dirname(serverRootDir);
  const override = parseEnvironmentOverride(argv);
  const nodeEnv = override ?? detectEnvironment(appRootDir);
  const envFile = resolveEnvFile(serverRootDir, nodeEnv);

  if (nodeEnv === "production" && !envFile) {
    throw new Error(`Production environment selected, but ${path.join(serverRootDir, ".env.production")} was not found`);
  }

  return {
    nodeEnv,
    envFile,
    serverRootDir,
    appRootDir,
    detectedFrom: override ? "--env" : appRootDir,
  };
}

function applyRuntimeConfig(config: RuntimeConfig) {
  process.env.NODE_ENV = config.nodeEnv;

  if (config.envFile) {
    process.env.ENV_FILE = config.envFile;
    return;
  }

  delete process.env.ENV_FILE;
}

function formatNullableDate(date: Date | null | undefined) {
  return date ? date.toISOString() : "-";
}

function formatNullableText(value: string | null | undefined) {
  return value?.trim() ? value : "-";
}

function printUsers(io: InteractiveIo, users: UserAccount[]) {
  if (users.length === 0) {
    io.info("No users found.");
    return;
  }

  io.info("id\temail\tstatus\tdisplayName\tonboardedAt\tlastLoginAt");
  for (const user of users) {
    io.info(
      [
        user.id,
        user.email,
        user.status,
        formatNullableText(user.displayName),
        formatNullableDate(user.onboardedAt),
        formatNullableDate(user.lastLoginAt),
      ].join("\t"),
    );
  }
}

function normalizeMenuChoice(value: string) {
  return value.trim().toLowerCase();
}

async function promptRequired(io: InteractiveIo, message: string) {
  while (true) {
    const value = (await io.prompt(message)).trim();
    if (value) {
      return value;
    }

    io.error("Please enter a value.");
  }
}

async function promptNewPassword(io: InteractiveIo) {
  while (true) {
    const password = await io.promptSecret("New password: ");
    if (password.length < 8) {
      io.error("Password must be at least 8 characters.");
      continue;
    }

    const confirmation = await io.promptSecret("Confirm password: ");
    if (password === confirmation) {
      return password;
    }

    io.error("Passwords did not match.");
  }
}

async function confirmProductionWrite(
  io: InteractiveIo,
  context: InteractiveContext,
  actionLabel: string,
) {
  if (context.nodeEnv !== "production") {
    return true;
  }

  const answer = await io.prompt(`Production ${actionLabel}. Type "yes" to continue: `);
  return answer.trim().toLowerCase() === "yes";
}

async function handleListUsers(dependencies: InteractiveDependencies) {
  const users = await listUserAccounts(dependencies.prisma);
  printUsers(dependencies.io, users);
}

async function handleCreateUser({ prisma, io, context }: InteractiveDependencies) {
  const email = await promptRequired(io, "Email: ");
  const password = await promptNewPassword(io);
  const displayName = (await io.prompt("Display name (optional): ")).trim() || null;

  if (!(await confirmProductionWrite(io, context, `create user ${email}`))) {
    io.info("Cancelled.");
    return;
  }

  const user = await createUserAccount(prisma, {
    email,
    password,
    displayName,
  });

  await createAuditEvent(prisma, {
    userId: user.id,
    eventType: "auth.user_created_admin",
    eventPayloadJson: {
      email: user.email,
    },
  });

  io.info(`Created user ${user.email} (${user.id}).`);
}

async function handlePasswordReset({ prisma, io, context }: InteractiveDependencies) {
  const email = await promptRequired(io, "Email: ");
  const password = await promptNewPassword(io);

  if (!(await confirmProductionWrite(io, context, `reset password for ${email}`))) {
    io.info("Cancelled.");
    return;
  }

  const { user, revokedSessions } = await setUserPassword(prisma, {
    email,
    password,
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
}

async function handleSetStatus(
  dependencies: InteractiveDependencies,
  status: "ACTIVE" | "DISABLED",
) {
  const { prisma, io, context } = dependencies;
  const email = await promptRequired(io, "Email: ");
  const action = status === "DISABLED" ? "disable" : "enable";

  if (!(await confirmProductionWrite(io, context, `${action} user ${email}`))) {
    io.info("Cancelled.");
    return;
  }

  const { user, revokedSessions } = await updateUserAccountStatus(prisma, {
    email,
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
}

function printMenu(io: InteractiveIo) {
  io.info("");
  io.info("Choose an action:");
  io.info("  1. List users");
  io.info("  2. Create user");
  io.info("  3. Reset password");
  io.info("  4. Disable user");
  io.info("  5. Enable user");
  io.info("  6. Show environment");
  io.info("  7. Quit");
}

function printEnvironment(io: InteractiveIo, context: InteractiveContext) {
  io.info(`Environment: ${context.nodeEnv}`);
  io.info(`Env file: ${context.envFile ?? "none"}`);
  io.info(`Database: ${context.databaseName ?? "unknown"}`);
}

export async function runInteractiveUserAdmin(dependencies: InteractiveDependencies) {
  const { io, context } = dependencies;

  io.info("Life OS user admin");
  printEnvironment(io, context);

  while (true) {
    printMenu(io);
    const choice = normalizeMenuChoice(await io.prompt("Select: "));

    try {
      switch (choice) {
        case "1":
        case "list":
          await handleListUsers(dependencies);
          break;
        case "2":
        case "create":
          await handleCreateUser(dependencies);
          break;
        case "3":
        case "reset":
        case "set-password":
          await handlePasswordReset(dependencies);
          break;
        case "4":
        case "disable":
          await handleSetStatus(dependencies, "DISABLED");
          break;
        case "5":
        case "enable":
          await handleSetStatus(dependencies, "ACTIVE");
          break;
        case "6":
        case "env":
          printEnvironment(io, context);
          break;
        case "7":
        case "quit":
        case "q":
        case "exit":
          io.info("Done.");
          return 0;
        default:
          io.error("Unknown option. Choose 1-7.");
      }
    } catch (error) {
      io.error(error instanceof Error ? error.message : String(error));
    }
  }
}

async function promptHidden(message: string) {
  if (!input.isTTY) {
    const rl = readline.createInterface({ input, output });
    try {
      return await rl.question(message);
    } finally {
      rl.close();
    }
  }

  return new Promise<string>((resolve, reject) => {
    const wasRaw = input.isRaw;
    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(wasRaw);
      output.write("\n");
    };

    const onData = (buffer: Buffer) => {
      const text = buffer.toString("utf8");

      if (text === "\u0003") {
        cleanup();
        reject(new Error("Cancelled"));
        return;
      }

      if (text === "\r" || text === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (text === "\b" || text === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += text;
      output.write("*");
    };

    output.write(message);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

function createTerminalIo(): InteractiveIo {
  let rl = readline.createInterface({ input, output });

  return {
    info: (message) => console.log(message),
    error: (message) => console.error(message),
    prompt: (message) => rl.question(message),
    promptSecret: async (message) => {
      rl.close();
      const answer = await promptHidden(message);
      rl = readline.createInterface({ input, output });
      return answer;
    },
  };
}

async function main() {
  const config = detectRuntimeConfig();
  applyRuntimeConfig(config);
  process.chdir(config.serverRootDir);

  const [{ PrismaClient }, envModule, dbBootstrap] = await Promise.all([
    import("@prisma/client"),
    import("../app/env.js"),
    import("../app/db-bootstrap.js"),
  ]);
  const env = envModule.getEnv();

  envModule.assertDatabaseSeparation(env);
  await dbBootstrap.ensureDatabaseExists(env);
  await dbBootstrap.ensureDatabaseMigrations(env);

  const prisma = new PrismaClient();
  const io = createTerminalIo();

  try {
    const exitCode = await runInteractiveUserAdmin({
      prisma,
      io,
      context: {
        nodeEnv: config.nodeEnv,
        envFile: config.envFile,
        databaseName: envModule.getDatabaseName(env.DATABASE_URL),
      },
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
