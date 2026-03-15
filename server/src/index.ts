import { buildApp } from "./app/build-app.js";
import { getEnv } from "./app/env.js";

async function start() {
  const env = getEnv();

  try {
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
      console.error(`Current DATABASE_URL: ${process.env.DATABASE_URL}`);
    }

    console.error(error);
    process.exit(1);
  }
}

void start();
