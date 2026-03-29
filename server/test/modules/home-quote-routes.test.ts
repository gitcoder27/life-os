import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerHomeRoutes } from "../../src/modules/home/routes.js";
import { createMockPrisma } from "../utils/mock-prisma.js";

function createFetchResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

function parseBody<T>(body: string) {
  return JSON.parse(body) as T;
}

describe("home quote routes", () => {
  const fetchMock = vi.fn();
  const authenticatedUser = {
    id: "user-1",
    email: "owner@example.com",
    displayName: "Owner",
  };

  let app: Awaited<ReturnType<typeof Fastify>> | undefined;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T08:00:00.000Z"));
    vi.stubGlobal("fetch", fetchMock);

    app = Fastify({ logger: false });
    app.decorate("prisma", createMockPrisma());
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionToken: "session-token",
        sessionId: "session-id",
        userId: authenticatedUser.id,
        user: authenticatedUser,
      };
    });

    await app.register(registerHomeRoutes, { prefix: "/api/home" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("serves different quotes from the cached ZenQuotes batch", async () => {
    fetchMock.mockResolvedValue(
      createFetchResponse([
        { q: "Stay with it.", a: "Coach" },
        { q: "Make the next hour count.", a: "Builder" },
        { q: "Protect momentum.", a: "Owner" },
      ]),
    );

    const firstResponse = await app!.inject({ method: "GET", url: "/api/home/quote" });
    const secondResponse = await app!.inject({ method: "GET", url: "/api/home/quote" });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstPayload = parseBody<{ quote: { text: string; author: string; attributionUrl: string } }>(firstResponse.body);
    const secondPayload = parseBody<{ quote: { text: string; author: string; attributionUrl: string } }>(secondResponse.body);

    expect(firstPayload.quote.attributionUrl).toBe("https://zenquotes.io");
    expect(secondPayload.quote.attributionUrl).toBe("https://zenquotes.io");
    expect(`${firstPayload.quote.text}::${firstPayload.quote.author}`).not.toBe(
      `${secondPayload.quote.text}::${secondPayload.quote.author}`,
    );
  });

  it("refreshes the batch after it is exhausted", async () => {
    fetchMock
      .mockResolvedValueOnce(createFetchResponse([{ q: "First quote.", a: "Author One" }]))
      .mockResolvedValueOnce(createFetchResponse([{ q: "Second quote.", a: "Author Two" }]));

    const firstResponse = await app!.inject({ method: "GET", url: "/api/home/quote" });
    const secondResponse = await app!.inject({ method: "GET", url: "/api/home/quote" });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstPayload = parseBody<{ quote: { text: string } }>(firstResponse.body);
    const secondPayload = parseBody<{ quote: { text: string } }>(secondResponse.body);

    expect(firstPayload.quote.text).toBe("First quote.");
    expect(secondPayload.quote.text).toBe("Second quote.");
  });

  it("falls back to the cached batch when a refresh fails after expiry", async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse([
        { q: "Keep showing up.", a: "Coach" },
        { q: "Finish the next rep.", a: "Trainer" },
      ]),
    );

    const firstResponse = await app!.inject({ method: "GET", url: "/api/home/quote" });
    expect(firstResponse.statusCode).toBe(200);
    const firstPayload = parseBody<{ quote: { text: string; author: string } }>(firstResponse.body);

    vi.setSystemTime(new Date("2026-03-31T09:00:00.000Z"));
    fetchMock.mockRejectedValueOnce(new Error("zenquotes unavailable"));

    const secondResponse = await app!.inject({ method: "GET", url: "/api/home/quote" });
    expect(secondResponse.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondPayload = parseBody<{ quote: { text: string; author: string } }>(secondResponse.body);
    expect(`${secondPayload.quote.text}::${secondPayload.quote.author}`).not.toBe(
      `${firstPayload.quote.text}::${firstPayload.quote.author}`,
    );
    expect(
      [
        "Keep showing up.::Coach",
        "Finish the next rep.::Trainer",
      ],
    ).toContain(`${secondPayload.quote.text}::${secondPayload.quote.author}`);
  });

  it("returns 503 when ZenQuotes is unavailable and no cache exists", async () => {
    fetchMock.mockRejectedValueOnce(new Error("zenquotes unavailable"));

    const response = await app!.inject({ method: "GET", url: "/api/home/quote" });

    expect(response.statusCode).toBe(503);
    expect(parseBody<{ message: string }>(response.body).message).toBe(
      "Motivational quote is unavailable right now.",
    );
  });
});
