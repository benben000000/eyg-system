# MICROCOPY — the inventory string deck

**Owner:** funnel agent (A5) · **Status:** paste-ready. Keys are the contract; components
look strings up by key.
**Base voice:** `docs/brand/VOICE-AND-TONE.md` §2 and `docs/funnel/MICROCOPY.md` §0. The
rules in this file are **deltas**, not a replacement.

**Deltas from the site voice, applied to every string below**

1. **Lead with what we can do, not what we cannot.** An absence is never sentence one.
2. **No `!` anywhere in this deck.** Zero. Not one per screen — zero. A stock line is
   transactional copy and transactional copy has no exclamation marks.
3. **A number is a promise.** Show it only when the shop can keep it
   (`TRUST-MESSAGES.md` R5).
4. **Name the part.** `the oil filter`, not `a component`. A customer who is told a part is
   short wants to know which part.
5. **Say who acts and when.** Every stock sentence has an owner: we, the supplier, you.
6. **Units always.** `4 EA` is not a sentence anyone says; `4 filters` is. The unit token is
   rendered from `UnitValue`, and `LITRE`/`KG`/`M` render as `L`/`kg`/`m` in copy.

---

## 1. Customer trust claims

| key | string | notes |
| --- | --- | --- |
| `inv.claim.ready` | `In stock today.` | the only licence is `canFulfil === true` |
| `inv.claim.readyFull` | `In stock today. We can do this on any open day.` | `/services` card line |
| `inv.claim.readyShort` | `In stock today.` | **identical** to `inv.claim.ready` when a non-blocking shortfall exists. By design. |
| `inv.claim.orderIn` | `We can do this. We need to order {partName} in — usually a day or two from our supplier.` | no-ETA form; the only shippable form today |
| `inv.claim.orderInDate` | `We'll have it by {dateLong}.` | requires the `expectedAt` CONTRACT GAP |
| `inv.claim.orderInService` | `We can do this, but we need to order a part in first. Call the shop and we'll tell you when it lands.` | `NOT_NOW` on `/services` |
| `inv.claim.bookGood` | `Good news — we have the parts for this in stock today.` | `/book` step 2; the one allowed interjection |
| `inv.claim.bookOrderIn` | `We can do this. We need to order {partName} in, and expect it by {dateLong}. Pick a time after {dateLong} and we'll have it ready.` | |
| `inv.claim.bookOrderInNoDate` | `We can do this once we've ordered one part in. Pick a time as normal and we'll confirm the date when we hear from the supplier.` | |
| `inv.claim.bookConfirm` | `This one we need to confirm first. Call the shop and we'll tell you what we can do on your date.` | last resort, `blocked === true` |
| `inv.claim.setAside` | `We've set aside the parts for this job. They're held for your booking reference.` | `reservations[].status === "HELD"` and `blocked === false` |
| `inv.claim.setAsidePartial` | `We've set aside the parts we need for the main work.` | non-blocking shortfall present |
| `inv.claim.setAsidePending` | `Booking received. One part still needs to come in — we'll text you the day it lands, before your date.` | `blocked === true` |
| `inv.claim.hold24` | `We hold parts for 24 hours after you book.` | factual, no countdown |
| `inv.claim.included` | `See what's included` | the disclosure behind it |

---

## 2. Customer shortfall copy

### Route 1 — order in

| key | string | notes |
| --- | --- | --- |
| `inv.short.orderIn.long` | `We can do this. We need to order one part in first — usually a day or two from our supplier. Pick a date as normal and we'll confirm the day it lands before you come in.` | the shippable form |
| `inv.short.orderIn.short` | `We can do this on {dateLong}. We'll have it by then, and we'll text you when it lands.` | requires `expectedAt` |
| `inv.short.orderIn.late` | `That part takes us to {dateLong}, which is after the day you picked. Two things we can do: come in {dateLong} and we'll have it ready, or come in earlier and do the rest while we wait for it.` | |
| `inv.short.orderIn.etaChanged` | `Your {size} set is running a day late — new date is {dateLong}. Your bay is still booked for {originalDate}.` | customer-initiated, >24h ahead |
| `inv.short.orderIn.etaClose` | `We don't have your {size} yet. Your bay is {time} tomorrow and we'd rather not have you in and out. Can we push you to {dateLong}? Your deposit moves with you.` | <24h ahead; a phone call is mandatory, this is the text |
| `inv.short.orderIn.never` | `We don't have your {size} yet, and we'd rather tell you now than on the day. Can we move you to {dateLong}?` | |
| `inv.short.orderIn.tellMe` | `Text me when it lands` | CTA label |
| `inv.short.orderIn.tellMeSub` | `One message on the day it arrives. Then we stop.` | |
| `inv.short.orderIn.tellMeDone` | `Done. We'll text you on the day it lands, and not before.` | |

