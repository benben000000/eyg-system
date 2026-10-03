# Risks — DO and DON'T

### EYG Tire & Auto Care website

**Owner:** research agent · **Compiled:** 2026-10-02 · **All sources checked 2026-10-02**

> **This is the guardrail document. Read it before writing a line of copy, a component, or
> a pricing rule.**
>
> Every row in the DO and DON'T tables has a *why* grounded in either **verified evidence**
> from this repository or a **named failure mode**. If a "why" says `ANALYST JUDGEMENT`,
> that is my reasoning, not a fact, and the orchestrator may overrule it. If it cites a
> document, it is traceable.
>
> **The five hard rules, stated once:**
> 1. **Never state a fact the owner has not signed off.** Not a price, not a warranty, not
>    a rating, not a year, not a brand, not a phone number.
> 2. **Never manufacture urgency.** The shop has 308 followers. In a market of 138
>    businesses, a fake-urgency story does not stay a marketing problem.
> 3. **Never make a customer's money a surprise.** Price range → written job order →
>    itemised receipt. Three steps, no gaps.
> 4. **Never publish a customer.** No plates, no names, no unconsented faces.
> 5. **Never ship a placeholder.** A `+639000000000` phone number is not a small bug. It
>    is the failure of the entire website, shipped.

---

## 1. The DO table

