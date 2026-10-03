// @vitest-environment node
/**
 * QA & SECURITY AGENT — instant-quote estimator: arithmetic and honesty.
 * ============================================================================
 * Contract under test: `estimate()` in `src/lib/server/quote.ts`.
 *
 * The estimator is the funnel's honesty gate. `QuoteEstimateDto.disclaimer` and
 * `isApproximate` (see `src/lib/types.ts`) are the only things stopping a
 * visitor from treating a guess as a quote. Being quoted ₱8,000 and charged
 * ₱11,500 is the fastest way to lose a Bataan customer *and* generate a DTI
 * complaint.
 *
 * DATABASE STRATEGY (documented in docs/qa/TEST-STRATEGY.md)
 * ---------------------------------------------------------
 * Prisma is mocked with `vi.mock("@/lib/server/db", …)` and a typed in-memory
 * fake. Every query the engine makes is a `findMany`/`findFirst` over that fake,
 * so the suite is deterministic, needs no Postgres, and runs in ~40 ms. The
 * authoritative database behaviour (serialisable transactions, the slot race)
 * lives in tests/integration/api-booking.test.ts.
 * ============================================================================
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuoteEstimateDto } from "@/lib/types";

// ── Typed in-memory Prisma fake ─────────────────────────────────────────────

type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  summary: string;
  pricing: "FIXED" | "RANGE" | "CALL_FOR_PRICE";
  priceMin: number | null;
  priceMax: number | null;
  priceNote: string | null;
  durationMin: number | null;
  isPopular: boolean;
  isFeatured: boolean;
  includes: string[];
  category: { slug: string; name: string; icon: string | null };
};

type PackageRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categoryId: string | null;
  priceMin: number;
  priceMax: number | null;
  compareAtMin: number | null;
  savingsPct: number | null;
  badge: string | null;
  isSeasonal: boolean;
  seasonKey: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{ service: { name: string }; quantity: number }>;
};

type PromoRow = {
  slug: string;
  title: string;
  kind: string;
  code: string | null;
  valuePct: number | null;
  valueOff: number | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

interface FakeDb {
  services: ServiceRow[];
  packages: PackageRow[];
  promos: PromoRow[];
}

const db: FakeDb = { services: [], packages: [], promos: [] };

vi.mock("@/lib/server/db", () => ({
  prisma: {
    service: {
      findMany: async (args: { where?: { id?: { in?: string[] }; isActive?: boolean } }) => {
        const ids = args.where?.id?.in ?? [];
        return db.services.filter(
          (s) => ids.includes(s.id) && (args.where?.isActive !== false || s.pricing !== null),
        );
      },
      findFirst: async () => null,
    },
    package: {
      findFirst: async (args: { where: { id: string; isActive?: boolean } }) =>
        db.packages.find((p) => p.id === args.where.id) ?? null,
    },
    promotion: {
      findFirst: async (args: { where: { code: string; isActive: boolean } }) =>
        db.promos.find((p) => p.code === args.where.code && p.isActive === args.where.isActive) ?? null,
    },
  },
}));

const NOW = new Date("2026-10-02T09:00:00+08:00");

// ── Fixtures ────────────────────────────────────────────────────────────────

function service(over: Partial<ServiceRow> & Pick<ServiceRow, "id" | "slug" | "name">): ServiceRow {
  return {
    shortName: null,
    summary: "",
    pricing: "FIXED",
    priceMin: 0,
    priceMax: 0,
    priceNote: null,
    durationMin: 60,
    isPopular: false,
    isFeatured: false,
    includes: [],
    category: { slug: "general", name: "General", icon: null },
    ...over,
  };
}

const FIXED_PMS = service({
  id: "svc-pms-a",
  slug: "pms-a",
  name: "PMS A (Oil + Filter)",
  pricing: "FIXED",
  priceMin: 1800,
  priceMax: 1800,
});
const RANGED_BRAKES = service({
  id: "svc-brakes",
  slug: "brake-pad-replacement",
  name: "Brake Pad Replacement (front axle)",
  pricing: "RANGE",
  priceMin: 2200,
  priceMax: 3400,
  priceNote: "Ceramic or semi-metallic",
  durationMin: 90,
});
const CALL_FOR_PRICE = service({
  id: "svc-undercoat",
  slug: "undercoating",
  name: "Undercoating",
  pricing: "CALL_FOR_PRICE",
  priceMin: null,
  priceMax: null,
  priceNote: "Depends on vehicle size and rust condition.",
  durationMin: 180,
});
const TYRES = service({
  id: "svc-tyres",
  slug: "tyre-change",
  name: "Tyre Change + Balance",
  pricing: "RANGE",
  priceMin: 1200,
  priceMax: 2400,
  durationMin: 60,
});

function pkg(over: Partial<PackageRow> & Pick<PackageRow, "id" | "slug" | "name" | "priceMin">): PackageRow {
  return {
    tagline: "",
    description: "",
    categoryId: null,
    priceMax: null,
    compareAtMin: null,
    savingsPct: null,
    badge: null,
    isSeasonal: false,
    seasonKey: null,
    validFrom: null,
    validUntil: null,
    isFeatured: false,
    isActive: true,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    items: [],
    ...over,
  };
}

const RAINY_PACKAGE = pkg({
  id: "pkg-rainy",
  slug: "rainy-season-safety-bundle",
  name: "Rainy Season Safety Bundle",
  priceMin: 2400,
  priceMax: 3200,
  compareAtMin: 3350,
});

function promo(over: Partial<PromoRow> & Pick<PromoRow, "code" | "kind">): PromoRow {
  return {
    slug: over.code!.toLowerCase(),
    title: over.code!,
    valuePct: null,
    valueOff: null,
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...over,
  };
}

beforeEach(() => {
  db.services = [FIXED_PMS, RANGED_BRAKES, CALL_FOR_PRICE, TYRES];
  db.packages = [RAINY_PACKAGE];
  db.promos = [
    // Exactly the shapes `src/content/marketing/promotions.ts` seeds.
    promo({ code: "RAINYSAFE", kind: "BUNDLE", valueOff: 950 }),
    promo({ code: "FIRSTPMS", kind: "PERCENT_OFF", valuePct: 15 }),
    promo({ code: "TIRESAVE", kind: "CLEARANCE", valuePct: 10 }),
    promo({ code: "NEIGHBOUR", kind: "FIXED_OFF", valueOff: 300 }),
    promo({ code: "MYCHECK", kind: "SEASONAL", valueOff: 300 }),
    promo({ code: "BDAYEYG", kind: "PERCENT_OFF", valuePct: 12 }),
  ];
});

/** Runs the engine and returns just the DTO. */
async function dto(serviceIds: string[], extra: Record<string, unknown> = {}): Promise<QuoteEstimateDto> {
  const { estimate } = await import("@/lib/server/quote");
  const result = await estimate({ serviceIds, now: NOW, ...extra });
  return result.dto;
}

