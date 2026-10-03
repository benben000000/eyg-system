# STOCK CAMPAIGNS — four campaigns, four real fields

> **Owner:** A6 · marketing & merchandising · **Status:** ready for owner sign-off
> **Applies to:** every automated campaign in the inventory build
> **Companion docs:** `TYRE-CLEARANCE-PLAYBOOK.md` · `PREORDER-FLOW.md` ·
> `SEASONAL-PLAN.md` · `DO-DONT.md`

---

## 0. The rule that governs all four

> **A campaign that outruns the shelf is the single worst thing this build could do.**

Not the worst marketing problem. The worst outcome. Every other failure mode — a stale
post, a bad photograph, an awkward price — is recoverable. This one is not: a customer
drives to EGSA Fourlanes for a tyre the system said was there, and the shop does not have
it. That is the exact scenario the whole inventory system was built to prevent, and no
campaign gets to reintroduce it for a click.

So the governing constraint is structural, not editorial:

> 🚫 **A campaign may not include a product where `StockLevelDto.isLow === true`.**
> **No exceptions. Not "unless it's nearly out". Not "just the post, not the link".
> The filter is not applied by the person writing the campaign — it is applied by the
> query that produces the campaign.**

Every campaign below is written as a query over `Product` + `StockLevel`, not as a list
someone maintains.

---

## 1. Campaign C1 — Low-stock urgency (the truthful version)

### 1.1 The trigger

| Field | Source | Condition |
| --- | --- | --- |
| `isLow` | `StockLevelDto.isLow` — *"available <= reorderPoint"* | `=== true` |
| `available` | `StockLevelDto.available` — `onHand − reserved` | `> 0` |

**And the exclusion that matters more than the trigger:**

| Field | Condition |
| --- | --- |
| `isLow` | `=== false` — a product that is **short cannot appear in any public campaign** |

### 1.2 What `isLow` actually means, and what it does not

This is the confusion that produces fake urgency, so it is worth being blunt:

| `isLow` is… | It is **not**… |
| --- | --- |
| a **replenishment signal for the shop** | a scarcity fact for the customer |
| "we are at or below the reorder point" | "we are nearly out" |
| derived from `available ≤ reorderPoint` | derived from anything the customer can see |
| invisible to the public | marketing material |

> **`isLow` is a reason for the shop to buy stock. It is never a reason to tell a customer
> to hurry.**

`reorderPoint` is a number the owner chose so that a reorder arrives before a stockout.
It is an internal buffer. It has no relationship to how many units are on the shelf.

### 1.3 What may be said

| Situation | Fields | What the shop may say |
| --- | --- | --- |
| `available > 0`, `isLow === true`, supplier confirmed stock | `available > 0` | ✅ **"In stock now, more on order."** ✅ **"We have it — we're ordering more for next week."** |
| `available > 0`, `isLow === true`, supplier **not** asked | — | ✅ **"We have it."** Full stop. Do not promise a next delivery that has not been confirmed. |
| `available === 0`, supplier confirmed stock and a date | `available === 0` | ✅ **"Not in the rack right now. We can order it in — usually [lead time]. Message us and we'll give you the date."** → `PREORDER-FLOW.md` |
| `available === 0`, no supplier confirmation | `available === 0` | ✅ **"Not in the rack. We'll check and call you."** Never a date. |

**In every one of those four rows the discount is 0%.**

> ### Why low stock is never paired with a discount
>
> Low stock is a reason to buy **now**. A discount is a reason to buy **later**. Running
> both teaches the market that this shop creates artificial pressure, and it destroys both
> signals at once: the urgency stops working, and the price stops meaning anything.
>
> It is also arithmetic. A "10% off, last few left" post on a low-margin tyre is a
> **double discount** — `TYRE-CLEARANCE-PLAYBOOK.md` §3.4 shows 10% off a 25%-margin tyre
> is 13.3% off cost. Adding scarcity to that is paying twice for the same unit.
>
> **`PROMO-PLAYBOOK.md` §2: a low-stock message is a *service* message. Its margin cost is
> zero, and its ceiling is 0%.**

