const asyncHandler = require("../../middleware/asyncHandler");
const culturesService = require("./cultures.service");

const list = asyncHandler(async (req, res) => {
  const locale = req.query.locale || "en";
  const cultures = await culturesService.list(locale);
  res.json({ cultures });
});

module.exports = { list };
