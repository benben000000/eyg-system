# METRICS — what the inventory system measures, and why

**Owner:** funnel agent (A5) · **Contract:** `src/lib/inventory-types.ts`
**Base schema:** `docs/funnel/FUNNEL-METRICS.md` §1 — this file extends it and does not
restate it.

---

## 0. Instrumentation rules

| Rule | Detail |
| --- | --- |
| **Fire-and-forget, always** | A failed analytics beacon never surfaces in the UI and never blocks a write. Queue it. |
| **No PII, ever** | No name, phone, email, plate, free-text reason, or raw query string in any property. `sku` is fine on staff-only events and **banned on anything customer-facing** — a SKU can carry a customer's order in its text |
| **`costPrice` and `marginPct` never enter analytics** | Analytics leaves the server. A margin number in a third-party dashboard is a leak to a party we have not contracted with. Staff-only aggregates are computed server-side and sent as a total, never as a per-product breakdown |
| **Idempotent keys are not analytics** | `idempotencyKey` never leaves the server. `stock_move_replayed{kind}` is the event; the key is not the property |
| **Dedupe per session per `(code, reason)`** | Offline flapping and maintenance re-renders do not spam. Genuinely distinct occurrences are not deduped |
| **Customer events carry a state, not a number** | `availability_state: "READY" \| "ORDER_IN" \| "NOT_NOW" \| "UNKNOWN"`. Never the raw `available` value — a stock level is a business secret and a re-identification vector |
| **Everything is `en-PH` / `Asia/Manila`** | A week boundary that starts at 06:00 is a bug that hides for months |

---

## 1. The event catalogue

### 1.1 Customer-facing

| Event | Properties | Answers |
| --- | --- | --- |
| `inv_availability_checked` | `surface` (`services` \| `book_step2` \| `size_finder` \| `estimator`), `service_count`, `availability_state`, `blocker_count`, `check_ms`, `outcome` (`ok` \| `degraded` \| `error`) | Is the promise being made? On which surfaces? Is the check slow enough to make the promise feel like work? |
| `inv_claim_rendered` | `surface`, `availability_state` | How often does a customer actually see a stock line? A claim nobody sees is a claim with no conversion value |
| `inv_claim_suppressed` | `surface`, `reason` (`degraded` \| `error` \| `eta_unknown` \| `no_bom`) | **R2 compliance.** Every time the system declines to make a claim, this fires. If this is non-zero on `services` during a healthy period, R2 has been violated in the client |
| `inv_size_searched` | `has_size` (bool), `size_normalized` (only when `has_size`), `result_count`, `availability_state` | Which sizes drive the finder, and which of them can we actually serve? |
| `inv_shortfall_route_shown` | `route` (`order_in` \| `substitute` \| `bay_only`), `service_count`, `has_eta` | Which route the shop actually falls into |
| `inv_shortfall_route_chosen` | `route`, `days_to_booking`, `service_count` | **The conversion of a shortfall.** Of the customers who were told we were short, how many still booked, and which road did they take? |
| `inv_substitute_considered` | `same_size` (bool), `load_index_equal_or_better` (bool), `price_delta_band` (`none`\|`under500`\|`500to1500`\|`over1500`), `accepted` (bool) | Do we substitute well? Is the price gap the reason people decline? |
| `inv_bay_only_accepted` | `partial_services`, `full_services`, `accepted` | Does splitting the visit keep the customer? |
| `inv_availability_blocked_step` | `availability_state`, `step` (always 3), `services_selected` | **THE funnel metric.** See §3.1 |
| `inv_orderin_waitlist_join` | `surface`, `has_eta` | Is the honest waitlist getting used, or are those customers simply going quiet? |

### 1.2 Operator / shop

