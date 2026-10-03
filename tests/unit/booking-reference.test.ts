// @vitest-environment node
/**
 * QA & SECURITY AGENT — booking / quote reference codes.
 * ============================================================================
 * Contract under test: `makeReference` in `src/lib/utils.ts`.
 *
 * A reference is read aloud over the phone by a mechanic, typed into a search
 * box by a front-desk clerk, and read back to a customer over SMS. So:
 *  • It must be the RIGHT LENGTH every time (a 5- or 7-char code means a
 *    front-desk search silently misses a customer).
 *  • It must exclude every glyph a human misreads: `0/O/o`, `1/I/l`.
 *  • It must not collide. At 32^6 ≈ 1.07e9 combinations, 10 000 references
 *    should produce ~10 000 distinct values.
 * ============================================================================
 */
import { describe, expect, it } from "vitest";

import { makeReference, REFERENCE_ALPHABET, REFERENCE_CONFUSABLE_PAIRS } from "@/lib/utils";
import { BOOKING } from "@/config/site";

/**
 * The alphabet comes from the module, not from a copy here: a hardcoded
 * duplicate silently rots the moment the alphabet is narrowed, which is exactly
 * what happened when `U`/`V` were removed for read-aloud safety (DEF-015).
 */
const ALPHABET = REFERENCE_ALPHABET;
const PREFIX = BOOKING.referencePrefix; // "EYG-"
const CODE_LENGTH = 6;
const REFERENCE_LENGTH = PREFIX.length + CODE_LENGTH;

const SAMPLES = 10_000;

/** The `code` half of a reference (everything after the prefix). */
const codeOf = (reference: string): string => reference.slice(PREFIX.length);

