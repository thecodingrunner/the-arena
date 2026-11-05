import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // apps/web has its own Next.js ESLint config.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "apps/web/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain Node scripts: allow Node's globals.
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  prettier,
);
