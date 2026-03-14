import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const registerPrismaPlugin: FastifyPluginAsync = async (app) => {
  const prisma = new PrismaClient();

  app.decorate("prisma", prisma);

  app.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
};