describe("makeReference — format", () => {
  it("emits the prefix + exactly 6 code characters", () => {
    for (let i = 0; i < 1000; i += 1) {
      const reference = makeReference(PREFIX);
      expect(reference.startsWith("EYG-")).toBe(true);
      expect(reference).toHaveLength(REFERENCE_LENGTH);
      expect(reference).toMatch(/^EYG-[A-Z0-9]{6}$/);
    }
  });

  it("honours a custom prefix and a custom length", () => {
    expect(makeReference("Q-")).toMatch(/^Q-[A-Z0-9]{6}$/);
    expect(makeReference("Q-", 8)).toMatch(/^Q-[A-Z0-9]{8}$/);
    expect(makeReference("")).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("never contains lowercase, whitespace or punctuation in the CODE half", () => {
    for (let i = 0; i < 1000; i += 1) {
      const reference = makeReference(PREFIX);
      expect(reference).toMatch(/^EYG-[A-Z0-9]{6}$/);
      // The prefix legitimately contains a hyphen; the code half must not, and
      // must not carry lowercase or punctuation of any kind.
      const code = codeOf(reference);
      expect(code).not.toMatch(/[a-z]/);
      expect(code).not.toMatch(/[\s\-_.,:;'"/\\|!@#$%^&*()+={}[\]<>`~]/);
    }
  });

  it("emits a value safe to put straight into a `tel:` / SMS body", () => {
    for (let i = 0; i < 500; i += 1) {
      const reference = makeReference(PREFIX);
      // GSM-7 basic set only — no curly quotes, no em dashes, no emoji.
      expect(reference).toMatch(/^[\x20-\x7E]+$/);
      expect(reference.toUpperCase()).toBe(reference);
    }
  });
});

describe("makeReference — alphabet never emits I, O, 0 or 1", () => {
  it(`never emits an ambiguous glyph across ${SAMPLES.toLocaleString("en-PH")} references`, () => {
    const forbidden = new Set(["I", "O", "0", "1", "i", "o", "l"]);
    const seen = new Set<string>();

    for (let i = 0; i < SAMPLES; i += 1) {
      const code = codeOf(makeReference(PREFIX));
      for (const character of code) {
        seen.add(character);
        expect(forbidden.has(character), `emitted ambiguous glyph "${character}"`).toBe(false);
        expect(ALPHABET, `glyph "${character}" is outside the documented alphabet`).toContain(character);
      }
    }

    expect(seen.size).toBeGreaterThan(0);
  });

  it("the documented alphabet itself contains no I/O/0/1", () => {
    for (const glyph of ["I", "O", "0", "1"]) {
      expect(ALPHABET.includes(glyph), `alphabet contains "${glyph}"`).toBe(false);
    }
  });

  it("exercises the whole alphabet, so the modulus is not collapsing buckets", () => {
    // `% 32` over bytes 0..255 is uniform only because 256 % 32 === 0. If the
    // alphabet length ever changes without the rejection sampler changing,
    // half the alphabet goes dead. 60 000 draws ⇒ every glyph essentially
    // certain; the threshold is set well below the expected 32.
    const seen = new Set<string>();
    for (let i = 0; i < SAMPLES; i += 1) {
      for (const character of codeOf(makeReference(PREFIX))) seen.add(character);
    }
    // Every glyph must be reachable. A `% n` over bytes 0..255 is uniform only
    // when n divides 256; for any other n the tail symbols are under-sampled and
    // can go effectively dead. Equality against the real alphabet length is
    // stricter than a fixed threshold and survives the alphabet being narrowed.
    expect(seen.size).toBe(ALPHABET.length);
  });
});

describe("makeReference — uniqueness", () => {
  it(`produces ${SAMPLES.toLocaleString("en-PH")} distinct references`, () => {
    const seen = new Set<string>();
    for (let i = 0; i < SAMPLES; i += 1) seen.add(makeReference(PREFIX));
    // Birthday collisions at 32^6 are astronomically unlikely; allow a handful.
    expect(seen.size).toBeGreaterThanOrEqual(SAMPLES - 5);
  });

  it("is not a pure counter — two consecutive calls differ", () => {
    let identicalInARow = 0;
    let previous = makeReference(PREFIX);
    for (let i = 0; i < 200; i += 1) {
      const next = makeReference(PREFIX);
      if (next === previous) identicalInARow += 1;
      previous = next;
    }
    expect(identicalInARow).toBe(0);
  });
});

describe("makeReference — read-aloud safety", () => {
  /**
   * The reference must survive being dictated to a stranger.
   * Digit-length only ("six characters") is not enough; it must be *readable*.
   */
  it("every glyph has a distinct, unambiguous spoken form", () => {
    // Glyph pairs a human reliably confuses when reading over a phone line.
    const confusable = new Set([
      "0O", "0o", "0D", "Oo", "OD",
      "1I", "1l", "Il", "11",
      "2Z", "5S", "8B", "6G", "UV", "VY",
    ]);
    for (const glyph of ALPHABET) {
      for (const other of ALPHABET) {
        if (glyph === other) continue;
        expect(confusable.has(glyph + other), `"${glyph}" and "${other}" are both in the alphabet`).toBe(false);
      }
    }
  });

  /**
   * DEF-015 is closed at the code layer: the alphabet was narrowed to
   * `REFERENCE_ALPHABET` (21 glyphs) so that no confusable pair survives, and
   * `REFERENCE_CONFUSABLE_PAIRS` documents exactly which pairs were removed.
   * 21^6 = 85 million codes, which is ample for one shop.
   *
   * Still open (owner decision): whether the confirmation SMS should spell the
   * reference out phonetically ("E-Y-G 7-F-3-K-NINE-A") for customers who
   * mishear it. That needs `spellReference()` in `src/lib/server/reference.ts`.
   */
  it("documents every confusable pair it removed", () => {
    // The declaration and the alphabet must agree: a pair listed as removed but
    // still present in the set would mean the doc lies.
    for (const [a, b] of REFERENCE_CONFUSABLE_PAIRS) {
      const present = ALPHABET.includes(a) || ALPHABET.includes(b);
      expect(present, `${a}/${b} is listed as confusable but is still in the alphabet`).toBe(false);
    }
  });

  it.todo(
    "src/lib/server/reference.ts must export spellReference(ref) so the " +
      "reference can be spelled out phonetically in the confirmation SMS " +
      "(owner decision, not required for launch).",
  );
});