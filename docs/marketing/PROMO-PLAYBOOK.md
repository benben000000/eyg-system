# PROMO PLAYBOOK — EYG Tire & Auto Care

> **Owner:** marketing agent · **Status:** ready for owner sign-off
> **Applies to:** every price, discount, code, bundle and "offer" that goes on
> Facebook, the website, the counter board, or a message to a customer.
> **Read this before building any campaign.** It exists because the fastest way
> to ruin a small tyre shop is to discount your way out of business.

---

## 0. The situation this playbook is written for

A tyre and auto care shop on EGSA Fourlanes, Tuyo, Balanga City. Open 2025.
308 Facebook followers. Two competitors within a few minutes' drive, plus the
usual chain and dealer options further out.

Three things are true about how customers in this market buy:

1. **They hunt for a price on Facebook first.** Not for you specifically — for
   "tire shop Balanga" or a group post — but before they will drive to Tuyo.
2. **They are more afraid of being overcharged than of being charged.** This is
   the actual blocker. A customer who trusts the price is worth more than a
   customer won by a discount.
3. **They trust a nearby shop with visible people, visible work and fast
   replies.** Word of mouth is the first channel. Facebook is the second.

Everything below follows from those three facts.

---

## 1. What a promotion is FOR at this shop

Not for volume. For **three specific jobs**:

| Job | What it looks like | Why it works here |
| --- | --- | --- |
| **Lower the risk of the first visit** | First-visit discount, check-up offer | Buys permission for a stranger to try the shop |
| **Give an existing customer a reason to come back now** | Rainy-season bundle, tyre clearance | Repeats are 5–10× cheaper to win than strangers |
| **Make one thing easy to say** | Referral offer | Word of mouth is the main growth engine anyway |

**What a promotion is NOT for:** clearing a slow month by slashing prices.
That is what a 40%-off clearance does to a tyre shop, and it is why we do not
run one.

---

## 2. The four archetypes that work locally

Everything in `src/content/marketing/promotions.ts` is one of these. Nothing
else is approved.

### Archetype 1 — SEASONAL BUNDLE *(the workhorse)*

Tie three services to the one thing the customer already believes. The rains
are coming; they already worry about grip, wipers and brakes. You are not
manufacturing a fear, you are giving them a bounded task.

- **Name it after the season, not the discount.** "Rainy Season Safety Bundle",
  not "Save 30%".
- **Three items maximum.** More is not a bundle, it is a price list.
- **Depth: 20–28% off the à-la-carte total.**
- **Runs the whole season, not a weekend.** A rainy-season offer that expires in
  11 days teaches people your dates are meaningless.
- *Example:* `rainy-season-safety-bundle` → 28% effective.

### Archetype 2 — CLEARANCE *(narrow, honest, fast)*

Only for genuine overstock, aged stock, or a specific discontinued size.

- **Name the constraint.** "Listed sizes", "while the stock lasts."
- **Depth: 10% max.** Tyre buyers are brand-loyal. A deep tyre discount reads as
  a reseller, and a reseller does not do brakes.
- **Scope it to what exists.** Never advertise a size you cannot bolt on today.
- **Delete the post when the rack is empty.** A stale clearance post costs more
  trust than it ever earned.
- *Example:* `tyre-clearance` → 10% off listed stock.

### Archetype 3 — FIRST-VISIT RISK-OFFER *(the trust engine)*

The highest-converting offer this shop will ever run, because it targets the
real objection rather than the price.

- **15% max.** Deliberately shallow. A first-timer who gets a suspiciously cheap
  PMS assumes something was skipped.
- **One per person, tracked by phone number.**
- **Always paired with "final price confirmed after inspection".**
- *Example:* `first-visit-pms` → 15% off the PMS line.

### Archetype 4 — RELATIONSHIP / RECOGNITION *(the long game)*

Not a coupon. A named mechanic, a named customer, a birthday month, a referral
that is thanked out loud.

- **Fixed peso amount, not a percentage.** ₱300, not "10%".
  A percentage on a referred job distorts the referred customer's first
  impression of the price. A flat ₱300 reads as generous and leaves the
  invoice honest.
- **Threshold on the referred job** (₱1,500+) so it is not a giveaway.
- **No form.** Name mentioned at the counter. Anything more frictioned gets used
  zero times.
