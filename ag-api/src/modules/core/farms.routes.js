const express = require("express");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./farms.controller");

const router = express.Router();

router.post("/", requireAuth, controller.create);
router.get("/mine", requireAuth, controller.listMine);
// Public farm profile — no auth, excludes contact_email/contact_phone/registration_number
router.get("/:id", controller.getPublic);
router.patch("/:id", requireAuth, controller.update);

module.exports = router;