### Route 2 — substitute with consent

| key | string | notes |
| --- | --- | --- |
| `inv.sub.ask` | `We've got a different brand in that size — {brand} {size}. Same size, and the load rating is equal or better. It's {priceDelta} {direction} than the one you asked for. Happy to fit it, or we can wait for the one you wanted?` | the whole ask, one paragraph |
| `inv.sub.directionUp` | `more` | interpolated where `priceDelta` is absolute pesos |
| `inv.sub.directionDown` | `less` | |
| `inv.sub.same` | `the same` | |
| `inv.sub.yes` | `Yes, fit that one` | |
| `inv.sub.wait` | `Wait for the one I asked for` | two options, equal weight |
| `inv.sub.none` | `No equivalent in stock` | staff + internal; never the sole customer line |
| `inv.sub.downgradeRefused` | `We won't fit a lower rating than your car needs, so that's not an option here.` | only renderable because the `>=` rule makes it true |

### Route 3 — bay-only

| key | string | notes |
| --- | --- | --- |
| `inv.bay.heading` | `Good news — we can do most of it today.` | |
| `inv.bay.body` | `{serviceList} are all in stock, so we'll get those done while your car is up. The {missingPart} needs to be ordered in. Do the rest now and pick it up separately, or wait and do everything at once?` | |
| `inv.bay.today` | `Today: {serviceList} — {formatPeso(partialTotal)}` | |
| `inv.bay.later` | `Later: {missingPart} — {formatPeso(partPrice)}` | |
| `inv.bay.together` | `Together: {formatPeso(fullTotal)} — same price. Splitting the work just means two visits.` | the whole argument |
| `inv.bay.todayShort` | `Today: {serviceList} — {formatPeso(partialTotal)}` | |
| `inv.bay.splitYes` | `Do it today` | |
| `inv.bay.splitNo` | `Wait for everything` | |

### The refusal that is real

| key | string | notes |
| --- | --- | --- |
| `inv.no.heading` | `We're not able to fit that size.` | |
| `inv.no.body` | `I don't want to take your booking and your bay time for something we can't finish. What I can do is {route}.` | a refusal always carries a route |

---

## 3. Confirmation / set-aside

| key | string | notes |
| --- | --- | --- |
| `inv.ok.setAsideHead` | `Parts set aside` | the disclosure heading on `/book` success |
| `inv.ok.setAsideBody` | `We've set aside the parts for this job. They're held for your booking reference.` | |
| `inv.ok.setAsideRef` | `Held under reference {reference}.` | |
| `inv.ok.pendingHead` | `One part still to come in` | `blocked === true` |
| `inv.ok.pendingBody` | `We'll text you the day it lands, before your date. Nothing else about your booking has changed.` | the reassurance sentence |
| `inv.ok.expired` | `Your hold on the parts has expired, so we're not able to say they're set aside any more. We can re-hold them for you at the counter — just mention your reference.` | render-time race only |

**No expiry countdown is rendered on the customer success screen.** Ever. (`R6`.)

---

## 4. Tyre-size finder

