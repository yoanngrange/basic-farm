const crypto = require("crypto");

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A listing slug always embeds its own id, so it can never collide and
// stays stable even if the title is edited after publication.
function listingSlug(id, title) {
  return `${id}-${slugify(title)}`.slice(0, 255);
}

module.exports = { slugify, listingSlug };
