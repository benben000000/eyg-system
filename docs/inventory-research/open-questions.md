# OPEN QUESTIONS — what the shop owner must confirm

### A1 research · compiled 2026-10-03 · **read this before ordering anything**

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  Blunt version: I can tell you what a tyre costs on Shopee today. I cannot     ║
║  tell you what YOU pay, because that number is not public. Everything in the  ║
║  starter catalogue hangs off it.                                              ║
║                                                                               ║
║  38 questions. 8 block launch. 6 block the ordering of stock.                  ║
║  4 are for the accountant, not the owner.                                     ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**Legend**

| | Meaning |
| --- | --- |
| 🔴 **BLOCKING** | The build or the ordering is wrong or unsafe until this is answered |
| 🟠 **HIGH** | Materially changes numbers in a shipped file |
| 🟡 **NORMAL** | Worth knowing; not urgent |
| ⬜ **FOR THE ACCOUNTANT** | Not the owner's call alone |

---

## 0. THE EIGHT THAT BLOCK LAUNCH

| # | Question | Why it blocks |
| --- | --- | --- |
| 🔴 **Q-01** | **What does your PETRONAS distributor actually charge, per pack, per grade?** | ✅ PETRONAS is your confirmed oil brand. 🔴 **I could not find a single Philippine price for it in any source I could reach.** Six catalogue rows rest on a guess, and if the guess is wrong by ₱600 you lose money on every can you sell. **Nothing else in this file matters as much** |
| 🔴 **Q-02** | **How many litres does a PMS on each of my cars actually take?** | 🔴 `ServicePartRequirement.qtyPerService Int` can hold exactly one oil quantity per service. A 1.3 Vios needs ~3.3 L; an Innova 2.0 needs ~4.5 L. **The system cannot currently work out how much oil to reserve.** It also has no field for "this can holds 4 litres" |
| 🔴 **Q-13** | **Is `dotCode` per tyre product, or per delivery?** | 🔴 One `dotCode` per `Product` but many DOT lots per shelf. **The system cannot do FIFO and cannot do an honest DOT clearance campaign.** Blocks A6 |
| 🔴 **Q-14** | **Is 183 Calero St. a stockholding location, or just the registered address?** | ✅ RMO 03-03 §5.2(c) requires inventories *"segregated per location"*. `StockLevel` has no location field. If the tyre trading arm holds stock, there is no field to record it in |
| 🔴 **Q-15** | **How long do I keep records — 5 years or 10?** | 🔴 Two secondary sources conflict (RR 7-2024 says 5; another says 10). ✅ RA 7394 Art. 68(b)(5) separately demands purchase records for **the life of the warranty** — 6 years for a Michelin tyre. **Design for 10, delete nothing, until your accountant answers** |
| 🔴 **Q-18** | **Are the parts actually labelled?** | 🔴 A mechanic standing at an unlabelled box with no scanner **cannot identify the part**. No schema fixes this. It is the single most likely physical failure in this whole build and it is a ₱300 afternoon of a label printer |
| 🔴 **Q-27** | **How long does each supplier actually take, in days?** | 🔴 Every `reorderPoint` in the catalogue assumes a lead time. **I guessed.** Get it wrong and you either stock out with a car on the lift, or you tie up cash in tyres |
| 🔴 **Q-28** | **How many service bays do you actually run?** | 🔴 `BOOKING.capacityPerSlot: 1` is `[UNVERIFIED]` in `site.ts` and it **parameterises the entire slot-race invariant**. If it is wrong, the booking race is wrong, and inventory demand is sized off bookings |

---

## 1. 🔴 PRICING AND SUPPLY — the money questions

### Q-01 · What do you actually pay? *(BLOCKING)*

**The single most valuable question in this document.** One afternoon with a
distributor and one invoice settles it.

| What I need | Catalogue rows affected |
| --- | --- |
| PETRONAS Syntium price list — grade × pack | 4 OIL rows |
| Shell Helix / Caltex / Castrol price list — if you carry them | 2 OIL rows |
| One tyre distributor invoice — the two lines you sell most | 11 TYRE rows |
| One ACDelco or VIC invoice — any filter, any pad | 13 FILTER + BRAKE rows |
| One Motolite or Amaron invoice + the **core credit** per returned unit | 4 BATTERY rows |