| Event | Properties | Answers |
| --- | --- | --- |
| `stock_move_posted` | `kind`, `product_kind`, `unit`, `qty_band`, `has_reference` (bool), `actor_role` | Is stock moving for reasons the shop can explain? What share of receives carries a supplier reference? |
| `stock_move_refused` | `reason`, `product_kind`, `has_reservations`, `requested_band`, `available_band` | **Refusal-not-clamp working.** A rising refusal count with `has_reservations` is the oversell-prevention engine earning its keep |
| `stock_move_replayed` | `kind`, `product_kind` | Double-taps absorbed by the idempotency key rather than the ledger |
| `stock_concurrent_write` | `outcome` (`serialised` \| `refused` \| `stale_client`), `product_kind` | Is two-staff-one-product normal or is something looping? |
| `stock_invariant_broken` | `product_kind`, `days_open` | The shop's most serious alarm. Fires **daily while open**, once per product, not once per detection |
| `low_stock_state_entered` | `rung` (1–5), `product_kind`, `available_band`, `reorder_point_band` | Are reorder points set sensibly? A rung entered and exited in 48 h means the point is set wrong |
| `low_stock_state_exited` | `rung`, `days_in_state`, `exit` (`received` \| `adjusted` \| `counted`) | Did the ladder actually resolve anything? `days_in_state` is the honest measure of a bad reorder point |
| `low_stock_digest_sent` | `row_count`, `rung_0_count`, `rung_2_count`, `rung_3_count`, `suppressed_count` | Is the 06:00 digest useful or noise? `suppressed_count` should be small — if it is large, the cap is hiding the fire |
| `low_stock_row_ordered` | `product_kind`, `has_reference`, `persisted` (bool) | Is the order loop closing? **`persisted: false`** on every row until `onOrder` ships is a standing reminder of the contract gap |
| `reorder_row_snoozed` | `product_kind`, `days_snoozed`, `snoozes_total` | The "I'll get to it" counter. Three snoozes on one SKU is a wrong `reorderPoint`, not a lazy owner |
| `receive_batched` | `line_count`, `total_units`, `has_reference` | Is the receive flow actually being used, or is stock still arriving through the back door unrecorded? |
| `receive_mismatch` | `typed`, `docket`, `diff_band` | **How often the docket disagrees with the shelf.** Persistent mismatches are a supplier or a receiving habit, not a software bug |
| `count_started` | `scope_kind`, `line_count`, `planned_minutes` | |
| `count_line_counted` | `product_kind`, `is_significant` | |
| `count_posted` | `scope_kind`, `line_count`, `net_variance_band`, `variance_value_band`, `duration_minutes_band` | Monday Q4. `variance_value_band` is a **band**, never the peso amount — this event leaves the server |
| `count_abandoned` | `lines_done`, `lines_total`, `age_days` | **Count-then-forget, measured.** `age_days > 7` with `lines_done > 0` is the exact failure `OPERATOR-UX.md` §5.4 escalates |
| `count_post_twice` | `status` | The double-post guard firing |
| `reservation_expired` | `mid_job` (bool), `blocking` (bool), `product_kind` | **TTL health.** `mid_job: true` is the one to watch — it means the hold is doing its job, but it also means a customer is on a lift |
| `reservation_released` | `reason_code`, `mid_job` | Cancellations, expiries, manual releases, all distinguishable |
| `parts_consumed` | `booking_id_hash`, `product_kind`, `unit`, `was_reserved` (bool) | `was_reserved: false` means consumption is happening outside the reservation flow — a gap in A4's booking hooks |

### 1.3 System

| Event | Properties | Answers |
| --- | --- | --- |
| `inv_contract_violation` | `field`, `route`, `surface` | **A forbidden field appeared in a public payload.** A hard alert, not a metric. See `ERROR-AND-EDGE-STATES.md` X9 |
| `inv_availability_degraded` | `route`, `status_code`, `duration_ms_band` | The check is failing. Every customer booking during the outage is a booking made without a stock promise |
| `inv_expiry_sweep` | `expired_count`, `mid_job_count`, `duration_ms` | The `/api/cron/tick` sweep |
| `inv_reorder_digest` | `rows`, `rung_0`, `duration_ms` | Cron health |
| `stock_count_schema_drift` | *(test only)* | The count UI showing a value for `expected` before the line is saved |

