const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("./contacts.controller");

// mergeParams: this router is mounted at /jobs/listings/:listingId/contacts
const router = express.Router({ mergeParams: true });

// Anti-abuse: no account needed to contact, so rate-limit by IP instead
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_CONTACT_MAX || "30", 10),
});

router.post("/", contactLimiter, controller.create);

module.exports = router;
