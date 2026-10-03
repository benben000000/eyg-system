# SEASONAL PLAN — 12 months of Philippine stock, for this shop's real service mix

> **Owner:** A6 · marketing & merchandising · **Status:** ready for owner sign-off
> **Applies to:** what to build stock for, and when to build it
> **Companion docs:** `STOCK-CAMPAIGNS.md` (the campaigns these windows feed) ·
`PROMO-PLAYBOOK.md` · `CONTENT-CALENDAR.md` §2 (the seasonal spine this extends)

---

## 0. What this plan is, and the two things it must not be

This is a **build-to-order calendar**, not a forecast. It answers one question per month:

> **Which SKU does this shop need to be holding more of, and by when?**

It is **not**:
- ❌ a revenue forecast. Nobody here can forecast a two-bay shop in Balanga.
- ❌ a demand model. It is a **stock floor** schedule: what must already be on the rack
  when the season arrives, because a reorder takes days and the season does not wait.

**The one hard-won lesson it encodes:** for a shop this size the constraint is almost never
demand. It is **lead time against a season that arrives on a date**, and **a bay that is
the real bottleneck**.

---

## 1. The ground truth this is built on

### 1.1 The confirmed services

From `BUSINESS.confirmedServices` — the ten services published on the shop's own Facebook
page. **Every row of every table below maps to one of these ten. Nothing else is planned
for.**

`PMS` · `Change Oil` · `Brake Cleaning and Maintenance` · `Underchassis Maintenance &
Repair` · `Wheel Alignment & Camber Correction` · `Wheel Balancing` · `Tire Mounting &
Repair` · `Nitrogen Tire Inflation` · `Battery Replacement` · `OBD Scanning & Resetting`

🚫 **Not planned for, and not stocked for marketing:** AC repair, engine tune-up, shocks,
CVL, glass, bodywork, motorcycles, roadside. Three local competitors advertise AC work
(`competitors.md` §5.4) — which means claiming it would hold EYG to a higher standard than
a silent competitor. Out of scope until the owner confirms.

### 1.2 The customer

Commuter, ~1.5 h from Manila, drives the EGSA. Price-conscious but **more afraid of being
overcharged than of being charged** (`competitors.md` §5.1). Weekly mileage in a good week;
short trips in a bad one. **Short trips are what kill batteries** — that single fact drives
three months of the calendar.

### 1.3 The Philippines calendar that matters

| Window | What it is | Certainty |
| --- | --- | --- |
| **Holy Week** (Maundy Thu → Easter Sunday) | 4-day shutdown, cars parked | Easter Sunday is computable; **operating hours are not confirmed** |
| **Chinese New Year** | Falls Jan–Feb, moves each year | 🚫 **TODO-VERIFY** the date for each year |
| **All Souls' Day (Nov 1) / All Saints (Nov 2)** | Cemetery traffic. High mileage, short trips. A Bataan/Central Luzon fixture. | Dates fixed |
| **Undas season** | October onward. Provincial trips, 2–4 h each way. | Fixed start, ramps late Oct |
| **9G / 10G toll-free days** | Announced yearly by NLEX | 🚫 **TODO-VERIFY every year — they change** |
| **Rainy season** | Jun–Nov, PAGASA-declared, varies by year | Start date varies; plan for the window, not the date |
| **Typhoon season** | Jun–Dec, peak Jul–Aug | Cannot be forecast. **Weather-driven risk.** |
| **Christmas + New Year** | Family travel, heavy idling in traffic | Fixed |

**Easter Sunday, for planning only:**
2026 → 5 Apr · 2027 → 28 Mar · 2028 → 16 Apr · 2029 → 1 Apr · 2030 → 21 Apr
⚠️ **TODO-VERIFY** — and note that *operating hours* are the thing the owner must confirm,
not the arithmetic. Philippine rules restrict business operations around Holy Week and
Christmas; `CONTENT-CALENDAR.md` §2 says the same. **No closure date goes in copy until
the owner confirms the hours.**

---

## 2. The 12-month stock calendar

Two columns carry the operational meaning:

- **BUILD BY** — the date the extra stock must already be on the rack.
- **WHY THE LEAD TIME MATTERS** — what happens if it is late.