| key | string | notes |
| --- | --- | --- |
| `inv.size.label` | `Tyre size` | existing estimator key reused |
| `inv.size.help` | `You'll find it on the sidewall. Example: 205/55 R16.` | existing |
| `inv.size.searching` | `Looking up {size}` | |
| `inv.size.plenty` | `We have {canPromise} of the {size} on the shelf.` | only when `canPromise >= 8` |
| `inv.size.fullSet` | `We have a full set of the {size} in stock.` | `4 <= canPromise < 8` |
| `inv.size.few` | `We have a few of the {size}. A full set means ordering some in.` | `1 <= canPromise < 4` |
| `inv.size.none` | `No {size} on the shelf right now.` | |
| `inv.size.noneCall` | `Call us and we'll tell you what's closest.` | |
| `inv.size.orderIn` | `No {size} on the shelf right now. We can have it by {dateLong}.` | requires `expectedAt` |
| `inv.size.noneFound` | `We don't stock the {size}.` | factual, and it is fine — it is a catalogue answer, not a stock one |
| `inv.size.noneFoundBody` | `We fit what our suppliers carry, and that size isn't one of them. Tell us what you're running on and we'll suggest the closest.` | |
| `inv.size.agedHidden` | *(no string — the size is filtered out)* | DOT rule |
| `inv.size.ctaSelect` | `Select this size` | |
| `inv.size.ctaOrder` | `Order it in for me` | |
| `inv.size.ctaCall` | `Call Shop Now` | |
| `inv.size.unit` | `{count} {unitLabel}` | `EA`→`tyres`/`filters` by kind; never the raw token |

---

## 5. Operator — the dashboard

| key | string | notes |
| --- | --- | --- |
| `inv.dash.title` | `Today` | |
| `inv.dash.greeting` | *(none — no greeting, no name, no weather)* | a shop tool at 6am does not say good morning |
| `inv.dash.block1` | `Needs a decision` | |
| `inv.dash.block1.empty` | `Nothing needs a decision right now.` | the block does not render when empty |
| `inv.dash.oversold` | `Check this line — the count and the shelf disagree.` | rung 0 |
| `inv.dash.oversoldSub` | `{sku} {name}. The system says {onHand}, {available} of it available.` | |
| `inv.dash.blockedBooking` | `TALK TO CUSTOMER — {name}, {dateLong}. Short: {partName}.` | staff-only, uppercase is `eyg-eyebrow` |
| `inv.dash.blockedSub` | `{serviceName} needs {short} more {unit}. {bookingsInWindow} booking(s) in the next 3 days.` | |
| `inv.dash.block2` | `Landing today` | |
| `inv.dash.block2.sub` | `{n} lines against {references}.` | |
| `inv.dash.block2.empty` | `Nothing received today.` | |
| `inv.dash.block3` | `Low` | |
| `inv.dash.block3.sub` | `{available} {unit} on hand. We reorder at {reorderPoint}.` | |
| `inv.dash.block3.out` | `Nothing on the shelf.` | rung 3 |
| `inv.dash.block3.committed` | `All {reserved} {unit} set aside for bookings. Nothing spare.` | rung 2 |
| `inv.dash.block3.ordered` | `Ordered {reference} · expect {dateLong}` | rung 4 |
| `inv.dash.block3.received` | `Received {qty} {unit} · {reference}` | rung 5 |
| `inv.dash.block3.empty` | `Everything is above its reorder point. Come back Monday.` | |
| `inv.dash.block4` | `Counts in progress` | |
| `inv.dash.block4.sub` | `{counted} of {total} counted.` | |
| `inv.dash.block4.stale` | `Open since {dateLong}. {outstanding} lines left. A count doesn't change anything until it's posted.` | |
| `inv.dash.search` | `Search sku, name, size or barcode` | |
| `inv.dash.searchEmpty` | `Nothing matches "{query}".` | |
| `inv.dash.searchEmptyBody` | `Try the size — that's how most of us find it. Like 205/55 R16.` | |
| `inv.dash.searchEmptyCall` | `Add it as a new product` | staff can create stock |

---

## 6. Operator — receive