---

## 2. The promise chain — the one funnel that matters

The inventory's value is a chain, and each link is a place the chain breaks:

```
stock on shelf  →  available (onHand − reserved)  →  canFulfil  →  claim shown
      →  booking made  →  parts held  →  parts in the car  →  consume written  →  ledger agrees with the shelf
```

| Link | Measured by |
| --- | --- |
| stock → available | `stock_move_posted`, `stock_invariant_broken` |
| available → canFulfil | `inv_availability_checked{availability_state}` |
| canFulfil → claim shown | `inv_claim_rendered` ÷ `inv_availability_checked` |
| claim shown → booking made | `inv_availability_blocked_step` + `booking_completed` |
| booking → held | `ReserveResult.blocked`, `reservation_released` |
| held → consumed | `parts_consumed{was_reserved}` |
| consumed → ledger agrees | `count_posted{variance_value_band}` |

**The link that is almost always broken is the third.** Every other agent will be measuring
whether the system is *technically* right. This one asks whether the rightness ever reaches
a human. If `inv_claim_rendered ÷ inv_availability_checked` is below ~0.9 on `/services`,
the trust lever exists in the database and nowhere else.

---

## 3. THE QUESTION

> ### Is the inventory engine's `blocked` flag costing us bookings, or is it protecting the promise?

This is the only question in the build that has no obvious answer from the data, and getting
it wrong in either direction is expensive in opposite ways. So it gets three independent
methods, and a decision rule that refuses to conclude without all three.

### 3.1 Why the obvious measurement does not work

The naive approach is: count the bookings `blocked` refused, and see whether that number is
worth worrying about. **It does not work, for three reasons.**

1. **A refused booking leaves no trace.** If the customer does not book, there is no
   `Booking` row, no `customerPhone`, no reference. **The loss is invisible by
   construction.** A metric that cannot observe its own numerator is a metric that will be
   quoted confidently and be meaningless.
2. **A refusal is not a lost booking.** In the design in `SHORTFALL-COPY.md`, `blocked` is an
   *informational* state: the customer is shown Route 1/2/3 and can still book. So the thing
   to measure is not "how many were refused" — it is **"how many stopped when they read it"**.
3. **The counterfactual is untestable by A/B.** You cannot turn `canFulfil` off for half the
   traffic, because that would be lying to real customers about stock we do not have.

**So the answer has to be assembled from three sources that each observe a different part of
the same story.**

### 3.2 Method 1 — Does telling the truth stop the customer at that step?

**Direct. Available on day one. No counterfactual needed.**

`inv_availability_blocked_step` fires on the transition into step 3 with the
`availability_state` the customer was shown. The metric is:

```
step3_completion_rate(state = READY)     vs     step3_completion_rate(state = ORDER_IN | NOT_NOW)
```

| Reading | Conclusion | Action |
| --- | --- | --- |
| No material difference | The honest line is free. Telling the truth about stock does not lose bookings | Ship `blocked` as designed, stop measuring this weekly |
| `ORDER_IN` abandons materially more | **The claim is costing bookings** | Fix the copy first (`METRICS.md` §4 ladder), then consider whether the ETA is the problem. Do **not** remove the honesty — remove the *wait* |
| `NOT_NOW` abandons much more than `ORDER_IN` | **The loss is the absence of a date, not the absence of stock** | This is the CONTRACT GAP, and it is now the highest-value field in the build: `expectedAt` on `blockers[]` converts `NOT_NOW` into `ORDER_IN`, which the same data says converts far better |

