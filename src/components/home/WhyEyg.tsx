import type { ReactElement } from "react";
import Link from "next/link";
import { Eye, Handshake, Sparkles, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BUSINESS } from "@/config/site";

interface Reason {
  icon: typeof Wrench;
  title: string;
  body: string;
}

/**
 * Why EYG.
 *
 * Every claim here is worded as the shop's *stated policy* or as a promise about
 * how the work is done — never as a verified number. The warranty period, the
 * brand authorisations and the customer count are all still `TODO-VERIFY`, so
 * they are not printed (see `src/components/layout/business.ts`).
 */
const REASONS: ReadonlyArray<Reason> = [
  {
    icon: Handshake,
    title: "The price range comes first",
    body: "You see what a job costs before the car goes on the lift, and we say so if it turns out to be different once we are under the hood. No surprise on the handover.",
  },
  {
    icon: Wrench,
    title: "We stand behind what we do",
    body: "Our policy is a guarantee on the workmanship in our bay. If something we did is not right, bring it back and we will fix it. Ask us for the exact terms when you book.",
  },
  {
    icon: Sparkles,
    title: "A clean bay, every time",
    body: "Tools back on the board, floor wiped, parts accounted for. A small shop has one reputation with the same families — it is not worth trading for a shortcut.",
  },
  {
    icon: Eye,
    title: "The honest recommendation",
    body: "If a part still has life in it, we tell you it still has life in it. We would rather do a brake pad now and see you again in six months than sell you a job you do not need.",
  },
];

export function WhyEyg(): ReactElement {
  return (
    <Section labelledBy="why-title">
      <SectionHeading
        id="why-title"
        eyebrow="Why EYG"
        title="A small shop that answers the phone"
        description={`${BUSINESS.legalName} is a local pit stop on the EGSA Fourlanes stretch in Tuyo — not a chain. Here is what that actually means when you hand over your keys.`}
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {REASONS.map((reason) => {
          const Icon = reason.icon;
          return (
            <li key={reason.title} className="h-full">
              <Card tone="surface" padding="lg" interactive className="flex h-full gap-4">
                <span
                  aria-hidden="true"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-eyebrow bg-brand-500 text-ink-950"
                >
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-h3 font-extrabold">{reason.title}</h3>
                  <p className="mt-2 text-muted-foreground">{reason.body}</p>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 max-w-prose text-sm text-muted-foreground">
        Want to see the bay before you commit?{" "}
        <Link
          href="/about"
          className="font-semibold text-foreground underline underline-offset-4 hover:text-brand-600"
        >
          Read about EYG
        </Link>{" "}
        or just look at{" "}
        <Link
          href="/gallery"
          className="font-semibold text-foreground underline underline-offset-4 hover:text-brand-600"
        >
          the before-and-after gallery
        </Link>
        .
      </p>
    </Section>
  );
}