| key | string | notes |
| --- | --- | --- |
| `inv.rec.title` | `Receive stock` | |
| `inv.rec.sub` | `Scan or type each item, then post the lines.` | |
| `inv.rec.refLabel` | `Invoice or delivery docket number` | |
| `inv.rec.refHelp` | `One number for the whole delivery. It goes on every line so we can reconcile later.` | |
| `inv.rec.refPlaceholder` | `DR-4471` | a real distributor-style reference |
| `inv.rec.refRequired` | `Put the invoice number on so we can match this to the delivery later.` | |
| `inv.rec.lineNow` | `Now {onHand} {unit}` | *below* the button |
| `inv.rec.commit` | `Receive {qty} → {onHandAfter}` | |
| `inv.rec.committing` | `Posting…` | never a spinner |
| `inv.rec.postAll` | `Post {n} lines` | |
| `inv.rec.postAllSub` | `One ledger entry per line. Each can be posted on its own.` | |
| `inv.rec.done` | `Received {qty} {unit}. {sku} is now {onHandAfter} {unit}.` | |
| `inv.rec.finished` | `Posted {n} lines. {reference} is in the ledger.` | |
| `inv.rec.mismatch` | `You typed {n}. The docket says {m}. We posted {n} and left {m} on the shelf.` | |
| `inv.rec.mismatchHold` | `Hold this line` | |
| `inv.rec.mismatchNote` | `Note what's different so the next person isn't surprised.` | |
| `inv.rec.countConflict` | `Counted on {dateLong} as {counted}. Posting will show a variance of {variance}.` | |
| `inv.rec.retry` | `The last line didn't go in. Everything before it is already saved.` | |
| `inv.rec.offline` | `You're offline, so we can't post a receive. Write the invoice number down — it'll still be here.` | |
| `inv.rec.cancel` | `Close receive` | ghost |
| `inv.rec.cancelConfirm` | `Close without posting? {n} lines you entered will be kept here for an hour.` | |
| `inv.rec.reasonPreset` | `Delivery — supplier invoice` | the default `reason` |
| `inv.rec.reasonFree` | `Anything else worth writing down?` | optional |

---

## 7. Operator — consume

| key | string | notes |
| --- | --- | --- |
| `inv.con.title` | `Consume parts` | |
| `inv.con.sub` | `What did this job use?` | |
| `inv.con.booking` | `Use booking {reference}` | |
| `inv.con.bookingSub` | `{customerName} · {dateLong} · {vehicleLabel}` | staff-only; a name is fine here, never on a customer surface |
| `inv.con.reserved` | `Reserved for this booking: {reserved} {unit}.` | |
| `inv.con.commit` | `Use {qty} → {onHandAfter}` | |
| `inv.con.post` | `Use {n} parts` | |
| `inv.con.postSub` | `Writes one ledger line per part, against {reference}.` | |
| `inv.con.done` | `Used {n} parts against {reference}. The bay can close.` | |
| `inv.con.releaseExtra` | `Release the extra {n}` | |
| `inv.con.releaseExtraSub` | `This booking reserved {reserved}, you are using {used}. The difference goes back on the shelf.` | |
| `inv.con.refuseOffer` | `Only {available} {unit} on hand. You asked for {requested}.` | |
| `inv.con.refuseCta` | `Use {available} instead` | |
| `inv.con.refuseHard` | `We have {available} {unit} and the job needs {requested}. Writing off {short} records why the shelf and the job disagree.` | |
| `inv.con.refuseCta2` | `Write this off instead` | P1 |
| `inv.con.noBooking` | `No booking selected.` | |
| `inv.con.noBookingSub` | `Pick the booking and we'll fill in what it reserved.` | |
| `inv.con.doneToBay` | `Back to the booking` | |

---

## 8. Operator — adjust

