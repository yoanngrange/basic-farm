const env = require("../config/env");
const logger = require("./logger");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS = 5000;

// Best-effort reverse geocoding via Nominatim (OpenStreetMap, free, no API
// key needed). Never throws — a parcel still saves with locality/
// country_code left null if this fails or times out, same
// graceful-degradation pattern as captcha.js/mailer.js/githubDispatch.js.
async function reverseGeocode(lat, lon) {
  // Automated tests never hit the real network — Nominatim's public
  // instance rate-limits to ~1 req/sec, and there's nothing meaningful
  // to assert from a real geocoding result in a test anyway.
  if (env.nodeEnv === "test") {
    return { locality: "Test City", countryCode: "FR" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BasicFarm/0.1 (https://basic-farm.com)" },
      signal: controller.signal,
    });
    if (!res.ok) return { locality: null, countryCode: null };
    const data = await res.json();
    const address = data.address || {};
    return {
      locality: address.city || address.town || address.village || address.municipality || null,
      countryCode: address.country_code ? address.country_code.toUpperCase() : null,
    };
  } catch (e) {
    logger.warn({ err: e.message }, "Reverse geocoding failed, skipping");
    return { locality: null, countryCode: null };
  } finally {
    clearTimeout(timeout);
  }
}

// Approximate centroid of a GeoJSON Polygon's exterior ring — good enough
// for a reverse-geocode lookup. Not geometrically exact; Postgres/PostGIS
// (area_ha, generated from the real geometry) stays the source of truth
// for anything that needs precision.
function approximateCentroid(geoJsonPolygon) {
  const ring = geoJsonPolygon.coordinates[0];
  const [sumLon, sumLat] = ring.reduce(([lon, lat], [x, y]) => [lon + x, lat + y], [0, 0]);
  return { lat: sumLat / ring.length, lon: sumLon / ring.length };
}

module.exports = { reverseGeocode, approximateCentroid };
