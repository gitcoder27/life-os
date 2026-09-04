// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FinanceSetupDrawer,
  type AccountForm,
  type CategoryForm,
  type CreditCardForm,
  type IncomeForm,
  type LoanForm,
  type RecurringBillForm,
  type SetupTab,
} from "./FinanceSetupDrawer";

afterEach(() => {
  cleanup();
});

const emptyAccountForm: AccountForm = {
  name: "",
  accountType: "bank",
  openingBalance: "",
};

const emptyIncomeForm: IncomeForm = {
  title: "Salary",
  accountId: "",
  amount: "",
  nextExpectedOn: "2026-05-19",
};

const emptyCategoryForm: CategoryForm = {
  name: "",
  color: "",
};

const emptyRecurringBillForm: RecurringBillForm = {
  title: "",
  amount: "",
  categoryId: "",
  nextDueOn: "2026-05-19",
};

const emptyCreditCardForm: CreditCardForm = {
  name: "",
  issuer: "",
  paymentAccountId: "",
  creditLimit: "",
  outstandingBalance: "",
  minimumDue: "",
  paymentDueDay: "",
};

const emptyLoanForm: LoanForm = {
  name: "",
  lender: "",
  paymentAccountId: "",
  principalAmount: "",
  outstandingBalance: "",
  emiAmount: "",
  dueDay: "",
};

describe("FinanceSetupDrawer", () => {
  it("switches from recurring bills to categories through an accessible Manage button", async () => {
    const user = userEvent.setup();

    function Harness() {
      const drawerRef = useRef<HTMLElement>(null);
      const closeButtonRef = useRef<HTMLButtonElement>(null);
      const [setupTab, setSetupTab] = useState<SetupTab>("recurring");
      const [accountForm, setAccountForm] = useState(emptyAccountForm);
      const [incomeForm, setIncomeForm] = useState(emptyIncomeForm);
      const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
      const [recurringBillForm, setRecurringBillForm] = useState(emptyRecurringBillForm);
      const [creditCardForm, setCreditCardForm] = useState(emptyCreditCardForm);
      const [loanForm, setLoanForm] = useState(emptyLoanForm);

      return (
        <FinanceSetupDrawer
          activeAccounts={[{ id: "checking", name: "Checking" }]}
          activeCategories={[{ id: "utilities", name: "Utilities", color: null }]}
          activeCreditCards={[]}
          activeLoans={[]}
          accountForm={accountForm}
          accountMap={new Map()}
          accounts={[]}
          categoryForm={categoryForm}
          categoryMap={new Map()}
          closeButtonRef={closeButtonRef}
          creditCardForm={creditCardForm}
          currency="USD"
          drawerRef={drawerRef}
          incomeForm={incomeForm}
          incomePlans={[]}
          isCreatingAccount={false}
          isCreatingCategory={false}
          isCreatingCreditCard={false}
          isCreatingIncome={false}
          isCreatingLoan={false}
          isCreatingRecurringBill={false}
          isReceivingIncome={false}
          isUndoingIncome={false}
          isUpdatingAccount={false}
          isUpdatingCategory={false}
          isUpdatingCreditCard={false}
          isUpdatingIncome={false}
          isUpdatingLoan={false}
          isUpdatingRecurringBill={false}
          loanForm={loanForm}
          onArchiveAccount={vi.fn()}
          onArchiveCard={vi.fn()}
          onArchiveCategory={vi.fn()}
          onArchiveIncome={vi.fn()}
          onArchiveLoan={vi.fn()}
          onArchiveRecurringBill={vi.fn()}
          onClose={vi.fn()}
          onCreateAccount={vi.fn()}
          onCreateCategory={vi.fn()}
          onCreateCreditCard={vi.fn()}
          onCreateIncome={vi.fn()}
          onCreateLoan={vi.fn()}
          onCreateRecurringBill={vi.fn()}
          onMarkIncomeReceived={vi.fn()}
          onPauseIncome={vi.fn()}
          onRestoreAccount={vi.fn()}
          onToggleRecurringBill={vi.fn()}
          onUndoIncomeReceipt={vi.fn()}
          plannedIncomeMinor={0}
          recurringBillForm={recurringBillForm}
          setupNavItems={[
            { key: "accounts", label: "Accounts", count: 1 },
            { key: "categories", label: "Categories", count: 1 },
            { key: "recurring", label: "Bills", count: 0 },
          ]}
          setupTab={setupTab}
          setAccountForm={setAccountForm}
          setCategoryForm={setCategoryForm}
          setCreditCardForm={setCreditCardForm}
          setIncomeForm={setIncomeForm}
          setLoanForm={setLoanForm}
          setRecurringBillForm={setRecurringBillForm}
          setSetupTab={setSetupTab}
          totalCashMinor={0}
          visibleRecurringBills={[]}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Manage" }));

    expect(screen.getByRole("button", { name: "Add category" })).toBeTruthy();
    expect(screen.getByText("For bills and expenses")).toBeTruthy();
  });
});