- *Examples:* `mechanic-birthday-special` (12%), `bring-a-neighbour` (₱300).

---

## 3. Naming rules

| Rule | Good | Bad |
| --- | --- | --- |
| Name the **situation**, not the number | "Rainy Season Safety Bundle" | "30% Off Promo!" |
| Name what is **included** | "Tire Inspection + Wiper Replacement + Brake Check" | "PROMO BUNDLE A" |
| Keep it under **6 words** | "Commuter Express PMS" | "Super Amazing Complete Service Package" |
| Codes are **short, loud, memorable** | `RAINYSAFE`, `FIRSTPMS` | `PROMO2026A`, `SPRINGX" |
| Never put **₱ or % in the name** | "Tyre Clearance" | "50% OFF SALE" |
| Never use **"Cheap", "Budget", "Murah"** | "Tyre Clearance" | "MURAH TIRE SALE" |

Codes are stored unique in `Promotion.code`. Choose something a customer can
read out loud on the phone without spelling.

---

## 4. How deep is too deep?

This is the part that gets shops into trouble.

### The "cheap shop" signal

Below roughly **20% off**, a discount stops being a reason to buy and becomes
the reason to doubt the quality. In tyre retail the customer's internal logic is:

> *"If they are cutting the price by a third, they must be cutting something —
> the part, the labour, or the honesty."*

And they are usually right.

### Discount depth ceiling

| Category | Max depth | Reasoning |
| --- | --- | --- |
| Labour-only services (rotation, balance, pressure check) | 25% | Almost pure margin, low perceived risk |
| Bundles (3 services) | 28% | The saving is visible and the components are explained |
| PMS / maintenance | 15–20% | Highly price-transparent already; deeper reads as a bait |
| **Tyres** | **10%** | Thin margin, brand-loyal buyers, "cheap tyre" stigma is the strongest in the category |
| Brakes | 20% | Safety purchase — a discount on brakes feels like a compromise |
| Undercoating / protection | 20% | Low frequency, needs explanation; discount devalues it |

**Hard ceiling: 30%. Nothing goes above it. Nothing goes above 20% on tyres.
If a promo needs 35% to be attractive, the promo is badly designed, not
insufficiently discounted.**

### Margin floors

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION.** These are starting points for a
Balanga shop, not verified cost data. The owner must replace every number with
actual supplier cost and actual bay rate before any campaign ships.

| Discount level | Minimum gross margin | Decision |
| --- | --- | --- |
| 0–10% off | **40%** | Healthy. Run it. |
| 10–20% off | **30%** | Acceptable on labour-heavy work. |
| 20–28% off | **22%** | Bundle only. Track the actual take rate. |
| 28–30% off | **15%** | One campaign per year, maximum, owner signs off personally. |
| > 30% off | — | **Refused.** Not negotiable at the counter. |

If a discount breaks the floor, the answer is **not** a smaller discount — it is
a bundle that changes what you are selling, or a promotion that targets the slow
day rather than the slow product.

---

## 5. The anchor (why `compareAtMin` exists and how to set it)

The anchor is the à-la-carte total of the exact same items. It exists to make a
bundle legible, **not to trick anyone.**

### Rules

1. **The anchor is a real sum of real line prices.** Customers add it up. In
   Bataan's price-aware market, somebody will.
2. **Always show both numbers and the word "instead of".** Never show only the
   discount.
3. **`savingsPct` is computed against the entry price (`priceMin`)**, so the
   published saving is the smallest true saving. This is implemented in
   `packages.ts` → `savingsPctOf()`.
4. **Price the range honestly.** `priceMin`–`priceMax`, not one number. A wiper
   blade pair is not the same cost as a tyre inspection, and a single number is
   a small lie that gets discovered at the counter.
5. **The anchor must survive the audit question**: *"If I bought these three
   things separately, would I pay more?"* If the answer is no, delete the anchor.

### Current anchors (all ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION)

| Package | Entry | Ceiling | À-la-carte | Saving | Why this anchor |
| --- | --- | --- | --- | --- | --- |
| Rainy Season Safety | ₱2,400 | ₱3,200 | ₱3,350 | 28% | Three items a customer cannot price for themselves |
| Commuter Express PMS | ₱1,750 | ₱1,950 | ₱2,300 | 24% | Repeated purchase — deliberately modest |
| Balanga Breeze Full Service | ₱3,900 | ₱4,600 | ₱5,200 | 25% | Highest-margin bundle; 4-wheel balance carries it |
| Brake & Balance Safety | ₱2,200 | ₱2,600 | ₱3,000 | 27% | Built from balancing, not from the frightening line |
| Tyre Changeover | ₱1,600 | ₱1,900 | ₱2,000 | 20% | Tyre category → shallower by policy |
| Undercoat & Rust Guard | ₱5,600 | ₱6,400 | ₱7,400 | 24% | Legibility, not savings — unfamiliar service |

---

## 6. Time-boxing

Every campaign has a **hard, published `endsAt`**. No silent extensions. Ever.

| Campaign type | Window | Why |
| --- | --- | --- |
| Seasonal bundle | The whole season (rainy = Jun–Nov) | Matches how long the need lasts |
| Clearance | 2–3 weeks | Fast. The rack will change. |
| First-visit offer | 3 months, then re-arm | Long enough to be remembered |
| Referral | 6 months | Relationship actions run on relationship time |
| Recognition / birthday | 12 months | Ongoing, not a campaign |

### The hard rules on dates

- **Name the season honestly.** The mid-year check-up runs **May–July**. Calling
  a December offer "mid-year" teaches customers that EYG's dates mean nothing,
  which costs more than the December sale was worth.
- **Post the end date in the copy**, in words: "until 30 November 2026".
- **No countdown timers.** Not on the site, not on the Facebook post. A
  countdown that resets when you reload it is a lie, and Facebook audiences in
  this market recognise it immediately.
- **No invented scarcity.** "Last 2 slots!" is a lie unless there are genuinely
  two slots. Say *"while the stock lasts"* — that is real and it is stronger.
- **Roll the window deliberately**, at least 7 days before it lapses, and post
  the extension. Customers notice when a deadline quietly moves.

---

## 7. The "never run two discounts at once" rule

> **Only ONE discount may be live per service category at any moment.**

### Why

The customer does not experience "campaigns". They experience *confusion*. Three
questions follow every second offer:

1. Which one applies to me?
2. Can I combine them?
3. Which one is the best deal — will I regret the wrong choice?

Every extra live offer adds answer time at the counter and mis-set price
expectations in the customer's head. And in a small shop, the counter is where
the trust is won or lost.

### Category map — what may overlap with what

| Category | May run alongside | May NOT run alongside |
| --- | --- | --- |
| Tyres | Labour bundles, recognition | Any other tyre discount |
| PMS / maintenance | Seasonal bundle, recognition | Another PMS discount |
| Brakes | Safety bundle | Brake discount |
| Roadside | Everything | Anything call-out priced |
| Recognition / referral | **Anything** — it is not a category discount | Another recognition offer |

### What you may run together

- **One category discount** + **one relationship offer** (referral or birthday).
  These do not compete: the relationship offer has a peso threshold and the
  category discount does not.

### What you may never run together

- Two tyre discounts.
- A tyre discount and a bundle that contains tyres at a discount.
- Any offer plus a "counter deal" given verbally to negotiate down.

### The informal discount problem

The most common violation in a small shop is not on the website — it is a
mechanic quietly shaving ₱100 to close a sale, because a competitor across the
road will. **The counter deal must be authorised, not improvised.** Give the
team a real lever instead: a free pressure check, a free rotation, a free wipe
of the rims. Those cost almost nothing, are visible to the customer, and do not
break the published price.

---

## 8. Banned marketing moves

Absolute. Not style preferences.

| Banned | Why |
| --- | --- |
| **Fabricated customer stories** | Consumer Act / Data Privacy Act exposure, plus the review is what loses you the shop |
| **Invented statistics** ("500+ customers", "10 years") | Same, plus a lie |
| **Fake or reset countdowns** | Noticing a fake timer is instant, permanent distrust |
| **"Last chance" on a campaign that gets extended** | Breaks a promise that was public |
| **Stock photos presented as our work** | A local recognises a stock garage instantly |
| **Naming or implying a competitor** | Cheap, and it never wins the customer you wanted |
| **"Free" anything with a hidden condition** | Not free. Say the condition. |
| **Offering anything for a review** | Google policy violation; can cost the profile |
| **Asking for a 5-star review** | Google policy violation. Ask for "an honest review". |
| **Guaranteeing an outcome** ("we will fix it", "no more vibration") | Say what you check, not what it will fix |

---

## 9. Ending a promo without alienating regulars

This is the step every shop skips and every customer notices.

### The problem

Your best customers came for the offer. When it ends, they assume the price went
back up and they were used. Loyalty that was built on a discount evaporates the
moment you withdraw it.

### The 4-step protocol

**Step 1 — Announce it before it ends (7 days out).**
Not "offer ended". Use the person's name and the specific thing they bought:

> *"Salamat sa mga nagpa-book ng Rainy Season bundle. Matapos ng Nov 30, bababa " +
> "na yung price. Kung gusto mo pa, i-book mo na this week. Kung hindi, okay lang " +
> "— andito lang kami."*

**Step 2 — Convert the deadline into a service, not a threat.**
*"Book before the 30th and we will put you on the normal schedule, no queue."*
That gives the early customer something the late one cannot get — which is
honest, and much better than inventing scarcity.

**Step 3 — Hold the loyalty, drop the discount.**
When the promo ends, the regular keeps:
- The relationship offer (referral, birthday) — these never expire.
- The free services (pressure checks, rotation on a PMS).
- The *price*, in the sense that the à-la-carte rate was always the real rate.

**Step 4 — Tell them what replaces it, if anything.**
Silence after an offer reads as a price rise. One line is enough:

> *"Yung bundle natin, wala na. Pero yung PMS first-visit offer, buwan pa rin. " +
> "Kung kailangan mo ng bagong bundle, message lang — baka maging interested kami."*

### The line never to use

> ~~"The promo has ended, prices are back to normal."~~

That sentence tells a loyal customer the entire time they were a customer was a
promotion period. Never say it.

---

## 10. Launching a campaign — the checklist

Copy this into the group chat. Do not skip a box.

```
CAMPAIGN: ______________________  CATEGORY: ______
OWNER (person accountable): ______________________

