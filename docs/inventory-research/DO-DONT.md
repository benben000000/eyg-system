# DO / DON'T — inventory UX for a Philippine tyre shop

### A1 research · compiled 2026-10-03

---

## 0. How to use this

The brief said: *"what these systems get right, what they get wrong, and the 20
anti-patterns to avoid on this build."*

§1 is what the benchmarks get **right** and should be copied.
§2 is what they get **wrong**, with the case that proves it.
§3 is the **20 anti-patterns**, each with the evidence that produced it and the
specific thing to do instead.
§4 is the shop-specific rule-set, which overrides all of it.

**The organising principle, stated once:**

> **This operator is standing at a shelf, one-handed, on a phone, with a
> customer waiting and a car on the lift. Every design decision is a decision
> about what that person needs in the next four seconds.**

---

## 1. What the benchmarks get RIGHT — copy these

| # | What | Source | Why it is right here |
| --- | --- | --- | --- |
| R1 | **`available` is a stored quantity, mutated atomically, never computed on read and rounded** | ✅ Shopify (`on_hand` = Σ states; `inventoryMoveQuantities`) ✅ OxMaint (*"available stock minus reserved quantities"*) | A conditional `UPDATE` is the only way to make overselling impossible. Anything else is a hopeful read-then-write |
| R2 | **One writer for the reserved state. Nobody else.** | ✅ Shopify, verbatim: *"You can't use the Admin API to adjust or move inventory quantities in the `committed` state"* | Shopify — a nine-figure engineering org — forbids its own API from writing the promise state. That is the rule |
| R3 | **A reservation is always attached to a job** | ✅ OxMaint: *"reserved for specific work orders or jobs"* ✅ Innovapptive: *"A released work order, reservation or minimum threshold breach raises kitting demand automatically"* | A reservation with no job is a leak. The `bookingId` is what makes expiry automatic |
| R4 | **Reorder fires on `available`, not `onHand`** | ✅ OxMaint: *"When current stock falls to or below this level, the item is marked 'Low Stock'"* — against *available* | If it fires on `onHand`, it never fires for a line that is always fully reserved |
| R5 | **An ambiguous input must produce a question, not a guess** | ✅ TecDoc's `HsnTsnVsnSelectionRequired` | A customer says "Toyota Vios" and means 5 different cars. The industry standard models the "not specific enough" state explicitly. **This schema has no such state.** |
| R6 | **Supercession / alternatives are surfaced, never silently substituted** | ✅ TecDoc *"Superseding Articles"* ✅ Autodoc: *"A list of alternatives is displayed… **compare the characteristics**"* | ✅ RA 7394 Art. 69(b): material must be *"reasonably fit for that purpose"* — and only the customer knows whether the alternative is |
| R7 | **A waitlist is a first-class flow, not a dead end** | ✅ Autodoc *"Notify availability"* → email on restock | This is the brief's A6 "tell me when it lands" flow. Autodoc has shipped it and it works |
| R8 | **An honest promise includes a time and a cutoff** | ✅ TireConnect: `delivery_date_time` and `cutoff` on every quote | *"We have it"* is a binary. *"Lands Thursday before 10am"* is a commitment the shop can keep |
| R9 | **Cycle counting eliminates the stock freeze** | ✅ AMCS: *"you eliminate the need for a complete stock freeze"* | A one-bay shop cannot close. This is why `cycleCountDays` exists at all |
| R10 | **Stale/dead stock is a named, surfaced concept** | ✅ Limble *"stale threshold — flags parts that haven't been used in a set number of days"* | A2's watch. Call it what Limble calls it |
| R11 | **Cost and retail are separate concepts all the way through** | ✅ TireConnect returns `cost` **and** `retail_price` | `costPrice` / `sellPrice`. Never merge them, never derive one from the other |
| R12 | **Barcode verification at the bin, not a part number read off a label** | ✅ Innovapptive's comparison table: *"Barcode scan plus material master photo"* vs *"Part number read off a label"* | The part is in a box. A photo is faster than a number |
| R13 | **The counter must work without a signal** | ✅ Innovapptive: *"works with no signal"* | A tin shed on EGSA Fourlanes. This is a hard requirement here |
| R14 | **A system that does not know, returns null — not a plausible number** | ✅ TireConnect: `vendor_total_order`: *"Can be null if vendor doesn't provide this information"* | ✅ The schema already does this: `costPrice 0 = unknown` |

