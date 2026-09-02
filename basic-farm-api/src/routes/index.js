const express = require("express");

const authRoutes = require("../modules/core/auth.routes");
const farmsRoutes = require("../modules/core/farms.routes");
const categoriesRoutes = require("../modules/jobs/categories.routes");
const listingsRoutes = require("../modules/jobs/listings.routes");
const contactsRoutes = require("../modules/jobs/contacts.routes");
const contactsController = require("../modules/jobs/contacts.controller");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// --- core (shared across every future product) ---
router.use("/core/auth", authRoutes);
router.use("/core/farms", farmsRoutes);

// --- jobs (first product: recruitment) ---
router.use("/jobs/categories", categoriesRoutes);
router.get("/jobs/contacts/mine", requireAuth, contactsController.listMine);
router.use("/jobs/listings/:listingId/contacts", contactsRoutes);
router.use("/jobs/listings", listingsRoutes);

// Future products mount here the same way, e.g.:
// router.use("/equipment/machines", require("../modules/equipment/machines.routes"));

module.exports = router;
