const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./listings.controller");

const router = express.Router();

// Independent of the captcha itself: caps how often any single IP can
// even attempt verification, so a leaked/replayed token can't be hammered.
const revealLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_REVEAL_MAX || "15", 10),
});

// Public browsing — no auth required, matches the "no candidate account" requirement
router.get("/", controller.listPublic);
// Must come before /:slug — otherwise "mine" is treated as a slug value
router.get("/mine", requireAuth, controller.listMine);
router.get("/:id/reveal-contact", revealLimiter, controller.revealContact);
router.get("/:slug", controller.getBySlug);

// Farmer-only writes
router.post("/", requireAuth, controller.create);
router.patch("/:id", requireAuth, controller.update);

module.exports = router;
