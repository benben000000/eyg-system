import type { ReactElement } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Accordion";
import { JsonLd } from "@/components/ui/JsonLd";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/Button";
import { faqJsonLd } from "@/lib/seo";
import { HOMEPAGE_FAQS, type FaqEntry } from "./faqContent";

/**
 * FAQ. Radix Accordion (single-open, keyboard operable, `aria-expanded` and
 * `aria-controls` handled) plus the matching `FAQPage` JSON-LD.
 *
 * The `Suspense` boundary is there for the day the entries come from the
 * database — a server component reading a slow table can then stream in without
 * holding the page.
 */
export function Faq({ entries = HOMEPAGE_FAQS }: { entries?: ReadonlyArray<FaqEntry> }): ReactElement {
  return (
    <Section labelledBy="faq-title">
      <SectionHeading
        id="faq-title"
        eyebrow="Questions"
        title="Straight answers to the things people actually ask"
        description="If the answer you need is not here, call. We would rather answer it than have you guess."
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <Accordion type="single" collapsible className="w-full">
          {entries.map((entry, index) => (
            <AccordionItem key={entry.question} value={`faq-${index}`}>
              <AccordionTrigger>{entry.question}</AccordionTrigger>
              <AccordionContent>{entry.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <aside className="lg:pt-2">
          <div className="rounded-panel border border-ink-800 bg-ink-950 p-6 text-white">
            <h3 className="text-h3 font-extrabold">Still not sure?</h3>
            <p className="mt-2 text-ink-200">
              Phone is the fastest way to a straight answer. If you are on the road, message instead —
              we reply between jobs.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href="/book" variant="accent" size="md">
                Book a bay
              </LinkButton>
              <LinkButton href="/contact" variant="outline" size="md" className="border-white/40 text-white hover:border-white hover:bg-white/10">
                Contact us
              </LinkButton>
            </div>
          </div>
        </aside>
      </div>

      <JsonLd data={faqJsonLd([...entries])} id="ld-faq" />
    </Section>
  );
}
