# TYRE CLEARANCE PLAYBOOK — DOT-driven, disclosed, arithmetic-checked

> **Owner:** A6 · marketing & merchandising · **Status:** ready for owner sign-off
> **Applies to:** any tyre that is ageing in the rack, and any price published for it
> **Companion docs:** `PROMO-PLAYBOOK.md` (depth ceilings, time-boxing) ·
> `STOCK-CAMPAIGNS.md` (the trigger) · `DO-DONT.md` (the bans) ·
> `../research/legal-compliance-ph.md` §4.3–4.4 (pricing representation)

---

## 0. Why this document exists

Tyres are the only inventory in this shop that **goes out of date while it sits still.**
Oil does not age on the shelf in any way a customer will ever notice. A tyre does, because
it carries a production date stamped into it, and because a tyre that has already spent
24 months of its life on a rack has 24 fewer months to give the next owner.

That is a real cost, it is a real disclosure obligation, and it is also **the single most
differentiating thing this shop can say** in a market where 138 registered businesses
publish nothing at all (`../research/competitors.md` §2.5).

This playbook does three things:

1. Turns a DOT code into a **price band**, with the margin arithmetic shown.
2. Writes the **disclosure line**, so selling an older tyre disclosed is defensible.
3. Sets a **hard floor** below which nothing ships without the owner.

---

## 1. The field, and how to read it

The only field that ages a tyre is `Product.dotCode` — `string | null`, documented in
`src/lib/inventory-types.ts` as *"Production week/year, e.g. '2418' = week 18 of 2024.
Tyres degrade."*

### 1.1 Where the DOT code physically is

On the **sidewall**, moulded into the rubber. Full format is `DOT` + 13 alphanumeric
characters; the **last four are the date code** — `WWYY`, two-digit week then two-digit year.

| DOT example | Reads as |
| --- | --- |
| `DOT 6X2W A1B2 C3D4` | Week **04**, **24** (2024) |
| `DOT 7XYZ 1234 EFGH` | Week **34**, **24** (2024) |
| `2418` | Week **18** of **2024** |

⚠️ **TODO-VERIFY (owner, with each tyre brand stocked):** print the DOT location from a
physical tyre of each brand in the rack and paste it here. It moves between brands and it is
on the side opposite the size code on some patterns. Do not write copy that tells a
customer to look in the wrong place.

### 1.2 The date algorithm — one implementation, used everywhere

A marketing campaign, an operator screen and a public availability page must all agree on
what "24 months old" means, or the shop will sell a tyre as "2 years" from one screen and
"3 years" from another. Deterministic rule:

```
dotCode  = last 4 characters of Product.dotCode
year     = 2000 + YY
week     = WW

manufacturedOn = Monday of ISO week WW of that year
ageMonths      = whole months between manufacturedOn and today
ageDays        = days between manufacturedOn and today
```

Worked check — `2418`: year 2024, week 18. ISO week 1 of 2024 began Monday 1 Jan 2024
(1 Jan 2024 was a Monday), so week 18 begins **Monday 29 April 2024**.

| Boundary | `manufacturedOn` |
| --- | --- |
| `2301` | Mon 2 Jan 2023 |
| `2352` | Mon 25 Dec 2023 |
| `2401` | Mon 1 Jan 2024 |
| `2418` | Mon 29 Apr 2024 |
| `2452` | Mon 23 Dec 2024 |
| `2501` | Mon 30 Dec 2024 |

Three edge cases the implementation must handle, not crash on:

1. **ISO week 53.** Some years have it, some do not. If `week === 53` and the target ISO
   year has only 52 weeks, use `week52Start + 7 days`. Never roll into January.
2. **The December/January overlap.** `2352` (Mon 25 Dec 2023) and `2501` (Mon 30 Dec 2024)
   are *different years* and both land in late December. A naive `parseInt("50")` on the
   string `2352` gives 50, and a naive `parseInt("52")` on `2501` gives 1 — the field is
   always read from the **last four characters**, never the whole string.
