// @vitest-environment node
/**
 * QA & SECURITY AGENT — Philippine phone-number handling.
 * ============================================================================
 * Contract under test: `normalisePhone`, `isValidPhPhone`, `formatPhPhone`
 * in `src/lib/utils.ts` (orchestrator-owned, do not edit).
 *
 * Why this is a *security* test as much as a formatting test:
 * `Customer.phone` is `@@unique` and `Booking.customerPhone` is indexed. If
 * normalisation is not idempotent, "0917 123 4567" and "+639171234567" become
 * two different customers — a booking-confirmation SMS to a mistyped number, a
 * missed roadside call, and a duplicate row that defeats the "one referral per
 * phone number per year" promo rule in `promotions.ts`.
 *
 * Rejection cases matter just as much: the shop's top-of-funnel is a phone
 * call, so a silently-accepted landline or a typo'd mobile becomes a customer
 * the front desk can never reach.
 * ============================================================================
 */
import { describe, expect, it } from "vitest";

import { formatPhPhone, isValidPhPhone, normalisePhone } from "@/lib/utils";

/** A real-format PH mobile. `+63917…` is the E.164 the DB stores. */
const CANONICAL = "+639171234567";

describe("normalisePhone — accepted shapes", () => {
  it.each([
    ["09171234567", "bare 0-prefixed mobile"],
    ["+639171234567", "full E.164"],
    ["639171234567", "country code, no plus"],
    ["9171234567", "bare 10-digit mobile, no prefix at all"],
  ])("normalises %s (%s)", (input) => {
    expect(normalisePhone(input)).toBe(CANONICAL);
  });

  it.each([
    ["0917 123 4567", "spaces"],
    ["0917-123-4567", "dashes"],
    ["(0917) 123-4567", "parentheses"],
    ["+63 917 123 4567", "spaces inside E.164"],
    ["  +63-917-123-4567  ", "leading/trailing whitespace and a dash"],
    ["0917.123.4567", "dots"],
    ["(+63) 917 123 4567", "parenthesised country code"],
  ])("normalises a decorated number: %s (%s)", (input) => {
    expect(normalisePhone(input)).toBe(CANONICAL);
  });

  it("strips every non-digit, including a leading '+' and even a pasted 'tel:' scheme", () => {
    expect(normalisePhone("+639171234567")).toBe(CANONICAL);
    expect(normalisePhone("tel:+639171234567")).toBe(CANONICAL);
  });

  /**
   * DOCUMENTED LIMITATION, reported as a finding.
   * An extension is not separable from the national number: "0917 123 4567
   * ext. 22" collapses to `+63917123456722`, which is 14 digits and passes
   * `isValidPhPhone`? No — it does not (`\\d{9}` after the `9` fails on the
   * extra `22`), so validation still rejects it. But a *valid-looking* paste
   * such as "0917 123 4567 x2" becomes `+6391712345672` and is rejected too.
   * Net effect: extensions cannot be captured. That is acceptable for this
   * shop (mobile only), but the booking form must not invite an extension.
   */
  it("cannot capture an extension — the extra digits make the number invalid", () => {
    expect(isValidPhPhone("0917 123 4567 ext. 22")).toBe(false);
  });
});

describe("normalisePhone — idempotence (property)", () => {
  /** normalise(normalise(x)) === normalise(x) for every accepted spelling. */
  const corpus: readonly string[] = [
    "09171234567",
    "+639171234567",
    "639171234567",
    "9171234567",
    "0917 123 4567",
    "0917-123-4567",
    "(0917) 123-4567",
    "+63 917 123 4567",
    "(+63) 917-123-4567",
    "  09171234567  ",
    "0917.123.4567",
    "+63917-123-4567",
    "0917/123/4567",
    "0917_123_4567",
  ];

  it.each(corpus)("is idempotent for %s", (input) => {
    const once = normalisePhone(input);
    const twice = normalisePhone(once);
    const thrice = normalisePhone(twice);
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
  });

  it("two spellings of the same number converge on one string", () => {
    const spellings = ["09171234567", "+639171234567", "639171234567", "(0917) 123-4567"];
    const results = new Set(spellings.map(normalisePhone));
    expect(results.size).toBe(1);
    expect([...results][0]).toBe(CANONICAL);
  });
});

