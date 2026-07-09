const { Pool } = require("pg");
const env = require("../config/env");
const logger = require("../lib/logger");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.isProd ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  // Errors on idle clients (e.g. connection dropped by the DB) —
  // must be logged, otherwise they crash the process silently.
  logger.error({ err }, "Unexpected error on idle Postgres client");
});

module.exports = pool;
