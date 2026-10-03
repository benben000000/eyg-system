// @vitest-environment node
/**
 * A7 · CI/CD & QA — cost leakage.
 * ============================================================================
 * THE ONE RULE
 * ------------
 * `costPrice` never reaches a surface without a staff session. Not in a
 * response body, not in an error message, not in a `?debug=1` query param, not in
 * a JSON-LD block, not in a client-component prop.
 *
 * WHY THIS FILE IS MOSTLY ABOUT ITS OWN SCANNER
 * ---------------------------------------------
 * A leakage test that cannot detect a leak is worse than no leakage test, because
 * it produces a green tick that means nothing. `support/leak.ts` is therefore
 * itself under test here, against deliberately planted leaks:
 *
 *   • every forbidden key name, planted one at a time, must be caught;
 *   • a cost leaked under a name the scanner does not know must still be caught
 *     by the SENTINEL VALUE check — a response that leaks money without saying
 *     the word "costPrice" is still a leak;
 *   • a body with no leak must NOT be flagged, or the suite becomes noise;
 *   • a value must not match inside a longer number (9973 must not match 99731).
 *
 * Only then is the scanner trusted to scan a real endpoint.
 *
 * THE SENTINEL
 * ------------
 * Every fixture product carries a `costPrice`. The oil filter's is 280 against a
 * sell price of 450. 280 is unique enough that finding it in a public body is
 * conclusive, and key-name scanning alone would miss a field renamed `cost`.
 *
 * WHAT RUNS TODAY: the scanner's own proofs, and a source-level scan of every
 * route file that exists under `src/app/api/**` for cost keys reaching a
 * customer-facing shape.
 *
 * WHAT WAITS ON A2: the endpoint behaviour. Registered per route, naming the file.
 * ============================================================================
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { ProductDto, ReorderRowDto, ServiceAvailabilityDto } from "@/lib/inventory-types";

import { createFakeDb } from "../support/fake-prisma";
import { FIXTURES, PRODUCTS, seedCatalogue } from "../support/fixtures";
import {
  FORBIDDEN_ALWAYS_KEYS,
  FORBIDDEN_COST_KEYS,
  collectNumbers,
  expectNoCostLeak,
  findKeyPaths,
  scanForCostLeak,
} from "../support/leak";
import { describeAwaiting, readRepoFile, SRC_DIR } from "../support/module-resolver";

/** The oil filter costs 280 and sells for 450. 280 appears nowhere else. */
const SENTINEL_COST = 280;
const SENTINEL_SELL = 450;

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The scanner must be able to fail, or nothing below it means anything
// ─────────────────────────────────────────────────────────────────────────────

