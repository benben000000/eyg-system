/**
 * EYG TIRE & AUTO CARE — MARKETING SEED: FACEBOOK CONTENT BANK (30 POSTS)
 * ============================================================================
 * Written for the shop's own voice, for a page with 308 followers in Balanga
 * City. Consumed by the owner (or whoever runs the page) — and available to the
 * site as `/deals` or a `/blog` teaser if that is wanted.
 *
 * ############################################################################
 * # THE THING THAT ACTUALLY MATTERS ABOUT THIS FILE                        #
 * ############################################################################
 *
 * A small shop in Balanga does not win on scale. It wins because Facebook is
 * the place people ask a price before they drive over, and because the people
 * who post the video are the same people who will be on the lift. So the bank
 * below is weighted the way this market actually behaves:
 *
 *   • EDUCATIONAL (10) — the highest-intent content on the platform. Nobody
 *     shares a discount. Everybody screenshots a tip that tells them why their
 *     tyre is wearing on one side.
 *   • TRUST (8) — the bay, the process, the faces. This is the anti-overcharge
 *     medicine: you cannot argue with a photo of the actual bay.
 *   • OFFER (6) — tied 1:1 to `./promotions`. Six posts, six live campaigns.
 *   • COMMUNITY (6) — Bataan rain, EGSA traffic, holiday travel. This is what
 *     stops the page looking like a catalogue and starts it looking local.
 *
 * THE FOUR BANNED MOVES (see docs/marketing/PROMO-PLAYBOOK.md §8)
 *   1. No fabricated customer stories. Not one post below invents a customer.
 *   2. No invented urgency. No "last slots", no "ending tonight" unless the date
 *      is real, no countdown that resets. A countdown that resets is a lie and
 *      it is the single fastest way to lose a local audience.
 *   3. No fake statistics. No "500+ customers", no "10 years experience".
 *   4. No stock photos presented as our work. Every shot list below is of the
 *      actual shop. If we do not have the photo, we do not post the post.
 *
 * `dayOffset` IS NOT A PUBLISH DATE
 * ----------------------------------
 * It is the position in the bank (0–29). Posting 30 days straight is how a
 * three-person shop burns out in three weeks and then goes quiet for a year.
 * `docs/marketing/CONTENT-CALENDAR.md` maps this bank onto a 90-day calendar at
 * a sustainable cadence (roughly 6 posts a week), and this file is the reserve
 * that fills the gaps when a customer walk-in makes a better post than a
 * scheduled one.
 *
 * VOICE: warm, plain, competent, neighbourly. Short sentences. No hype.
 * Occasionally one natural Tagalog word where a local would actually use it.
 * ============================================================================
 */

import type { PromoKind } from "./promotions";

export const SOCIAL_PILLARS = ["educational", "trust", "offer", "community"] as const;
export type SocialPillar = (typeof SOCIAL_PILLARS)[number];

export const SOCIAL_FORMATS = ["photo", "reel", "carousel", "text-only"] as const;
export type SocialFormat = (typeof SOCIAL_FORMATS)[number];

export type SocialSeason =
  | "rainy"
  | "summer"
  | "holiday"
  | "toll-days"
  | "summer-holidays"
  | "year-end"
  | "none";

export interface SocialPost {
  /** Position in the bank, 0–29. NOT a publish date — see the header note. */
  dayOffset: number;
  pillar: SocialPillar;
  format: SocialFormat;
  /** The scroll-stopper. This is line 1 of `body` — kept separate so the owner
   *  can rewrite the hook without touching the rest of the copy.
   *  INVARIANT: `body.startsWith(hook)` must hold for every post. QA checks it. */
  hook: string;
  /** Full post copy. Starts with `hook`. Line breaks are intentional. */
  body: string;
  /** Filipino + English mix. 4–6 is the ceiling — more reads as spam here. */
  hashtags: readonly string[];
  /** Exactly ONE action. Two CTAs means nobody does either. */
  cta: string;
  /** Set when the post is tied to a campaign in `./promotions`. */
  promoSlug?: string;
  /** Seasonality tag, used to schedule this post in the right window. */
  season: SocialSeason;
  /** What to actually film or photograph. Our shop, our people, our bay. */
  shotList: readonly string[];
  /** Owner-facing production note. Never published. */
  note: string;
}

