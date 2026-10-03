# DO / DON'T — the inventory system

**Owner:** funnel agent (A5) · **Every rule names its evidence or its failure mode.**
**Sources:** `docs/brand/DO-NOT.md`, `docs/brand/VOICE-AND-TONE.md`,
`docs/funnel/CTA-MAP.md` §6, `docs/funnel/MICROCOPY.md` §14, the inventory contract's own
comments, and `prisma/schema.prisma`'s field comments.

**The house test for a rule in this file:** *can I name the failure it prevents, in one
sentence a mechanic would recognise?* If not, the rule is taste, and taste is not a
specification.

---

## 1. The customer-facing DO table

| # | DO | Why — evidence or failure mode |
| --- | --- | --- |
| **D1** | **Promise against `available`, and only `available`.** | `StockLevelDto`'s own comment: *"available = onHand − reserved. THE number a promise is made against."* A promise made against `onHand` is a promise that evaporates when the second customer books — and the first customer has already driven 90 minutes |
| **D2** | **Show nothing when the availability check fails.** | The failure is invisible in QA: the fallback renders, the test passes, and a customer is lied to. Absence of evidence is not evidence of stock |
| **D3** | **Let the booking proceed when the check fails.** | Blocking a sale because *our status page* is down is the most expensive possible failure. Fail closed on the promise, fail open on the revenue |
| **D4** | **Say what the shop can do first, then what is missing.** | A customer who hears "we don't have it" assumes they drove 1.5 hours for nothing. The sentence order is the whole difference |
| **D5** | **Lead with the shortfall sentence never.** | Every good version in `SHORTFALL-COPY.md` opens with a capability. Every bad one opens with an absence |
| **D6** | **Keep `costPrice`, `marginPct`, `estimatedCost`, `supplierId`, `supplierName`, `reorderPoint`, `reorderQty` and `isOversold` off every customer surface.** | Not a style rule. It is the shop's entire price position: an oil filter bought at ₱180 and sold at ₱310 is the difference between a shop that survives the year and one that does not. A competitor with one browser tab owns that number forever |
| **D7** | **Show a number only above the `2 × qtyNeeded` threshold.** | At exactly `qtyNeeded`, one phone call from another customer converts the promise into a shortfall while the first customer is on the road |
| **D8** | **Never let the parts ledger touch the bay calendar.** | Two availability systems fighting over one screen. A slot greyed out because of a filter, next to a slot greyed out because the bay is full, is a customer who books nothing |
| **D9** | **Default to the order-in, never the substitute.** | The substitute is lower-friction, which is exactly why it must not be the default — it is a downgrade the customer did not ask for. Asking costs one question and preserves the choice |
| **D10** | **Print the load-index rule in the copy whenever a substitute is offered.** | Substituting down on load index or speed rating is a safety failure, not a commercial one. `Q.loadIndex >= P.loadIndex` is a rule, and the copy has to match it or the rule is invisible |
| **D11** | **Say "set aside", not "reserved".** | `Reservation` is `HELD` with a 24h TTL. "Reserved" is a word that promises permanence in the customer's mind. "Set aside" is a physical image a mechanic can actually keep |
| **D12** | **Keep the order-in a sale, not a refusal.** | `blocked === true` means *phone the distributor*. It does not mean *the customer drove here for nothing*. A refusal always carries a route |
| **D13** | **Show aged tyres on a separate surface with their age printed, never through the `In stock today` line.** | `ProductAvailabilityDto` ships `ageDays` and `isNearExpiry` for exactly this. A caveat in the availability line is an invitation, and the assistant at 8am with a queue behind them will say yes |
| **D14** | **Keep the phone one thumb-reach on every state.** | The shop's whole funnel is a phone call. `ERROR-AND-EDGE-STATES.md` §0 principle 1, restated because it is the one that always survives scope cuts |
| **D15** | **Preserve the customer's typed data across every stock-related failure.** | The mechanic re-presses; they do not re-type. A form that clears on failure trains people to double-submit |
| **D16** | **Write a refusal as a sentence with a number in it.** | `PostMovementRejection` ships `available` and `requested` so the UI can say *"3 left"*, not *"failed"*. The fields exist for exactly this. Using them to print "failed" is a defect |
| **D17** | **Write an ETA with one working day of slack, or don't write it.** | A distributor delivery in Bataan at 4:30pm cannot be fitted at 4:30pm. A raw supplier date turned into an availability date is a broken promise with a date printed on it |
| **D18** | **Keep the promise identical across `/services`, `/book`, the estimate and the size finder.** | One string, five surfaces. Two strings means two promises, and only one of them can be kept |
| **D19** | **Never show a colour-only status.** | `DO-NOT.md` §1.2 rule 17: under deuteranopia EYG's racing red and pit green are 58 RGB units apart — the same colour. A customer who is red/green colour-blind and a customer looking at a greyscale phone screen see the same thing: nothing |
| **D20** | **Let the `Not sure` customer through anyway.** | The existing funnel already allows a fully empty vehicle step. A stock system must not invert that: an unknown car is an unknown parts list, and refusing to sell because we could not identify the vehicle is a refusal with no route |

