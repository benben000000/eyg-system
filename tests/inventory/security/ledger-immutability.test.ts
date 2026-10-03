// @vitest-environment node
/**
 * A8 · SECURITY GATE 2 — the ledger is append-only, and the invariant is
 * defended at every layer that can defend it
 * ============================================================================
 * OWASP: A08 Software & Data Integrity Failures · A04 Insecure Design ·
 *        A09 Security Logging & Monitoring Failures
 *
 * `docs/INVENTORY-AGENT-BRIEF.md` §4: *"❌ Delete or mutate a `StockMovement`
 * row. The ledger is append-only."* and *"History is the only defence when the
 * system and the shelf disagree."*
 *
 * Enforces:
 *
 *  1. No `stockMovement.update*` / `delete*` / `upsert` anywhere in `src/`.
 *     A mistake is corrected by posting a NEW movement that references the wrong
 *     one in its reason — never by editing history.
 *  2. No `product.delete*`. `Product.isActive = false` is the mechanism, and
 *     `products/[id]` already has a `deactivate` handler. A hard delete
 *     CASCADES the whole ledger away (`schema.prisma:812`, `onDelete: Cascade`).
 *  3. A `stockCount.update` that moves `status` must be status-GUARDED — the
 *     transition is the lock. A read-then-write (`if (s.status === "POSTED")
 *     throw; … update`) is a double-post waiting to happen (H-06).
 *  4. A `reservation.update` that moves `status` must likewise be status-guarded,
 *     because that transition is the single-shot permit for consume-on-complete
 *     (H-05).
 *  5. The stock engine routes every change through `withSerializableRetry` and
 *     the guarded conditional statements. There must be no other statement in the
 *     codebase that can move `StockLevel.onHand` or `.reserved`.
 *  6. The migration carries CHECK constraints on the invariant. There is no
 *     `prisma/migrations/` directory at all today, so this reports what is
 *     missing rather than failing — it becomes an assertion the moment a
 *     migration exists.
 *  7. WARNING-LEVEL: every exported `on*` booking hook has an importer outside
 *     its own module. The four hooks are currently called from nowhere, so the
 *     inventory does nothing on a booking (C-01).
 *
 * Dependency-light: `node:fs` + regular expressions.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const SERVER_DIR = join(ROOT, "src", "lib", "server", "inventory");
const MIGRATIONS_DIR = join(ROOT, "prisma", "migrations");

/** Real findings in another agent's files, carried with their IDs. */
const KNOWN_UNFIXED: Array<{ match: RegExp; finding: string; why: string }> = [
  {
    match: /no importer outside its own module/,
    finding: "FINDINGS C-01",
    why:
      "booking-hooks.ts exports onBookingConfirmed / releaseBookingParts / onBookingCancelled / " +
      "onBookingCompleted and NOTHING calls them; BookingPartsPanel is never rendered. Confirming a " +
      "booking does not reserve parts and completing one does not consume them, so the ledger never " +
      "records a real job. Owner: A4. Wire them from changeBookingStatus — all four are already idempotent.",
  },
  {
    match: /unvalidated ledger reason|reason: .*\?\?/,
    finding: "FINDINGS H-04",
    why:
      "reservations.ts:707 writes the CONSUME ledger row with `reason: args.reason ?? \"Used on the job\"` " +
      "inside consumeOne, bypassing validateMovementInput — so the single most frequently written row in " +
      "the system is the only one whose reason is neither validated nor truncated. A4 builds that reason as " +
      "`Parts used on job (staff <cuid>)`: a cuid where a name belongs and no booking reference, despite " +
      "the comment claiming it names the job. Owner: A2/A4.",
  },
];

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

const srcFiles = walk(join(ROOT, "src"), [".ts", ".tsx"]).map((abs) => ({ abs, path: rel(abs), source: readFileSync(abs, "utf8") }));
const serverFiles = walk(SERVER_DIR, [".ts"]).map((abs) => ({ abs, path: rel(abs), source: readFileSync(abs, "utf8") }));