| # | DO | Why |
|---|---|---|
| **D1** | **Publish the hours, exactly as verified.** Mon–Sat 08:00–17:00, Sunday closed | ✅ **CONFIRMED** from EYG's own Facebook posts (`facebook-intel.md` §2.2). **Of five local competitors read in full, zero publish their hours** (`competitors.md` §3). This is a verified fact that no competitor offers, and it costs nothing |
| **D2** | **Publish the service list verbatim, in the shop's own order and Title Case** | ✅ **CONFIRMED** — the page's own 10-item footer (`facebook-intel.md` §2.3). The shop chose this vocabulary and locals use it. Paraphrasing it into marketing-speak throws away free keyword equity and misrepresents the offer |
| **D3** | **Publish a price *range* with a stated variable, tied to a written job order** | ✅ Nobody in Balanga publishes a price (`competitors.md` §3) — it is the single biggest available differentiator. **And it is legally safer than silence:** a stated range plus a signed job order is far better evidence of fair dealing than "inquire at the counter" (`legal-compliance-ph.md` §4.3) |
| **D4** | **Say what is NOT included, for every service** | Kills bait-and-switch at the root, and it is the honest-shop counter-programme: the industry's defining accusation is that you never learn the exclusions until pickup (`legal-compliance-ph.md` §4.4). `content/services.md` is already structured for it |
| **D5** | **Quote the complete installed tyre price — tyre + mounting + balancing — in one number** | This one sentence removes the industry's most common complaint from EYG's transactions entirely (`legal-compliance-ph.md` §4.4). A shopper comparing ₱4,500 with ₱7,800 is comparing like with like, and EYG is the one telling the truth |
| **D6** | **Publish a live open/closed indicator** | It is the single most useful thing on the site for the actual customer — a driver at 07:40 wanting to know if a bay is free. Verified hours make it possible to be correct. `ANALYST JUDGEMENT` on the conversion lift; **D1 makes it truthful** |
| **D7** | **Make the phone number reachable within one thumb-reach on every viewport, always** | The brief's hard rule, and it is right: the top of the funnel is a phone call during working hours (`AGENT-BRIEF.md` §1). A stranded driver does not read. Persistent bottom bar on mobile |
| **D8** | **Let the customer book a bay and get a real confirmation** | ✅ **No local competitor has any online booking** (`competitors.md` §3). This is a defensible, checkable, first-to-market advantage. **It only counts if the availability data is real and the confirmation actually sends** — a booking form that fails silently is worse than none (`AGENT-BRIEF.md` §5) |
| **D9** | **Name the exact part, brand and size, the way the shop already does** | The shop's own voice: *"Installed DIN80 Amaron Jade AGM battery"*, *"Replaced Steering Rack Assembly"*, *"265/65R17 RADAR RENEGADE R/T+"* (`facebook-intel.md` §2.12). **Concrete specificity is a stronger trust signal than any adjective**, in a market where everyone says "quality service" |
| **D10** | **Claim only what is verifiable: "a listed Michelin and BFGoodrich dealer"** | ✅ **VERIFIED** — EYG appears in both official dealer locators (`facebook-intel.md` §2.6). Anyone can check it. It is the most credible sentence EYG can write, and it costs nothing to support |
| **D11** | **Do the job order BEFORE the work, with the odometer reading in and out** | 🔴 The single most effective consumer-protection practice available to a small shop (`legal-compliance-ph.md` §5). Protects the customer from an unjustified-bill claim **and** the shop from a theft allegation. One sheet of paper. **Highest-value ₱0 addition in this document** |
| **D12** | **Blur or crop every plate; never name a customer; alt text describes the work** | 🔴 Plates are LTO-issued and arguably **sensitive** personal information — RA 10173 Sec. 3(l)(3) (`legal-compliance-ph.md` §2.3). RA 10173 Sec. 16(f) creates a statutory **indemnity** for unauthorised use. Also a WCAG 2.2 requirement (`AGENT-BRIEF.md` §5) |
| **D13** | **Have a written, dated **job-order-before-work** process and an itemised receipt** | RA 7394 exposure on surprise charges is the #1 legal risk the pricing page creates (`legal-compliance-ph.md` §4.2). The receipt is the artefact that settles a dispute |
| **D14** | **Publish a written warranty — or state plainly that there is none** | Silence is not a warranty, and an implied one is a legal exposure. If there is one, it must state its **scope, period, and provider** — and distinguish EYG workmanship from manufacturer parts warranty (`legal-compliance-ph.md` §4.2) |
| **D15** | **Separate the transactional SMS consent from the marketing SMS consent, visually** | Different permissions, different legal bases (contract vs consent), and dark-patterning them fails twice — legally and as trust (`legal-compliance-ph.md` §2.4, §7.3). `CreateBookingInput` already models them separately; the UI must match |
| **D16** | **Honour STOP, promptly, and keep a real suppression list** | An ignored opt-out is a continuing breach, and spam complaints are how a small PH business attracts regulatory attention (`legal-compliance-ph.md` §3.2). Build it as a feature, not a manual task |
| **D17** | **Gate `/admin` with authentication, `noindex`, and `Disallow:` in robots.txt** | 🔴🔴 A publicly-indexable booking board with names, phones and plates is **simultaneously** a RA 10173 Sec. 20(f) breach, a **Sec. 26 negligence offence (1–3 years, ₱500,000–₱2,000,000)**, and the worst possible first impression (`legal-compliance-ph.md` §2.8) |
| **D18** | **Name a DPO and publish their name and contact details** | RA 10173 Sec. 21(b): the PIC *"shall designate an individual… The identity shall be made known to any data subject upon request."* Sec. 16(b)(6) requires it in the privacy notice. **The owner needs to be able to answer "who is responsible for your data?" today** |
| **D19** | **File the notarised Annex 1 (NPC Circular 2022-04) if not registering voluntarily** | EYG is below all three mandatory thresholds, so registration is not required — but filing Annex 1 is, and it is legally binding (`legal-compliance-ph.md` §8.2). Registration status changes **none** of the DPA's substantive duties |
| **D20** | **Reuse the shop's own structural template** — emoji section breaks, action verbs in past tense, Title Case service names, exact sizes, the `🖤💛 … 💛🖤` motif | This is EYG's **actual, established voice**, observed across 8+ posts (`facebook-intel.md` §2.12). Copying it makes the website feel like the same business as the Facebook page — which is what a customer expects. Inventing a different voice breaks the continuity |
| **D21** | **Use the real job photos, cropped to the work** | EYG has 15 verified job photos of real completed work — steering rack, AGM battery, brake and alignment (`facebook-intel.md` §2.11.3). In a town this size the customers know what EYG's bay looks like. **Real beats stock every time, and stock would be caught** |
| **D22** | **Get the NAP byte-identical across website, GBP, both FB pages, balanga.com.ph, Waze, Apple Maps** | Local ranking is decided on NAP consistency, and EYG currently has **two addresses and two phone numbers in the wild** (`facebook-intel.md` §2.4, §2.6). Until this is resolved, every SEO effort is leaking |
| **D23** | **Create the Google Business Profile — it does not exist** | 🔴 The highest-impact action in this entire build. It is the primary "near me" surface in PH local search, it is free, and EYG has **none** (`seo-keywords.md` §4 item 1) |
| **D24** | **Ask Michelin and BFGoodrich to correct the dealer record** | EYG is filed under **Batangas** with Batangas City coordinates and is **absent from the Bataan index** (`facebook-intel.md` §2.6). Free, high-value branded traffic that the website cannot fix on its own. Only the authorised dealer can request it |
| **D25** | **Take a job without a written job order? Never. Return the car with an itemised receipt? Always.** | See §6 item 9 for the full shop-floor protocol. The website cannot fix a shop that takes cars without paperwork — but the website *creates the pressure* to fix it, by making the job-order reference visible to the customer |
| **D26** | **Fix the fabricated values in `site.ts` before launch** | `phoneE164: "+639000000000"`, `whatsappNumber: "639000000000"`, `hello@eygtireautocare.ph`, `ratingValue: 4.9`, `ratingCount: 0`, `workmanshipGuaranteeDays: 30`, `foundedYear: 2024`, `SITE.twitter`, 5 of 6 `tireBrands`, the whole `paymentMethods` array. **Every `tel:` and `wa.me` link is currently broken and every trust claim is currently a lie** (`facebook-intel.md` §6) |
| **D27** | **Show the customer the old tyre** | Standard industry practice, near-universal, and it is the best available trust device. Costs nothing, and it is exactly what EYG's market is missing (`legal-compliance-ph.md` §4.4) |
| **D28** | **Be the shop that tells you what it costs before you leave home** | ✅ **The entire strategy, in one sentence.** 138 registered automotive businesses in Balanga City; **not one of the five I read in full publishes hours, prices, or a booking** (`competitors.md` §3). This is an *observable fact*, not a marketing claim — which is why it is bulletproof |

---

## 2. The DON'T table

