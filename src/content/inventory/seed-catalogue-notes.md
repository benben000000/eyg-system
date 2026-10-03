# SEED CATALOGUE NOTES — guidance for A2 / A3

> **Owner:** A6 · marketing & merchandising · **For:** whoever writes the inventory seed
> **Status:** guidance, not code. A6 owns this file; A2 owns the inventory engine, A3 owns
> the operator UI, and `prisma/seed.ts` is not mine to write.
> **Companion docs:** `../../../docs/inventory-marketing/DO-DONT.md` ·
> `../../../docs/inventory-marketing/TYRE-CLEARANCE-PLAYBOOK.md` ·
> `../../../docs/inventory-marketing/CUSTOMER-BROWSING-UX.md` ·
> `../../../src/lib/inventory-types.ts` (the contract)

---

## 0. What this file is for

The seed creates the rows that **every campaign, every availability badge and every price on
the public site reads from.** That makes it the highest-leverage file in the build and the
one with the worst failure mode: **a placeholder that ships looking real.**

A wrong `sellPrice` is a wrong price on a shop's website. A wrong `dotCode` is a
misrepresentation a customer can photograph. A fabricated `costPrice` produces a margin
report that is fiction, and every clearance price derived from it is fiction too.

So: the rules below are mostly about **what you may not invent**, and one of them — the DOT
code — is absolute.

---

## 1. The eight rules

| # | Rule | Enforcement |
| --- | --- | --- |
| 1 | 🚫 **Never invent a `dotCode`.** It is a fact about a physical object. | `null` until read off the sidewall. |
| 2 | 🚫 **Never seed fake stock.** `OPENING` takes a **counted** quantity or it does not run. | `kind: "OPENING"` fails if the product already has stock. |
| 3 | ⚠️ **`costPrice: 0` means unknown.** Never derive a price, a margin or a campaign from it. | The schema says so. Respect it. |
| 4 | 🚫 **Never seed a placeholder product that renders as if it were real stock.** | `isActive: false` on anything not yet counted. |
| 5 | 🚫 **Never seed `Reservation`, `StockCount` or any movement other than `OPENING`.** | See §6. |
| 6 | **Every product must be countable.** `cycleCountDays > 0` or an explicit `0 = never`. | |
| 7 | **Every product needs a real `reorderPoint`, or an explicit "we do not stock this regularly" decision.** | Drives Gate 1 of every campaign. |
| 8 | **Size strings are canonical and normalised.** | Drives the finder. §5. |

---

## 2. `dotCode` — the absolute rule

### 2.1 Why

`Product.dotCode` is the only field in the entire schema that **ages a product**, and it is
the input to the clearance campaign, the disclosed-clearance badge on a public page, and the
`ageDays` on `ProductAvailabilityDto`.

There is no way to look up "what DOT code a Michelin Primacy 4 in size 205/55R16 usually
has." It is stamped on one tyre. Not on the model. Not on the size. **On that tyre.**

### 2.2 The rules

| ✅ | 🚫 |
| --- | --- |
| `dotCode: null` until a person reads the sidewall | 🚫 A plausible-looking `2418` typed from nowhere |
| Read it during the stock take, per unit | 🚫 A single DOT for a stack of eight tyres |
| `dotCode` on tyres only | 🚫 `dotCode` on oil, filters, brake pads, batteries |
| A note saying the count is still to be done | 🚫 Deriving a plausible week from an invoice date |

### 2.3 Why a single DOT per stack is still wrong

`Product.dotCode` is one field on one `Product` row, and a `StockLevel` row is one number.
The honest model is: **when a batch of a size has mixed production weeks, seed the batch
that is going on clearance first**, and record the spread in `notes`.

```
notes: "DOT spread across rack: 2319 x2, 2412 x4, 2418 x2.
        dotCode set to the oldest batch pending per-unit split.
        Per-unit DOT capture required before any clearance campaign runs."
```

**And the consequence, which A2 must enforce:** the clearance selector filters on
`ageDays >= 730`. **A `dotCode` of `null` means no band, so no campaign.** There is no
"assume fresh" path. That is deliberate — an unmeasured tyre is not a fresh tyre.

