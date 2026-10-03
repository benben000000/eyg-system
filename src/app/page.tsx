import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getOpenStatus } from "@/components/layout/hours";
import { EmergencyBanner } from "@/components/layout/EmergencyBanner";
import { pageSeo } from "@/lib/seo";
import { Hero } from "@/components/home/Hero";
import { ServiceMenu } from "@/components/home/ServiceMenu";
import { QuoteTeaser } from "@/components/home/QuoteTeaser";
import { SocialProof } from "@/components/home/SocialProof";
import { WhyEyg } from "@/components/home/WhyEyg";
import { LocationHours } from "@/components/home/LocationHours";
import { Faq } from "@/components/home/Faq";
import { ClosingCta } from "@/components/home/ClosingCta";

export const metadata: Metadata = pageSeo({
  title: "Tire Shop & Auto Care in Balanga City, Bataan — Book a Service Bay | EYG Tire & Auto Care",
  description:
    "Tire change, PMS, wheel alignment, brakes, undercoating and car aircon at EYG Tire & Auto Care on EGSA Fourlanes, Tuyo, Balanga City. Book a service bay online, get an instant quote, or call the shop.",
  path: "/",
  keywords: [
    "tire shop Tuyo",
    "auto care Balanga City",
    "PMS Balanga price",
    "wheel alignment Tuyo",
    "vulcanizing Balanga",
    "undercoating Bataan",
    "car aircon Balanga",
    "EGSA Fourlanes tire shop",
  ],
});

/**
 * The homepage — the single highest-traffic page in the site.
 *
 * Server Component. The only client code is the emergency banner's dismiss
 * button, the open/closed pills, the marquee and the two action bars, all of
 * which live in the shell or in small isolated leaves.
 *
 * Section order, and why each one earns its place:
 *  1. Hero             — names the job and the place, offers book / quote / call.
 *  2. Emergency band   — LANE A, for the person who is already stranded.
 *  3. Service menu     — LANE B, "which job do I need?"
 *  4. Instant quote    — LANE B, "what will it cost?"
 *  5. Social proof     — "can I trust them?"
 *  6. Why EYG          — the shop's stated policies.
 *  7. Location & hours — "can I get there, are they open?"
 *  8. FAQ              — the last objections, answered.
 *  9. Closing CTA      — book or call, one last time.
 */
export default function HomePage(): ReactElement {
  const status = getOpenStatus(new Date());

  return (
    <>
      <Hero status={status} />
      <EmergencyBanner dismissible />
      <ServiceMenu />
      <QuoteTeaser />
      <SocialProof />
      <WhyEyg />
      <LocationHours status={status} />
      <Faq />
      <ClosingCta />
    </>
  );
}
