const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./auth.controller");

const router = express.Router();

// Brute-force / signup-spam protection on the sensitive endpoints.
// Configurable so test suites (which legitimately register/login many
// accounts in a row against one shared in-memory limiter) aren't throttled.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "20", 10),
});

router.post("/register", authLimiter, controller.register);
router.post("/login", authLimiter, controller.login);
router.get("/me", requireAuth, controller.me);

module.exports = router;
