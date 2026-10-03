/**
 * EYG — SERVICES FAQ (schema + on-page list)
 * ============================================================================
 * The questions that actually decide whether someone books, written as a shop
 * owner would answer them at the counter. The same array feeds
 * `faqJsonLd()` in `src/app/services/page.tsx`, so the structured data can never
 * drift from the visible copy.
 *
 * The accordion is a native `<details>` per item: works with JavaScript off,
 * keyboard accessible for free, and the answer is in the DOM for crawls.
 * ============================================================================
 */

import { JsonLd } from "@/components/ui/JsonLd";
import { faqJsonLd } from "@/lib/seo";
import { Container, Eyebrow, Section } from "@/components/pages/_shims";
import { ChevronDown, HelpCircle } from "@/components/pages/_icons";

export const SERVICES_FAQS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "How do I know what my car actually needs?",
    answer:
      "You do not have to know, and you should not have to guess. Book the pre-trip check or a PMS and we go through it item by item — brakes, tyres, suspension, belts, fluids, battery — then hand you a written list sorted into three groups: do now, watch it, and nothing to worry about. A large part of that list is usually the third group, and we will tell you so.",
  },
  {
    question: "Is the price on this page the price I will pay?",
    answer:
      "It is an estimate, and we treat it as one. The figure you see is a range based on a typical vehicle in that category. The final price is confirmed with you after the technician inspects the car, before any work starts. Nothing is added to your bill that you have not agreed to on the spot.",
  },
  {
    question: "Do I have to bring the car in to get a price?",
    answer:
      "For most work, no. Send us a photo of the tyre sidewall or describe the noise and we will give you a range straight away. For anything where the answer depends on measurements — brake disc thickness, bushings, a leak — we would rather measure than guess.",
  },
  {
    question: "Can I book more than one service in one visit?",
    answer:
      "Yes, and it is cheaper for you in bay time. Add everything you need in the booking wizard and we will give you a single arrival time and a single estimate. You can also just describe the job when you get here — the point of booking ahead is to be less waiting, not more paperwork.",
  },
  {
    question: "What if I do not know my vehicle?",
    answer:
      "There is an escape hatch for exactly that on the booking page: choose 'I am not sure about my vehicle', describe the car in your own words, and pick a slot anyway. We will identify it from the plate, or from a photo of the registration, when you arrive.",
  },
  {
    question: "How long will I be waiting?",
    answer:
      "Longer than most people expect, if you turn up without booking. Booked jobs go into a reserved bay at your time. Walk-ins are fitted in between booked work, so you may wait — we will tell you honestly how long rather than quote you a time we cannot keep.",
  },
  {
    question: "Do you take tyres you bought elsewhere?",
    answer:
      "Yes. Fitting and balancing a customer-supplied tyre is normal work for us. What we cannot do is warrant a tyre we did not sell you, or guarantee its lifespan. Ask us to check it before fitting and we will tell you what we see.",
  },
  {
    question: "What payment do you accept?",
    answer:
      "Cash, GCash, Maya, credit and debit cards, and credit installment. We show the full accepted list on the contact page, and we will tell you before the work starts if an amount is above what you have with you.",
  },
];

export function ServicesFaq({ className }: { className?: string }): React.ReactElement {
  const headingId = "services-faq";
  return (
    <Section labelledBy={headingId} id="faq" className={className}>
      <JsonLd data={faqJsonLd(SERVICES_FAQS.map((f) => ({ ...f })))} id="ld-services-faq" />
      <Container>
        <div className="max-w-prose space-y-3">
          <Eyebrow>Questions we get asked</Eyebrow>
          <h2 id={headingId} className="text-h2">
            Straight answers before you book
          </h2>
        </div>

        <div className="mt-8 max-w-prose divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">
          {SERVICES_FAQS.map((faq) => (
            <details key={faq.question} className="group/faq">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 px-5 py-4 marker:content-none">
                <HelpCircle
                  aria-hidden="true"
                  className="size-5 shrink-0 text-brand-500"
                />
                <span className="flex-1 font-display text-base font-extrabold">
                  {faq.question}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 transition-transform group-open/faq:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <div className="px-5 pb-5 pl-14">
                <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