> 🔴 **Ask the tyre distributor four questions, not one:**
>
> 1. What is my cost on a `205/55R16` Michelin Energy XM2+, by the pair?
> 2. What is my cost on a `205/55R16` Radar Dimax Sprint?
> 3. **What is my rebate structure at end of quarter?**  ← the real margin
> 4. **What is your lead time, in days, from order to my rack?**

### Q-01b · Do you run on rebates? *(HIGH)*

🔴 Tyre margins are thin **because of rebates**. A 19.7% gross margin becomes
comfortable with a quarterly rebate; without it, `TYR-BFG-26565R17-ADVT` is a
₱6,902 bet on a 19.7% coin flip. **Nothing in this build knows about rebates.**
Should it?

### Q-09 · Is my assumed trade discount anywhere near right? *(HIGH)*

`pricing-benchmarks.md` §6 lists the assumption the whole catalogue rests on:

| Category | Factor I used |
| --- | --- |
| Tyres (mid/premium) | 0.68 of online retail |
| Tyres (value) | 0.78 |
| Oil | 0.76 |
| Filters | 0.62 |
| Brake pads / rotors | 0.60 |
| Batteries | 0.72 |
| Wipers, fluids, consumables | 0.60 |

> **If your real figure is 0.55 rather than 0.68 on tyres, ten of the eleven tyre
> rows in the catalogue are underwater.** One invoice (Q-01) settles this. The
> table exists so you can correct my arithmetic rather than guess at it.
> *(Formerly cited as Q-01c; Q-09 is the canonical reference.)*

### Q-02 · Oil quantities per vehicle *(BLOCKING)*

**This one is arithmetic you can do with an oil funnel and a service manual.**

| Vehicle | Engine | Approx. fill | My status |
| --- | --- | --- | --- |
| Toyota Vios 1.3 / 1.5 | 1NR-FE / 2NR-FE | ~3.3 L / ~3.5 L | 🧠 estimated |
| Toyota Corolla Altis 1.8 | 2ZR-FE | ~4.5 L | 🧠 estimated |
| Toyota Innova 2.0 | 3NR-FE | ~4.5 L | 🧠 estimated |
| Toyota Innova 2.8 diesel | 7GD-FHV | ~6.0 L | 🧠 estimated |
| Toyota Hilux 2.4 / 2.8 | 2GD / 2GD | ~9.5 L / ~10 L | 🧠 estimated |
| Mitsubishi Xpander 1.5 / 2.0 | 4A92 / 4B11 | ~4.5 L / ~4.5 L | 🧠 estimated |
| Honda Civic 1.8 / 2.0 | R20A / K20C | ~4.0 L / ~4.7 L | 🧠 estimated |
| Hyundai Accent 1.4 / 1.6 | G4 / GDI | ~3.5 L / ~3.5 L | 🧠 estimated |
| Nissan Urvan 2.5 | K2M | ~6.0 L | 🧠 estimated |
| Suzuki Ertiga 1.5 | K14B | ~4.5 L | 🧠 estimated |

🟠 **Every figure in that table is a guess. Delete it all and use your own
service manual.** Then answer the structural question:

> **Does a "Preventive Maintenance Service" booking need to know the fill volume,
> or does the mechanic top up to the dipstick and record the litres used?**
>
> ✅ The second is how most PH shops actually work, and it is **much** easier to
> build. If that is you, the answer to Q-02 is **"the mechanic records the litres
> consumed at handover"** and no schema change is needed.

### Q-13 · One DOT code or one per delivery? *(BLOCKING for A6)*

🟡 The technical facts are already settled (`dot-codes-and-shelf-life.md` §6).
What is needed is a **decision**:

| Option | What you get | What it costs |
| --- | --- | --- |
| **A.** Add a `ProductLot` table | FIFO, honest DOT clearance, `ageDays` that means something | A schema change and A2/A3/A6/A7 rework |
| **B.** Leave `dotCode` null and track age on paper | Nothing digital | A6 **cannot ship a DOT campaign.** Honest, but it kills the feature |

