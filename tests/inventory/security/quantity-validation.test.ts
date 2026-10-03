// @vitest-environment node
/**
 * A8 · SECURITY GATE 4 — quantity validation and pagination ceilings
 * ============================================================================
 * OWASP: A03 Injection · A04 Insecure Design
 *
 * A quantity is the only input in this system that moves money and stock
 * directly, so it is the only input that gets a full set of assertions:
 *
 *  1. No bare `parseInt` / `parseFloat` / `Number()` applied to a quantity-like
 *     identifier unless the same file carries a Zod `.int()` — because
 *     `parseInt("3abc")` is `3` and `Number("")` is `0`, and a stock number
 *     derived from either is a fabricated one.
 *  2. Every `pageSize` and `limit` is bounded. `MovementQuery.pageSize` with no
 *     ceiling is a whole-stock-history dump in one request: every `reason`
 *     (staff free text, PII), every `actorName`, every `bookingReference`.
 *  3. Every `findMany` in an inventory server module passes `take:` — an
 *     unbounded catalogue read is the enumeration primitive.
 *  4. No `Math.min(requested, …)` on a consumption quantity without a matching
 *     refusal branch. The engine refuses rather than clamps; a caller that
 *     clamps above it turns "only 2 were held" into "consumed 2" and says
 *     nothing. (H-03)
 *  5. The DOT-code write validator and the read parser agree on the valid week
 *     range. A DOT that the reader rejects is a tyre whose age is unknown, and
 *     "unknown" must never be presented as "fresh" in a clearance campaign.
 *     (M-07)
 *  6. The contract's `PostMovementInput` carries no client-supplied truth field.
 *     `onHandAfter`, `available`, `reserved` and `onHand` must not exist as
 *     fields — "there is no field to assign into" is stronger than "we validate
 *     that field", and this assertion is checked against a file that exists.
 *
 * The last two read files that exist today, so this gate is not vacuous.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const INVENTORY_TREE = [
  "src/lib/server/inventory",
  "src/app/api/inventory",
  "src/app/inventory",
  "src/components/inventory",
];

const KNOWN_UNFIXED: Array<{ match: RegExp; finding: string; why: string }> = [
  {
    match: /reservations\.ts.*clamps a consumption quantity/,
    finding: "FINDINGS H-03",
    why:
      "reservations.ts:614 does `const qty = Math.min(requested, row.qty)`. A BOM asking for 4 against a " +
      "hold of 2 consumes 2 and records NO refusal — onBookingCompleted passes bomLine.qtyNeeded as " +
      "`requested`, so a partial hold silently under-consumes and the booking is still marked COMPLETED. " +
      "A4's brief: \"Do not silently consume the wrong quantity.\" Push a ConsumeRefusal for the " +
      "difference instead of absorbing it. Owner: A2.",
  },
  {
    match: /validation.*does not constrain the DOT week range/,
    finding: "FINDINGS M-07",
    why:
      "validation.test-support.ts:107 validates dotCode with /^\\d{4}$/, which accepts week 00 and week 99. " +
      "parseDotCode (the reader) correctly rejects anything outside 1..53, so the two disagree. A tyre " +
      "whose DOT cannot be parsed has NO age, and the ageing report must treat that as unknown — never " +
      "as fresh, because the clearance campaign is DOT-driven. Owner: A2.",
  },
  {
    match: /\.findMany without a `take`/,
    finding: "FINDINGS M-10",
    why:
      "availability.ts:171 and :273 read `product` (selecting costPrice) and `reservation` with no `take`. " +
      "Both are bounded in practice by a Zod-validated service-id list (max 20 services), but the bound " +
      "lives in a different file from the query. This is the one place in the inventory tree where a cost " +
      "field is selected inside the availability path, so it deserves an explicit ceiling rather than an " +
      "implicit one. Owner: A2.",
  },
];

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const path = join(dir, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) walk(path, exts, out);
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(path);
  }
  return out;
}

function rel(abs: string): string {
  return relative(ROOT, abs).replace(/\\/g, "/");
}

const files = INVENTORY_TREE.flatMap((dir) =>
  walk(join(ROOT, dir), [".ts", ".tsx"]).map((abs) => ({ abs, path: rel(abs), source: readFileSync(abs, "utf8") })),
);
// Server-side only. A client component coercing its own input field is fine —
// the server revalidates and the engine refuses rather than clamps. Flagging
// `Number(input.value)` inside a dialog would be noise that trains people to
// ignore this gate, which is worse than not having it.
const serverFiles = files.filter((f) => !f.path.startsWith("src/components/"));
const serverModules = serverFiles.filter((f) => f.path.startsWith("src/lib/server/inventory/"));
const contract = readFileSync(join(ROOT, "src", "lib", "inventory-types.ts"), "utf8");

const QUANTITY_IDENTIFIERS = "qty|quantity|counted|pageSize|limit|ttlMinutes|qtyPerService|onHand|reserved|reorderQty";

/** Print a suppression rather than swallowing it. Same discipline as owasp-lite-scan. */
function report(title: string, violations: string[]): void {
  const hits = KNOWN_UNFIXED.filter((s) => violations.some((v) => s.match.test(v)));
  if (hits.length === 0) return;
  const suppressed = violations.filter((v) => hits.some((s) => s.match.test(v)));
  process.stderr.write(
    `\n  ── ${suppressed.length} suppressed finding(s): ${title} ──\n` +
      suppressed.map((v) => `     ${v}\n`).join("") +
      hits.map((s) => `       [${s.finding}] ${s.why}\n`).join("") +
      `     ──────────────────────────────────────────────────────────────────────\n\n`,
  );
}

