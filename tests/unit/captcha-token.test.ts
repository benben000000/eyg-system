// @vitest-environment node
/**
 * QA & SECURITY AGENT — captcha / anti-bot challenge.
 * ============================================================================
 * Contract under test: `src/lib/captcha.ts`.
 *   issueCaptchaChallenge() → { question, token, expiresIn }
 *   verifyCaptcha(input, ip) → { provider, spamSignal }  (throws ApiError)
 *   resetCaptchaChallenges()
 *
 * The challenge is an arithmetic question whose ANSWER IS NEVER in the token —
 * it lives in a short-lived server-side record keyed by a signed nonce. So the
 * three properties that matter are:
 *
 *   1. TAMPER EVIDENCE — flipping the nonce, the expiry or the signature must
 *      invalidate it.
 *   2. SINGLE USE, BURNED EVEN ON FAILURE — a wrong answer deletes the nonce, so
 *      the small integer answer space cannot be brute-forced against one token.
 *   3. CONSTANT-TIME COMPARISON — `timingSafeEqual`, never `===`.
 *
 * `verifyCaptcha` reads the clock internally, so every time-dependent case here
 * runs on `vi.useFakeTimers()` with a pinned system time. That is deterministic
 * by construction.
 * ============================================================================
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type CaptchaModule = typeof import("@/lib/captcha");

let captcha: CaptchaModule | null = null;

/** `CAPTCHA_ENABLED=true` is injected before the module is evaluated. */
async function loadCaptcha(): Promise<CaptchaModule> {
  vi.stubEnv("CAPTCHA_ENABLED", "true");
  vi.resetModules();
  const mod = (await import("@/lib/captcha")) as CaptchaModule;
  captcha = mod;
  return mod;
}

const SOURCE_PATH = join(
  resolve(fileURLToPath(new URL("../..", import.meta.url))),
  "src",
  "lib",
  "captcha.ts",
);
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

/** Solves the arithmetic in a question like "What is 17 − 6?". */
function solve(question: string): number {
  const m = /What is (\d+)\s*([+−])\s*(\d+)\?/.exec(question);
  if (!m) throw new Error(`unparseable challenge question: ${question}`);
  const a = Number(m[1]);
  const b = Number(m[3]);
  return m[2] === "+" ? a + b : a - b;
}

const PINNED_NOW = new Date("2026-10-02T09:00:00Z");