| key | string | notes |
| --- | --- | --- |
| `inv.adj.title` | `Adjust stock` | |
| `inv.adj.sub` | `The number on screen is wrong. Say why.` | |
| `inv.adj.current` | `The system says {onHand} {unit}.` | |
| `inv.adj.available` | `{available} available, {reserved} promised to bookings.` | |
| `inv.adj.kindUp` | `Add` | |
| `inv.adj.kindDown` | `Remove` | |
| `inv.adj.kindShrink` | `Write off` | |
| `inv.adj.kindUpHelp` | `Found it on the shelf. The count missed it.` | |
| `inv.adj.kindDownHelp` | `It's gone. The number was counted or keyed wrong.` | |
| `inv.adj.kindShrinkHelp` | `Damaged, leaked, or used and not logged. This one shows as a loss.` | |
| `inv.adj.reasonLabel` | `Reason` | |
| `inv.adj.reasonRequired` | `Required. "Because" is not a reason.` | |
| `inv.adj.reasonTooShort` | `Write a little more so this answers "why is this number wrong" in six weeks.` | |
| `inv.adj.reasonBecause` | `"Because" won't tell us anything. What actually happened?` | |
| `inv.adj.preset.found` | `Found on shelf` | |
| `inv.adj.preset.damaged` | `Damaged` | |
| `inv.adj.preset.wrongItem` | `Wrong item` | |
| `inv.adj.preset.shortShip` | `Supplier short-shipped` | |
| `inv.adj.preset.lost` | `Lost` | |
| `inv.adj.preset.correction` | `Counting correction` | |
| `inv.adj.commitUp` | `Add {qty} → {onHandAfter}` | |
| `inv.adj.commitDown` | `Hold to remove {qty} → {onHandAfter}` | |
| `inv.adj.commitShrink` | `Hold to write off {qty} → {onHandAfter}` | |
| `inv.adj.commitTrace` | `This writes a ledger line anyone can trace to {actorName}.` | *below* a destructive commit |
| `inv.adj.needReason` | `Add a reason` | |
| `inv.adj.why` | `We need one line so we can answer "why is this number wrong" in six weeks.` | |
| `inv.adj.overReserved` | `This is above {available} available.` | |
| `inv.adj.overReservedSub` | `{reserved} {unit} are promised to bookings. Removing more means those bookings break.` | |
| `inv.adj.done` | `Done. {sku} is now {onHandAfter} {unit}.` | |

---

## 9. Operator — count

| key | string | notes |
| --- | --- | --- |
| `inv.cnt.title` | `Count` | |
| `inv.cnt.start` | `Start a count` | |
| `inv.cnt.startSub` | `Count the shelf. The system doesn't show you what it thinks until you've counted.` | |
| `inv.cnt.scope.all` | `Everything` | |
| `inv.cnt.scope.kind` | `{KindName}` | |
| `inv.cnt.scope.one` | `One product` | |
| `inv.cnt.due` | `What's due this week` | |
| `inv.cnt.dueSub` | `{n} lines · about {minutes}` | |
| `inv.cnt.heading` | `Count {scopeName}` | |
| `inv.cnt.help` | `Count what is on the shelf. Don't look for what the system thinks it should be.` | |
| `inv.cnt.line` | `{sku} · {name}` | |
| `inv.cnt.countIn` | `Count in {unit}` | |
| `inv.cnt.blank` | `Not counted yet` | shown where the input is |
| `inv.cnt.save` | `Save {counted} {unit}` | |
| `inv.cnt.saved` | `Saved` | |
| `inv.cnt.variance` | `{counted} · we expected {expected} · {variance}` | |
| `inv.cnt.varianceUp` | `{variance} more than we thought` | long form for the accessibility tree |
| `inv.cnt.varianceDown` | `{variance} less than we thought` | |
| `inv.cnt.varianceZero` | `Matches` | |
| `inv.cnt.significant` | `That's a big difference.` | |
| `inv.cnt.significantNote` | `Say what happened — "two sold without a booking" or "broken in the rack".` | |
| `inv.cnt.noteLabel` | `What happened` | |
| `inv.cnt.noteRequired` | `A variance without a reason is either a bug or a loss. Both deserve a name.` | |
| `inv.cnt.progress` | `{counted} of {total} counted. {outstanding} to go.` | |
| `inv.cnt.finish` | `Finish counting` | |
| `inv.cnt.reviewHeading` | `Check these before you post` | |
| `inv.cnt.post` | `Post count` | |
| `inv.cnt.postSub` | `{n} lines will change the ledger. Net {netVariance} {unit}, {formatPeso(varianceValue)} at cost.` | staff-only money |
| `inv.cnt.postZero` | `Nothing on this count differs. Posting still closes it so the next one starts clean.` | |
| `inv.cnt.posted` | `Posted. {reference} is closed. {sku} now reads {onHandAfter} {unit}.` | |
| `inv.cnt.cancel` | `Cancel this count` | |
| `inv.cnt.cancelSub` | `Nothing you counted will change. Your entries are kept so you can finish it later.` | |
| `inv.cnt.reservedNote` | `{reserved} {unit} of this are promised to bookings. Count them anyway.` | |

