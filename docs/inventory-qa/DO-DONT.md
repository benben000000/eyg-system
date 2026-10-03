# A7 · QA — INVENTORY DO / DON'T

The rules this suite actually applies. Every ❌ here is a mistake that has either been
made in this repository or is cheap enough to make that it needs saying out loud.

If a rule here and a passing test ever disagree, **the rule wins and the test is
wrong.** Fix the test. Never the other way round.

---

## The invariant

> `available = onHand - reserved`, and it is never negative.

Everything below is downstream of that sentence.

### ✅ DO — refuse, and report the truth

```ts
return { ok: false, reason: "INSUFFICIENT_STOCK", available: 3, requested: 9, message: "…" };
```

Three filters on the shelf and a request for nine is not a failure, it is an answer.
The counter needs to say *"three left"*.

### ❌ DON'T — clamp

```ts
onHand: Math.max(0, onHand - qty)   // ❌ nine requested, three available, two left on the shelf
```

Clamping is how a discrepancy becomes unexplainable. The ledger says one thing, the
level says another, and six weeks later nobody can say which one is lying. **Refuse.**

### ❌ DON'T — write a ledger row for a refused move

Not even a `qty: 0` row. A refused move that leaves a trace creates two witnesses that
disagree. `stock-engine.test.ts` asserts the whole world is byte-identical after every
single refusal.

### ❌ DON'T — trust a client-supplied number

`onHandAfter`, `available`, `isLow`, `marginPct` — all server-side. A forged
`onHandAfter: 9999` must be ignored and the running total recomputed. There is a test
that sends one.

---

## Concurrency

### ✅ DO — make the check and the write ONE statement

```sql
UPDATE "StockLevel"
   SET "reserved" = "reserved" + $1
 WHERE "productId" = $2
   AND "onHand" - "reserved" >= $1
RETURNING "onHand", "reserved"
```

Zero rows returned means *refused*, and the refusal carries the current truth. There
is no window between deciding and committing, because there is no "then".

### ❌ DON'T — read, decide, then write

```ts
const level = await tx.stockLevel.findUnique({ where: { productId } });
if (level.onHand - level.reserved < n) return refuse();
await tx.stockLevel.update({ where: { productId }, data: { reserved: { increment: n } } });
```

Safe **only** if every caller is inside a `SERIALIZABLE` transaction that retries on
`P2034`. The moment `withSerializableRetry` becomes a bare `prisma` call — a very
reasonable-looking simplification — the guard is gone and the last filter is sold
twice. `concurrency.test.ts` proves both halves of that sentence.

### ✅ DO — wrap in `withSerializableRetry`

And treat a lost compare-and-swap as *"re-read and decide again"*, not as *"give up"*.
A CAS has one winner per read generation; without a retry loop, a burst of six
consumes against sufficient stock would serve one and refuse five. Safe, but wrong.

### ❌ DON'T — let a fake prove something it cannot model

A fake that skips an unrecognised statement, or that quietly compares
`"productId" = 'prd_…'` with `Number()` (so `NaN === NaN` is `false` and **every**
guard fails), produces a suite that is green while the engine writes nothing. Both
bugs happened in this harness. Both are now asserted against.

**If a recogniser cannot parse something, it must throw.**

### ❌ DON'T — write a race test with `Promise.all` and hope

`Promise.all([a(), b()])` interleaves nondeterministically. It reproduces a race some
of the time — which means it will be green the day it matters. **Declare the
schedule**: name the ops that must rendezvous, and assert the arrival order you got.

---

## Idempotency

### ✅ DO — replay the ORIGINAL result

```ts
{ movement: <the first one>, stock: <the first one>, replayed: true }
```

A retry that succeeded the first time is not a failure. Answering 409 makes the client
retry harder.

### ❌ DON'T — scope a key lookup without checking the product

`StockMovement.idempotencyKey` is `@unique` **globally**. A key spent on product A and
reused on product B collides for a reason that has nothing to do with B. The naive
handler — *"key exists, return what I found"* — hands back **product A's movement** as
the answer to a request about B. The caller believes it moved B's stock. B's stock
never moved. That is a wrong-answer bug, not a loud failure, which is why it gets its
own test.

### ✅ DO — remember the key de-duplicates a *submission*, not a *state*

Reserve → release → reserve must work. Treating the key as a permanent lock strands
the shop's stock forever.

---

## The promise to the customer

### ✅ DO — block only on a **blocking** part

No brake pads means the car does not leave. No decanted litre of oil means you pour
from the 4-litre case. `ServicePartRequirement.isBlocking` exists for exactly this
distinction, and it is the difference between a booking engine and a booking
obstacle.

### ❌ DON'T — block a sale for a non-blocking part

The brief calls this out and it is worth repeating: a PMS that cannot be booked
because the shop is out of shop-brand oil is a shop that turned away work it could
perfectly well do.

### ✅ DO — read `available`, never `onHand`

Six filters on the shelf, all six promised, is **zero** filters the shop can sell. Any
decision made on `onHand` is wrong by exactly the number of outstanding promises.

### ✅ DO — show the unit on every number