That third row is the most valuable single line in this document. **A shop that cannot date
its own order-in is measurably worse at converting a shortfall than a shop that can**, and
the fix is one field, not a copy change.

**Guard:** this only works if the booking is not blocked by the client. If A4 disables
Continue on `blocked`, the abandonment is manufactured by the UI and the metric measures
A4's implementation, not the customer's decision. That is exactly the N5/M5 prohibition, and
this metric is the enforcement mechanism for it.

### 3.3 Method 2 — The blocked-but-taken bookings (ground truth)

**This is the decisive method.** The shop already runs this experiment by accident: a
customer phones instead of booking, arrives anyway, or a staff member takes the booking with
the shortfall visible. Every one of those is a counterfactual that actually happened.

**Requirement — CONTRACT GAP, and the second most valuable field in the build:**

> A4 must persist, on the booking, the availability state at confirm time:
> `partsBlocked: boolean` and `partsShortfallCount: number`. Without these, a
> blocked-but-taken booking is indistinguishable from an ordinary one, and this method
> cannot be built at all.

With those two fields, each blocked-but-taken booking answers three questions:

| Question | Field | Why it matters |
| --- | --- | --- |
| Did the job actually get done? | `Booking.status` | A `CANCELLED` or a partial completion is a `blocked` failure that cost a bay-hour *and* the customer |
| How long did it take from promise to fix? | `startAt − createdAt` | The customer's patience, measured rather than assumed |
| Did the part get substituted or written off? | `parts_consumed{was_reserved:false}` + `SHORTFALL` movements | The cost of gambling rather than blocking |

### 3.4 The three numbers

| # | Name | Definition | Good | Bad |
| --- | --- | --- | --- | --- |
| **A** | **False blocks** | Bookings that were allowed *despite* `blocked === true`, and which then **cancelled, were rescheduled more than once, or had the blocking part substituted** | `> 90%` complete on first attempt, median ≤ 1 day promise-to-fix | A meaningful share cancel or substitute |
| **B** | **Protected promises** | Bookings that were **blocked**, that the customer re-booked or phoned about within 7 days, and that then completed | Rising | Flat while A rises — the shop is turning away work it could have done |
| **C** | **Wasted trips** | Bookings that completed but where a **non-blocking** shortfall turned into a substitution, a write-off, or a second visit | Near zero | Any material share — this is a Route-3 failure, and Route 3 is supposed to *prevent* it |

### 3.5 Method 3 — Did the customer go quiet, or go to the phone?

The cheapest signal and the most easily misread, so it is last.

A customer who reads "we need to order it in" has three options: book anyway, phone, or
disappear. **Disappear is invisible.** Phone is not:

| Signal | Reading |
| --- | --- |
| `blocked` views up, inbound `LEAD` / contact submissions up within 48 h | **Channel substitution.** The demand was never lost; it moved to the channel the shop already measures. Blocking is not costing bookings |
| `blocked` views up, inbound up only slightly, `booking_completed` down | **True loss.** This is the number that justifies the whole build |
| `blocked` views flat, inbound up | Unrelated. A6's campaigns or a seasonal effect. Do not attribute it to inventory |

**Stated honestly:** inbound volume is a *proxy*. Not every phone call becomes a lead, and
in a 308-follower shop a meaningful share of customers will simply drive past. It is the
weakest of the three methods and it is included because it is the only one that can move
while a customer is sitting in the bay. **It is never the sole basis for a decision.**

### 3.6 The decision rule

**Do not change `isBlocking` until all three methods agree, and until `n ≥ 30` blocked
bookings exist. Below that, the shop has not run the experiment and the data is noise.**