---

## 2. What the benchmarks get WRONG — the cases that must not be copied

| # | The failure | Evidence | What it cost |
| --- | --- | --- | --- |
| W1 | 🔴 **Reducing a stock number to a boolean** | ✅ Autodoc's own support reply, verbatim: *"**the availability button for an item is active when at least one unit is available.** However… **the number of orders placed for a product may temporarily exceed the actual stock available**"* | A customer ordered **4 tyres "which said they were in stock"** and chased for 3 days |
| W2 | 🔴 **Availability shown with no age information** | ✅ Same customer: *"received tyres with DOT codes from… 2023. This was… years old at the time of delivery"* | Trust destroyed permanently. **Both halves of the failure in one review** |
| W3 | 🔴 **No honest shortfall state — silence until it resolves** | ✅ Same: 3 days of no contact | The shop's own help centre admits *"our customer support team will contact you"* — i.e. it has no real-time shortfall state |
| W4 | 🔴 **A single `dotCode` per product** | ✅ OxMaint maps **batch numbers**; ✅ TireConnect splits stock **per branch/warehouse**; ✅ TecDoc supersedes per article | A size's stock is a mix of ages and the system cannot say so. **This is a defect in this schema, not in their design** |
| W5 | 🔴 **A quantity without a unit** | ✅ RMO 03-03 §5.12(a), verbatim: *"Quantities and unit prices must be stated in **correct units**"* | An audit finding, on a statutory record |
| W6 | 🔴 **No location dimension** | ✅ TireConnect `stock_available[]` per branch; ✅ RMO 03-03 §5.2(c) inventories *"segregated per location"* | EYG has two addresses in the wild. ✅ A BIR requirement with no field to satisfy it |
| W7 | 🔴 **An in-place editable stock balance** | ✅ BIR: records *"shall be **preserved intact, unaltered, and unmutilated**"* | Defensible in no audit, ever |
| W8 | 🔴 **A warranty with no purchase record behind it** | ✅ RA 7394 Art. 68(b)(5), verbatim: retailers *"shall keep a record of all purchases covered by a warranty… for such period of time corresponding to the lifetime of the product's respective warranties"* | ✅ Michelin's is 6 years. The shop has a shoebox |

---

## 3. THE 20 ANTI-PATTERNS

Each one is a real, evidenced failure mode or a sourced legal/operational trap.

---

### 🔴 AP-01 — Never render a boolean where a number is the truth

**Evidence:** W1. Autodoc's support team named the boolean as the cause.
**Trap:** *"In stock ✓"*, *"Available"*, a green dot, a badge, *"yes"*.
**Instead:** Render `available` with its unit and its number. ✅
`ProductAvailabilityDto.available: number` exists — 🟢 **keep it a number at every
layer, including the customer-facing one.**
**Never:** a boolean derived from `available > 0`.

---

### 🔴 AP-02 — Never count `onHand` as availability

**Evidence:** the invariant itself. `available = onHand − reserved`.
**Trap:** any query, view or badge reading `onHand`.
**Instead:** one derived value, computed once, server-side. Reserved stock is
**not sellable** — a hold for an appointment 25 minutes away is not a promise.
🟢 This is also the consumer-protection point: ✅ publishing a number the shop
knows is false is a **deceptive act under RA 7394 Art. 50**.

---

### 🔴 AP-03 — Never clamp a negative. Refuse

**Evidence:** the brief's own invariant, and W1 — overselling is what actually
happens in production.
**Trap:** `Math.max(0, …)`, a `GREATEST()` in SQL, silently reducing `qty` to
what's there.
**Instead:** `INSUFFICIENT_STOCK` with `available` and `requested` in the
response, so the UI can say **"3 left"**, not **"failed"**. ✅
`PostMovementRejection` already carries exactly those fields.

---

### 🔴 AP-04 — Never let two code paths write `reserved`

**Evidence:** ✅ Shopify's explicit, documented restriction on the `committed`
state (R2).
**Trap:** A2's `postMovement` *and* A4's `booking-hooks.ts` both adjusting the
hold.
**Instead:** one writer. A4 may *request* a reservation; only A2's path may
create it.

