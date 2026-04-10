export type FinanceRouteIntent = "view" | "pay";
export type FinanceRouteSection = "due_now" | "pending_bills";

type BuildFinanceRouteOptions = {
  billId?: string | null;
  dueOn?: string | null;
  month?: string | null;
  intent?: FinanceRouteIntent;
  section?: FinanceRouteSection;
};

type FinanceRouteBillLike = {
  id: string;
  dueOn: string;
};

export type FinanceRouteRequest = {
  billId: string | null;
  month: string | null;
  intent: FinanceRouteIntent;
  section: FinanceRouteSection | null;
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

export const buildFinanceBillRoute = (
  bill: FinanceRouteBillLike,
  options: Omit<BuildFinanceRouteOptions, "billId" | "dueOn" | "month"> = {},
) =>
  buildFinanceRoute({
    billId: bill.id,
    dueOn: bill.dueOn,
    ...options,
  });

export const readFinanceRouteRequest = (search: string): FinanceRouteRequest => {
  const params = new URLSearchParams(search);
  const intent = params.get("intent");
  const section = params.get("section");
  const month = params.get("month");

  return {
    billId: params.get("bill"),
    month: month && /^\d{4}-\d{2}$/.test(month) ? month : null,
    intent: intent === "pay" ? "pay" : "view",
    section: section === "due_now" || section === "pending_bills" ? section : null,
  };
};
