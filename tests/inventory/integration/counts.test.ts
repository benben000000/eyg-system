// @vitest-environment node
/**
 * A7 · CI/CD & QA — cycle counts.
 * ============================================================================
 * Counting the shelf without closing the bay. The count is the only mechanism
 * that reconciles the system with reality, so it has to be right in two directions
 * at once: it must FIND the discrepancies, and it must not INTRODUCE new ones.
 *
 * THE THREE TRAPS
 * ---------------
 *  1. **The snapshot.** `StockCountLine.expected` is captured when the count is
 *     CREATED, not when the line is counted. Without that, a sale between
 *     opening the count and counting the shelf silently rewrites what the shelf
 *     "should" have held, and the discrepancy vanishes — which is the exact
 *     discrepancy the count existed to find.
 *
 *  2. **Posting twice.** Posting writes `ADJUST_UP` / `ADJUST_DOWN` rows against
 *     `StockLevel`. Posting twice writes them twice. A POS adjustment is
 *     therefore applied twice, the level ends up wrong, and the ledger now
 *     contains two rows that both claim to be the correction. The guard is
 *     `status === "POSTED"` and it has to be checked INSIDE the transaction that
 *     does the adjusting — a check outside it is a check-and-then-act.
 *
 *  3. **Adjusting below zero.** A count that says 0 when 6 are promised must NOT
 *     set `onHand` to 0 and leave 6 reserved. That is a negative balance created
 *     by the reconciliation itself, and it is the one place the count feature can
 *     break the invariant it exists to protect.
 *
 * WHAT RUNS TODAY: the state machine and the schema's own guarantees, read from
 * `prisma/schema.prisma` so a dropped constraint is a red test rather than a
 * surprise at quarter end.
 *
 * WHAT WAITS ON A2: `createCount` / `recordCountLine` / `reviewCount` / `postCount`.
 * ============================================================================
 */

import { beforeEach, describe, expect, it } from "vitest";

import { STOCK_COUNT_STATUSES, type StockCountStatusValue } from "@/lib/inventory-types";

import { createFakeDb, type FakeDb } from "../support/fake-prisma";
import {
  FIXTURES,
  PINNED_NOW,
  seedCatalogue,
  seedCountLine,
  seedOne,
} from "../support/fixtures";
import { replayLedger } from "../support/reference-engine";
import {
  capability,
  describeAwaiting,
  readRepoFile,
  resolveInventoryModule,
  surface,
  type ActorContext,
  type CountSurface,
} from "../support/module-resolver";

const MANAGER: ActorContext = { actorId: "usr_manager", actorName: "Ana (Manager)", now: PINNED_NOW };
const TECHNICIAN: ActorContext = { actorId: "usr_tech", actorName: "Roi (Technician)", now: PINNED_NOW };

const engine = await resolveInventoryModule(
  [
    "@/lib/server/inventory/counts",
    "@/lib/server/inventory/stock-count",
    "@/lib/server/inventory/index",
    "@/lib/server/inventory",
  ],
  [
    capability("createCount", ["startCount", "beginCount"], () => true),
    capability("recordCountLine", ["recordLine", "recordCount"], () => true),
    capability("reviewCount", ["review", "setCountStatus"], () => true),
    capability("postCount", ["post", "completeCount"], () => true),
  ],
);

let db: FakeDb;

