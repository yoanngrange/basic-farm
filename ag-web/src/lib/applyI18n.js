// Walks the DOM applying translations declared via data-i18n="path.to.key"
// (textContent) and data-i18n-placeholder="path.to.key" (input placeholder).
// Kept deliberately tiny — no templating engine, this is a small CSR area.
export function applyI18n(t) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.documentElement.lang = document.documentElement.lang || "en";
}
