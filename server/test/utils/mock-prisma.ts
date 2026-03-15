import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

type ModelBag = Record<string, MockFn>;

function createModelBag() {
  const modelMethods: ModelBag = {};

  return new Proxy(modelMethods, {
    get(target, prop) {
      const key = String(prop);
      if (!(key in target)) {
        target[key] = vi.fn();
      }

      return target[key];
    },
  });
}

export function createMockPrisma() {
  const modelCache: Record<string, unknown> = {};
  const topLevel: Record<string, unknown> = {
    $disconnect: vi.fn(),
    $transaction: vi.fn(async (callback: (transactionPrisma: unknown) => Promise<unknown>) => {
      return callback(mockPrisma as unknown);
    }),
  };

  const mockPrisma = new Proxy(topLevel, {
    get(target, prop) {
      const key = String(prop);
      if (!(key in target)) {
        modelCache[key] ??= createModelBag();
        target[key] = modelCache[key];
      }

      return target[key];
    },
  }) as Record<string, unknown>;

  return mockPrisma as Record<string, unknown>;
}
