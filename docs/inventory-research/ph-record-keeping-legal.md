# PHILIPPINE RECORD-KEEPING, WARRANTY AND CONSUMER LAW FOR STOCK

### A1 research · compiled 2026-10-03 · all checks performed 2026-10-03 (Asia/Manila)

---

## 0. Status of this document

**RA 7394 (Consumer Act of the Philippines) full text was retrieved and read
verbatim** from `lawphil.net/statutes/repacts/ra1992/ra_7394_1992.html` on
2026-10-03. Article numbers and quotations in §4–§6 are **primary-source
statutory text**, not commentary. This upgrades a question that the project's
earlier research (`docs/research/legal-compliance-ph.md` §4.1) had to leave open
because it could not reach the statute.

**Three findings here change what this build must do. They are flagged 🔴 and
they matter more than the rest of this document combined:**

| # | Finding | Consequence for the build |
| --- | --- | --- |
| **🔴 1** | **Art. 71** — service firms must guarantee workmanship **and replacement of spare parts for not less than 90 days, and it "shall be indicated in the pertinent invoices"** | The receipt/invoice is a **statutory warranty document**. The 90-day guarantee is a **legal floor**, not an optional policy. `site.ts` has `workmanshipGuaranteeDays: 0` |
| **🔴 2** | **Art. 68(b)(5)** — retailers "shall keep a **record of all purchases** covered by a warranty … for such period of time corresponding to the **lifetime of the product's respective warranties**" | 🔴 **A 6-year tyre warranty legally requires 6 years of purchase records.** The inventory system is a statutory record-keeper, not just a tool |
| **🔴 3** | **Art. 81** — it is **"unlawful to offer any consumer product for retail sale… without an appropriate price tag"** and to sell **"at a price higher than that stated therein"** | The shop-facing price tag and the website price are **the same legal claim**. A stale website price is a statutory breach, not a UX annoyance |

---

## 1. What kind of business this is, legally

✅ RA 7394 Art. 4(bi), verbatim:

> *"**'Repair and service firm' means any business establishment, engaged directly
> or indirectly, in the repair, service, or maintenance of any consumer
> product."*

**EYG is a "repair and service firm" as a matter of statutory definition.** That
definition pulls it into Title III of the Act: warranties (Ch. III), labeling and
fair packaging (Ch. IV), and liability for product and service (Ch. V). The
turning tyres does not change this — the *repair* and *service* does.

Art. 4(bo) — *"'Service' shall, with respect to repair and service firms,
services supplied in connection with a contact for construction, maintenance,
repair, processing, treatment or cleaning of goods or of fixtures on land, or
distribution of goods, or transportation of goods."* ✅ **Tire Mounting and Repair
is a service.** So is Wheel Balancing. So is Change Oil.

---

## 2. BIR — what a small shop must keep

### 2.1 Books of accounts must be registered before use

✅ **Revenue Memorandum Order No. 03-03** (BIR), retrieved in full from
`lawphil.net/administ/bir/rmo/rmo03_03.pdf` and read 2026-10-03. This is the BIR's
own **inventory-verification** procedure, and it is the single most important BIR
document for this project.

✅ A Philippine tax-practice summary of the same rules
(`grantthornton.com.ph/insights/articles-and-updates1/lets-talk-tax/what-to-expect-from-bir-tax-mapping/`,
published 2023-08-01, read 2026-10-03) adds:

> *"Taxpayers who use manual books of accounts, as provided in RMC 29-2019, shall
> register their manual books of accounts before the deadline for filing of the
> first quarterly income tax return or the annual income tax return, whichever
> comes earlier… **books of accounts shall always be kept at the place of business
> of the taxpayer.** Such books and registers, together with records, vouchers,
> and other supporting papers and documents prescribed by the BIR, kept by
> taxpayers shall be **preserved intact, unaltered, and unmutilated**."*

🔴 **"Preserved intact, unaltered, and unmutilated"** is the legal character of
every record this inventory system writes. **This is the legal case for the
append-only `StockMovement` ledger.** An edit-in-place stock table is
non-compliant in spirit and indefensible in an audit. The orchestrator's
"never update, never delete a `StockMovement`" rule is not architectural
preference — it is a response to a statutory preservation duty.

### 2.2 🔴 Stock cards and inventory lists are what a BIR officer looks for

✅ **RMO 03-03 §5.2**, verbatim — the records a Revenue Officer must obtain from
a taxpayer:

> *"**b)** Records of sales, purchases, sales returns, purchase returns and other
> records/documents, **such as stock cards**, pertinent to the taxpayer's
> records of inventories; and **c) Inventory lists at the end of the year** based
> on inventories **segregated per location** where the same are stored or
> maintained."*

✅ **RMO 03-03 §5.12**, verbatim:

> *"Reconcile **Actual Inventory Summaries with Inventory Records/Stock Cards**
> kept by the taxpayer… **a)** Verify the extensions, footings, and totals on
> inventory sheets. **Quantities and unit prices must be stated in correct
> units** (e.g., dozens and price per dozen; tons and price per ton, etc.)…
> **b)** Compare the result of the actual physical count with the balance on
> taxpayer's inventory lists and stock cards."*

🔴 **"Quantities and unit prices must be stated in correct units."** That is a
BIR instruction to say `EA`, `LITRE`, `PAIR`, `SET`, `KG`, `M` — not "some oil",
not "a set". `UnitOfMeasure` is a compliance field, not just a display nicety.

🔴 **"Segregated per location."** EYG has **two** business addresses in the wild
— EGSA Fourlanes, Tuyo (service) and 183 Calero St., Ibayo (tyre trading)
(`facebook-intel.md`, ✅ both confirmed). **If both hold stock, the BIR expects
them accounted separately.** The `StockLevel` model has **no location dimension**
— one row per `productId`, full stop. → `open-questions.md` **Q-14**.

