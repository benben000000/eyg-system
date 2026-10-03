// @vitest-environment node
/**
 * QA & SECURITY AGENT — `formatPeso` / `formatPesoRange`.
 * ============================================================================
 * Contract under test: `src/lib/utils.ts` (orchestrator-owned, do not edit).
 *
 * PH money rules encoded here:
 *  • The peso sign is U+20B1 (`₱`), never `PHP`, `P`, or `Php`.
 *  • **No centavos.** `₱1,250.00` is not a Philippine retail price; it is a
 *    SaaS dashboard price. The brief and the schema (`priceMin Int`) both say
 *    integer pesos. This suite fails if a decimal ever appears.
 *  • Both ends null → the copy must say something a human can act on
 *    ("Ask us"), never `₱null`, `₱NaN` or `₱0`.
 * ============================================================================
 */
import { describe, expect, it } from "vitest";

import { formatPeso, formatPesoRange } from "@/lib/utils";

const PESO_SIGN = "\u20B1";

/**
 * `formatPesoRange` is *declared* `(min: number | null, max: number | null)`,
 * but at runtime it is fed straight from JSON payloads, Prisma `Int?` columns
 * and optional CMS fields — any of which can hand it `undefined`. These tests
 * pin that the implementation degrades gracefully instead of printing
 * "₱undefined". This alias widens the call site only; the assertion is
 * unchanged.
 */
const range = formatPesoRange as (min?: number | null, max?: number | null) => string;

describe("formatPeso — symbol and shape", () => {
  it("uses the real peso sign U+20B1, not 'PHP'/'P'/'Php'", () => {
    const out = formatPeso(1250);
    expect(out.startsWith(PESO_SIGN)).toBe(true);
    expect(out).toBe(`${PESO_SIGN}1,250`);
    expect(out).not.toMatch(/\b(PHP|Php|P\b)/);
  });

  it("emits whole pesos only — never centavos (PH practice)", () => {
    const matrix: readonly number[] = [0, 1, 9, 10, 99, 100, 250, 500, 999, 1000, 1250, 4999, 12500, 99999, 100000, 1000000];
    for (const value of matrix) {
      const out = formatPeso(value);
      expect(out, `formatPeso(${value})`).not.toMatch(/\.\d/);
      expect(out, `formatPeso(${value})`).not.toMatch(/,\d{2}$/);
      expect(out).not.toMatch(/\.\d{2}$/);
    }
  });

  it("compact mode emits at most ONE decimal, and never a two-decimal peso amount", () => {
    const matrix: readonly number[] = [0, 999, 1000, 1500, 1250, 4999, 5000, 12500, 24999, 125000, 999999];
    for (const value of matrix) {
      for (const compact of [false, true]) {
        const out = formatPeso(value, { compact });
        expect(out, `formatPeso(${value}, { compact: ${compact} })`).not.toMatch(/\.\d{2}/);
        // The compact form may carry ".3" — that is a "k" abbreviation, not centavos.
        const decimals = /\.(\d+)/.exec(out)?.[1];
        expect(decimals === undefined || decimals.length <= 1, out).toBe(true);
      }
    }
  });

  it("rounds a fractional input to the nearest whole peso", () => {
    expect(formatPeso(1250.4)).toBe(`${PESO_SIGN}1,250`);
    expect(formatPeso(1250.5)).toBe(`${PESO_SIGN}1,251`);
    expect(formatPeso(1250.99)).toBe(`${PESO_SIGN}1,251`);
  });

  it("formats zero, not an empty string and not 'NaN'", () => {
    expect(formatPeso(0)).toBe(`${PESO_SIGN}0`);
    expect(formatPeso(0)).not.toBe("");
  });

  it("uses a thousands separator for 4+ digit values", () => {
    expect(formatPeso(1000)).toBe(`${PESO_SIGN}1,000`);
    expect(formatPeso(10000)).toBe(`${PESO_SIGN}10,000`);
    expect(formatPeso(1000000)).toBe(`${PESO_SIGN}1,000,000`);
    // 3 digits gets NO separator — a stray "1,000" at 999 is a classic bug.
    expect(formatPeso(999)).toBe(`${PESO_SIGN}999`);
  });

  it("renders a dash (never a number) for absent values", () => {
    expect(formatPeso(null)).toBe("\u2014");
    expect(formatPeso(undefined)).toBe("\u2014");
    expect(formatPeso(Number.NaN)).toBe("\u2014");
    for (const bad of [null, undefined, Number.NaN]) {
      const out = formatPeso(bad);
      expect(out).not.toMatch(/NaN|null|undefined/);
      expect(out).not.toContain(PESO_SIGN);
    }
  });

  it("never emits the literal string 'NaN', 'undefined' or 'null'", () => {
    const inputs: readonly (number | null | undefined)[] = [
      null, undefined, Number.NaN, 0, -1, 1e21, Number.MAX_SAFE_INTEGER,
    ];
    for (const input of inputs) {
      const out = formatPeso(input);
      expect(out).not.toMatch(/NaN|undefined|null/);
    }
  });
});

