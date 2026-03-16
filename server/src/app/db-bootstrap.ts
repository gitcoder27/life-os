import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { promisify } from "node:util";

import { type AppEnv, getDatabaseName, withDatabaseName } from "./env.js";

const execFileAsync = promisify(execFile);
const FALLBACK_MAINTENANCE_DATABASES = ["postgres", "template1"];
const SQL_IDENTIFIER_QUOTE = `"`;
const PRISMA_MIGRATE = ["migrate", "deploy"];
const PRISMA_SCHEMA_RELATIVE_PATH = path.join("prisma", "schema.prisma");
const localPrismaBinary = path.join(process.cwd(), "node_modules", ".bin", "prisma");

function quoteIdentifier(value: string) {
  return `${SQL_IDENTIFIER_QUOTE}${value.replace(/"/g, `""`)}${SQL_IDENTIFIER_QUOTE}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAlreadyExistsError(message: string) {
  return /already exists/i.test(message);
}

function isMaintenanceDatabaseUnavailable(message: string) {
  return /database .* does not exist/i.test(message) || /could not connect to server/i.test(message);
}

export async function ensureDatabaseMigrations(env: AppEnv): Promise<void> {
  if (env.NODE_ENV === "test" || !env.AUTO_APPLY_MIGRATIONS) {
    return;
  }

  const schemaPath = path.resolve(process.cwd(), PRISMA_SCHEMA_RELATIVE_PATH);
  if (!existsSync(schemaPath)) {
    throw new Error(`[db-bootstrap] Missing Prisma schema at ${schemaPath}`);
  }

  const prismaBinary = existsSync(localPrismaBinary) ? localPrismaBinary : "prisma";

  const migrationArgs = [...PRISMA_MIGRATE, "--schema", schemaPath];
  try {
    await execFileAsync(prismaBinary, migrationArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    throw new Error(`[db-bootstrap] Prisma migrate failed: ${message}`);
  }
}

export async function ensureDatabaseExists(env: AppEnv): Promise<void> {
  if (env.NODE_ENV === "test" || !env.AUTO_CREATE_DATABASE) {
    return;
  }

  const targetDatabase = getDatabaseName(env.DATABASE_URL);
  if (!targetDatabase || targetDatabase === "postgres") {
    return;
  }

  const statement = `CREATE DATABASE ${quoteIdentifier(targetDatabase)}`;
  let lastMessage = "";

  for (const adminDatabase of FALLBACK_MAINTENANCE_DATABASES) {
    const adminUrl = withDatabaseName(env.DATABASE_URL, adminDatabase);
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: adminUrl,
        },
      },
    });

    try {
      await prisma.$executeRawUnsafe(statement);
      return;
    } catch (error) {
      const message = getErrorMessage(error);
      lastMessage = message;

      if (isAlreadyExistsError(message)) {
        return;
      }

      if (!isMaintenanceDatabaseUnavailable(message)) {
        throw new Error(
          `[db-bootstrap] Could not ensure database "${targetDatabase}" using admin database "${adminDatabase}": ${message}`,
        );
      }
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  throw new Error(
    `[db-bootstrap] Could not ensure database "${targetDatabase}" exists with AUTO_CREATE_DATABASE=true. Last error: ${lastMessage}`,
  );
}