> **My recommendation: Option A, but only for `kind: TYRE`.** Every other kind has
> one obvious age (or none), and a lot table on tyres alone is a contained change.
> **The orchestrator decides, not me.** But it must be decided **before A6
> builds**, and I would flag it as the highest-value single change in the build.

### Q-14 · Do both addresses hold stock? *(BLOCKING)*

✅ EGSA Fourlanes, Tuyo (the service centre) and 183 Calero St., Ibayo (the tyre
trading arm) are **both confirmed** — different phone numbers, different
registrations (`facebook-intel.md`).

> **Do you keep tyres at Calero and do the fitting at EGSA?**
>
> - **Yes** → you need a location dimension, and you need stock to *move* between
>   locations. ✅ `StockMovementKind` already has `TRANSFER_IN` and
>   `TRANSFER_OUT`, so the movements exist. What is missing is a place to move
>   them *to*.
> - **No** → Calero is just where the business is registered. Say so, and record
>   it, so the BIR's *"segregated per location"* question has an answer.

### Q-15 · Records: 5 years or 10? *(BLOCKING — with your accountant)*

Two sources conflict. ✅ RA 7394 Art. 68(b)(5) independently demands purchase
records for **the lifetime of the warranty** — ✅ 6 years for a Michelin tyre.

> **Until answered: design for 10 years and delete nothing.** Deleting early is
> irreversible; keeping too long costs only disk.

### Q-16 · Which system is the BIR-registered one? *(HIGH)*

🔴 This inventory app is **not** a POS and must not print BIR invoices. Which
system issues your official receipts today?

### Q-27 · Lead times, in days, per supplier *(BLOCKING)*

| Supplier type | My assumed lead time | Status |
| --- | --- | --- |
| Metro Manila tyre distributor | 3 days | 🧠 guessed |
| Local parts trade (ACDelco / VIC / Hi-Q / ICER) | 2 days | 🧠 guessed |
| Motolite / Amaron distributor | 7 days | 🧠 guessed |
| Cloud/freight from Manila | 5 days | 🧠 guessed |

**Batteries are the dangerous one.** ✅ An AGM battery sitting in a warehouse for
three weeks **self-discharges**. If your battery lead time is 7 days, you need a
larger `reorderPoint` than the arithmetic suggests.

---

## 2. 🔴 LEGAL AND POLICY — questions with a regulator attached

### Q-04 · Genuine filters or equivalent? *(HIGH)*

✅ The catalogue stocks **ACDelco** equivalents only. ✅ Genuine Toyota
`90915-YZZE1` exists and a marketplace floor of ₱130 was seen; ✅ the VIC
equivalent (C-110) is ₱250 at partspro.ph.

> **Which do you actually fit today, and do you sell them by the OEM part number
> or by brand?** 🔴 Do not sell the genuine part number at the equivalent's
> price. That is both a margin error and a honesty problem.
> **Do you price-match a customer who quotes you the marketplace price?** If yes,
> you need to know that *before* the price list goes on the shelf.

### Q-05 · Batteries: core credit, warranty, and subsidiarily-liability exposure *(HIGH)*

Three questions, all for the battery distributor:

1. **What is the core credit per returned battery, per group size?**
2. **What is the warranty, in months, and what does a claim require?** ✅ Amaron's
   public site does not publish it. ✅ It states privately and commercially are
   **different** periods — ask for both.
3. 🔴 **If a warranty claim is refused, does the shop eat it?** ✅ RA 7394
   Art. 68(b)(3): *"the retailer shall be subsidiarily liable… the retailer shall
   shoulder the expenses and costs necessary to honor the warranty."*
   **At ₱11,500 for a JADE AGM that is ₱11,500 of shop money per unreturnable
   unit.** Is that acceptable, or do you cap the battery range?

### Q-06 · Where does the core credit live in the system? *(HIGH)*

✅ `costPrice Int @default(0)` — one number. A battery's true cost is
**purchase price minus core credit**. Three options:

| Option | Behaviour |
| --- | --- |
| **A.** `costPrice` = net of core credit | ✅ Simple. 🔴 But the number now means two things and nobody can see the gross |
| **B.** `costPrice` = gross, core credit as a `MovementKind` | ✅ Honest ledger. Needs an enum value the schema does not have |
| **C.** A separate `coreCredit` field | ✅ Cleanest. 🔴 Schema change |

