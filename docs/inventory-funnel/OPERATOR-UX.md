# OPERATOR UX — the 6am loop

**Owner:** funnel agent (A5) · **Audience:** the mechanic on the bay floor, the owner in the
back office, the staff member on the phone
**Contract:** `StockLevelDto`, `ProductDto`, `MovementDto`, `ReservationDto`, `ReorderRowDto`,
`StockCountDto`, `StockMovementKind`, `StockCountStatus`
**Contract read for context:** `Product.cycleCountDays`, `Product.reorderPoint`,
`Product.reorderQty`, `StockCountLine.expected`, `StockLevel.updatedAt`

---

## 0. The loop, and who is standing in it

```
open the app  →  know what's low  →  order  →  receive  →  sell
```

Five steps, and the design has one job: **make step 2 take under thirty seconds for the
items that matter, and make step 4 completable with one hand while a customer waits.**

The mechanic is not a data analyst at 6am. They are standing in front of a rack with a
delivery docket in one hand and a customer asking whether their car can go in at nine.
Everything below is written for that person.

---

## 1. The dashboard — what is on it, in what order

`/inventory`, default view. Four blocks, in this order, and the order is the argument.

| # | Block | Source | Renders when |
| --- | --- | --- | --- |
| **1** | **Needs a decision** | `isOversold`, and `blocked` blockers on bookings in the next 3 days | only if non-empty |
| **2** | **Landing today** | `MovementDto` where `kind === "RECEIVE"` and `createdAt` is today | only if non-empty |
| **3** | **Low** | `ReorderRowDto` | always (empty state in `ERROR-AND-EMPTY-STATES.md` §3) |
| **4** | **Counts in progress** | `StockCountDto` where `status ∈ {DRAFT, COUNTING, REVIEW}` | always |

**Block 1 is first because it is the only block that costs money today.** A car on a lift
with no part is the shop's expensive minute. Everything else can wait until 8am.

**Block 1's contents, exactly two things:**

- `isOversold === true` on any product. This means the invariant has been broken and the
  ledger is lying. It is the one thing on this screen that is an **error**, and it is the
  only thing permitted to use red (`racing-600` light / `racing-400` dark, per
  `ACCESSIBILITY-SPEC.md` §1.1) with a `circle-alert` icon and the word `Check this line`.
- Any booking in the next 3 days with a blocking short (`ReserveResult.blocked === true`),
  with the part and the short count. Copy:
  `TALK TO CUSTOMER — {name}, {dateLong}, {serviceName}. Short: {partName}.`

That second row is the human handoff. The system cannot decide whether to move a booking;
it can only refuse to let anyone forget.

### What is deliberately NOT on it

| Absent | Why |
| --- | --- |
| **Margin % and gross profit** | Two reasons, both real. (1) The person who needs it is the owner, and he reads it Monday, not at 6am with a delivery in hand. (2) Putting margin next to availability invites "don't stock that" decided on margin alone — and **range is the shop's moat.** A shop that only carries the fat-margin tyre has no answer when a customer asks for the size they actually drive on. |
| **Stock valuation (retail or cost)** | A number that cannot change a decision this morning. Monthly at most, in the review. |
| **Supplier scorecards** (lead time, fill rate) | **CONTRACT GAP.** There is no `PurchaseOrder`, so there is no order history to compute a lead time from. A scorecard computed from nothing is a fabricated number on an owner's screen — the exact thing `docs/brand/DO-NOT.md` §1.4 forbids. Ship the block when the data exists. |
| **Days of cover, stock velocity, charts** | `reorderPoint` *is* the owner's encoded judgement about cover. Showing a computed cover number next to it starts a debate the owner has already settled, in the wrong direction. |
| **Revenue, bookings, conversion** | A different system answering a different question. |
| **An activity feed** | The ledger **is** the activity feed and it is filterable. A feed is what apps show when they have nothing to say. |
| **Anything with a % change vs last week** | A kind can have zero movements for a week. `−87%` renders as a crisis and it is a Tuesday. |
| **A per-item notification** | See §4.3. |
| **A customer-facing stock number** | Any of it. See `TRUST-MESSAGES.md` R7 and `DO-DONT.md` §4. |

---

## 2. What a mechanic never sees

