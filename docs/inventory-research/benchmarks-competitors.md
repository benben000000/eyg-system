# BENCHMARKS & COMPETITORS — inventory systems and Philippine tyre shops

### A1 research · compiled 2026-10-03 · all checks performed 2026-10-03 (Asia/Manila)

---

## 0. What this document is for

Six other agents are building against a schema that a handful of real systems
also had to solve. This document asks four questions of each benchmark:

1. **How do they model a tyre?** Size as a string, or as structure? One size, or
   a front/rear pair?
2. **How do they handle "a set of 4 vs 5"?**
3. **How do they handle reservations, backorders and pre-orders?**
4. **How do they do cycle counting and reorder points?**

Then it answers: **what should this build copy, what should it refuse, and what
are the twenty anti-patterns to avoid.** The DO/DON'T table is in `DO-DONT.md`.

Everything I could not inspect is marked **`NOT INSPECTED`**. I did not log in to
anything, did not scrape behind authentication, and did not violate a ToS.

---

## 1. Shopify — the closest structural match in the world

✅ **shopify.dev**, "Apps in inventory management"
(`shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps`),
read 2026-10-03. **First-party vendor documentation.** This is the single most
useful benchmark for this build, and it is worth reading in full.

### 1.1 Shopify's state model — verbatim

> *"**`on_hand`** — The total number of units that are **physically at a
> location**. The `on_hand` state **equals the sum** of inventory quantities that
> are in the `available`, `committed`, `reserved`, `damaged`, `safety_stock`, and
> `quality_control` states."*

> *"**`available`** — The inventory that a merchant can sell. Available inventory
> isn't committed and isn't part of incoming transfers."*

> *"**`committed`** — The number of units that are set aside and aren't available
> to sell. Inventory is committed when a placed order hasn't been fulfilled.
> Inventory is also committed when you reserve inventory on a draft order."*

> *"**`reserved`** — The on-hand units that are temporarily set aside. For example,
> a merchant might want to set on-hand units aside for holds or inspection."*

> *"**`damaged`** — The on-hand units that aren't sellable or usable due to damage."*

> *"**`safety_stock`** — The on-hand units that are set aside to help guard
> against overselling."*

> *"**`quality_control`** — The on-hand units that aren't sellable because they're
> currently in inspection for quality purposes."*

> *"**Note:** The `incoming`, `available`, `committed`, `reserved`, `damaged`,
> `safety_stock`, and `quality_control` states are **mutually exclusive**."*

### 1.2 What Shopify gets right, and why it matters here

| Shopify | This schema | Verdict |
| --- | --- | --- |
| `on_hand = Σ(available, committed, reserved, damaged, safety_stock, QC)` | `StockLevel.onHand`, `StockLevel.reserved` | 🟢 **Same shape.** The invariant is industry-standard, not bespoke |
| `available` is a *stored* quantity, not a computed one, so it can be mutated atomically | ✅ *"Held rather than computed on read so it can be mutated in a single conditional UPDATE"* — the schema's own comment | 🟢 **Identical reasoning.** Shopify moves quantities *between* states with a dedicated mutation (`inventoryMoveQuantities`); a conditional `UPDATE` is the same idea |
| Costs and retail are separate concepts | `costPrice` / `sellPrice`, staff-only | 🟢 Aligned |
| Webhooks on `inventory_levels/update` | `/api/cron/tick` sweeps + notification layer | 🟡 Analogous |

### 1.3 🟢 What Shopify does that this schema lacks — and should be copied

Shopify has **seven** states. This schema has **three** (`onHand`, `reserved`,
and `available` as a derived read).

| Shopify state | Why a tyre shop needs it |
| --- | --- |
| **`incoming`** | 🔴 **The most important missing one.** Stock on a PO that has not arrived is *not* sellable. If A6's "tell me when it lands" flow (§ the brief's A6 role) cannot distinguish "ordered" from "here", it will promise stock that is four days away in a distributor's van. `Product` has no `onOrder` field |
| **`damaged`** | 🔴 Real. A tyre with a cut sidewall, a cracked brake rotor, a dropped battery. Today those will go through `SHRINK` (which is the right *movement*) but there is no state that says "it is on the shelf and it is not sellable" |
| **`quality_control`** | 🟡 Marginally. Relevant to a battery that arrived with a low charge, or a tyre whose DOT the mechanic could not read |
| **`safety_stock`** | 🟡 Relevant. A deliberate buffer is different from an accident. Not necessary for v1 |

> **🔴 Recommendation to the orchestrator, framed as a request not a change:**
> **`onOrder` is the highest-value single field this schema is missing.** A tyre
> shop's single most common operational fact is *"it's coming, it's Thursday."*
> Without `onOrder`, `ProductAvailabilityDto.canPromise` can only ever be
> `available`, and the "tell me when it lands" flow A6 is asked to build has
> nothing to read. → `open-questions.md` **Q-17**.

### 1.4 Shopify's documented limitation — the exact thing A7 must test

✅ Shopify states, verbatim:

> *"**You can't use the Admin API to adjust or move inventory quantities in the
> `committed` state.** Inventory quantities in the `committed` state is managed by
> Shopify through actions such as creating and fulfilling orders, reserving
> inventory on draft orders, and marking transfers or shipments as ready to ship."*