3. **The two-digit year.** `YY` is ambiguous by design beyond the next 75 years. Irrelevant
   for this catalogue; document it and move on.

### 1.3 `ageDays` is computed from the DOT code, never from `shelfLifeDays`

Two different fields, two different jobs, and conflating them is a real bug:

| Field | Applies to | Meaning |
| --- | --- | --- |
| `Product.shelfLifeDays` | **Oil, coolant, additives, brake fluid** | Days from receipt to expiry. Drives `isNearExpiry` on `ProductAvailabilityDto`. |
| `Product.dotCode` → `ageDays` | **Tyres only** | Days since the tyre was *manufactured*. `ProductAvailabilityDto.ageDays` is the derived value. |

`schema.prisma` says it outright on `shelfLifeDays`: *"Shelf life in days from receipt.
Oil and coolant expire; **tyres do not**."* So **leave `shelfLifeDays` null on every
tyre** and drive age entirely off the DOT code. A tyre with a `shelfLifeDays` set would
enter the 30-day `isNearExpiry` window and get treated as an expiring consumable, which it
is not.

🚩 **Contract note to the orchestrator (reported, not changed):**
`ProductAvailabilityDto.ageDays` is commented *"Days until the DOT-coded stock is considered
stale, if tracked."* That reads as **time remaining**, but the field is named `ageDays`,
which reads as **time elapsed** — and every one of these four files needs *elapsed*. The
comment and the name disagree. **Recommendation: `ageDays` = days since manufacture,
monotonic, and fix the comment.** Until that is settled, A2 must document which it
implements and every consumer of it must read the JSDoc, not the name.

### 1.4 The rule that protects the whole thing

> **The physical tyre is the truth. `Product.dotCode` is what we wrote down.**

Whoever writes the job order **reads the DOT off the sidewall** and writes it on the card.
They do not copy it from the product record. If what is on the tyre and what is in the
system disagree, that is a receiving error: post an `ADJUST_DOWN`/`SHRINK` movement with a
real reason, fix the record, and **stop selling that line until it has been recounted.**

A clearance campaign built on a wrong DOT code is not a marketing problem. It is a
misrepresentation the customer can check for themselves with a phone camera.

---

## 2. The age bands

### 2.1 The bands

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION.** These bands are a **shop merchandising
policy**, not a legal requirement and not a manufacturer specification. No Philippine
regulation on tyre retirement age was retrieved during research
(`../research/legal-compliance-ph.md` §4.1 — RA 7394 and its IRR could not be fetched).

| Band | `ageDays` | Label used with the customer | What it actually is |
| --- | --- | --- | --- |
| **A** | `< 365` | *(no label — never mentioned)* | Fresh. The reference price for every other band. |
| **B** | `365 – 729` | "Made 20XX" | **Perfectly good stock.** Not a clearance problem. |
| **C** | `730 – 1094` | "Made 20XX — aged stock" | Where the discounting starts. |
| **D** | `1095+` | "Made 20XX — older stock, priced to move" | Liquidation. Supplier return first. |

### 2.2 The most important sentence in this document

> **Age is the *gate*. Velocity is the *price*.**

Band B tyres do not need a discount. A two-year-old tyre with 4 mm of tread and a clean
sidewall is a normal tyre that a normal shop sells at a normal price, and discounting it
teaches a customer that EYG's prices are a function of how long something has been on the
shelf. That customer then waits for a tyre to age before buying, and they are right to.

The correct trigger for a discount is **band ∩ velocity**, where velocity is read from the
ledger the system already keeps: `StockMovement` rows of kind `CONSUME` for that
`productId` in the last 60 days.

```
Discount is permitted ONLY when:
    band ∈ { C, D }                                    // age qualifies
AND NO CONSUME movement for productId in 60 days      // and it has not sold
AND stock.isLow === false                             // and we are not short of it
AND stock.available > 0                                // and there is something to sell
```

