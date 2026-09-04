const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const parcelsService = require("./parcels.service");

const router = express.Router();

// Read-only for now — write access via API key is on the roadmap, once
// the read side has been through more real-world use. req.apiKey.farmId
// is set by requireApiKey (mounted on the parent /api/v1 router), so
// there's no farmId param to pass or accidentally get wrong.
router.get("/", asyncHandler(async (req, res) => {
  const parcels = await parcelsService.listForFarm(req.apiKey.farmId);
  res.json({ items: parcels });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const parcel = await parcelsService.getForFarm(req.apiKey.farmId, req.params.id);
  res.json(parcel);
}));

module.exports = router;
