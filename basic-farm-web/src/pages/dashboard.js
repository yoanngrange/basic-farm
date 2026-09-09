import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { api } from "../lib/api.js";
import { requireSession, clearSession } from "../lib/auth.js";
import { resolveCurrentFarm, setCurrentFarmId } from "../lib/farmContext.js";

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
  setupFarmSwitcher(farms);
}

// Farm selection lives here on the hub, shared by every module — see
// basic-farm-web/CLAUDE.md. Module pages just read the persisted choice
// via farmContext.resolveCurrentFarm() instead of hardcoding farms[0].
function setupFarmSwitcher(farms) {
  if (farms.length === 0) return;

  const current = resolveCurrentFarm(farms);
  const wrap = document.getElementById("farm-switcher-wrap");
  const select = document.getElementById("farm-switcher");

  select.innerHTML = "";
  farms.forEach((farm) => {
    const option = document.createElement("option");
    option.value = farm.id;
    option.textContent = farm.name;
    if (farm.id === current.id) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener("change", () => setCurrentFarmId(select.value));
  wrap.hidden = farms.length < 2; // nothing to switch between with a single farm
}

init();