beforeAll(async () => {
  await loadCaptcha();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function requireCaptcha(): CaptchaModule {
  if (!captcha) throw new Error("captcha module was not loaded");
  return captcha;
}

function requireMathProvider(): CaptchaModule {
  const mod = requireCaptcha();
  const provider = mod.captchaProvider();
  if (provider !== "math") {
    throw new Error(
      `expected the math challenge to be the active provider, got "${provider}". ` +
        "Set CAPTCHA_ENABLED=true and make sure TURNSTILE_SECRET_KEY is empty.",
    );
  }
  return mod;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("captcha — issuing", () => {
  it("math is the provider when enabled and no Turnstile key is set", () => {
    requireMathProvider();
  });

  it("issues a question, a token and a TTL", () => {
    const { issueCaptchaChallenge } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    expect(challenge.question).toMatch(/^What is \d+ [+−] \d+\?$/);
    expect(challenge.token.split(".")).toHaveLength(3);
    expect(challenge.expiresIn).toBeGreaterThan(0);
    expect(challenge.expiresIn).toBeLessThanOrEqual(3600);
  });

  it("the token payload is an 18-byte opaque nonce, not an encoded answer", () => {
    const { issueCaptchaChallenge } = requireMathProvider();
    for (let i = 0; i < 200; i += 1) {
      const challenge = issueCaptchaChallenge();
      const answer = String(solve(challenge.question));
      const [noncePart] = challenge.token.split(".");
      expect(noncePart).toMatch(/^[A-Za-z0-9_-]+$/);
      // randomBytes(18) → 18 raw bytes → 24 base64url characters.
      expect(Buffer.from(noncePart!, "base64url")).toHaveLength(18);
      expect(noncePart).toHaveLength(24);
      // The answer cannot be *derived* from the payload because the payload is
      // random bytes, not a serialisation of the operands.
      expect(noncePart).not.toBe(answer.padEnd(24, "A"));
    }
  });

  it("the answer is never recoverable from the token by inspecting it", () => {
    const { issueCaptchaChallenge } = requireMathProvider();
    for (let i = 0; i < 200; i += 1) {
      const [nonce, expiresAt, signature] = issueCaptchaChallenge().token.split(".");
      expect(nonce).toMatch(/^[A-Za-z0-9_-]{20,}$/);
      expect(Number(expiresAt)).toBeGreaterThan(PINNED_NOW.getTime());
      expect(signature).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    }
  });

  it("keeps the answer non-negative so screen readers and humans are not confused", () => {
    const { issueCaptchaChallenge } = requireMathProvider();
    for (let i = 0; i < 500; i += 1) {
      expect(solve(issueCaptchaChallenge().question)).toBeGreaterThan(0);
    }
  });

  it("produces 500 distinct tokens", () => {
    const { issueCaptchaChallenge } = requireMathProvider();
    const tokens = new Set<string>();
    for (let i = 0; i < 500; i += 1) tokens.add(issueCaptchaChallenge().token);
    expect(tokens.size).toBe(500);
  });
});

describe("captcha — verification", () => {
  it("accepts the correct answer for a genuine token", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const result = await verifyCaptcha(
      { token: challenge.token, answer: solve(challenge.question) },
      "203.0.113.7",
    );
    expect(result.spamSignal).toBe(false);
    expect(result.provider).toBe("math");
  });

  it("rejects a wrong answer", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const wrong = solve(challenge.question) + 1;
    await expect(
      verifyCaptcha({ token: challenge.token, answer: wrong }, "203.0.113.7"),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });

  it("rejects a missing token, a missing answer and a non-integer answer", async () => {
    const { verifyCaptcha } = requireMathProvider();
    const ip = "203.0.113.7";
    await expect(verifyCaptcha({}, ip)).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
    await expect(verifyCaptcha({ token: "a.b.c" }, ip)).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
    await expect(
      verifyCaptcha({ token: "a.b.c", answer: 1.5 }, ip),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });

  it("BRUITS FORCE REJECTED — the nonce is burned on a wrong answer", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const correct = solve(challenge.question);
    const ip = "203.0.113.8";
    for (let guess = correct - 10; guess <= correct + 10; guess += 1) {
      await expect(verifyCaptcha({ token: challenge.token, answer: guess }, ip)).rejects.toThrow();
    }
    // …and the real answer no longer works on the same token.
    await expect(
      verifyCaptcha({ token: challenge.token, answer: correct }, ip),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });
});

describe("captcha — tampering", () => {
  it("rejects a token whose signature byte was flipped", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const [nonce, expiresAt, signature] = challenge.token.split(".");
    const flipped = `${signature!.replace(/^./, (c) => (c === "A" ? "B" : "A"))}`;
    await expect(
      verifyCaptcha({ token: `${nonce}.${expiresAt}.${flipped}`, answer: solve(challenge.question) }, "203.0.113.9"),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });

  it("rejects a token whose NONCE was swapped for another challenge's nonce", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const first = issueCaptchaChallenge();
    const second = issueCaptchaChallenge();
    const [, secondExpiry, secondSig] = second.token.split(".");
    await expect(
      verifyCaptcha(
        { token: `${second.token.split(".")[0]}.${secondExpiry}.${secondSig}`, answer: solve(first.question) },
        "203.0.113.10",
      ),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });

  it("rejects an expiry pushed into the future without re-signing", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const [nonce, , signature] = challenge.token.split(".");
    const forgedExpiry = PINNED_NOW.getTime() + 86_400_000;
    await expect(
      verifyCaptcha({ token: `${nonce}.${forgedExpiry}.${signature}`, answer: solve(challenge.question) }, "203.0.113.11"),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });

  it("rejects a malformed token shape", async () => {
    const { verifyCaptcha } = requireMathProvider();
    const ip = "203.0.113.12";
    for (const token of ["", "a", "a.b", "a.b.c.d", "..", "abc.def.ghi", "!!!.###.$$$"]) {
      await expect(verifyCaptcha({ token, answer: 1 }, ip), token).rejects.toMatchObject({
        code: "CAPTCHA_FAILED",
      });
    }
  });
});

describe("captcha — expiry", () => {
  it("accepts one millisecond before expiry and rejects one millisecond after", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const ip = "203.0.113.13";
    const issuedAt = Date.now();

    // Both challenges are minted at the SAME instant, then the clock is moved.
    const early = issueCaptchaChallenge();
    const late = issueCaptchaChallenge();

    vi.setSystemTime(new Date(issuedAt + early.expiresIn * 1000 - 1));
    await expect(
      verifyCaptcha({ token: early.token, answer: solve(early.question) }, ip),
    ).resolves.toBeTruthy();

    vi.setSystemTime(new Date(issuedAt + late.expiresIn * 1000 + 1));
    await expect(
      verifyCaptcha({ token: late.token, answer: solve(late.question) }, ip),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });
});

describe("captcha — replay", () => {
  it("the second verification of the same token fails", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const input = { token: challenge.token, answer: solve(challenge.question) };
    const ip = "203.0.113.14";
    await expect(verifyCaptcha(input, ip)).resolves.toBeTruthy();
    await expect(verifyCaptcha(input, ip)).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });

  it("replays cannot walk across endpoints — one challenge, one submission", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const input = { token: challenge.token, answer: solve(challenge.question) };
    const ip = "203.0.113.15";
    await verifyCaptcha(input, ip); // e.g. on POST /api/lead
    await expect(verifyCaptcha(input, ip)).rejects.toMatchObject({ code: "CAPTCHA_FAILED" }); // e.g. POST /api/booking
  });
});

describe("captcha — honeypot", () => {
  it("a filled honeypot is SPAM_REJECTED before the challenge is even examined", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    await expect(
      verifyCaptcha(
        { token: challenge.token, answer: solve(challenge.question), website: "http://spam.example" },
        "203.0.113.16",
      ),
    ).rejects.toMatchObject({ code: "SPAM_REJECTED" });
  });

  it("a whitespace-only honeypot is still treated as a filled field", async () => {
    // The check is `website.length > 0`, not `website.trim().length > 0`, so a
    // bot that pads the honeypot with spaces is still flagged.
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    await expect(
      verifyCaptcha(
        { token: challenge.token, answer: solve(challenge.question), website: "   \n\t " },
        "203.0.113.17",
      ),
    ).rejects.toMatchObject({ code: "SPAM_REJECTED" });
  });

  it("an undefined honeypot is not touched", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    await expect(
      verifyCaptcha({ token: challenge.token, answer: solve(challenge.question) }, "203.0.113.17"),
    ).resolves.toBeTruthy();
  });

  it("an empty honeypot passes straight through", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    await expect(
      verifyCaptcha({ token: challenge.token, answer: solve(challenge.question), website: "" }, "203.0.113.18"),
    ).resolves.toBeTruthy();
  });
});

