import { defineConfig } from "astro/config";

// Production URL. Every build must set DEPLOY_ENV=production|staging|preview (src/deploy-env.ts); only production is indexed.
export default defineConfig({
  site: "https://vicuna-eg.com",
  output: "static",
  trailingSlash: "always",
  // The stylesheet is written into each page (owner, 2026-10-18, PageSpeed "render-blocking requests"): the first
  // paint no longer waits for a separate CSS file; it costs a few KB per page, compressed.
  build: { format: "directory", inlineStylesheets: "always" },
  i18n: {
    locales: ["ar", "en"],
    defaultLocale: "ar",
    routing: { prefixDefaultLocale: false },
  },
});