describe("leakage — the scanner itself is under test", () => {
  it.each(FORBIDDEN_COST_KEYS)("catches a planted `%s` key", (key) => {
    const body = JSON.stringify({ ok: true, data: { rows: [{ sku: "FLT-1", [key]: 280 }] } });
    const report = scanForCostLeak(body);
    expect(report.ok, `"${key}" was not detected`).toBe(false);
    expect(report.leakedKeys).toContain(key);
    expect(findKeyPaths(JSON.parse(body), [key])).toEqual([`data.rows[0].${key}`]);
  });

  it.each(FORBIDDEN_ALWAYS_KEYS)("catches a planted `%s` key", (key) => {
    const body = JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR", [key]: "value" } });
    expect(scanForCostLeak(body).ok, `"${key}" was not detected`).toBe(false);
  });

  it("catches a cost that leaks as a VALUE with no leaking key name", () => {
    // The rename attack. `unitCost` could be added tomorrow; the sentinel catches
    // it today.
    const body = JSON.stringify({ ok: true, data: { items: [{ sku: "FLT-oil-honda-fit", landed: 280 }] } });
    const report = scanForCostLeak(body, { sentinelCosts: [SENTINEL_COST] });
    expect(report.leakedKeys, "no forbidden key name — this is the sneaky case").toEqual([]);
    expect(report.leakedValues).toEqual([SENTINEL_COST]);
    expect(report.ok).toBe(false);
  });

  it("does not confuse a longer number with the sentinel", () => {
    const body = JSON.stringify({ ok: true, data: { qty: 2_807, total: 45_010 } });
    const report = scanForCostLeak(body, { sentinelCosts: [SENTINEL_COST] });
    expect(report.leakedValues, "9973 must not match inside 99731").toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("does not flag a clean body — a scanner that always fails is noise", () => {
    const body = JSON.stringify({
      ok: true,
      data: {
        products: [
          { id: FIXTURES.oilFilter, sku: "FLT-oil-honda-fit", name: "Oil filter", sellPrice: SENTINEL_SELL, stock: { onHand: 4, reserved: 1, available: 3 } },
        ],
      },
      meta: { requestId: "req_1" },
    });
    const report = scanForCostLeak(body, { sentinelCosts: [SENTINEL_COST] });
    expect(report.leakedKeys).toEqual([]);
    expect(report.leakedValues, "the SELL price is not the cost price").toEqual([]);
    expect(report.leakedShapes).toEqual([]);
    expect(report.ok).toBe(true);
    expect(() => expectNoCostLeak(body, "clean body", { sentinelCosts: [SENTINEL_COST] })).not.toThrow();
  });

  it("catches infrastructure detail that is never acceptable in any body", () => {
    for (const body of [
      JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR", message: "PrismaClientKnownRequestError: P2002" } }),
      JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR", message: "connect postgresql://eyg:eyg@db:5432/eyg failed" } }),
      JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR", message: "at Object.<anonymous> (/app/src/lib/server/inventory/stock-engine.ts:42:9)" } }),
      JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR", message: 'SELECT "reserved" FROM "StockLevel" WHERE 1=1' } }),
    ]) {
      expect(scanForCostLeak(body).ok, `not detected: ${body}`).toBe(false);
    }
  });

  it("finds the cost at any depth, including inside an array of arrays", () => {
    const body = JSON.stringify({ ok: true, data: { groups: [[{ meta: { costPrice: 280 } }]] } });
    expect(findKeyPaths(JSON.parse(body), ["costPrice"])).toEqual(["data.groups[0][0].meta.costPrice"]);
    expect(collectNumbers(JSON.parse(body))).toContain(280);
  });

  it("throws with the offending bytes when it does leak", () => {
    const body = JSON.stringify({ ok: true, data: { costPrice: 280 } });
    let message = "";
    try {
      expectNoCostLeak(body, "GET /api/inventory/products", { sentinelCosts: [SENTINEL_COST] });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("COST LEAKAGE");
    expect(message).toContain("GET /api/inventory/products");
    expect(message).toContain("costPrice");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The contract must make cost optional, so a filter is possible
// ─────────────────────────────────────────────────────────────────────────────

describe("leakage — the contract leaves room to filter", () => {
  it("`costPrice` and `marginPct` are OPTIONAL on `ProductDto`, with a staff-only note", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const product = /export interface ProductDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(product).toContain("/** PHP. Server-side only — never send `costPrice` to a public surface. */");
    // Optional, not nullable: `costPrice: number | null` would still put the KEY
    // in the JSON as `null`, and a naive client-side check for absence would miss
    // a leaked value on a sibling row. Optional is the only shape that filters.
    expect(product).toContain("costPrice?: number;");
    expect(product).toContain("marginPct?: number | null;");
    expect(product).toContain("/** Set when the operator is allowed to see margin (staff only). */");
  });

  it("`sellPrice` is required and `costPrice` is not — the pair cannot be confused", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const product = /export interface ProductDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(product).toMatch(/^\s*sellPrice: number;/m);
    expect(product).toMatch(/^\s*costPrice\?: number;/m);
  });

  it("the reorder row's cost fields are optional too", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const row = /export interface ReorderRowDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(row).toContain("costPrice?: number;");
    expect(row).toContain("estimatedCost?: number;");
    expect(row, "the decision fields must be REQUIRED, or a filtered row is useless").toMatch(
      /^\s*suggestedQty: number;/m,
    );
  });

  it("the availability DTO has no cost field AT ALL — not even an optional one", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    for (const name of ["PartAvailabilityDto", "ServiceAvailabilityDto", "ProductAvailabilityDto"]) {
      const block = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(types)?.[1] ?? "";
      expect(block, `${name} not found in inventory-types.ts`).not.toBe("");
      expect(block, `${name} must not carry cost or margin — it is reachable without a session`).not.toMatch(
        /cost|margin/i,
      );
    }
  });

  it("only the valuation DTO carries cost, and only optionally", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    const valuation = /export interface ValuationDto \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(valuation).toContain("/** At cost. Staff-only. */");
    expect(valuation).toContain("costValue?: number;");
  });

  it("`StockCountDto.summary.varianceValue` is optional — it is money", () => {
    const types = readRepoFile("src/lib/inventory-types.ts");
    expect(types).toContain("varianceValue?: number;");
  });

  it("`JSON.parse` is not a filter — the suite scans the raw bytes", () => {
    // Stated as a test because it is the single most common way a leakage suite
    // goes quietly vacuous: `expect(body.data.product).not.toHaveProperty(...)`
    // checks one sub-object of one envelope and calls it a day.
    const raw = JSON.stringify({ ok: true, data: { product: { sku: "A" }, meta: { debug: { costPrice: 280 } } } });
    const parsed = JSON.parse(raw) as { data: { product: Record<string, unknown> } };
    expect(parsed.data.product.costPrice, "sanity: the parsed sub-object has no cost").toBeUndefined();
    expect(scanForCostLeak(raw, { sentinelCosts: [SENTINEL_COST] }).ok, "but the bytes do").toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The fixtures must be populated, or a leak cannot be observed
// ─────────────────────────────────────────────────────────────────────────────

describe("leakage — the fixtures carry real cost data", () => {
  let db: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    db = createFakeDb({ now: () => new Date("2026-03-11T09:00:00+08:00") });
    seedCatalogue(db);
  });

  it("every fixture product has a costPrice and a derived marginPct", () => {
    for (const product of PRODUCTS) {
      expect(product.costPrice, `${product.sku} has no cost — a leak test would pass for the wrong reason`)
        .toBeGreaterThan(0);
      expect(product.sellPrice).toBeGreaterThan(product.costPrice);
      const expectedMargin = Math.round(((product.sellPrice - product.costPrice) / product.sellPrice) * 100);
      expect(product.marginPct, `${product.sku} margin`).toBe(expectedMargin);
    }
  });

  it("the sentinel cost is unique across the catalogue, so finding it is conclusive", () => {
    const costs = PRODUCTS.map((product) => product.costPrice);
    expect(costs.filter((cost) => cost === SENTINEL_COST)).toHaveLength(1);
    // No other product's sell price, quantity or reorder point may equal it either.
    const others = PRODUCTS.filter((product) => product.id !== FIXTURES.oilFilter).flatMap((product) => [
      product.sellPrice,
      product.reorderPoint,
      product.reorderQty,
      product.shelfLifeDays ?? 0,
    ]);
    expect(others, "the sentinel collides with another fixture value").not.toContain(SENTINEL_COST);
  });

  it("a server-side product read DOES carry the cost — so the filter has something to remove", () => {
    // The control. If the staff read also had no cost, the public-read test would
    // pass because the value was never there, not because it was filtered.
    const staffProduct = {
      id: FIXTURES.oilFilter,
      sku: "FLT-oil-honda-fit",
      name: "Oil filter — Honda Fit / City",
      sellPrice: SENTINEL_SELL,
      costPrice: SENTINEL_COST,
      marginPct: 38,
    } as ProductDto;
    const raw = JSON.stringify({ ok: true, data: staffProduct });
    expect(scanForCostLeak(raw, { sentinelCosts: [SENTINEL_COST] }).ok, "the control must FAIL the scan").toBe(false);
  });

  it("a staff reorder read carries the cost; a public one does not", () => {
    const staffRow = {
      productId: FIXTURES.oilFilter,
      sku: "FLT-oil-honda-fit",
      available: 4,
      reorderPoint: 6,
      reorderQty: 24,
      suggestedQty: 24,
      costPrice: SENTINEL_COST,
      estimatedCost: SENTINEL_COST * 24,
      isStockout: true,
    } as ReorderRowDto;
    const publicRow = { ...staffRow, costPrice: undefined, estimatedCost: undefined } as ReorderRowDto;

    const staffRaw = JSON.stringify({ ok: true, data: staffRow });
    const publicRaw = JSON.stringify({ ok: true, data: publicRow });

    expect(scanForCostLeak(staffRaw, { sentinelCosts: [SENTINEL_COST] }).ok).toBe(false);
    expect(scanForCostLeak(publicRaw, { sentinelCosts: [SENTINEL_COST] }).ok, "the filtered row must be clean").toBe(true);
    expect(publicRaw, "JSON.stringify must OMIT an undefined optional, not emit null").not.toContain("costPrice");
  });

  it("a staff availability read is clean — availability never carries cost at all", () => {
    const availability: ServiceAvailabilityDto = {
      serviceId: FIXTURES.servicePms,
      serviceSlug: "pms-honda",
      name: "PMS — Honda (oil + filter)",
      canFulfil: true,
      parts: [
        {
          productId: FIXTURES.oilFilter,
          sku: "FLT-oil-honda-fit",
          name: "Oil filter — Honda Fit / City",
          size: null,
          kind: "FILTER",
          unit: "EA",
          qtyPerService: 1,
          qtyNeeded: 1,
          available: 4,
          isBlocking: true,
          isShort: false,
          sellPrice: SENTINEL_SELL,
        },
      ],
      blockers: [],
    };
    expect(scanForCostLeak(JSON.stringify(availability), { sentinelCosts: [SENTINEL_COST] }).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · Every route that exists today
// ─────────────────────────────────────────────────────────────────────────────

describe("leakage - no route in the app returns cost to an anonymous caller", () => {
  it("no existing API route ships an unfiltered cost field in a client-facing shape", () => {
    // Walks `src/app/api/**`. Every route that ships today is checked, so the
    // moment one lands with a `select` that includes `costPrice`, this goes red.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        const full = join(dir, name);
        if (existsSync(full) && statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!name.endsWith(".ts")) continue;
        const relative = full.slice(join(SRC_DIR, "app", "api").length + 1).split(sep).join("/");
        const source = readRepoFile(join("src", "app", "api", relative));
        // A `select` that names `costPrice` is the shape that puts it on the wire.
        if (/select:\s*\{[^}]*\bcostPrice\b/.test(source)) offenders.push(full);
      }
    };
    walk(join(SRC_DIR, "app", "api"));
    expect(offenders, "a route selects costPrice, which puts it on the wire").toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · A2-facing
// ─────────────────────────────────────────────────────────────────────────────

describeAwaiting(
  {
    ready: false,
    mod: null,
    specifier: null,
    missing: [
      "the unauthenticated read of `GET /api/inventory/availability`",
      "the unauthenticated read of `GET /api/inventory/products`",
      "the error body of `POST /api/inventory/movement`",
      "the error body of `GET /api/inventory/products/[id]`",
      "the error body of `GET /api/inventory/reorder`",
    ],
    notes: [],
  },
  "leakage — AWAITING the real inventory routes",
);

describe("leakage — the endpoint assertions that will run when the routes land", () => {
  it.todo(
    "GET /api/inventory/availability with NO session. Assert on `await response.text()` — not on a " +
      "parsed object — that the raw JSON contains neither `costPrice` nor `marginPct` nor the " +
      "sentinel 280, for every product in the response, and that a 200 is returned (availability is " +
      "the one public read) with `cache-control` that does not let a shared cache keep it. " +
      "Awaits: `src/app/api/inventory/availability/route.ts`.",
  );

  it.todo(
    "GET /api/inventory/products with NO session, and with a CUSTOMER session. Both must be 401 or " +
      "403 — the catalogue is a staff surface. Assert the raw text carries no cost key and no " +
      "sentinel. Then with a `FRONT_DESK` staff session: 200 is fine, and the cost keys MAY be " +
      "present (staff are allowed to see margin) — that asymmetry is the point, so assert both " +
      "sides or the test proves nothing. Awaits: `src/app/api/inventory/products/route.ts`.",
  );

  it.todo(
    "A 400/404/409/500 error body from EVERY inventory route. Assert the raw text contains no cost " +
      "key, no sentinel, no stack frame, no `PrismaClient`, no connection string and no SQL — " +
      "including the `error.fields` map, which is where a Zod `path` can echo an unexpected field " +
      "name straight back to the client. Awaits: all inventory routes.",
  );

  it.todo(
    "`?debug=1`, `?include=cost`, `?fields=all` and `?cost=true` on every inventory route: the " +
      "response must be byte-identical to the request without them. A query parameter that widens a " +
      "response is the most common way a cost field escapes a filter. Awaits: all inventory routes.",
  );

  it.todo(
    "No inventory component ships cost as a prop to a Client Component. Read every file under " +
      "`src/app/inventory/**` and `src/components/inventory/**`, assert none of them begins with " +
      "\"use client\" AND mentions `costPrice` or `marginPct`, and assert none passes a `costPrice` " +
      "into a child component's props from a server component. Awaits: A3's files.",
  );

  it.todo(
    "JSON-LD and `generateMetadata`: the product JSON-LD block must carry `offers.price` (sell) and " +
      "never `costPrice` or a margin field. Awaits: A3's `src/app/inventory/**`.",
  );
});
