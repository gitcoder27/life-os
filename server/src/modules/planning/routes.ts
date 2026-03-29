import type { FastifyPluginAsync } from "fastify";

import { registerPlanningGoalRoutes } from "./goal-routes.js";
import { registerPlanningPlanRoutes } from "./plan-routes.js";
import { registerPlanningTaskTemplateRoutes } from "./task-template-routes.js";
import { registerPlanningTaskRoutes } from "./task-routes.js";

export const registerPlanningRoutes: FastifyPluginAsync = async (app) => {
  await app.register(registerPlanningGoalRoutes);
  await app.register(registerPlanningPlanRoutes);
  await app.register(registerPlanningTaskTemplateRoutes);
  await app.register(registerPlanningTaskRoutes);
};