### 2.3 🔴 THE KILLER CLAUSE — RMO 03-03 §5.14

✅ **RMO 03-03 §5.14**, verbatim. This is the single most important sentence in
this document:

> *"**If the taxpayer does not maintain inventory records/books or stock cards,
> the Revenue Officer shall determine the discrepancy by using the beginning
> Inventory List as submitted by the taxpayer.** From the beginning balance, add
> all items of purchases with adjustments on returned items and materials/goods
> in transit, to arrive at the total items for sale. From this quantity, deduct
> all the items sold with adjustments on returns, to get the number of items as
> ending inventory. Match the resultant figure per item of inventory with the
> quantities reflected in the physical inventory count and verify discrepancies,
> if any. **If the taxpayer cannot validly justify the discrepancy(ies) noted,
> consider the same as undeclared sales.**"*

Read that again slowly. **A shop with no stock records, whose physical count does
not tie to the arithmetic, has its discrepancy treated as undeclared sales.**
Undeclared sales are unrecorded taxable sales.

> **This is the commercial case for building this system at all.** A tyre shop
> that stocks a few hundred thousand pesos of tyres, batteries and oil and runs
> on a shoebox and memory is one audit away from that clause. **A system that
> produces a defensible stock card, a movement ledger, and a reconcilable count
> is the difference between "undeclared sales" and "here is my reconciliation".**

### 2.4 Retention period — ⚠️ the sources conflict, and I am not resolving it

| Source | Period | Class |
| --- | --- | --- |
| ✅ A tax-practice summary, `fiscal-requirements.com/news/5916-philippines-software-compliance` (read 2026-10-03), citing **RR No. 7-2024**: *"books of accounts and other accounting records must generally be retained for **five years**… The concept of accounting records includes supporting documents such as invoices, receipts, vouchers, and other source records."* | **5 years** | 🟡 Secondary summary of a named issuance I did not retrieve |
| 🟡 `pinoygovguide.com/bir/books-of-accounts` (read 2026-10-03): *"Books of accounts must be **preserved for a period of 10 years from the last entry**"* (cited to the NIRC) | **10 years** | 🟡 Secondary blog |

> **⚠️ These conflict, and I did not retrieve RR 7-2024 itself to adjudicate.**
> **Resolution for this build: design for the longer period.** RA 7394
> Art. 68(b)(5) ✅ independently requires purchase records to be kept **"for such
> period of time corresponding to the lifetime of the product's respective
> warranties"** — for a 6-year tyre warranty, that is **6 years**, and for a
> battery it is however long that brand's warranty runs. **The longest
> applicable obligation governs. Assume 10 years. Delete nothing.**
> → `open-questions.md` **Q-15** — the owner confirms with his accountant.

### 2.5 POS / cash register / receipts

✅ **Revenue Regulations No. 10-99**, "Rules on the Use of Cash Register and
Point-of-Sale Machines in Lieu of Registered Sales Invoices or Receipts",
retrieved from `elibrary.judiciary.gov.ph` (Supreme Court E-Library), read
2026-10-03. Registered CRM/POS machines must produce a two-roller audit journal,
a reset counter, legible impressions, and **numbered, itemised, consecutively
issued receipts**.

🟡 **Grant Thornton (2023-08-01)** lists, among the BIR's stated penalties:

| Failure | Penalty stated |
| --- | --- |
| Failure to display **"Ask for Receipt"** / NIRI | ₱1,000 |
| Failure to attach/paste the authorised sticker authorising CRM/POS/CAS use | ₱1,000 per unit |
| Failure to present the application forms to use registered sales books / permit to use loose-leaf sales books | ₱1,000 |

✅ **RMO No. 24-2023** (BIR, `bir-cdn.bir.gov.ph`, read 2026-10-03) governs
accreditation of cash-register/POS/CAS software in the Enhanced eAccReg System and
specifies, among a checklist of requirements, *"a. Accumulated Grand Total Sales
b. Tamper-free c. Activity Log or Transaction Log d. Non-volatile memory e.
E-journal or Audit Journal… m. Data Retention."*

🔴 **This inventory system is not the shop's POS and must not attempt to be.**
It is an internal stock ledger. The BIR-registered receipting system remains the
BIR-registered receipting system. **Do not print BIR invoices from this app.**
→ `open-questions.md` **Q-16** — confirm which system is the BIR-registered one.

---

## 3. DTI — what DTI does and does not do here

### 3.1 DTI's role in RA 7394

✅ RA 7394 Art. 6(b): the Act is enforced **"with respect to other consumer
products not specified above"** by **DTI**. Art. 75 ✅ repeats this for the
labeling chapter: *"The Department of Trade and Industry shall enforce the
provisions of this Chapter."* Art. 96 ✅ for liability.

### 3.2 🔴 DTI price-display rules DO apply to this shop — via the Consumer Act, not the Price Act

This is the answer to the brief's question *"Any DTI price-display rules for
tyres?"*, and the naive answer ("no, the Price Act only covers basic
necessities") is **wrong**.

✅ **RA 7581 (Price Act) §3** does list basic necessities — and ✅ that list, as
read from a law-firm analysis (`alburolaw.com/retail-and-wholesale-price-of-commodities/`,
read 2026-10-03), is rice, corn, root crops, bread, fish, pork/beef/poultry,
eggs, bottled water, milk, vegetables, instant noodles, coffee, sugar, cooking
oil, salt, detergents, LPG, kerosene, candles, essential drugs and similar.
**Tyres, filters, brake pads and engine oil are not on it.** So no SRP cap
applies to tyres.

**BUT** ✅ **RA 7394 Article 81** is a separate statute with separate scope:

