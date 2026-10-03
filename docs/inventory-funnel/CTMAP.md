# CTA MAP — the inventory system

**Owner:** funnel agent (A5) · **Scope:** every call-to-action in `/inventory/**`, every
stock claim CTA on the customer site, and the booking-side integration panels
**Contract:** `src/lib/inventory-types.ts` · **Style contract:** `docs/funnel/CTA-MAP.md`
**Status:** buildable. No `TODO`.

---

## 0. How to read this file

- **`cta_id`** is the contract. Analytics, QA and copy tests key off the id, never off the
  class name or the label.
- **Placement** is a logical slot, not a component filename.
- **Variant** is the existing site vocabulary, unchanged: `primary` · `secondary` ·
  `tertiary` · `ghost` · `emergency`. No new variants.
- **Priority:** `P0` the screen fails its job without it · `P1` strong measured lift ·
  `P2` nice, ships last.
- **Microcopy sits above the button** unless marked *below*.
- All `cta_id`s are prefixed `inv.` so they can never collide with the existing site map
  (`book.*`, `services.*`, `home.*`).
- Chips, badges and status pills are `rounded-eyebrow` (**2px**), never `rounded-pill`
  (`docs/brand/DO-NOT.md` §6). No `blur-*`, no low-opacity colour wash.

---

## 1. The naming decisions — why these labels

The site's rule stands unchanged: **the label contains the verb the person will do**, and
for a stock write it contains **the quantity and the consequence**.

| Candidate | Verdict | Reason |
| --- | --- | --- |
| **`Receive 24 → 28`** | ✅ **the canonical stock-write label** | It is the only form of this button that cannot be misread. The verb, the quantity, and the resulting number are all on it, so the operator never has to look away from the button to find out what pressing it does. It is also the before→after requirement from A3's brief, satisfied by the control itself rather than by a dialog beside it. |
| `Save` | ❌ | It names the database operation, not the shop action. In a stock system `Save` is actively misleading — nothing is saved, something is *received*. |
| `Confirm` | ❌ | Confirms what? The operator has just typed the number. A confirm label on a primary stock write invites a double-press, which is exactly the double-consume the idempotency key exists to absorb. |
| `Add stock` | ❌ | Adds stock to *what*? And "add" is a database verb. |
| `Update` | ❌ | Same problem, and worse: it implies the number on screen was wrong rather than that goods arrived. |
| **`Post 12 lines`** | ✅ accepted, **only** for a multi-line receive | It names the scope (12 lines) and the verb from the ledger's own vocabulary. Never used on a single line, where `Receive 24 → 28` is strictly better. |
| **`Hold to remove 2 → 2`** | ✅ accepted, destructive writes only | The hold *is* the confirmation and it is the label. `ADJUST_DOWN`, `SHRINK` and `RETURN_TO_SUPPLIER` all take this form. |
| **`Adjust stock`** | ✅ accepted, as the dialog *title* | It is a container, not a commit. It never appears on a button that writes. |
| **`Count this line`** | ✅ accepted, per-line in a count | "Count" is the shop's own word (`StockCountStatus.COUNTING`) and it is unambiguous next to "count" meaning "figure out the price". |
| **`Start a count`** | ✅ accepted, count creation only | Names the artifact it creates. |
| **`Post count`** | ✅ accepted, the one write on a count | `POSTED` is a real status in the contract; the label is the status transition. |
| **`Call {supplierName}`** | ✅ accepted, the reorder row | The shop buys by phone. `Place order` implies a system that places orders, and this system does not. |
| **`See what's low`** | ✅ accepted, dashboard entry | `View inventory` describes a container; the operator wants the list of problems. |
| **`Book a Service Bay`** | ✅ accepted, the only stock-adjacent customer CTA | It is the existing site primary. A stock system never gets to invent a new customer primary. |
| `Order it in for me` | ✅ accepted, **only** when `canPromise === 0` and an ETA exists | The customer is asking for something, and this is exactly what they asked for. It is a customer-side commitment and therefore a route to SHORTFALL-COPY Route 1. |