---

### 🔴 AP-05 — Never mutate or delete a `StockMovement`

**Evidence:** ✅ BIR — records *"shall be preserved intact, unaltered, and
unmulated"* (§2.1 of `ph-record-keeping-legal.md`). Also: the ledger is the only
defence when the system and the shelf disagree.
**Instead:** append-only. Corrections are new rows with a `reason`. `OPENING` is
the baseline and fails if stock already exists.

---

### 🔴 AP-06 — Never let a quantity be entered without a unit

**Evidence:** ✅ RMO 03-03 §5.12(a) — *"Quantities and unit prices must be stated
in correct units"* — an audit instruction.
**Trap:** a bare `number` input labelled "qty", so the mechanic types `4` meaning
4 litres.
**Instead:** the unit is part of the field, always rendered, always in the
confirmation. ✅ `UNITS` has `EA | PAIR | SET | LITRE | KG | M`. 🟡 For
decantable oil, `LITRE` needs a pack size the schema does not carry —
**Q-02**.

---

### 🔴 AP-07 — Never show a number with no timestamp or DOT context

**Evidence:** W2 — the DOT-2023 complaint. ✅ Michelin PH: *"The DOT numbers
aren't as important as the number of years the tires have been used. **A tire
that's been in use for only 1 year can have aged as much as an unused tire kept
in storage for 10 years.**"*
**Trap:** a plain `4` next to a tyre name.
**Instead:** `4 in stock · oldest made wk33 2023`. If the age is unknown, **say
so** (AP-08), do not omit the context.

---

### 🔴 AP-08 — Never invent an age, a price, a warranty, or an ETA

**Evidence:** ✅ TireConnect returns `null` when the supplier does not know
(R14). ✅ `pricing-benchmarks.md` §9's fourteen-item unverified list. ✅
`docs/research/legal-compliance-ph.md` §4.1's four things it refused to fake.
**Trap:** `ageDays: 0` for "unknown". `dotCode: ""`. A placeholder price.
**Instead:** `null`. ✅ `ageDays?: number | null` permits it. **An honest null
beats a plausible number every single time.**

---

### 🔴 AP-09 — Never let a clearance/aged-stock price bypass the floor

**Evidence:** ✅ RA 7394 Art. 81 — *"shall not be sold at a price higher than that
stated therein"*, penalised under Art. 95(b) up to **₱5,000**, and *"A second
conviction… shall also carry with it the penalty of revocation of business
permit and license."* Also ✅ Art. 83: *"no erasures or alterations of any sort of
price tags."*
**Trap:** a campaign that writes `sellPrice` directly, or a markdown that
overrides `minSellPrice`.
**Instead:** `Product.minSellPrice` is the floor and it is not a suggestion.
Clearance sets a price **above** the floor, with the owner's approval.

---

### 🔴 AP-10 — Never use fake-urgency language

**Evidence:** ✅ RA 7394 Art. 4(l) defines *"**'closing out sale'**"* as *"a
consumer sale wherein the seller uses the announcement to create the impression
that he is willing to give large discounts… in order to reduce, dispose or close
out his inventory **and business**."* ✅ Art. 72(d) prohibits *"any **false
representation in an advertisement** as to the existence of a warranty or
guarantee."* ✅ Art. 50 prohibits *"fraudulent manipulation"*.
**Banned words:** *closing out · final sale · last chance · everything must go ·
while stocks last (on a resetting timer) · hurry · 3 days only · liquidation ·
going out of business.*
**Instead:** *"Made week 33 of 2023. Reduced."* — which is also a **better sales
line**, because it is checkable.

---

### 🔴 AP-11 — Never advertise a warranty the shop does not give

**Evidence:** ✅ RA 7394 Art. 72(d) — false representation as to the existence of
a warranty is prohibited. ✅ Art. 68(a)(1) — the seller must *"clearly identify
himself as the warrantor."*
**Trap:** implying Michelin's 6-year warranty is EYG's. Implying a manufacturer's
battery warranty is a workmanship warranty. Shipping a warranty statement not
labelled **"Full"** or **"Limited"** (✅ Art. 68(c)).
**Instead:** EYG's guarantee and the manufacturer's warranty are **two separate,
separately-labelled statements** on the invoice.

