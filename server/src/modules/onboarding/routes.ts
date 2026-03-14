import type { FastifyPluginAsync } from "fastify";

import type {
  OnboardingCompleteRequest,
  OnboardingCompleteResponse,
  OnboardingStateResponse,
} from "@life-os/contracts";
import { z } from "zod";

const onboardingCompletionSchema = z.object({
  displayName: z.string().min(1),
  timezone: z.string().min(1),
  currencyCode: z.string().length(3),
  weekStartsOn: z.number().int().min(0).max(6),
  dailyWaterTargetMl: z.number().int().positive(),
  firstWeekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const registerOnboardingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/state", async (_request, reply) => {
    const response: OnboardingStateResponse = {
      isComplete: false,
      completedAt: null,
      nextStep: "account",
      defaults: {
        timezone: "UTC",
        currencyCode: "USD",
        weekStartsOn: 1,
        dailyWaterTargetMl: 2500,
      },
      generatedAt: new Date().toISOString(),
    };

    return reply.send(response);
  });

  app.post("/complete", async (request, reply) => {
    const payload = request.body as OnboardingCompleteRequest;
    const parsed = onboardingCompletionSchema.safeParse(payload);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid onboarding payload",
      });
    }

    const response: OnboardingCompleteResponse = {
      success: true,
      completedAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
    };

    return reply.status(202).send(response);
  });
};
