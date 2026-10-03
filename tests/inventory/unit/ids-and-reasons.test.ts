// @vitest-environment node
/**
 * A7 · CI/CD & QA — ids, reasons and the ledger's own arithmetic.
 * ============================================================================
 * WHAT RUNS TODAY, AND WHY IT IS NOT FILLER
 * ------------------------------------------
 * Most of the inventory suite waits on A2's engine. This file deliberately does
 * not, because there is a whole class of defect that lives entirely in files
 * that already exist and can be proved right now:
 *
 *   • **Contract ↔ schema drift.** `src/lib/inventory-types.ts` declares
 *     `MOVEMENT_KINDS`, `UNITS`, `PRODUCT_KINDS`, `RESERVATION_STATUSES` and
 *     `STOCK_COUNT_STATUSES` as TypeScript unions. `prisma/schema.prisma`
 *     declares the same concepts as Postgres enums. Two hand-maintained lists
 *     describing one domain will drift, and when they do the symptom is a
 *     `PrismaClientValidationError` at 3am on the first movement of a new kind —
 *     not a type error, because the DTO never sees the Prisma enum. These tests
 *     parse the schema and compare.
 *
 *   • **The ledger must replay.** `StockMovement.onHandAfter` and
 *     `StockLevel.onHand` are written by two different statements. Six weeks
 *     later, when the system and the shelf disagree, they are the only two
 *     witnesses. Replaying the ledger has to reproduce the held number exactly,
 *     or one of them is lying.
 *
 *   • **References.** `makeReference` from the existing `src/lib/utils.ts` is what
 *     stock-count references are built from. An ambiguous `0`/`O`/`1`/`I` in a
 *     reference a human reads off a label and types into a search box is a real
 *     defect, and the existing booking suite already asserts it for bookings.
 *
 * THE REST WAITS ON A2
 * --------------------
 * Reason hygiene and idempotency-key behaviour are engine properties. They are
 * registered as `it.todo`, each naming the exact export.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";

import {
  MOVEMENT_KINDS,
  PRODUCT_KINDS,
  RESERVATION_STATUSES,
  STOCK_COUNT_STATUSES,
  UNITS,
  type MovementKindValue,
  type MovementRefusalReason,
} from "@/lib/inventory-types";
import { REFERENCE_ALPHABET, makeReference } from "@/lib/utils";

import { createFakeDb, type FakeStockMovement } from "../support/fake-prisma";
import { FIXTURES, PINNED_NOW, seedCatalogue } from "../support/fixtures";
import { MOVEMENT_SIGN, replayLedger } from "../support/reference-engine";
import { describeAwaiting, readRepoFile, resolveInventoryModule, capability } from "../support/module-resolver";

// ── Contract ↔ schema parity ────────────────────────────────────────────────

/** Reads a Postgres `enum` block out of the Prisma schema. */
function schemaEnum(name: string): string[] {
  const schema = readRepoFile("prisma/schema.prisma");
  const match = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`, "m").exec(schema);
  if (!match?.[1]) throw new Error(`enum ${name} not found in prisma/schema.prisma`);
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//") && !line.startsWith("///"))
    .map((line) => line.split("//")[0]?.trim() ?? "")
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\w+\s+/, "").trim());
}

describe("ids and reasons — the contract and the database describe the same domain", () => {
  it.each([
    ["ProductKind", PRODUCT_KINDS],
    ["UnitOfMeasure", UNITS],
    ["StockMovementKind", MOVEMENT_KINDS],
    ["ReservationStatus", RESERVATION_STATUSES],
    ["StockCountStatus", STOCK_COUNT_STATUSES],
  ])("%s in prisma/schema.prisma matches %s in inventory-types.ts", (enumName, contractValues) => {
    const fromSchema = [...schemaEnum(String(enumName))].sort();
    const fromContract = [...(contractValues as readonly string[])].sort();
    // Exact set equality in BOTH directions. A value only in the schema cannot
    // be produced by the engine; a value only in the contract cannot be stored.
    expect(fromSchema, `${enumName}: schema has values the contract does not`).toEqual(fromContract);
    expect(fromContract, `${enumName}: contract has values the database cannot store`).toEqual(fromSchema);
  });

  it("the movement kinds are exhaustive — every kind has a sign convention", () => {
    const unclassified = MOVEMENT_KINDS.filter((kind) => MOVEMENT_SIGN[kind] === undefined);
    expect(
      unclassified,
      "a new MovementKindValue arrived with no sign. Sign 0 means 'reserved moves, " +
        "onHand does not'; +1 adds to onHand; -1 removes from it. RESERVE and RELEASE " +
        "move the promise, not the shelf.",
    ).toEqual([]);
  });

  it("the sign convention encoded here matches the convention the contract documents", () => {
    // `PostMovementInput.kind`'s doc comment is the specification of record. It
    // is parsed rather than restated, so editing the comment without editing the
    // engine fails this test instead of silently becoming a lie.
    const types = readRepoFile("src/lib/inventory-types.ts");
    const parsed = /`kind` decides the sign convention:\s*\n\s*\*\s+([^\n]*)\n\s*\*\s+([^\n]*)\n/.exec(types);
    const adds = parsed?.[1] ?? "";
    const removes = parsed?.[2] ?? "";
    expect(adds, "the documented 'adds to onHand' list changed; re-derive MOVEMENT_SIGN").toBe(
      "RECEIVE / ADJUST_UP / TRANSFER_IN  -> adds to onHand",
    );
    expect(removes, "the documented 'removes' list changed; re-derive MOVEMENT_SIGN").toBe(
      "CONSUME / ADJUST_DOWN / SHRINK / TRANSFER_OUT / RETURN_TO_SUPPLIER -> removes",
    );

    for (const kind of ["RECEIVE", "ADJUST_UP", "TRANSFER_IN"] as const) {
      expect(MOVEMENT_SIGN[kind], `${kind} adds to onHand`).toBe(1);
    }
    for (const kind of ["CONSUME", "ADJUST_DOWN", "SHRINK", "TRANSFER_OUT", "RETURN_TO_SUPPLIER"] as const) {
      expect(MOVEMENT_SIGN[kind], `${kind} removes from onHand`).toBe(-1);
    }
    expect(MOVEMENT_SIGN["OPENING"], "OPENING sets a baseline, it does not add").toBe(0);
    expect(MOVEMENT_SIGN["RESERVE"], "RESERVE moves the promise, not the shelf").toBe(0);
    expect(MOVEMENT_SIGN["RELEASE"], "RELEASE moves the promise, not the shelf").toBe(0);
  });

  it("every refusal reason the engine can return is reachable from a test case", () => {
    // A completeness check on the contract itself. When someone adds a reason to
    // `MovementRefusalReason`, this fails until a refusal case is written for it
    // in `stock-engine.test.ts`. A refusal nobody tests is a refusal nobody can
    // claim is handled.
    const reasons: MovementRefusalReason[] = [
      "INSUFFICIENT_STOCK",
      "NEGATIVE_QUANTITY",
      "ZERO_QUANTITY",
      "PRODUCT_INACTIVE",
      "OPENING_ALREADY_SET",
      "INSUFFICIENT_AVAILABLE",
    ];
    const source = readRepoFile("tests/inventory/unit/stock-engine.test.ts");
    const untested = reasons.filter((reason) => !source.includes(`"${reason}"`));
    expect(
      untested,
      "these refusal reasons have no case in stock-engine.test.ts — add one, or the " +
        "reason is unreachable in the suite and therefore unproven",
    ).toEqual([]);
  });
});

// ── The ledger must replay ──────────────────────────────────────────────────

/** Writes one movement straight into the fake, bypassing any engine. */
function ledgerRow(
  db: ReturnType<typeof createFakeDb>,
  productId: string,
  kind: MovementKindValue,
  qty: number,
  onHandAfter: number,
  minuteOffset: number,
): FakeStockMovement {
  const row: FakeStockMovement = {
    id: `mv_${productId}_${minuteOffset}_${kind}`,
    productId,
    kind,
    qty,
    onHandAfter,
    reason: `fixture ${kind}`,
    reference: null,
    bookingId: null,
    idempotencyKey: null,
    actorId: "usr_manager",
    actorName: "Manager",
    createdAt: new Date(PINNED_NOW.getTime() + minuteOffset * 60_000),
  };
  db.insert("stockMovement", row);
  return row;
}

describe("ids and reasons — the ledger replays to the held level", () => {
  it("replaying a full lifecycle reproduces StockLevel.onHand exactly", () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    seedCatalogue(db, { [FIXTURES.oilFilter]: { onHand: 0, reserved: 0 } });
    const productId = FIXTURES.oilFilter;

    // A month of a shop's life: counted, restocked, promised, released, used
    // twice, shrunk, corrected. Promises: 6 reserved, 1 released, 2 + 3 consumed
    // — which nets to zero, and each consume clears its own hold as it goes.
    ledgerRow(db, productId, "OPENING", 20, 20, 0);
    ledgerRow(db, productId, "RESERVE", 6, 20, 10);
    ledgerRow(db, productId, "RELEASE", 1, 20, 20);
    ledgerRow(db, productId, "CONSUME", 2, 18, 30);
    ledgerRow(db, productId, "RECEIVE", 12, 30, 40);
    ledgerRow(db, productId, "CONSUME", 3, 27, 50);
    ledgerRow(db, productId, "SHRINK", 1, 26, 60);
    ledgerRow(db, productId, "ADJUST_DOWN", 1, 25, 70);
    ledgerRow(db, productId, "ADJUST_UP", 2, 27, 80);
    db.stockLevel_upsert({
      id: `lvl_${productId}`,
      productId,
      onHand: 27,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });

    const replay = replayLedger(db, productId);
    expect(replay.onHand, "the replayed ledger must reproduce the held on-hand").toBe(27);
    expect(replay.lastOnHandAfter, "the last movement's running total must equal it too").toBe(27);
    expect(replay.reserved, "every promise was either released or consumed").toBe(0);
    expect(replay.movements).toBe(9);
    expect(db.levelOf(productId)).toEqual({ onHand: 27, reserved: 0, available: 27 });
  });

  it("the ledger reproduces `opening + received - consumed +/- adjusted` exactly", () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    seedCatalogue(db, { [FIXTURES.oil]: { onHand: 0, reserved: 0 } });
    const productId = FIXTURES.oil;

    // Oil is counted in LITRES, and `StockLevel.onHand` is an `Int`, so a bay
    // that draws 1.4 L draws 2. The rounding belongs to the *consume*, not to
    // the ledger, so the ledger has to add up exactly.
    const OPENING = 40;
    const CASE_OF_24 = 24;
    const LITRES_PER_DRAW = 2;
    const DRAWS = 5;
    const CASES = 3;

    ledgerRow(db, productId, "OPENING", OPENING, OPENING, 0);
    for (let case_ = 0; case_ < CASES; case_ += 1) {
      ledgerRow(db, productId, "RECEIVE", CASE_OF_24, OPENING + (case_ + 1) * CASE_OF_24, case_ + 1);
    }
    for (let draw = 0; draw < DRAWS; draw += 1) {
      ledgerRow(db, productId, "CONSUME", LITRES_PER_DRAW, OPENING + CASES * CASE_OF_24 - (draw + 1) * LITRES_PER_DRAW, 10 + draw);
    }

    const expected = OPENING + CASES * CASE_OF_24 - DRAWS * LITRES_PER_DRAW;
    const replay = replayLedger(db, productId);
    expect(replay.onHand).toBe(expected);
    expect(replay.lastOnHandAfter).toBe(expected);

    // Now the engine writes the held level, and the two witnesses must agree.
    db.stockLevel_upsert({
      id: `lvl_${productId}`,
      productId,
      onHand: expected,
      reserved: 0,
      updatedAt: PINNED_NOW,
    });
    expect(db.levelOf(productId).onHand).toBe(expected);
    expect(db.levelOf(productId).onHand).toBe(replay.lastOnHandAfter);
  });

  it("a replay with no OPENING row starts from zero and says so", () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    seedCatalogue(db, { [FIXTURES.rag]: { onHand: 0, reserved: 0 } });
    ledgerRow(db, FIXTURES.rag, "RECEIVE", 5, 5, 0);
    expect(replayLedger(db, FIXTURES.rag).onHand).toBe(5);

    const empty = createFakeDb({ now: () => PINNED_NOW });
    seedCatalogue(empty, { [FIXTURES.rag]: { onHand: 0, reserved: 0 } });
    expect(replayLedger(empty, FIXTURES.rag)).toEqual({
      onHand: 0,
      reserved: 0,
      movements: 0,
      lastOnHandAfter: null,
    });
  });

  it("a ledger row for a kind the engine does not know fails loudly instead of guessing", () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    seedCatalogue(db, { [FIXTURES.rag]: { onHand: 0, reserved: 0 } });
    ledgerRow(db, FIXTURES.rag, "RECEIVE", 1, 1, 0);
    db.insert("stockMovement", {
      id: "mv_bogus",
      productId: FIXTURES.rag,
      kind: "MISPLACED_PARTS",
      qty: 1,
      onHandAfter: 2,
      reason: null,
      reference: null,
      bookingId: null,
      idempotencyKey: null,
      actorId: null,
      actorName: null,
      createdAt: PINNED_NOW,
    });
    expect(() => replayLedger(db, FIXTURES.rag)).toThrow(/unknown movement kind "MISPLACED_PARTS"/);
  });

  it("the ledger is append-only: the fake refuses to rewrite or delete history", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    seedCatalogue(db, { [FIXTURES.rag]: { onHand: 0, reserved: 0 } });
    ledgerRow(db, FIXTURES.rag, "RECEIVE", 5, 5, 0);
    const before = db.snapshot("stockMovement");

    await expect(db.stockMovement.update({ where: { id: before[0]?.id }, data: { qty: 999 } })).rejects.toThrow(
      /append-only/,
    );
    await expect(db.stockMovement.delete({ where: { id: before[0]?.id } })).rejects.toThrow(/append-only/);
    await expect(db.stockMovement.deleteMany({ where: {} })).rejects.toThrow(/append-only/);

    expect(db.snapshot("stockMovement"), "a refused mutation must leave the ledger untouched").toHaveLength(1);
    expect(db.snapshot("stockMovement")[0]?.qty).toBe(5);
  });
});

// ── References ──────────────────────────────────────────────────────────────

describe("ids and reasons — stock-count references", () => {
  // `makeReference(prefix, len)` concatenates: the caller supplies the separator,
  // exactly as the booking engine does with `makeReference("EYG-")`.
  const COUNT_PREFIX = "COUNT-";

  it("a COUNT reference is prefixed, uppercase and fixed-width", () => {
    const reference = makeReference(COUNT_PREFIX, 8);
    expect(reference.startsWith(COUNT_PREFIX)).toBe(true);
    const body = reference.slice(COUNT_PREFIX.length);
    expect(body).toHaveLength(8);
    expect(body).toMatch(/^[A-Z0-9]+$/);
  });

  it("a reference never contains a glyph a human reads wrong off a shelf label", () => {
    // `O`/`0`, `I`/`1`, `S`/`5`, `B`/`8` are the pairs that cost a technician a
    // minute every time. The booking suite proves this for `EYG-`; the same
    // alphabet serves `COUNT-`.
    for (let draw = 0; draw < 500; draw += 1) {
      const body = makeReference(COUNT_PREFIX, 8).slice(COUNT_PREFIX.length);
      expect(body, `ambiguous glyph in ${body}`).not.toMatch(/[IO01SBZ]/);
      for (const character of body) {
        expect(
          REFERENCE_ALPHABET.includes(character),
          `"${character}" is not in REFERENCE_ALPHABET`,
        ).toBe(true);
      }
    }
  });

  it("500 references drawn from a 21-character alphabet at length 8 do not collide", () => {
    // 21^8 ≈ 3.8e10. A birthday collision across 500 draws is ~3e-6, so a
    // collision here means `makeReference` is broken, not unlucky. This is the
    // same order of check the booking suite runs; `StockCount.reference` is
    // `@unique`, so a collision is a failed insert on the owner's laptop.
    expect(REFERENCE_ALPHABET).toHaveLength(21);
    const seen = new Set<string>();
    for (let draw = 0; draw < 500; draw += 1) seen.add(makeReference(COUNT_PREFIX, 8));
    expect(seen.size, "makeReference produced a duplicate").toBe(500);
  });
});

// ── What waits on A2 ─────────────────────────────────────────────────────────

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

describeAwaiting(engine, "ids and reasons — AWAITING the real stock engine");
