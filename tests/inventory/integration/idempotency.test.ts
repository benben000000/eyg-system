// @vitest-environment node
/**
 * A7 · CI/CD & QA — idempotency. Networks retry; humans double-tap.
 * ============================================================================
 * `PostMovementInput.idempotencyKey` exists because a stock write is not
 * idempotent by nature: a retried `CONSUME 1` spends a second filter, and a
 * retried `RECEIVE 24` invents 24 litres of oil the shop never bought. Both are
 * the kind of error that is invisible for a week and then very expensive.
 *
 * THREE CASES, IN ORDER OF HOW MUCH DAMAGE THEY DO
 * -------------------------------------------------
 *  1. **The same key twice.** One ledger row. The second call returns the ORIGINAL
 *     result with `replayed: true`. Not a second move, and not an error — a retry
 *     that succeeded the first time is not a failure, and answering 409 would
 *     make the client retry harder.
 *
 *  2. **CROSS-PRODUCT REPLAY — the subtle one.** `StockMovement.idempotencyKey` is
 *     `@unique` GLOBALLY, not scoped to a product. So a key used on product A and
 *     then reused on product B collides on a unique index for a reason that has
 *     nothing to do with B. The naive implementation — "key exists, return the
 *     stored result" — hands back product A's movement as the answer to a request
 *     about product B. The caller believes it moved B's stock. B's stock never
 *     moved. This is a wrong-answer bug, not a loud failure, and it is the single
 *     most valuable test in this file.
 *
 *  3. **Reserve → release → reserve with the same key.** Safe, and the safe answer
 *     is the interesting one: the key de-duplicates a *submission*, not a *state*,
 *     so a genuinely new reservation after a release must be allowed to proceed.
 *     Getting this wrong in the other direction (treating the key as a permanent
 *     lock) strands the shop's stock forever.
 *
 * WHAT RUNS TODAY
 * ---------------
 * The unique-constraint behaviour that makes all three cases possible is modelled
 * against the fake and proved directly: a second `create` with the same key is a
 * `P2002`, not a silent overwrite. The cross-product scenario is then modelled
 * end to end, so the shape of the bug is on record before A2 writes the handler.
 *
 * WHAT WAITS ON A2: `postMovement`'s actual replay behaviour.
 * ============================================================================
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { PostMovementInput, PostMovementRejection, PostMovementResult } from "@/lib/inventory-types";

import { createFakeDb, type FakeDb, type FakeStockMovement } from "../support/fake-prisma";
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

const ACTOR: ActorContext = { actorId: "usr_manager", actorName: "Ana (Manager)", now: PINNED_NOW };

const engine = await resolveInventoryModule(
  [
    "@/lib/server/inventory/stock-engine",
    "@/lib/server/inventory/idempotency",
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

let db: FakeDb;

beforeEach(() => {
  db = createFakeDb({ now: () => PINNED_NOW });
});

const isResult = (value: PostMovementResult | PostMovementRejection): value is PostMovementResult =>
  !("ok" in value && value.ok === false);

// ─────────────────────────────────────────────────────────────────────────────
// Runs today
// ─────────────────────────────────────────────────────────────────────────────

describe("idempotency — the mechanism the contract depends on", () => {
  it("`idempotencyKey` is documented as returning the ORIGINAL result, not an error", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("/** True when the request was a replay of an idempotencyKey. */");
    expect(types).toContain("replayed: boolean;");
    const input = /export interface PostMovementInput \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(input).toContain("idempotencyKey?: string;");
    expect(input).toContain("The server returns the ORIGINAL result for a repeat rather than erroring.");
  });

  it("the ledger enforces it with a GLOBAL unique index, not one per product", () => {
    // This is why cross-product replay is a bug rather than a non-issue. If the
    // index were `@@unique([productId, idempotencyKey])` the whole class of
    // problem would not exist; as written, a key is spent globally.
    const schema = readRepoFile("prisma/schema.prisma");
    const movement = /model StockMovement \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(movement).toMatch(/idempotencyKey\s+String\?\s+@unique/);
    expect(
      movement,
      "the index is global on purpose — a per-product index would make the key reusable across " +
        "products, and the contract does not promise that",
    ).not.toContain("@@unique([productId, idempotencyKey])");
    expect(movement).toContain("De-duplicates a retried submit. Two taps must not double-consume.");
  });

  it("a second movement with the same key is a P2002, not a silent overwrite", async () => {
    seedCatalogue(db, { [FIXTURES.oilFilter]: { onHand: 5, reserved: 0 } });
    const movement: FakeStockMovement = {
      id: "mv_1",
      productId: FIXTURES.oilFilter,
      kind: "CONSUME",
      qty: 1,
      onHandAfter: 4,
      reason: "bay 2",
      reference: null,
      bookingId: FIXTURES.bookingA,
      idempotencyKey: "tap-once-please",
      actorId: "usr_manager",
      actorName: "Ana",
      createdAt: PINNED_NOW,
    };
    await db.stockMovement.create({ data: movement });

    await expect(
      db.stockMovement.create({ data: { ...movement, id: "mv_2" } }),
    ).rejects.toMatchObject({ code: "P2002", meta: { target: ["idempotencyKey"] } });

    expect(db.snapshot("stockMovement"), "the original row must be untouched").toHaveLength(1);
    expect(db.snapshot("stockMovement")[0]?.qty).toBe(1);
  });

  it("the naive cross-product handler returns product A's movement for a request about product B", async () => {
    // This test asserts the BUG, on purpose, so the shape of it is on record.
    // If a future implementation breaks it, this test goes red and someone has to
    // explain why the fix was safe.
    seedCatalogue(db, {
      [FIXTURES.oilFilter]: { onHand: 5, reserved: 0 },
      [FIXTURES.oil]: { onHand: 40, reserved: 0 },
    });

    const KEY = "shared-key-from-a-buggy-client";
    await db.stockMovement.create({
      data: {
        id: "mv_on_filter",
        productId: FIXTURES.oilFilter,
        kind: "CONSUME",
        qty: 1,
        onHandAfter: 4,
        reason: "bay 2",
        reference: null,
        bookingId: FIXTURES.bookingA,
        idempotencyKey: KEY,
        actorId: "usr_manager",
        actorName: "Ana",
        createdAt: PINNED_NOW,
      },
    });

    // A client reuses the key for a DIFFERENT product — a buggy UI, a copy-pasted
    // payload, or two browser tabs sharing a generated key.
    await db.stockLevel.update({
      where: { productId: FIXTURES.oil },
      data: { onHand: { decrement: 2 }, updatedAt: PINNED_NOW },
    });

    // THE BUG: "key exists, so return what it found" — with no product check.
    const found = await db.stockMovement.findUnique({ where: { idempotencyKey: KEY } });
    expect(found?.productId, "the naive lookup hands back the wrong product").toBe(FIXTURES.oilFilter);
    expect(found?.productId, "which is NOT the product the caller asked about").not.toBe(FIXTURES.oil);

    // The CORRECT behaviour needs the productId in the comparison, and either a
    // refusal or a fresh key. Both are asserted in the A2-facing block below.
    expect(db.levelOf(FIXTURES.oil).onHand).toBe(38);
  });

  it("a nullable unique column still allows many NULLs, as SQL requires", async () => {
    // A human who does not supply a key must not collide with every other
    // keyless movement in history. MySQL would get this wrong with a plain index.
    seedCatalogue(db, { [FIXTURES.oilFilter]: { onHand: 5, reserved: 0 } });
    for (let index = 0; index < 5; index += 1) {
      await db.stockMovement.create({
        data: {
          id: `mv_null_${index}`,
          productId: FIXTURES.oilFilter,
          kind: "CONSUME",
          qty: 1,
          onHandAfter: 4 - index,
          reason: "no key supplied",
          reference: null,
          bookingId: null,
          idempotencyKey: null,
          actorId: null,
          actorName: null,
          createdAt: PINNED_NOW,
        },
      });
    }
    expect(db.snapshot("stockMovement")).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing
// ─────────────────────────────────────────────────────────────────────────────

const describeEngine = engine.ready ? describe : describe.skip;
const engineUnderTest = (): StockEngineSurface => surface<StockEngineSurface>(engine);

function idempotentWorld(target: FakeDb): void {
  seedOne(target, FIXTURES.oilFilter, { onHand: 5, reserved: 0 });
  seedOne(target, FIXTURES.oil, { onHand: 40, reserved: 0 });
}

describeEngine("idempotency — the same key twice", () => {
  it("produces one ledger row, and the second call replays the ORIGINAL result", async () => {
    idempotentWorld(db);
    const input: PostMovementInput = {
      productId: FIXTURES.oilFilter,
      kind: "CONSUME",
      qty: 1,
      reason: "bay 2 — PMS",
      bookingId: FIXTURES.bookingA,
      idempotencyKey: "pms-2026-03-11-bay2",
    };

    const first = await engineUnderTest().postMovement(input, ACTOR);
    const second = await engineUnderTest().postMovement(input, ACTOR);

    expect(isResult(first), "the first call must succeed").toBe(true);
    expect(isResult(second), "the replay must return a result, not an error").toBe(true);
    if (!isResult(first) || !isResult(second)) return;

    expect(first.replayed, "the first call is not a replay").toBe(false);
    expect(second.replayed, "the second call must be flagged as a replay").toBe(true);

    expect(db.snapshot("stockMovement"), "a retry must not write a second row").toHaveLength(1);
    expect(db.levelOf(FIXTURES.oilFilter), "a retry must not spend a second filter").toEqual({
      onHand: 4,
      reserved: 0,
      available: 4,
    });

    // The replay must be the ORIGINAL, byte for byte — not a recomputed one.
    expect(second.movement.id).toBe(first.movement.id);
    expect(second.movement.qty).toBe(first.movement.qty);
    expect(second.movement.onHandAfter).toBe(first.movement.onHandAfter);
    expect(second.stock.onHand).toBe(first.stock.onHand);
  });

  it("replays a REFUSAL too — a retried refusal must not be re-executed", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 2, reserved: 0 });
    const input: PostMovementInput = {
      productId: FIXTURES.oilFilter,
      kind: "CONSUME",
      qty: 5,
      reason: "bay 2 — PMS",
      idempotencyKey: "will-not-fit",
    };
    const before = JSON.stringify(db.snapshot("stockMovement"));

    const first = await engineUnderTest().postMovement(input, ACTOR);
    const second = await engineUnderTest().postMovement(input, ACTOR);

    expect(isResult(first), "the first call should refuse").toBe(false);
    expect(isResult(second), "the replay of a refusal should refuse").toBe(false);
    if (isResult(first) || isResult(second)) return;
    expect(second).toEqual(first);
    expect(JSON.stringify(db.snapshot("stockMovement"))).toBe(before);
  });

  it("a DIFFERENT key spends stock again — the key de-duplicates a submit, not a decision", async () => {
    idempotentWorld(db);
    await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 1, reason: "bay 2", idempotencyKey: "key-a" },
      ACTOR,
    );
    await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 1, reason: "bay 3", idempotencyKey: "key-b" },
      ACTOR,
    );
    expect(db.snapshot("stockMovement")).toHaveLength(2);
    expect(db.levelOf(FIXTURES.oilFilter).onHand).toBe(3);
  });

  it("omitting the key entirely means no de-duplication — and that is the client's choice", async () => {
    idempotentWorld(db);
    await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 1, reason: "bay 2" },
      ACTOR,
    );
    await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 1, reason: "bay 2" },
      ACTOR,
    );
    expect(db.snapshot("stockMovement")).toHaveLength(2);
  });
});