| # | DON'T | Why |
|---|---|---|
| **N1** | 🚫 **Don't invent facts.** Phone, email, hours, prices, warranty, ratings, years in business, bay count, technician count, brand partnerships, "certified", "authorised" | `AGENT-BRIEF.md` §5. Concretely: `site.ts` currently ships **nine** fabricated or placeholder values (`facebook-intel.md` §6). Each one is either a broken link or a false statement a customer can disprove |
| **N2** | 🚫 **Don't fake urgency.** No countdown timers, no "3 slots left", no "closing soon", no "hurry, sale ends tonight" | `AGENT-BRIEF.md` §5. **Named failure mode: EYG's own expired promo.** "Special Opening Treat: The first 20 customers will receive FREEBIES!" was posted **2025-12-09** and is **10 months expired** (`facebook-intel.md` §2.8). Recycling it would be a false "current offer" under the Consumer Act. **Three bays and 308 followers do not have real scarcity — a fake count is instantly falsifiable by the shop's own customers** |
| **N3** | 🚫 **Don't do price bait.** A rock-bottom headline price for a service nobody can get at that price | **Named failure mode: the industry's core sin.** The bait is the tyre; the switch is "your brakes need cleaning", "that sidewall is cracked", "we need to balance it". RA 7394 deceptive-practice exposure (`legal-compliance-ph.md` §4.2), and it is the reason nobody trusts tyre advertising. **The site's own honesty is the product** |
| **N4** | 🚫 **Don't hide fees.** No tax, disposal, "shop supplies", or diagnostic fee appearing for the first time at handover | **Named failure mode: the surprise charge.** The most common auto-shop complaint in the Philippines. Every charge belongs on the job order **before** the work (`legal-compliance-ph.md` §4.2) |
| **N5** | 🚫 **Don't let the quote move after the customer agrees to it** | Any increase needs a new, explicit agreement. Silent escalation converts a customer into a public 1-star review, and in a 138-business market a bad review is materially expensive (`competitors.md` §2) |
| **N6** | 🚫 **Don't do scope creep.** Never add work the customer did not approve | If the tyre is damaged beyond use, **say so and stop.** Proceeding without asking is the behaviour that ends a business relationship and a Facebook reputation simultaneously |
| **N7** | 🚫 **Don't take a car without a proper job order** | See §6 item 9. Without one there is no baseline, no defence against a theft allegation, no way to settle a dispute, and no way to show the customer what was and wasn't done |
| **N8** | 🚫 **Don't publish an unverified claim as fact.** "Certified", "licensed", "authorised dealer", "official distributor", "genuine parts only" | Each is either unfalsifiable or contractually owned by someone else. **There is no general Philippine mechanic-licensing scheme to point at** — the real, citable credential is **TESDA**, and it must be named with its qualification and year (`legal-compliance-ph.md` §6). The copywriter's biggest temptation is a signboard someone else wrote |
| **N9** | 🚫 **Don't use dark patterns.** No pre-ticked boxes, no "Accept" brighter than "Decline", no decline hidden in smaller grey type, no forced account creation, no cart-abandonment trickery, no "are you sure you want to leave" on the phone number | `AGENT-BRIEF.md` §5. Beyond ethics: **a bundled or pre-ticked marketing consent is not valid consent** under RA 10173, so a dark pattern both deceives the customer and destroys the legal defence (`legal-compliance-ph.md` §2.4) |
| **N10** | 🚫 **Don't use a cookie wall or a modal interstitial** | `AGENT-BRIEF.md` §5. **And it is commercially self-defeating:** the brief's #1 hard rule is a phone number within one thumb-reach, and the top of the funnel is a phone call (`AGENT-BRIEF.md` §1). **A wall between a stranded driver and a phone number is a wall between the business and its revenue.** The privacy page's promise that you can still call with cookies blocked must be **true** |
| **N11** | 🚫 **Don't ship a form that fails silently.** Every submit needs pending / success / error states | `AGENT-BRIEF.md` §5. **Named failure mode: §4 item 2.** A customer who thinks they have booked a bay and has not will arrive anyway — or worse, not arrive, and never re-book. From the shop's side a silent failure is an invisible lead leak that nobody ever notices |
| **N12** | 🚫 **Don't add colour as the only signal** | `AGENT-BRIEF.md` §5, WCAG 2.2. Pair every colour state with an icon **and** text. In a bay full of yellow-and-black, "the yellow one is selected" is not an interface |
| **N13** | 🚫 **Don't cause layout shift.** Set width and height on every image, reserve space for dynamic content | `AGENT-BRIEF.md` §5 — CLS is a Core Web Vitals failure **and** a WCAG 2.2 concern. On a ₱3,000 Android over 3G (`AGENT-BRIEF.md` §5) a jumping page is a page that gets closed |
| **N14** | 🚫 **Don't ship placeholder text.** No "Lorem", no "TODO", no `example.com`, no `000-000-0000`, no dead `#` links, no `href="#"` | `AGENT-BRIEF.md` §5. A `+639000000000` phone link is the canonical example: it looks fine in code review and fails 100% of the time in the shop |
| **N15** | 🚫 **Don't publish a plate number, a customer name, or an unconsented face** | 🔴 RA 10173 Sec. 3(g) and arguably Sec. 3(l)(3); Sec. 16(f) creates a statutory **indemnity** (`legal-compliance-ph.md` §2.3, §2.6). Also: **a plate in a URL is a public, indexable, shareable identifier** — never |
| **N16** | 🚫 **Don't add `AggregateRating` to the schema** until a real Google rating exists | `trust.ratingValue: 4.9` with `ratingCount: 0` is self-evidently fake, and **invalid structured data is a manual-action risk**. EYG has **no Google Business Profile at all** (`facebook-intel.md` §3) |
| **N17** | 🚫 **Don't emit `Product`, `Offer` or `PriceSpecification` schema from a guessed price** | Rich-result markup for a price you cannot honour is a Consumer Act exposure and a guidelines violation (`legal-compliance-ph.md` §4.3) |
| **N18** | 🚫 **Don't put secrets in client bundles.** Anything `NEXT_PUBLIC_*` is public forever | `AGENT-BRIEF.md` §5. Relevant here: the SMS gateway credentials and any Map/analytics API key must be server-side. A leaked SMS key is a bill and a spam relay |
| **N19** | 🚫 **Don't use `any`, `@ts-ignore`, or `eslint-disable` to silence a real problem** | `AGENT-BRIEF.md` §5. The likeliest instance in this build: typing around the `noUncheckedIndexedAccess` flag on a phone-number or price field. **That is exactly where the fabrications live** — do not let a type error be papered over in the one file every other agent reads from |
| **N20** | 🚫 **Don't let an unhandled promise rejection or console noise reach production** | `AGENT-BRIEF.md` §5. In this build the specific case is the booking submit: a rejected fetch with no error state is failure mode N11 |
| **N21** | 🚫 **Don't reuse the expired "first 20 customers FREEBIES" offer** | ✅ **CONFIRMED expired 2025-12-09** (`facebook-intel.md` §2.8). Reusing a 10-month-old opening promo is a false "current offer" under the Consumer Act **and** would be instantly visible to the shop's own followers |
| **N22** | 🚫 **Don't claim "the only tyre shop on EGSA Fourlanes"** | 🚨 **FALSE.** **Jed-M Tires & Batteries & Service Center is registered at "4 Lanes Egsa, Tuyo"** — the same street (`competitors.md` §1.1). A demonstrably false claim about an identifiable local competitor, in a 138-business market, is a defamation risk and a self-inflicted review disaster |
| **N23** | 🚫 **Don't claim any year — "since 20XX", "serving Balanga for N years"** | **Four contradictory answers exist:** Facebook `foundingDate` 2025-10-19 (Auto Care page), 2021-03-18 (EYG TIRE TRADING page), doors-opened 2025-12-09, the brief's "March 2025", and `foundedYear: 2024` in `site.ts` (`facebook-intel.md` §2.1, §4). **Claim no year until the owner settles it** |
| **N24** | 🚫 **Don't claim roadside assistance / 24-hour service** | 🚨🚨 **ZERO EVIDENCE IT EXISTS** — not on either Facebook page, not in the Michelin or BFGoodrich listings, not in the city directory. Yet it is Lane A of the whole funnel. **A stranded driver calling an "emergency" number that nobody answers is a safety problem, not a marketing one.** Do not write it, do not target the keyword, do not put it in a meta description (`seo-keywords.md` Cluster G) |
| **N25** | 🚫 **Don't offer undercoating until the owner confirms the service exists** | 🚫 **Not on the verified 10-item list.** The verified service is *"Underchassis Maintenance and Repair"* — a **different thing**. Yet undercoating is a genuinely strong Bataan category (Subic, Baguio, Cubao trips), which is exactly why faking it would be found out (`seo-keywords.md` Cluster F) |
| **N26** | 🚫 **Don't publish a rating, a review count, or a testimonial with a made-up person** | `AGENT-BRIEF.md` §5. "Fake reviews, invented customer names" is named explicitly. **And in Balanga, an invented customer name is verifiable by asking one person** |
| **N27** | 🚫 **Don't use stock photos as EYG's work, bay, or team** | `AGENT-BRIEF.md` §5. Beyond the ban: EYG's customers know what the shop looks like. A stock photo of a different shop's bay is the most laughable possible lie in a town this size. Use the 15 real job photos already extracted |
| **N28** | 🚫 **Don't name competitors disparagingly** | No "the shop down the road overcharges", no naming Jed-M, CMC, Motorlandia. **Defamation exposure, and it insults a customer-facing neighbour.** Win on your own information, never on someone else's reputation |
| **N29** | 🚫 **Don't send promotional SMS to anyone who has not opted in** | 🔴 RA 10173 **Sec. 28**: processing for an unauthorised purpose — **1.5 to 5 years and ₱500,000–₱1,000,000**. A number given for servicing carries no consent to be marketed to (`legal-compliance-ph.md` §3) |
| **N30** | 🚫 **Don't put "24/7", "open now", or "open late" in a meta description** | No after-hours service is evidenced (`facebook-intel.md` §4 Q14). A meta description promising availability that does not exist is the exact deceptive-representation shape (`legal-compliance-ph.md` §4.2) |
| **N31** | 🚫 **Don't make a claim you cannot evidence just because a competitor's signboard does** | This is the mechanism behind N8, N22, N23, N24, N25. **In a 138-business market, the most common untrue claim on a local site is one copied from a neighbour.** Each of EYG's claims must survive a customer checking it |
| **N32** | 🚫 **Don't over-claim from a dealer listing.** "Listed dealer" ≠ "authorised dealer" ≠ "official distributor" | EYG's verified status is a **dealer-locator record** (`facebook-intel.md` §2.7). Those are three different claims with three different evidentiary standards. Upgrading the wording is a legal claim about a contractual relationship the site cannot evidence |
| **N33** | 🚫 **Don't add a service EYG may not have, to look competitive** | Three local competitors already advertise AC work (Allen, Justine Angelos, Vernick). The temptation to match them is obvious. **If EYG does not do AC, adding it means a customer drives over, waits, and is told no** — which is worse than the gap, because it also costs a review |
| **N34** | 🚫 **Don't put the booking form behind a login, a wall, or a multi-step gauntlet** | The 4-step `/book` flow is already at the limit. Every additional required field is a lost booking. Optional means optional: the plate and the email are genuinely optional (`legal-compliance-ph.md` §2.3) |

