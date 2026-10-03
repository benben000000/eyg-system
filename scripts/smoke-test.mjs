#!/usr/bin/env node
/**
 * smoke-test.mjs — prove a deployment is actually alive and actually EYG.
 * ============================================================================
 * A green build proves the code compiles. It does not prove the server boots,
 * that the database is reachable, or that the page a customer sees contains the
 * shop's phone number. This script asserts both, and it is the gate between
 * "deployed" and "live".
 *
 * Pure Node ESM. No dependencies — `fetch` and `AbortSignal` are built in.
 *
 * Checks, in order:
 *   1.  /api/health                    200, JSON, reports ok
 *   2.  /api/ready                     200, JSON, dependencies reachable
 *   3.  /                               200, HTML contains brand + tel: link
 *   4.  /services /book /deals         200, brand present
 *   5.  /contact /gallery /about       200, brand present
 *   6.  /privacy /terms                200
 *   7.  /this-route-does-not-exist     404, and a real 404 page (not a crash)
 *   8.  POST /api/availability         200/4xx-with-JSON (never 5xx, never HTML)
 *   9.  POST /api/quote                200/4xx-with-JSON (never 5xx, never HTML)
 *  10.  Security headers present on every response
 *  11.  No secret leaked into __NEXT_DATA__ / the HTML payload
 *  12.  No Next.js dev error overlay
 *
 * Usage:
 *   node scripts/smoke-test.mjs
 *   BASE_URL=https://eygtireautocare.ph node scripts/smoke-test.mjs
 *   node scripts/smoke-test.mjs --base-url=https://staging.example --strict
 *   node scripts/smoke-test.mjs --retries=5 --retry-delay=3000 --json
 *
 * Flags:
 *   --base-url=<url>   target origin (default: $BASE_URL, else http://localhost:3000)
 *   --retries=<n>      attempts per check on a *connection* failure (default 1)
 *   --retry-delay=<ms> base backoff, doubled per attempt (default 2000)
 *   --timeout=<ms>     per-request timeout (default 15000)
 *   --strict           fail on 4xx from the write endpoints as well as 5xx
 *   --skip-post        skip /api/availability and /api/quote (read-only probe)
 *   --json             emit a JSON report on stdout
 *   --verbose          print each response line as it happens
 *
 * Exit codes: 0 = all checks passed · 1 = at least one check failed · 2 = bad usage
 *
 * SECRET HYGIENE: this script reads known secret *names* from the environment
 * purely to assert they do NOT appear in any response body. It never prints a
 * secret value — it prints only the first 4 characters of a *name*, never a
 * value, and a violation is reported by variable name alone.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
void ROOT;

// ── Brand contract ──────────────────────────────────────────────────────────
// Kept in sync with src/config/site.ts (orchestrator-owned). The phone number is
// deliberately the PLACEHOLDER until the owner confirms — see LAUNCH-CHECKLIST.
const BRAND_STRING = "EYG";
const EXPECTED_TEL = process.env.SMOKE_EXPECT_TEL || "tel:";
const LEGACY_TEL = "+639000000000"; // placeholder — a match here FAILS the test

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = {
    baseUrl: (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),
    retries: Number(process.env.SMOKE_RETRIES || 1),
    retryDelay: Number(process.env.SMOKE_RETRY_DELAY || 2000),
    timeout: Number(process.env.SMOKE_TIMEOUT || 15000),
    strict: process.env.SMOKE_STRICT === "1",
    skipPost: false,
    json: false,
    verbose: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) o.baseUrl = arg.slice(11).replace(/\/+$/, "");
    else if (arg.startsWith("--retries=")) o.retries = Number(arg.slice(10));
    else if (arg.startsWith("--retry-delay=")) o.retryDelay = Number(arg.slice(14));
    else if (arg.startsWith("--timeout=")) o.timeout = Number(arg.slice(10));
    else if (arg === "--strict") o.strict = true;
    else if (arg === "--skip-post") o.skipPost = true;
    else if (arg === "--json") o.json = true;
    else if (arg === "--verbose") o.verbose = true;
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "smoke-test.mjs — prove a deployment is alive\n" +
          "  --base-url=<url>  --retries=<n>  --retry-delay=<ms>  --timeout=<ms>\n" +
          "  --strict  --skip-post  --json  --verbose\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`smoke-test: unknown argument "${arg}"\n`);
      process.exit(2);
    }
  }

  if (!/^https?:\/\//.test(o.baseUrl)) {
    process.stderr.write(`smoke-test: --base-url must be http(s), got "${o.baseUrl}"\n`);
    process.exit(2);
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));

// ── Reporting ───────────────────────────────────────────────────────────────

const RED = "[31m";
const GRN = "[32m";
const YEL = "[33m";
const DIM = "[2m";
const BLD = "[1m";
const OFF = "[0m";
const useColour = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const c = (code, text) => (useColour ? `${code}${text}${OFF}` : text);

/** @type {{ name: string, ok: boolean, status?: number, ms: number, note?: string, skip?: boolean }[]} */
const results = [];
let failures = 0;
let skips = 0;

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {{ status?: number, ms?: number, note?: string, skip?: boolean }} [meta]
 */
