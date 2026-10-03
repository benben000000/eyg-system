/**
 * HOMEPAGE FAQ — LOCAL CONTENT
 * ============================================================================
 * Named `faqContent.ts` (not `faq.ts`) on purpose: the component is
 * `Faq.tsx`, and Windows/case-insensitive module resolution cannot tell
 * `faq.ts` and `Faq.tsx` apart.
 *
 * SWAP POINT: `Faq` records also exist in the Prisma model (`prisma/schema.prisma`
 * → `model Faq`). When the backend publishes them, render those instead and keep
 * this list as the offline/DB-down fallback. The copy here is deliberately
 * conservative: it describes what the shop does and how booking works, and it
 * makes no claim that is not already in `src/config/site.ts`.
 *
 * Fed straight into `faqJsonLd()` from `@/lib/seo`.
 */

export interface FaqEntry {
  question: string;
  answer: string;
}

export const HOMEPAGE_FAQS: ReadonlyArray<FaqEntry> = [
  {
    question: "Do I need an appointment, or can I just drive in?",
    answer:
      "You can drive in during opening hours. Booking a bay online is faster though — it tells us what to prepare, so your car is not waiting on parts when you arrive.",
  },
  {
    question: "How much does a PMS cost?",
    answer:
      "It depends on your make, model and which package you need. The services page lists the range for each job. The fastest way to get your exact figure is the instant quote, or call the shop and we will price it while you are on the line.",
  },
  {
    question: "Can you fix a tire while I wait?",
    answer:
      "Punctures and tire changes are usually done while you wait. Tire rotation, balancing and vulcanizing take a little longer, but none of them need the car overnight.",
  },
  {
    question: "What payment do you accept?",
    answer:
      "Cash, GCash, Maya, credit or debit cards, and credit installment. You can settle the full amount before you pick up the car.",
  },
  {
    question: "Are you an authorised dealer for any tire brand?",
    answer:
      "We stock several brands, but we would rather tell you honestly what is on the shelf today than put a badge on this page we cannot stand behind. Ask us on the phone and we will tell you exactly which brands we can fit that day.",
  },
  {
    question: "Can you do wheel alignment and brakes in one visit?",
    answer:
      "Yes. When you book, list everything you need and we will schedule enough time in one bay visit rather than sending you home for a second trip.",
  },
  {
    question: "My car broke down on EGSA. Can you help?",
    answer:
      "Call us. The emergency bar at the top of this page goes straight to the shop, and a message on Messenger or WhatsApp reaches us too. Tell us your location and what happened and we will tell you straight away whether to come in or whether a tow is the safer option.",
  },
  {
    question: "Do you service SUVs, trucks and motorcycles?",
    answer:
      "Most cars and SUVs are routine for us. Tell us your make and model when you book — if a job is outside what we can do properly in our bay, we will say so and point you somewhere that can.",
  },
];
