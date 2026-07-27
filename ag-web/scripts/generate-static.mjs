import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LOCALES, fetchJson, BASE_PATH } from "./lib-helpers.mjs";
import {
  pageShell, listingCard, paginationNav, jobPostingJsonLd, contactWidget,
  revealContactWidget, farmProfileTemplate, notFoundPage,
} from "./templates.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist");
// SSG_API_BASE_URL lets the SSG fetch step use a different URL than the
// one baked into the CSR bundle (VITE_API_BASE_URL) — needed in Docker
// Compose, where generate-static.mjs must reach the API via the internal
// service hostname (e.g. http://api:3000/api) while the browser-facing
// CSR bundle needs the host-reachable URL (e.g. http://localhost:3000/api).
const API_BASE_URL = process.env.SSG_API_BASE_URL || process.env.VITE_API_BASE_URL || "http://localhost:3000/api";
// Needed to build absolute URLs in sitemap.xml — search engines require them.
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://example.com";
const PAGE_SIZE = 20;

const sitemapUrls = [];

function loadDict(locale) {
  const raw = fs.readFileSync(path.join(ROOT, "src", "i18n", `${locale}.json`), "utf8");
  return JSON.parse(raw);
}

function writeFile(relPath, content, { indexable = true } = {}) {
  const full = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  if (indexable) {
    sitemapUrls.push(`${SITE_ORIGIN}/${relPath}`.replace(/\/index\.html$/, "/index.html"));
  }
}

function copyAsset(from, to) {
  fs.mkdirSync(path.dirname(path.join(OUT_DIR, to)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), path.join(OUT_DIR, to));
}

async function fetchAllPublished({ language, category, farmId }) {
  const listings = [];
  let page = 1;
  let totalPages = 1;
  do {
    const qs = new URLSearchParams({ status: "published", page: String(page), pageSize: String(PAGE_SIZE) });
    if (language) qs.set("language", language);
    if (category) qs.set("category", category);
    if (farmId) qs.set("farmId", farmId);
    const res = await fetchJson(`${API_BASE_URL}/jobs/listings?${qs.toString()}`);
    listings.push(res.listings);
    totalPages = res.pagination.totalPages;
    page++;
  } while (page <= totalPages);
  return listings; // array of pages, each an array of listings
}