⚠️ **All quantities are described in relative terms, not numbers.** This shop's real
reorder quantities live in `Product.reorderPoint` and `Product.reorderQty`, per SKU, set
from actual sales. A monthly plan that overrides per-SKU reorder points with a made-up
number would be worse than no plan.

| Month | Lead story | Stock focus | Build by | Why the lead time matters |
| --- | --- | --- | --- | --- |
| **JAN** | Cars come back from Christmas trips with real wear on them | `TYRE` (top sizes), `OIL`, `FILTER`, `BATTERY` | mid-Dec | Every vehicle that travelled came back with worn tread and a strained battery. This is the **post-travel inspection** window. Lowest competition of the year. |
| **FEB** | Pre-Holy-Week. Chinese New Year travel. | `OIL`, `FILTER`, `BATTERY` | mid-Feb | Sludge from short trips and stop-start traffic. A car that idled in the city for 3 hours in NLEX traffic is an oil-change candidate. |
| **MAR** | **Holy Week.** The four-day idle window. | `OIL`, `FILTER`, `BATTERY`, `TYRE` | 2 weeks out | Cars sit. Fluids settle. Tyres sit under a point load. Batteries drop on repeated start-stop. **This is the classic check-up window of the year** — `CONTENT-CALENDAR.md` calls it *"the vehicle idles for 4 days"* and it is correct. |
| **APR** | Shoulder. Post-Holy-Week. Summer travel starts. | `TYRE`, `BATTERY` | end of Mar | Heat is climbing. Battery stress and tyre pressure both rise with ambient temperature. |
| **MAY** | **Summer holiday travel.** Pre-trip checks. | `TYRE`, `BATTERY`, `OIL` | mid-Apr | The bay, not the shelf, is the constraint. Long distances at expressway speed chew tread and heat brakes. |
| **JUN** | **First rains.** `rainy-season-safety-bundle` goes live. | `WIPER`, `BRAKE`, `TYRE` | **end of May** | 🔴 **The most important build-by date in the year.** Wiper demand appears *with the rain*, not after it. A customer who needs blades on 3 June cannot wait a week. **Build in May.** |
| **JUL** | **Peak rains.** | `WIPER`, `BRAKE`, `CONSUMABLE` (undercoating) | end of Jun | Standing water, hydroplaning questions, brakes asked about. Highest undercoating demand of the year. |
| **AUG** | **Typhoon season peak.** | `WIPER`, `BATTERY`, `CONSUMABLE` | mid-Jul | Blades torn by debris after every storm. Batteries exposed to water in the engine bay. Corrosion checks. ⚠️ **Cannot be forecast — this is a stock *floor*, not a reorder trigger.** |
| **SEP** | Back-to-school, class resumption. Undas prep begins. | `TYRE`, `OIL`, `FILTER` | mid-Aug | Monsoon driving has done measurable work on tread depth. This is the natural point for the annual **alignment + balance + tyre** conversation. |
| **OCT** | **Undas season opens.** Typhoon tail. | `TYRE`, `WIPER` | mid-Sep | `CONTENT-CALENDAR.md` already schedules `tyre-clearance` here. Alignment demand peaks. Expect toll-day traffic spikes. |
| **NOV** | **All Souls / All Saints.** Christmas season opens. | `BATTERY`, `OIL`, `FILTER`, `TYRE` | 1st week of Oct | Cemetery traffic: **high daily mileage, short journeys, lots of idling.** The worst possible profile for a starter battery and the best possible profile for an oil change. |
| **DEC** | **Christmas + New Year.** Year-end servicing. | `BATTERY`, `OIL`, `FILTER`, `TYRE` | 1st week of Nov | Province trips + urban idling. Year-end spend. **This is the highest-value month in the calendar.** |

---

## 3. Seasonal demand vs weather-driven risk

This is the distinction the whole plan turns on, and getting it wrong is expensive in
opposite directions.

