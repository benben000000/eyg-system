# TRUST MESSAGES — the inventory's customer-facing promise

**Owner:** funnel agent (A5) · **Scope:** every stock claim that reaches a customer
**Contract:** `src/lib/inventory-types.ts` — `ServiceAvailabilityDto`, `PartAvailabilityDto`,
`ReserveResult`, `ProductAvailabilityDto`, `StockLevelDto`
**Rule:** this file contains no field that is not in the contract. Where a claim would need
a field the contract does not have, it is marked **CONTRACT GAP** and routed to the
orchestrator, not invented here.

---

## 0. The one promise

> **"We have your size in stock."**

It is the strongest thing a tyre shop can say. It beats *fast service* (the customer cannot
verify it), it beats *friendly staff* (they meet you after they have already driven 1.5h),
and it beats a discount (a discount is a reason to buy from anyone who undercuts next week).

It is also the easiest promise in retail to break. A shelf that says 4 in the system and
holds 3 at 8am is not a data problem — it is a customer standing at a counter with their car
up on the lift and no way to get a refund on the drive home.

**So the promise has exactly one rule: it may only be made against `available`, and only
while the shop can keep it.**

---

## 1. Rules of the promise

### R1 — The promise is made against `available`, never `onHand`

`StockLevelDto.available = onHand − reserved` is "the number a promise is made against"
per the contract's own comment. A customer never sees `onHand`; a bay with three tyres
on the shelf and two already promised to two other bookings has **one** to promise.

### R2 — Absence of evidence is not evidence of stock

**If the availability check fails, times out, or returns 5xx, the customer-facing line
does not render.** No "In stock today" fallback. No green chip on a guess. The line's
absence is silent and invisible — the page simply does not make a stock claim.

This is the rule that most inventory systems get backwards, because the failure is
invisible in QA: the fallback renders, the test passes, and the customer is lied to.

### R3 — Fail closed on the promise, fail open on the sale

The corollary, and it is the one that protects revenue. When availability cannot be
checked, the **booking still proceeds normally**. A status endpoint being down must never
cost the shop a booking. The unavailability is a staff-only badge, never a customer-facing
wall.

> Refusing to promise anything is safe. Refusing to sell anything is not.

### R4 — Non-blocking shortfall does not change the customer-facing state

`ReserveResult.shortfalls` lists every product that could not be fully covered.
`ReserveResult.blocked` is true only when a **blocking** part is short.

- `blocked === false` → the service goes ahead, and the customer-facing claim is `READY`.
- The shortfall on a non-blocking part is an **internal** fact. It surfaces on the staff
  panel and in the reorder list. It does not become customer copy.

A shop that says "we're low on wiper blades, is that a problem?" to a customer who wants
a PMS has invented a problem the customer did not have.

### R5 — A customer never sees a raw count, with one exception

Bands, not numbers. A number is a promise with a denominator attached.

| Customer sees | Condition | Why |
| --- | --- | --- |
| `In stock today` | `canFulfil === true` | A binary promise the shop controls |
| `A few left` | `0 < canPromise < 2 × qtyNeeded` | Honest without a number |
| `We can get that in` + date | `blocked === true`, a real ETA exists | An order-in is still a sale |
| *(nothing)* | check failed, or ETA unknown | R2 / R3 |

**The single exception — the full set.** When the customer asks for a tyre size and
`canPromise ≥ 2 × qtyNeeded` (i.e. the shop can fill their car *and* still honour another
same-day booking), the raw number may be shown, because at that depth the promise is real:

> `We have 8 of the 205/55 R16 on the shelf.`

The `2 ×` factor is not decoration. At `canPromise = qtyNeeded` exactly, one phone call
from another customer converts a promise into a shortfall while the first customer is
already on the road.

### R6 — Never a manufactured scarcity

Not `Only 2 left!`, not `Hurry`, not a client-generated countdown. Whatever
`capacityLeft` and `available` say is what renders, verbatim, and the reasons are printed
(`book.s3.reason1` / `book.s3.reason2` already do this for bays — the same discipline
applies to parts). `docs/brand/DO-NOT.md` §1.4 rule 43: a promo with no end date is not a
promo; a scarcity claim with no ledger behind it is not a scarcity claim.

### R7 — Nothing about cost, margin, supplier, or reorder point crosses to the customer