---

## 3. Deep dive: the three failure modes most likely to actually happen

Everything above is a rule. These three are the ones I expect to bite.

### 3.1 🔴 Fake urgency — the one that will be caught

**The failure.** A designer adds a red badge: *"3 slots left this Saturday!"* or a
countdown to a deal. It looks like urgency, it converts for about a week, and then it is
the story.

**Why it fails *here specifically*.** EYG has 308 followers in a city of 138 registered
automotive businesses where **the owner personally knows most of the other owners**. The
shop's real booking capacity is a handful of bays, visible from the forecourt. A fabricated
scarcity number is falsifiable by asking EYG's own customers, and **when it is
falsifiable, it stops being marketing and becomes gossip.**

**The compounding problem.** EYG's *one* expired promo is already public. "First 20
customers get FREEBIES" is in the Facebook record from 2025-12-09, visible to anyone who
scrolls. So a 308-follower shop attempting manufactured urgency is attempting it **in a
community that can read its own history.**

**The rule that replaces it.** Bounded capacity is *real* — but **never fabricate it.**
Say the true thing:
- ✅ "3 bays. Book the 8:30 AM slot." — real, useful, honest
- ✅ "Open Monday to Saturday, 8 AM to 5 PM." — verified, and no local competitor says it
- ✅ "We take 4 PMS jobs a morning. Book ahead." — if that is the true number
- ❌ "Only 2 slots left!!!" — when there are 9