const spread = (value: QuoteEstimateDto): number => {
  const midpoint = (value.min + value.max) / 2;
  return midpoint === 0 ? Number.POSITIVE_INFINITY : (value.max - value.min) / midpoint;
};

// ─────────────────────────────────────────────────────────────────────────────

describe("quote-math — arithmetic", () => {
  it("a FIXED service yields min === max === the listed price", async () => {
    const result = await dto([FIXED_PMS.id]);
    expect(result.min).toBe(1800);
    expect(result.max).toBe(1800);
    expect(result.currency).toBe("PHP");
    const line = result.lineItems.find((l) => l.id === FIXED_PMS.id);
    expect(line).toBeDefined();
    expect(line!.isVariable).toBe(false);
    expect(spread(result)).toBe(0);
  });

  it("a RANGE service yields min < max with both bounds present", async () => {
    const result = await dto([RANGED_BRAKES.id]);
    expect(result.min).toBe(2200);
    expect(result.max).toBe(3400);
    expect(result.lineItems.find((l) => l.id === RANGED_BRAKES.id)!.isVariable).toBe(false);
  });

  it("adds multiple services", async () => {
    const result = await dto([FIXED_PMS.id, RANGED_BRAKES.id]);
    expect(result.min).toBe(4000);
    expect(result.max).toBe(5200);
    expect(result.lineItems).toHaveLength(2);
  });

  it("every amount is a whole-peso integer", async () => {
    const result = await dto([FIXED_PMS.id, RANGED_BRAKES.id, CALL_FOR_PRICE.id], {
      packageId: RAINY_PACKAGE.id,
      promoCode: "FIRSTPMS",
    });
    const amounts: number[] = [result.min, result.max];
    for (const line of result.lineItems) amounts.push(line.min, line.max, line.quantity);
    for (const value of amounts) {
      expect(Number.isInteger(value), `non-integer peso: ${value}`).toBe(true);
      expect(String(value), `a peso amount rendered with centavos: ${value}`).not.toMatch(/[.,]\d/);
    }
  });

  it("min <= max, expiresAt is in the future, and the quote TTL is 7 days", async () => {
    const { QUOTE_TTL_DAYS } = await import("@/lib/server/quote");
    const result = await dto([RANGED_BRAKES.id]);
    expect(result.min).toBeLessThanOrEqual(result.max);
    expect(Date.parse(result.expiresAt)).toBe(NOW.getTime() + QUOTE_TTL_DAYS * 86_400_000);
  });

  it("multiplies a per-tyre service by tyreCount, clamped to 1..4", async () => {
    expect((await dto([TYRES.id], { tyreCount: 4 })).min).toBe(4800);
    expect((await dto([TYRES.id], { tyreCount: 1 })).min).toBe(1200);
    // A hostile tyreCount must not inflate the quote without limit.
    expect((await dto([TYRES.id], { tyreCount: 99 })).min).toBe(4800);
    expect((await dto([TYRES.id], { tyreCount: 0 })).min).toBe(1200);
  });

  it("a package REPLACES the individual lines with one bundled price", async () => {
    const result = await dto([FIXED_PMS.id], { packageId: RAINY_PACKAGE.id });
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]!.id).toBe(RAINY_PACKAGE.slug);
    expect(result.min).toBe(2400);
    expect(result.max).toBe(3200);
  });
});

