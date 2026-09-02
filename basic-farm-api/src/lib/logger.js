const pino = require("pino");
const env = require("../config/env");

/**
 * Structured, stateless logging: everything goes to stdout as JSON.
 * Clever Cloud captures stdout/stderr natively (visible in the console
 * and CLI via `clever logs`), and it can be piped to a log drain
 * (Elasticsearch, Datadog...) later without any code change here.
 * No custom log storage / rotation is implemented on purpose — that's
 * the platform's job, not the app's.
 */
const logger = pino({
  level: env.logLevel,
  base: { service: "basic-farm-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.password_hash",
      "*.token",
      "*.jwt",
    ],
    censor: "[redacted]",
  },
});

module.exports = logger;