**Test before shipping:** *could the shop's own receptionist prove this claim is true?* If
not, it does not ship.

### 3.2 🔴 Price bait → bait-and-switch, the trust-destroying sequence

**The failure.** Publish an attractive headline price. The customer arrives. The tyre is
damaged; the rims need straightening; the brakes "really need cleaning"; the car "needs
balancing". The final invoice is 2.5× the headline. The customer posts about it, and the
post lives forever.

**Why it is the industry's defining failure.** It is the reason tyre advertising is
distrustful, and distrust is the single most exploitable weakness in this market
(`competitors.md` §3: **nobody local publishes a price at all**, so every customer
arrives with zero price information and maximum suspicion). **That suspicion is EYG's
opportunity — and bait-and-switch is how you would destroy it.**

**The sequence, and the specific moments it goes wrong:**

| Moment | What goes wrong | Prevention |
|---|---|---|
| 1. The advert | Headline price is for something the customer cannot get at that price | N3. A range's low end must be genuinely payable |
| 2. Arrival | Staff discover more work and the price moves | N5, N6. **Stop and ask.** Every time |
| 3. The estimate | Charges appear that were not on the advert | N4. Everything on the job order, before work |
| 4. Handover | The invoice is higher than the estimate with no explanation | This is where the review is written |
| 5. The review | Public, permanent, in a market where reputation is the business | The only fix is upstream |

**The protocol that replaces it** — and it is genuinely better business, not just safer:

1. Advertise the **complete installed price**, or state the fitting cost in the same breath.
2. **If you find damage, stop and ask.** Never proceed on inference.
3. **Every charge on the job order before the work starts.** Signed.
4. **Odometer in and out.** It settles disputes in both directions. (D11)
5. **Show the customer the old tyre.** (D27)
6. **The public promise, on the website:** *"Tyre price includes mounting and balancing. If
   we find damage, we stop and ask first — we never add work you did not approve."*

That last sentence is the whole competitive strategy expressed as a customer promise. It
is **entirely true of an honest shop**, it costs nothing, and **no competitor in Balanga
can say it** — because most of them are doing the thing it forbids.

### 3.3 🔴 The bad-review failure mode — why reputation is the actual business

**The reality of a 308-follower local shop.** There is no corporate reputation buffer.
A single 1-star review does not dent a national chain; on a business whose entire
differentiator is *"people here know and trust us"*, **it is the business**.

**The chain, and each link is preventable:**

```
A price surprise at handover
        ↓
"Ang bait na pala 'yan."          ← said to a friend, at the counter, in a queue
        ↓
A Facebook comment on the page     ← 308 followers see it instantly
        ↓
A Google review, once a GBP exists  ← permanent, searchable, ranked
        ↓
A competitor's counter-script       ← "Ayon po, sa kanila kasi ganyan."
        ↓
Price-shopping becomes the default
```

**The specific triggers, ranked by likelihood in this business:**

| Trigger | Likelihood | Prevention |
|---|---|---|
| Final invoice higher than the estimate | 🔴 **High** | D13, N4, N5. Job order before work |
| A tyre sold as fine, then found damaged | 🔴 **High** — it is the transaction type EYG does (individual tyres out of stock, `facebook-intel.md` §2.11.3) | D5, N6. Stop and ask |
| "Ang tagal naghintay ko" — waiting longer than quoted | 🟡 **Medium** | Publish realistic durations. **A quoted 2 hours that takes 3 is a complaint; an honest "3–4 hours" that takes 4 is not** |
| Job not done properly, first time | 🟡 **Medium** | The written rework policy (D14). **And: fix it immediately and say so publicly.** A shop that publicly fixes a mistake in the comments is *more* trusted than one with no reviews |
| The promised phone number is dead | 🔴 **High right now** — `+639000000000` is live in `site.ts` | D26. **This is the most likely first review EYG will ever get, and it is entirely self-inflicted** |
| Wrong hours published, customer arrives on Sunday | 🟡 **Medium** | D1, D6. Sunday-closed is verified; get it right |
| A customer's plate published and misused | 🟡 Low likelihood, 🔴 **high impact** | N15, D12. Statutory indemnity under Sec. 16(f) |

**The reputational playbook, for a small shop:**

| Situation | Do this | Never this |
|---|---|---|
| A legitimate complaint arrives publicly | Reply **within the hour**, acknowledge specifically, state what you will do, do it, then say publicly that it's done | Defend, deflect, or stay silent |
| It is your fault | Say so plainly. Fix it. Offer the remedy. | Blame the customer, the manufacturer, or the previous owner |
| It is not your fault | Explain once, calmly, with the receipt. Then stop. | Argue in a comment thread for three days |
| A fake or malicious review | Reply once, factually, and report it to Google | retaliate, or publish the reviewer's details |
| You cannot fix it | Say so. Offer what you can. | Overpromise to make the thread go away |

**The single most valuable reputation asset EYG can build** is a long, honest public record
of the same thing the website says: *"we tell you the price first."* In a market where
that is genuinely rare, **consistency between the promise and the forecourt is worth more
than any marketing spend available to a shop this size.**

---

## 4. The 12 ways a small auto-shop website fails in the Philippines

Ranked by how often it actually happens. **Each has a mitigation, and most have an owner.**

### 1. The site loads, and nobody calls

