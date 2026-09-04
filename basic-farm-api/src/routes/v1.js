const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireApiKey } = require("../middleware/apiKeyAuth");
const parcelsV1Routes = require("../modules/plots/parcelsV1.routes");

const router = express.Router();

// A public developer API is a real abuse surface — rate-limit by the raw
// Authorization header (so it's per-key once a request carries one) with
// IP as a fallback for pre-auth/invalid-key requests. Configurable for
// the same reason auth's limiter is (test suites hit this many times).
const v1Limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_V1_MAX || "100", 10),
  keyGenerator: (req) => req.headers.authorization || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(v1Limiter);
router.use(requireApiKey);
router.use("/parcels", parcelsV1Routes);

module.exports = router;
