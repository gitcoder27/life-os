import type { AppEnv } from "../../app/env.js";
import { AppError } from "../../lib/errors/app-error.js";

interface RateLimitEntry {
  count: number;
  firstFailureAt: number;
}

const failedLoginAttempts = new Map<string, RateLimitEntry>();

function getKey(ipAddress: string, email: string) {
  return `${ipAddress}:${email.toLowerCase()}`;
}

export function assertLoginRateLimit(
  env: AppEnv,
  input: {
    ipAddress: string;
    email: string;
  },
) {
  const key = getKey(input.ipAddress, input.email);
  const existing = failedLoginAttempts.get(key);

  if (!existing) {
    return;
  }

  const windowMs = env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  const windowExpired = Date.now() - existing.firstFailureAt > windowMs;

  if (windowExpired) {
    failedLoginAttempts.delete(key);
    return;
  }

  if (existing.count >= env.AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new AppError({
      statusCode: 429,
      code: "RATE_LIMITED",
      message: "Too many failed login attempts. Try again later.",
    });
  }
}

export function recordLoginFailure(
  env: AppEnv,
  input: {
    ipAddress: string;
    email: string;
  },
) {
  const key = getKey(input.ipAddress, input.email);
  const existing = failedLoginAttempts.get(key);
  const windowMs = env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

  if (!existing || Date.now() - existing.firstFailureAt > windowMs) {
    failedLoginAttempts.set(key, {
      count: 1,
      firstFailureAt: Date.now(),
    });
    return;
  }

  failedLoginAttempts.set(key, {
    count: existing.count + 1,
    firstFailureAt: existing.firstFailureAt,
  });
}

export function clearLoginFailures(input: { ipAddress: string; email: string }) {
  failedLoginAttempts.delete(getKey(input.ipAddress, input.email));
}
