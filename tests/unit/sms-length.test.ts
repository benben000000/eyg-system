// @vitest-environment node
/**
 * QA & SECURITY AGENT — SMS template length and encodability.
 * ============================================================================
 * Contract under test: `src/content/marketing/copy.ts`.
 *   SMS_MAX_LENGTH, SMS_OPT_OUT_LINE, SMS_SENDER_PREFIX, SMS_TEMPLATE_KEYS,
 *   SMS_TEMPLATES, SMS_TOKENS, renderSms, smsLength, assertSmsFits,
 *   assertSmsConsent, SMS_MARKETING_COOLDOWN_DAYS
 *
 * PH mobile SMS bills per 160-character GSM-7 segment (70 for UCS-2). This shop
 * has 308 Facebook followers and no marketing budget: a confirmation SMS that
 * splits into two segments doubles the cost of every booking, and one that falls
 * to UCS-2 because of a single emoji or a curly apostrophe costs 3×.
 *
 * Two rules this suite holds:
 *   1. LENGTH — every template renders ≤160 GSM-7 septets with the LONGEST
 *      plausible values substituted.
 *   2. ENCODING — every template is GSM-7 encodable. `₱`, `—`, `–`, `’`, `“”`
 *      and `…` are all outside the GSM 03.38 basic character set and force the
 *      whole message to UCS-2.
 * ============================================================================
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  SMS_MARKETING_COOLDOWN_DAYS,
  SMS_MAX_LENGTH,
  SMS_OPT_OUT_LINE,
  SMS_SENDER_PREFIX,
  SMS_TEMPLATE_KEYS,
  SMS_TEMPLATES,
  SMS_TOKENS,
  assertSmsConsent,
  assertSmsFits,
  renderSms,
  smsLength,
  type SmsTemplateKey,
  type SmsVars,
} from "@/content/marketing/copy";

// ── GSM 03.38 basic character set (3GPP TS 23.038 §9.1.1) ──────────────────
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const GSM_BASIC_SET = new Set(GSM_BASIC.split(""));
/** Basic-set characters that need the GSM-7 extension escape (2 septets). */
const GSM_EXTENDED = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

/** Exact GSM-7 septet count. */
export function gsm7Length(input: string): number {
  let septets = 0;
  for (const character of input) {
    if (GSM_EXTENDED.has(character)) septets += 2;
    else if (GSM_BASIC_SET.has(character)) septets += 1;
    else septets += 2; // outside GSM-7 → the message is sent as UCS-2
  }
  return septets;
}

/** Would this message be sent as GSM-7 at all? */
export function isGsm7(input: string): boolean {
  for (const character of input) {
    if (GSM_EXTENDED.has(character)) continue;
    if (!GSM_BASIC_SET.has(character)) return false;
  }
  return true;
}

const UCS2_LIMIT = 70;

/** The worst plausible value for every token, all at once. */
const LONG_VARS: SmsVars = {
  sender: SMS_SENDER_PREFIX,
  optout: SMS_OPT_OUT_LINE,
  reference: "EYG-7F3K9A",
  name: "Maria Concepcion Del Rosario",
  date: "Wed 11 Mar",
  time: "9:00 AM",
  services: "Undercoating, Brake Pad Replacement, PMS A + 3 more",
  servicesCount: "8",
  mins: "90",
  eta: "25 minutes",
  min: "1,200",
  max: "9,500",
  url: "https://eygtireautocare.ph/book",
  title: "Rainy Season Safety Bundle",
  value: "15% off",
  end: "30 Nov 2026",
  plate: "ABC 1234",
  total: "3,350",
};

/** Marketing templates must carry the opt-out; transactional ones must not need to. */
const isMarketing = (key: SmsTemplateKey): boolean => SMS_TEMPLATES[key].purpose === "marketing";

const KEYS = SMS_TEMPLATE_KEYS;

const SOURCE = readFileSync(
  join(resolve(fileURLToPath(new URL("../..", import.meta.url))), "src", "content", "marketing", "copy.ts"),
  "utf8",
);

// ─────────────────────────────────────────────────────────────────────────────

