export const LOCALES = ["en", "es", "fr", "it", "pt"];

// Set to e.g. "/basic-farm" when deployed as a GitHub Pages *project* page
// (served under https://user.github.io/basic-farm/, not the domain root).
// Leave unset once a custom domain is attached, since that serves from "/".
export const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/$/, "");

// Mirrors basic-farm-api's src/lib/slug.js — kept as a tiny duplicate
// rather than a shared package, since the two apps don't share any code.
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Localized country name from an ISO 3166-1 alpha-2 code, via Node's
// built-in ICU data — no translation file to maintain per locale.
export function countryName(code, locale) {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code;
}

export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} -> ${res.status}`);
  return res.json();
}