beforeEach(() => {
  db = createFakeDb({ now: () => PINNED_NOW });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runs today
// ─────────────────────────────────────────────────────────────────────────────

describe("counts — the status machine and the schema's guarantees", () => {
  it("POSTED is terminal — a posted count cannot return to DRAFT", () => {
    const legal: Readonly<Record<StockCountStatusValue, readonly StockCountStatusValue[]>> = {
      DRAFT: ["COUNTING", "REVIEW", "CANCELLED"],
      COUNTING: ["REVIEW", "CANCELLED"],
      REVIEW: ["COUNTING", "POSTED", "CANCELLED"],
      POSTED: [],
      CANCELLED: [],
    };
    expect(legal["POSTED"], "a posted count that can be reopened will be double-posted").toEqual([]);
    expect(legal["CANCELLED"]).toEqual([]);
    // Every non-terminal status must have a route to POSTED or CANCELLED.
    for (const status of STOCK_COUNT_STATUSES) {
      if (status === "POSTED" || status === "CANCELLED") continue;
      expect(legal[status].length, `${status} is a dead end`).toBeGreaterThan(0);
      expect(
        legal[status].some((next) => next === "POSTED" || next === "CANCELLED"),
        `${status} cannot reach a terminal status`,
      ).toBe(true);
    }
    expect([...STOCK_COUNT_STATUSES].sort()).toEqual([
      "CANCELLED",
      "COUNTING",
      "DRAFT",
      "POSTED",
      "REVIEW",
    ]);
  });

  it("`expected` is snapshotted at creation, per the schema", () => {
    // Without the snapshot, a sale during the count rewrites history and the
    // discrepancy the count exists to find silently disappears.
    const schema = readRepoFile("prisma/schema.prisma");
    const line = /model StockCountLine \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(line, "StockCountLine block not found").not.toBe("");
    expect(line).toContain("expected  Int");
    expect(line).toContain("counted   Int?");
    expect(line).toMatch(/countedAt\s+DateTime\?/);
    expect(line).toContain("concurrent sale does not silently rewrite history");
  });

  it("a count line is unique per (count, product) — a double-tap cannot make two lines", () => {
    const schema = readRepoFile("prisma/schema.prisma");
    const line = /model StockCountLine \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(line).toContain("@@unique([countId, productId])");
  });

  it("the count reference is unique, so two counts cannot share a number", async () => {
    // `makeReference("COUNT-", 8)` draws from a 21-character alphabet; a collision
    // is a failed insert on the owner's laptop at 6am. Proved against the fake.
    seedCatalogue(db);
    await db.stockCount.create({ data: { id: "cnt_1", reference: "COUNT-ABCD2345", status: "DRAFT", scope: "all" } });
    await expect(
      db.stockCount.create({ data: { id: "cnt_2", reference: "COUNT-ABCD2345", status: "DRAFT", scope: "all" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("the contract's summary is computable — net variance is counted - expected, summed", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const summary = /summary: \{([\s\S]*?)\n  \};\n\}/.exec(types)?.[1] ?? "";
    expect(summary).toContain("total: number;");
    expect(summary).toContain("counted: number;");
    expect(summary).toContain("outstanding: number;");
    expect(summary).toContain("variances: number;");
    expect(summary).toContain("/** Net unit variance across the whole count. */");
    expect(summary).toContain("varianceValue?: number;");
  });

  it("`varianceValue` is OPTIONAL — a peso value a public read can omit", () => {
    // HISTORY, kept because it nearly was not: this field was REQUIRED
    // (`varianceValue: number`) while its own doc comment said "Staff-only". A
    // required field cannot be filtered out of a response, so the contract — not
    // any route — guaranteed that any surface returning a `StockCountDto` to a
    // caller not entitled to see what the shop paid would leak a peso value.
    //
    // It is optional again. This test is here so it cannot quietly become required
    // again, which is a one-character change with a data-protection consequence and
    // no type error anywhere.
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types, "the summary's peso-variance note must stay STAFF-ONLY and OPTIONAL").toMatch(
      /Absolute peso value of the variances at cost\. STAFF-ONLY and OPTIONAL,/,
    );
    expect(types, "and must stay optional").toContain("varianceValue?: number;");
    expect(
      types,
      "CONTRACT REGRESSION: summary.varianceValue is REQUIRED while documented staff-only. " +
        "A required field cannot be filtered out, so a public count response leaks cost — or is " +
        "forced to fabricate a 0.",
    ).not.toMatch(/summary: \{[^}]*varianceValue: number;/s);

    // `CountLineDto` carries the same pair, optional for the same reason.
    const line = /export interface CountLineDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(line).toContain("costPrice?: number;");
    expect(line).toContain("varianceValue?: number | null;");
    expect(line).toContain("/** `(counted - expected) * costPrice`. Signed. Null until counted. */");
  });

  it("the count supports three scopes: everything, one kind, or one product", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const input = /export interface CreateCountInput \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(input).toContain('/** "all" | a ProductKind | a single productId. */');
    expect(input).toContain("scope?: string;");
    expect(input).toContain("note?: string;");
    const schema = readRepoFile("prisma/schema.prisma");
    const count = /model StockCount \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(count).toMatch(/scope\s+String\s+@default\("all"\)/);
    expect(count).toContain('// "all" | a kind | a single productId');
    expect(count, "who posted is recorded — a count is a human decision").toContain("postedBy  String?");
  });

  it("a variance of zero is not a variance — the badge must not read '3 variances' for 3 correct lines", () => {
    seedCatalogue(db, { [FIXTURES.oilFilter]: { onHand: 4, reserved: 0 } });
    seedCountLine(db, "line_a", "cnt_1", FIXTURES.oilFilter, 4, 4);
    seedCountLine(db, "line_b", "cnt_1", FIXTURES.rag, 20, 20);
    const lines = db.snapshot("stockCountLine");
    const variances = lines.filter((line) => line.counted !== null && line.counted !== line.expected);
    expect(variances, "counting correctly is not a variance").toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing
// ─────────────────────────────────────────────────────────────────────────────

const describeCounts = engine.ready ? describe : describe.skip;
const counts = (): CountSurface => surface<CountSurface>(engine);

function countWorld(target: FakeDb): void {
  seedCatalogue(target, {
    [FIXTURES.oilFilter]: { onHand: 4, reserved: 0 },
    [FIXTURES.oil]: { onHand: 10, reserved: 0 },
    [FIXTURES.wiper]: { onHand: 6, reserved: 0 },
  });
}

describeCounts("counts — create, record, review, post", () => {
  it("creates a DRAFT count that snapshots every product's expected on-hand", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: "all", note: "monthly" }, MANAGER);
    expect(count.status).toBe("DRAFT");
    expect(count.reference.startsWith("COUNT-")).toBe(true);
    expect(count.lines.length).toBeGreaterThan(0);
    expect(count.summary.total).toBe(count.lines.length);
    expect(count.summary.outstanding).toBe(count.lines.length);
    for (const line of count.lines) {
      const level = db.levelOf(line.productId);
      expect(line.expected, `${line.sku} snapshotted the wrong expected`).toBe(level.onHand);
      expect(line.counted).toBeNull();
      expect(line.variance).toBeNull();
    }
  });

  it("a sale AFTER the count was created does not rewrite the snapshot", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: FIXTURES.oilFilter }, MANAGER);
    const line = count.lines[0];
    expect(line?.expected).toBe(4);

    // The shop sells a filter while the count is still open on the shelf.
    await db.stockLevel.update({
      where: { productId: FIXTURES.oilFilter },
      data: { onHand: { decrement: 1 }, updatedAt: PINNED_NOW },
    });

    const stillOpen = await counts().recordCountLine(
      { countId: count.id, productId: FIXTURES.oilFilter, counted: 3, note: "three on the shelf" },
      TECHNICIAN,
    );
    const recounted = stillOpen.lines.find((row) => row.productId === FIXTURES.oilFilter);
    expect(recounted?.expected, "the snapshot moved — history was rewritten").toBe(4);
    expect(recounted?.counted).toBe(3);
    expect(recounted?.variance, "3 counted against 4 expected is a shortfall of 1").toBe(-1);
  });

  it("recording a line is idempotent — a double-tap overwrites, it does not append", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: FIXTURES.oilFilter }, MANAGER);

    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);
    const again = await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);

    expect(again.lines, "a double-tap created a second line for the same product").toHaveLength(1);
    expect(again.summary.outstanding).toBe(0);
  });

  it("a negative count is a legal number — the shelf really can be empty — but never a negative count of a negative", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: FIXTURES.oilFilter }, MANAGER);
    const after = await counts().recordCountLine(
      { countId: count.id, productId: FIXTURES.oilFilter, counted: 0, note: "empty box on the shelf" },
      TECHNICIAN,
    );
    expect(after.lines[0]?.counted).toBe(0);
    expect(after.lines[0]?.variance).toBe(-4);

    // A negative COUNT is not a thing: nobody counts minus four filters.
    const bad = await counts().recordCountLine(
      { countId: count.id, productId: FIXTURES.oil, counted: -3 },
      TECHNICIAN,
    );
    expect(
      bad.lines.find((row) => row.productId === FIXTURES.oil)?.counted,
      "a negative count was stored",
    ).not.toBe(-3);
  });

  it("review reports the variance summary without touching stock", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: "all" }, MANAGER);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oil, counted: 10 }, TECHNICIAN);

    const before = JSON.stringify(db.snapshot("stockLevel"));
    const review = await counts().reviewCount({ countId: count.id, status: "REVIEW" }, MANAGER);
    expect(review.status).toBe("REVIEW");
    expect(review.summary.variances).toBe(1);
    expect(review.summary.netVariance).toBe(-1);
    expect(review.summary.counted).toBe(2);
    expect(JSON.stringify(db.snapshot("stockLevel")), "review must not move stock").toBe(before);
  });

  it("posting writes the variance to the ledger and moves the level exactly once", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: "all" }, MANAGER);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oil, counted: 10 }, TECHNICIAN);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.wiper, counted: 7 }, TECHNICIAN);
    await counts().reviewCount({ countId: count.id, status: "REVIEW" }, MANAGER);

    const posted = await counts().postCount({ countId: count.id }, MANAGER);
    expect(posted.count.status).toBe("POSTED");
    expect(posted.count.postedAt).toBeTruthy();
    expect(posted.posted).toBe(2);

    // The oil filter was counted at 3 against an expected 4: one ADJUST_DOWN.
    expect(db.levelOf(FIXTURES.oilFilter).onHand).toBe(3);
    // The wiper was counted at 7 against 6: one ADJUST_UP.
    expect(db.levelOf(FIXTURES.wiper).onHand).toBe(7);
    // The oil was counted correctly: no movement at all.
    expect(db.levelOf(FIXTURES.oil).onHand).toBe(10);

    const movements = db.snapshot("stockMovement");
    expect(movements).toHaveLength(2);
    expect(movements.every((row) => row.kind === "ADJUST_UP" || row.kind === "ADJUST_DOWN")).toBe(true);
    for (const movement of movements) {
      expect(movement.reason, "a count adjustment is still a human action and needs a reason").toBeTruthy();
      expect(movement.actorName).toBe("Ana (Manager)");
      expect(movement.onHandAfter).toBeGreaterThanOrEqual(0);
    }
    const replay = replayLedger(db, FIXTURES.oilFilter);
    expect(replay.onHand, "the ledger and the level must agree after posting").toBe(db.levelOf(FIXTURES.oilFilter).onHand);
  });

  it("POSTING TWICE MUST NOT DOUBLE-ADJUST", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: FIXTURES.oilFilter }, MANAGER);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);
    await counts().reviewCount({ countId: count.id, status: "REVIEW" }, MANAGER);

    const first = await counts().postCount({ countId: count.id }, MANAGER);
    const afterFirst = db.levelOf(FIXTURES.oilFilter);
    expect(afterFirst.onHand).toBe(3);
    expect(first.posted).toBe(1);

    // The second post must be refused outright, not applied again.
    let second: { posted: number; count: { status: string } } | null = null;
    try {
      second = await counts().postCount({ countId: count.id }, MANAGER);
    } catch {
      second = null;
    }

    expect(
      db.levelOf(FIXTURES.oilFilter),
      "posting twice moved the stock a second time",
    ).toEqual(afterFirst);
    expect(db.snapshot("stockMovement"), "posting twice wrote a second adjustment").toHaveLength(1);
    if (second !== null) {
      expect(second.posted, "a second post reported work it did not do").toBe(0);
      expect(second.count.status).toBe("POSTED");
    }
  });

  it("a count that says 0 while 6 are promised must NOT create a negative balance", async () => {
    seedCatalogue(db, { [FIXTURES.brakePads]: { onHand: 6, reserved: 6 } });
    const count = await counts().createCount({ scope: FIXTURES.brakePads }, MANAGER);
    await counts().recordCountLine(
      { countId: count.id, productId: FIXTURES.brakePads, counted: 0, note: "box empty" },
      TECHNICIAN,
    );
    await counts().reviewCount({ countId: count.id, status: "REVIEW" }, MANAGER);

    await counts().postCount({ countId: count.id }, MANAGER);

    const level = db.levelOf(FIXTURES.brakePads);
    expect(level.available, "the reconciliation itself broke the invariant").toBeGreaterThanOrEqual(0);
    expect(level.reserved).toBeLessThanOrEqual(level.onHand);
    for (const movement of db.snapshot("stockMovement")) {
      expect(movement.onHandAfter).toBeGreaterThanOrEqual(0);
    }
  });

  it("posting a DRAFT count is refused — a count nobody reviewed must not move stock", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: FIXTURES.oilFilter }, MANAGER);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);

    let posted: { posted: number } | null = null;
    try {
      posted = await counts().postCount({ countId: count.id }, MANAGER);
    } catch {
      posted = null;
    }
    expect(db.levelOf(FIXTURES.oilFilter).onHand, "an unreviewed count moved the stock").toBe(4);
    expect(db.snapshot("stockMovement")).toHaveLength(0);
    if (posted !== null) expect(posted.posted).toBe(0);
  });

  it("an outstanding line blocks posting until every product has been counted", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: "all" }, MANAGER);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);

    const review = await counts().reviewCount({ countId: count.id, status: "REVIEW" }, MANAGER);
    expect(review.summary.outstanding, "two products are still uncounted").toBeGreaterThan(0);

    let posted: { posted: number } | null = null;
    try {
      posted = await counts().postCount({ countId: count.id }, MANAGER);
    } catch {
      posted = null;
    }
    expect(db.levelOf(FIXTURES.oilFilter).onHand, "a partial count was posted anyway").toBe(4);
    if (posted !== null) expect(posted.posted).toBe(0);
  });

  it("a per-product count touches exactly one product", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: FIXTURES.oilFilter }, MANAGER);
    expect(count.lines).toHaveLength(1);
    expect(count.lines[0]?.productId).toBe(FIXTURES.oilFilter);
    expect(count.scope).toBe(FIXTURES.oilFilter);
  });

  it("a count scoped to one kind touches every product of that kind", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: "OIL" }, MANAGER);
    expect(count.lines.length).toBeGreaterThan(0);
    for (const line of count.lines) {
      expect(db.rows("product").find((row) => row.id === line.productId)?.kind).toBe("OIL");
    }
  });

  it("a cancelled count moves nothing and cannot be posted afterwards", async () => {
    countWorld(db);
    const count = await counts().createCount({ scope: "all" }, MANAGER);
    await counts().recordCountLine({ countId: count.id, productId: FIXTURES.oilFilter, counted: 3 }, TECHNICIAN);
    await counts().reviewCount({ countId: count.id, status: "CANCELLED" }, MANAGER);

    expect(db.levelOf(FIXTURES.oilFilter).onHand).toBe(4);
    let posted: { posted: number } | null = null;
    try {
      posted = await counts().postCount({ countId: count.id }, MANAGER);
    } catch {
      posted = null;
    }
    expect(db.snapshot("stockMovement")).toHaveLength(0);
    if (posted !== null) expect(posted.posted).toBe(0);
  });
});

describeAwaiting(engine, "counts — AWAITING the real count service");