Band A and band B are therefore **structurally excluded from every clearance**, no matter
how slow they move. A band B tyre that has not sold in 90 days gets a **price review**, not
a discount — the correct response to a slow-moving fresh tyre is to return it to the
supplier (`RETURN_TO_SUPPLIER`) or to work it into a bundle, not to shave the price.

### 2.3 Price bands

| Band | Max discount off shelf price | Margin floor it must respect | Owner approval required? |
| --- | --- | --- | --- |
| **A** `< 12 mo` | **0%** | n/a — this *is* the reference price | No |
| **B** `12–24 mo` | **0%** | n/a | **No — and a counter attempt to discount band B is refused** |
| **C** `24–36 mo` | **5%**, rising to **10%** once `ageDays > 1094` | §4 floor, checked per SKU | Yes, per campaign, in writing |
| **D** `36 mo +` | **10% maximum** | §4 floor, checked per SKU | **Yes. Per SKU. On paper. Before it is published.** |

**5% is the band-C starting point, not the target.** 10% is the house ceiling for tyres
(`PROMO-PLAYBOOK.md` §4: *"Tyres — 10% … thin margin, brand-loyal buyers"*) and it is a
ceiling, not a discount. If clearing a tyre needs 10% off, the tyre is too slow and the
fix is a supplier return, not a deeper discount.

### 2.4 Band D: try four things, in this order

Discounting is the **last** option, not the first. `MOVEMENT_KINDS` in
`src/lib/inventory-types.ts` contains three kinds that are all better than a discount:

| Order | Action | `MovementKind` | Why it beats a discount |
| --- | --- | --- | --- |
| 1 | **Ask the supplier to take it back** | `RETURN_TO_SUPPLIER` | Distributors have ageing-stock and warranty-claim terms on slow SKUs. ⚠️ **TODO-VERIFY per supplier in writing — do not assume this exists.** |
| 2 | **Move it to a bundle** | *(no movement)* | Sells the tyre at full price inside a service job where the margin is the labour. Zero discount, full revenue. |
| 3 | **Shrink it out of the book, honestly** | `SHRINK` | Removes the dead money from the valuation report so the owner is not managing a number that does not exist. Requires a real `reason`. |
| 4 | **Discount it, disclosed** | *(price change only)* | Only now. With the owner on paper. |

Every one of 1–3 requires a **non-empty, human-readable `reason`** on the movement. `1`
and `3` change `onHand`. `2` changes nothing on the shelf and everything on the invoice.

---

## 3. "Off sell" vs "off cost" — the arithmetic nobody at the counter knows

This is the section that decides whether the clearance makes money or eats it.

### 3.1 Why the distinction is not pedantic

Every shelf label, every Facebook post and every customer conversation says **"10% off."**
Ten percent of *what*? The customer hears ten percent off **the price they are paying**.
The shop's P&L experiences ten percent off **more than that**, because the cost did not
move with the discount.

> **On a 25%-margin tyre, "10% off" is a 13.3% give-away against what you paid.**

### 3.2 The three formulas

Let `GM` = gross margin at the *shelf price* = `(sell − cost) ÷ sell`, and `d` = the
discount as a fraction of the shelf price.

```
Margin after the discount          GM_after = 1 − (1 − GM_before) / (1 − d)

The same discount, on your money   %off cost = d / (1 − GM_before)

Max discount that still lands      d_max = 1 − (1 − GM_before) / (1 − GM_floor)
on a margin floor
```

### 3.3 Worked table — shelf price normalised to ₱100

No real prices appear here. **Shelf price = ₱100 in every row**; the cost is derived from
the margin the shop actually realises. Substitute the real `costPrice` and `sellPrice` from
the product record before using any of this.

**GM at the shelf price = 25%** → cost is ₱75, and the shop is making ₱25 on the tyre.

