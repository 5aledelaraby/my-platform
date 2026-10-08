import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/dist/**", "**/node_modules/**", "**/.astro/**", "**/.wrangler/**"]),
  tseslint.configs.recommended,
  {
    rules: {
      "no-console": "warn",
      eqeqeq: ["error", "always"],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
]);
