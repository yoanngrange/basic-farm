const pool = require("../../db/pool");
const { listingSlug } = require("../../lib/slug");
const { ValidationError, NotFoundError, AuthError } = require("../../lib/errors");
const { verifyTurnstileToken } = require("../../lib/captcha");
const githubDispatch = require("../../lib/githubDispatch");
const farmsService = require("../core/farms.service");

const ALLOWED_LANGUAGES = ["en", "es", "fr", "it", "pt"];
const ALLOWED_STATUSES = ["draft", "published", "filled", "expired", "archived"];

async function listPublic(filters) {
  const {
    language, country, categorySlug, farmId, status = "published",
    page = 1, pageSize = 20,
  } = filters;

  const size = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * size;

  const where = ["l.status = $1"];
  const filterParams = [status];
  let i = 2;

  if (language) { where.push(`l.language = $${i}`); filterParams.push(language); i++; }
  if (country) { where.push(`f.country_code = $${i}`); filterParams.push(country.toUpperCase()); i++; }
  if (categorySlug) { where.push(`c.slug = $${i}`); filterParams.push(categorySlug); i++; }
  if (farmId) { where.push(`l.farm_id = $${i}`); filterParams.push(farmId); i++; }

  const whereClause = where.join(" AND ");

  const dataQuery = `
    SELECT l.id, l.title, l.slug, l.language, l.status, l.published_at, l.start_date,
           l.duration_value, l.duration_unit, l.view_count,
           f.id AS farm_id, f.name AS farm_name, f.locality, f.region, f.country_code,
           c.slug AS category_slug
    FROM jobs.job_listings l
    JOIN core.farms f ON f.id = l.farm_id
    LEFT JOIN jobs.job_categories c ON c.id = l.category_id
    WHERE ${whereClause}
    ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;
  const dataParams = [...filterParams, size, offset];

  const countQuery = `
    SELECT count(*) FROM jobs.job_listings l
    JOIN core.farms f ON f.id = l.farm_id
    LEFT JOIN jobs.job_categories c ON c.id = l.category_id
    WHERE ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, dataParams),
    pool.query(countQuery, filterParams),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);
  return {
    listings: dataResult.rows,
    pagination: { page: parseInt(page, 10) || 1, pageSize: size, total, totalPages: Math.ceil(total / size) },
  };
}

async function getBySlug(slug) {
  const result = await pool.query(
    `SELECT l.*, f.name AS farm_name, f.locality, f.region, f.country_code, f.website AS farm_website,
            c.slug AS category_slug
     FROM jobs.job_listings l
     JOIN core.farms f ON f.id = l.farm_id
     LEFT JOIN jobs.job_categories c ON c.id = l.category_id
     WHERE l.slug = $1`,
    [slug]
  );
  const listing = result.rows[0];
  if (!listing) throw new NotFoundError("Listing not found");

  await pool.query("UPDATE jobs.job_listings SET view_count = view_count + 1 WHERE id = $1", [listing.id]);
  return listing;
}

async function create(userId, data) {
  const { farmId, categoryId, title, description, language = "en", startDate, durationValue, durationUnit } = data;
  if (!farmId || !title || !description) {
    throw new ValidationError("farmId, title and description are required");
  }
  if (!ALLOWED_LANGUAGES.includes(language)) {
    throw new ValidationError(`language must be one of: ${ALLOWED_LANGUAGES.join(", ")}`);
  }

  await farmsService.assertUserCanManage(userId, farmId);

  const insertResult = await pool.query(
    `INSERT INTO jobs.job_listings
       (farm_id, user_id, category_id, title, description, slug, language, start_date, duration_value, duration_unit, status)
     VALUES ($1,$2,$3,$4,$5, 'TEMP', $6,$7,$8,$9, 'draft')
     RETURNING *`,
    [farmId, userId, categoryId || null, title, description, language, startDate || null, durationValue || null, durationUnit || null]
  );
  const listing = insertResult.rows[0];

  // Slug embeds the row's own id — generated right after insert.
  const slug = listingSlug(listing.id, title);
  const updateResult = await pool.query(
    "UPDATE jobs.job_listings SET slug = $1 WHERE id = $2 RETURNING *",
    [slug, listing.id]
  );
  return updateResult.rows[0];
}

async function updateStatusOrContent(userId, listingId, data) {
  const current = await pool.query("SELECT farm_id FROM jobs.job_listings WHERE id = $1", [listingId]);
  if (current.rowCount === 0) throw new NotFoundError("Listing not found");
  await farmsService.assertUserCanManage(userId, current.rows[0].farm_id);

  const { title, description, status, startDate, durationValue, durationUnit, categoryId } = data;
  if (status && !ALLOWED_STATUSES.includes(status)) {
    throw new ValidationError(`status must be one of: ${ALLOWED_STATUSES.join(", ")}`);
  }

  const sets = ["updated_at = now()"];
  const values = [];
  let i = 1;
  const maybe = (col, v) => { if (v !== undefined) { sets.push(`${col} = $${i}`); values.push(v); i++; } };

  maybe("title", title);
  maybe("description", description);
  maybe("category_id", categoryId);
  maybe("start_date", startDate);
  maybe("duration_value", durationValue);
  maybe("duration_unit", durationUnit);
  if (status !== undefined) {
    maybe("status", status);
    if (status === "published") sets.push("published_at = COALESCE(published_at, CURRENT_DATE)");
  }

  values.push(listingId);
  const result = await pool.query(
    `UPDATE jobs.job_listings SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );

  // The static site only reflects reality after a rebuild — trigger one
  // whenever this change could affect what's publicly visible: any status
  // transition (covers being newly published, or removed via
  // filled/expired/archived), or any content edit to a listing that is
  // currently published. Fire and forget: never let a GitHub API hiccup
  // fail the farmer's request.
  const updated = result.rows[0];
  if (status !== undefined || updated.status === "published") {
    githubDispatch.triggerSiteRebuild(`listing ${listingId} updated (status: ${updated.status})`);
  }

  return updated;
}

async function listMine(userId) {
  const result = await pool.query(
    `SELECT l.id, l.title, l.slug, l.language, l.status, l.published_at, l.created_at, l.view_count,
            l.description, l.category_id, l.start_date, l.duration_value, l.duration_unit,
            f.id AS farm_id, f.name AS farm_name
     FROM jobs.job_listings l
     JOIN core.users_farms uf ON uf.farm_id = l.farm_id
     JOIN core.farms f ON f.id = l.farm_id
     WHERE uf.user_id = $1
     ORDER BY l.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function revealContact(listingId, captchaToken, remoteip) {
  if (!captchaToken) {
    throw new ValidationError("captchaToken is required");
  }
  const valid = await verifyTurnstileToken(captchaToken, remoteip);
  if (!valid) {
    throw new AuthError("Captcha verification failed");
  }

  const result = await pool.query(
    `SELECT f.contact_email, f.contact_phone
     FROM jobs.job_listings l
     JOIN core.farms f ON f.id = l.farm_id
     WHERE l.id = $1`,
    [listingId]
  );
  if (result.rowCount === 0) throw new NotFoundError("Listing not found");
  return result.rows[0];
}

module.exports = { listPublic, getBySlug, create, updateStatusOrContent, listMine, revealContact };
