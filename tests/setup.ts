/**
 * QA & SECURITY AGENT — global test setup.
 * ============================================================================
 * Two jobs, both load-bearing:
 *
 *  1. POLYFILL ONLY WHAT jsdom LACKS. jsdom 26 already implements most of the
 *     DOM; anything that *does* exist is left alone so a test never exercises a
 *     stub instead of the real thing. We do not, for example, stub
 *     `Element.prototype.matches` because jsdom has a correct one.
 *
 *  2. REFUSE TO RUN AGAINST A GUESSABLE SECRET. If `AUTH_SECRET` looks like a
 *     placeholder, a whole class of security tests (HMAC, session, CSRF) would
 *     quietly prove nothing, because a 4-character secret is trivially forgeable.
 *     This turns a false-green into a loud red.
 * ============================================================================
 */
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach } from "vitest";

// ── 1. jsdom gaps ───────────────────────────────────────────────────────────

/** `crypto.getRandomValues` — drives `makeReference`. Node has it; jsdom may not. */
if (typeof globalThis.crypto === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
if (typeof globalThis.crypto.getRandomValues !== "function") {
  Object.defineProperty(globalThis.crypto, "getRandomValues", {
    value: (array: Uint8Array): Uint8Array => webcrypto.getRandomValues(array),
    configurable: true,
    writable: true,
  });
}
if (typeof globalThis.crypto.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: (): string => webcrypto.randomUUID(),
    configurable: true,
    writable: true,
  });
}

/** `matchMedia` — `prefers-reduced-motion` and dark-mode hooks read it. */
if (typeof globalThis.matchMedia !== "function") {
  Object.defineProperty(globalThis, "matchMedia", {
    value: (query: string): MediaQueryList => {
      const listeners = new Set<(event: MediaQueryListEvent) => void>();
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        addListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => false,
        // Captured so the listener set is not garbage-collected and so a test
        // can prove the object identity is stable (React hooks rely on it).
        listeners,
      } as unknown as MediaQueryList;
    },
    configurable: true,
    writable: true,
  });
}

class NoopObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver !== "function") {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: NoopObserver,
    configurable: true,
    writable: true,
  });
}

class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver !== "function") {
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: NoopResizeObserver,
    configurable: true,
    writable: true,
  });
}

// ── 2. Never run against a guessable secret ────────────────────────────────

/**
 * Values that are *technically* long enough to satisfy `secret(32)` but are
 * not a secret. A suite that runs against `CHANGEME-CHANGEME-CHANGEME-...`
 * proves nothing about HMAC forgery resistance.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^(change[-_ ]?me|replace[-_ ]?me|placeholder|example|dummy|test|secret|password|pass)/i,
  /(change[-_ ]?me|replace[-_ ]?me|placeholder|your[-_ ]?|todo|fixme|xxx+)/i,
  /^(.)\1+$/, // a single repeated character
  /^0+$/, // all zeroes
];

const MIN_SECRET_LENGTH = 32;

/** Collects every reason the current environment is not safe to test against. */
function secretProblems(name: string, value: string | undefined): string[] {
  const problems: string[] = [];
  if (value === undefined) {
    problems.push(`${name} is not set at all`);
    return problems;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    problems.push(`${name} is empty`);
    return problems;
  }
  if (trimmed.length < MIN_SECRET_LENGTH) {
    problems.push(`${name} is only ${trimmed.length} chars (need ≥ ${MIN_SECRET_LENGTH})`);
  }
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) problems.push(`${name} looks like a placeholder (${pattern})`);
  }
  return problems;
}

const problems: string[] = [
  ...secretProblems("AUTH_SECRET", process.env.AUTH_SECRET),
  ...secretProblems("PII_ENCRYPTION_KEY", process.env.PII_ENCRYPTION_KEY),
  ...secretProblems("WEBHOOK_SIGNING_SECRET", process.env.WEBHOOK_SIGNING_SECRET),
];

if (problems.length > 0) {
  throw new Error(
    [
      "",
      "══════════════════════════════════════════════════════════════════",
      " QA SECURITY GUARD — refusing to run the test suite.",
      "",
      " The following environment values are missing or look like placeholders:",
      ...problems.map((p) => `   • ${p}`),
      "",
      " Every secret must be ≥32 chars and NOT match:",
      "   change-me / replace-me / placeholder / your-X / todo / xxx / all-one-char.",
      "",
      " Why this is fatal: HMAC, session and CSRF tests all *prove* something",
      " only when the secret is unpredictable. Against a guessable secret they",
      " are theatre, and a green run would be a lie.",
      "",
      " Fix: set real values (openssl rand -base64 48), or set the test-only",
      " values that vitest.config.ts already injects when running via vitest.",
      "══════════════════════════════════════════════════════════════════",
      "",
    ].join("\n"),
  );
}

// ── 3. Determinism hygiene ──────────────────────────────────────────────────

/**
 * Every spec is expected to pin `process.env.TZ` itself. We only record the
 * starting value so a failure message can name the ambient zone, which is the
 * single most useful clue when a timezone-sensitive assertion goes red.
 */
const AMBIENT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

beforeEach(() => {
  (globalThis as Record<string, unknown>).__QA_AMBIENT_TZ__ = AMBIENT_TZ;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__QA_AMBIENT_TZ__;
});