// @vitest-environment node
/**
 * QA & SECURITY AGENT — CSRF / cross-origin request rejection.
 * ============================================================================
 * Contract under test: `middleware()` and `ipAllowed()` in `src/middleware.ts`.
 *
 * The shop's whole conversion funnel is cookie-less and JSON-based, which means
 * CSRF is not a cookie-theft problem here — it is a "someone makes the owner's
 * browser POST a booking they did not intend" problem. The defence is an
 * Origin/Referer allowlist plus a SameSite cookie and a strict content type.
 * This suite proves the allowlist is not a rubber stamp.
 *
 * ⚠ KNOWN DEFECT asserted below (DEF-012): the allowlist is built from the
 * request's OWN `Host` header, so `Host: evil.example` + `Origin:
 * https://evil.example` is accepted. See the test body.
 * ============================================================================
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Middleware = typeof import("@/middleware");

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const env = actual["env"] as Record<string, unknown>;
  return {
    ...actual,
    env: { ...env, siteUrl: "https://eygtireautocare.ph", isProduction: true, adminIpAllowlist: [] },
  };
});

let mod: Middleware;

beforeEach(async () => {
  vi.resetModules();
  mod = await import("@/middleware");
});

/** A `NextRequest`-alike good enough for the middleware's reads. */
function req(
  url: string,
  init: { method?: string; headers?: Record<string, string>; cookies?: Record<string, string> } = {},
): never {
  const parsed = new URL(url);
  const headers = new Headers(init.headers ?? {});
  return {
    nextUrl: parsed,
    url,
    method: init.method ?? "GET",
    headers,
    cookies: {
      get: (name: string) => (init.cookies?.[name] === undefined ? undefined : { name, value: init.cookies[name]! }),
      getAll: () => [],
    },
    ip: "203.0.113.60",
  } as never;
}

const BASE = "https://eygtireautocare.ph";
const OTHER = "https://evil.example";

function run(url: string, init?: Parameters<typeof req>[1]): Response {
  return mod.middleware(req(url, init)) as unknown as Response;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("csrf — cross-origin writes are rejected", () => {
  it("rejects a POST from a foreign Origin", () => {
    const response = run(`${BASE}/api/booking`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", origin: OTHER, "content-type": "application/json" },
    });
    expect(response.status).toBe(403);
  });

  it("rejects a POST whose Referer is foreign when Origin is absent", () => {
    const response = run(`${BASE}/api/booking`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", referer: `${OTHER}/attack`, "content-type": "application/json" },
    });
    expect(response.status).toBe(403);
  });

  it("rejects a POST with neither Origin nor Referer (a browser always sends one)", () => {
    const response = run(`${BASE}/api/booking`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", "content-type": "application/json" },
    });
    expect(response.status).toBe(403);
  });

  it("exempts the signed webhooks, which authenticate with a signature instead", () => {
    const response = run(`${BASE}/api/webhooks/twilio`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", "content-type": "application/json" },
    });
    expect(response.status).not.toBe(403);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("checks the origin on %s", (method) => {
    const response = run(`${BASE}/api/booking`, {
      method,
      headers: { host: "eygtireautocare.ph", origin: OTHER, "content-type": "application/json" },
    });
    expect(response.status).toBe(403);
  });

  it("does not origin-check a safe method", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const response = run(`${BASE}/api/availability?date=2026-10-04`, {
        method,
        headers: { host: "eygtireautocare.ph", origin: OTHER },
      });
      expect(response.status, method).not.toBe(403);
    }
  });
});

describe("csrf — same-origin writes are allowed", () => {
  it("accepts a POST whose Origin is the configured site", () => {
    const response = run(`${BASE}/api/booking`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", origin: BASE, "content-type": "application/json" },
    });
    expect(response.status).not.toBe(403);
  });

  it("accepts a POST with a matching Referer and no Origin", () => {
    const response = run(`${BASE}/api/booking`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", referer: `${BASE}/book`, "content-type": "application/json" },
    });
    expect(response.status).not.toBe(403);
  });

  it("tolerates a trailing slash on the Origin", () => {
    const response = run(`${BASE}/api/booking`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", origin: `${BASE}/`, "content-type": "application/json" },
    });
    expect(response.status).not.toBe(403);
  });
});

/**
 * ⚠ EXPECTED TO FAIL — DEF-012.
 *
 * `originAllowed()` builds its allowlist partly from the request's OWN `Host`
 * header:
 *
 *     const allowed = new Set([env.siteUrl, `https://${host}`, `http://${host}`])
 *
 * `Host` is attacker-influenced whenever the deployment is not behind a proxy
 * that overwrites it (a bare origin, a self-hosted reverse proxy that forwards
 * the client's Host, some CDN paths). An attacker who can point a hostname at
 * the app sends `Host: evil.example` + `Origin: https://evil.example` and the
 * check passes. That is not a drive-by CSRF (a victim browser cannot set Host),
 * but it IS an open cross-origin write primitive for anyone who can reach the
 * origin directly — which is exactly the shape of a Host-header-poisoning
 * attack, and it also defeats the allowlist's purpose as a second factor.
 *
 * Fix: validate `Origin` against `env.siteUrl` ONLY. Keep the `Host`-derived
 * entries for the *development* case (`localhost`, LAN IP) and gate them behind
 * `env.isDevelopment`.
 */
