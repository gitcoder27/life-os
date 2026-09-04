import type { FastifyInstance } from "fastify";
import type {
  AttentionItem,
  FinanceSummary,
  IsoDateString,
  IsoMonthString,
} from "@life-os/contracts";

import { toIsoDateString } from "../../lib/time/date.js";
import { buildFinanceAttentionItems } from "./home-finance-attention.js";
import { buildFinanceRoute } from "./finance-navigation.js";
import { buildFinanceTimeline } from "./finance-timeline-service.js";

export async function loadHomeFinanceSummary(
  app: FastifyInstance,
  input: {
    userId: string;
    targetDate: Date;
    targetIsoDate: IsoDateString;
    monthStartDate: Date;
    nextMonthStartDate: Date;
    currencyCode: string;
  },
): Promise<{
  financeSummary: FinanceSummary;
  attentionItems: AttentionItem[];
}> {
  const [expenses, todayAdminItems, monthlyPendingAdminItems, financeTimeline] = await Promise.all([
    app.prisma.expense.findMany({
      where: {
        userId: input.userId,
        spentOn: {
          gte: input.monthStartDate,
          lt: input.nextMonthStartDate,
        },
      },
    }),
    app.prisma.adminItem.findMany({
      where: {
        userId: input.userId,
        itemType: "BILL",
        dueOn: input.targetDate,
        status: {
          in: ["PENDING", "RESCHEDULED"],
        },
      },
      orderBy: [{ dueOn: "asc" }],
    }),
    app.prisma.adminItem.findMany({
      where: {
        userId: input.userId,
        itemType: "BILL",
        dueOn: {
          gte: input.monthStartDate,
          lt: input.nextMonthStartDate,
        },
        status: {
          in: ["PENDING", "RESCHEDULED"],
        },
      },
      orderBy: [{ dueOn: "asc" }],
    }),
    buildFinanceTimeline(
      app,
      input.userId,
      input.targetIsoDate.slice(0, 7) as IsoMonthString,
    ),
  ]);
  const focusFinanceBill =
    todayAdminItems[0]
    ?? monthlyPendingAdminItems[0]
    ?? null;
  const attentionItems: AttentionItem[] = [];

  for (const item of todayAdminItems.slice(0, 2)) {
    attentionItems.push({
      id: item.id,
      title: item.title,
      kind: "admin",
      tone: "urgent",
      detail: "Open Finance to handle the bill.",
      dismissible: true,
      action: {
        type: "open_route",
        route: buildFinanceRoute({
          billId: item.id,
          dueOn: toIsoDateString(item.dueOn),
          intent: "pay",
          section: "due_now",
        }),
      },
    });
  }

  const upcomingAdminItem = monthlyPendingAdminItems.find((item) =>
    toIsoDateString(item.dueOn) > input.targetIsoDate,
  );
  if (todayAdminItems.length === 0 && upcomingAdminItem) {
    attentionItems.push({
      id: `upcoming-admin:${upcomingAdminItem.id}`,
      title: upcomingAdminItem.title,
      kind: "finance",
      tone: "warning",
      detail: `Upcoming on ${toIsoDateString(upcomingAdminItem.dueOn)}.`,
      dismissible: true,
      action: {
        type: "open_route",
        route: buildFinanceRoute({
          billId: upcomingAdminItem.id,
          dueOn: toIsoDateString(upcomingAdminItem.dueOn),
          section: "pending_bills",
        }),
      },
    });
  }

  attentionItems.push(...buildFinanceAttentionItems(financeTimeline.items, financeTimeline.currencyCode));

  return {
    financeSummary: {
      spentThisMonthMinor: expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
      currencyCode: input.currencyCode,
      budgetLabel: expenses.length === 0 ? "No spend logged" : "Current month spend",
      upcomingBills: monthlyPendingAdminItems.length,
      focusBill: focusFinanceBill
        ? {
            id: focusFinanceBill.id,
            title: focusFinanceBill.title,
            dueOn: toIsoDateString(focusFinanceBill.dueOn),
            amountMinor: focusFinanceBill.amountMinor,
            status: focusFinanceBill.status === "RESCHEDULED" ? "rescheduled" : "pending",
          }
        : null,
      action: focusFinanceBill
        ? {
            type: "open_route",
            route: buildFinanceRoute({
              billId: focusFinanceBill.id,
              dueOn: toIsoDateString(focusFinanceBill.dueOn),
              section: toIsoDateString(focusFinanceBill.dueOn) <= input.targetIsoDate ? "due_now" : "pending_bills",
            }),
          }
        : {
            type: "open_route",
            route: buildFinanceRoute({
              month: input.targetIsoDate.slice(0, 7),
            }),
          },
    },
    attentionItems,
  };
}
