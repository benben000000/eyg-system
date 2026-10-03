# DOT CODES, TYRE AGE, SHELF LIFE AND STALE STOCK
### A1 research · compiled 2026-10-03 · all checks performed 2026-10-03 (Asia/Manila)

---

## 0. Why this document exists

Two features in this build depend entirely on it:

- **A6 — the DOT-code-based tyre clearance campaign.** A clearance campaign is
  either honest or it is a scam. Honesty requires knowing what the DOT code
  means, what the brand's own warranty does with it, and what you are allowed to
  claim.
- **A2 — the stale-stock watch.** `ProductAvailabilityDto.ageDays` is in
  `src/lib/inventory-types.ts`. This document says what ageDays should be
  measured against and what the thresholds should be.

Everything with a source has one. Everything without one is tagged
**`UNVERIFIED`** or **`SUGGESTED`**. Nothing here is invented.

---

## 1. What a DOT code actually is

### 1.1 The format — official, primary, US federal law

✅ **49 CFR §574.5(b)(3), "Tire identification requirements"** — eCFR
(`ecfr.gov/current/title-49/subtitle-B/chapter-V/part-574/section-574.5`),
read 2026-10-03. Verbatim:

> *"**Date code.** The date code, consisting of four numerical symbols, is the
> final group. The date code must identify the **week and year of manufacture**.
> The first and second symbols of the date code must identify the week of the
> year by using "01" for the first full calendar week in each year, "02" for the
> second full calendar week, and so on. **The calendar week runs from Sunday
> through the following Saturday.** The final week of each year may include no
> more than six days of the following year. The third and fourth symbols of the
> date code must identify the last two digits of the year of manufacture. For
> example, **0109** means the tire was manufactured in the first full calendar
> week of 2009, or the week beginning on Sunday, January 4, 2009, and ending on
> Saturday, January 10, 2009."*

**So `WKYY` is not folklore. It is the codified US format, and the shop's tyres
carry it because the tyres were made for a global market under this standard.**

### 1.2 The rest of the TIN (what is *not* the date)

✅ Same source:

| Group | Length | Meaning |
| --- | --- | --- |
| 1 | 3 symbols | Plant code, assigned by NHTSA to the manufacturer |
| 2 | 6 symbols | Manufacturer's code / brand-name owner |
| 3 | (varies) | Optional descriptive code — size, construction, tread |
| **4** | **4 symbols** | **`WKYY` — the date code. Always last.** |

Total for a new tyre: **13 symbols**.

### 1.3 Two traps A3's UI must not fall into

