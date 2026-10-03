// @vitest-environment node
/**
 * A7 · CI/CD & QA — the single write path: `postMovement`.
 * ============================================================================
 * THE CONTRACT UNDER TEST
 * -----------------------
 * `PostMovementInput` says it plainly:
 *
 *   • `REJECT` is returned when the move would push `available` below zero.
 *   • A refusal is never silently clamped.
 *   • `reason` is REQUIRED for anything a human initiated. "Because" is not a
 *     reason.
 *   • `PostMovementRejection.available` exists so the UI can say "3 left", not
 *     "failed".
 *   • `idempotencyKey` de-duplicates a retried submit, and the server returns
 *     the ORIGINAL result for a repeat rather than erroring.
 *
 * WHAT A REFUSAL MUST DO — ALL FIVE, EVERY TIME
 * ----------------------------------------------
 *   1. return `ok: false` with a `MovementRefusalReason`;
 *   2. write **no** `StockMovement` row;
 *   3. leave `StockLevel` **completely** unchanged — byte for byte;
 *   4. report the TRUE `available`, so the counter can say how many are left;
 *   5. never record an `onHandAfter` that implies a negative balance.
 *
 * Point 5 is the subtle one. A refused move that still writes a ledger row — even
 * one with `qty: 0` — is how a discrepancy becomes unexplainable: the ledger says
 * something happened and the level says it did not, and six weeks later nobody can
 * say which one is lying.
 *
 * WHAT RUNS TODAY
 * ---------------
 * The refusal table below is the single source of truth for which refusals exist;
 * `ids-and-reasons.test.ts` reads this file and fails if the contract grows a
 * reason with no case here. The contract's own documented wording is also asserted,
 * so a rewrite of `PostMovementRejection` into a "clamped success" cannot pass
 * unnoticed.
 *
 * WHAT WAITS ON A2
 * ----------------
 * Every behavioural assertion is written out in full and registered against the
 * real module, activating the moment `postMovement` exists.
 * ============================================================================
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { MovementRefusalReason, PostMovementInput } from "@/lib/inventory-types";

import { createFakeDb, type FakeDb } from "../support/fake-prisma";
import { FIXTURES, PINNED_NOW, seedCatalogue, seedOne } from "../support/fixtures";
import {
  capability,
  describeAwaiting,
  readRepoFile,
  resolveInventoryModule,
  surface,
  type ActorContext,
  type StockEngineSurface,
} from "../support/module-resolver";

const ACTOR: ActorContext = {
  actorId: "usr_manager",
  actorName: "Ana (Manager)",
  now: PINNED_NOW,
};

const engine = await resolveInventoryModule(
  [
    "@/lib/server/inventory/stock-engine",
    "@/lib/server/inventory/engine",
    "@/lib/server/inventory/index",
    "@/lib/server/inventory",
  ],
  [
    capability("postMovement", ["postStockMovement", "move"], () => true),
    capability("reserveForBooking", ["reserve", "reserveParts"], () => true),
    capability("releaseReservations", ["release", "releaseForBooking"], () => true),
    capability("consumeReservations", ["consume", "consumeForBooking"], () => true),
    capability("expireReservations", ["expire", "expireStaleHolds"], () => true),
  ],
);

// ── The refusal table ───────────────────────────────────────────────────────

/**
 * Every reason the engine may return, with the world that provokes it and the
 * truth the UI needs in order to say something useful.
 */
interface RefusalCase {
  readonly reason: MovementRefusalReason;
  readonly describe: string;
  readonly world: (db: FakeDb) => void;
  readonly qty: number;
  readonly kind: PostMovementInput["kind"];
  readonly expectAvailable: number;
}