🧡 **Read that as an architectural confession.** The platform with the most
engineers and the most money in e-commerce deliberately *forbids* its own API
from writing to the state that represents a promise. The reason is obvious in
hindsight: that state's integrity depends on a single writer with total authority
over the order lifecycle.

> **This is the strongest available argument for this build's "one write path"
> rule.** A2's `postMovement` and A4's `booking-hooks.ts` must be the *only*
> things that touch `reserved`. If two modules can move stock between `available`
> and `reserved`, the shop will eventually oversell — and Shopify, with a
> nine-figure engineering budget, wrote that rule down.

---

## 2. TireConnect — a tyre-specific integration platform

✅ **TireConnect public API documentation**, published by EAxis
(`eaxisinc.atlassian.net/wiki/spaces/TP/pages/1187184641` and
`…/2152529921`, "Tire Supplier Ordering Integration Guide" and "Web Services
Requirements Overview (Tires)"), read 2026-10-03. A real B2B tyre-distribution
integration platform. This is the benchmark that knows what a tyre actually is.

### 2.1 How TireConnect models a tyre size — verbatim

The size search takes the size **structurally**, not as a string:

> *"You can make any kind of search, for example using search By Size method"*
>
> ```json
> "size": { "size_part_1": "205", "size_part_2": "55", "size_part_3": "16" }
> ```
>
> *"1. `size_part_1` 2. `size_part_2` 3. `size_part_3` — Or it can be just `size`
> param that accept raw size."*

### 2.2 What each response field teaches us

| Field | Verbatim | What it teaches |
| --- | --- | --- |
| `quantity_available` | *"Available quantity for this tire"* | 🟢 **`quantity_available` is distinct from `quantity`.** That is `available` vs `onHand`. Exactly the split in this schema |
| `stock_available[]` | *"List of branches with quantities where this tire currently available"* | 🔴 **Per-branch, per-warehouse quantity breakdown.** This schema has no location dimension, and ✅ RMO 03-03 §5.2(c) requires inventories *"segregated per location"* |
| `cost` **and** `retail_price` | Both returned, separately | 🟢 Validates `costPrice` / `sellPrice` as separate concepts |
| `min_quantity` | *"minimum qty that available in stock"* | 🟡 A search-time minimum. Suggests a **size-search that can promise "4 or more"** — the set-of-4 problem, solved by a query parameter |
| `delivery_date_time` / `cutoff` | *"Estimated delivery date & time provided by the supplier"*, `cutoff: {date, time}` | 🟢 **The promise includes a time and a cutoff.** The honest version of "we have it for you" is *"it lands Thursday before 10am"*, not *"in stock"* |
| `fetcher`/`vendor_total_order` | `vendor_total_order`: *"Total order counted by vendor. Can be null if vendor doesn't provide this information."* | 🟢 **The system does not fake a number it does not have.** It returns null. Same discipline as `costPrice 0 = unknown` |

### 2.3 Verdict on TireConnect

🟢 **Copy the structured size.** ✅ The schema already does this —
`size` / `aspectRatio` / `rimSizeIn` / `loadIndex` / `speedRating`. TireConnect
proves the industry splits a tyre size into parts, and that is exactly what a
"type `20555` and get `205/55R16`" mechanic search needs. **The orchestrator's
schema is right and this benchmark validates it.**

🔴 **The per-branch breakdown is the gap.** Combined with ✅ RMO 03-03 §5.2(c),
this is now two independent sources pointing at the same missing field.
→ `open-questions.md` **Q-14**.

---

## 3. TecAlliance / TecDoc — how the automotive aftermarket models a tyre

✅ TecAlliance's own product page (`shop.tecalliance.net/…/tecdoc-catalogue-garage-data`,
read 2026-10-03) and its **TecDoc Data Format specification v2.4**
(`tec-doc-services.com/download/TecDoc-Data-Format_Version_2.4_EN.pdf`) and its
**TecRMI REST/SOAP interface descriptions** (`tecrmi-services.tecalliance.net/docs/PDF/…`),
all read 2026-10-03.

### 3.1 The Tyres module — verbatim from the TecAlliance shop page

> *"**Tyres – Tyre & wheel data.** The Tyres module provides comprehensive
> information on tyres and wheels including:
>
> - Display of **permissible wheel/tyre combinations according to EC type approval**
> - Possible wheel/tyre combinations for **front axle/rear axle**
> - **Seasonal restrictions** for summer and winter tyres
> - Data on tyre dimensions with **speed and load index** and **rim dimensions with
>   offset**"*

### 3.2 The data structure — verbatim from the TecRMI interface description

```
class TdTyre:
  string  ApplicationText
  string  FrontTyreSize      ← "The size of the front tyre."
  string  FrontRimSize       ← "The size of the front rim."
  string  RearTyreSize       ← "The size of the rear tyre."
  string  RearRimSize        ← "The size of the rear rim."
  bool    HsnTsnVsnSelectionRequired
```

🔴 **THE SET-OF-4-VS-5 ANSWER, FROM THE INDUSTRY'S OWN DATA STANDARD.**