**Do not do any of these silently.** Which one?

### Q-20 · Is "Brake Pad Replacement" a separate service? *(HIGH)*

✅ The confirmed service list has **"Brake Cleaning and Maintenance"** and
**nothing about pads.** But the catalogue has four brake-pad rows and a rotor.

> **Do you change pads and discs? Under which service name?**
> 🔴 If the seed data has a single `brake-pad-replacement` absorbing the
> brake-cleaning BOM, a customer who books "Brake Cleaning" will consume a set of
> pads. **And if you do not change pads, four rows of the catalogue are wrong.**

### Q-07 · What is actually in the service list? *(HIGH)*

✅ Confirmed: PMS, Change Oil, Brake Cleaning, Underchassis, Wheel Alignment,
Wheel Balancing, Tire Mounting, Nitrogen, Battery Replacement, OBD.

> **Are these also real?** Undercoating · rustproofing · AC regas · engine tune-up
> · shocks · CVL · glass · roadside · motorcycles.
> 🔴 **Nothing outside the ten gets a SKU.** Answer this and the catalogue
> boundary is settled.

---

## 3. 🟡 THE STOCK DECISIONS

### Q-03 · The two commercial sizes you have actually sold *(HIGH)*

✅ You have **confirmed sold**:

- **Radar Renegade R/T+ `265/65R17`** — 🔴 TireDepot returned 404 for it, so I
  have **no anchor at all** and substituted BFGoodrich
- **Blacklion Mix `11R22.5`** — 🔴 no PH price found anywhere

> **Do you still get asked for these? Do you order-to-order, or hold stock?**
> 🧡 My assumption is **order-to-order**, so `reorderPoint: 0`. Confirm.
> **Do you still carry them at all?** If EYG's tyre-trading arm is a separate
> business from the service centre, the catalogue may be modelling the wrong shop.

### Q-25 · Which tyre brands do you carry? *(NORMAL)*

| Brand | Status |
| --- | --- |
| **Michelin, BFGoodrich** | ✅ Confirmed via the official dealer locators |
| **Radar, Deestone, Blacklion** | ✅ Confirmed **sold**, per your own stock posts |
| **Blackhawk, Arivo, MRF** | ⚠️ Your own About-text claim; unverified |
| **Maxxis** | ❌ Not on either list — and the catalogue has one Maxxis row |
| Bridgestone, Goodyear, Dunlop, Yokohama | ❌ Not evidenced. 🔴 **Bridgestone is excluded from the catalogue on margin grounds — see §3.3 DANGER 2** |

### Q-08 · Balancing weights, valve cores, tyre plugs *(NORMAL)*

✅ **Wheel Balancing** is a confirmed service and it consumes weights. 🔴 **I could
not find a Philippine price for weights or valve cores and have deliberately not
modelled them.**

> **What do you buy, in what unit, from whom, at what price?** A box of clip-on
> weights is not a kilogram of weights, and the box's tare has to live somewhere.
> Until this is answered, the balancing labour carries them. **This is a
> documented gap, not an oversight.**

### Q-10 · Is Total oil sold in this area? *(NORMAL)*

The brief listed Total among brands sold in PH. 🔴 **I found no Total product in
any Philippine seller I read.** Either it is genuinely absent regionally, or I
missed it. Do you carry it?

### Q-11 · ACCRA — do you buy through a fuel-company channel? *(HIGH, if yes)*

🟡 The oil trade in the Philippines runs partly through **ACCRA** — the
petroleum industry representative. If you buy through an oil-company channel
(Motul, Shell, Petrolux, Total) the pricing and the discount structure are not the
same as a trade counter. **Your accountant or your supplier can explain it; I
could not research it.**

### Q-12 · Does your oil supplier publish a shelf life? *(NORMAL — but it sets `shelfLifeDays`)*

🔴 **I found no Philippine engine-oil shelf life anywhere.** ✅ Motul's Malaysian
site states an **industry** norm: sealed *"up to five years"*, opened *"ideally
within 12 months"*. ✅ PETRONAS publishes **three years** — but for **hydraulic**
oil, a different product class.