---

## 2. The customer-facing DON'T table

| # | DON'T | Why — the named failure |
| --- | --- | --- |
| **N1** | **❌ `Only 2 left!` / `Limited stock!` / `Hurry!`** on any part | **Manufactured scarcity.** The failure is specific and delayed: the customer who believes it arrives, finds five free bays and four tyres, and concludes we lie about everything — including the price on the job card. One fake number costs the whole relationship. `funnel/CTA-MAP.md` §6 already bans it for bays; a stock system has far more tempting places to cheat |
| **N2** | **❌ A client-generated countdown on a stock claim or a parts hold** | **A resetting timer teaches the customer the timer is theatre.** The site already banned it for prices (`est.total.checked` replaced it with `Prices checked at {HH:MM}`). The parts hold gets the same treatment on the customer side and a *real* live clock on the staff side, where the mechanic can act on it |
| **N3** | **❌ `Out of stock` as a dead end** | **No verb, no owner, no date.** It reads as a wall and it converts a supply problem into a lost customer. The sentence is `We need to order that in`, which has a verb and a clock |
| **N4** | **❌ `We don't have that.` alone** | **The sentence that makes a customer who drove 90 minutes feel stupid.** Never ship it without a next sentence in the same breath |
| **N5** | **❌ Blocking a sale because a part is short** | **This is the failure that kills tyre margin.** The customer needs their car fixed; the part is a solvable supply problem. `blocked === true` blocks a *promise*, never a *booking* |
| **N6** | **❌ Blocking a sale for a non-blocking part** | `ServicePartRequirement.isBlocking` exists precisely to prevent this, and `ReserveResult.blocked` is true only for blocking shortfalls. A PMS booking cancelled because the wiper blades are short is a bay-hour and a customer lost over ₱150 |
| **N7** | **❌ Showing a customer a stock number the shop cannot keep** | **It is a written promise with a number on it.** The customer holds it in their head from `/services` to the counter. The failure mode is worse than showing nothing, because it converts a normal service into a grievance |
| **N8** | **❌ Blocking the wizard, or greying out date slots, because of a part** | **Two availability systems fighting.** `book.s3.reason1`/`reason2` already own the honest bay explanation. A slot's story must never be rewritten by the parts ledger |
| **N9** | **❌ Overwriting `capacityLeft` with a parts number** | Same failure as N8, in the other direction: a bay that is free but has no parts stops looking like a free bay. The bay calendar and the parts ledger are two different books |
| **N10** | **❌ Promoting a substitute without saying the size, the brand and the price difference** | **An undisclosed downgrade.** A customer who agreed to a substitute without knowing the brand changed has been sold something they did not consent to, and the load-index rule is invisible to them |
| **N11** | **❌ Fitting a lower load index or speed rating** | **Not a commercial decision. A safety one.** The candidate rule in `SHORTFALL-COPY.md` §3 is `>=`, and it must be asserted in a test, not reviewed by eye |
| **N12** | **❌ Silently dropping a service from a basket because a part is short** | The site already handles a deactivated service by striking it through and saying so (`funnel/ERROR-AND-EDGE-STATES.md` §5.4). A stock-driven removal gets the identical treatment, never a silent one |
| **N13** | **❌ A `TODO`, a placeholder size, or fake stock data presented as real** | `DO-NOT.md` §1.4 rule 44. On this site specifically, a placeholder tyre size is worse than a placeholder paragraph, because it can be quoted back to a mechanic at the counter |
| **N14** | **❌ A number a customer cannot verify, in a place they would check** | "We have 4 left" on a shop floor is checkable in one second. A number the shop cannot stand behind is worse than a band, because the check is what destroys trust |
| **N15** | **❌ Exclamation marks, ever** | `VOICE-AND-TONE.md` §2.1: no exclamation marks in transactional copy. A stock line is transactional copy. Zero in this entire deck |
| **N16** | **❌ Rendering a raw enum anywhere a customer or an operator will read it** | `INSUFFICIENT_STOCK` is a database value. `ERROR-AND-EDGE-STATES.md` §0 principle 4 applies: say what happened, say what to do. `ADJUST_DOWN` never renders; the `kind` selects a string |
| **N17** | **❌ Hiding a shortfall from staff to protect the conversion** | The customer is the first person to find out, and finding out is expensive. Staff see the shortfall, the route, and the two options — and the customer sees a sentence, not a system |
| **N18** | **❌ Auto-posting a waitlist SMS, or promising one the shop will not send** | `MICROCOPY.md` §6.6 sets the precedent: *do not promise a keyword that does not respond*. The same applies to "we'll text you when it lands" |
| **N19** | **❌ Retiring a size with live holds, silently** | The hold is a person with a booking. `isActive = false` keeps the ledger and the holds; the operator is told |
| **N20** | **❌ Showing cost, margin, or supplier identity on a customer surface "temporarily"** | There is no temporary. It ships, it gets cached, it gets screenshotted, and `A8`'s finding list gets a new row. The assertion belongs in the test suite, not in a code review comment |

