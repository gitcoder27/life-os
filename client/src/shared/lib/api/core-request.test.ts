import { afterEach, describe, expect, it, vi } from "vitest";

const importCore = async (env: Record<string, string> = {}) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }

  return import("./core");
};

const stubBrowserGlobals = (options: {
  cookie?: string;
  fetchResponse: Response;
}) => {
  const fetch = vi.fn(async () => options.fetchResponse);

  vi.stubGlobal("window", {
    location: {
      origin: "http://life-os.test",
    },
  });
  vi.stubGlobal("document", {
    cookie: options.cookie ?? "",
  });
  vi.stubGlobal("fetch", fetch);

  return fetch;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("builds relative URLs with query params and includes credentials", async () => {
    const fetch = stubBrowserGlobals({
      fetchResponse: Response.json({ ok: true }),
    });
    const { apiRequest } = await importCore();

    await expect(apiRequest("/api/tasks", {
      query: {
        status: "pending",
        empty: "",
        missing: undefined,
      },
    })).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith("http://life-os.test/api/tasks?status=pending", expect.objectContaining({
      credentials: "include",
      method: "GET",
    }));
  });

  it("sends JSON bodies, preferred timezone, and CSRF headers for unsafe requests", async () => {
    const fetch = stubBrowserGlobals({
      cookie: "life_os_csrf=token%20123",
      fetchResponse: Response.json({ saved: true }),
    });
    const { apiRequest } = await importCore({
      VITE_CSRF_COOKIE_NAME: "life_os_csrf",
    });
    const { setPreferredTimezone } = await import("../date");
    setPreferredTimezone("Asia/Kolkata");

    await apiRequest("/api/tasks", {
      method: "POST",
      body: {
        title: "Capture",
      },
    });

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(init.body).toBe(JSON.stringify({ title: "Capture" }));
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-client-timezone")).toBe("Asia/Kolkata");
    expect(headers.get("x-csrf-token")).toBe("token 123");
  });

  it("does not require a CSRF token for login requests", async () => {
    const fetch = stubBrowserGlobals({
      fetchResponse: Response.json({ user: null }),
    });
    const { apiRequest } = await importCore({
      VITE_CSRF_COOKIE_NAME: "life_os_csrf",
    });

    await apiRequest("/api/auth/login", {
      method: "POST",
      body: {
        email: "owner@example.com",
        password: "secret",
      },
    });

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Headers).get("x-csrf-token")).toBeNull();
  });

  it("maps API error payloads into ApiClientError", async () => {
    stubBrowserGlobals({
      fetchResponse: Response.json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        fieldErrors: [{ field: "title", message: "Required" }],
      }, { status: 400 }),
    });
    const { ApiClientError, apiRequest } = await importCore();

    try {
      await apiRequest("/api/tasks");
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({
        name: "ApiClientError",
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        fieldErrors: [{ field: "title", message: "Required" }],
      });
    }
  });

  it("returns undefined for empty successful responses", async () => {
    stubBrowserGlobals({
      fetchResponse: new Response(null, { status: 204 }),
    });
    const { apiRequest } = await importCore({
      VITE_CSRF_COOKIE_NAME: "life_os_csrf",
    });

    await expect(apiRequest("/api/tasks/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