> *"**Article 81. Price Tag Requirement.** – It shall be unlawful to offer **any
> consumer product for retail sale to the public** without an appropriate price
> tag, label or marking publicly displayed to indicate the price of each article
> **and said products shall not be sold at a price higher than that stated
> therein** and without discrimination to all buyers: Provided, That… if
> consumer products for sale are too small or the nature of which makes it
> impractical to place a price tag thereon a **price list placed at the nearest
> point where the products are displayed** indicating the retail price of the
> same may suffice."*

✅ **Article 82:** *"Price tags, labels or markings must be written clearly,
indicating the price of the consumer product **per unit in pesos and centavos**."*

✅ **Article 83:** *"…**There shall be no erasures or alterations of any sort of
price tags**, labels or markings."*

✅ **Article 4(bd)** defines *"'Price tag' means any device, written, printed,
affixed or attached to a consumer product **or displayed in a consumer repair or
service establishment** for the purpose of indicating the retail price per unit
**or service**."* — ✅ **the definition expressly reaches a service
establishment's posted service prices, not just goods on a shelf.**

✅ **Penalty, Article 95(b):** *"Any person who violates the provisions of Article
81 to 83 for the first time shall be subject to a fine of not less than **Two
hundred pesos (P200.00) but not more than Five thousand pesos (P5,000.00)** or by
imprisonment of not less than one (1) month but not more than six (6) months or
both… **A second conviction under this paragraph shall also carry with it the
penalty of revocation of business permit and license.**"*

### 3.3 What Article 81 means for this build — concretely

| # | Requirement | Where it lands |
| --- | --- | --- |
| 1 | Every product offered for retail sale needs a displayed price | The shop's shelf tag. Inventory's job is to make that tag correct |
| 2 | **You may not sell above the stated price** | 🔴 **A website price is a "price tag" under Art. 4(bd).** If `sellPrice` in the database is not the price on the tag and the customer sees a lower/higher number, that is an Art. 81 breach |
| 3 | Price in **pesos and centavos** | Note: the schema uses `Int` pesos — *"Philippine practice has no cents"* is the schema's own comment. **An integer-peso price satisfies Art. 82's requirement to state pesos and centavos, provided centavos are shown as `.00`** 🟡 or the price is a whole peso and is stated as such |
| 4 | **No erasures or alterations of price tags** | 🟡 Practically: reprint the tag, do not stick over it. This is a shop procedure, not code |
| 5 | "**without discrimination to all buyers**" | 🔴 **No "different price at the counter".** The tag price is the price |
| 6 | A **price list at the display point** suffices for small/impractical items | Filters, valves, plugs, weights → a printed or displayed list, not 40 individual tags |

> **🔴 The 90-day invoice warranty and the price tag have a common enemy: a
> printed price list that is out of date.** Art. 83 forbids altering a tag;
> Art. 81 forbids selling above it. The cheapest compliance control is **a
> monthly check that the shop's displayed prices match the system** — and that
> is a free feature of the inventory system (`ValuationDto`, `ReorderRowDto`).
> Recommend A2 expose a "prices changed" digest; the owner reads it on the first
> of the month.

---

## 4. Warranty — the statute, verbatim

### 4.1 🔴 Article 71 — the 90-day service guarantee. This is the big one

✅ **RA 7394 Article 71**, verbatim, in full:

> *"**Article 71. Guaranty of Service Firms. – Service firms shall guarantee
> workmanship and replacement of spare parts for a period not less than ninety
> (90) days which shall be indicated in the pertinent invoices.**"*

Three things are happening in one sentence:

1. **It is mandatory.** "Shall", not "may".
2. **It covers two things** — *workmanship* **and** *replacement of spare parts*.
   Both. Not "workmanship at the shop's discretion".
3. **It must appear on the invoice.** Not on a poster, not in a policy document,
   not in small print on a sign — **on the pertinent invoice.**

> **🔴 Consequence 1 — `src/config/site.ts` is currently non-compliant by
> omission.**
> `BUSINESS.trust.workmanshipGuaranteeDays: 0`, with the comment
> *"No workmanship warranty has been agreed. Rendered as policy language, never
> as a number, until the owner signs one off."*
> ✅ **The law already sets the floor at 90 days.** The shop does not get to
> choose zero. It may choose *more* than 90; it may not choose less. **The
> orchestrator must set this to 90 and print it on the invoice.**
> *(I am not editing `site.ts` — it is orchestrator-owned. This is a request.)*
>
> **🔴 Consequence 2 — the invoice is a legal instrument.** It must carry the
> 90-day guarantee. This makes `StockMovement.reference` and the booking
> reference materially more important than they look: they are the trail from a
> job back to the invoice that carries the guarantee.
>
> **🔴 Consequence 3 — a well-intentioned no-warranty policy is unlawful.**
> *"No return on installed parts"* (the existing legal doc flags this as a
> complaint generator — correctly) is, if it applies to the **first 90 days**, a
> breach of Art. 71. It can apply after 90 days.

### 4.2 Article 69 — implied warranties on services and materials

✅ **RA 7394 Article 69**, verbatim:

> *"**a)** In every contract for the supply of services to a consumer made by a
> seller in the course of a business, there is an **implied warranty that the
> service will be rendered with due care and skill** and that **any material
> supplied in connection with such services will be reasonably fit for the
> purpose for which it is supplied**.
>
> **b)** Where a seller supplies consumer services in the course of a business
> and the consumer, expressly or by implication, **makes known to the seller the
> particular purpose** for which the services are required, there is an implied
> warranty that the services supplied under the contract **and any material
> supplied in connection therewith will be reasonably fit for that purpose** or
> are of such a nature or quality that they might reasonably be expected to
> achieve that result, unless the circumstances show that the consumer does not
> rely or that it is unreasonable for him to rely, on the seller's skill or
> judgment."*

