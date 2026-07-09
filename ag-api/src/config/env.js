require("dotenv").config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: (process.env.NODE_ENV || "development") === "production",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  logLevel: process.env.LOG_LEVEL || "info",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || null,
  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
  smtpUser: process.env.SMTP_USER || null,
  smtpPass: process.env.SMTP_PASS || null,
  emailFrom: process.env.EMAIL_FROM || "Ag Jobs <no-reply@example.com>",
  githubDispatchToken: process.env.GITHUB_DISPATCH_TOKEN || null,
  githubDispatchRepo: process.env.GITHUB_DISPATCH_REPO || null,
  githubDispatchEventType: process.env.GITHUB_DISPATCH_EVENT_TYPE || "listing-changed",
};
