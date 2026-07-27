import { defineConfig } from "vite";
import { resolve } from "path";

// This config only builds the CSR (client-rendered) farmer area —
// login, register, dashboard, listing editor. The public, indexable
// pages (home, listing detail, category pages, per locale) are plain
// static HTML produced by scripts/generate-static.mjs, not by Vite.
// BASE_PATH (e.g. "/ag") is set when deployed as a GitHub Pages *project*
// page — see scripts/lib-helpers.mjs for the same convention used by the
// SSG templates.
const BASE_PATH = process.env.BASE_PATH || "";

export default defineConfig({
  base: `${BASE_PATH}/`,
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        login: resolve(__dirname, "login.html"),
        register: resolve(__dirname, "register.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        "dashboard-jobs": resolve(__dirname, "dashboard-jobs.html"),
        "listing-new": resolve(__dirname, "listing-new.html"),
      },
    },
  },
});