**How it happens.** The site is a beautiful brochure. The phone number is in the footer, 4,000 px down, in 14 px grey text. On a phone, a driver in traffic cannot find it, cannot tap it, and gives up in nine seconds.

**Why it's #1.** The entire top of the funnel is a phone call during working hours (`AGENT-BRIEF.md` §1). Everything else is secondary.

**Mitigation.** Persistent, thumb-reachable call button on **every** viewport, always. Minimum 48×48 px touch target, WCAG 2.2 AA. Above the fold on `/`. Bottom bar on mobile. Plus `tel:` and `wa.me` in the header, the hero, the footer, `/contact`, the error pages, and the footer of `/privacy` and `/terms`. **Phone-first, not phone-also.**

**Owner:** frontend-core, widgets.

### 2. The owner never checks the form, so bookings die invisibly

**How it happens.** The form works in dev. In production it silently 500s, or the SMS gateway has no credit, or the DB write fails. Nobody notices for three weeks. Meanwhile, forty customers filled it in and believed they had a booking.

**Why it's worse than an outage.** The failure is **invisible from the outside** — the customer sees a success state. This is exactly what `AGENT-BRIEF.md` §5 bans ("a form that fails silently") and it is the most expensive class of bug in this build, because it produces *silent* lead loss.

**Mitigation.** Four things, all mandatory: (a) a real error state on every submit, never a fake success; (b) a **daily digest of bookings to the owner's phone** so a zero-booking day is noticed; (c) a **health check that alerts when the SMS send fails**; (d) a monthly manual test booking, end to end, from a real phone on mobile data.

**Owner:** backend-core (a, c), backend-integrations (b), qa (d), devops (c).

### 3. The WhatsApp number is wrong, old, or a personal number that was changed

**How it happens.** The owner gets a new SIM, or the number was a temporary one, and the site still points at the old one. Or it was set from a screenshot. Or it is the *tyre shop's* number, not the service centre's.

**Why it is severe here specifically.** 🚨 **`whatsappNumber: "639000000000"` is live in `site.ts` right now** — a placeholder. And EYG has **two real numbers** for two locations (`facebook-intel.md` §2.4). A wrong WhatsApp link is a worse failure than a missing one: it looks like it works and it does not.

**Mitigation.** Owner confirms the number in writing. Use the **same** number for `tel:` and `wa.me` unless the owner explicitly wants two. Test both from a real phone, on mobile data, before launch. **Add a "wrong number? Tell us" link in the footer** so it is self-correcting.

**Owner:** owner (decision), orchestrator (config), qa (test).

### 4. No Google Business Profile — or one that is unclaimed and wrong

**How it happens.** The shop is on Facebook and thinks that's enough. "near me" searches resolve to a competitor's Maps listing, or to a third-party directory the shop never created.

**Why it's severe here.** 🔴 **EYG has no GBP at all** (`facebook-intel.md` §3). The GBP is the primary "near me" surface in PH local search, and "near me" is the cluster EYG's EGSA location is best suited for. Missing it means **the highest-intent searches in the cluster EYG wins on are structurally invisible.**

**Mitigation.** Create it, claim it, verify it, fill in **real hours (D1)**, add **real photos (D21)**, write the description using the **verified** service list (D2), and make the NAP **byte-identical** to the website (D22). Then maintain it: a GBP with stale hours is worse than none.

**Owner:** owner (needs a Google account + postcard/phone verification), marketing (listing copy), orchestrator (NAP consistency).

### 5. The site is slow on a cheap Android over 3G

**How it happens.** A 4 MB hero image, four web fonts, an analytics tag, a chat widget, and a map embed. On a ₱3,000 Android on 3G, that is a 15-second white screen. The driver gives up and calls the next shop.

**Why it's severe here.** `AGENT-BRIEF.md` §5 sets this as an explicit constraint. **The target device is a real, named device class, and the target network is the most common mobile network in the customer's province.**

**Mitigation.** Self-hosted fonts with `display: swap` (`AGENT-BRIEF.md` §2). Every image sized, `next/image`, explicit `width`/`height` (N13). One hero image, compressed. **Defer or drop analytics.** Lazy-load below the fold. Budget: **interactive in under 3 seconds on a throttled 3G profile.** Test with DevTools CPU + network throttling, not on office wifi.

**Owner:** frontend-core, devops, qa.

### 6. The NAP is wrong on at least one surface

**How it happens.** The site says EGSA Fourlanes. The Facebook page says EGSA Fourlanes. balanga.com.ph says 183 Calero St. (because that is the *registered* tyre business). The Michelin locator says Batangas. Google has no record. A customer calls, drives to the wrong address, and never comes back.

**Why it's severe here.** 🚨 **All five of those are currently true simultaneously** (`facebook-intel.md` §2.4, §2.6). This is not a hypothetical — it is the *present state* of EYG's local presence, and it is destroying more value than any design decision on this list.

**Mitigation.** The owner decides **one primary NAP**. The site, the GBP, both FB pages, balanga.com.ph, Waze, Apple Maps and the schema all carry it **byte-identically**. If the tyre shop at Calero St. is a real second location, list it as a **second location** with its own data — never as a conflicting primary. Ask Michelin and BFGoodrich to fix their record (D24).

**Owner:** owner (decision), orchestrator (site), marketing (all surfaces).

### 7. The prices on the site are wrong, or the range's bottom is unreachable

**How it happens.** Someone copies industry figures into `content/services.md` and the site ships. A customer arrives expecting ₱1,200 and is quoted ₱2,100. The gap between the *promise* and the *forecourt* is where the 1-star review is born.

**Why it's severe here.** **This project is about to invent a complete price list, because EYG has never published one** (`facebook-intel.md` §2.9). Every number will be an analyst estimate. **The risk is not that the numbers are wrong; it is that they ship without sign-off.**

