// @vitest-environment node
/**
 * A7 · CI/CD & QA — THE CONCURRENCY SUITE. The most important file in this build.
 * ============================================================================
 * THE INVARIANT
 * -------------
 *     available = onHand - reserved        and available is NEVER negative
 *
 * Overselling the last oil filter does not mean a spreadsheet is wrong. It means
 * a customer arrives, the bay is occupied, and the part is not there. Every
 * write path must **refuse**, never clamp.
 *
 * WHAT THIS FILE ACTUALLY PROVES, IN THREE LAYERS
 * ------------------------------------------------
 * LAYER 1 — the fake's atomicity contract (runs today).
 *   A typed in-memory Prisma fake is only useful if it models the one database
 *   behaviour the inventory depends on: a guarded `UPDATE` applies to every row
 *   matching the guard at the instant it runs, or to none. §1 proves that
 *   directly. Without it, nothing below means anything.
 *
 * LAYER 2 — the algorithm differential (runs today).
 *   §2 races the mandated compare-and-swap against the naive read-then-write
 *   across a **declared table of interleavings**, and demands that they differ.
 *   This is what gives the file teeth: it identifies the distinguishing
 *   property, so the naive form is a *detectable* regression rather than a
 *   silent one. It also proves the transaction wrapper is separately
 *   load-bearing, and that `withSerializableRetry` is what saves the naive form
 *   when it is present — which is precisely why removing it is a defect.
 *
 *   What Layer 2 does NOT prove: that A2 wrote the conditional version. That is
 *   Layer 3.
 *
 * LAYER 3 — A2's real engine (§5).
 *   §5 runs the identical declared schedules against the REAL
 *   `reserve()` / `postMovement()` in `src/lib/server/inventory/`. It also asserts
 *   WHICH guard the engine used, by reading back the statement the fake's
 *   recogniser parsed — so "the engine used the conditional write" is an
 *   observation, not an assumption.
 *
 *   That layer only became possible because the engine writes the guarded `UPDATE`
 *   as raw SQL, which a Prisma-shaped fake cannot execute. `support/fake-prisma.ts`
 *   therefore recognises exactly that one statement's grammar and THROWS on
 *   anything else, so it can never degrade into a no-op that makes these
 *   assertions vacuous.
 *
 * WHAT THIS FILE STILL CANNOT PROVE
 * ---------------------------------
 * A fake models a database; it is not a database. The isolation level, `P2034`
 * under genuine contention, and `P2002` against a real index need Postgres. §6
 * records the exact reproduction as `it.todo` and the procedure is written up in
 * `docs/inventory-qa/TEST-STRATEGY.md` §4. Blunt version: **this suite proves
 * the code order and the algorithm; only the ephemeral-Postgres job proves the
 * isolation level.** Same gap, and the same owner, as the booking slot race.
 * ============================================================================
 */

import { beforeEach, describe, expect, it } from "vitest";

import { applyStockLevelUpdate, createFakeDb, type FakeDb } from "../support/fake-prisma";
import { createRendezvous, race, type RendezvousHandle } from "../support/rendezvous";
import {
  consumeConditional,
  consumeNaive,
  reserveConditional,
  reserveNaive,
} from "../support/reference-engine";
import { FIXTURES, PINNED_NOW, seedCatalogue, seedOne } from "../support/fixtures";
import {
  capability,
  describeAwaiting,
  describeWhenReady,
  resolveInventoryModule,
  surface,
  type ActorContext,
  type StockEngineSurface,
} from "../support/module-resolver";

// ── The world: one oil filter, one unit on the shelf ────────────────────────

/**
 * The last filter in the shop. `available === 1` is the whole scenario: two
 * callers, one unit, one winner. Any test that does not start from this number
 * is not testing the race.
 */
const LAST_UNIT: { productId: string; onHand: number } = {
  productId: FIXTURES.oilFilter,
  onHand: 1,
};

function worldWithOneUnitLeft(db: FakeDb): void {
  seedOne(db, LAST_UNIT.productId, { onHand: 1, reserved: 0 });
}

function worldWith(db: FakeDb, productId: string, onHand: number, reserved: number): void {
  seedOne(db, productId, { onHand, reserved });
}

/** `available` may never be negative, for any product, at any instant. */
function assertInvariantNeverBroken(db: FakeDb, note: string): void {
  for (const level of db.snapshot("stockLevel")) {
    const available = level.onHand - level.reserved;
    expect(
      available,
      `${note}: ${level.productId} is oversold (onHand=${level.onHand}, reserved=${level.reserved})`,
    ).toBeGreaterThanOrEqual(0);
    expect(level.reserved, `${note}: ${level.productId} has reserved > onHand`).toBeLessThanOrEqual(level.onHand);
  }
}

let db: FakeDb;
let serializableDb: FakeDb;

