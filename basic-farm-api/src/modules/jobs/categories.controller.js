const asyncHandler = require("../../middleware/asyncHandler");
const categoriesService = require("./categories.service");

const list = asyncHandler(async (req, res) => {
  const locale = req.query.locale || "en";
  const categories = await categoriesService.list(locale);
  res.json({ categories });
});

module.exports = { list };
