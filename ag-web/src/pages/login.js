import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { api, ApiError } from "../lib/api.js";
import { saveSession, getSession } from "../lib/auth.js";

async function init() {
  const { t, locale } = await loadI18n();
  document.documentElement.lang = locale;
  applyI18n(t);

  // Already logged in? skip straight to the dashboard.
  if (getSession()) {
    window.location.href = `${import.meta.env.BASE_URL}dashboard.html`;
    return;
  }

  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const formData = new FormData(form);

    try {
      const { token, user } = await api.login({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      saveSession({ token, user });
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("next") || `${import.meta.env.BASE_URL}dashboard.html`;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : t("auth.genericError");
      errorEl.hidden = false;
    }
  });
}

init();