🔴 **Article 69(b) is the strongest argument in the entire statute for A3's
inventory build and for A4's booking integration.**

- *"any material supplied in connection with such services will be reasonably
  fit for the purpose"* → **selling the wrong oil filter for the car is a
  statutory warranty breach.** An inventory system that lets the bay pull any
  filter is a statutory exposure.
- *"the consumer, expressly or by implication, makes known to the seller the
  particular purpose"* → **the customer's declared vehicle is that
  information.** The booking's vehicle record is the disclosure. If the system
  lets a mechanic fit a part without reference to the booked vehicle, the shop
  has thrown away the disclosure that defines the warranty.
- 🔴 **Therefore: `ServicePartRequirement` is not a convenience feature. It is the
  mechanism by which the shop demonstrates it supplied material fit for the
  disclosed purpose.**

### 4.3 Article 68 — what an express warranty must say, and how a claim works

✅ **Article 68(a)** — any seller or manufacturer who gives an express warranty
**shall**:

> *"1) set forth the terms of warranty in clear and readily understandable
> language and clearly identify himself as the warrantor; 2) identify the party
> to whom the warranty is extended; 3) state the products or parts covered;
> 4) state what the warrantor will do in the event of a defect, malfunction or
> failure to conform to the written warranty **and at whose expense**; 5) state
> what the consumer must do to avail of the rights which accrue to the warranty;
> and 6) stipulate the period within which, after notice of defect, the warrantor
> will perform any obligation under the warranty."*

> 🔴 **Items 1, 2 and 4 are the trap.** *"clearly identify himself as the
> warrantor"* — the shop must not present the customer's **manufacturer's**
> warranty (Michelin's 6 years, Amaron's warranty) as if it were **its own**. And
> item 4, *"at whose expense"*, means a Michelin warranty claim where the customer
> pays a pro-rata share must be disclosed.
> **The existing project rule — distinguish EYG workmanship warranty from
> manufacturer parts warranty, never blur them — is Article 68(a)(1).**

✅ **Article 68(b)(4) — "Enforcement of warranty or guarantee"**, verbatim:

> *"The warranty rights can be enforced by presentment of a claim. To this end,
> **the purchaser needs only to present to the immediate seller either the
> warranty card or the official receipt along with the product** to be serviced or
> returned to the immediate seller. **No other documentary requirement shall be
> demanded from the purchaser.** If the immediate seller is the manufacturer's
> factory or showroom, the warranty shall immediately be honored… In the case of
> a retailer other than the distributor, **the former shall take responsibility
> without cost to the buyer of presenting the warranty claim to the distributor
> in the consumer's behalf.**"*

> **🔴 This is the precise, statutory answer to the brief's question "what does a
> warranty claim require (invoice)?"**
>
> **Answer: the warranty card OR the official receipt. Nothing else may be
> demanded of the customer.**
>
> Three operational consequences:
>
> 1. ✅ This **corroborates Amaron's own first-party guidance** ("keep the Warranty
>    Card and a copy of the sales receipt", `amaron-ph.com/tips-for-buying-batteries`).
>    Statute and manufacturer agree.
> 2. 🔴 **A customer who turns up with neither is entitled to the warranty
>    anyway**, and demanding more is unlawful (Art. 68(b)(4)). What the shop may
>    do is find its **own** record of the sale.
> 3. 🔴 **"The former shall take responsibility… of presenting the warranty claim
>    to the distributor in the consumer's behalf"** — **the shop is the customer's
>    representative to Amaron, Michelin or Motolite.** That is a job. It is the
>    Amaron **warranty card** that must be handed over, and the shop must be able
>    to produce the serial number it recorded at sale.

✅ **Article 68(b)(5) — the record-keeping duty**, verbatim:

> *"**Record of purchases. – Distributors and retailers covered by this Article
> shall keep a record of all purchases covered by a warranty or guarantee for
> such period of time corresponding to the lifetime of the product's respective
> warranties or guarantees.**"*

> **🔴🔴 This is the finding that makes this inventory system legally
> necessary.**
>
> A retailer must **keep a record of every warranty-covered purchase** for as
> long as that product's warranty lasts. ✅ Michelin Philippines' tyre warranty runs
> **6 years** from the date of purchase (`michelin.com.ph/michelin-ph-warranty`,
> effective 1 Jan 2026, read 2026-10-03).
>
> **Therefore EYG is required by Philippine law to be able to produce, for six
> years, the record of every tyre it sold: to whom, when, which size, which brand,
> which DOT.**
>
> **Today, with a shoebox, that record does not exist.** The moment a customer
> comes back in 2031 with a warranty claim and the shop cannot produce the sale,
> the shop has breached Art. 68(b)(5).
>
> **The append-only `StockMovement` ledger, the `Booking` record, and the
> `reference` field are, together, the statutory record.** This is the single
> strongest justification for the whole build and it is a *legal* one, not a
> commercial one.

✅ **Article 68(b)(1) — the sales report**, verbatim:

> *"All sales made by distributors of products covered by this Article shall be
> reported to the manufacturer, producer, or importer of the product sold **within
> thirty (30) days from date of purchase**, unless otherwise agreed upon. The
> report shall contain, among others, the date of purchase, model of the product
> bought, **its serial number**, name and address of the buyer. The report made in
> accordance with this provision **shall be equivalent to a warranty
> registration**…"*
> *"**2) Failure to make or send report.** … Failure of the distributor to make
> the report… **shall relieve the latter [manufacturer] of its liability under the
> warranty**: Provided, however, That the distributor who failed to comply… **shall
> be personally liable under the warranty.** For this purpose, the manufacturer
> shall be obligated to make good the warranty **at the expense of the
> distributor**."*
> *"**3) Retail.** – The retailer shall be **subsidiarily liable** under the
> warranty in case of failure of both the manufacturer and distributor to honor
> the warranty. In such case, the retailer **shall shoulder the expenses and costs
> necessary to honor the warranty**."*