### 2.4 `shelfLifeDays` — a different field, a different job

`schema.prisma`: *"Shelf life in days from receipt. Oil and coolant expire; **tyres do
not**."*

| Product kind | `shelfLifeDays` | `dotCode` |
| --- | --- | --- |
| `TYRE` | **`null`** | Set, once counted |
| `OIL` | **Set** ⚠️ owner figure | `null` |
| Brake fluid, coolant, additives (`CONSUMABLE`) | **Set** ⚠️ owner figure | `null` |
| `FILTER` | `null` — rubber and metal do not spoil in a sealed box on a rack | `null` |
| `BATTERY` | ⚠️ **Set from the manufacturer's date** — batteries do age in storage | `null` |
| `WIPER` | ⚠️ **Set** — rubber ages out of a shelf | `null` |
| `BRAKE` pads/discs | ⚠️ **Set on pads** (rubber compound ages); discs, `null` | `null` |
| `TOOL`, `OTHER` | `null` | `null` |

🚫 **Never set `shelfLifeDays` on a tyre.** A tyre with a shelf life enters the 30-day
`isNearExpiry` window on `ProductAvailabilityDto` and gets treated as an expiring
consumable, which it is not.

⚠️ **Every `shelfLifeDays` value is `SUGGESTED — REQUIRES OWNER CONFIRMATION`.** No oil or
battery shelf life has been verified for any brand the shop actually stocks.

---

## 3. `costPrice: 0` means unknown — and it has consequences

`schema.prisma` on `Product.marginPct`: *"Derived at read time; stored for reporting.
**`costPrice 0 = unknown`**."*

That comment is a contract. Honour it:

| Situation | Rule |
| --- | --- |
| Cost known | `costPrice: <real>` and `marginPct` may be stored |
| Cost unknown | `costPrice: 0`, `marginPct: null`, and **`notes` starts with `TODO-VERIFY cost`** |
| `marginPct > 100` or absurd | 🔴 **A bug.** Margin is `(sell − cost) ÷ sell`. Report it, do not clamp it. |

### 3.1 🔴 Gate 1 — the clearance calculator must refuse to price an unknown-cost product

This is not a UI nicety. `TYRE-CLEARANCE-PLAYBOOK.md` §4.2:

```
if costPrice <= 0  →  REFUSE TO PRICE.  Escalate to the owner.
```

**A margin computed from an unknown cost is a fiction**, and every campaign price derived
from it is a fiction that reaches a public page. The seed should therefore **not** seed
`costPrice: 0` for anything the shop intends to sell publicly — it should seed the real
figure from the actual supplier invoice, or the product stays `isActive: false`.

---

## 4. Field conventions per product kind

### 4.1 `TYRE`

| Field | Rule |
| --- | --- |
| `size` | **Canonical, exactly as it will be searched.** `205/55R16`. See §5. |
| `aspectRatio` | `55` for `205/55R16` — **the digits after the slash, as a number** |
| `rimSizeIn` | `16` — the number after `R` |
| `loadIndex` | `"95"`, stored as a **string**. Two digits. It is not a number you do maths on. |
| `speedRating` | `"V"` — a single letter. Stored as a string. |
| `pattern` | `"Primacy 4"` — the family name, so a mechanic can search it |
| `dotCode` | See §2. **`null` until counted.** |
| `brand` | **Only a brand the shop actually stocks.** See §4.5. |
| `unit` | **`PAIR`** for anything the shop fits as a pair. 🔴 This drives the `available >= 2` availability rule — see §4.6. |
| `shelfLifeDays` | **`null`** |
| `reorderPoint` | ⚠️ **The single most important field on a tyre row.** It is the campaign exclusion gate. |

### 4.2 `OIL`

| Field | Rule |
| --- | --- |
| `unit` | **`LITRE`**, never `EA` |
| `shelfLifeDays` | ⚠️ Set, owner figure |
| `name` | **Grade + volume.** `"PETRONAS 0W-20 — 1 L"` is unambiguous on a shelf label. A name that does not distinguish two grades is a name that gets mis-poured. |
| `barcode` | Only if the shop actually has a scanner |
| 🚫 | Never seed a 4L or a case as `EA`. The `UNITS` enum is `EA PAIR SET LITRE KG M` and **`LITRE` is the right one.** A 4L bottle is 4 `LITRE` of stock, not 1. |