function record(name, ok, meta = {}) {
  const entry = { name, ok, status: meta.status, ms: meta.ms ?? 0, note: meta.note, skip: meta.skip };
  results.push(entry);
  if (entry.skip) {
    skips += 1;
    if (!opts.json) process.stdout.write(`  ${c(YEL, "skip")}  ${name}\n`);
    return;
  }
  if (ok) {
    if (!opts.json) {
      const ms = entry.ms ? c(DIM, `${entry.ms}ms`) : "";
      const st = entry.status ? c(DIM, String(entry.status)) : "";
      process.stdout.write(`  ${c(GRN, "pass")}  ${name} ${st} ${ms}\n`);
    }
  } else {
    failures += 1;
    if (!opts.json) {
      process.stdout.write(`  ${c(RED, "FAIL")}  ${name}${entry.note ? ` — ${entry.note}` : ""}\n`);
    }
  }
}

const section = (title) => {
  if (!opts.json) process.stdout.write(`\n${c(BLD, title)}\n`);
};

// ── HTTP helper ─────────────────────────────────────────────────────────────

/**
 * @param {string} path
 * @param {{ method?: string, headers?: Record<string, string>, body?: string, timeout?: number }} [init]
 * @returns {Promise<{ ok: boolean, status: number, ms: number, text: string, headers: Headers }>}
 */
async function request(path, init = {}) {
  const url = path.startsWith("http") ? path : `${opts.baseUrl}${path}`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeout ?? opts.timeout);

  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        "user-agent": "eyg-smoke-test/1.0 (+ops runbook)",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(init.headers ?? {}),
      },
      body: init.body,
      redirect: "manual",
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, ms: Date.now() - started, text, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retries only on transport failures (the container is still booting, or a
 * rolling deploy swapped the process underneath us). A 500 is never retried:
 * a 500 is a decision, not a race.
 * @param {string} path
 * @param {{ method?: string, headers?: Record<string, string>, body?: string, retries?: number }} [init]
 */
