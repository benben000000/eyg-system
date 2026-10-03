# PRE-ORDER FLOW — "tell me when it lands"

> **Owner:** A6 · marketing & merchandising · **Status:** ready for owner sign-off
> **Applies to:** a customer who wants a size or a part the shop does not have on the rack
> **Companion docs:** `TYRE-CLEARANCE-PLAYBOOK.md` §6.2 (the low-stock reroute) ·
> `STOCK-CAMPAIGNS.md` (what low stock may say) · `CUSTOMER-BROWSING-UX.md` §3 (the
> "on order" state) · `DO-DONT.md`

---

## 0. The one thing to get right

> **A pre-order is NOT a reservation. A reservation is not a pre-order. Using one for the
> other is a bug, and it is the most expensive kind of bug in this system.**

Everything else in this document follows from that sentence.

---

## 1. Why the two are different — in the data

`Reservation` in `prisma/schema.prisma` and in `src/lib/inventory-types.ts`:

| Property | Value | Consequence |
| --- | --- | --- |
| `bookingId` | `String` — **required, non-null** | A reservation cannot exist without a booking. A pre-order is often raised *before* a booking exists. |
| `productId` | `String` — required | It points at a `Product` that must exist in the catalogue. |
| `qty` | `Int` | It is a claim on `StockLevel`. |
| `status` | `HELD` \| `CONSUMED` \| `RELEASED` \| `EXPIRED` | A **lifecycle of a hold on goods that exist**. |
| `expiresAt` | `DateTime` | A TTL so a hold does not leak forever. |
| `@@unique([productId, bookingId])` | | One hold per product per booking. |

And the invariant it exists to protect:

```
available = onHand − reserved        and available is NEVER negative
```

**The whole reservation mechanism is arithmetic on `onHand`.** A `Reservation` does not
create stock. It earmarks stock that is physically present. For a tyre that is *at the
supplier's warehouse*, there is no `onHand` to earmark.

### 1.1 What actually goes wrong if you conflate them

| Confusion | Result | Severity |
| --- | --- | --- |
| Create a `Reservation` for stock you do not have | `reserved` rises above `onHand` ⇒ `available` goes **negative** ⇒ the exact invariant the whole build exists to prevent is broken | 🔴 **Catastrophic.** Silent until a customer is standing at the counter. |
| Increment `onHand` when you order | The system believes a tyre is on the shelf that is 80 km away. Availability pages say "Ready to fit". A customer drives to Tuyo for a tyre at the distributor. | 🔴 **Catastrophic.** This is the single worst failure this build could produce. |
| Make a booking `CONFIRMED` on a blocking part that is short | A4's rule is explicit: a booking is only *promised* when `ServiceAvailabilityDto.canFulfil` is true. A pre-order cannot make it true. | 🔴 **Breaks the promise contract.** |
| Reuse the TTL to mean "pre-order expiry" | Two unrelated clocks on one row. When a pre-order "expires", somebody releases a reservation and a held tyre becomes available to someone else. | 🟠 Real, and it disappears as a ghost stockout weeks later. |
| Report pre-orders in the reorder digest | The owner sees "12 outstanding pre-orders" and counts them as demand, then buys wrong. | 🟠 Real, but visible. |

### 1.2 So the pre-order is a different object

🚩 **REQUEST TO THE ORCHESTRATOR — this is a genuine contract gap, not something A6 can
solve inside `inventory-types.ts`:**

> There is **no pre-order model**. `Product`, `StockLevel`, `StockMovement`, `Reservation`,
> `StockCount`, `ServicePartRequirement` and `Supplier` are the inventory models, and none
> of them represents *"a customer asked for something we do not have."*
>
> **Recommended shape** (orchestrator decides; A2 owns `prisma/schema.prisma`):
>
> ```
> model PreOrder {
>   id             String   @id @default(cuid())
>   reference      String   @unique   // "PO-2026-0001"
>   customerName   String
>   customerPhone  String
>   plate          String?            // personal info — Data Privacy Act. Retain, restrict.
>   size           String?            // "205/55R16"
>   preferredBrand String?            // null = no preference, take what fits
>   qty            Int      @default(1)
>   productId      String?            // resolved later, when a matching SKU is created
>   status         PreOrderStatus @default(NEW)
>     // NEW -> QUOTED -> ORDERED -> LANDED -> INSTALLED
>     //     -> UNAVAILABLE | CANCELLED | EXPIRED
>   expectedAt     DateTime?          // THE SUPPLIER'S COMMITTED DATE. Never a guess.
>   estimatedCost  Int?               // staff-only, never exposed
>   bookingId      String?            // set when it converts to a real booking
>   consentSms     Boolean  @default(false)
>   notes          String?
>   createdAt      DateTime @default(now())
>   updatedAt      DateTime @updatedAt
>   @@index([status, expectedAt])
>   @@index([customerPhone])
> }
> ```
>
> **The one rule that must be enforced in the model or the code:** a `PreOrder` **creates no
> `Reservation` and no `StockMovement`** at any point before the goods are physically
> received. It has no `productId` and no `qty` against `StockLevel` until it is `LANDED`.