### 4.3 `FILTER`, `BRAKE`, `SUSPENSION`

| Field | Rule |
| --- | --- |
| `unit` | `EA` for a single filter. **`SET`** for anything the shop sells as a set — the contract's own example is *"a set of 5"*. |
| `name` | **Part number first.** A mechanic reads a rack label in two seconds. `"Oil Filter — Honda Civic 1.5 / Fit"` beats `"Premium filtration cartridge"` |
| `size` | 🚫 **Not a tyre size.** Leave it null. It is indexed and searched by the mechanic. |
| 🚫 | Never seed two rows for the same part number at two prices. One `Product`, one price. |

### 4.4 `BATTERY`

| Field | Rule |
| --- | --- |
| `shelfLifeDays` | ⚠️ **Set — from the manufacturer's storage guidance, per brand.** Not a guess. |
| 🚫 | `dotCode` on a battery. `schema.prisma` documents `dotCode` as the **tyre** production week. Using it for a battery is a misuse of the field and it will confuse the age calculation. |
| `name` | Brand + group + the model. `"Amaron Jade AGM — Group N91 / 70Ah"` |

### 4.5 `brand` — the evidenced list only

`competitors.md` §5.3 and §6.3, verified from the brand locators and the shop's own posts:

| ✅ May be printed | 🚫 May never be printed |
| --- | --- |
| **Michelin** `[CONFIRMED]` — `michelin.com.ph` dealer locator | Bridgestone |
| **BFGoodrich** `[CONFIRMED]` — `bfgoodrich.com.ph` dealer locator | Goodyear |
| PETRONAS | Dunlop |
| Amaron | Maxxis |
| Radar | Yokohama |
| Blacklion | |
| Deestone | |

And the wording, which is separate from the list:

> 🚫 **"Authorised dealer" / "Official dealer" / "Distributor"** — the evidenced status is a
> **dealer-locator listing**, which is a dealer record, **not** franchise authorisation,
> exclusivity, or an OEM warranty. `competitors.md` §6 item 3.

### 4.6 `unit` drives public availability — this is not cosmetic

From `CUSTOMER-BROWSING-UX.md` §3.2:

| `unit` | "In stock" means |
| --- | --- |
| `PAIR` | 🔴 **`available >= 2`.** A pair is a pair. |
| `SET` | `available >= 1` — a set of 5 is one shelf unit |
| `LITRE`, `KG`, `M` | `available >= 1` **and** above the decanted figure ⚠️ owner |
| `EA` | `available >= 1` |

🚫 **Do not seed a tyre as `unit: "EA"`.** A seed of `"EA"` makes a single tyre render as
"In the bay now", and then the shop cannot fit a pair. This is a **correctness bug that
reaches a customer**, not a style choice. **`PAIR` or nothing.**

---

## 5. Size normalisation — the finder's data contract

`CUSTOMER-BROWSING-UX.md` §5.4 recommends a plain size-input finder. **The finder's
correctness depends entirely on this seed convention**, so it belongs here and not in a
frontend doc.

### 5.1 Canonical form

```
205/55R16      ← width / aspectRatio R rimSizeIn
```

| Element | Form | Example |
| --- | --- | --- |
| Width | 3 digits, mm, no unit | `205` |
| Separator | `/` | |
| Aspect ratio | 2 digits, **no `%`** | `55` |
| Rim marker | uppercase `R` | |
| Rim diameter | 2 digits, inches | `16` |

### 5.2 What the normaliser must accept

| Input | Normalises to |
| --- | --- |
| `205/55R16` | `205/55R16` |
| `205/55-16` | `205/55R16` |
| `205/55 R16` | `205/55R16` |
| `205 55 R 16` | `205/55R16` |
| `20555R16` | `205/55R16` |
| `205/55r16` | `205/55R16` |
| `205/55R16 95V` | `205/55R16` |
| `205/55R16M+S` | `205/55R16` |