| Pattern | A | B | C | Decision |
| --- | --- | --- | --- | --- |
| **Blocking works** | low | high | ~0 | **Keep it.** `blocked` is protecting the promise, and B is the evidence it is protecting a *reachable* promise |
| **Over-blocking** | **high** | low | low | **Loosen `isBlocking`** on the specific parts in A. Move them to `isBlocking: false` and keep them on the reorder list. Re-measure in 4 weeks |
| **Under-blocking** | low | low | **high** | **Tighten `isBlocking`** on the parts in C. Route 3 is not working for them and the job is finishing without its part |
| **Copy problem, not a flag problem** | low | low | low, but §3.2 shows high `NOT_NOW` abandonment | **Do not touch `isBlocking`.** Ship `expectedAt` and fix the copy. §3.2 says the problem is the missing date |

The fourth row is the one people get wrong, because it feels like a data problem and it is a
copy-and-data problem. **Changing `isBlocking` when the real issue is a missing ETA makes the
shop oversell, and fixes nothing.**

### 3.7 The cost function is asymmetric, and it flips on `isBlocking`

Before any of this: the two errors are not the same size.

| | False **block** (we refused a job we could have done) | False **allow** (we promised what we did not have) |
| --- | --- | --- |
| Non-blocking part | **The whole job's revenue**, and a customer who finds another shop for next time | One conversation at the counter: "we'll get the rest and call you" |
| Blocking part, **not** substitutable (a specific tyre size) | The job, deferred | A bay occupied and a customer sent home, or a substitution they did not choose |
| Blocking part, **safety-critical** (brakes) | One phone call and a day | **A car with unsafe brakes.** Not a bay-hour. A different category entirely |

**The asymmetry flips.** Which means the guidance is not "bias toward blocking" or "bias
toward allowing" — it is:

> **`isBlocking: true` for safety-critical parts and for parts that cannot be substituted at
> all. Everything else `false`.**

That is what `ServicePartRequirement`'s own comment already says — *"True for
safety-critical items (brake pads), false for nice-to-haves"* — and the metrics are what
keep it true as the catalogue grows. **The default in the schema is `isBlocking: true`, and
the correct operating posture is that almost nothing should still be on the default.**

**Recommendation to the orchestrator:** consider whether the schema default should be
`false`, with safety parts opting *in*. A default that is wrong 80% of the time is a
default that produces overselling until someone audits every row — and the schema comment
describes the minority case as the default.

---

## 4. What the owner reads, and how often

| Cadence | Surface | What it answers | Never shown |
| --- | --- | --- | --- |
| **Every morning, 06:00** | One digest SMS: rung 0, rungs 2 and 3, capped at 12 rows | `What can we not promise today?` | Anything about rung 1. Margin. Valuation |
| **Monday, 20 min** | The six questions (`OPERATOR-UX.md` §7) with the metrics behind each attached | The six answers | A percentage that has no denominator |
| **Monthly** | `reorderPoint` review, driven by `low_stock_state_exited{days_in_state}` | Which points are set wrong | A scorecard computed from data we do not have |
| **Quarterly** | §3's blocked-flag review, all three methods | Is `blocked` right yet | A conclusion before `n ≥ 30` |

### The one chart the shop gets

**Ages over time for each product that has been rung 1 or below for more than 30 days.**
Sorted by days, not by value. It answers Monday Q5 — *which sizes keep running out* — and it
is the only visual in the whole inventory system.

> **CONTRACT GAP for the one chart.** "Ages over time" needs the age of a rung-1 state,
> which `low_stock_state_exited{days_in_state}` only gives you **after** the state ends. A
> live version needs a `low_stock_state_entered` read per product, not an event stream. The
> minimum honest version ships without A2 changing anything: **the ledger answer.** `SELECT
> DISTINCT productId` over `MovementDto{kind:"CONSUME"}` for the last 30 days, left-joined
> against `ReorderRowDto` — a product that has sold in 30 days and is still at or below its
> reorder point is the run-rate list, and it is derivable today.

It is a chart because the question is "how long, for how many items, and is the list getting
longer", which a number cannot answer. Everything else on these surfaces is a list because
everything else is a lookup.

