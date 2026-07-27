export const LOCALES = ["en", "es", "fr", "it", "pt"];

// Set to e.g. "/ag" when deployed as a GitHub Pages *project* page
// (served under https://user.github.io/ag/, not the domain root).
// Leave unset once a custom domain is attached, since that serves from "/".
export const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/$/, "");

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