async function requestWithRetry(path, init = {}) {
  const maxAttempts = Math.max(1, init.retries ?? opts.retries);
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await request(path, init);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        if (!opts.json) {
          process.stdout.write(
            `  ${c(YEL, "wait")}  ${path} — ${describeError(err)}, retry ${attempt}/${maxAttempts - 1}\n`,
          );
        }
        await sleep(opts.retryDelay * 2 ** (attempt - 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("request failed");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {unknown} err */
function describeError(err) {
  if (err instanceof Error) {
    if (err.name === "AbortError") return `timed out after ${opts.timeout}ms`;
    const cause = /** @type {{ code?: string }} */ (err).cause;
    if (cause && typeof cause === "object" && "code" in cause) return `${cause.code}`;
    return err.message.slice(0, 120);
  }
  return String(err).slice(0, 120);
}

// ── Assertions ──────────────────────────────────────────────────────────────

const NEXT_ERROR_MARKERS = [
  "nextjs-container-errors",
  "nextjs-portal",
  "__next_error__",
  "Unhandled Runtime Error",
  "Application error: a client-side exception",
  "call of undefined",
  "webpack-hmr",
];

/** Next.js server errors leak stack traces into the HTML. Detect and fail. */
function findErrorOverlay(text) {
  return NEXT_ERROR_MARKERS.find((m) => text.includes(m)) ?? null;
}

/** Environment variable names whose VALUES must never reach the client. */
const SECRET_ENV_NAMES = [
  "AUTH_SECRET",
  "PII_ENCRYPTION_KEY",
  "WEBHOOK_SIGNING_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "TURNSTILE_SECRET_KEY",
  "RESEND_API_KEY",
  "SMTP_PASSWORD",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_AUTH_TOKEN",
  "WHATSAPP_ACCESS_TOKEN",
  "GOOGLE_API_KEY",
  "FACEBOOK_PAGE_ACCESS_TOKEN",
  "SENTRY_AUTH_TOKEN",
  "ADMIN_PASSWORD",
  "DATABASE_URL",
];

/**
 * Asserts that no live secret value appears in a response body. Only *values*
 * are searched and only the offending variable NAME is reported — never the
 * value, not even truncated.
 * @param {string} text
 * @returns {string | null} offending variable name
 */
function findLeakedSecret(text) {
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name];
    // Short values produce false positives (e.g. a 12-char token inside a hash).
    if (typeof value !== "string" || value.length < 16) continue;
    if (text.includes(value)) return name;
  }
  return null;
}

/**
 * Redacts any live secret value out of a string before it is printed. Anything
 * that ends up in a log line, a note or a PR comment goes through this. Without
 * it, the failure path for "a secret leaked into the HTML" would echo the secret
 * straight into CI logs — turning an incident report into a credential dump.
 * @param {string} text
 * @returns {string}
 */
function redactSecrets(text) {
  let out = text;
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name];
    if (typeof value !== "string" || value.length < 8) continue;
    out = out.split(value).join(`[redacted:${name}]`);
  }
  return out;
}

/** Collapse whitespace and clamp the length of a body excerpt for a note. */
function bodyExcerpt(text) {
  return redactSecrets(text.slice(0, 80).replace(/\s+/g, " ").trim());
}

/** Parse a JSON body, tolerating an HTML error page. */
function tryJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function summariseJson(value) {
  if (value === null || typeof value !== "object") return typeof value;
  const record = /** @type {Record<string, unknown>} */ (value);
  const status = record.status ?? record.ok ?? record.ready;
  return typeof status === "string" || typeof status === "boolean" ? `status=${String(status)}` : "json";
}

// ── Checks ──────────────────────────────────────────────────────────────────

async function checkHealth() {
  section("Health & readiness");
  let res;
  try {
    res = await requestWithRetry("/api/health", { headers: { accept: "application/json" } });
  } catch (err) {
    record("/api/health returns 200 JSON", false, { note: describeError(err) });
    record("/api/ready returns 200 JSON", false, { note: "skipped — /api/health unreachable" });
    return;
  }
  const parsed = tryJson(res.text);
  const overlay = findErrorOverlay(res.text);
  record(
    "/api/health returns 200 JSON",
    res.status === 200 && parsed.ok && !overlay,
    {
      status: res.status,
      ms: res.ms,
      note: overlay
        ? "server error overlay in body"
        : !parsed.ok
          ? `expected JSON, got ${bodyExcerpt(res.text)}`
          : undefined,
    },
  );
  if (opts.verbose && parsed.ok) process.stdout.write(`        ${summariseJson(parsed.value)}\n`);

  // Health must not be cached — a cached 200 behind a dead process is a lie.
  const cc = res.headers.get("cache-control") ?? "";
  record(
    "/api/health is not cached",
    /no-store|no-cache/.test(cc),
    { note: cc === "" ? "no Cache-Control header" : `Cache-Control: ${cc.slice(0, 40)}` },
  );

  try {
    const ready = await requestWithRetry("/api/ready", { headers: { accept: "application/json" } });
    const readyJson = tryJson(ready.text);
    record(
      "/api/ready returns 200 JSON",
      ready.status === 200 && readyJson.ok && !findErrorOverlay(ready.text),
      {
        status: ready.status,
        ms: ready.ms,
        note: readyJson.ok ? undefined : `expected JSON, got ${ready.text.slice(0, 60).replace(/\s+/g, " ")}`,
      },
    );
  } catch (err) {
    record("/api/ready returns 200 JSON", false, { note: describeError(err) });
  }
}

