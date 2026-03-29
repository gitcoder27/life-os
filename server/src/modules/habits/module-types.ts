import type { FastifyPluginAsync } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";

export type HabitsApp = Parameters<FastifyPluginAsync>[0];
export type HabitsPrisma = PrismaClient | Prisma.TransactionClient;
