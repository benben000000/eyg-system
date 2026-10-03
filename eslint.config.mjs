import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * ESLint flat config.
 * `next lint` is deprecated in Next 15; this config is consumed by
 * `eslint .` and is what `.github/workflows/ci.yml` runs.
 */
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "public/**",
      "docs/brand/build-assets.mjs",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      // ── Type safety ───────────────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",

      // ── Correctness ───────────────────────────────────────────────────────
      eqeqeq: ["error", "smart"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "warn",
      "no-param-reassign": ["error", { props: false }],
      "no-return-await": "error",
      "require-await": "off",

      // ── Security ──────────────────────────────────────────────────────────
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",

      // ── React ─────────────────────────────────────────────────────────────
      "react/no-array-index-key": "error",
      "react/jsx-no-target-blank": ["error", { allowReferrer: false }],
      "react/jsx-key": "error",
      "react/self-closing-comp": "error",
      "react/no-children-prop": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": ["error", { aspects: ["noHref", "invalidHref"] }],

      // ── Next.js ───────────────────────────────────────────────────────────
      /**
       * `warn`, not `error`. Every page image uses `next/image`. The exceptions
       * are the before/after comparison slider and the lightbox, where two
       * arbitrary user-supplied images must be pixel-aligned under a clip path
       * and loaded cross-origin from unknown hosts — `next/image`'s optimiser
       * adds nothing there and its wrapper breaks the drag geometry.
       * Each occurrence carries an inline justification.
       */
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": ["error", "src/app"],

      // ── Imports ───────────────────────────────────────────────────────────
      /**
       * `allowSeparateTypeImports` so a legitimate `import { x }` +
       * `import type { y }` pair from one module is allowed — that is the
       * recommended pattern under `verbatimModuleSyntax`, and without this flag
       * the rule fires on ~17 correct files.
       */
      "no-duplicate-imports": ["error", { "includeExports": false, "allowSeparateTypeImports": true }],
      "import/no-duplicates": "off",
    },
  },

  {
    // The structured logger's whole job is to write a line somewhere.
    files: ["src/lib/logger.ts"],
    rules: { "no-console": "off" },
  },

  {
    // Tests, seeds and scripts may need dev-only patterns.
    files: ["tests/**/*.{ts,tsx}", "prisma/seed.ts", "scripts/**/*.mjs", "**/*.config.{ts,mjs}"],
    rules: {
      "no-console": "off",
      "no-script-url": "off",
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react/display-name": "off",
    },
  },

  {
    // Generated OG images are produced by a script, not hand-authored.
    files: ["src/components/ui/JsonLd.tsx"],
    rules: { "react/no-danger": "off" },
  },

  {
    // CommonJS helpers run under plain `node --require`, before any bundler or
    // type system exists. `require()` is the entire point of the `.cjs`
    // extension - rewriting them as ESM would mean threading a loader hook
    // through `node --import` for no benefit.
    files: ["scripts/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default config;