**TecDoc does not model a tyre as one size. It models a tyre as a FRONT/REAR
PAIR.** `FrontTyreSize` and `RearTyreSize` are separate fields on the same
object, because for a real fraction of the global fleet they differ. An
all-wheel-drive vehicle, a staggered-fitment sports car, a light commercial
vehicle with 195/75R16C front and dual rears — TecDoc has to represent all of it.

> **What this means for EYG:** a `205/65R16` front with `215/55R17` rears is a
> real thing on a Fortuner or an X-Trail in this catchment. This schema models a
> single `size` per `Product`, which is **correct for the bulk of a Philippine
> fleet and wrong for a visible minority.** That is an acceptable v1 decision,
> but it must be a *decision*, not an oversight.
> 🟢 **And it answers the "set of 5" question cleanly:** in this market the
> correct bundle is not `qty: 4`. It is *"front pair"* or *"rear pair"* —
> `Product.unit: "PAIR"`, and for the staggered minority, **two** `Product` rows
> and **two** BOM lines. `set of 5` is not a concept this shop needs, and
> building it would be building for a market that does not exist here.
> → `tyre-and-parts-landscape.md` §2.4 for the Philippine-specific argument.

### 3.3 Other TecDoc structures worth stealing conceptually

| TecDoc entity | Verbatim | Lesson |
| --- | --- | --- |
| **"Superseding Articles"** (table 204 in the format spec) | ✅ *"Superseding Articles"* | 🔴 **Supercession.** A VIC filter supersedes a 90915-YZZE1. This schema has no supersession edge. A mechanic holding the wrong number has nowhere to go |
| **"Trade Numbers"** (207) / **"Reference Numbers"** (203) | ✅ listed in the data-format TOC | 🟢 **Multiple identifiers per part.** `Product.sku` + `Product.barcode` + one `notes` field is thin. An OE part number, an aftermarket number, and an internal SKU are three different things |
| **"Parts Lists" / "Article Criteria"** (205, 210) | ✅ listed | 🟡 The ancestor of `ServicePartRequirement` |
| **"Parts Lists" as a vehicle group** | ✅ listed | 🟢 Group fitments rather than exploding one row per vehicle |
| VIN filter | ✅ *"VIN-Filter – Vehicle Identification by VIN"* listed as a module | 🟢 Worth noting: a plate/date-based lookup is **not** how the industry identifies a vehicle. **Risk: a mis-entered plate silently returns the wrong parts.** A4's booking vehicle record must be validated, not trusted |
| `HsnTsnVsnSelectionRequired` | ✅ *"indicating whether the user has to select an HSN/TSN/VSN combination"* | 🟢 **The industry standard explicitly models "your input was not specific enough — ask again."** This schema has no such state. A `ServiceAvailabilityDto` that resolves an ambiguous vehicle and returns a confident `canFulfil` is a defect |

---

## 4. Autodoc — what it does, and the failure mode to avoid

### 4.1 What I could and could not inspect

| Target | Status |
| --- | --- |
| `autodoc.parts` knowledge articles | ❌ **HTTP 403.** Blocked from this environment. Not attempted around |
| `autodoc.parts` product pages | 🟡 One page's structured data was reachable via a documented scraping tutorial; I read the tutorial's **example output**, not the live page |
| Autodoc **IE** help centre (`help.auto-doc.ie`) | ✅ Reachable, read 2026-10-03 |
| Autodoc **T&C** (`autodoc.parts/services/terms-conditions`) | ✅ Reachable via search index, read 2026-10-03 |
| Autodoc's **internal inventory system** | ❌ **NOT INSPECTED.** A third party's internals are not public |

### 4.2 What Autodoc does — verbatim from its own help centre

> *"If a product is in stock, you will see the following icon… If a product is out
> of stock, you will see the following icon… **The information about the product
> availability changes rapidly.** So if you have placed an order but the product
> is out of stock, our customer support team will contact you."*

> *"If the product you need is out of stock, you can click on **'Notify
> availability'** and provide us your contact details. **Once the chosen product is
> available we will inform you via email.**"*

> *"If you cannot find an item in the catalogue, we recommend **searching by OEM
> number.** If the result is still unsatisfactory, please contact our customer
> service team."*

> *"A list of **alternatives** is displayed if you search for parts by the OEM
> number. An alternative product is a product which **has similar or identical
> characteristics.** Right after you've entered the OEM number, be sure to
> compare the characteristics of the alternatives shown in the list."*

> *"If the part I ordered is out of stock, can you pick an alternative product? —
> If you have already placed an order and a certain product is out of stock, we
> can choose the right alternative product for you. **The alternative product will
> have the same specifications and warranty period.** We will try to choose an
> alternative at the best possible price for you."*

> T&C: *"The item is available. Items with this availability status are sent
> within 1–2 working days after the receipt of payment. **Currently not in stock**
> — This item cannot be ordered. **It is no longer available or has been
> discontinued.**"*

🟢 **Three things Autodoc does that this brief should copy:**

1. **A waitlist as a first-class flow.** *"Notify availability"* is exactly the
   brief's "tell me when it lands" flow for A6. ✅ Autodoc has shipped it, it
   works, and it is what a customer who cannot be served today wants.
