const env = require("../config/env");
const logger = require("./logger");

/**
 * Triggers a rebuild+redeploy of the static site (ag-web) whenever a
 * listing's public visibility changes — this is what keeps sitemap.xml
 * (and every generated page) in sync automatically, since the site is
 * static and only updates when explicitly rebuilt.
 *
 * Fire-and-forget, like the mailer: a GitHub API hiccup must never fail
 * the farmer's request. Skipped (logged) if not configured, so local dev
 * and CI don't need real GitHub credentials.
 */
async function triggerSiteRebuild(reason) {
  if (!env.githubDispatchToken || !env.githubDispatchRepo) {
    logger.warn({ reason }, "GitHub dispatch not configured — skipping site rebuild trigger");
    return { skipped: true };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${env.githubDispatchRepo}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.githubDispatchToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: env.githubDispatchEventType, client_payload: { reason } }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body, reason }, "GitHub dispatch request failed");
      return { skipped: true };
    }
    logger.info({ reason }, "Triggered ag-web site rebuild");
    return { skipped: false };
  } catch (err) {
    logger.error({ err, reason }, "Failed to trigger site rebuild");
    return { skipped: true };
  }
}

module.exports = { triggerSiteRebuild };