### 1.4 What must NOT be said

| ❌ Banned | Why |
| --- | --- |
| "Only 2 left!" | Even if true at the moment of writing, it is a number that will be wrong by tomorrow. **Never on a public surface.** True only at the counter, on the phone, to someone in the shop. |
| "Last one!" | Same. And it pressures a customer into a purchase before you have read the DOT code or looked at the tread. |
| "Selling fast!" | `isLow` says nothing about velocity. Check the ledger before claiming it — and if `isLow` is true, the item is **excluded from campaigns**, so you can never advertise it anyway. |
| "Hurry / last chance / grab it" | Manufactured urgency. Banned by `PROMO-PLAYBOOK.md` §8. |
| A countdown | §6. "No countdown timers. Not on the site, not on the Facebook post." |
| "While stocks last" when `available === 0` | There are no stocks to last. |
| Any campaign post including an `isLow` product | §0. Hard rule. |
| "3 people are viewing this" | Fabricated. There is no such counter in the system and there never should be. |
| Publishing a **count** of remaining units | The count is true for an instant. The post lives for a week. |

### 1.5 How it ends

**A stock campaign ends on a field, not on a date.** This is the inversion the whole
inventory build buys:

```
CAMPAIGN C1 MEMBERSHIP
  START  isLow flips false → available > reorderPoint   (auto, server-side)
  STOP   isLow flips true  → excluded from all campaigns (auto, server-side)
  BACKSTOP  14 days from entry                             (in case the field never flips)
```

The backstop exists only to stop a stale post outliving the data. **No one should ever
have to remember to take a low-stock message down**, because a low-stock message becomes
inaccurate the moment someone buys the thing it is about.

---

## 2. Campaign C2 — Aged tyre clearance

Full treatment in `TYRE-CLEARANCE-PLAYBOOK.md`. Summary here, because it is a campaign and
it needs a trigger.

### 2.1 The trigger

| Field | Source | Condition |
| --- | --- | --- |
| `kind` | `ProductKindValue` | `=== "TYRE"` |
| `isActive` | `ProductDto.isActive` | `=== true` |
| `dotCode` | `ProductDto.dotCode` | `!== null` — **no DOT, no age, no campaign** |
| `ageDays` | `ProductAvailabilityDto.ageDays` | `>= 730` (24 months) |
| `available` | `StockLevelDto.available` | `> 0` |
| `isLow` | `StockLevelDto.isLow` | `=== false` |
| `costPrice` | `ProductDto.costPrice` | `> 0` — 🔴 **unknown cost cannot be priced** |
| ledger | `StockMovement` `CONSUME`, 60 days | **none** — the velocity gate |

### 2.2 Band escalation

| `ageDays` | Band | Max discount off sell | Approval |
| --- | --- | --- | --- |
| 730–1094 | C | 5% | Per campaign, written |
| 1095–1459 | C+ | 10% | Per campaign, written |
| 1460+ | D | 10% max, and `RETURN_TO_SUPPLIER` attempted first | **Per SKU, per publication** |

⚠️ All band thresholds and depths: **SUGGESTED — REQUIRES OWNER CONFIRMATION.**

### 2.3 Message, channel, margin