describe("sms-length — the module is present and complete", () => {
  it("declares all eleven templates", () => {
    expect(KEYS.length).toBe(11);
    expect(Object.keys(SMS_TEMPLATES).sort()).toEqual([...KEYS].sort());
  });

  it("every template names its own key, purpose and legal note", () => {
    for (const key of KEYS) {
      const template = SMS_TEMPLATES[key];
      expect(template.key, key).toBe(key);
      expect(["transactional", "marketing"], key).toContain(template.purpose);
      expect(template.purposeNote.trim().length, key).toBeGreaterThan(20);
      expect(typeof template.requiresConsent, key).toBe("boolean");
    }
  });

  it("every {{token}} used in a body is declared in SMS_TOKENS", () => {
    const declared = new Set<string>(SMS_TOKENS);
    for (const key of KEYS) {
      for (const match of SMS_TEMPLATES[key].body.matchAll(/\{\{(\w+)\}\}/g)) {
        expect(declared, `${key} uses undeclared token {{${match[1]}}}`).toContain(match[1]!);
      }
    }
  });

  it("sets a 160-character limit and a concrete opt-out line", () => {
    expect(SMS_MAX_LENGTH).toBe(160);
    expect(SMS_OPT_OUT_LINE.trim()).not.toBe("");
    expect(SMS_OPT_OUT_LINE).toMatch(/stop|opt out|unsubscribe/i);
    expect(SMS_SENDER_PREFIX.trim()).not.toBe("");
  });
});

describe("sms-length — every template fits ONE GSM-7 segment", () => {
  it.each(KEYS.map((key) => [key] as const))("%s renders ≤160 GSM-7 septets", (key) => {
    const message = renderSms(key, LONG_VARS);
    expect(
      gsm7Length(message),
      `${key} rendered ${gsm7Length(message)} septets (budget 160):\n${message}`,
    ).toBeLessThanOrEqual(SMS_MAX_LENGTH);
  });

  it.each(KEYS.map((key) => [key] as const))("%s renders ≤160 characters with NO vars at all", (key) => {
    const message = renderSms(key);
    expect(message.length, `${key} with no vars:\n${message}`).toBeLessThanOrEqual(SMS_MAX_LENGTH);
  });

  it("the documented worst case (BOOKING_CONFIRMED at 147) still holds", () => {
    const message = renderSms("BOOKING_CONFIRMED", LONG_VARS);
    expect(gsm7Length(message)).toBeLessThanOrEqual(SMS_MAX_LENGTH);
    expect(smsLength("BOOKING_CONFIRMED", LONG_VARS)).toBe(gsm7Length(message));
  });
});

/**
 * ⚠ EXPECTED TO FAIL — DEF-011 (High).
 *
 * `BOOKING_CONFIRMED` has 70 characters of literal overhead. With the module's
 * own documented worst case — sender + a real reference + a real date + a real
 * time + three real service names plus "+N more" — it renders **169
 * characters**, 9 over the 160 limit. `assertSmsFits` therefore throws for any
 * booking with three ordinary services, so the confirmation SMS is never sent.
 *
 * The source comment ("Longest rendered message is BOOKING_CONFIRMED at 147
 * chars … every other template has 30+ characters of slack") was measured with
 * short placeholders and is wrong for real data.
 */
describe("sms-length — the module's own documented worst case (DEF-011, expected to fail)", () => {
  const CAPPED_SERVICES = "Brake Pad Replacement (front axle), Tyre Balance, PMS A + 5 more";

  it("BOOKING_CONFIRMED fits 160 with three real service names", () => {
    const message = renderSms("BOOKING_CONFIRMED", { ...LONG_VARS, services: CAPPED_SERVICES });
    expect(
      message.length,
      `rendered ${message.length} chars:\n${message}`,
    ).toBeLessThanOrEqual(SMS_MAX_LENGTH);
  });

  it("assertSmsFits does not throw for a realistic three-service booking", () => {
    expect(() => assertSmsFits("BOOKING_CONFIRMED", { ...LONG_VARS, services: CAPPED_SERVICES })).not.toThrow();
  });

  it("the literal overhead of every template leaves room for a real payload", () => {
    const report: string[] = [];
    for (const key of KEYS) {
      const overhead = SMS_TEMPLATES[key].body.replace(/\{\{\w+\}\}/g, "").length;
      const slack = SMS_MAX_LENGTH - overhead;
      if (slack < 70) report.push(`${key}: ${overhead} literal chars, ${slack} left for values`);
    }
    expect(report, `templates with too little slack for real values: ${report.join("; ")}`).toEqual([]);
  });
});

/**
 * ⚠ EXPECTED TO FAIL — DEF-009.
 *
 * `PROMO_BLURB` contains a typographic em dash (U+2014):
 *
 *   "{{sender}}: {{title}} — {{value}} until {{end}}. "
 *
 * U+2014 is NOT in the GSM 03.38 basic character set. One character downgrades
 * the whole message to UCS-2, which means a 1-segment promo blurb is billed as
 * 3 segments (70/70/57) and is delivered with a GSM-03.38-unaware handset
 * rendering "?" instead.
 *
 * `smsLength()` uses `.length` (UTF-16 code units), which cannot see this, and
 * `assertSmsFits()` only compares that length to 160 — so neither guard catches
 * it. The whole message silently costs 3×.
 */