One oil filter, not a pack. A set of five tyres is five units. 1.4 litres is 2, because
`StockLevel.onHand` is an `Int`.

### ❌ DON'T — promise on anything but `canFulfil === true`

It is the single field the booking flow may trust.

---

## Cost and margin

### ✅ DO — assert on the RAW bytes

```ts
const raw = await response.text();
expectNoCostLeak(raw, "GET /api/inventory/availability", { sentinelCosts: [280] });
```

`expect(body.data.product).not.toHaveProperty("costPrice")` checks one sub-object of
one envelope. `JSON.parse` is not a filter — it keeps whatever you did not ask about.

### ✅ DO — plant a SENTINEL value

A response that leaks money under a renamed key (`unitCost`) still gets caught by
finding the number. Key names alone can be evaded; a value cannot.

### ✅ DO — assert the STAFF read carries the cost too

Both directions, or the test proves nothing. A filter that removes a field the
codebase never had is not a filter.

### ❌ DON'T — make a staff-only field REQUIRED

`varianceValue` was briefly `number` while documented "Staff-only". **A required field
cannot be filtered out**, so the contract — not any route — guaranteed the leak. Cost
fields are `?: number` and always will be.

### ✅ DO — measure age from the right clock

`dotCode` is **production** week (`WWYY`, pivoting at 2000). `shelfLifeDays` runs from
**receipt**, not `createdAt`. Confusing them puts three-year-old rubber in the
"arrived last week" pile.

### ❌ DON'T — decode an unreadable DOT code into a date

`9999`, `XXXX`, blank: return `null`. A tyre with no readable code that reports age 0
is advertised as brand new, and a customer drives on it.

---

## Authorisation

### ✅ DO — know what `withAdminRead` actually is

```ts
return withAdmin("FRONT_DESK", handler, { csrf: false });
```

A session, yes. **No CSRF token, and the lowest role floor.** Using it on a `POST`
hands the shop's single stock write to any counter account. Every mutating verb must be
`withAdmin("MANAGER", …)`.

### ✅ DO — check both directions of the role ladder

`TECHNICIAN` and `FRONT_DESK` both rank 1. An authz suite that only checks the
permissive direction has proved nothing.

### ❌ DON'T — take `actorName` from the request body

`StockMovement.actorName` is denormalised so history survives a deleted account. If it
comes from the payload, the audit log can be written by anyone holding a session.

---

## Tests themselves

### ✅ DO — leave a failing test failing, and report it

A red test with a file and a line number is worth more than a green run. That is the
entire point of this role.

### ✅ DO — use `it.todo` naming the exact export

```ts
it.todo("awaits `reserveForBooking` from `@/lib/server/inventory/reservations`");
```

An `it.todo` is a promise with a name on it. It is greppable, it disappears from the
report when the export lands, and it cannot be mistaken for a passing test.

### ❌ DON'T — `expect(true).toBe(true)`

Not as a placeholder, not "just to get it green", not once. It is legal TypeScript and
legal Vitest, so nothing in the toolchain will catch it — which is exactly why
`vitest.inventory.config.ts` ships a plugin that fails the run on it.

### ❌ DON'T — weaken an assertion to make a run pass

Change the fixture, or change the implementation, or file the defect. Those are the
three options. Editing the assertion is not one of them.

### ❌ DON'T — delete a failing test

Deletion is a refactor that looks like a fix. It leaves no trace, so the next person
reintroduces the bug with the same confidence.

### ✅ DO — assert the schedule you actually got

If a concurrency test declares "both callers read the same snapshot", assert the
arrival log matches. Otherwise the test asserts against a schedule it may never have
run — which is how a race test becomes green without ever having raced anything.

### ✅ DO — make a test harness prove it can fail

A leakage scanner that cannot detect a leak is worse than none, because it produces a
green tick that means nothing. Plant the leak, prove it is caught, and prove a clean
body is **not** flagged — otherwise the scanner is just noise.

### ❌ DON'T — share a mutable fixture between tests

Build everything. A stock level from the previous test is a stock level this test
cannot reason about.

### ❌ DON'T — read the wall clock

Pin the date. The DOT decoder is proved stable across `Asia/Manila`, `UTC`,
`Pacific/Kiritimati` and `America/New_York` — a tyre's age must not change with the
server's timezone, which is the failure behind "the clearance page changed overnight".

---

## One-line summary

| ✅ | ❌ |
| --- | --- |
| Refuse, and report the true `available` | Clamp |
| Make the check and the write one statement | Read, decide, then write |
| Throw when a fake cannot parse something | Skip the statement it does not recognise |
| Declare the interleaving you are testing | `Promise.all` and hope |
| Replay the original result | Replay the wrong product's result |
| Block only on a blocking part | Block a sale for a non-blocking part |
| Decide on `available` | Decide on `onHand` |
| Assert on the raw bytes | Assert on a parsed sub-object |
| Keep cost fields optional | Make a staff-only field required |
| Check both directions of the role ladder | Check only the permissive one |
| Leave it failing and report it | Weaken the assertion |
| `it.todo` naming the export | `expect(true).toBe(true)` |
| Build every fixture | Share a mutable one |
| Pin the clock | Read `Date.now()` |
