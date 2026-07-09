const asyncHandler = require("../../middleware/asyncHandler");
const listingsService = require("./listings.service");

const listPublic = asyncHandler(async (req, res) => {
  const { language, country, category, farmId, status, page, pageSize } = req.query;
  const result = await listingsService.listPublic({
    language, country, categorySlug: category, farmId, status, page, pageSize,
  });
  res.json(result);
});

const getBySlug = asyncHandler(async (req, res) => {
  const listing = await listingsService.getBySlug(req.params.slug);
  res.json({ listing });
});

const create = asyncHandler(async (req, res) => {
  const listing = await listingsService.create(req.user.id, req.body);
  req.log.info({ listingId: listing.id, farmId: listing.farm_id }, "Listing created");
  res.status(201).json({ listing });
});

const update = asyncHandler(async (req, res) => {
  const listing = await listingsService.updateStatusOrContent(req.user.id, req.params.id, req.body);
  req.log.info({ listingId: listing.id, status: listing.status }, "Listing updated");
  res.json({ listing });
});

const listMine = asyncHandler(async (req, res) => {
  const listings = await listingsService.listMine(req.user.id);
  res.json({ listings });
});

const revealContact = asyncHandler(async (req, res) => {
  const contact = await listingsService.revealContact(req.params.id, req.query.captchaToken, req.ip);
  req.log.info({ listingId: req.params.id }, "Listing contact info revealed");
  res.json({ email: contact.contact_email || null, phone: contact.contact_phone || null });
});

module.exports = { listPublic, getBySlug, create, update, listMine, revealContact };
