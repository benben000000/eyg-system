/**
 * LOCAL ESTIMATE ENGINE — the honest fallback.
 * ============================================================================
 * Runs entirely on the customer's device from the same `ServiceDto` /
 * `PackageDto` price data the server would use. It exists for one reason: when
 * `POST /api/quote` is unreachable, a visitor must still get a useful number and
 * a next action, not a broken form.
 *
 * HONESTY RULES BAKED IN
 *  - The output is a `QuoteEstimateDto`, so every downstream renderer already
 *    knows how to show `isApproximate`, the `disclaimer` and per-line
 *    `variableNote`s. Nothing is special-cased away.
 *  - A `CALL_FOR_PRICE` service widens the spread and sets `isVariable`, so a
 *    guess is never presented as a price.
 *  - `expiresAt` is a real, non-resetting instant: the estimate is good until
 *    the shop confirms it, which is what the disclaimer says.
 *  - `nextStep` always points at a human path (`/book`) — never a fake checkout.
 * ============================================================================
 */
import type { PackageDto, QuoteEstimateDto, QuoteEstimateInput, ServiceDto } from "@/lib/types";
import {
  ESTIMATE_DISCLAIMER,
  indexCatalogue,
  isWideSpread,
  priceBand,
  type WidgetCatalogue,
} from "@/components/widgets/internal/catalogue";

export interface EngineOptions {
  catalogue: WidgetCatalogue;
  /** Absolute "now". Injected so the value is testable and never lies. */
  nowMs?: number;
  /** Absolute expiry. Defaults to 48h from `nowMs`. */
  expiresAtMs?: number;
  /** Rendered into `nextStep`. */
  nextStep?: { label: string; href: string };
  /** Extra copy appended after the disclaimer (e.g. the local-mode note). */
  disclaimerSuffix?: string;
}

const DEFAULT_EXPIRY_MS = 48 * 60 * 60 * 1000;

/** Extra engine-level spread applied when the engine type is unknown. */
const UNKNOWN_ENGINE_SPREAD = 0.12;
const HYBRID_SPREAD = 0.1;
const ELECTRIC_NOTE = "Electric vehicles use different fluids and filters — we confirm the correct ones for your model.";
const DIESEL_NOTE = "Diesel engines take larger filters and can need a fuel-system check.";

function roundToPeso(value: number): number {
  return Math.max(0, Math.round(value / 10) * 10);
}

/**
 * Computes an estimate from the local catalogue. Pure — same input, same output,
 * no clock reads unless `nowMs` is omitted.
 */
