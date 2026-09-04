const express = require("express");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./apiKeys.controller");

const router = express.Router({ mergeParams: true });

router.get("/", requireAuth, controller.list);
router.post("/", requireAuth, controller.create);
router.delete("/:keyId", requireAuth, controller.remove);

module.exports = router;
