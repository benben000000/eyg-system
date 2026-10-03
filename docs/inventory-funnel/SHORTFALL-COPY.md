# SHORTFALL COPY — being honest about a part we don't have

**Owner:** funnel agent (A5) · **Applies to:** every place the system says no to a customer
**Contract:** `ServiceAvailabilityDto.blockers`, `ReserveResult.shortfalls`, `ReserveResult.blocked`,
`PartAvailabilityDto.{isBlocking,isShort,available,qtyNeeded}`, `ProductAvailabilityDto.canPromise`

---

## 0. The situation this file exists for

A customer in Bataan has spent 90 minutes round trip to find out the shop does not have
their size. That sentence, delivered badly, ends the relationship for years and tells every
other person they know not to bother.

The mistake is not the absence of stock. **The mistake is making the absence the first
sentence.**

| ❌ What kills it | ✅ What keeps them |
| --- | --- |
| `Sorry, we don't have that size.` | `We fit that size. Let me check what we can get you and when.` |
| The shortfall as the headline | What the shop *can* do, as the headline |
| A dead end (no next step) | Two routes, both real, both with a date or a decision |
| `Out of stock` (dead, no verb) | `We need to order it in` (**a verb, an owner, and a clock**) |
| Blaming the supplier | Naming the part and the day, nothing else |
| An apology for the shop's system | Silence about the system entirely |

> **The copy rule: the shortfall is never sentence one. Sentence one is what the shop can
> do. Sentence two is what is missing.**

---

## 1. Three routes, and the rule that picks between them

There are exactly three honest answers to "we're short". They are ordered by how much of
the customer's original intent survives.

| # | Route | What survives | Blocking? | Needs the customer to decide? |
| --- | --- | --- | --- | --- |
| **1** | **Order in, with a date** | The whole job, later | no | no — just inform |
| **2** | **Substitute, with consent** | The job, at a different price or brand | no | **yes — always** |
| **3** | **Bay-only** | Part of the job, today | no | yes — a reduced scope |

**None of the three is a refusal.** A refusal is only correct in one case: the shop
genuinely cannot do the work and will not have the part at all, which for a tyre shop with
a distributor is almost never true. Design for that case anyway — `NOT_AVAILABLE`, §6 — but
it is the exception, not the funnel.

### The decision rule (A4 wires this; it is not a judgement call in the UI)

```
if (!serviceAvailability.canFulfil) {
    if (an equivalent product exists with canPromise >= qtyNeeded)  → Route 2
    else if (supplier can deliver before the requested date)        → Route 1
    else                                                          → Route 3
}
if (shortfalls.length > 0 && blocked === false) → Route 3, silently
```

The fourth line is the one that protects revenue and it is the one most systems get wrong.
`blocked === false` means **go**. The customer gets the job, the bay gets occupied, the
revenue lands, and the non-blocking part is discussed at the counter under the existing
promise: *if something extra turns up, we ask first.*

---

## 2. Route 1 — Order in, with a date

**Placement.** `/services` card (`NOT_NOW`), `/book` step 2 tray, and the booking staff
panel. It is never a modal and never blocks the wizard.

### Customer copy — the order-in

**Long form (no ETA yet — the only shippable form today):**

> `We can do this. We need to order one part in first — usually a day or two from our supplier. Pick a date as normal and we'll confirm the day it lands before you come in.`

`a day or two` is an **estimate stated as an estimate**, in the shop's own voice. It is not
a promise about a specific date, and it is not an invented SLA — see the CONTRACT GAP below.

**Short form (ETA known):**

> `We can do this on {dateLong}. We'll have it by then, and we'll text you when it lands.`

**If the ETA is later than the customer's date:**

> `That part takes us to {dateLong}, which is after the day you picked. Two things we can do: come in {dateLong} and we'll have it ready, or come in earlier and do the rest while we wait for it.`

Two options, both real, neither a loss. The second one is the Bay-only route wearing a
different hat — offering it here is what stops "come back next week" from becoming the
customer's only choice.

### The `2 ×` factor on order-in dates

An order-in date is a promise too. Before printing one, require that the expected arrival
leaves at least **one full working day** of slack before the customer's booking date, because
a distributor delivery in Bataan that lands at 4:30pm cannot be fitted at 4:30pm.

```
effectiveEta = supplierEta − 1 working day
if (effectiveEta < bookingDate) → offer the alternative date, or Bay-only
```

Never print a supplier's raw promised date as an availability date.

### Staff copy (booking panel, one line)

> `Short: 205/55 R16 Primacy 4 — need 4, have 0. On order, ref DR-4471, expected Tue 6 Oct.`

One line. Product, need, have, action, date. It is on a screen a mechanic reads in one
glance while a car is on the lift; a paragraph is worse than nothing.

### CONTRACT GAP — the ETA field

`ServiceAvailabilityDto.blockers[]` is `{ productId, name, short }`. There is no date. The
whole Route-1 short form is therefore **unshippable** until A2 exposes one.

