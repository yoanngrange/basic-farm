import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { requireSession, clearSession } from "../lib/auth.js";

async function init() {
  const { t, locale } = await loadI18n();
  document.documentElement.lang = locale;
  applyI18n(t);

  const session = requireSession(locale);
  if (!session) return;

  document.getElementById("logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = "/login.html";
  });
}

init();