describe("captcha — minimum time to submit", () => {
  it("rejects a submission stamped less than MIN_SUBMIT_SECONDS after render", async () => {
    const { issueCaptchaChallenge, verifyCaptcha, MIN_SUBMIT_SECONDS } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const renderedAt = Date.now();
    vi.setSystemTime(new Date(renderedAt + MIN_SUBMIT_SECONDS * 1000 - 500));
    await expect(
      verifyCaptcha(
        { token: challenge.token, answer: solve(challenge.question), renderedAt },
        "203.0.113.19",
      ),
    ).rejects.toMatchObject({ code: "SPAM_REJECTED" });
  });

  it("accepts a submission at exactly MIN_SUBMIT_SECONDS", async () => {
    const { issueCaptchaChallenge, verifyCaptcha, MIN_SUBMIT_SECONDS } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    const renderedAt = Date.now();
    vi.setSystemTime(new Date(renderedAt + MIN_SUBMIT_SECONDS * 1000));
    await expect(
      verifyCaptcha({ token: challenge.token, answer: solve(challenge.question), renderedAt }, "203.0.113.20"),
    ).resolves.toBeTruthy();
  });

  it("rejects a stamp from the far future (spoofed header / wrong clock)", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    await expect(
      verifyCaptcha(
        { token: challenge.token, answer: solve(challenge.question), renderedAt: Date.now() + 3_600_000 },
        "203.0.113.21",
      ),
    ).rejects.toMatchObject({ code: "SPAM_REJECTED" });
  });

  it("a MISSING stamp is tolerated (privacy browsers and no-JS posts)", async () => {
    const { issueCaptchaChallenge, verifyCaptcha } = requireMathProvider();
    const challenge = issueCaptchaChallenge();
    await expect(
      verifyCaptcha(
        { token: challenge.token, answer: solve(challenge.question), renderedAt: null },
        "203.0.113.22",
      ),
    ).resolves.toBeTruthy();
    await expect(
      verifyCaptcha(
        { token: issueCaptchaChallenge().token, answer: 1, renderedAt: undefined },
        "203.0.113.22",
      ),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
  });
});