---

## 2. Operator chrome — `/inventory`

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | Sidebar (`inv.nav.dashboard`) | `Today` | secondary | `/inventory` | — | **P0** |
| I2 | Sidebar (`inv.nav.low`) | `What's low` | secondary | `/inventory/low` | `12 items · 2 out of stock` | **P0** |
| I3 | Sidebar (`inv.nav.count`) | `Counts` | secondary | `/inventory/counts` | `1 open · {outstanding} lines left` | **P0** |
| I4 | Sidebar (`inv.nav.products`) | `All products` | secondary | `/inventory/products` | — | **P0** |
| I5 | Sidebar (`inv.nav.movements`) | `Ledger` | secondary | `/inventory/movements` | — | P1 |
| I6 | Sidebar (`inv.nav.reorder`) | `Order from suppliers` | secondary | `/inventory/reorder` | `5 to call · ₱{estimatedCost}` | **P0** |
| I7 | Search (`inv.search.focus`) | *(no label — `/`)* | ghost | focus search | `Search sku, name, size or barcode` | **P0** |
| I8 | Command bar (`inv.cmd.receive`) | `Receive` (`R`) | primary | open receive | `Goods in from a supplier` | **P0** |
| I9 | Command bar (`inv.cmd.consume`) | `Consume` (`C`) | secondary | open consume | `Parts used on a job` | **P0** |
| I10 | Command bar (`inv.cmd.adjust`) | `Adjust` (`A`) | secondary | open adjust | `Fix a wrong number. A reason is required.` | **P0** |
| I11 | Command bar (`inv.cmd.count`) | `Count` (`K`) | secondary | start/join a count | `Check the shelf against the system` | **P0** |
| I12 | Nav (`inv.nav.bookings`) | `Bookings` | secondary | `/admin/bookings` | `2 need a decision on parts` | **P0** |
| I13 | Account (`inv.nav.signout`) | `Sign out` | ghost | auth sign-out | — | P1 |

**I1 is `Today`, not `Dashboard`.** "Dashboard" is a word about charts; "Today" is a word
about a morning. The screen deliberately has no charts (`OPERATOR-UX.md` §1) and the label
should not advertise them.

**I6's microcopy carries the money** because the owner's actual question is *what does this
cost*, not *what is low*. `estimatedCost` is staff-only and appears here and nowhere a
customer can see it.

---

## 3. Receive

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Receive dialog header (`inv.rec.start`) | `Receive stock` | primary | `/inventory/receive` | `Scan or type each item, then post the lines.` | **P0** |
| R2 | Reference field (`inv.rec.ref`) | *(field, not a button)* | — | — | `Invoice or delivery docket number. One for the whole delivery.` | **P0** |
| R3 | Per line (`inv.rec.line`, productId) | `Receive {qty} → {onHandAfter}` | primary | `POST /api/inventory/movement` `kind: RECEIVE` | `{sku} · {name} · {unit}` · *below:* `Now {onHand} {unit}` | **P0** |
| R4 | Footer (`inv.rec.postAll`) | `Post {n} lines` | primary | batch post all counted lines | `One ledger entry per line. Each can be posted on its own.` | **P0** |
| R5 | Footer (`inv.rec.postOne`) | `Post this line` | secondary | post one line | — | P1 |
| R6 | Count conflict note (`inv.rec.countConflict`) | `See the open count` | tertiary | `/inventory/counts/{id}` | `Counted on {dateLong} as {counted}. Posting will show a variance of {+n}.` | **P0** |
| R7 | Received confirmation (`inv.rec.done`) | `Keep receiving` | primary | next line | `Received {qty} {unit}. {sku} is now {onHandAfter} {unit}.` | **P0** |
| R8 | Received confirmation (`inv.rec.finished`) | `Back to Today` | secondary | `/inventory` | `Posted {n} lines. {reference} is in the ledger.` | **P0** |
| R9 | Shortage on receive (`inv.rec.mismatch`) | `Hold this line` | secondary | mark line as not received | `You typed {n}. The docket says {m}. We posted {n} and left {m} on the shelf.` | **P0** |
| R10 | Refused line (`inv.rec.retry`) | `Try again` | primary | resubmit same line, same idempotency key | `The last line didn't go in. Everything before it is already saved.` | **P0** |

