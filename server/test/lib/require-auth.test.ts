import { describe, expect, it } from "vitest";

import { AppError } from "../../src/lib/errors/app-error.js";
import { requireAuthenticatedUser } from "../../src/lib/auth/require-auth.js";

describe("requireAuthenticatedUser", () => {
  it("returns the auth user when present", () => {
    const user = { id: "u1", email: "u@example.com", displayName: "User" };

    expect(requireAuthenticatedUser({ auth: { user } } as any)).toEqual(user);
  });

  it("throws UNAUTHENTICATED when request has no user", () => {
    const request = { auth: { user: null } } as any;

    try {
      requireAuthenticatedUser(request);
      expect.fail("Expected requireAuthenticatedUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("UNAUTHENTICATED");
      expect((error as AppError).statusCode).toBe(401);
    }
  });
});
