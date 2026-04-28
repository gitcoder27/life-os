import type { FinanceSafeToSpendBreakdown } from "@life-os/contracts";

interface BuildFinanceSafeToSpendBreakdownInput {
  currencyCode: string;
  cashAvailableMinor: number;
  incomeReceivedMinor: number;
  unpaidBillsMinor: number;
  cardDuesMinor: number;
  loanEmisMinor: number;
  plannedExpensesMinor: number;
  goalCommitmentsMinor: number;
  billCount: number;
  cardCount: number;
  loanCount: number;
  goalCount: number;
}

export function buildFinanceSafeToSpendBreakdown(
  input: BuildFinanceSafeToSpendBreakdownInput,
): FinanceSafeToSpendBreakdown {
  const totalDeductionsMinor =
    input.unpaidBillsMinor
    + input.cardDuesMinor
    + input.loanEmisMinor
    + input.plannedExpensesMinor
    + input.goalCommitmentsMinor;
  const safeToSpendMinor = input.cashAvailableMinor - totalDeductionsMinor;

  return {
    currencyCode: input.currencyCode,
    cashAvailableMinor: input.cashAvailableMinor,
    incomeReceivedMinor: input.incomeReceivedMinor,
    unpaidBillsMinor: input.unpaidBillsMinor,
    cardDuesMinor: input.cardDuesMinor,
    loanEmisMinor: input.loanEmisMinor,
    plannedExpensesMinor: input.plannedExpensesMinor,
    goalCommitmentsMinor: input.goalCommitmentsMinor,
    totalDeductionsMinor,
    safeToSpendMinor,
    lines: [
      {
        key: "cash_available",
        label: "Cash available",
        amountMinor: input.cashAvailableMinor,
        role: "starting_balance",
        sourceCount: null,
      },
      {
        key: "income_received",
        label: "Income received",
        amountMinor: input.incomeReceivedMinor,
        role: "context",
        sourceCount: null,
      },
      {
        key: "upcoming_bills",
        label: "Upcoming bills",
        amountMinor: input.unpaidBillsMinor,
        role: "deduction",
        sourceCount: input.billCount,
      },
      {
        key: "card_dues",
        label: "Card dues",
        amountMinor: input.cardDuesMinor,
        role: "deduction",
        sourceCount: input.cardCount,
      },
      {
        key: "loan_emis",
        label: "Loan EMIs",
        amountMinor: input.loanEmisMinor,
        role: "deduction",
        sourceCount: input.loanCount,
      },
      {
        key: "planned_expenses",
        label: "Planned expenses",
        amountMinor: input.plannedExpensesMinor,
        role: "deduction",
        sourceCount: input.plannedExpensesMinor > 0 ? 1 : 0,
      },
      {
        key: "goal_commitments",
        label: "Goal commitments",
        amountMinor: input.goalCommitmentsMinor,
        role: "deduction",
        sourceCount: input.goalCount,
      },
      {
        key: "safe_to_spend",
        label: "Safe to spend",
        amountMinor: safeToSpendMinor,
        role: "result",
        sourceCount: null,
      },
    ],
  };
}
