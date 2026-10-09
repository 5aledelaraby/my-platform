import { defineConfig } from "astro/config";

// Production URL. Every build must set DEPLOY_ENV=production|staging|preview (src/deploy-env.ts); only production is indexed.
export default defineConfig({
  site: "https://vicuna-eg.com",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  i18n: {
    locales: ["ar", "en"],
    defaultLocale: "ar",
    routing: { prefixDefaultLocale: false },
  },
});
