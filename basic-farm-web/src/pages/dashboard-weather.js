import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { api, ApiError } from "../lib/api.js";
import { requireSession } from "../lib/auth.js";
import { resolveCurrentFarm } from "../lib/farmContext.js";

// WMO weather codes (used by Open-Meteo) mapped to a simple icon. Not
// exhaustive — falls back to a plain thermometer for anything unmapped,
// good enough for a first pass.
const WEATHER_ICONS = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};
function iconFor(code) {
  return WEATHER_ICONS[code] || "🌡️";
}

let session, farmId, t;

async function init() {
  const i18n = await loadI18n();
  t = i18n.t;
  document.documentElement.lang = i18n.locale;
  applyI18n(t);

  session = requireSession();
  if (!session) return;

  const farms = await api.myFarms(session.token).then((r) => r.farms).catch(() => []);
  const farm = resolveCurrentFarm(farms);

  if (!farm) {
    document.getElementById("search-section").hidden = true;
    document.getElementById("empty-state").hidden = false;
    return;
  }
  farmId = farm.id;
  document.getElementById("current-farm-name").textContent = farm.name;

  setupSearch();
  await renderLocations();
}

function setupSearch() {
  const input = document.getElementById("city-search");
  const resultsEl = document.getElementById("search-results");
  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 2) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(() => runSearch(q, input, resultsEl), 300);
  });

  document.addEventListener("click", (event) => {
    if (event.target !== input && !resultsEl.contains(event.target)) {
      resultsEl.hidden = true;
    }
  });
}

async function runSearch(query, input, resultsEl) {
  let results;
  try {
    ({ results } = await api.weatherSearch(session.token, query, document.documentElement.lang));
  } catch {
    results = [];
  }

  resultsEl.innerHTML = "";
  if (results.length === 0) {
    resultsEl.hidden = true;
    return;
  }

  results.forEach((r) => {
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      resultsEl.hidden = true;
      input.value = "";
      try {
        await api.createWeatherLocation(session.token, {
          farmId,
          label,
          latitude: r.latitude,
          longitude: r.longitude,
          countryCode: r.countryCode,
          timezone: r.timezone,
        });
        await renderLocations();
      } catch (err) {
        window.alert(err instanceof ApiError ? err.message : t("weather.genericError"));
      }
    });
    li.appendChild(button);
    resultsEl.appendChild(li);
  });
  resultsEl.hidden = false;
}

async function renderLocations() {
  const container = document.getElementById("locations");
  const noneMsg = document.getElementById("no-locations-message");

  let locations;
  try {
    ({ locations } = await api.weatherLocations(session.token, farmId));
  } catch {
    locations = [];
  }

  container.innerHTML = "";
  noneMsg.hidden = locations.length > 0;
  locations.forEach((loc) => container.appendChild(renderLocationCard(loc)));
}

function renderLocationCard(loc) {
  const article = document.createElement("article");
  article.className = "weather-card";

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = loc.label;
  const removeBtn = document.createElement("button");
  removeBtn.className = "secondary";
  removeBtn.textContent = t("weather.remove");
  removeBtn.addEventListener("click", async () => {
    if (!window.confirm(t("weather.confirmRemove"))) return;
    await api.deleteWeatherLocation(session.token, loc.id);
    await renderLocations();
  });
  header.append(title, removeBtn);
  article.appendChild(header);

  if (!loc.forecast_json) {
    const p = document.createElement("p");
    p.textContent = t("weather.noForecastYet");
    article.appendChild(p);
    return article;
  }

  const current = loc.forecast_json.current || {};
  const currentP = document.createElement("p");
  currentP.className = "weather-current";
  currentP.textContent = `${iconFor(current.weather_code)} ${Math.round(current.temperature_2m)}°C`;
  article.appendChild(currentP);

  const daily = loc.forecast_json.daily;
  if (daily?.time?.length) {
    article.appendChild(renderDailyTable(daily));
  }

  const footer = document.createElement("div");
  footer.className = "weather-card-footer";

  const updatedP = document.createElement("p");
  updatedP.className = "weather-updated";
  updatedP.textContent = loc.forecast_fetched_at
    ? `${t("weather.lastUpdated")}: ${new Date(loc.forecast_fetched_at).toLocaleString()}`
    : "";

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "secondary";
  refreshBtn.textContent = t("weather.refresh");
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    try {
      await api.refreshWeatherLocation(session.token, loc.id);
      await renderLocations();
    } finally {
      refreshBtn.disabled = false;
    }
  });

  footer.append(updatedP, refreshBtn);
  article.appendChild(footer);

  return article;
}

function renderDailyTable(daily) {
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th"));
  daily.time.forEach((date) => {
    const th = document.createElement("th");
    th.textContent = new Date(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tbody.appendChild(dailyRow(t("weather.max"), daily.temperature_2m_max.map((v) => `${Math.round(v)}°`)));
  tbody.appendChild(dailyRow(t("weather.min"), daily.temperature_2m_min.map((v) => `${Math.round(v)}°`)));
  tbody.appendChild(dailyRow(t("weather.precip"), daily.precipitation_sum.map((v) => `${v} mm`)));
  table.appendChild(tbody);

  return table;
}

function dailyRow(label, values) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = label;
  tr.appendChild(th);
  values.forEach((v) => {
    const td = document.createElement("td");
    td.textContent = v;
    tr.appendChild(td);
  });
  return tr;
}

init();