2. **OEM number as a search key.** *"searching by OEM number"* ✅ — the mechanic
   holding a part number is the primary search case, not a customer typing a
   description.
3. **Explicit supercession-with-a-human.** *"A list of alternatives is displayed…
   compare the characteristics of the alternatives shown in the list."* It does
   not silently substitute. **This is the correct behaviour and it is exactly
   what RA 7394 Art. 69(b) ✅ demands — material supplied must be *"reasonably fit

> for that purpose"*, and only the customer can say if an alternative is.**

### 4.3 🔴🔴 THE FAILURE MODE — the most valuable thing in this document

✅ **Trustpilot review of autodoc.de, dated 2026-03-03**
(`trustpilot.com/review/autodoc.de`), read 2026-10-03. A customer review:

> *"Purchased **4 Bridgestone tyres which said they were in stock**, chased after
> 3 days of them still being sat in order being transferred between warehouses,
> they told me that there was a delay… and received them… **and received tyres
> with DOT codes from… 2023. This was… years old at the time of delivery…**
> …clearly does not meet my expectations…"*

✅ **Autodoc's own published reply**, same page:

> *"Please note that **the availability button for an item is active when at
> least one unit is available**. However, we can have very many users
> simultaneously on our website and in the app. In some cases, **the number of
> orders placed for a product may temporarily exceed the actual stock
> available.**"*

> **Read that sentence again. Autodoc's own customer-support team has told a
> customer, in writing, that its website oversells stock under concurrency.**
>
> This is a company with a large engineering organisation. It is not a small
> shop with a shoebox. **It oversold four tyres, took three days to admit it, and
> then delivered tyres with DOT codes that were years old** — which is *both* the
> oversell failure *and* the DOT-age failure in a single complaint.

| Autodoc's failure | The exact defect | Where this build prevents it |
| --- | --- | --- |
| "said they were in stock" → not in stock | Availability read from a stale/non-atomic figure under concurrency | ✅ A2's conditional `UPDATE … WHERE onHand - reserved >= n RETURNING` inside `SERIALIZABLE` + `withSerializableRetry`, refusing rather than clamping |
| 3 days of silence | No honest shortfall state | ✅ A4 must surface a shortfall to staff *immediately* on confirm, with a real date |
| DOT codes from 2023, undisclosed | Age not surfaced at the point of sale | ✅ A6's clearance bands (`dot-codes-and-shelf-life.md` §2.3) — disclose, or do not claim "new" |
| "availability button active when at least one unit is available" | A **boolean** availability where the truth is a **quantity** | 🔴 This schema gets it right: `ProductAvailabilityDto.available` and `.canPromise` are **numbers**. 🟢 **Do not collapse them into a boolean anywhere.** A5 especially — no "In stock ✓" badge without the number |

> **🔴 Anti-pattern #1, and it is not theoretical: never reduce a stock number to
> a boolean.** Autodoc's own support team named the boolean as the cause of a
> customer complaint. This build has `available: number` at every layer. **Keep
> it that way and never let a UI summarise it to a tick.**

---

## 5. MRO / CMMS systems — where `available = onHand − reserved` is spelled out

These are the systems that already solved this exact invariant in a workshop
setting. All read 2026-10-03. All ✅ first-party product documentation.

### 5.1 OxMaint — the most literally-similar system found

✅ `oxmaint.co.uk/stock-management`, read 2026-10-03. **Verbatim:**

> *"**Reserved Stock.** Track items **reserved for specific work orders or jobs**."*
>
> *"**Available Calculation.** Auto-calculate available stock minus reserved
> quantities."*
>
> *"This prevents the same inventory from being promised to multiple jobs and
> ensures accurate availability information when planning maintenance work."*

> **That sentence is this build's entire brief, in someone else's product copy.**

| OxMaint feature | Verbatim | This schema |
| --- | --- | --- |
| Reserved stock | ✅ *"reserved for specific work orders or jobs"* | ✅ `Reservation.bookingId` — a reservation is always against a job |
| Available | ✅ *"available stock minus reserved quantities"* | ✅ The invariant |
| Reorder point | ✅ *"When current stock falls to or below this level, the item is marked 'Low Stock' and can trigger alerts"* | ✅ `ProductDto.isLow` = `available <= reorderPoint`. **Identical semantics — on `available`, not `onHand`** |
| Safety stock | ✅ *"Calculate your reorder point based on lead time demand plus safety stock"* | 🟡 Not modelled |
| Cycle count scheduling | ✅ *"**Schedule regular counts for high-value or critical items**"* · *"Track last count dates for each stock item"* | ✅ `Product.cycleCountDays` |
| Work-order auto-reserve | ✅ *"**Auto-reserve parts for jobs**"* | ✅ A4's `ReserveInput.fromServices` |
| Part vs Stock separation | ✅ *"a 'Part' is, for example, SKF Bearing 6205, while '15 units at Warehouse A - Shelf 3' is a Stock entry for that part"* | ✅ `Product` vs `StockLevel` |
| Batch number mapping | ✅ *"**batch number mapping**"* to SAP storage locations | 🔴 **This is the DOT problem.** `Product.dotCode` is a single value; ✅ OxMaint maps **batch**. Supports `dot-codes-and-shelf-life.md` §6 |
| Count date with timezone | ✅ *"Record count dates **with timezone support (GMT)**"* | 🟡 Minor, but a good discipline for a shop that will log counts at 06:00 |