**R9 is the most important button on this screen.** A count of 24 on a docket that says 22
happens every week. The system's job is to let the human record the truth and keep the
difference visible — not to average it away or to correct it silently.

**R3's label changes to the server's answer after the post** and the button is disabled
until the quantity changes again. Two taps on the same line cannot double-receive.

---

## 4. Consume

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Consume dialog (`inv.con.start`) | `Consume parts` | primary | open consume | `What did this job use?` | **P0** |
| C2 | Booking picker (`inv.con.booking`) | `Use booking {reference}` | secondary | select booking, load its BOM | `{customerName} · {dateLong} · {vehicleLabel}` | **P0** |
| C3 | Per line (`inv.con.line`, productId) | `Use {qty} → {onHandAfter}` | primary | `POST /api/inventory/movement` `kind: CONSUME` | `Reserved for this booking: {reserved}.` | **P0** |
| C4 | Over-reserved line (`inv.con.releaseExtra`) | `Release the extra {n}` | secondary | `POST …/release` | `This booking reserved {reserved}, you are using {used}.` | **P0** |
| C5 | Footer (`inv.con.post`) | `Use {n} parts` | primary | batch consume | `Writes one ledger line per part, against {reference}.` | **P0** |
| C6 | Done (`inv.con.done`) | `Back to the booking` | primary | `/admin/bookings/{id}` | `Used {n} parts against {reference}. The bay can close.` | **P0** |
| C7 | **Refusal** (`inv.con.refuse`) | `Use {available} instead` | secondary | resubmit with `available` | `Only {available} {unit} on hand. You asked for {requested}.` | **P0** |
| C8 | Refusal, nothing usable (`inv.con.refuseHard`) | `Write this off instead` | secondary | `ADJUST_DOWN` with reason | `We have {available} {unit} and the job needs {requested}. Writing off {short} records why the shelf and the job disagree.` | P1 |

**C7 is the design.** `PostMovementRejection` carries `available` and `requested` precisely
so the UI can offer the truth instead of an error. `Use 3 instead` is not a consolation
prize — it is usually correct: the job needs three, four were on the estimate.

**C8 exists because `refuse-not-clamp` will otherwise strand a job.** Writing off with a
reason is the honest ledger entry; refusing forever just leaves the bay occupied. It is P1
because it must never be the *default* path.

---

## 5. Adjust

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- |
| A1 | Adjust dialog (`inv.adj.start`) | `Adjust stock` | primary | open adjust | `The number on screen is wrong. Say why.` | **P0** |
| A2 | Current (`inv.adj.current`) | *(readout)* | — | — | `The system says {onHand} {unit}.` | **P0** |
| A3 | Kind picker (`inv.adj.kind`) | `Add` · `Remove` · `Write off` | secondary | sets `ADJUST_UP` / `ADJUST_DOWN` / `SHRINK` | `Add — found it on the shelf. Remove — it's gone. Write off — damaged, leaked, or used and not logged.` | **P0** |
| A4 | Reason (`inv.adj.reason`) | *(required field + presets)* | — | — | `Required. "Because" is not a reason.` | **P0** |
| A5 | Presets (`inv.adj.preset`) | `Found on shelf` · `Damaged` · `Wrong item` · `Supplier short-shipped` · `Lost` · `Correction` | secondary | fills reason | — | **P0** |
| A6 | Commit up (`inv.adj.up`) | `Add {qty} → {onHandAfter}` | primary | `POST …` `ADJUST_UP` | — | **P0** |
| A7 | Commit down (`inv.adj.down`) | `Hold to remove {qty} → {onHandAfter}` | secondary | `ADJUST_DOWN` | *below:* `This writes a ledger line anyone can trace to {actorName}.` | **P0** |
| A8 | Commit shrink (`inv.adj.shrink`) | `Hold to write off {qty} → {onHandAfter}` | secondary | `SHRINK` | — | **P0** |
| A9 | No reason (`inv.adj.needReason`) | `Add a reason` | secondary | focus the reason field | `We need one line so we can answer "why is this number wrong" in six weeks.` | **P0** |
| A10 | Over-reserved adjust (`inv.adj.overReserved`) | `This is above {available} available` | tertiary | explain | `{reserved} {unit} are promised to bookings. Removing more means those bookings break.` | **P0** |