| Discount | New shelf price | Margin after | The discount, as % of what you paid | Margin change |
| --- | --- | --- | --- | --- |
| 5% | ₱95 | **21.05%** | 6.7% | −3.95 pts |
| **10%** | **₱90** | **16.7%** | **13.3%** | **−8.3 pts** |
| 15% | ₱85 | 11.8% | 20.0% | −13.2 pts |
| 20% | ₱80 | 6.25% | 26.7% | −18.7 pts |
| 25% | ₱75 | **0.0%** | 33.3% | −25.0 pts — break-even, no labour paid |

**Read that last row again.** A "25% off" tyre sale on a 25%-margin tyre earns **exactly
zero**, before anyone has mounted it, balanced it, or swept the floor. The advertised
discount is smaller than the real one in every single row.

### 3.4 The full conversion table

Shelf price ₱100 throughout. `GM at shelf` is the row. Read **across** for a discount,
**down** for a starting margin.

| GM at shelf | Cost | 5% off → margin · %off cost | 10% off → margin · %off cost | 15% off → margin · %off cost | 20% off → margin · %off cost |
| --- | --- | --- | --- | --- | --- |
| **10%** | ₱90 | 5.3% · 5.6% | **0.0% · 11.1%** | −5.9% · 16.7% | −12.5% · 22.2% |
| **15%** | ₱85 | 10.5% · 5.9% | 5.6% · 11.8% | **0.0% · 17.6%** | −6.25% · 23.5% |
| **20%** | ₱80 | 15.8% · 6.25% | 11.1% · 12.5% | 5.9% · 18.75% | **0.0% · 25.0%** |
| **25%** | ₱75 | 21.05% · 6.7% | 16.7% · 13.3% | 11.8% · 20.0% | 6.25% · 26.7% |
| **30%** | ₱70 | 26.3% · 7.1% | 22.2% · 14.3% | 17.6% · 21.4% | 12.5% · 28.6% |
| **35%** | ₱65 | 31.6% · 7.7% | 27.8% · 15.4% | 23.5% · 23.1% | 18.8% · 30.8% |

🚨 **Any negative number in that table is a below-cost sale.** The 10%-margin row at 10%
off lands at exactly ₱0 margin, and one step further is negative. A tyre shop that realises
10% on tyres — entirely possible on a branded tyre bought from a distributor — **cannot
discount at all.** That is a fact about its own purchase price, not a failure of nerve.

### 3.5 The d_max table — the number to actually put in the software

Maximum discount off the shelf price that still lands on a chosen margin floor:

| GM at shelf | hold 20% floor | hold 15% floor | hold 12% floor | hold 10% floor |
| --- | --- | --- | --- | --- |
| 10% | impossible | impossible | impossible | **0%** |
| 15% | impossible | **0%** | 3.4% | 5.6% |
| 20% | **0%** | 5.9% | 9.1% | 11.1% |
| 25% | 6.25% | 11.8% | 14.8% | 16.7% |
| 30% | 12.5% | 17.6% | 20.5% | 22.2% |
| 35% | 18.8% | 23.5% | 26.1% | 27.8% |

**"impossible" means the floor is already below where the tyre sells.** At 10% gross
margin you are already under a 12% floor before you discount anything.

**The clearance rule, in one line:**

> `allowedDiscount = min(10% house ceiling, d_max for the SKU's real margin, band ceiling)`
> **and if the result is 0%, that tyre is not for the clearance. It is for
> `RETURN_TO_SUPPLIER`.**

---

## 4. The hard floor — what "below cost" actually means here

### 4.1 Why invoice cost is the wrong floor

Tyre margin in this shop is not `sell − invoice cost`. The invoice is only the first cost.
The real cost of selling a tyre at a reduced price includes:

| Component | Why it counts | Tracked where |
| --- | --- | --- |
| Invoice cost | What the supplier charged | `Product.costPrice` |
| Mounting labour | Bay time, a technician, the lift | Service labour rate ⚠️ owner |
| Balancing labour | Machine time, weights, valve | Service labour rate ⚠️ owner |
| Fitting consumables | Valve stems, soap, lubricant, wipe | `kind: "CONSUMABLE"` |
| Payment fee | GCash / Maya / card fee on a lower total | ⚠️ owner |
| Share of shrinkage | The tyres that get vulcanized or scrapped | Ledger history |

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION.** The whole point of the floor is to force a
decision, so it is expressed as a **multiplier on a field that exists**, not as a peso
figure nobody can check:

