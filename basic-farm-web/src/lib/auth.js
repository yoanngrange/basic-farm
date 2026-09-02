// Token lives in localStorage: this is the farmer-only CSR area, not a
// claude.ai artifact — a real deployed app needs the session to survive
// page reloads. The public SSG pages never read this and never ship a token.
const STORAGE_KEY = "basic_farm_auth";

export function saveSession({ token, user }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function requireSession() {
  const session = getSession();
  if (!session) {
    window.location.href = `${import.meta.env.BASE_URL}login.html?next=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }
  return session;
}