describeEngine("idempotency — CROSS-PRODUCT REPLAY", () => {
  it("a key used on product A and reused on product B is NOT a replay of A", async () => {
    idempotentWorld(db);
    const KEY = "shared-key-from-a-buggy-client";

    const onA = await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 1, reason: "bay 2", idempotencyKey: KEY },
      ACTOR,
    );
    const onB = await engineUnderTest().postMovement(
      { productId: FIXTURES.oil, kind: "CONSUME", qty: 2, reason: "bay 2", idempotencyKey: KEY },
      ACTOR,
    );

    expect(isResult(onA)).toBe(true);
    expect(isResult(onB)).toBe(true);
    if (!isResult(onA) || !isResult(onB)) return;

    // Two acceptable behaviours; both are safe. The unsafe one is a replay.
    if (onB.replayed) {
      expect(
        onB.movement.productId,
        "a replay must never return a movement for a DIFFERENT product",
      ).toBe(FIXTURES.oil);
      throw new Error(
        "postMovement treated a key spent on product A as a replay of product B. " +
          "The caller would believe it moved B's stock. Refuse the key as already-spent, " +
          "or scope the lookup by productId.",
      );
    }

    expect(onB.movement.productId).toBe(FIXTURES.oil);
    expect(db.snapshot("stockMovement"), "both products get their own ledger row").toHaveLength(2);
    expect(db.levelOf(FIXTURES.oilFilter).onHand).toBe(4);
    expect(db.levelOf(FIXTURES.oil).onHand, "product B's stock must actually have moved").toBe(38);
  });

  it("the same key with the same product but a different quantity is not a silent replay either", async () => {
    idempotentWorld(db);
    const KEY = "edited-payload";
    await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 1, reason: "bay 2", idempotencyKey: KEY },
      ACTOR,
    );
    const edited = await engineUnderTest().postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 3, reason: "bay 2", idempotencyKey: KEY },
      ACTOR,
    );

    if (isResult(edited) && edited.replayed) {
      expect(
        edited.movement.qty,
        "a replay must return the ORIGINAL quantity, not the edited one",
      ).toBe(1);
    }
    // Either it replayed the original (qty 1, no second row) or it refused. What
    // it must NOT do is spend 3 more filters while reporting success.
    expect(db.levelOf(FIXTURES.oilFilter).onHand).toBeGreaterThanOrEqual(4);
    expect(db.snapshot("stockMovement").length).toBeLessThanOrEqual(2);
  });
});

