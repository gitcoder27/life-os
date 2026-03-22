import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

function resolveEnvPath() {
  const cwd = process.cwd();
  const nodeEnv = process.env.NODE_ENV;
  const candidates = [
    process.env.ENV_FILE,
    nodeEnv ? `.env.${nodeEnv}` : null,
    `.env`,
    ...(nodeEnv ? [path.join("server", `.env.${nodeEnv}`)] : []),
    path.join("server", ".env"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const absolutePath = path.resolve(cwd, candidate);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

const envPath = resolveEnvPath();
if (envPath) {
  loadEnv({
    path: envPath,
  });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3004),
  APP_ORIGIN: z.string().default("http://localhost:5174"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/life_os"),
  DEV_DATABASE_URL: z.string().optional(),
  PROD_DATABASE_URL: z.string().optional(),
  DATABASE_SEPARATION_STRICT: z.coerce.boolean().default(false),
  AUTO_CREATE_DATABASE: z.coerce.boolean().default(false),
  AUTO_APPLY_MIGRATIONS: z.coerce.boolean().default(false),
  SESSION_COOKIE_NAME: z.string().default("life_os_session"),
  SESSION_SECRET: z.string().min(16).default("dev-only-change-me"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  CSRF_COOKIE_NAME: z.string().default("life_os_csrf"),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  BOOTSTRAP_USER_EMAIL: z.string().email().optional(),
  BOOTSTRAP_USER_PASSWORD: z.string().min(8).optional(),
  BOOTSTRAP_USER_DISPLAY_NAME: z.string().optional(),
  OWNER_EMAIL: z.string().email().optional(),
  OWNER_PASSWORD: z.string().min(8).optional(),
  OWNER_DISPLAY_NAME: z.string().default("Owner"),
});

export type AppEnv = z.infer<typeof envSchema>;

type DbIdentity = {
  host: string;
  port: string;
  database: string;
};

function getDbIdentity(databaseUrl: string): DbIdentity | null {
  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\//, "");
    return {
      host: url.hostname || "localhost",
      port: url.port || "5432",
      database: database || "postgres",
    };
  } catch {
    return null;
  }
}

export function getDatabaseName(databaseUrl: string) {
  const dbIdentity = getDbIdentity(databaseUrl);
  return dbIdentity?.database ?? "";
}

export function withDatabaseName(databaseUrl: string, databaseName: string) {
  try {
    const url = new URL(databaseUrl);
    const pathname = `/${databaseName}`;
    url.pathname = pathname;
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function areDbUrlsSame(left: string, right: string) {
  const normalizedLeft = getDbIdentity(left);
  const normalizedRight = getDbIdentity(right);
  if (!normalizedLeft || !normalizedRight) {
    return left === right;
  }

  return (
    normalizedLeft.host === normalizedRight.host &&
    normalizedLeft.port === normalizedRight.port &&
    normalizedLeft.database === normalizedRight.database
  );
}

function isLikelyProdDatabase(dbName: string) {
  return dbName === "life_os" || /(^|_)prod($|_)/.test(dbName);
}

function isLikelyDevDatabase(dbName: string) {
  return /(^|_)dev(_|$)/.test(dbName) || /_dev$/.test(dbName) || dbName.includes("dev");
}

export function assertDatabaseSeparation(env: AppEnv) {
  if (env.NODE_ENV === "test") {
    return;
  }

  const oppositeEnvUrl = env.NODE_ENV === "production" ? env.DEV_DATABASE_URL : env.PROD_DATABASE_URL;
  const dbIdentity = getDbIdentity(env.DATABASE_URL);
  const dbName = dbIdentity?.database ?? "";

  if (oppositeEnvUrl) {
    if (areDbUrlsSame(env.DATABASE_URL, oppositeEnvUrl)) {
      throw new Error(
        `[env] DATABASE_URL cannot be same as ${
          env.NODE_ENV === "production" ? "DEV_DATABASE_URL" : "PROD_DATABASE_URL"
        }. Current env and configured other environment are identical and will cause data collision.`,
      );
    }
    return;
  }

  if (env.NODE_ENV === "production" && isLikelyDevDatabase(dbName)) {
    const message =
      "[env] Potential database collision: production DATABASE_URL appears to target a development database.";
    if (env.DATABASE_SEPARATION_STRICT) {
      throw new Error(message);
    }
    console.warn(message);
    console.warn("If this is expected, set DATABASE_SEPARATION_STRICT=false (default).");
    return;
  }

  if (env.NODE_ENV === "development" && isLikelyProdDatabase(dbName)) {
    const message =
      "[env] Potential database collision: development DATABASE_URL appears to target a production database.";
    if (env.DATABASE_SEPARATION_STRICT) {
      throw new Error(message);
    }
    console.warn(message);
    console.warn("Set DEV_DATABASE_URL and PROD_DATABASE_URL for strict comparisons.");
  }
}

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ")}`,
    );
  }

  return parsed.data;
}
