/**
 * EYG TIRE & AUTO CARE — MARKETING SEED: FAQ
 * ============================================================================
 * Consumed by `prisma/seed.ts` (backend agent).
 * Structurally mirrors `prisma/schema.prisma` → `model Faq`, and is safe to
 * serialise straight into `faqJsonLd()` from `@/lib/seo` (which only needs
 * `question` and `answer`).
 *
 * THE RULE THAT SHAPES EVERY ANSWER BELOW
 * ---------------------------------------
 * No answer contains a peso figure, a phone number, an opening hour, a warranty
 * length or a brand partnership that is not already sourced from
 * `src/config/site.ts`. Where the customer genuinely needs a number, the answer
 * routes them to a live source (the estimator, a call, the counter) instead of
 * hard-coding a figure that will be wrong in six months.
 *
 * This is not caution for its own sake. In this market a wrong number is not an
 * inconvenience, it is the thing that loses the customer and gets repeated on
 * Facebook. A range plus "after inspection" is honest *and* more persuasive
 * than a confident wrong number.
 *
 * ⚠️  Where an answer touches a value that `site.ts` still flags `TODO-VERIFY`
 *     (business hours, the 30-day workmanship guarantee), the inline comment
 *     says so. Confirm with the owner, then delete the flag.
 *
 * VOICE: warm, plain, competent, neighbourly. Short sentences. Answer the
 * question that was actually asked, then stop.
 * ============================================================================
 */

