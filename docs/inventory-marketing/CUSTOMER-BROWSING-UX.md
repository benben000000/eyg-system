# CUSTOMER BROWSING UX — should a customer see the catalogue?

> **Owner:** A6 · marketing & merchandising · **Status:** ready for owner sign-off
> **Applies to:** any public surface that reads `Product` or `StockLevel`
> **Companion docs:** `STOCK-CAMPAIGNS.md` · `PREORDER-FLOW.md` · `DO-DONT.md` ·
> `../../src/lib/inventory-types.ts` (the contract this must not leak)

---

## 0. The recommendation, up front

> ### ✅ **Yes — publish a tyre and fitting catalogue. No — publish a live parts catalogue
>
> with stock numbers.**
>
> **Publish:** size, brand, pattern, honest price, and a **three-state** availability
> indicator for **tyres only**.
>
> **Do not publish:** anything about oil, filters, brake parts, batteries, wiper blades or
> consumables **as stock**. Publish those as a **catalogue with prices** and route every
> enquiry to the phone.

Then §5: **yes, build the tyre-size finder — as "enter the size, see if we have it", not as
a vehicle selector.**

---

## 1. Why a catalogue at all

The competitive research is unusually clear about this, and it settles the question before
anyone argues about UI.

| What a customer needs before driving to a shop | Jed-M | CMC | New Ancor | Tiremarks | EYG **with this** |
| --- | --- | --- | --- | --- | --- |
| Phone number that works | ✅ | ✅ | ✅ | ✅ | ✅ |
| Street address | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Opening hours** | ❌ | ❌ | ❌ | ❌ | ✅ |
| Service list | ❌ | ❌ | ❌ | ✅ (FB) | ✅ |
| **Prices / price ranges** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Book online** | ❌ | ❌ | ❌ | ❌ | ✅ |
| A website | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Tyre size lookup** | ❌ | ❌ | ❌ | ❌ | ✅ |

*(Source: `../research/competitors.md` §3 — five local listings read in full against the
official Balanga City business directory, which publishes 138 automotive businesses.)*

> **Zero of five local competitors publish a price. Zero publish hours. Zero let you book
> online.** That absence is the entire opportunity, and a catalogue is the natural place to
> answer the one question a tyre customer actually has before leaving the house:

> ### *"Is my size there, and what is the total going to cost me?"*

### 1.1 But the catalogue is a *price* surface, and a price is a representation

`../research/legal-compliance-ph.md` §4.3 — three non-negotiables on any published price:

1. **A range must be a range, and the low end must be genuinely payable.** Publishing
   `from ₱1,200` and then quoting ₱1,950 for a "basic" PMS is bait-and-switch.
2. **A range needs a stated condition.** *"₱1,200–₱2,500 depending on oil type and
   vehicle"* is honest. A bare range invites the argument about which end applies.
3. **Every estimate is confirmed in writing before work starts, and the customer signs the
   job order.**

⚠️ **Therefore: every peso figure in a public catalogue is `SUGGESTED — REQUIRES OWNER
CONFIRMATION` until the owner signs it off. Not published before.**

### 1.2 The trap the tyre industry sets, and how the catalogue defuses it

`../research/legal-compliance-ph.md` §4.4 calls bait-and-switch *"the industry's defining
failure mode"* and *"the reason tyre advertising is distrusted"*. The shape: advertise a
tyre at price X, then discover balancing, alignment, a valve and a repair until the real
cost is 3× X.

**The catalogue's answer is to show the complete installed price in one number** — tyre +
mounting + balancing + valve. That is:

- required by the research document,
- removes the accusation entirely (there is no "extra" to be upset about),
- and is **genuinely differentiating**, because nobody local publishes anything to compare
  it against.

---

## 2. What may be shown publicly — the field-by-field table

Read straight from `src/lib/inventory-types.ts`. **Anything not marked ✅ or ⚠️ must be
stripped at the server before the payload leaves.** Not in the component. **At the server.**

### 2.1 `ProductDto`