**Request to the orchestrator** (this is the single most valuable contract addition in the
inventory build):

> Add `PurchaseOrder` + `PurchaseOrderLine` models, and on `ProductAvailabilityDto` and
> `ServiceAvailabilityDto.blockers[]` add `expectedAt: string | null`. An order-in with no
> date is a waitlist, and the shop already has a clipboard.

Second, smaller: `onOrder: number` on `StockLevelDto`, so the escalation ladder's third
rung is durable instead of a memory (`OPERATOR-UX.md` §4).

### Until the gap is closed

Ship `NOT_NOW` (the long form). It converts — it tells the customer the job is possible and
that calling will date it. It invents nothing. When A2 ships the field, the short form turns
on; it does not require a copy change, only a condition change.

---

## 3. Route 2 — Substitute, with consent

**Substitution is a safety decision before it is a commercial one.** A substitute tyre with
a lower load index or a lower speed rating is not a cheaper option, it is a hazard.

### The candidate rule (grounded, no new field)

A substitute for product `P` is a product `Q` where **all** of:

| Attribute | Rule | Why |
| --- | --- | --- |
| `kind` | equal | a filter never substitutes for a tyre |
| `size` | equal | the sidewall is the car |
| `rimSizeIn` | equal | belt and bead |
| `loadIndex` | `Q.loadIndex >= P.loadIndex` — **never lower** | safety, non-negotiable |
| `speedRating` | `Q.speedRating >= P.speedRating` — **never lower** | safety, non-negotiable |
| `canPromise` | `>= qtyNeeded` | it must actually be on the shelf |
| `isNearExpiry` / `ageDays` | not aged out | the DOT rule from TRUST-MESSAGES §6 |

There is no `substituteFor` column in the schema and this rule does not need one — it is a
query over `Product` attributes that are all already indexed (`@@index([kind])`,
`@@index([size])`, `@@index([brand])`).

### Customer copy — the ask

> `We've got a different brand in that size — {brand} {size}. Same size, and the load rating is equal or better. It's {priceDelta} {direction} than the one you asked for. Happy to fit it, or we can wait for the one you wanted?`

Rules in that sentence, all deliberate:

- **The name and the size are stated**, so the customer can verify at the counter.
- **The rating claim is specific** — "load rating is equal or better" — and it is only
  renderable because of the `>=` rule above. It is not "same quality", which is unfalsifiable.
- **The price difference is a direction and an amount**, never a vague "similar price".
  `PartAvailabilityDto.sellPrice` is public catalogue data and is safe to show.
- **Two options, equal weight.** The question ends with a choice, not a recommendation.
- **No brand disparagement.** Never "the other one isn't as good". The customer asked for a
  brand; give them the reason for the difference and let them decide.

### Staff copy

> `Substitute offered: {brand} {size} for {sku}, +₱{delta}. Customer said yes at {time}.`

This goes in the ledger as the movement's `reason` — the reason field is mandatory, and
`reason: "Customer approved substitute, per {staffName}"` is the honest entry. It is the
answer to "why is there a cheaper tyre on this invoice?" six weeks later.

### When there is no substitute

Do not manufacture one. `No equivalent in stock` → Route 1 or Route 3. Never fit a
different size and hope. Never fit a lower-rated tyre and mention it afterwards.

---

## 4. Route 3 — Bay-only (the service that doesn't need the part)

**The most under-used route in the whole system, and the one that saves the most money.**

A customer who books *PMS + undercoating + wiper blades* when the blades are short should
get the PMS and the undercoating today, in one bay, at one price, and be offered the blades
separately. The customer did not drive 90 minutes for a wiper blade. The shop did not
spend a bay-hour to find that out.

### Customer copy

> `Good news — we can do most of it today. {serviceList} are all in stock, so we'll get those done while your car is up. The {missingPart} needs to be ordered in. Do the rest now and pick it up separately, or wait and do everything at once?`

Two options, both legitimate. The bay stays full, the car is fixed, the customer is not
sent away, and the parts conversation happens at the counter with the car already on the
lift.

**Consistency requirement.** `book.s2.conflict` already ships this exact pattern for a
bundle conflict: *{ServiceName} is already in {PackageName}. We'll leave the bundle as it
is and ignore the extra one.* Route 3 is that sentence applied to a stock shortfall. Use
the same grammar, the same two-option structure, and the same "we'll leave it as it is"
framing so the site has **one** voice for "we're doing this differently from what you
asked."

### The price line — do the arithmetic in front of them

> `Today: {serviceList} — {formatPeso(partialTotal)}`
> `Later: {missingPart} — {formatPeso(partPrice)}`
> `Together: {formatPeso(fullTotal)} — same price. Splitting the work just means two visits.`

That third line is the whole argument. A customer who has been quoted a total will pay the
total; the split is only about **timing**, and saying so plainly removes the friction
entirely. Never inflate the total by a re-diagnosis fee for doing the job in two visits.

### Staff copy