**Mitigation.** 🚫 **No price ships until the owner signs it off** (D3, `legal-compliance-ph.md` §4.3). The low end of every range must be genuinely payable. The variable that moves the price must be named. Every estimate confirmed in writing before work. **And run the "can my receptionist prove this?" test on the price page, the same as the urgency test.**

**Owner:** owner (non-negotiable), research (markers), marketing (page).

### 8. Nothing is ever posted, so the site goes stale and Google stops caring

**How it happens.** The site launches. Nothing changes for six months. Google sees a dead local site. The Facebook page goes quiet. Traffic decays to zero and nobody notices because traffic was never measured.

**Why it's severe here.** 🚨 **EYG's own cadence proves the risk:** the tyre-stock posts are from **September 2024**; the service posts are **May, July and August 2026**. There are visible gaps. A website does not fix an absent content habit.

**Mitigation.** One Facebook post a week, reusing the shop's own template (D20) — a job done, a tyre in stock, a tip, a seasonal reminder. **Repost every one to the site.** One site update a quarter: a new photo set, a FAQ answered properly, a price corrected. **And actually look at Search Console at 30 and 90 days** (`seo-keywords.md` §5).

**Owner:** owner (posts — this is the one thing only they can do), marketing (repurposing), qa (measurement).

### 9. A review arrives that is unfair, and it is handled badly

**How it happens.** A one-star review. The owner replies defensively, argues for three days in the comments, or does not reply at all. The thread becomes the story.

**Why it's severe here.** A 308-follower shop has **no buffer.** §3.3 is the full analysis.

**Mitigation.** The playbook in §3.3. Reply **within the hour**, acknowledge specifically, state the remedy, deliver it, then say publicly that it's done. **A shop that publicly fixes a mistake is more trusted than one with no reviews at all.** Never argue, never retaliate, never publish a reviewer's details.

**Owner:** owner (this is a personality question, not a marketing one — the orchestrator should brief the owner directly).

### 10. Someone copies a service, a price, or a claim from the site and it is wrong

**How it happens.** A competitor's staff screenshot the price list. Or a customer quotes the site in a dispute and it disagrees with the forecourt. Or an aggregator scrapes a `SUGGESTED` price and republishes it as EYG's.

**Why it's severe here.** **The price list is the entire differentiator, which makes it the entire attack surface** (`competitors.md` §3). Prices that are wrong are worse than no prices.

