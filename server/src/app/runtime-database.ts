import type { AppEnv } from "./env.js";
import { assertDatabaseSeparation } from "./env.js";
import { ensureDatabaseExists, ensureDatabaseMigrations } from "./db-bootstrap.js";

type RuntimeDatabaseHooks = {
  assertSeparation?: (env: AppEnv) => void;
  ensureExists?: (env: AppEnv) => Promise<void>;
  ensureMigrations?: (env: AppEnv) => Promise<void>;
};

export async function prepareRuntimeDatabase(
  env: AppEnv,
  hooks: RuntimeDatabaseHooks = {},
) {
  const assertSeparation = hooks.assertSeparation ?? assertDatabaseSeparation;
  const ensureExists = hooks.ensureExists ?? ensureDatabaseExists;
  const ensureMigrations = hooks.ensureMigrations ?? ensureDatabaseMigrations;

  assertSeparation(env);
  await ensureExists(env);
  await ensureMigrations(env);
}
