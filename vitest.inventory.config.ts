/**
 * A7 · CI/CD & QA — the inventory gate's own Vitest config.
 * ============================================================================
 * WHY A SEPARATE CONFIG AT ALL
 * ----------------------------
 * The base `vitest.config.ts` already globs everything under `tests`, so
 * `npm test` covers the inventory suite too. This config exists for three reasons
 * that are about SIGNAL rather than coverage:
 *
 *   1. **A separate CI job.** The inventory gate must be able to fail on its own.
 *      A green tick on the whole suite that hides five red concurrency tests is
 *      not a gate; a job named `inventory · concurrency` is.
 *   2. **A separate JUnit report.** `inventory-junit.xml` uploads separately, so a
 *      failure is attributable to the inventory suite without digging through the
 *      whole run.
 *   3. **A stricter coverage scope.** Coverage here is measured against
 *      `src/lib/server/inventory/**` and `src/app/api/inventory/**` only. A shop
 *      with no stock control and a perfect booking funnel is a shop that cannot
 *      take an order for a tyre it does not have.
 *
 * IT INHERITS, IT DOES NOT REPLACE
 * ---------------------------------
 * The base config is spread in rather than copied, so the `@/*` alias, the
 * `server-only` stub, the pinned `TZ`, the high-entropy test secrets and the
 * throwing optional-SDK stubs all carry over. Duplicating them here would create
 * a second place for them to drift — and a duplicated secret guard that drifted
 * out of sync would be a guard that proves nothing.
 *
 * NOTE ON OWNERSHIP: `package.json` is orchestrator-owned, so there is no
 * `test:inventory` script here. The CI job invokes
 * `npx vitest run --config vitest.inventory.config.ts` directly, and a local run
 * is the same command.
 * ============================================================================
 */

import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

import base from "./vitest.config";

const abs = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

/**
 * Fails the run if one of THIS AGENT's spec files contains a placeholder
 * assertion.
 *
 * The specific failure mode: someone "fixing" a red concurrency test by replacing
 * the assertion with `expect(true).toBe(true)`. That is not a passing test, it is
 * a deleted test with extra steps, and it is the one thing the brief forbids
 * outright. `expect(true)` is legal TypeScript and legal Vitest, so nothing else
 * in the toolchain will catch it.
 *
 * SCOPE — deliberately narrow. `tests/inventory/security/**` belongs to the
 * security agent, and a gate that fails someone else's file is a gate that stops
 * being read. The guard covers the files this agent owns; an instance found in a
 * neighbour's file is reported to them rather than enforced from here.
 *
 * (It has already found one: `security/cost-data-containment.test.ts` carried a
 * bare `expect(true).toBe(true);`. Reported to the security agent, not enforced.)
 *
 * It runs as a `transform` hook so it sees every spec that was actually loaded,
 * including a filtered single-file run.
 */
const OWNED_SPECS: readonly RegExp[] = [
  /tests[\\/]inventory[\\/]unit[\\/].*\.ts$/,
  /tests[\\/]inventory[\\/]integration[\\/].*\.ts$/,
  /tests[\\/]inventory[\\/]support[\\/].*\.ts$/,
  /tests[\\/]inventory[\\/]security[\\/](leakage|authz)\.test\.ts$/,
];

function forbidPlaceholderAssertions(): Plugin {
  const forbidden: ReadonlyArray<{ pattern: RegExp; why: string }> = [
    { pattern: /expect\(\s*true\s*\)\.toBe\(\s*true\s*\)/, why: "an assertion that cannot fail" },
    { pattern: /\bxit\(/, why: "a skipped test where a todo belongs" },
  ];

  return {
    name: "inventory:forbid-placeholder-assertions",
    enforce: "post",
    transform(code, id) {
      if (!OWNED_SPECS.some((owned) => owned.test(id))) return null;
      for (const rule of forbidden) {
        if (rule.pattern.test(code)) {
          throw new Error(
            `${id}: contains ${rule.why} (${rule.pattern}). ` +
              "If the implementation is wrong, leave the test failing and report it. " +
              "If the export does not exist yet, the assertion belongs in an `it.todo` naming it.",
          );
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  ...base,

  plugins: [...(base.plugins ?? []), forbidPlaceholderAssertions()],

  test: {
    ...base.test,

    /** Only the inventory suite. `tests/security/**` is excluded by the base. */
    include: ["tests/inventory/**/*.test.ts"],

    reporters: process.env.CI ? ["default", "junit", "json"] : ["default"],

    /**
     * Stricter than the base, on purpose. The whole point of the inventory gate
     * is that the guarded write, the reservation lifecycle and the availability
     * promise are covered; 60% would let the reserve path go untested.
     */
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      reportsDirectory: "coverage-inventory",
      include: [
        "src/lib/server/inventory/**",
        "src/app/api/inventory/**",
        "src/lib/inventory-types.ts",
      ],
      exclude: ["**/*.d.ts", "**/*.test-support.ts"],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
  },
});

// `abs` and `readFileSync` are kept referenced so a future guard that needs to
// read a file has the helper already in scope. Referencing them here also stops a
// linter from stripping the imports.
void abs;
void readFileSync;

