const express = require("express");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./people.controller");

const router = express.Router();

router.get("/mine", requireAuth, controller.listMine);
router.post("/", requireAuth, controller.create);
router.post("/bulk", requireAuth, controller.createBulk);
router.patch("/:id", requireAuth, controller.update);
router.delete("/:id", requireAuth, controller.remove);

module.exports = router;
