// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FinanceBillEditor,
  FinanceTransactionEditor,
  type BillForm,
  type TransactionForm,
} from "./FinanceEntryEditors";

afterEach(() => {
  cleanup();
});

describe("FinanceEntryEditors", () => {
  it("filters the transfer target account away from the source account", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const initialForm: TransactionForm = {
      transactionType: "expense",
      accountId: "",
      transferAccountId: "",
      amount: "",
      occurredOn: "2026-05-19",
      description: "",
      expenseCategoryId: "",
    };

    function Harness() {
      const [form, setForm] = useState(initialForm);

      return (
        <FinanceTransactionEditor
          accounts={[
            { id: "checking", name: "Checking" },
            { id: "savings", name: "Savings" },
          ]}
          categories={[{ id: "groceries", name: "Groceries" }]}
          form={form}
          setForm={setForm}
          isSaving={false}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    }

    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Type"), "transfer");
    await user.selectOptions(screen.getByLabelText("Account"), "checking");

    const targetSelect = screen.getByLabelText("To") as HTMLSelectElement;
    expect(Array.from(targetSelect.options).map((option) => option.value)).toEqual(["", "savings"]);

    await user.click(screen.getByRole("button", { name: "Save entry" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("keeps bill category management and save callbacks wired", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onManageCategories = vi.fn();
    const initialForm: BillForm = {
      title: "",
      dueOn: "2026-05-19",
      amount: "",
      categoryId: "",
    };

    function Harness() {
      const [form, setForm] = useState(initialForm);

      return (
        <FinanceBillEditor
          categories={[{ id: "utilities", name: "Utilities" }]}
          form={form}
          setForm={setForm}
          isSaving={false}
          onSave={onSave}
          onCancel={vi.fn()}
          onManageCategories={onManageCategories}
        />
      );
    }

    render(<Harness />);

    await user.type(screen.getByLabelText("Bill"), "Internet");
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "utilities");
    await user.click(screen.getByRole("button", { name: "Manage" }));
    await user.click(screen.getByRole("button", { name: "Save bill" }));

    expect(onManageCategories).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
