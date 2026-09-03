const asyncHandler = require("../../middleware/asyncHandler");
const parcelsService = require("./parcels.service");

const create = asyncHandler(async (req, res) => {
  const parcel = await parcelsService.create(req.user.id, req.body);
  req.log.info({ parcelId: parcel.id, farmId: parcel.farm_id }, "Parcel created");
  res.status(201).json({ parcel });
});

const listMine = asyncHandler(async (req, res) => {
  const parcels = await parcelsService.listMine(req.user.id, req.query.farmId);
  res.json({ parcels });
});

const update = asyncHandler(async (req, res) => {
  const parcel = await parcelsService.update(req.user.id, req.params.id, req.body);
  req.log.info({ parcelId: parcel.id }, "Parcel updated");
  res.json({ parcel });
});

const remove = asyncHandler(async (req, res) => {
  await parcelsService.remove(req.user.id, req.params.id);
  res.status(204).send();
});

module.exports = { create, listMine, update, remove };