---

### 🔴 AP-12 — Never demand a document the law says the customer need not produce

**Evidence:** ✅ RA 7394 Art. 68(b)(4), verbatim: *"the purchaser needs only to
present… either the warranty card **or** the official receipt… **No other
documentary requirement shall be demanded from the purchaser.**"*
**Trap:** *"we need the box", "we need the old invoice", "come back with the
receipt"*.
**Instead:** accept card **or** receipt. If the customer has neither, **the shop
looks up its own record** — which is why ✅ Art. 68(b)(5) and the whole build
exist.

---

### 🔴 AP-13 — Never require more paperwork than the law requires for a claim

**Evidence:** same, Art. 68(b)(4) — and ✅ Art. 68(b)(3): the retailer *"shall
take responsibility without cost to the buyer of presenting the warranty claim to
the distributor in the consumer's behalf."*
**Trap:** *"bring it to our supplier, that's their problem."*
**Instead:** the shop is the customer's representative to Amaron, Michelin and
Motolite. That is the shop's job and it should have the serial number ready.

---

### 🔴 AP-14 — Never block a customer's sale for a non-blocking part

**Evidence:** the brief's own shared non-negotiables; ✅ `ServicePartRequirement.isBlocking`
exists precisely for this; ✅ Autodoc's *"we can choose the right alternative
product"* is the customer-serving behaviour.
**Trap:** `blocked: true` because a wiper blade is short.
**Instead:** `isBlocking` is a per-BOM-row decision. Safety-critical → blocking.
Everything else → a warning and a real date.

---

### 🔴 AP-15 — Never silently substitute a part

**Evidence:** ✅ RA 7394 Art. 69(b) — the implied warranty is that material is
*"reasonably fit for that purpose"*, and the customer's disclosure defines that
purpose. ✅ TecDoc's `Superseding Articles`. ✅ Autodoc's alternatives list.
**Trap:** fitting the VIC filter when the ticket said `90915-YZZE1`, because the
genuine one was short.
**Instead:** name the alternative, name the difference, **let the customer
decide.** This is one line of UI and it is the honest version of a margin play.

---

### 🔴 AP-16 — Never require an online connection to consume a part

**Evidence:** ✅ Innovapptive: receive, pick and count *"with no coverage"*, every
movement *"barcode-verified at the bin and posted as it happens"*.
**Trap:** the bay opens a browser, the mobile data drops, and the mechanic cannot
issue the part.
**Instead:** the consume flow works offline and reconciles. 🟡 **Flagged as a
requirement to A2/A3 — this is shop-specific, not theoretical.**

---

### 🔴 AP-17 — Never make the mechanic read a part number off a label

**Evidence:** ✅ Innovapptive's own comparison: *"Barcode scan plus material
master photo"* beats *"Part number read off a label"*.
**Trap:** typing `90915-YZZE1` from an unlabelled box.
**Instead:** scan, or **show a photo**. 🟡 Neither `Product.barcode` scanners nor
photo fields exist yet. **An unlabelled box is the #1 physical failure mode in a
small shop, and no amount of schema fixes it — only labelling does.**
→ `open-questions.md` **Q-18**.

---

### 🔴 AP-18 — Never let a count silently rewrite history

**Evidence:** ✅ the schema's own design — `StockCountLine.expected` is
*"snapshotted when the count is created so a concurrent sale does not silently
rewrite history."*
**Trap:** counting a line while a sale posts, then comparing against a live
`onHand`.
**Instead:** snapshot, count, variance, review, post. The variance is the finding;
the recount is a decision.

---

### 🔴 AP-19 — Never resolve an ambiguous vehicle into a confident answer

**Evidence:** ✅ TecDoc's `HsnTsnVsnSelectionRequired` — the industry standard
**explicitly models the "not specific enough" state**.
**Trap:** a booking says *"Toyota Vios"* and the system picks a size.
**Instead:** ask. `"Toyota Vios — 2015, 1.5 G?"` One extra question beats a
wrong part on a car that is on the lift. ✅ This is also Art. 69(b): the
**customer's disclosure is what defines the warranty.**