**Until that model exists, this flow is a counter + Messenger + paper process.** That is
not a workaround, it is the correct answer: a two-bay shop with a phone number converts
pre-orders in a conversation far more reliably than through a form nobody has built yet.
The SOP below is written so it works today with no code, and so it maps onto the model
later without the shop changing how it behaves.

---

## 2. The distinction, side by side

| | **Pre-order** | **Reservation** |
| --- | --- | --- |
| **What it is** | A request for goods that do not exist in the shop | A hold on goods that do |
| **Requires `onHand > 0`** | **No** | Yes, always |
| **Touches `StockLevel`** | **Never** | Yes — increments `reserved` |
| **Has a ledger row** | **No** | Yes, `kind: RESERVE` |
| **Requires a `bookingId`** | **No** | Yes, non-null |
| **Has a TTL** | Yes — **customer-intent expiry**, separate clock | Yes — **hold expiry**, `expiresAt` |
| **Can make `canFulfil` true** | **No, ever** | Yes |
| **The customer promise** | *"We order it and I'll call you the day it lands."* | *"It's held for your bay on Thursday."* |
| **Converted to a reservation** | Yes — on `RECEIVE` | Already is one |
| **If the supplier cannot deliver** | Tell the customer the same day, refund in full, offer nearest size | Release the hold, booking stays or moves |

**One-line test at the counter:**

> **Can you walk to the rack and put your hand on it?**
> **Yes ⇒ reservation. No ⇒ pre-order.**

---

## 3. The flow — what the customer sees

Channel order matters: **phone first, Messenger second, web form third.**
`../research/competitors.md` §3 verified that **zero of five** local listings accept a
booking online, and the shop's top-of-funnel is a phone call. A pre-order is a conversation
by nature — the size is on the customer's sidewall and the answer is a date.

### 3.1 Stage 1 — size discovery (30 seconds, at the counter)

> **"Okay, we don't hold that one. Let's get it. Ano nga size?"**
>
> *"Alright, we don't hold that one. Let's get it for you. What size?"*

Then, in this order:

| Ask | Why it is asked first | Field it fills |
| --- | --- | --- |
| **Size** | Without it nothing else is possible. Read it off the sidewall with them. | `size` |
| **How many** | 1 / 2 / 4. A single tyre on a 4-wheel car is a conversation, not a sale. | `qty` |
| **Brand preference** | If they have none, say so out loud — *"we'll take whatever fits and is good."* Do not invent a preference. | `preferredBrand` |
| **How soon** | Determines whether this is a same-week local buy or a special order. | urgency |
| **Plate + make/model** | So the mechanic can find it on the shelf on arrival. Plate is personal information. | — |

🚫 **Never ask for a brand the shop cannot supply.** `competitors.md` §5.3 lists the only
evidenced brands: **Michelin, BFGoodrich, PETRONAS, Amaron, Radar, Blacklion, Deestone.**
Do not say Bridgestone, Goodyear, Dunlop, Maxxis or Yokohama — there is no evidence, and a
false brand promise in a tyre shop is the fastest way to lose a customer who knows tyres.

### 3.2 Stage 2 — the honest answer about the date

This is the only promise the shop makes, and it is a small one:

> **"Two options. I can call the distributor today and find out the real date — that's
> usually [lead time]. Or we take your number now and I message you the moment we know."**

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION** — lead-time bands, per supplier. These are
placeholders and must be replaced with the owner's actual experience:

