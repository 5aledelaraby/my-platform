import { defineConfig } from "astro/config";

// Production URL. Staging/preview builds set DEPLOY_ENV (see src/layouts/Base.astro) so they are never indexed.
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