**A6/A7/A8 use different verbs because they mean different things.** `Add` is a gain, `Remove`
is a correction, `Write off` is a loss. The ledger can tell them apart later only if the
labels told them apart at the time. Using `Adjust` on all three would flatten the entire
history of the shop into one meaningless column.

**A10 blocks the button, not the field.** The operator can still type it, and they see
exactly which bookings break — but the default path is not a foot-gun.

---

## 6. Count

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| K1 | Start (`inv.cnt.start`) | `Start a count` | primary | `/inventory/counts/new` | `Count the shelf. The system doesn't show you what it thinks until you've counted.` | **P0** |
| K2 | Scope (`inv.cnt.scope`) | `Everything` · `{KindName}` · `One product` | secondary | sets `CreateCountInput.scope` | — | **P0** |
| K3 | Due (`inv.cnt.due`) | `What's due this week` | primary | filtered count queue | `{n} lines · about {minutes}` | **P0** |
| K4 | Per line (`inv.cnt.line`, productId) | `Count this line` | secondary | focus the number field | `{sku} · {name} · count in {unit}` | **P0** |
| K5 | Submit line (`inv.cnt.save`, productId) | `Save {counted} {unit}` | primary | `POST /api/inventory/count/{id}/lines` | — | **P0** |
| K6 | Variance reveal (`inv.cnt.variance`) | *(readout, not a button)* | — | — | `{counted} · we expected {expected} · {variance}` | **P0** |
| K7 | Significant variance (`inv.cnt.note`) | `Add a note` | secondary | focus note | `That's a big difference. Say what happened — "two sold without a booking" or "broken in the rack".` | **P0** |
| K8 | Progress (`inv.cnt.progress`) | `Finish counting` | primary | `COUNTING → REVIEW` | `{counted} of {total} counted. {outstanding} to go.` | **P0** |
| K9 | Post (`inv.cnt.post`) | `Post count` | primary | `REVIEW → POSTED` | `{n} lines will change the ledger. Net {netVariance} {unit}, {varianceValue} at cost.` | **P0** |
| K10 | Post, nothing to post (`inv.cnt.postZero`) | `Post count` | secondary | `REVIEW → POSTED` | `Nothing on this count differs. Posting still closes it so the next one starts clean.` | **P0** |
| K11 | Stale count (`inv.cnt.stale`) | `Finish {reference}` | secondary | `/inventory/counts/{id}` | `Open since {dateLong}. {outstanding} lines left. A count doesn't change anything until it's posted.` | **P0** |
| K12 | Cancel (`inv.cnt.cancel`) | `Cancel this count` | ghost | `→ CANCELLED` | `Nothing you counted will change. Your entries are kept so you can finish it later.` | P1 |

**K10 matters.** A count with zero variance is a *successful* count and closing it resets
the cycle. Leaving it open is how the count queue fills with finished work.

**K12 says the entries are kept.** Cancelling is recoverable, and it must say so, or nobody
will cancel and every abandoned count becomes a permanent nag on the dashboard.

---

