// @vitest-environment node
/**
 * A8 · SECURITY GATE 1 — inventory route authorisation
 * ============================================================================
 * OWASP: A01 Broken Access Control · A05 Security Misconfiguration ·
 *        A07 Identification & Auth Failures · A03 Injection
 *
 * Enforces, against every route under `src/app/api/inventory/**`:
 *
 *  1. Every route handler is wrapped in `withAdmin` or `withAdminRead`.
 *     One route per file may be public, and only by being declared in
 *     `PUBLIC_READ_ROUTES` below. Anything else is a breach waiting to happen,
 *     because `/api/inventory` matches no entry in `ADMIN_PREFIXES` and the
 *     middleware's staff guard never fires for it (H-07).
 *  2. A mutating verb (POST/PUT/PATCH/DELETE) uses `withAdmin(`, never
 *     `withAdminRead(`. `withAdminRead` is `{ csrf: false }` — using it on a
 *     write removes the double-submit token check.
 *  3. A `GET` uses `withAdminRead(`, never `withAdmin(`. `withAdmin` demands an
 *     `x-csrf-token` header, which a browser cannot attach to a plain
 *     navigation. Two routes currently get this wrong (H-05).
 *  4. No mutating route references `readLimiter`. `read` is
 *     `onInfraError: "open"`, so a stock write behind it is unbounded whenever
 *     the rate-limit store is unreachable.
 *  5. A route that can post more than one movement kind contains a
 *     `roleAtLeast(` gate. A single `withAdmin("MANAGER")` on the whole
 *     movement route means a technician cannot record that they used a filter
 *     (H-01), which is worse than it sounds: the ledger rots and the shop
 *     abandons the system.
 *  6. Raw SQL in the inventory tree is `Prisma.sql`-tagged. `$executeRawUnsafe`
 *     and `$queryRawUnsafe` fail the site scanner, and the guard that makes the
 *     invariant safe depends on raw SQL — so the two must be reconciled without
 *     weakening either (H-16).
 *
 * Dependency-light on purpose: `node:fs` + `node:path` + regular expressions,
 * in the spirit of `tests/security/owasp-lite-scan.mjs`. A security scanner
 * that cannot run in a bare CI container is a scanner nobody runs.
 *
 * The `describe` title reports how many route files were inspected, so a green
 * run cannot be mistaken for coverage.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const API_DIR = join(ROOT, "src", "app", "api", "inventory");
const SERVER_DIR = join(ROOT, "src", "lib", "server", "inventory");

const SOURCE_EXT = [".ts", ".tsx"];

/**
 * The ONLY inventory routes permitted to answer without a staff session. Each
 * one must justify itself in its file header. Adding a route here is a security
 * decision, so the list is deliberately short and explicit.
 */
const PUBLIC_READ_ROUTES = ["availability"];

const MUTATING_VERBS = ["POST", "PUT", "PATCH", "DELETE"];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) walk(path, out);
    else if (entry === "route.ts") out.push(path);
  }
  return out;
}

interface RouteFile {
  /** Path relative to the repo root, POSIX separators. */
  path: string;
  /** The route's public identity, e.g. "counts/[id]/post". */
  route: string;
  source: string;
}

function toRouteId(abs: string): string {
  const rel = relative(API_DIR, abs).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  return rel;
}