---

## 3. The operator-facing DO table

| # | DO | Why |
| --- | --- | --- |
| **O1** | **Refuse, never clamp.** Every write path. | The contract's own instruction. Clamping is how a silent discrepancy appears that nobody can explain six weeks later — and the ledger is the only defence |
| **O2** | **Make the reason mandatory and reject "Because".** | `PostMovementInput.reason`: *"REQUIRED for anything a human initiated. 'Because' is not a reason."* Every unexplained number is a question the shop cannot answer |
| **O3** | **Put the consequence in the commit button's label.** `Receive 24 → 28`. | It satisfies A3's before→after requirement in the control itself, and it removes the need for a confirmation dialog — which is a thing a mechanic with a customer waiting will skip |
| **O4** | **Post the count, not just take it.** | `POSTED` is the only status that changes `available`. A count sitting in `COUNTING` has changed nothing and looks identical to real work |
| **O5** | **Hide `expected` while counting.** | The schema says `expected` is snapshotted *"so a concurrent sale does not silently rewrite history"* — and a counter who sees `5` will often find 5. Hiding it is the entire return on that design decision |
| **O6** | **Require a note on every `isSignificant` variance.** | A variance without a reason is either a bug or a loss. Both deserve a name attached before it enters the ledger |
| **O7** | **Count on Sunday, in aisle order, by `cycleCountDays`.** | The shop is closed Sunday (`BUSINESS_HOURS`) and `cycleCountDays` already encodes the owner's judgement per product. Alphabetical order is a screen order, not a walking order |
| **O8** | **Keep a still-low row visible after someone says "I ordered it".** | There is no `PurchaseOrder` in the schema. The day an order is late or lost, a hidden row means **nothing anywhere says the shop is short** — and the customer finds out at the counter |
| **O9** | **Make one digest, at 06:00, rungs 0/2/3 only.** | Nine low-stock messages on Tuesday and the channel is muted by Wednesday — which also mutes rung 0, the real oversell |
| **O10** | **Let `isOversold` block the controls, never the screen.** | You must be able to look at a broken line. Only counting it may change it — no automatic repair, ever |
| **O11** | **Reconcile a stale dialog in words, never silently rewrite the predicted label.** | Two staff on two phones is a normal Tuesday. A last-write-wins with a quietly recomputed `onHandAfter` is how a ledger stops matching a shelf |
| **O12** | **Reuse the same `idempotencyKey` on a retry, and issue a new one when the quantity changes.** | A retry with a changed quantity and the old key returns the original refusal forever — the operator presses the button five times and it refuses five times |
| **O13** | **Let the consume dialog offer `Use {available} instead`.** | The job needs three, the estimate said four. The refusal data is right there. Making the human retype a smaller number is friction with no upside |
| **O14** | **Receive into a `LITRE` product with a decimal and a container.** | 4.2 litres, not 4. `UNITS` includes `LITRE`, `KG` and `M`, and the schema comment says *"4 oil filters, 1.4 litres, a set of 5"* |
| **O15** | **Print the shelf label from the SKU.** | `Product.sku`'s comment says it is *"printed on the shelf label and read by the mechanic"* |
| **O16** | **Review `reorderPoint` monthly.** | The owner set it; the system's only opinion is the flag it sets. A rung the owner never acts on is a rung set wrong, and the fix is the number, not the alert |
| **O17** | **Retire with `isActive = false`, never a delete.** | `onDelete: Cascade` runs from `Product` to `movements`. A delete destroys the history that defends the number |
| **O18** | **Never show an empty state in red or with a warning icon.** | An empty state is not an error. Styling it as one trains the eye to treat an ordinary state as a crisis — which is the whole cry-wolf mechanism |