## 7. Order / reorder

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | Sidebar / dashboard (`inv.ord.open`) | `Order from suppliers` | primary | `/inventory/reorder` | `{n} to call · {formatPeso(estimatedCost)}` | **P0** |
| O2 | Group header (`inv.ord.callSupplier`, supplierId) | `Call {supplierName}` | primary | `Supplier.phone` (`tel:`) | `{n} lines · {formatPeso(groupCost)}` | **P0** |
| O3 | Group header (`inv.ord.copySheet`) | `Copy the order` | secondary | clipboard, call sheet | `Sku, quantity and unit. Paste it into the message.` | **P0** |
| O4 | Row checkbox (`inv.ord.select`, productId) | *(checkbox)* | — | — | `Suggested {suggestedQty} {unit}` | **P0** |
| O5 | Row qty (`inv.ord.qty`, productId) | *(number field)* | — | — | `Default {reorderQty} {unit}` | **P0** |
| O6 | Row (`inv.ord.markOrdered`, productId) | `Mark as ordered` | secondary | open the order panel | `Write the reference and the date so the next person knows.` | **P0** |
| O7 | Order panel (`inv.ord.saveRef`) | `Save the reference` | primary | session-only until `onOrder` ships | *below:* `Saved for today only. The system has no purchase-order record yet, so this row stays on the list.` | **P0** |
| O8 | Stockout row (`inv.ord.callOut`) | `Call about {supplierName}` | primary | `tel:` | `Nothing on the shelf. {sku} · need {reorderQty} {unit}` | **P0** |
| O9 | Empty (`inv.ord.empty`) | `Nothing to order` | tertiary | `/inventory/low` | `Every item is above its reorder point. Come back Monday.` | P2 |
| O10 | Over-order guard (`inv.ord.tooMany`) | `That is {n} {unit}. We only use about {usage30d}.` | tertiary | revert the field | `Ordering more than you sell is the fastest way to turn good stock into dead stock.` | **P0** |

**O7's honesty line is not optional and must ship with the button.** Until `onOrder` exists,
clicking it does not persist anything, and a control that looks durable and is not is worse
than no control. The line under the button is what makes it fair.

**O10 is the anti-"reorder everything" reflex, in the place the reflex happens.** It fires
on the qty field, not on a policy page.

**`usage30d` is a derived value, not a stored one.** It is the sum of `qty` across
`MovementQuery{kind:"CONSUME", from: <30 days ago>, to: today}` for that product, and it is
the number that makes O10 possible at all — without it the guard would be a policy, and
policies are what get ignored.

> **CONTRACT GAP:** `ReorderRowDto` has no usage field. A2 should add
> `used30d?: number | null` to `ReorderRowDto`. Until it exists, O10 **must not ship as a
> number** — ship it as the softer, still-true version instead: `That is {n} {unit}. Is that
> more than you usually go through?` and let the owner judge.

### The movement kinds this shop does not use

`MovementKindValue` has twelve values. This shop has one location, so `TRANSFER_IN` and
`TRANSFER_OUT` have no destination or origin, and `RESERVE`/`RELEASE` are performed by the
booking hooks rather than typed by a human. None of the four gets a receive/adjust CTA. If
a second location is ever added, both transfer kinds get a first-class flow — they are
deliberately **not** mapped onto `ADJUST_UP`/`ADJUST_DOWN` in the meantime, because an
adjustment has no counterparty and a transfer does, and conflating them loses the only
information that makes a transfer auditable.

---

