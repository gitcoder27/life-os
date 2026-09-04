import type { AppEnv } from "./env.js";
import { assertDatabaseSeparation } from "./env.js";
import { ensureDatabaseExists, ensureDatabaseMigrations } from "./db-bootstrap.js";

type RuntimeDatabaseHooks = {
  assertSeparation?: (env: AppEnv) => void;
  ensureExists?: (env: AppEnv) => Promise<void>;
  ensureMigrations?: (env: AppEnv) => Promise<void>;
};

function assertProductionRuntimeMutationDisabled(env: AppEnv) {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const enabledRuntimeMutations = [
    env.AUTO_CREATE_DATABASE ? "AUTO_CREATE_DATABASE" : null,
    env.AUTO_APPLY_MIGRATIONS ? "AUTO_APPLY_MIGRATIONS" : null,
  ].filter(Boolean);

  if (enabledRuntimeMutations.length === 0) {
    return;
  }

  throw new Error(
    `[runtime-database] ${enabledRuntimeMutations.join(
      " and ",
    )} cannot be enabled for production app or worker startup. Run database creation and migrations from an explicit deploy/admin command instead.`,
  );
}

export async function prepareRuntimeDatabase(
  env: AppEnv,
  hooks: RuntimeDatabaseHooks = {},
) {
  const assertSeparation = hooks.assertSeparation ?? assertDatabaseSeparation;
  const ensureExists = hooks.ensureExists ?? ensureDatabaseExists;
  const ensureMigrations = hooks.ensureMigrations ?? ensureDatabaseMigrations;

  assertSeparation(env);
  assertProductionRuntimeMutationDisabled(env);
  await ensureExists(env);
  await ensureMigrations(env);
}