**Mitigation.** Owner sign-off (same as #7). State clearly on the page that ranges are indicative and confirmed on the job order — that is honest, and it is also a **defence**. Do not put a price in a URL or a query parameter. Be aware that **everything published is copyable** and design for it: the differentiator is the *reliability of the quote*, not the secrecy of the number.

**Owner:** owner, legal, marketing.

### 11. A government, bank, or telco SMS compliance rule changes and the flow breaks silently

**How it happens.** SMS is the confirmation channel. A gateway's sender ID is unregistered, a number is reclassified, or a consent rule tightens. Messages stop delivering. Bookings keep "succeeding" on the site. Nobody finds out until a customer says *"I never got your message."*

**Why it's severe here.** SMS is load-bearing for the whole funnel, and it is a regulated channel in the Philippines — the exact area where this research found the most legal uncertainty (`legal-compliance-ph.md` §3.1: the NPC direct-marketing circular was `⚠️ SOURCE NOT RETRIEVED`).

**Mitigation.** Never make SMS the *only* confirmation — always show it on screen too, so a failed send is visible. **Monitor delivery status**, not just send status. **Never send promotional SMS without consent** (N29) — the fine is 1.5 to 5 years and ₱500,000 to ₱1,000,000. Have a phone number the customer can use if SMS does not arrive. **And obtain the NPC circular before launch** (`legal-compliance-ph.md` §9 item 10).

**Owner:** backend-integrations, owner, legal.

### 12. The website gets no traffic, and the owner concludes the website doesn't work

**How it happens.** Launch. Three weeks. 40 visits, 2 calls. The owner concludes it was a waste and stops posting about it, stops maintaining it, and the death spiral completes.

**Why it's severe here.** 🚨 **EYG is on the second page of every search that matters.** All five local listings I read publish **no hours, no prices, no service list** (`competitors.md` §3). Local SEO is a **months-long** discipline and a brand-new domain has no authority at all. The website is a compounding asset, not a switch.

**Mitigation.** Set the expectation **before launch**, with the owner, in writing: **90 days minimum, GBP live in week 1, posts weekly, Search Console at 30/60/90.** Judge it on **calls and bookings**, not visits. Track "how did you hear about us?" on every single booking — **for a business this size that single field beats any analytics tool** (`seo-keywords.md` §5).

**Owner:** owner (the expectation-setting conversation), orchestrator (the measurement), marketing (the reporting).

---

## 5. 🔴 The single highest-risk claim in the build

**Roadside assistance.**

| Fact | Source |
|---|---|
| The brief makes **roadside Lane A** of the conversion ladder — the stranded-driver-to-rescue path is the primary conversion in the entire funnel | `AGENT-BRIEF.md` §4 |
| **There is ZERO evidence EYG offers any roadside or 24/7 service** | Not on either Facebook page; not in the Michelin or BFGoodrich listings; not in the 138-listing city directory (`facebook-intel.md` §3) |
| The nearest identifiable real towing operator in the city directory is **MDE Towing Service** | `competitors.md` §1.2 Tier B |
| Hours are **Mon–Sat 08:00–17:00**, Sunday closed — **verified** | `facebook-intel.md` §2.2 |
| `BUSINESS.breakWindows` includes a **12:00–13:00** lunch break, and capacity is 3 per slot | `src/config/site.ts` — so the shop models itself as **closed for an hour at midday** |

**Why this is the top risk, not just another unverified claim.** It is the only
unverified claim in the project that is attached to a **safety scenario**. A driver with
a flat at 19:00 on a Sunday, seeing "24/7 roadside assistance Balanga" in a search result,
pulls over and calls. Nobody answers — the shop is closed, and the shop's own published
hours say so, which makes the advertisement a lie that only the customer finds out.

**Three possible resolutions. Only the owner can choose.**

| Option | What ships | Trade-off |
|---|---|---|
| **A — EYG runs real after-hours roadside** | The full Lane A funnel, honestly | Requires a genuinely staffed, genuinely answered service. **Only do this if it is true** |
| **B — EYG does not (most likely)** 🚨 **recommended** | **No roadside keyword, no "24/7" claim, no emergency copy.** Instead: *"Got a flat? Here's what to do, and here's what we can do when we open."* The honest version **still converts** — it wins on not wasting a stranded driver's time, and it is true | Forfeits the highest-intent query in the market. **Acceptable** — a shop that cannot deliver it should not claim it |
| **C — EYG partners with a real towing operator** | *"Roadside partner"* — named, with the partner's number | Requires a real agreement. Do not imply EYG is doing it |

**Until the owner answers, the recommendation is Option B**, and the site should convert
the intent rather than claim the service: the FAQ entry *"Do you do roadside assistance?"*
answered honestly, plus *"What should I do if I get a flat?"* — genuinely useful, fully
deliverable, and it captures the search without a claim that cannot be kept.

---

## 6. Shop-floor protocol the website depends on

The website cannot fix a shop that operates differently. But the website creates the
pressure to fix it, because it makes promises the forecourt has to keep.

### 9. Never take a car without a job order

**The named failure mode.** A car arrives, there is nothing written down, and afterwards
there are three unanswerable questions: *what did the customer authorise? what was the
mileage when it arrived? what exactly did we do?* The shop is exposed to a theft
allegation, an unjustified-bill allegation, and has no defence to either.

**Every job, no exceptions, including a free air-con check:**

| Field | Why it exists |
|---|---|
| Job-order reference — matching the website booking | Links the physical job to the digital record. Makes a disputed charge trivially checkable |
| Date and time in, date and time out | These diverge constantly. Disputes turn on them |
| **Odometer reading IN** 🔴 | **The shop's own evidence that nothing extra happened while the car was with them.** Protects against an unjustified-repair claim |
| **Odometer reading OUT** 🔴 | The customer's evidence. They can check it against their own dash |
| Customer name and mobile | For the receipt and the confirmation |
| Vehicle make, model, **plate** | The plate links the receipt to the job. **This is why the plate belongs on paper and not on the website** (`legal-compliance-ph.md` §2.3) |
| Requested work, itemised | The baseline. **Nothing outside this list happens without a new, signed authorisation** |
| **Estimated cost, itemised** | Labour and parts separately. Every fee that could be charged later appears here |
| **Customer signature** | The anchor. Digital acknowledgement is acceptable if it is recorded |
| Authorisation box for extra work | A second signature for anything found during the job |

**The odometer line is the cheapest insurance in this document.** One line, two numbers,
and it settles the two most common categories of dispute in both directions.

### The rest of the floor protocol, briefly

| Rule | Why |
|---|---|
| **Stop and ask** before any work outside the job order | The bait-and-switch chain, §3.2 |
| **Every charge on the estimate** | The surprise charge is the #1 complaint |
| **Show the customer the old tyre** | Trust, and it forecloses a dispute |
| **Old tyres returned, or disposal agreed and priced in advance** | Silent disposal of a customer's property is its own complaint |
| **Itemised receipt, every time** | Name, address, TIN, both dates, vehicle, odometer, itemised labour, itemised parts with brand and part number, oil spec and volume, subtotal, total, job-order reference, warranty (or its explicit absence), signature |
| **Warranty stated in writing, or stated as absent** | An implied warranty is a legal exposure (`legal-compliance-ph.md` §4.2) |
| **Never promise a time you cannot hold** | A quoted 2 hours that takes 3 is a complaint. An honest "3–4 hours" that takes 4 is not |
| **The old tyre, the old part, or the old fluid goes back to the customer** | Standard practice. Cheapest trust device available |

---

## 7. The one-page summary to hand to every agent

**Before you write any code or any copy, check these ten:**

1. **Is this fact verified?** Not "is it plausible" — **verified**, with a source in
   `docs/research/`. If not: it does not ship.
2. **Does the owner have a `TODO-VERIFY` open on it?** If yes, it is not a fact yet.
3. **Is this a place where a customer can be surprised by money?** If yes, it needs the
   full chain: range → job order → itemised receipt.
4. **Is this a plate, a name, or a face?** If yes, it does not go on a public page.
5. **Is this a scarcity, a countdown, or a rating?** If yes, can the shop's own
   receptionist prove it? If not, it does not ship.
6. **Am I copying a claim from a competitor's signboard?** If yes, it is probably false.
   Verify it independently or cut it.
7. **Is this a brand, warranty, certification, or authorisation claim?** It must be
   **naming the certifying body**, and the body must be able to confirm it.
8. **Does this respect the DPA?** Lawful basis, minimal data, two separate consents,
   retention, and no `/admin` exposure.
9. **Would this work on a ₱3,000 Android over 3G, in traffic, one-handed?**
   **If not, it does not exist.**
10. **Is there a phone number within one thumb-reach?** If not, the page is not finished.

**And the one sentence that decides the strategy:**

> **Nobody in Balanga publishes their hours, their prices, or a way to book. EYG will
> publish all three, and keep the promise at the forecourt. That is the whole business
> case, and it only works if it is true.**
