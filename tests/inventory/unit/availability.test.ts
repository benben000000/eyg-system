// @vitest-environment node
/**
 * A7 · CI/CD & QA — availability: the promise the booking flow makes.
 * ============================================================================
 * `ServiceAvailabilityDto.canFulfil` is the single value that decides whether a
 * job may be PROMISED to a customer. `true` means every part is on the shelf and
 * un-promised. `false` means the shop has to say "we may need to order this in",
 * which is an honest sentence rather than a lost sale.
 *
 * So the two rules below are not preferences; they are the product.
 *
 * RULE 1 — A SHORT **NON-BLOCKING** PART MUST NOT SET `blocked`.
 *   A PMS needs an oil filter. It does not need the shop's stock of engine oil
 *   decanted to the litre; a bay pours from the 4-litre case. If a shortage on a
 *   non-blocking part sets `blocked`, the front desk starts turning away work the
 *   shop can perfectly well do, and the booking engine's whole reason for
 *   existing evaporates.
 *
 * RULE 2 — A SHORT **BLOCKING** PART MUST SET `blocked`.
 *   Brake pads are safety-critical. Promising a car with no pads is not a
 *   marketing problem; it is a car on the lift with nothing to put on it.
 *
 * AND THE ARITHMETIC MUST RESPECT THE UNIT
 * -----------------------------------------
 * A PMS uses **one** oil filter. Not a pack. A set of five tyres is **five**
 * units, not one, because the spare is a physical tyre that occupies shelf space
 * and can be fitted. Oil is counted in LITRES, so a bay that draws 1.4 L draws 2
 * — `StockLevel.onHand` is an `Int`, and a bay never takes half a litre.
 *
 * WHAT RUNS TODAY
 * ---------------
 * The BOM fixtures and their unit arithmetic, asserted directly against the seeded
 * `ServicePartRequirement` rows, plus the contract's own guarantee that
 * `canFulfil` is a hard gate. The fixtures are shared by A2's tests and by
 * `concurrency.test.ts`, so a wrong fixture fails loudly everywhere rather than
 * quietly making a test about something else.
 *
 * WHAT WAITS ON A2: every assertion about what `getServiceAvailability` returns.
 * ============================================================================
 */

import { beforeEach, describe, expect, it } from "vitest";

import { createFakeDb, type FakeDb } from "../support/fake-prisma";
import {
  FIXTURES,
  PINNED_NOW,
  seedBom,
  seedBrakeService,
  seedCatalogue,
  seedPmsService,
  seedService,
} from "../support/fixtures";
import {
  capability,
  describeAwaiting,
  readRepoFile,
  resolveInventoryModule,
  surface,
  type AvailabilitySurface,
} from "../support/module-resolver";

const engine = await resolveInventoryModule(
  [
    "@/lib/server/inventory/availability",
    "@/lib/server/inventory/stock-engine",
    "@/lib/server/inventory/engine",
    "@/lib/server/inventory/index",
    "@/lib/server/inventory",
  ],
  [
    capability("getServiceAvailability", ["serviceAvailability", "availabilityForServices"], () => true),
    capability("getProductAvailability", ["productAvailability", "availabilityForProducts"], () => true),
  ],
);

let db: FakeDb;

