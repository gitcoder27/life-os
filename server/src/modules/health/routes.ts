import type { FastifyPluginAsync } from "fastify";

export const registerHealthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
  }));
};
