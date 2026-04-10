type FinanceRouteIntent = "view" | "pay";
type FinanceRouteSection = "due_now" | "pending_bills";

type BuildFinanceRouteOptions = {
  billId?: string | null;
  dueOn?: string | null;
  month?: string | null;
  intent?: FinanceRouteIntent;
  section?: FinanceRouteSection;
};

export const buildFinanceRoute = ({
  billId,
  dueOn,
  month,
  intent = "view",
  section,
}: BuildFinanceRouteOptions): string => {
  const search = new URLSearchParams();
  const resolvedMonth = month ?? dueOn?.slice(0, 7) ?? null;

  if (resolvedMonth) {
    search.set("month", resolvedMonth);
  }

  if (billId) {
    search.set("bill", billId);
  }

  if (intent !== "view") {
    search.set("intent", intent);
  }

  if (section) {
    search.set("section", section);
  }

  const query = search.toString();
  return query ? `/finance?${query}` : "/finance";
};

export const extractFinanceBillId = (entityId: string | null): string | null => {
  if (!entityId) {
    return null;
  }

  const [billId] = entityId.split(":");
  return billId || null;
};

export const extractFinanceBillDueOn = (entityId: string | null): string | null => {
  if (!entityId) {
    return null;
  }

  const [, dueOn] = entityId.split(":");
  return dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null;
};