| Field | Public? | Notes |
| --- | --- | --- |
| `size` | ✅ | The whole reason the catalogue exists |
| `brand` | ✅ | **Only brands the shop actually stocks.** ⚠️ `BUSINESS.tireBrands` is `["Michelin", "BFGoodrich"]`, `[CONFIRMED]` via dealer locators. Radar, Blacklion and Deestone appear in the shop's own posts. 🚫 **Not** Bridgestone, Goodyear, Dunlop, Maxxis, Yokohama — no evidence (`competitors.md` §6). |
| `pattern` | ✅ | *"Primacy 4"*. It is how the customer recognises the tyre |
| `aspectRatio`, `rimSizeIn` | ✅ | Derived from `size`; useful for the finder's explanation copy |
| `loadIndex`, `speedRating` | ✅ | **Only if the shop fits them.** A published load index is a suitability claim |
| `name`, `kind`, `unit` | ✅ | `unit` is only surfaced where it is customer-meaningful — *"per litre"*, *"per pair"* |
| `sellPrice` | ✅ **as a range** | Per §1.1. **Never** `sellPrice` alone as a single figure for something whose price varies |
| `isActive` | ⚠️ indirectly | Drives visibility; never displayed |
| `id` | ⚠️ | Needed to address the record. Opaque. Never a readable SKU |
| `sku` | 🚫 | Internal. Also the thing the mechanic shouts across the bay |
| `barcode` | 🚫 | Scannable, and reveals internal structure |
| `costPrice` | 🚫🚫 | **`legal-compliance-ph.md` §4.2. Never reaches a customer surface. Server-filtered.** |
| `marginPct` | 🚫🚫 | Same. And it is *derived from* `costPrice` — filtering only `marginPct` leaks the cost by division |
| `supplierId`, `supplierName` | 🚫 | **Publishing the distributor tells the customer to go direct.** That is a commercial decision, and it is not one to make from a component |
| `reorderPoint`, `reorderQty` | 🚫 | Internal buffer. Also a free map of the shop's weaknesses for a competitor |
| `shelfLifeDays`, `cycleCountDays` | 🚫 | Internal |
| `dotCode` | ⚠️ **conditional** | 🚫 Never on a normal item. ✅ **On a disclosed clearance item only** — the year, in plain words. See §4 |
| `notes` | 🚫 | Internal free text. **Highest leak risk in the whole model.** A note saying *"good margin, push this"* is a business document |
| `createdAt`, `updatedAt` | 🚫 | Noise, and `updatedAt` leaks operational cadence |
| `isOversold` | 🚫🚫 | Should never be true. If it is, it is a loud internal alarm, not a customer state |

### 2.2 `StockLevelDto` — the dangerous one

| Field | Public? | Notes |
| --- | --- | --- |
| — | ✅ **as a derived 3-state**, never as raw numbers | §3 |
| `onHand` | 🚫 | 🔴 **The single most dangerous field in the model.** `onHand` includes `reserved` — stock promised to someone else |
| `reserved` | 🚫 | 🔴 **Publishing `reserved` would expose a customer's booking to the public.** Combined with `onHand` it is also a direct `available` disclosure |
| `available` | ⚠️ **derived state only** | The number itself stays server-side; a boolean or enum leaves |
| `isLow` | 🚫🚫 | Internal replenishment. See `STOCK-CAMPAIGNS.md` §1.2 — publishing it is exactly how fake urgency gets born |
| `isOversold` | 🚫🚫 | Never |

### 2.3 `ProductAvailabilityDto`

| Field | Public? | Notes |
| --- | --- | --- |
| `canPromise` | ⚠️ internal | Drives the booking flow, not the catalogue |
| `ageDays` | ⚠️ conditional | ✅ On a disclosed clearance line. 🚫 Otherwise |
| `isNearExpiry` | ⚠️ conditional | ✅ For a genuinely expiring consumable, as *"last few bottles"*. 🚫 Never as urgency |
| `reorderPoint` | 🚫 | Same as `ProductDto.reorderPoint` |

### 2.4 The three never-fields, restated because they are the ones that will be asked for

| Field | Why someone will ask for it | The answer |
| --- | --- | --- |
| `costPrice` | "Let customers see the margin to justify the price" | That argument is exactly backwards. **Publishing your cost tells the customer your price is 25% over — and tells your competitor the same thing.** `legal-compliance-ph.md` §4.2 treats a leaked `costPrice` as the #1 cost-leak risk. A8 is going to test for this. |
| `supplierName` | "Show we are a real dealer" | The evidenced claim is a **dealer-locator listing** for Michelin and BFGoodrich — a dealer record, **not** franchise authorisation (`competitors.md` §5.3, §6 item 3). The supplier field proves nothing to a customer and tells a competitor who to call. |
| `onHand` / `reserved` / `isLow` | "Urgency makes people act" | Every one of these is a fact about *the shop*, presented as a fact about *the market*. It is the countdown, in a different costume. |

---

## 3. Presenting availability — a promise the shop can keep

### 3.1 Three states, no numbers

> **Show a state. Never a count.**

A count is true for an instant and lives on a page for a week. "3 left" becomes "0 left"
on Tuesday and the post is a lie by Wednesday. *"While the rack lasts"* is true for as long
as the page is up, because the page goes away when the rack is empty.