async function generateIndexPages(locale, dict) {
  const pages = await fetchAllPublished({ language: locale });
  const totalPages = pages.length || 1;

  // Every locale's home page is a translation of the same logical page —
  // real hreflang candidates, always pointing at each locale's page 1.
  const alternates = Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_PATH}/${loc}/index.html`]));

  pages.forEach((pageListings, idx) => {
    const page = idx + 1;
    const body = `
    <h1>${dict.search.title}</h1>
    <p>${pageListings.length > 0 ? dict.search.resultsCount.replace("{count}", pageListings.length) : dict.search.noResults}</p>
    ${pageListings.map((l) => listingCard(l, dict)).join("\n")}
    ${paginationNav({ locale, basePath: `${BASE_PATH}/${locale}/index`, page, totalPages })}
    `;
    const filename = page === 1 ? `${locale}/index.html` : `${locale}/index-${page}.html`;
    writeFile(
      filename,
      pageShell({
        locale,
        title: `${dict.site.title} — ${dict.search.title}`,
        description: dict.site.tagline,
        canonicalPath: `${BASE_PATH}/${locale}/index.html`,
        siteName: dict.site.title,
        bodyHtml: body,
        hreflangAlternates: page === 1 ? alternates : undefined,
        switcherAlternates: alternates,
      })
    );
  });
  return pages.flat().length;
}

async function buildCategorySlugMap() {
  // canonical_slug -> { locale: translatedSlug }, needed to link the
  // "same" category page across locales (each locale has its own slug).
  const map = {};
  for (const locale of LOCALES) {
    const { categories } = await fetchJson(`${API_BASE_URL}/jobs/categories?locale=${locale}`);
    for (const cat of categories) {
      map[cat.canonical_slug] = map[cat.canonical_slug] || {};
      map[cat.canonical_slug][locale] = { slug: cat.slug, label: cat.label };
    }
  }
  return map;
}

async function generateCategoryPages(locale, dict, categorySlugMap) {
  let count = 0;
  for (const [canonicalSlug, byLocale] of Object.entries(categorySlugMap)) {
    const localeEntry = byLocale[locale];
    if (!localeEntry) continue; // no translation for this locale — skip
    const pages = await fetchAllPublished({ language: locale, category: canonicalSlug });
    const totalPages = pages.length || 1;

    const alternates = Object.fromEntries(
      Object.entries(byLocale).map(([loc, entry]) => [loc, `${BASE_PATH}/${loc}/category/${entry.slug}.html`])
    );

    pages.forEach((pageListings, idx) => {
      const page = idx + 1;
      const body = `
      <h1>${localeEntry.label}</h1>
      <p>${pageListings.length > 0 ? dict.search.resultsCount.replace("{count}", pageListings.length) : dict.search.noResults}</p>
      ${pageListings.map((l) => listingCard(l, dict)).join("\n")}
      ${paginationNav({ locale, basePath: `${BASE_PATH}/${locale}/category/${localeEntry.slug}`, page, totalPages })}
      `;
      const filename = page === 1 ? `${locale}/category/${localeEntry.slug}.html` : `${locale}/category/${localeEntry.slug}-${page}.html`;
      writeFile(
        filename,
        pageShell({
          locale,
          title: `${localeEntry.label} — ${dict.site.title}`,
          description: dict.site.tagline,
          canonicalPath: `${BASE_PATH}/${locale}/category/${localeEntry.slug}.html`,
          siteName: dict.site.title,
          bodyHtml: body,
          hreflangAlternates: page === 1 ? alternates : undefined,
          switcherAlternates: alternates,
        })
      );
      count += pageListings.length;
    });
  }
  return count;
}

// One canonical page per listing, at a language-neutral path (/jobs/{slug}.html) —
// deliberately NOT under /{locale}/, since the listing content itself is
// single-language and duplicating it per UI locale would be duplicate content.
// No hreflang here for the same reason; the language switcher falls back
// to each locale's home page instead of a non-existent translation.
async function generateListingPages() {
  const allSlugs = new Set();
  const farmIds = new Set();
  for (const locale of LOCALES) {
    const pages = await fetchAllPublished({ language: locale });
    pages.flat().forEach((l) => {
      allSlugs.add(l.slug);
      farmIds.add(l.farm_id);
    });
  }

  const homeSwitcher = Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_PATH}/${loc}/index.html`]));

  let count = 0;
  for (const slug of allSlugs) {
    const { listing } = await fetchJson(`${API_BASE_URL}/jobs/listings/${slug}`);
    const dict = loadDict(listing.language);
    const t = dict;

    const durationHtml = listing.duration_value
      ? `<p>${t.listing.duration.replace("{value}", listing.duration_value).replace("{unit}", t.durationUnit[listing.duration_unit] || listing.duration_unit)}</p>`
      : "";
    const startHtml = listing.start_date ? `<p>${t.listing.startDate.replace("{date}", listing.start_date)}</p>` : "";

    const body = `
    ${jobPostingJsonLd(listing)}
    <article>
      <header>
        <h1>${listing.title}</h1>
        <p class="listing-meta">
          <a href="${BASE_PATH}/${listing.language}/farm/${listing.farm_id}.html">${listing.farm_name}</a>
          &middot; ${listing.locality || ""}${listing.region ? ", " + listing.region : ""} (${listing.country_code})
        </p>
        <p class="listing-meta">${t.listing.publishedOn.replace("{date}", listing.published_at)}</p>
      </header>
      <p>${listing.description.replace(/\n/g, "<br>")}</p>
      ${startHtml}
      ${durationHtml}
      <footer>
        <h2>${t.listing.contactTitle}</h2>
        <p><small>${t.listing.viewCount.replace("{count}", listing.view_count)}</small></p>
        ${revealContactWidget(listing, t, API_BASE_URL, process.env.TURNSTILE_SITE_KEY)}
        ${contactWidget(listing, t, API_BASE_URL)}
      </footer>
    </article>
    <p><a href="${BASE_PATH}/${listing.language}/index.html">&laquo; ${t.listing.backToSearch}</a></p>
    `;

    writeFile(
      `jobs/${slug}.html`,
      pageShell({
        locale: listing.language,
        title: `${listing.title} — ${dict.site.title}`,
        description: listing.description.slice(0, 160),
        canonicalPath: `${BASE_PATH}/jobs/${slug}.html`,
        siteName: dict.site.title,
        bodyHtml: body,
        switcherAlternates: homeSwitcher,
      })
    );
    count++;
  }
  return { count, farmIds };
}

