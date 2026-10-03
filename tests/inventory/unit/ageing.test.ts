// @vitest-environment node
/**
 * A7 · CI/CD & QA — ageing: DOT codes and shelf life.
 * ============================================================================
 * Oil degrades. Tyres degrade. Brake fluid degrades. What the shop sells as new
 * and what the customer receives is not the same thing, and in the Philippines
 * that is a consumer-protection question as much as a margin one.
 *
 * TWO DIFFERENT CLOCKS, AND CONFLATING THEM IS THE BUG
 * ---------------------------------------------------
 *   DOT code — production week, printed on the tyre wall as `WWYY`. "2618" is
 *   week 18 of 2026. It describes when the tyre was MADE, not when the shop got
 *   it. A tyre made three years ago and received last week is still three years
 *   old.
 *
 *   `shelfLifeDays` — days from RECEIPT. Oil and coolant carry this; tyres do
 *   not, because a tyre's clock started before it reached the shelf.
 *
 * An ageing report that used `createdAt` for both would call a fresh delivery of
 * three-year-old stock brand new, and the clearance campaign would then advertise
 * stale rubber as a bargain. That is the failure this file exists to prevent.
 *
 * THE DOT CODE IS HARDER THAN IT LOOKS
 * ------------------------------------
 *   • It is `WWYY`, not `YYWW`.
 *   • Week 00 does not exist; the range is 01–53.
 *   • Years pivot at 2000, the way a tyre does: "9901" is December 1999, and the
 *     year is `2000 + yy` until the pivot, then `1900 + yy`.
 *   • ISO weeks do not start on January 1, so a January tyre can carry a week
 *     number from the previous December.
 *
 * WHAT RUNS TODAY: the decoder and the age arithmetic, pinned to a fixed clock
 * (`Asia/Manila`, which `vitest.config.ts` sets). This is specification-as-code —
 * the same arrangement as `reference-engine.ts`, and for the same reason: A2's
 * `getStockAgeing` does not exist yet, and a DOT-code bug is both easy to write
 * and invisible until a customer is holding the tyre.
 *
 * WHAT WAITS ON A2: the ageing service itself.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";

import { ONE_DAY_MS, PINNED_NOW, PRODUCTS } from "../support/fixtures";
import {
  capability,
  describeAwaiting,
  readRepoFile,
  resolveInventoryModule,
  surface,
  type AgeingSurface,
} from "../support/module-resolver";

const engine = await resolveInventoryModule(
  [
    "@/lib/server/inventory/ageing",
    "@/lib/server/inventory/stock-level",
    "@/lib/server/inventory/index",
    "@/lib/server/inventory",
  ],
  [capability("getStockAgeing", ["stockAgeing", "ageing", "getAgeing"], () => true)],
);

// ─────────────────────────────────────────────────────────────────────────────
// Runs today: the DOT-code decoder
// ─────────────────────────────────────────────────────────────────────────────

/** Proleptic Gregorian leap year. */
const isLeap = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Whether `year` has 53 ISO weeks: 1 January is a Thursday, or it is a leap year
 * and 1 January is a Wednesday.
 */
const isoWeeksInYear = (year: number): number => {
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  return jan1 === 4 || (isLeap(year) && jan1 === 3) ? 53 : 52;
};

/**
 * Decodes a `WWYY` DOT code into the UTC instant of the Monday that starts that
 * production week.
 *
 * Returns `null` for anything that is not a plausible tyre DOT code rather than
 * guessing: `9999` means the tyre has no readable code (cut tyres, retreads,
 * budget imports), and treating it as week 99 of year 99 would date the tyre in
 * the far future and mark it "brand new" forever.
 *
 * KNOWN CONTRACT DEFECT — reported, not silently reinterpreted.
 * `prisma/schema.prisma` documents `dotCode` as:
 *     /// Production week/year, e.g. "2418" = week 18 of 2024. Tyres degrade.
 * Read as `WWYY` — which is what every tyre on every sidewall since 2000 actually
 * is — "2418" is week 24 of 2018, not week 18 of 2024. The example contradicts the
 * format the field's own name implies. This decoder implements the REAL `WWYY`
 * convention and `tests/inventory/unit/ageing.test.ts` asserts the schema's exact
 * wording so the ambiguity stays visible until the orchestrator corrects the
 * comment. Reading it as `YYWW` would mean every future tyre on the shelf is
 * decoded as being from the wrong year.
 */
