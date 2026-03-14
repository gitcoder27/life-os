import type { FastifyPluginAsync } from "fastify";

import type { AppEnv } from "../app/env.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerHealthRoutes } from "./health/routes.js";
import { registerHomeRoutes } from "./home/routes.js";
import { registerOnboardingRoutes } from "./onboarding/routes.js";

export interface ModuleRegistrationOptions {
  env: AppEnv;
}

export const registerModules: FastifyPluginAsync<ModuleRegistrationOptions> = async (
  app,
  options,
) => {
  await app.register(registerHealthRoutes, { prefix: "/health" });
  await app.register(registerAuthRoutes, {
    env: options.env,
    prefix: "/auth",
  });
  await app.register(registerOnboardingRoutes, { prefix: "/onboarding" });
  await app.register(registerHomeRoutes, { prefix: "/home" });
};
