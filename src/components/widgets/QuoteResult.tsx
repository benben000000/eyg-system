"use client";

/**
 * QUOTE RESULT — the live estimate, rendered honestly.
 * ============================================================================
 * THE HARD REQUIREMENT
 *  A number is only presented as a price when the shop would honour it. So:
 *  - When `isApproximate` is true, the range is labelled as an estimate and the
 *    `disclaimer` is rendered VERBATIM. Not paraphrased, not shortened.
 *  - Every `isVariable` line carries its `variableNote` verbatim.
 *  - Any line with no confirmed price shows "Price confirmed on inspection"
 *    rather than a guessed figure.
 *  - The CTA deep-links into `/book` with the whole selection preserved in
 *    search params, so the customer never re-types anything.
 *
 * DEEP-LINK PARAM NAMES (published contract, also in `internal/quote-engine.ts`)
 *   /book?service=<id,id>&package=<id>&promo=<CODE>&engine=<engine>
 *         &tyres=<n>&size=<size>&year=<y>&make=<m>&model=<mo>&variant=<v>&step=<n>
 * ============================================================================
 */
import { forwardRef } from "react";
import { ArrowRight, Info, MessageCircle, Phone, TriangleAlert } from "lucide-react";
import type { QuoteEstimateDto, QuoteEstimateInput, QuoteRequestDto } from "@/lib/types";
import { BUSINESS, LINKS } from "@/config/site";
import { formatPeso, formatPesoRange } from "@/lib/utils";
import { LOCAL_ESTIMATE_NOTE, ON_SITE_LABEL } from "@/components/widgets/internal/catalogue";
import { buildBookHref } from "@/components/widgets/internal/quote-engine";
import { events } from "@/lib/hooks";
import { Pill, Skeleton, WidgetCard } from "@/components/widgets/internal/ui";

export interface QuoteResultProps {
  estimate: QuoteEstimateDto;
  /** The selection the estimate was computed from. Used to build the CTA link. */
  input: QuoteEstimateInput;
  /**
   * `false` when the estimate was computed on the customer's device because the
   * API was unreachable. The number stays on screen, but it is labelled as an
   * on-site estimate and the call/WhatsApp path is offered instead of a form.
   */
  isLocalEstimate?: boolean;
  /** Shown before the first compute lands. */
  loading?: boolean;
  /** Set when the "text me this estimate" capture succeeded. */
  reference?: QuoteRequestDto | null;
  className?: string;
  headingId?: string;
  /** Override the CTA href. Defaults to the deep-linked `/book?...` URL. */
  ctaHref?: string;
  ctaLabel?: string;
}

