const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AuthError } = require("../lib/errors");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new AuthError("Missing or malformed Authorization header"));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    req.log.setBindings({ userId: req.user.id });
    next();
  } catch (e) {
    next(new AuthError("Invalid or expired token"));
  }
}

module.exports = { requireAuth };
