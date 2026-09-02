const app = require("./app");
const env = require("./config/env");
const logger = require("./lib/logger");
const pool = require("./db/pool");

const server = app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, "basic-farm-api started");
});

// Clever Cloud sends SIGTERM before restarting/stopping an app — this
// lets in-flight requests finish and closes the pg pool cleanly instead
// of dropping connections mid-query.
function shutdown(signal) {
  logger.info({ signal }, "Shutting down gracefully");
  server.close(async () => {
    await pool.end();
    logger.info("Shutdown complete");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — exiting");
  process.exit(1);
});