```
LANDED FLOOR      floorPHP = costPrice × 1.12        // absolute hard stop
THINK LINE        thinkPHP = costPrice × 1.20        // campaign requires written approval
```

These two multipliers are placeholders chosen to be obviously round and obviously arguable.
**The owner replaces them with the real landed-cost calculation before any campaign ships.**
The formula is the deliverable; the multiplier is a starting point.

### 4.2 Three gates, in order. Every one is hard

| Gate | Test | Result if failed |
| --- | --- | --- |
| **1 — Known cost** | `costPrice > 0` | 🚫 **Refuse to price.** `schema.prisma` defines `costPrice 0 = unknown`. A margin computed from an unknown cost is a fiction. The clearance calculator **must not return a price for a product whose `costPrice` is 0.** |
| **2 — House ceiling** | `allowedDiscount ≤ 10%` | Cap it, or refuse. Never exceed 10% on a tyre (`PROMO-PLAYBOOK.md` §4). |
| **3 — Landed floor** | `clearancePrice ≥ floorPHP` | 🚫 **Owner approval, in writing, per SKU, before publication.** Not per campaign. Per SKU. |

**And the absolute rule, stated once:**

> 🚫 **No tyre is ever published at or below `costPrice` without the owner approving that specific tyre, on paper, before it goes up.**
>
> The owner may approve it. The owner has to be the one who decided. No mechanic, no
> campaign builder, no urgency, and no "the customer is standing right here" changes this.

### 4.3 The approval record — what "on paper" means

Gate 3 requires a line the shop can produce six weeks later when the margin does not look
like the spreadsheet said it would. Minimum fields:

| Field | Example |
| --- | --- |
| `sku` | `TY-20555R16-MI-PRIM4` |
| `size` / `brand` / `pattern` | `205/55R16` · Michelin · Primacy 4 |
| `dotCode` **read off the tyre** | `2319` |
| `ageDays` at approval | 632 |
| `costPrice` | *(real, from the invoice)* |
| `clearancePrice` | *(the approved number)* |
| Margin **after** approval | *(computed, signed)* |
| Approved by / date | *(name, date)* |
| Review date | *(hard, ≤ 14 days — see §5.4)* |

---

## 5. The disclosure — the whole reason this playbook exists

### 5.1 The law, stated honestly

`../research/legal-compliance-ph.md` §4.1 could not retrieve RA 7394 or its IRR, so **no
section number is asserted anywhere in this document.** What is asserted is the risk
structure, which is stable across consumer-protection regimes:

- **Misleading price representations** — advertising a price or range and charging more
  without disclosure. The §4.3 mitigation is a written job order confirmed **before** work.
- **Conformity with an express warranty** — if you publish "30-day workmanship guarantee",
  you have made a warranty and must honour it. `site.ts` has
  `workmanshipGuaranteeDays: 0`, which is deliberate. **The clearance playbook does not
  create a warranty.** It creates a *disclosure*.
- **Bait-and-switch on tyres** — §4.4 names this as *"the industry's defining failure mode."*
  Advertise a tyre at price X, then discover balancing, alignment, a valve and a repair
  until the real cost is 3× X.

### 5.2 The disclosure line

This is the sentence. It is short enough to say at a counter with a tyre in your hands.

> **"This one's made 20XX."**

Then, if they ask why it is cheaper:

> **"Older stock, so it's priced lower. Same mounting and balancing, same fitting. The
> DOT code is on the sidewall — have a look."**

If they ask whether it is safe:

> **"Check the date and the tread — I'll show you both. It's a tyre with months of life
> left on it, not a used one. New, never fitted."** *(and only that sentence — see §5.5)*

**Written form, on the job order and on the receipt, every time a band C or D tyre is
sold. Not optional. Not verbal-only:**

