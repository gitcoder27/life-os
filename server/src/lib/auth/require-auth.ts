import type { FastifyRequest } from "fastify";

import type { SessionUser } from "@life-os/contracts";

import { AppError } from "../errors/app-error.js";

export function requireAuthenticatedUser(request: FastifyRequest): SessionUser {
  if (!request.auth.user) {
    throw new AppError({
      statusCode: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  }

  return request.auth.user;
}
