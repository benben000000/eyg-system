// @vitest-environment node
/**
 * A7 · CI/CD & QA — authorisation for the inventory surface.
 * ============================================================================
 * WHO MAY DO WHAT
 * ---------------
 * From `src/lib/server/admin-guard.ts`, which is the shared door every staff
 * route goes through:
 *
 *   FRONT_DESK — read the board, check a customer in, confirm a job
 *   MANAGER    — change the catalogue, close a bay, edit a promo
 *   OWNER      — anything, including staff accounts
 *
 * So the inventory floors follow:
 *
 *   read the catalogue / a stock level / the ledger   → FRONT_DESK (or higher)
 *   reserve for a booking, release on cancel          → FRONT_DESK (or higher)
 *   receive, consume, adjust, shrink, transfer        → MANAGER
 *   create / review / post a stock count              → MANAGER
 *   change a product's cost, create a staff account   → OWNER
 *
 * A `FRONT_DESK` account that can adjust stock can invent inventory. That is not
 * an insider-threat question: it is a shared till, a shoulder-surfed password and
 * an audit log that names the wrong person.
 *
 * WHAT RUNS TODAY
 * ---------------
 * `roleAtLeast` is real production code in `src/lib/server/auth.ts`, and it has a
 * property worth pinning: `TECHNICIAN` and `FRONT_DESK` both rank 1, so a
 * technician CAN do everything front desk can. That is correct and intentional —
 * and it means `roleAtLeast("TECHNICIAN", "FRONT_DESK") === true` while
 * `roleAtLeast("FRONT_DESK", "MANAGER") === false`. Both directions are asserted
 * here, because an authorisation suite that only checks the permissive direction
 * has proved nothing.
 *
 * WHAT WAITS ON A2: the per-route behaviour.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";

import { roleAtLeast, type Role } from "@/lib/server/auth";

import { describeAwaiting, readRepoFile } from "../support/module-resolver";

const ALL_ROLES: readonly Role[] = ["FRONT_DESK", "TECHNICIAN", "MANAGER", "OWNER"];

// ─────────────────────────────────────────────────────────────────────────────
// Runs today: the role ladder the inventory inherits
// ─────────────────────────────────────────────────────────────────────────────

describe("authz — the role ladder", () => {
  it("OWNER outranks MANAGER, who outranks the floor roles", () => {
    expect(roleAtLeast("OWNER", "MANAGER")).toBe(true);
    expect(roleAtLeast("MANAGER", "OWNER")).toBe(false);
    expect(roleAtLeast("MANAGER", "FRONT_DESK")).toBe(true);
    expect(roleAtLeast("FRONT_DESK", "MANAGER")).toBe(false);
  });

  it("TECHNICIAN and FRONT_DESK are peers — a technician can do everything the counter can", () => {
    // Deliberate and asserted in both directions. A future change that ranks
    // them differently changes what a mechanic can do on the shop's own stock,
    // and that has to be a decision someone remembers making.
    expect(roleAtLeast("TECHNICIAN", "FRONT_DESK")).toBe(true);
    expect(roleAtLeast("FRONT_DESK", "TECHNICIAN")).toBe(true);
    expect(roleAtLeast("TECHNICIAN", "MANAGER"), "a mechanic must not be able to adjust stock").toBe(false);
    expect(roleAtLeast("MANAGER", "TECHNICIAN")).toBe(true);
  });

  it("nobody outranks the owner", () => {
    for (const role of ALL_ROLES) {
      expect(roleAtLeast("OWNER", role), `OWNER must clear ${role}`).toBe(true);
    }
  });

  it("every role satisfies at least one of the four inventory floors", () => {
    const floors: ReadonlyArray<{ minimum: Role; what: string }> = [
      { minimum: "FRONT_DESK", what: "read the catalogue" },
      { minimum: "FRONT_DESK", what: "reserve / release parts" },
      { minimum: "MANAGER", what: "adjust or consume stock" },
      { minimum: "MANAGER", what: "post a stock count" },
      { minimum: "OWNER", what: "change a cost price" },
    ];
    for (const role of ALL_ROLES) {
      const reachable = floors.filter((floor) => roleAtLeast(role, floor.minimum)).map((floor) => floor.what);
      expect(reachable.length, `${role} can do nothing at all, which cannot be right`).toBeGreaterThan(0);
    }
  });

  it("exactly one role may change a cost price", () => {
    // Margin is survival on tyre money, and `costPrice` is the number a customer
    // must never learn and a disgruntled staff member must not be able to change.
    for (const role of ALL_ROLES) {
      expect(roleAtLeast(role, "OWNER"), `${role} may change a cost price`).toBe(role === "OWNER");
    }
  });

  it("a FRONT_DESK account must NOT be able to adjust stock or post a count", () => {
    // The specific claim the brief makes, asserted against real code.
    expect(roleAtLeast("FRONT_DESK", "MANAGER"), "FRONT_DESK must not clear the MANAGER floor").toBe(false);
    expect(roleAtLeast("FRONT_DESK", "MANAGER"), "so it must not post a count").toBe(false);
    expect(roleAtLeast("FRONT_DESK", "MANAGER"), "so it must not adjust stock").toBe(false);
    // …but it can reserve, because confirming a job is the counter's job.
    expect(roleAtLeast("FRONT_DESK", "FRONT_DESK")).toBe(true);
  });

  it("the ladder in the code matches the ladder the guard documents", () => {
    const auth = readRepoFile("src/lib/server/auth.ts");
    expect(auth).toContain('export type Role = "OWNER" | "MANAGER" | "TECHNICIAN" | "FRONT_DESK";');
    expect(auth).toMatch(/const ROLE_RANK: Record<Role, number> = \{[\s\S]*?\n\};/);

    const guard = readRepoFile("src/lib/server/admin-guard.ts");
    // The doc comment in admin-guard is the specification of record for the floors.
    expect(guard).toContain("FRONT_DESK` — read the board, check a customer in, confirm a job");
    expect(guard).toContain("MANAGER`    — change the catalogue, close a bay, edit a promo");
    expect(guard).toContain("OWNER`      — anything, including staff accounts");
  });

  it("`requireRole` throws for a missing session, so an unauthenticated caller never reaches a handler", async () => {
    // Proved against real code, with the session cookie absent. This is the
    // mechanism every inventory route inherits through `withAdmin`.
    const { requireRole } = await import("@/lib/server/auth");
    await expect(requireRole("FRONT_DESK")).rejects.toBeTruthy();
    await expect(requireRole("OWNER")).rejects.toBeTruthy();
  });

  it("a forged session cookie is rejected by the handler, not just by middleware", () => {
    // `admin-guard.ts` says so explicitly. The inventory routes inherit it, and
    // the claim is worth being unable to misread.
    const guard = readRepoFile("src/lib/server/admin-guard.ts");
    expect(guard).toMatch(
      /Middleware has already done the cheap checks[\s\S]*?this module does the authoritative ones\./,
    );
    expect(guard, "the authoritative check is the role, and it runs first").toContain(
      "1. `requireRole(minimum)` — a live session at or above the minimum role",
    );
  });

  it("the read-only guard still needs a session — `withAdminRead` is not anonymous", () => {
    const guard = readRepoFile("src/lib/server/admin-guard.ts");
    const readVariant = /export function withAdminRead[\s\S]*?\n\}/.exec(guard)?.[0] ?? "";
    expect(readVariant, "withAdminRead not found in admin-guard.ts").not.toBe("");
    // It delegates to withAdmin with FRONT_DESK, so a session is still required.
    // A future `withAdminRead` that dropped the guard would turn every read route
    // into a public one.
    expect(readVariant).toContain('return withAdmin("FRONT_DESK", handler, { csrf: false });');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing
// ─────────────────────────────────────────────────────────────────────────────

describeAwaiting(
  {
    ready: false,
    mod: null,
    specifier: null,
    missing: [
      "the 401 for every inventory route with no session",
      "the 403 for `FRONT_DESK` on a stock adjustment",
      "the 403 for `FRONT_DESK` on posting a stock count",
      "the 403 for `MANAGER` on changing a `costPrice`",
      "the 403 for a write with no CSRF token",
      "the isolation of a customer session from a staff session",
    ],
    notes: [],
  },
  "authz — AWAITING the real inventory routes",
);

describe("authz — the per-route assertions that will run when the routes land", () => {
  it.todo(
    "For EVERY file under `src/app/api/inventory/**`: an unauthenticated call is `401` with " +
      "`error.code === \"UNAUTHENTICATED\"`, and the body carries no catalogue data. This is " +
      "inherited from `withAdmin`, but it must be PROVED per route — a handler that calls " +
      "`prisma` before the guard is a handler that leaks. Awaits: A2's routes.",
  );

  it.todo(
    "`FRONT_DESK` may READ and may RESERVE/RELEASE for a booking, and must be refused on: " +
      "`POST /api/inventory/movement` with `kind` in {ADJUST_UP, ADJUST_DOWN, SHRINK, " +
      "TRANSFER_IN, TRANSFER_OUT, RETURN_TO_SUPPLIER}, on `POST /api/inventory/count/[id]/post`, " +
      "and on any `PATCH /api/inventory/products/[id]` that carries `costPrice` or `sellPrice`. " +
      "Each must be `403` `FORBIDDEN` with zero rows written. Awaits: A2's routes.",
  );

  it.todo(
    "`MANAGER` may adjust stock and post a count, and must be refused on any change to " +
      "`costPrice` — that is the `OWNER` floor. Awaits: A2's routes.",
  );

  it.todo(
    "A customer session is not a staff session. Using a `Customer` row's identifier where a staff " +
      "session is expected must be 401, not 200 — and the failure must not reveal whether the " +
      "catalogue exists. Awaits: A2's routes + the session resolver.",
  );

  it.todo(
    "Every write requires CSRF. `POST` / `PATCH` / `DELETE` with a valid staff session but no CSRF " +
      "header must be `403`, and must write nothing. The CSRF test is orthogonal to the role test: " +
      "a MANAGER with no token is still refused. Awaits: A2's routes.",
  );

  it.todo(
    "A staff read must not be cacheable by a shared cache: assert `cache-control` contains " +
      "`private` or `no-store` on every inventory response that is not the public availability read. " +
      "A cached cost field served to the next anonymous caller is a leak with a delay. " +
      "Awaits: A2's routes.",
  );

  it.todo(
    "One staff member must not be able to act as another: a movement posted with an " +
      "`actorId` that does not match the session must record the SESSION's user in " +
      "`StockMovement.actorName`, not the submitted one. A denormalised `actorName` that comes " +
      "from the request body is an audit log that can be written by anyone holding a session. " +
      "Awaits: A2's routes.",
  );

  it.todo(
    "Cross-tenant does not apply, but CROSS-BOOKING does: a staff member must not be able to " +
      "reserve parts for a booking that is not theirs without an explicit permission. Assert that " +
      "releasing another customer's reservation requires MANAGER and writes an `AuditLog` row. " +
      "Awaits: A2's routes + `writeAuditLog` usage.",
  );
});