describe("sms-length — GSM-7 encodability (DEF-009, expected to fail)", () => {
  it("every template is GSM-7 encodable", () => {
    const offenders: string[] = [];
    for (const key of KEYS) {
      const message = renderSms(key, LONG_VARS);
      if (!isGsm7(message)) {
        const bad = [...new Set([...message].filter((c) => !GSM_BASIC_SET.has(c) && !GSM_EXTENDED.has(c)))];
        offenders.push(
          `${key}: ${bad
            .map((c) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")})`)
            .join(", ")}`,
        );
      }
    }
    expect(offenders, `non-GSM-7 templates (each costs 3x): ${offenders.join(" | ")}`).toEqual([]);
  });

  it("no template LITERAL contains a non-GSM-7 character", () => {
    const offenders: string[] = [];
    for (const key of KEYS) {
      const bad = [...new Set([...SMS_TEMPLATES[key].body].filter((c) => !GSM_BASIC_SET.has(c) && !GSM_EXTENDED.has(c)))];
      if (bad.length > 0) {
        offenders.push(`${key}: ${bad.map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(", ")}`);
      }
    }
    expect(offenders, `non-GSM-7 literals: ${offenders.join(" | ")}`).toEqual([]);
  });
});

describe("sms-length — token substitution safety", () => {
  it("renders no undefined, null, NaN or [object Object]", () => {
    for (const key of KEYS) {
      for (const vars of [LONG_VARS, {}, { services: "PMS" }]) {
        const message = renderSms(key, vars);
        expect(message, `${key}`).not.toMatch(/undefined|null|NaN|\[object/i);
      }
    }
  });

  it("collapses the whitespace left behind by stripped tokens", () => {
    for (const key of KEYS) {
      const message = renderSms(key, { sender: SMS_SENDER_PREFIX, optout: SMS_OPT_OUT_LINE });
      expect(message, key).not.toMatch(/[ \t]{2,}/);
      expect(message, key).not.toMatch(/\s+[,.!?]/);
      expect(message.trim(), key).toBe(message.trim());
    }
  });

  it("never sends a customer an unsubstituted {{placeholder}} (DEF-010)", () => {
    for (const key of KEYS) {
      const message = renderSms(key, LONG_VARS);
      const leftover = [...message.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);
      expect(leftover, `${key} still contains ${leftover.join(", ")}`).toEqual([]);
    }
  });

  it("assertSmsFits — the documented send gate — refuses a message that still has a placeholder (DEF-010)", () => {
    // `renderSms` deliberately leaves an unknown/missing token visible, which is
    // right for a preview. But `assertSmsFits` is the only guard between the
    // renderer and Twilio, and today it checks LENGTH ONLY — so a confirmation
    // that still reads "on {{date}}, {{time}}" passes the gate and is billed.
    expect(() => assertSmsFits("BOOKING_CONFIRMED", { services: "PMS" })).toThrow(/\{\{/);
    expect(() => assertSmsFits("QUOTE_READY", { min: "1,200", max: "9,500" })).toThrow(/\{\{/);
  });

  it("an unknown token is surfaced by renderSms rather than silently swallowed", () => {
    // Correct behaviour for preview: the typo must be visible.
    expect(renderSms("QUOTE_READY", { sender: SMS_SENDER_PREFIX, optout: SMS_OPT_OUT_LINE })).toMatch(
      /\{\{\w+\}\}/,
    );
  });
});

describe("sms-length — consent and stop", () => {
  it("every marketing template carries the opt-out line", () => {
    for (const key of KEYS) {
      if (!isMarketing(key)) continue;
      expect(renderSms(key, { ...LONG_VARS, optout: SMS_OPT_OUT_LINE }), key).toMatch(
        new RegExp(SMS_OPT_OUT_LINE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      );
    }
  });

  it("every template that requires consent refuses to render without it", () => {
    for (const key of KEYS) {
      expect(SMS_TEMPLATES[key].requiresConsent, key).toBe(true);
      expect(() => assertSmsConsent(key, false), key).toThrow(/consent/i);
      expect(() => assertSmsConsent(key, true), key).not.toThrow();
    }
  });

  it("marketing and transactional templates are labelled honestly", () => {
    expect(KEYS.filter(isMarketing)).toEqual([
      "PROMO_BLURB",
      "REVIEW_REQUEST",
      "SERVICE_DUE_NUDGE",
    ]);
    // A booking confirmation is transactional under RA 9486 — it does not need an
    // opt-out line, and pretending otherwise wastes 24 characters of a 160 budget.
    for (const key of KEYS.filter((k) => k.startsWith("BOOKING_") || k === "ROADSIDE_EN_ROUTE")) {
      expect(SMS_TEMPLATES[key].purpose, key).toBe("transactional");
    }
  });

  it("there is a real cool-down between marketing sends", () => {
    expect(SMS_MARKETING_COOLDOWN_DAYS).toBeGreaterThanOrEqual(14);
  });

  it("every template ends with something the customer can act on, or a clear courtesy close", () => {
    for (const key of KEYS) {
      const message = renderSms(key, LONG_VARS);
      expect(
        message,
        key,
      ).toMatch(
        /\+63[\d\s-]{8,}|https?:\/\/\S+|Reply|Collect|Nothing is charged|Ask us|Thanks for waiting|we will call|stay in the car/i,
      );
    }
  });
});

describe("sms-length — assertSmsFits is a real gate", () => {
  it("returns the rendered body when it fits", () => {
    const body = assertSmsFits("BOOKING_REMINDER_24H", LONG_VARS);
    expect(body).toContain("EYG-7F3K9A");
    expect(gsm7Length(body)).toBeLessThanOrEqual(SMS_MAX_LENGTH);
  });

  it("defaults `sender` and `optout` so production cannot forget them", () => {
    const body = assertSmsFits("PROMO_BLURB", { title: "Tyre Clearance", value: "10% off", end: "20 Dec 2026" });
    expect(body).toContain(SMS_SENDER_PREFIX);
    expect(body).toContain(SMS_OPT_OUT_LINE);
  });

  it("throws with an actionable message when over budget", () => {
    // Asserted against the *behaviour* rather than one specific guard: passing
    // only `services` leaves `reference`/`date`/`time` unfilled, so the
    // placeholder guard (DEF-010) fires before the length guard would. Either
    // refusal is correct — what matters is that the message is actionable and
    // names the file to edit.
    expect(() =>
      assertSmsFits("BOOKING_CONFIRMED", {
        services: "X".repeat(400),
        reference: "EYG-7F3K9A",
        date: "Wed 11 Mar",
        time: "9:00 AM",
      }),
    ).toThrow(/over the 160 limit|copy\.ts/);
  });

  it("the throw message names the template so the author knows what to shorten", () => {
    expect(() => assertSmsFits("BOOKING_CONFIRMED", { services: "X".repeat(400) })).toThrowError(/BOOKING_CONFIRMED/);
  });
});

describe("sms-length — the module never references a secret", () => {
  it("names no server secret", () => {
    for (const needle of [
      "AUTH_SECRET",
      "WEBHOOK_SIGNING_SECRET",
      "PII_ENCRYPTION_KEY",
      "TWILIO_AUTH_TOKEN",
      "RESEND_API_KEY",
      "SMTP_PASSWORD",
      "GOOGLE_API_KEY",
    ]) {
      expect(SOURCE, `copy.ts must not reference ${needle}`).not.toContain(needle);
    }
  });

  it("never reads process.env", () => {
    expect(SOURCE).not.toContain("process.env");
  });
});

describe("sms-length — GSM-7 accounting (self-check, no module needed)", () => {
  it("counts ASCII as one septet", () => {
    expect(gsm7Length("abc")).toBe(3);
    expect(gsm7Length("")).toBe(0);
  });

  it("counts the GSM-7 extension characters as two septets each", () => {
    expect(gsm7Length("[")).toBe(2);
    expect(gsm7Length("{a}")).toBe(5); // { + a + } = 2 + 1 + 2
  });

  it("the peso sign is NOT in the GSM 03.38 basic set", () => {
    expect(isGsm7("\u20B11,250")).toBe(false);
  });

  it("flags the typography PH copy naturally reaches for", () => {
    for (const character of ["\u2018", "\u2019", "\u201C", "\u201D", "\u2013", "\u2014", "\u2026"]) {
      expect(isGsm7(character), `U+${character.codePointAt(0)!.toString(16)} is not GSM-7`).toBe(false);
    }
    expect(isGsm7("EYG: 9:00 AM, Fri 11 Mar. Book now!")).toBe(true);
  });

  it("flags emoji as non-GSM-7", () => {
    expect(isGsm7("\u2705")).toBe(false);
    expect(isGsm7("\uD83D\uDE4F")).toBe(false);
  });

  it("knows the real segment limits: 160 GSM-7, 70 UCS-2", () => {
    expect(SMS_MAX_LENGTH).toBe(160);
    expect(UCS2_LIMIT).toBe(70);
    expect(gsm7Length("a".repeat(160))).toBe(160);
    expect(gsm7Length("a".repeat(161))).toBe(161);
  });
});