> The catalogue therefore sets `shelfLifeDays: 1,095` (3 years) on sealed oil —
> **deliberately tighter than Motul's 5-year claim**, because a Bataan shop turns
> oil faster than three years and a tighter number makes the stale-stock watch
> actually fire.
> 🟡 **Ask your distributor for the datasheet.** A printed shelf life on a can is
> both a compliance artefact and a real answer to a customer's question.

### Q-18 · Are the parts labelled? *(BLOCKING)*

> **Can a mechanic standing at a box identify what is in it without asking you?**

| Answer | Consequence |
| --- | --- |
| **Yes** | 🟢 Fine. Keep it that way. A label printer and 200 labels is a few hours' work |
| **No** | 🔴 **This is the most likely physical failure in the entire build.** ✅ Innovapptive's own benchmark: *"Barcode scan plus material master photo"* beats *"Part number read off a label."* No schema fixes an unlabelled box |

**And the follow-up:** do you own a barcode scanner? ✅ `Product.barcode` exists
and is optional. 🟡 If you buy one, it must populate `barcode` or it is decoration.

### Q-24 · Does that air filter actually fit? *(NORMAL)*

`FLT-AIR-ACD-INNOVA` — ✅ partspro.ph lists it for *"Toyota Fortuner 2015-,
**Hilux 2015-**, **Innova 2016-**"*, but that is one seller's description.
🔴 **At a ₱521 estimated cost, a wrong fitment guess is an expensive mistake.**
Check the part number on the box against the manual before ordering six.

### Q-19 · Default `isActive` for anything outside a confirmed service *(NORMAL)*

Three rows are not tied to a confirmed service: the 10 L coolant, the 20" wiper,
the 24" wiper. **Ship them active or inactive by default?** 🟢 I'd say inactive
and let the owner switch on. But it is your shelf.

### Q-17 · Should "on order" be visible in the system? *(HIGH — a schema question)*

✅ Shopify models **seven** inventory states; ✅ TireConnect returns
`delivery_date_time` and `cutoff` on every tyre quote. 🔴 **This schema models
three** (`onHand`, `reserved`, `available`) and has **no `onOrder`**.

> **Is a tyre that is on a PO but not yet on the rack — in stock or not?**
> It is **not**, and the booking flow will refuse correctly without it. But:
>
> - A6's brief asks for a **"tell me when it lands"** flow. **It has nothing to
>   read today.** 🟡 That flow becomes a paper phone log.
> - A4's shortfall state says *"we may need to order this in"*. 🔴 **With no
>   `onOrder`, staff cannot tell the customer when.** That is the single most
>   common operational sentence in a tyre shop.
>
> **Do you want "arriving Thursday, 4 units of `205/55R16`" on the counter
> screen?** If yes, that is a field, and it is the highest-value single addition
> to the schema. **The orchestrator decides, not me.**

### Q-21 · What are your five machines actually worth? *(NORMAL)*

`TOL-BAL-VERA-5T`, `TOL-ALN-MACH-4W`, `TOL-TYRCHG-2024`, `TOL-N2GEN-2X`,
`TOL-TORQ-WRNCH-1-2` carry **invented asset values** totalling roughly ₱474,000.
`costPrice` on a `TOOL` row is a **balance-sheet figure, not a purchase price**,
and the numbers in the catalogue are almost certainly wrong.

> **Put your real numbers in.** They cost nothing and they are the only numbers on
> the tool rows you actually know.

### Q-22 · What does a bag of 100 valve caps cost you? *(NORMAL)*

`TAR-VALV-CAP-100` has **no research anchor of any kind**. ✅ The only researched
price is **₱699 for ARB branded caps** — a premium accessory brand at roughly
15× the commodity price. **A bag of generic caps is a ₱1–100 item and I have no
evidence for the figure in the catalogue.** Buy one and write the number on the
box. It is the cheapest line to fix.

### Q-23 · What does a 20" NWB wiper cost you? *(NORMAL)*

`WIP-NWB-20` has **no direct anchor**. ✅ NWB 18" is ₱1,090 and PIAA 19" is ₱1,293
at the same retailer, so ₱720 cost / ₱980 sell is a **step between two numbers**,
not a researched price. **Order 2, not 12** until it is confirmed — and 🟡 check
whether NWB even comes in 20"; the catalogue assumed a brand's range is
continuous across sizes, which it may not be.

