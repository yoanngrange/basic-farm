const express = require("express");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./teams.controller");

const router = express.Router();

router.get("/mine", requireAuth, controller.listMine);
router.post("/", requireAuth, controller.create);
router.patch("/:id", requireAuth, controller.update);
router.delete("/:id", requireAuth, controller.remove);
router.post("/:id/members", requireAuth, controller.addMember);
router.delete("/:id/members/:personId", requireAuth, controller.removeMember);

module.exports = router;