const QuoteResult = forwardRef<HTMLDivElement, QuoteResultProps>(function QuoteResult(
  {
    estimate,
    input,
    isLocalEstimate = false,
    loading = false,
    reference = null,
    className,
    headingId,
    ctaHref,
    ctaLabel,
  },
  ref,
) {
  const href = ctaHref ?? buildBookHref(input);
  const spreadPct =
    estimate.min > 0
      ? Math.round(((estimate.max - estimate.min) / estimate.min) * 100)
      : 0;

  return (
    <div ref={ref} className={className}>
      <WidgetCard
        as="section"
        className="flex flex-col gap-4 border-brand-300"
        aria-labelledby={headingId}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 id={headingId} className="text-h3 text-foreground">
              {isLocalEstimate ? ON_SITE_LABEL : "Your estimate"}
            </h3>
            {isLocalEstimate ? (
              <Pill tone="warning">Calculated on this device</Pill>
            ) : estimate.isApproximate ? (
              <Pill tone="warning">Indicative range</Pill>
            ) : (
              <Pill tone="success">Fixed price</Pill>
            )}
          </div>

          <div className="flex flex-col items-end">
            {loading ? (
              <Skeleton className="h-9 w-36" />
            ) : (
              <span
                data-testid="quote-total"
                className="tabular font-display text-3xl font-extrabold tracking-tight text-foreground"
              >
                {formatPesoRange(estimate.min, estimate.max)}
              </span>
            )}
            {estimate.min > 0 && estimate.max > estimate.min && !loading ? (
              <span className="text-xs text-muted-foreground">
                A spread of about {spreadPct}% — the exact figure depends on your car.
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Line items, with per-line honesty ─────────────────────────── */}
        {estimate.lineItems.length > 0 ? (
          <ul className="flex flex-col gap-2 border-t border-border pt-3">
            {estimate.lineItems.map((line) => {
              const lineTotalMin = line.min * line.quantity;
              const lineTotalMax = line.max * line.quantity;
              return (
                <li key={line.id} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">
                      {line.name}
                      {line.quantity > 1 ? (
                        <span className="ml-1 text-xs font-medium text-muted-foreground">
                          × {line.quantity}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular shrink-0 text-sm font-bold text-foreground">
                      {formatPesoRange(lineTotalMin, lineTotalMax)}
                    </span>
                  </div>
                  {line.isVariable ? (
                    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                      <TriangleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-3 shrink-0"
                        focusable="false"
                      />
                      <span>
                        <span className="font-bold">Varies.</span>{" "}
                        {line.variableNote ??
                          "We check the parts your car actually needs before we quote a firm price."}
                      </span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            Pick at least one service and the range updates as you choose.
          </p>
        )}

        {estimate.savings ? (
          <p className="flex flex-wrap items-baseline gap-2 rounded-card border border-pit-300 bg-pit-50 p-2.5 text-sm">
            <span className="font-bold text-pit-900">
              You save about {formatPeso(estimate.savings.amount)}
            </span>
            <span className="tabular text-xs text-pit-800">
              off {formatPeso(estimate.savings.compareAt)} with the promo applied.
            </span>
          </p>
        ) : null}

        {/* ── The disclaimer, verbatim ──────────────────────────────────── */}
        <p className="flex items-start gap-2 rounded-card border border-border-strong bg-surface-muted p-3 text-xs leading-relaxed text-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" focusable="false" />
          <span>{estimate.disclaimer}</span>
        </p>

        {isLocalEstimate ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {LOCAL_ESTIMATE_NOTE}{" "}
            <a href={LINKS.call} onClick={() => events.call("instant-quote-local")} className="font-semibold underline underline-offset-4">
              Call {BUSINESS.phoneDisplay}
            </a>{" "}
            for the exact figure, or{" "}
            <a href={LINKS.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => events.whatsapp("instant-quote-local")} className="font-semibold underline underline-offset-4">
              message us on WhatsApp
            </a>
            .
          </p>
        ) : null}

        {/* ── Success: the reference ────────────────────────────────────── */}
        {reference ? (
          <div className="rounded-card border border-pit-300 bg-pit-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-pit-900">
              <MessageCircle aria-hidden="true" className="size-4" focusable="false" />
              We will text you this estimate.
            </p>
            <p className="mt-1 text-sm text-pit-900">
              Your reference is{" "}
              <span className="tabular font-extrabold">{reference.reference}</span> — quote it if you
              call the shop. The range above is {formatPesoRange(reference.estimateMin, reference.estimateMax)}.
            </p>
          </div>
        ) : null}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <a
            href={href}
            onClick={() => events.bookingStarted("instant-quote")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-card bg-brand-500 px-4 py-2 text-sm font-bold text-accent-foreground shadow-cta hover:bg-brand-400"
          >
            {ctaLabel ?? estimate.nextStep.label}
            <ArrowRight aria-hidden="true" className="size-4" focusable="false" />
          </a>

          {/* The human path is always available, on every state. */}
          <a
            href={LINKS.call}
            onClick={() => events.call("instant-quote")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-card border border-border-strong bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
          >
            <Phone aria-hidden="true" className="size-4" focusable="false" />
            Call for the exact price
          </a>
          <a
            href={LINKS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => events.whatsapp("instant-quote")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-card border border-border-strong bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
          >
            <MessageCircle aria-hidden="true" className="size-4" focusable="false" />
            WhatsApp us
          </a>
        </div>

        {!isLocalEstimate && !reference ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Prefer to have it texted to you? {BUSINESS.phoneDisplay} is the fastest way to reach a
            person — no form, no waiting.
          </p>
        ) : null}
      </WidgetCard>
    </div>
  );
});

export { QuoteResult };
export default QuoteResult;