🚫 **Never string-compare raw input against `Product.size`.** Strip, lowercase, remove
separators, re-join, compare. Six spellings of one tyre is the normal case, not the edge
case — customers read the sidewall, mechanics read the invoice, and the shop's own Facebook
posts have written `265/65R17`, `11R22.5` and `185/65-14` in three different styles.

### 5.3 The commercial size trap

`185/65-14`, `11R22.5` and `11R22.5` are **commercial / light-truck constructions** with a
different sidewall structure. They are not a formatting variant of a passenger tyre.

🚫 **Do not normalise a commercial size into a passenger pattern.** If the shop genuinely
stocks `11R22.5` Blacklion — which `competitors.md` §1.4 evidences from its own posts — it
gets its own `Product` row, its own `Product.kind` treatment, and its own copy. **A wrong
size is the one failure this site cannot have.** `legal-compliance-ph.md` §4.4.

---

## 6. Stock seeding

### 6.1 The one legal movement to seed

```ts
kind: "OPENING",      // sets the baseline
qty: <COUNTED>,       // 🚫 not the expected number, not an estimate, not a guess
reason: "STOCK TAKE <date> — counted by <name>",
reference: "COUNT-<date>-<n>",
```

`schema.prisma` / `inventory-types.ts`: *"`OPENING` → sets the baseline (**fails if the
product already has stock**)."*

| ✅ | 🚫 |
| --- | --- |
| The quantity a person physically counted | 🚫 `qty: reorderQty` |
| A real, human-readable reason | 🚫 `qty: 10` because "ten sounds right" |
| A real actor name | 🚫 `actorId: null` on a human-initiated opening |
| One `OPENING` per product | 🚫 A second `OPENING` for the same product — it will be **refused**, correctly |

### 6.2 `OPENING` for a product with no stock

If the shop does not hold it: **seed the `Product` with a `StockLevel` of 0 and no movement
at all**, and set `isActive` deliberately:

| Situation | `isActive` |
| --- | --- |
| Stocked and counted | `true` |
| Stocked but **not yet counted**, or `costPrice: 0` | **`false`** — 🔴 so it cannot render as if it were real |
| A size the shop can order but does not hold | `false`, and a pre-order, not an `OPENING` |

### 6.3 Never seed these

| Object | Why |
| --- | --- |
| `Reservation` | 🚫 A held reservation at seed time is a permanent phantom hold on real stock. `available` is wrong from minute one. |
| `StockMovement` other than `OPENING` | The ledger is a record of what happened. A seed did not happen. |
| `StockCount` / `StockCountLine` | A count with `expected` values written by hand is a fabricated variance baseline. |
| `ServicePartRequirement` qty that is a guess | ⚠️ See §7. A wrong BOM makes `canFulfil` lie, and `canFulfil` is the promise. |

---

## 7. `ServicePartRequirement` — where a guess becomes a promise

This is the highest-consequence table in the seed, because it drives
`ServiceAvailabilityDto.canFulfil`, and **A4's rule is that a booking is only promised when
`canFulfil` is true.**

| Field | Rule |
| --- | --- |
| `qtyPerService` | 🚫 **Do not guess.** One oil filter per PMS = `1`. That is knowable. Anything else is measured, not assumed. |
| `isBlocking` | ⚠️ Owner decision, per part. The schema's own guidance: *"True for safety-critical items (brake pads), false for nice-to-haves."* |
| `productId` | Must point at a real, counted `Product` |

### 7.1 The one rule that protects the customer

> 🚫 **Never mark a part `isBlocking: true` merely to be safe.** A blocking part the shop
> does not reliably stock turns every booking into a shortfall, and a shortfall that is
> surfaced to a customer as "we may need to order this in" for a non-safety item is a worse
> experience than just selling the job.

And the mirror rule:

> 🚫 **Never mark a safety-critical part `isBlocking: false`.** A customer whose brake pads
> are not available is a customer who needs a bus home. That is not a nice-to-have.

### 7.2 ⚠️ Every BOM line is `SUGGESTED — REQUIRES OWNER CONFIRMATION`

