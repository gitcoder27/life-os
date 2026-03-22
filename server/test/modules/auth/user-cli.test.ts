import { describe, expect, it, vi } from "vitest";

import { runUserCli } from "../../../src/cli/users.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed"),
    verify: vi.fn(),
  },
}));

function createIo() {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe("user CLI", () => {
  it("prints usage when no command is supplied", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo();

    const exitCode = await runUserCli([], {
      prisma,
      io,
    });

    expect(exitCode).toBe(0);
    expect(io.info).toHaveBeenCalledWith("Usage:");
  });

  it("creates a user from CLI arguments", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "first@example.com",
    });
    prisma.auditEvent.create.mockResolvedValue({});

    const exitCode = await runUserCli(
      [
        "create",
        "--email",
        "first@example.com",
        "--password",
        "password123",
        "--display-name",
        "First User",
      ],
      {
        prisma,
        io,
      },
    );

    expect(exitCode).toBe(0);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(io.info).toHaveBeenCalledWith("Created user first@example.com (user-1).");
  });

  it("updates passwords from CLI arguments", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "first@example.com",
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "first@example.com",
    });
    prisma.session.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditEvent.create.mockResolvedValue({});

    const exitCode = await runUserCli(
      [
        "set-password",
        "--email",
        "first@example.com",
        "--password",
        "new-password123",
      ],
      {
        prisma,
        io,
      },
    );

    expect(exitCode).toBe(0);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(io.info).toHaveBeenCalledWith(
      "Updated password for first@example.com; revoked 2 session(s).",
    );
  });

  it("disables users from CLI arguments", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "first@example.com",
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "first@example.com",
      status: "DISABLED",
    });
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    prisma.auditEvent.create.mockResolvedValue({});

    const exitCode = await runUserCli(
      [
        "disable",
        "--email",
        "first@example.com",
      ],
      {
        prisma,
        io,
      },
    );

    expect(exitCode).toBe(0);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "DISABLED",
        },
      }),
    );
    expect(io.info).toHaveBeenCalledWith(
      "Updated first@example.com to DISABLED; revoked 1 session(s).",
    );
  });

  it("lists users in tabular output", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo();
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "first@example.com",
        displayName: "First User",
        status: "ACTIVE",
        createdAt: new Date("2026-03-22T00:00:00.000Z"),
        onboardedAt: null,
        lastLoginAt: null,
      },
    ]);

    const exitCode = await runUserCli(["list"], {
      prisma,
      io,
    });

    expect(exitCode).toBe(0);
    expect(io.info).toHaveBeenNthCalledWith(
      1,
      "id\temail\tstatus\tdisplayName\tonboardedAt\tlastLoginAt",
    );
    expect(io.info).toHaveBeenNthCalledWith(
      2,
      "user-1\tfirst@example.com\tACTIVE\tFirst User\t-\t-",
    );
  });
});
