import { useState } from "react";

import { useMarkBillPaidMutation } from "../../shared/lib/api";

export const useQuickMarkBillPaid = (todayDate: string) => {
  const mutation = useMarkBillPaidMutation(todayDate);
  const [pendingBillId, setPendingBillId] = useState<string | null>(null);

  const markPaid = async (billId: string) => {
    setPendingBillId(billId);

    try {
      await mutation.mutateAsync({
        billId,
        paidOn: todayDate,
      });
    } finally {
      setPendingBillId(null);
    }
  };

  return {
    markPaid,
    pendingBillId,
    isPending: mutation.isPending,
  };
};
