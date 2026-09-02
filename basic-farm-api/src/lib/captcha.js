const env = require("../config/env");
const logger = require("./logger");

/**
 * Verifies a Cloudflare Turnstile token server-side. This is the only
 * gate protecting core.farms.contact_email/contact_phone — the public
 * listing endpoints never select those columns, so a valid, verified
 * token is the sole path to seeing them.
 *
 * Dev/test bypass: if no real secret is configured and we're not in
 * production, skip the network call to Cloudflare entirely (useful for
 * local dev and CI, which can't reach challenges.cloudflare.com). Tests
 * can pass token "invalid" to simulate a failed verification.
 */
async function verifyTurnstileToken(token, remoteip) {
  if (!token) return false;

  if (!env.isProd && !env.turnstileSecretKey) {
    return token !== "invalid";
  }

  const body = new URLSearchParams({ secret: env.turnstileSecretKey, response: token });
  if (remoteip) body.append("remoteip", remoteip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = await res.json();
  if (data.success !== true) {
    logger.warn({ errorCodes: data["error-codes"] }, "Turnstile verification failed");
  }
  return data.success === true;
}

module.exports = { verifyTurnstileToken };
