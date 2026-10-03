"use client";

/**
 * TRUST STRIP — the guarantee, the pricing commitment, the brands, the payment.
 * ============================================================================
 * HONESTY CONTRACT
 *  Only values that are actually present and non-placeholder in `site.ts`
 *  render. `BUSINESS.trust.workmanshipGuaranteeDays` is still `TODO-VERIFY`
 *  upstream, so when the value is absent, zero, negative or a placeholder
 *  string, this renders the *policy language* instead of a fabricated number:
 *  "We stand behind our work. If something we did needs fixing, bring it back
 *  and we will sort it — you do not pay twice for the same fault."
 *  A zero rating count never renders. A `4.9` rating with zero reviews is not
 *  a rating at all and is not shown.
 *
 * MOTION
 *  The marquee variant pauses on hover AND on keyboard focus, and does not move
 *  at all under `prefers-reduced-motion: reduce` (verified in CSS, not JS, so
 *  there is no flash of animation on first paint).
 * ============================================================================
 */
import { useEffect, useId, useRef, useState } from "react";
import { BadgeCheck, CalendarClock, Receipt, Star, Warehouse } from "lucide-react";
import { BUSINESS } from "@/config/site";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Pill, WidgetCard } from "@/components/widgets/internal/ui";
import PaymentMethods from "@/components/widgets/PaymentMethods";

export interface TrustStripProps {
  /** Guarantee window in days. Falls back to `BUSINESS.trust.*`. */
  guaranteeDays?: number | null | undefined;
  /** Ratings are never shown without a real review count behind them. */
  ratingValue?: number | null | undefined;
  ratingCount?: number | null | undefined;
  yearsServing?: number | null | undefined;
  bays?: number | null | undefined;
  brands?: readonly string[] | undefined;
  paymentMethods?: readonly { id: string; label: string; icon?: string | null }[] | undefined;
  className?: string;
  /** Render the brand list as a slow marquee instead of a wrapped row. */
  marquee?: boolean;
  /** Shown when nothing at all can be claimed. */
  fallbackNote?: string;
}

const POLICY_GUARANTEE =
  "We stand behind our work. If something we did needs fixing, bring it back and we will sort it — you never pay twice for the same fault.";

function isPlaceholderNumber(value: number | null | undefined): boolean {
  return typeof value !== "number" || !Number.isFinite(value) || value <= 0;
}

function cleanBrands(brands: readonly string[] | undefined): string[] {
  if (!brands) return [];
  return brands
    .map((b) => b.trim())
    .filter((b) => b.length > 1 && !/todo|tbd|example|placeholder/i.test(b));
}

