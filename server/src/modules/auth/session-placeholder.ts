import type { FastifyReply, FastifyRequest } from "fastify";

import type { SessionUser } from "@life-os/contracts";

const PLACEHOLDER_USER: SessionUser = {
  id: "usr_owner",
  email: "owner@example.com",
  displayName: "Owner",
};

export function getPlaceholderSessionUser(
  request: FastifyRequest,
  cookieName: string,
): SessionUser | null {
  const sessionCookie = request.cookies[cookieName];

  return sessionCookie ? PLACEHOLDER_USER : null;
}

export function writePlaceholderSession(reply: FastifyReply, cookieName: string) {
  reply.setCookie(cookieName, "dev-session-token", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
}

export function clearPlaceholderSession(reply: FastifyReply, cookieName: string) {
  reply.clearCookie(cookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
}
