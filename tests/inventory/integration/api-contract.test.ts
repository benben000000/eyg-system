// @vitest-environment node
/**
 * A7 · CI/CD & QA — the HTTP contract for `/api/inventory/**`.
 * ============================================================================
 * WHAT AN INVENTORY ROUTE MUST BE, EVERY TIME
 * --------------------------------------------
 *   • Every route but ONE goes through `withAdmin(...)`. The one exception is a
 *     read-only availability endpoint, which is rate-limited and returns no cost
 *     data — and its absence of a session must be a decision in the code, visible
 *     in a test, rather than an accident.
 *   • Writes carry CSRF and a role floor. `FRONT_DESK` reads the board; it does
 *     not adjust stock and it does not post a count.
 *   • Errors use the shared `ApiResult` envelope with an `API_ERROR_CODES` code.
 *   • No response is cacheable: staff payloads carry what the shop paid.
 *
 * WHY THIS FILE CHECKS SOURCE AS WELL AS BEHAVIOUR
 * -------------------------------------------------
 * A behavioural test needs a route module to exist. Until A2 lands there is
 * nothing to call, so this file ALSO resolves `src/app/api/inventory/**` and
 * asserts, per file, that the guard is present in the source. That turns "every
 * inventory route goes through `withAdmin`" from a review instruction into a red
 * build, and it starts working the moment the first route file appears — with no
 * edit to this test.
 *
 * A CROSS-AGENT BLOCKER, RECORDED HERE
 * ------------------------------------
 * The brief asks for `rateLimit` tiers `inventory.read`, `inventory.write` and
 * `inventory.count`. `RateLimitTierName` in `src/lib/ratelimit.ts` is a closed
 * union of `public | booking | quote | login | read` and `RATE_LIMIT_POLICIES` is
 * `Object.freeze`d. Neither file is A2's. Until a tier is added there, an
 * inventory route must either reuse `readLimiter` / `publicLimiter` or ship
 * unthrottled — and an unthrottled write endpoint is a free stock-manipulation
 * oracle. That is a request for the orchestrator, not a test failure, and it is
 * registered as `it.todo` so it cannot be forgotten.
 * ============================================================================
 */

import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { API_ERROR_CODES } from "@/lib/types";

import { describeAwaiting, readRepoFile, resolveInventoryModule, capability } from "../support/module-resolver";
import { SRC_DIR } from "../support/module-resolver";

const API_ROOT = join(SRC_DIR, "app", "api", "inventory");
const REPO_ROOT = join(SRC_DIR, "..");

/** Every `route.ts` under `src/app/api/inventory/**`, repo-root relative. */
function inventoryRouteFiles(): string[] {
  if (!existsSync(API_ROOT)) return [];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") {
        found.push(relative(REPO_ROOT, full).split(sep).join("/"));
      }
    }
  };
  walk(API_ROOT);
  return found.sort();
}

/**
 * Routes that are allowed to answer without a staff session. There is exactly
 * one of them, and it is a read.
 */
const PUBLIC_ROUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  "src/app/api/inventory/availability/route.ts",
]);

const ROUTE_FILES = inventoryRouteFiles();

// ─────────────────────────────────────────────────────────────────────────────
// Runs today
// ─────────────────────────────────────────────────────────────────────────────