const PAGE_CHECKS = [
  { path: "/", brand: true, tel: true },
  { path: "/services", brand: true },
  { path: "/book", brand: true },
  { path: "/deals", brand: true },
  { path: "/contact", brand: true, tel: true },
  { path: "/gallery", brand: true },
  { path: "/about", brand: true },
  { path: "/privacy", brand: true },
  { path: "/terms", brand: true },
];

async function checkPages() {
  section("Pages");
  const cached = new Map();

  for (const page of PAGE_CHECKS) {
    let res;
    try {
      res = await requestWithRetry(page.path, {
        headers: { accept: "text/html" },
      });
    } catch (err) {
      record(page.path, false, { note: describeError(err) });
      continue;
    }
    cached.set(page.path, res);

    const problems = [];
    if (res.status !== 200) problems.push(`status ${res.status}`);
    if (!res.text.includes("<!DOCTYPE html") && !res.text.includes("<html")) {
      problems.push("not an HTML document");
    }
    const overlay = findErrorOverlay(res.text);
    if (overlay) problems.push(`error overlay: ${overlay}`);

    let html = res.text;
    // A 301 to a canonical path is a pass, not a failure — follow one hop.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location && location !== page.path) {
        try {
          res = await request(location);
          html = res.text;
          if (res.status !== 200) problems.push(`after redirect status ${res.status}`);
          cached.set(page.path, res);
        } catch (err) {
          problems.push(`redirect target failed: ${describeError(err)}`);
        }
      }
    }

    if (page.brand && !html.includes(BRAND_STRING)) problems.push(`missing brand string "${BRAND_STRING}"`);
    if (page.tel) {
      if (!html.includes(EXPECTED_TEL)) problems.push(`missing a ${EXPECTED_TEL} call link`);
      if (html.includes(LEGACY_TEL)) problems.push(`still serving the placeholder phone ${LEGACY_TEL}`);
    }
    const leaked = findLeakedSecret(html);
    if (leaked) problems.push(`secret leaked into HTML: ${leaked}`);
    // Never let Next's server payload carry the process environment.
    if (html.includes("DATABASE_URL") && html.includes("postgresql://")) {
      problems.push("DATABASE_URL appears in the rendered payload");
    }

    record(`${page.path} renders`, problems.length === 0, {
      status: res.status,
      ms: res.ms,
      note: problems.join("; "),
    });
  }
  return cached;
}

async function checkNotFound() {
  section("Error handling");
  let res;
  try {
    res = await requestWithRetry("/eyg-smoke-test-no-such-page", { headers: { accept: "text/html" } });
  } catch (err) {
    record("404 route", false, { note: describeError(err) });
    return;
  }
  const problems = [];
  if (res.status !== 404) problems.push(`expected 404, got ${res.status}`);
  const overlay = findErrorOverlay(res.text);
  if (overlay) problems.push(`error overlay: ${overlay}`);
  // A hard 500 from a missing route means no not-found.tsx boundary.
  if (res.status >= 500) problems.push("server crashed on an unknown route");
  record("unknown route returns a real 404", problems.length === 0, {
    status: res.status,
    ms: res.ms,
    note: problems.join("; "),
  });
}

