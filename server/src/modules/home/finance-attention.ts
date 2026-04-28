import type {
  AttentionItem,
  FinanceTimelineItem,
  FinanceTimelineStatus,
} from "@life-os/contracts";

import { buildFinanceRoute } from "../finance/finance-navigation.js";

const actionableSourceTypes = new Set<FinanceTimelineItem["sourceType"]>([
  "income_plan",
  "bill",
  "credit_card_due",
  "loan_emi",
]);

const actionableStatuses = new Set<FinanceTimelineStatus>(["overdue", "due_today"]);

const sourcePriority: Record<FinanceTimelineItem["sourceType"], number> = {
  income_plan: 0,
  income_transaction: 5,
  bill: 1,
  credit_card_due: 2,
  loan_emi: 3,
  planned_expense: 4,
  goal_contribution: 4,
};

const formatMinorCurrency = (amountMinor: number, currencyCode: string) => {
  const amount = amountMinor / 100;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
};

const getAttentionTitle = (item: FinanceTimelineItem) => {
  if (item.sourceType === "income_plan") {
    return item.status === "overdue" ? `${item.title} is overdue` : `Mark ${item.title} received`;
  }

  if (item.sourceType === "bill") {
    return item.status === "overdue" ? `${item.title} is overdue` : item.title;
  }

  return item.status === "overdue" ? `${item.title} is overdue` : `Pay ${item.title}`;
};

const getAttentionDetail = (item: FinanceTimelineItem, currencyCode: string) => {
  const amount = formatMinorCurrency(item.amountMinor, item.currencyCode || currencyCode);
  return item.status === "overdue" ? `${amount} missed on ${item.date}` : `${amount} due today`;
};

const getFinanceAttentionRoute = (item: FinanceTimelineItem) => {
  if (item.sourceType === "bill") {
    return buildFinanceRoute({
      billId: item.sourceId,
      dueOn: item.date,
      intent: item.status === "overdue" || item.status === "due_today" ? "pay" : "view",
      section: item.status === "overdue" || item.status === "due_today" ? "due_now" : "pending_bills",
    });
  }

  return buildFinanceRoute({
    month: item.date.slice(0, 7),
  });
};

const isActionableTimelineItem = (item: FinanceTimelineItem) => {
  if (!actionableSourceTypes.has(item.sourceType)) {
    return false;
  }

  if (!actionableStatuses.has(item.status)) {
    return false;
  }

  if (!item.primaryAction) {
    return false;
  }

  if (item.sourceType === "bill") {
    return item.status === "overdue";
  }

  return true;
};

const sortActionableItems = (left: FinanceTimelineItem, right: FinanceTimelineItem) => {
  const statusDelta =
    (left.status === "overdue" ? 0 : 1) - (right.status === "overdue" ? 0 : 1);
  if (statusDelta !== 0) return statusDelta;

  return (
    left.date.localeCompare(right.date)
    || sourcePriority[left.sourceType] - sourcePriority[right.sourceType]
    || left.title.localeCompare(right.title)
  );
};

export const buildFinanceAttentionItems = (
  timelineItems: FinanceTimelineItem[],
  currencyCode: string,
): AttentionItem[] =>
  timelineItems
    .filter(isActionableTimelineItem)
    .sort(sortActionableItems)
    .map((item) => ({
      id: `finance:${item.sourceType}:${item.sourceId}`,
      title: getAttentionTitle(item),
      kind: "finance" as const,
      tone: item.status === "overdue" ? "urgent" as const : "warning" as const,
      detail: getAttentionDetail(item, currencyCode),
      dismissible: true,
      action: {
        type: "open_route" as const,
        route: getFinanceAttentionRoute(item),
      },
    }));
