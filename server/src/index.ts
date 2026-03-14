import { buildApp } from "./app/build-app.js";
import { getEnv } from "./app/env.js";

async function start() {
  const env = getEnv();
  const app = await buildApp(env);

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
