import { buildApp } from "./app/build-app.js";
import { describeDatabaseTarget, getEnv } from "./app/env.js";
import { prepareRuntimeDatabase } from "./app/runtime-database.js";

async function start() {
  const env = getEnv();

  try {
    await prepareRuntimeDatabase(env);
    const app = await buildApp(env);
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Can't reach database server")
    ) {
      console.error(
        `[server] Prisma connection failed. Start Postgres first and confirm DATABASE_URL in ${process.cwd()}/server/.env`,
      );
      console.error(`Current database target: ${describeDatabaseTarget(env.DATABASE_URL)}`);
    }

    if (error instanceof Error && /database .* does not exist/i.test(error.message)) {
      console.error(
        "[server] Database is missing. Either set AUTO_CREATE_DATABASE=true in server/.env or create the DB manually.",
      );
    }

    if (error instanceof Error && /table .* does not exist/i.test(error.message)) {
      console.error(
        "[server] Database tables are missing. Run migrations (for example: `cd server && npx prisma migrate deploy`) or set AUTO_APPLY_MIGRATIONS=true.",
      );
    }

    console.error(error);
    process.exit(1);
  }
}

void start();