---

## 10. Operator — reorder and order

| key | string | notes |
| --- | --- | --- |
| `inv.ord.title` | `Order from suppliers` | |
| `inv.ord.sub` | `{n} to call · {formatPeso(estimatedCost)}` | |
| `inv.ord.callSupplier` | `Call {supplierName}` | |
| `inv.ord.copySheet` | `Copy the order` | |
| `inv.ord.copySheetSub` | `Sku, quantity and unit. Paste it into the message.` | |
| `inv.ord.rowHint` | `Suggested {suggestedQty} {unit}` | |
| `inv.ord.qtyDefault` | `Default {reorderQty} {unit}` | |
| `inv.ord.markOrdered` | `Mark as ordered` | |
| `inv.ord.markOrderedSub` | `Write the reference and the date so the next person knows.` | |
| `inv.ord.refLabel` | `Their reference` | |
| `inv.ord.refPlaceholder` | `PO-2291` | |
| `inv.ord.dateLabel` | `Expected` | |
| `inv.ord.saveRef` | `Save the reference` | |
| `inv.ord.saveRefNote` | `Saved for today only. The system has no purchase-order record yet, so this row stays on the list.` | **the honesty line; ships with the button** |
| `inv.ord.tooMany` | `That is {n} {unit}. We only use about {usage30d}.` | |
| `inv.ord.tooManySub` | `Ordering more than you sell is the fastest way to turn good stock into dead stock.` | |
| `inv.ord.empty` | `Nothing to order` | |
| `inv.ord.emptySub` | `Every item is above its reorder point. Come back Monday.` | |
| `inv.ord.emptyCta` | `See the low list anyway` | |
| `inv.ord.noSupplier` | `No supplier on this item` | |
| `inv.ord.noSupplierSub` | `Add one on the product page and it'll be in this list next time.` | |
| `inv.ord.cost` | `{formatPeso(estimatedCost)}` | staff-only |
| `inv.ord.callOut` | `Call about {supplierName}` | stockout row |

---

## 11. Operator — reservations and the booking panel

| key | string | notes |
| --- | --- | --- |
| `inv.res.panelTitle` | `Parts for this booking` | staff-only panel, A4 owns the component |
| `inv.res.reserved` | `Set aside` | |
| `inv.res.consumed` | `Used` | |
| `inv.res.released` | `Released` | |
| `inv.res.expired` | `Hold expired` | |
| `inv.res.holdsUntil` | `Held until {time}` | |
| `inv.res.release` | `Release {qty} {unit}` | |
| `inv.res.releaseSub` | `Held for {bookingReference} until {time}. Releasing puts it back on the shelf.` | |
| `inv.res.releaseConfirm` | `Release {qty} {unit} back to the shelf? The booking at {time} may break.` | |
| `inv.res.expiringSoon` | `This hold ends at {time}. Say if the customer isn't coming.` | |
| `inv.res.expired` | `The hold on {sku} expired at {time}. {n} {unit} went back on the shelf.` | |
| `inv.res.deactivated` | `{sku} was taken off the list while it was set aside for {bookingReference}. The hold stays; nothing was consumed.` | |
| `inv.res.consumeMismatch` | `This booking reserved {reserved} but only {used} went into the car. {diff} {unit} released.` | |
| `inv.res.shortLine` | `Short {short} {unit} · blocking` | staff |
| `inv.res.shortLineSoft` | `Short {short} {unit} · not blocking` | staff |
| `inv.res.noneReserved` | `No parts set aside for this booking.` | |
| `inv.res.noneReservedSub` | `This service has no parts list yet, so nothing was held.` | |

