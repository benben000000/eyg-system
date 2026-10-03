/**
 * EYG — PROMOTION WINDOW ARITHMETIC
 * ============================================================================
 * ⚠️  This module is intentionally NOT `"use client"`.
 *
 * `PromoCountdown.tsx` is a Client Component, and anything imported from it
 * becomes a client reference. Calling such a function from a Server Component
 * throws at render time ("Attempted to call X() from the server but X is on the
 * client"), which silently drops the whole page out of SSR. The live / upcoming
 * / ended split on `/deals` is server-side logic, so it lives here.
 *
 * Every comparison is on absolute ISO instants that already carry an explicit
 * `+08:00`, so no timezone arithmetic is done by hand.
 * ============================================================================
 */

export type PromoWindow = "live" | "upcoming" | "ended";

function instant(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** True when the end instant is genuinely in the future. */
export function endsInFuture(endsAt: string | null, now: Date = new Date()): boolean {
  const end = instant(endsAt);
  return end !== null && end > now.getTime();
}

/** True when the start instant is genuinely in the future. */
export function startsInFuture(startsAt: string | null, now: Date = new Date()): boolean {
  const start = instant(startsAt);
  return start !== null && start > now.getTime();
}

/**
 * The single source of truth for "is this offer running right now".
 * A switched-off (`isActive: false`) promotion is `ended`, never `upcoming`.
 */
export function promoWindow(
  promo: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: Date = new Date(),
): PromoWindow {
  if (!promo.isActive) return "ended";
  const t = now.getTime();
  const start = instant(promo.startsAt);
  const end = instant(promo.endsAt);
  if (start !== null && t < start) return "upcoming";
  if (end !== null && t > end) return "ended";
  return "live";
}

/** Convenience: is this offer live right now? */
export function isLiveNow(
  promo: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: Date = new Date(),
): boolean {
  return promoWindow(promo, now) === "live";
}
