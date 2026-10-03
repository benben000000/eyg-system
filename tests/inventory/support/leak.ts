/**
 * A7 · CI/CD & QA — cost-leakage scanner.
 * ============================================================================
 * WHY THE RAW STRING AND NOT THE PARSED OBJECT
 * --------------------------------------------
 * `expect(body.data.product).not.toHaveProperty("costPrice")` on a parsed
 * object is a weak assertion in three separate ways, and all three have bitten
 * real codebases:
 *
 *   1. **Wrong scope.** The leak is usually somewhere else in the envelope —
 *      in `meta`, in a sibling row, in an error `fields` map. Checking one
 *      sub-object proves nothing about the response.
 *   2. **Renamed keys.** A refactor to `cost` or `unitCost` passes a check
 *      that only knows the old name.
 *   3. **`JSON.parse` keeps what you did not look at.** It is not a filter.
 *      Nothing is removed by not asking about it.
 *
 * So every leakage assertion in this suite runs against
 * `await response.text()` — the exact bytes on the wire. A key that is present
 * but unexamined is a failure, not a pass.
 *
 * THE SENTINEL VALUE
 * ------------------
 * Key names alone can be evaded by a field called `cost`. So the security suite
 * also plants a product whose `costPrice` is a number no other field could hold
 * and asserts that number never appears. A response that leaks cost *without*
 * leaking the word "costPrice" is still caught.
 * ============================================================================
 */

/** Keys that must never reach a surface without a staff session. */
export const FORBIDDEN_COST_KEYS: readonly string[] = [
  "costPrice",
  "marginPct",
  "estimatedCost",
  "costValue",
  "varianceValue",
  "unitCost",
  "cost",
  "supplierCost",
];

/** Keys that must never reach any response at all, staff or not. */
export const FORBIDDEN_ALWAYS_KEYS: readonly string[] = [
  "passwordHash",
  "tokenHash",
  "twoFactorSecret",
  "PII_ENCRYPTION_KEY",
  "DATABASE_URL",
  "authSecret",
];

/** Infrastructure detail that must never appear in a body, ever. */
export const FORBIDDEN_SHAPES: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "a Postgres connection string", pattern: /postgres(?:ql)?:\/\//i },
  { label: "a Prisma error class name", pattern: /PrismaClient/ },
  { label: "a stack frame", pattern: /\bat\s+Object\./ },
  { label: "a source location", pattern: /\.ts:\d+:\d+/ },
  { label: "a SQL fragment", pattern: /\bSELECT\b[\s\S]{0,80}\bFROM\b/i },
];

export interface LeakReport {
  readonly leakedKeys: readonly string[];
  readonly leakedValues: readonly number[];
  readonly leakedShapes: readonly string[];
  readonly ok: boolean;
}

/** Every offending key path, so the report names *where*, not just *that*. */
export function findKeyPaths(payload: unknown, forbidden: readonly string[]): string[] {
  const hits: string[] = [];
  const seen = new WeakSet<object>();

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      if (seen.has(node)) return;
      seen.add(node);
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const here = path ? `${path}.${key}` : key;
      if (forbidden.includes(key)) hits.push(here);
      walk(value, here);
    }
  };

  walk(payload, "");
  return hits;
}

/** Numbers present anywhere in the payload — used for the sentinel check. */
export function collectNumbers(payload: unknown): number[] {
  const found: number[] = [];
  const seen = new WeakSet<object>();

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      if (seen.has(node)) return;
      seen.add(node);
      node.forEach(walk);
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (typeof value === "number") found.push(value);
      else walk(value);
    }
  };

  walk(payload);
  return found;
}

/**
 * Scans the exact bytes a client would receive.
 *
 * @param raw          The response body as text. Never a parsed object.
 * @param sentinelCosts Cost values that must not appear even under another name.
 * @param forbiddenKeys Key names that must not appear.
 */
export function scanForCostLeak(
  raw: string,
  options: { sentinelCosts?: readonly number[]; forbiddenKeys?: readonly string[] } = {},
): LeakReport {
  const forbiddenKeys = options.forbiddenKeys ?? [...FORBIDDEN_COST_KEYS, ...FORBIDDEN_ALWAYS_KEYS];
  const sentinelCosts = options.sentinelCosts ?? [];

  const leakedKeys: string[] = [];
  for (const key of forbiddenKeys) {
    // `"key"` or `key:` — a JSON key or a JS object literal key.
    if (new RegExp(`"${key}"\\s*:`).test(raw) || new RegExp(`(^|[{,]\\s*)${key}\\s*:`, "m").test(raw)) {
      leakedKeys.push(key);
    }
  }

  const leakedValues: number[] = [];
  for (const value of sentinelCosts) {
    // Boundaries matter: 9973 must not match inside 99731.
    if (new RegExp(`(?<![\\d.])${value}(?![\\d.])`).test(raw)) leakedValues.push(value);
  }

  const leakedShapes: string[] = [];
  for (const shape of FORBIDDEN_SHAPES) {
    if (shape.pattern.test(raw)) leakedShapes.push(shape.label);
  }

  return {
    leakedKeys,
    leakedValues,
    leakedShapes,
    ok: leakedKeys.length === 0 && leakedValues.length === 0 && leakedShapes.length === 0,
  };
}

/** Throwing wrapper, so a leak names itself in the failure message. */
export function expectNoCostLeak(
  raw: string,
  where: string,
  options: { sentinelCosts?: readonly number[]; forbiddenKeys?: readonly string[] } = {},
): void {
  const report = scanForCostLeak(raw, options);
  const parts: string[] = [];
  if (report.leakedKeys.length > 0) parts.push(`keys ${report.leakedKeys.join(", ")}`);
  if (report.leakedValues.length > 0) parts.push(`values ${report.leakedValues.join(", ")}`);
  if (report.leakedShapes.length > 0) parts.push(report.leakedShapes.join(", "));
  if (parts.length === 0) return;
  throw new Error(
    [
      `COST LEAKAGE at ${where}`,
      `  leaked: ${parts.join("; ")}`,
      "  A surface without a staff session must never carry what the shop paid.",
      `  body (first 600 chars): ${raw.slice(0, 600)}`,
    ].join("\n"),
  );
}