---

## 12. Refusal copy — every `MovementRefusalReason`

**The rule from the contract:** *"What was actually available, so the UI can say '3 left' not
'failed'."* Every refusal below leads with the number.

### Operator-facing

| reason | string | notes |
| --- | --- | --- |
| `INSUFFICIENT_STOCK` | `Only {available} {unit} on hand. You asked for {requested}.` | never `failed` |
| `NEGATIVE_QUANTITY` | `That's a negative number. Enter how many are actually there.` | |
| `ZERO_QUANTITY` | `Enter a number first.` | |
| `PRODUCT_INACTIVE` | `{sku} is not being sold any more. Put it back first if you mean to change it.` | links to `inv.prod.activate` |
| `OPENING_ALREADY_SET` | `{sku} already has a starting count. Adjust it instead of setting it again.` | links to `inv.adj.start` |
| `INSUFFICIENT_AVAILABLE` | `Someone booked the last {unit} while this screen was open. {available} left.` | reserve-specific; the reservation race |

**Zero stock, zero shortfall — the special case.** `available === 0` and `requested > 0`:
`There's nothing of {sku} on the shelf. It needs ordering, not adjusting.`

### Customer-facing equivalents

There is no such thing as a customer-facing `MovementRefusalReason`. A customer is never
told a movement was refused; a customer is told a part is short, in `SHORTFALL-COPY.md`
terms, and the refusal reason determines *which* route:

| Internal refusal | Customer sees |
| --- | --- |
| `INSUFFICIENT_AVAILABLE` on a blocking part | Route 1 or Route 3 |
| `INSUFFICIENT_STOCK` during consume, at the counter | `We have {available}. We'll get the rest and call you.` + Route 1 |
| `PRODUCT_INACTIVE` | the size has left the finder and the services page entirely |
| `NEGATIVE_QUANTITY`, `ZERO_QUANTITY` | nothing — client-side validation, never sent |

---

## 13. Loading — `aria` labels only, no visible spinner text

| key | string | notes |
| --- | --- | --- |
| `inv.load.products` | `Loading products` | visually hidden; `aria-busy` container |
| `inv.load.search` | `Searching` | |
| `inv.load.dashboard` | `Loading today` | |
| `inv.load.low` | `Loading the low list` | |
| `inv.load.reorder` | `Loading the order list` | |
| `inv.load.product` | `Loading this product` | |
| `inv.load.ledger` | `Loading the ledger` | |
| `inv.load.count` | `Loading the count` | |
| `inv.load.availability` | `Checking stock` | customer surfaces; hidden |
| `inv.load.posting` | `Posting` | |
| `inv.load.counting` | `Counting` | |

**No visible skeleton text anywhere.** A mechanic does not need to be told the screen is
loading; it needs the number to be there.

---

## 14. Empty states

Keys only — the full trigger/copy/recovery table is in `ERROR-AND-EMPTY-STATES.md` §3.

| key | string |
| --- | --- |
| `inv.empty.dashboardAll` | `Nothing needs a decision, nothing's low, nothing's open.` |
| `inv.empty.low.heading` | `Nothing is below its reorder point.` |
| `inv.empty.low.body` | `Every item is above the number we reorder at. Come back Monday.` |
| `inv.empty.products.heading` | `No products yet.` |
| `inv.empty.ledger.heading` | `No movements recorded yet.` |
| `inv.empty.count.heading` | `Nothing to count right now.` |
| `inv.empty.bom.heading` | `No parts list on this service.` |
| `inv.empty.ordered.heading` | `Nothing ordered yet today.` |

---

## 15. Error states

Keys only — full table in `ERROR-AND-EDGE-STATES.md`.