```
TYRE    Michelin Primacy 4 · 205/55R16
MADE    2023 (DOT 2319) — aged stock, disclosed
PRICE   ₱____  (₱____ mounted, balanced, valve fitted)
```

### 5.3 The written disclosure line, for the website

Where a clearance tyre is shown publicly:

> **"Made 2023. Older stock, priced lower — not worse. We show you the DOT code before
> you pay."**

🚫 Never write: *"As good as new." "Like new." "Factory seconds." "Fresh stock."*
Those are unverifiable claims about a product the customer cannot inspect, and "factory
seconds" is a manufacturing term this shop has no standing to apply to a tyre it bought
through a distributor.

### 5.4 Three disclosure rules that will feel annoying and are non-negotiable

1. **The disclosure precedes the price.** Never hand someone a discounted price and
   disclose the age afterwards. Order matters: year first, price second. This is the
   difference between consent and disclosure-after-the-fact.
2. **The disclosure is per-tyre, not per-campaign.** "Clearance stock" on a Facebook post
   is not disclosure for a specific tyre sold to a specific person. The job order carries it.
3. **Disclosure expires with the approval.** A gate-3 approval is valid for **14 days**, and
   a new approval is required after that with a fresh margin check. Prices move, stock
   moves, and a 4-month-old approval is not a decision anyone made this month.

### 5.5 The three claims the shop must not make about an aged tyre

| ❌ Never | Why | ✅ Instead |
| --- | --- | --- |
| "As good as new" / "like new" | Unverifiable comparative claim about a product with a visible date code | "New, never fitted. Made 20XX." |
| "Safe for X more years" | **A technical lifespan guarantee.** That is an express warranty, created by a marketing sentence, that `site.ts` has not agreed to | "Tread is at N mm. Here's the date code. Decide." |
| "We only sell quality tyres" | The "genuine parts only" trap from `competitors.md` §6 item 1 — unfalsifiable, and a bait-and-switch accusation waiting to happen | "Michelin Primacy 4. Here is the date code." |

The middle one is the dangerous one. **A sentence about remaining life is a warranty.** If
the owner ever wants to say it, it goes in a written policy with a scope and a process —
not in a Facebook caption.

---

## 6. How to clear without teaching customers to wait

The failure mode is not losing money on the discount. It is a customer base that learns to
time their purchases against EYG's calendar. A shop that trains customers to wait is a shop
that only sells in the week before a clearance.

### 6.1 Nine rules, each with the reason

| # | Rule | Why |
| --- | --- | --- |
| 1 | **The clearance price is the only price that size will ever have.** It does not come down again next week, and it does not go back up when the tyre sells. | There is no second rung to wait for. §6 of `PROMO-PLAYBOOK.md`: no silent extensions, no resetting timers. |
| 2 | **One discount event per `productId` per 90 days.** After a size has been on clearance, it returns to list price and cannot re-enter clearance until it reaches a higher band. | Re-entry at the same price is how a customer learns the first price was a fiction. |
| 3 | **Advertise the complete installed price — tyre + mounting + balancing + valve — in one number.** | `legal-compliance-ph.md` §4.4 requires it and it is the industry's defining sin otherwise. It also removes the objection entirely: there is no "extra" to be upset about later. |
| 4 | **Lead with the DOT year, not the discount.** Post reads `Made 2023 · 10% off`, never `10% OFF · made 2023`. | The year is the reason. A post that leads with the number is a sale; a post that leads with the year is a disclosure, and disclosures are not something you learn to wait for. |
| 5 | **Put the labour in the bundle, not in the tyre price.** Aged tyre at list + a discounted alignment or balance. | Discounting labour (up to 25% per playbook §4) costs almost nothing and reads as generous. Discounting the tyre costs 13 points of margin and reads as cheap. Same customer value, 90% of the margin intact. |
| 6 | **Change the angle, never the depth.** Next post is the size, the year, the tread depth, the customer's car. | Six weeks of "10% off, 10% off, 10% off" trains an audience to wait for the next one. |
| 7 | **Delete the post the day the last tyre sells.** Not the day after. | *"A stale clearance post costs more trust than it ever earned"* — `PROMO-PLAYBOOK.md` §2. |
| 8 | **Never run a tyre clearance alongside another tyre discount.** | `PROMO-PLAYBOOK.md` §7: one discount live per category. Two tyre offers means the customer is guessing which is better, and guessing costs counter time. |
| 9 | **Never discount a tyre we are short of.** If `isLow === true`, it is out of the campaign and it becomes a reorder item. | 🚫 This is the rule the whole inventory build exists to enforce. A campaign that outruns the shelf is the worst thing this build could do. |