// One page per farm per locale — legitimate per-locale duplication (only
// the surrounding UI text differs; name/address are language-independent
// proper nouns), same pattern as the index/category pages.
async function generateFarmProfiles(farmIds) {
  let count = 0;
  const homeSwitcher = Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_PATH}/${loc}/index.html`]));

  for (const farmId of farmIds) {
    let farm;
    try {
      ({ farm } = await fetchJson(`${API_BASE_URL}/core/farms/${farmId}`));
    } catch {
      continue; // shouldn't happen, but never let one bad id break the whole build
    }
    const pages = await fetchAllPublished({ farmId });
    const listings = pages.flat();

    const alternates = Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_PATH}/${loc}/farm/${farmId}.html`]));

    for (const locale of LOCALES) {
      const dict = loadDict(locale);
      const body = farmProfileTemplate(farm, listings, dict);
      writeFile(
        `${locale}/farm/${farmId}.html`,
        pageShell({
          locale,
          title: `${farm.name} — ${dict.site.title}`,
          description: dict.site.tagline,
          canonicalPath: `${BASE_PATH}/${locale}/farm/${farmId}.html`,
          siteName: dict.site.title,
          bodyHtml: body,
          hreflangAlternates: alternates,
          switcherAlternates: alternates,
        })
      );
      count++;
    }
  }
  return count;
}

function writeSitemapAndRobots() {
  const urlEntries = sitemapUrls
    .map((url) => `  <url><loc>${url}</loc></url>`)
    .join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
  writeFile("sitemap.xml", sitemap, { indexable: false });

  const robots = `User-agent: *\nAllow: /\nDisallow: /login.html\nDisallow: /register.html\nDisallow: /dashboard.html\nDisallow: /dashboard-jobs.html\nDisallow: /listing-new.html\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
  writeFile("robots.txt", robots, { indexable: false });
}

async function main() {
  console.log(`Generating static site from ${API_BASE_URL} ...`);

  copyAsset("node_modules/@picocss/pico/css/pico.min.css", "assets/pico.min.css");
  copyAsset("src/styles/main.css", "assets/main.css");
  copyAsset("src/static-assets/contact-widget.js", "assets/contact-widget.js");
  copyAsset("src/static-assets/reveal-contact-widget.js", "assets/reveal-contact-widget.js");

  let totalIndexListings = 0;
  let totalCategoryListings = 0;
  const categorySlugMap = await buildCategorySlugMap();

  for (const locale of LOCALES) {
    const dict = loadDict(locale);
    totalIndexListings += await generateIndexPages(locale, dict);
    totalCategoryListings += await generateCategoryPages(locale, dict, categorySlugMap);
  }

  const { count: listingPageCount, farmIds } = await generateListingPages();
  const farmProfileCount = await generateFarmProfiles(farmIds);

  // Root redirect — GitHub Pages serves this as the site's entrypoint.
  writeFile(
    "index.html",
    `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${BASE_PATH}/en/index.html"><title>Ag Jobs</title></head><body></body></html>`,
    { indexable: false }
  );

  writeFile("404.html", notFoundPage({}, "Ag Jobs"), { indexable: false });

  writeSitemapAndRobots();

  console.log(
    `Done. Index listings: ${totalIndexListings}, category listings: ${totalCategoryListings}, ` +
    `listing pages: ${listingPageCount}, farm profiles: ${farmProfileCount} (${farmIds.size} farms x 5 locales), ` +
    `sitemap entries: ${sitemapUrls.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
