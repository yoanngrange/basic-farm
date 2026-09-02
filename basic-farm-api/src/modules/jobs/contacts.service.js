const crypto = require("crypto");
const pool = require("../../db/pool");
const { ValidationError, NotFoundError } = require("../../lib/errors");
const mailer = require("../../lib/mailer");
const logger = require("../../lib/logger");

const ALLOWED_TYPES = ["email", "phone_click", "contact_form"];

const CONTACT_TYPE_LABEL = {
  email: "clicked to email you",
  phone_click: "clicked to call you",
  contact_form: "sent you a message",
};

function hashIp(ip) {
  // Never store raw IPs — a salted hash is enough for abuse detection
  // (e.g. rate-limiting repeat offenders) without keeping PII around.
  return crypto.createHash("sha256").update(ip + (process.env.IP_HASH_SALT || "")).digest("hex");
}

async function notifyFarmer(listingId, contactType, candidateEmail, message) {
  try {
    const result = await pool.query(
      `SELECT l.title, u.email AS author_email
       FROM jobs.job_listings l
       JOIN core.users u ON u.id = l.user_id
       WHERE l.id = $1`,
      [listingId]
    );
    const row = result.rows[0];
    if (!row) return;

    const lines = [
      `A candidate ${CONTACT_TYPE_LABEL[contactType] || "contacted you"} about your listing "${row.title}".`,
    ];
    if (candidateEmail) lines.push(`Candidate email: ${candidateEmail}`);
    if (message) lines.push(`Message: ${message}`);
    lines.push("", "Log in to your dashboard to see all contacts for this listing.");

    await mailer.sendMail({
      to: row.author_email,
      subject: `New contact on "${row.title}"`,
      text: lines.join("\n"),
    });
  } catch (err) {
    // Notification is best-effort — never let it affect the candidate's request.
    logger.error({ err, listingId }, "Failed to notify farmer of new contact");
  }
}

async function create(listingId, ip, data) {
  const { contactType, candidateEmail, message } = data;
  if (!ALLOWED_TYPES.includes(contactType)) {
    throw new ValidationError(`contactType must be one of: ${ALLOWED_TYPES.join(", ")}`);
  }
  if (contactType === "contact_form" && !candidateEmail) {
    throw new ValidationError("candidateEmail is required for contact_form submissions");
  }

  const listing = await pool.query(
    "SELECT id, status FROM jobs.job_listings WHERE id = $1", [listingId]
  );
  if (listing.rowCount === 0) throw new NotFoundError("Listing not found");

  const result = await pool.query(
    `INSERT INTO jobs.listing_contacts (listing_id, contact_type, candidate_email, message, ip_hash)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, listing_id, contact_type, contacted_at`,
    [listingId, contactType, candidateEmail || null, message || null, hashIp(ip)]
  );

  // Fire-and-forget: don't await synchronously in a way that could delay
  // or fail the candidate's response if SMTP is slow/down. notifyFarmer
  // already swallows its own errors, so this is safe either way — we
  // still await it here to keep behavior deterministic in tests.
  await notifyFarmer(listingId, contactType, candidateEmail, message);

  return result.rows[0];
}

async function listMineForUser(userId) {
  const result = await pool.query(
    `SELECT c.id, c.listing_id, c.contact_type, c.candidate_email, c.message, c.contacted_at,
            l.title AS listing_title, l.slug AS listing_slug
     FROM jobs.listing_contacts c
     JOIN jobs.job_listings l ON l.id = c.listing_id
     JOIN core.users_farms uf ON uf.farm_id = l.farm_id
     WHERE uf.user_id = $1
     ORDER BY c.contacted_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = { create, listMineForUser };
