# ERROR, EMPTY & EDGE STATES — the inventory system

**Owner:** funnel agent (A5) · **Applies to:** `/inventory/**`, the availability surfaces on
`/services` and `/book`, and the booking staff panel.
**Base pattern:** `docs/funnel/ERROR-AND-EDGE-STATES.md`. This file is an **extension**, not a
replacement — §0 of the base document still governs anything not restated here.
**Contract:** `MovementRefusalReason`, `PostMovementRejection`, `ReserveResult`,
`ReservationStatusValue`, `StockCountStatusValue`, `CountLineDto`, `StockLevelDto`

Every row has five parts: **trigger → what the user sees → exact copy → recovery →
telemetry**. A state without a recovery is a dead end, and on a shop floor a dead end costs
a bay-hour.

---

## 0. Principles

1. **A refusal states a number.** `PostMovementRejection` carries `available` and
   `requested` for exactly this. The string `failed` does not appear in this system, in any
   state, for any audience.
2. **The typed number survives.** Every failed stock write leaves the quantity field exactly
   as the operator typed it. Re-pressing the button re-sends it with the **same
   `idempotencyKey`**.
3. **The ledger is never wrong because a UI was wrong.** A refused move writes nothing. An
   empty state writes nothing. An error state writes nothing.
4. **No stock write is optimistic** (A3's brief). The number on screen is the server's last
   confirmed value until the server answers.
5. **Skeleton for load, determinate bar for submit, error state at 6 s.** No spinner over
   400 ms (`ERROR-AND-EDGE-STATES.md` §2, which also fixes the timings: 400 ms minimum so
   it does not flash, 6 000 ms maximum before the error state takes over).
6. **An empty state is not an error.** No red, no warning icon, no `0 results` styling.
7. **Rung 0 (`isOversold`) blocks the controls, not the screen.** You can look at a broken
   line; you cannot change it until it is counted.

---

## 1. Refusals — every `MovementRefusalReason`

### 1.1 `INSUFFICIENT_STOCK`

| Field | Value |
| --- | --- |
| **Trigger** | `kind ∈ {CONSUME, ADJUST_DOWN, SHRINK, TRANSFER_OUT, RETURN_TO_SUPPLIER}` where `onHand − reserved < qty` |
| **User sees** | The commit button is replaced in place by two buttons on the same row. No dialog. The committed label is struck through and greyed, not removed, so the operator can see what they tried. Focus moves to the first replacement. |
| **Copy** | heading: `Only {available} {unit} on hand. You asked for {requested}.` · buttons: `Use {available} instead` · `Write this off instead` · below, on the row: `{diff} {unit} promised to {bookings}` if `reserved > 0` |
| **Zero-stock variant** | `There's nothing of {sku} on the shelf. It needs ordering, not adjusting.` · single button: `Order it` → reorder list with the row preselected |
| **Recovery** | `Use {available} instead` resubmits with `qty = available` and a **new** idempotency key · `Write this off instead` opens the adjust dialog pre-set to `SHRINK` for `{diff}` with the reason carried across · `Order it` |
| **Telemetry** | `stock_move_refused{reason:"INSUFFICIENT_STOCK", product_kind, has_reservations}` |
| **Never** | `failed` · `Error` · a red toast that disappears after 4 s · clamping `qty` down silently · **re-firing the original `idempotencyKey` on a changed quantity**, which would return the original refusal forever |

### 1.2 `NEGATIVE_QUANTITY` · `ZERO_QUANTITY`

| Field | Value |
| --- | --- |
| **Trigger** | client-side validation, before the request |
| **User sees** | Inline field error, `aria-invalid`, `circle-alert` + text. The commit button is disabled. |
| **Copy** | negative: `That's a negative number. Enter how many are actually there.` · zero/blank: `Enter a number first.` |
| **Recovery** | fix and commit |
| **Telemetry** | `stock_input_rejected{field:"qty", kind:"negative" \| "zero"}` |
| **Never** | A number field that accepts a minus sign and silently coerces it to 0 — A3's brief forbids this and a `-` keystroke on a numeric keypad is a fat-finger, not an intent |

### 1.3 `PRODUCT_INACTIVE`

| Field | Value |
| --- | --- |
| **Trigger** | Any write to a product with `isActive === false` — including a **consume** on a job that started before the product was retired |
| **User sees** | The row renders with a flat `Not sold` chip (`rounded-eyebrow`, no colour). The write buttons are replaced by one link: `Put it back` |
| **Copy** | `{sku} is not being sold any more. Put it back first if you mean to change it.` · link: `Put it back` |
| **Recovery** | `Put it back` (P1, `CTMAP.md` P6) → re-activates → the write becomes possible. **Or** finish the job with the part physically on the shelf and record it as `ADJUST_UP` after re-activation. Note the order: the job does not wait for the flag |
| **Telemetry** | `stock_move_refused{reason:"PRODUCT_INACTIVE"}` |
| **Never** | Blocking the job indefinitely over a flag. A car is on the lift |

### 1.4 `OPENING_ALREADY_SET`

| Field | Value |
| --- | --- |
| **Trigger** | `kind === "OPENING"` on a product that already has stock |
| **User sees** | Inline error under the opening field, with the existing state in full |
| **Copy** | `{sku} already has a starting count of {onHand} {unit}. Adjust it instead of setting it again.` · link: `Adjust it` |
| **Recovery** | `Adjust it` → adjust dialog |
| **Telemetry** | `stock_move_refused{reason:"OPENING_ALREADY_SET"}` |

### 1.5 `INSUFFICIENT_AVAILABLE` — the reservation race

| Field | Value |
| --- | --- |
| **Trigger** | `POST /api/inventory/reserve` where `available < qty`. This is **another customer**, not a bad system |
| **User sees — customer** | The date strip is refetched, the slot that was just lost is removed, and the state is the existing `book.slot-race-see-others`. The inventory claim is dropped, not restated: no `setAside` line is rendered |
| **User sees — staff** | The booking panel shows the shortfall and the two routes (`SHORTFALL-COPY.md` §5) |
| **Copy — customer** | `That time just went. Pick another one — nothing was booked.` + `See other times on {date}` |
| **Copy — staff** | `Someone booked the last {unit} while this screen was open. {available} left.` · `Short {short} {unit} · blocking` |
| **Recovery** | customer: `See other times on {date}` · `Call us to hold that bay` · staff: Route 1 / 2 / 3 |
| **Telemetry** | `stock_reserve_refused{reason:"INSUFFICIENT_AVAILABLE", product_kind, blocking}` **plus** `booking_completed{blocked:true, shortfall_count, shortfall_blocking_count}` — this is the metric that answers `METRICS.md` §4 |
| **Never** | Showing the still-held number to the customer. Offering the slot with a warning on it — the bay and the parts are two different books |

### 1.6 An idempotent replay — not an error

| Field | Value |
| --- | --- |
| **Trigger** | `PostMovementResult.replayed === true` — the same `idempotencyKey` was already committed |
| **User sees** | The **original** result, exactly as it was, with one extra line. This is the contract's stated behaviour and it is the reason double-tapping is safe |
| **Copy** | `That already went in {timeAgo}. Here's what it did.` · below: `Posted {qty} {unit}. {sku} was {onHandAfter} {unit} afterwards.` |
| **Recovery** | None needed. The button returns to idle. **Do not** offer a retry — a retry here is a double-write attempt |
| **Telemetry** | `stock_move_replayed{kind}` |
| **Never** | Showing this as an error. Showing it as success with no acknowledgement — the operator needs to know the shelf already moved, or they will post again |

---

## 2. The dangerous edges

### 2.1 A reservation expires mid-job

**The worst case in this system**: the car is on the lift, the hold expired an hour ago, and
another booking took the last oil filter.

| Field | Value |
| --- | --- |
| **Trigger** | `Reservation.expiresAt < now` while the booking is `CHECKED_IN` or `IN_PROGRESS`, or a cron sweep sets `status = "EXPIRED"` |
| **User sees** | The booking panel reservation row flips to `Hold expired`, and — **only if a blocking part is now short** — a `TALK TO CUSTOMER` row appears on the dashboard, top block. If nothing is short, nothing appears: an expired hold on a part that was consumed is a non-event |
| **Copy** | `The hold on {sku} expired at {time}. {n} {unit} went back on the shelf.` · if short: `This booking reserved {reserved} {unit} of {sku}. That hold expired at {time} and {available} {unit} are left.` · dashboard: `TALK TO CUSTOMER — {name}, {dateLong}. Short: {partName}.` |
| **Recovery** | Re-hold from the panel (`Reserved` → `Reserve again`, P0) if stock allows · Route 1/2/3 · Route 3 with **no** conversation needed if the missing part was non-blocking |
| **Telemetry** | `reservation_expired{mid_job:true, blocking, product_kind}` + `booking_parts_short{mid_job:true}` |
| **Never** | Consuming against an expired hold silently. Consuming anyway because the part is physically on the shelf and the customer is waiting — that is a real situation and the honest record of it is an `ADJUST_UP` with `reason: "Hold expired, part still on shelf, booked in by {actorName}"`, **not** a consume against a dead reservation |
| **Design note** | The expiry sweep runs on `/api/cron/tick`. A mid-job expiry is not a system failure; it is a TTL doing its job. The UX obligation is that a human sees it before the customer does |

### 2.2 A product is deactivated while it is reserved

| Field | Value |
| --- | --- |
| **Trigger** | `isActive` flipped to `false` while `Reservation.status === "HELD"` for it |
| **User sees** | The reservation row stays, with an added flat chip `Not sold`. The hold is **not** auto-released and **nothing** is consumed |
| **Copy** | `{sku} was taken off the list while it was set aside for {bookingReference}. The hold stays; nothing was consumed.` · and on the product: `It's still promised to {n} booking(s). Retire it after those jobs are done, or release them.` |
| **Recovery** | `Finish the job first` (stay) · `Release {qty} {unit}` · `Put it back` |
| **Telemetry** | `product_deactivated_with_reservations{count}` — a standing data-quality alarm for the owner |
| **Never** | Deleting the product. Cascade would take the movements with it (§3 of `DO-NOT.md`) |

### 2.3 A count is posted twice

| Field | Value |
| --- | --- |
| **Trigger** | `POST` on a `StockCount` whose `status` is already `POSTED` or `CANCELLED` |
| **User sees** | The count screen switches to a read-only posted view. The post button does not come back. |
| **Copy** | `This count was already posted on {dateLong}. Nothing was changed twice.` · below: `{reference} · {summary} net {netVariance} {unit}` · link: `See the ledger` |
| **Recovery** | `See the ledger` (filtered to that count's products) · `Start a count` |
| **Telemetry** | `stock_count_post_twice{reference_hash, status}` |
| **Never** | Re-applying the adjustments. Showing a second success toast. Reporting the count as posted when the server returned a refusal |

### 2.4 Two staff adjust the same product at once

**This is a normal Tuesday, not an error.** The conditional `UPDATE` serialises both writes;
what the UI must solve is that the *label* lied.

| Scenario | What the user sees | Copy | Recovery |
| --- | --- | --- | --- |
| **Both succeed, serially** — B's `ADJUST_UP 2` lands after A's | B's committed line is replaced with the server's answer, and a quiet reconciliation line appears. Not an error state, not a toast | `Someone else changed this while you were typing. Your {qty} went on top — it's {onHandAfter} {unit} now, not {predicted}.` | none required; the number is right |
| **One is refused** (B tries to remove more than remains) | §1.1 | as §1.1 | as §1.1 |
| **Both are refused** (`isOversold` already) | §2.5 | | |
| **Client detects staleness first** (B's screen is >60 s old and the poll shows a different `onHand`) | An inline non-blocking strip above the dialog, `role="status"` | `Someone else changed {sku} while this was open. It was {onHandAtOpen} {unit}, it's {onHand} {unit} now. Your number is still here — check it before you post.` | continue, or `Use the current number` |
| **Server returns a version conflict** (A2's choice) | as the row above, with the server's `stock` | `Someone else changed this while you were typing. Here's the current number: {onHand} {unit}.` | `Use {onHand}` re-fills the field |

**Rule:** a stale dialog never silently rewrites the predicted `onHandAfter` on a button
label. The label is a **prediction**; the moment the server disagrees, the label is replaced
with a sentence.

**Rule:** never take a write lock across the whole product to "solve" this. Two staff on two
phones in one shop is the normal case, and a lock that blocks the second person's job is
worse than the reconciliation.

**Telemetry:** `stock_concurrent_write{outcome:"serialised" \| "refused" \| "stale_client", product_kind}`
**Never:** last-write-wins with a silent overwrite. The ledger has two rows and `onHandAfter`
on each — that is the whole defence.

### 2.5 `isOversold` — the invariant is already broken

| Field | Value |
| --- | --- |
| **Trigger** | `StockLevelDto.isOversold === true` (i.e. `available < 0`) |
| **User sees** | Dashboard block 1, permanently, at the top. On the product page, every write control is disabled with a visible explanation. The line is still fully readable |
| **Copy** | dashboard: `Check this line — the count and the shelf disagree.` · product: `This line is already wrong, so we've stopped you changing it. Count it and post the count — that's how it gets fixed.` |
| **Recovery** | `Count this line` → a `COUNTING` count scoped to that product → post → the variance writes the correction through the normal ledger path |
| **Telemetry** | `stock_invariant_broken{product_kind, days_open}` — the shop's most serious inventory alarm |
| **Never** | An automatic repair. Never a `SHRINK` to "fix" it. The count is the fix, and the count is a human looking at a shelf |

---

## 3. Empty states — the complete list

| # | Condition | Heading | Body | Actions | Telemetry |
| --- | --- | --- | --- | --- | --- |
| **E1** | No products at all — a new install | `No products yet.` | `Add the first thing you actually stock. Start with what you fit every week — oil, filters, wipers.` | `Add a product` (primary) + `Load the starter catalogue` (secondary, A1's file) | `error_shown{code:"NOT_FOUND", reason:"empty_products"}` |
| **E1a** | No products **because the catalogue is empty on a live shop** | `Our parts list isn't loaded.` | `Call us and we'll tell you what we have on the shelf today.` | `Call Shop Now` (emergency) | `error_shown{code:"INTERNAL_ERROR", reason:"catalogue_empty"}` — **this is a bug, not an empty state.** It is a different string from E1 on purpose |
| **E2** | A product has no movements | `No movements recorded yet.` | `When you receive this in, it'll show up here.` | `Start receiving this item` (secondary) | `error_shown{code:"NOT_FOUND", reason:"empty_ledger"}` |
| **E3** | A count exists with **nothing counted yet** | `Nothing counted yet.` | `{total} lines on this count. Start anywhere — go down the aisle, not down the list.` | `Count the first line` (primary) | `error_shown{code:"NOT_FOUND", reason:"empty_count"}` |
| **E3a** | A count with **no lines at all** (scope matched nothing) | `Nothing matches this scope.` | `Nothing in {scope} is due for a count. Pick a different one, or start one on a single product.` | `Pick another scope` + `Start a count` | `error_shown{code:"NOT_FOUND", reason:"count_scope_empty"}` |
| **E4** | A count where everything was counted and **nothing differs** | `Everything matches.` | `No line on this count differs from what the system thought. Posting still closes it so the next one starts clean.` | `Post count` (primary) — **posting must stay available** | — |
| **E5** | A service has **no bill of materials** | `No parts list on this service.` | `Nobody has written down what this job uses, so we can't promise anything about parts for it. Add the list and availability starts working.` | `Add what this job uses` (primary) | `error_shown{code:"NOT_FOUND", reason:"no_bom"}` |
| **E5a** | A service with a BOM where **every requirement is non-blocking** | `No blocking parts on this service.` | `Nothing here stops the job, so a shortage never cancels a booking. That means we might have to order something in on the day.` | `Make a part blocking` (tertiary) | — |
| **E6** | Reorder list with **nothing to order** | `Nothing is below its reorder point.` | `Every item is above the number we reorder at. Come back Monday.` | `See the low list anyway` (tertiary) | `error_shown{code:"NOT_FOUND", reason:"empty_reorder"}` |
| **E6a** | Reorder list with rows but **nothing has been contacted today** | `Nothing ordered yet today.` | `{n} items are low. {m} suppliers to call.` | `Call {supplierName}` (primary) | — |
| **E7** | A reorder row with **no supplier** | `No supplier on this item` | `Add one on the product page and it'll be in this list next time.` | `Add a supplier` (tertiary) | `error_shown{code:"NOT_FOUND", reason:"no_supplier"}` |
| **E8** | Product search returns nothing | `Nothing matches "{query}".` | `Try the size — that's how most of us find it. Like 205/55 R16.` | `Add it as a new product` (secondary) + `Clear the search` (ghost) | `error_shown{code:"NOT_FOUND", reason:"empty_search", query}` — truncated, lowercased, 40 chars, never PII |
| **E9** | A product with **no reservations and no movements** | `Never used.` | `This item has never moved. It may not be something you actually sell.` | `Stop selling this` (secondary) | — |
| **E10** | Dashboard with **nothing in any block** | `Nothing needs a decision, nothing's low, nothing's open.` | `That's a good morning. Next check is Monday.` | `Start a count` (secondary) | — |
| **E11** | Booking panel with **no reservations** | `No parts set aside for this booking.` | `This service has no parts list yet, so nothing was held.` | `Hold parts now` (secondary) | `error_shown{code:"NOT_FOUND", reason:"no_reservations"}` |
| **E11a** | Booking panel, reservations all released/expired | `The parts hold has ended.` | `{n} {unit} went back on the shelf. Nothing was consumed.` | `Hold again` (primary) | — |
| **E12** | Low list with rows but **every one already ordered today** | `All ordered today.` | `{n} items, {m} suppliers called. Nothing more to do until they land.` | `See the order list` (tertiary) | — |
| **E13** | Ledger filtered to nothing | `No {kind} movements.` | `Try a wider date range, or clear the filter.` | `Clear filters` (ghost) | — |
| **E14** | **No suppliers at all** | `No suppliers yet.` | `Add the distributors you buy from and the reorder list will group itself by phone call.` | `Add a supplier` (primary) | `error_shown{code:"NOT_FOUND", reason:"empty_suppliers"}` |
| **E15** | Availability check returned **0 services** (deep link with a dead id) | *(no customer-facing empty state)* | — | fall through to `ERROR-AND-EDGE-STATES.md` §6 `deep_link_fully_unresolvable` | `error_shown{code:"NOT_FOUND", reason:"availability_no_services"}` |
| **E16** | Size finder, **the size is not stocked at all** | `We don't stock the {size}.` | `We fit what our suppliers carry, and that size isn't one of them. Tell us what you're running on and we'll suggest the closest.` | `Call Shop Now` (emergency) + `See what we fit` (tertiary) | `error_shown{code:"NOT_FOUND", reason:"size_not_stocked"}` |
| **E16a** | Size finder, the size is stocked but **every candidate is aged out** | `We don't stock the {size} right now.` | *(same body as E16)* — an aged tyre must not appear through the availability line | `Call Shop Now` | `error_shown{code:"NOT_FOUND", reason:"size_aged_out"}` |

**No empty state uses red, a warning icon, or `0 results` styling.** E1a is the one
exception in tone — it is a bug, and it says so.

---

## 4. Loading — the skeleton inventory

Skeletons mirror the real box model so nothing shifts. Mechanics read numbers; skeletons
have numbers in the right places, which is why these are specified per surface.

| Surface | Skeleton | Minimum | `aria` label |
| --- | --- | --- | --- |
| Dashboard | block 1: 1 row 64 px · block 2: 3 rows 44 px · block 3: 5 rows 44 px · block 4: 1 row 56 px | 400 ms | `inv.load.dashboard` |
| Product list | 12 rows × 56 px: 24 % name bar, 12 % sku bar, 14 % stock bar, 12 % chip bar | 400 ms | `inv.load.products` |
| Product detail | header 72 px + 4 stat bars 64 px + ledger 8 rows 40 px | 400 ms | `inv.load.product` |
| Ledger | 8 rows × 40 px: 18 % kind bar, 12 % qty bar, 20 % after-bar, 50 % reason bar | 400 ms | `inv.load.ledger` |
| Receive | 1 reference bar 56 px + 6 line bars 56 px with a 96 px qty field each | 400 ms | `inv.load.products` |
| Count | 10 line bars 56 px, number field 96 px each, **no expected bar** | 400 ms | `inv.load.count` |
| Reorder | 3 supplier groups × (1 header 40 px + 3 rows 56 px) | 400 ms | `inv.load.reorder` |
| Low list | 8 rows × 48 px | 400 ms | `inv.load.low` |
| Customer availability line | **nothing** | — | hidden, `inv.load.availability` |

**The count skeleton deliberately has no `expected` bar.** Neither the skeleton nor the
counting screen may hint at the system's belief — `OPERATOR-UX.md` §5.3.

**Submit** uses a determinate inline bar on the button, never a skeleton, never a spinner.
At **6 000 ms** every one of these becomes its error state. Never keep pulsing.

---

## 5. Error states — network, session, server

| # | Trigger | User sees | Copy | Recovery | Telemetry |
| --- | --- | --- | --- | --- | --- |
| **X1** | `navigator.onLine === false`, or a fetch rejecting under a known-down connection | A dismissible, non-blocking strip at the top of `/inventory`. Stock write buttons are disabled with the reason inline | strip: `You're offline.` / `No connection. The number you typed is still here.` · button disabled note: `Offline — we won't post a stock move we can't confirm.` | Automatic: on `online`, retry once, announce `Back online. Trying again.` · manual: `Try again` | `error_shown{code:"SERVICE_UNAVAILABLE", reason:"offline"}` **once per episode** |
| **X2** | 5xx on any inventory route | Inline panel replacing only the failed region; the rest of the page stands | `That didn't go through. Try again.` + `Try again` + `Reference: {requestId}` | `Try again` | `error_shown{code:"INTERNAL_ERROR", region, request_id}` |
| **X3** | `UNAUTHENTICATED` — session expired | Inline expiry panel **above** the content; the content does not unmount, so a mechanic can still read the numbers they were looking at | `Your session ended.` / `Sign in again to make changes. Nothing you were looking at was lost.` · `Sign in` | `Sign in` → `/admin` with **no** `returnTo` query (a deep-linked return is a CSRF surface) | `error_shown{code:"UNAUTHENTICATED", page:"/inventory", reason:"session_timeout"}` |
| **X4** | `FORBIDDEN` — role not permitted for the write | Inline, with the role named so the operator knows whether to ask | `You're signed in as {role}, and only {requiredRole} can change stock.` / `Ask {ownerName} to do it, or sign in as {requiredRole}.` | ask, or sign in again | `error_shown{code:"FORBIDDEN", reason:"role", role, required_role}` |
| **X5** | `RATE_LIMITED` on `inventory.write` or `inventory.count` | The button is replaced by a countdown panel, `role="status"`, `aria-live="polite"`. The typed value stays | `Slow down a moment.` / `Too many stock moves in a row. Try again in {n} seconds.` · secondary: `Call the shop if it's urgent.` | auto re-enable at 0 with focus returned to the button and `You can try again now.` | `error_shown{code:"RATE_LIMITED", action, retry_after}` |
| **X6** | `CONFLICT` from a product-version check | §2.4's reconciliation row | `Someone else changed this while you were typing. Here's the current number: {onHand} {unit}.` | `Use {onHand}` | `stock_concurrent_write{outcome:"stale_client"}` |
| **X7** | `VALIDATION_ERROR` with `fields` | Summary panel at the top of the dialog, `role="alert"`, `tabindex="-1"`, focused on render. Each key also inline | `Check these:` + anchor list to each key | fix and re-submit with the **same** idempotency key | `error_shown{code:"VALIDATION_ERROR", fields}` |
| **X8** | A **customer** hits a 5xx on the availability endpoint | **Nothing.** No line, no chip, no notice. The service card renders exactly as it does with no inventory system at all | *(nothing)* | the customer's path is unaffected — they book normally | `error_shown{code:"INTERNAL_ERROR", reason:"availability", surface}` |
| **X9** | The availability payload arrives containing a forbidden field | **Nothing to the customer.** The client renders only its five states. The server log records the field name; A8 is notified | *(nothing customer-facing)* | — | `inv_contract_violation{field}` — **a hard alert.** A payload that leaked is a bug, not a UI condition |

---

## 6. Content-lifecycle edges

| # | Trigger | User sees | Copy | Recovery | Telemetry |
| --- | --- | --- | --- | --- | --- |
| **L1** | The product a customer's booking reserved is **deactivated** before they arrive | Customer: no change. The booking is intact and the shop knows they are coming | staff: §2.2 | as §2.2 | `product_deactivated_with_reservations{count}` |
| **L2** | A service in the customer's basket has **no BOM** | Customer: no change at all. A missing BOM is a catalogue gap, not a stock fact | staff: E5 | E5 | `error_shown{code:"NOT_FOUND", reason:"no_bom", service_slug}` |
| **L3** | A **blocking** requirement was added to a BOM after the customer booked | Customer: nothing changes, they keep their booking. Staff get a `TALK TO CUSTOMER` row if the new part is short | `TALK TO CUSTOMER — {name}, {dateLong}. Short: {partName}.` | Route 1/2/3 | `booking_parts_short{mid_job:true, cause:"bom_changed"}` |
| **L4** | The availability endpoint's **`canFulfil` flips true→false** between the customer's check and their submit | The existing slot-race state. The claim is dropped, not restated | `That time just went. Pick another one — nothing was booked.` | `See other times on {date}` · `Call us to hold that bay` | `booking_completed{blocked:true}` |
| **L5** | A count is **cancelled** with counted lines | The count returns to the queue with its entries intact and a chip `Cancelled — entries kept` | `Nothing you counted will change. Your entries are kept so you can finish it later.` | `Finish {reference}` | `stock_count_cancelled{with_entries:boolean}` |
| **L6** | A supplier is **deactivated** while reorder rows reference it | The row keeps its `supplierName` as a plain label; the `Call` button disappears and is replaced by a note | `No phone on file for {supplierName}.` / `Add one on the supplier page.` | `Add a phone number` (tertiary) | `error_shown{code:"NOT_FOUND", reason:"supplier_no_phone"}` |

---

## 7. Telemetry for every state

| Rule | Value |
| --- | --- |
| Refusal events | `stock_move_refused{reason, product_kind, has_reservations}` — **never** `product_id`, never a customer name, never a SKU that could carry a plate |
| Every state above | `error_shown{code, reason, region?}` per the site's shared schema |
| Concurrency | `stock_concurrent_write{outcome}` |
| Invariant | `stock_invariant_broken{product_kind, days_open}` — fires daily while open, not once |
| Replays | `stock_move_replayed{kind}` |
| Availability contract violation | `inv_contract_violation{field}` — **never silently stripped** |
| Dedupe | per session per `(code, reason)`; genuinely distinct occurrences (three refusals on three different lines) are not deduped |
| PII | no name, phone, email, plate, free-text reason, or raw query string in any property |

---

## 8. QA checklist

- [ ] Every one of the six `MovementRefusalReason` values renders its exact string, and
      **the substring `failed` appears nowhere in the bundle.**
- [ ] `INSUFFICIENT_STOCK` renders `available` and `requested` as digits in the copy.
- [ ] A quantity field cannot accept a minus sign (`-` and `e` are filtered in the key
      handler, not coerced in the parser).
- [ ] A failed write leaves the typed quantity in the field, byte-identical.
- [ ] A replayed write shows the original result and offers **no** retry button.
- [ ] Two tabs, same product, both adjust → both ledger rows exist, both `onHandAfter`
      values are readable, and neither write is lost.
- [ ] A count posted twice produces one set of ledger rows and the `inv.err.postedTwice`
      string.
- [ ] `isOversold` disables every write control on that product and the dashboard block 1
      row is the first thing rendered.
- [ ] A product deactivated with live reservations keeps the hold and consumes nothing.
- [ ] Availability 500 → **zero** customer-facing change on `/services` and `/book`, and the
      booking path still completes end to end.
- [ ] A payload containing `costPrice`, `marginPct`, `reorderPoint`, `reorderQty`,
      `supplierId`, `supplierName`, `estimatedCost` or `isOversold` on a public route raises
      `inv_contract_violation` in the test suite.
- [ ] Every skeleton resolves to the error state at exactly 6 000 ms; none resolves to a
      spinner.
- [ ] Every empty state in §3 has a working recovery control. Grep the bundle for `0 results`.
- [ ] No empty state renders red or a warning icon (E1a excepted, deliberately).
- [ ] Offline disables stock writes with a visible reason, and the typed values survive.