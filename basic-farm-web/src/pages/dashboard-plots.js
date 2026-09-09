import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { api, ApiError } from "../lib/api.js";
import { requireSession } from "../lib/auth.js";
import { resolveCurrentFarm } from "../lib/farmContext.js";

const DEFAULT_CENTER = [46.6, 2.2]; // roughly the middle of France — arbitrary but reasonable fallback
const DEFAULT_ZOOM = 6;

let session, farmId, t, locale;
let map, drawnItems;
let cultures = []; // [{ id, label }] in the current locale
let layersByParcelId = new Map();

async function init() {
  const i18n = await loadI18n();
  t = i18n.t;
  locale = i18n.locale;
  document.documentElement.lang = locale;
  applyI18n(t);

  session = requireSession();
  if (!session) return;

  const farms = await api.myFarms(session.token).then((r) => r.farms).catch(() => []);
  const farm = resolveCurrentFarm(farms);

  if (!farm) {
    document.getElementById("map-section").hidden = true;
    document.getElementById("stats-section").hidden = true;
    document.getElementById("empty-state").hidden = false;
    return;
  }
  farmId = farm.id;
  document.getElementById("current-farm-name").textContent = farm.name;

  cultures = await api.cultures(locale).then((r) => r.cultures.map((c) => ({ id: c.id, label: c.label }))).catch(() => []);
  populateCultureSelect(document.querySelector('#new-parcel-form select[name="cultureId"]'));

  setupMap(farm);
  setupNewParcelForm();

  const parcels = await api.myParcels(session.token, farmId).then((r) => r.parcels).catch(() => []);
  renderStats(parcels);
  renderParcelsList(parcels);
  parcels.forEach((parcel) => addParcelLayer(parcel));
  fitMapToLayers();
}

function populateCultureSelect(select) {
  cultures.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.label;
    select.appendChild(option);
  });
}

function cultureLabel(cultureId) {
  const culture = cultures.find((c) => c.id === cultureId);
  return culture ? culture.label : t("plots.noCulture");
}

function setupMap(farm) {
  const center = farm.latitude && farm.longitude ? [farm.latitude, farm.longitude] : DEFAULT_CENTER;
  const zoom = farm.latitude && farm.longitude ? 14 : DEFAULT_ZOOM;
  map = L.map("map").setView(center, zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: {
      polygon: { allowIntersection: false, showArea: true },
      marker: false,
      circle: false,
      circlemarker: false,
      polyline: false,
      rectangle: false,
    },
    edit: false, // per-parcel reshape is handled from the list (layer.editing), not this global toolbar
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, (event) => openNewParcelPanel(event.layer));
}

function fitMapToLayers() {
  if (drawnItems.getLayers().length > 0) {
    map.fitBounds(drawnItems.getBounds(), { padding: [20, 20] });
  }
}

function openNewParcelPanel(layer) {
  const panel = document.getElementById("new-parcel-panel");
  const form = document.getElementById("new-parcel-form");
  form.reset();
  document.getElementById("new-parcel-error").hidden = true;
  panel.hidden = false;
  panel.pendingLayer = layer;
  drawnItems.addLayer(layer); // shown on the map immediately, removed again if the user cancels
}

function setupNewParcelForm() {
  const panel = document.getElementById("new-parcel-panel");
  const form = document.getElementById("new-parcel-form");
  const errorEl = document.getElementById("new-parcel-error");

  document.getElementById("new-parcel-cancel").addEventListener("click", () => {
    if (panel.pendingLayer) drawnItems.removeLayer(panel.pendingLayer);
    panel.pendingLayer = null;
    panel.hidden = true;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const layer = panel.pendingLayer;
    if (!layer) return;

    const formData = new FormData(form);
    const name = formData.get("name")?.trim();
    const cultureId = formData.get("cultureId") || undefined;
    if (!name) return;

    try {
      const parcel = await api.createParcel(session.token, {
        farmId,
        name,
        cultureId,
        geometry: layer.toGeoJSON().geometry,
      });
      drawnItems.removeLayer(layer); // re-added by addParcelLayer with the server-confirmed data
      addParcelLayer(parcel);
      const parcels = await api.myParcels(session.token, farmId).then((r) => r.parcels);
      renderStats(parcels);
      renderParcelsList(parcels);
      panel.pendingLayer = null;
      panel.hidden = true;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : t("plots.genericError");
      errorEl.hidden = false;
    }
  });
}

