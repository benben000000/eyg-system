/**
 * PROMO PRESENTATION HELPERS
 * ============================================================================
 * Next.js route modules may only export HTTP verbs and the route-segment config,
 * so the DTO types and the formatting/serialisation helpers live here instead of
 * in `route.ts`, which imports them.
 * ============================================================================
 */
import { PH_OFFSET_MINUTES } from "@/lib/server/time";
import { formatPeso } from "@/lib/utils";

export type PromoKind = "PERCENT_OFF" | "FIXED_OFF" | "BUNDLE" | "CLEARANCE" | "SEASONAL" | "TIRES";

export interface PromoDto {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  kind: PromoKind;
  badge: string | null;
  code: string | null;
  valuePct: number | null;
  valueOff: number | null;
  /** Human value for the headline, e.g. "15% off PMS". Never empty. */
  valueLabel: string;
  /**
   * MANDATORY. A discount is never handed out without its conditions. Sourced
   * from the DB `terms` array; an empty array renders as an explicit "Ask us"
   * line rather than silently disappearing.
   */
  terms: string[];
  imageUrl: string | null;
  isActive: boolean;
  /** ISO with `+08:00`, or `null` for an open-ended window. */
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  viewCount: number;
  claimCount: number;
  /** True only when active AND inside the window right now. */
  isLive: boolean;
  isUpcoming: boolean;
  isExpired: boolean;
  /** Days until `endsAt`; `null` when there is no end or it is not live. */
  daysRemaining: number | null;
}

export interface PromosDto {
  promos: PromoDto[];
  total: number;
  liveCount: number;
  timezone: "Asia/Manila";
  fetchedAt: string;
}

export interface PromoRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  kind: PromoKind;
  badge: string | null;
  code: string | null;
  valuePct: number | null;
  valueOff: number | null;
  terms: string[];
  imageUrl: string | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  viewCount: number;
  claimCount: number;
}

/** ISO with the real `+08:00` offset so a countdown never has to guess. */
export function isoPh(instant: Date | null): string | null {
  if (!instant) return null;
  const shifted = new Date(instant.getTime() + PH_OFFSET_MINUTES * 60_000);
  const p = (n: number): string => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
    `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}+08:00`
  );
}

/**
 * Headline value. Pure, and never returns an empty string — a promo with no
 * discount is a "bundle" or a "seasonal" and says so.
 */
export function promoValueLabel(row: Pick<PromoRow, "kind" | "valuePct" | "valueOff" | "title">): string {
  if (row.valuePct !== null && row.valuePct > 0) return `${row.valuePct}% off`;
  if (row.valueOff !== null && row.valueOff > 0) return `${formatPeso(row.valueOff)} off`;
  switch (row.kind) {
    case "BUNDLE":
      return "Bundle price";
    case "CLEARANCE":
      return "Clearance price";
    case "TIRES":
      return "Tyre pricing";
    case "SEASONAL":
      return "Seasonal offer";
    case "PERCENT_OFF":
    case "FIXED_OFF":
    default:
      return "Ask us for the price";
  }
}

/** Maps a row to the wire shape. `now` is injected so this is testable. */
export function buildPromoResponse(row: PromoRow, now: Date): PromoDto {
  const startsAt = row.startsAt ? row.startsAt.getTime() : null;
  const endsAt = row.endsAt ? row.endsAt.getTime() : null;
  const t = now.getTime();

  const started = startsAt === null || startsAt <= t;
  const notEnded = endsAt === null || endsAt >= t;
  const isLive = row.isActive && started && notEnded;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    kind: row.kind,
    badge: row.badge,
    code: row.code,
    valuePct: row.valuePct,
    valueOff: row.valueOff,
    valueLabel: promoValueLabel(row),
    // An empty terms array would let a client render a discount with no
    // conditions. Substitute an explicit line instead of an empty array.
    terms: row.terms.length > 0 ? row.terms : ["Ask us for the full terms before you book. Prices are confirmed after inspection."],
    imageUrl: row.imageUrl,
    isActive: row.isActive,
    startsAt: isoPh(row.startsAt),
    endsAt: isoPh(row.endsAt),
    priority: row.priority,
    viewCount: row.viewCount,
    claimCount: row.claimCount,
    isLive,
    isUpcoming: row.isActive && startsAt !== null && startsAt > t,
    isExpired: endsAt !== null && endsAt < t,
    daysRemaining: isLive && endsAt !== null ? Math.max(0, Math.ceil((endsAt - t) / 86_400_000)) : null,
  };
}