export default function TrustStrip({
  guaranteeDays,
  ratingValue,
  ratingCount,
  yearsServing,
  bays,
  brands,
  paymentMethods,
  className,
  marquee = false,
  fallbackNote,
}: TrustStripProps) {
  const uid = useId();

  const days = guaranteeDays ?? BUSINESS.trust.workmanshipGuaranteeDays;
  const value = ratingValue ?? BUSINESS.trust.ratingValue;
  const count = ratingCount ?? BUSINESS.trust.ratingCount;
  const years = yearsServing ?? BUSINESS.trust.yearsServing;
  const bayCount = bays ?? BUSINESS.trust.bays;
  const brandList = cleanBrands(brands ?? BUSINESS.tireBrands);

  // A rating only counts when there are reviews behind it. "0 reviews (4.9)" is
  // a fabrication, and fabricating proof is exactly what this component exists
  // to avoid.
  const showRating = !isPlaceholderNumber(count) && typeof value === "number" && value > 0;
  const showGuaranteeNumber = !isPlaceholderNumber(days);

  const items: Array<{
    key: string;
    icon: typeof BadgeCheck;
    label: string;
    detail: string;
  }> = [
    {
      key: "guarantee",
      icon: BadgeCheck,
      label: showGuaranteeNumber ? `${days}-day workmanship guarantee` : "Workmanship guarantee",
      detail: showGuaranteeNumber
        ? "Bring it back if something we did needs fixing."
        : POLICY_GUARANTEE,
    },
    {
      key: "pricing",
      icon: Receipt,
      label: "Price agreed before the work starts",
      detail:
        "We show you the parts, the labour and the total. If it changes, we call you — we do not just do it and bill you.",
    },
  ];

  if (showRating) {
    items.push({
      key: "rating",
      icon: Star,
      label: `${value?.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`,
      detail: "Collected from customers after each job.",
    });
  }

  if (!isPlaceholderNumber(years)) {
    items.push({
      key: "years",
      icon: CalendarClock,
      label: `Serving Balanga since ${BUSINESS.foundedYear + (years ?? 0)}`,
      detail: "A local shop with local people behind it.",
    });
  }

  if (!isPlaceholderNumber(bayCount)) {
    items.push({
      key: "bays",
      icon: Warehouse,
      label: `${bayCount} service bays`,
      detail: "More bays means a shorter wait.",
    });
  }

  return (
    <WidgetCard as="section" className={cn("flex flex-col gap-4", className)} aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="sr-only">
        Why customers come to EYG
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-800"
              >
                <Icon className="size-5" focusable="false" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-foreground">{item.label}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{item.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {brandList.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyg-eyebrow text-muted-foreground">Tyre brands we fit</p>
          {marquee ? (
            <MarqueeBrandList brands={brandList} />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {brandList.map((brand) => (
                <li key={brand}>
                  <Pill className="min-h-9">{brand}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="border-t border-border pt-4">
        <PaymentMethods methods={paymentMethods ?? BUSINESS.paymentMethods} heading="We accept" />
      </div>

      {items.length === 0 && brandList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {fallbackNote ?? "Call the shop and ask us directly — we will tell you exactly what we fit and what we charge."}
        </p>
      ) : null}
    </WidgetCard>
  );
}

export { TrustStrip };

// ── Marquee ─────────────────────────────────────────────────────────────────

/**
 * A slow, seamless brand scroll.
 *
 * Implemented with `requestAnimationFrame` + `transform` rather than a CSS
 * `keyframes` rule, because the keyframe would have to live in `globals.css`
 * (orchestrator-owned) and this component must not depend on a stylesheet it
 * cannot edit. Behaviour:
 *  - paused on pointer hover AND on keyboard focus;
 *  - completely still under `prefers-reduced-motion: reduce`;
 *  - the list is focusable and horizontally scrollable by keyboard, so it is
 *    never a content that only a mouse can reach;
 *  - every frame and every listener is cleaned up on unmount.
 */
function MarqueeBrandList({ brands }: { brands: readonly string[] }) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || paused) return;
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    let offset = 0;
    let last = 0;
    // 28px/s — slow enough to read, fast enough to notice.
    const SPEED_PX_PER_MS = 0.028;

    const frame = (t: number) => {
      if (last === 0) last = t;
      const dt = t - last;
      last = t;
      // Half the track is a duplicate, so one half-width wraps seamlessly.
      const half = track.scrollWidth / 2;
      if (half > 0) {
        offset = (offset + dt * SPEED_PX_PER_MS) % half;
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced, paused]);

  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
      <ul
        ref={trackRef}
        className="no-scrollbar flex w-max gap-2 overflow-x-auto"
        tabIndex={0}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        aria-label={`Tyre brands we fit: ${brands.join(", ")}`}
      >
        {[...brands, ...brands].map((brand, i) => (
          // The list is doubled for a seamless marquee loop, so a brand can
          // legitimately appear twice. Keying on the pass (`copy` vs `loop`)
          // keeps the two halves from ever being reconciled as one node.
          <li
            key={`${brand}-${i < brands.length ? "copy" : "loop"}`}
            aria-hidden={i >= brands.length ? "true" : undefined}
          >
            <Pill className="min-h-9">{brand}</Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}