| key | string |
| --- | --- |
| `inv.err.network` | `No connection. The number you typed is still here.` |
| `inv.err.server` | `That didn't go through. Try again.` |
| `inv.err.conflict` | `Someone else changed this while you were typing. Here's the current number: {onHand} {unit}.` |
| `inv.err.forbidden` | `Your session ended. Sign in again — nothing you typed is lost.` |
| `inv.err.rateLimit` | `Too many moves in a row. Give it a moment.` |
| `inv.err.oversold` | `This line is already wrong. Count it before changing it again.` |
| `inv.err.postedTwice` | `This count was already posted on {dateLong}. Nothing was changed twice.` |

---

## 16. The do-not-say list for inventory surfaces

| Never say | Why | Say instead |
| --- | --- | --- |
| `Only 2 left!` | Manufactured scarcity | `We have {canPromise} of the {size} on the shelf.` — and only above the `2 ×` threshold |
| `Hurry!` · `Act now!` | The customer is already in a hurry | delete the sentence |
| `Out of stock` | No verb, no owner, no date | `We need to order that in` |
| `We don't have that.` alone | Ends a 90-minute drive | capability sentence first |
| `Item unavailable` | E-commerce register | `No {size} on the shelf right now.` |
| `Unfortunately` · `Sorry for the inconvenience` | Passive, apologising to a system | delete |
| `Our supplier failed to deliver` | Blames a party the customer cannot act on | `It's running a day late. New date is {dateLong}.` |
| `Item currently unavailable due to high demand` | Manufactured scarcity unless literally measured | the real reason |
| `Inventory low!` (red, pulsing, with an icon) | Rung 1 is not an error | a flat 2px chip reading `Low` |
| `Critical stock!` | Escalation theatre on a Tuesday | `Nothing on the shelf.` |
| `Failed to complete movement` | A database operation name | `Only {available} {unit} on hand. You asked for {requested}.` |
| `Error: INSUFFICIENT_STOCK` | The enum value, verbatim, in a UI | the sentence above |
| `Operation failed (code 409)` | Nobody's language | `Someone else changed this while you were typing.` |
| `500 Internal Server Error` | Never, anywhere | `That didn't go through. Try again.` |
| `Loading…` for 6 seconds | A skeleton that never resolves | the error state at 6 s |
| `Are you sure?` (bare) | Says sure of what | `Release {qty} {unit} back to the shelf? The booking at {time} may break.` |
| `Submit` | Says nothing | `Post count` · `Receive 24 → 28` |
| `Confirm` on a stock write | Invites the double-tap | the quantity is in the label |
| `Delete` on a product | Deletes the ledger by cascade | `Stop selling this` |
| Any of `costPrice`, `marginPct`, `estimatedCost`, `supplierId`, `reorderPoint` on a customer surface | Leak | nothing |
| An ETA with no supplier commitment behind it | An invented date | the no-ETA form |
| A countdown that resets | Manufactured deadline | a factual timestamp |

---

## 17. Interpolation rules

| Rule | Detail |
| --- | --- |
| `formatPeso` and `formatPesoRange` only | from `src/lib/utils.ts`. Never a hand-typed thousands separator |
| Unit labels | `EA` resolves to a plural noun by kind where one is natural — `filters`, `pads`, `tyres` — and falls back to the raw token `ea`. `LITRE`→`L`, `KG`→`kg`, `M`→`m`, `PAIR`→`pair`/`pairs`, `SET`→`set`/`sets`. Never a concatenated plural |
| `{short}` in a variance | `+2` / `−1` with a real minus sign `U+2212`, never a hyphen. `.tabular` per `DO-NOT.md` §1.3 rule 31 |
| Dates | `{dateLong}` = `Wednesday 6 October`. `{dateShort}` = `Wed 6 Oct`. `en-PH`, `Asia/Manila` |
| Times | `{time}` = `9:00 AM`. Never `09:00` |
| References | Spelled for dictation, as the booking reference already is: `D-R dash four four seven one` |
| No raw enum in copy | `ADJUST_DOWN` never renders. The `kind` selects a string from §7/§8 |
| No raw enum in an error | `INSUFFICIENT_STOCK` never renders. See §12 |
| The actor name | `{actorName}` on a destructive trace line is staff-only and is the point of the line |
| `{customerName}` | staff-only surfaces only. Never in an SMS, never in a customer-facing string |