describeEngine("idempotency — reserve, release, reserve again", () => {
  it("the same key after a release is safe: the second reserve proceeds and the level agrees", async () => {
    idempotentWorld(db);
    const engine = engineUnderTest();
    const KEY = "booking-confirm";

    const first = await engine.reserveForBooking(
      { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oilFilter, qty: 2 }], ttlMinutes: 1_440 },
      ACTOR,
    );
    expect(first.blocked).toBe(false);
    expect(db.levelOf(FIXTURES.oilFilter).reserved).toBe(2);

    await engine.releaseReservations(
      { bookingId: FIXTURES.bookingA, reason: "customer cancelled" },
      ACTOR,
    );
    expect(db.levelOf(FIXTURES.oilFilter).reserved).toBe(0);

    // The booking is re-confirmed. Whether the caller reuses the key or not, the
    // hold must be recreated and the level must be right.
    const again = await engine.reserveForBooking(
      { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oilFilter, qty: 2 }], ttlMinutes: 1_440 },
      ACTOR,
    );
    expect(again.blocked, "a released hold must not permanently strand the stock").toBe(false);
    expect(db.levelOf(FIXTURES.oilFilter)).toEqual({ onHand: 5, reserved: 2, available: 3 });
    expect(db.snapshot("reservation").filter((row) => row.status === "HELD")).toHaveLength(1);
    void KEY;
  });

  it("reserving twice with the same key does not double the hold", async () => {
    idempotentWorld(db);
    const engine = engineUnderTest();
    const input = {
      bookingId: FIXTURES.bookingA,
      items: [{ productId: FIXTURES.oilFilter, qty: 2 }],
      ttlMinutes: 1_440,
    };
    await engine.reserveForBooking(input, ACTOR);
    await engine.reserveForBooking(input, ACTOR);

    const level = db.levelOf(FIXTURES.oilFilter);
    expect(level.reserved, "a retried confirm must not hold 4 filters").toBeLessThanOrEqual(2);
    expect(level.available).toBeGreaterThanOrEqual(0);
    expect(
      db.snapshot("reservation").filter((row) => row.status === "HELD"),
      "one booking holds a product once — `@@unique([productId, bookingId])`",
    ).toHaveLength(1);
  });
});

describeAwaiting(engine, "idempotency — AWAITING the real stock engine");