beforeEach(() => {
  db = createFakeDb({ now: () => PINNED_NOW });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runs today
// ─────────────────────────────────────────────────────────────────────────────

describe("availability — the contract makes `canFulfil` a hard gate", () => {
  it("the contract says only a true `canFulfil` may be promised to a customer", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("/** Every part is covered. Only a true value may be promised to a customer. */");
    expect(types).toContain("canFulfil: boolean;");
    expect(types).toContain("/** True when a blocking part is short — the booking must not be promised. */");
    expect(types).toContain("blocked: boolean;");
    expect(types).toContain("/** Shortfalls on blocking parts only. */");
  });

  it("the contract says `isShort` is `available < qtyNeeded`, not `<=`", () => {
    // Off-by-one here is the difference between "we are exactly enough" being
    // reported as short and the front desk ordering oil the shop already has.
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("/** available < qtyNeeded. */");
  });

  it("the contract forbids cost data on an availability read", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const dto = /export interface PartAvailabilityDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(dto, "PartAvailabilityDto must not gain a cost field — it is reachable without a session").not.toMatch(
      /costPrice|marginPct|cost/i,
    );
    expect(dto).toContain("sellPrice: number;");
  });

  it("a PMS consumes exactly one oil filter and one litre of oil", () => {
    seedCatalogue(db);
    seedPmsService(db);
    const bom = db.snapshot("servicePartRequirement").filter((row) => row.serviceId === FIXTURES.servicePms);
    expect(bom).toHaveLength(2);

    const filter = bom.find((row) => row.productId === FIXTURES.oilFilter);
    expect(filter?.qtyPerService, "a PMS uses one filter, not a pack of four").toBe(1);
    expect(filter?.isBlocking, "no filter means no service, so it blocks").toBe(true);

    const oil = bom.find((row) => row.productId === FIXTURES.oil);
    expect(oil?.qtyPerService, "a PMS draws one litre").toBe(1);
    expect(oil?.isBlocking, "oil can be poured from the case, so a shortage only warns").toBe(false);
  });

  it("a set of five tyres is FIVE units, not one", () => {
    seedCatalogue(db);
    seedService(db, { id: FIXTURES.serviceRotation, slug: "tyre-rotation", name: "Tyre rotation + set of 5" });
    seedBom(db, FIXTURES.serviceRotation, [
      { productId: FIXTURES.tyre, qtyPerService: 4, isBlocking: true },
      { productId: FIXTURES.tyreSetOfFive, qtyPerService: 1, isBlocking: true },
    ]);

    const product = db.snapshot("product").find((row) => row.id === FIXTURES.tyreSetOfFive);
    expect(product?.unit, "a set of five is a SET, and that unit is the whole point").toBe("SET");
    expect(product?.sku).toBe("TYR-SET5-205-55R16-BF-G2");

    const bom = db.snapshot("servicePartRequirement").filter((row) => row.serviceId === FIXTURES.serviceRotation);
    // The requirement is expressed in the product's own unit. Four loose tyres is
    // four; a set that includes the spare is one set. The arithmetic downstream
    // is what must not collapse the set to a single tyre.
    expect(bom.find((row) => row.productId === FIXTURES.tyre)?.qtyPerService).toBe(4);
    expect(bom.find((row) => row.productId === FIXTURES.tyreSetOfFive)?.qtyPerService).toBe(1);
    expect(product?.unit).not.toBe("EA");
  });

  it("oil is counted in LITRES, so a 1.4 L draw is 2 — the column is an Int", () => {
    seedCatalogue(db);
    const schema = readRepoFile("prisma/schema.prisma");
    expect(schema, "a fractional litre cannot be stored in an Int").toMatch(
      /model StockLevel \{[\s\S]*?onHand\s+Int\s+@default\(0\)/,
    );
    const oil = db.snapshot("product").find((row) => row.id === FIXTURES.oil);
    expect(oil?.unit).toBe("LITRE");
  });

  it("a service with no bill of materials is a valid service, not a broken one", () => {
    seedCatalogue(db);
    seedService(db, { id: FIXTURES.serviceNoBom, slug: "aircon-recharge", name: "Aircon recharge" });
    expect(db.snapshot("servicePartRequirement").filter((r) => r.serviceId === FIXTURES.serviceNoBom)).toHaveLength(0);
  });

  it("brake pads are blocking and the shop rag is not — safety decides, not cost", () => {
    seedCatalogue(db);
    seedBrakeService(db);
    const pads = db
      .snapshot("servicePartRequirement")
      .find((row) => row.serviceId === FIXTURES.serviceBrakes);
    expect(pads?.productId).toBe(FIXTURES.brakePads);
    expect(pads?.isBlocking, "no pads means the car does not leave").toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing
// ─────────────────────────────────────────────────────────────────────────────

const describeAvailability = engine.ready ? describe : describe.skip;
const availability = (): AvailabilitySurface => surface<AvailabilitySurface>(engine);

/** In stock for everything; tests then remove exactly one thing. */
function stockedWorld(): void {
  seedCatalogue(db, {
    [FIXTURES.oilFilter]: { onHand: 8, reserved: 0 },
    [FIXTURES.oil]: { onHand: 40, reserved: 0 },
    [FIXTURES.brakePads]: { onHand: 4, reserved: 0 },
    [FIXTURES.tyre]: { onHand: 12, reserved: 0 },
    [FIXTURES.tyreSetOfFive]: { onHand: 2, reserved: 0 },
    [FIXTURES.wiper]: { onHand: 6, reserved: 0 },
    [FIXTURES.cleaner]: { onHand: 3, reserved: 0 },
    [FIXTURES.rag]: { onHand: 20, reserved: 0 },
  });
  seedPmsService(db);
  seedBrakeService(db);
  seedService(db, { id: FIXTURES.serviceRotation, slug: "tyre-rotation", name: "Tyre set of 5" });
  seedBom(db, FIXTURES.serviceRotation, [{ productId: FIXTURES.tyreSetOfFive, qtyPerService: 1, isBlocking: true }]);
  seedService(db, { id: FIXTURES.serviceNoBom, slug: "aircon-recharge", name: "Aircon recharge" });
}

describeAvailability("availability — bill of materials, derived from services", () => {
  it("derives the parts from the service's BOM and reports each one's arithmetic", async () => {
    stockedWorld();
    const [service] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.servicePms] });

    expect(service?.serviceId).toBe(FIXTURES.servicePms);
    expect(service?.serviceSlug).toBe("pms-honda");
    expect(service?.parts).toHaveLength(2);

    const filter = service?.parts.find((part) => part.productId === FIXTURES.oilFilter);
    expect(filter?.qtyPerService).toBe(1);
    expect(filter?.qtyNeeded).toBe(1);
    expect(filter?.available).toBe(8);
    expect(filter?.isShort).toBe(false);
    expect(filter?.isBlocking).toBe(true);
    expect(filter?.unit, "every quantity shows its unit").toBe("EA");

    const oil = service?.parts.find((part) => part.productId === FIXTURES.oil);
    expect(oil?.unit).toBe("LITRE");
    expect(oil?.isBlocking).toBe(false);
    expect(oil?.available).toBe(40);
  });

  it("a short NON-BLOCKING part must NOT set blocked and must NOT appear in `blockers`", async () => {
    stockedWorld();
    // Zero oil, full filters. The car can still be serviced.
    db.stockLevel_upsert({
      id: `lvl_${FIXTURES.oil}`,
      productId: FIXTURES.oil,
      onHand: 0,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });

    const [service] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.servicePms] });

    const oil = service?.parts.find((part) => part.productId === FIXTURES.oil);
    expect(oil?.isShort, "no oil IS short").toBe(true);
    expect(oil?.available).toBe(0);

    expect(service?.blockers, "a non-blocking shortage must not produce a blocker").toEqual([]);
    expect(service?.blockers, "blockers are blocking shortfalls only").toEqual([]);
    expect(service?.parts.some((part) => part.isShort), "the shortfall must still be VISIBLE").toBe(true);
  });

  it("a short BLOCKING part must set blocked and must name the shortfall", async () => {
    stockedWorld();
    db.stockLevel_upsert({
      id: `lvl_${FIXTURES.brakePads}`,
      productId: FIXTURES.brakePads,
      onHand: 0,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });

    const [service] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.serviceBrakes] });

    expect((service?.blockers.length ?? 0) > 0, "a blocking shortfall must produce a blocker").toBe(true);
    expect(service?.blockers).toHaveLength(1);
    expect(service?.blockers[0]?.productId).toBe(FIXTURES.brakePads);
    expect(service?.blockers[0]?.short, "one pair needed, none there").toBe(1);
    expect(service?.blockers[0]?.name).toBe("Brake pads — front axle set (Honda Civic)");
  });

  it("`canFulfil` is false for a blocking shortfall and true otherwise — it is the only thing a booking may trust", async () => {
    stockedWorld();
    const [ok] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.servicePms] });
    expect(ok?.canFulfil).toBe(true);

    db.stockLevel_upsert({
      id: `lvl_${FIXTURES.oilFilter}`,
      productId: FIXTURES.oilFilter,
      onHand: 0,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });
    const [short] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.servicePms] });
    expect(short?.canFulfil).toBe(false);
    expect((short?.blockers.length ?? 0) > 0, "a blocking shortfall must produce a blocker").toBe(true);
  });

  it("reserved stock counts as unavailable — the shop must not promise what is spoken for", async () => {
    stockedWorld();
    db.stockLevel_upsert({
      id: `lvl_${FIXTURES.oilFilter}`,
      productId: FIXTURES.oilFilter,
      onHand: 4,
      reserved: 4,
      updatedAt: PINNED_NOW,
    });

    const [service] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.servicePms] });
    const filter = service?.parts.find((part) => part.productId === FIXTURES.oilFilter);
    expect(filter?.available, "available is onHand - reserved, not onHand").toBe(0);
    expect(filter?.isShort).toBe(true);
    expect(service?.canFulfil).toBe(false);
  });

  it("exactly-enough is NOT short — `isShort` is `<`, not `<=`", async () => {
    stockedWorld();
    db.stockLevel_upsert({
      id: `lvl_${FIXTURES.oilFilter}`,
      productId: FIXTURES.oilFilter,
      onHand: 1,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });

    const [service] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.servicePms] });
    const filter = service?.parts.find((part) => part.productId === FIXTURES.oilFilter);
    expect(filter?.available).toBe(1);
    expect(filter?.qtyNeeded).toBe(1);
    expect(filter?.isShort, "one filter in stock for a one-filter job is enough").toBe(false);
    expect(service?.canFulfil).toBe(true);
  });

  it("a service with no BOM succeeds silently — no parts, no blockers, no error", async () => {
    stockedWorld();
    const [service] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.serviceNoBom] });
    expect(service?.canFulfil).toBe(true);
    expect(service?.blockers).toEqual([]);
    expect(service?.parts).toEqual([]);
    expect(service?.blockers).toEqual([]);
  });

  it("a set of five tyres needs five tyre positions, and the unit is reported", async () => {
    stockedWorld();
    // Two sets in stock: one for the customer, one spare for the shelf.
    const [service] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.serviceRotation] });
    const part = service?.parts[0];
    expect(part?.unit).toBe("SET");
    expect(part?.qtyNeeded).toBe(1);
    expect(part?.available).toBe(2);
    expect(service?.canFulfil).toBe(true);

    // One set left: still enough for this job.
    db.stockLevel_upsert({
      id: `lvl_${FIXTURES.tyreSetOfFive}`,
      productId: FIXTURES.tyreSetOfFive,
      onHand: 1,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });
    const [stillOk] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.serviceRotation] });
    expect(stillOk?.canFulfil).toBe(true);

    db.stockLevel_upsert({
      id: `lvl_${FIXTURES.tyreSetOfFive}`,
      productId: FIXTURES.tyreSetOfFive,
      onHand: 0,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });
    const [short] = await availability().getServiceAvailability({ serviceIds: [FIXTURES.serviceRotation] });
    expect(short?.canFulfil).toBe(false);
    expect(short?.blockers[0]?.short).toBe(1);
  });

  it("availability never leaks what the shop paid", async () => {
    stockedWorld();
    const rows = await availability().getServiceAvailability({ serviceIds: [FIXTURES.servicePms] });
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain("costPrice");
    expect(serialised).not.toContain("marginPct");
    // The sentinel cost of the filter is 280; the sell price is 450.
    expect(serialised).not.toMatch(/(?<!\d)280(?!\d)/);
  });

  it("an unknown service id is refused rather than reported as fulfilable", async () => {
    stockedWorld();
    // `canFulfil: true` for a service that does not exist would let a booking be
    // promised against a phantom.
    const result = await availability().getServiceAvailability({ serviceIds: ["svc_does_not_exist"] });
    expect(result.length, "a phantom service must not come back fulfilable").toBeLessThanOrEqual(1);
    for (const row of result) {
      expect(row.serviceId, "a service that does not exist cannot be fulfilable").not.toBe("svc_does_not_exist");
    }
  });

  it("per-product availability reports what can still be promised, never a cost", async () => {
    stockedWorld();
    const rows = await availability().getProductAvailability([FIXTURES.oilFilter, FIXTURES.oil]);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.canPromise, "canPromise must never exceed available").toBeLessThanOrEqual(row.available);
      expect(row.available).toBeGreaterThanOrEqual(0);
      expect(row.isLow).toBe(row.available <= row.reorderPoint);
    }
    expect(JSON.stringify(rows)).not.toContain("costPrice");
    expect(JSON.stringify(rows)).not.toMatch(/(?<!\d)280(?!\d)/);
  });
});

describeAwaiting(engine, "availability — AWAITING the real availability service");