| Route | Typical lead time | Status |
| --- | --- | --- |
| Common size, local distributor, in stock there | same day – 1 day | ⚠️ SUGGESTED |
| Common size, Metro Manila distributor | 3–5 days | ⚠️ SUGGESTED |
| Less common size, ordered in | 1–2 weeks | ⚠️ SUGGESTED |
| Special order (unusual width / load index) | 2–4 weeks | ⚠️ SUGGESTED |

**Never quote a lead time the shop has not confirmed with the supplier on this order.** A
date that slips by three weeks is a broken promise that costs more than a slow honest one.
If the date is not confirmed, the only permitted answer is *"I'll message you the date."*

### 3.3 Stage 3 — taking it (four fields, no deposit form, no app)

Paper or the operator screen. Four fields, then the customer leaves:

```
PRE-ORDER  PO-2026-0001
Name      ______________
Phone     ______________
Size      ______________   Qty ____
Brand     ______________   (no preference / __________)
Need by   ______________
Status    NEW ☐ QUOTED ☐ ORDERED ☐ LANDED ☐ INSTALLED
Expected  ______________  ← supplier's committed date. Blank until confirmed.
```

**`Expected` stays blank until the supplier commits.** A blank cell is honest; a guessed
date is a promise the shop made to itself.

### 3.4 Deposit — the default is no deposit

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION.** The recommended policy:

| Rule | Recommendation |
| --- | --- |
| Take a deposit? | **No**, for the first six months. A deposit creates an obligation to refund, a receipt to issue, and a balance to settle — and it converts "can you get me a tyre?" into "will you pay me back?" |
| If a deposit is taken | Written statement on the pre-order: what it is, what happens if the supplier cannot deliver, and that **it is refunded in full** on a failed order. No exceptions, no deduction, no "cancellation fee". |
| Never | A deposit on an item with no confirmed date. |

### 3.5 Stage 4 — the message that closes it

**Messenger / SMS, same day:**

```
EYG Tire: pre-order noted. <brand/pattern> <size>, <qty>.
<Expected date> — we order it <date/day>, you fit it <date>.
Wala pang bay slot booked. Message mo lang kapag ready ka.
Ref PO-2026-0001
```

**Rules on this message:** no offer in it. No promo code. No cross-sell. It is a
transactional message about the customer's own thing. Sending a promo to someone who asked
for a part is how you get marked as spam.

### 3.6 Stage 5 — the close-out message

When it lands, before the customer has asked:

```
EYG Tire: dating na yung <size> mo (Ref PO-2026-0001).
Pwede mong i-book yung bay — <2 real times>.
Sizing ng exact price pag nasa taas na, confirm ko sa job order bago mag-start.
```

Booking the bay at the same time as announcing the arrival is the entire conversion
mechanism. The two must go in one message or the customer does one of them, and it is not
always the one you wanted.

### 3.7 The three failure messages

| Situation | What to send | What you must **not** say |
| --- | --- | --- |
| **Supplier cannot deliver** | `"Hindi na available yung <size> sa supplier. Ibalik yung <deposit> ko buong-buo. May dalawa pang <size> na kaya — gusto mo?"` | *"Baka next month na."* *"Try mo na sa iba."* Anything that leaves the customer holding a date that will not arrive. |
| **Delivered but damaged / wrong size** | `"Ang dating ay mali / sira. Hindi namin i-install. Baliktad na ito — ibang padala."` | Silence. A wrong-size tyre fitted is a safety problem and a `legal-compliance-ph.md` §4.4 liability. |
| **Customer never comes** | `"Tapos na yung order mo. Bay slot mo hindi na umaabot. Kailangan mo pa ba?"` | Leave it open forever. A pre-order that never closes becomes a ghost that counts as demand next season. |

---

## 4. The staff view

### 4.1 The pre-order board

Five columns, one card each, one owner. This is a **sheet or an operator screen**, not a
dashboard.

| Column | Entered when | The only question this column answers |
| --- | --- | --- |
| **NEW** | Customer asked, nothing done yet | Has anyone called the supplier? |
| **QUOTED** | Supplier quoted a date | Has the customer been told the date? |
| **ORDERED** | PO placed, reference recorded | Is it in transit? |
| **LANDED** | Goods physically received | Has the customer been messaged? |
| **INSTALLED** | Fitted, or collected | Closed. |
| **DEAD** *(separate)* | `UNAVAILABLE`, `CANCELLED`, `EXPIRED` | Why, and was the customer told? |

**`expectedAt` sorted ascending is the whole board.** Anything overdue is at the top and
someone owns it that morning.