| | |
| --- | --- |
| **Message** | The DOT year **first**, the discount second. Complete installed price in one number. |
| **Channel** | Facebook (the shop's front door), the counter board, and the size list at the counter |
| **Margin** | The §3.5 `d_max` formula against the real margin, capped at 10%, gated at the landed floor |
| **Channel note** | ❌ **Never** on the public `/deals` page as a permanent listing — see `CUSTOMER-BROWSING-UX.md` §2 |
| **How it ends** | `available === 0` → delete the post **the same day**. Never a countdown. Never a "final days". |

---

## 3. Campaign C3 — Bundle the bay

### 3.1 The trigger — this is the strongest inventory-truth message available

> **"We have the parts. Book the slot."**

It is the only thing a shop with a stock system can say that a shop without one cannot,
and it is a **service** message — it needs no discount to work.

| Field | Source | Condition |
| --- | --- | --- |
| `canFulfil` | `ServiceAvailabilityDto.canFulfil` | **`=== true`** for every service in the bundle |
| `blockers` | `ServiceAvailabilityDto.blockers` | `.length === 0` |
| `isBlocking` | `PartAvailabilityDto.isBlocking` | A short non-blocking part does **not** fail the campaign |
| `isShort` | `PartAvailabilityDto.isShort` | `false` for every blocking part |
| `qtyNeeded` vs `available` | both | `available >= qtyNeeded` per part |

### 3.2 The rule that makes it honest

> 🚫 **If `canFulfil` is false for any service in the bundle, the bundle cannot be
> advertised — not on Facebook, not on the site, not verbally as a package deal.**

A4's rule is explicit: *"a booking is only promised when `ServiceAvailabilityDto.canFulfil`
is true."* The marketing surface inherits that rule. It is not a marketing choice; it is
the same promise, made in a different place.

### 3.3 Non-blocking shortages do not kill it

`ServicePartRequirement.isBlocking` exists so that a nice-to-have being short does not stop
a sale. Marketing uses the same flag:

| Campaign status | Condition | What the shop says |
| --- | --- | --- |
| **GREEN — advertise** | `canFulfil === true` | *"We have the parts. Book the slot."* |
| **AMBER — advertise, name the gap** | `canFulfil === true`, one non-blocking part short | *"We have everything for this except [part], which we're ordering. The bay is free [date]."* |
| **RED — do not advertise** | `canFulfil === false` | Nothing. The booking is not promised. Route to `PREORDER-FLOW.md`. |

AMBER is the one people get wrong. **The honest gap sells more than the smooth lie**, and
"we're ordering the brake pads, here's your date" is the same sentence that wins the next
job.

### 3.4 Margin

| Component | Depth | Source |
| --- | --- | --- |
| **Availability message alone** | **0%** | A service message. The margin cost of "we have it" is zero and it is the highest-value sentence the shop has. |
| **With a bundle** | ≤ 28% for a 3-service bundle | `PROMO-PLAYBOOK.md` §2 Archetype 1, §4 |
| **Labour-only components** | ≤ 25% | §4. Balance and alignment are almost pure margin. **This is where the discount belongs.** |
| **Tyres inside a bundle** | ≤ 10%, and **never on top of** `TYRE-CLEARANCE-PLAYBOOK.md` | §7 — two tyre discounts may never run together |

### 3.5 How it ends

```
STOP   canFulfil flips false for any service in the bundle
       → the bundle leaves the site and the board in the same request, not the next morning
BACKSTOP  the campaign's published endsAt, per PROMO-PLAYBOOK.md §6
```

**Never extend a bundle's window to cover the day the parts ran out.** That is the exact
"your dates mean nothing" lesson in `CONTENT-CALENDAR.md` §2.

---

## 4. Campaign C4 — Battery and oil, seasonal

### 4.1 The trigger

A month-based window **intersected with** the field filter. Both, always. The month decides
*what to say*; the fields decide *whether it can be said at all*.

```
Campaign C4 fires for a date D and a product P only when:

    D.month ∈ SEASONAL_WINDOW(kind = P.kind)          -- the calendar
AND P.isActive === true
AND P.kind ∈ { BATTERY, OIL, FILTER, WIPER, TYRE, BRAKE }
AND P.isLow === false                                  -- §0, non-negotiable
AND P.available > 0
```

### 4.2 The windows, tied to the confirmed service mix

`BUSINESS.confirmedServices` is the ground truth: PMS, Change Oil, Brake Cleaning &
Maintenance, Underchassis Maintenance & Repair, Wheel Alignment & Camber Correction, Wheel
Balancing, Tire Mounting & Repair, Nitrogen Tire Inflation, Battery Replacement, OBD
Scanning & Resetting. **Every campaign below maps to one of those ten. Nothing else.**

| Window | Kind focus | The service it feeds | Why the stock moves |
| --- | --- | --- | --- |
| **Feb** — pre-Holy-Week | `OIL`, `FILTER` | Change Oil, PMS | Cars go long-distance over the break. Sludge from short trips. |
| **Late Mar – early Apr** — Holy Week | `OIL`, `FILTER`, `BATTERY` | PMS, Battery Replacement | Four days parked. Tyres sit under a point load; batteries drop on repeated start-stop. |
| **May** — summer travel | `TYRE`, `BATTERY` | Tire Mounting, Wheel Balancing, Wheel Alignment | Pre-trip check window. The bay is the constraint, not the shelf. |
| **Jun** — first rains | `WIPER`, `BRAKE` | Underchassis, Brake Cleaning, PMS | Visibility and grip questions arrive before the calendar says they will. |
| **Jul – Aug** — peak rains / typhoon | `WIPER`, `BATTERY` | Underchassis, Battery Replacement | Wipers torn by debris; batteries from water in the engine bay. ⚠️ **Weather-driven risk — see `SEASONAL-PLAN.md` §3.** |
| **Sep** — Undas prep | `TYRE` | Tire Mounting, Balancing, Alignment | Wear from the monsoon driving cycle. |
| **Oct** — Undas season | `TYRE` | same | Year-end tyre cycle. `CONTENT-CALENDAR.md` already schedules `tyre-clearance` here. |
| **Nov** — All Souls / All Saints | `OIL`, `BATTERY`, `FILTER` | PMS, Battery Replacement | Cemetery traffic — high daily mileage, short trips. The classic battery-killer profile. |
| **Dec** — Christmas + New Year | `BATTERY`, `OIL` | Battery Replacement, Change Oil | Long trips, idling in traffic on the way to the province. |
| **Jan** — post-holiday | `TYRE`, `OIL` | Tire inspection, PMS | Cars come back from trips with real wear on them. |

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION:** the window boundaries. **Holy Week,
All Souls' Day and Christmas operating hours are unconfirmed** and Philippine labour rules
restrict business operations in these periods — `CONTENT-CALENDAR.md` §2 flags this
explicitly. **Do not publish a closure date, a holiday price, or a "book before" deadline
until the owner confirms the actual hours.**

⚠️ **TODO-VERIFY:** the 9G / 10G toll-free dates are announced yearly by NLEX and change
every year. They must be read from the NLEX announcement, never from a calendar carried
over from last year.

### 4.3 Message, channel, margin

| | |
| --- | --- |
| **Message** | The season, then the service, then the price range. Never the price first. `PROMO-PLAYBOOK.md` §3: *"Name the situation, not the number."* |
| **Channel** | Facebook (6 posts/week per `CONTENT-CALENDAR.md`), GBP offer post, and the counter board — all matching exactly |
| **Margin** | Battery 10–15% · Oil + PMS 15–20% · Seasonal bundle ≤ 28% · Tyres ≤ 10% — all from `PROMO-PLAYBOOK.md` §4 |
| **Battery specifically** | ⚠️ **SUGGESTED** — a battery is a trust purchase with a manufacturer's warranty attached. `legal-compliance-ph.md` §4.2: state the **manufacturer** warranty separately from anything EYG claims. **Never invent a parts warranty.** |
| **How it ends** | On the window's last day, with the §9 protocol from `PROMO-PLAYBOOK.md` — announce 7 days out, never say *"prices are back to normal."* |

---

## 5. Campaign C5 — The one nobody asked for and every shop needs

**Not requested in the brief. Included because the brief's own hardest rule makes it
necessary.**

### 5.1 The problem

Every campaign above *excludes* `isLow` products. That is correct. But it means the single
most valuable thing the inventory system knows — *"this tyre is nearly out"* — never
reaches the one person who can act on it at the right moment, because a **reorder takes
days** and the reorder is driven by a field that only trips at the reorder point.

### 5.2 The campaign

| | |
| --- | --- |
| **Trigger** | `isLow === true` **and** `available === 0` **and** `stock.available` crossed zero within the last 48 hours |
| **Audience** | **Internal only.** `notify*`, in the existing 6am owner digest. Never public. |
| **Message** | Three lines: the SKU, the size, how many pre-orders are attached to it |
| **Why the pre-orders matter** | A stockout with 4 pre-orders attached is a different morning than a stockout with none. The pre-order count is **demand you already have**, and it is the most accurate reorder quantity the shop will ever get. |
| **Margin** | 0%. The margin on a reorder is the margin on whatever it stops stockouting. |
| **How it ends** | `available > reorderPoint` → digest line disappears. |

### 5.3 Suggested digest line

```
STOCKOUT  TY-20555R16-MI-PRIM4 · 205/55R16 · 0 of 2 · 4 pre-orders waiting
          ordered 12 Mar · PO ref TR-0442
```

**This is the highest-ROI line in the entire inventory build** and it costs no money.

---

## 6. The campaign contract — what every campaign must declare

Any campaign, automated or hand-written, is invalid without these nine. Copy this into the
spec.

```
CAMPAIGN CONTRACT

1. TRIGGER     the exact field(s) and threshold. Not "when stock is low".
2. EXCLUSION   isLow === true → excluded. Always. Enforced in the query, not the copy.
3. UNIT        availability is in the product's own unit (ProductDto.unit).
               unit === "PAIR" is only "available" at available >= 2.
4. PROMISE     the exact sentence the shop may say. Written down, not improvised.
5. MARGIN      the depth, and which row of PROMO-PLAYBOOK.md §4 authorises it.
6. CHANNEL     where it runs. The counter board and the website must match exactly.
7. ENDS_ON     the field that ends it. Not a date. A date is only the backstop.
8. BACKSTOP    the hard expiry, in writing, in words, in the copy.
9. APPROVER    the person who signed the depth off. One name.
```

---

## 7. Campaign conflict check — before anything is published

From `PROMO-PLAYBOOK.md` §7 and §10. **Run this every time.**

```
[ ] Category conflict — is another live discount in this category?
      Tyres       : may run with labour bundles + recognition. NOT with another tyre discount.
      PMS / maint : may run with a seasonal bundle. NOT with another PMS discount.
      Brakes      : may run with a safety bundle. NOT with a brake discount.
[ ] Depth ≤ the category ceiling (PROMO-PLAYBOOK.md §4). Tyres ≤ 10%, hard.
[ ] Margin ≥ the floor at that depth, computed from REAL cost. Not the suggested numbers.
[ ] Gate 1 passed: costPrice > 0 for every product in the campaign.
[ ] Gate 2 passed: isLow === false for every product. The filter is the query, not the poster.
[ ] compareAtMin is the real à-la-carte sum of the same items.
[ ] Hard published endsAt, in plain words, inside the right window.
[ ] No countdown. No invented scarcity. No fake statistic. No fabricated customer.
[ ] "Final price confirmed after inspection" wherever a price is shown.
[ ] Counter board matches the website exactly. (Checklist item: PROMO-PLAYBOOK.md §10)
[ ] Post-expiry copy already drafted. PROMO-PLAYBOOK.md §9 step 1.
```

---

## 8. What no campaign may ever do

Not stylistic preferences. **Absolute.** The first three are the ones that would end the
shop's local reputation, and a 308-follower page has no margin for any of them.

| Banned | Why |
| --- |---|
| 🚫 **Advertise a product where `isLow === true`** | The shelf cannot keep the promise. The one failure this build exists to prevent. |
| 🚫 **Reset a countdown, or extend a published end date silently** | Instant and permanent distrust. `PROMO-PLAYBOOK.md` §6. |
| 🚫 **"3 people are viewing" / "12 people booked today"** | There is no such counter in the system. It is fabricated, and a customer in a small town knows the shop's real numbers. |
| 🚫 **A price below `costPrice` without written owner approval for that SKU** | `TYRE-CLEARANCE-PLAYBOOK.md` §4 |
| 🚫 **"Last 2 slots"** | Bounded capacity is real — but never fabricate it. Say *"while the rack lasts."* |
| 🚫 **Fabricating a customer, a quote, a rating, or a review count** | Consumer Act + Data Privacy Act + a Google manual action. `competitors.md` §6 items 8, 10. |
| 🚫 **Stock photography presented as our work** | A local recognises a stock garage instantly. |
| 🚫 **Offering anything in exchange for a review** | Google policy. Can cost the profile. |
| 🚫 **Naming or disparaging a competitor** | `competitors.md` §6 item 13. Jed-M is metres away. Never mention them. |
| 🚫 **"Genuine parts only" / "certified technicians" / "authorised dealer"** | `competitors.md` §6 items 1–3. Say the **part brand and model you fitted** instead. |
| 🚫 **"Safe for X more years" on an aged tyre** | That is an express warranty, created by a caption. |
| 🚫 **Recycling the expired "First 20 customers get FREEBIES" post** | `competitors.md` §6 item 8 — it expired 2025-12-09. Re-running it is a false "current offer". |
| 🚫 **A discount that teaches the customer to wait** | `TYRE-CLEARANCE-PLAYBOOK.md` §6 |

---

## 9. Ending any campaign — the four-step protocol

Copied from `PROMO-PLAYBOOK.md` §9 because it is the step every shop skips and every
customer notices. **Use these sentences.**

**Step 1 — announce it 7 days out, by name, about the specific thing they bought:**

> *"Salamat sa mga nagpa-book ng Rainy Season bundle. Matapos ng Nov 30, bababa na yung
> price. Kung gusto mo pa, i-book mo na this week. Kung hindi, okay lang — andito lang kami."*

**Step 2 — turn the deadline into a service, not a threat:**

> *"Book before the 30th and we will put you on the normal schedule, no queue."*

**Step 3 — hold the relationship, drop the discount.** The referral offer, the birthday
mechanic, the free pressure check and the free rotation all continue. The à-la-carte rate
was always the real rate.

**Step 4 — say what replaces it, in one line:**

> *"Yung bundle natin, wala na. Pero yung PMS first-visit offer, buwan pa rin. Kung
> kailangan mo ng bagong bundle, message lang — baka maging interested kami."*

### 🚫 The line never to use

> ~~"The promo has ended, prices are back to normal."~~

That sentence tells a loyal customer that their entire time as a customer was a
promotional period. It is the single most expensive sentence in retail.

---

## 10. Owner-confirmation register

| # | Item | Status |
| --- | --- | --- |
| 1 | Low-stock message wording (§1.3) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 2 | C2 band thresholds and depths | See `TYRE-CLEARANCE-PLAYBOOK.md` §8 |
| 3 | C4 seasonal window boundaries | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 4 | **Holy Week / All Saints / Christmas operating hours** | 🚫 **TODO-VERIFY** — do not publish any date |
| 5 | **9G / 10G toll-free dates** | 🚫 **TODO-VERIFY** — read from the NLEX announcement each year |
| 6 | Battery campaign depth (10–15%) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 7 | Battery manufacturer warranty wording | 🚫 **TODO-VERIFY** — per brand, in writing |
| 8 | `PAIR` requires `available >= 2` to be called "in stock" | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 9 | 14-day campaign backstop (§1.5) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 10 | Real `costPrice` for every campaign product | 🚫 **TODO-VERIFY** — Gate 1 cannot pass without it |
| 11 | Internal stockout digest format (§5.3) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |

---

## 11. Related

`TYRE-CLEARANCE-PLAYBOOK.md` (C2 in full, and the margin arithmetic) ·
`PREORDER-FLOW.md` (the `available === 0` reroute) · `SEASONAL-PLAN.md` (the C4 calendar
and weather-risk split) · `CUSTOMER-BROWSING-UX.md` (what `available` may be shown as) ·
`DO-DONT.md` · `PROMO-PLAYBOOK.md` §2, §4, §6, §7, §8, §9, §10
