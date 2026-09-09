// Shared "current farm" selection across every module dashboard. Lives on
// the hub (dashboard.html) per the platform's farm-selection design (see
// root CLAUDE.md / basic-farm-api's CLAUDE.md "known gaps"), persisted in
// localStorage so a module page opened directly still resolves to the
// right farm without re-selecting it.
const STORAGE_KEY = "basic_farm_current_farm_id";

export function getCurrentFarmId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentFarmId(farmId) {
  try {
    if (farmId) localStorage.setItem(STORAGE_KEY, farmId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, etc.) — selection just won't
    // persist across reloads; still works for the current page load.
  }
}

// Resolves the farm a module page should act on: the persisted selection
// if it's still one of the user's farms, otherwise the first farm
// (and persists that as the new default). Returns null if the user has
// no farm at all yet.
export function resolveCurrentFarm(farms) {
  if (!farms || farms.length === 0) return null;
  const storedId = getCurrentFarmId();
  const farm = farms.find((f) => f.id === storedId) || farms[0];
  setCurrentFarmId(farm.id);
  return farm;
}
