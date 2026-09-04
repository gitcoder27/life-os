import type { FastifyPluginAsync } from "fastify";

import { registerHealthLogRoutes } from "./health-log-routes.js";
import { registerHealthMealPlanRoutes } from "./health-meal-plan-routes.js";
import { registerHealthMealTemplateRoutes } from "./health-meal-template-routes.js";
import { registerHealthSummaryRoutes } from "./health-summary-routes.js";

export const registerHealthRoutes: FastifyPluginAsync = async (app) => {
  await app.register(registerHealthLogRoutes);
  await app.register(registerHealthMealPlanRoutes);
  await app.register(registerHealthMealTemplateRoutes);
  await app.register(registerHealthSummaryRoutes);
};