**Not shown:** anything with a percentage change week-on-week, anything with a sparkline,
anything colour-coded by trend. A shop with zero movements in a kind for a week renders
`−87%` and the owner learns to distrust the screen.

---

## 5. Engine health — the metrics that say the inventory is lying

These are not business metrics. They are **trust metrics for the ledger itself**, and the
first three are what stand between "the system says 24" and "there are 24".

| Metric | Healthy | Unhealthy means |
| --- | --- | --- |
| `stock_invariant_broken` — products currently open | **0** | The number on the screen is not the number on the shelf. Everything else in this file is meaningless until this is 0 |
| `stock_move_refused{reason:"INSUFFICIENT_STOCK"}` with `has_reservations` | Non-zero and **stable** | Zero means reservations are not actually being checked. A sudden drop means reservations stopped |
| `parts_consumed{was_reserved:false}` ÷ all consumed | < 10% | Consumption is happening outside the reservation flow — the booking hooks are leaking and `available` is drifting |
| `reservation_expired{mid_job:true}` | Low and **not** zero | A high number means the TTL is shorter than the shop's booking horizon, and customers are on lifts when their parts walk away |
| `count_abandoned{age_days > 7}` | 0 | Count-then-forget is happening and the numbers are drifting because of it |
| `receive_batched` vs total `RECEIVE` movements | Near 100% | Stock is arriving through the back door unrecorded. **Any system that is not written to at the moment of receipt is not a stock system** |
| `stock_count_post_twice` | 0 | Something is retrying a post. Harmless, but it is noise hiding a real problem |
| `inv_claim_suppressed` / `inv_availability_checked` during healthy periods | ~0 | R2 is being violated in the client and the shop is making promises it has not checked |
| `inv_contract_violation` | **0, always** | A cost field reached a public payload. This is an incident, not a metric |

---

## 6. What we deliberately do not measure

| Not measured | Why |
| --- | --- |
| **Per-product margin or cost, in analytics** | It leaves the server. Bands and totals only, and `inv_contract_violation` guards the boundary |
| **Which staff member is fastest** | This is a shop where three people do everything. A per-person metric turns into a performance conversation that has nothing to do with the customer |
| **Count accuracy per counter** | Same reason, and worse: it punishes the person who found a real discrepancy |
| **Dashboard views, sessions, time on page** | There is no funnel here. The mechanic opens it, receives twelve lines, and leaves. Time on page would be an argument *against* the tool working |
| **Search terms typed into the product search** | A mechanic searching by a customer's plate number would put PII into a third-party analytics tool |
| **`inv_availability_checked` per customer** | Identifies a browser, which for one household is one person, which combined with a booking is identifiable. Aggregate only |
| **Anything that ranks services by revenue** | `marginPct` next to `canFulfil` is how a shop decides to stop carrying the tyre its actual customers drive on. Range is the moat |

---

## 7. Instrumentation QA

- [ ] No event property is a customer name, phone, email, plate, free-text reason, raw query
      string, sku on a customer-facing event, `costPrice`, `marginPct`, `estimatedCost`, or an
      `idempotencyKey`. Assert it in the test suite with an allowlist, not a comment.
- [ ] `inv_claim_suppressed` is 0 on `/services` in a healthy period. If it is not, the client
      is rendering a claim on a failed check — which is R2 violated and a claim the shop
      cannot keep.
- [ ] `booking_completed` carries `partsBlocked` and `partsShortfallCount` on **every** row,
      including the ones where both are `false`/`0`. A missing field is indistinguishable
      from a false one and destroys Method 2.
- [ ] `inv_availability_blocked_step` fires exactly once per step-3 entry, not once per render
      and not once per re-check. A polling re-check that fires the event turns a rate into a
      count.
- [ ] The `§3.6` decision rule is implemented as a **query with a hard `n ≥ 30` guard that
      returns "not enough data"** rather than a number. A dashboard that shows a percentage
      on six data points is the failure this whole section exists to prevent.
