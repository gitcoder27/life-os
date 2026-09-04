import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseEnv } from "dotenv";
import { z } from "zod";

type ResolveEnvPathOptions = {
  cwd?: string;
  envFile?: string | null;
  nodeEnv?: string | null;
  serverRootDir?: string;
};

type LoadSelectedEnvOptions = ResolveEnvPathOptions & {
  targetEnv?: NodeJS.ProcessEnv;
  overrideExisting?: boolean;
};

export function getServerRootDir(moduleUrl = import.meta.url) {
  const modulePath = fileURLToPath(moduleUrl);
  return path.resolve(path.dirname(modulePath), "..", "..");
}

function dedupePaths(paths: string[]) {
  return [...new Set(paths)];
}

function resolveExplicitEnvCandidates(envFile: string, cwd: string, serverRootDir: string) {
  if (path.isAbsolute(envFile)) {
    return [envFile];
  }

  return dedupePaths([
    path.resolve(cwd, envFile),
    path.resolve(serverRootDir, envFile),
    path.resolve(path.dirname(serverRootDir), envFile),
    path.resolve(serverRootDir, path.basename(envFile)),
  ]);
}

export function resolveEnvPath(options: ResolveEnvPathOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const envFile = options.envFile === undefined ? process.env.ENV_FILE : options.envFile;
  const nodeEnv = options.nodeEnv === undefined ? process.env.NODE_ENV : options.nodeEnv;
  const serverRootDir = options.serverRootDir ?? getServerRootDir();

  if (envFile) {
    const explicitCandidates = resolveExplicitEnvCandidates(envFile, cwd, serverRootDir);

    for (const candidate of explicitCandidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `[env] ENV_FILE was set but no env file was found. Checked: ${explicitCandidates.join(", ")}`,
    );
  }

  const candidates = [
    ...(nodeEnv ? [path.join(serverRootDir, `.env.${nodeEnv}`)] : []),
    path.join(serverRootDir, ".env"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function loadSelectedEnv(options: LoadSelectedEnvOptions = {}) {
  const envPath = resolveEnvPath(options);

  if (!envPath) {
    return null;
  }

  const parsedEnv = parseEnv(readFileSync(envPath));
  const targetEnv = options.targetEnv ?? process.env;
  const overrideExisting = options.overrideExisting ?? targetEnv.ENV_FILE_OVERRIDE === "true";

  for (const [key, value] of Object.entries(parsedEnv)) {
    if (overrideExisting || targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }

  targetEnv.ENV_FILE = envPath;

  return envPath;
}

const envPath = loadSelectedEnv();

const defaultSessionSecret = "dev-only-change-me";
const minimumProductionSessionSecretLength = 32;
const minimumProductionBootstrapPasswordLength = 16;
const weakProductionSessionSecrets = new Set([
  defaultSessionSecret,
  "change-me",
  "changeme",
  "changeit",
  "password",
  "secret",
  "session-secret",
  "life-os-session-secret",
]);
const weakProductionBootstrapPasswords = new Set([
  "change-me",
  "changeme",
  "change-me-please",
  "change-me-before-production",
  "password",
  "password123",
  "owner-password",
  "bootstrap-password",
  "admin-password",
  "life-os-password",
]);

const envBooleanSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

function isRepeatedCharacter(value: string) {
  return /^(.)(\1)+$/.test(value);
}

export function getProductionBootstrapPasswordIssue(password: string) {
  const trimmedPassword = password.trim();
  const normalizedPassword = trimmedPassword.toLowerCase();
  const hasUppercase = /[A-Z]/.test(trimmedPassword);
  const hasLowercase = /[a-z]/.test(trimmedPassword);
  const hasDigit = /\d/.test(trimmedPassword);
  const hasSymbol = /[^A-Za-z0-9]/.test(trimmedPassword);

  if (
    trimmedPassword.length < minimumProductionBootstrapPasswordLength ||
    weakProductionBootstrapPasswords.has(normalizedPassword) ||
    normalizedPassword.includes("password") ||
    normalizedPassword.includes("change-me") ||
    isRepeatedCharacter(trimmedPassword) ||
    !hasUppercase ||
    !hasLowercase ||
    !hasDigit ||
    !hasSymbol
  ) {
    return "Production bootstrap passwords must be non-example values with at least 16 characters, mixed case, a number, and a symbol";
  }

  return null;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3004),
    APP_ORIGIN: z.string().default("http://localhost:5174"),
    DATABASE_URL: z
      .string()
      .default("postgresql://postgres:postgres@localhost:5432/life_os"),
    DEV_DATABASE_URL: z.string().optional(),
    PROD_DATABASE_URL: z.string().optional(),
    ENV_FILE_OVERRIDE: envBooleanSchema.default(false),
    DATABASE_SEPARATION_STRICT: envBooleanSchema.default(false),
    AUTO_CREATE_DATABASE: envBooleanSchema.default(false),
    AUTO_APPLY_MIGRATIONS: envBooleanSchema.default(false),
    TRUST_PROXY: envBooleanSchema.default(false),
    SESSION_COOKIE_NAME: z.string().default("life_os_session"),
    SESSION_SECRET: z.string().min(16).default(defaultSessionSecret),
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
    CSRF_COOKIE_NAME: z.string().default("life_os_csrf"),
    AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    BOOTSTRAP_USER_EMAIL: z.string().email().optional(),
    BOOTSTRAP_USER_PASSWORD: z.string().min(8).optional(),
    BOOTSTRAP_USER_DISPLAY_NAME: z.string().optional(),
    ALLOW_PRODUCTION_BOOTSTRAP: envBooleanSchema.default(false),
    OWNER_EMAIL: z.string().email().optional(),
    OWNER_PASSWORD: z.string().min(8).optional(),
    OWNER_DISPLAY_NAME: z.string().default("Owner"),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") {
      return;
    }

    const trimmedSecret = value.SESSION_SECRET.trim();
    const normalizedSecret = trimmedSecret.toLowerCase();

    if (
      trimmedSecret.length < minimumProductionSessionSecretLength ||
      weakProductionSessionSecrets.has(normalizedSecret) ||
      isRepeatedCharacter(trimmedSecret)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_SECRET"],
        message:
          "SESSION_SECRET must be explicitly set to a strong production-only value of at least 32 characters",
      });
    }

    if (!value.DATABASE_SEPARATION_STRICT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_SEPARATION_STRICT"],
        message: "DATABASE_SEPARATION_STRICT=true is required in production",
      });
    }

    const bootstrapEmail = value.BOOTSTRAP_USER_EMAIL ?? value.OWNER_EMAIL;
    const bootstrapPassword = value.BOOTSTRAP_USER_PASSWORD ?? value.OWNER_PASSWORD;
    const hasBootstrapCredential = Boolean(bootstrapEmail || bootstrapPassword);

    if (!hasBootstrapCredential) {
      return;
    }

    if (!value.ALLOW_PRODUCTION_BOOTSTRAP) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOW_PRODUCTION_BOOTSTRAP"],
        message: "ALLOW_PRODUCTION_BOOTSTRAP=true is required to create a bootstrap user in production",
      });
    }

    if (!bootstrapEmail || !bootstrapPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BOOTSTRAP_USER_EMAIL"],
        message: "Production bootstrap requires both an email and password, or neither",
      });
      return;
    }

    const passwordIssue = getProductionBootstrapPasswordIssue(bootstrapPassword);
    if (passwordIssue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: value.BOOTSTRAP_USER_PASSWORD ? ["BOOTSTRAP_USER_PASSWORD"] : ["OWNER_PASSWORD"],
        message: passwordIssue,
      });
    }
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

export function describeDatabaseTarget(databaseUrl: string) {
  const dbIdentity = getDbIdentity(databaseUrl);

  if (!dbIdentity) {
    return "unparseable database URL";
  }

  return `host=${dbIdentity.host} port=${dbIdentity.port} database=${dbIdentity.database}`;
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

export function parseAppEnv(input: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ")}`,
    );
  }

  return parsed.data;
}

export function getEnv(): AppEnv {
  return parseAppEnv(process.env);
}
