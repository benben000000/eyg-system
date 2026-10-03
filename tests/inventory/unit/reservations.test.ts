// @vitest-environment node
/**
 * A7 · CI/CD & QA — reservations: the promise the shop makes before the customer
 * arrives.
 * ============================================================================
 * WHY A RESERVATION IS NOT A DECREMENT
 * -----------------------------------
 * `onHand` is what is physically on the shelf. `reserved` is what is physically
 * there but already spoken for. Decrementing `onHand` on reserve would be simpler
 * and wrong: if the booking cancels, the part is still on the shelf and the shelf
 * must say so. If the shop never shows up at all, the hold has to expire on its
 * own — which is the entire reason `Reservation.expiresAt` exists.
 *
 * THE FULL LIFECYCLE, AND WHAT MUST HOLD AT EVERY STEP
 * ----------------------------------------------------
 *   confirm  → reserve   available drops, onHand does NOT, ledger gains RESERVE
 *   cancel   → release   available returns, ledger gains RELEASE
 *   complete → consume   onHand drops, reserved drops, available is UNCHANGED
 *   never    → expire    available returns, status EXPIRED, ledger gains RELEASE
 *
 * The two arithmetic facts a shop lives by:
 *
 *   • `onHand` changes ONLY on consume / shrink / adjust / receive / transfer.
 *     A reserve or a release moves `reserved` and touches nothing else.
 *   • A consume moves `onHand` and `reserved` together, so `available` — the
 *     number a promise is made against — does not move when a job is finished.
 *     If it did, finishing a job would silently increase what the shop can sell.
 *
 * AT EVERY STEP the ledger and the held level must agree:
 *   replay(ledger).onHand === StockLevel.onHand
 * and at the end: `final onHand === opening + received - consumed ± adjusted`.
 *
 * WHAT RUNS TODAY: the TTL arithmetic and the status machine, checked against the
 * contract's own wording and against the schema. Both are places where a
 * "default 24 hours" written in one file and a `@@index([status, expiresAt])`
 * written in another can quietly disagree.
 *
 * WHAT WAITS ON A2: every behavioural assertion.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";

import { RESERVATION_STATUSES, type ReservationStatusValue } from "@/lib/inventory-types";

import { createFakeDb, type FakeDb } from "../support/fake-prisma";
import { FIXTURES, ONE_DAY_MS, PINNED_NOW, seedCatalogue, seedOne, seedPmsService } from "../support/fixtures";
import { reserveConditional, replayLedger } from "../support/reference-engine";
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
    "@/lib/server/inventory/reservations",
    "@/lib/server/inventory/engine",
    "@/lib/server/inventory/index",
    "@/lib/server/inventory",
  ],
  [
    capability("postMovement", ["postStockMovement", "move"], () => true),
    capability("reserveForBooking", ["reserve", "reserveParts"], () => true),
    capability("releaseReservations", ["release", "releaseForBooking"], () => true),
    capability("consumeReservations", ["consume", "consumeForBooking"], () => true),
    capability("expireReservations", ["expire", "expireStaleHolds", "sweepExpiredReservations"], () => true),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Runs today
// ─────────────────────────────────────────────────────────────────────────────

describe("reservations — the contract's TTL and status rules are unambiguous", () => {
  it("the default TTL is 24 hours, in minutes, and says why", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("/** Default 24h. A hold that never expires becomes a permanent leak. */");
    expect(types).toContain("ttlMinutes?: number;");
    // 24h in minutes, not 24 minutes and not 24 days. Written as a literal so
    // the unit cannot be silently changed.
    expect(ONE_DAY_MS / 60_000).toBe(1_440);
  });

  it("the schema indexes the sweep the cron depends on", () => {
    // `expireReservations` is a `WHERE status = 'HELD' AND expiresAt < now()` scan.
    // Without `@@index([status, expiresAt])` that scan is a table scan on a table
    // that grows every time a part is reserved — on a shop's single small VPS.
    const schema = readRepoFile("prisma/schema.prisma");
    const reservation = /model Reservation \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(reservation, "Reservation block not found in prisma/schema.prisma").not.toBe("");
    expect(reservation).toContain("@@index([status, expiresAt])");
    expect(reservation, "expiresAt must be a plain column so the sweep can compare it to now()").toMatch(
      /^\s*expiresAt\s+DateTime\s*$/m,
    );
    expect(
      reservation,
      "a booking may hold several products, so the unique key must be the PAIR",
    ).toContain("@@unique([productId, bookingId])");
  });

  it("every status the schema declares is one the contract can return", () => {
    const schema = readRepoFile("prisma/schema.prisma");
    const declared = /enum ReservationStatus \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    const fromSchema = declared
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("/"))
      .sort();
    expect(fromSchema).toEqual([...RESERVATION_STATUSES].sort());
  });

  it("the status machine has no dead ends — every status can reach a terminal one", () => {
    // A status nobody can leave is a promise nobody can take back, which is the
    // leak the TTL exists to prevent. Terminal = CONSUMED / RELEASED / EXPIRED.
    const terminal: ReadonlySet<ReservationStatusValue> = new Set(["CONSUMED", "RELEASED", "EXPIRED"]);
    const transitions: Readonly<Record<ReservationStatusValue, readonly ReservationStatusValue[]>> = {
      HELD: ["CONSUMED", "RELEASED", "EXPIRED"],
      CONSUMED: [],
      RELEASED: [],
      EXPIRED: [],
    };
    for (const status of RESERVATION_STATUSES) {
      expect(transitions[status], `${status} has no declared transitions`).toBeDefined();
      if (terminal.has(status)) {
        expect(transitions[status].length, `${status} is terminal but declares an exit`).toBe(0);
      } else {
        expect(transitions[status].length, `${status} cannot reach a terminal status`).toBeGreaterThan(0);
        expect(
          transitions[status].every((next) => terminal.has(next)),
          `${status} exits to a non-terminal status`,
        ).toBe(true);
      }
    }
    expect([...terminal].sort()).toEqual(["CONSUMED", "EXPIRED", "RELEASED"]);
  });

  it("a release reason is mandatory in the contract, matching the brief's 'every write has a reason'", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const release = /export interface ReleaseReservationsInput \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(release).toContain("reason: string;");
    expect(release).toContain("statuses?: ReservationStatusValue[];");
    expect(release).toContain("/** Release only HELD rows. Consumed ones are already gone from the shelf. */");
  });

  it("the reference CAS already satisfies the arithmetic the lifecycle depends on", async () => {
    // Reserve does not touch onHand. This is proved against the reference
    // implementation rather than asserted in prose, because the arithmetic is the
    // part that is easy to get subtly wrong and hard to notice.
    const db = createFakeDb({ now: () => PINNED_NOW });
    seedOne(db, FIXTURES.oilFilter, { onHand: 6, reserved: 0 });

    expect(db.levelOf(FIXTURES.oilFilter)).toEqual({ onHand: 6, reserved: 0, available: 6 });
    await reserveConditional(db, {
      productId: FIXTURES.oilFilter,
      bookingId: FIXTURES.bookingA,
      qty: 4,
      now: PINNED_NOW,
    });
    expect(db.levelOf(FIXTURES.oilFilter), "a reserve must not move onHand").toEqual({
      onHand: 6,
      reserved: 4,
      available: 2,
    });
    const held = db.snapshot("reservation");
    expect(held).toHaveLength(1);
    expect(held[0]?.expiresAt, "the hold must carry an expiry").toBeTruthy();

    expect((held[0]?.expiresAt.getTime() ?? 0) - PINNED_NOW.getTime()).toBe(ONE_DAY_MS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing: the full lifecycle
// ─────────────────────────────────────────────────────────────────────────────

const describeEngine = engine.ready ? describe : describe.skip;
const engineUnderTest = (): StockEngineSurface => surface<StockEngineSurface>(engine);

/** Opens the world a PMS booking runs against. */
function lifecycleWorld(db: FakeDb): void {
  seedCatalogue(db, {
    [FIXTURES.oilFilter]: { onHand: 4, reserved: 0 },
    [FIXTURES.oil]: { onHand: 10, reserved: 0 },
  });
  seedPmsService(db);
}

/**
 * The invariant that must hold after EVERY step of the lifecycle, not just at
 * the end: the ledger replays to exactly the held level.
 */
function assertLedgerAgreesWithLevel(db: FakeDb, step: string): void {
  for (const level of db.snapshot("stockLevel")) {
    const replay = replayLedger(db, level.productId);
    if (replay.movements === 0) continue;
    expect(replay.onHand, `${step}: ledger replays to ${replay.onHand} but the level says ${level.onHand}`).toBe(
      level.onHand,
    );
    expect(level.onHand - level.reserved, `${step}: ${level.productId} is oversold`).toBeGreaterThanOrEqual(0);
  }
}

describeEngine("reservations — the full lifecycle", () => {
  it("reserve on confirm, release on cancel, and the shelf is exactly as it was", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    const before = db.levelOf(FIXTURES.oilFilter);

    const reserved = await engineUnderTest().reserveForBooking(
      { bookingId: FIXTURES.bookingA, fromServices: true, ttlMinutes: 1_440 },
      ACTOR,
    );
    expect(reserved.blocked, "the PMS parts are in stock, so nothing blocks").toBe(false);
    expect(reserved.shortfalls).toEqual([]);
    expect(reserved.reservations.length).toBeGreaterThan(0);
    expect(reserved.reservations.every((row) => row.status === "HELD")).toBe(true);
    expect(new Date(reserved.expiresAt).getTime() - PINNED_NOW.getTime()).toBe(ONE_DAY_MS);

    const held = db.levelOf(FIXTURES.oilFilter);
    expect(held.onHand, "a reserve must not move onHand").toBe(before.onHand);
    expect(held.reserved).toBeGreaterThan(0);
    expect(held.available).toBe(before.available - held.reserved);
    assertLedgerAgreesWithLevel(db, "after reserve");

    const released = await engineUnderTest().releaseReservations(
      { bookingId: FIXTURES.bookingA, reason: "customer cancelled — booked elsewhere" },
      ACTOR,
    );
    expect(released.released).toBeGreaterThan(0);

    const after = db.levelOf(FIXTURES.oilFilter);
    expect(after.onHand, "a release must not move onHand").toBe(before.onHand);
    expect(after.reserved, "a release must give every promise back").toBe(0);
    expect(after.available).toBe(before.available);
    expect(db.snapshot("reservation").every((row) => row.status === "RELEASED")).toBe(true);
    expect(db.snapshot("reservation").every((row) => row.releasedReason === "customer cancelled — booked elsewhere")).toBe(true);
    assertLedgerAgreesWithLevel(db, "after release");
  });

  it("reserve on confirm, consume on complete, and `available` never moves", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    const opening = db.levelOf(FIXTURES.oilFilter);

    await engineUnderTest().reserveForBooking(
      { bookingId: FIXTURES.bookingA, fromServices: true, ttlMinutes: 1_440 },
      ACTOR,
    );
    const held = db.levelOf(FIXTURES.oilFilter);

    const consumed = await engineUnderTest().consumeReservations(FIXTURES.bookingA, ACTOR);
    expect(consumed.consumed.length).toBeGreaterThan(0);
    expect(consumed.movements.length).toBeGreaterThan(0);
    expect(consumed.movements.every((movement) => movement.kind === "CONSUME")).toBe(true);
    expect(consumed.movements.every((movement) => movement.bookingId === FIXTURES.bookingA)).toBe(true);

    const done = db.levelOf(FIXTURES.oilFilter);
    // The part left the shelf AND its promise was settled, so `available` — the
    // number a promise is made against — is unchanged by doing the job.
    expect(done.available, "finishing a job must not increase what the shop can sell").toBe(held.available);
    expect(done.onHand).toBe(held.onHand - held.reserved);
    expect(done.reserved).toBe(0);
    expect(done.onHand).toBe(opening.onHand - held.reserved);
    assertLedgerAgreesWithLevel(db, "after consume");

    // Consuming again is a no-op, not a second decrement.
    const again = await engineUnderTest().consumeReservations(FIXTURES.bookingA, ACTOR);
    expect(again.consumed, "a consumed hold must not be consumable twice").toHaveLength(0);
    expect(db.levelOf(FIXTURES.oilFilter)).toEqual(done);
  });

  it("the final on-hand equals opening + received - consumed +/- adjusted", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    const engine = engineUnderTest();

    await engine.postMovement({ productId: FIXTURES.oil, kind: "OPENING", qty: 10, reason: "opening count" }, ACTOR);
    await engine.postMovement(
      { productId: FIXTURES.oil, kind: "RECEIVE", qty: 24, reason: "PO-2026-0142", reference: "PO-2026-0142" },
      ACTOR,
    );

    // Two jobs, one cancelled and one completed.
    await engine.reserveForBooking(
      { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oil, qty: 2 }] },
      ACTOR,
    );
    await engine.reserveForBooking(
      { bookingId: FIXTURES.bookingB, items: [{ productId: FIXTURES.oil, qty: 3 }] },
      ACTOR,
    );
    await engine.releaseReservations({ bookingId: FIXTURES.bookingA, reason: "no-show" }, ACTOR);
    await engine.consumeReservations(FIXTURES.bookingB, ACTOR);

    const level = db.levelOf(FIXTURES.oil);
    expect(level.onHand, "10 opening + 24 received - 3 consumed").toBe(31);
    expect(level.reserved).toBe(0);
    expect(level.available).toBe(31);

    const replay = replayLedger(db, FIXTURES.oil);
    expect(replay.onHand).toBe(31);
    expect(replay.lastOnHandAfter).toBe(31);
    expect(replay.reserved).toBe(0);
  });

  it("an expired hold is released on its own, without anyone remembering to", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    await engineUnderTest().reserveForBooking(
      { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oilFilter, qty: 2 }], ttlMinutes: 1_440 },
      ACTOR,
    );
    expect(db.levelOf(FIXTURES.oilFilter).reserved).toBe(2);

    // Nothing has expired yet.
    const early = await engineUnderTest().expireReservations(PINNED_NOW, ACTOR);
    expect(early.expired).toBe(0);
    expect(db.levelOf(FIXTURES.oilFilter).reserved).toBe(2);

    // A minute past the TTL.
    const later = new Date(PINNED_NOW.getTime() + ONE_DAY_MS + 60_000);
    const sweep = await engineUnderTest().expireReservations(later, ACTOR);
    expect(sweep.expired).toBe(1);

    const level = db.levelOf(FIXTURES.oilFilter);
    expect(level.reserved, "an expired hold must give the promise back").toBe(0);
    expect(level.onHand, "an expiry must not move onHand").toBe(4);
    expect(level.available).toBe(4);
    expect(db.snapshot("reservation")[0]?.status).toBe("EXPIRED");
    expect(db.snapshot("reservation")[0]?.releasedAt).not.toBeNull();
    assertLedgerAgreesWithLevel(db, "after expiry");
  });

  it("the sweep is idempotent — running it twice does not double-release", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    await engineUnderTest().reserveForBooking(
      { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oilFilter, qty: 2 }] },
      ACTOR,
    );
    const later = new Date(PINNED_NOW.getTime() + ONE_DAY_MS + 1_000);

    const first = await engineUnderTest().expireReservations(later, ACTOR);
    const after = db.levelOf(FIXTURES.oilFilter);
    const second = await engineUnderTest().expireReservations(later, ACTOR);

    expect(first.expired).toBe(1);
    expect(second.expired, "a second sweep must find nothing left to expire").toBe(0);
    expect(db.levelOf(FIXTURES.oilFilter)).toEqual(after);
    expect(after.reserved).toBe(0);
    expect(after.available).toBe(4);
  });

  it("release touches only HELD rows by default — a consumed part is not given back", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    const engine = engineUnderTest();

    await engine.reserveForBooking(
      { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oilFilter, qty: 1 }] },
      ACTOR,
    );
    await engine.reserveForBooking(
      { bookingId: FIXTURES.bookingB, items: [{ productId: FIXTURES.oilFilter, qty: 1 }] },
      ACTOR,
    );
    await engine.consumeReservations(FIXTURES.bookingA, ACTOR);

    const afterConsume = db.levelOf(FIXTURES.oilFilter);
    expect(afterConsume.reserved).toBe(1);

    await engine.releaseReservations({ bookingId: FIXTURES.bookingA, reason: "late cancellation" }, ACTOR);
    const afterRelease = db.levelOf(FIXTURES.oilFilter);
    expect(afterRelease.reserved, "releasing a CONSUMED hold would hand back stock that left the shelf").toBe(1);
    expect(afterRelease.onHand, "and would put an already-used part back on the shelf").toBe(afterConsume.onHand);
    expect(afterRelease.available).toBe(afterConsume.available);
  });

  it("a zero or negative TTL is refused rather than creating a hold that expires instantly", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    const before = db.levelOf(FIXTURES.oilFilter);
    for (const ttlMinutes of [0, -30]) {
      const result = await engineUnderTest().reserveForBooking(
        { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oilFilter, qty: 1 }], ttlMinutes },
        ACTOR,
      );
      // A hold that expires the instant it is made is a reservation that never
      // existed; the alternative — accepting it — is a promise the shop cannot keep.
      expect(result.reservations, `ttlMinutes=${ttlMinutes} created a hold`).toHaveLength(0);
      expect(result.blocked).toBe(true);
      expect(db.levelOf(FIXTURES.oilFilter)).toEqual(before);
    }
  });

  it("a reservation carries the product's name and SKU so staff can read it at a glance", async () => {
    const db = createFakeDb({ now: () => PINNED_NOW });
    lifecycleWorld(db);
    const result = await engineUnderTest().reserveForBooking(
      { bookingId: FIXTURES.bookingA, items: [{ productId: FIXTURES.oilFilter, qty: 1 }] },
      ACTOR,
    );
    const row = result.reservations[0];
    expect(row?.productSku, "a hold a mechanic cannot identify is not usable").toBe("FLT-oil-honda-fit");
    expect(row?.productName).toBe("Oil filter — Honda Fit / City");
    expect(row?.bookingReference).toBeTruthy();
  });
});

describeAwaiting(engine, "reservations — AWAITING the real stock engine");
