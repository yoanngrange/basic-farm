const pinoHttp = require("pino-http");
const crypto = require("crypto");
const logger = require("../lib/logger");

/**
 * HTTP access logging: one structured line per request, with a
 * correlation id (req.id) that every downstream log line in the same
 * request should reuse (see req.log usage in controllers/services).
 * Reuses an incoming X-Request-Id header if present (useful once
 * requests start hopping between future services), otherwise
 * generates a UUID.
 */
module.exports = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers["x-request-id"];
    const id = existing || crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },
});