export const SOCIAL_POSTS: readonly SocialPost[] = [
  // ══ EDUCATIONAL ══════════════════════════════════════════════════════════
  {
    dayOffset: 0,
    pillar: "educational",
    format: "carousel",
    hook: "Your tyre size is printed on the tyre. Most people have never read it.",
    body:
      "Your tyre size is printed on the tyre. Most people have never read it.\n\n" +
      "Look at the sidewall of any tyre on your car. You will see something like:\n\n" +
      "205/55 R16 95V\n\n" +
      "205 — the width in millimetres\n" +
      "55 — the sidewall height, as a percentage of the width\n" +
      "R16 — the rim size in inches\n" +
      "95V — the load and speed rating\n\n" +
      "That string is the fastest way to get an accurate price for your tyres. " +
      "Send it to us on Messenger before you drive over and we will tell you exactly " +
      "what fits, what it costs, and whether we have it in the bay today.\n\n" +
      "If you cannot find it, just send your make, model and year. That works too.",
    hashtags: ["#TireShopBalanga", "#AutoCareBataan", "#BalangaCity", "#Tuyo", "#EGSA", "#TirePH"],
    cta: "Message us your tyre size, or your make and model.",
    season: "none",
    shotList: [
      "Close-up of a tyre sidewall with the size code readable",
      "Second shot: an older-style size code for contrast",
    ],
    note:
      "Highest-save potential post in the bank. Carousel: slide 1 hook, slides 2–4 one " +
      "token per line, slide 5 the CTA. Pin it to the top of the page.",
  },
  {
    dayOffset: 3,
    pillar: "educational",
    format: "photo",
    hook: "Check the number on your door frame. Not the number on the tyre.",
    body:
      "Check the number on your door frame. Not the number on the tyre.\n\n" +
      "There is a sticker on the driver's door jamb with the tyre pressure we " +
      "recommend for your car. Open the door and look at the edge of the frame — it " +
      "is a small white or silver label.\n\n" +
      "The number moulded into the sidewall of the tyre is different. That one is a " +
      "maximum, not a recommendation. Running at the maximum is why some tyres wear " +
      "out on the shoulders first.\n\n" +
      "Check cold, meaning before you drive or at least three hours after. Pressure " +
      "rises when the tyres are hot, and a hot reading will fool you.\n\n" +
      "Bring the car in any time and we will check and top up all four, free.",
    hashtags: ["#TirePressure", "#TireShopBataan", "#Balanga", "#CarCarePH", "#EGSA"],
    cta: "Drive in and we will check all four pressures. Free, no booking needed.",
    season: "none",
    shotList: [
      "A hand pointing at the sticker on an open driver's door jamb",
      "Side by side: the door sticker and the tyre sidewall number",
    ],
    note: "Pair with the free pressure check offer in the caption — no code needed.",
  },
  {
    dayOffset: 6,
    pillar: "educational",
    format: "carousel",
    hook: "Why is one of your tyres bald and the other three fine?",
    body:
      "Why is one of your tyres bald and the other three fine?\n\n" +
      "Almost always one of three things.\n\n" +
      "1. It was never rotated. Front tyres wear fastest under braking, rear tyres " +
      "wear fastest under acceleration. Swap them front to back every 10,000 km or " +
      "every six months.\n\n" +
      "2. The alignment is off. If the car pulls to one side, one shoulder of one " +
      "tyre is doing all the work.\n\n" +
      "3. The pressure has been wrong. An underinflated tyre flexes through every " +
      "corner and wears the two shoulders. An overinflated one wears dead centre.\n\n" +
      "If rotation is not possible — a one-directional pattern, or different sizes " +
      "on each axle — we will tell you why instead of forcing it.",
    hashtags: ["#TireRotation", "#WheelAlignment", "#AutoCareBataan", "#BalangaCity", "#TirePH"],
    cta: "Message us if you are not sure whether your tyres can be rotated.",
    season: "none",
    shotList: [
      "A wheel on the ground showing uneven wear on one shoulder",
      "A rotation diagram drawn on a bay wall or a whiteboard",
    ],
    note: "Educational + soft service pitch. Works with or without a promotion running.",
  },
  {
    dayOffset: 9,
    pillar: "educational",
    format: "photo",
    hook: "Can you see the grooves? If you cannot, you are past due.",
    body:
      "Can you see the grooves? If you cannot, you are past due.\n\n" +
      "Tread is there to push water out from under the tyre. In the rain, that is " +
      "the difference between a car that stops and a car that keeps going.\n\n" +
      "Quick test: look straight down at a tyre in daylight. You should see the " +
      "channels clearly. If the blocks have worn flat into each other, you do not " +
      "have tread any more — and that is the moment to replace, not after.\n\n" +
      "Also look at the sidewall. Cuts, bulges and deep scuffs from kerbing are a " +
      "reason to replace on their own, even if the tread is still deep.\n\n" +
      "And check the date. Every tyre has a manufacture code on the sidewall. " +
      "Rubber ages whether it is used or not.",
    hashtags: ["#TireSafety", "#RainySeasonPH", "#TireShopBataan", "#Balanga", "#CarCarePH"],
    cta: "Not sure? Drive in and we will look at all four.",
    season: "rainy",
    shotList: [
      "Close-up of new tread versus worn tread, side by side on the bench",
      "A sidewall with the manufacture code highlighted",
    ],
    note: "Rainy-season post. Schedule between June and November.",
  },
  {
    dayOffset: 12,
    pillar: "educational",
    format: "carousel",
    hook: "PMS A or PMS B? Here is the actual difference.",
    body:
      "PMS A or PMS B? Here is the actual difference.\n\n" +
      "PMS A — engine oil, a new oil filter, fluid levels topped up, tyre pressures " +
      "checked. That is it. It is the routine service.\n\n" +
      "PMS B — everything in PMS A, plus a proper multi-point inspection with the car " +
      "on the lift. Brakes, belts, hoses, the underside, the steering. It is for a car " +
      "that has some mileage on it, or one you have never had properly looked at.\n\n" +
      "If you are not sure which you need, book the inspection first. We will tell " +
      "you honestly which one your car actually needs. Sometimes the answer is the " +
      "cheaper one.\n\n" +
      "We do not put full synthetic in without asking, and we use whatever grade your " +
      "car came with unless you want to change it.",
    hashtags: ["#PMS", "#ChangeOil", "#PreventiveMaintenance", "#AutoCareBataan", "#BalangaCity"],
    cta: "Book a PMS on the website, or message us your make and model.",
    season: "none",
    shotList: [
      "The two PMS services written on a whiteboard in the bay",
      "A car on the lift during a multi-point check",
    ],
    note: "Directly supports the First Visit PMS campaign. Run near day 11's offer post.",
  },
  {
    dayOffset: 15,
    pillar: "educational",
    format: "carousel",
    hook: "Can this hole be vulcanized? It depends entirely on where it is.",
    body:
      "Can this hole be vulcanized? It depends entirely on where it is.\n\n" +
      "VULCANIZABLE — a puncture in the tread area, away from the shoulder. We " +
      "patch it from the inside, and properly done it will outlast the tyre.\n\n" +
      "NOT VULCANIZABLE — damage on the sidewall. Damage near the shoulder. A hole " +
      "bigger than a coin. A cut from a nail or a wire that ran the length of the " +
      "groove. Those need a new tyre, because the sidewall is what holds the tyre " +
      "together.\n\n" +
      "We will tell you which one you have before we start. Every time. If it can be " +
      "repaired, we repair it — it is the honest answer, and it is cheaper for you " +
      "and better for the tyre.",
    hashtags: ["#Vulcanizing", "#TireRepair", "#TireShopBataan", "#Balanga", "#PneumaticRepair"],
    cta: "Message us a photo of the puncture and we will tell you if it can be repaired.",
    season: "none",
    shotList: [
      "A repaired tyre from the inside, showing the patch",
      "A sidewall cut for comparison",
    ],
    note: "Great for replies — people post photos of punctures in the comments all week.",
  },
  {
    dayOffset: 18,
    pillar: "educational",
    format: "reel",
    hook: "Squeal or grind. Those are two very different problems.",
    body:
      "Squeal or grind. Those are two very different problems.\n\n" +
      "SQUEAL when you brake: the pads are warning you they are getting thin. It is " +
      "annoying, not dangerous yet. Do not ignore it for months.\n\n" +
      "GRINDING: the pad is already gone and metal is now cutting metal on the disc. " +
      "That is expensive. Every kilometre you drive adds to it.\n\n" +
      "The mistake we see most: waiting for the noise to disappear. It does not go " +
      "away on its own.\n\n" +
      "Recording the sound helps more than people expect. Hold your phone near the " +
      "wheel when it happens and send it to us — you will usually get a straight " +
      "answer about how urgent it is.",
    hashtags: ["#BrakePad", "#CarCarePH", "#AutoCareBataan", "#BalangaCity", "#SafetyFirst"],
    cta: "Recording is enough. Send us the sound and we will tell you how urgent it is.",
    season: "none",
    shotList: [
      "20-second reel: pedal pressed, sound captured, then the pad measured with a gauge",
      "A photo of worn versus new pad thickness",
    ],
    note:
      "Reel must be shot in the bay with real audio. Never use stock engine noise. " +
      "No text overlay claiming an outcome — describe, do not promise.",
  },
  {
    dayOffset: 21,
    pillar: "educational",
    format: "photo",
    hook: "Your tyre has a birthday. It is moulded into the sidewall.",
    body:
      "Your tyre has a birthday. It is moulded into the sidewall.\n\n" +
      "Look for four numbers and a letter. It looks like 2223 — that means the week " +
      "of 2022, twenty-second week.\n\n" +
      "Rubber ages whether you drive on it or not. A tyre that sat in the sun on a rack " +
      "for four years is four years old, and the sidewall gets brittle and the grip " +
      "goes before the tread does.\n\n" +
      "This is why buying second-hand tyres is a gamble. Sometimes it is fine. " +
      "Sometimes you get a five-year-old tyre with good tread and no grip left.\n\n" +
      "We check the date on every tyre we fit. We will tell you what we found, even " +
      "if it means selling you a tyre instead of a fitting job.",
    hashtags: ["#TireAge", "#TireSafety", "#TireShopBataan", "#Balanga", "#CarCarePH"],
    cta: "Come in before you buy. We will check the tyres already on your car.",
    season: "none",
    shotList: [
      "Sidewall with the DOT / manufacture code circled",
      "A stock rack with visible codes",
    ],
    note:
      "Trust-building: the line about selling a tyre instead of a fitting job is the " +
      "whole brand in one sentence. Do not cut it.",
  },
  {
    dayOffset: 24,
    pillar: "educational",
    format: "photo",
    hook: "If your car pulls to one side when you brake, check the brakes before the alignment.",
    body:
      "If your car pulls to one side when you brake, check the brakes before the " +
      "alignment.\n\n" +
      "It feels like an alignment problem. It usually is not.\n\n" +
      "A caliper that is sticking on one side drags all the time, not just under " +
      "braking. That drags one pad and one disc down until they are gone, and the " +
      "car starts pulling.\n\n" +
      "Get an alignment done on a dragging brake and you have paid for nothing. The " +
      "brake is being replaced again in a few weeks, and the alignment is wrong again " +
      "by then.\n\n" +
      "Order matters. Brakes first, then alignment, then balance.",
    hashtags: ["#WheelAlignment", "#BrakePad", "#AutoCareBataan", "#BalangaCity", "#CarCarePH"],
    cta: "Message us if your car pulls. We will tell you what to check first.",
    season: "none",
    shotList: ["A wheel on a stand with the pad measured on one side", "An alignment printout"],
    note: "Positions EYG as the shop that thinks, not the shop that just does.",
  },
  {
    dayOffset: 27,
    pillar: "educational",
    format: "carousel",
    hook: "Four warning lights that mean stop the car. Four that mean get it checked.",
    body:
      "Four warning lights that mean stop the car. Four that mean get it checked.\n\n" +
      "STOP THE CAR:\n" +
      "• Oil pressure — red oil can. Continuing means the engine is being destroyed.\n" +
      "• Temperature — the car is overheating. Pull over, switch off, wait.\n" +
      "• Brake system — the system is not working properly. Do not drive it far.\n" +
      "• Battery — the charging system has failed.\n\n" +
      "DRIVE CAREFULLY, GET IT CHECKED:\n" +
      "• Engine check — the car has stored a fault. It can usually still drive.\n" +
      "• Tyre pressure — one tyre is low or a sensor is failing.\n" +
      "• ABS — the anti-lock brakes are not working. Regular brakes still work. " +
      "Do not drive in heavy rain.\n" +
      "• Airbag — get it looked at, but it is not a stop-the-car light.\n\n" +
      "If you are not sure which light you are looking at, take a photo and send it " +
      "to us. We will tell you honestly whether to drive it in or leave it.",
    hashtags: ["#WarningLights", "#CarSafety", "#AutoCareBataan", "#Balanga", "#CarCarePH"],
    cta: "Photograph the light and message us. We will tell you if you can drive.",
    season: "none",
    shotList: [
      "Dashboard shots of the actual cluster on a car in the bay",
      "A simple two-colour chart on paper, hand-written — hand-written reads more honest",
    ],
    note: "Save-worthy. Also a strong driver for inbound DMs, which is the real goal here.",
  },

  // ══ TRUST ════════════════════════════════════════════════════════════════
  {
    dayOffset: 1,
    pillar: "trust",
    format: "photo",
    hook: "This is the bay. Small, but it has the right equipment.",
    body:
      "This is the bay. Small, but it has the right equipment.\n\n" +
      "We are a small shop on EGSA Fourlanes in Tuyo. We are not trying to be the " +
      "biggest in Balanga. We are trying to be the one you come back to.\n\n" +
      "That means the same faces every time, a bay you can actually stand in and " +
      "watch, and a price you are told before we start.\n\n" +
      "If you have never been here, come in and have a look around. Pressure checks " +
      "are free and there is no obligation to book anything.\n\n" +
      "Kumusta, magandang tanawin dito.",
    hashtags: ["#BalangaCity", "#Tuyo", "#AutoCareBataan", "#EGSA", "#TireShopBalanga"],
    cta: "Come by and have a look. No booking, no obligation.",
    season: "none",
    shotList: [
      "Wide shot of the whole bay from the entrance, lights on",
      "Same shot at night — proves the shop is genuinely lit and open",
      "The frontage, taken from the EGSA road so the landmark is obvious",
    ],
    note:
      "This is the anti-overcharge post. Real bay photos do more than any claim. " +
      "Never use a stock garage image — a local will spot it immediately.",
  },
  {
    dayOffset: 2,
    pillar: "trust",
    format: "reel",
    hook: "We show you the old part. Every time. Here is what that looks like.",
    body:
      "We show you the old part. Every time. Here is what that looks like.\n\n" +
      "Not because we have to. Because there is no faster way to prove to a customer " +
      "that they were right to be worried.\n\n" +
      "In this video: the brake pads we took off, the thickness we measured, and the " +
      "discs underneath. The pads still had life in them. We told the customer so, " +
      "and they drove away having spent less than they expected.\n\n" +
      "Some people want to keep the old part. Some do not. That should be your choice, " +
      "not ours.\n\n" +
      "If we replace something on your car, you will see it.",
    hashtags: ["#BrakePad", "#AutoCareBataan", "#BalangaCity", "#Tuyo", "#EGSA"],
    cta: "Book a brake check. We will measure, then we will tell you.",
    season: "none",
    shotList: [
      "Actual removed brake pads, held up to the light, with a depth gauge",
      "The pads laid next to new ones for scale",
      "A mechanic's hands, in frame, doing the measuring — faces optional",
    ],
    note:
      "⚠️ The narration above describes a scenario. When filming, narrate what ACTUALLY " +
      "happened on that job. Never film a set-up and caption it as a real outcome. " +
      "If no part came off that day, post the bay instead.",
  },
  {
    dayOffset: 4,
    pillar: "trust",
    format: "carousel",
    hook: "How a job actually goes at EYG. Four steps, no surprises.",
    body:
      "How a job actually goes at EYG. Four steps, no surprises.\n\n" +
      "1. YOU TELL US WHAT IS WRONG\n" +
      "What it sounds like, when it started, whether it happens when you brake or when " +
      "you turn. You do not need to diagnose anything.\n\n" +
      "2. WE LOOK, THEN WE PRICE\n" +
      "A technician inspects the vehicle. They tell you what is actually wrong, and " +
      "also what is NOT wrong. That second part matters.\n\n" +
      "3. YOU DECIDE\n" +
      "You get the price and the options. Nothing is opened, nothing is replaced, " +
      "until you say yes. If the price changes while the work is open, we stop and " +
      "call you first.\n\n" +
      "4. STRAIGHTFORWARD HANDOVER\n" +
      "You get the parts we removed, an itemised invoice, and a plain explanation of " +
      "what happens next and when you should come back.\n\n" +
      "That is the whole process. There is no step five.",
    hashtags: ["#AutoCareBataan", "#BalangaCity", "#TireShopBalanga", "#EGSA", "#Tuyo"],
    cta: "Book a bay online, or call the shop.",
    season: "none",
    shotList: [
      "Each step as one carousel slide, photographed in the bay",
      "An itemised invoice with the customer details covered",
    ],
    note:
      "The 'what is NOT wrong' line is the differentiator. Do not cut it for length.",
  },
  {
    dayOffset: 7,
    pillar: "trust",
    format: "photo",
    hook: "Torque wrench, not a rattle gun and a guess.",
    body:
      "Torque wrench, not a rattle gun and a guess.\n\n" +
      "This is the difference between a wheel done right and a wheel done fast.\n\n" +
      "A wheel has to be torqued to the manufacturer's specification. Too loose and " +
      "the wheel comes off. Too tight and you warp the rotor, or strip a stud, or " +
      "bend something you cannot see.\n\n" +
      "The number is on your door jamb, right next to the tyre pressure. Most people " +
      "have never looked at it.\n\n" +
      "This is the tool we use. It clicks when it reaches the number, and it does not " +
      "lie about being tight.\n\n" +
      "It is not the most impressive-looking tool in the bay. It is one of the most " +
      "important.",
    hashtags: ["#WheelBalancing", "#TireService", "#AutoCareBataan", "#Balanga", "#TirePH"],
    cta: "Bringing new tyres in? Ask us to torque them to spec. We will.",
    season: "none",
    shotList: [
      "The torque wrench in a mechanic's hand, mid-click",
      "The torque chart on the door jamb, legible",
    ],
    note: "Underrated post. It appeals to the customer who already knows cars.",
  },
  {
    dayOffset: 10,
    pillar: "trust",
    format: "photo",
    hook: "Small shop. Same faces when you come back.",
    body:
      "Small shop. Same faces when you come back.\n\n" +
      "That is the whole business model.\n\n" +
      "You do not have to explain your car again. You do not have to be quoted by " +
      "someone new who has never touched it. The mechanic who did the last job is " +
      "the one who sees the next one.\n\n" +
      "We are on EGSA Fourlanes in Tuyo, Balanga. We are here Monday to Saturday. If " +
      "you have been before, you know where we are.\n\n" +
      "If you have not, come and see. Pressure checks are free and looking does not " +
      "commit you to anything.",
    hashtags: ["#BalangaCity", "#Tuyo", "#EGSA", "#AutoCareBataan", "#SupportLocal"],
    cta: "Come by and say hello. Kumusta lang.",
    season: "none",
    shotList: [
      "⚠️ REAL PEOPLE ONLY — the actual team, in the bay, natural light, not posed",
      "Wide shot of two or three of them working",
      "Faces visible. This is the point of the post.",
    ],
    note:
      "⚠️ REQUIRES OWNER ASSETS: real faces and permission from each person in the " +
      "photo. DO NOT publish this with placeholder names, stock people, or anyone " +
      "who has not agreed to be on the page. If consent is not yet obtained, replace " +
      "this post with a bay-only shot and move it to day 19.",
  },
  {
    dayOffset: 14,
    pillar: "trust",
    format: "photo",
    hook: "This is what a check sheet looks like. You get a copy.",
    body:
      "This is what a check sheet looks like. You get a copy.\n\n" +
      "This is what our inspection sheet looks like. You get a copy of it.\n\n" +
      "Not a marketing leaflet. An actual list, ticked, with what we checked and what " +
      "we found.\n\n" +
      "It separates into three columns:\n" +
      "DO NOW — things that affect safety or will get expensive if ignored.\n" +
      "WATCH IT — things with life left in them, and roughly how long.\n" +
      "NOTHING TO WORRY ABOUT — which is a real column, and often the fullest one.\n\n" +
      "Most shops will not hand you a sheet because it tells you what you do not need. " +
      "That is exactly why we do.\n\n" +
      "Ask for it at the counter and we will print you a fresh one for your car.",
    hashtags: ["#PreventiveMaintenance", "#AutoCareBataan", "#BalangaCity", "#EGSA", "#CarCarePH"],
    cta: "Book a check-up and we will hand you the sheet.",
    season: "none",
    shotList: [
      "The actual printed inspection sheet, photographed flat on the bench",
      "A tick and a note handwritten on it — legible, no real customer data visible",
    ],
    note: "⚠️ Blur or replace any customer name, plate or phone on the sheet before posting.",
  },
  {
    dayOffset: 20,
    pillar: "trust",
    format: "text-only",
    hook: "There are jobs we do not do. Here is one, and here is why.",
    body:
      "There are jobs we do not do. Here is one, and here is why.\n\n" +
      "We get asked about them regularly, and the answer is always no. Here is one: " +
      "transmission rebuilds.\n\n" +
      "Not because it is beneath us. Because it is a specialist job, it needs a " +
      "different set of tools and a different room, and a shop like ours does not have " +
      "either. If we tried it, we would be doing it badly, and you would pay for it.\n\n" +
      "So we tell you that, and we point you to someone who does it properly.\n\n" +
      "It costs us the job. It costs you nothing but the fuel to drive to the right " +
      "shop. We would rather be the shop you come back to in six months.\n\n" +
      "If you ever get an answer from a shop that sounds too certain and too cheap, " +
      "that is the signal, not the sales pitch.",
    hashtags: ["#AutoCareBataan", "#BalangaCity", "#HonestAuto", "#Tuyo", "#EGSA"],
    cta: "If we cannot do it, we will tell you. Message us and ask.",
    season: "none",
    shotList: [
      "None. Text-only post, on purpose — a text post from a small shop reads as honest.",
    ],
    note:
      "⚠️ Confirm with the owner that this job is genuinely out of scope before " +
      "posting. If they actually do transmission work, delete this post — a false " +
      "refusal is worse than no post.",
  },
  {
    dayOffset: 26,
    pillar: "trust",
    format: "photo",
    hook: "What it is actually like when you walk in.",
    body:
      "What it is actually like when you walk in.\n\n" +
      "No reception desk with a script. No upsell table. Just the bay, the tools, and " +
      "somebody who will look at your car with you.\n\n" +
      "You can stand and watch. You can ask questions while the work is happening. " +
      "You will not be rushed out of the door with an invoice you did not read.\n\n" +
      "If you are the type who wants to understand what is being done to your car, " +
      "you will like it here.\n\n" +
      "EGSA Fourlanes, Tuyo, Balanga City.",
    hashtags: ["#BalangaCity", "#Tuyo", "#AutoCareBataan", "#EGSA", "#TireShopBalanga"],
    cta: "Walk in during your next errand on the Fourlanes.",
    season: "none",
    shotList: [
      "The counter / waiting area as a customer sees it, walking in",
      "A customer's-eye view of a car up on the lift",
    ],
    note: "Pairs well with the Review post. Run close to a quiet week.",
  },

  // ══ OFFER ════════════════════════════════════════════════════════════════
  {
    dayOffset: 5,
    pillar: "offer",
    format: "photo",
    hook: "Rainy season is here. Three checks, one visit, one price.",
    body:
      "Rainy season is here. Three checks, one visit, one price.\n\n" +
      "Our Rainy Season Safety Package covers the three things that quietly matter " +
      "the moment the rains start:\n\n" +
      "• Tyre inspection — pressure, tread depth, sidewall, on all four\n" +
      "• Wiper blades — a fresh pair, front\n" +
      "• Brake check — pads, discs and lines, on the lift\n\n" +
      // SUGGESTED — REQUIRES OWNER CONFIRMATION (₱2,400 entry / ₱3,200 ceiling)
      "Bundle price is around P2,400 to P3,200 depending on the wiper blades you " +
      // SUGGESTED — REQUIRES OWNER CONFIRMATION (P950 saving off a P3,350 a-la-carte total)
      "pick, instead of about P3,350 if you booked the three separately.\n\n" +
      "You leave with a written list, sorted into do-now, watch-it, and fine.\n\n" +
      "Final price is confirmed after we inspect. Nothing gets done until you say " +
      "yes. Cannot be combined with other offers.\n\n" +
      "Valid until 30 November 2026. Rains do not read the calendar.",
    hashtags: ["#RainySeasonPH", "#RainySeasonSafety", "#AutoCareBataan", "#BalangaCity", "#EGSA"],
    cta: "Message us RAINYSAFE or book the package on the website.",
    promoSlug: "rainy-season-safety-bundle",
    season: "rainy",
    shotList: [
      "Wiper blades on the bench, new pair next to the old one",
      "A tyre being checked with a tread depth gauge",
      "A brake pad measured with a caliper",
    ],
    note:
      "⚠️ Do not publish the peso figures until the owner has confirmed them. " +
      "If they are unconfirmed, cut the price paragraph and post the three items only. " +
      "The offer works without the number.",
  },
  {
    dayOffset: 8,
    pillar: "offer",
    format: "photo",
    hook: "Clearance tyres in the rack. Listed stock only.",
    body:
      "Clearance tyres in the rack. Listed stock only.\n\n" +
      "We hold sizes that move slowly. Rather than let them age on the rack, we are " +
      "clearing them.\n\n" +
      // SUGGESTED — REQUIRES OWNER CONFIRMATION (flat 10% off listed clearance stock)
      "Straight 10% off the listed price, while the stock lasts.\n\n" +
      "What is in this photo is what is in the bay. We do not advertise a size we " +
      "cannot bolt on the same day.\n\n" +
      "Message us your size before you drive over and we will tell you honestly " +
      "whether it is in stock, because it changes as stock lands and as people buy.\n\n" +
      "Fitting, balancing and valve stems are charged separately — the clearance is " +
      "on the tyre, not the whole job.\n\n" +
      "Cannot be combined with other offers. Valid until 20 December 2026.",
    hashtags: ["#TireClearance", "#TireShopBataan", "#BalangaCity", "#Tuyo", "#TirePH"],
    cta: "Message us your tyre size and we will check the rack.",
    promoSlug: "tyre-clearance",
    season: "none",
    shotList: [
      "The actual rack, photographed straight on, with the clearance tags visible",
      "One tyre out of the rack with its size and price tag legible",
    ],
    note:
      "Honest scarcity: 'while the stock lasts' is true and needs no countdown. " +
      "Update the photo whenever the rack changes, or delete the post.",
  },
  {
    dayOffset: 11,
    pillar: "offer",
    format: "photo",
    hook: "Never been to EYG? Your first PMS is 15% off.",
    body:
      "Never been to EYG? Your first PMS is 15% off.\n\n" +
      "We know the first visit is the hard one. You do not know the prices, you do " +
      "not know the shop, and everyone you ask has a different story.\n\n" +
      "So here is a way to find out without a big commitment. Book a PMS, get " +
      "15% off it, and see whether we are straight with you.\n\n" +
      // SUGGESTED — REQUIRES OWNER CONFIRMATION (15% off the PMS line)
      "We would rather earn the tyres and the brakes from you later than sell them " +
      "to you now.\n\n" +
      "New customers only. One per person. Final price confirmed after inspection. " +
      "Discount is on the PMS line, not on parts you add that day. Cannot be combined " +
      "with another offer.\n\n" +
      "Valid until 31 December 2026.",
    hashtags: ["#PMS", "#ChangeOil", "#AutoCareBataan", "#BalangaCity", "#FirstTimeCustomer"],
    cta: "Message us FIRSTPMS, or book online and add the code at the counter.",
    promoSlug: "first-visit-pms",
    season: "none",
    shotList: ["The bay during a PMS, oil going in, no customer identifiable"],
    note: "Strongest first-turn campaign. Run it in the month with the most slow weeks.",
  },
  {
    dayOffset: 16,
    pillar: "offer",
    format: "photo",
    hook: "You already know somebody who needs this. Send them our way.",
    body:
      "You already know somebody who needs this. Send them our way.\n\n" +
      // SUGGESTED — REQUIRES OWNER CONFIRMATION (P300 off a P1,500+ service, both sides)
      "Bring a neighbour, they get P300 off any service over P1,500 — and so do you, " +
      "on your next visit.\n\n" +
      "It works both ways. If somebody refers you, you claim it too. Just mention " +
      "their name at the counter.\n\n" +
      "No form. No code to remember. No minimum spend games.\n\n" +
      "One per person per year. After any other pricing is agreed. Cannot be combined " +
      "with another offer.\n\n" +
      "Valid until 31 March 2027.\n\n" +
      "Most of our customers came from somebody like you. This is just saying thank you.",
    hashtags: ["#SupportLocal", "#BalangaCity", "#AutoCareBataan", "#Tuyo", "#ReferAFriend"],
    cta: "Tag the person, or just send them this post.",
    promoSlug: "bring-a-neighbour",
    season: "none",
    shotList: ["The frontage, sunny day, with the sign legible", "The team at the counter"],
    note:
      "Tagging a real person in the comments is powerful here — but only tag people " +
      "who have actually been customers. Never tag strangers to manufacture reach.",
  },
  {
    dayOffset: 23,
    pillar: "offer",
    format: "photo",
    hook: "One mechanic, one month, one customer whose kid gets to help.",
    body:
      "One mechanic, one month, one customer whose kid gets to help.\n\n" +
      "Every month we pick one mechanic and one EYG customer to feature. The " +
      "customer's child gets to help mount a tyre, hold the light, or run the impact " +
      "wrench — with a mechanic standing right next to them the whole time.\n\n" +
      // SUGGESTED — REQUIRES OWNER CONFIRMATION (12% off, birthday month only)
      "And in that customer's birthday month, their service gets 12% off.\n\n" +
      "It is not a raffle. We will ask you at the counter. If the month's slot is " +
      "already taken, we will tell you honestly and move you to the next one.\n\n" +
      "One per month, first come first served. For registered EYG customers — " +
      "registration is free at the counter.\n\n" +
      "One please do not do: post your birth date publicly. We only need the month, " +
      "and we would rather not have your birthday on the internet.\n\n" +
      "Valid until 30 September 2027.",
    hashtags: ["#BirthdayMonth", "#BalangaCity", "#AutoCareBataan", "#Tuyo", "#SupportLocal"],
    cta: "Ask at the counter to be registered and put on the list.",
    promoSlug: "mechanic-birthday-special",
    season: "none",
    shotList: [
      "⚠️ A mechanic with a customer's child, WITH both families' written permission",
      "The impact wrench moment — the child actually holding it",
    ],
    note:
      "⚠️ REQUIRES OWNER ASSETS + CONSENT: this post cannot be made without a real " +
      "customer family who has agreed in writing. Do not stage it with staff " +
      "children. If there is no family this month, swap to the bay photo from day 26.",
  },
  {
    dayOffset: 29,
    pillar: "offer",
    format: "photo",
    hook: "Book your mid-year check-up early. It is cheaper, and it is calmer.",
    body:
      "Book your mid-year check-up early. It is cheaper, and it is calmer.\n\n" +
      "Six months into the year, most cars are starting to say something. A tyre " +
      "losing a pound a week. A pedal that feels a little soft. A belt that squeaks " +
      "when you turn the aircon on.\n\n" +
      "The mid-year check-up goes through it item by item — brakes, tyres, " +
      "suspension, belts, fluids, battery. You leave with a written list sorted into " +
      "do now, watch it, and nothing to worry about.\n\n" +
      // SUGGESTED — REQUIRES OWNER CONFIRMATION (P300 off a P1,000 check-up)
      "P300 off the check-up fee.\n\n" +
      "The check-up is still charged. This reduces the fee — it does not make it free, " +
      "and we are not going to pretend otherwise.\n\n" +
      "Any repairs we find are quoted and approved by you before we touch anything.\n\n" +
      "Valid 1 May to 31 July 2027. You can book now and come in during the window.",
    hashtags: ["#CarCheckup", "#PreventiveMaintenance", "#AutoCareBataan", "#BalangaCity", "#EGSA"],
    cta: "Book a slot now for a mid-year date. Message us MYCHECK.",
    promoSlug: "mid-year-check-up",
    season: "none",
    shotList: ["A car up on the lift with the checklist on the bench", "A completed sheet, no customer data"],
    note:
      "Schedule this in January or February so people can book ahead. The window is " +
      "deliberately May–July: calling a deal 'mid-year' in December teaches customers " +
      "our dates mean nothing.",
  },

  // ══ COMMUNITY ════════════════════════════════════════════════════════════
  {
    dayOffset: 13,
    pillar: "community",
    format: "text-only",
    hook: "Bataan rain is not the same as Manila rain. It is heavier, and it sits on the road.",
    body:
      "Bataan rain is not the same as Manila rain. It is heavier, and it sits on the " +
      "road.\n\n" +
      "That matters for three things:\n\n" +
      "TYRES — standing water on the Fourlanes, gravel washed onto the shoulder, and " +
      "a lot of cars running on tyres that have not been checked since they were new.\n\n" +
      "VISIBILITY — if you cannot clear the windscreen in the first five seconds, you " +
      "cannot see a motorcycle. Wipers are cheap. Not seeing is not.\n\n" +
      "BRAKES — wet, the stopping distance goes up. If the pedal has felt softer " +
      "lately, that is the month to look at it.\n\n" +
      "None of this is a sales pitch. It is just what we see in the bay when it rains.\n\n" +
      "If you are not sure about any of it, come in. Pressure checks are free.",
    hashtags: ["#Bataan", "#RainySeasonPH", "#BalangaCity", "#EGSA", "#RoadSafetyPH"],
    cta: "Come in before the rains get serious. Pressure checks are free.",
    season: "rainy",
    shotList: ["None — text-only. Rain photo of the Fourlanes if you want a cover image."],
    note:
      "Local voice post. This is the one that makes the page feel like a neighbour, " +
      "not a business. Post it even in weeks with no promotion running.",
  },
  {
    dayOffset: 17,
    pillar: "community",
    format: "text-only",
    hook: "If you drive the Fourlanes, come to us when the road is empty, not when you are.",
    body:
      "If you drive the Fourlanes, come to us when the road is empty, not when you " +
      "are.\n\n" +
      "We know how the traffic works here. Everyone leaves Balanga at the same time, " +
      "so the mornings and the afternoon wave are when the bay is full and the wait is " +
      "longest.\n\n" +
      "If your day allows, mid-morning and mid-afternoon are the quietest. Same price, " +
      "same service, nobody waiting behind you for the bay.\n\n" +
      "And if you cannot choose your time — the ones who are already driving, already " +
      "on the road, already fed up — then call us. That is what the roadside is for. " +
      "We would honestly rather you came at a quiet hour than that you got stranded.\n\n" +
      "See you in the bay.",
    hashtags: ["#EGSA", "#Bataan", "#BalangaCity", "#Tuyo", "#CommuterPH"],
    cta: "Call the shop when you are on the road and we will tell you what is open.",
    season: "none",
    shotList: ["None — text-only."],
    note:
      "Also a good weeknight post, when engagement on photos is low.",
  },
  {
    dayOffset: 19,
    pillar: "community",
    format: "text-only",
    hook: "Cheap and tipid are not the same thing. Here is how to tell the difference.",
    body:
      "Cheap and tipid are not the same thing. Here is how to tell the difference.\n\n" +
      "A tyre shop that is too cheap usually gets there in one of three ways: the " +
      "labour, the part, or the honesty.\n\n" +
      "THE LABOUR IS SKIPPED — the wheel is torqued by feel instead of by " +
      "specification. Nothing visibly wrong for years. Then a wheel comes off.\n\n" +
      "THE PART IS DOWNGRADED — same size on the label, cheaper compound, thinner " +
      "actually. You cannot see it. You feel it in the wet.\n\n" +
      "THE WORK IS NOT EXPLAINED — the old part is hidden, the invoice has items on " +
      "it you did not authorise, and nobody mentioned that something else needed " +
      "doing.\n\n" +
      "We are not saying we are the cheapest in Balanga. We are saying you should be " +
      "able to ask us any question about your invoice and get a straight answer.\n\n" +
      "Kung may tanong kayo sa resibo, tanungin lang kami. Walang hiya.",
    hashtags: ["#TipidPH", "#Pambansa", "#AutoCareBataan", "#BalangaCity", "#TireShopBalanga"],
    cta: "Ask us anything about your invoice. We would rather answer it now.",
    season: "none",
    shotList: ["None — text-only."],
    note:
      "Strongest positioning post in the community set. Do NOT name or hint at any " +
      "other shop. Never disparage a competitor by name or implication.",
  },
  {
    dayOffset: 22,
    pillar: "community",
    format: "photo",
    hook: "Hot day. Check your pressures before you blame the tyre.",
    body:
      "Hot day. Check your pressures before you blame the tyre.\n\n" +
      "In the heat, air in a tyre expands and the pressure goes up. In the cold, it " +
      "drops. Over a long trip with the AC on and the tyres working, you can lose " +
      "enough air to notice the car handling differently — and drivers usually blame " +
      "the tyres themselves.\n\n" +
      "Check them cold, against the number on the door jamb. If they are reading low " +
      "in the morning, they were low.\n\n" +
      "And if one keeps losing air, that is not a pressure check, that is a slow leak. " +
      "Bring it in and we will find it, usually at the valve or the rim edge.\n\n" +
      "Bring the car in and we will check all four while you wait. Free.",
    hashtags: ["#SummerPH", "#TirePressure", "#AutoCareBataan", "#Balanga", "#CarCarePH"],
    cta: "Drive in and we will check and top up all four. Free.",
    season: "summer",
    shotList: ["A pressure gauge on a hot tyre, gauge reading visible", "A technician checking pressure"],
    note: "April to May, or any week above 33°C. Genuinely useful, no offer needed.",
  },
  {
    dayOffset: 25,
    pillar: "community",
    format: "carousel",
    hook: "First car. Here is the list we wish somebody had given us.",
    body:
      "First car. Here is the list we wish somebody had given us.\n\n" +
      "1. Learn ONE number: your tyre pressure. It is on the door jamb. Every other " +
      "car problem gets easier once you know it.\n\n" +
      "2. Keep something in the boot. A small compressor, a torch, a jump pack. Not " +
      "fancy, not expensive. Just present.\n\n" +
      "3. Tyres before brakes. Grip comes before stopping. A new set of tyres on worn " +
      "brakes is still a car that slides.\n\n" +
      "4. Learn to read a tread depth. If you cannot see the grooves from above, it is " +
      "done. It takes two seconds and it is the whole test.\n\n" +
      "5. Do not ignore a noise. A noise is the car telling you where it hurts, before " +
      "it costs you more.\n\n" +
      "6. Oil is not the same as service. Check what your car actually needs before " +
      "you pay for a package.\n\n" +
      "7. Ask the price before you authorise anything, every single time. A good shop " +
      "will not mind.\n\n" +
      "Enjoy the car. Drive it. Fix it before it fixes itself.",
    hashtags: ["#NewDriver", "#FirstCar", "#CarCarePH", "#AutoCareBataan", "#BalangaCity"],
    cta: "Save this. Then come and see us when you need someone to look at it properly.",
    season: "none",
    shotList: [
      "One tip per carousel slide, hand-written on paper in the bay",
      "A boot with the emergency kit laid out — real items, no stock photo",
    ],
    note:
      "Reaches a completely new audience: first-time drivers. Long-tail local search " +
      "and a lot of saves. Schedule before enrolment / licence renewal season.",
  },
  {
    dayOffset: 28,
    pillar: "community",
    format: "carousel",
    hook: "Going home for the holidays? Check these five before you leave.",
    body:
      "Going home for the holidays? Check these five before you leave.\n\n" +
      "1. TYRE PRESSURE — cold, and against the door jamb number. Underinflated tyres " +
      "overheat on a long highway run, and that is how you get a blowout.\n\n" +
      "2. TREAD DEPTH — look at all four. The front two wear fastest.\n\n" +
      "3. BRAKES — if the pedal has been soft, or there is a squeal or a grind, do not " +
      "leave town on it.\n\n" +
      "4. WIPERS AND WASH — you will be driving through a storm at some point.\n\n" +
      "5. LIGHTS — headlights, brake lights, indicators. All three of those matter in " +
      "traffic, and a burnt bulb is a two-minute fix that some people drive around with " +
      "for a month.\n\n" +
      "If you are driving the toll road, add a sixth: check the spare. A lot of cars " +
      "have never had one tested since it went in the boot.\n\n" +
      "Ten minutes at a shop now is a much worse afternoon avoided.",
    hashtags: ["#HolidayTravelPH", "#Undas", "#TireSafety", "#AutoCareBataan", "#Bataan"],
    cta: "Book a check-up before you go. It is the cheapest part of the trip.",
    season: "holiday",
    shotList: [
      "A tyre tread close-up on the last slide",
      "A working indicator light on a car in the bay",
      "A spare tyre out of the boot",
    ],
    note:
      "Schedule mid-November so it lands BEFORE the Undas rush, not during it. " +
      "Pairs with day 17's traffic post as a two-week theme.",
  },
] as const;