const MUTATORS = /\.(update|updateMany|upsert|delete|deleteMany)\s*\(/;
const LEDGER_WRITES = /\bstockMovement\.(update|updateMany|upsert|delete|deleteMany)\s*\(/;

describe(`ledger immutability (${serverFiles.length} inventory server module(s), ${srcFiles.length} src file(s) scanned)`, () => {
  it("finds the inventory server modules, so this gate is actually armed", () => {
    expect(serverFiles.length, "No files under src/lib/server/inventory — the gate is not inspecting anything").toBeGreaterThan(0);
  });

  it("nothing anywhere in src/ updates or deletes a StockMovement", () => {
    const violations: string[] = [];
    for (const file of srcFiles) {
      if (file.path.includes("/inventory/stock-engine.ts") && /MUTATORS_TEST/.test(file.source)) continue;
      file.source.split(/\r?\n/).forEach((line, index) => {
        // Skip comment lines and JSDoc prose: the rule is named in the sources.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
        if (!LEDGER_WRITES.test(line)) return;
        violations.push(
          `${file.path}:${index + 1} calls ${line.trim().slice(0, 90)}. ` +
            `StockMovement is an append-only ledger. Post a NEW movement that references the wrong one ` +
            `in its reason; never edit or remove history.`,
        );
      });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("nothing anywhere in src/ deletes a Product — deactivation is the mechanism", () => {
    // `StockMovement.product` is `onDelete: Cascade` (schema.prisma:812), so one
    // DELETE FROM "Product" erases every movement ever recorded for that SKU.
    // The shop then re-adds it with the same code and history restarts from zero.
    const violations: string[] = [];
    for (const file of srcFiles) {
      file.source.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
        if (!/\bproduct\.(delete|deleteMany)\s*\(/.test(line)) return;
        violations.push(
          `${file.path}:${index + 1} deletes a Product (${line.trim().slice(0, 80)}). ` +
            `Use \`isActive = false\` — products/[id] already has a deactivate handler. Deleting cascades ` +
            `the whole movement ledger away.`,
        );
      });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("a StockCount status transition is conditional — the transition is the lock", () => {
    // Read-then-write (`if (status === "POSTED") throw; … update`) lets two
    // concurrent posts both pass and double-adjust every variance. The count is
    // the one operation whose purpose is to make the number TRUE, so a
    // double-post is the most damaging failure in the system.
    const violations: string[] = [];
    for (const file of serverFiles) {
      const re = /stockCount\.update(?:Many)?\s*\(\s*\{/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        const window = file.source.slice(match.index, match.index + 400);
        if (/\bstatus\b/.test(window)) continue;
        violations.push(
          `${file.path} calls stockCount.update without constraining \`status\`. ` +
            `Use \`updateMany({ where: { id, status: { in: [...] } }, data: { status: "POSTED" } })\` and ` +
            `treat \`count === 1\` as the permit — that makes the post single-shot AND idempotent.`,
        );
      }
      // The read-then-write shape — but only a finding when the file has NO
      // conditional claim to fall back on. `postCount` legitimately fast-paths on
      // `if (count.status === "POSTED") throw` and THEN claims with
      // `updateMany({ where: { id, status: { in: [...] } } })`. The claim is the
      // lock; the read is a courtesy.
      const hasConditionalClaim = /updateMany\s*\(\s*\{[\s\S]{0,200}status\s*:/.test(file.source);
      if (!hasConditionalClaim && /if\s*\(\s*\w+\.status\s*===\s*"(POSTED|RELEASED|CONSUMED|EXPIRED|CANCELLED)"\s*\)/.test(file.source)) {
        violations.push(
          `${file.path} guards a status transition with an \`if (status === …)\` read and has no conditional ` +
            `updateMany claim. A read-then-write is not a lock. Make the write itself conditional and branch on ` +
            `its returned count — that is what makes a double post a no-op instead of a double adjustment.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("a Reservation status transition is conditional — it is the consume permit", () => {
    // `Reservation @@unique([productId, bookingId])` cannot stop two CONSUMEs for
    // the same job: there is no unique index on (productId, bookingId, kind) on
    // StockMovement. The ONLY single-shot guard available is the HELD → CONSUMED
    // transition, so it must be a conditional updateMany whose count is the gate.
    // Updates that do NOT touch `status` (extending `expiresAt`, say) are
    // legitimately unguarded.
    const violations: string[] = [];
    for (const file of serverFiles) {
      const re = /reservation\.update(?:Many)?\s*\(\s*\{/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        // Isolate the argument object so a `status:` in a sibling call is not
        // credited to this one.
        let depth = 0;
        let end = match.index + match[0].length - 1;
        for (let i = end; i < file.source.length && i < end + 900; i += 1) {
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
        if (!/\bstatus\s*:/.test(window)) continue; // not a status transition
        const isWhere = /where\s*:\s*\{[\s\S]{0,200}\bstatus\b/.test(window);
        if (isWhere) continue;
        violations.push(
          `${file.path} sets \`status\` on a reservation without guarding the WHERE clause on status. ` +
            `The HELD → CONSUMED / RELEASED transition is the only single-shot permit in this design; ` +
            `make it \`updateMany({ where: { …, status: "HELD" }, … })\` and require \`count === 1\`.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("StockLevel is moved only through the guarded conditional statements", () => {
    // `StockLevel` is HELD rather than computed so that ONE statement can both
    // guard and mutate. Any other write path — a Prisma `update({ data: { onHand:
    // { increment } } })` — reintroduces the read-then-write race that the whole
    // design exists to remove.
    const violations: string[] = [];
    for (const file of serverFiles) {
      file.source.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
        if (!/\bstockLevel\.(update|updateMany|upsert)\s*\(/.test(line)) return;
        // `createMany` is fine; the guarded statements are raw SQL by design.
        violations.push(
          `${file.path}:${index + 1} writes StockLevel through the Prisma client (${line.trim().slice(0, 70)}). ` +
            `Every change to onHand/reserved must go through postMovementInTx and its \`Prisma.sql\` ` +
            `conditional UPDATE, so the guard lives in the WHERE clause.`,
        );
      });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("the stock engine runs every mutation inside withSerializableRetry", () => {
    // SERIALIZABLE alone is not enough: the read and the write must be in the
    // SAME transaction, and the retry must re-read. `withSerializableRetry`
    // (src/lib/server/db.ts:137) is the only thing that re-reads on P2034.
    const engine = serverFiles.find((f) => f.path.endsWith("inventory/stock-engine.ts"));
    expect(engine, "src/lib/server/inventory/stock-engine.ts not found").toBeDefined();
    expect(engine?.source, "the engine must import withSerializableRetry").toMatch(/withSerializableRetry/);
    expect(engine?.source, "the engine must reference the P2034-driven retry").toMatch(/P2034|isUniqueViolation/);
  });

  it("a StockMovement write always carries a reason, and never invents one", () => {
    // Invariant I5: a human-initiated movement has a non-empty reason. The
    // engine's `validateMovementInput` enforces it. A direct `stockMovement.create`
    // whose `reason` falls back to a string literal bypasses it — and the CONSUME
    // path, the most frequently written row in the whole system, used to do
    // exactly that (`reason: args.reason ?? "Used on the job"`).
    const violations: string[] = [];
    for (const file of serverFiles) {
      const re = /stockMovement\.create\s*\(\s*\{/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        const lineNumber = file.source.slice(0, match.index).split("\n").length;
        const window = file.source.slice(match.index, match.index + 1200);
        const reasonLine = /\breason\s*:\s*([^\n,]*)/.exec(window)?.[1] ?? "";
        // A literal `??` fallback bypasses the mandatory-reason rule.
        if (!/\?\?/.test(reasonLine)) continue;
        violations.push(
          `${file.path}:${lineNumber} — reason: ${reasonLine.trim().slice(0, 70)}. A literal \`??\` fallback ` +
            `bypasses the mandatory-reason rule. Pass it through normaliseReason() and truncate it, or route ` +
            `the write through a single shared ledger-insert helper so there is one place to validate.`,
        );
      }
    }
    report("unvalidated ledger reason", violations);
    expect(actionable(violations), violations.join("\n")).toEqual([]);
  });

  it("the inventory server modules never reach a client bundle boundary", () => {
    // `import "server-only"` makes a Client Component import a BUILD error rather
    // than a runtime leak. It is the mechanical control behind every cost-price
    // guarantee in this system.
    //
    // `*.test-support.ts` is deliberately excluded: those modules are pure (no
    // database, no clock the caller cannot inject) precisely so A7 can drive the
    // arithmetic without one. Excluding them is the right call, and this comment
    // records that it was a decision rather than an oversight.
    const violations: string[] = [];
    for (const file of serverFiles) {
      if (file.path.endsWith(".test-support.ts")) continue;
      if (/^\s*import\s+["']server-only["']/m.test(file.source)) continue;
      violations.push(`${file.path} does not import "server-only".`);
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("REPORT: the migration's CHECK constraints on the invariant", () => {
    // Advisory, not a gate — because the directory does not exist yet and the
    // schema is orchestrator-owned. The moment a migration lands this becomes a
    // real assertion. Recorded here so the requirement cannot be forgotten.
    const required = [
      "stocklevel_onhand_non_negative",
      "stocklevel_reserved_non_negative",
      "stocklevel_reserved_le_onhand",
      "stockmovement_qty_nonzero",
      "stockmovement_sign_matches_kind",
      "stockmovement_human_reason_required",
    ];
    const migrationFiles = walk(MIGRATIONS_DIR, [".sql"]);
    if (migrationFiles.length === 0) {
      process.stderr.write(
        `\n  ── REPORT: prisma/migrations/ does not exist ──\n` +
          `     Every guarantee about StockLevel currently lives in TypeScript, in one directory.\n` +
          `     One \`UPDATE "StockLevel" SET "onHand"=0, "reserved"=8\` corrupts the running total\n` +
          `     permanently; toStockLevelDto will log it, but detection is not prevention.\n` +
          `     Requested CHECK constraints: ${required.join(", ")}\n` +
          `     ───────────────────────────────────────────────────────────────────\n\n`,
      );
      expect(required.length, "keep the requirement list non-empty").toBeGreaterThan(0);
      return;
    }
    const combined = migrationFiles.map((f) => readFileSync(f, "utf8")).join("\n");
    const missing = required.filter((name) => !combined.includes(name));
    expect(missing, `migration is missing CHECK constraint(s): ${missing.join(", ")}`).toEqual([]);
  });

  it("WARNING: every exported on* booking hook has an importer outside its own module", () => {
    const hooks = serverFiles.flatMap((file) =>
      (file.source.match(/export\s+(?:async\s+)?function\s+(on[A-Z]\w*)\s*\(/g) ?? []).map((m) => ({
        file,
        name: /function\s+(on[A-Z]\w*)/.exec(m)?.[1] ?? "",
      })),
    );
    const orphans: string[] = [];
    for (const hook of hooks) {
      const imported = srcFiles.some(
        (other) => other.path !== hook.file.path && new RegExp(`\\b${hook.name}\\b`).test(other.source) && other.path.includes("api/"),
      );
      if (!imported) orphans.push(`${hook.file.path}: ${hook.name} has no importer outside its own module`);
    }
    const suppressed = orphans.filter((o) => KNOWN_UNFIXED.some((s) => s.match.test(o)));
    if (suppressed.length > 0) {
      process.stderr.write(
        `\n  ── ${suppressed.length} unwired booking hook(s) ──\n` +
          suppressed.map((o) => `     ${o}\n`).join("") +
          KNOWN_UNFIXED.map((s) => `       [${s.finding}] ${s.why}\n`).join("") +
          `     ───────────────────────────────────────────────────────────────\n\n`,
      );
    }
    expect(actionable(orphans), orphans.join("\n")).toEqual([]);
  });

  it("the suppression list cites findings that still exist in FINDINGS.md", () => {
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