- [ ] `stock_invariant_broken` fires once per product per day while open, and pages the owner
      — it is the only event on this list that is allowed to be noisy enough to be ignored,
      and it is not.
- [ ] `inv_contract_violation` has an alert attached, not a dashboard tile.
- [ ] Every event is fire-and-forget: a beacon failure never surfaces in the UI and never
      delays a stock write.
- [ ] All weekly boundaries are `Asia/Manila`, and "week" means Monday 00:00, matching the
      Monday review in `OPERATOR-UX.md` §7.

---

## 8. The contract gap register — verified, not assumed

Checked against `src/lib/inventory-types.ts`, `prisma/schema.prisma` and
`src/lib/server/inventory/booking-hooks.ts` as they stood when this file was written.
**Four gaps. Ranked by what they cost the shop.**

| # | Gap | Cost of leaving it | Where it is designed around |
| --- | --- | --- | --- |
| **1** | **`Booking` has no record of the availability state at confirm time** — no `partsBlocked`, no `partsShortfallCount`. `booking-hooks.ts` computes `blocked` and **logs the agreement probe at `debug` level**, but does not persist it. A blocked-but-taken booking is therefore indistinguishable from an ordinary one | **§3's Method 2 cannot be built at all.** The decisive measurement of the `blocked` question is impossible, and the question will be answered by opinion instead of by data — which is how an `isBlocking` flag ends up permanently wrong on either side. This is the single most expensive gap in the build | §3.3. `METRICS.md` §3.6 refuses to conclude without it, and the `n ≥ 30` guard means the conclusion arrives late but arrives |
| **2** | **`expectedAt` on `ServiceAvailabilityDto.blockers[]`** — `blockers[]` is `{ productId, name, short }`, with no date | **`ORDER_IN` cannot exist.** Only the no-ETA `NOT_NOW` form ships, and §3.2's third row says `NOT_NOW` abandons materially more than `ORDER_IN`. The shop cannot date its own order-in, and the difference is worth conversions on every blocked booking | `TRUST-MESSAGES.md` §3 and §4, `SHORTFALL-COPY.md` §2 |
| **3** | **No `PurchaseOrder` model** — no PO, no `onOrder`, no order history | **Rung 4 of the escalation ladder is not durable.** `Mark as ordered` can only be a session-level note, and the row must stay visible forever. Monday Q3 (*"what has been low for a week and nobody ordered?"*) has to be reconstructed from the `RECEIVE` ledger instead — which works, and is genuinely the workaround | `OPERATOR-UX.md` §3.3 and §4.2, `CTMAP.md` §7's honesty line on O7 |
| **4** | **`ReorderRowDto` has no `used30d`** — `available`, `reorderPoint`, `reorderQty` and `suggestedQty` exist, but not the consumption rate | **The anti-"reorder everything" guard cannot state a number** (`CTMAP.md` O10). Without it, the reflex at the quantity field is unrestrained, and that reflex is the specific mechanism that converts working capital into aged rubber | `CTMAP.md` §7's softer fallback wording |

**What is *not* a gap**, having been checked and found already correct in the contract:

- `PostMovementRejection.available` / `.requested` — the refusal copy in
  `MICROCOPY.md` §12 is fully shippable today.
- `ServiceAvailabilityDto.blockers` is **already filtered to blocking parts only**, so the
  client never re-derives `isBlocking`. `TRUST-MESSAGES.md` §3 depends on that and it holds.
- `ProductAvailabilityDto.ageDays` is documented as **elapsed, not remaining** — which is
  what the DOT rule in `TRUST-MESSAGES.md` §6 assumes. The expanded comment makes the
  ambiguity explicit; the field is safe to gate on.
- `StockCountLine.expected` remains snapshotted at creation. The blind-count design in
  `OPERATOR-UX.md` §5.3 depends on it and it is intact.