function actionable(violations: string[]): string[] {
  return violations.filter((v) => !KNOWN_UNFIXED.some((s) => s.match.test(v)));
}

describe(`quantity validation & pagination ceilings (${files.length} inventory file(s) scanned)`, () => {
  it("finds the inventory tree, so this gate is actually armed", () => {
    expect(files.length, "No files under the inventory tree — the gate is not inspecting anything").toBeGreaterThan(0);
  });

  it("no bare parseInt/parseFloat/Number() coerces a quantity without a Zod .int() nearby", () => {
    // parseInt("3abc") === 3. Number("") === 0. Number(null) === 0. A stock
    // number built from any of those is a fabricated one, and the ledger would
    // record it as real.
    const violations: string[] = [];
    const coercion = new RegExp(`(parseInt|parseFloat|Number)\\s*\\([^)]*\\b(${QUANTITY_IDENTIFIERS})\\b`, "i");
    for (const file of serverFiles) {
      if (/\.int\(\)/.test(file.source)) continue; // a Zod integer schema governs this file
      file.source.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
        if (!coercion.test(line)) return;
        violations.push(
          `${file.path}:${index + 1} coerces a quantity with ${/parseInt|parseFloat|Number/.exec(line)?.[0]} and has ` +
            `no Zod .int() in the file — ${trimmed.slice(0, 80)}. Validate the value as an integer and cap it.`,
        );
      });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every pageSize and limit is bounded", () => {
    const violations: string[] = [];
    for (const file of serverFiles) {
      // A file-level exemption: if the module clamps its paging anywhere, every
      // later use of the variable is already bounded. Checking per LINE would
      // flag `skip: (page - 1) * pageSize` twenty lines below its clamp, which is
      // exactly the noise that trains people to ignore a gate.
      const clampsPaging = /Math\.min\s*\(\s*\d+|queryInt\s*\(|\.max\s*\(\s*\d+/.test(file.source);
      // A route that validates its query through the shared inventory Zod schema
      // carries its bound in that module — which is where the bound belongs, and
      // which this same suite asserts. Do not demand a second clamp at the call site.
      const validatesQuery = /parseQuery\s*\(|from\s+["'][^"']*validation\.[a-z-]*inventory[^"']*["']/.test(file.source);
      if (clampsPaging || validatesQuery) continue;
      const lines = file.source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] as string;
        if (!/\b(pageSize|limit)\b/.test(line)) continue;
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        // A TypeScript type declaration, not a read: `pageSize?: number;` — which may
        // appear mid-line inside a function's parameter type.
        if (/\b(pageSize|limit)\s*[?]?\s*:\s*(number|string)\b/.test(line)) continue;
        // A bounded read on the line itself.
        const bounded =
          /Math\.min\s*\(/.test(line) ||
          /\bqueryInt\s*\(/.test(line) ||
          /\.max\s*\(/.test(line) ||
          /:\s*\d{1,5}\s*[,)]/.test(line) ||
          /\bMAX_[A-Z_]+/.test(line) ||
          /\?\?\s*\d{1,5}/.test(line);
        if (bounded) continue;
        violations.push(
          `${file.path}:${index + 1} reads a pageSize/limit with no visible ceiling — ${trimmed.slice(0, 80)}. ` +
            `An unbounded page is a full-table dump: every reason, actorName and bookingReference in one response.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every catalogue, ledger and reservation read passes take:", () => {
    // Scoped to the tables that carry cost, PII and ledger detail — an unbounded
    // read of those is the enumeration primitive. `ServicePartRequirement` and
    // `BusinessHours` reads are bounded by a validated id list and are exempt.
    const SENSITIVE = /prisma\.(product|stockMovement|reservation|stockCount|customer|lead)\b/;
    const violations: string[] = [];
    for (const file of serverModules) {
      const re = /prisma\.(product|stockMovement|reservation|stockCount|customer|lead)\.findMany\s*\(\s*\{/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        if (!SENSITIVE.test(file.source)) continue;
        // Isolate the argument object so a `take:` in a sibling call is not
        // credited to this one.
        let depth = 0;
        let end = match.index + match[0].length - 1;
        for (let i = end; i < file.source.length && i < end + 2500; i += 1) {
          if (file.source[i] === "{") depth += 1;
          else if (file.source[i] === "}") {
            depth -= 1;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        const window = file.source.slice(match.index, end + 1);
        if (/\btake\s*:/.test(window)) continue;
        const lineNumber = file.source.slice(0, match.index).split("\n").length;
        violations.push(
          `${file.path}:${lineNumber} calls ${match[1]}.findMany without a \`take\`. ` +
            `An unbounded read of a cost, PII or ledger table is the enumeration primitive — add \`take\`, ` +
            `or move it behind a route whose schema bounds the input.`,
        );
      }
    }
    report("unbounded findMany", violations);
    expect(actionable(violations), violations.join("\n")).toEqual([]);
  });

  it("no caller silently clamps a consumption quantity without recording a refusal", () => {
    const violations: string[] = [];
    for (const file of serverFiles) {
      const re = /Math\.min\s*\(\s*(requested|asked|needed|wanted)\b[^\)]*\)/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        const lineNumber = file.source.slice(0, match.index).split("\n").length;
        // Allow it if the surrounding function also pushes a refusal.
        const context = file.source.slice(Math.max(0, match.index - 900), match.index + 900);
        const recordsRefusal = /refusals\.push|ConsumeRefused|shortfall|short\s*[:=]/i.test(context);
        if (recordsRefusal) continue;
        violations.push(
          `${file.path}:${lineNumber} clamps a consumption quantity to the held amount and records no refusal. ` +
            `The engine refuses rather than clamps (stock-engine.test-support.ts:126); a caller that clamps ` +
            `above it turns "only 2 held" into "consumed 2" and the booking still closes. Report the shortfall.`,
        );
      }
    }
    const suppressed = violations.filter((v) => KNOWN_UNFIXED.some((s) => s.match.test(v)));
    if (suppressed.length > 0) {
      process.stderr.write(
        `\n  ── ${suppressed.length} suppressed clamp finding(s) ──\n` +
          suppressed.map((v) => `     ${v}\n`).join("") +
          KNOWN_UNFIXED.map((s) => `       [${s.finding}] ${s.why}\n`).join("") +
          `     ────────────────────────────────────────────────────────\n\n`,
      );
    }
    expect(violations.filter((v) => !KNOWN_UNFIXED.some((s) => s.match.test(v))), violations.join("\n")).toEqual([]);
  });

  it("the DOT-code validator and the DOT-code parser agree on the week range", () => {
    // parseDotCode (stock-engine.test-support.ts:253) is careful: exactly four
    // digits, week 1..53, the tyre-industry two-digit-year convention, dated to
    // the Monday of the production week, and week 53 of a 52-week year rejected
    // rather than invented. The WRITE side must not be looser, because a
    // tyre whose DOT cannot be parsed has no age at all.
    const writer = files.find((f) => f.path.endsWith("inventory/validation.test-support.ts"));
    const reader = files.find((f) => f.path.endsWith("inventory/stock-engine.test-support.ts"));
    expect(writer, "the inventory validation module not found").toBeDefined();
    expect(reader, "the inventory pure-helper module not found").toBeDefined();

    const dotLine = writer?.source.split(/\r?\n/).find((l) => /dotCode/.test(l) && /refine|\.regex|optionalCleaned/.test(l)) ?? "";
    const hasWeekRange = /\(\s*0\[1-9\]|\[1-4\]\\d|5\[0-3\]/.test(dotLine);
    if (!hasWeekRange) {
      const message = "validation does not constrain the DOT week range";
      if (KNOWN_UNFIXED.some((s) => s.match.test(message))) {
        process.stderr.write(
          `\n  ── REPORT: ${message} ──\n` +
            KNOWN_UNFIXED.filter((s) => s.match.test(message))
              .map((s) => `       [${s.finding}] ${s.why}\n`)
              .join("") +
            `     ──────────────────────────────────────────────────────────────\n\n`,
        );
        return;
      }
      expect(dotLine, "the DOT-code write validator must constrain the week range to 01–53, matching parseDotCode").toMatch(
        /0\[1-9\]/,
      );
      return;
    }
    expect(dotLine).toMatch(/0\[1-9\]/);
  });

  it("the contract's PostMovementInput carries no client-supplied truth field", () => {
    // "There is no field to assign into" is strictly stronger than "we validate
    // that field". `onHandAfter` is written from the RETURNING of the guarded
    // UPDATE; `available` is derived. If either becomes an input, the ledger can
    // be written to agree with a number the client chose.
    const start = contract.search(/export\s+interface\s+PostMovementInput\b/);
    expect(start, "PostMovementInput not found in the contract").toBeGreaterThan(-1);
    const body = contract.slice(start, contract.indexOf("\n}", start));
    const forbidden = ["onHandAfter", "available", "reserved", "onHand", "costPrice", "sellPrice", "marginPct"];
    const present = forbidden.filter((field) => new RegExp(`^\\s*${field}\\s*[?]?\\s*:`, "m").test(body));
    expect(present, `PostMovementInput must not accept ${present.join(", ")} — these are server-computed`).toEqual([]);
  });

  it("the contract's ReserveInput bounds ttlMinutes", () => {
    // A hold that never expires becomes a permanent leak, and `available` is the
    // only number a promise may be made against. The client must not choose the
    // TTL; the server clamps it. (clampTtlMinutes exists — this checks the
    // contract advertises the bound too.)
    const start = contract.search(/export\s+interface\s+ReserveInput\b/);
    expect(start, "ReserveInput not found in the contract").toBeGreaterThan(-1);
    const body = contract.slice(start, contract.indexOf("\n}", start));
    // The contract declares the field; the clamp lives in the implementation and
    // in the Zod schema. What must NOT happen is a documented "no maximum".
    expect(body, "the TTL doc comment must not invite an unbounded hold").not.toMatch(/no\s+maximum|unbounded/i);
  });

  it("every suppression cites a finding that still exists in FINDINGS.md", () => {
    let report = "";
    try {
      report = readFileSync(join(ROOT, "docs", "inventory-security", "FINDINGS.md"), "utf8");
    } catch {
      report = "";
    }
    for (const suppression of KNOWN_UNFIXED) {
      const id = suppression.finding.replace("FINDINGS ", "").trim();
      expect(report, `Suppression "${suppression.finding}" no longer appears in FINDINGS.md — delete the entry`).toContain(id);
    }
  });
});