### 3.2 The three states, and the exact field condition for each

**Availability is computed in the product's own unit.** `UNITS` in the contract is
`EA | PAIR | SET | LITRE | KG | M`. This matters enormously and is the most commonly
missed detail in a catalogue build:

| `unit` | What "in stock" must mean |
| --- | --- |
| `PAIR` | 🔴 **`available >= 2`.** A pair is a pair. `available === 1` on a `PAIR` line is not a pair, and calling it "in stock" is a promise the shop cannot keep at the fitting |
| `EA` | `available >= 1` |
| `SET` | `available >= 1` set (a "set of 5" is one shelf unit) |
| `LITRE`, `KG`, `M` | `available >= 1` **and** above the decanted quantity. ⚠️ **TODO-VERIFY the decant figure per SKU** |

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION:** the `PAIR >= 2` rule. It is the right
answer — you cannot fit one tyre to both sides of a car — but it means a PAIR line drops
out of "in stock" at `available === 1`, which the owner should see and agree to before the
catalogue ships.

### 3.3 The state table — copy included

| State | Condition (tyre, `unit === "PAIR"`) | Customer-facing line | Tone |
| --- | --- | --- | --- |
| **READY TO FIT** | `isLow === false` **and** `available >= 2` | **"In the bay now. Book a slot."** | Confident. This is the strongest promise a tyre shop can make and it is a *fact*. |
| **ON ORDER** | `available === 0`, supplier confirmed | **"Not in the rack right now. We order it in — usually [lead time]. Message us and we'll give you the date."** → `PREORDER-FLOW.md` | Plain. No apology, no alarm. |
| **ASK US** | `available >= 1` but `< 2` on a `PAIR`, **or** `isLow === true` and `available > 0` | **"Call us first — we might have one, but we don't want you driving over for nothing."** → phone | Honest. Routes to the channel with a 100% answer rate. |
| **NOT LISTED** | no matching `size` | **"We don't hold that size. Message us — we'll tell you straight if we can get it."** | Direct. Also a lead. |

### 3.4 The freshness line — mandatory on any availability surface

> **"Stock checked [date], [time]."**

Reason: the shop's own counting cadence is `ProductDto.cycleCountDays`. If that is 30 days,
then "in stock" is at best 30 days old, and the page must say so. `StockLevelDto.updatedAt`
exists — expose **that** timestamp, not a made-up "live" claim.

🚫 **Never render the word "live" about availability.** It is not live. It is the last
reconciled value plus the live `available` arithmetic. "As of 9:14 am" is true; "live" is a
promise.

### 3.5 The rule that closes the loophole

> **Every availability surface must be re-evaluated at the moment of the interaction, not
> at page load.**

- The catalogue page shows the 3-state from the server.
- **The `/book` step re-checks `ServiceAvailabilityDto.canFulfil` before it says the word
  "booked".** That is A4's rule, and the marketing surface inherits it.
- **The counter always confirms by phone or in person before the customer drives over.**

And the last line, the one that matters:

> 🚫 **A catalogue may never say "we have your size in stock" unless it also names the
> shop, its hours and its phone number.**
>
> An anonymous availability claim is not a service. It is a lead form with extra steps.

---

## 4. The clearance disclosure on a public surface

From `TYRE-CLEARANCE-PLAYBOOK.md`. The rule in one line:

> **A public surface may show `dotCode` only on a product that is already in a disclosed
> clearance campaign. Anywhere else it is `null`, and the customer is told nothing.**

**On the line:**

```
Made 2023. Older stock, priced lower — not worse. We show you the DOT code before you pay.
```

**Never, anywhere:**

| ❌ | Why |
| --- | --- |
| "As good as new" / "like new" | Unverifiable comparative claim on a product with a visible date code |
| "Safe for X more years" | **That is an express warranty, created by a caption.** `site.ts` has `workmanshipGuaranteeDays: 0` on purpose. |
| "Factory seconds" | A manufacturing term this shop has no standing to apply to stock bought through a distributor |
| The raw `DOT 6X2W A1B2 C3D4` string | Nobody reads it and it looks machine-generated. **Show the year.** |
| A percentage, without the year | `10% off` alone is a sale. `Made 2023 · 10% off` is a disclosure. |

---

## 5. The tyre-size finder — build it, and build it this way

### 5.1 The recommendation

> ### ✅ **Build it. As "enter the size you can see on your tyre" — *not* as a
>
> make/model/year vehicle selector.**

**Not a rejection of the finder. A specific design of it.**

### 5.2 The traffic reasoning