The public availability response is a **two-field contract**: `{ serviceId, canFulfil }`
plus the part rows the customer page actually renders (name, size, and `sellPrice`, which
is already a public catalogue price). Never `costPrice`, `marginPct`, `estimatedCost`,
`reorderPoint`, `reorderQty`, `supplierId`, `supplierName`, or `isOversold`.

The full leak-surface list is `DO-DONT.md` **D6** (the DO) and **N20** (the DON'T), and it
is handed to A8.

### R8 — Visual discipline (NO GLOW, `docs/brand/DO-NOT.md` §6)

An availability chip is `rounded-eyebrow` (**2px**), a 1px border, flat fill, and it
carries **colour + icon + word**. Never `rounded-pill`. Never `blur-*`. Never a
low-opacity colour wash. `pit-*` green is confirmation, not ambient availability — an
"in stock" chip is not a success event, and colouring it green trains the eye to ignore
green everywhere else in the product.

---

## 2. The customer-visible state model

Every customer-facing stock surface renders one of exactly **five** states. There is no
sixth, and there is no partial/unknown state that renders as a claim.

| State | Grounded in | Customer line | Customer-facing? |
| --- | --- | --- | --- |
| `READY` | `canFulfil === true`, `shortfalls.length === 0` | `In stock today.` | yes |
| `READY_PARTIAL` | `canFulfil === true`, `shortfalls.length > 0`, `blocked === false` | same as `READY` | yes — identical copy, by R4 |
| `ORDER_IN` | `blocked === true`, ETA known | `We'll have it by {date}.` | yes |
| `NOT_NOW` | `blocked === true`, no ETA | `We need to order that in. Call us and we'll tell you when it lands.` | yes — this is still a sale |
| `UNKNOWN` | endpoint failed / `isActive: false` | *(nothing renders)* | no claim |

`READY` and `READY_PARTIAL` deliberately share one string. Two strings would tell a
customer there is a difference when the difference does not change their day.

---

## 3. T1 — `/services`: per-service availability line

**Placement.** Inside each service card, on its own line, **directly above** the price
range and **above** the `Select {shortName} & pick date` button. Above the button because
it is read first. It is a `<p>` with an icon and a word — not a heading, because a card
that grows a heading per state creates an extra level in the outline of every page.

**Never on:** the service card's title, the price, the package card, or the mobile
selection tray. The tray's job is the count of selected services and the estimate.

### Exact copy

| State | Line | Icon | Word chip |
| --- | --- | --- | --- |
| `READY` / `READY_PARTIAL` | `In stock today. We can do this on any open day.` | `circle-check` 16px | `In stock today` |
| `ORDER_IN` (ETA known) | `We can do this. We need to order {partName} in — expect it by {dateLong}.` | `clock` 16px | `Order in · {dateLong}` |
| `NOT_NOW` | `We can do this, but we need to order a part in first. Call the shop and we'll tell you when it lands.` | `clock` 16px | `Order in` |
| `UNKNOWN` | *(no line)* | — | — |

Under `NOT_NOW`, the service's CTA is **unchanged**. The customer can still select the
service and still pick a date. `blocked` is a promise flag, not a paywall — refusing the
booking outright is A4's decision and it applies to `blocked === true` at *reserve* time,
not to browsing.

### Conditions — the exact test A3/A4 wires

```
GET availability for [serviceId]
  200 → state = parts.length ? (blocked ? ETA-known ? ORDER_IN : NOT_NOW : READY) : READY
  404 → state = UNKNOWN   (service deactivated; funnel ERROR §1.2 handles the card)
  429/5xx/timeout/offline → state = UNKNOWN
```

`blocked` for a single service is `ServiceAvailabilityDto.blockers.length > 0` — the
contract already filters `blockers` to blocking parts only, so the client does **not** have
to re-derive `isBlocking`. That is the whole reason the field exists and it must not be
recomputed client-side.

### Data requirement

| Needs | Field | Notes |
| --- | --- | --- |
| Yes / no | `ServiceAvailabilityDto.canFulfil` | the licence to print `In stock today` |
| Yes / no | `ServiceAvailabilityDto.blockers[]` | `[{ productId, name, short }]` |
| Yes / no | `ServiceAvailabilityDto.serviceSlug` | cache key |
| Customer-readable | `PartAvailabilityDto.name` | for `{partName}` in `ORDER_IN` |
| **CONTRACT GAP** | a per-blocking-part ETA | `blockers[]` has no date. `ORDER_IN` with a date **cannot render** until A2 exposes one. Until then only `NOT_NOW` ships, which is honest and needs no new field. |

### What it must NOT say when stock is short

- ❌ `Limited stock!` · `Only 2 left!` · `Hurry!` — manufactured (R6).
- ❌ `Out of stock` as a dead end — `blocked === true` means *order it in*, and an order-in
  is a booking, not a rejection.
- ❌ `Sorry, unavailable` — vague, passive, and it reads as the customer's problem.
- ❌ `We don't have that.` — stated alone, this is the sentence that makes a customer who
  drove 1.5 hours feel stupid. Never ship it without a next sentence.
- ✅ `We can do this, but we need to order a part in first. Call the shop and we'll tell you when it lands.`
  Same fact, and it hands the customer an action instead of a verdict.

---

## 4. T2 — `/book` wizard: before the customer picks a date

**Placement.** Step 2 (Services), in the summary tray above the `Continue to Date & Time`
button — the same slot the estimate occupies. It must be **above** the Continue button and
**below** the selected-service list, so it is read as a property of the selection rather
than as a warning about the next step.

**Timing.** The check fires on the *first* service selection and debounces 400 ms after the
last change. It never blocks Continue: `blocked === true` does not disable the button,
because the wizard's job is to take an order, not to enforce a warehouse rule.

### Exact copy

| State | Line |
| --- | --- |
| `READY` | `Good news — we have the parts for this in stock today.` |
| `READY_PARTIAL` | `Good news — we have the parts for this in stock today.` *(identical, R4)* |
| `ORDER_IN` (ETA known) | `We can do this. We need to order {partName} in, and expect it by {dateLong}. Pick a time after {dateLong} and we'll have it ready.` |
| `ORDER_IN` (ETA unknown) | `We can do this once we've ordered one part in. Pick a time as normal and we'll confirm the date when we hear from the supplier.` |
| `blocked === true`, **no** line at all permitted | `This one we need to confirm first. Call the shop and we'll tell you what we can do on your date.` + `Call Shop Now` |
| `UNKNOWN` | *(no line)* — the customer's Continue path is untouched |

**"Good news"** is used deliberately, once. It is the only place in the inventory surface
where an interjection is allowed, because the sentence is carrying a genuine relief — the
customer just worried about whether the shop has their size. Everything after it is flat.

### The date-strip interaction (this is the part A4 must get right)

When `blocked === true`, the **slot grid is untouched** — all three bays still show, at
their real capacity. The inventory does not get a veto on the calendar. It gets a sentence
and a recommendation.

Two allowed integrations, one forbidden:

| Allowed | Forbidden |
| --- | --- |
| Prepend one line to the slot grid: `We'll have {partName} by {dateLong}. Times before then need a call first.` | Grey out or hide slots before the ETA |
| Mark the ETA date chip with the `clock` icon and the word `Parts landing` — **in addition to** its existing bay-capacity label, never replacing it | Replace a slot's capacity with a stock number |
| On `blocked`, show a `Call us to hold that bay` secondary (reuses existing `book.slot-race-call`) | Disable `Continue to Date & Time` |

The bay calendar and the parts ledger are two different books. One availability number must
never overwrite the other.

### Data requirement

| Needs | Field | Notes |
| --- | --- | --- |
| Yes / no | `ServiceAvailabilityDto[]` for **every selected service**, not just the last one | availability is per service set; a customer with PMS + 2 tyres needs both answered |
| Yes / no | `canFulfil` per service, AND-ed across the selection | `canFulfil: true` for one service says nothing about the other |
| Yes / no | `blockers[].name` | `{partName}` |
| No | `blockers[].productId` | never rendered to a customer — it is an internal id |
| No | `parts[].available` | **never** rendered on the wizard. R5. |
| No | anything from `ProductDto.costPrice` / `marginPct` | R7 |

---

## 5. T3 — Confirmation screen: "your parts are set aside"

This is the strongest single sentence the site can say, because it is the only one backed
by a real physical reservation row in the database. It must therefore also be the one most
carefully scoped: it is only true while the reservation is `HELD`.

**Placement.** `/book` success, immediately under `ok.title` and above `ok.refLabel`. It is
the second thing on the screen after the time.

### Exact copy

| Condition | Line |
| --- | --- |
| ≥1 reservation, all `HELD`, `blocked === false` | `We've set aside the parts for this job. They're held for your booking reference.` |
| `blocked === true` (partial reserve) | **No set-aside claim at all.** Instead: `Booking received. One part still needs to come in — we'll text you the day it lands, before your date.` |
| 0 reservations (service has no BOM, or `isActive` on every part) | *(no line)* — nothing was set aside, so nothing is claimed |
| `blocked === false` **and** a non-blocking shortfall exists | `We've set aside the parts we need for the main work.` *(the word `we need` does the work — it is true and it does not overreach)* |
| Reservation TTL already elapsed at render (race) | *(no line)* — the claim expired; R2 again |

### Why "set aside" and not "reserved"

`Reservation.status === "HELD"` with a 24h TTL is a soft, time-boxed hold. "Reserved" is a
word that promises permanence in the customer's mind; "set aside" is a physical image —
someone put a sticker on a tyre and pulled it into the bay. **The copy must not outrun the
TTL.**

### The TTL honesty rule

`ReserveResult.expiresAt` is **never rendered as a countdown** on the customer success
screen (R6, and the same reasoning as `est.total.checked`: no timer that resets). What is
rendered is a factual line, only when the hold is genuinely short:

> `We hold parts for 24 hours after you book.`

On the **staff** side the expiry is live and prominent — `MICROCOPY.md` §11,
`inv.res.holdsUntil` — because the mechanic is the person who can act on it.

### Data requirement

| Needs | Field | Notes |
| --- | --- | --- |
| Yes / no | `ReserveResult.reservations[]` — at least one with `status === "HELD"` | the licence to say `set aside` |
| Yes / no | `ReserveResult.blocked === false` | `blocked === true` kills the claim entirely |
| Yes / no | `ReserveResult.expiresAt` | for the staff hold countdown, and to detect an already-expired hold |
| Yes / no | `ReservationDto.productName` | staff panel only |
| No | `ReservationDto.productId` | never rendered to a customer |
| **CONTRACT GAP** | reservation scope for the success screen | `ReserveResult` has no `serviceSlug` and no list of part names for the customer surface. A4 should attach the resolved names from the availability call it already made. **No customer-facing part names** without it — the generic sentence is the fallback and it is sufficient. |

---

## 6. T4 — Tyre-size finder

The size finder is where the promise is won or lost. A customer types `205/55 R16` and gets
one of three answers. Only one of them can be a promise.

**Placement.** Result row per size, under the size, above the `Select this size` CTA. Same
five-state model. Unit is `PAIR`; a full car is four, and the arithmetic must be done in
the unit the product is stocked in — never in a bare integer.

### Exact copy

| Condition (`ProductAvailabilityDto`) | Line | CTA |
| --- | --- | --- |
| `canPromise >= 8` (2 × a full set) | `We have {canPromise} of the {size} on the shelf.` | `Select this size` |
| `4 <= canPromise < 8` | `We have a full set of the {size} in stock.` | `Select this size` |
| `1 <= canPromise < 4` | `We have a few of the {size}. A full set means ordering some in.` | `Select this size` — **unchanged** |
| `canPromise === 0`, ETA known | `No {size} on the shelf right now. We can have it by {dateLong}.` | `Order it in for me` |
| `canPromise === 0`, no ETA | `No {size} on the shelf right now. Call us and we'll tell you what's closest.` | `Call Shop Now` |
| `isNearExpiry === true`, or `ageDays > 730` | the size is **filtered out of the results entirely** | — |

### The DOT rule — the hardest honesty line in this document

`ProductAvailabilityDto.ageDays` and `isNearExpiry` exist for exactly one reason: a tyre is
not a fungible unit of stock. **A tyre the shop would not fit does not appear in the
finder.** If `isNearExpiry === true`, or `ageDays` exceeds 730 days, the size is excluded
from results rather than shown with a caveat. A caveat is an invitation — "ask the
assistant about it" — and the assistant at 8am with a queue behind them will say yes.

Aged stock is not dead stock: it is honest content (`docs/inventory-marketing/`, A6) shown
on a **separate** aged-stock surface with its age printed. But it is never presented
through the availability line that says `In stock today`. Those are two different promises
and they must not share a sentence.

### Data requirement

| Needs | Field | Notes |
| --- | --- | --- |
| Yes / no | `ProductAvailabilityDto.canPromise` | **not** `available` — this is the field the contract defines as promiseable |
| Yes / no | `ProductAvailabilityDto.isLow` | decides "a few" vs "a full set" copy emphasis, never the number |
| Yes / no | `isNearExpiry` | gates exclusion, per the DOT rule |
| Yes / no | `ageDays` | gates exclusion, per the DOT rule |
| Customer-readable | size string | `ProductDto.size` via the finder's own DTO — the finder is a customer surface, so `ProductDto` is **not** the right shape; A4/A6 must return `{ size, label, canPromise, state }` |
| No | `reorderPoint` | tells a customer the shop's internal buffer. R7. |
| No | `ProductDto.costPrice`, `marginPct`, `supplierId` | R7 |

---

## 7. T5 — The estimate and the staff quote

The estimator is the second place the promise gets made, and the first place it gets
over-claimed, because `est.disclaimer` is doing all the hedging work and the availability
line is doing none.

**Rule:** if the customer can carry a tyre selection into the estimator (they can —
`est.tyres.size`), then the estimator renders the same T4 availability line for the entered
size, using the same five states and the same strings. **One promise, two surfaces, one
string.** A promise that reads differently on `/services` and on the estimate is two
promises, and only one of them can be kept.

**On the staff quote:** the job card printed for the customer lists services, quantities
and amounts — `docs/brand/VOICE-AND-TONE.md` §5.5. It lists **no stock figures and no stock
warnings.** A customer does not need to know the shop holds two oil filters; they need to
know what they are paying for. Any part shortfall on a job card is a **staff** line in the
booking panel, never a printed line.

---

## 8. T6 — "Tell me when it lands" (pre-order)

The honest form of the waitlist. A6 owns the campaign mechanics; **the trust claim is
defined here** and A6 must use it verbatim.

> `We'll text you the day it lands. One message, then we stop.`

Three conditions, all mandatory:

1. The message is genuinely one-per-arrival, not a drip.
2. The ETA printed to the customer is the **same** value the reorder digest prints to the
   owner. Two ETAs on the same part is a lie waiting for a phone call.
3. If the ETA moves, the customer gets a **move** message, not silence.

**`blocked === true` is the entrance condition for this flow, not an exit.** A customer who
cannot be served today is the exact customer for whom this belongs — and it is the only
place a waitlist is honest rather than a retention trap, because the reason for waiting is
a physical absence the shop can name.

---

## 9. Wiring sheet — one table for A3 / A4

| Surface | Owner | Call | Reads | Renders |
| --- | --- | --- | --- | --- |
| `/services` card line | A3 | public availability endpoint, per `serviceSlug` | `canFulfil`, `blockers[]` | T1 states |
| `/book` step 2 tray | A4 | same endpoint, all selected `serviceIds` | `canFulfil` AND-ed, `blockers[].name` | T2 states |
| `/book` success | A4 | from the reserve response already in hand | `reservations[].status`, `blocked`, `expiresAt` | T3 states |
| Size finder | A3 / A6 | product availability by size | `canPromise`, `isLow`, `ageDays`, `isNearExpiry` | T4 states |
| Estimator | A4 | same as size finder | same | T4 states, identical strings |
| Booking staff panel | A4 | `ReserveResult` | everything, including cost-free shortfalls | OPERATOR-UX §3 |

**One endpoint, five surfaces, five strings.** If a sixth surface ever needs a stock claim,
it reuses these strings. If it cannot, the claim does not ship.

---

## 10. Copy tests — run these before any inventory release

- [ ] With the availability endpoint returning **500**, `/services` shows **no availability
      line on any card**, and the service CTA still works.
- [ ] With the endpoint returning `canFulfil: false` and one blocker, the copy is
      `We can do this, but we need to order a part in first…` — and the string
      `Out of stock` appears nowhere on the page.
- [ ] `shortfalls.length > 0` with `blocked === false` produces **byte-identical** copy to
      `shortfalls.length === 0`. (Diff the rendered strings in a test.)
- [ ] No customer-facing response body contains `costPrice`, `marginPct`, `reorderPoint`,
      `reorderQty`, `supplierId`, `supplierName`, `estimatedCost`, or `isOversold`.
- [ ] With `isNearExpiry: true`, the size does not appear in the finder results.
- [ ] With `blocked === true`, the date strip still renders every slot at its real
      `capacityLeft`, and `Continue to Date & Time` is enabled.
- [ ] No stock chip uses `rounded-pill`, `blur-*`, or a `/15`-opacity colour wash.
- [ ] No stock claim contains `Only`, `Left!`, `Hurry`, `Limited`, or an exclamation mark.
- [ ] The success screen's set-aside line disappears when the reservation is `RELEASED`,
      `EXPIRED`, or `CONSUMED`.
