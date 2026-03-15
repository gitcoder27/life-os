import Fastify from "fastify";
import { createMockPrisma } from "./test/utils/mock-prisma.js";
import { registerModules } from "./src/modules/index.js";

const app = Fastify({ logger: false });
app.decorate("prisma", createMockPrisma());
app.decorateRequest("auth", null);
app.addHook("onRequest", async (request) => {
  request.auth = {
    sessionToken: "session-token",
    sessionId: "session-id",
    userId: "user-1",
    user: { id: "user-1", email: "owner@example.com", displayName: "Owner" },
  };
});

const testEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  APP_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "dev-only-change-me",
  SESSION_TTL_DAYS: 14,
  CSRF_COOKIE_NAME: "life_os_csrf",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  OWNER_DISPLAY_NAME: "Owner",
  OWNER_EMAIL: "owner@example.com",
  OWNER_PASSWORD: "password123",
};

await app.register(registerModules, { env: testEnv }, { prefix: "/api" });
await app.ready();

console.log(app.printRoutes({ commonPrefix: false }));

for (const url of [
  "/api/admin/admin-items",
  "/api/admin-items",
  "/api/finance/summary",
  "/api/health/summary",
  "/api/habits",
  "/api/notifications",
  "/api/onboarding/state",
  "/api/goals",
  "/api/reviews/daily/2026-03-14",
  "/api/reviews/weekly/2026-03-14",
  "/api/reviews/monthly/2026-03-01",
  "/api/scores/weekly-momentum?endingOn=2026-03-14",
  "/api/scores/daily/2026-03-14",
  "/api/home/overview",
  "/api/auth/session",
]) {
  const response = await app.inject({
    method: "GET",
    url: url,
  });
  console.log(url, response.statusCode, response.body.slice(0, 140));
}
