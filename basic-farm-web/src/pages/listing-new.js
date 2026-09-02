import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { api, ApiError } from "../lib/api.js";
import { requireSession } from "../lib/auth.js";

async function init() {
  const { t, locale } = await loadI18n();
  document.documentElement.lang = locale;
  applyI18n(t);

  const session = requireSession();
  if (!session) return;

  const editId = new URLSearchParams(window.location.search).get("id");

  const farmSelect = document.getElementById("farm-select");
  const farms = await api.myFarms(session.token).then((r) => r.farms).catch(() => []);
  if (farms.length === 0) {
    window.location.href = `${import.meta.env.BASE_URL}dashboard-jobs.html`;
    return;
  }
  farms.forEach((farm) => {
    const opt = document.createElement("option");
    opt.value = farm.id;
    opt.textContent = farm.name;
    farmSelect.appendChild(opt);
  });

  const categorySelect = document.getElementById("category-select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  categorySelect.appendChild(emptyOpt);
  const categories = await api.categories(locale).then((r) => r.categories).catch(() => []);
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.label;
    categorySelect.appendChild(opt);
  });

  const form = document.getElementById("listing-form");
  const errorEl = document.getElementById("error");

  let existingListing = null;
  if (editId) {
    // No dedicated "get one" endpoint is needed: /mine already returns
    // every editable field for every listing the user manages.
    const listings = await api.myListings(session.token).then((r) => r.listings).catch(() => []);
    existingListing = listings.find((l) => l.id === editId) || null;
    if (!existingListing) {
      window.location.href = `${import.meta.env.BASE_URL}dashboard-jobs.html`;
      return;
    }
    document.getElementById("page-title").textContent = t("dashboard.edit");
    document.querySelector('button[type="submit"]').textContent = t("form.submit");

    farmSelect.value = existingListing.farm_id;
    farmSelect.disabled = true; // moving a listing to another farm isn't supported
    form.title.value = existingListing.title;
    form.description.value = existingListing.description || "";
    form.language.value = existingListing.language;
    if (existingListing.category_id) categorySelect.value = existingListing.category_id;
    if (existingListing.start_date) form.startDate.value = existingListing.start_date.slice(0, 10);
    if (existingListing.duration_value) form.durationValue.value = existingListing.duration_value;
    if (existingListing.duration_unit) form.durationUnit.value = existingListing.duration_unit;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const formData = new FormData(form);
    const payload = {
      farmId: formData.get("farmId"),
      title: formData.get("title"),
      description: formData.get("description"),
      language: formData.get("language"),
      categoryId: formData.get("categoryId") || undefined,
      startDate: formData.get("startDate") || undefined,
      durationValue: formData.get("durationValue") ? Number(formData.get("durationValue")) : undefined,
      durationUnit: formData.get("durationValue") ? formData.get("durationUnit") : undefined,
    };

    try {
      if (existingListing) {
        // farmId can't be changed once created — the API doesn't accept it on update anyway.
        delete payload.farmId;
        await api.updateListing(session.token, existingListing.id, payload);
      } else {
        await api.createListing(session.token, payload);
      }
      window.location.href = `${import.meta.env.BASE_URL}dashboard-jobs.html`;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : t("auth.genericError");
      errorEl.hidden = false;
    }
  });
}

init();