describe("isValidPhPhone — what must be REJECTED", () => {
  it.each([
    ["12345678", "8-digit Metro Manila landline"],
    ["81234567", "8-digit local landline"],
    ["8123 4567", "8-digit landline with a space"],
    ["(02) 8123 4567", "Metro Manila landline, parenthesised"],
    ["(047) 123 4567", "Bataan landline, parenthesised"],
  ])("rejects %s (%s)", (input) => {
    expect(isValidPhPhone(input)).toBe(false);
  });

  it.each([
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["abc", "letters"],
    ["09", "two digits"],
    ["0917123456", "one digit short"],
    ["091712345678", "one digit long"],
    ["+639171234567890", "absurdly long"],
    ["0917 123 456", "short with separators"],
    ["0917123456a", "trailing letter"],
  ])("rejects %j (%s)", (input) => {
    expect(isValidPhPhone(input)).toBe(false);
  });

  it.each([
    ["+14155552671", "US"],
    ["+1 415 555 2671", "US with spaces"],
    ["+44 7911 123456", "GB mobile"],
    ["+6281234567890", "ID mobile"],
    ["+819012345678", "JP mobile"],
  ])("rejects the non-PH number %s (%s)", (input) => {
    expect(isValidPhPhone(input)).toBe(false);
  });

  it("does not accept a PH landline area code dressed up as a mobile", () => {
    // `047 123 4567` must never be allowed to masquerade as `+63 9…`.
    expect(isValidPhPhone("0471234567")).toBe(false);
    expect(isValidPhPhone("(02) 8123 4567")).toBe(false);
  });

  it("accepts every legitimate spelling of one valid mobile", () => {
    for (const input of ["09171234567", "+639171234567", "639171234567", "(0917) 123-4567"]) {
      expect(isValidPhPhone(input), input).toBe(true);
    }
  });
});

describe("normalisePhone — landline mangling", () => {
  /**
   * DOCUMENTED BEHAVIOUR, reported as a finding rather than a failure.
   *
   * `normalisePhone("0471234567")` produces `+63471234567`. That is a *valid*
   * looking E.164 shape for a non-existent PH mobile range, and it silently
   * discards the fact that the customer gave a Bataan landline. The validator
   * still rejects it (`isValidPhPhone` → false, because position 3 is `4` not
   * `9`), so nothing unvalidated reaches the DB — but any code path that
   * normalises *without* validating will store `+63471234567` as
   * `Customer.phone`, where `@@unique` will happily treat it as a mobile.
   *
   * See docs/qa/security-checklist.md → A04 / broken-auth residual risk.
   */
  it("mangles a Bataan landline into a mobile-looking E.164 (documented, validated downstream)", () => {
    const mangled = normalisePhone("0471234567");
    expect(mangled).toBe("+63471234567");
    // The validator is the safety net. If THIS ever becomes true the
    // landline-mangling finding escalates to High.
    expect(isValidPhPhone("0471234567")).toBe(false);
  });
});

describe("formatPhPhone — human display format", () => {
  /**
   * This is the read-aloud format the front desk uses when confirming a booking,
   * so the grouping must be +CC NNN NNN NNNN (`+63 917 123 4567`).
   *
   * ⚠ EXPECTED TO FAIL against the current implementation — see the QA report.
   * `formatPhPhone` slices `e164.slice(4)` which keeps the leading `9` in the
   * first group, producing `+63 9171 234 567`.
   */
  it("formats a mobile as '+63 917 123 4567'", () => {
    expect(formatPhPhone("09171234567")).toBe("+63 917 123 4567");
    expect(formatPhPhone("+639171234567")).toBe("+63 917 123 4567");
    expect(formatPhPhone("639171234567")).toBe("+63 917 123 4567");
  });

  it("preserves the ten national digits exactly (no digit dropped or duplicated)", () => {
    const national = "9171234567";
    for (const input of ["09171234567", "+639171234567", "639171234567", "(0917) 123-4567"]) {
      const formatted = formatPhPhone(input);
      const digits = formatted.replace(/\D/g, "");
      expect(digits, `${input} → ${formatted}`).toBe(`63${national}`);
    }
  });

  it("does not mangle a landline into a mobile-looking string", () => {
    // Whatever it does, it must never present a landline as `+63 9…`.
    expect(formatPhPhone("0471234567")).not.toMatch(/^\+63 9\d/);
  });
});