describe("quote-math — CALL_FOR_PRICE honesty", () => {
  it("is flagged variable and carries a note", async () => {
    const result = await dto([CALL_FOR_PRICE.id]);
    const line = result.lineItems.find((l) => l.id === CALL_FOR_PRICE.id);
    expect(line!.isVariable).toBe(true);
    expect((line!.variableNote ?? "").trim()).not.toBe("");
    expect(line!.variableNote).toContain("rust condition");
    expect(result.isApproximate).toBe(true);
  });

  /**
   * ⚠ EXPECTED TO FAIL — DEF-005.
   *
   * `estimate()` builds the line from `priceMin ?? 0` and `priceMax ?? priceMin`,
   * so a `CALL_FOR_PRICE` service contributes **₱0 – ₱0** to the band. The
   * customer sees "Undercoating ₱0" in an itemised quote and can reasonably
   * conclude the undercoating is free. The brief requires a WIDE BAND, not a
   * zero. See docs/qa/DEFECT-LOG-TEMPLATE.md → DEF-005.
   */
  it("must contribute a real band, never ₱0 (DEF-005, expected to fail)", async () => {
    const result = await dto([CALL_FOR_PRICE.id]);
    const line = result.lineItems.find((l) => l.id === CALL_FOR_PRICE.id)!;
    expect(line.max, "a CALL_FOR_PRICE service must never quote ₱0–₱0").toBeGreaterThan(line.min);
    expect(line.max).toBeGreaterThan(0);
  });

  it("a variable line alone makes the whole estimate approximate", async () => {
    const result = await dto([FIXED_PMS.id, CALL_FOR_PRICE.id]);
    expect(result.isApproximate).toBe(true);
  });
});

describe("quote-math — the 60% honesty rule", () => {
  it("APPROXIMATE_SPREAD_RATIO is 0.6", async () => {
    const { APPROXIMATE_SPREAD_RATIO } = await import("@/lib/server/quote");
    expect(APPROXIMATE_SPREAD_RATIO).toBe(0.6);
  });

  it("flags isApproximate when the spread exceeds 60% of the midpoint", async () => {
    const wide = service({
      id: "svc-wide",
      slug: "full-underbody-repair",
      name: "Full underbody repair",
      pricing: "RANGE",
      priceMin: 500,
      priceMax: 9000,
    });
    db.services = [wide];
    const result = await dto([wide.id]);
    expect(spread(result), "fixture must actually exceed the threshold").toBeGreaterThan(0.6);
    expect(result.isApproximate).toBe(true);
    expect(result.disclaimer.trim()).not.toBe("");
  });

  it("does NOT flag a tight band", async () => {
    const result = await dto([FIXED_PMS.id]);
    expect(spread(result)).toBeLessThan(0.6);
    expect(result.isApproximate).toBe(false);
  });

  it("the disclaimer reads like a human disclaimer", async () => {
    const result = await dto([CALL_FOR_PRICE.id]);
    expect(result.disclaimer).toMatch(/indicative|estimate|confirm|inspection|vehicle/i);
    expect(result.disclaimer.length).toBeGreaterThan(20);
  });
});

