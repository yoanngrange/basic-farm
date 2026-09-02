const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, token, params } = {}) {
  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));
    const qsString = qs.toString();
    if (qsString) url += `?${qsString}`;
  }

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error?.message || "Request failed", res.status, data.error?.code);
  }
  return data;
}

export const api = {
  register: (payload) => request("/core/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/core/auth/login", { method: "POST", body: payload }),
  me: (token) => request("/core/auth/me", { token }),

  createFarm: (token, payload) => request("/core/farms", { method: "POST", body: payload, token }),
  myFarms: (token) => request("/core/farms/mine", { token }),
  farm: (id) => request(`/core/farms/${id}`),
  updateFarm: (token, id, payload) => request(`/core/farms/${id}`, { method: "PATCH", body: payload, token }),

  categories: (locale) => request("/jobs/categories", { params: { locale } }),
  listings: (params) => request("/jobs/listings", { params }),
  myListings: (token) => request("/jobs/listings/mine", { token }),
  listing: (slug) => request(`/jobs/listings/${slug}`),
  createListing: (token, payload) => request("/jobs/listings", { method: "POST", body: payload, token }),
  updateListing: (token, id, payload) => request(`/jobs/listings/${id}`, { method: "PATCH", body: payload, token }),
  contactsMine: (token) => request("/jobs/contacts/mine", { token }),

  contact: (listingId, payload) => request(`/jobs/listings/${listingId}/contacts`, { method: "POST", body: payload }),
};

export { ApiError, API_BASE_URL };