### 5.2 Limble — the reorder-point and stale-stock answer

✅ `limble.com/products/spare-parts-inventory`, read 2026-10-03. **Verbatim:**

> *"How does Limble prevent stockouts — static min/max or usage-based reorder
> points? — **We use minimum part quantity thresholds: set a minimum for any
> part, and once stock drops below that level, Limble automatically creates a
> reorder task.** We also support a **stale threshold**, which **flags parts that
> haven't been used in a set number of days**, so you can spot excess or dead
> stock."*

| Limble | This schema | Verdict |
| --- | --- | --- |
| Minimum-quantity threshold → auto reorder task | ✅ `Product.reorderPoint` + `Product.reorderQty` + `/api/cron/*reorder` | 🟢 **Same model** |
| 🟢 **Stale threshold — "parts that haven't been used in N days"** | 🟡 `Product.shelfLifeDays` is an *age* concept; a *non-movement* concept is missing | 🟢 **This is exactly A2's stale-stock watch, and Limble names it.** The mechanic-facing name for it is "dead stock" |
| Usage-based forecasting | ❌ not needed at 40 SKUs | 🟡 Overkill |
| Parts connected to work orders | ✅ *"Connect parts directly to work orders"* | ✅ A4 |

> 🟢 **Copy the naming.** Limble calls it a **"stale threshold"**. The dashboard
> should say *"Not moved in 60 days"* — the mechanic's word, not the analyst's.
> ✅ §7.1 of `ph-record-keeping-legal.md` makes this legally meaningful too.

### 5.3 Innovapptive — reservations as a *signal*, not a record

✅ `innovapptive.com/software/spare-parts-management-software`, read 2026-10-03.
**Verbatim:**

> *"**Signal.** A released work order, **reservation or minimum threshold breach**
> raises kitting demand automatically, with no request ticket and no call to the
> storeroom."*
>
> *"**Issue.** The goods issue is confirmed by **digital signature** and posts to
> ERP in real time, so the record matches what left the storeroom."*
>
> *"Barcode-verified receiving, kitting, staging, picking and cycle counting run in
> one native app that works with **no signal**."*
>
> *"**Combo Scan** reads several barcode types at once, and **material photo
> thumbnails** from the SAP material master appear on screen during picking."*

| Innovapptive | Verdict for this build |
| --- | --- |
| A reservation *raises demand* rather than being passive bookkeeping | 🟢 A4: on reserve, the reorder view should change, not just the stock view |
| Goods issue confirmed by signature, posted in real time | 🟢 A3: the consume dialog should record **who**, and post immediately |
| 🟢 **Works offline** | 🔴 **This shop is in a tin shed on EGSA Fourlanes with uncertain mobile data.** The consume flow must work offline and reconcile. **Flag to A2/A3 — and note this is a genuine, shop-specific requirement that no benchmark dismisses** |
| 🟢 **Material photo thumbnail at the bin** | 🔴 **Enormously valuable here and nobody in Balanga does it.** The single highest-value low-cost inventory feature for a shop where the part is in an unlabelled box. A3 should consider it |
| Non-stock items tracked *beside* stocked material | 🟡 Relevant: `11R22.5` and premium rotors are supplier-orderable, not stocked |

### 5.4 AMCS — min/max and paperless cycle counting

✅ `amcsgroup.com/solutions/fleet-maintenance/fleet-parts-inventory-management`,
read 2026-10-03. **Verbatim:**

> *"**inventory cycle counts** — Inventory Cycle Counts are part of the Inventory
> Adjustment feature… Conducting inventory checks is a breeze… **By performing these
> checks regularly—daily, weekly, or monthly, you eliminate the need for a complete
> stock freeze**."*
>
> *"**Min/Max Stock Level feature. Set minimum and maximum thresholds for each
> part, and you will be notified when the stock drops below the minimum level.**"*
>
> *"…tracking, from barcoding to **obsolete parts management**, ensuring that every
> part moving in and out of your stockroom is accounted for."*

