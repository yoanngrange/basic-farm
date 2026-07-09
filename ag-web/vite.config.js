import { defineConfig } from "vite";
import { resolve } from "path";

// This config only builds the CSR (client-rendered) farmer area —
// login, register, dashboard, listing editor. The public, indexable
// pages (home, listing detail, category pages, per locale) are plain
// static HTML produced by scripts/generate-static.mjs, not by Vite.
export default defineConfig({
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