---

### 🔴 AP-20 — Never show cost or margin on a customer surface

**Evidence:** the brief's shared non-negotiables; ✅ ✅ `ProductDto.costPrice?`
is commented *"PHP. Server-side only — never send `costPrice` to a public
surface."*
**Trap:** leaking it through a JSON-LD block, a page prop, an error message, a
`?debug=1` param, an analytics event, a sitemap, or an availability endpoint.
**Instead:** the availability endpoint returns no cost data. 🟢 **A8's job, and
the anti-pattern list for it is in `docs/inventory-security/`.**

---

## 4. THE SHOP-SPECIFIC RULE-SET — this overrides everything above

### 4.1 The four-second test

🟢 Every operator-facing surface answers four questions in this order:

| # | Question | Where |
| --- | --- | --- |
| 1 | **Is it here?** | Product list, availability badge |
| 2 | **Which one?** | Size / brand / pattern, big enough to read on a phone |
| 3 | **How many?** | `available` with a unit, never a boolean |
| 4 | **Take it.** | One action: consume. Confirmation shows before→after |

### 4.2 The never-list

**These must never appear anywhere — operator or customer:**

```
✗ "In stock" as a bare boolean
✗ "Only N left!"                                    (fake urgency — AP-10)
✗ "Closing out" / "Final sale" / "Last chance"      (AP-10, RA 7394 Art. 4(l))
✗ A countdown that resets
✗ Any cost, margin, or supplier price on a customer surface   (AP-20)
✗ A DOT age the system cannot source               (AP-08)
✗ A tyre described as "expired"                    (no PH legal expiry exists)
✗ A warranty the shop does not give                (AP-11, RA 7394 Art. 72(d))
✗ Nitrogen as a stock item                          (it is a service)
✗ A set-of-4 as qty:4                               (tyre-and-parts-landscape §2.4)
✗ A quantity with no unit                           (AP-06)
✗ Any "example", "TODO", "demo" or placeholder data presented as real
```

### 4.3 The always-list

**Every mutation screen must show, before the operator confirms:**

```
✓  the product, unambiguously (SKU + size + brand)
✓  the unit, on the number itself
✓  what the number is NOW
✓  what it will be AFTER
✓  a mandatory, human-readable REASON field
✓  the reservation/booking this is against, if any
✓  confirmation comes FROM THE SERVER, never optimistically
```

### 4.4 The three sentences the shop must be able to say

🟢 **If the build cannot produce all three honestly, it is not finished:**

1. ✅ *"We have your size in stock."* — only when `available >= qtyNeeded` on
   every blocking part.
2. ✅ *"We'll need to order that in — it should be here [honest date]."* — for a
   non-blocking shortfall.
3. ✅ *"These tyres were made in [week/year]. They carry the full six-year
   warranty from your invoice."* — ✅ sourced at
   `michelin.com.ph/michelin-ph-warranty`, and only while under 10 years old.

**And the one it must never say:** *"we have it"* — when it doesn't.

### 4.5 Two truths about this shop that change the defaults

| Truth | Consequence |
| --- | --- |
| 🟢 **Nobody in Balanga publishes a price, an hour, or a stock number** (§7 of `benchmarks-competitors.md`) | Accuracy is the entire competitive position. One wrong number is worth more than every feature, because it is the only thing the competitor has to beat |
| 🔴 **And a 5.3× price spread exists online for one tyre size on one day** (`pricing-benchmarks.md` §8) | The customer can price-compare in three browser tabs. **Do not compete on price. Compete on the tyre being physically on the rack and on the number being true.** |

---

## 5. One-paragraph summary

Nine systems, one lesson: `available = onHand − reserved` is the correct model and
four of them say it in almost these words, so the design is right. But the case
that should be printed and pinned above the bay is Autodoc — a large company that
showed a green tick, sold four tyres it did not have, took three days to admit it,
and then delivered tyres manufactured years earlier, with a support reply
admitting the website itself oversells under load. Every anti-pattern above is a
different way of becoming that company. And the reason to care is the shop
around us: not one of the five tyre shops in Balanga publishes a single number
anyone can check, which means the only thing EYG has to beat is its own accuracy.