🟢 **"You eliminate the need for a complete stock freeze"** — this is precisely
the framing `docs/AGENT-BRIEF.md` uses ("Cycle counting: count the shelf without
closing the bay"), and it is the correct framing for a one-bay shop.

🟢 **"Obsolete parts management"** — an industry name for what A6's clearance
campaign and A2's stale-stock watch jointly solve.

### 5.5 The FDC/Cat-Logistics benchmark — the number that matters

✅ An INFORMS conference paper, *"Inventory Management Simulations at CAT
Logistics"* (INFORMS WSC 2000), `informs-sim.org/wsc00papers/160.PDF`, read
2026-10-03. Caterpillar's parts network:

> *"**With inventory sized to support demand, Cat Logistics clients typically
> achieve inventory reductions of 15% to 40%**… at improved service levels."*

✅ A second Cat Logistics paper on extended warehouse management (via Scribd,
read 2026-10-03) lists **"Dynamic cycle counting"** as a named WMS capability
alongside kitting, slotting, replenishment and wave management.

🟢 **"Dynamic cycle counting" beats `cycleCountDays` as a name and as a
mechanism.** A fixed 30-day cycle for a shop where a tyre line sells twice a week
and a rotor line sells twice a year is wrong for both. ✅ `cycleCountDays` per
product is the right *field*; A2 should compute the *schedule* from it and
prioritise by **velocity and value**, not by the calendar.
→ recommend to A2 and A7. 🟡 The scheduling formula is a `SUGGESTED`.

---

## 6. Benchmarks summary — a scorecard

| System | Structured tyre size | Front/rear pair | Reservation semantics | `available = onHand − reserved` | Cycle count | Reorder point | Age/batch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Shopify** | n/a (generic) | n/a | ✅ `committed`, `reserved`, single-writer rule | ✅ stored, not computed | 🟡 n/a | n/a | ❌ |
| **TireConnect** | ✅ `size_part_1/2/3` | ❌ | ✅ pre-order + delivery date + cutoff | ✅ `quantity_available` ≠ `quantity` | ❌ | 🟡 `min_quantity` | ❌ |
| **TecDoc** | ✅ dimensions, speed/load index, rim offset | ✅ **explicit** | ❌ | ❌ | ❌ | ❌ | ✅ **Superseding Articles** |
| **Autodoc** | ✅ by size + by vehicle | ❌ | ✅ waitlist + alternatives | 🔴 **fails in production** | ❌ | ❌ | 🔴 **DOT-age complaint** |
| **OxMaint** | ❌ | ❌ | ✅ *"reserved for specific work orders"* | ✅ **verbatim** | ✅ scheduled | ✅ on `available` | ✅ **batch mapping** |
| **Limble** | ❌ | ❌ | ✅ | ✅ | 🟡 | ✅ min-threshold + **stale** | ❌ |
| **Innovapptive** | ❌ | ❌ | ✅ reservation as a demand signal | ✅ | ✅ | ✅ breach-triggered | ❌ |
| **AMCS** | ❌ | ❌ | ❌ | 🟡 | ✅ paperless | ✅ min/max | ✅ obsolete tracking |
| **Cat Logistics** | ❌ | ❌ | ✅ backorder/referral | ✅ | ✅ **dynamic** | ✅ forecast + safety stock | ❌ |

**🟢 The honest conclusion: `available = onHand − reserved` is not a clever idea.
Four independent systems state it in almost exactly these words, and Shopify's
platform with the largest engineering budget of any of them forbids third-party
code from writing to the state that implements it. That is a well-solved problem
and this build's design is correct.**

**🔴 And the honest corollary: this shop will get it *wrong* more often than
Autodoc does if it is built carelessly, because a shop has one mechanic, no
engineering team, and a customer standing at the counter.** The sophistication of
the model raises the cost of a bug. `available` is never negative or the whole
thing is decoration.

---

## 7. Philippine tyre shops — the online-competition reality

### 7.1 Methodology and its limits

✅ `docs/research/competitors.md` (this project, prior agent) verified **five
Balanga listings end-to-end** against the City of Balanga's official business-tax
directory on **2026-10-02**. I re-checked for any web presence on **2026-10-03**
and found one additional fact set via a third-party business aggregator
(`exa.ai` library, place records dated 2026-09-14).

> **⚠️ The aggregator is a third-party compilation, not a primary record.** Where
> it conflicts with the city directory, the city directory wins. It is cited here
> only for the **brand claim and the review count**, which the city directory does
> not carry.

### 7.2 The five verified direct competitors

| Shop | Location | Phone | Online presence (checked 2026-10-03) |
| --- | --- | --- | --- |
| **Jed-M Tires & Batteries & Service Center** | 4 Lanes EGSA, Tuyo, Balanga City — ✅ *effectively EYG's neighbour* | 0999 177 5192 | 🟡 **Facebook only.** ✅ Prior research: *"Publishes nothing. No hours, no price, no service list, no photos, no website, no logo."* ✅ The aggregator carries the listing title **"Jed-M Trading — Authorized Dealer of Federal Tires and 3K Battery"** (`exa.ai` library, 2026-09-14) and a **3-of-5 rating from 4 reviews** |
| **CMC Tire & Service Centre** | DM Banzon Avenue, Doña Francisca, Balanga City | 0939 118 0673 | 🟡 Facebook only. Not on EGSA. No published hours, prices or service list |
| **New Ancor Tires and Auto Parts** | Don Manuel Banzon Ave., Doña Francisca, Balanga City | 0929 395 2818 | 🟡 Facebook only. 🟡 The aggregator records **registration date 2009** (`ph.datagemba.com`, undated read) — ✅ "Active". No published hours or prices. Has a **duplicate listing**, which dilutes its local SEO |
| **Tiremarks Automotive Repair Services** | Roman Superhighway, Cupang Proper, Balanga City | 0908 304 0682 | 🟡 Facebook only. Two listings (repair + auto supply). Not on EGSA |
| **CM Tireman Trading & Services** | DM Banzon Avenue, Doña Francisca | 9391180673 | 🟡 Facebook only, per `balanga.com.ph` ✅ prior research |

### 7.3 🟢 The finding that matters for this build

✅ Prior research, `docs/research/competitors.md` §2.5, read 2026-10-02:

> *"Of the five listings I read end-to-end: **0 publish hours. 0 publish prices.
> 0 publish a service list. 0 publish photos. 0 publish a website.** 2 of 5 have
> no logo."*
>
> *"**Zero evidence of any local competitor accepting a booking online.**"*

**I re-checked for web presence on 2026-10-03 and found none.** Not one of them
has a stock page, a price list, or a size finder. The closest any competitor gets
to inventory transparency is a Facebook photo of a tyre they sold.

> ### This is the strategic fact the inventory build rests on
>
> **Every capability in this project — availability, honest shortfall, DOT-aware
> clearance, a real reorder loop — is invisible in the local market.** There is no
> competitor to out-feature. There is only a customer to serve honestly and a
> price to survive on.
>
> And ✅ `pricing-benchmarks.md` §8 shows what the shop is competing *against*: a
> **5.3× price spread** on `205/55R16` between the cheapest and dearest listing
> in the Philippines on one day. The customer can get a `205/55R16` from ₱1,976
> delivered to their door in Metro Manila. **EYG cannot and must not compete on
> price. It competes on the tyre being physically on the rack in Balanga, and on
> the shop being able to say so honestly.**
>
> That is exactly what `ServiceAvailabilityDto.canFulfil` is for.

### 7.4 The one competitor brand claim worth noting

🟡 Jed-M Trading's listing is titled **"Authorized Dealer of Federal Tires and
3K Battery"** (`exa.ai` library, 2026-09-14). 🟡 **I could not verify this against
Federal's or 3K's own dealer locators, and a directory listing title is not proof
of a dealer agreement.**

🔴 **Do not repeat this claim about Jed-M anywhere.** ✅ The project's own rule is
absolute: a wrong claim about a named local business is a defamation risk.
Mentioning a competitor's claimed brands backhanded — *"so-and-so claims to be a
Federal dealer, which we are not"* — is exactly the wrong move. Say what EYG
**is**: ✅ a listed Michelin and BFGoodrich dealer, which is verifiable at
`michelin.com.ph` and `bfgoodrich.com.ph`.

### 7.5 What is NOT verified about the competitive set

- ❓ Whether any competitor stocks 4WD/SUV sizes, or serves the 265/65R17 crowd
- ❓ Whether any competitor does 4WD alignments (a genuine differentiator if none do)
- ❓ Whether any competitor publishes a price *in the shop*, which a customer can
  only discover by visiting — so unmeasurable from outside
- ❓ Whether the region's nearest alternative (Motorlandia, Motortrade, a
  Goodyear Autocare franchise) operates in Batoon

