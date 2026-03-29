import type { FastifyPluginAsync } from "fastify";

import { registerHabitRoutes } from "./habit-routes.js";
import { registerRoutineRoutes } from "./routine-routes.js";

export const registerHabitsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(registerHabitRoutes);
  await app.register(registerRoutineRoutes);
};