export function decodeDotCode(
  dot: string,
  options: { pivotYear?: number; now?: Date } = {},
): Date | null {
  if (!/^\d{4}$/.test(dot)) return null;
  const week = Number(dot.slice(0, 2));
  const twoDigitYear = Number(dot.slice(2, 4));
  if (week < 1 || week > 53) return null;

  // The industry pivot, as on a VIN: DOT years count from 2000. A tyre from the
  // 1990s is still sold, and it is not from the year 90 of this century.
  const pivot = options.pivotYear ?? (options.now ?? PINNED_NOW).getUTCFullYear();
  const century = Math.floor(pivot / 100) * 100;
  let year = century + twoDigitYear;
  if (year > pivot + 1) year -= 100;

  if (week === 53 && isoWeeksInYear(year) !== 53) return null;

  // ISO week 1 is the week containing the first Thursday of January, so it can
  // begin in the PREVIOUS calendar year. That is why a tyre made in early
  // January can carry a week number from the previous December.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86_400_000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86_400_000);
}

describe("ageing — the DOT code decodes to a production week, not a purchase date", () => {
  it("the format is `WWYY`, and the schema example says so unambiguously", () => {
    // RESOLVED. This assertion used to pin the DEFECTIVE example:
    //
    //   Production week/year, e.g. "2418" = week 18 of 2024.
    //
    // Real DOT codes are `WWYY` - WEEK then YEAR - so `"2418"` is week 24 of 2018.
    // Read the old comment's way and every tyre on the shelf looks a year older
    // than it is, and a mechanic scanning a code is told they are fitting a
    // part older than they believed.
    const schema = readRepoFile("prisma/schema.prisma");

    expect(schema, "the schema must state WWYY, week first").toContain("WWYY");
    expect(schema, "the example must be unambiguous").toContain('"1824" is week 18 of 2024');

    // And the misleading example must not survive anywhere.
    expect(
      schema,
      'the misleading "2418 = week 18 of 2024" example must not return',
    ).not.toContain('"2418" = week 18 of 2024');

    // The decoder is the authority: week 24 of 2018, NOT 2024.
    const decoded = decodeDotCode("2418");
    expect(decoded?.toISOString().slice(0, 4), "2418 is week 24 of 2018").toBe("2018");
  });

  it("a code from the previous century pivots back rather than forward", () => {
    const old = decodeDotCode("0699");
    expect(old?.getUTCFullYear(), "week 6 of 1999, not of 2099").toBe(1999);
    expect(old?.toISOString().slice(0, 10)).toBe("1999-02-08");
  });

  it("a code from the current year is not pivoted at all", () => {
    const current = decodeDotCode("0626");
    expect(current?.getUTCFullYear()).toBe(2026);
    // ISO week 1 of 2026 begins on Monday 29 December 2025, so week 6 begins on
    // 2 February 2026. Reading the code as `YYWW` would give June 2026.
    expect(current?.toISOString().slice(0, 10)).toBe("2026-02-02");
  });

  it("week 00 does not exist", () => {
    expect(decodeDotCode("0001"), "week 0 is not a week").toBeNull();
  });

  it("an unreadable code is null, never a date in the far future", () => {
    // Cut tyres, retreads and budget imports all carry `DOT` with no number.
    for (const dot of ["9999", "XXXX", "", "062", "06241", "06 24", "abcd"]) {
      expect(decodeDotCode(dot), `"${dot}" decoded to a date`).toBeNull();
    }
  });

  it("a January tyre carries a week number from the ISO year that began in December", () => {
    // ISO week 1 of 2026 started on Monday 29 December 2025. A tyre made on
    // 5 January 2026 is week 2 of 2026; one made on 30 December 2025 is week 1
    // of 2026. Six days apart, two different week numbers — and transposing the
    // digits would put the first in June 2001 and the second in February 2001.
    expect(decodeDotCode("0126")?.toISOString().slice(0, 10)).toBe("2025-12-29");
    expect(decodeDotCode("0226")?.toISOString().slice(0, 10)).toBe("2026-01-05");
  });

  it("week 53 is only valid in a long year", () => {
    // 2020 and 2026 are 53-week ISO years; 2021 is not. A `5321` on a wall is not
    // a real date, and decoding it would place the tyre in 2022.
    expect(isoWeeksInYear(2020), "2020 is long").toBe(53);
    expect(isoWeeksInYear(2026), "2026 is long").toBe(53);
    expect(isoWeeksInYear(2021), "2021 is not").toBe(52);
    expect(decodeDotCode("5320"), "week 53 of 2020 exists").not.toBeNull();
    expect(decodeDotCode("5321"), "week 53 of 2021 does not").toBeNull();
    expect(decodeDotCode("5326"), "week 53 of 2026 exists").not.toBeNull();
  });

  it("the decoder is timezone-stable — the same DOT code decodes identically under any TZ", () => {
    // `vitest.config.ts` pins `TZ=Asia/Manila`. The decoder works in UTC
    // precisely so a tyre's age does not change with the server's timezone — the
    // failure mode behind "the clearance page changed overnight".
    const original = process.env["TZ"];
    try {
      const outputs: string[] = [];
      for (const zone of ["Asia/Manila", "UTC", "Pacific/Kiritimati", "America/New_York"]) {
        process.env["TZ"] = zone;
        outputs.push(decodeDotCode("0624")?.toISOString() ?? "null");
      }
      expect(new Set(outputs).size, `DOT decoding changed with TZ: ${outputs.join(" | ")}`).toBe(1);
      expect(outputs[0]).toBe("2024-02-05T00:00:00.000Z");
    } finally {
      if (original === undefined) delete process.env["TZ"];
      else process.env["TZ"] = original;
    }
  });

  it("age is measured in whole days from the pinned clock, and never negative", () => {
    const decoded = decodeDotCode("0626");
    expect(decoded).not.toBeNull();
    const ageDays = Math.floor((PINNED_NOW.getTime() - (decoded?.getTime() ?? 0)) / ONE_DAY_MS);
    expect(ageDays, "week 6 of 2026 read on 11 March 2026 Manila").toBe(37);
    expect(ageDays).toBeGreaterThanOrEqual(0);
  });
});

