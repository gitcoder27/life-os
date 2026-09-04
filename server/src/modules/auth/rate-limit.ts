import type { AppEnv } from "../../app/env.js";
import { AppError } from "../../lib/errors/app-error.js";

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const failedLoginAttempts = new Map<string, RateLimitEntry>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getIpKey(ipAddress: string) {
  return `ip:${ipAddress}`;
}

function getAccountKey(email: string) {
  return `account:${normalizeEmail(email)}`;
}

function getWindowMs(env: AppEnv) {
  return env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
}

function getIpMaxAttempts(env: AppEnv) {
  return Math.max(env.AUTH_RATE_LIMIT_MAX_ATTEMPTS * 5, env.AUTH_RATE_LIMIT_MAX_ATTEMPTS + 1);
}

function cleanupExpiredLoginFailures(now = Date.now()) {
  for (const [key, entry] of failedLoginAttempts.entries()) {
    if (entry.expiresAt <= now) {
      failedLoginAttempts.delete(key);
    }
  }
}

function getActiveEntry(key: string, now = Date.now()) {
  const entry = failedLoginAttempts.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    failedLoginAttempts.delete(key);
    return null;
  }

  return entry;
}

function assertBucketAllowed(key: string, maxAttempts: number, now = Date.now()) {
  const entry = getActiveEntry(key, now);

  if (!entry) {
    return;
  }

  if (entry.count >= maxAttempts) {
    throw new AppError({
      statusCode: 429,
      code: "RATE_LIMITED",
      message: "Too many failed login attempts. Try again later.",
    });
  }
}

function recordBucketFailure(key: string, windowMs: number, now = Date.now()) {
  const existing = getActiveEntry(key, now);

  if (!existing) {
    failedLoginAttempts.set(key, {
      count: 1,
      expiresAt: now + windowMs,
    });
    return;
  }

  failedLoginAttempts.set(key, {
    count: existing.count + 1,
    expiresAt: existing.expiresAt,
  });
}

export function assertLoginRateLimit(
  env: AppEnv,
  input: {
    ipAddress: string;
    email: string;
  },
) {
  const now = Date.now();
  cleanupExpiredLoginFailures(now);
  assertBucketAllowed(getAccountKey(input.email), env.AUTH_RATE_LIMIT_MAX_ATTEMPTS, now);
  assertBucketAllowed(getIpKey(input.ipAddress), getIpMaxAttempts(env), now);
}

export function recordLoginFailure(
  env: AppEnv,
  input: {
    ipAddress: string;
    email: string;
  },
) {
  const now = Date.now();
  const windowMs = env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

  cleanupExpiredLoginFailures(now);
  recordBucketFailure(getAccountKey(input.email), windowMs, now);
  recordBucketFailure(getIpKey(input.ipAddress), windowMs, now);
}

export function clearLoginFailures(input: { ipAddress: string; email: string }) {
  cleanupExpiredLoginFailures();
  failedLoginAttempts.delete(getAccountKey(input.email));
}

export function resetLoginRateLimitForTests() {
  failedLoginAttempts.clear();
}

export function getLoginRateLimitBucketCountForTests() {
  cleanupExpiredLoginFailures();
  return failedLoginAttempts.size;
}