## 8. The low-stock badge and the dashboard blocks

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Sidebar nav badge (`inv.badge.low`) | *(count only)* | ghost | `/inventory/low` | — | **P0** |
| D2 | Product row badge (`inv.badge.lowChip`) | `Low` · `Committed` · `Out` · `Ordered` · `Received` | ghost | product detail | — | **P0** |
| D3 | Dashboard block 1 (`inv.dash.oversold`) | `Count this line` | primary | `/inventory/counts/new?product={id}` | `Check this line — the count and the shelf disagree.` | **P0** |
| D4 | Dashboard block 1 (`inv.dash.blockedBooking`) | `Open the booking` | primary | `/admin/bookings/{id}` | `TALK TO CUSTOMER — {name}, {dateLong}. Short: {partName}.` | **P0** |
| D5 | Dashboard block 2 (`inv.dash.received`) | `See all {n} lines` | tertiary | ledger, filtered `RECEIVE` today | `Received against {references}.` | P1 |
| D6 | Dashboard block 3 (`inv.dash.lowRow`, productId) | `{sku} {name}` | ghost | product detail | `Low — {available} {unit} on hand` | **P0** |
| D7 | Dashboard block 4 (`inv.dash.countRow`) | `Finish {reference}` | secondary | `/inventory/counts/{id}` | `{counted} of {total} counted.` | **P0** |
| D8 | Low list row (`inv.low.orderIt`, productId) | `Order {reorderQty} {unit}` | primary | reorder list, row preselected | `Available {available}. We reorder at {reorderPoint}.` | **P0** |
| D9 | Low list row (`inv.low.reserveImpact`, productId) | `{reserved} are promised to bookings` | tertiary | product detail reservations | `These are customers coming in. This one is not a slow-mover problem.` | **P0** |

### The badge rules — these are not optional

1. **A badge carries colour + icon + word.** Never a coloured dot. Under deuteranopia, EYG's
   racing red and pit green are 58 RGB units apart (`DO-NOT.md` §1.2 rule 17).
2. **No `rounded-pill` on any badge.** `rounded-eyebrow`, 2px, 1px border.
3. **No badge animates.** No pulse, no flash, no count-up. `DO-NOT.md` §1.5 rules 45–50.
4. **A badge is never the only way to get to the thing.** It is an affordance and a
   summary, never a gate.
5. **The badge never changes the page layout when it appears.** Reserve the width
   (`DO-NOT.md` §1.5 rule 49, CLS = 0).
6. **`pit-*` green is never an availability badge.** Green means "done", not "in stock"
   (`OPERATOR-UX.md` §1). Rung 5 `Received` is the only green on this screen.
7. **The low badge is the count of rungs 2 and 3** — the ones that cost money today. Rung 1
   (low) is not badged in the nav; it is a list row. Badging rung 1 would put a number on
   screen that the owner cannot action and will train him to ignore the badge entirely.

---

## 9. Product detail

| # | Slot (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Detail header (`inv.prod.receive`) | `Receive` (`R`) | primary | receive dialog, product preselected | — | **P0** |
| P2 | Detail header (`inv.prod.consume`) | `Use` (`C`) | secondary | consume dialog, product preselected | — | **P0** |
| P3 | Detail header (`inv.prod.adjust`) | `Adjust` (`A`) | secondary | adjust dialog | — | **P0** |
| P4 | Detail header (`inv.prod.count`) | `Count this line` (`K`) | secondary | count dialog | `Last counted {dateLong}.` | **P0** |
| P5 | Detail header (`inv.prod.deactivate`) | `Stop selling this` | secondary | confirm | `It disappears from the finder and the services page. The ledger stays.` | P1 |
| P6 | Detail header (`inv.prod.activate`) | `Put it back` | secondary | confirm | — | P1 |
| P7 | Ledger filter (`inv.prod.ledgerFilter`) | `{MovementKind}` chips | ghost | filter ledger | — | P1 |
| P8 | Reservation (`inv.prod.release`, reservationId) | `Release {qty} {unit}` | secondary | `POST …/release` | `Held for {bookingReference} until {time}. Releasing puts it back on the shelf.` | **P0** |
| P9 | Reorder points (`inv.prod.editReorder`) | `Change reorder point` | tertiary | edit | `We warn you at {reorderPoint} {unit}. Available is {available}.` | P1 |
| P10 | Empty ledger (`inv.prod.noHistory`) | `Start receiving this item` | secondary | receive dialog | `No movements recorded yet.` | P1 |

**P5 is the retirement path and it is a feature, not a delete.** `isActive = false` is how
a size the shop will not source again leaves the customer-facing surfaces — no copy needed,
no "sorry, unavailable" state, no dead SKU in the finder. The ledger is untouched, which is
the point.

