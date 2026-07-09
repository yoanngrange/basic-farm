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

  if (getSession()) {
    window.location.href = "/dashboard.html";
    return;
  }

  const form = document.getElementById("register-form");
  const errorEl = document.getElementById("error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const formData = new FormData(form);
    const payload = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
      password: formData.get("password"),
    };

    try {
      await api.register(payload);
      const { token, user } = await api.login({ email: payload.email, password: payload.password });
      saveSession({ token, user });
      window.location.href = "/dashboard.html";
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : t("auth.genericError");
      errorEl.hidden = false;
    }
  });
}

init();