---

## 4. 🟡 OPERATIONAL REALITY

### Q-26 · How many bays, really? *(BLOCKING — see §0)*

🔴 `BOOKING.capacityPerSlot: 1` in `site.ts` is explicitly `[UNVERIFIED]` and
**it parameterises the entire slot-race invariant.** It also sizes inventory
demand: one bay cannot consume more filters per day than one bay can change.

### Q-29 · Do you serve walk-ins, or bookings only? *(HIGH)*

🟠 This changes the whole UI. If most customers walk in, the inventory screen is
used at the counter with a customer watching. If bookings dominate, it is used at
a desk. ✅ Your Facebook posts suggest both.

### Q-30 · Who counts the shelf, and when? *(HIGH)*

✅ RMO 03-03 §5.14: **no stock records, and the count doesn't tie, and the
discrepancy is treated as undeclared sales.** ✅ Art. 68(b)(5): keep purchase
records for the warranty's life.

> **Real questions:**
>
> - Who does the count — you, or a staff member?
> - How often — ✅ `cycleCountDays` per product needs a real number
> - **Do you have a system, or a notebook?**
> - **Would you actually count, or would you defer it?** A count that does not
>   happen is worse than no count, because it creates a false confidence.

### Q-31 · Do you decant oil? *(HIGH)*

🔴 If you decant 4 L cans into 1 L bottles:

- ✅ Motul, first-party: *"avoid transferring oil into unlabelled or non-airtight
  containers"*
- Decanted oil has a **different shelf life** from sealed
- The system has **no `openedAt` field** and cannot track it
- 🟡 My recommendation: **don't model decants in v1**; record shrinkage as
  `SHRINK`. But if you decant, **the litres consumed per job must be recorded
  somewhere** or the stock will not reconcile.

### Q-32 · How hot is the storeroom? *(NORMAL, and free)*

🟡 ✅ PETRONAS storage guidance: indoors, **0–35 °C**, out of direct sunlight.
✅ Motul: **10–25 °C**. ✅ Michelin PH on tyres: *"a dry place out of direct
sunlight"*.

> **Put a thermometer in the oil store for a week.** If it reads over 35 °C in
> Bataan, the cheapest margin improvement this shop can make is a shaded,
> insulated oil and tyre store — and it improves shelf life at the same time.

### Q-33 · Do you hold a spare tyre as stock? *(NORMAL)*

🧡 In this market customers buy **one or two** tyres, and the spare is a
space-saver that does not match. **Is a spare tyre ever a stocked item, or a
special order?** If it is a special order, `reorderQty: 0` everywhere is correct.

---

## 5. ⬜ FOR THE ACCOUNTANT

| # | Question |
| --- | --- |
| **Q-15** | Records retention: 5 years (RR 7-2024) or 10 years? 🟠 **Design for 10 until told otherwise** |
| **Q-16** | Which system is BIR-registered for receipts? |
| **Q-34** | 🟡 **Are you a 8% flat-income-tax payer or on graduated rates?** Affects the receipt format |
| **Q-35** | 🟡 Are you VAT-registered? If not, ✅ RMO 24-2023 requires the receipt to say so — and it affects whether POS transmits to the EIS |
| **Q-36** | 🟡 **RMC 29-2019 / RMC 5-2021** — which book-of-accounts regime are you on? Manual, loose-leaf, or CAS? |
| **Q-37** | 🟡 Confirm the invoice carries ✅ **RA 7394 Art. 71**'s 90-day workmanship + spare-parts guarantee, labelled ✅ Art. 68(c) *"Full"* or *"Limited"* warranty |

---