### 4.2 The 6am digest — four lines

`notify*` already exists for low-stock alerts. The pre-order line in the owner's morning
message:

```
PRE-ORDERS  6 open · 2 due today · 1 OVERDUE (2 days)
  OVERDUE  PO-2026-0007 · 205/55R16 · expected 4 Mar · call customer
  DUE      PO-2026-0011 · oil filter · expected today · confirm receipt
```

Three lines, every morning. Not a chart. **The only number that matters is `OVERDUE`.**

### 4.3 Staff rules — the six that get broken

| # | Rule | The failure it prevents |
| --- | --- | --- |
| 1 | 🚫 **Never tick `expectedAt` from memory.** It comes off the supplier's message. | A missed date that nobody was tracking |
| 2 | 🚫 **Never put an overdue pre-order's expected date forward** to make the board look clean. | The board stops being a truth source; the owner loses it in a week |
| 3 | **Message the customer the day it lands, not when they ask.** | They assume it was forgotten and buy elsewhere |
| 4 | **Book the bay in the same message as the arrival.** | The tyre arrives and sits. This is the #1 conversion leak in the whole flow. |
| 5 | **One item, one reference.** Do not merge two pre-orders to look tidier. | One is delivered, the other is forgotten |
| 6 | **A pre-order is not a reservation.** Nothing in the pre-order flow creates stock or a hold. | §1.1, catastrophic |

---

## 5. How it converts

The honest answer: **this flow makes money on the second job, not the first.** The first
job probably loses money if the tyre had to be special-ordered at a premium. That is fine,
and it should be said plainly to the owner, because a pre-order programme judged on its
first-job margin gets cancelled.

| Step | What happens | What it is worth |
| --- | --- | --- |
| 1 | Customer asks for a size you do not have | **₱0 today.** Also: they asked you for a tyre instead of the shop on the next street. |
| 2 | You answer in 30 seconds with a date | Trust, in a market where 138 businesses publish nothing |
| 3 | Tyre lands, you book the bay | The **mounting, balancing, valve** — labour-only, up to 25% off per playbook §4, and effectively 100% margin |
| 4 | Car is in the bay | 🔑 **This is the real conversion.** The car is on the lift. You can now check alignment, balance, brakes, underchassis — every confirmed service in `BUSINESS.confirmedServices`. |
| 5 | Job card asks for the review | `REVIEW-SOP.md`. The customer already trusts you enough to wait three weeks for you. |

**The measure that matters is not "how many pre-orders".** It is:

| Measure | Why |
| --- | --- |
| **Attach rate** — % of pre-orders that become a paid job | A pre-order that never converts is a failure, not a lead |
| **Secondary job rate** — services added at fitting | The number that makes the programme worth running |
| **Days from `NEW` to `LANDED`** | The shop's control variable |
| **`OVERDUE` count at 6am** | The quality-of-life number. It should be 0. |

---

## 6. Owner-confirmation register

| # | Item | Status |
| --- | --- | --- |
| 1 | Lead-time bands per supplier (§3.2) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 2 | Deposit policy — default no deposit; written refund terms if yes (§3.4) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 3 | Pre-order expiry window ⚠️ SUGGESTED 30 days from `NEW`, then close as `EXPIRED` | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 4 | Pre-order reference format (`PO-2026-0001`) | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 5 | Which brands the shop will special-order on request | 🚫 **TODO-VERIFY** — constrained to the evidenced list |
| 6 | Where `plate` is stored and who may read it (Data Privacy Act, sensitive) | 🚫 **TODO-VERIFY** |
| 7 | A `PreOrder` model exists at all | 🚫 **GAP — reported to the orchestrator, §1.2** |
| 8 | That no pre-order path may create a `Reservation` or a movement | 🚫 **MUST BE ENFORCED IN CODE before a model ships** |

---

## 7. Related

`TYRE-CLEARANCE-PLAYBOOK.md` §6.2 (low stock → pre-order reroute) ·
`STOCK-CAMPAIGNS.md` (what may be said when `isLow`) · `REVIEW-SOP.md` (step 5) ·
`CUSTOMER-BROWSING-UX.md` §3 (the "on order" state) · `../research/legal-compliance-ph.md`
§2.3 (plate = sensitive personal information) · `INVENTORY-AGENT-BRIEF.md` §0 (the
invariant a pre-order must never break)
