import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { api, ApiError } from "../lib/api.js";
import { requireSession, clearSession } from "../lib/auth.js";
import { resolveCurrentFarm } from "../lib/farmContext.js";

async function init() {
  const { t, locale } = await loadI18n();
  document.documentElement.lang = locale;
  applyI18n(t);

  const session = requireSession();
  if (!session) return;

  document.getElementById("logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = `${import.meta.env.BASE_URL}login.html`;
  });

  const farms = await api.myFarms(session.token).then((r) => r.farms).catch(() => []);
  const farm = resolveCurrentFarm(farms);

  if (!farm) {
    document.getElementById("toggle-form-btn").hidden = true;
    document.getElementById("empty-state").hidden = false;
    document.getElementById("empty-state").querySelector("p").textContent = t("dashboard.noFarms");
    return;
  }

  setupForm(session.token, farm.id, t);
  await renderKeys(session.token, farm.id, t);
}

function setupForm(token, farmId, t) {
  const toggleBtn = document.getElementById("toggle-form-btn");
  const emptyCreateBtn = document.getElementById("empty-create-btn");
  const form = document.getElementById("create-form");
  const errorEl = document.getElementById("create-error");
  const submitBtn = document.getElementById("create-submit-btn");
  const revealEl = document.getElementById("new-key-reveal");
  const revealDoneBtn = document.getElementById("reveal-done-btn");
  const copyBtn = document.getElementById("copy-key-btn");
  const newKeyValueEl = document.getElementById("new-key-value");

  const setFormOpen = (open) => {
    form.hidden = !open;
    revealEl.hidden = true;
    toggleBtn.textContent = open ? t("apiKeys.cancel") : t("apiKeys.create");
    if (!open) form.reset();
  };
  toggleBtn.addEventListener("click", () => setFormOpen(form.hidden));
  emptyCreateBtn.addEventListener("click", () => setFormOpen(true));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const name = new FormData(form).get("name")?.trim();
    if (!name) {
      errorEl.textContent = t("apiKeys.validationError");
      errorEl.hidden = false;
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = t("apiKeys.creating");
    try {
      const { rawKey } = await api.createApiKey(token, farmId, { name, scope: "read" });
      newKeyValueEl.textContent = rawKey;
      setFormOpen(false);
      revealEl.hidden = false;
      await renderKeys(token, farmId, t);
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : t("apiKeys.genericError");
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t("apiKeys.createKey");
    }
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(newKeyValueEl.textContent);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the raw key
      // is still visible on screen to copy by hand, never block on this.
    }
  });

  revealDoneBtn.addEventListener("click", () => {
    revealEl.hidden = true;
  });
}

async function renderKeys(token, farmId, t) {
  const keys = await api.apiKeys(token, farmId).then((r) => r.items).catch(() => []);
  const table = document.getElementById("keys-table");
  const body = document.getElementById("keys-body");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("key-count");

  body.innerHTML = "";
  emptyState.hidden = keys.length > 0;
  table.hidden = keys.length === 0;
  countEl.hidden = keys.length === 0;
  countEl.textContent = `${keys.length} / 20 ${t("apiKeys.activeCount")}`;

  keys.forEach((key) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = key.name;

    const keyTd = document.createElement("td");
    keyTd.textContent = `••••••••${key.key_preview}`;

    const createdTd = document.createElement("td");
    createdTd.textContent = new Date(key.created_at).toLocaleDateString();

    const createdByTd = document.createElement("td");
    createdByTd.textContent = key.created_by
      ? (`${key.created_by.first_name || ""} ${key.created_by.last_name || ""}`.trim() || key.created_by.email)
      : "—";

    const actionsTd = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "secondary";
    deleteBtn.textContent = t("apiKeys.delete");
    deleteBtn.addEventListener("click", async () => {
      if (!window.confirm(t("apiKeys.confirmDelete"))) return;
      await api.deleteApiKey(token, farmId, key.id);
      await renderKeys(token, farmId, t);
    });
    actionsTd.appendChild(deleteBtn);

    tr.append(nameTd, keyTd, createdTd, createdByTd, actionsTd);
    body.appendChild(tr);
  });
}

init();