`PROMO-PLAYBOOK.md` §11 item 3, and the same rule here. **A wrong BOM is not a data problem.
It is a broken promise on the booking page.**

---

## 8. `reorderPoint` and `reorderQty` — the two numbers that gate everything

Every campaign in `STOCK-CAMPAIGNS.md` refuses to run on a product where `isLow === true`,
and `isLow` is *defined* as `available <= reorderPoint`.

**A wrong `reorderPoint` therefore does not just mis-order stock — it silently switches
campaigns on and off.**

| Field | Rule |
| --- | --- |
| `reorderPoint` | ⚠️ **Set from real sales.** From the `CONSUME` movements once three months exist. Until then, a placeholder — and the placeholder is honest about being one. |
| `reorderQty` | ⚠️ **Set from the supplier's minimum order quantity and lead time**, not from a round number. |
| `reorderPoint: 0` | 🚫 **Meaningless and dangerous** — `isLow` would then be true whenever stock hits 0, i.e. only after a stockout. It is better than nothing, but it is not a reorder point. |

### 8.1 The seasonal override

`SEASONAL-PLAN.md` §3.1: for `kind === "WIPER"` and the undercoating `CONSUMABLE`s,
`reorderPoint` must cover the **whole rainy season**, not the gap between deliveries —
because the demand arrives with the rain and a reorder takes days.

⚠️ **Who changes it, and when, is an owner decision.** A stock floor that moves twice a year
is an operating rule, not a config value. Flag it in the owner-confirmation register; do not
hardcode a seasonal multiplier anywhere.

---

## 9. `notes` — the field most likely to leak the business

`ProductDto.notes` is `string | null` and is **not** on any public allow-list
(`CUSTOMER-BROWSING-UX.md` §2.1: 🚫).

Write notes as if they will be read by someone who is not friendly:

```
✅ "DOT 2418. Older than 24 months — clearance band C. Checked 2026-10-04."
✅ "Oil: 4 L per PMS on this model. Owner to confirm."
✅ "DOT spread across rack: 2319 x2, 2412 x4. Per-unit capture required."
✅ "TODO-VERIFY cost — invoice pending from distributor."
🚫 "Good margin — push this one."
🚫 "Customer always asks about this one, price firm."
🚫 "Margin 34%."
```

**The first four are operational. The last three are a business document in a field with no
access control at the API layer.**

---

## 10. Naming — what the mechanic reads in two seconds

The SKU and the name both end up on a shelf label and get shouted across a bay. Write for
that person.

| Kind | Pattern | Example |
| --- | --- | --- |
| Tyre | `<BRAND> <PATTERN> <SIZE>` | `"Michelin Primacy 4 205/55R16"` |
| Oil | `<BRAND> <GRADE> — <VOLUME>` | `"PETRONAS 0W-20 — 1 L"` |
| Filter | `<PART NO> — <APPLICATION>` | `"90915-YZZD1 — Honda Civic / Fit"` |
| Brake pad | `<BRAND> <APPLICATION> <POSITION>` | `"Amaron Brake Pad — Civic 2019+ Front"` |

- **The size or the part number goes in the name.** Not the marketing adjective.
- 🚫 **No adjectives in a product name.** `"Premium", "Genuine", "Original", "High-Quality"`
  — `competitors.md` §6 item 1 makes the "genuine only" claim unfalsifiable and a
  bait-and-switch accusation waiting to happen. **Say the brand and the model you fitted.**
- 🚫 **No emoji in a product name.** It gets read aloud.
- ⚠️ **SKU convention is a proposal for the owner to accept or replace** — it is a decision
  they have to live with forever, and it is theirs. A reasonable starting shape:
  `TY-20555R16-MI-PRIM4` · `OL-PET-0W20-1L` · `FL-90915`. **Monospace, uppercase, short
  enough to read over the phone.**

---

## 11. The pre-seed gate

Run this before the seed executes. Every unchecked box is a reason to not run it.