🟡 EYG is a **retailer**, not a distributor, so Art. 68(b)(1)'s 30-day report is
not its direct duty. But Art. 68(b)(3) ✅ is, and it is severe: **if both Amaron
and its distributor fail to honour a warranty, the retailer pays.**

> 🔴 **That is a real cash exposure on the battery line.** A battery is the most
> expensive single item the shop stocks and the one most likely to fail inside
> its warranty. **"The retailer shoulders the expenses"** means a shop with
> ₱5,000 of Amaron in stock carries a tail risk of ₱5,000 per unit it cannot
> return to the distributor.
> **This is an argument for the owner's approval before adding an upper-band AGM
> line** (e.g. the ₱9,500–₱14,900 Amaron JADE) — it maximises exactly the
> exposure Art. 68(b)(3) creates. → `open-questions.md` **Q-05**.

### 4.4 Article 68(e) and 68(f) — duration and breach

✅ **Article 68(e):** *"The seller and the consumer may stipulate the period
within which the express warranty shall be enforceable… **Any other implied
warranty shall endure not less than sixty (60) days nor more than one (1) year
following the sale of new consumer products.**"*

✅ **Article 68(f)(1) — Breach of express warranty**, verbatim:

> *"the consumer may elect to have the goods repaired or its purchase price
> refunded by the warrantor. In case the repair of the product in whole or in
> part is elected, **the warranty work must be made to conform to the express
> warranty within thirty (30) days**… In case the refund of the purchase price is
> elected, the amount directly attributable to the use of the consumer prior to
> the discovery of the non-conformity shall be deducted."*

🔴 **The 30-day repair clock is a hard number the shop's workflow must respect.**
An inventory system that lets a warranty job sit for six weeks because the part
was never received is in breach of a statutory deadline. This is an argument for
`Reservation` having a real `expiresAt` and for the reorder digest to actually
fire — a2/A4.

### 4.5 Article 68(c) and 68(d) — "full" vs "limited" warranty

✅ **Article 68(c):** a written warranty must be clearly designated as
**"Full warranty"** if it meets the minimum requirements in para (d), or
**"Limited warranty"** if it does not.

✅ **Article 68(d) — minimum standards**, verbatim: the warrantor shall
*"1) remedy such consumer product **within a reasonable time and without charge**
in case of a defect, malfunction or failure to conform to such written warranty;
2) **permit the consumer to elect whether to ask for a refund or replacement
without charge** of such product or part, as the case may be, where after
reasonable number of attempts to remedy the defect or malfunction, the product
continues to have the defect or to malfunction."*

🔴 **If the shop writes an express warranty on the invoice (and Art. 71 obliges
it to indicate a guarantee), it must be labelled "Full warranty" or "Limited
warranty".** Shipping a warranty statement with neither label is a defect in the
warranty itself. **This is a copy decision for A5, and it must be made
deliberately.**

### 4.6 Article 72 — prohibited acts

✅ **RA 7394 Article 72**, verbatim:

> *"The following acts are prohibited:
> a) **refusal without any valid legal cause** by the manufacturer or any person
> obligated under the warranty or guarantee to honor a warranty or guarantee
> issued; b) **unreasonable delay** by the local manufacturer or any person
> obligated under the warranty or guarantee in honoring the warranty; c)
> **removal by any person of a product's warranty card for the purpose of evading
> said warranty obligation**; d) **any false representation in an advertisement
> as to the existence of a warranty or guarantee.**"*

🔴 **Article 72(d) is A6's hard limit.** A clearance campaign must not advertise
a warranty the shop does not give. ✅ Michelin's Philippine warranty is
**"six (6) years from the date of purchase (subject to the presentation of valid
proof of purchase)"** and the claim is accepted **"only … within 10 years from
the tire's manufacturing date"** — so an advertisement saying *"full 6-year
Michelin warranty"* on a tyre made 9 years ago is a **false representation under
Art. 72(d)**. `dot-codes-and-shelf-life.md` §2.3 sets the bands that avoid this.

✅ **Article 73(b) — penalties:** *"fine of not less than One thousand pesos
(P1,000.00) but not more than **Fifty thousand pesos (P50,000.00)** or
imprisonment for a period of at least one (1) year but not more than five (5)
years, or both."*

### 4.7 Liability for services — Article 99

✅ **RA 7394 Article 99**, verbatim:

> *"**Liability for Defective Services.** The service supplier is liable for
> redress, **independently of fault**, for damages caused to consumers by defects
> relating to the rendering of the services, as well as for **insufficient or
> inadequate information on the fruition and hazards thereof**."*

🔴 **"Independently of fault"** — strict liability. **"Insufficient or inadequate
information on the fruition and hazards"** — i.e. *failing to warn* is itself a
liability. For this shop that means the OBD Scanning and Resetting service, and the
Underchassis Maintenance and Repair service, must not be sold as a mystery box.
A3/A5 should confirm the copy discloses what the service does and does not find.

---

## 5. Deceptive and unfair sales practices — the "in stock" question

### 5.1 The statute

✅ **RA 7394 Article 50**, verbatim:

> *"A deceptive act or practice by a seller or supplier in connection with a
> consumer transaction violates this Act whether it occurs **before, during or
> after** the transaction. An act or practice shall be deemed deceptive whenever
> the producer, manufacturer, supplier or seller, **through concealment, false
> representation or fraudulent manipulation**, induces a consumer to enter into a
> sales or lease transaction of any consumer product or service."*

