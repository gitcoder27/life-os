import type { ApiMeta, ApiSuccess } from "@life-os/contracts";

export function getGeneratedAt() {
  return new Date().toISOString();
}

export function withGeneratedAt<T extends object>(payload: T): T & ApiMeta {
  return {
    ...payload,
    generatedAt: getGeneratedAt(),
  };
}

export function withWriteSuccess<T extends object>(payload?: T): ApiSuccess & ApiMeta & T {
  return {
    success: true,
    generatedAt: getGeneratedAt(),
    ...(payload ?? ({} as T)),
  };
}