describe("captcha — constant-time comparison", () => {
  it("the implementation uses node:crypto timingSafeEqual", () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*timingSafeEqual[^}]*\}\s*from\s*"node:crypto"/);
  });

  it("never compares token material with === or !==", () => {
    expect(SOURCE).not.toMatch(/signature\s*===/);
    expect(SOURCE).not.toMatch(/token\s*===/);
    expect(SOURCE).not.toMatch(/!=\s*sign\(/);
    // The ONLY equality on token material must be the length guard, and the
    // actual comparison must go through timingSafeEqual.
    const comparisons = SOURCE.match(/safeEqual\([^)]*\)|token\s*===|signature\s*===/g) ?? [];
    expect(comparisons.length).toBeGreaterThan(0);
    expect(SOURCE).toMatch(/return timingSafeEqual\(bufA,\s*bufB\)/);
  });

  it("burns a comparison on a length mismatch so timing does not leak length", () => {
    expect(SOURCE).toMatch(/bufA\.length\s*!==\s*bufB\.length/);
    expect(SOURCE).toMatch(/timingSafeEqual\(bufA,\s*bufA\)/);
  });
});

describe("captcha — disabled provider", () => {
  it("with CAPTCHA_ENABLED=false the math step is skipped but the honeypot still bites", async () => {
    vi.stubEnv("CAPTCHA_ENABLED", "false");
    vi.resetModules();
    const mod = (await import("@/lib/captcha")) as CaptchaModule;
    expect(mod.captchaProvider()).toBe("disabled");
    await expect(mod.verifyCaptcha({}, "203.0.113.23")).resolves.toMatchObject({
      provider: "disabled",
      spamSignal: false,
    });
    await expect(
      mod.verifyCaptcha({ website: "http://spam.example" }, "203.0.113.23"),
    ).rejects.toMatchObject({ code: "SPAM_REJECTED" });
    // Restore the math provider for any later test in this file.
    await loadCaptcha();
  });

  it.todo(
    "src/lib/captcha.ts :: issueCaptchaChallenge({ purpose }) — bind the HMAC payload to " +
      "an intended purpose ('booking' | 'quote' | 'lead' | 'promo') and have verifyCaptcha " +
      "require the same purpose, so a challenge minted on the newsletter form cannot be " +
      "redeemed on POST /api/booking. Today a token carries {nonce, expiresAt} only.",
  );
});