const asyncHandler = require("../../middleware/asyncHandler");
const contactsService = require("./contacts.service");

const create = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const contact = await contactsService.create(req.params.listingId, ip, req.body);
  req.log.info({ listingId: contact.listing_id, contactType: contact.contact_type }, "Listing contact recorded");
  res.status(201).json({ contact });
});

const listMine = asyncHandler(async (req, res) => {
  const contacts = await contactsService.listMineForUser(req.user.id);
  res.json({ contacts });
});

module.exports = { create, listMine };