---

## 10. Customer-facing stock CTAs

These reuse the existing site map wherever one exists. **The inventory system adds no new
customer primary.** It adds three secondary/tertiary CTAs and nothing else.

| # | Surface (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | Size finder, in stock (`inv.pub.select`) | `Select this size` | primary | `/book?step=2&size={size}` | `We have {canPromise} of the {size} on the shelf.` | **P0** |
| S2 | Size finder, short (`inv.pub.selectShort`) | `Select this size` | primary | `/book?step=2&size={size}` | `We have a few of the {size}. A full set means ordering some in.` | **P0** |
| S3 | Size finder, none (`inv.pub.orderIn`) | `Order it in for me` | primary | `/book?step=2&size={size}&orderIn=1` | `No {size} on the shelf right now. We can have it by {dateLong}.` | **P0** |
| S4 | Size finder, none, no ETA (`inv.pub.callSize`) | `Call Shop Now` | emergency | `LINKS.call` | `No {size} on the shelf right now. Call us and we'll tell you what's closest.` | **P0** |
| S5 | `/services`, order-in card (`inv.pub.orderInService`) | `Select {shortName} & pick date` | primary | `/book?step=2&service={slug}` | `We can do this. We need to order one part in first — usually a day or two.` | **P0** |
| S6 | `/services`, ready card (`inv.pub.selectService`) | `Select {shortName} & pick date` | primary | `/book?step=2&service={slug}` | `In stock today. We can do this on any open day.` | **P0** |
| S7 | `/book` step 2, blocked (`inv.pub.callBlocked`) | `Call us to hold that bay` | secondary | `LINKS.call` | `We'll have {partName} by {dateLong}. Times before then need a call first.` | **P0** |
| S8 | `/book` success, set aside (`inv.pub.details`) | `See what's included` | tertiary | disclosure | `We've set aside the parts for this job.` | P1 |
| S9 | Order-in waitlist (`inv.pub.tellMe`) | `Text me when it lands` | secondary | lead capture | `One message on the day it arrives. Then we stop.` | P1 |

**S5/S6's CTA is unchanged from the existing site map.** This is deliberate: the availability
line is *information about* the service, and the customer's action is identical whether or
not the shop has the part today. Changing the button when stock is short would teach
customers that a stock line means a different deal.

**S3 is P0 only when an ETA exists.** Without the `expectedAt` contract field there is no
honest `Order it in for me` and the surface ships S4 instead (`TRUST-MESSAGES.md` §3,
CONTRACT GAP).

---

## 11. Frequency caps (INV-FC)

| ID | Rule | Enforcement |
| --- | --- | --- |
| **INV-FC-1** | **Never two sticky surfaces on `/inventory`.** Candidates: the command bar, the receive footer, the count footer. Priority on collision: receive footer > count footer > command bar. One owner, resolved in render — a z-index decision is not a decision. | same `useStickyOwner()` hook as the site's FC-1 |
| **INV-FC-2** | **One destructive commit per screen.** An adjust screen never shows a receive commit. | render guard |
| **INV-FC-3** | **No CTA in the first 400 ms after a route change.** | `useDelayedMount(400)`, as the site |
| **INV-FC-4** | **No `cta_id` twice in one viewport.** Suffixes are not allowed — the id is a type. | build-time check |
| **INV-FC-5** | **One phone CTA per inventory screen, maximum.** The phone is for customers; an operator tool that offers two competing `tel:` links has lost its point. | render guard |
| **INV-FC-6** | **A commit button is disabled for the duration of its request and re-labelled from the server's answer.** No optimistic stock write, ever (A3's brief). | the server response replaces the label |

---

## 12. Anti-patterns — refused, with the replacement designed