> `Bay-only: {serviceList} today, {missingPart} on order. Customer approved the split at {time}.`

---

## 5. Route selection on the counter — the one-question script

When a customer is standing there and the system says short, the mechanic asks **one**
question. Not a form, not a dialogue tree, not a menu.

> `Two ways we can do this: we order the {part} and you come back {date}, or we fit {brand} {size} which we have today. Which one suits you?`

If they cannot decide: `Let's get the {part} ordered. I'll text you the day it lands.` That
is the default, because it preserves the customer's original choice and it creates the
reorder row. **Never default to the substitute.** The substitute is the cheaper-friction
option and that is exactly why it must not be the default — it is a downgrade the customer
did not ask for.

---

## 6. `NOT_AVAILABLE` — the real refusal, and why it is rare

There is exactly one honest refusal: **the shop will not have the part at all.**

> `We're not able to fit that size. I don't want to take your booking and your bay time for something we can't finish. What I can do is [Route 1 or Route 2].`

- **No apology.** The shop has not failed; it has declined to promise.
- **The refusal is about the shop's commitment**, never about the customer's request. "We
  can't finish it" is a statement about competence, which is a claim the shop is entitled
  to make. "That size doesn't work on your car" is a claim about their car, which we may
  be wrong about.
- **A refusal always carries a route.** A refusal with no route is a lost customer.
- If the shop genuinely will not source the part, that is a **catalogue** fact, not a stock
  fact: set `Product.isActive = false`, which retires it everywhere (`CTMAP.md` P5), and
  the finder and `/services` both drop it without anyone writing copy about it.

---

## 7. When the order-in misses

**The failure mode to design against: the customer was given a date, and the date passed.**
This is the single largest trust cost in the whole inventory system, and it is worse than
never having promised the date at all.

| Trigger | Customer sees | Copy | Recovery |
| --- | --- | --- | --- |
| Supplier slipped, ETA moved, customer informed >24h ahead | SMS + a line in the booking panel | `Your {size} set is running a day late — new date is {dateLong}. Your bay is still booked for {originalDate}.` | keep the bay, re-date the part |
| Supplier slipped, customer informed **<24h** ahead, booking is tomorrow | SMS + a phone call from the shop | `We don't have your {size} yet. Your bay is {time} tomorrow and we'd rather not have you in and out. Can we push you to {dateLong}? Your deposit moves with you.` | **the call is not optional** |
| Part never arrived; booking is in the next 48h | Phone call, same day | `Your {size} hasn't landed and we don't want you driving out for nothing. Let's move you to {dateLong}, or fit {brand} {size} today if you'd rather.` | Route 2 or re-date |
| Part arrived after the booking was cancelled | Nothing to the customer | — | the reservation released on cancel; stock returns to `available` |

**Never** let a booking reach `CHECKED_IN` with a `blocked` blocker unresolved without a
human having spoken to the customer. The system cannot make that call. The staff panel
marks it `TALK TO CUSTOMER` and it stays marked.

---

## 8. What must never appear in any shortfall message

| ❌ Never ship | Why | Say instead |
| --- | --- | --- |
| `Out of stock` as a standalone state | No verb, no owner, no date — reads as a wall | `We need to order that in` |
| `We don't have that.` alone | Ends the visit | capability sentence first |
| `Item unavailable` | E-commerce register. This is a shop with a lift. | `We don't have {part} on the shelf` |
| `Unfortunately` | Passive, apologetic to a system | delete the sentence |
| `Our supplier failed to deliver` | Blames a third party the customer cannot act on | `It's running a day late. New date is {dateLong}.` |
| `Limited stock!` / `Only 2 left!` | Manufactured urgency | `A few left` (T4) |
| `This item is currently unavailable due to high demand` | "High demand" as scarcity pressure is manufactured unless literally measured | the real reason, or nothing |
| A customer-visible ETA with no supplier commitment behind it | An invented date is a broken promise with a date on it | the long form |
| `Alternative products available!` | A cross-sell banner on a shortfall | Route 2's two-option ask |
| Any part of the cost or supplier's identity | R7 | — |

---

## 9. Copy tests

- [ ] A `blocked` booking renders the customer-facing text of exactly one route, and the
      wizard's Continue button is enabled in all three.
- [ ] `blocked === false` with three non-blocking shortfalls renders **zero** shortfall copy
      on the customer surface.
- [ ] The substitute query returns no candidate whose `loadIndex` or `speedRating` is lower
      than the original, at any price. (Assert this in a test, not in a review.)
- [ ] The substitute copy never appears without both options and without the price delta.
- [ ] Bay-only pricing shows `Together: same price` whenever `partialTotal + partPrice === fullTotal`.
- [ ] Every shortfall message's first sentence contains a capability or an action, not an
      absence.
- [ ] The string `Out of stock` does not appear anywhere in the customer bundle.
- [ ] No customer's shortfall message is rendered without a reachable `tel:`.
- [ ] An ETA is never rendered with less than one working day of slack before the booking date.