/** Mirror of `prisma/schema.prisma` → `model Faq` (create-input shape). */
export interface FaqSeed {
  question: string;
  /** Plain text. No HTML, no markdown, no line breaks. FAQ schema requires it. */
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export const FAQS: readonly FaqSeed[] = [
  // ── Trust & pricing (the two biggest objections in this market) ──────────
  {
    question: "How much will my service cost?",
    answer:
      "We give you a range before you come in, and a single confirmed price after we " +
      "look at the vehicle. Use the estimator on the Services page for a range, or send " +
      "us your make, model and year on Messenger and we will quote it. The price does " +
      "not change once the job is open without calling you first.",
    category: "trust",
    sortOrder: 10,
    isPublished: true,
  },
  {
    question: "Do I need to know what is wrong with my car?",
    answer:
      "No. That is our job, not yours. If you know the symptom, tell us — when it " +
      "started, what it sounds or feels like, and whether it happens when braking or " +
      "when turning. If you know nothing, just describe the noise and we will start " +
      "from there.",
    category: "trust",
    sortOrder: 20,
    isPublished: true,
  },
  {
    question: "Why do you ask for the make, model and year?",
    answer:
      "Because parts are not universal. The same service costs very different amounts " +
      "on a small hatchback and an SUV, and we would rather quote you honestly than " +
      "guess low and add later. The year matters most — brake and suspension parts " +
      "change between generations.",
    category: "trust",
    sortOrder: 30,
    isPublished: true,
  },
  {
    question: "Do you show me the old parts?",
    answer:
      "Yes. If we replace something, you get to see the old part before we dispose of " +
      "it. Not everyone wants it — some people do, and it should be your choice, not " +
      "ours.",
    category: "trust",
    sortOrder: 40,
    isPublished: true,
  },
  {
    question: "Can I watch while you work?",
    answer:
      "You are welcome to. Our bay is small, so we keep the number of people in it " +
      "low, but there is usually a spot where you can stand where you can see. Ask us " +
      "and we will tell you what works today.",
    category: "trust",
    sortOrder: 50,
    isPublished: true,
  },

  // ── Booking ──────────────────────────────────────────────────────────────
  {
    question: "How do I book a bay?",
    answer:
      "Book online on the Book page — pick the vehicle, the services, a time and your " +
      "contact details, and you will get a reference number and an SMS confirmation. " +
      "You can also call the shop or send a Messenger message and we will book it for " +
      "you. Walk-ins are welcome when there is a bay free.",
    category: "booking",
    sortOrder: 60,
    isPublished: true,
  },
  {
    question: "What does my confirmation number mean?",
    answer:
      "It is your reference. Quote it at the counter, over the phone, or on Messenger " +
      "and we will find your booking immediately instead of asking you to explain it " +
      "again. It also appears on your receipt.",
    category: "booking",
    sortOrder: 70,
    isPublished: true,
  },
  {
    question: "Can I change or cancel my booking?",
    answer:
      "Yes. Reply to the confirmation SMS, call the shop, or message us on Facebook " +
      "with your reference number. Cancellations more than a couple of hours ahead " +
      "are the easiest to rebook.",
    category: "booking",
    sortOrder: 80,
    isPublished: true,
  },
  {
    question: "How much notice do you need?",
    answer:
      "At least ninety minutes for a normal booking, because we hold a bay for you " +
      "rather than double-booking it. If you need to be in and out faster, call and " +
      "ask — we will always tell you honestly whether we can fit you in.",
    category: "booking",
    sortOrder: 90,
    isPublished: true,
  },
  {
    question: "Can I wait for the car or do you keep it?",
    answer:
      "Either. Most people wait — a tyre change, a PMS or a brake check is not a " +
      "long job. If you need to leave the car, tell us before you go and we will agree " +
      "the pickup time and the bill in advance so there is nothing to settle later.",
    category: "booking",
    sortOrder: 100,
    isPublished: true,
  },

  // ── Tyres ────────────────────────────────────────────────────────────────
  {
    question: "How do I read my tyre size?",
    answer:
      "Look at the sidewall of any tyre on your car. You will see something like " +
      "205/55 R16 95V. The first number, 205, is the width in millimetres. The second, " +
      "55, is the aspect ratio — the sidewall height as a percentage of the width. R16 " +
      "is the rim diameter in inches. Bring a photo of that text or just tell us your " +
      "make, model and year and we will look it up.",
    category: "tyres",
    sortOrder: 110,
    isPublished: true,
  },
  {
    question: "What tyre size do I need?",
    answer:
      "Send us your make, model and year and we will tell you the size and the load " +
      "and speed rating that came with the car. Fit a different size and you change " +
      "the speedometer reading and the handling, so we will not do it unless you ask " +
      "us to and we tell you what changes.",
    category: "tyres",
    sortOrder: 120,
    isPublished: true,
  },
  {
    question: "When should tyres be rotated?",
    answer:
      "Roughly every ten thousand kilometres, or every six months, whichever comes " +
      "first. Rotation evens out the wear so you do not end up replacing two tyres at " +
      "once. If your tyres are a one-directional pattern or a different size on each " +
      "axle, rotation may not be possible and we will tell you why.",
    category: "tyres",
    sortOrder: 130,
    isPublished: true,
  },
  {
    question: "How do I know when a tyre needs replacing?",
    answer:
      "Three things: the tread. If you look at the tread pattern and cannot see the " +
      "grooves clearly, it is worn. Then check the sidewall for cuts, bulges or scuffs " +
      "from kerbing. Finally, the date — tyres have a manufactured-in code on the " +
      "sidewall. Bring the car in and we will check all three properly, which is faster " +
      "than trying to read a sidewall in a dark carpark.",
    category: "tyres",
    sortOrder: 140,
    isPublished: true,
  },
  {
    question: "Do you vulcanize, or do you just replace?",
    answer:
      "Both, depending on where the damage is and how big it is. A puncture in the tread " +
      "area can often be vulcanized from the inside and will outlast a new tyre. Sidewall " +
      "damage, and damage close to the shoulder, cannot be safely repaired — those need a " +
      "new tyre. We will tell you which one you have before we start, every time.",
    category: "tyres",
    sortOrder: 150,
    isPublished: true,
  },
  {
    question: "How often should tyre pressure be checked?",
    answer:
      "At least monthly, and definitely before a long trip or before heavy rain. Check " +
      "the number on the driver's door jamb sticker, not the number printed on the tyre " +
      "itself — that one is a maximum, not a recommendation. Pressure drops with heat, so " +
      "check it when the tyres are cold. We will check and top up any car that drives in.",
    category: "tyres",
    sortOrder: 160,
    isPublished: true,
  },

  // ── Brakes & safety ──────────────────────────────────────────────────────
  {
    question: "My brakes are making a noise. Is it safe to drive?",
    answer:
      "Do not drive far. A squeal when you brake is usually the pads warning you they " +
      "are getting thin. A grinding sound can mean the pad is already gone and you are " +
      "now cutting metal on metal, which destroys the disc. In both cases, drive slowly " +
      "to the nearest shop and avoid hard braking. Call us first if you are not sure, " +
      "and we will tell you honestly whether to drive it in or leave it.",
    category: "safety",
    sortOrder: 170,
    isPublished: true,
  },
  {
    question: "Can you check my brakes without replacing them?",
    answer:
      "Yes, and we would rather do the check than the replacement. We measure the pad " +
      "thickness rather than guessing from the pedal feel, check the discs and the lines. " +
      "If there is life left in them, we will tell you and tell you how long you have.",
    category: "brakes",
    sortOrder: 180,
    isPublished: true,
  },
  {
    question: "What is undercoating and does my car need it?",
    answer:
      "Undercoating sprays a protective coating on the chassis and wheel arches, which " +
      "is where mud, salt, gravel and flood water attack the metal. On Bataan roads it " +
      "slows that down. It is not essential on a car that only drives on tarmac in " +
      "town — if your car is genuinely fine, we will tell you it is genuinely fine and " +
      "you can skip it.",
    category: "brakes",
    sortOrder: 190,
    isPublished: true,
  },
  {
    question: "My car is pulling to one side when I brake. Is that an alignment problem?",
    answer:
      "It could be. It is also a brake problem, and that is the more important thing " +
      "to rule out first, because a caliper sticking on one side will wear one pad and " +
      "one disc down fast. Bring it in and we will check the brakes before we touch the " +
      "alignment. Getting an alignment done on a dragging brake just wastes the money.",
    category: "brakes",
    sortOrder: 200,
    isPublished: true,
  },

  // ── Maintenance ──────────────────────────────────────────────────────────
  {
    question: "What is PMS A and how is it different from PMS B?",
    answer:
      "PMS A is the basic one: engine oil, a new oil filter, and a check of the usual " +
      "fluid levels and tyre pressure. PMS B goes further — oil and filter plus a fuller " +
      "multi-point inspection with the car on the lift, looking at the brakes, the " +
      "belts, the hoses and the underside. If you are not sure which you need, book the " +
      "inspection first and we will tell you which one your car actually needs.",
    category: "maintenance",
    sortOrder: 210,
    isPublished: true,
  },
  {
    question: "Do I have to use the oil brand you sell?",
    answer:
      "No. We will use any oil you bring, provided it is the right grade and viscosity " +
      "for your engine. If you would rather buy from us, we will tell you the grade your " +
      "car came with and what the alternatives are, and you can decide. We do not put " +
      "full synthetic in without asking.",
    category: "maintenance",
    sortOrder: 220,
    isPublished: true,
  },
  {
    question: "How often is a car aircon regas needed?",
    answer:
      "Only when it is losing cooling, because regas does not fix a leak. If the aircon " +
      "is not as cold as it used to be, we find the leak first and fix that, then regas " +
      "it. Regas without finding the leak just means you will be back in a few months.",
    category: "maintenance",
    sortOrder: 230,
    isPublished: true,
  },
  {
    question: "Do you do motorcycles?",
    answer:
      // ⚠️ TODO-VERIFY — answer must match what the bay actually handles.
      //     Default is an honest "ask us" until the owner confirms. Do NOT
      //     change this answer to "yes" without owner confirmation.
      "It depends on the size and type of the bike. Message us on Facebook with the " +
      "make and model, or call the shop, and we will tell you straight away whether we " +
      "can take it in or point you to someone who can.",
    category: "maintenance",
    sortOrder: 240,
    isPublished: true,
  },

  // ── Roadside ─────────────────────────────────────────────────────────────
  {
    question: "My tyre just went flat. What should I do first?",
    answer:
      "Do not brake hard. Ease off the gas, keep a steady hand on the wheel and pull " +
      "over as smoothly as you can. Turn on your hazard lights, put on your seatbelt, and " +
      "if you are on a busy road or a bridge, stay in the car with the belt on. Call us " +
      "and give us your location and your plate number so we can find you faster.",
    category: "roadside",
    sortOrder: 250,
    isPublished: true,
  },
  {
    question: "Do you do roadside assistance?",
    answer:
      // ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION: confirm the call-out
      //     area, call-out charge and hours before publishing. The pricing
      //     itself must come from the estimator or a call, never from here.
      "Yes, within our service area. Call the shop with your location, your plate number " +
      "and a description of the problem, and we will tell you straight away whether we " +
      "can reach you and roughly what the call-out costs before we set off.",
    category: "roadside",
    sortOrder: 260,
    isPublished: true,
  },
  {
    question: "What warning lights should make me stop the car?",
    answer:
      "Stop safely and switch off if the oil pressure light, the temperature light, the " +
      "brake system light, or the battery light comes on. Those four mean stop driving. " +
      "An engine check light or a tyre pressure light means get it looked at soon but " +
      "you can usually drive carefully to a shop. If you are not sure which light it is, " +
      "call and describe it — we would rather talk you through it than have you break " +
      "down on the Fourlanes.",
    category: "safety",
    sortOrder: 270,
    isPublished: true,
  },

  // ── Payment & shop ───────────────────────────────────────────────────────
  {
    question: "What payment do you accept?",
    answer:
      "Cash, GCash, Maya, credit and debit cards, and credit instalment for bigger " +
      "jobs. We do not add a fee for any of them. For instalment, we will need to see " +
      "an ID and the vehicle documents — ask us before you come in so you know what to " +
      "bring.",
    category: "payment",
    sortOrder: 280,
    isPublished: true,
  },
  {
    question: "Can I pay in instalments or do a down payment first?",
    answer:
      "Yes. We can start with a down payment and settle the rest on collection or over " +
      "an agreed schedule. Come to the counter, bring a valid ID and your vehicle " +
      "documents, and we will walk you through the options. We would rather agree the " +
      "schedule with you at the start than surprise you at handover.",
    category: "payment",
    sortOrder: 290,
    isPublished: true,
  },
  {
    question: "Do you give a warranty on the work?",
    answer:
      // ⚠️ TODO-VERIFY: `BUSINESS.trust.workmanshipGuaranteeDays` = 30 in
      //     src/config/site.ts and is still unconfirmed. The number is stated
      //     in ONE place (site.ts) — do not hardcode a different figure here,
      //     and do not publish until the owner confirms it.
      "Yes. Our workmanship guarantee covers the work we did for thirty days. If " +
      "something we adjusted or fitted starts giving you trouble in that period, come " +
      "back and we will look at it. It covers our work, not the parts themselves — each " +
      "part's own warranty, if it has one, is on your invoice.",
    category: "trust",
    sortOrder: 300,
    isPublished: true,
  },
  {
    question: "Where exactly are you?",
    answer:
      "We are along EGSA Fourlanes in Tuyo, Balanga City, Bataan, easy to see from the " +
      "main road. The Contact page has the map, a directions link and the nearest " +
      "landmark. If you are coming from Manila or from the toll, the Fourlanes exit is " +
      "the one to take — message us before you leave and we will tell you which way is " +
      "faster at that hour.",
    category: "shop",
    sortOrder: 310,
    isPublished: true,
  },
  {
    question: "Are you open on Sundays?",
    // ⚠️ TODO-VERIFY: answer tracks `BUSINESS_HOURS` in src/config/site.ts
    //     (Mon–Sat, Sunday closed). Hours were not confirmed from the official
    //     Facebook page. If the shop's real hours differ, fix site.ts and the
    //     Contact page — never edit only this answer.
    answer:
      "We are open Monday to Saturday, 8 AM to 5 PM, and closed on Sundays. The " +
      "Contact page always shows the live hours, including any closure for a holiday, so " +
      "check there before setting out if it matters.",
    category: "shop",
    sortOrder: 320,
    isPublished: true,
  },
  {
    question: "Can I leave my car overnight?",
    // ⚠️ TODO-VERIFY — only publish once the owner confirms this is possible and
    //     on what terms. If not possible, delete this entry rather than soften it.
    answer:
      "Ask us first — it depends on the job and whether a bay is free. We will agree " +
      "the pickup time and the payment arrangement before you leave, so there is nothing " +
      "to settle when you come back.",
    category: "shop",
    sortOrder: 330,
    isPublished: true,
  },
  {
    question: "Do you speak Tagalog, or English only?",
    answer:
      "Taglish, and Tagalog. Ask your question the way it comes out — English, Tagalog " +
      "or a mix. If a word for the problem does not exist, just describe the noise or " +
      "the feeling and we will figure out the rest.",
    category: "shop",
    sortOrder: 340,
    isPublished: true,
  },
  {
    question: "How do I leave a review?",
    answer:
      "Find us on Google Maps, tap Write a review, and write whatever you actually " +
      "experienced. Good or bad — we would rather have an honest one than a fast one, " +
      "and we reply to all of them. If something went wrong, tell us first so we can fix " +
      "it, and the review after that is up to you.",
    category: "trust",
    sortOrder: 350,
    isPublished: true,
  },
] as const;

/** JSON-LD-ready shape for `faqJsonLd()`. Drop-in, no mapping needed. */
export const FAQ_SCHEMA: ReadonlyArray<{ question: string; answer: string }> = FAQS.map((f) => ({
  question: f.question,
  answer: f.answer,
}));

/** Grouped for the `/` FAQ accordion and the `/contact` sidebar. */
export const FAQS_BY_CATEGORY: Readonly<Record<string, readonly FaqSeed[]>> = FAQS.reduce<
  Record<string, FaqSeed[]>
>((acc, f) => {
  const key = f.category ?? "general";
  (acc[key] ??= []).push(f);
  return acc;
}, {});