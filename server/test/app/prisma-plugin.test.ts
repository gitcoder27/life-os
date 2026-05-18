import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaConstructorMock = vi.hoisted(() => vi.fn());
const disconnectMock = vi.hoisted(() => vi.fn());

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaConstructorMock,
}));

import { registerPrismaPlugin } from "../../src/app/plugins/prisma.js";

beforeEach(() => {
  prismaConstructorMock.mockReset();
  disconnectMock.mockReset();
  prismaConstructorMock.mockReturnValue({
    $disconnect: disconnectMock,
  });
});

describe("registerPrismaPlugin", () => {
  it("decorates Fastify with Prisma and disconnects on close", async () => {
    const hooks: Array<(instance: any) => Promise<void>> = [];
    const app = {
      decorate: vi.fn(),
      addHook: vi.fn((_name: string, hook: (instance: any) => Promise<void>) => {
        hooks.push(hook);
      }),
    };

    await registerPrismaPlugin(app as never, {});

    const prisma = prismaConstructorMock.mock.results[0]?.value;
    expect(app.decorate).toHaveBeenCalledWith("prisma", prisma);
    expect(app.addHook).toHaveBeenCalledWith("onClose", expect.any(Function));

    await hooks[0]?.({ prisma });

    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