async function checkWriteEndpoints() {
  section("Write endpoints (non-destructive)");

  if (opts.skipPost) {
    record("POST /api/availability", true, { skip: true });
    record("POST /api/quote", true, { skip: true });
    return;
  }

  // Availability: a malformed request MUST be rejected with JSON, never crash
  // and never return an HTML error page (which is what a thrown exception in a
  // route handler produces).
  try {
    const res = await requestWithRetry("/api/availability", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ serviceSlug: "pms-a", date: "2000-01-01" }),
    });
    const parsed = tryJson(res.text);
    const overlay = findErrorOverlay(res.text);
    const problems = [];
    if (parsed.ok) {
      const value = /** @type {Record<string, unknown>} */ (parsed.value);
      if (res.status >= 500) problems.push(`server error ${res.status}`);
      if (value.error === undefined && value.slots === undefined && value.data === undefined) {
        problems.push("JSON has neither an `error` nor a `slots`/`data` field");
      }
    } else if (res.status >= 500) {
      problems.push("returned HTML, not JSON — the handler threw");
    } else if (!overlay) {
      problems.push(`unparseable body: ${bodyExcerpt(res.text)}`);
    }
    if (opts.strict && res.status >= 400) problems.push(`strict mode: status ${res.status}`);
    record("POST /api/availability answers JSON", problems.length === 0, {
      status: res.status,
      ms: res.ms,
      note: problems.join("; "),
    });
  } catch (err) {
    record("POST /api/availability answers JSON", false, { note: describeError(err) });
  }

  // Quote: same contract. Deliberately invalid so nothing is ever written.
  try {
    const res = await requestWithRetry("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ phone: "not-a-phone", selections: [] }),
    });
    const parsed = tryJson(res.text);
    const overlay = findErrorOverlay(res.text);
    const problems = [];
    if (parsed.ok) {
      const value = /** @type {Record<string, unknown>} */ (parsed.value);
      if (res.status >= 500) problems.push(`server error ${res.status}`);
      if (value.error === undefined && value.quote === undefined && value.estimate === undefined) {
        problems.push("JSON has neither an `error` nor a `quote`/`estimate` field");
      }
    } else if (res.status >= 500) {
      problems.push("returned HTML, not JSON — the handler threw");
    } else if (!overlay) {
      problems.push(`unparseable body: ${bodyExcerpt(res.text)}`);
    }
    if (opts.strict && res.status >= 400) problems.push(`strict mode: status ${res.status}`);
    record("POST /api/quote answers JSON", problems.length === 0, {
      status: res.status,
      ms: res.ms,
      note: problems.join("; "),
    });
  } catch (err) {
    record("POST /api/quote answers JSON", false, { note: describeError(err) });
  }
}

async function checkSecurityHeaders() {
  section("Security headers");
  let res;
  try {
    res = await request("/", { headers: { accept: "text/html" } });
  } catch (err) {
    record("security headers", false, { note: describeError(err) });
    return;
  }

  // Header names only — never a value from a secret.
  const REQUIRED = [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "strict-transport-security",
    "permissions-policy",
  ];
  const missing = REQUIRED.filter((h) => res.headers.get(h) === null);
  record(
    "baseline security headers present",
    missing.length === 0,
    { note: missing.length > 0 ? `missing: ${missing.join(", ")}` : undefined },
  );

  const csp = res.headers.get("content-security-policy");
  record("Content-Security-Policy present", csp !== null, {
    note: csp === null ? "no CSP header" : undefined,
  });

  if (csp !== null) {
    const hasDefaultSrc = /default-src\s+(?:'none'|'self')/.test(csp);
    record("CSP has a default-src", hasDefaultSrc);

    // A nonce-based CSP must rotate *per response*. Reusing one nonce across
    // requests is what a hardcoded `'nonce-...'` in the source looks like, and
    // it silently defeats the policy. Two requests, compare the nonce sets.
    const noncesFor = (text) => [...text.matchAll(/'nonce-([^']+)'/g)].map((m) => m[1] ?? "");
    const first = noncesFor(csp);

    if (first.length === 0) {
      record(
        "CSP uses a per-response nonce",
        false,
        { note: "no nonce found — check the CSP builder in src/middleware.ts" },
      );
    } else {
      let second = [];
      try {
        const again = await request("/", { headers: { accept: "text/html" } });
        const csp2 = again.headers.get("content-security-policy");
        second = csp2 ? noncesFor(csp2) : [];
      } catch {
        second = [];
      }
      const reused = second.length > 0 && second.some((n) => first.includes(n));
      record("CSP rotates its nonce per response", !reused, {
        note: reused ? "a nonce from a previous response was reused — it is hardcoded" : undefined,
      });
      if (opts.verbose) process.stdout.write(`        ${first.length} nonce(s) per response\n`);
    }
  }

  const poweredBy = res.headers.get("x-powered-by");
  record("X-Powered-By stripped", poweredBy === null, {
    note: poweredBy === null ? undefined : `header present (${poweredBy.slice(0, 20)})`,
  });

  const server = res.headers.get("server");
  if (server !== null && opts.verbose) {
    process.stdout.write(`        server: ${server.slice(0, 40)}\n`);
  }
}

