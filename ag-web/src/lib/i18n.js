const SUPPORTED_LOCALES = ["en", "es", "fr", "it", "pt"];
const DEFAULT_LOCALE = "en";

const dictionaries = {
  en: () => import("../i18n/en.json"),
  es: () => import("../i18n/es.json"),
  fr: () => import("../i18n/fr.json"),
  it: () => import("../i18n/it.json"),
  pt: () => import("../i18n/pt.json"),
};

function detectLocale() {
  // 1. explicit ?lang= override, 2. path prefix (/fr/...), 3. browser language, 4. default
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("lang");
  if (fromQuery && SUPPORTED_LOCALES.includes(fromQuery)) return fromQuery;

  const pathLocale = window.location.pathname.split("/")[1];
  if (SUPPORTED_LOCALES.includes(pathLocale)) return pathLocale;

  const browserLocale = (navigator.language || "en").slice(0, 2);
  if (SUPPORTED_LOCALES.includes(browserLocale)) return browserLocale;

  return DEFAULT_LOCALE;
}

function get(dict, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict);
}

function interpolate(str, vars = {}) {
  return str.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{${key}}`));
}

export async function loadI18n(explicitLocale) {
  const locale = explicitLocale && SUPPORTED_LOCALES.includes(explicitLocale) ? explicitLocale : detectLocale();
  const mod = await dictionaries[locale]();
  const dict = mod.default || mod;

  function t(path, vars) {
    const value = get(dict, path);
    if (value === undefined) return path; // fail loudly-ish in dev, never crash the page
    return typeof value === "string" && vars ? interpolate(value, vars) : value;
  }

  return { locale, t, dict };
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