describe("quote-math — promo clamping", () => {
  it("a percent discount never drives the total below zero", async () => {
    db.promos.push(promo({ code: "ABSURD", kind: "PERCENT_OFF", valuePct: 400 }));
    const result = await dto([FIXED_PMS.id], { promoCode: "ABSURD" });
    expect(result.min).toBeGreaterThanOrEqual(0);
    expect(result.max).toBeGreaterThanOrEqual(0);
    expect(result.lineItems.every((l) => l.min >= 0 && l.max >= 0)).toBe(true);
  });

  it("a fixed discount larger than the subtotal clamps at zero", async () => {
    db.promos.push(promo({ code: "HUGE", kind: "FIXED_OFF", valueOff: 99_999 }));
    const result = await dto([FIXED_PMS.id], { promoCode: "HUGE" });
    expect(result.min).toBe(0);
    expect(result.max).toBeGreaterThanOrEqual(0);
  });

  it("percent-off is clamped to 90% server-side, not trusted from the seed", async () => {
    db.promos.push(promo({ code: "OVER90", kind: "PERCENT_OFF", valuePct: 250 }));
    const { evaluatePromo } = await import("@/lib/server/quote");
    const evaluation = await evaluatePromo("OVER90", NOW);
    expect(evaluation.percentOff).toBeLessThanOrEqual(90);
  });

  it("the reported saving never exceeds the pre-discount subtotal", async () => {
    const result = await dto([RANGED_BRAKES.id], { promoCode: "FIRSTPMS" });
    if (result.savings) {
      expect(result.savings.amount).toBeGreaterThanOrEqual(0);
      expect(result.savings.compareAt).toBeGreaterThanOrEqual(result.min);
    }
  });

  it("an inactive promo is not applied and is reported", async () => {
    db.promos.push(promo({ code: "GONE", kind: "PERCENT_OFF", valuePct: 50, isActive: false }));
    const { estimate } = await import("@/lib/server/quote");
    const result = await estimate({ serviceIds: [FIXED_PMS.id], promoCode: "GONE", now: NOW });
    expect(result.promoStatus).toBe("NOT_FOUND");
    expect(result.dto.min).toBe(1800);
    expect(result.dto.savings).toBeUndefined();
  });

  it("an expired promo window is reported as EXPIRED, not silently applied", async () => {
    db.promos.push(
      promo({ code: "LASTYEAR", kind: "FIXED_OFF", valueOff: 500, endsAt: new Date("2026-01-01T00:00:00+08:00") }),
    );
    const { evaluatePromo } = await import("@/lib/server/quote");
    expect((await evaluatePromo("LASTYEAR", NOW)).status).toBe("EXPIRED");
  });

  it("a not-yet-started promo is reported as NOT_STARTED", async () => {
    db.promos.push(
      promo({ code: "FUTURE", kind: "FIXED_OFF", valueOff: 500, startsAt: new Date("2027-01-01T00:00:00+08:00") }),
    );
    const { evaluatePromo } = await import("@/lib/server/quote");
    expect((await evaluatePromo("FUTURE", NOW)).status).toBe("NOT_STARTED");
  });

  /**
   * ⚠ EXPECTED TO FAIL — DEF-006.
   *
   * `estimate()` computes ONE peso amount from `subtotalMin` and then subtracts
   * that same amount from BOTH bounds:
   *
   *     discount  = round(subtotalMin * pct / 100)
   *     min       = subtotalMin - discount
   *     max       = subtotalMax - discount
   *
   * So 15% off a ₱1,800–₱3,400 basket yields ₱1,530–₱3,070, when the true
   * 15%-off band is ₱1,530–₱2,890. The customer is shown a maximum that is
   * ₱180 too high — the shop has quoted a ceiling it does not intend to honour.
   * A discount must be applied to each bound proportionally.
   */
  it("a percent discount must scale BOTH bounds proportionally (DEF-006, expected to fail)", async () => {
    const gross = await dto([FIXED_PMS.id, RANGED_BRAKES.id]); // 4000 – 5200
    const discounted = await dto([FIXED_PMS.id, RANGED_BRAKES.id], { promoCode: "FIRSTPMS" });
    expect(discounted.min).toBe(Math.round(4000 * 0.85));
    expect(discounted.max, "the ceiling must be discounted by the same percentage as the floor").toBe(
      Math.round(5200 * 0.85),
    );
    expect(discounted.max).toBeLessThan(gross.max);
    expect(discounted.max).toBeLessThanOrEqual(gross.max - discounted.savings!.amount + 1);
  });

  /**
   * ⚠ EXPECTED TO FAIL — DEF-007.
   *
   * `evaluatePromo()` only reads arithmetic from `PERCENT_OFF` and `FIXED_OFF`:
   *
   *     percentOff = kind === "PERCENT_OFF" ? valuePct : 0
   *     fixedOff   = kind === "FIXED_OFF"   ? valueOff : 0
   *
   * Three of the six promotions seeded in `src/content/marketing/promotions.ts`
   * carry their value on a kind that is not read:
   *   • RAINYSAFE — kind BUNDLE,    valueOff 950, priority 100 (the hero promo)
   *   • TIRESAVE  — kind CLEARANCE, valuePct 10,  priority 90
   *   • MYCHECK   — kind SEASONAL,  valueOff 300
   * All three return `NOT_ELIGIBLE`, so a customer who types the code sees no
   * discount at all while the /deals page advertises one.
   */
  it("honours every promo kind the seed actually uses (DEF-007, expected to fail)", async () => {
    const { evaluatePromo } = await import("@/lib/server/quote");
    const report: string[] = [];
    for (const code of ["RAINYSAFE", "TIRESAVE", "MYCHECK", "NEIGHBOUR", "FIRSTPMS", "BDAYEYG"]) {
      const evaluation = await evaluatePromo(code, NOW);
      report.push(`${code}=${evaluation.status}`);
      expect(evaluation.status, `${code} was reported ${evaluation.status}`).toBe("APPLIED");
      expect(evaluation.percentOff + evaluation.fixedOff, `${code} carries no value`).toBeGreaterThan(0);
    }
    expect(report.join(" ")).toMatch(/APPLIED/);
  });
});