// ── Derived helpers ─────────────────────────────────────────────────────────

/** All posts of one pillar, in bank order. */
export function postsByPillar(pillar: SocialPillar): readonly SocialPost[] {
  return SOCIAL_POSTS.filter((p) => p.pillar === pillar);
}

/** The posts tied to a live campaign in `./promotions`. */
export function postsForPromo(promoSlug: string): readonly SocialPost[] {
  return SOCIAL_POSTS.filter((p) => p.promoSlug === promoSlug);
}

/** Posts whose seasonality tag matches the given window. */
export function postsBySeason(season: SocialSeason): readonly SocialPost[] {
  return SOCIAL_POSTS.filter((p) => p.season === season);
}

/**
 * Formats a post body as plain text for pasting into the Facebook composer.
 * Pure string work so it can be unit-tested without a browser.
 */
export function formatPostForFacebook(post: SocialPost): string {
  const tags = post.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  return `${post.body.trim()}\n\n${tags}`.trim();
}

/**
 * Promotional post + campaign kind, for the offer calendar and for META-ADS.md's
 * creative mapping. Pure lookup so it cannot go stale.
 */
export function promoKindForPost(post: SocialPost, kinds: Record<string, PromoKind>): PromoKind | null {
  return post.promoSlug ? (kinds[post.promoSlug] ?? null) : null;
}