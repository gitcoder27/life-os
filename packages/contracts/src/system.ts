import type { ApiMeta } from "./common.js";

export interface HealthCheckResponse extends ApiMeta {
  ok: true;
  service: string;
  version: string;
}