function loadRoutes(): RouteFile[] {
  return walk(API_DIR)
    .map((abs) => ({
      path: relative(ROOT, abs).replace(/\\/g, "/"),
      route: toRouteId(abs),
      source: readFileSync(abs, "utf8"),
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

/** `export const POST = …`, `export async function GET() {}`, `export function GET() {}`. */
function handlersFor(source: string): Array<{ verb: string; body: string; index: number }> {
  const found: Array<{ verb: string; body: string; index: number }> = [];
  const re = /export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    // Slice to the next handler (or 1200 chars) so a guard on one verb is not
    // credited to another.
    const next = source
      .slice(match.index + 1)
      .search(/export\s+(?:const|async\s+function|function)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/);
    const end = next === -1 ? Math.min(source.length, match.index + 1400) : match.index + 1 + next;
    found.push({ verb: match[1] as string, body: source.slice(match.index, end), index: match.index });
  }
  return found;
}

/**
 * Real findings in files owned by another agent, carried as suppressions rather
 * than as a red build. Same mechanism and same discipline as the SUPPRESSIONS
 * list in `tests/security/owasp-lite-scan.mjs`: **a suppression is a claim** —
 * each entry must name the finding that justifies it, and `every suppression
 * cites a live finding` below fails if one points at something that has been
 * fixed and the entry was left behind.
 *
 * Delete an entry the moment the fix lands. A suppression nobody deletes is a
 * vulnerability nobody fixed.
 */
const KNOWN_UNFIXED: Array<{ match: RegExp; finding: string; why: string }> = [
  {
    match: /reports\/(reorder|valuation)\/route\.ts:GET uses withAdmin/,
    finding: "FINDINGS H-05",
    why:
      "Two inventory READ routes use `withAdmin(\"MANAGER\")` instead of `withAdminRead`. `withAdmin` " +
      "defaults to `{ csrf: true }`, so these GETs require an `x-csrf-token` header a browser will not " +
      "attach to a navigation or a bare `fetch` — the reorder and valuation screens 403 for a legitimate " +
      "staff member. Not exploitable (it is stricter, not weaker), but the endpoint is unusable as " +
      "written. Owner: A2. One-word fix in each file.",
  },
];

const routes = loadRoutes();
const inspected = routes.length;

describe(`inventory route authorisation (${inspected} route file(s) on disk)`, () => {
  it("finds the inventory API surface, so this gate is actually armed", () => {
    // A gate that silently inspects nothing is worse than no gate: it reports
    // green and protects nothing. If the tree is empty something is wrong with
    // the scan, not with the code.
    expect(inspected, "No files found under src/app/api/inventory — the gate is not inspecting anything").toBeGreaterThan(0);
  });

  it("every inventory route is behind withAdmin or withAdminRead, unless it is a declared public read", () => {
    const violations: string[] = [];
    for (const route of routes) {
      const handlers = handlersFor(route.source);
      if (handlers.length === 0) {
        violations.push(`${route.path}: no exported HTTP handler found (an empty route.ts is not a control)`);
        continue;
      }
      for (const handler of handlers) {
        const guarded = /withAdmin(Read)?\s*[<(]/.test(handler.body);
        const isDeclaredPublic = PUBLIC_READ_ROUTES.includes(route.route) && handler.verb === "GET";
        if (guarded || isDeclaredPublic) continue;
        violations.push(
          `${route.path}:${handler.verb} is not wrapped in withAdmin/withAdminRead. ` +
            `ADMIN_PREFIXES does not cover /api/inventory, so the middleware staff guard never runs for this ` +
            `path — withAdmin in the handler is the ONLY control. Either add the guard or add the route to ` +
            `PUBLIC_READ_ROUTES in this file with a justification in its header.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("no public-read route is declared that does not exist", () => {
    // Guards against a stale allowlist quietly granting nothing, or a typo
    // silently widening it later.
    const routeIds = new Set(routes.map((r) => r.route));
    const stale = PUBLIC_READ_ROUTES.filter((id) => !routeIds.has(id));
    expect(stale, `PUBLIC_READ_ROUTES names route(s) that do not exist: ${stale.join(", ")}`).toEqual([]);
  });

  it("a mutating verb uses withAdmin (CSRF enforced), never withAdminRead", () => {
    const violations: string[] = [];
    for (const route of routes) {
      for (const handler of handlersFor(route.source)) {
        if (!MUTATING_VERBS.includes(handler.verb)) continue;
        if (/withAdminRead\s*[(<]/.test(handler.body) && !/withAdmin\s*[(<]/.test(handler.body)) {
          violations.push(
            `${route.path}:${handler.verb} uses withAdminRead, which is \`{ csrf: false }\`. ` +
              `A state-changing request must go through withAdmin so requireCsrf() demands the ` +
              `double-submit token bound to the live session.`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("a GET uses withAdminRead, never withAdmin — a browser cannot attach a CSRF header to a navigation", () => {
    const violations: string[] = [];
    for (const route of routes) {
      for (const handler of handlersFor(route.source)) {
        if (handler.verb !== "GET") continue;
        if (!/withAdmin\s*\(/.test(handler.body)) continue;
        violations.push(
          `${route.path}:GET uses withAdmin(\`…\`), which defaults to \`{ csrf: true }\` and therefore ` +
            `requires an \`x-csrf-token\` request header. A plain browser navigation and a bare \`fetch\` ` +
            `cannot send one, so the endpoint answers 403 to a legitimate staff member. Use withAdminRead.`,
        );
      }
    }
    const suppressed = violations.filter((v) => KNOWN_UNFIXED.some((s) => s.match.test(v)));
    const actionable = violations.filter((v) => !KNOWN_UNFIXED.some((s) => s.match.test(v)));
    if (suppressed.length > 0) {
      // Printed, never silent — same discipline as owasp-lite-scan's SUPPRESSIONS.
      process.stderr.write(
        `\n  ── ${suppressed.length} suppressed GET-guard finding(s), each citing a live finding ──\n` +
          suppressed.map((v) => `     ${v}\n`).join("") +
          KNOWN_UNFIXED.map((s) => `       [${s.finding}] ${s.why}\n`).join("") +
          `     ─────────────────────────────────────────────────────────────────────\n\n`,
      );
    }
    expect(actionable, actionable.join("\n")).toEqual([]);
  });

  it("every suppression cites a finding that still appears in FINDINGS.md", () => {
    // A suppression that points at nothing is a hole with paperwork. This reads
    // the report so a fixed-and-forgotten entry cannot linger silently.
    let report = "";
    try {
      report = readFileSync(join(ROOT, "docs", "inventory-security", "FINDINGS.md"), "utf8");
    } catch {
      report = "";
    }
    for (const suppression of KNOWN_UNFIXED) {
      const id = suppression.finding.replace("FINDINGS ", "").trim();
      expect(report, `Suppression "${suppression.finding}" no longer appears in docs/inventory-security/FINDINGS.md — delete the entry`).toContain(
        id,
      );
    }
  });

  it("no inventory mutation is rate-limited on a fail-OPEN tier", () => {
    // `read` is `onInfraError: "open"` by design (src/lib/ratelimit.ts:90-96):
    // availability must survive Redis being down. A stock WRITE behind that tier
    // is unbounded for exactly as long as the outage, which is when nobody wants
    // someone posting 240 adjustments a minute.
    const violations: string[] = [];
    for (const route of routes) {
      for (const handler of handlersFor(route.source)) {
        if (!MUTATING_VERBS.includes(handler.verb)) continue;
        const usesReadLimiter = /\breadLimiter\b/.test(handler.body);
        const declaresFailClosed = /onInfraError:\s*["']closed["']/.test(route.source);
        if (usesReadLimiter && !declaresFailClosed) {
          violations.push(
            `${route.path}:${handler.verb} rate-limits with the \`read\` tier (fail-OPEN). ` +
              `Use inventoryWriteLimiter / inventoryCountLimiter, both \`onInfraError: "closed"\`.`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every inventory route declares a rate-limit tier", () => {
    // An unrated route is an unmetered route. The limiter is not the capacity
    // control, but it is what blunts a script, and it costs one line.
    const violations: string[] = [];
    for (const route of routes) {
      for (const handler of handlersFor(route.source)) {
        if (!/rateLimit\s*\(/.test(handler.body)) {
          violations.push(`${route.path}:${handler.verb} calls no rateLimit({ … }). Every route needs a tier.`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("a route handling more than one movement kind contains a per-kind roleAtLeast gate", () => {
    // One threshold for every kind is wrong at both ends: FRONT_DESK lets the
    // rank-1 front-desk account SHRINK the owner's stock, and MANAGER stops a
    // technician recording that they used a filter. Copy the pattern from
    // src/app/api/admin/bookings/[id]/status/route.ts, which gates its
    // destructive states with roleAtLeast inside a FRONT_DESK route.
    const KIND_WORDS = /"?(CONSUME|RESERVE|RELEASE|ADJUST_UP|ADJUST_DOWN|SHRINK|OPENING|TRANSFER_IN|TRANSFER_OUT|RETURN_TO_SUPPLIER)"?/;
    const DESTRUCTIVE = /"?(ADJUST_UP|ADJUST_DOWN|SHRINK|OPENING|RETURN_TO_SUPPLIER)"?/;
    const violations: string[] = [];
    for (const route of routes) {
      for (const handler of handlersFor(route.source)) {
        if (!MUTATING_VERBS.includes(handler.verb)) continue;
        const kinds = new Set(handler.body.match(new RegExp(KIND_WORDS, "g")) ?? []);
        const destructive = new Set(handler.body.match(new RegExp(DESTRUCTIVE, "g")) ?? []);
        if (destructive.size === 0) continue; // not a movement route
        if (kinds.size < 2) continue; // single-kind route: the threshold is unambiguous
        if (!/roleAtLeast\s*\(/.test(route.source)) {
          violations.push(
            `${route.path}:${handler.verb} handles ${kinds.size} movement kinds ` +
              `(${[...destructive].join(", ")}) behind a single withAdmin threshold. Split it: the routine ` +
              `kinds at FRONT_DESK, the destructive ones behind an in-handler \`roleAtLeast(…, "MANAGER")\`.`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("raw SQL in the inventory tree is Prisma.sql-tagged, never $queryRawUnsafe", () => {
    // The conditional write that makes the invariant safe CANNOT be expressed in
    // Prisma's query builder, so it must be raw. `Prisma.sql` binds its
    // interpolations as parameters, so it is safe and it passes the site
    // scanner's `raw-sql` rule. `$executeRawUnsafe`/`$queryRawUnsafe` do not.
    // The scanner must not be weakened to accommodate either — that is the
    // whole point of the rule.
    const files = [...walk(SERVER_DIR).map((p) => ({ abs: p, kind: "server" })), ...routes.map((r) => ({ abs: join(ROOT, r.path), kind: "route" }))];
    const violations: string[] = [];
    for (const file of files) {
      if (!SOURCE_EXT.some((ext) => file.abs.endsWith(ext))) continue;
      const source = readFileSync(file.abs, "utf8");
      const lines = source.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!/\$(queryRawUnsafe|executeRawUnsafe)\s*\(/.test(line)) return;
        violations.push(
          `${relative(ROOT, file.abs).replace(/\\/g, "/")}:${index + 1} uses $queryRawUnsafe/$executeRawUnsafe. ` +
            `Use Prisma.sql tagged interpolation — the parameters are bound by the driver and the site ` +
            `scanner accepts it. Never loosen owasp-lite-scan to allow this.`,
        );
      });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every inventory route forces dynamic rendering, and a hand-rolled route pins no-store", () => {
    // `withAdmin`/`withAdminRead` already emit `Cache-Control: no-store` for
    // every response (admin-guard.ts:86 via http.ts:125), so a guarded route
    // needs nothing more. A route that is NOT wrapped in `withAdmin` — i.e. the
    // public availability read — gets no such default, so it must state
    // `no-store` itself. `withAdmin`'s no-store protects the RESPONSE; it does
    // nothing for a route segment's own caching, hence `force-dynamic`
    // everywhere.
    const violations: string[] = [];
    for (const route of routes) {
      if (!/export\s+const\s+dynamic\s*=\s*"force-dynamic"/.test(route.source)) {
        violations.push(`${route.path} does not declare \`export const dynamic = "force-dynamic"\`.`);
      }
      const guarded = /withAdmin(Read)?\s*[<(]/.test(route.source);
      if (guarded) continue;
      if (!/cacheControl:\s*"[^"]*no-store/.test(route.source) && !/export\s+const\s+revalidate\s*=\s*0/.test(route.source)) {
        violations.push(
          `${route.path} is not wrapped in withAdmin, so it does NOT inherit withAdmin's \`no-store\`. ` +
            `It must set \`cacheControl: "no-store, max-age=0"\` itself. A cached availability answer is a ` +
            `promise the shop cannot keep.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});