| Refused | Why it is a dark pattern or an operational trap | What ships instead |
| --- | --- | --- |
| `Only 2 left!` on a tyre size | Manufactured scarcity. A customer who arrives and finds 5 free bays learns we lie about everything, including the price. | `We have 2 of the 205/55 R16 on the shelf.` — and only when `canPromise ≥ 2 × qtyNeeded`, at which point the promise is real |
| A countdown on the parts hold | A resetting timer on a promise teaches the customer the countdown is theatre. | `We hold parts for 24 hours after you book.` — a fact, on the staff side a live clock |
| `Save` / `Confirm` / `Update` on a stock write | Says nothing about what happens, and invites the double-tap the idempotency key exists to absorb | `Receive 24 → 28` |
| A modal confirmation dialog on every stock write | Reading is what gets skipped when a customer is in the bay. It also blocks the one screen that must work on a phone. | The consequence is in the button label. `Hold to remove 2 → 2` for destructive writes |
| A reason field with a "Skip" link | A mandatory reason that can be skipped is not mandatory, and the ledger's whole value is the reason | Preset chips first, free text required, `Because` rejected by the same rule the contract states |
| Hiding `costPrice` from staff | The brief is explicit, and an operator who cannot see cost cannot tell a pricing error from a stock error | Cost and margin on every staff stock surface; never on a customer one |
| "Order everything" as a bulk reorder button | It is the reflex that kills tyre margin: dead stock in a small shop is cash that cannot buy the tyre the customer is asking for | Per-row selection, `suggestedQty` prefilled, and O10's usage guard on the qty field |
| Greying out a booking step because a blocking part is short | Blocks revenue on a supply problem the shop can solve with a phone call | Route 1/2/3 from `SHORTFALL-COPY.md`. The bay calendar is never touched |
| Greying out date slots before an ETA | Two availability systems fighting; the bay calendar is not the parts ledger | One line above the slot grid (`S7`) |
| Hiding a still-low row because someone said "I ordered it" | The day the order is late, nothing anywhere says the shop is short | The row stays until a `RECEIVE` posts (`OPERATOR-UX.md` §3.3) |
| A notification per low item | Cry wolf. The channel is muted and then rung 0 — a real oversell — is muted too | One 06:00 digest, rungs 0/2/3 only (`OPERATOR-UX.md` §4.3) |
| A `Delete product` button | A deleted product deletes its movements (cascade) and the history that defends the number | `Stop selling this` (`isActive = false`). The ledger is append-only |
| `Inventory low!` in red with a `circle-alert` | Rung 1 is not an error. Red is reserved for errors, and using it on a normal Tuesday teaches the eye to stop seeing red | A flat 2px chip reading `Low`, no colour |
| A disabled primary with `Coming soon` | A button that leads nowhere is a promise the business does not keep | Every CTA resolves to a route, a `tel:`/`m.me` link, or a documented POST |
| A badge that pulses or animates | `DO-NOT.md` §1.5 rule 47 — a pulsing badge becomes background noise and stops being read | Static chip, colour + icon + word |

---

## 13. QA checklist

- [ ] Every `cta_id` in this file is present in the DOM with the exact label, at least once
      per route it belongs to.
- [ ] Every stock-write button label contains a quantity and an `→` and its result.
- [ ] No `rounded-pill`, `blur-*`, or `/15`-opacity wash on any chip or badge.
- [ ] Every badge has colour + icon + word and survives a greyscale print.
- [ ] INV-FC-1 holds at 360 px and 1280 px.
- [ ] No `optimistic` stock write anywhere (`grep -r "onHand +"` on inventory components).
- [ ] INV-FC-6: a commit button is disabled in flight and re-labelled from the response.
- [ ] No badge appears or disappears in a way that shifts layout.
- [ ] No cost, margin, supplier, `reorderPoint` or `reorderQty` field is reachable from any
      `cta_id` prefixed `inv.pub.` — assert it on the public bundle, not by reading the JSX.
- [ ] Every customer-facing stock CTA is `secondary` or lower except the size-finder
      `primary` (`S1`–`S3`), which is already the surface's single primary.
- [ ] Grep the customer bundle for: `Only`, `left!`, `Hurry`, `Limited`, `Out of stock`,
      `!`.