| Question | Answer |
| --- | --- |
| **Is there search volume?** Yes, but it is **low-volume and very high-intent.** Someone searching "205/55R16" is at the buying stage, not browsing. They will not browse a catalogue — they will type a size and leave. |
| **Does the finder compete with anything?** No. It fills a column where Jed-M, CMC, New Ancor, Tiremarks and 133 other Balanga businesses all show ❌. |
| **Does the finder *win* against a phone call?** It wins on one thing only: it lets the customer find out **without asking a human**, which matters because `competitors.md` §5.1 says the real fear is being overcharged. A private, free, no-obligation "do you have my size and what is it" is the lowest-friction first contact available. |
| **What is the expected volume?** Low. ⚠️ **The finder is not a growth engine. It is a trust device and a cheap front door.** Do not let anyone present it as a revenue driver. |

### 5.3 Why NOT a vehicle selector — three reasons, in order of severity

**1. A wrong size is the one failure this site cannot have.**
A stale vehicle database produces a wrong size. A customer arrives with a size the finder
confidently recommended. That is a safety problem and a `legal-compliance-ph.md` §4.4
liability, and it happens more easily here than anywhere: second-hand cars, locally modified
suspension, and vehicles fitted with non-original wheels are **routine** in this market.
A database will be wrong about exactly those cars.

**2. It rots immediately and nobody maintains it.**
Make / model / year / trim / engine / variant tables are a permanent maintenance burden.
This is a two-bay shop with a person on the phone. A stale picker is worse than no picker,
because it is *confidently* wrong.

**3. The customer already knows the answer and does not need a database to find it.**
The size is moulded into the sidewall of the tyre already on the car. The job is not to
*identify* the size. The job is to **teach them to read it** — and that is already the
highest-save post in the shop's own content bank (`CONTENT-CALENDAR.md` day 1,
`dayOffset: 0`, *"how to read your tyre size"*). The content is proven. The picker is not
needed.

### 5.4 What to build instead — three components

**Component A — the sidewall explainer.** Reuse the `dayOffset: 0` carousel as the
landing content. Show a photo of a real tyre sidewall with the four digits ringed. Show the
door jamb plate. **Use a real photograph of a tyre in the rack.**

**Component B — a plain size input.**

```
205/55R16     →  READY TO FIT · 2 pairs · ₱X–₱Y fitted
205-55-16     →  same match (normalisation, below)
194/70R15C    →  ASK US
225/40R18     →  NOT LISTED · message us and we'll tell you straight
```

**The normalisation is real work and it is worth doing.** Customers and mechanics write
the same tyre six ways. Use `Product.size`, `aspectRatio` and `rimSizeIn`:

| Input | Normalise to |
| --- | --- |
| `205/55R16`, `205/55-16`, `205/55 R16`, `205 55 R 16` | `205/55R16` |
| `20555R16` (no slash) | `205/55R16` |
| `205/55R16 95V` (trailing rating) | `205/55R16` |
| lowercase `205/55r16` | `205/55R16` |

Store the canonical form in `Product.size`. Strip and rejoin; never string-compare raw
input. ⚠️ **This is an A2/A3 build task — reported, not implemented by A6.**

**Component C — the four honest outcomes**, from §3.3's state table. **A miss is a lead,
not a dead end:**

> *"We don't hold 225/40R18. Message us and we'll tell you straight if we can get it, and
> what it would cost. No pressure."*

### 5.5 What the finder must never do

| ❌ | Why |
| --- | --- |
| 🚫 **"We can order any size"** | A universal promise this shop cannot keep, and it is an express commitment about supplier capability. |
| 🚫 **Show availability for a size the shop does not stock** | There is no `Product` row, so there is no `StockLevel`, so there is nothing true to show. |
| 🚫 **Show a count of tyres available** | §3.1 |
| 🚫 **Auto-submit a customer enquiry** | The Data Privacy Act: consent must be *evidenced* (`legal-compliance-ph.md` §3). One tap = a record, not a lead. |
| 🚫 **Collect a plate** in the finder | `legal-compliance-ph.md` §2.3 — a plate is LTO-issued and treated as **sensitive personal information**. The counter collects it; the public finder does not. |
| 🚫 **Ask for an email to show a price** | The price is public information. Gating it is a form for nothing. |

---

## 6. Four states, everywhere

`docs/AGENT-BRIEF.md` — "no form that fails silently". Every catalogue surface has all four.