---

## 4. The operator-facing DON'T table

| # | DON'T | Why — the named failure |
| --- | --- | --- |
| **M1** | **❌ "Just reorder everything"** — a bulk reorder that fills every SKU to its reorder point in one press | **This is the reflex that kills tyre margin, and it is the one this system is most tempted by.** Tyres are the highest-cost-per-unit item on the shelf and the slowest to age out. A shop that carries four of every tyre size it has ever been asked for has converted working capital into dead rubber that is now ageing past its DOT window while the cash that would have bought the size the next customer walks in for sits in a warehouse bay. The concrete failure: a ₱45,000 shelf of 205/55 R16 that the shop sells 2 of a month is not stock, it is a **₱45,000 hole**, and it is indistinguishable from cash until the count. **`reorderPoint` is the owner's judgement; `suggestedQty` is a suggestion; the qty field is where the reflex lives — so that is where the guard is** (`CTMAP.md` O10: `That is {n} {unit}. We only use about {usage30d}.`) |
| **M2** | **❌ Count-then-forget** | **A count that is never posted is a count that never happened, and it looks identical to work.** `COUNTING` changes nothing — not `available`, not the reorder list, not a single promise. The failure is silent: the team did the hard part, the queue drains, the number is unchanged, and six weeks later someone asks why the count "didn't fix it". Three defences: the dashboard's block 4 exists to make an open count unmissable; every `isSignificant` line needs a note before `REVIEW → POSTED`; an unreviewed count older than 7 days escalates to the owner **with a date on it** |
| **M3** | **❌ Hide cost and margin from staff** | **A3's brief is explicit and it is right.** An operator who cannot see cost cannot distinguish a pricing error from a stock error — and those two have completely different fixes. It also means the mechanic can answer "why is this ₱310?" instead of shrugging and going to the owner. Cost is staff-only, server-filtered, and **absent from the customer payload** — the opposite rule, N20/D6 |
| **M4** | **❌ A confirmation dialog on every stock write** | **Reading is what gets skipped when a customer is in the bay.** It also blocks the one screen that must work on a phone, and on a 3G connection a modal with a sentence in it is a thing an operator will dismiss without reading. The consequence goes in the label; the destructive case takes `Shift+Enter` |
| **M5** | **❌ Optimistic stock writes** | A3's brief forbids it and the invariant makes it wrong. If the server refuses and the UI has already shown the new number, the operator is looking at a number that does not exist while a car is on the lift |
| **M6** | **❌ A take-lock to "fix" two staff editing at once** | Two staff, two phones, one shop — that is the normal case. A lock that blocks the second person's job is worse than the reconciliation in `ERROR-AND-EDGE-STATES.md` §2.4 |
| **M7** | **❌ Auto-repair an `isOversold` line** | The count is the fix. A script that writes off the difference destroys the evidence of what happened and makes the number wrong *and* unexplainable |
| **M8** | **❌ A notification per low item** | **Cry wolf, precisely.** `OPERATOR-UX.md` §4.1: the notification channel is a shared resource with a low tolerance, and it will be tuned for the noisiest signal on it |
| **M9** | **❌ A badge, colour, pulse, or animation for rung 1 (`isLow`)** | `isLow` fires for 30 items on a Monday morning. Visual urgency on a normal state is how the eye stops seeing it — and `isLow` is also what feeds `ReorderRowDto`, the reorder list, and the Monday review. It is a **number**, not an alarm. The nav badge counts rungs 2 and 3 only |
| **M10** | **❌ Suppress a customer claim because the shortfall is "only" non-blocking** | That is `READY_PARTIAL`, and its copy is deliberately identical to `READY`. The temptation is to show a hedge to look scrupulous. The result is a customer who is told there is a catch when there is not, on a service they were going to book anyway |
| **M11** | **❌ Editing a `StockMovement` or deleting one** | Append-only, in the contract and in the schema. Every "we'll just fix that row" is the exact moment the ledger stops being evidence |
| **M15** | **❌ A "failed" toast on a refusal** | It says the system failed. It did not — the system **refused correctly**, which is the feature. `Only {available} {unit} on hand. You asked for {requested}.` is the same event, correctly described |
| **M12** | **❌ A chart, a percentage, or a trend line on `Today`** | A kind can have zero movements for a week. `−87%` renders as a crisis and it is a Tuesday. The dashboard answers *what needs a decision today*, and a number that cannot change today's decision does not belong on it |
| **M13** | **❌ Printing cost, margin, or a shortfall on the customer's job card** | `VOICE-AND-TONE.md` §5.5's job card format lists services, quantities and amounts. A customer does not need to know the shop holds two oil filters; they need to know what they are paying for. Shortfalls stay on the staff panel |
| **M14** | **❌ Letting `Mark as ordered` look durable while nothing is persisted** | A control that looks like it recorded something and did not is worse than no control. Either it writes a `PurchaseOrder` or it says, in the copy under the button, that it only lasts for today |

---

## 5. The one-paragraph version

Trust is the only thing this system sells that a competitor cannot copy on a poster.
Every rule in this file that ends in **customer-facing** is protecting one thing: *a customer
who believes what we wrote, drives to the shop, and finds we were right.* Every rule that
ends in **operator-facing** is protecting the other half: *a number on the screen that
matches the shelf at the moment somebody asks.* A stock system that gets the first half
right and the second half wrong is a shop with a beautifully written confirmation SMS for a
part it does not have. **The promise is the product; the ledger is the only way to keep
it.**