## 6. THE SIGN-OFF SHEET — one page to print

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  EYG TIRE & AUTO CARE — INVENTORY SIGN-OFF                                   ║
║  Nothing below is a guess. Sign nothing you have not checked.                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  BLOCKING BEFORE LAUNCH                                                      ║
║   □ Q-01  PETRONAS distributor price list obtained            date ____       ║
║   □ Q-02  Oil fill volume per vehicle — method chosen         date ____       ║
║   □ Q-13  dotCode: per-product or per-lot — DECISION          date ____       ║
║   □ Q-14  Does Calero St. hold stock?                         date ____       ║
║   □ Q-15  Retention 5 or 10 years (with accountant)            date ____       ║
║   □ Q-18  Parts labelled?  Yes / No   Scanner?  Yes / No      date ____       ║
║   □ Q-27  Supplier lead times, per supplier, in days          date ____       ║
║   □ Q-28  Number of service bays — ACTUAL                     date ____       ║
║                                                                              ║
║  BLOCKING BEFORE THE FIRST ORDER                                             ║
║   □ Q-01  One tyre invoice obtained                            date ____       ║
║   □ Q-01  One filter / pad invoice obtained                    date ____       ║
║   □ Q-05  Battery core credit + warranty months + claim route  date ____       ║
║   □ Q-03  Radar R/T+ 265/65R17 and 11R22.5 — still carried?   date ____       ║
║   □ Q-04  Genuine vs equivalent filters — decided              date ____       ║
║                                                                              ║
║  HIGH                                                                       ║
║   □ Q-20  Is brake-pad replacement a separate service?        date ____       ║
║   □ Q-06  Where the battery core credit is recorded            date ____       ║
║   □ Q-07  Full service list confirmed                          date ____       ║
║   □ Q-29  Walk-ins or bookings — which dominates?              date ____       ║
║   □ Q-30  Who counts the shelf, and how often                   date ____       ║
║   □ Q-31  Do you decant oil?                                   date ____       ║
║   □ Q-01b Rebates?                                             date ____       ║
║                                                                              ║
║  APPROVALS                                                                   ║
║   Battery range accepted incl. Art. 68(b)(3) exposure?         ☐ Yes  ☐ No    ║
║   Tyre floor prices approved (minSellPrice)?                   ☐ Yes  ☐ No    ║
║   Bridgestone excluded on margin grounds?                      ☐ Yes  ☐ No    ║
║   90-day Art. 71 guarantee accepted as the floor?              ☐ Yes  ☐ No    ║
║                                                                              ║
║  Owner ______________________________   Date ____________                     ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 7. What happens if the owner answers nothing

🧠 **This is the plan-B the build needs, and it should be written down now.**

| If unanswered | Then the build must |
| --- | --- |
| Q-01 (oil prices) | 🔴 **Do not print any oil price to a customer.** Render *"Call for price"* or show nothing. ✅ **Art. 81 is then satisfied by the shop's own price list, not the website** |
| Q-02 (oil volumes) | 🟠 Ship the mechanic-records-litres-used path. It needs no schema change |
| Q-13 (DOT per lot) | 🔴 **A6 ships no DOT campaign.** `dotCode` stays `null`; `ageDays` returns `null`. 🟢 Honest beats wrong |
| Q-14 (Calero stock) | 🟠 Assume **EGSA only**. One location. Simplest assumption, and the one the schema currently supports |
| Q-15 (retention) | 🟠 Never delete a `StockMovement`. Ever. 🟢 The append-only rule already does this — **so the conservative answer is the default and no decision is needed** |
| Q-18 (labels) | 🔴 Ship anyway, but log it as a known risk. 🟢 The system is still better than a notebook for the BIR |
| Q-27 (lead times) | 🟠 Default `reorderPoint` = **2 weeks of expected demand**, and print the assumption in the UI so a human can correct it |
| Q-28 (bays) | 🔴 **Cannot default.** A one-bay assumption that is wrong produces double-bookings. **Must be answered** |

---

## 8. THE THREE QUESTIONS, IF THE OWNER ONLY HAS FIVE MINUTES

1. **What does your PETRONAS distributor charge for Syntium 5000 5W-30, 4 L?**
   → Q-01. It settles six rows and the whole oil business.

2. **Are your parts in labelled boxes a mechanic can read at arm's length?**
   → Q-18. It settles whether the system can be used at all, at speed, by hand.

3. **Do you want the DOT clearance campaign this season?**
   → Q-13. Because if yes, someone has to decide about per-lot tracking, and
   **it has to be decided before the feature is built, not after.** 🟢 And it is
   the one inventory feature that would be genuinely visible in Balanga, where —
   ✅ five shops checked — nobody publishes a single number anyone can verify.