| | **Seasonal demand** | **Weather-driven risk** |
| --- | --- | --- |
| **What it is** | A calendar-driven uplift in a **specific** SKU | A contingent uplift in a **category**, triggered by weather |
| **Predictable?** | Yes — the date is known | **No.** It arrives at 2am during a typhoon |
| **Examples** | Battery + oil before Christmas · tyres before Undas · filters at PMS | Undercoating & rust guard · wiper blades · batteries after flooding |
| **How you supply it** | **Reorder on a schedule.** Order earlier than the season. | **Hold a floor from before it starts.** You cannot reorder into a storm. |
| **Lead time matters** | Days. Straightforward. | **Weeks.** The build must be done *before* the season. |
| **Failure mode** | Stockout in a normal month | **Stockout in the worst month, with the most customers on the road** |
| **Campaign risk** | Low | 🔴 **High** — see below |

### 3.1 The rainy season is risk, not a campaign

The `rainy-season-safety-bundle` is a **service** campaign — a bundle of labour and a small
parts line, per `PROMO-PLAYBOOK.md` §2 Archetype 1. That is correct.

🚫 **But it must never become a stock campaign.** The moment a wipers campaign is automated
off a rain-driven demand signal, two things go wrong:

1. **The signal arrives too late.** A `WIPER` SKU does not hit `isLow` until the blades
   have already sold out. By then the reorder takes 3–5 days and the customer already bought
   elsewhere.
2. **The campaign then excludes the out-of-stock SKU** — by our own §0 rule — so the
   highest-demand moment is the moment the campaign automatically switches itself off.
   Which is correct behaviour, and useless.

**The fix is upstream, in the `reorderPoint`, not in the campaign.** For `kind === "WIPER"`
and for the undercoating `CONSUMABLE`s, `reorderPoint` must be set to cover the whole
season, not the gap between deliveries.

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION:** raise `reorderPoint` for
`kind IN ('WIPER')` and the undercoating consumables from roughly **1st May**, and drop it
back after **30 November**. The system already has `shelfLifeDays`, `cycleCountDays` and
`isLow` to do this with. **Who sets it, and when, is an owner decision** — a stock floor
that changes twice a year is an operating rule, not a config value.

### 3.2 The two things that cannot be reordered into

| Event | What it breaks | What to do |
| --- | --- | --- |
| **A typhoon lands** | Every tyre shop in Bataan is open at once, on the same roads, at the same time. **Every competitor is in the same position.** | 🏆 **This is EYG's best weather moment and it has nothing to do with stock.** Being open, on the phone, with a bay, and honest is the whole play. Publish hours; publish that you are open. The competitor two doors down publishes nothing. |
| **A toll-free day (9G/10G)** | Bay congestion. A "book the slot" promise fails if the slot is 4 hours deep. | 🚫 **Do not run an availability campaign into toll-free congestion.** Check the slot calendar before the campaign fires. A promised slot is a promise. |

---

## 4. Lead-time assumptions

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION.** 🚫 **These are not researched figures.**
They are the ranges a marketer expects and the owner must replace them with what the shop's
actual suppliers actually do. **No campaign, no pre-order quote, and no "we can get it by
Friday" is ever based on this table as it stands.**

| Route | Assumed lead time | Used for |
| --- | --- | --- |
| Local Balanga / Bataan supplier, common SKU, in stock there | same day – 1 day | Same-day counter fixes, walk-in turnarounds |
| Metro Manila distributor, common SKU | 3–5 days | The default pre-order promise |
| Ordered-in size, not held locally | 1–2 weeks | `PREORDER-FLOW.md` §3.2 |
| Special order (unusual width, load index, or a brand the shop does not normally carry) | 2–4 weeks | Never quoted without a supplier confirmation first |

### 4.1 Three lead-time rules that hold regardless of the numbers

| Rule | Why |
| --- | --- |
| 🚫 **Never quote a lead time the supplier has not confirmed on this order.** | A date that slips three weeks costs more than a slow honest one. |
| **The number shown to the customer is the supplier's commitment, not the shop's hope.** | Same reason, from the other side. |
| **A build-by date earlier than the lead time is a purchase order, not a reorder point.** | Reorder points fire when stock is low. A seasonal build has to happen *before* stock is low. That is a calendar task on a Monday, not a system event. |

---

## 5. The bay is the real constraint

A two-bay shop in a peak month does not sell out of stock. It sells out of **hours**. Three
consequences that change how the calendar should be read:

| Consequence | What to do |
| --- | --- |
| **Seasonal demand concentrates, it does not increase evenly.** | In Nov, a customer will take any available slot. **Sell the slot, not the discount.** Campaign C3 ("we have the parts, book the slot") is worth more in a peak month than in a slow one. |
| **Lead time for a *bay* is zero; lead time for a *part* is days.** | Never make a customer wait for a bay slot to get a part that is already there. And never tell them the bay is free on a date you know the part will not arrive. |
| **A slow month needs a different lever than a peak month.** | Peak → slots and availability. **Slow → labour bundles and off-peak scheduling**, per `PROMO-PLAYBOOK.md` §4 (labour-only services go to 25%). Never a deeper discount. |

---

## 6. Which months are which — the summary the owner actually needs

| Season | Months | Stock strategy | Marketing strategy |
| --- | --- | --- | --- |
| **Slow** | Feb, Apr, May | Trim. Do not buy deep. | `rainy-season-safety-bundle` in May · labour bundles · off-peak slots |
| **Building** | Jun, Sep | **Build.** Rainy-season wipers in May. Undas tyres in August. | Pre-book slots early. `CONTENT-CALENDAR.md` D73 schedules the mid-year book-ahead post. |
| **Peak** | Oct, Nov, Dec | Hold. Do not chase. **Shortages here are reputation events.** | Availability, slots, tyre clearance, referral |
| **Weather-risk hold** | Jun–Aug | **Stock floor, not a reorder point.** Hold wipers and undercoating consumables *through* the season. | Service campaigns only. 🚫 **No wipers stock campaign.** |

---

## 7. The Monday-morning 20-minute stock review

Ties the calendar to the system. Runs **weekly, Monday, 20 minutes** — the same slot as
`CONTENT-CALENDAR.md` §8's marketing review, done together.

```
[ ] Reorder list: anything where isLow === true.
      For each: is the reorder PLACED, and what is the expectedAt?
      Anything without an expectedAt gets one today, not Friday.

[ ] Pre-orders: overdue count. Target zero. (STOCK-CAMPAIGNS.md §5.3)

[ ] Seasonal check — is the next build-by date inside 2 weeks?
      Jun build-by is end of May. Nov build-by is 1st week of Oct.
      If yes: is the purchase order placed?

[ ] Aged tyres: any kind === 'TYRE' with ageDays >= 730 and a CONSUME
      in the last 60 days? That combination means the band is right and the
      price is wrong. Fix the price, do NOT discount it.
      (TYRE-CLEARANCE-PLAYBOOK.md §2.2 — age is the gate, velocity is the price.)

[ ] Campaigns live right now: one per category? Any endsAt inside 7 days with
      no post-expiry copy drafted?
```

---

## 8. Owner-confirmation register

| # | Item | Status |
| --- | --- | --- |
| 1 | **Holy Week operating hours and closure dates** | 🚫 **TODO-VERIFY** — do not publish |
| 2 | **All Souls' Day / Christmas operating hours** | 🚫 **TODO-VERIFY** — do not publish |
| 3 | Chinese New Year date per year | 🚫 **TODO-VERIFY** |
| 4 | **9G / 10G toll-free dates** | 🚫 **TODO-VERIFY** — read from NLEX each year |
| 5 | Rainy-season start/end per year (PAGASA) | 🚫 **TODO-VERIFY** — plan for the window |
| 6 | All four lead-time bands (§4) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 7 | Which months are genuinely "slow" for this shop (§6) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. **The owner's own numbers will not match a marketer's guess.** |
| 8 | Wiper / undercoating `reorderPoint` uplift and who changes it (§3.1) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 9 | Per-SKU `reorderPoint` / `reorderQty` from real sales | 🚫 **TODO-VERIFY** — blocks every campaign's Gate 1 |
| 10 | Bay capacity per day, by season | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. Determines whether C3 is even possible in October. |
| 11 | Whether the 10 confirmed services are the complete list | 🚫 **TODO-VERIFY** |

---

## 9. Related

`STOCK-CAMPAIGNS.md` (C4, the campaigns these windows feed) · `TYRE-CLEARANCE-PLAYBOOK.md`
(the October clearance) · `PREORDER-FLOW.md` (lead-time quoting) ·
`PROMO-PLAYBOOK.md` §2 Archetype 1 · `CONTENT-CALENDAR.md` §2, §8 ·
`../research/competitors.md` §3 (nobody here publishes anything — the gap is the plan)