- **Any cost, margin, or supplier field on a customer surface** — including a booking panel
  that a customer can see over a shoulder. The staff panel shows `costPrice` and `marginPct`;
  the quote shows `sellPrice`. Those are two different objects and they must never be the
  same payload.
- **A confirmation dialog for a stock write.** See §5.4.
- **A spinner over 400 ms.** Skeletons on load, a determinate bar on submit, then the
  server's answer (`ERROR-AND-EMPTY-STATES.md` §1).

---

## 3. The reorder flow — suggestion → purchase → receive

### 3.1 Where a suggestion comes from

`ReorderRowDto` is produced from `isLow`, which is `available <= reorderPoint`. Two things
fall out of that, and both are load-bearing:

1. **A failed reservation automatically creates a reorder row.** `available` is what a
   promise is made against, so the moment a promise is at risk the row appears. The
   customer who was blocked *is* the reorder suggestion. Nothing has to notice the
   relationship.
2. **The owner controls the trigger.** `reorderPoint` is his judgement, not the system's.
   The system never decides "this is too low" on its own.

### 3.2 The suggestion → the purchase

The reorder screen is a **working list, not an order-entry system.** Three facts per row:

| Column | Field | Note |
| --- | --- | --- |
| What | `sku`, `name`, `size` | `size` first for anything with a size — that is how a mechanic thinks |
| How little | `available` vs `reorderPoint` | `2 left · we reorder at 3` |
| How much | `suggestedQty` (A2's arithmetic) and `reorderQty` | the owner's default, editable per row |
| Who from | `supplierName`, `supplierId` | grouped by supplier, because one phone call covers a group |
| What it costs | `estimatedCost`, `costPrice` — **staff only** | the total is the number the owner actually needs |
| Hard | `isStockout` | out of stock on the shelf, as opposed to low |

**The row action is `Call {supplierName}`** with the phone number from `Supplier.phone`, a
`tel:` link, and the line list on screen — sku, suggested qty, unit. A phone call is how
this shop buys. A "generate purchase order" PDF is not.

### 3.3 `Mark as ordered` — and what it can honestly do today

`reorderPoint`, `supplierId` and the whole reorder model exist; **a purchase order does
not.** `PurchaseOrder` is not in `schema.prisma`. So the honest design has two halves.

**Today (no contract change):**

`Mark as ordered` does **not** hide the row. It opens a small panel where the person who
made the call types the **reference** (PO number or the distributor's job number) and the
**expected date**, and it renders a copyable call sheet with those lines. It stores nothing
durable, it says so, and the row **stays on the list** in an `Asked {supplierName}` state
for the session only.

Why the row stays: if the system hid a still-low item because someone said "I ordered it",
then the day that order is late or lost, **nothing anywhere says the shop is short.** A
repeated low row is an annoyance. A missing one is a customer at the counter with a wheel
off.

**Once A2 ships `onOrder` + a purchase-order model:** the row moves to rung 4 of the
ladder (§4), the reference and ETA persist, and `available + onOrder` can be shown as
`2 on hand · 8 on order · arrives {date}`. That is the correct long-term display and it is
one column wider.

### 3.4 Receive — the step that has to be fast

The 6am loop's payoff. **This is the screen that must work with one hand on a phone.**

```
R E C E I V E   —   invoice {reference}

  [ search: sku · name · size · barcode ]   ← auto-focused, never autofocus-on-load
  ─────────────────────────────────────────────────────────────
   row 1   OIL-FLT-015   Engine oil filter · EA
           24   →   Receive 24 → 28          ← Enter commits and advances
  row 2   BRK-PAD-VX75-F  Brake pad set · SET
           2    →   Receive 2 → 4
  ─────────────────────────────────────────────────────
           [ Post all 3 lines ]
```

Rules, all of them load-bearing:

| Rule | Why |
| --- | --- |
| One invoice number, entered once, applies to every line as `PostMovementInput.reference` | the supplier invoice is the only thing that makes a ledger row reconcilable six weeks later |
| Each line commits independently with its own `idempotencyKey` | a network drop on line 3 must not lose lines 1 and 2 |
| **The commit button carries the consequence in its own label:** `Receive 24 → 28` | the number after the arrow is the server's `onHandAfter`, and seeing it *before* committing is the whole before→after requirement |
| No confirmation dialog | see §5.4 |
| Reason is a preset list per kind (`Delivery — supplier invoice`) plus a free field | a mandatory reason that takes typing is a mandatory reason that gets typed as "ok" |
| Unit is shown on every quantity, always | 4 oil filters is 4; a set of 5 pads is not 5 pads |
| `LITRE` products take a decimal and show the container | `4.2 L`, never `4` |

**Receipt is never blocked by an open count.** Receiving adds to `onHand` and the count's
`expected` snapshot deliberately does not move — it is history. The screen says so on the
line before you commit:

> `Counted on {date} as {counted}. Posting will show a variance of {+n}.`

That note is the difference between a variance a human understands and a variance the owner
stops trusting.

### 3.5 The middle of the loop is the gap

The ledger **is** durable on both ends — `isLow` on one side, `RECEIVE` with a `reference`
on the other. The only missing piece is the middle: *ordered, not yet arrived*. That is why
§3.3 keeps the row visible. The Monday question *"what has been low for a week and nobody
ordered?"* (§7 Q3) is answerable **today** from the ledger alone — that is the workaround,
and it is a real answer, not a consolation prize.

---

## 4. The escalation ladder — a calm signal, not an alarm

### 4.1 The premise

A shop that cries wolf gets ignored, and then it ignores a real fire. The mechanism is
specific: **the notification channel is a shared resource with a low tolerance.** If a
mechanic receives nine low-stock messages on Tuesday, rung 0 — a genuine oversell — is
muted by Wednesday, and the oversell is the one that costs a customer.

### 4.2 The ladder

Monotone in urgency. Each rung has exactly **one** owner action; a rung with two readings is
a rung that gets misread.

| Rung | State | Condition (grounded) | Line the operator sees | Owner action | Voice |
| --- | --- | --- | --- | --- | --- |
| **0** | **The number is wrong** | `StockLevelDto.isOversold === true` | `Check this line — the count and the shelf disagree.` | Count this one line today | **error**: `circle-alert` + red + the word `Check this line` |
| **1** | **At the reorder point** | `isLow && available > 0` | `Low — {available} {unit} on hand` | Order it this week | **flat**: no colour, no icon, no alarm. A chip reading `Low` |
| **2** | **Committed but empty** | `available === 0 && reserved > 0` | `All {reserved} {unit} set aside for bookings. Nothing spare.` | Order it today — this one is selling out | flat chip, `circle-lock`, word `Committed` |
| **3** | **Out of stock** | `available === 0 && reserved === 0` | `Nothing on the shelf.` | Order it today | flat chip, `circle-slash`, word `Out` |
| **4** | **On order** | *(CONTRACT GAP: `onOrder`)* | `Ordered {reference} · expect {dateLong}` | Chase it if the date passes | `clock` + word `Ordered` |
| **5** | **Arrived** | a `RECEIVE` movement exists | `Received {qty} {unit} · {reference}` | Check it against the invoice | `circle-check` + word `Received` |

**Rungs 2 and 3 are the pair that matters.** `available === 0` with `reserved > 0` means the
shop is selling a part it does not have, on bookings already confirmed. That is a different
problem from an empty shelf and it needs a different response, so it gets a different line.
Collapsing them into "out of stock" loses the only signal that predicts a disappointed
customer.

### 4.3 How often it speaks

| Rung | Surfaces as | Notifies? |
| --- | --- | --- |
| 0 | Block 1 on the dashboard, always, at the top | **yes** — immediately, once |
| 1 | Block 3 list row | **never.** It is a row in a list, not an event. |
| 2 | Block 3 list row, sorted above rung 1 | **yes** — in the daily digest only |
| 3 | Block 3 list row, sorted to the top | **yes** — in the daily digest only |
| 4 | Block 3 list row | no |
| 5 | Block 2 (`Landing today`) | no — it is already visible on the dashboard |

**One digest, one moment.** `/api/cron/reorder` at **06:00 Asia/Manila**, one message, only
rungs 0, 2 and 3. Everything else lives in the app and waits for a human to look at it.
Rung 0 is the single exception to "digest only", because a broken invariant is not a
condition, it is a bug, and a bug should be loud.

`notifyLowStock` is a **new function in `src/lib/integrations/notify.ts`** (A2's file). It
follows the shape of `notifyNewLeadAlert`: queued, one message per run, deduplicated by
`(productId, rung, date)` so a rerun of the cron does not send twice.

### 4.4 The anti-cry-wolf rules

1. **Rung 1 never notifies.** If every low item pinged the owner, the owner would be
   responsible for 30 items at 6am, and he would turn them off.
2. **A rung changes only when the underlying number changes.** No "getting worse" badge, no
   age counter, no escalation because time passed. The ladder is a function of `available`,
   not of anxiety.
3. **Dedupe per product per day per rung.** A cron rerun is not a new event.
4. **The digest is capped at 12 rows**, sorted by `isStockout`, then by `available` ascending.
   The rest is a count: `and 18 more on the list.` — the message's job is to make the owner
   open the app, not to be the app.
5. **Reorder points are reviewed monthly** (Monday Q5, §7). A rung the owner never acts on
   is a rung that is set wrong, and the fix is the number, not the notification.

---

## 5. Counting

### 5.1 Why cycle counting, and why it works here

A shop with a Friday closing and a Saturday closing and a Sunday closed has a full day a
week with no bay, no customer and no revenue. **That day is the count day.** An annual
stocktake is not a discipline problem in a small shop, it is a *closure*: you either close on
the day, or you count from memory in January and are wrong by March.

Cycle counting keeps every line within one count-cycle of the shelf, using the idle day, and
it produces a variance trail instead of one unexplained number in December.

### 5.2 The rhythm

| Rule | Value | Grounded in |
| --- | --- | --- |
| Count cadence is per product, set by the owner | `cycleCountDays`: `7` fast movers, `30` slow movers, `0` never (tools, one-off sizes) | `Product.cycleCountDays`, whose own comment says `0 = never` |
| The count queue is every product where `cycleCountDays > 0` **and** `StockLevel.updatedAt` is older than that | — | both fields exist |
| Day | **Sunday.** 90 minutes, aisle by aisle | `BUSINESS_HOURS` — closed Sunday |
| Order of work | Physical aisle order, **not** alphabetical | counting in shelf order is the only order a walk takes |
| Scope options | `all`, a `ProductKind`, or a single product | `CreateCountInput.scope` |
| Reference | `COUNT-{date}-{n}` via `makeReference("COUNT")` | existing helper |

### 5.3 The blind count — the whole point of `expected`

`StockCountLine.expected` is *snapshotted at creation* so that a concurrent sale cannot
silently rewrite history (the schema says exactly this). A count that shows the expected
number while the counter is counting is therefore a count that has wasted the snapshot.

**Design rule: `expected` is hidden until the line is submitted.**

| Stage | The counter sees | The counter does not see |
| --- | --- | --- |
| Counting | sku, name, size, unit, an empty number field | `expected` |
| On submit | the variance appears immediately: `3 · we expected 5 · −2` | — |
| `REVIEW` | the full list of `isSignificant` lines, each needing a note | — |

This is a real behavioural difference and it is worth the two lines of UI: a counter who
sees "5" will often find 5.

### 5.4 Variance policy — the cure for count-then-forget

1. **A count is not done until it is posted.** A count sitting in `COUNTING` changes
   nothing — not `available`, not the reorder list, not the promise. The dashboard's
   block 4 exists to make that unmissable.
2. **Every `isSignificant` line needs a note before `REVIEW → POSTED`.** Copy: `Say what
   happened. "Two sold without a booking" or "Broken in the rack".` A variance without a
   written reason is either a bug or a loss, and both deserve a name attached.
3. **An unreviewed count older than 7 days escalates to the owner** with a date on it:
   `{reference} has been open since {dateLong}. {outstanding} lines still to count.`
4. **Posting twice is refused, not repeated** — see `ERROR-AND-EMPTY-STATES.md` §2.1.

### 5.5 No confirmation dialog for a stock write

A dialog with a sentence in it is a thing you must read, and reading is what gets skipped
when there is a customer in the bay. **The commit control carries its own consequence in
its label:**

| Action | Button label |
| --- | --- |
| Receive 24 into a line at 4 | `Receive 24 → 28` |
| Adjust down 2 | `Remove 2 → 2` |
| Adjust up 1 | `Add 1 → 5` |
| Shrink 1 (damage, evaporation, a bust gasket) | `Write off 1 → 3` |

The arrow number is `onHandAfter`, computed from the server's last confirmed value plus the
typed quantity, and it is replaced by the server's answer on commit. A destructive write
still takes a reason and a second deliberate press — `Hold to remove 2 → 2` — because the
danger there is real, and the confirmation *is* the label.

---

## 6. The 6am screen, second by second

| Second | What happens |
| --- | --- |
| 0 | `/inventory` opens. Skeleton for the list, then rows. No landing page, no tour, no "what's new". |
| 2 | Block 1 read. If rung 0 exists, the operator already knows the day has a problem. |
| 5 | `R` opens **Receive**, search auto-focused, invoice reference remembered from the last one this week (`sessionStorage`, never a server field). |
| 40 | Twelve lines entered with Enter. `Post all 12 lines`. The ledger writes. Block 2 fills in. |
| 90 | Block 3 read. `↑ ↓` to the first supplier group, `C` to call them. |
| 120 | Phone call made with the line list on screen. |
| 8:00am | The shop opens. Every blocking part is either on the shelf or on a list the owner has seen. |

---

## 7. The six questions the owner answers every Monday

Twenty minutes, Sunday afternoon or Monday 6am, from the app. Each one is answerable from
the contract **today**.

| # | Question | Where it is answered | The number that matters |
| --- | --- | --- | --- |
| **1** | **What couldn't we promise this week?** | Bookings with `blocked === true`, grouped by `blockers[].name` | count of blocked bookings, and the top blocking part. A part that appears three weeks running is a **range** decision, not a stock decision |
| **2** | **What came in, and did it match?** | Block 2 + `MovementDto` where `kind === "RECEIVE"` | lines received vs lines received *with* a `reference`. A supplier whose invoices are missing a reference is a supplier the owner cannot argue with |
| **3** | **What has been low for a week and nobody ordered?** | `ReorderRowDto` with no matching `RECEIVE` in the last 7 days | the count. This is the ledger standing in for the missing purchase-order table (§3.3). Non-zero every Monday means the 06:00 digest is not being read |
| **4** | **What did we lose?** | Posted `StockCountDto.summary`: `netVariance`, `varianceValue`, `variances` | `varianceValue` in pesos, and the top 5 absolute variances with their line notes. Rising `|netVariance|` on one product is a process problem, not a theft |
| **5** | **Which sizes keep running out?** | `CONSUME` movements per product over 30 days vs `reorderPoint` | the run-rate list. Each row: *carry more* (raise `reorderPoint`), *carry it* (it is fast and the gaps are small), or *stop carrying it and order it in on demand* — the last is the correct answer far more often than a shop admits |
| **6** | **Are we selling at the price we think?** | `ProductDto.sellPrice` vs `Product.minSellPrice`; `marginPct` on the stock list | count of products below the floor, and count of movements that were refused for price rather than for stock. A refusal is a feature; a silent sale under the floor is not |

**Question 5 is the one that grows the shop.** Questions 1, 3 and 4 keep the shelves
honest. Question 5 decides what the shop *is* — and it is the only one whose answer is
usually "stock fewer things, better".

---

## 8. One-handed rules for the floor

| Rule | Detail |
| --- | --- |
| Any stock write is ≤ 2 taps from `/inventory` | `R` receive, `C` consume, `A` adjust, `K` count — all single keys |
| All controls ≥ 44 × 44 px, thumb-reachable | `DO-NOT.md` §1.6 rule 57 |
| No horizontal scrolling in the receive flow | the docket is the phone's whole job |
| Quantity input opens the numeric keypad | `inputmode="numeric"`, integers and decimals for `LITRE` |
| **Never optimistic on a stock write** | the local number stays, a pending label appears, and the server's `stock` replaces it. Never show `onHand + qty` as though it were the answer |
| A failed write leaves the form exactly as typed | the mechanic re-presses; they do not re-type |
| The search field takes sku, name, size and barcode in one box | a mechanic does not know which of the four they are holding |
| `/` focuses search from anywhere in `/inventory`; `Esc` clears it | `KEYBOARD-MAP.md` |
| The dashboard is never a modal and never traps focus | `DO-NOT.md` §1.6 rule 53 |