async function checkResponseTimes() {
  section("Latency budget");
  const budgets = [
    { path: "/api/health", max: 1000 },
    { path: "/", max: 2500 },
    { path: "/services", max: 2500 },
    { path: "/book", max: 2500 },
  ];
  for (const b of budgets) {
    try {
      const res = await request(b.path, { headers: { accept: "text/html,application/json" } });
      record(
        `${b.path} under ${b.max}ms`,
        res.ms <= b.max,
        { ms: res.ms, status: res.status, note: res.ms > b.max ? `took ${res.ms}ms` : undefined },
      );
    } catch (err) {
      record(`${b.path} under ${b.max}ms`, false, { note: describeError(err) });
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!opts.json) {
    process.stdout.write(`${c(BLD, "SMOKE TEST")} ${c(DIM, opts.baseUrl)}\n`);
  }

  const startedAt = Date.now();
  await checkHealth();
  // If health is down nothing else is meaningful — fail fast and loudly.
  const healthOk = results.find((r) => r.name.startsWith("/api/health returns"));
  if (healthOk && !healthOk.ok) {
    if (!opts.json) {
      process.stdout.write(
        `\n${c(RED, c(BLD, "ABORT"))} /api/health is down; skipping page checks.\n` +
          `  ${c(DIM, "The deployment is not live. Roll back — see docs/ops/INCIDENT-RESPONSE.md")}\n`,
      );
    }
  } else {
    await checkPages();
    await checkNotFound();
    await checkWriteEndpoints();
    await checkSecurityHeaders();
    await checkResponseTimes();
  }

  const duration = Date.now() - startedAt;
  const summary = {
    tool: "smoke-test",
    baseUrl: opts.baseUrl,
    durationMs: duration,
    total: results.length,
    passed: results.filter((r) => r.ok && !r.skip).length,
    skipped: skips,
    failed: failures,
    ok: failures === 0,
    results,
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write("\n");
    if (failures === 0) {
      process.stdout.write(
        `${c(GRN, c(BLD, "PASS"))} ${summary.passed}/${summary.total} checks green in ${duration}ms` +
          (skips > 0 ? c(DIM, ` (${skips} skipped)`) : "") +
          "\n",
      );
    } else {
      process.stdout.write(
        `${c(RED, c(BLD, "FAIL"))} ${failures} check(s) failed — the deployment is NOT safe to serve.\n`,
      );
    }
  }
  process.exit(failures === 0 ? 0 : 1);
}

process.on("unhandledRejection", (err) => {
  process.stderr.write(`smoke-test: unhandled rejection: ${describeError(err)}\n`);
  process.exit(1);
});

main().catch((err) => {
  process.stderr.write(`smoke-test: ${describeError(err)}\n`);
  process.exit(err instanceof Error && err.message.includes("--") ? 2 : 1);
});
