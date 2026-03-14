import type { FastifyPluginAsync } from "fastify";

import type { HomeOverviewResponse, IsoDateString } from "@life-os/contracts";
import { z } from "zod";

const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function getGreeting(now: Date) {
  const hour = now.getUTCHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getIsoDate(date: Date): IsoDateString {
  return date.toISOString().slice(0, 10) as IsoDateString;
}

export const registerHomeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/overview", async (request, reply) => {
    const parsed = dateQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid overview date",
      });
    }

    const targetDate: IsoDateString = parsed.data.date
      ? (parsed.data.date as IsoDateString)
      : getIsoDate(new Date());
    const response: HomeOverviewResponse = {
      date: targetDate,
      generatedAt: new Date().toISOString(),
      greeting: getGreeting(new Date()),
      dailyScore: {
        value: 72,
        label: "On Track",
        earnedPoints: 65,
        possiblePoints: 90,
      },
      weeklyMomentum: 74,
      topPriorities: [
        {
          id: "pri_1",
          title: "Complete backend bootstrap",
          slot: 1,
          status: "pending",
        },
      ],
      tasks: [
        {
          id: "tsk_1",
          title: "Finalize API contracts",
          status: "pending",
          scheduledForDate: targetDate,
        },
      ],
      routineSummary: {
        completedItems: 2,
        totalItems: 5,
        currentPeriod: "morning",
      },
      habitSummary: {
        completedToday: 3,
        dueToday: 5,
        streakHighlights: ["Morning routine 4 days", "Water target 2 days"],
      },
      healthSummary: {
        waterMl: 1200,
        waterTargetMl: 2500,
        mealsLogged: 2,
        workoutStatus: "planned",
      },
      financeSummary: {
        spentThisMonth: 420,
        budgetLabel: "Within baseline",
        upcomingBills: 2,
      },
      attentionItems: [
        {
          id: "attn_1",
          title: "Complete daily review tonight",
          kind: "review",
          tone: "warning",
        },
      ],
      notifications: [
        {
          id: "ntf_1",
          title: "Welcome to Life OS",
          body: "This is a placeholder overview payload until real aggregation is wired in.",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    return reply.send(response);
  });
};
