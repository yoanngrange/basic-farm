const { createHash, randomBytes } = require("crypto");

// API keys are high-entropy random tokens, not user-chosen passwords —
// a fast SHA-256 hash is appropriate (no need for bcrypt's deliberate
// slowness, which exists to defeat guessing attacks on low-entropy
// secrets). Same approach as basic-map's src/lib/tokens.ts.
function generateApiKey() {
  return `bf_${randomBytes(24).toString("base64url")}`;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

module.exports = { generateApiKey, hashToken };