describe("quote-math — disclaimer is never empty", () => {
  const matrix: ReadonlyArray<readonly [string, string[], Record<string, unknown>]> = [
    ["empty selection", [], {}],
    ["fixed", [FIXED_PMS.id], {}],
    ["ranged", [RANGED_BRAKES.id], {}],
    ["call-for-price", [CALL_FOR_PRICE.id], {}],
    ["mixed", [FIXED_PMS.id, CALL_FOR_PRICE.id], {}],
    ["bad promo", [FIXED_PMS.id], { promoCode: "NOPE" }],
    ["package", [], { packageId: RAINY_PACKAGE.id }],
    ["tyres x4", [TYRES.id], { tyreCount: 4, engine: "electric" }],
    ["everything", [FIXED_PMS.id, RANGED_BRAKES.id, CALL_FOR_PRICE.id, TYRES.id], { tyreCount: 4 }],
  ];

  it.each(matrix.map(([name, ids, extra]) => [name, ids, extra] as const))(
    "%s yields a non-empty, human disclaimer",
    async (_name, ids, extra) => {
      const result = await dto([...ids], { ...extra });
      expect(typeof result.disclaimer, _name).toBe("string");
      expect(result.disclaimer.trim(), `disclaimer was "${result.disclaimer}"`).not.toBe("");
      expect(result.disclaimer, _name).not.toMatch(/undefined|NaN|null|\[object/i);
      expect(result.disclaimer.length, _name).toBeGreaterThan(15);
    },
  );
});

describe("quote-math — nextStep safety", () => {
  it("nextStep.href is a relative in-app path", async () => {
    const result = await dto([FIXED_PMS.id]);
    expect(result.nextStep.label.trim()).not.toBe("");
    expect(result.nextStep.href.startsWith("/")).toBe(true);
    expect(result.nextStep.href).not.toMatch(/^(javascript|data|https?):/i);
  });

  it("nextStep carries the selected service slugs so /book pre-checks them", async () => {
    const result = await dto([FIXED_PMS.id, RANGED_BRAKES.id]);
    expect(result.nextStep.href).toContain("service=pms-a");
    expect(result.nextStep.href).toContain("service=brake-pad-replacement");
  });

  it("a promo that was NOT applied is never echoed into the /book link", async () => {
    const result = await dto([FIXED_PMS.id], { promoCode: "NOPE" });
    expect(result.nextStep.href).not.toContain("promo=");
  });

  it("an applied promo IS carried into the /book link", async () => {
    const result = await dto([FIXED_PMS.id], { promoCode: "NEIGHBOUR" });
    expect(result.nextStep.href).toContain("promo=NEIGHBOUR");
  });
});

describe("quote-math — robustness", () => {
  it("an unknown service id is a VALIDATION_ERROR, never a silent zero line", async () => {
    const { estimate } = await import("@/lib/server/quote");
    await expect(estimate({ serviceIds: ["ghost"], now: NOW })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("an unknown package id is a VALIDATION_ERROR", async () => {
    const { estimate } = await import("@/lib/server/quote");
    await expect(estimate({ serviceIds: [FIXED_PMS.id], packageId: "ghost", now: NOW })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("an unknown promo code is reported, not thrown", async () => {
    const { estimate } = await import("@/lib/server/quote");
    const result = await estimate({ serviceIds: [FIXED_PMS.id], promoCode: "GHOST", now: NOW });
    expect(result.promoStatus).toBe("NOT_FOUND");
  });

  it("a zero-price service does not produce NaN", async () => {
    const free = service({ id: "svc-free", slug: "aircon-regas-check", name: "A/C check", priceMin: 0, priceMax: 0 });
    db.services = [free];
    const result = await dto([free.id]);
    expect(Number.isFinite(result.min)).toBe(true);
    expect(Number.isFinite(result.max)).toBe(true);
    expect(result.min).toBeGreaterThanOrEqual(0);
  });

  /**
   * ⚠ EXPECTED TO FAIL — DEF-008 (Low severity).
   *
   * `QuoteEstimateDto.min` / `.max` are typed `number`, but nothing in
   * `estimate()` sanitises. A non-finite value serialises to `null`, so the
   * client renders `₱null`. Unreachable from Postgres today (`priceMin` is
   * `Int?`), but it is one `Float` column away — hence the guard.
   */
  it("never emits a non-finite min/max, which JSON would turn into null (DEF-008, expected to fail)", async () => {
    db.services = [
      service({ id: "svc-nan", slug: "x", name: "X", priceMin: Number.NaN, priceMax: Number.NaN }),
    ];
    const result = await dto(["svc-nan"]);
    expect(Number.isFinite(result.min), "min must be a finite number").toBe(true);
    expect(Number.isFinite(result.max), "max must be a finite number").toBe(true);
    expect(JSON.stringify(result), "the wire format must never contain null in place of a peso").not.toMatch(
      /"min":null|"max":null/,
    );
  });
});

describe("quote-math — estimator abuse (A04)", () => {
  it("cannot be used to enumerate a competitor's price list by probing ids", async () => {
    // Only ids that exist resolve; everything else is a VALIDATION_ERROR that
    // discloses nothing about what DOES exist.
    const { estimate } = await import("@/lib/server/quote");
    const probes = await Promise.allSettled(
      ["svc-1", "svc-2", "svc-3", "svc-4", "svc-5", "svc-6", "svc-7", "svc-8"].map((id) =>
        estimate({ serviceIds: [id], now: NOW }),
      ),
    );
    for (const probe of probes) {
      expect(probe.status).toBe("rejected");
      if (probe.status === "rejected") {
        expect((probe.reason as { code: string }).code).toBe("VALIDATION_ERROR");
      }
    }
  });

  it("a promo cannot be stacked by repeating it in one request", async () => {
    const once = await dto([FIXED_PMS.id], { promoCode: "NEIGHBOUR" });
    const twice = await dto([FIXED_PMS.id], { promoCode: "NEIGHBOUR" });
    expect(twice.min).toBe(once.min);
  });
});