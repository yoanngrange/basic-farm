const asyncHandler = require("../../middleware/asyncHandler");
const farmsService = require("./farms.service");

const create = asyncHandler(async (req, res) => {
  const farm = await farmsService.createFarm(req.user.id, req.body);
  req.log.info({ farmId: farm.id }, "Farm created");
  res.status(201).json({ farm });
});

const listMine = asyncHandler(async (req, res) => {
  const farms = await farmsService.listMine(req.user.id);
  res.json({ farms });
});

const update = asyncHandler(async (req, res) => {
  const farm = await farmsService.updateFarm(req.user.id, req.params.id, req.body);
  req.log.info({ farmId: farm.id }, "Farm updated");
  res.json({ farm });
});

const getPublic = asyncHandler(async (req, res) => {
  const farm = await farmsService.getPublicById(req.params.id);
  res.json({ farm });
});

module.exports = { create, listMine, update, getPublic };