---

## 8. Source register

| # | Source | Class | Retrieved |
| --- | --- | --- | --- |
| B1 | `shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps` | **First-party vendor documentation** | ✅ 2026-10-03 |
| B2 | `eaxisinc.atlassian.net/wiki/spaces/TP/pages/1187184641` and `/2152529921` — TireConnect tyre-supplier ordering integration guide; Web Services Requirements Overview (Tires) | **First-party API documentation** | ✅ 2026-10-03 |
| B3 | `shop.tecalliance.net/…/tecdoc-catalogue-garage-data` — TecDoc Tyres module description | Brand, first-party | ✅ 2026-10-03 |
| B4 | `tec-doc-services.com/download/TecDoc-Data-Format_Version_2.4_EN.pdf` — TecDoc Data Format v2.4 | Vendor specification | ✅ 2026-10-03 |
| B5 | `tecrmi-services.tecalliance.net/docs/PDF/REST/ServiceTd_REST.pdf` and `/SOAP/ServiceTd_SOAP.pdf` — `TdTyre` class: `FrontTyreSize`, `RearTyreSize`, `FrontRimSize`, `RearRimSize`, `HsnTsnVsnSelectionRequired` | Vendor interface specification | ✅ 2026-10-03 |
| B6 | `help.auto-doc.ie/categories/106/248/766` — availability icons, "Notify availability" waitlist, OEM-number search, alternatives list | Brand, first-party (Irish market) | ✅ 2026-10-03 |
| B7 | `autodoc.parts/services/terms-conditions` and `/services/shipping` — availability statuses; the Safe Order exception for tyres | Brand, first-party | ✅ 2026-10-03 |
| B8 | `autodoc.parts/knowledge/tyre-dot-date-code` | ❌ **HTTP 403 — not retrieved** | ❌ 2026-10-03 |
| B9 | `trustpilot.com/review/autodoc.de` — the 4-Bridgestone-tyre DOT-2023 complaint and **Autodoc's own reply** admitting availability overselling under concurrency | Third-party review platform; the company reply is first-party | ✅ 2026-10-03 |
| B10 | `oxmaint.co.uk/stock-management` — Reserved Stock, Available Calculation, Reorder Point, Safety Stock, Cycle Count Scheduling, Batch number mapping | **First-party product documentation** | ✅ 2026-10-03 |
| B11 | `limble.com/products/spare-parts-inventory` — minimum part quantity thresholds; **stale threshold**; cycle counts; work-order linkage | First-party product documentation | ✅ 2026-10-03 |
| B12 | `innovapptive.com/software/spare-parts-management-software` — Signal/Assign/Kit/Stage/Issue; reservation and threshold breach as demand signal; offline operation; Combo Scan and material photos | First-party product documentation | ✅ 2026-10-03 |
| B13 | `amcsgroup.com/solutions/fleet-maintenance/fleet-parts-inventory-management` — Min/Max Stock Level; paperless cycle counting; obsolete parts management | First-party product documentation | ✅ 2026-10-03 |
| B14 | `informs-sim.org/wsc00papers/160.PDF` — *"Inventory Management Simulations at CAT Logistics"*, INFORMS WSC 2000 — 15–40% inventory reduction at improved service; dynamic cycle counting | Academic conference paper | ✅ 2026-10-03 |
| B15 | `docs/research/competitors.md` (this project, prior agent, 2026-10-02) — the five verified Balanga listings and the "0 of 5 publish anything" finding | First-party, pre-existing in this repo | ✅ 2026-10-02 |
| B16 | `exa.ai/library/place/…` (place records dated 2026-09-14) — Jed-M Trading listing title; Ancor and CMC place records | 🟡 **Third-party aggregator, not a primary record** | ✅ 2026-10-03 |
| B17 | `ph.datagemba.com/companies/view/NEW-ANCOR-TIRES---AUTO-PARTS/51701` — Ancor registration date 2009 | 🟡 Third-party business directory | ✅ 2026-10-03 |
| B18 | `tyrepress.com/2022/01/continental-first-tyre-maker-in-tecdoc-catalogue/` — Continental et al. first tyre brands in TecDoc; PRICAT → TecDoc conversion | Trade press | ✅ 2026-10-03 |