describe("csrf — the allowlist must not be derived from the request Host (DEF-012, expected to fail)", () => {
  it("rejects a POST whose Host and Origin agree with each other but not with the site", () => {
    const response = run("http://127.0.0.1:3000/api/booking", {
      method: "POST",
      headers: { host: "evil.example", origin: "https://evil.example", "content-type": "application/json" },
    });
    expect(
      response.status,
      "a Host header the attacker controls must not be able to authorise its own Origin",
    ).toBe(403);
  });

  it("rejects a plaintext-http Origin even when the Host matches", () => {
    const response = run(`${BASE}/api/booking`, {
      method: "POST",
      headers: { host: "eygtireautocare.ph", origin: "http://eygtireautocare.ph", "content-type": "application/json" },
    });
    expect(response.status, "http:// must not be trusted in production").toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("csrf — bot damping and scrapers", () => {
  it("403s a known scraper on the API", () => {
    for (const ua of ["Mozilla/5.0 (compatible; SemrushBot/7~bl)", "curl/8.4.0", "python-requests/2.31.0"]) {
      const response = run(`${BASE}/api/availability?date=2026-10-04`, {
        headers: { host: "eygtireautocare.ph", "user-agent": ua },
      });
      expect(response.status, ua).toBe(403);
    }
  });

  it("never blocks a legitimate SEO crawler", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; facebookexternalhit/1.1)",
    ]) {
      const response = run(`${BASE}/services`, { headers: { host: "eygtireautocare.ph", "user-agent": ua } });
      expect(response.status, ua).not.toBe(403);
    }
  });

  it("does not 403 a real browser", () => {
    const response = run(`${BASE}/`, {
      headers: {
        host: "eygtireautocare.ph",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      },
    });
    expect(response.status).not.toBe(403);
  });

  it("never blocks Playwright's own UA in production CI", () => {
    // `playwright` is on the scraper list. If the E2E suite runs against a
    // production-like env it would 403 itself — worth knowing, not a defect.
    const response = run(`${BASE}/`, { headers: { host: "eygtireautocare.ph", "user-agent": "Playwright" } });
    expect([200, 403]).toContain(response.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("csrf — admin surface", () => {
  it("ipAllowed returns true for an empty allowlist (disabled, dev only)", () => {
    expect(mod.ipAllowed("203.0.113.1", [])).toBe(true);
  });

  it("ipAllowed matches an exact address", () => {
    expect(mod.ipAllowed("203.0.113.1", ["203.0.113.1"])).toBe(true);
    expect(mod.ipAllowed("203.0.113.2", ["203.0.113.1"])).toBe(false);
  });

  it("ipAllowed matches a CIDR range", () => {
    expect(mod.ipAllowed("203.0.113.77", ["203.0.113.0/24"])).toBe(true);
    expect(mod.ipAllowed("198.51.100.5", ["203.0.113.0/24"])).toBe(false);
    expect(mod.ipAllowed("10.0.0.4", ["10.0.0.0/8"])).toBe(true);
  });

  it.each([
    ["203.0.113.0/33", "an impossible prefix length"],
    ["not-an-ip/24", "a malformed range"],
    ["203.0.113.0/abc", "a non-numeric prefix"],
    ["999.1.1.1/24", "an out-of-range octet"],
  ])("ipAllowed safely rejects a bad rule (%s — %s)", (rule) => {
    expect(mod.ipAllowed("203.0.113.77", [rule])).toBe(false);
  });

  it("does not treat an IPv6 address as matching an IPv4 rule", () => {
    expect(mod.ipAllowed("2001:db8::1", ["0.0.0.0/0"])).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("csrf — security headers on a page response", () => {
  const response = (): Response => run(`${BASE}/`, { headers: { host: "eygtireautocare.ph" } });

  it("sets a Content-Security-Policy with no unsafe-eval and a nonce on script-src", () => {
    const csp = response().headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9_-]+'/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("never allows a wildcard SOURCE (a host wildcard like https://*.x.com is fine)", () => {
    const csp = response().headers.get("content-security-policy") ?? "";
    for (const directive of ["default-src", "script-src", "style-src", "img-src", "connect-src", "frame-src"]) {
      const value = new RegExp(`${directive}[^;]*`).exec(csp)?.[0] ?? "";
      // A source of exactly `*` (or `http://*`) is the thing to forbid.
      expect(value, directive).not.toMatch(/(?:^|[\s'])https?:\/\*\s*(?:;|$)/);
      expect(value, directive).not.toMatch(/(?:^|[\s'])\*(?=[\s;])/);
    }
  });

  it("sets nosniff, a strict referrer policy and a permissions policy", () => {
    const res = response();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("sets HSTS in production only", () => {
    expect(response().headers.get("strict-transport-security")).toMatch(/max-age=\d+/);
  });

  it("does not leak the framework version (poweredByHeader)", () => {
    expect(response().headers.get("x-powered-by")).toBeNull();
  });

  it("issues a fresh nonce per response", () => {
    const a = response().headers.get("x-nonce");
    const b = response().headers.get("x-nonce");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("carries a request id on every response", () => {
    expect(response().headers.get("x-request-id")).toBeTruthy();
  });
});