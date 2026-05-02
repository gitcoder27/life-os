import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  detectRuntimeConfig,
  runInteractiveUserAdmin,
} from "../../../src/cli/user-admin.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed"),
    verify: vi.fn(),
  },
}));

function createServerCheckout(appRootDir: string, envFiles: string[] = []) {
  const serverRootDir = path.join(appRootDir, "server");
  mkdirSync(path.join(serverRootDir, "src", "cli"), { recursive: true });
  writeFileSync(path.join(serverRootDir, "package.json"), "{}");
  writeFileSync(path.join(serverRootDir, "src", "cli", "users.ts"), "");

  for (const envFile of envFiles) {
    writeFileSync(path.join(serverRootDir, envFile), "");
  }

  return serverRootDir;
}

function createIo(answers: string[]) {
  const info = vi.fn();
  const error = vi.fn();
  const prompt = vi.fn(async () => answers.shift() ?? "7");
  const promptSecret = vi.fn(async () => answers.shift() ?? "password123");

  return {
    info,
    error,
    prompt,
    promptSecret,
  };
}

describe("interactive user admin CLI", () => {
  it("detects the development env file from a Development checkout", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "life-os-dev-"));
    const appRootDir = path.join(root, "Development", "life-os");
    const serverRootDir = createServerCheckout(appRootDir, [".env.development"]);

    const config = detectRuntimeConfig([], serverRootDir);

    expect(config.nodeEnv).toBe("development");
    expect(config.envFile).toBe(path.join(serverRootDir, ".env.development"));
  });

  it("detects the production env file from an apps/life-os-prod checkout", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "life-os-prod-"));
    const appRootDir = path.join(root, "apps", "life-os-prod");
    const serverRootDir = createServerCheckout(appRootDir, [".env.production"]);

    const config = detectRuntimeConfig([], appRootDir);

    expect(config.nodeEnv).toBe("production");
    expect(config.envFile).toBe(path.join(serverRootDir, ".env.production"));
  });

  it("lists users from the interactive menu", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo(["1", "7"]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "first@example.com",
        displayName: "First User",
        status: "ACTIVE",
        onboardedAt: null,
        lastLoginAt: null,
      },
    ]);

    const exitCode = await runInteractiveUserAdmin({
      prisma,
      io,
      context: {
        nodeEnv: "development",
        envFile: "/tmp/.env.development",
        databaseName: "life_os_dev",
      },
    });

    expect(exitCode).toBe(0);
    expect(io.info).toHaveBeenCalledWith(
      "user-1\tfirst@example.com\tACTIVE\tFirst User\t-\t-",
    );
  });

  it("creates users from the interactive menu", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo([
      "2",
      "new@example.com",
      "password123",
      "password123",
      "New User",
      "7",
    ]);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-2",
      email: "new@example.com",
    });
    prisma.auditEvent.create.mockResolvedValue({});

    const exitCode = await runInteractiveUserAdmin({
      prisma,
      io,
      context: {
        nodeEnv: "development",
        envFile: "/tmp/.env.development",
        databaseName: "life_os_dev",
      },
    });

    expect(exitCode).toBe(0);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(io.info).toHaveBeenCalledWith("Created user new@example.com (user-2).");
  });

  it("requires confirmation before production password resets", async () => {
    const prisma = createMockPrisma() as any;
    const io = createIo([
      "3",
      "first@example.com",
      "password123",
      "password123",
      "no",
      "7",
    ]);

    const exitCode = await runInteractiveUserAdmin({
      prisma,
      io,
      context: {
        nodeEnv: "production",
        envFile: "/tmp/.env.production",
        databaseName: "life_os",
      },
    });

    expect(exitCode).toBe(0);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(io.info).toHaveBeenCalledWith("Cancelled.");
  });
});