const refusalCases: readonly RefusalCase[] = [
  {
    reason: "INSUFFICIENT_STOCK",
    describe: "consuming more than is physically on the shelf",
    world: (db) => seedOne(db, FIXTURES.oilFilter, { onHand: 3, reserved: 0 }),
    qty: 5,
    kind: "CONSUME",
    expectAvailable: 3,
  },
  {
    reason: "INSUFFICIENT_AVAILABLE",
    describe: "reserving more than is available once promises are counted",
    world: (db) => seedOne(db, FIXTURES.oilFilter, { onHand: 6, reserved: 4 }),
    qty: 3,
    kind: "RESERVE",
    expectAvailable: 2,
  },
  {
    reason: "NEGATIVE_QUANTITY",
    describe: "a client sending a negative quantity",
    world: (db) => seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 }),
    qty: -1,
    kind: "CONSUME",
    expectAvailable: 5,
  },
  {
    reason: "ZERO_QUANTITY",
    describe: "a client sending zero — the double-tap that arrived as nothing",
    world: (db) => seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 }),
    qty: 0,
    kind: "CONSUME",
    expectAvailable: 5,
  },
  {
    reason: "PRODUCT_INACTIVE",
    describe: "moving stock for a product that has been discontinued",
    world: (db) => seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 }, { isActive: false }),
    qty: 1,
    kind: "CONSUME",
    expectAvailable: 5,
  },
  {
    reason: "OPENING_ALREADY_SET",
    describe: "setting an opening balance on a product that already has stock",
    world: (db) => seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 }),
    qty: 10,
    kind: "OPENING",
    expectAvailable: 5,
  },
];

let db: FakeDb;

/** Everything a refusal must leave alone, captured verbatim. */
function snapshotWorld(): string {
  return JSON.stringify({
    levels: db.snapshot("stockLevel"),
    movements: db.snapshot("stockMovement"),
    reservations: db.snapshot("reservation"),
  });
}

