import type { PackageDto, QuoteEstimateInput, ServiceDto } from "@/lib/types";

/**
 * INSTANT QUOTE — SERVER COMPONENT SHELL
 * ============================================================================
 * This file deliberately has NO `"use client"` directive, so it is a Server
 * Component. It renders the section chrome, the heading and the honest framing
 * copy on the server, then drops a single client island (`./InstantQuote`) into
 * it. Everything inside the island is interactive; nothing here is.
 *
 * WHY A SEPARATE FILE
 *  A file that starts with `"use client"` cannot also be a Server Component, so
 *  the shell has to live on its own. Pages should import THIS module, not the
 *  island, unless they specifically want the bare island.
 *
 * USAGE (from `src/app/**`, owned by frontend-pages)
 *   import { InstantQuoteSection } from "@/components/widgets";
 *   <InstantQuoteSection services={services} packages={packages} />
 *
 *  `services` and `packages` are optional. Omit them and the widget falls back
 *  to its own conservative list, where every unconfirmed price resolves to
 *  "confirmed on inspection" rather than a guess.
 * ============================================================================
 */
import InstantQuote from "@/components/widgets/InstantQuote";

export interface InstantQuoteSectionProps {
  services?: readonly ServiceDto[] | undefined;
  packages?: readonly PackageDto[] | undefined;
  initial?: Partial<QuoteEstimateInput> | undefined;
  heading?: string;
  description?: string;
  eyebrow?: string;
  className?: string;
  showCaptureForm?: boolean;
  headingId?: string;
  source?: string | undefined;
}

export default function InstantQuoteSection({
  services,
  packages,
  initial,
  heading = "Instant quote",
  description = "Pick what you need and see a range straight away. It is an estimate, not a fixed price — we confirm it before any work starts.",
  eyebrow = "Price it yourself",
  className,
  showCaptureForm = true,
  headingId = "instant-quote",
  source,
}: InstantQuoteSectionProps) {
  // `Date.now()` is read once here, on the server, and handed to the island so
  // the estimate expiry and "today" do not shift between the HTML and hydration.
  const serverNowMs = Date.now();

  return (
    <section className={className} aria-labelledby={headingId}>
      <div className="mb-5 flex flex-col gap-1">
        <p className="eyg-eyebrow text-muted-foreground">{eyebrow}</p>
        <h2 id={headingId} className="text-h2 text-foreground">
          {heading}
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <InstantQuote
        {...(services ? { services } : {})}
        {...(packages ? { packages } : {})}
        {...(initial ? { initial } : {})}
        {...(showCaptureForm !== undefined ? { showCaptureForm } : {})}
        {...(source ? { source } : {})}
        headingId={`${headingId}-widget`}
        serverNowMs={serverNowMs}
      />
    </section>
  );
}

export { InstantQuoteSection };