export function computeLocalEstimate(
  input: QuoteEstimateInput,
  options: EngineOptions,
): QuoteEstimateDto {
  const nowMs = options.nowMs ?? Date.now();
  const { byId, byPackageId } = indexCatalogue(options.catalogue);

  const lineItems: QuoteEstimateDto["lineItems"] = [];
  let anyVariable = false;

  // ── Package, if one is selected ──────────────────────────────────────────
  const pkg: PackageDto | undefined = input.packageId
    ? byPackageId.get(input.packageId)
    : undefined;

  const chosenServices: ServiceDto[] = [];
  for (const id of input.serviceIds) {
    const service = byId.get(id);
    if (service) chosenServices.push(service);
  }

  if (pkg && chosenServices.length === 0) {
    lineItems.push({
      id: pkg.id,
      name: pkg.name,
      quantity: 1,
      min: pkg.priceMin > 0 ? pkg.priceMin : 0,
      max: pkg.priceMax ?? Math.max(pkg.priceMin, 0),
      isVariable: pkg.priceMax === null || pkg.priceMax > pkg.priceMin,
      variableNote:
        pkg.priceMax === null || pkg.priceMax > pkg.priceMin
          ? `${pkg.tagline} Final price confirmed after we check the vehicle.`
          : undefined,
    });
  }

  for (const service of chosenServices) {
    const band = priceBand(service);
    if (band.isVariable) anyVariable = true;
    lineItems.push({
      id: service.id,
      name: service.name,
      quantity: 1,
      min: band.min,
      max: band.max,
      isVariable: band.isVariable,
      variableNote: band.variableNote,
    });
  }

  // ── Tyres ────────────────────────────────────────────────────────────────
  const tyreCount = clampInt(input.tyreCount ?? 0, 0, 8);
  if (tyreCount > 0) {
    anyVariable = true;
    const size = input.tyreSize?.trim();
    const per = 4_200;
    lineItems.push({
      id: "tyres",
      name: `Tyres${size ? ` · ${size}` : ""}`,
      quantity: tyreCount,
      min: roundToPeso(per * 0.8 * tyreCount),
      max: roundToPeso(per * 1.8 * tyreCount),
      isVariable: true,
      variableNote: size
        ? `Tyre price moves with the brand and the size (${size}). We confirm the price for the brand you pick before fitting anything.`
        : "Tell us the size on your sidewall (e.g. 205/55 R16) and we will price the exact brand. Tyre prices move week to week.",
    });
  }

  // ── Engine-driven spread, applied only when the total is known ───────────
  let min = lineItems.reduce((sum, l) => sum + l.min * l.quantity, 0);
  let max = lineItems.reduce((sum, l) => sum + l.max * l.quantity, 0);

  if (lineItems.length > 0) {
    const spread = engineSpread(input.engine);
    if (spread > 0) {
      max = roundToPeso(max * (1 + spread));
    }
  }

  // ── Promo ────────────────────────────────────────────────────────────────
  let savings: QuoteEstimateDto["savings"];
  const promo = input.promoCode?.trim().toUpperCase();
  if (promo && max > 0) {
    const cut = promoDiscount(promo, max);
    if (cut > 0) {
      savings = { amount: cut, compareAt: max };
      max = max - cut;
    }
  }

  // Engine honesty: widen further if we genuinely do not know the vehicle.
  if (input.engine === "unknown" && max > 0) {
    max = roundToPeso(max * (1 + UNKNOWN_ENGINE_SPREAD));
  }

  min = roundToPeso(min);
  max = Math.max(min, roundToPeso(max));

  // "Approximate" describes the honesty of a NUMBER. With nothing selected there
  // is no number, so there is nothing to hedge — flagging it would be noise.
  const isApproximate =
    lineItems.length > 0 && (anyVariable || isWideSpread(min, max) || input.engine === "unknown");
  const disclaimer = [ESTIMATE_DISCLAIMER, options.disclaimerSuffix, engineNote(input.engine)]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join(" ");

  const nextStep =
    options.nextStep ??
    ({ label: "Pick a date and time", href: buildBookHref(input) } satisfies {
      label: string;
      href: string;
    });

  return {
    min,
    max,
    currency: "PHP",
    isApproximate,
    lineItems,
    ...(savings ? { savings } : {}),
    expiresAt: new Date(options.expiresAtMs ?? nowMs + DEFAULT_EXPIRY_MS).toISOString(),
    disclaimer,
    nextStep,
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function engineSpread(engine: QuoteEstimateInput["engine"]): number {
  switch (engine) {
    case "hybrid":
      return HYBRID_SPREAD;
    case "electric":
    case "diesel":
      return 0.08;
    case "gasoline":
      return 0;
    case "unknown":
    default:
      return 0;
  }
}

function engineNote(engine: QuoteEstimateInput["engine"]): string | null {
  if (engine === "electric") return ELECTRIC_NOTE;
  if (engine === "diesel") return DIESEL_NOTE;
  return null;
}

/**
 * Only codes that exist in `src/content/marketing/promotions.ts` are honoured.
 * Any other code is ignored — we never invent a discount the shop did not run.
 */
function promoDiscount(code: string, gross: number): number {
  const KNOWN: Record<string, (g: number) => number> = {
    FIRSTPMS: (g) => g * 0.15,
    BDAYEYG: (g) => g * 0.12,
    NEIGHBOUR: (g) => (g >= 1500 ? 300 : 0),
    MYCHECK: () => 300,
    TIRESAVE: (g) => g * 0.1,
  };
  const fn = KNOWN[code];
  if (!fn) return 0;
  return Math.min(gross, Math.max(0, Math.round(fn(gross) / 10) * 10));
}

export const KNOWN_PROMO_CODES: readonly string[] = Object.freeze([
  "FIRSTPMS",
  "BDAYEYG",
  "NEIGHBOUR",
  "MYCHECK",
  "TIRESAVE",
  "RAINYSAFE",
]);

// ── Deep-link contract ──────────────────────────────────────────────────────

/**
 * ============================================================================
 * DEEP-LINK SEARCH PARAMS  (published contract — pages agent must match these)
 * ============================================================================
 *   /book?service=<serviceId>&service=<serviceId>   repeatable, comma-joined
 *   /book?package=<packageId>
 *   /book?promo=<PROMOCODE>
 *   /book?engine=<gasoline|diesel|hybrid|electric|unknown>
 *   /book?tyres=<count>
 *   /book?size=<tyreSize>          (URL-encoded, e.g. 205%2F55%20R16)
 *   /book?year=<4-digit year>&make=<make>&model=<model>&variant=<variant>
 *   /book?step=<1|2|3|4>           (1=vehicle 2=services 3=slot 4=contact)
 *
 * `service` is emitted as a single comma-separated value so the URL stays
 * readable; the booking parser splits on ",". Empty selections are omitted
 * entirely — no `service=` with nothing after it.
 * ============================================================================
 */
export const BOOK_PARAM = {
  services: "service",
  package: "package",
  promo: "promo",
  engine: "engine",
  tyres: "tyres",
  size: "size",
  year: "year",
  make: "make",
  model: "model",
  variant: "variant",
  step: "step",
} as const;

/** Builds the `/book` URL that preserves an estimator selection exactly. */
export function buildBookHref(input: QuoteEstimateInput, step?: number): string {
  const params = new URLSearchParams();
  if (input.serviceIds.length > 0) params.set(BOOK_PARAM.services, input.serviceIds.join(","));
  if (input.packageId) params.set(BOOK_PARAM.package, input.packageId);
  if (input.promoCode?.trim()) params.set(BOOK_PARAM.promo, input.promoCode.trim().toUpperCase());
  if (input.engine) params.set(BOOK_PARAM.engine, input.engine);
  if (input.tyreCount && input.tyreCount > 0) params.set(BOOK_PARAM.tyres, String(input.tyreCount));
  if (input.tyreSize?.trim()) params.set(BOOK_PARAM.size, input.tyreSize.trim());
  if (input.vehicleYear) params.set(BOOK_PARAM.year, String(input.vehicleYear));
  if (input.vehicleMake?.trim()) params.set(BOOK_PARAM.make, input.vehicleMake.trim());
  if (input.vehicleModel?.trim()) params.set(BOOK_PARAM.model, input.vehicleModel.trim());
  const stepValue = step ?? (input.serviceIds.length > 0 || input.packageId ? 3 : 2);
  params.set(BOOK_PARAM.step, String(stepValue));
  return `/book?${params.toString()}`;
}

/** Parses `?service=a,b` back into an array, dropping blanks. */
export function parseServiceParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}