import type { FastifyPluginAsync } from "fastify";

import type { AppEnv } from "../app/env.js";
import { registerAdminRoutes } from "./admin/routes.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerFinanceRoutes } from "./finance/routes.js";
import { registerHabitsRoutes } from "./habits/routes.js";
import { registerHealthRoutes } from "./health/routes.js";
import { registerHomeRoutes } from "./home/routes.js";
import { registerNotificationRoutes } from "./notifications/routes.js";
import { registerOnboardingRoutes } from "./onboarding/routes.js";
import { registerPlanningRoutes } from "./planning/routes.js";
import { registerReviewRoutes } from "./reviews/routes.js";
import { registerScoringRoutes } from "./scoring/routes.js";
import { registerSettingsRoutes } from "./settings/routes.js";

export interface ModuleRegistrationOptions {
  env: AppEnv;
}

export const registerModules: FastifyPluginAsync<ModuleRegistrationOptions> = async (
  app,
  options,
) => {
  await app.register(registerHealthRoutes, { prefix: "/health" });
  await app.register(registerAdminRoutes);
  await app.register(registerAuthRoutes, {
    env: options.env,
    prefix: "/auth",
  });
  await app.register(registerFinanceRoutes, { prefix: "/finance" });
  await app.register(registerHabitsRoutes);
  await app.register(registerNotificationRoutes, { prefix: "/notifications" });
  await app.register(registerOnboardingRoutes, { prefix: "/onboarding" });
  await app.register(registerPlanningRoutes);
  await app.register(registerReviewRoutes);
  await app.register(registerScoringRoutes);
  await app.register(registerSettingsRoutes, { prefix: "/settings" });
  await app.register(registerHomeRoutes, { prefix: "/home" });
};