| State | Catalogue | Size finder |
| --- | --- | --- |
| **Loading** | Skeleton rows, not a spinner. Show the size column and the price column as grey bars — the layout should not move when data lands. | *"Checking…"* under the input. Never a full-page spinner on a 3-character input. |
| **Success** | The catalogue, or an **empty** catalogue with a real message: *"We're rebuilding the parts list. For a price on anything, call us — [number]."* | The 3-state result with price. |
| **Empty** | 🔴 **Never a blank page.** An empty catalogue is a phone number and a sentence. | *"We don't hold that size."* + the ask. Never a 404. |
| **Error** | 🔴 **Never a silent failure.** *"Couldn't load prices just now. Call us and we'll quote it."* **with the number as a tap-to-call link.** Never a bare "Something went wrong". | *"Couldn't check that one just now. Call us and we'll tell you straight."* |

**The error state matters more than the others.** This is the shop's differentiating claim —
*"we're the only shop in Balanga that tells you what it costs"* — and it fails the claim if
the price page throws a 500 and the customer sees nothing. **An error state that shows a
phone number converts better than a loading state.**

---

## 7. Accessibility — non-negotiable

WCAG 2.2 AA, per the site brief.

| Rule | Why |
| --- | --- |
| **Availability is never colour alone.** The three states each get a **word**. "In the bay now", "Not in the rack", "Call us first". A colour-only state fails 1.4.1 and fails a tyre customer in the sun on a phone. |
| **The state change is announced.** Use a polite live region so a screen reader hears "In the bay now" when the result arrives. |
| **Type-to-find, keyboard-first.** The operator UI is A3's, but the finder inherits it: `/` focuses, arrow keys navigate, Enter opens. One hand, a phone keyboard. |
| **`prefers-reduced-motion`.** No animated state transitions. The state changes. The animation does not. |
| **Prices are text, not images.** "₱8,500" is searchable, selectable, screen-readable. A rendered price graphic is not. |
| **₱ attached, no space.** `₱8,500` — always. `../brand/VOICE-AND-TONE.md` §3.1. |
| **En dash for ranges.** `₱8,500–₱9,200`. |

---

## 8. Owner-confirmation register

| # | Item | Status |
| --- | --- | --- |
| 1 | **Every `sellPrice` in the catalogue** | 🚫 **TODO-VERIFY** — nothing publishes until the owner signs |
| 2 | Whether prices publish as single figures or ranges | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 3 | The `PAIR >= 2` "in stock" rule (§3.2) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 4 | Decant quantity per oil SKU (`LITRE`) | 🚫 **TODO-VERIFY** |
| 5 | Which brands may be printed | ⚠️ `tireBrands` is `[CONFIRMED]` for Michelin + BFGoodrich; Radar / Blacklion / Deestone evidenced from the shop's own posts — **owner confirms the printed list** |
| 6 | Lead-time wording on the "ON ORDER" state | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. See `SEASONAL-PLAN.md` §4. |
| 7 | `cycleCountDays` per SKU — drives the "stock checked" timestamp | 🚫 **TODO-VERIFY** |
| 8 | Whether the finder may collect a phone number | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. **Not a plate. Ever.** |
| 9 | The sidewall photo asset | 🚫 **TODO-VERIFY** — must be a real tyre in the rack, not stock photography |
| 10 | Vehicle-selector deferral | ⚠️ **Recommendation only.** Revisit if — and only if — the owner has a maintainer. |

---

## 9. The short version, for the counter

A customer asks, *"Do you have 205/55R16?"*

| The system says | Say |
| --- | --- |
| `available >= 2`, `isLow === false` | **"Meron, boss. Two pairs. I-book mo na yung bay."** |
| `available >= 1`, `PAIR` | **"Meron yung isa lang. Confirm ko muna — baka may na-order na yung iba."** |
| `available === 0`, supplier confirmed | **"Wala sa rack ngayon. Ordering ko, sabihin ko sa 'yo yung exact date."** |
| `available === 0`, nothing confirmed | **"Wala. Titingnan ko, tatawagan ko ka."** |
| No such size | **"Hindi namin hawak yung size na 'yon. Titingnan ko kung kaya naming gawan — sabihin ko."** |

🚫 Never, for any row: *"Baka may konti pa, try mo na."*

---

## 10. Related

`STOCK-CAMPAIGNS.md` (the `isLow` exclusion, and what may be said) ·
`TYRE-CLEARANCE-PLAYBOOK.md` (the `dotCode` disclosure) · `PREORDER-FLOW.md` (the
`available === 0` reroute) · `DO-DONT.md` ·
`../../src/lib/inventory-types.ts` (the contract) · `../research/legal-compliance-ph.md`
§2.3, §4.2, §4.3, §4.4 · `../research/competitors.md` §3, §5.1, §5.3, §6