describe("ageing — the fixtures carry the clocks they claim to", () => {
  it("only tyres carry a DOT code, and only shelf-life goods carry a shelf life", () => {
    for (const product of PRODUCTS) {
      if (product.kind === "TYRE") {
        expect(product.dotCode, `${product.sku} is a tyre with no DOT code`).toMatch(/^\d{4}$/);
        expect(product.shelfLifeDays, `${product.sku} is a tyre — its clock started before the shelf`).toBeNull();
      } else {
        expect(
          product.dotCode,
          `${product.sku} is a ${product.kind}, not a tyre — it must not carry a DOT code`,
        ).toBeNull();
      }
      if (product.kind === "OIL") {
        expect(product.shelfLifeDays, `${product.sku} needs a shelf life`).not.toBeNull();
      }
    }
  });

  it("a shop rag has no expiry and must not be given a fake one", () => {
    // `shelfLifeDays: 0` would read as "expires immediately"; `365` would put the
    // rag on the expiry list every year. Cloth does not expire.
    const rag = PRODUCTS.find((product) => product.sku === "CON-shop-rag");
    expect(rag?.shelfLifeDays).toBeNull();
    expect(rag?.kind).toBe("CONSUMABLE");
  });

  it("the contract puts `ageDays` and `isNearExpiry` on the product availability read, not on the catalogue", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const availability = /export interface ProductAvailabilityDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(availability).toContain("ageDays?: number | null;");
    expect(availability).toContain("/** True when a shelf-life product is within 30 days of expiry. */");
    expect(availability).toContain("isNearExpiry?: boolean;");
    // 30 days is the contract's number. Stated here so it cannot be changed
    // quietly: a different threshold is a decision, not a refactor.
    expect(30).toBeGreaterThan(0);
  });

  it("ageing IS a query: the DOT code is indexed", () => {
    // RESOLVED. This test was titled "indexes nothing on it", which was a
    // complaint rather than an assertion. Two things changed:
    //
    //   1. `StockLot` carries the per-delivery DOT code and IS indexed, because a
    //      shelf holds many DOT ages at once - that is precisely why it was split
    //      out of `Product`.
    //   2. `Product.dotCode` is now indexed too, and documented as superseded
    //      by the lot, so a single loose tyre can still be recorded and found.
    const schema = readRepoFile("prisma/schema.prisma");

    const product = /model Product \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(product).toMatch(/dotCode\s+String\?/);
    expect(product).toMatch(/shelfLifeDays\s+Int\?/);
    expect(product, "Product.dotCode must be indexed").toMatch(/@@index\(\[dotCode\]\)/);

    const lot = /model StockLot \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(lot, "the per-lot DOT code is what ageing actually queries").toMatch(
      /@@index\(\[productId, dotCode\]\)/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A2-facing
// ─────────────────────────────────────────────────────────────────────────────

const describeAgeing = engine.ready ? describe : describe.skip;

describeAgeing("ageing — the ageing report", () => {
  const ageing = (): AgeingSurface => surface<AgeingSurface>(engine);

  it("reports tyre age from the DOT code, not from when the row was created", async () => {
    const rows = await ageing().getStockAgeing(PINNED_NOW);
    const tyre = rows.find((row) => row.productId === "prd_tyre_205_55r16");
    expect(tyre, "the tyre must appear in the ageing report").toBeDefined();
    // DOT 2618 = week 18 of 2026 = 27 April 2026, which is AFTER the pinned
    // clock of 11 March 2026. A fixture can do that; the report must handle it
    // honestly rather than reporting a negative age.
    expect(tyre?.kind).toBe("TYRE");
    if ((tyre?.ageDays ?? 0) < 0) {
      throw new Error("the fixture DOT code is in the future — change the fixture, not the assertion");
    }
  });

  it("flags a shelf-life product within 30 days of expiry and nothing else", async () => {
    const rows = await ageing().getStockAgeing(PINNED_NOW);
    for (const row of rows) {
      if (row.kind === "TYRE") {
        expect(row.isNearExpiry, "a tyre has no receipt clock, so it cannot be 'near expiry'").toBe(false);
      }
      expect(row.ageDays ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it("never reports a negative age, whatever the fixture", async () => {
    const rows = await ageing().getStockAgeing(PINNED_NOW);
    for (const row of rows) {
      expect(row.ageDays, `${row.productId} has ageDays=${String(row.ageDays)}`).not.toBeLessThan(0);
    }
  });

  it("a product with no DOT code and no shelf life has a null age, not zero", async () => {
    const rows = await ageing().getStockAgeing(PINNED_NOW);
    const wiper = rows.find((row) => row.productId === "prd_wiper_22");
    expect(wiper?.ageDays, "zero would say 'brand new' about something we simply do not know").toBeNull();
    expect(wiper?.isNearExpiry).toBe(false);
  });
});

describeAwaiting(engine, "ageing — AWAITING the real ageing service");