beforeEach(() => {
  db = createFakeDb({ serializable: false, now: () => PINNED_NOW });
  serializableDb = createFakeDb({ serializable: true, now: () => PINNED_NOW });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The fake's atomicity contract
// ─────────────────────────────────────────────────────────────────────────────

describe("concurrency — the fake models a single UPDATE as atomic", () => {
  it("two concurrent guarded updates against one row: exactly one applies", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 });

    // `onHand: 5, reserved: 0` is the guard: it matches the row exactly as it
    // stands now, and stops matching the moment anything moves it.
    const guarded = (): Promise<{ count: number }> =>
      db.stockLevel.updateMany({
        where: { productId: FIXTURES.oilFilter, onHand: 5, reserved: 0 },
        data: { reserved: { increment: 5 } },
      });

    const [first, second] = await race([{ run: guarded }, { run: guarded }]);

    expect(first.count + second.count, "a guarded UPDATE is all-or-nothing").toBe(1);
    expect(db.levelOf(FIXTURES.oilFilter)).toEqual({ onHand: 5, reserved: 5, available: 0 });
  });

  it("a guarded update that no longer matches returns count 0 and changes nothing", async () => {
    seedOne(db, FIXTURES.oilFilter, { onHand: 5, reserved: 0 });
    const stale = await db.stockLevel.updateMany({
      where: { productId: FIXTURES.oilFilter, onHand: 99 },
      data: { reserved: { increment: 5 } },
    });
    expect(stale.count).toBe(0);
    expect(db.levelOf(FIXTURES.oilFilter)).toEqual({ onHand: 5, reserved: 0, available: 5 });
  });

  it("the predicate and the write are one uninterrupted step, not two awaits", async () => {
    // If the fake evaluated the guard, then awaited, then wrote, a second caller
    // landing in that gap would pass a guard it had already invalidated. Pinning
    // both callers onto the same write proves there is no gap to land in.
    seedOne(db, FIXTURES.oilFilter, { onHand: 1, reserved: 0 });
    const rendezvous = createRendezvous(["pre:stockLevel:write"], 2);
    rendezvous.install(db);

    const guarded = (): Promise<{ count: number }> =>
      db.stockLevel.updateMany({
        where: { productId: FIXTURES.oilFilter, onHand: 1, reserved: 0 },
        data: { reserved: { increment: 1 } },
      });

    const [a, b] = await race([{ run: guarded }, { run: guarded }]);
    expect(rendezvous.releases, "both callers must have reached the write").toBeGreaterThanOrEqual(1);
    expect(a.count + b.count).toBe(1);
  });

  it("a `post:` barrier really does pin both callers to the SAME snapshot", async () => {
    // The load-bearing property of the harness itself. A `pre:` barrier cannot
    // promise this: the second caller may not evaluate its predicate until after
    // the first has written, in which case it simply sees the new value and the
    // race was never tested. `post:` is the only phase that guarantees both
    // callers observed the same committed state — so the schedules below are
    // real, and this test is what makes that claim checkable.
    seedOne(db, FIXTURES.oilFilter, { onHand: 1, reserved: 0 });
    const rendezvous = createRendezvous(["post:stockLevel:read"], 2);
    rendezvous.install(db);

    const observe = async (): Promise<number> => {
      const level = await db.stockLevel.findUnique({ where: { productId: FIXTURES.oilFilter } });
      return level?.onHand ?? -1;
    };

    const [a, b] = await race([
      { run: observe },
      { run: observe },
    ]);

    expect(rendezvous.releases).toBe(1);
    expect([a, b], "both callers must have observed the same committed on-hand").toEqual([1, 1]);
  });

  it("the SQL recogniser REFUSES a statement it does not understand, rather than no-oping it", async () => {
    // This is the property that keeps Layer 3 honest. The engine writes its
    // invariant-bearing `UPDATE` as raw SQL, so the fake recognises exactly one
    // statement's grammar. If an unfamiliar statement were skipped or returned
    // an empty result, every concurrency assertion against the real engine would
    // pass while the engine wrote nothing at all.
    const raw = (statement: string): { sql: string; values: unknown[] } => ({ sql: statement, values: [] });
    const notRecognised = /only `UPDATE "StockLevel"|unrecognised \$queryRaw statement/;

    await expect(db.$queryRaw(raw(`DELETE FROM "StockLevel" WHERE "productId" = 'x'`))).rejects.toThrow(notRecognised);

    await expect(
      db.$queryRaw(raw(`UPDATE "StockMovement" SET "qty" = 0 WHERE "id" = 'x' RETURNING "qty"`)),
    ).rejects.toThrow(notRecognised);

    await expect(
      db.$queryRaw(raw(`SELECT "onHand" FROM "StockLevel"`)),
    ).rejects.toThrow(/SELECT via \$queryRaw is not recognised/);

    // Every one of those was still RECORDED, so a test can see what was attempted.
    expect(db.rawSqlCalls.length).toBe(3);
  });

  it("the recogniser evaluates the guard honestly: a decline writes nothing", () => {
    // A direct test of the recogniser, with no engine in the way. `available = 1`,
    // asking for 2 → the guard fails, zero rows are affected, nothing moves. This
    // is the exact behaviour `UPDATE … RETURNING` gives in Postgres, and it is
    // what makes the whole concurrency claim possible.
    const levels = [{ id: "lvl_1", productId: "p", onHand: 1, reserved: 0, updatedAt: new Date(0) }];
    const holdSql = (qty: number): string =>
      `UPDATE "StockLevel" SET "reserved" = "reserved" + ?, "updatedAt" = now() WHERE "productId" = ? AND "onHand" - "reserved" >= ? RETURNING "onHand", "reserved"`;

    const declined = applyStockLevelUpdate(levels, holdSql(1), [2, "p", 2]);
    expect(declined.affected, "asking for 2 with 1 available must affect no rows").toBe(0);
    expect(declined.returned).toEqual([]);
    expect(levels[0]?.reserved, "a declined statement must not write").toBe(0);

    const accepted = applyStockLevelUpdate(levels, holdSql(1), [1, "p", 1]);
    expect(accepted.affected).toBe(1);
    expect(accepted.returned).toEqual([{ onHand: 1, reserved: 1 }]);
    expect(levels[0]?.reserved).toBe(1);

    // The same statement once more now fails, because the guard is re-read
    // against the row as it now stands. This single line is the whole invariant.
    const again = applyStockLevelUpdate(levels, holdSql(1), [1, "p", 1]);
    expect(again.affected, "the guard is re-evaluated against the row as it now stands").toBe(0);
    expect(levels[0]?.reserved).toBe(1);

    // OPENING is ABSOLUTE (`SET "onHand" = 40`), not additive. Reading it as
    // additive would make the baseline a running total.
    const opened = applyStockLevelUpdate(
      [{ id: "lvl_2", productId: "q", onHand: 0, reserved: 0, updatedAt: new Date(0) }],
      `UPDATE "StockLevel" SET "onHand" = ?, "updatedAt" = now() WHERE "productId" = ? AND "onHand" = 0 AND "reserved" = 0 RETURNING "onHand", "reserved"`,
      [40, "q"],
    );
    expect(opened.affected).toBe(1);
    expect(opened.returned).toEqual([{ onHand: 40, reserved: 0 }]);
  });

  it("a malformed statement is REFUSED rather than approximated", async () => {
    // If a recogniser skipped an unfamiliar statement, every concurrency
    // assertion against the real engine would pass while the engine wrote nothing.
    expect(() =>
      applyStockLevelUpdate(
        [{ id: "l", productId: "p", onHand: 1, reserved: 0 }],
        `UPDATE "StockLevel" SET "onHand" = "onHand" * 2 WHERE "productId" = 'p' RETURNING "onHand", "reserved"`,
        [],
      ),
    ).toThrow(/UNRECOGNISED SQL/);

    // Placeholder/parameter arity is checked too — a mismatch means the statement
    // is not the one the caller thinks it is.
    expect(() =>
      applyStockLevelUpdate(
        [{ id: "l", productId: "p", onHand: 1, reserved: 0 }],
        `UPDATE "StockLevel" SET "reserved" = "reserved" + ? WHERE "productId" = ? AND "onHand" - "reserved" >= ? RETURNING "onHand", "reserved"`,
        [1, "p"],
      ),
    ).toThrow(/UNRECOGNISED SQL/);

    // …and so is the reverse: more parameters than placeholders.
    expect(() =>
      applyStockLevelUpdate(
        [{ id: "l", productId: "p", onHand: 1, reserved: 0 }],
        `UPDATE "StockLevel" SET "reserved" = "reserved" + ? WHERE "productId" = ? AND "onHand" - "reserved" >= ? RETURNING "onHand", "reserved"`,
        [1, "p", 1, "extra"],
      ),
    ).toThrow(/placeholders but 4 values/);
  });

  it("the ledger is append-only at the fake level, not just by convention", async () => {
    seedCatalogue(db);
    await expect(
      db.stockMovement.update({ where: { id: "x" }, data: { qty: 99 } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.stockMovement.delete({ where: { id: "x" } })).rejects.toThrow(/append-only/);
    await expect(db.stockMovement.deleteMany()).rejects.toThrow(/append-only/);
  });

  it("a unique violation surfaces as P2002, so the engine cannot rely on an `if`", async () => {
    seedCatalogue(db);
    await db.reservation.create({
      data: { productId: FIXTURES.oilFilter, bookingId: "bkg_x", qty: 1, status: "HELD" },
    });
    await expect(
      db.reservation.create({ data: { productId: FIXTURES.oilFilter, bookingId: "bkg_x", qty: 1, status: "HELD" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · THE LAST UNIT — the algorithm differential
// ─────────────────────────────────────────────────────────────────────────────

interface Interleaving {
  readonly label: string;
  /** `"<phase>:<table>:<verb>"` keys that form the rendezvous. */
  readonly barrierOps: readonly string[];
  /** The arrival prefix this configuration must produce for the claim to hold. */
  readonly expectedArrivals: readonly string[];
  /** How many barrier generations must have completed. */
  readonly expectedReleases: number;
  readonly why: string;
}

const READ = "stockLevel:read";
const WRITE = "stockLevel:write";
const HOLD = "reservation:write";

/**
 * The declared schedules. Each row is a different *legal* ordering of two
 * concurrent callers; together they cover every way the check-then-act window
 * can be entered. A row that does not produce its expected arrival order fails
 * the test, so the suite can never claim to have tested a schedule it did not
 * actually run.
 *
 * Arrivals are compared as a **prefix**, not an equality: a losing caller that
 * re-reads after losing its write appends more arrivals, and that is correct
 * behaviour worth seeing rather than hiding.
 */
const INTERLEAVINGS: readonly Interleaving[] = [
  {
    label: "both callers read the same committed snapshot",
    barrierOps: [`post:${READ}`],
    expectedArrivals: [`post:${READ}`, `post:${READ}`],
    expectedReleases: 1,
    why: "Both decide against onHand=1, reserved=0. The canonical check-then-act window.",
  },
  {
    label: "both reads complete, then both writes collide",
    barrierOps: [`post:${READ}`, `pre:${WRITE}`],
    expectedArrivals: [`post:${READ}`, `post:${READ}`, `pre:${WRITE}`, `pre:${WRITE}`],
    expectedReleases: 2,
    why: "The snapshot is pinned AND the write slot is claimed simultaneously.",
  },
  {
    label: "both writes are claimed simultaneously",
    barrierOps: [`pre:${WRITE}`],
    expectedArrivals: [`pre:${WRITE}`, `pre:${WRITE}`],
    expectedReleases: 1,
    why: "The guard is evaluated against state the loser has not yet seen.",
  },
  {
    label: "full lockstep through read and write",
    barrierOps: [`post:${READ}`, `post:${WRITE}`],
    // Four entries, not six. Under the conditional write the loser never reaches
    // hold creation: it re-reads instead. That is the behaviour worth pinning —
    // a loser that still created a hold would be the ghost-hold bug.
    expectedArrivals: [`post:${READ}`, `post:${READ}`, `post:${WRITE}`, `post:${WRITE}`],
    expectedReleases: 2,
    why: "Both callers read the same snapshot and both writes collide; only one may proceed to a hold.",
  },
];

function reserveWith(
  target: FakeDb,
  impl: (db: FakeDb, input: { productId: string; bookingId: string; qty: number; now: Date }) => Promise<{ ok: boolean; available: number }>,
  bookingId: string,
): Promise<{ ok: boolean; available: number }> {
  return impl(target, { productId: LAST_UNIT.productId, bookingId, qty: 1, now: PINNED_NOW });
}

describe("concurrency — two simultaneous reservations for the LAST UNIT", () => {
  it.each(INTERLEAVINGS)(
    "conditional write: exactly one success — $label",
    async (interleaving) => {
      worldWithOneUnitLeft(db);
      const rendezvous = createRendezvous(interleaving.barrierOps, 2);
      rendezvous.install(db);

      const [a, b] = await race([
        { run: () => reserveWith(db, reserveConditional, "bkg_a") },
        { run: () => reserveWith(db, reserveConditional, "bkg_b") },
      ]);

      expect(
        rendezvous.arrivals.slice(0, interleaving.expectedArrivals.length),
        `the declared schedule did not run: ${JSON.stringify(rendezvous.arrivals)}`,
      ).toEqual(interleaving.expectedArrivals);
      expect(rendezvous.releases, "the barrier generations must have completed").toBeGreaterThanOrEqual(
        interleaving.expectedReleases,
      );

      const winners = [a, b].filter((outcome) => outcome.ok);
      expect(winners, `both callers reserved the last unit: ${JSON.stringify([a, b])}`).toHaveLength(1);

      const level = db.levelOf(LAST_UNIT.productId);
      expect(level).toEqual({ onHand: 1, reserved: 1, available: 0 });
      assertInvariantNeverBroken(db, interleaving.label);

      // The loser must be told the truth so the UI can say "0 left", and must
      // leave no trace: one hold, not two.
      const loser = [a, b].find((outcome) => !outcome.ok);
      expect(loser?.available).toBe(0);
      expect(db.snapshot("reservation")).toHaveLength(1);
    },
  );

  it.each(INTERLEAVINGS)(
    "REGRESSION SENTINEL: read-then-write double-sells the last unit — $label",
    async (interleaving) => {
      // This is the whole reason the suite is a *differential*. If the naive
      // implementation did NOT fail here, the conditional one would prove
      // nothing and a refactor back to it would go unnoticed. The assertion is
      // deliberately inverted: it asserts the BUG is present.
      worldWithOneUnitLeft(db);
      const rendezvous = createRendezvous(interleaving.barrierOps, 2);
      rendezvous.install(db);

      const [a, b] = await race([
        { run: () => reserveWith(db, reserveNaive, "bkg_a") },
        { run: () => reserveWith(db, reserveNaive, "bkg_b") },
      ]);

      expect(rendezvous.releases, "the barrier generations must have completed").toBeGreaterThanOrEqual(
        interleaving.expectedReleases,
      );

      const winners = [a, b].filter((outcome) => outcome.ok);
      const level = db.levelOf(LAST_UNIT.productId);
      expect(
        winners.length,
        `read-then-write did not double-sell under "${interleaving.label}" (available=${level.available}). ` +
          "If this fails, the schedule is no longer a race and the conditional implementation is untested.",
      ).toBe(2);
      expect(level.available, `read-then-write did not oversell: ${JSON.stringify(level)}`).toBeLessThan(0);
      expect(level.reserved).toBe(2);
    },
  );

  it("across the whole table the naive form breaks the invariant and the conditional form never does", async () => {
    // The summary claim, proved by running every declared schedule through both
    // implementations rather than by inferring it from any one of them.
    const tally: {
      naiveOversold: string[];
      conditionalOversold: string[];
      naiveDoubleSold: string[];
      conditionalDoubleSold: string[];
    } = {
      naiveOversold: [],
      conditionalOversold: [],
      naiveDoubleSold: [],
      conditionalDoubleSold: [],
    };

    for (const interleaving of INTERLEAVINGS) {
      const naiveDb = createFakeDb({ serializable: false, now: () => PINNED_NOW });
      worldWithOneUnitLeft(naiveDb);
      const naiveRendezvous: RendezvousHandle = createRendezvous(interleaving.barrierOps, 2);
      naiveRendezvous.install(naiveDb);
      const naiveResults = await race([
        { run: () => reserveWith(naiveDb, reserveNaive, "bkg_a") },
        { run: () => reserveWith(naiveDb, reserveNaive, "bkg_b") },
      ]);
      if (naiveDb.levelOf(LAST_UNIT.productId).available < 0) tally.naiveOversold.push(interleaving.label);
      if (naiveResults.filter((outcome) => outcome.ok).length > 1) tally.naiveDoubleSold.push(interleaving.label);

      const casDb = createFakeDb({ serializable: false, now: () => PINNED_NOW });
      worldWithOneUnitLeft(casDb);
      const casRendezvous: RendezvousHandle = createRendezvous(interleaving.barrierOps, 2);
      casRendezvous.install(casDb);
      const casResults = await race([
        { run: () => reserveWith(casDb, reserveConditional, "bkg_a") },
        { run: () => reserveWith(casDb, reserveConditional, "bkg_b") },
      ]);
      if (casDb.levelOf(LAST_UNIT.productId).available < 0) tally.conditionalOversold.push(interleaving.label);
      if (casResults.filter((outcome) => outcome.ok).length > 1) tally.conditionalDoubleSold.push(interleaving.label);
    }

    expect(
      tally.conditionalOversold,
      "the conditional write must survive every declared interleaving",
    ).toEqual([]);
    expect(tally.conditionalDoubleSold, "and must never let two callers win the last unit").toEqual([]);
    expect(
      tally.naiveDoubleSold.length,
      "at least one declared schedule must double-sell under read-then-write, or this suite cannot " +
        "distinguish the two implementations and proves nothing",
    ).toBeGreaterThan(0);
    expect(tally.naiveOversold.length, "and at least one must drive available negative").toBeGreaterThan(0);
  });

  it("exactly one HELD reservation exists and it belongs to the winner", async () => {
    worldWithOneUnitLeft(db);
    const rendezvous = createRendezvous([`post:${READ}`, `pre:${WRITE}`], 2);
    rendezvous.install(db);

    const [a, b] = await race([
      { run: () => reserveWith(db, reserveConditional, "bkg_a") },
      { run: () => reserveWith(db, reserveConditional, "bkg_b") },
    ]);

    const winnerBookingId = a.ok ? "bkg_a" : "bkg_b";
    const held = db.snapshot("reservation").filter((row) => row.status === "HELD");
    expect(held).toHaveLength(1);
    expect(held[0]?.bookingId).toBe(winnerBookingId);
    expect(held[0]?.qty).toBe(1);
  });

  it("the refuser's own booking holds nothing — a refused reserve creates no ghost hold", async () => {
    worldWithOneUnitLeft(db);
    const rendezvous = createRendezvous([`post:${READ}`, `pre:${WRITE}`], 2);
    rendezvous.install(db);

    await race([
      { run: () => reserveWith(db, reserveConditional, "bkg_a") },
      { run: () => reserveWith(db, reserveConditional, "bkg_b") },
    ]);

    const bookings = db.snapshot("reservation").map((row) => row.bookingId);
    expect(bookings).toHaveLength(1);
  });
});

describe("concurrency — the transaction wrapper is separately load-bearing", () => {
  it("naive read-then-write INSIDE a serialisable transaction survives (that is what SERIALIZABLE buys)", async () => {
    // Recorded honestly: with `withSerializableRetry` in place, the naive form
    // does NOT oversell, because the loser's write is aborted with P2034 and the
    // retry re-reads. That is the booking engine's guarantee, and it is real.
    worldWithOneUnitLeft(serializableDb);
    const rendezvous = createRendezvous([`post:${READ}`, `pre:${WRITE}`], 2);
    rendezvous.install(serializableDb);

    const attempt = (bookingId: string) => (): Promise<{ ok: boolean; available: number }> =>
      serializableDb.withSerializableRetry(async () =>
        reserveNaive(serializableDb, { productId: LAST_UNIT.productId, bookingId, qty: 1, now: PINNED_NOW }),
      );

    await race([{ run: attempt("bkg_a") }, { run: attempt("bkg_b") }]);

    expect(serializableDb.levelOf(LAST_UNIT.productId).reserved).toBeLessThanOrEqual(1);
    expect(serializableDb.levelOf(LAST_UNIT.productId).available).toBeGreaterThanOrEqual(0);
    assertInvariantNeverBroken(serializableDb, "naive + serialisable + retry");
  });

  it("the SAME naive code WITHOUT the serialisable wrapper oversells — the wrapper is the difference", async () => {
    worldWithOneUnitLeft(db);
    const rendezvous = createRendezvous([`post:${READ}`, `pre:${WRITE}`], 2);
    rendezvous.install(db);

    await race([
      { run: () => reserveWith(db, reserveNaive, "bkg_a") },
      { run: () => reserveWith(db, reserveNaive, "bkg_b") },
    ]);

    const level = db.levelOf(LAST_UNIT.productId);
    expect(
      level.available,
      `naive read-then-write with no serialisable transaction oversold the last unit: ${JSON.stringify(level)}`,
    ).toBeLessThan(0);
  });

  it("a write that collides with an in-flight transaction is aborted with P2034 and genuinely retried", async () => {
    // The load-bearing claim about the `serializable: true` mode: a conflict is
    // DETECTED and the retry actually re-runs. If the fake quietly shared one
    // lock token between transactions, this test would still pass while nothing
    // was ever aborted — so the abort itself is asserted, not just the outcome.
    worldWithOneUnitLeft(serializableDb);

    let releaseSlow: () => void = () => undefined;
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    const slow = serializableDb.$transaction(async () => {
      await serializableDb.stockLevel.update({
        where: { productId: LAST_UNIT.productId },
        data: { reserved: { increment: 1 }, updatedAt: PINNED_NOW },
      });
      await slowGate;
    });

    // Wait for the slow transaction to take its row lock. Bounded on turns, not
    // on the clock, so it cannot hang and cannot be slow.
    for (let spin = 0; spin < 2_000 && serializableDb.locksHeld().length === 0; spin += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(serializableDb.locksHeld(), "the slow transaction must hold a row lock").toContain(
      `stockLevel:lvl_${LAST_UNIT.productId}`,
    );

    let attempts = 0;
    const outcome = await serializableDb
      .withSerializableRetry(async () => {
        attempts += 1;
        await serializableDb.stockLevel.update({
          where: { productId: LAST_UNIT.productId },
          data: { reserved: { increment: 1 }, updatedAt: PINNED_NOW },
        });
      })
      .then(
        () => "committed",
        (error: unknown) => (error as { code?: string }).code ?? "no-code",
      );

    expect(outcome, "a conflicting write must be aborted, not silently applied").toBe("P2034");
    expect(attempts, "withSerializableRetry must have retried").toBe(3);
    expect(
      serializableDb.levelOf(LAST_UNIT.productId).reserved,
      "the aborted transaction must not have written",
    ).toBe(1);

    releaseSlow();
    await slow;
    expect(serializableDb.locksHeld(), "locks are released when the transaction ends").toEqual([]);
    expect(serializableDb.openTransactions()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · Many callers, not just two
// ─────────────────────────────────────────────────────────────────────────────

describe("concurrency — N simultaneous callers", () => {
  it("8 callers for the last unit: still exactly one winner", async () => {
    worldWithOneUnitLeft(db);
    const parties = 8;
    const rendezvous = createRendezvous([`post:${READ}`, `pre:${WRITE}`], parties);
    rendezvous.install(db);

    const actors = Array.from({ length: parties }, (_, index) => ({
      run: () => reserveWith(db, reserveConditional, `bkg_${index}`),
    }));
    const results = await race(actors);

    expect(rendezvous.releases, "all 8 callers must have shared the first snapshot").toBeGreaterThanOrEqual(1);
    const winners = results.filter((outcome) => outcome.ok);
    expect(winners).toHaveLength(1);
    expect(db.levelOf(LAST_UNIT.productId)).toEqual({ onHand: 1, reserved: 1, available: 0 });
    expect(db.snapshot("reservation")).toHaveLength(1);
    assertInvariantNeverBroken(db, "8 callers, 1 unit");
  });

  it("N concurrent consumes of an INSUFFICIENT quantity: available never goes negative and the total consumed never exceeds on-hand", async () => {
    // 10 on the shelf, 10 already promised, 6 bays each wanting 3. At most 3 can
    // be served. The two things that must never happen: on-hand going below the
    // total consumed, and `available` dipping below zero at any instant.
    const productId = FIXTURES.brakePads;
    worldWith(db, productId, 10, 10);
    const parties = 6;
    const qtyEach = 3;

    const rendezvous = createRendezvous([`pre:${WRITE}`], parties);
    rendezvous.install(db);

    const actors = Array.from({ length: parties }, (_, index) => ({
      run: () => consumeConditional(db, { productId, bookingId: `bkg_${index}`, qty: qtyEach, now: PINNED_NOW }),
    }));
    const results = await race(actors);

    expect(rendezvous.releases, "all 6 consumers must have reached the write").toBeGreaterThanOrEqual(1);

    const consumed = results.filter((outcome) => outcome.ok).reduce((total, outcome) => total + outcome.qty, 0);
    const level = db.levelOf(productId);

    expect(consumed, "more was consumed than the shelf held").toBeLessThanOrEqual(10);
    expect(consumed, "every refusal must be a real refusal, not a lost CAS").toBeGreaterThan(0);
    expect(consumed, "the CAS retry loop must not starve callers who could be served").toBe(9);
    expect(level.onHand).toBe(10 - consumed);
    expect(level.available, `available went negative: ${JSON.stringify(level)}`).toBeGreaterThanOrEqual(0);
    assertInvariantNeverBroken(db, "6 concurrent consumes of an insufficient quantity");

    // Every refusal must name a real shortfall, not an internal CAS artefact.
    for (const refusal of results.filter((outcome) => !outcome.ok)) {
      expect(refusal.available, "a refusal must report the true available").toBeGreaterThanOrEqual(0);
    }
  });

  it("the same 6 concurrent naive consumes DO oversell — the differential at N", async () => {
    const productId = FIXTURES.brakePads;
    worldWith(db, productId, 10, 0);
    const parties = 6;
    const rendezvous = createRendezvous([`pre:${WRITE}`], parties);
    rendezvous.install(db);

    const actors = Array.from({ length: parties }, (_, index) => ({
      run: () => consumeNaive(db, { productId, bookingId: `bkg_${index}`, qty: 3, now: PINNED_NOW }),
    }));
    await race(actors);

    const level = db.levelOf(productId);
    expect(level.onHand, "naive consumes drove on-hand below zero").toBeLessThan(0);
  });

  it("50 concurrent reserves against 7 available units never sell the eighth", async () => {
    worldWith(db, FIXTURES.oil, 7, 0);
    const parties = 50;
    const rendezvous = createRendezvous([`pre:${WRITE}`], parties);
    rendezvous.install(db);

    const actors = Array.from({ length: parties }, (_, index) => ({
      run: () => reserveConditional(db, { productId: FIXTURES.oil, bookingId: `bkg_${index}`, qty: 1, now: PINNED_NOW }),
    }));
    const results = await race(actors);

    const winners = results.filter((outcome) => outcome.ok).length;
    // The CAS retry loop is bounded at 5 attempts, so a 50-way stampede on 7
    // units may serve fewer than 7. The invariant is the ceiling, never the
    // exact count — and it must never exceed it.
    expect(winners, "more units were sold than the shelf held").toBeLessThanOrEqual(7);
    expect(winners, "a 50-way stampede must still serve the stock that exists").toBeGreaterThan(0);
    const level = db.levelOf(FIXTURES.oil);
    expect(level.reserved).toBe(winners);
    expect(level.available).toBe(7 - winners);
    expect(db.snapshot("reservation")).toHaveLength(winners);
    assertInvariantNeverBroken(db, "50 callers, 7 units");
  });

  it("reserves for DIFFERENT products do not block each other", async () => {
    // Serialising on a global lock instead of per-row would turn a 50-line
    // basket into a queue. The CAS is per product, and this proves it.
    seedCatalogue(db, {
      [FIXTURES.oilFilter]: { onHand: 1, reserved: 0 },
      [FIXTURES.oil]: { onHand: 1, reserved: 0 },
      [FIXTURES.wiper]: { onHand: 1, reserved: 0 },
    });
    const results = await Promise.all([
      reserveConditional(db, { productId: FIXTURES.oilFilter, bookingId: "bkg_a", qty: 1, now: PINNED_NOW }),
      reserveConditional(db, { productId: FIXTURES.oil, bookingId: "bkg_a", qty: 1, now: PINNED_NOW }),
      reserveConditional(db, { productId: FIXTURES.wiper, bookingId: "bkg_a", qty: 1, now: PINNED_NOW }),
    ]);
    expect(results.every((outcome) => outcome.ok)).toBe(true);
    assertInvariantNeverBroken(db, "three products, one basket");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · Mixed traffic
// ─────────────────────────────────────────────────────────────────────────────

describe("concurrency — mixed traffic", () => {
  it("reserve and consume racing on the same unit keep available at or above zero", async () => {
    // 4 filters, 2 already promised. A consume (which clears a hold) and a
    // reserve (which takes one) hit the same row from opposite directions.
    const productId = FIXTURES.oilFilter;
    worldWith(db, productId, 4, 2);
    const rendezvous = createRendezvous([`post:${READ}`, `pre:${WRITE}`], 3);
    rendezvous.install(db);

    await race([
      { run: () => consumeConditional(db, { productId, bookingId: "bkg_c", qty: 1, now: PINNED_NOW }) },
      { run: () => consumeConditional(db, { productId, bookingId: "bkg_d", qty: 1, now: PINNED_NOW }) },
      { run: () => reserveConditional(db, { productId, bookingId: "bkg_e", qty: 2, now: PINNED_NOW }) },
    ]);

    const level = db.levelOf(productId);
    expect(level.available).toBeGreaterThanOrEqual(0);
    expect(level.reserved).toBeLessThanOrEqual(level.onHand);
  });

  it("a retry storm still terminates and still refuses", async () => {
    // Every attempt losing the CAS is a legitimate outcome. It must end in a
    // refusal carrying the true availability, not in a clamp or a hang.
    worldWith(db, FIXTURES.oilFilter, 1, 0);
    const outcome = await reserveConditional(
      db,
      { productId: FIXTURES.oilFilter, bookingId: "bkg_a", qty: 5, now: PINNED_NOW },
      3,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.available).toBe(1);
    expect(db.levelOf(FIXTURES.oilFilter)).toEqual({ onHand: 1, reserved: 0, available: 1 });
  });

  it("the invariant holds across a randomised burst of mixed operations", async () => {
    // Deterministic pseudo-randomness: a fixed linear congruential sequence, not
    // `Math.random()`. Same schedule every run, so a failure is reproducible.
    let seedState = 20260311;
    const nextInt = (bound: number): number => {
      seedState = (seedState * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seedState % bound;
    };

    const productId = FIXTURES.oil;
    worldWith(db, productId, 20, 0);

    for (let step = 0; step < 60; step += 1) {
      const qty = 1 + nextInt(3);
      const isReserve = nextInt(2) === 0;
      await (isReserve
        ? reserveConditional(db, { productId, bookingId: `bkg_${step}`, qty, now: PINNED_NOW })
        : consumeConditional(db, { productId, bookingId: `bkg_${step}`, qty, now: PINNED_NOW }));
      assertInvariantNeverBroken(db, `burst step ${step}`);
    }

    const level = db.levelOf(productId);
    expect(level.available).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · A2's real engine — the same schedules, against the real code
// ─────────────────────────────────────────────────────────────────────────────
//
// The mock has to be declared before the engine is imported, and `vi.mock` is
// hoisted, so it lives in its own module. `useFakeDatabase` then swaps the
// database per test, which is what lets a `describeWhenReady` body create one
// database per case instead of sharing a mutable fixture.

import { useFakeDatabase } from "../support/db-mock";
import { seedBooking } from "../support/fixtures";

const engineModule = await resolveInventoryModule(
  [
    "@/lib/server/inventory/stock-engine",
    "@/lib/server/inventory/reservations",
    "@/lib/server/inventory/index",
    "@/lib/server/inventory",
  ],
  [
    capability("postMovement", ["postStockMovement", "move"], () => true),
    capability("reserveForBooking", ["reserve", "reserveParts"], () => true),
    capability("releaseReservations", ["release", "releaseHolds", "releaseForBooking"], () => true),
    capability("consumeReservations", ["consume"], () => true),
    capability("expireReservations", ["expireHolds", "expire", "expireStaleHolds"], () => true),
  ],
);

/** `PostMovementContext` as the engine declares it. */
const ACTOR = { actorId: "usr_manager", actorName: "Ana (Manager)", requestId: "req_concurrency" };

interface EngineOutcome {
  ok: boolean;
  available: number;
  shortfall: number;
}

function reserveViaEngine(engine: StockEngineSurface, bookingId: string, productId: string, qty = 1): Promise<EngineOutcome> {
  return engine
    .reserveForBooking({ bookingId, items: [{ productId, qty }], ttlMinutes: 24 * 60 }, ACTOR)
    .then((result) => {
      const shortfall = result.shortfalls.find((row) => row.productId === productId);
      return {
        ok: result.blocked === false && result.shortfalls.length === 0,
        available: shortfall?.available ?? 0,
        shortfall: shortfall ? shortfall.requested - shortfall.available : 0,
      };
    });
}

/** A fresh database, installed as the one the mocked `prisma` talks to. */
function engineWorld(configure: (target: FakeDb) => void): FakeDb {
  const fresh = createFakeDb({ serializable: false, now: () => PINNED_NOW });
  configure(fresh);
  useFakeDatabase(fresh);
  return fresh;
}

/**
 * The declared schedules for the REAL engine, and why there is only one.
 *
 * The engine has no separate read to interleave: `reserve` issues
 * `UPDATE … WHERE "onHand" - "reserved" >= n RETURNING *` and reads the answer out
 * of the same statement. There is no check-then-act window to widen, because there
 * is no "then". Pinning both callers onto that one statement is therefore the
 * strongest schedule available — and it is the schedule the whole design rests on.
 *
 * The Prisma-builder schedules in §2 are kept for the reference implementations,
 * where a read and a write genuinely are two statements.
 */
const ENGINE_SCHEDULES: readonly Interleaving[] = [
  {
    label: "both callers claim the guarded write simultaneously",
    barrierOps: [`pre:${WRITE}`],
    expectedArrivals: [`pre:${WRITE}`, `pre:${WRITE}`],
    expectedReleases: 1,
    why: "The whole check and the whole write are one statement; both callers reach it together.",
  },
];

describeWhenReady(engineModule, "concurrency — A2's real engine, the same declared schedules", () => {
  it.each(ENGINE_SCHEDULES)("two simultaneous reservations for the LAST unit: exactly one — $label", async (interleaving) => {
    const engine = surface<StockEngineSurface>(engineModule);
    const engineDb = engineWorld((target) => {
      seedOne(target, LAST_UNIT.productId, { onHand: 1, reserved: 0 });
      seedBooking(target, "bkg_a");
      seedBooking(target, "bkg_b");
    });
    const rendezvous = createRendezvous(interleaving.barrierOps, 2);
    rendezvous.install(engineDb);

    const [a, b] = await race([
      { run: () => reserveViaEngine(engine, "bkg_a", LAST_UNIT.productId) },
      { run: () => reserveViaEngine(engine, "bkg_b", LAST_UNIT.productId) },
    ]);

    expect(
      rendezvous.arrivals.slice(0, interleaving.expectedArrivals.length),
      `the declared schedule did not run: ${JSON.stringify(rendezvous.arrivals)}`,
    ).toEqual(interleaving.expectedArrivals);
    expect(rendezvous.releases, "the barrier generation must have completed").toBeGreaterThanOrEqual(
      interleaving.expectedReleases,
    );

    const winners = [a, b].filter((outcome) => outcome.ok);
    expect(
      winners,
      `THE LAST UNIT WAS SOLD TWICE — both callers reserved it: ${JSON.stringify([a, b])}`,
    ).toHaveLength(1);

    const level = engineDb.levelOf(LAST_UNIT.productId);
    expect(level.reserved, `reserved=${level.reserved} on a shelf of 1`).toBe(1);
    expect(level.available).toBe(0);
    expect(engineDb.snapshot("reservation").filter((row) => row.status === "HELD")).toHaveLength(1);
    expect(engineDb.snapshot("stockMovement").filter((row) => row.kind === "RESERVE")).toHaveLength(1);
    assertInvariantNeverBroken(engineDb, `A2 engine · ${interleaving.label}`);
  });

  it("the loser is told the truth, so the counter can say '0 left' rather than 'failed'", async () => {
    const engine = surface<StockEngineSurface>(engineModule);
    engineWorld((target) => {
      seedOne(target, LAST_UNIT.productId, { onHand: 1, reserved: 0 });
      seedBooking(target, "bkg_a");
      seedBooking(target, "bkg_b");
    });

    const first = await reserveViaEngine(engine, "bkg_a", LAST_UNIT.productId);
    const second = await reserveViaEngine(engine, "bkg_b", LAST_UNIT.productId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.shortfall, "the refusal must name the shortfall").toBe(1);
    expect(second.available, "and report zero available, not a stale one").toBe(0);
  });

  it("the write really is the guarded one — the derived `onHand - reserved` guard is present", async () => {
    // The assertion above would also pass if the engine were correct by accident.
    // This reads back the statement the fake's recogniser actually parsed and
    // checks the guard the brief mandates is in the WHERE clause.
    const engine = surface<StockEngineSurface>(engineModule);
    const engineDb = engineWorld((target) => {
      seedOne(target, LAST_UNIT.productId, { onHand: 1, reserved: 0 });
      seedBooking(target, "bkg_a");
    });

    await reserveViaEngine(engine, "bkg_a", LAST_UNIT.productId);

    const statement = engineDb.lastRecognisedUpdate();
    expect(statement, "the engine did not issue a guarded UPDATE \"StockLevel\"").not.toBeNull();
    expect(statement?.statement).toContain('UPDATE "StockLevel"');
    const derived = statement?.parsed.filter((condition) => condition.derived) ?? [];
    expect(
      derived.map((condition) => `${condition.column} ${condition.operator} ${condition.value}`),
      `the guard is not \"onHand\" - \"reserved\" >= n: ${statement?.statement}`,
    ).toEqual(['onHand - reserved >= 1']);
  });

  it("a decline actually returns zero rows rather than writing a clamped value", async () => {
    const engineDb = engineWorld((target) => {
      seedOne(target, FIXTURES.oilFilter, { onHand: 2, reserved: 0 });
      seedBooking(target, "bkg_a");
    });
    const engine = surface<StockEngineSurface>(engineModule);

    const result = await engine.postMovement(
      { productId: FIXTURES.oilFilter, kind: "CONSUME", qty: 9, reason: "bay 2" },
      ACTOR,
    );
    expect("ok" in result && result.ok === false, "consuming 9 of 2 was not refused").toBe(true);
    expect(result).toMatchObject({ ok: false, reason: "INSUFFICIENT_STOCK", available: 2, requested: 9 });
    expect(engineDb.lastRecognisedUpdate()?.affected, "the guarded UPDATE touched a row it should not have").toBe(0);
    expect(engineDb.levelOf(FIXTURES.oilFilter)).toEqual({ onHand: 2, reserved: 0, available: 2 });
    expect(engineDb.snapshot("stockMovement"), "a refused move wrote a ledger row").toHaveLength(0);
  });

  it("8 simultaneous callers for the last unit: still exactly one winner", async () => {
    const engine = surface<StockEngineSurface>(engineModule);
    const engineDb = engineWorld((target) => {
      seedOne(target, LAST_UNIT.productId, { onHand: 1, reserved: 0 });
      for (let index = 0; index < 8; index += 1) seedBooking(target, `bkg_${index}`);
    });
    const rendezvous = createRendezvous([`pre:${WRITE}`], 8);
    rendezvous.install(engineDb);

    const actors = Array.from({ length: 8 }, (_, index) => ({
      run: () => reserveViaEngine(engine, `bkg_${index}`, LAST_UNIT.productId),
    }));
    const results = await race(actors);

    expect(rendezvous.releases).toBeGreaterThanOrEqual(1);
    expect(results.filter((outcome) => outcome.ok), "more than one caller won the last unit").toHaveLength(1);
    expect(engineDb.levelOf(LAST_UNIT.productId).reserved).toBe(1);
    assertInvariantNeverBroken(engineDb, "A2 engine · 8 callers, 1 unit");
  });

  it("50 concurrent reserves against 7 units never sell the eighth", async () => {
    const engine = surface<StockEngineSurface>(engineModule);
    const engineDb = engineWorld((target) => {
      worldWith(target, FIXTURES.oil, 7, 0);
      for (let index = 0; index < 50; index += 1) seedBooking(target, `bkg_${index}`);
    });
    const rendezvous = createRendezvous([`pre:${WRITE}`], 50);
    rendezvous.install(engineDb);

    const actors = Array.from({ length: 50 }, (_, index) => ({
      run: () => reserveViaEngine(engine, `bkg_${index}`, FIXTURES.oil),
    }));
    const results = await race(actors);

    const winners = results.filter((outcome) => outcome.ok).length;
    expect(winners, "more units were sold than the shelf held").toBeLessThanOrEqual(7);
    expect(winners, "a 50-way stampede served nothing at all").toBeGreaterThan(0);
    const level = engineDb.levelOf(FIXTURES.oil);
    expect(level.reserved, `reserved=${level.reserved} but ${winners} callers succeeded`).toBe(winners);
    expect(level.available).toBe(7 - winners);
    expect(engineDb.snapshot("reservation")).toHaveLength(winners);
    assertInvariantNeverBroken(engineDb, "A2 engine · 50 callers, 7 units");
  });
});