```
PRODUCTS
[ ] Every row has a real, human-readable name. No adjectives, no emoji.
[ ] Every TYRE has unit === "PAIR". (Never "EA".)
[ ] Every OIL has unit === "LITRE".
[ ] Every size is in canonical form: 205/55R16.
[ ] Every aspectRatio / rimSizeIn matches its size string.
[ ] Every brand is on the evidenced list only.
[ ] No commercial size is folded into a passenger pattern.

MONEY
[ ] costPrice is a real figure, or 0 with notes starting "TODO-VERIFY cost".
[ ] marginPct is null wherever costPrice is 0.
[ ] Every sellPrice is flagged SUGGESTED — REQUIRES OWNER CONFIRMATION until the
    owner signs. (promotions.ts convention.)
[ ] NO margin figure is > 100%. (That is a bug, not a deal.)

TYRE AGE
[ ] Every TYRE has dotCode === null OR a DOT physically read off a sidewall.
[ ] No dotCode on a non-tyre.
[ ] shelfLifeDays is null on every TYRE.
[ ] shelfLifeDays is set on oil, batteries, wipers and brake pads — owner figures.

STOCK
[ ] Every OPENING qty was counted by a person, with a real reason and an actor.
[ ] No second OPENING for the same product.
[ ] Zero rows in Reservation, StockMovement (except OPENING), StockCount.
[ ] isActive === false on anything not yet counted, or with costPrice === 0.

REPLENISHMENT
[ ] Every product has a real reorderPoint, or an explicit documented decision not to.
[ ] reorderQty reflects the supplier's MOQ, not a round number.

BOM
[ ] Every ServicePartRequirement.qtyPerService is measured or owner-confirmed.
[ ] isBlocking is set per part, with safety-critical parts true.
[ ] No BOM line points at a non-active product.

PUBLICATION
[ ] Nothing with isActive === true can reach a public surface while it still
    carries an unconfirmed sellPrice.
[ ] "Stock checked [time]" is rendered from StockLevel.updatedAt — the seed must
    therefore not fake updatedAt.
```

---

## 12. Owner-confirmation register

| # | Item | Status |
| --- | --- | --- |
| 1 | Every `costPrice` | 🚫 **TODO-VERIFY** — real supplier invoices. Blocks every campaign's Gate 1. |
| 2 | Every `sellPrice` | 🚫 **TODO-VERIFY** — nothing publishes until signed |
| 3 | Every `dotCode` | 🚫 **TODO-VERIFY** — read off physical tyres during the stock take |
| 4 | Every `shelfLifeDays` (oil, battery, wiper, brake pad) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 5 | Every `reorderPoint` / `reorderQty` | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 6 | Every `cycleCountDays` | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 7 | The SKU convention | ⚠️ **PROPOSED** — the owner's call |
| 8 | Every `ServicePartRequirement.qtyPerService` | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 9 | Every `ServicePartRequirement.isBlocking` | ⚠️ **OWNER DECISION** — safety-critical parts must be `true` |
| 10 | The evidenced brand list printed on a public surface | ⚠️ Michelin + BFGoodrich `[CONFIRMED]`; PETRONAS / Amaron / Radar / Blacklion / Deestone from the shop's own posts — **owner confirms** |
| 11 | Oil decant quantity per SKU (drives `LITRE` availability) | 🚫 **TODO-VERIFY** |
| 12 | Item selection — which ~40 SKUs | ⚠️ **From A1's catalogue in `docs/inventory-research/`.** Do not invent items. If that file is not present at seed time, **do not seed** — a shop's catalogue is its own. |

---

## 13. Related

`DO-DONT.md` · `TYRE-CLEARANCE-PLAYBOOK.md` (§1 the DOT algorithm, §4 the cost floor) ·
`CUSTOMER-BROWSING-UX.md` (§2 the public field allow-list, §5 the finder) ·
`STOCK-CAMPAIGNS.md` (Gate 1 and Gate 2) · `SEASONAL-PLAN.md` §3.1 (seasonal reorder
floor) · `PREORDER-FLOW.md` §1 (what a pre-order must never seed) ·
`../../../docs/inventory-research/` (A1's SKU catalogue — the source for item selection) ·
`../../../src/lib/inventory-types.ts` · `prisma/schema.prisma`
