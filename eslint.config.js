
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist/**",
      "dist-server",
      "dist-server/**",
      "node_modules",
      "build",
      "coverage",
      "**/*.backup.*",
      "**/*.bak.*",
      "**/*.old.*",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "prefer-const": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "@typescript-eslint/no-non-null-assertion": "error"
    },
  }
  ,
  // Node-side code: allow console usage (scripts/seeds/logging)
  {
    files: [
      "server/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx}",
      "prisma/**/*.{ts,tsx}",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Prisma seeds & scripts: console is expected
  {
    files: ["scripts/**/*.{ts,tsx}", "prisma/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
    },
  },
  // Server: keep rule, but allow log/info for operational logs
  {
    files: ["server/**/*.{ts,tsx}"],
    rules: {
      "no-console": ["warn", { "allow": ["log", "info", "warn", "error"] }],
    },
  }
  ,
  // UI primitives (shadcn): allow constant exports in same file
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  }
);
