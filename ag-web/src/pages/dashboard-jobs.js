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

  const session = requireSession(locale);
  if (!session) return;

  const farms = await api.myFarms(session.token).then((r) => r.farms).catch(() => []);
  const currentFarm = farms[0] || null; // single-farm assumption for now
  setupFarmForm(session.token, currentFarm);

  if (!currentFarm) {
    // No farm yet: nothing to list until one exists.
    document.getElementById("listings-section").hidden = true;
    document.getElementById("contacts-section").hidden = true;
    return;
  }

  await renderListings(session.token, t);
  await renderContacts(session.token);
}

function setupFarmForm(token, farm) {
  const form = document.getElementById("farm-form");
  const errorEl = document.getElementById("farm-error");
  const successEl = document.getElementById("farm-success");

  if (farm) {
    form.logoUrl.value = farm.logo_url || "";
    form.name.value = farm.name || "";
    form.addressLine.value = farm.address_line || "";
    form.locality.value = farm.locality || "";
    form.countryCode.value = farm.country_code || "FR";
    form.contactEmail.value = farm.contact_email || "";
    form.contactPhone.value = farm.contact_phone || "";
  }

  if (!form.dataset.bound) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorEl.hidden = true;
      successEl.hidden = true;
      const formData = new FormData(form);
      const payload = {
        logoUrl: formData.get("logoUrl") || undefined,
        name: formData.get("name"),
        addressLine: formData.get("addressLine") || undefined,
        locality: formData.get("locality") || undefined,
        countryCode: formData.get("countryCode"),
        contactEmail: formData.get("contactEmail") || undefined,
        contactPhone: formData.get("contactPhone") || undefined,
      };

      try {
        if (form.dataset.activeFarmId) {
          await api.updateFarm(token, form.dataset.activeFarmId, payload);
        } else {
          await api.createFarm(token, payload);
        }
        successEl.hidden = false;
        if (!form.dataset.activeFarmId) window.location.reload();
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
        errorEl.hidden = false;
      }
    });
    form.dataset.bound = "true";
  }

  form.dataset.activeFarmId = farm ? farm.id : "";
}

async function renderListings(token, t) {
  const listings = await api.myListings(token).then((r) => r.listings).catch(() => []);
  const tbody = document.getElementById("listings-body");

  if (listings.length === 0) {
    document.getElementById("no-listings-message").hidden = false;
    return;
  }

  listings.forEach((listing) => {
    const tr = document.createElement("tr");

    const titleTd = document.createElement("td");
    titleTd.textContent = listing.title;

    const statusTd = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.textContent = t(`status.${listing.status}`);
    statusTd.appendChild(badge);

    const viewsTd = document.createElement("td");
    viewsTd.textContent = listing.view_count;

    const actionsTd = document.createElement("td");
    const editLink = document.createElement("a");
    editLink.href = `/listing-new.html?id=${listing.id}`;
    editLink.textContent = t("dashboard.edit");
    editLink.setAttribute("role", "button");
    editLink.className = "secondary";
    actionsTd.appendChild(editLink);

    if (listing.status === "draft") {
      const publishBtn = document.createElement("button");
      publishBtn.textContent = t("dashboard.publish");
      publishBtn.style.marginLeft = "0.5rem";
      publishBtn.addEventListener("click", async () => {
        await api.updateListing(token, listing.id, { status: "published" });
        window.location.reload();
      });
      actionsTd.appendChild(publishBtn);
    }

    tr.append(titleTd, statusTd, viewsTd, actionsTd);
    tbody.appendChild(tr);
  });
}

async function renderContacts(token) {
  const contacts = await api.contactsMine(token).then((r) => r.contacts).catch(() => []);
  const tbody = document.getElementById("contacts-body");

  if (contacts.length === 0) {
    document.getElementById("no-contacts-message").hidden = false;
    return;
  }

  contacts.forEach((c) => {
    const tr = document.createElement("tr");
    const cells = [c.listing_title, c.contact_type, c.candidate_email || "—", c.message || "—", c.contacted_at];
    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

init();
