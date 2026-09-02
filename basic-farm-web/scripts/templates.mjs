import { esc, BASE_PATH } from "./lib-helpers.mjs";

const LOCALE_LABEL = { en: "EN", es: "ES", fr: "FR", it: "IT", pt: "PT" };

export function pageShell({
  locale, title, description, canonicalPath, bodyHtml, siteName,
  hreflangAlternates, switcherAlternates,
}) {
  const switcher = switcherAlternates || hreflangAlternates;
  const hreflangTags = hreflangAlternates
    ? Object.entries(hreflangAlternates)
        .map(([loc, url]) => `  <link rel="alternate" hreflang="${loc}" href="${url}" />`)
        .join("\n") + `\n  <link rel="alternate" hreflang="x-default" href="${hreflangAlternates.en || canonicalPath}" />`
    : "";

  const switcherHtml = switcher
    ? `<li>
        <details class="dropdown">
          <summary role="button" class="secondary">${LOCALE_LABEL[locale] || locale.toUpperCase()}</summary>
          <ul dir="rtl">
            ${Object.entries(switcher).map(([loc, url]) => `<li><a href="${url}">${LOCALE_LABEL[loc] || loc.toUpperCase()}</a></li>`).join("\n")}
          </ul>
        </details>
      </li>`
    : "";

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonicalPath}" />
${hreflangTags}
  <link rel="stylesheet" href="${BASE_PATH}/assets/pico.min.css" />
  <link rel="stylesheet" href="${BASE_PATH}/assets/main.css" />
</head>
<body>
  <header class="container">
    <nav>
      <ul><li><a href="${BASE_PATH}/${locale}/index.html"><strong>${esc(siteName)}</strong></a></li></ul>
      <ul>${switcherHtml}</ul>
    </nav>
  </header>
  <main class="container">
${bodyHtml}
  </main>
  <footer class="container">
    <small>${esc(description)}</small>
  </footer>
</body>
</html>`;
}

export function listingCard(listing, t) {
  return `<article class="listing-card">
  <h3><a href="${BASE_PATH}/jobs/${esc(listing.slug)}.html">${esc(listing.title)}</a></h3>
  <p class="listing-meta">${esc(listing.locality || "")}${listing.region ? ", " + esc(listing.region) : ""} (${esc(listing.country_code)})
    ${listing.category_slug ? " &middot; " + esc(listing.category_slug) : ""}</p>
</article>`;
}

// countries: array of { code, label, href }, already sorted/localized by the caller.
export function countryFilterNav({ countries, anyHref, t }) {
  if (countries.length === 0) return "";
  const options = countries.map((c) => `<li><a href="${c.href}">${esc(c.label)}</a></li>`).join("\n");
  return `<nav aria-label="${esc(t.search.filterCountry)}">
    <details>
      <summary role="button" class="secondary">${esc(t.search.filterCountry)}</summary>
      <ul dir="rtl">
        <li><a href="${anyHref}">${esc(t.search.anyCountry)}</a></li>
        ${options}
      </ul>
    </details>
  </nav>`;
}

export function paginationNav({ locale, basePath, page, totalPages }) {
  if (totalPages <= 1) return "";
  const prev = page > 1 ? `<a href="${basePath}${page - 1 === 1 ? "" : "-" + (page - 1)}.html">&laquo; Prev</a>` : "<span></span>";
  const next = page < totalPages ? `<a href="${basePath}-${page + 1}.html">Next &raquo;</a>` : "<span></span>";
  return `<nav class="pagination"><div>${prev}</div><div>Page ${page} / ${totalPages}</div><div>${next}</div></nav>`;
}

export function formatDate(isoString) {
  if (!isoString) return "";
  return String(isoString).slice(0, 10); // YYYY-MM-DD, drop the time component
}

export function contactWidget(listing, t, apiBaseUrl) {
  return `<div id="contact-widget" data-listing-id="${esc(listing.id)}" data-api-base="${esc(apiBaseUrl)}">
    <form id="contact-form">
      <label>
        <span>${esc(t.listing.formEmailLabel)}</span>
        <input type="email" name="email" required />
      </label>
      <label>
        <span>${esc(t.listing.formMessageLabel)}</span>
        <textarea name="message" rows="3"></textarea>
      </label>
      <button type="submit">${esc(t.listing.formSubmit)}</button>
      <p id="contact-success" hidden>&#10003;</p>
      <p class="error-message" id="contact-error" hidden></p>
    </form>
  </div>
  <script src="${BASE_PATH}/assets/contact-widget.js" defer></script>`;
}
export function revealContactWidget(listing, t, apiBaseUrl, turnstileSiteKey) {
  if (!turnstileSiteKey) return ""; // not configured at build time — skip gracefully, don't ship a broken button
  return `<div id="reveal-contact" data-listing-id="${esc(listing.id)}" data-api-base="${esc(apiBaseUrl)}" data-site-key="${esc(turnstileSiteKey)}">
    <button id="reveal-btn" type="button">${esc(t.listing.revealContactButton)}</button>
    <div id="turnstile-container" hidden></div>
    <p id="reveal-result" data-no-info-text="${esc(t.listing.revealNoInfo)}" hidden></p>
    <p class="error-message" id="reveal-error" data-error-text="${esc(t.listing.revealError)}" hidden></p>
  </div>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script src="${BASE_PATH}/assets/reveal-contact-widget.js" defer></script>`;
}

export function farmProfileTemplate(farm, listings, t) {
  const addressParts = [farm.address_line, farm.locality, farm.region, farm.country_code].filter(Boolean);
  const logoHtml = farm.logo_url
    ? `<img src="${esc(farm.logo_url)}" alt="${esc(farm.name)}" style="max-width:120px;" />`
    : "";

  return `
  <header>
    ${logoHtml}
    <h1>${esc(farm.name)}</h1>
    <p class="listing-meta">${esc(addressParts.join(", "))}</p>
  </header>
  <nav>
    <ul><li><a href="#jobs" aria-current="page" role="button">Jobs</a></li></ul>
  </nav>
  <section id="jobs">
    ${listings.length > 0 ? listings.map((l) => listingCard(l, t)).join("\n") : `<p>${esc(t.search.noResults)}</p>`}
  </section>`;
}

export function notFoundPage(t, siteName) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>404 — ${esc(siteName)}</title>
  <link rel="stylesheet" href="${BASE_PATH}/assets/pico.min.css" />
  <link rel="stylesheet" href="${BASE_PATH}/assets/main.css" />
</head>
<body>
  <main class="container" style="text-align:center; margin-top: 4rem;">
    <div style="font-size: 6rem; transform: rotate(180deg); display: inline-block;">&#128668;</div>
    <h1>404</h1>
    <p>This page took a wrong turn in the field.</p>
    <p><a href="${BASE_PATH}/en/index.html" role="button">Back to safety</a></p>
  </main>
</body>
</html>`;
}

export function jobPostingJsonLd(listing) {
  const data = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: listing.title,
    description: listing.description,
    datePosted: listing.published_at,
    validThrough: listing.expires_at || undefined,
    employmentType: "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: listing.farm_name,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: listing.locality || undefined,
        addressRegion: listing.region || undefined,
        addressCountry: listing.country_code,
      },
    },
    inLanguage: listing.language,
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}
