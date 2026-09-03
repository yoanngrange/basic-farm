const express = require("express");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./parcels.controller");

const router = express.Router();

router.post("/", requireAuth, controller.create);
router.get("/mine", requireAuth, controller.listMine);
router.patch("/:id", requireAuth, controller.update);
router.delete("/:id", requireAuth, controller.remove);

module.exports = router;