**What I could not inspect and did not fake:**

1. **Autodoc's internal inventory system.** Not public. ❌
2. **MotoParts.** Named in the brief. I did not find a *public* inventory
   operations page for a business of that name that I could attribute with
   confidence to a motorcycle-parts retailer. **I am not going to invent a
   profile for it.** The motorcycle/ATV "set of 4" bundle pattern is documented
   instead via `wildboaratvparts.com` and `ombwarehouse.com` product pages
   (✅ read 2026-10-03), which show the pattern clearly — see §9.
3. **TecAlliance's user-facing catalogue UI.** I read the data model and the
   module description, not the rendered catalogue.
4. **Lightspeed / Square.** 🟡 Not inspected. Shopify and the CMMS set covered the
   relevant design decisions; Lightspeed is a POS with Shopify-like inventory
   semantics and adding it would have added volume, not insight.
5. **Any competitor's actual stock.** Nobody publishes it.

---

## 9. 🟡 A documented note on "sets"

The brief asked how these systems handle "a set of 4 vs 5". In the
motorcycle/ATV trade ✅ (`wildboaratvparts.com` and `ombwarehouse.com` product
pages, read 2026-10-03) the answer is visible and it is instructive:

> *"**Set of 4** EFX MotoClaw Tires: 2 front 28x9-15 and 2 rear 28x11-15"* —
> `wildboaratvparts.com`, listing a `Model` code (`MC-28-9-15-MC-28-11-15-Full-Set`)
> as a **distinct product with its own SKU, its own stock line, and its own
> availability state.**

🟢 **The pattern is right: a set is its own product, not a quantity.** And note
it is a **front-and-rear** set — the same asymmetry TecDoc models. 🟡 It also
carries its own `In Stock Today: 7` / `In-Store Stock: 7` counters, i.e. **its
own stock record.**

> **For EYG: `Product.unit: "SET"` is the right unit *if* a set is ever sold as a
> product — and it must then have its own SKU, its own cost, and its own stock.
> It must never be modelled as `qty: 4` of a single tyre.** Otherwise the four
> tyres share one `dotCode` field, which is the `dot-codes-and-shelf-life.md` §6
> problem in its purest form.
> 🟢 **And in this market a set-of-4 is a rarity, not a staple** — see
> `tyre-and-parts-landscape.md` §2.4. Default to `EA`. Model `PAIR` for
> wipers, for the 16" rear-wiper case, and for front brake rotors. Leave `SET`
> available but unused.

---

## 10. The one-paragraph version

I read nine real systems' own documentation. Four of them say, in almost exactly
these words, what this build's central invariant says — *"available stock minus
reserved quantities"*, *"reserved for specific work orders"*, *"quantity
available"* distinct from *"quantity"*, *"on_hand equals the sum of … committed
and reserved"*. That is good news: the design is not clever, it is correct, and
it has been solved many times. Shopify's platform, which has more engineers than
this entire project, writes down a rule forbidding its own API from touching the
committed state — which is exactly this build's "one write path" rule. But the
benchmark that should worry us is Autodoc: a large company that oversold four
tyres under concurrency, took three days to admit it, and then delivered tyres
whose DOT codes were years old — and its own support team told the customer, in
writing, that the website can promise more than it has. Everything we are
building exists to make that impossible here. And the reason it is worth building
at all is that not one of the five Balanga tyre shops publishes a price, an hour,
or a single number anyone can check.
