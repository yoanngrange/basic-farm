const express = require("express");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./locations.controller");

const router = express.Router();

router.get("/search", requireAuth, controller.search);
router.get("/mine", requireAuth, controller.listMine);
router.post("/", requireAuth, controller.create);
router.delete("/:id", requireAuth, controller.remove);
router.post("/:id/refresh", requireAuth, controller.refresh);

module.exports = router;
