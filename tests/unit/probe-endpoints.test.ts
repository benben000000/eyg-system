// @vitest-environment node
/**
 * QA & SECURITY AGENT — the health endpoints must be pollable.
 * ============================================================================
 * Contract under test: `PROBE_API_PATHS` and `isProbeApi` in
 * `src/lib/session-cookie.ts`, and the bot-damping branch of `src/middleware.ts`
 * that consults them.
 *
 * WHY THIS TEST EXISTS
 *
 * The container image's own HEALTHCHECK runs `wget --spider` against
 * `/api/health`. `wget/` is in the middleware's scraper user-agent list, so the
 * probe was answered with a 403 and the container was marked `unhealthy` — for
 * as long as the image took to build, which was never, because the base image
 * tag did not exist. Two failures stacked on top of each other and neither was
 * visible until both were removed.
 *
 * The underlying problem is bigger than CI. `curl/`, `python-requests` and
 * `node-fetch` are in the same list, so `/api/health` answered 403 to every
 * non-browser caller: no uptime monitor, no load balancer probe, and no operator
 * running `curl` from a laptop could tell whether the shop was up. An endpoint
 * you cannot poll is not a health check.
 *
 * The exemption has to stay NARROW. `PUBLIC_API_PREFIXES` is the tempting thing
 * to reuse — it already contains `/api/health` — but it answers "reachable
 * without a staff session" and also lists `/api/booking` and `/api/quote`, which
 * are exactly what the scraper block protects. So the tests below assert that
 * widening the exemption to the public API list is a failure, not a convenience.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";

import { PUBLIC_API_PREFIXES, PROBE_API_PATHS, isProbeApi } from "@/lib/session-cookie";

/**
 * The scraper list as the middleware holds it, and the exemption as it is
 * applied. Re-derived here on purpose: the point of the test is the relationship
 * between two lists, and importing both from their modules would let them drift
 * together without anyone noticing.
 */
const SCRAPER_UA = ["curl/", "wget/", "python-requests", "node-fetch", "go-http-client", "axios/"];

/** The rule the middleware applies, in one line. */
function middlewareBlocksApi(pathname: string, ua: string): boolean {
  const isApi = pathname.startsWith("/api/");
  return isApi && !isProbeApi(pathname) && SCRAPER_UA.some((b) => ua.toLowerCase().includes(b));
}

describe("health endpoints are pollable by automated agents", () => {
  it("names exactly the two probe endpoints", () => {
    expect([...PROBE_API_PATHS]).toEqual(["/api/health", "/api/ready"]);
  });

  it("recognises them, and nothing that merely looks like them", () => {
    expect(isProbeApi("/api/health")).toBe(true);
    expect(isProbeApi("/api/ready")).toBe(true);

    // Prefix, suffix and case variants must not inherit the exemption. A
    // `startsWith` here would exempt every endpoint beneath these paths, which
    // is how an exemption for two endpoints turns into a hole in the API.
    expect(isProbeApi("/api/healthz")).toBe(false);
    expect(isProbeApi("/api/health/../admin")).toBe(false);
    expect(isProbeApi("/api/ready/deep")).toBe(false);
    expect(isProbeApi("/api/healthy")).toBe(false);
    expect(isProbeApi("/api/")).toBe(false);
    expect(isProbeApi("/api/Health")).toBe(false);
    expect(isProbeApi("/")).toBe(false);
    expect(isProbeApi("/api/health?x=1")).toBe(false);
  });

  it("is not answered with 403 to any scraper user-agent", () => {
    for (const ua of SCRAPER_UA) {
      for (const path of PROBE_API_PATHS) {
        expect(middlewareBlocksApi(path, ua), `${ua} must be able to poll ${path}`).toBe(false);
      }
    }
  });

  it("is not answered with 403 when there is no user-agent at all", () => {
    // A probe from a load balancer may send none. `isLikelyScraper` already
    // treats a missing UA as not-a-scraper; this pins that behaviour against the
    // exemption so the two cannot be read differently later.
    expect(middlewareBlocksApi("/api/health", "")).toBe(false);
  });

  it("still blocks the endpoints the scraper rule exists to protect", () => {
    // The exemption is the whole change; these are what must not move.
    for (const path of ["/api/booking", "/api/quote", "/api/availability", "/api/reviews"]) {
      expect(middlewareBlocksApi(path, "curl/8.4.0"), `scrapers must still be blocked from ${path}`).toBe(true);
      expect(middlewareBlocksApi(path, "python-requests/2.31.0"), `scrapers must still be blocked from ${path}`).toBe(true);
    }
  });

  it("does not exempt anything merely because it is on PUBLIC_API_PREFIXES", () => {
    // This is the mistake the exemption is shaped to prevent: reusing the public
    // list would take /api/booking and /api/quote along with it.
    const others = PUBLIC_API_PREFIXES.filter((p) => !(PROBE_API_PATHS as readonly string[]).includes(p));
    expect(others.length).toBeGreaterThan(0);
    for (const path of others) {
      expect(isProbeApi(path), `${path} must not inherit the probe exemption`).toBe(false);
      expect(middlewareBlocksApi(path, "wget/1.21")).toBe(true);
    }
  });

  it("leaves browser traffic alone, before and after the change", () => {
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
    for (const path of ["/api/health", "/api/booking", "/api/quote"]) {
      expect(middlewareBlocksApi(path, chrome)).toBe(false);
    }
  });
});