describe("api/inventory — the envelope and the error vocabulary", () => {
  it("every failure uses a code from the shared, closed list", () => {
    // An inventory route inventing its own error code means a client cannot
    // branch on it, and the shared `withApi` error handler will not recognise it.
    expect([...API_ERROR_CODES]).toEqual([
      "VALIDATION_ERROR",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "RATE_LIMITED",
      "CAPTCHA_FAILED",
      "SPAM_REJECTED",
      "SLOT_UNAVAILABLE",
      "SERVICE_UNAVAILABLE",
      "MAINTENANCE",
      "INTERNAL_ERROR",
    ]);
    // A refusal is a CONFLICT, not a 500: the client is meant to show "3 left".
    expect(API_ERROR_CODES).toContain("CONFLICT");
    expect(API_ERROR_CODES).toContain("FORBIDDEN");
  });

  it("`withAdmin` is the only door to a staff inventory route, and it demands a role", () => {
    const guard = readRepoFile("src/lib/server/admin-guard.ts");
    expect(guard).toContain("export function withAdmin<T>(");
    expect(guard).toContain("minimum: Role,");
    expect(guard).toContain("const user = await requireRole(minimum);");
    // CSRF on writes is not optional-by-default; the default IS on.
    expect(guard).toContain("const needsCsrf = options.csrf ?? true;");
    // Staff payloads carry customer PII and margin: never cached.
    expect(guard).toContain("...(result.cacheControl ? { cacheControl: result.cacheControl } : { private: true }),");
  });

  it("the inventory rate-limit tiers live in the SHARED limiter, next to every other budget", () => {
    // HISTORY. These tiers did not exist: `RateLimitTierName` was a closed union
    // of `public | booking | quote | login | read`, and the inventory routes
    // therefore carried their budgets as frozen objects declared inside
    // `src/lib/server/inventory/stock-engine.ts`. That worked, but it put three
    // budgets somewhere nobody would find while tuning the other four.
    //
    // They are namespaced with a dot — `rl:inventory.write:…` sorts apart from
    // customer traffic in Redis and in the logs — which is the right call for a
    // shop where one mis-set budget would lock the counter out of its own stock.
    const ratelimit = readRepoFile("src/lib/ratelimit.ts");
    for (const tier of ["inventory.read", "inventory.write", "inventory.count"]) {
      expect(ratelimit, `the ${tier} tier is missing from the shared limiter`).toContain(`"${tier}"`);
    }
    expect(
      ratelimit,
      "a budget the owner cannot find is a budget the owner will not raise",
    ).toMatch(/RATE_LIMIT_POLICIES: Record<RateLimitTierName, RateLimitPolicy> = Object\.freeze\(\{/);

    // Every inventory route must actually use them, not declare its own.
    const engine = readRepoFile("src/lib/server/inventory/stock-engine.ts");
    for (const name of ["inventoryReadLimiter", "inventoryWriteLimiter", "inventoryCountLimiter"]) {
      expect(engine, `${name} is missing from stock-engine.ts`).toContain(name);
    }
  });

  it("the public availability endpoint is the ONLY route without a guard, and it is a read", () => {
    // A2's routes now exist, so this stops being hypothetical: exactly one of them
    // answers without a session, and it is the one the brief allows.
    expect(ROUTE_FILES.length, "no inventory routes exist yet — this gate is dormant").toBeGreaterThan(0);

    const unguarded = ROUTE_FILES.filter((file) => !/withAdmin(Read)?\s*[<(]/.test(readRepoFile(file)));
    expect(
      unguarded,
      "every inventory route except the public availability read must go through withAdmin",
    ).toEqual(["src/app/api/inventory/availability/route.ts"]);

    // It is a GET and nothing else. A POST reaching the same handler would be a
    // stock write with no session and no role floor.
    const availability = readRepoFile("src/app/api/inventory/availability/route.ts");
    expect(availability).toMatch(/export (?:const|async function) GET\b/);
    expect(availability, "the public read must not export a mutating verb").not.toMatch(
      /export (?:const|async function) (POST|PUT|PATCH|DELETE)\b/,
    );
    expect(availability, "and it must be rate-limited").toContain("rateLimit");
    expect(availability, "and it must be uncacheable — it is force-dynamic for a reason").toContain(
      'export const revalidate = 0;',
    );
  });

  it("every WRITE verb is behind withAdmin with a role floor and CSRF on", () => {
    // `withAdminRead` is `withAdmin("FRONT_DESK", handler, { csrf: false })`. Using
    // it on a POST would hand the shop's single stock write to any counter
    // account with no CSRF token — so this is checked per verb, not per file.
    const offenders: string[] = [];
    for (const file of ROUTE_FILES) {
      if (PUBLIC_ROUTE_ALLOWLIST.has(file)) continue;
      const source = readRepoFile(file);
      for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
        const declaration = new RegExp(`export const ${verb}\\s*=\\s*([A-Za-z]+)`, "g");
        for (const match of source.matchAll(declaration)) {
          const factory = match[1] ?? "";
          if (factory !== "withAdmin") {
            offenders.push(`${file} ${verb} uses ${factory} instead of withAdmin`);
            continue;
          }
          // `withAdmin<Dto>("MANAGER", …)` — the generic parameter sits between the
          // factory name and the role floor.
          const floor = new RegExp(`export const ${verb}\\s*=\\s*withAdmin(?:<[^>]*>)?\\(\\s*"([A-Z_]+)"`).exec(source);
          if (!floor?.[1]) offenders.push(`${file} ${verb} has no role floor`);
          else if (floor[1] === "FRONT_DESK") offenders.push(`${file} ${verb} is writable by FRONT_DESK`);
        }
      }
    }
    expect(offenders, "a stock write must be behind a MANAGER floor with CSRF on").toEqual([]);
  });

  it("the ageing read is the only other unguarded-by-role route, and it is still a session", () => {
    // `withAdminRead` is a session, not anonymity — asserted in authz.test.ts.
    const readRoutes = ROUTE_FILES.filter((file) => /withAdminRead\s*</.test(readRepoFile(file)));
    expect(readRoutes.length, "no read routes found; the routes changed").toBeGreaterThan(0);
    for (const file of readRoutes) {
      expect(readRepoFile(file), `${file} is a read route with a mutating verb`).not.toMatch(
        /export const (POST|PUT|PATCH|DELETE)\s*=\s*withAdminRead/,
      );
    }
  });

  it("no route file selects costPrice into a client-facing shape", () => {
    // `costPrice` may be READ inside a staff route; what must never appear is an
    // unfiltered `select` that would put it in the shape sent to the client.
    const offenders: string[] = [];
    for (const file of ROUTE_FILES) {
      const source = readRepoFile(file);
      if (/select:\s*\{[^}]*\bcostPrice\b/.test(source)) offenders.push(file);
    }
    expect(offenders, "a route selects costPrice, which puts it on the wire").toEqual([]);
  });

  it("every inventory route declares a cache policy that keeps staff payloads private", () => {
    // `withAdmin` sets `private: true` by default, so the risk is a route that
    // overrides it with something a shared cache would keep.
    const offenders = ROUTE_FILES.filter((file) =>
      /cacheControl:\s*"public/.test(readRepoFile(file)),
    );
    expect(offenders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The gate that turns on when A2's routes exist
// ─────────────────────────────────────────────────────────────────────────────

describe("api/inventory — the gate that arms itself", () => {
  it("the rate-limit tier gap is recorded and named", () => {
    // The routes exist and are all limited; the only outstanding item is WHERE the
    // budget is defined. This test exists so the gap has a name in the report.
    expect(ROUTE_FILES.length).toBeGreaterThan(0);
    const limited = ROUTE_FILES.filter((file) => /rateLimit\(/.test(readRepoFile(file)));
    expect(
      ROUTE_FILES.filter((file) => !limited.includes(file)),
      "an inventory route with no rate limit is a free stock-manipulation oracle",
    ).toEqual([]);
  });

  it.todo(
    "PER-ROUTE HTTP CONTRACT. For every file under `src/app/api/inventory/**`, assert: " +
      "(a) an unauthenticated call is 401 with `error.code === \"UNAUTHENTICATED\"`; " +
      "(b) a `FRONT_DESK` call to a write is 403 with `FORBIDDEN`; " +
      "(c) a write without the CSRF header is 403; " +
      "(d) a success is `ApiResult` — `{ ok: true, data, meta: { requestId } }` — with " +
      "`cache-control: private, no-store`; " +
      "(e) a refusal is 409 `CONFLICT` with the `MovementRefusalReason` and the true `available`; " +
      "(f) no 5xx body contains a stack, a Prisma class name or a connection string. " +
      "Awaits: route modules under `src/app/api/inventory/**` (owned by A2).",
  );

  it.todo(
    "VALIDATION. `POST /api/inventory/movement` must 400 on a missing `productId`, an unknown " +
      "`kind`, a non-integer or non-positive `qty`, and a blank `reason` — each with a non-empty " +
      "`error.fields` map naming the offending key. Unknown keys must be rejected under `_root` " +
      "rather than ignored, so a typo in `idempotencyKey` is not silently accepted. " +
      "Awaits: `src/app/api/inventory/movement/route.ts` (owned by A2).",
  );

  it.todo(
    "RATE LIMITING. `POST /api/inventory/movement` must be throttled. Prove it by exceeding the " +
      "budget in a loop and asserting a 429 with `retryAfter` in `meta` and a `RateLimit-Limit` " +
      "header. Until `RateLimitTierName` gains an `inventory.*` tier, the route must reuse " +
      "`publicLimiter` for writes and `readLimiter` for reads. " +
      "Awaits: `inventory.*` in `src/lib/ratelimit.ts` (ORCHESTRATOR — see `docs/inventory-qa/RELEASE-CHECKLIST.md` §G).",
  );

  it.todo(
    "CRON SWEEPS. `POST /api/cron/inventory-expiry` and `POST /api/cron/inventory-reorder` must " +
      "reject a request without the cron secret with 401, must be idempotent when run twice, and " +
      "must return counts the owner can read (`{ expired: n }`, `{ stockouts: n }`). " +
      "Awaits: `src/app/api/cron/*expiry*` and `*reorder*` (owned by A2).",
  );
});

describeAwaiting(
  await resolveInventoryModule(
    [
      "@/lib/server/inventory/stock-engine",
      "@/lib/server/inventory/engine",
      "@/lib/server/inventory/index",
      "@/lib/server/inventory",
    ],
    [capability("postMovement", ["postStockMovement", "move"], () => true)],
  ),
  "api/inventory — AWAITING the real inventory service layer",
);
