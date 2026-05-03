import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { describeDatabaseTarget, loadSelectedEnv, parseAppEnv, resolveEnvPath } from "../../src/app/env.js";

type EnvFixture = {
  rootDir: string;
  serverRootDir: string;
};

const tempDirs: string[] = [];

function createEnvFixture(): EnvFixture {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "life-os-env-"));
  const serverRootDir = path.join(rootDir, "server");
  tempDirs.push(rootDir);
  mkdirSync(serverRootDir, { recursive: true });
  return {
    rootDir,
    serverRootDir,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe("env loading", () => {
  it("prefers the server workspace env file over a repo-root match", () => {
    const { rootDir, serverRootDir } = createEnvFixture();
    const rootEnvPath = path.join(rootDir, ".env.production");
    const serverEnvPath = path.join(serverRootDir, ".env.production");

    writeFileSync(rootEnvPath, "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/root_prod\n");
    writeFileSync(serverEnvPath, "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/server_prod\n");

    expect(
      resolveEnvPath({
        cwd: rootDir,
        envFile: null,
        nodeEnv: "production",
        serverRootDir,
      }),
    ).toBe(serverEnvPath);
  });

  it("resolves a relative ENV_FILE against the server workspace when launched from repo root", () => {
    const { rootDir, serverRootDir } = createEnvFixture();
    const serverEnvPath = path.join(serverRootDir, ".env.production");

    writeFileSync(serverEnvPath, "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/server_prod\n");

    expect(
      resolveEnvPath({
        cwd: rootDir,
        envFile: ".env.production",
        serverRootDir,
      }),
    ).toBe(serverEnvPath);
  });

  it("overrides inherited database variables with the selected env file", () => {
    const { rootDir, serverRootDir } = createEnvFixture();
    const serverEnvPath = path.join(serverRootDir, ".env.production");

    writeFileSync(
      serverEnvPath,
      [
        "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_os",
        "DEV_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_os_dev",
        "NODE_ENV=production",
      ].join("\n"),
    );

    const targetEnv: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/stale_dev",
      DEV_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/stale_dev",
      NODE_ENV: "production",
    };

    expect(
      loadSelectedEnv({
        cwd: rootDir,
        envFile: ".env.production",
        serverRootDir,
        targetEnv,
      }),
    ).toBe(serverEnvPath);
    expect(targetEnv.DATABASE_URL).toBe("postgresql://postgres:postgres@localhost:5432/life_os");
    expect(targetEnv.DEV_DATABASE_URL).toBe("postgresql://postgres:postgres@localhost:5432/life_os_dev");
    expect(targetEnv.ENV_FILE).toBe(serverEnvPath);
  });

  it("fails fast when ENV_FILE points to a missing file", () => {
    const { rootDir, serverRootDir } = createEnvFixture();

    expect(() =>
      resolveEnvPath({
        cwd: rootDir,
        envFile: "/tmp/does-not-exist.env",
        serverRootDir,
      }),
    ).toThrow("[env] ENV_FILE was set but no env file was found.");
  });
});

describe("env validation", () => {
  const baseProductionEnv: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
    DEV_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os_dev",
  };

  it("rejects the default session secret in production", () => {
    expect(() =>
      parseAppEnv({
        ...baseProductionEnv,
        SESSION_SECRET: "dev-only-change-me",
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("rejects short production session secrets", () => {
    expect(() =>
      parseAppEnv({
        ...baseProductionEnv,
        SESSION_SECRET: "short-production-secret",
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("accepts a strong explicit production session secret", () => {
    const parsed = parseAppEnv({
      ...baseProductionEnv,
      SESSION_SECRET: "prod-secret-with-at-least-thirty-two-chars",
    });

    expect(parsed.SESSION_SECRET).toBe("prod-secret-with-at-least-thirty-two-chars");
  });

  it("describes database targets without credentials", () => {
    const description = describeDatabaseTarget(
      "postgresql://life_os_user:super-secret@db.example.com:5439/life_os?schema=public",
    );

    expect(description).toBe("host=db.example.com port=5439 database=life_os");
    expect(description).not.toContain("life_os_user");
    expect(description).not.toContain("super-secret");
  });
});
