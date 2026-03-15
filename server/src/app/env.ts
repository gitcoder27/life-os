import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3004),
  APP_ORIGIN: z.string().default("http://localhost:5174"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/life_os"),
  SESSION_COOKIE_NAME: z.string().default("life_os_session"),
  SESSION_SECRET: z.string().min(16).default("dev-only-change-me"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  CSRF_COOKIE_NAME: z.string().default("life_os_csrf"),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OWNER_EMAIL: z.string().email().optional(),
  OWNER_PASSWORD: z.string().min(8).optional(),
  OWNER_DISPLAY_NAME: z.string().default("Owner"),
});

export type AppEnv = z.infer<typeof envSchema>;

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
