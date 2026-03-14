import type { ApiMeta, ApiSuccess, EntityId } from "./common.js";

export interface SessionUser {
  id: EntityId;
  email: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends ApiSuccess, ApiMeta {
  user: SessionUser;
}

export interface SessionResponse extends ApiMeta {
  authenticated: boolean;
  user: SessionUser | null;
}

export interface LogoutResponse extends ApiSuccess, ApiMeta {}

export interface LogoutAllResponse extends ApiSuccess, ApiMeta {
  revokedSessions: number;
}