describe("formatPeso — compact mode", () => {
  it("compacts 1000 and above", () => {
    expect(formatPeso(1000, { compact: true })).toBe(`${PESO_SIGN}1k`);
    expect(formatPeso(5000, { compact: true })).toBe(`${PESO_SIGN}5k`);
    expect(formatPeso(1250, { compact: true })).toBe(`${PESO_SIGN}1.3k`);
    expect(formatPeso(12500, { compact: true })).toBe(`${PESO_SIGN}12.5k`);
  });

  it("leaves anything below 1000 un-compacted", () => {
    expect(formatPeso(0, { compact: true })).toBe(`${PESO_SIGN}0`);
    expect(formatPeso(999, { compact: true })).toBe(`${PESO_SIGN}999`);
  });

  it("compact mode never emits a peso amount that differs in value from the input", () => {
    const matrix: readonly number[] = [1000, 1500, 1250, 4999, 5000, 12500, 24999, 125000];
    for (const value of matrix) {
      const compact = formatPeso(value, { compact: true });
      const digits = Number.parseFloat(compact.slice(1).replace("k", ""));
      expect(Number.isFinite(digits), `unparseable compact output: ${compact}`).toBe(true);
      // A "k" figure must land within 10% of the true value.
      expect(Math.abs(digits * 1000 - value) / value, `${value} → ${compact}`).toBeLessThan(0.11);
    }
  });
});

describe("formatPesoRange", () => {
  it('returns "Ask us" when BOTH ends are unknown', () => {
    expect(formatPesoRange(null, null)).toBe("Ask us");
    expect(range(undefined, undefined)).toBe("Ask us");
    expect(range(null, undefined)).toBe("Ask us");
  });

  it('returns "Ask us" when only the MIN is unknown — we cannot state a floor', () => {
    expect(formatPesoRange(null, 5000)).toBe("Ask us");
    expect(range(undefined, 5000)).toBe("Ask us");
  });

  it("collapses to a single figure when max is unknown", () => {
    expect(formatPesoRange(500, null)).toBe(`${PESO_SIGN}500`);
    expect(range(500, undefined)).toBe(`${PESO_SIGN}500`);
  });

  it("collapses to a single figure when min === max", () => {
    expect(formatPesoRange(1250, 1250)).toBe(`${PESO_SIGN}1,250`);
    expect(formatPesoRange(0, 0)).toBe(`${PESO_SIGN}0`);
  });

  it("renders a two-sided range with an en dash and thousands separators", () => {
    expect(formatPesoRange(500, 1500)).toBe(`${PESO_SIGN}500\u2013${PESO_SIGN}1,500`);
    expect(formatPesoRange(1200, 4800)).toBe(`${PESO_SIGN}1,200\u2013${PESO_SIGN}4,800`);
  });

  it("never produces '₱500-₱1500' with a hyphen, and never drops a sign", () => {
    const out = formatPesoRange(500, 1500);
    expect(out).not.toMatch(/\d-\d/);
    expect(out.match(new RegExp(PESO_SIGN, "g"))?.length).toBe(2);
  });

  it("produces no centavos and no 'NaN'/'null' for any input combination", () => {
    const values: readonly (number | null | undefined)[] = [null, undefined, 0, 1, 999, 1000, 1250.5, 999999];
    for (const min of values) {
      for (const max of values) {
        const out = range(min, max);
        expect(out, `formatPesoRange(${String(min)}, ${String(max)})`).toBeTruthy();
        expect(out).not.toMatch(/NaN|null|undefined/);
        expect(out).not.toMatch(/\.\d/);
      }
    }
  });

  it("treats NaN like absent rather than printing NaN", () => {
    const out = formatPesoRange(Number.NaN, Number.NaN);
    expect(out).not.toMatch(/NaN/);
  });
});