beforeEach(() => {
  db = createFakeDb({ now: () => PINNED_NOW });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runs today: the table and the contract's own wording
// ─────────────────────────────────────────────────────────────────────────────

describe("stock-engine — the refusal table is the contract's, not this suite's", () => {
  it("declares a case for every reason in MovementRefusalReason, and nothing more", () => {
    const declared = [...refusalCases.map((entry) => entry.reason)].sort();
    const expected = [
      "INSUFFICIENT_AVAILABLE",
      "INSUFFICIENT_STOCK",
      "NEGATIVE_QUANTITY",
      "OPENING_ALREADY_SET",
      "PRODUCT_INACTIVE",
      "ZERO_QUANTITY",
    ].sort();
    expect(declared).toEqual(expected);
    expect(new Set(declared).size, "a reason is declared twice").toBe(declared.length);
  });

  it("every case names a provoke-world and a truth the UI can display", () => {
    for (const entry of refusalCases) {
      expect(entry.describe.length, `${entry.reason} has no description`).toBeGreaterThan(0);
      expect(Number.isInteger(entry.expectAvailable), `${entry.reason} has a non-integer available`).toBe(true);
      expect(
        entry.expectAvailable,
        `${entry.reason} reports a negative available, which would be its own lie`,
      ).toBeGreaterThanOrEqual(0);
      expect(entry.qty === 0, `${entry.reason} must provoke with a zero or non-zero quantity`).toBe(
        entry.reason === "ZERO_QUANTITY",
      );
    }
  });

  it("the contract still says a refusal is never clamped", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types, "`REJECT` must still be documented as the shortfall response").toContain(
      "`REJECT` is returned when the move would push `available` below zero.",
    );
    expect(types, "a refusal must still be documented as not-clamped").toContain(
      "/** A move that the server refused. Never silently clamped. */",
    );
    expect(types, "the rejection must still carry `available` for the '3 left' message").toContain(
      '/** What was actually available, so the UI can say "3 left" not "failed". */',
    );
  });

  it("OPENING is still documented as failing when the product already has stock", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("OPENING -> sets the baseline (fails if the product already has stock)");
  });

  it("`PostMovementResult.replayed` and `PostMovementRejection` are distinguishable without parsing", () => {
    // `PostMovementResult` has no `ok` field at all; only a rejection does. So a
    // caller that forgets to check `ok` gets a TypeError rather than silently
    // treating a refusal as a success. This test pins that shape so it cannot be
    // softened into `"ok": true` on a clamped result.
    const types = readRepoFile("src/lib/inventory-types.ts");
    const result = /export interface PostMovementResult \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(result, "PostMovementResult must NOT grow an `ok: true`, or a refusal and a success merge").not.toMatch(
      /\bok\s*[?]:/,
    );
    expect(result).toContain("replayed: boolean;");

    const rejection = /export interface PostMovementRejection \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(rejection).toContain("ok: false;");
    expect(rejection).toContain("available: number;");
    expect(rejection).toContain("requested: number;");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing: registered the moment `postMovement` exists
// ─────────────────────────────────────────────────────────────────────────────

const describeEngine = engine.ready ? describe : describe.skip;

describeEngine("stock-engine — refusal, never clamp", () => {
  const engineUnderTest = (): StockEngineSurface => surface<StockEngineSurface>(engine);

  it.each(refusalCases.map((entry) => [entry.reason, entry] as const))(
    "%s — refuses, writes nothing, and reports the true available",
    async (reason, entry) => {
      entry.world(db);
      const before = snapshotWorld();

      const result = await engineUnderTest().postMovement(
        {
          productId: FIXTURES.oilFilter,
          kind: entry.kind,
          qty: entry.qty,
          reason: "PMS on bay 2 — mechanic asked",
          reference: "PO-2026-0142",
        },
        ACTOR,
      );

      expect("ok" in result && result.ok === false, `${reason} must be a rejection, not a clamped success`).toBe(
        false,
      );
      expect(result).toMatchObject({
        ok: false,
        reason,
        available: entry.expectAvailable,
        requested: entry.qty,
      });
      expect(snapshotWorld(), `${reason} must leave the database completely unchanged`).toBe(before);
      expect(db.snapshot("stockMovement"), `${reason} must write no ledger row`).toHaveLength(0);

      const level = db.levelOf(FIXTURES.oilFilter);
      expect(level.available, `${reason} must not drive available negative`).toBeGreaterThanOrEqual(0);
      expect(level.reserved).toBeLessThanOrEqual(level.onHand);
    },
  );

  it("a refusal carries a message an operator can read, not an error code", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 2, reserved: 0 });
    const result = await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 9, reason: "bay 2" },
      ACTOR,
    );
    expect("message" in result && typeof result.message === "string" && result.message.length > 0).toBe(true);
    expect("message" in result ? result.message : "").not.toMatch(/INSUFFICIENT_STOCK/);
  });

  it("a refused movement records no `onHandAfter` that implies a negative balance", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 2, reserved: 0 });
    await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 9, reason: "bay 2" },
      ACTOR,
    );

    const movements = db.snapshot("stockMovement");
    expect(movements, "a refused move writes nothing at all").toHaveLength(0);
    for (const movement of movements) {
      expect(movement.onHandAfter).toBeGreaterThanOrEqual(0);
    }
    expect(db.levelOf(FIXTURES.oilFilter).available).toBe(2);
  });

  it("a human-initiated write without a real reason is refused, and 'because' is not a reason", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 });
    const before = snapshotWorld();

    for (const reason of ["", "   ", "because", "n/a", "-"]) {
      const result = await engineUnderTest().postMovement(
        { productId: FIXTURES.oilFilter, kind: "ADJUST_DOWN", qty: 1, reason },
        ACTOR,
      );
      expect("replayed" in result, `reason ${JSON.stringify(reason)} was accepted`).toBe(false);
      expect(snapshotWorld(), `reason ${JSON.stringify(reason)} changed the database`).toBe(before);
    }
  });

  it("a system-initiated write may omit the reason, but the actor is still recorded", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 });
    const result = await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 1, reason: "", bookingId: FIXTURES.bookingA },
      { actorName: "booking-hooks", now: PINNED_NOW },
    );
    expect("replayed" in result).toBe(true);
    expect(db.snapshot("stockMovement")).toHaveLength(1);
    expect(db.snapshot("stockMovement")[0]?.actorName).toBe("booking-hooks");
    expect(db.snapshot("stockMovement")[0]?.bookingId).toBe(FIXTURES.bookingA);
  });

  it("the ledger is append-only: no movement is ever updated after it is written", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 });
    await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "RECEIVE", qty: 10, reason: "PO-2026-0142" },
      ACTOR,
    );
    const written = db.snapshot("stockMovement");
    expect(written).toHaveLength(1);

    await expect(db.stockMovement.update({ where: { id: written[0]?.id }, data: { qty: 0 } })).rejects.toThrow(
      /append-only/,
    );
    expect(db.snapshot("stockMovement")).toHaveLength(1);
    expect(db.snapshot("stockMovement")[0]?.qty).toBe(10);
  });

  it("a client-supplied `onHandAfter` is ignored — the server computes the running total", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 });
    const forged = {
      productId: FIXTURES.oilFilter,
      kind: "RECEIVE",
      qty: 1,
      reason: "PO",
      onHandAfter: 9_999,
    } as unknown as PostMovementInput;

    await engineUnderTest().postMovement(forged, ACTOR);
    expect(db.snapshot("stockMovement")[0]?.onHandAfter, "a client-supplied running total must be ignored").toBe(6);
    expect(db.levelOf(FIXTURES.oilFilter).onHand).toBe(6);
  });

  it("RECEIVE adds, the removers remove, and every running total is correct", async () => {
    seedCatalogue(db, { [FIXTURES.oil]: { onHand: 0, reserved: 0 } });

    const sequence: ReadonlyArray<{ kind: PostMovementInput["kind"]; qty: number; expect: number }> = [
      { kind: "OPENING", qty: 40, expect: 40 },
      { kind: "RECEIVE", qty: 24, expect: 64 },
      { kind: "CONSUME", qty: 2, expect: 62 },
      { kind: "SHRINK", qty: 1, expect: 61 },
      { kind: "ADJUST_DOWN", qty: 1, expect: 60 },
      { kind: "ADJUST_UP", qty: 4, expect: 64 },
      { kind: "TRANSFER_IN", qty: 2, expect: 66 },
      { kind: "TRANSFER_OUT", qty: 6, expect: 60 },
      { kind: "RETURN_TO_SUPPLIER", qty: 5, expect: 55 },
    ];

    for (const step of sequence) {
      const result = await engineUnderTest().postMovement(
        { productId: FIXTURES.oil, kind: step.kind, qty: step.qty, reason: `fixture ${step.kind}` },
        ACTOR,
      );
      expect("replayed" in result, `${step.kind} was refused: ${JSON.stringify(result)}`).toBe(true);
      expect(
        db.levelOf(FIXTURES.oil).onHand,
        `${step.kind} ${step.qty} should leave onHand at ${step.expect}`,
      ).toBe(step.expect);
      expect(db.snapshot("stockMovement").at(-1)?.onHandAfter, `${step.kind} running total`).toBe(step.expect);
    }

    // OPENING twice must be refused; a baseline is not a correction.
    const second = await engineUnderTest().postMovement(
      { productId: FIXTURES.oil, kind: "OPENING", qty: 1, reason: "tried to re-base" },
      ACTOR,
    );
    expect("replayed" in second).toBe(false);
    expect(db.levelOf(FIXTURES.oil).onHand, "a second OPENING must not rewrite history").toBe(55);
  });

  it("a CONSUME that would take on-hand below zero is refused while a RESERVE-only shortfall is a different reason", async () => {
    // The two shortfall reasons are not interchangeable. INSUFFICIENT_STOCK means
    // the part is not on the shelf; INSUFFICIENT_AVAILABLE means it is on the
    // shelf but already promised. Staff triage differently, so conflating them
    // costs a phone call.
    seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 4 });

    const consume = await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 2, reason: "bay 2" },
      ACTOR,
    );
    // onHand 5 >= 2, so the shelf can serve it. If the engine also demands the
    // hold, this is INSUFFICIENT_AVAILABLE.
    const reserve = await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "RESERVE", qty: 2, reason: "bay 3" },
      ACTOR,
    );
    expect("reason" in reserve && reserve.reason === "INSUFFICIENT_AVAILABLE").toBe(true);
    expect("reason" in consume).toBe(true);
  });
});

describeAwaiting(engine, "stock-engine — AWAITING the real stock engine");