**Trap 1 — pre-July-2000 tyres have a 3-digit date code.**
✅ 49 CFR §574.5(g)(4) and the Federal Register preamble that created the rule
(`govinfo.gov/content/pkg/FR-1999-07-08/html/99-17402.htm`, read 2026-10-03)
confirm the change: *"Effective July 2, 2000, the number of digits in the date
code will be increased from 3 to 4."*
🟡 Michelin adds the 1990s marker: 1990–1999 tyres carry a **triangle (◄)** after
the three digits (confirmed on Michelin's own owner manual, see §2.2).
**A three-digit tail with no triangle is ambiguous. Never guess it. Print "DOT
unreadable — ask staff" and make a human look.**

**Trap 2 — the year wraps every 100 years, and a tyre can be older than it looks.**
✅ Continental's own consumer guidance (`generaltire.custhelp.com`, the Continental
family's help site, read 2026-10-03) says it plainly: *"For tires manufactured
prior to the year 2000, **three numbers instead of four** indicate the date of
manufacture."*
**A real risk for this shop specifically:** if any remaining Deestone 185/65-14 or
Blacklion 11R22.5 stock is old enough to predate 2000, a naive 4-digit parser
will read `2247` as week 22 of 2047 and treat a 1990s tyre as brand new.
**Recommendation: any tyre whose parsed year is more than 1 year in the future
must be flagged as unreadable, not silently accepted.**

### 1.4 US dealer record-keeping — cited for completeness, NOT applicable in PH

✅ **49 CFR §574.8** ("Information requirements — tire distributors and dealers",
`ecfr.gov`, read 2026-10-03) requires each independent tyre dealer, at the time
of sale, either to (i) give the purchaser a paper tyre-registration form
recording the full TIN, or (ii)/(iii) transmit the purchaser's name, address,
full TIN and its own name/address to the tyre manufacturer **within 30 days**.

> **🔴 This is US law. It does not apply to a shop in Balanga.**
> **Do not build a "tyre registration" form because of it.** It is documented here
> for one reason only: it demonstrates that the industry *already* treats
> **"full TIN, tied to a specific sale, retained"** as the correct pattern. That
> pattern is worth copying internally. It is not a Philippine obligation.
> Philippine obligations are in `ph-record-keeping-legal.md`.

---

## 2. Tyre age: the "10-year" vs "6-year" argument, resolved

This is the section the whole clearance campaign depends on. Both numbers are
real, they are both from credible sources, and they are **not in conflict — they
measure different things.**

### 2.1 The two clocks, from the tyre brand itself

✅ **Michelin Philippines, first-party, two pages, both read 2026-10-03:**

**(a) The warranty clock — starts at the SALE.**
`michelin.com.ph/michelin-ph-warranty`, *Product Warranty Policy for Passenger
car, Light Truck, Truck Bus and Motorcycle Tires effective from 1st Jan 2026*:

> *"MICHELIN® replacement tires, when used under normal service conditions on
> the vehicle to which they were originally fitted, are covered under this
> warranty as follows: **'The warranty shall remain valid until the original
> usable tread pattern is worn out, or for a period of six (6) years from the
> date of purchase (subject to the presentation of valid proof of purchase),
> whichever occurs first.'**"*
>
> *"**The tire claim shall be accepted only if it is made within 10 years from
> the tire's manufacturing date.**"*

**(b) The safety clock — starts at the FACTORY.**
`michelin.com.ph/auto/advice/change-tires/how-long-do-tires-last`:

> *"**Tire age limit: the 10-year threshold.** If the tires have not been replaced
> 10 years after their date of manufacture, Michelin recommends replacing them
> with new tires **as a precaution**. This recommendation also applies to spare
> tires."*
>
> *"From 5 years of use… After 5 years of use, **have them checked by a
> professional at least once a year**."*
> *"Please consider replacement **before they reach the ten-year mark from their
> date of manufacture, which is considered the upper limit**."*

And Michelin's own caution against over-reading the DOT, from
`michelin.com.ph/auto/advice/tire-basics/do-i-need-to-know-how-to-check-tire-manufacture-codes`:

> *"**The DOT numbers aren't as important as the number of years the tires have
> been used. A tire that's been in use for only 1 year can have aged as much as
> an unused tire kept in storage for 10 years.** In fact, it can be dangerous to
> focus only on when your tire was made, since it makes you overlook several
> other issues your tires might have."*
> *"Make sure your new tires haven't degraded due to heat, poor care, or incorrect
> storage. **Tires should always be stored properly in … dry place out of direct
> sunlight** to avoid cracking or loss of shape."*

### 2.2 The industry counter-position

✅ **U.S. Tire Manufacturers Association, *Tire Care & Safety* guide**, the
September 2025 edition (`ustires.org/system/files/2025-09/Tire Care and Safety
Guide.pdf`), read 2026-10-03:

> *"**Tire Service Life Is Not Determined by Chronological Age** — Tires are
> composed of various materials, including rubber, having performance properties
> essential to the proper functioning of the tire. These component properties
> evolve over a combination of time, service and storage conditions… **Since
> service and storage conditions vary widely, accurately predicting the service
> life of any specific tire based on calendar age is not possible.** USTMA is not
> aware of scientific or technical data that establishes or identifies a specific
> minimum or maximum service life for passenger and light truck tires."*

### 2.3 The verdict — and what it means for this shop

| Position | Source | Effective rule |
| --- | --- | --- |
| **10 years from manufacture = retire it** | ✅ Michelin PH (the brand EYG is a listed dealer for) | The shop's own recommended ceiling |
| **10 years from manufacture = retire it** | ✅ General Tire / Continental, same consumer guidance | Independent corroboration |
| **5 years onward = inspect annually** | ✅ Michelin PH | Inspection regime |
| **"Age alone does not determine life"** | ✅ USTMA, ✅ Michelin PH itself | The honest caveat |
| **6 years from purchase = warranty ends** | ✅ Michelin PH warranty policy, effective 1 Jan 2026 | The commercial clock |
| **10 years from manufacture = claim window closes** | ✅ Michelin PH warranty policy | The hard ceiling |

> **🔴 The single most valuable, citable fact in this document:**
>
> ### An aged tyre sold today still gets a full 6-year warranty from today's sale date — provided it is under 10 years old at manufacture.
>
> Because ✅ Michelin's policy runs the 6 years from **"the date of purchase"**
> (defined as *"the date on your sales invoice"*), and only caps the claim at
> **10 years from manufacture**. A tyre made in week 20 of 2023, sold in October
> 2026, carries a warranty until **October 2032**, and its claim window does not
> close until **week 20 of 2033**.
>
> **That is the entire legal and commercial basis for an honest DOT-based
> clearance campaign.** A6 can say *"These tyres were made in 2023. They carry the
> full six-year Michelin warranty from today's invoice."* — and that is **true**,
> **verifiable**, and **checkable by the customer against their own invoice.**

### 2.4 The threshold table I recommend A2 and A6 to use

**SUGGESTED — REQUIRES OWNER CONFIRMATION.** Derived from the sourced clocks
above. The owner may change these; he may not ship them to a customer.

| Tyre age (from `WKYY`) | Status | Internal action | May be advertised as |
| --- | --- | --- | --- |
| **0 – 12 months** | **FRESH** | Normal stock. First to sell | Normal catalogue price |
| **12 – 24 months** | **CURRENT** | Normal stock | Normal catalogue price |
| **24 – 36 months** | **AGING** | Flag in the stale-stock watch; prefer selling over re-ordering | Normal price. Optional honest note *"stocked 2024"* |
| **36 – 60 months** | **AGED** | Clearance candidate. Re-order only to order, not to stock | Reduced, with **the DOT week stated on the label and the quote** |
| **60 – 120 months** | **PRE-RETIREMENT** | Do not re-order. Sell through or scrap | Deeply reduced. **Must** state the manufacture week/year |
| **> 120 months** | **RETIRE** | 🔴 **Block sale. Do not mount. Do not sell.** Scrab or return | 🔴 **Never advertised. Ever.** |

**The word to use is "stocked" or "manufactured", never "old" or "expired".**
🟡 There is no Philippine legal expiry date for a tyre. Saying "expired" is a
false legal claim. Saying *"made week 20 of 2023, still inside the
manufacturer's ten-year recommendation, full warranty from your invoice"* is
precise, honest, and a *better* sales line than the lie.

---

## 3. Pricing and selling aged stock — the rules

### 3.1 Rules I can support

1. **FIFO by DOT, always.** ✅ 49 CFR §574.5 gives you a week-precise sort key
   for free. Sell the oldest first. This is the single most important operating
   rule in the document: **it costs nothing and it prevents the entire problem.**
2. **Never discount a tyre to below the owner's `minSellPrice`.**
   `Product.minSellPrice` exists in the schema (a floor on `sellPrice`, "a guard
   against a mis-keyed `sellPrice` losing money on a real part") — a3, not
   markdown, is the mechanism for clearing aged stock. **⛔ Do not use A6's
   clearance campaign as a price-override path.** `minSellPrice` is the floor.
3. **State the DOT on the quote, not on the website.** 🟡 **UNVERIFIED that a
   PH customer-facing obligation exists to disclose tyre age** — see
   `ph-record-keeping-legal.md` §6. **Disclosing it anyway is the honest choice
   and it is this shop's differentiator.**
4. **A 6-year-old tyre is not "expired" and cannot be described as such.**
   §2.3. Saying so is a false representation under RA 7394
   (`ph-record-keeping-legal.md` §5).
5. **Do not sell the shop's last tyre of a size to a customer who needs four and
   will need the fifth in a month.** 🧡 The spare is a space-saver on this fleet
   (§2.4 of the landscape doc). Selling a lone 185/65R15 to a Vios owner who has
   three 185/60R15 on the car is a service call in six months and a bad review.
   🧠 **`reorderPoint: 2` on fast-moving tyre lines, not 1.**

### 3.2 What aged stock is actually worth

🧠 INFERRED, and it is the reason a clearance campaign is worth doing at all:

| Age band | Realistic discount vs. a fresh equivalent | Why |
| --- | --- | --- |
| 12–24 months | 0% | No discount needed. It is not old |
| 24–36 months | 10–15% | Enough to move it, not enough to signal "we cannot sell it" |
| 36–60 months | 20–30% | Where the real money is. Still fully warranted |
| 60–120 months | 40–60% | **Owner approval required.** Each peso of this is margin the shop needs to survive the slow months |

> **🔴 The A6 rule that matters more than any of these numbers:**
> the shop's tyre margin is thin (§7 of `pricing-benchmarks.md`). A 40% clearance
> on a tyre bought at 68% of SRP puts the sell price at **41% of SRP**. Below
> cost. **Every clearance price in this build must pass the owner's margin
> approval before it is visible to anyone.** The orchestrator's brief already
> says this ("never market a price below cost without the owner approving the
> margin") — this document supplies the arithmetic.

---

## 4. ENGINE OIL — opened vs sealed, and decant storage

### 4.1 Sourced shelf life

| Source | Claim | Class |
| --- | --- | --- |
| ✅ **Motul**, `motul.com/en-MY/information/can-engine-oil-go-bad`, read 2026-10-03 | *"Most manufacturers — including premium brands — state that engine oil typically lasts **up to five years if it remains sealed and stored correctly**. After that, performance can no longer be guaranteed."* · *"Once a bottle is opened, oxidation begins immediately. Even if the cap is put back on, air and humidity can enter, accelerating degradation. That's why **opened oil should ideally be used within a year**."* · *"Poorly stored oil: replace sooner, regardless of age."* | Brand, first-party. **Note: it is the Motul **Malaysia** site. The rule is stated as the industry's, not Motul's own product claim** |
| 🟡 **PETRONAS**, lubricant FAQ (`global.pli-petronas.com/lubricants-fluid/hydraulic`), read 2026-10-03 | For **hydraulic** oil: *"A hydraulic oil stored as recommended can have a **shelf life of up to three years**."* · *"Hydraulic oils should be **stored indoors in a cool and dry area, away from direct sunlight** and be kept at a temperature of **between 0°C and 35°C**."* | Brand, first-party, **but for a different product class.** Not applicable to engine oil |
| ❌ | **No Philippine-specific engine-oil shelf life found.** No Shell, Caltex, Motul-PH, PETRONAS-PH or Total-PH statement | — |

**I did not find an engine-oil shelf life published by any Philippine brand.
The Motul figure is the best available and it is explicitly framed as an
industry norm.** → `open-questions.md` **Q-12**.

### 4.2 Storage rules that are sourced

✅ Motul, same page:

> *"Always keep oil in the **original container** and **reseal it tightly** after
> use. **Avoid transferring oil into unlabelled or non-airtight containers**,
> which can introduce dirt and moisture."*
> *"Store oil between **10°C and 25°C**, away from sunlight and humidity."*
> *"In Malaysia's tropical climate, poor storage can cause oil to degrade faster
> than expected. To protect it, store oil in a cool, dry place, away from direct
> sunlight and temperature extremes."*

🟡 PETRONAS, same FAQ, different product, useful as a general floor:
**0 °C to 35 °C, indoors, out of direct sunlight.**

### 4.3 🔴 What this means for Bataan, specifically

🧠 INFERRED, and it matters more here than most of this document:

**Bataan is hot.** An uninsulated metal shed in Balanga hits 45 °C+ easily.
🟡 The PETRONAS storage ceiling is 35 °C and the Motul guidance is 10–25 °C.
**A tin shed with a metal roof is the wrong place for oil.** The single cheapest
inventory improvement this shop can make is a **shaded, insulated oil store** —
and it is also a shelf-life improvement, so it pays for itself.

**The decant rule, and it is non-negotiable:** ✅ Motul says explicitly
*"avoid transferring oil into unlabelled or non-airtight containers."* A shop
that decants into a plain bottle with a hand-written grade will (a) lose track of
when it was opened and (b) risk a customer being given the wrong grade.
🟢 If the shop decants at all, decanted oil must carry a written grade, spec,
date opened, and the decanting person's name. **See §6 for why the schema cannot
yet record this.**

### 4.4 Recommended `shelfLifeDays` for oils — SUGGESTED

`Product.shelfLifeDays Int?` exists. Suggested values, all `SUGGESTED — REQUIRES
OWNER CONFIRMATION`:

| Product | `shelfLifeDays` | Basis |
| --- | --- | --- |
| **Unopened** sealed engine oil (4 L can, 1 L bottle) | **1,095** (3 years) | 🧠 Deliberately **shorter** than Motul's 5-year claim. A shop in a hot climate turning stock faster than 3 years gains nothing from a longer number, and a tighter number makes the stale-stock watch actually fire |
| **Opened** / decanted engine oil | **90** | 🧠 Far shorter than Motul's "within a year". Working practice in a hot shop: a decanted litre is used in weeks |
| Brake fluid (DOT 4) | **365** | 🧠 Brake fluid is hygroscopic and is universally treated as a ~2-year maximum unopened, ~1 year opened in humid climates. **🟡 SUGGESTED — I did not find a sourced figure** |
| Coolant | **730** | 🧠 SUGGESTED |
| Brake/parts cleaner (aerosol) | **1,095** | 🧠 SUGGESTED; aerosols are effectively non-expiring while pressurised |
| Grease (tube) | **1,095** | 🧠 SUGGESTED |
| Tyres | **`null`** | The schema comment says it outright: *"Shelf life in days from receipt. Oil and coolant expire; tyres do not."* **Tyre age is tracked by `dotCode`, not `shelfLifeDays`** |

---

## 5. BATTERY WARRANTY WINDOWS AND SELF-DISCHARGE

### 5.1 What the brands actually publish

| Fact | Source | Class |
| --- | --- | --- |
| A battery warranty claim requires **the warranty card and a copy of the sales receipt** | ✅ `amaron-ph.com/tips-for-buying-batteries`, read 2026-10-03 | Brand, first-party, Philippines |
| *"**The warranty period for Private use and Commercial use are different**"* | ✅ same page | Brand, first-party |
| Motolite batteries come with a warranty covering *"factory defects for a specific period"*, registered by **serial number or plate number** in the RES-Q app | ✅ `motolite.com/pages/automotive-battery` + `/pages/e-warranty`, read 2026-10-03 | Brand, first-party, Philippines |
| Motolite: replace when *"over three to five years old"*; do a load test annually after that | ✅ same page | Brand, first-party |
| ❌ **The number of months, for either brand** | — | ❌ **UNVERIFIED.** Neither brand publishes it on its public site |

### 5.2 The garage-door consequence of battery age

🔴 **This is the most under-appreciated inventory fact in the whole project.**

🧡 A lead-acid battery left on a shelf **self-discharges continuously** — it is
a chemical device that is slowly going flat whether or not it is sold. It is not
like oil. It is not like a wiper blade. **A battery in stock is a battery losing
value every week.**

Consequences the build must respect:

1. **`shelfLifeDays` on a `BATTERY` is not decorative.** A suggested 270–365 days
   on a maintenance-free battery is the correct modelling choice, because the
   product genuinely degrades in the shop.
2. **Never sell an old battery as new.** If the warranty card is dated from the
   *purchase*, a 3-year-old stock battery bought today still carries a full
   warranty — but the customer's vehicle may need the battery in year 4, and they
   will hold the shop responsible. This is a genuine consumer-protection risk.
3. **Store batteries properly.** ✅ Amaron's own guidance to buyers includes
   checking cranking voltage (**>9.8 V**) and alternator charging voltage
   (**13.8–14.5 V**) — the same discipline applies to stock on the shelf.
4. **The core credit is the offsetting economics.** ✅ Amaron PH, first-party:
   the customer's old battery is worth money back, *"either provide you with a
   financial reward for the old battery or subtract the corresponding amount from
   the cost of a new battery purchase."* A core credit funds the self-discharge.
   **Do not let the shop carry unsold batteries without cores.**

### 5.3 🧡 "Do I need a battery test before replacing?" — the shop's own FAQ says yes

✅ Amaron PH, first-party, verbatim:

> *"1. Ensure your current battery has failed. Sometimes, your vehicle's
> electrical system could have a problem. Hence **find out the root cause of the
> problem (call us or your mechanic to check the root cause of the problem)**."*
> *"3. **Before fitting the new battery, check the electrical system of your
> vehicle.**"*

"Battery Replacement" is ✅ one of EYG's ten confirmed services. **This is the
manufacturer's own written instruction to the customer's mechanic.** It is also
the cheapest upsell in the shop and the one that most protects the customer's
wallet. A3/A5 should consider whether "Battery Replacement" needs a mandatory
"battery & charging system test" line before the replacement is quoted.

---

## 6. 🔴 THE BIGGEST SCHEMA PROBLEM IN THIS BUILD — DOT is per-LOT, not per-PRODUCT

### 6.1 The collision

`prisma/schema.prisma` → `Product`:

```prisma
/** Production week/year, e.g. "2418" = week 18 of 2024. Tyres degrade. */
dotCode   String?
```

**One `dotCode` per `Product`.** But:

1. A `Product` is a *size + brand + pattern* — `TYR-MIC-20555R16-XM2P`.
2. The shop will receive that tyre across **multiple deliveries**, each with a
   **different DOT week**.
3. `StockLevel` is **one row per product** (`productId String @unique`), holding a
   single `onHand` and a single `reserved`.

> **Therefore the schema, as written, physically cannot represent the situation
> this document is about.** Once two deliveries of the same size are on the shelf,
> the shop does not know how many of each age it has. **It cannot FIFO. It cannot
> do an honest clearance campaign. It cannot answer `ageDays` in
> `ProductAvailabilityDto`.**

### 6.2 What is needed — a request to the orchestrator, not a workaround

The minimal correct model is a **lot/batch layer**:

```
Product  (size, brand, pattern, sellPrice, minSellPrice, …)   ← unchanged
  └── ProductLot  (productId, lotCode, dotCode, receivedAt, qtyReceived)
        └── StockLevel becomes per-lot, OR
              StockLevel stays per-product and a lotQty table holds the split
```

and every stock movement needs a `lotId`, so that `CONSUME` takes the oldest lot
first.

**I am not writing this schema and it is not mine to write.** But A2, A3, A6 and
A7 are all building against `Product.dotCode` and three of them are actively
misled by it. This must be resolved **before** A6 ships a DOT-based campaign.

### 6.3 The interim, honest workaround if the orchestrator declines a lot table

If the answer is "no new model for v1", then:

- **Do not set `dotCode` on a tyre `Product` row at all.** Leave it `null`.
  A `null` is honest. A single stale `dotCode` on a product with 6 units of mixed
  age is a lie with a UI on it.
- **Track the oldest-DOT-per-size in `notes` as human-readable text only**, with
  an explicit prefix so nobody mistakes it for structured data, e.g.
  `notes: "OLDEST DOT 2331 (wk33 2023). Confirm physically at the shelf."`
- **A6 must not build a customer-facing clearance campaign on this.** A campaign
  whose hero product has a stale `dotCode` in the database will eventually
  advertise the wrong tyre's age to a customer. That is a Consumer Act exposure
  and a reputational kill.
- **Set `ageDays` to `null` in `ProductAvailabilityDto`** for tyres until lots
  exist. `ageDays?: number | null` permits null. 🟢 **Returning null is correct;
  returning a fabricated number is not.**

**Decision required. `open-questions.md` Q-13 — flagged BLOCKING for A6.**

---

## 7. WHAT "WE STOCK THIS WHILE YOU WAIT" ACTUALLY REQUIRES IN THE PHILIPPINES

### 7.1 The short, honest answer

**🟡 There is no Philippine legal requirement, specific to stock availability,
that I was able to verify.** No DTI, BIR or LGU rule was located that obliges a
retailer to hold goods aside for a customer who asks.

**But there is a Philippine legal rule that makes an unkeepable promise a real
liability**, and it is not about stock at all — it is about misleading
representations. See `ph-record-keeping-legal.md` §5 and §6.

### 7.2 The risk, stated precisely

🟡 RA 7394 (Consumer Act of the Philippines), **Article 52**, via a Philippine law
firm's analysis (`thefirmva.com/updates.do?id=26594`, read 2026-10-03), lists as
circumstances of an **unfair or unconscionable** sales practice:

> *"**When the consumer transaction was entered into, the price grossly exceeded
> the price at which similar products or services were readily obtainable in
> similar transaction by like consumers**"*
> *"When the consumer transaction was entered into, the consumer was unable to
> receive a substantial benefit from the subject of the transaction"*

> ⚠️ **Read the price clause as the reverse of the obvious.** It is not only about
> overcharging. Publishing a price the shop will not honour, or advertising an
> availability the shop cannot deliver, is the same class of problem.

### 7.3 The practical rules for this build

These are **`SUGGESTED` house rules derived from the above**, not legal advice.
They are the version that is honest under the inventory invariant.

| Situation | What the shop may say | What it must not say |
| --- | --- | --- |
| `available >= qtyNeeded` on every **blocking** part | ✅ *"We have your size in stock."* | — |
| `available < qtyNeeded` on a **non-blocking** part | ✅ *"We'll need to order that in — it should be here in X days."* | ❌ Blocking the sale for it |
| `available < qtyNeeded` on a **blocking** part | ✅ **Nothing to the customer yet.** Staff-only shortfall state. Staff tells the customer *"we'll have it by [honest date]"* | ❌ *"We have it"* |
| `available` = 1 tyre of a size, customer needs 4 | ✅ *"We've got one. Order the other three?"* | ❌ *"In stock"* without qualification |
| `available` includes `reserved` stock | 🚫 **A reserved tyre is not available.** `available = onHand − reserved` is the whole point | ❌ Counting a held tyre in a promise |

> **🔴 The last row is the one that will actually bite this build.**
> A reservation held for a booking that expires at 23:59 is not sellable.
> If A5 renders "in stock" from anything other than `available`, the shop
> double-promises the last tyre. The orchestrator's invariant —
> `available = onHand − reserved`, never negative — exists precisely to prevent
> this, and it is **a consumer-protection feature, not just a data-integrity
> one**.

---

## 8. Storage: what actually degrades a tyre on a shelf

| Factor | Sourced? | Rule |
| --- | --- | --- |
| **Heat and direct sunlight** | ✅ Michelin PH, first-party | *"Tires should always be stored properly in … dry place out of direct sunlight to avoid cracking or loss of shape."* |
| **Service life is not age alone** | ✅ Michelin PH: *"A tire that's been in use for only 1 year can have aged as much as an unused tire kept in storage for 10 years."* ✅ USTMA | Condition check is not optional |
| **Tropical climate accelerates degradation** | 🟡 Motul (MY): poor storage degrades oil faster; 🟡 Amaron PH markets Silven-X alloy specifically for *"High Heat Tolerance"*, *"3X more corrosion resistant"*, *"Zero Maintenance"* | 🔴 **An uninsulated Balanga storeroom is a value-destroying environment for tyres.** Storage is a margin control, not a tidiness issue |
| **Stacking / flat-spotting** | 🟡 Michelin owner manual lists *"Flat spotting caused by improper storage or brakelock"* as **NOT covered** by warranty | 🟡 Stacking rules are real but I did not find a Philippine-source rule. Owner should follow the tyre brand's storage guidance |
| **Rotation discipline** | ✅ Michelin owner manual (first-party): *"tires must be rotated every 6,000–8,000 miles (10,000–12,000 km) or as recommended by the vehicle manufacturer… **Failure to rotate the tires as provided herein voids the treadwear warranty**"* | ✅ AYG: this is a *saleable service* the shop can honestly sell, and it protects the customer's warranty |

### 8.1 🟢 A free revenue idea that comes straight out of the sourced research

✅ Michelin's own warranty terms (first-party, `michelin.com.ph` links its owner
manual) say the **treadwear warranty is voided unless tyres are rotated every
10,000–12,000 km**. ✅ The shop's confirmed service list includes **Wheel
Alignment and Camber Correction** and **Wheel Balancing**.

> **The shop can tell a Michelin customer, truthfully and citing their own
> warranty document: "If you don't rotate them every 10,000 km, Michelin voids
> the treadwear warranty. We do the rotation."**
>
> That is a *manufacturer's own warranty condition* turned into a service sale,
> with no claim at all. 🟢 **Recommend to A5/A6 — this is the highest-credibility
> sales line available to this shop and nobody in Balanga can copy it, because
> nobody else is a listed Michelin dealer.**

---

## 9. Source register

| # | Source | Class | Retrieved |
| --- | --- | --- | --- |
| D1 | `ecfr.gov` — 49 CFR §574.5 (TIN content, date code, 3→4 digit change, plant/manufacturer codes) | US federal regulation, **authoritative but unofficial eCFR** | ✅ 2026-10-03 |
| D2 | `ecfr.gov` — 49 CFR §574.8 (dealer record-keeping) | US federal regulation — **NOT applicable in PH; cited as industry pattern only** | ✅ 2026-10-03 |
| D3 | `govinfo.gov` FR 1999-07-08 — the rulemaking that mandated 4-digit date codes from 2 July 2000 | US Federal Register | ✅ 2026-10-03 |
| D4 | `michelin.com.ph/michelin-ph-warranty` — **Product Warranty Policy, effective 1 Jan 2026**: 6 years from date of purchase, subject to valid proof of purchase; claim accepted only within 10 years of manufacture | Brand, **first-party Philippines** | ✅ 2026-10-03 |
| D5 | `michelin.com.ph/auto/advice/change-tires/how-long-do-tires-last` — 10-year precaution threshold; annual inspection from 5 years | Brand, first-party Philippines | ✅ 2026-10-03 |
| D6 | `michelin.com.ph/auto/advice/tire-basics/do-i-need-to-know-how-to-check-tire-manufacture-codes` — *"A tire that's been in use for only 1 year can have aged as much as an unused tire kept in storage for 10 years"*; store out of direct sunlight | Brand, first-party Philippines | ✅ 2026-10-03 |
| D7 | `michelin.com.ph/auto/advice/choose-tires/choose-car-tires` — ten-year mark as *"the upper limit"* | Brand, first-party Philippines | ✅ 2026-10-03 |
| D8 | Michelin *Owner's Manual and Limited Warranty* PDF (`dgaddcosprod.blob.core.windows.net` / `cxf-prod.azureedge.net`, linked from michelin.com.ph) — rotation 6,000–8,000 mi / 10,000–12,000 km or treadwear warranty is voided; DOT reading incl. the 1990s triangle; 10-year precaution; exclusions incl. flat-spotting from improper storage | Brand, first-party | ✅ 2026-10-03 |
| D9 | `ustires.org` — *Tire Care & Safety* guide, Sept 2025 edition — *"Tire Service Life Is Not Determined by Chronological Age"*; two-at-a-time with newer on the rear axle; all-four preferred; treadwear-indicator definition | **US Tire Manufacturers Association** — industry body | ✅ 2026-10-03 |
| D10 | `generaltire.custhelp.com` — Continental-family consumer guidance: 10-year removal recommendation; *"General Tire is unaware of any technical data that supports a specific tire age for removal from service"*; 3-digit date code pre-2000 | Brand, first-party | ✅ 2026-10-03 |
| D11 | `motul.com/en-MY/information/can-engine-oil-go-bad` — sealed up to 5 years; opened ideally within 12 months; store 10–25 °C; do not decant into unlabelled/non-airtight containers | Brand, first-party (**Malaysia** site; states an industry norm) | ✅ 2026-10-03 |
| D12 | `global.pli-petronas.com/lubricants-fluid/hydraulic` — **hydraulic** oil shelf life up to 3 years; store indoors 0–35 °C | Brand, first-party — **different product class** | ✅ 2026-10-03 |
| D13 | `amaron-ph.com/tips-for-buying-batteries` — warranty card + sales receipt required; private vs commercial periods differ; core-return compensation; cranking >9.8 V, alternator 13.8–14.5 V; check the electrical system before fitting | Brand, first-party Philippines | ✅ 2026-10-03 |
| D14 | `motolite.com/pages/automotive-battery` + `/pages/e-warranty` — warranty covering factory defects for a specific period; registered by serial/plate in RES-Q; replace at 3–5 years | Brand, first-party Philippines | ✅ 2026-10-03 |
| D15 | `thefirmva.com/updates.do?id=26594` — RA 7394 Art. 52 unfair/unconscionable practice provisions incl. price-grossly-exceeded and no-substantial-benefit; Art. 60 penalty | **Law-firm commentary**, not the statute | ✅ 2026-10-03 |
| D16 | `49 CFR 574.5` full text also mirrored at `govinfo.gov` CFR-2024-title49-vol7-part574 | US federal regulation | ✅ 2026-10-03 |

**What I could not verify and did not fake:**

1. **Any Philippine statutory provision on tyre age, DOT codes, or stock
   disclosure.** RA 4136 (Land Transportation and Traffic Code) was targeted and
   **could not be retrieved** (`transport.gov.ph` — transport error). **No
   Philippine legal claim about tyres is asserted anywhere in this document.**
2. **A Philippine brand's engine-oil shelf life.** None published. Used Motul's
   industry-norm statement and labelled it as such.
3. **Amaron or Motolite warranty durations in months.**
4. **Any Philippine tyre-storage standard.**
5. **Brake fluid's shelf life.** The 365-day figure is `SUGGESTED`.

---

## 10. The one-paragraph version for the owner

Every tyre you sell has its factory week moulded into the sidewall — four
digits, week then year, and that is US federal law, not tyre-industry folklore.
Michelin, whose dealer you are, says retire a tyre ten years after it left the
factory as a precaution, inspect anything five years old every year, and their
Philippine warranty runs **six years from the day you sell it, evidenced by your
invoice, with the claim window closing ten years after the factory date**. That
last combination is your clearance campaign: a tyre made in 2023, sold today,
carries a genuine warranty to 2032. Say *"made week 33 of 2023, full six-year
warranty from your invoice"* and it is true, checkable, and better copy than any
fake-urgency countdown. What you cannot do yet is run that campaign in software,
because the system as designed stores one DOT code per tyre product and a
shelf holds several deliveries at once — that needs fixing before A6 builds
anything.
