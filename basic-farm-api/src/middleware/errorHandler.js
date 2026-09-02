const { AppError } = require("../lib/errors");
const env = require("../config/env");

/**
 * Central error handler. Every error passed to next(err) anywhere in
 * the app lands here exactly once — this is the single place that
 * decides what gets logged and what gets sent back to the client.
 * Operational errors (AppError) log at "warn" with their real message;
 * anything unexpected logs at "error" with the stack trace, but the
 * client only ever sees a generic message in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? err.statusCode : 500;
  const code = isOperational ? err.code : "INTERNAL_ERROR";

  const log = req.log || require("../lib/logger");
  const logPayload = {
    err,
    statusCode,
    code,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
  };

  if (isOperational) {
    log.warn(logPayload, err.message);
  } else {
    log.error(logPayload, "Unhandled error");
  }

  res.status(statusCode).json({
    error: {
      code,
      message: isOperational || !env.isProd ? err.message : "Internal server error",
    },
    requestId: req.id,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
    requestId: req.id,
  });
}

module.exports = { errorHandler, notFoundHandler };