### 6.2 The counter version

Rule 9 needs a counter script, because this is where it will be tested. A customer with
their hand on the rack asking for a size that is on the wall *and* on the reorder list:

> **"Bawal na 'yon, boss — konti na lang kami ngayon. Ordering na ko, sabihin ko sa 'yo
> pag dating."**
>
> *"That one's off-limits, boss — we're nearly out. I'm ordering now, I'll tell you the day
> it arrives."*

Then route to the pre-order flow (`PREORDER-FLOW.md`). **The reorder and the sale are the
same conversation.** That is the design: low stock is not a lost sale, it is a
pre-order with a date attached.

🚫 Never: *"Baka may konti pa, try mo na."* That is the oversell, spoken out loud.

### 6.3 The post that works — shape, not script

Voice per `../brand/VOICE-AND-TONE.md`. Angle label and content are placeholders.

```
TYRE CLEARANCE — DOT 23xx

Made 2023. Priced lower, not worse. We show you the
date code before you pay.

<brand/pattern> <size>
₱<installed price>, mounted and balanced

Older stock, while the rack lasts. Bring the car, we'll
check the tread with you first.

EGSA Fourlanes, Tuyo · <phone>
```

Angle labels for the next six posts on the same tyre — **six angles, one price, zero
countdown:**

| # | Angle |
| --- | --- |
| 1 | The DOT year, up front |
| 2 | The tread depth on the actual tyre in the rack |
| 3 | The complete installed price, versus what a customer would pay piecemeal |
| 4 | "Your size is on the list" — matched to a car model that fits it |
| 5 | The sidewall photo, DOT circled, showing how to check it themselves |
| 6 | The same tyre fitted on a real customer's car (real photo, consent, no outcome promise) |

---

## 7. The clearance run sheet

Everything below is a **filter**, evaluated against real records. No spreadsheet.

### 7.1 Selector

```
SELECT p.*, sl.onHand, sl.reserved, (sl.onHand - sl.reserved) AS available
FROM Product p
JOIN StockLevel sl ON sl.productId = p.id
WHERE p.kind = 'TYRE'
  AND p.isActive = true
  AND p.dotCode IS NOT NULL                          -- no DOT, no age band
  AND p.costPrice > 0                                -- GATE 1: unknown cost cannot be priced
  AND (sl.onHand - sl.reserved) > 0                  -- nothing to sell is not a campaign
  AND (sl.onHand - sl.reserved) > p.reorderPoint     -- never market what we are short of
  AND ageDays(p.dotCode) >= 730                      -- band C or D only
  AND NOT EXISTS (                                   -- velocity gate
      SELECT 1 FROM StockMovement m
      WHERE m.productId = p.id AND m.kind = 'CONSUME'
        AND m.createdAt > now() - interval 60 days
  )
```

### 7.2 Band assignment

```
band = ageDays < 365 ? 'A' : ageDays < 730 ? 'B' : ageDays < 1095 ? 'C' : 'D'
```

`ProductAvailabilityDto.ageDays` carries `ageDays` already — read it, do not recompute it
in a campaign, or the campaign and the operator screen will disagree.

### 7.3 The price

