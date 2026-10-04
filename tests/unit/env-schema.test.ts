// @vitest-environment node
/**
 * QA & SECURITY AGENT — environment schema: fail-closed, no silent ignores,
 * no secret in a public key.
 * ============================================================================
 * `.env.example` line 4–5 makes a hard promise:
 *
 *   "Every var below is validated at boot by `src/lib/env.ts` — the app
 *    refuses to start with an invalid combination."
 *
 * These tests hold the app to that sentence:
 *   1. Every key in `.env.example` is either a validated server-schema key or
 *      an explicitly-documented `NEXT_PUBLIC_*` key. Nothing is silently read
 *      straight off `process.env` and nothing is silently ignored.
 *   2. Removing a required production secret makes the module THROW, and the
 *      throw names the KEY but never the VALUE.
 *   3. A fully-specified production environment loads cleanly.
 *   4. No server-only secret is ever re-exported under a `NEXT_PUBLIC_*` key,
 *      and no `NEXT_PUBLIC_*` value looks like a server secret.
 * ============================================================================
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");
const ENV_TS_PATH = join(ROOT, "src", "lib", "env.ts");

const STRONG_SECRET = "K3y-0f-a-S3cret-with-9x8q7w-entropy-and-no-banned-word-zz11qq22";
const STRONG_SECRET_2 = "An0ther-S3cret-with-enough-entropy-to-pass-the-32-char-guard-aa11bb";

/** `.env` files that may exist locally. Never uploaded, never committed. */
function localEnvFiles(): readonly string[] {
  try {
    return readdirSync(ROOT)
      .filter((name) => /^\.env(\..+)?$/.test(name) && name !== ".env.example")
      .map((name) => join(ROOT, name))
      .filter((path) => statSync(path).isFile());
  } catch {
    return [];
  }
}

interface ParsedEnv {
  keys: readonly string[];
  pairs: Readonly<Record<string, string>>;
  comments: readonly string[];
}