[ ] Category discount conflict check — is another live offer in this category?
[ ] Depth check — is it at or under the category ceiling in §4?
[ ] Margin check — at this depth, is gross margin still at or above the §4 floor?
    (Use actual supplier cost + actual bay rate. Not the suggested numbers.)
[ ] compareAtMin is the real à-la-carte sum of the same items
[ ] priceMin and priceMax are a real range, not a padded single number
[ ] End date is set, hard, and inside the right window for §6
[ ] End date appears in plain words in every piece of copy
[ ] No countdown timer anywhere
[ ] Terms array written, plain language, 4+ lines
[ ] "Subject to inspection" language present wherever a price is shown
[ ] No invented scarcity, no fake statistics, no fabricated customer story
[ ] promoCode chosen, unique, readable over the phone
[ ] Instagram/Facebook post written and shot (see social.ts)
[ ] Counter board updated — the counter must match the website exactly
[ ] Google Business Profile offer post scheduled for the same start date
[ ] Staff briefed: what they may say, what they may not offer
[ ] Expiry reminder set for 7 days before endsAt
[ ] Post-expiry copy drafted NOW (step 1 of §9)
```

---

## 11. Owner-confirmation register

Every figure in this playbook and in `src/content/marketing/promotions.ts` /
`packages.ts` is a **suggestion made by a marketer, not by a mechanic**. Nothing
here has been seen by the shop owner.

| # | Item | Status |
| --- | --- | --- |
| 1 | All 6 campaign discount values (₱950 / 10% / 15% / ₱300 / ₱300 / 12%) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 2 | All 6 package price ranges and `compareAtMin` anchors | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 3 | All margin floors in §4 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 4 | Brand-promise line "We tell you the price before we start" | ⚠️ OWNER COMMITMENT REQUIRED — it is an operating rule, not a slogan |
| 5 | Category depth ceilings in §4 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 6 | 21-day marketing cooldown | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 7 | Campaign date windows | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |

---

**Related:** `PROMO-PLAYBOOK.md` → `src/content/marketing/promotions.ts`,
`packages.ts`, `social.ts` (offer pillar) · `CONTENT-CALENDAR.md` for the
posting schedule · `GBP-LISTING.md` §8 for the GBP offer posts.