✅ **Article 52**, verbatim:

> *"An unfair or unconscionable sales act or practice … violates this Chapter
> whether it occurs **before, during or after** the consumer transaction. An act
> or practice shall be deemed unfair or unconscionable whenever the producer,
> manufacturer, distributor, supplier or seller, **by taking advantage of the
> consumer's physical or mental infirmity, ignorance, illiteracy, lack of time or
> the general conditions of the environment or surroundings, induces the consumer
> to enter into a sales or lease transaction grossly inimical to the interests of
> the consumer or grossly one-sided in favor of** the producer, manufacturer,
> distributor, supplier **or seller**."*

✅ **Article 60(a) — penalties:** *"fine of not less than **Five Hundred Pesos
(P500.00)** but not more than **Ten Thousand Pesos (P10,000.00)** or imprisonment
of not less than **five (5) months** but not more than **one (1) year**, or both."*

🔴 **Article 52's trigger words are the ones this build must not trip:** *"lack
of time"*, *"the general conditions of the environment or surroundings"*, and
*"grossly one-sided in favor of … the seller."*

**A customer standing at a counter with their car on a lift has no time. That is
precisely the "lack of time" circumstance Article 52 names.** Everything this
build does about honesty at the counter is, in law terms, a refusal to exploit
that asymmetry.

### 5.2 🔴 THE ANSWER: does displaying "in stock" create an obligation?

**Answer: displaying "in stock" creates no *specific* obligation that I could
locate in Philippine law — but publishing a stock number is a *representation*,
and it is governed by Article 50.**

| Question | Answer | Basis |
| --- | --- | --- |
| Is there a Philippine rule obliging a shop to hold goods for a customer who asks? | **No such rule located.** ❌ | Negative finding. RA 509 §10 and RA 1168 §7 both contain *"No person engaged in the retail trade shall refuse to sell any such displayed merchandise"* — but ✅ both are statutes about **price-controlled commodities**, and ✅ tyres are not basic necessities or prime commodities under RA 7581 §3. **Do not apply them here** |
| Does displaying a price create an obligation? | **YES.** ✅ Art. 81 + Art. 95(b) | §3.2 |
| Does displaying *"in stock"* create an obligation? | **Indirectly, YES.** It is a representation of fact under **Art. 50**. If it is false, and it induces the transaction, it is a deceptive act | Art. 50, verbatim above |
| Does it matter that the deception is by the *website* rather than the counter? | **No.** Art. 50 applies *"whether it occurs before, during or after the transaction"* ✅ | Art. 50 |
| Is there an obligation to *disclose* that a tyre is a specific DOT week? | **No specific rule located.** ❌ | But calling a 2019 tyre *"old"* or *"expired"* **would** be a false representation under Art. 50. Stating the true week is therefore the *safe* disclosure |

> **🔴 The operational rule, and it is the exact inverse of what most inventory
> software does:**
>
> **`available` is the ONLY number that may be rendered to a customer as a stock
> promise. `onHand` is never a promise. `reserved` is never a promise.**
>
> A reservation held for a 25-minute-later appointment is not sellable. If a
> customer-facing surface renders "4 in stock" from `onHand` while three are held
> for a booking, the shop has made a representation under Art. 50 that it knows to
> be false. **The orchestrator's invariant is the legal protection, not just the
> data-integrity one.**

### 5.3 Article 4(l) — "closing out sale" — A6's specific hazard

✅ **RA 7394 Art. 4(l)**, verbatim:

> *"**'Closing out sale' means a consumer sale wherein the seller uses the
> announcement to create the impression that he is willing to give large
> discounts or merchandise in order to reduce, dispose or close out his inventory
> and business.**"*

🔴 **A DOT-based tyre clearance campaign is the textbook shape of a closing out
sale.** The campaign must therefore:

| Rule | Why |
| --- | --- |
| 🚫 **Never say "closing out", "final sale", "last chance", "everything must go", or "we're clearing the warehouse"** | Those are the statutory signal words of a closing-out sale. In a shop that is not closing, that is a false representation |
| 🚫 **Never imply the business is ending** | Art. 4(l) includes *"close out his inventory **and business**"* |
| ✅ **Say what is true**: *"Tyres manufactured in 2023. Reduced while stock lasts."* | Verifiable, and carries the same commercial message |
| ✅ **Never run a countdown that resets** | Art. 50 — a reset countdown is a fraudulent manipulation of the customer's decision |
| ✅ **Every clearance price must be a real price at the counter** | Art. 81 — "shall not be sold at a price higher than that stated therein" |

---

## 6. 🔴 The owner compliance checklist — inventory-specific

Cross-referenced to `docs/research/legal-compliance-ph.md` §9, which covers the
whole business. **This is only the stock-and-warranty subset.**

### TIER 1 — before the inventory system goes live (blocking)

