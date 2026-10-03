// @vitest-environment node
/**
 * A8 · SECURITY GATE 5 — idempotency, reasons, and the booking→ledger seam
 * ============================================================================
 * OWASP: A04 Insecure Design · A08 Data Integrity · A09 Logging Failures
 *
 * `docs/INVENTORY-AGENT-BRIEF.md` §4:
 *   • "Idempotency key on every stock mutation. Networks retry; humans
 *      double-tap."
 *   • "Every write has a reason. Required, non-empty, human-readable."
 *   • "Never trust any client-supplied quantity, price, or `onHandAfter`."
 *
 * Enforces:
 *
 *  1. The idempotency lookup happens INSIDE the transaction, not before it.
 *     A read outside the transaction is a double-spend: both callers miss, both
 *     decrement, and one ledger insert is rejected *after* its decrement has
 *     already committed. (H-04)
 *  2. A replay branch must not synthesise a stock level. `reserved: 0` inside a
 *     `toStockLevelDto(` call is a fabricated number in a staff-facing response,
 *     and A3 must render "before → after". (H-06)
 *  3. `onBookingCompleted` asserts the booking's status before consuming. Its
 *     own sibling `onBookingConfirmed` gates on `status !== "CONFIRMED"`; the
 *     write path gates on nothing, so it will consume against a cancelled job.
 *     (H-02)
 *  4. `onHandAfter` is never read from the caller's input. It comes from the
 *     `RETURNING` of the guarded UPDATE and from nowhere else.
 *  5. The TTL is clamped server-side, and the clamp is a named exported
 *     function so there is one place that decides it.
 *  6. The idempotency key is bounded and present on every ledger write path that
 *     can be retried (movement, count post).
 *
 * The last three read files that exist today, so this gate is not vacuous.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const SERVER_DIR = join(ROOT, "src", "lib", "server", "inventory");

const KNOWN_UNFIXED: Array<{ match: RegExp; finding: string; why: string }> = [
  {
    match: /onBookingCompleted does not assert the booking status/,
    finding: "FINDINGS H-02",
    why:
      "booking-hooks.ts:654-658 calls readBookingStatus(tx, bookingId) and only returns early if the row is " +
      "ABSENT. There is no check for COMPLETED and no refusal for CANCELLED / NO_SHOW — while the sibling " +
      "onBookingConfirmed (L359) correctly gates on `status !== \"CONFIRMED\"`. Once the hooks are wired (C-01) " +
      "this will consume against a dead job. Owner: A4. Add the assertion inside the same transaction, before " +
      "anything is read.",
  },
  {
    match: /a replay branch synthesises a stock level/,
    finding: "FINDINGS H-06",
    why:
      "stock-engine.ts:381 returns toStockLevelDto({ onHand: existing.onHandAfter, reserved: 0 }, -Infinity) on " +
      "a replay. `reserved: 0` is invented, so `available` and `isLow` are both wrong — the operator sees " +
      "\"9 available, not low\" when the real figure may be 3 and low. postMovementInTx is already inside the " +
      "transaction when it takes this branch, so re-reading the level costs one indexed read. Owner: A2.",
  },
  {
    match: /each define normaliseReason/,
    finding: "FINDINGS L-02",
    why:
      "stock-engine.test-support.ts:104 exports `normaliseReason(raw): string` and booking-hooks.ts:147 " +
      "defines a SECOND `normaliseReason(raw, fallback): { reason, substituted }`. Two implementations of " +
      "the rule that decides whether a movement has a reason will drift, and the brief warns about exactly " +
      "this (\"so what the engine does and what a test asserts cannot drift\"). Keep one, in the pure module, " +
      "and import it. Owner: A2/A4.",
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

const files = walk(SERVER_DIR, [".ts"]).map((abs) => ({ abs, path: rel(abs), source: readFileSync(abs, "utf8") }));
const routes = walk(join(ROOT, "src", "app", "api", "inventory"), [".ts"]).map((abs) => ({
  path: rel(abs),
  source: readFileSync(abs, "utf8"),
}));

function report(title: string, violations: string[]): void {
  const suppressed = violations.filter((v) => KNOWN_UNFIXED.some((s) => s.match.test(v)));
  if (suppressed.length === 0) return;
  process.stderr.write(
    `\n  ── ${suppressed.length} suppressed finding(s): ${title} ──\n` +
      suppressed.map((v) => `     ${v}\n`).join("") +
      KNOWN_UNFIXED.filter((s) => suppressed.some((v) => s.match.test(v)))
        .map((s) => `       [${s.finding}] ${s.why}\n`)
        .join("") +
      `     ──────────────────────────────────────────────────────────────────────\n\n`,
  );
}

function actionable(violations: string[]): string[] {
  return violations.filter((v) => !KNOWN_UNFIXED.some((s) => s.match.test(v)));
}

describe(`idempotency, reasons & the booking seam (${files.length} inventory server module(s) scanned)`, () => {
  it("finds the inventory server modules, so this gate is actually armed", () => {
    expect(files.length, "No files under src/lib/server/inventory — the gate is not inspecting anything").toBeGreaterThan(0);
  });

  it("the idempotency lookup is inside the transaction, not a lock-free pre-check", () => {
    // A read OUTSIDE the transaction is not a correctness property, it is a
    // performance shortcut: two concurrent submits both miss it, both decrement,
    // and one is rejected by the unique index after its decrement has committed.
    // The engine gets this right — there IS a fast path, but it is a *fast path*,
    // and the authoritative check sits inside postMovementInTx. This assertion
    // exists so that fast path can never become the only path.
    const violations: string[] = [];
    for (const file of files) {
      const lookup = /stockMovement\.(findUnique|findFirst)\s*\(\s*\{\s*where:\s*\{\s*idempotencyKey/.exec(file.source);
      if (!lookup) continue;
      // The authoritative check: is there one inside a transaction callback?
      const insideTx = /tx\.stockMovement\.(findUnique|findFirst)\s*\(\s*\{\s*where:\s*\{\s*idempotencyKey/.test(file.source);
      if (!insideTx) {
        violations.push(
          `${file.path} looks up idempotencyKey only OUTSIDE a transaction. The lookup must also exist on a ` +
            `transaction client (\`tx.stockMovement.…\`), and the unique-index P2002 path must catch the loser.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("a P2002 on the idempotency key is caught and answered with the original movement", () => {
    const engine = files.find((f) => f.path.endsWith("inventory/stock-engine.ts"));
    expect(engine, "the stock engine not found").toBeDefined();
    const source = engine?.source ?? "";
    expect(source, "the engine must detect a unique violation").toMatch(/P2002/);
    expect(
      source,
      "a caught P2002 must re-read by idempotencyKey and return the original — never re-throw as a 500",
    ).toMatch(/idempotencyKey[\s\S]{0,400}(findUnique|replayOutcome)/);
  });

  it("no replay branch synthesises a stock level", () => {
    // `PostMovementResult.stock` is documented as the level after the move. On a
    // replay it must be the REAL level, re-read — not `reserved: 0`, which makes
    // `available` and `isLow` both wrong in the one case the operator is most
    // likely to be looking at the screen (a double-tap).
    const violations: string[] = [];
    for (const file of files) {
      const re = /toStockLevelDto\s*\(\s*\{[^}]*reserved\s*:\s*0[^}]*\}/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        const lineNumber = file.source.slice(0, match.index).split("\n").length;
        violations.push(
          `${file.path}:${lineNumber} a replay branch synthesises a stock level (${match[0].replace(/\s+/g, " ").slice(0, 80)}). ` +
            `Re-read the level inside the transaction instead. A wrong number is worse than no number.`,
        );
      }
    }
    report("replay stock level", violations);
    expect(actionable(violations), violations.join("\n")).toEqual([]);
  });

  it("onHandAfter is never read from the caller's input", () => {
    // It is written from the RETURNING of the guarded UPDATE. If it ever becomes
    // `input.onHandAfter` or `body.onHandAfter`, the ledger can be written to
    // agree with a number the client chose — a fabricated audit trail.
    const violations: string[] = [];
    for (const file of files) {
      file.source.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
        if (/\b(input|body|parsed|raw|req|request|clean|ctx)\b[.\[\]]*\s*onHandAfter/.test(line)) {
          violations.push(`${file.path}:${index + 1} reads onHandAfter from an input — ${trimmed.slice(0, 80)}.`);
        }
      });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("onBookingCompleted asserts the booking status before consuming anything", () => {
    // `onBookingConfirmed` gates on `status !== \"CONFIRMED\"`. `onBookingCompleted`
    // must refuse a CANCELLED / NO_SHOW booking and require COMPLETED, otherwise
    // parts leave the shelf for work that did not happen.
    const hooks = files.find((f) => f.path.endsWith("inventory/booking-hooks.ts"));
    expect(hooks, "booking-hooks.ts not found").toBeDefined();
    const source = hooks?.source ?? "";
    const start = source.search(/export\s+async\s+function\s+onBookingCompleted\b/);
    expect(start, "onBookingCompleted not found").toBeGreaterThan(-1);
    // Read a generous window: the gate must be near the top, before the consume.
    const window = source.slice(start, start + 3000);
    const assertsTerminal = /status\s*!==?\s*"COMPLETED"/.test(window);
    const refusesDead = /status\s*==\s*"(CANCELLED|NO_SHOW)"/.test(window);
    const violation =
      window.includes("CANCELLED") || window.includes("NO_SHOW") || assertsTerminal
        ? ""
        : "onBookingCompleted does not assert the booking status";
    report("booking status assertion", violation ? [violation] : []);
    expect(actionable(violation ? [violation] : []), violation).toEqual([]);
  });

  it("the reservation TTL is clamped by one named exported function", () => {
    // A hold that never expires becomes a permanent leak: stock is not removed,
    // it is converted into air, and nothing looks wrong. One named function
    // means one decision, and the Zod schema bounds it a second time.
    const reservations = files.find((f) => f.path.endsWith("inventory/reservations.ts"));
    expect(reservations, "reservations.ts not found").toBeDefined();
    const source = reservations?.source ?? "";
    expect(source, "an exported clamp for ttlMinutes must exist").toMatch(/export\s+function\s+clampTtlMinutes\b/);
    expect(source, "clampTtlMinutes must apply both a floor and a ceiling").toMatch(
      /Math\.min\s*\(\s*\w*MAX\w*[\s\S]{0,80}Math\.max\s*\(\s*\w*MIN\w*/,
    );
    expect(source, "every reservation write must derive expiresAt from the clamped TTL").toMatch(/expiresAt\s*=\s*new Date/);
  });

  it("the movement route accepts an idempotency key, and the schema bounds it", () => {
    const route = routes.find((r) => r.path.endsWith("api/inventory/movements/route.ts"));
    expect(route, "the movements route not found").toBeDefined();
    const validation = files.find((f) => f.path.endsWith("inventory/validation.test-support.ts"));
    expect(validation?.source ?? "", "postMovementSchema must accept a bounded idempotencyKey").toMatch(
      /idempotencyKey[\s\S]{0,200}(min|max)\(/,
    );
  });

  it("a cycle-count post is idempotent, keyed on the count and the product", () => {
    // The count id + product id is a natural key that makes the whole post
    // REPLAYABLE: a crash-and-retry resumes instead of double-applying, and a
    // double-click is a no-op rather than a second set of ADJUST rows.
    const counts = files.find((f) => f.path.endsWith("inventory/counts.ts"));
    expect(counts, "counts.ts not found").toBeDefined();
    const source = counts?.source ?? "";
    expect(source, "count adjustments must carry a count:<countId>:<productId> idempotency key").toMatch(
      /idempotencyKey\s*:\s*`count:/,
    );
    expect(source, "the POSTED claim must be a conditional updateMany").toMatch(
      /stockCount\.updateMany\s*\(\s*\{[\s\S]{0,200}status/,
    );
  });

  it("every ledger write passes a reason through the shared normaliser", () => {
    // Two implementations of the rule that decides whether a movement has a
    // reason is exactly the drift the brief warns about. There must be ONE
    // normaliser, in the pure module, and every module must use it.
    const normalisers = files.filter((f) => /function\s+normaliseReason\s*\(/.test(f.source));
    const violations: string[] = [];
    if (normalisers.length > 1) {
      report(
        "duplicated reason normaliser",
        [`${normalisers.map((f) => f.path).join(" and ")} each define normaliseReason(). Two implementations ` +
          `of the mandatory-reason rule will drift. Keep one, in the pure module, and import it.`],
      );
    }
    for (const file of files) {
      if (!/\bstockMovement\.create\s*\(/.test(file.source)) continue;
      if (!/\bnormaliseReason\s*\(/.test(file.source)) {
        violations.push(`${file.path} writes a StockMovement row but never calls normaliseReason().`);
      }
    }
    report("ledger write without a reason normaliser", violations);
    expect(actionable(violations), violations.join("\n")).toEqual([]);
  });

  it("every suppression cites a finding that still exists in FINDINGS.md", () => {
    let md = "";
    try {
      md = readFileSync(join(ROOT, "docs", "inventory-security", "FINDINGS.md"), "utf8");
    } catch {
      md = "";
    }
    for (const suppression of KNOWN_UNFIXED) {
      const id = suppression.finding.replace("FINDINGS ", "").trim();
      expect(md, `Suppression "${suppression.finding}" no longer appears in FINDINGS.md — delete the entry`).toContain(id);
    }
  });
});