/** Minimal dotenv reader: strips `export `, quotes, and `#` comments. */
function parseEnv(source: string): ParsedEnv {
  const keys: string[] = [];
  const pairs: Record<string, string> = {};
  const comments: string[] = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("#")) {
      comments.push(line);
      continue;
    }
    if (line === "") continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2] ?? "";
    // Strip an inline comment only when the value is unquoted.
    if (!/^["']/.test(value)) value = value.replace(/\s+#.*$/, "").trim();
    else value = value.replace(/^["']/, "").replace(/["']$/, "").trim();
    keys.push(key);
    pairs[key] = value;
  }
  return { keys, pairs, comments };
}

const ENV_EXAMPLE = parseEnv(readFileSync(ENV_EXAMPLE_PATH, "utf8"));
const ENV_TS_SOURCE = readFileSync(ENV_TS_PATH, "utf8");

/** Keys declared in the `z.object({ ... })` block of `src/lib/env.ts`. */
const SCHEMA_KEYS: ReadonlySet<string> = (() => {
  const start = ENV_TS_SOURCE.indexOf("serverSchema");
  const end = ENV_TS_SOURCE.indexOf(".superRefine", start);
  const block = ENV_TS_SOURCE.slice(start, end > start ? end : undefined);
  const found = new Set<string>();
  for (const match of block.matchAll(/^\s{4}([A-Z][A-Z0-9_]{2,}):/gm)) found.add(match[1]!);
  return found;
})();

/** Keys the schema validates that `.env.example` never documents. */
const SCHEMA_KEYS_UNDOCUMENTED = [...SCHEMA_KEYS].filter((key) => !ENV_EXAMPLE.keys.includes(key)).sort();

const PUBLIC_KEY_PATTERN = /^NEXT_PUBLIC_[A-Z0-9_]+$/;

// ── Module re-import harness ────────────────────────────────────────────────

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

/** Re-imports `@/lib/env` under an exact environment, restoring the real one after. */
async function loadEnvWith(
  patch: Readonly<Record<string, string | undefined>>,
): Promise<{ ok: true; module: Record<string, unknown> } | { ok: false; error: Error }> {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv, patch);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
  }
  vi.resetModules();
  try {
    const module = (await import("@/lib/env")) as unknown as Record<string, unknown>;
    return { ok: true, module };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/** A complete, valid PRODUCTION environment. */
const VALID_PRODUCTION_ENV: Readonly<Record<string, string | undefined>> = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://eyg:eyg@db:5432/eyg?schema=public",
  AUTH_SECRET: STRONG_SECRET,
  PII_ENCRYPTION_KEY: STRONG_SECRET_2,
  WEBHOOK_SIGNING_SECRET: "whsec_0123456789abcdefghijklmnop", // gitleaks:allow — sequential filler
  NEXT_PUBLIC_SITE_URL: "https://eygtireautocare.ph",
  LOG_LEVEL: "info",
};

// ─────────────────────────────────────────────────────────────────────────────

describe("env-schema — .env.example coverage", () => {
  it("parses a non-trivial .env.example (sanity check on the reader)", () => {
    expect(ENV_EXAMPLE.keys.length).toBeGreaterThan(30);
    expect(ENV_EXAMPLE.keys).toContain("AUTH_SECRET");
    expect(ENV_EXAMPLE.keys).toContain("DATABASE_URL");
  });

  it("has no duplicate keys in .env.example", () => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const key of ENV_EXAMPLE.keys) {
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    }
    expect([...duplicates]).toEqual([]);
  });

  it("validates EVERY non-public var declared in .env.example", () => {
    const unvalidated = ENV_EXAMPLE.keys.filter(
      (key) => !PUBLIC_KEY_PATTERN.test(key) && !SCHEMA_KEYS.has(key),
    );
    expect(
      unvalidated,
      `.env.example declares keys that src/lib/env.ts never validates — they are ` +
        "read straight off process.env and silently ignored at boot",
    ).toEqual([]);
  });

  it("does not validate any NEXT_PUBLIC_* key on the server (they are inlined at build)", () => {
    const leaked = [...SCHEMA_KEYS].filter((key) => PUBLIC_KEY_PATTERN.test(key));
    expect(
      leaked,
      "NEXT_PUBLIC_* keys belong in src/lib/public-env.ts, not the server schema",
    ).toEqual([]);
  });

  it("only documents extra schema keys that the source explicitly calls out", () => {
    // Anything in the schema but not in .env.example is a documentation gap.
    // The only tolerated gaps are the ones src/lib/env.ts names in a comment.
    // Every key in the Zod schema is documented in .env.example.
    //
    // This assertion used to pin the exact list of gaps:
    //   ["ADMIN_EMAIL", "ADMIN_PASSWORD", "RATE_LIMIT_READ_PER_MINUTE"]
    // Those three have been documented, so the drift is closed and the only
    // acceptable value is empty. Pinning the broken list would have made this
    // test FAIL the moment someone fixed the gap properly, which is a test that
    // rewards leaving a defect in place.
    expect(SCHEMA_KEYS_UNDOCUMENTED).toEqual([]);
  });

  it("ships every SECRET as EMPTY in .env.example", () => {
    // `DATABASE_URL` and `NODE_ENV` legitimately carry a development default;
    // the secrets must not.
    for (const key of ["AUTH_SECRET", "PII_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET"]) {
      expect(ENV_EXAMPLE.pairs[key], `${key} must ship EMPTY in .env.example`).toBe("");
    }
  });

  it("ships no real-looking secret value in .env.example", () => {
    const ALLOWED_DEFAULTS = new Set([
      "NODE_ENV",
      "DATABASE_URL",
      "RATE_LIMIT_PUBLIC_PER_MINUTE",
      "RATE_LIMIT_BOOKING_PER_HOUR",
      "RATE_LIMIT_QUOTE_PER_HOUR",
      "RATE_LIMIT_LOGIN_PER_15MIN",
        "RATE_LIMIT_READ_PER_MINUTE",
      "CAPTCHA_ENABLED",
      "CAPTCHA_TTL_SECONDS",
      "SMTP_PORT",
      "SMTP_SECURE",
      "LOG_LEVEL",
      "NEXT_PUBLIC_APP_VERSION",
      "NEXT_PUBLIC_SITE_URL",
      "EMAIL_FROM",
    ]);
    for (const key of ENV_EXAMPLE.keys) {
      if (ALLOWED_DEFAULTS.has(key)) continue;
      if (key.startsWith("NEXT_PUBLIC_")) continue;
      expect(ENV_EXAMPLE.pairs[key], `${key} should ship empty in .env.example`).toBe("");
    }
  });
});