| # | Item | Why | Owner |
| --- | --- | --- | --- |
| **1** | 🔴 **Decide the workmanship guarantee and set it to at least 90 days.** `BUSINESS.trust.workmanshipGuaranteeDays` must stop being 0 | ✅ RA 7394 Art. 71 — "shall guarantee … not less than ninety (90) days" | Owner → orchestrator |
| **2** | 🔴 **Design the invoice to carry the 90-day guarantee, and label it "Full warranty" or "Limited warranty"** | ✅ Art. 71 ("shall be indicated in the pertinent invoices"); ✅ Art. 68(c)–(d) for the label | Owner + A5 |
| **3** | 🔴 **Confirm the retention design keeps purchase records for the life of the warranty (6 years for tyres), and treat 10 years as the working target** | ✅ Art. 68(b)(5); retention conflict §2.4 | Owner + accountant + A2 |
| **4** | 🔴 **Read the invoice requirement**: seller name, TIN, address, date of service, date of issue, customer, vehicle, plate, itemised labour, itemised parts with brand **and part number**, oil grade **and litres**, totals in pesos, the job-order reference, and the warranty scope + who provides it | `docs/research/legal-compliance-ph.md` §5 (16-element list); ✅ Art. 81 requires the price per unit | Owner |
| **5** | 🔴 **Resolve the two-address question before stocking anything.** EGSA Fourlanes vs 183 Calero St. | ✅ RMO 03-03 §5.2(c) — "Inventory lists … **segregated per location**". `StockLevel` has no location dimension | Owner → orchestrator. **Q-14** |
| **6** | **Confirm which system is the BIR-registered receipting system, and that this inventory app is not it** | ✅ RR 10-99; ✅ RMO 24-2023 | Owner + accountant. **Q-16** |
| **7** | 🔴 **Write the shelf-price procedure**: every saleable item has a displayed price or a price list at the display point; monthly reconciliation of displayed prices to the system; never alter a tag | ✅ RA 7394 Arts. 81–83, 95(b) | Owner |
| **8** | **Establish the physical-count regime.** Year-end inventory, and the stock-card record RMO 03-03 §5.12 expects | ✅ RMO 03-03 §5.2(b), §5.11, §5.12, §5.14 | Owner + A2/A3 |

### TIER 2 — first month

| # | Item | Why | Owner |
| --- | --- | --- | --- |
| 9 | 🔴 **Design the warranty-claim SOP around Art. 68(b)(4)**: the customer presents *either* the warranty card *or* the official receipt; **demand nothing else**; the shop presents the claim to the distributor on the customer's behalf | ✅ Art. 68(b)(4); ✅ RA 7394 Art. 72(c) makes removing a warranty card to evade the obligation prohibited | Owner |
| 10 | **Capture the battery serial number at the point of sale** | ✅ Art. 68(b)(1) names the serial number as the identifying record; ✅ Motolite registers warranty by serial or plate | Owner + A3 |
| 11 | **Get the Amaron warranty duration in months, in writing, and the claim procedure** | ✅ Amaron's public site does not publish it; ✅ Art. 68(a)(1)–(6) requires the terms to be stated to the consumer | Owner → distributor |
| 12 | **Get the Michelin PH dealer warranty terms in writing from Michelin** (the shop is a listed dealer) | ✅ Already published at `michelin.com.ph/michelin-ph-warranty`; get the dealer copy | Owner |
| 13 | **Decide whether the shop accepts battery warranty exposure beyond its distributor** | ✅ Art. 68(b)(3) — retailer subsidiarily liable, shallering the cost | Owner. **Q-05** |
| 14 | **Confirm the LGU business permit and the DTI/SEC registration cover the retail sale of parts**, not only services | DTI; ✅ Art. 4(bi) definition covers both | Owner |
| 15 | **Read RA 7394 Chapter IV labeling rules (Art. 77) and confirm every part sold over the counter carries the minimum label information** | ✅ Art. 77 requires all domestically-sold consumer products to indicate specified label information. 🟡 *I read the article heading and its existence; I did not transcribe every sub-item — the owner or a lawyer must* | Owner |

### TIER 3 — ongoing

| # | Item | Cadence |
| --- | --- | --- |
| 16 | **Count the shelf. Always.** The Art. 68(b)(5) record and the RMO 03-03 stock card only exist if the count exists | `cycleCountDays` per product; a full count at least quarterly |
| 17 | **Reconcile displayed prices to the system** — Art. 83 forbids altering tags, so a mismatch must be corrected by reprinting, not by sticker | Monthly |
| 18 | **Review the DOT bands in `dot-codes-and-shelf-life.md` §2.4 against what is actually on the shelf** | Quarterly |
| 19 | **Re-read this document and `docs/research/legal-compliance-ph.md` with the owner or his accountant** | Annually |
| 20 | **Re-check RR 7-2024 retention vs the 10-year reading** | Annually. **Q-15** |

---

## 7. Source register