describeAwaiting(engineModule, "concurrency — AWAITING the real stock engine");

// ─────────────────────────────────────────────────────────────────────────────
// §6 · The proof that needs a real database
// ─────────────────────────────────────────────────────────────────────────────

describe("concurrency - what a fake cannot prove", () => {
  it.todo(
    "EPHEMERAL-POSTGRES RACE (docs/inventory-qa/TEST-STRATEGY.md section 4). Against a real Postgres 16 " +
      "with `prisma migrate deploy`, set one product to onHand=1, reserved=0, then fire 20 concurrent " +
      "`reserve({ bookingId, items: [{ productId, qty: 1 }] })` calls and assert: (a) exactly 1 result " +
      "has no shortfall, (b) `SELECT \"reserved\" FROM \"StockLevel\"` = 1, (c) `SELECT count(*) FROM " +
      "\"Reservation\" WHERE status='HELD'` = 1, (d) `SELECT \"onHand\" - \"reserved\"` >= 0. Repeat " +
      "with `isolationLevel: Serializable` AND with the default ReadCommitted, because the difference " +
      "between the two is the whole claim. Section 5 above runs this exact schedule against the real " +
      "engine through the SQL recogniser, which proves the STATEMENT; only a real database proves the " +
      "ISOLATION LEVEL. This is the single highest-value outstanding test in the build.",
  );

  it.todo(
    "P2034 UNDER REAL CONTENTENTION. Assert that `withSerializableRetry` retries a genuine Postgres " +
      "`40001` and that the retry re-read refuses rather than clamps. The fake aborts a second " +
      "in-flight write to the same row, which is the common case; real Postgres can also abort on a " +
      "read-write dependency cycle that no write lock predicts. " +
      "Awaits: an ephemeral Postgres harness (docs/inventory-qa/RELEASE-CHECKLIST.md section G).",
  );

  it.todo(
    "CONCURRENT SERIALISABLE TRANSACTIONS. The engine block above runs with `serializable: false`, " +
      "which is the STRICTEST setting for the invariant: no isolation level is rescuing the engine, " +
      "the guard alone has to hold. Re-run the same schedules with `serializable: true` to prove the " +
      "real `P2034` retry path does not turn a refusal into a success on retry. " +
      "Awaits: nothing new - the fake supports it via `createFakeDb({ serializable: true })`.",
  );
});
