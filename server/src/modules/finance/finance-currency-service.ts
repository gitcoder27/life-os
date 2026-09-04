import { Prisma } from "@prisma/client";

type FinanceCurrencyClient = Pick<Prisma.TransactionClient, "userPreference">;

export async function getUserCurrencyCode(
  prisma: FinanceCurrencyClient,
  userId: string,
) {
  const preferences = await prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });

  return preferences?.currencyCode ?? "USD";
}
