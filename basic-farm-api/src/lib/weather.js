const env = require("../config/env");
const logger = require("./logger");

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 5000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Worldwide city-name search via Open-Meteo's geocoding API (free, no API
// key, no rate-limit constraints tight enough to matter at this volume).
// Bypassed in tests the same way src/lib/geocode.js bypasses Nominatim —
// no network call, nothing meaningful to assert against a live result.
async function searchLocations(query, locale) {
  if (env.nodeEnv === "test") {
    return [
      {
        name: "Test City",
        country: "France",
        countryCode: "FR",
        admin1: "Test Region",
        latitude: 48.85,
        longitude: 2.35,
        timezone: "Europe/Paris",
      },
    ];
  }

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=8&language=${locale || "en"}&format=json`;
  try {
    const data = await fetchJson(url);
    return (data?.results || []).map((r) => ({
      name: r.name,
      country: r.country || null,
      countryCode: r.country_code || null,
      admin1: r.admin1 || null,
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone || null,
    }));
  } catch (e) {
    logger.warn({ err: e.message }, "Weather geocode search failed");
    return [];
  }
}

// Best-effort forecast fetch via Open-Meteo's forecast API (free, no API
// key). Never throws — a stale/missing cache is a degraded dashboard, not
// a broken request, same graceful-degradation pattern as geocode.js.
async function fetchForecast(latitude, longitude, timezone) {
  if (env.nodeEnv === "test") {
    return {
      current: { temperature_2m: 18.5, weather_code: 1, wind_speed_10m: 12, precipitation: 0 },
      daily: {
        time: ["2026-01-01", "2026-01-02"],
        temperature_2m_max: [20, 19],
        temperature_2m_min: [10, 9],
        precipitation_sum: [0, 1.2],
        weather_code: [1, 61],
      },
    };
  }

  const url =
    `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
    `&forecast_days=7&timezone=${encodeURIComponent(timezone || "auto")}`;
  try {
    const data = await fetchJson(url);
    if (!data) return null;
    return { current: data.current, daily: data.daily };
  } catch (e) {
    logger.warn({ err: e.message }, "Weather forecast fetch failed");
    return null;
  }
}

module.exports = { searchLocations, fetchForecast };
