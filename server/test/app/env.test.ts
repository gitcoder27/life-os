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

  it("preserves inherited variables by default when loading the selected env file", () => {
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
    expect(targetEnv.DATABASE_URL).toBe("postgresql://postgres:postgres@localhost:5432/stale_dev");
    expect(targetEnv.DEV_DATABASE_URL).toBe("postgresql://postgres:postgres@localhost:5432/stale_dev");
    expect(targetEnv.ENV_FILE).toBe(serverEnvPath);
  });

  it("allows explicit env-file override mode for local or admin workflows", () => {
    const { rootDir, serverRootDir } = createEnvFixture();
    const serverEnvPath = path.join(serverRootDir, ".env.production");

    writeFileSync(
      serverEnvPath,
      [
        "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_os",
        "DEV_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_os_dev",
      ].join("\n"),
    );

    const targetEnv: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/stale_dev",
      ENV_FILE_OVERRIDE: "true",
    };

    loadSelectedEnv({
      cwd: rootDir,
      envFile: ".env.production",
      serverRootDir,
      targetEnv,
    });

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
    DATABASE_SEPARATION_STRICT: "true",
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

  it("parses string booleans safely", () => {
    const parsed = parseAppEnv({
      NODE_ENV: "development",
      DATABASE_SEPARATION_STRICT: "false",
      AUTO_CREATE_DATABASE: "false",
      AUTO_APPLY_MIGRATIONS: "false",
      ENV_FILE_OVERRIDE: "false",
      TRUST_PROXY: "true",
      ALLOW_PRODUCTION_BOOTSTRAP: "false",
    });

    expect(parsed.DATABASE_SEPARATION_STRICT).toBe(false);
    expect(parsed.AUTO_CREATE_DATABASE).toBe(false);
    expect(parsed.AUTO_APPLY_MIGRATIONS).toBe(false);
    expect(parsed.ENV_FILE_OVERRIDE).toBe(false);
    expect(parsed.TRUST_PROXY).toBe(true);
    expect(parsed.ALLOW_PRODUCTION_BOOTSTRAP).toBe(false);
  });

  it("requires strict database separation in production", () => {
    expect(() =>
      parseAppEnv({
        ...baseProductionEnv,
        DATABASE_SEPARATION_STRICT: "false",
        SESSION_SECRET: "prod-secret-with-at-least-thirty-two-chars",
      }),
    ).toThrow(/DATABASE_SEPARATION_STRICT/);
  });

  it("rejects production bootstrap credentials unless explicitly allowed", () => {
    expect(() =>
      parseAppEnv({
        ...baseProductionEnv,
        SESSION_SECRET: "prod-secret-with-at-least-thirty-two-chars",
        BOOTSTRAP_USER_EMAIL: "owner@example.com",
        BOOTSTRAP_USER_PASSWORD: "StrongProd#123456",
      }),
    ).toThrow(/ALLOW_PRODUCTION_BOOTSTRAP/);
  });

  it("rejects known weak production bootstrap passwords", () => {
    expect(() =>
      parseAppEnv({
        ...baseProductionEnv,
        SESSION_SECRET: "prod-secret-with-at-least-thirty-two-chars",
        ALLOW_PRODUCTION_BOOTSTRAP: "true",
        BOOTSTRAP_USER_EMAIL: "owner@example.com",
        BOOTSTRAP_USER_PASSWORD: "change-me-please",
      }),
    ).toThrow(/Production bootstrap passwords/);
  });

  it("accepts explicitly allowed strong production bootstrap credentials", () => {
    const parsed = parseAppEnv({
      ...baseProductionEnv,
      SESSION_SECRET: "prod-secret-with-at-least-thirty-two-chars",
      ALLOW_PRODUCTION_BOOTSTRAP: "true",
      BOOTSTRAP_USER_EMAIL: "owner@example.com",
      BOOTSTRAP_USER_PASSWORD: "StrongProd#123456",
    });

    expect(parsed.ALLOW_PRODUCTION_BOOTSTRAP).toBe(true);
    expect(parsed.BOOTSTRAP_USER_PASSWORD).toBe("StrongProd#123456");
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