```
d_band   = 'C' ? 0.05 : 0.10
d_margin = 1 − (1 − GM_at_shelf) / (1 − GM_FLOOR)     // §3.5
allowed  = MIN(0.10, d_band, d_margin)                // house ceiling never exceeds 10%
price    = ROUND(sellPrice × (1 − allowed))

if costPrice <= 0        -> REFUSE. Price unknown. Escalate.
if price < costPrice×1.12 -> ESCALATE. Owner sign-off required before publishing.
if price < costPrice×1.20 -> ESCALATE. Explicit written approval, per SKU.
if price < costPrice     -> BLOCKED. Owner sign-off mandatory. Never auto-publish.
```

`GM_FLOOR` for tyres: **SUGGESTED 12%** — REQUIRES OWNER CONFIRMATION. A tyre business
cannot run at the 22–28% floors that a labour bundle gets, because labour is not in the
tyre line. 12% is the number that keeps the shelf alive without pretending a tyre has a
service margin.

### 7.4 What it is NOT allowed to do

| ❌ Not allowed | Why |
| --- | --- |
| Change `Product.sellPrice` | `sellPrice` is the list price. It is the anchor every other price statement is measured against. A clearance is a **separate published price**, never a silent edit of the shelf price. |
| Touch `onHand`, `reserved`, or any movement | A price change is not a stock event. Posting one as a movement corrupts the ledger and the valuation. |
| Fire on a product with `isLow === true` | Rule 9. |
| Fire when `ageDays` cannot be computed | `dotCode` null ⇒ no band ⇒ no campaign. Not "assume fresh". |
| Publish a **count** of remaining tyres | "3 left" on a Facebook post is a number that will be wrong by tomorrow. Say *"while the rack lasts."* |
| Run with a countdown, or a date that gets extended | `PROMO-PLAYBOOK.md` §6. |

**A campaign whose membership changes when the data changes is not a campaign — it is a
query.** That is the whole design. It cannot outrun the shelf, because the shelf is the
input.

---

## 8. Owner-confirmation register

Every number in this document that is not arithmetic. **Nothing ships until these are
replaced.**

| # | Item | Current value | Status |
| --- | --- | --- | --- |
| 1 | Age band boundaries (12 / 24 / 36 months) | §2.1 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 2 | Velocity window (60 days, no `CONSUME`) | §2.2 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 3 | Band C discount (5%, rising to 10% past 36 months) | §2.3 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 4 | Band D discount (10% max) | §2.3 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 5 | Landed floor multiplier (`costPrice × 1.12`) | §4.1 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 6 | Think-line multiplier (`costPrice × 1.20`) | §4.1 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 7 | Tyre margin floor (`GM_FLOOR = 12%`) | §7.3 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 8 | Approval expiry (14 days) | §5.4 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 9 | One-discount-per-SKU window (90 days) | §6.1 rule 2 | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 10 | Real `costPrice` per tyre SKU | — | 🚫 **TODO-VERIFY** — required before any price |
| 11 | Supplier ageing-stock / warranty-claim terms | §2.4 | 🚫 **TODO-VERIFY** — ask each distributor in writing |
| 12 | DOT code location, per brand stocked | §1.1 | 🚫 **TODO-VERIFY** — read off a physical tyre |
| 13 | Retail tyre margin actually realised (for `GM_at_shelf`) | §3.4 | 🚫 **TODO-VERIFY** — compute from real invoices |
| 14 | Any "remaining life" statement about a tyre | §5.5 | 🚫 **REFUSED until the owner signs a written policy** |

---

## 9. Related

`STOCK-CAMPAIGNS.md` (campaign C2, the trigger) · `PREORDER-FLOW.md` (§6.2 counter
reroute) · `CUSTOMER-BROWSING-UX.md` (what `dotCode` may be shown publicly) ·
`DO-DONT.md` (the bans) · `PROMO-PLAYBOOK.md` §2 Archetype 2, §4 depth, §6 time-boxing ·
`../research/legal-compliance-ph.md` §4.2–4.4 · `../brand/VOICE-AND-TONE.md` §2.4 honesty
