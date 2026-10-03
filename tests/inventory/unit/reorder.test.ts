// @vitest-environment node
/**
 * A7 · CI/CD & QA — the reorder list.
 * ============================================================================
 * The reorder list is the loop that stops the shop running out: low stock → order
 * → receive. It is also the list most likely to be *quietly wrong*, because a
 * reorder list that is one day late is invisible until a customer is standing at
 * the counter with their car on the lift.
 *
 * Three things must be true of it:
 *
 *   1. **It is driven by `available`, not `onHand`.** Six filters on the shelf,
 *      all six promised, is zero filters the shop can sell. A reorder list keyed
 *      on `onHand` will not order until the shelf is empty — which is the moment
 *      it is too late.
 *   2. **It carries no cost to anyone without a staff session.** `ReorderRowDto`
 *      has optional `costPrice` and `estimatedCost` precisely so a public read can
 *      exist without them.
 *   3. **A suggested quantity is a quantity, not a vague number.** It must be
 *      enough to clear the reorder point, and it must respect the product's unit.
 *
 * WHAT RUNS TODAY
 * ---------------
 * The contract's `isLow` / `isStockout` semantics are asserted against the
 * contract's own wording. **This suite found a contradiction there** — see
 * `ReorderRowDto.isStockout`'s doc comment, reported in
 * `docs/inventory-qa/DEFECTS.md`. The test encodes the only reading that can
 * drive correct UI, and names the ambiguity so it cannot be resolved silently.
 *
 * WHAT WAITS ON A2: `getReorderList`.
 * ============================================================================
 */

import { beforeEach, describe, expect, it } from "vitest";

import { createFakeDb, type FakeDb } from "../support/fake-prisma";
import { FIXTURES, PINNED_NOW, seedCatalogue, seedOne } from "../support/fixtures";
import {
  capability,
  describeAwaiting,
  readRepoFile,
  resolveInventoryModule,
  surface,
  type ReorderSurface,
} from "../support/module-resolver";

const engine = await resolveInventoryModule(
  [
    "@/lib/server/inventory/reorder",
    "@/lib/server/inventory/stock-engine",
    "@/lib/server/inventory/index",
    "@/lib/server/inventory",
  ],
  [capability("getReorderList", ["reorderList", "listReorder", "getReorder"], () => true)],
);

let db: FakeDb;