describe("env-schema — fails closed", () => {
  it("loads a complete, valid production environment without throwing", async () => {
    const result = await loadEnvWith(VALID_PRODUCTION_ENV);
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    if (result.ok) {
      const env = result.module["env"] as { isProduction: boolean; authSecret: string; databaseUrl: string };
      expect(env.isProduction).toBe(true);
      expect(env.authSecret).toBe(STRONG_SECRET);
      expect(env.databaseUrl).toBe("postgresql://eyg:eyg@db:5432/eyg?schema=public");
    }
  });

  it.each(["AUTH_SECRET", "PII_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET", "DATABASE_URL"])(
    "refuses to boot when %s is missing",
    async (key) => {
      const result = await loadEnvWith({ ...VALID_PRODUCTION_ENV, [key]: undefined });
      expect(result.ok, `expected ${key} to be required`).toBe(false);
      if (!result.ok) expect(result.error.message).toContain(key);
    },
  );

  // ── The build must not demand secrets ──────────────────────────────────────
  //
  // A Vercel deploy failed on exactly this, and the log is why these tests exist:
  //
  //     • AUTH_SECRET: is required
  //     • PII_ENCRYPTION_KEY: is required
  //     • WEBHOOK_SIGNING_SECRET: is required
  //     • NEXT_PUBLIC_SITE_URL: is required in production
  //     [Error: Failed to collect page data for /api/admin/bookings/[id]/status]
  //
  // `next build` sets NODE_ENV=production and imports every route to collect page
  // data, so this module is evaluated while COMPILING. None of those four values is
  // needed to compile — three are runtime secrets and the fourth already has a
  // correct default in `src/config/site.ts`. Requiring them made a first deploy fail
  // on configuration the operator had not been told about yet.
  describe("env-schema — a build compiles without secrets", () => {
    const NO_SECRETS: Readonly<Record<string, string | undefined>> = {
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      LOG_LEVEL: "info",
    };

    /**
     * Explicitly unset, not merely absent. `loadEnvWith` restores the real
     * process environment underneath the patch and Vitest loads `.env`, so a key
     * left out of the patch inherits whatever the machine happens to have — which
     * would make "no secrets" a lie and the test pass for the wrong reason.
     */
    const NO_SECRET_KEYS: Readonly<Record<string, undefined>> = {
      DATABASE_URL: undefined,
      AUTH_SECRET: undefined,
      PII_ENCRYPTION_KEY: undefined,
      WEBHOOK_SIGNING_SECRET: undefined,
      NEXT_PUBLIC_SITE_URL: undefined,
    };

    it("loads during the build phase with no secrets set", async () => {
      // Every secret is explicitly undefined, not merely absent from the patch:
      // the harness restores the real process env underneath, and Vitest loads
      // `.env`, so "absent" would silently inherit a real value.
      const result = await loadEnvWith({ ...NO_SECRETS, ...NO_SECRET_KEYS });
      expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    });

    it("uses obviously-fake placeholders, so no real value is required to compile", async () => {
      const result = await loadEnvWith({ ...NO_SECRETS, ...NO_SECRET_KEYS });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const env = result.module["env"] as Record<string, unknown>;
      for (const key of ["authSecret", "piiEncryptionKey", "webhookSigningSecret", "databaseUrl"]) {
        expect(String(env[key]), key).toContain("build-phase-placeholder");
      }
    });

    it("STILL refuses to boot at runtime without the secrets", async () => {
      // The whole safety of the build-phase escape rests on this. If a served
      // process accepted the placeholders, the site would encrypt customer phone
      // numbers with a literal published in this repository.
      const result = await loadEnvWith({ ...NO_SECRETS, ...NO_SECRET_KEYS, NEXT_PHASE: undefined });
      expect(result.ok, "a runtime boot with no secrets must fail").toBe(false);
      if (result.ok) return;
      for (const key of ["AUTH_SECRET", "PII_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET"]) {
        expect(result.error.message, key).toContain(key);
      }
      expect(result.error.message).not.toContain("build-phase-placeholder");
    });

    it("does not let a placeholder overwrite a real secret during a build", async () => {
      const result = await loadEnvWith({ ...VALID_PRODUCTION_ENV, NEXT_PHASE: "phase-production-build" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const env = result.module["env"] as Record<string, unknown>;
      expect(env["authSecret"]).toBe(STRONG_SECRET);
      expect(env["piiEncryptionKey"]).toBe(STRONG_SECRET_2);
      expect(env["webhookSigningSecret"]).not.toContain("build-phase-placeholder");
    });

    it("falls back to the canonical SITE.url, never localhost, when SITE_URL is unset", async () => {
      const result = await loadEnvWith({ ...VALID_PRODUCTION_ENV, NEXT_PUBLIC_SITE_URL: undefined });
      expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
      if (!result.ok) return;
      const env = result.module["env"] as { siteUrl: string };
      expect(env.siteUrl).toBe("https://eygtireautocare.ph");
      expect(env.siteUrl).not.toContain("localhost");
    });
  });

  it("rejects a DATABASE_URL that is not a postgres connection string", async () => {
    const result = await loadEnvWith({ ...VALID_PRODUCTION_ENV, DATABASE_URL: "mysql://root@db/eyg" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("DATABASE_URL");
  });

  it("rejects a too-short AUTH_SECRET", async () => {
    const result = await loadEnvWith({ ...VALID_PRODUCTION_ENV, AUTH_SECRET: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("AUTH_SECRET");
  });

  it("rejects a half-configured Upstash pair", async () => {
    const result = await loadEnvWith({
      ...VALID_PRODUCTION_ENV,
      UPSTASH_REDIS_REST_URL: "https://eu1-xxx.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("rejects RESEND_API_KEY together with SMTP_HOST", async () => {
    const result = await loadEnvWith({
      ...VALID_PRODUCTION_ENV,
      RESEND_API_KEY: "re_abcdefghijklmnopqrstuvwxyz123456", // gitleaks:allow — the alphabet, obviously fake
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user",
      SMTP_PASSWORD: "password",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a partial Twilio triple", async () => {
    const result = await loadEnvWith({
      ...VALID_PRODUCTION_ENV,
      TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_FROM_NUMBER: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("TWILIO_AUTH_TOKEN");
  });

  it("never echoes a secret VALUE into the boot error", async () => {
    const leakValue = "LEAKED-VALUE-must-never-appear-in-a-log-or-error-0000000000";
    const result = await loadEnvWith({
      ...VALID_PRODUCTION_ENV,
      AUTH_SECRET: leakValue,
      PII_ENCRYPTION_KEY: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("PII_ENCRYPTION_KEY");
      expect(result.error.message).not.toContain(leakValue);
    }
  });
});

describe("env-schema — nextStep / siteUrl validation", () => {
  /**
   * ⚠ EXPECTED TO FAIL against the current implementation — see the QA report.
   *
   * `.env.example` says every var is validated at boot. `NEXT_PUBLIC_SITE_URL`
   * is not in the server schema at all; `env.siteUrl` does a bare
   * `process.env.NEXT_PUBLIC_SITE_URL ?? fallback` with a trailing-slash strip
   * and no URL validation. A typo therefore reaches production and breaks
   * canonical tags, the sitemap and OG images (all of which build absolute
   * URLs from it via `src/lib/seo.ts`), with no boot-time signal at all.
   */
  it("refuses to boot when NEXT_PUBLIC_SITE_URL is not an absolute http(s) URL", async () => {
    const result = await loadEnvWith({ ...VALID_PRODUCTION_ENV, NEXT_PUBLIC_SITE_URL: "eygtireautocare.ph" });
    expect(result.ok, "a bare hostname with no scheme must be rejected at boot").toBe(false);
  });

  it("refuses to boot when NEXT_PUBLIC_SITE_URL uses a scheme other than http/https", async () => {
    const result = await loadEnvWith({ ...VALID_PRODUCTION_ENV, NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" });
    expect(result.ok).toBe(false);
  });

  it("strips a trailing slash from NEXT_PUBLIC_SITE_URL", async () => {
    const result = await loadEnvWith({
      ...VALID_PRODUCTION_ENV,
      NEXT_PUBLIC_SITE_URL: "https://eygtireautocare.ph///",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const env = result.module["env"] as { siteUrl: string };
      expect(env.siteUrl).toBe("https://eygtireautocare.ph");
    }
  });
});

describe("env-schema — public keys never carry a server secret", () => {
  /** `NEXT_PUBLIC_*` keys that legitimately contain the word KEY but are public by design. */
  const PUBLIC_BY_DESIGN = new Set([
    // Google Maps JavaScript API keys are embedded in the client bundle by
    // design. They MUST be restricted by HTTP referrer — tracked in
    // docs/qa/security-checklist.md → A05 residual risk.
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    // Cloudflare Turnstile's *site* key is public; its secret key is not.
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  ]);

  /** Value shapes that must NEVER appear under a NEXT_PUBLIC_ key. */
  const SECRET_VALUE_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
    { name: "postgres connection string", pattern: /postgres(ql)?:\/\//i },
    { name: "PEM private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { name: "Stripe live key", pattern: /\b(sk|rk)_live_[A-Za-z0-9]{10,}/ },
    { name: "Twilio secret", pattern: /\bSK[0-9a-fA-F]{32}\b/ },
    { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
    { name: "Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
    { name: "long opaque base64 blob (≥40)", pattern: /^[A-Za-z0-9+/_-]{40,}={0,2}$/ },
    { name: "SendGrid key", pattern: /\bSG\.[A-Za-z0-9_-]{20,}\./ },
  ];

  const ENV_FILES: readonly string[] = [ENV_EXAMPLE_PATH, ...localEnvFiles()];

  it("no NEXT_PUBLIC_* key name contains SECRET, TOKEN, PASSWORD, CREDENTIAL or PRIVATE", () => {
    const offenders: string[] = [];
    for (const path of ENV_FILES) {
      const parsed = parseEnv(readFileSync(path, "utf8"));
      for (const key of parsed.keys) {
        if (!PUBLIC_KEY_PATTERN.test(key)) continue;
        if (PUBLIC_BY_DESIGN.has(key)) continue;
        if (/SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE|AUTH/i.test(key)) offenders.push(`${key} (${path})`);
      }
    }
    expect(offenders, "a NEXT_PUBLIC_* name implies the value is public forever").toEqual([]);
  });

  it("no NEXT_PUBLIC_* value looks like a server secret", () => {
    const offenders: string[] = [];
    for (const path of ENV_FILES) {
      const parsed = parseEnv(readFileSync(path, "utf8"));
      for (const key of parsed.keys) {
        if (!PUBLIC_KEY_PATTERN.test(key)) continue;
        const value = parsed.pairs[key] ?? "";
        if (value === "") continue;
        for (const { name, pattern } of SECRET_VALUE_PATTERNS) {
          if (pattern.test(value)) offenders.push(`${key} holds a ${name} (${path})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no value of a server-only key is re-used under a NEXT_PUBLIC_* key", () => {
    const serverKeys = [...SCHEMA_KEYS].filter((key) => !PUBLIC_KEY_PATTERN.test(key));
    const offenders: string[] = [];
    for (const path of ENV_FILES) {
      const parsed = parseEnv(readFileSync(path, "utf8"));
      for (const serverKey of serverKeys) {
        const secretValue = parsed.pairs[serverKey];
        if (!secretValue || secretValue.length < 8) continue;
        for (const key of parsed.keys) {
          if (!PUBLIC_KEY_PATTERN.test(key)) continue;
          if ((parsed.pairs[key] ?? "") === secretValue) offenders.push(`${serverKey} === ${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no source file declares a NEXT_PUBLIC_* key that smells like a secret", () => {
    const offenders: string[] = [];
    const stack: string[] = [join(ROOT, "src")];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          stack.push(path);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) continue;
        const source = readFileSync(path, "utf8");
        for (const match of source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
          const name = match[0];
          if (/SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE/i.test(name)) {
            offenders.push(`${name} in ${path.slice(ROOT.length + 1)}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src/lib/env.ts keeps every secret behind `import 'server-only'`", () => {
    expect(ENV_TS_SOURCE).toMatch(/^import "server-only";/m);
  });

  it("exports an immutable, frozen env object", async () => {
    const result = await loadEnvWith(VALID_PRODUCTION_ENV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const env = result.module["env"] as Record<string, unknown>;
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env["rateLimit"])).toBe(true);
  });
});

describe("env-schema — public env module", () => {
  it.todo(
    "src/lib/public-env.ts must exist and export `publicEnv` containing ONLY the " +
      "NEXT_PUBLIC_* keys, so client code never imports src/lib/env.ts (which is " +
      "`server-only`). Assert: every key of publicEnv is prefixed NEXT_PUBLIC_ and " +
      "no value matches the server-secret patterns.",
  );
});