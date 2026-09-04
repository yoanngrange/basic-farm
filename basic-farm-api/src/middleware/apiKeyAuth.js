const pool = require("../db/pool");
const { hashToken } = require("../lib/tokens");
const { AuthError, ForbiddenError } = require("../lib/errors");

// Auth for the public /api/v1/* surface, separate from the JWT session
// auth (requireAuth) used by the dashboard. A key resolves straight to a
// farm_id — the external API never takes a farmId param, so a key for
// farm A has no way to address farm B's data even by mistake.
async function requireApiKey(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new AuthError("Missing API key"));
  }
  try {
    const result = await pool.query(
      "SELECT id, farm_id, scope FROM core.api_keys WHERE key_hash = $1",
      [hashToken(token)]
    );
    if (result.rowCount === 0) {
      return next(new AuthError("Invalid API key"));
    }
    const key = result.rows[0];
    req.apiKey = { id: key.id, farmId: key.farm_id, scope: key.scope };
    req.log.setBindings({ apiKeyId: key.id, farmId: key.farm_id });
    pool.query("UPDATE core.api_keys SET last_used_at = now() WHERE id = $1", [key.id]).catch(() => {});
    next();
  } catch (e) {
    next(e);
  }
}

function requireWriteScope(req, res, next) {
  if (req.apiKey.scope !== "read_write") {
    return next(new ForbiddenError("This API key does not have write access"));
  }
  next();
}

module.exports = { requireApiKey, requireWriteScope };