beforeEach(() => {
  db = createFakeDb({ now: () => PINNED_NOW });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runs today
// ─────────────────────────────────────────────────────────────────────────────

describe("reorder — the contract's semantics are readable", () => {
  it("`isLow` is defined against AVAILABLE, not on-hand", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("/** available <= reorderPoint. Drives the reorder list and the dashboard badge. */");
    expect(types).toContain("isLow: boolean;");
  });

  it("`isStockout` means exactly one thing: order now", () => {
    // RESOLVED. This test used to pin the DEFECTIVE wording so the ambiguity
    // would stay visible until the orchestrator acted on it. It has.
    //
    //   /** true = at/below reorder point, false = already below zero. */
    //
    // The first clause described "time to reorder"; the second described a
    // state the invariant makes impossible, because `available` is never
    // negative. A boolean cannot mean both, and a boolean with two meanings is
    // a boolean the UI will get wrong.
    //
    // The contract now says one thing, and it is the only reading that drives
    // correct behaviour: `true` when `available <= reorderPoint`, zero included.
    const types = readRepoFile("src/lib/inventory-types.ts");

    expect(types, "the resolved wording changed - re-read it").toContain(
      "True when this line needs ordering now",
    );

    // And the impossible second meaning must not come back.
    expect(
      types,
      "available is never negative, so 'below zero' must not come back as a meaning"
    ).not.toContain("false = already below zero");

    expect(types).toContain("isStockout: boolean;");
  });

  it("`isOversold` is documented as a state that should never be true", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("/** Below zero *should* never be true; surfaced loudly if it ever is. */");
    expect(types).toContain("isOversold: boolean;");
  });

  it("cost fields on the reorder row are OPTIONAL, so a public read can omit them", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const row = /export interface ReorderRowDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(row).toContain("costPrice?: number;");
    expect(row).toContain("estimatedCost?: number;");
    expect(row, "available must be present — it is what the ordering decision is made on").toContain(
      "available: number;",
    );
    expect(row, "the unit must be present — a suggestion in the wrong unit is unusable").toContain("unit: UnitValue;");
  });

  it("`estimatedCost` is at COST, not at sell price — the two must never be confused", () => {
    // Margin is survival on tyre money. An `estimatedCost` computed from
    // `sellPrice` would make the owner believe a reorder is cheaper than it is.
    // Stated here as a claim on the implementation, because the DTO cannot enforce
    // it: both fields are `number`.
    const types = readRepoFile("src/lib/inventory-types.ts");
    const row = /export interface ReorderRowDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(row).toContain("costPrice?: number;");
    expect(row).toContain("estimatedCost?: number;");
    expect(row, "estimatedCost must sit next to costPrice so the pair is reviewable together").toMatch(
      /costPrice\?: number;\s*\n\s*estimatedCost\?: number;/,
    );
  });

  it("`ValuationDto.costValue` is at cost and `retailValue` at sell — both are labelled", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const valuation = /export interface ValuationDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(valuation).toContain("/** At cost. Staff-only. */");
    expect(valuation).toContain("costValue?: number;");
    expect(valuation).toContain("/** At sell price. */");
    expect(valuation).toContain("retailValue: number;");
  });

  it("a product with 6 on the shelf and 6 promised is NOT in stock, whatever the reorder point", () => {
    // The arithmetic the whole list rests on, stated once, plainly, and checked
    // against the fixture rather than against prose.
    seedOne(db, FIXTURES.oilFilter, { onHand: 6, reserved: 6 });
    const level = db.levelOf(FIXTURES.oilFilter);
    expect(level.onHand).toBe(6);
    expect(level.available).toBe(0);
    expect(level.available <= 0, "available, not onHand, is what the reorder point is measured against").toBe(true);
  });

  it("`valuationValue` is split by kind so a tyre count is never read as an oil count", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const valuation = /export interface ValuationDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(valuation).toContain("byKind: Array<{ kind: ProductKindValue; products: number; units: number; retailValue: number }>");
    expect(valuation).toContain("costValue?: number;");
    expect(valuation).toContain("retailValue: number;");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing
// ─────────────────────────────────────────────────────────────────────────────

const describeReorder = engine.ready ? describe : describe.skip;
const reorder = (): ReorderSurface => surface<ReorderSurface>(engine);

function reorderWorld(): void {
  seedCatalogue(db, {
    // Below the point: order now.
    [FIXTURES.oilFilter]: { onHand: 2, reserved: 0 },
    // Comfortably above the point.
    [FIXTURES.wiper]: { onHand: 30, reserved: 0 },
    // On the shelf but ALL of it promised. `onHand` is fine; `available` is 0.
    [FIXTURES.brakePads]: { onHand: 6, reserved: 6 },
    // Exactly on the point.
    [FIXTURES.cleaner]: { onHand: 5, reserved: 0 },
    // No stock record at all.
    [FIXTURES.rag]: { onHand: 0, reserved: 0 },
  });
}

describeReorder("reorder — the list is driven by `available`", () => {
  it("lists every product whose AVAILABLE is at or below its reorder point", async () => {
    reorderWorld();
    const { rows } = await reorder().getReorderList({ includeCost: true });
    const byId = new Map(rows.map((row) => [String(row["productId"]), row]));

    expect(byId.has(FIXTURES.oilFilter), "2 available against a reorder point of 6 must be listed").toBe(true);
    expect(byId.has(FIXTURES.brakePads), "0 AVAILABLE despite 6 on the shelf — this is the whole point").toBe(true);
    expect(byId.has(FIXTURES.cleaner), "exactly on the point is at the point").toBe(true);
    expect(byId.has(FIXTURES.wiper), "30 available against a point of 4 must not be listed").toBe(false);
  });

  it("never lists a product whose available exceeds its reorder point", async () => {
    reorderWorld();
    const { rows } = await reorder().getReorderList({ includeCost: true });
    for (const row of rows) {
      const available = Number(row["available"]);
      const point = Number(row["reorderPoint"]);
      expect(available, `${String(row["sku"])} is listed with available ${available} > point ${point}`)
        .toBeLessThanOrEqual(point);
      expect(available, "a listed row must never report negative availability").toBeGreaterThanOrEqual(0);
    }
  });

  it("a suggested quantity is a whole number in the product's own unit, and it clears the point", async () => {
    reorderWorld();
    const { rows } = await reorder().getReorderList({ includeCost: true });
    const filter = rows.find((row) => row["productId"] === FIXTURES.oilFilter);

    expect(filter).toBeDefined();
    const suggested = Number(filter?.["suggestedQty"]);
    expect(Number.isInteger(suggested), "a fractional filter is not a thing").toBe(true);
    expect(suggested, "the suggestion must be positive").toBeGreaterThan(0);
    expect(
      suggested + Number(filter?.["available"]),
      "ordering the suggestion must leave the shop above its reorder point",
    ).toBeGreaterThan(Number(filter?.["reorderPoint"]));
    expect(filter?.["unit"], "every suggested quantity carries its unit").toBe("EA");
  });

  it("a product with no stock row at all appears with zero, not omitted", async () => {
    // An omitted product is invisible. A new filter with no StockLevel row is
    // exactly the thing an owner needs to see on the list.
    seedCatalogue(db);
    const { rows } = await reorder().getReorderList({ includeCost: true });
    const filter = rows.find((row) => row["productId"] === FIXTURES.oilFilter);
    expect(filter, "a product with no level row must still appear").toBeDefined();
    expect(Number(filter?.["available"])).toBe(0);
    expect(filter?.["isStockout"], "zero available is the definition of a stockout").toBe(true);
  });

  it("an inactive product is never ordered — it is discontinued, not forgotten", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 0, reserved: 0 }, { isActive: false });
    const { rows } = await reorder().getReorderList({ includeCost: true });
    expect(rows.some((row) => row["productId"] === FIXTURES.oilFilter)).toBe(false);
  });

  it("cost is omitted entirely unless a staff session asked for it", async () => {
    reorderWorld();
    const publicish = await reorder().getReorderList({});
    const staff = await reorder().getReorderList({ includeCost: true });

    expect(JSON.stringify(publicish.rows), "a read with no staff flag must carry no cost").not.toContain("costPrice");
    expect(JSON.stringify(publicish.rows)).not.toContain("estimatedCost");

    const costRow = staff.rows.find((row) => row["productId"] === FIXTURES.oilFilter);
    expect(costRow?.["costPrice"], "a staff read must still be able to see the cost").toBe(280);
    // The sentinel: the filter costs 280 and sells for 450. If `estimatedCost` is
    // computed at sell price the owner plans a reorder on a number that is 60%
    // too high, and margin is how this shop survives.
    expect(Number(costRow?.["estimatedCost"])).toBeLessThanOrEqual(280 * Number(costRow?.["suggestedQty"]));
  });

  it("the supplier travels with the row so the owner can actually place the order", async () => {
    reorderWorld();
    const { rows } = await reorder().getReorderList({ includeCost: true });
    const filter = rows.find((row) => row["productId"] === FIXTURES.oilFilter);
    expect(filter?.["supplierName"]).toBe("Metro Tire Supply");
  });
});

describeAwaiting(engine, "reorder — AWAITING the real reorder service");