function addParcelLayer(parcel) {
  const layer = L.geoJSON(parcel.geometry).getLayers()[0];
  layer.parcelId = parcel.id;
  layer.bindPopup(parcel.name);
  drawnItems.addLayer(layer);
  layersByParcelId.set(parcel.id, layer);
  return layer;
}

function renderStats(parcels) {
  document.getElementById("stat-count").textContent = parcels.length;

  const totalArea = parcels.reduce((sum, p) => sum + (parseFloat(p.area_ha) || 0), 0);
  document.getElementById("stat-area").textContent = `${totalArea.toFixed(2)} ha`;

  const byCulture = new Map();
  parcels.forEach((p) => {
    const label = cultureLabel(p.culture_id);
    byCulture.set(label, (byCulture.get(label) || 0) + (parseFloat(p.area_ha) || 0));
  });

  const list = document.getElementById("stat-by-culture");
  list.innerHTML = "";
  [...byCulture.entries()].forEach(([label, area]) => {
    const li = document.createElement("li");
    li.textContent = `${label}: ${area.toFixed(2)} ha`;
    list.appendChild(li);
  });
}

function renderParcelsList(parcels) {
  const container = document.getElementById("parcels-list");
  const noneMsg = document.getElementById("no-parcels-message");
  container.innerHTML = "";
  noneMsg.hidden = parcels.length > 0;
  parcels.forEach((parcel) => container.appendChild(renderParcelItem(parcel)));
}

function renderParcelItem(parcel) {
  const article = document.createElement("article");
  article.className = "parcel-item";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = parcel.name;
  nameInput.addEventListener("change", async () => {
    const updated = await api.updateParcel(session.token, parcel.id, { name: nameInput.value });
    const layer = layersByParcelId.get(parcel.id);
    if (layer) layer.bindPopup(updated.name);
  });

  const cultureSelect = document.createElement("select");
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = t("plots.noCulture");
  cultureSelect.appendChild(noneOption);
  populateCultureSelect(cultureSelect);
  cultureSelect.value = parcel.culture_id || "";
  cultureSelect.addEventListener("change", async () => {
    await api.updateParcel(session.token, parcel.id, { cultureId: cultureSelect.value || null });
    const parcels = await api.myParcels(session.token, farmId).then((r) => r.parcels);
    renderStats(parcels);
  });

  const areaSpan = document.createElement("span");
  areaSpan.className = "parcel-area";
  areaSpan.textContent = `${parseFloat(parcel.area_ha).toFixed(2)} ha`;

  const reshapeBtn = document.createElement("button");
  reshapeBtn.className = "secondary";
  reshapeBtn.textContent = t("plots.reshape");
  reshapeBtn.addEventListener("click", () => toggleReshape(parcel.id, reshapeBtn));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "secondary";
  deleteBtn.textContent = t("plots.delete");
  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm(t("plots.confirmRemove"))) return;
    await api.deleteParcel(session.token, parcel.id);
    const layer = layersByParcelId.get(parcel.id);
    if (layer) {
      drawnItems.removeLayer(layer);
      layersByParcelId.delete(parcel.id);
    }
    const parcels = await api.myParcels(session.token, farmId).then((r) => r.parcels);
    renderStats(parcels);
    renderParcelsList(parcels);
  });

  const locationSpan = document.createElement("span");
  locationSpan.className = "parcel-location";
  locationSpan.textContent = [parcel.locality, parcel.country_code].filter(Boolean).join(", ") || "—";

  article.append(nameInput, cultureSelect, areaSpan, locationSpan, reshapeBtn, deleteBtn);
  return article;
}

function toggleReshape(parcelId, button) {
  const layer = layersByParcelId.get(parcelId);
  if (!layer) return;

  if (layer.editing.enabled()) {
    layer.editing.disable();
    button.textContent = t("plots.reshape");
    api
      .updateParcel(session.token, parcelId, { geometry: layer.toGeoJSON().geometry })
      .then(() => api.myParcels(session.token, farmId))
      .then((r) => {
        renderStats(r.parcels);
        renderParcelsList(r.parcels);
      });
  } else {
    layer.editing.enable();
    button.textContent = t("plots.doneReshaping");
  }
}

init();