| # | Source | Class | Retrieved |
| --- | --- | --- | --- |
| L-01 | **`lawphil.net/statutes/repacts/ra1992/ra_7394_1992.html`** — **full text of RA 7394, the Consumer Act of the Philippines** (Art. 4 definitions incl. "price tag", "repair and service firm", "closing out sale"; Art. 50 deceptive acts; Art. 52 unfair/unconscionable; Art. 60 penalties; Art. 67–73 warranties incl. **Art. 71 the 90-day service guarantee**; Art. 74–83 labeling incl. **Art. 81 price tag requirement**; Art. 95 penalties; Art. 96–99 liability) | **PRIMARY — statute** | ✅ 2026-10-03 |
| L-02 | `lawphil.net/administ/bir/rmo/rmo03_03.pdf` — **BIR RMO 03-03, inventory verification**: §5.2(b) stock cards; §5.2(c) inventory lists segregated per location; §5.11; §5.12; **§5.14 the undeclared-sales clause**; §5.3(c) marking the books for inventory cut-off | **PRIMARY — BIR issuance** | ✅ 2026-10-03 |
| L-03 | `elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/47969` — **BIR RR 10-99**, Rules on the Use of Cash Register and Point-of-Sale Machines | **PRIMARY — BIR issuance** | ✅ 2026-10-03 |
| L-04 | `bir-cdn.bir.gov.ph/…/RMO No. 24-2023 Digest FINAL.pdf` — **BIR RMO 24-2023**, POS/CAS accreditation via Enhanced eAccReg; the required feature checklist (accumulated grand total, tamper-free, activity log, non-volatile memory, e-journal, data retention…) | **PRIMARY — BIR issuance** | ✅ 2026-10-03 |
| L-05 | `chanrobles.com/republicacts/republicactno509.html` — **RA 509**, §10 price list + price tag + "no person engaged in the retail trade shall refuse to sell any such displayed merchandise" | PRIMARY — statute. ⚠️ **Applies to price-controlled commodities; tyres are not controlled.** Cited to show why the clause does *not* reach this shop | ✅ 2026-10-03 |
| L-06 | `chanrobles.com/republicacts/republicactno1168.html` — **RA 1168**, §7 the same posting/refusal clause | PRIMARY — statute, same caveat | ✅ 2026-10-03 |
| L-07 | `chanrobles.com/republicacts/republicactno2610.html` — **RA 2610**, §3 factors for a reasonable margin; §5 under-oath stock inventory; §7 posting; §8 "No importer, manufacturer or producer, wholesaler or retailer … shall refuse to sell any such merchandise if he has such merchandise in stock" | PRIMARY — statute, same caveat | ✅ 2026-10-03 |
| L-08 | `alburolaw.com/retail-and-wholesale-price-of-commodities/` — RA 7581 Price Act §2, §3 basic-necessities list, §10(5) SRP issuance | 🟡 Law-firm commentary on statute | ✅ 2026-10-03 |
| L-09 | `alburolaw.com/on-illegal-acts-of-price-manipulation/` — RA 7581 §5 price manipulation; prima facie evidence of profiteering incl. **no price tag** | 🟡 Law-firm commentary on statute | ✅ 2026-10-03 |
| L-10 | `grantthornton.com.ph/…/what-to-expect-from-bir-tax-mapping/` — manual books registration; books kept at the place of business; **"preserved intact, unaltered, and unmutilated"**; penalties incl. "Ask for Receipt"/NIRI ₱1,000 | 🟡 Professional advisory, published 2023-08-01 | ✅ 2026-10-03 |
| L-11 | `grantthornton.com.ph/…/what-taxpayers-need-to-know/` — removal of the 5-year validity period on receipts/invoices effective 16 July 2022; PTU validity | 🟡 Professional advisory, published 2022-07-27 | ✅ 2026-10-03 |
| L-12 | `fiscal-requirements.com/news/5916-philippines-software-compliance` — citing **RR No. 7-2024**, 5-year retention of books and accounting records; CAS registration under RMC 5-2021; non-resettable grand totals, tamper-evident audit logs | 🟡 **Secondary summary. I did NOT retrieve RR 7-2024 itself.** Conflicts with L-13 on the period | ✅ 2026-10-03 |
| L-13 | `pinoygovguide.com/bir/books-of-accounts` — 10-year retention from last entry | 🟡 Secondary blog. ⚠️ Conflicts with L-12 | ✅ 2026-10-03 |
| L-14 | `amaron-ph.com/tips-for-buying-batteries` — warranty card + sales receipt; private vs commercial periods; core-return compensation; cranking >9.8 V, alternator 13.8–14.5 V | ✅ Brand, first-party Philippines — **corroborates Art. 68(b)(4)** | ✅ 2026-10-03 |
| L-15 | `michelin.com.ph/michelin-ph-warranty` — Product Warranty Policy effective 1 Jan 2026: **6 years from date of purchase, subject to valid proof of purchase**; claim only **within 10 years from manufacture** | ✅ Brand, first-party Philippines — **sets the Art. 68(b)(5) retention floor at 6 years for tyres** | ✅ 2026-10-03 |
| L-16 | `docs/research/legal-compliance-ph.md` (this project, prior agent, 2026-10-02) — the 16-element receipt list; the mechanic-licensing reality; the NPC obligations; DTI business-name registration | First-party, pre-existing in this repo | ✅ 2026-10-02 |

### What I could not verify, and did not fake

1. **RA 4136 (Land Transportation and Traffic Code)** — targeted for tyre
   provisions, **could not be retrieved** (`transport.gov.ph` — transport error).
   **No Philippine statutory claim about tyres is asserted anywhere in this
   document.**
2. **RA 7394's IRR** — not retrieved. Section-level obligations are cited from
   the statute itself; anything depending on the IRR is not asserted.
3. **RR 7-2024** — cited only through a secondary summary. The retention-period
   conflict with L-13 is **not resolved** and is not papered over.
4. **The exact documentary-stamp treatment of a service invoice** — not
   researched. `docs/research/legal-compliance-ph.md` §5 also flags it as open.
5. **RA 7394 Art. 77's full list of minimum labeling particulars** — I confirmed
   the article exists and requires label information; I did not transcribe every
   sub-item. Checklist item 15 says so explicitly.
6. **Any Philippine rule requiring a tyre dealer to keep stock or to hold goods for
   a customer.** No such rule located. The *negative* finding is stated as a
   negative finding, and the Art. 50 exposure is stated as the real constraint.

---

## 8. The one-paragraph version for the owner

Three things in Philippine law that I did not expect and that change the job.
First, **Article 71 of the Consumer Act says a service shop "shall guarantee
workmanship and replacement of spare parts for a period not less than ninety days
which shall be indicated in the pertinent invoices"** — that is a legal floor, not
an optional policy, so your invoice has to say it and the website's "no warranty
guarantee" setting is not a choice you can make. Second, **Article 68 says you
must keep a record of every warranty-covered purchase for as long as that
product's warranty lasts** — and Michelin tyres carry six years — so the system
we are building is not a convenience, it is the record the law assumes you have.
Third, **Article 81 makes it unlawful to offer anything for retail sale without a
displayed price and to sell above it**, which means the number on the shelf tag
and the number on the website are the same legal claim, and a second conviction
for a price-tag offence can cost you your business permit. None of this is
punishment; it is the reason the bookkeeping has to be right, and it turns out
that is exactly what this build is for.
