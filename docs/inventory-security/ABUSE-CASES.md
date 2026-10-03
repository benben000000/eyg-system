# INVENTORY ABUSE CASES

**Agent:** A8 · Security & Integration Review
**Date:** 2026-10-03

> **Read this first.** This is not a list of hypotheticals. Every entry is
> something a real person would actually do against a tyre shop's stock
> system, written from the attacker's side in the first person.
>
> Each case ends with one of three verdicts:
>
> - **SURVIVED** — the design holds. Say so; it is as useful as a finding.
> - **PARTIAL** — the control exists but has a hole. The hole is named.
> - **BREACH** — it works against us today, or it works the moment the obvious
>   implementation lands. The finding ID is given.
>
> Four of these are **social**. A tyre shop trains staff to be helpful, because
> helpfulness is the business. The technical controls are strong enough that
> the most likely attack is somebody asking nicely. That is not a cop-out; it
> is the threat model.

---

## Part 1 — The outsider with no account

### AC-01 · "I want to know what this shop stocks, and how little of it there is"

**Who:** a competitor two streets away, or an independent tyre reseller, on a
laptop, with time.
**Goal:** the catalogue and the depth. Depth is the valuable half — knowing the
shop is *one filter short* is worth more than knowing it sells filters.

**What I try, in order:**

```bash
# 1. Does the public board tell me?
curl -s 'https://eygtireautocare.ph/api/availability?date=2026-10-05&serviceIds=a'
# 2. Is there a public stock check?
curl -s 'https://eygtireautocare.ph/api/stock-availability?serviceIds=pms' -o r.json
# 3. Walk the catalogue through a public search, if one exists.
for id in $(seq 1 400); do curl -s "https://eygtireautocare.ph/api/products?id=$id" ; done
```

**Verdict: PARTIAL — depends entirely on the one public read.**

The contract's public DTOs are clean: `PartAvailabilityDto`,
`ServiceAvailabilityDto` and `ProductAvailabilityDto` carry `sellPrice` and
**no `costPrice`, no `reserved`, no reservation ids**. That is the hard part
already done, and it means the public surface gives away *stocking intent* and
*sell prices* — both of which are public anyway, since they are on the price
list.

What I get for free, by design: "they stock 205/55R16 in Michelin Primacy 4 and
you can have it Tuesday". That is A5's central claim — *"we have your size in
stock is the single strongest promise a tyre shop can make"* — and it is a
deliberate, valuable, correct disclosure.

What must not happen: the public read must not expose exact per-product counts
without a service context, must not be enumerable one product at a time into a
catalogue dump, and must never carry cost.

**Concretely required:**
- The public endpoint is a **per-service availability question**, not a product
  browser. One call in, one service's parts out. Not `?productId=` anything.
- It is rate-limited on its own tier (M-08) so it cannot be walked.
- It returns `isShort` / `canFulfil`, not a full stock ledger for the shop.
- **Never `cacheControl: "public"` on anything carrying inventory internals**
  (H-14).

**Failing that**, the honest read is: this is *meant* to be public, so the
finding is not "the shop leaks its catalogue" — it is "the shop leaks its
**count**". Exact counts on a public endpoint tell a competitor when to buy
stock elsewhere, and cost the shop nothing to withhold while still keeping the
promise honest (`canFulfil: true` is sufficient; `available: 37` is not).

---

### AC-02 · "The booking reference is only six characters — let me brute-force it"

**Who:** anyone. No account, no skill.
**Goal:** someone else's booking. A name, a phone number, a car, a plate, and a
schedule. In Balanga, a plate plus a schedule is a person.

**What I try:**

```bash
# 32 bits of entropy sounds like a lot. It is 2^31 attempts at 240/min.
for r in $(python3 -c 'import string,itertools; [print("EYG-"+"".join(p)) for p in itertools.product("ABCDEFGHJKLMNPQRSTUVWXYZ23456789",repeat=6)]'); do
  curl -s "https://eygtireautocare.ph/api/booking/$r?phone=09171234567" -o /dev/null -w "%{http_code} $r\n"
done | grep -v 404
```

**Verdict: SURVIVED — and it survived for the right reasons.**

`GET /api/booking/[reference]` requires the reference **and** a phone that
matches, at `/api/booking/[reference]/route.ts:50–51`. Both "unknown reference"
and "wrong phone" return **404 with the same body**, so it is not an existence
oracle — I cannot distinguish "no such booking" from "not your booking", so
there is nothing to hill-climb against. And `booking.lookup` runs on
`publicLimiter` (10/min/IP), so a sweep is 10 requests a minute.

The deeper protection is the design: the DTO excludes staff notes, cancel
reasons, IP and UTM, and `BookingDto` (`src/lib/types.ts:109–130`) has no
`serviceIds` and — critically for us — **no parts, no BOM, and no reservation
information**.

**That last point is the thing to protect going forward.** A4's brief says the
customer-facing flow should be honest about stock. "We may need to order this
in" is honest. *"Your service includes one oil filter and 1.4 L of 5W-30"* is
**the shop's consumption recipe for a job**, delivered free to anyone who
creates a booking. For a competitor that is a services-pricing and
sourcing document: it tells them exactly what to undercut and what to hold
stock in.

**Rule:** a customer-facing booking response may say a part is **short**. It may
never enumerate the parts, and `ServicePartRequirement` never crosses the
boundary. This is in the threat model as requirement A4-3 and it needs to be in
A4's header comment, because it is exactly the kind of helpful addition an
agent makes without noticing.

---

### AC-03 · "Let me flood the search box until the site stops answering the phone"

**Who:** me, a script, and patience. Or a bored staff member with a fast
connection and a stuck keyboard.
**Goal:** not data — **availability**. I do not care about your cost prices, I
care that the booking form is down on a Saturday.

**What I try:**

```bash
# `Product` has B-tree indexes on bare columns. A leading wildcard defeats all
# of them, so every one of these is a sequential scan of the whole catalogue.
for i in $(seq 1 2000); do
  curl -s "https://eygtireautocare.ph/api/admin/inventory/products?q=%25" &
done
```

**Verdict: BREACH the moment catalogue search ships, unless three things land.**

1. **`limit` capped** (M-08). `?limit=1000` must not return a thousand rows.
2. **Wildcards stripped** from the term. `%` is not a search feature.
3. **`pg_trgm` + a GIN index**, and the search route on its own limiter tier.

Without the third, this is the worst query in the system and it competes for the
**same pooled connection** as `/api/availability`, `/api/booking` and every
admin route. The connection pool is a shared finite resource. `/api/availability`
survives a flood because it is cached for five minutes; a `LIKE '%…%'` scan
cannot be cached and cannot be indexed, so it goes straight to the pool.

The limiter's own first-burst weakness (M-12) makes this worse: the first burst
of concurrent requests on a fresh key is effectively **unmetered**, because the
counter's create path assigns `count: 1` instead of incrementing.

**This is the highest-severity *denial of wallet* case in the whole document**,
because the thing being attacked is not the inventory — it is the shop's phone
and web bookings, which are the entire business.

---

### AC-04 · "Let me write to the stock engine and see what happens"

**Who:** anyone with a script.
**Goal:** see whether `POST /api/inventory/movements` needs a session.

**What I try:**

```bash
curl -s -X POST https://eygtireautocare.ph/api/inventory/movements \
  -H 'Content-Type: application/json' \
  -d '{"productId":"cld0abc123","kind":"ADJUST_UP","qty":9999,"reason":"test"}'
```

**Verdict: BREACH the moment a route lands there without `withAdmin` — H-01.**

This is the whole of H-01. `ADMIN_PREFIXES` is `["/admin","/api/admin"]`, so
`/api/inventory/**` never enters the middleware's staff guard. There is no IP
allowlist, no cookie-presence check, no CSRF-cookie check. The **only** control
is `withAdmin` in each individual route handler.

Note what the edge *does* still do: step 4 of `middleware.ts` runs the CSRF
**origin** check on every `POST` regardless of prefix, so a browser-based
cross-site CSRF fails. It does nothing against a script, because a script sets
`Origin: <anything it likes>` or omits it — and the no-Origin branch
(`middleware.ts:161–167`) explicitly permits anything that is not
`/api/webhooks`.

**Fix, and it is one line of orchestration:** give the inventory API a guarded
prefix. Put the one intended-public read on a path outside both trees, then add
`/api/inventory` to `ADMIN_PREFIXES`. After that, a route that forgets
`withAdmin` gets a **401 from the edge** — a self-inflicted outage during
development instead of a breach in production. That is the difference between
a design that relies on discipline and one that relies on a mistake not
happening.

---

### AC-05 · "Let me see if `?debug=1` or a verbose 500 gives me anything"

**Who:** me, and `curl`.
**Goal:** a stack trace, a Prisma code, a connection string, a SQL fragment.

**What I try:**

```bash
for p in 'debug=1' 'verbose=1' 'trace=1' 'dev=1' '_debug=1' 'NODE_ENV=development'; do
  curl -s "https://eygtireautocare.ph/api/inventory/products?$p"
  curl -s -X POST "https://eygtireautocare.ph/api/inventory/movements?$p" -d '{}'
done
# Break it on purpose: a body that violates the schema, a huge id, a null byte.
curl -s -X POST .../api/inventory/movements -d '{"productId":null,"kind":"NOPE","qty":"x"}'
```

**Verdict: SURVIVED. Solidly.**

I traced the whole error path rather than guessing. `withApi()`
(`src/lib/http.ts:190–209`) catches every throw. An `ApiError` passes through;
a Prisma error is mapped **by code** — `P2002` → 409, `P2025` → 404, `P2034` →
retryable 409 — with `meta.target` only, which is a *schema identifier*, not
user data. Anything else becomes a generic `INTERNAL_ERROR`. And `fail()`
(`http.ts:155–181`) builds the body from **`code`, `message` and `fields` only** —
`logMeta`, `cause` and the stack are logged with a `requestId` and never
serialised.

The one branch that looked suspicious is the development fallback at
`http.ts:206`: `logMeta: { err: String(err) }`. It is safe anyway, because
`fail()` does not put `logMeta` in the response body. So **there is no
environment in which a stack trace reaches a client through this layer.** The
`?debug=1` vector named in my brief does not exist.

**What I would still try next**, and why A2 must care: none of this protects
the *message text* of a refusal. `PostMovementRejection` carries `available`
and `requested`. If a refusal ever reaches a customer-reachable surface,
`requested` reveals what another customer's job needs. Staff-only for now; keep
it that way.

---

### AC-06 · "A `User-Agent` header is free. Let me get past the bot damper."

**Who:** me.
**Goal:** catalogue enumeration at speed.

```bash
curl -s -H 'User-Agent: facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' \
  'https://eygtireautocare.ph/api/inventory/products?limit=1000'
curl -s -H 'User-Agent: Mozilla/5.0 (compatible; googlebot/2.1; +http://www.google.com/bot.html)' \
  'https://eygtireautocare.ph/api/inventory/products'
```

**Verdict: SURVIVED, because it was never the control.**

`isLikelyScraper` (`middleware.ts:208–213`) checks `ALLOWED_BOTS` **first** and
returns `false` on a match, so `facebookexternalhit`, `googlebot`, `bingbot`,
`applebot`, `twitterbot`, `slackbot` and `discordbot` all bypass the entire
scraper list. One header.

That is fine, because the damper is explicitly a *blunting* tool and its own
comment says so. It is **not** an authorisation control and it must never be
counted as one. The real controls are `withAdmin` and the rate-limit tier.

**One practical note for the QA team**, because this will waste someone's
afternoon: `curl/` and `python-requests` are in `SCRAPER_UA`, so **the API
returns 403 to anything testing it with curl**, including manual verification
of the inventory endpoints. That presents as an auth bug. Use
`-H 'User-Agent: Mozilla/5.0'` when testing by hand.

---

## Part 2 — The authenticated insider

### AC-07 · "I have a session. Let me sell the same oil filter twice."

**Who:** a staff member, or anyone holding a borrowed session. A mechanic's
phone on the bench is unlocked more often than anyone would like.
**Goal:** walk away with a part. Two filters is two filters.

**What I try:**

```bash
# 1. Double-tap. The same request twice, fast.
for i in 1 2 3 4 5; do
  curl -s -X POST .../api/inventory/movements -H "Cookie: $S" -H "x-csrf-token: $C" \
    -d '{"productId":"f1","kind":"CONSUME","qty":1,"reason":"PMS","idempotencyKey":"job-9"}' &
done; wait
```

**Verdict: SURVIVED — provided the ledger INSERT is inside the transaction.**

`StockMovement.idempotencyKey String? @unique` (`schema.prisma:805`) is a real
unique index, and the contract defines the replay behaviour precisely
(`inventory-types.ts:192–195`): *"The server returns the ORIGINAL result for a
repeat rather than erroring."* That is the right call — a double-tap should be
invisible to the operator, not a bug report.

**The hole is one transaction boundary.** If the implementation reads
`stockMovement.findUnique({where:{idempotencyKey}})` *outside* the transaction,
and writes the ledger row *after* the stock change has committed, then both
requests miss the check, both decrement `onHand`, and one `create` fails with
`P2002` **after its decrement is already durable**. Result: the shelf is one
lower than the system believes, and the ledger has one CONSUME row instead of
two — so it does not even reconstruct. **H-04.**

The safe shape is to **claim the key first** with the unique index doing the
arbitration, inside `withSerializableRetry`, and treat `P2002` as "someone else
already did this — return their row". `findings` H-04 has the code.

**And the squat variant**, which costs me nothing:

```bash
# Pre-claim the key the next person will use. 240/min is plenty.
for k in $(seq 1 500); do
  curl -s -X POST .../api/inventory/movements -d "{\"productId\":\"f1\",\"kind\":\"CONSUME\",\"qty\":1,\"reason\":\"x\",\"idempotencyKey\":\"consume-f1-$k\"}"
done
# Now every legitimate movement using those keys 409s, forever.
```

Because the unique index is **global** — not per product, not per actor — I own
the key namespace for any value I care to claim. That is a self-inflicted DoS
that presents as a bug, and it is the argument for scoping keys to
`(productId, idempotencyKey)` or generating them server-side.

**Business impact, plainly: a mechanic double-taps "consume" on a phone with a
laggy screen, and the shop's filter count is now one lower than the shelf, with
a ledger that says otherwise. Six weeks later nobody can say why.**

---

### AC-08 · "Two of us grabbed the last tyre at the same time"

**Who:** not even an attacker. Two staff, two phones, one customer.
**Goal:** nothing. I am just doing my job.

```bash
# Two reservations, one unit, both at once.
curl -s -X POST .../api/inventory/reservations -d '{"bookingId":"b1","items":[{"productId":"t1","qty":1}]}' &
curl -s -X POST .../api/inventory/reservations -d '{"bookingId":"b2","items":[{"productId":"t1","qty":1}]}' &
wait
```

**Verdict: SURVIVED — this is the design working, and it is the reason the
design is the design.**

The guard is a single conditional write:

```sql
UPDATE "StockLevel"
   SET "reserved" = "reserved" + 1
 WHERE "productId" = 't1'
   AND "onHand" - "reserved" >= 1
RETURNING "onHand", "reserved";
```

The condition is **in the predicate**, so the row lock covers the read and the
write together. Under `SERIALIZABLE`, exactly one commit wins; the loser gets
`P2034`, `withSerializableRetry` retries it, it re-reads, sees `available = 0`,
and **refuses**. The booking gets `blocked: true` with a named shortfall, and
staff see "we may need to order this in".

This is the one design decision in the whole system that I would defend hardest,
and it rests on `StockLevel` being **held rather than computed at read time**
(`schema.prisma:766–776`). Anyone who "simplifies" `available` into a
`SUM(movements)` at read time reintroduces the race and there is no longer a
single statement to put the guard in.

**The one way to break it is to move the read outside the transaction.** Read
`available` to build a nice error message, then write — and the retry re-reads
stale truth and the second caller succeeds too. **H-04 / I1 in the threat
model.** The refusal message must be built *after* the conditional write fails.

---

### AC-09 · "Can I turn a CONSUME into a RECEIVE?"

**Who:** a rank-1 staff session. Or a curious customer if AC-04 failed.
**Goal:** stock appears. I take four filters and the system says one was used.

```bash
# A negative quantity against a consuming kind.
curl -X POST .../api/inventory/movements \
  -d '{"productId":"f1","kind":"CONSUME","qty":-4,"reason":"x"}'
# Both kinds at once, hoping one is not validated.
curl -X POST .../api/inventory/movements \
  -d '{"productId":"f1","kind":"CONSUME","kind":"RECEIVE","qty":4,"reason":"x"}'
# The full row, hoping `available` is accepted.
curl -X POST .../api/inventory/movements \
  -d '{"productId":"f1","kind":"CONSUME","qty":4,"onHandAfter":9999,"available":9999,"reason":"x"}'
```

**Verdict: SURVIVED — the contract closes all three.**

`MovementRefusalReason` includes `NEGATIVE_QUANTITY` and `ZERO_QUANTITY`
(`inventory-types.ts:202–203`), so the negative is a typed refusal, not a
clamp. `kind` is a discriminated union over `MOVEMENT_KINDS`, so the duplicated
key is a `.strict()` rejection. And the third is the best of the three:
`PostMovementInput` **has no `onHandAfter`, no `available`, no `reserved`, no
`onHand` field at all** (`inventory-types.ts:183–197`). The fields do not exist
in the type. There is nothing to mass-assign into.

That last point is worth stating loudly, because it is the difference between
"we validate that field" and "there is no such field". The contract was designed
well here.

**The residual is overflow, not sign.** `qty: 3000000000` passes
`z.number().int()` (max 2^53) and overflows Postgres `int4`, so Prisma throws
and `withApi` maps an unknown error to a **500**, not a 400. Low severity, but
it is a 500 in the logs on every attempt and the fix is a `.max()`. **L-02.**

---

### AC-10 · "Can I write off the owner's stock with a reason of 'because'?"

**Who:** the front-desk account. Rank 1. The person at the counter.
**Goal:** forty tyres gone, or — more realistically — a small one I will blame on
a supplier.

```bash
curl -X POST .../api/inventory/movements -H "Cookie: $FRONT_DESK" -H "x-csrf-token: $CSRF" \
  -d '{"productId":"t1","kind":"SHRINK","qty":4,"reason":"because"}'
```

**Verdict: BREACH if the whole route is guarded at one level — H-12.**

`ROLE_RANK` collapses `FRONT_DESK` and `TECHNICIAN` to the same rank
(`auth.ts:95–100`). So there are two possible guards and both are wrong:

| Guard on `POST /movements` | What actually happens |
| --- | --- |
| `withAdmin("MANAGER")` | **a technician cannot log that they used a filter.** The job is done, the ledger is not, the next count finds a mystery. The system is abandoned in week one, which is worse than any leak. |
| `withAdmin("FRONT_DESK")` | **the front-desk account writes off forty tyres** with one request and a reason of "because". |

The fix is per-`kind`, and the codebase already has the pattern one directory
away — `src/app/api/admin/bookings/[id]/status/route.ts:63` gates the
destructive states with `roleAtLeast(user.role, "MANAGER")` *inside* a
`FRONT_DESK` route. Copy it:

```
CONSUME · RELEASE · RESERVE       → FRONT_DESK   (it happened; log it)
ADJUST_UP · ADJUST_DOWN · SHRINK  → MANAGER      (nobody can explain it otherwise)
OPENING · RETURN_TO_SUPPLIER      → MANAGER      (baseline / money out)
costPrice write                   → MANAGER      (M-03)
```

**The principle: the roles must be able to do the boring, high-volume, routine
thing without a manager, and must not be able to do the rare, destructive thing
without one.** A design that blocks the first gets bypassed with paper. A design
that permits the second loses the shop's stock.

---

### AC-11 · "Can I hide my own shrinkage?"

**Who:** someone who already took four filters home.
**Goal:** no trace, or a trace that reads as normal.

```bash
# The naïve one — refused by PRODUCT_INACTIVE / the sign convention.
curl -X POST .../api/inventory/movements -d '{"productId":"f1","kind":"CONSUME","qty":4,"reason":"PMS"}'
# It works. It is also the one thing that is recorded.
# So: make it look like a job that did not happen.
curl -X POST .../api/inventory/reservations/release -d '{"bookingId":"b1","reason":"customer cancelled"}'
curl -X POST .../api/inventory/movements -d '{"productId":"f1","kind":"RETURN_TO_SUPPLIER","qty":4,"reference":"INV-99213"}'
# Or: the ledger can be edited, if anyone ever builds that route.
```

**Verdict: SURVIVED, and this is the strongest control in the system.**

`actorId` **and** a denormalised `actorName` on every movement
(`schema.prisma:807–808`), `reason` mandatory, `bookingId` and `reference`
recorded on the row. There is a name and a reason next to every unit that
moved. Combined with "the ledger is append-only", the concealment paths are:

- **the theft is recorded** — the CONSUME row names me and names the job;
- **the cover-up is recorded** — a RETURN_TO_SUPPLIER with a supplier invoice
  number is a claim that is *checkable against the supplier's paperwork*, which
  is exactly why `reference` exists.

**This is the difference between "we cannot explain why" and "we can explain
why, and here is who".** The brief's line — *"History is the only defence when
the system and the shelf disagree"* — is a security control, not a nicety.

**Where it does leak**, and these are the real findings:

1. **`Reservation` records no actor at all** (`schema.prisma:829–848` — no
   `createdBy`, no `releasedBy`). So while I cannot hide *a movement*, the
   trail of *who held the stock and who authorised letting it go* is
   unattributed. **M-10.**
2. **Deleting the product erases the evidence.** `StockMovement.product` is
   `onDelete: Cascade` (`:812`). One `DELETE FROM "Product"` and every
   CONSUME, RECEIVE, ADJUST and SHRINK for that tyre is gone — and the shop
   then re-adds it with the same SKU, so history restarts from zero. **M-11.**

---

### AC-12 · "What is on the shelf right now, exactly?"

**Who:** any staff account, including a technician's.
**Goal:** the whole ledger, in one request, for the next six weeks of
investigation.

```bash
curl -s '.../api/inventory/movements?pageSize=1000000' -H "Cookie: $S" -H "x-csrf-token: $C" \
  | jq '.data.movements[] | "\(.createdAt) \(.kind) \(.qty) \(.reason)"'
```

**Verdict: BREACH — `MovementQuery.pageSize` has no maximum. H-13.**

`MovementQuery` (`inventory-types.ts:374–382`) declares `pageSize?: number` with
no default and no ceiling, and the codebase already has the right primitive —
`queryInt(value, fallback, min, max)` at `src/lib/integrations/api.ts:282` —
which the availability route uses. The contract just does not carry a bound, so
nothing forces one.

What comes back is every `reason` ever written, every `actorName`, every
`bookingReference`, every `onHandAfter`. `reason` is staff free text, so this is
also a PII dump: *"customer complained about noise, called 0917-555-0142,
returning tomorrow"* is exactly the kind of sentence mechanics write. **L-05.**

**Fix:** `queryInt(v, 50, 1, 200)`, and bound `from`/`to` to at most a year.
The caller learns the total and paginates; the caller does not learn the shop's
entire internal operating history in one response.

---

### AC-13 · "Can I pin stock so you cannot sell it?"

**Who:** a customer, if AC-04 failed. Or a staff member with a grudge, or a
competitor's customer who booked four slots.
**Goal:** `available` hits zero and stays there.

```bash
curl -X POST https://eygtireautocare.ph/api/inventory/reservations \
  -d '{"bookingId":"b1","items":[{"productId":"p1","qty":4}],"ttlMinutes":315360000}'
```

**Verdict: BREACH if `ttlMinutes` is honoured as sent — H-11.**

The contract states the risk and then hands over the control:

```ts
// inventory-types.ts:236-237
/** Default 24h. A hold that never expires becomes a permanent leak. */
ttlMinutes?: number;
```

`ttlMinutes` is a number **in a client-supplied input object**. If A2 clamps
only a maximum and accepts a huge value, stock becomes invisible on demand. The
customer-facing variant is the dangerous one: if any part of A4's booking path
forwards a client-supplied `ttlMinutes`, an anonymous visitor can book four
services and hold every part each of them consumes for ten years.

Note what makes this nasty rather than merely exploitable: **nothing looks
wrong.** `reserved` is a legal value, `available` is correctly computed,
`isOversold` is false, every flag is green, and the expiry sweep is working
exactly as written. Stock is not removed — it is converted into air, and the
shop cannot order what it cannot see.

**Fix:** clamp to `[30 min, 7 days]` server-side, and **ignore the client's
value entirely on any customer-reachable path.** Also: the sweep must be safe
to run concurrently with itself, because an unbounded `updateMany` on
`expiresAt < now()` will double-release if two cron invocations overlap — which
produces `reserved < 0`, the H-08 corruption.

---

### AC-14 · "Can I post the same cycle count twice?"

**Who:** a manager, twice, on a Monday.
**Goal:** nothing malicious. I am just tired and the button did not obviously
change.

```bash
curl -X POST .../api/inventory/counts/COUNT-2026-10-04-01/post &
curl -X POST .../api/inventory/counts/COUNT-2026-10-04-01/post &
wait
```

**Verdict: BREACH unless the status transition is the lock — H-06.**

`StockCount.status` is a plain column. The natural implementation reads it,
checks it, and updates it — three separate statements, and two concurrent posts
both pass the check.

**Business impact, and this one is the worst of its kind:** the count is the
one operation whose entire purpose is to make the number *true*, and it is the
one most likely to make it false. The variance rows are individually plausible
ledger entries, so a double-post is not detectable by reading the ledger
afterwards. It is the same failure as H-04 but with a worse blast radius,
because a count is the mechanism you would otherwise use to *detect* drift.

**Fix — the transition is the lock, and the count id is the idempotency key:**

```ts
const claimed = await tx.stockCount.updateMany({
  where: { id, status: { in: ["COUNTING", "REVIEW"] } },
  data: { status: "POSTED", postedAt: new Date(), postedBy: user.id },
});
if (claimed.count === 0) throw new ApiError("CONFLICT", "Already posted.");
// then, and only then, write the ADJUST movements — each with
// idempotencyKey: `count:${countId}:${productId}`
```

The second half matters as much as the first: it makes the whole post
**replayable**, so a post that crashes half way resumes instead of
double-applying.

---

### AC-15 · "Two of us are editing this product at once and nobody noticed"

**Who:** two staff, two phones, one product.
**Goal:** nothing. I am fixing the price.

```bash
curl -X PATCH .../api/inventory/products/f1 -d '{"sellPrice":4200,"costPrice":1}' &
curl -X PATCH .../api/inventory/products/f1 -d '{"reorderPoint":10}' &
wait
```

**Verdict: PARTIAL.**

Two staff adjusting the same product is not an attack, it is Tuesday, and the
outcome is benign: the second write wins, both `AuditLog` rows exist, and the
operator sees "someone else changed this" if the UI does a version check. The
`P2034` path in `withSerializableRetry` covers genuine write conflicts.

**The part that is not benign is `costPrice`.** A `TECHNICIAN` can send
`{"costPrice":1}` (M-03) and the margin becomes 99.8%. Nobody steals anything —
the point is that `costPrice` drives `marginPct`, drives `reorderQty`, and
drives the stock valuation the owner uses to decide whether the shop is
viable. That is **corruption of the owner's decision inputs**, which is a
better motive for a bored insider than theft.

`PATCH /products` must reject `costPrice` from a non-`MANAGER`, and log the
change with the previous value.

**Related and worse:** `marginPct` is **both stored and derived**
(`schema.prisma:728–729`, "Derived at read time; stored for reporting"). Both
cannot be authoritative. Whichever A2 picks, the other will go stale, and the
owner will price off a margin that stopped existing (M-02).

---

## Part 3 — The social attacks

These four are the most likely to succeed, and none of them is a code defect.
They are listed because a security review that only looks at code will miss
every one of them.

### AC-16 · "Just quickly note down that we used one of these"

**Who:** a mechanic, genuinely busy, with a customer's car on the lift and
`FRONT_DESK`/`TECHNICIAN` rank.
**What I say:** *"Doc, can you just note down we took one of the oil filters?
Mrs. Santos is waiting and the form's asking for a reason."*

**Verdict: the design makes the *right* thing the easy thing — which is the
whole defence.**

The mandatory `reason` is the load-bearing control, and it is load-bearing
*socially*, not technically. "Because" is explicitly called out as not a reason
(`inventory-types.ts:187`). The mechanic will write *"PMS EYG-7F3K9A"* because
that is **one tap on a booking reference** and it is genuinely more useful than
typing a sentence — the reason field and the reconciliation field are the same
field.

**What to protect in A3's UI:** the reason input must be **fast**. A mechanic
with a customer waiting will abandon a three-field form, and an abandoned form
is a hole in the ledger. Make the booking reference a picker; make the common
reasons a short list; make `reference` (the PO number) one field, not a
paragraph. **The threat to the ledger is friction, not malice.**

**What genuinely helps, technically:** a daily digest of movements with a
missing or useless reason. Nobody reads it, but its existence changes the
calculation for someone deciding whether to bother.

### AC-17 · "Can you just change the cost to what I paid you?"

**Who:** the owner, legitimately, on the phone, to someone at the counter.
**What I say:** *"While you're in there, the distributor went up — put the
filter at 3,300, not 3,200."*

**Verdict: SURVIVED, and this should be easy.**

A price change is a legitimate, frequent, one-handed operation, and the design
lets it happen through a normal audited path. The control that matters is
**attribution**: `AuditLog` records the user, the IP and the previous value.

This is the inverse of AC-10 — the same control (`MANAGER` for cost writes)
protects against both the owner-of-record's legitimate change being lost in the
ledger and a technician's unauthorised one.

### AC-18 · "Send me the stock list, I need to check the reorder"

**Who:** a supplier's rep, on a visit. Or a new staff member on their first day.
**What I say:** *"Can you just export the product list with the cost price? I
want to line it up against my invoice."*

**Verdict: BREACH if there is a bulk export, and this is the finding to watch
when A3 lands.**

`ProductDto` **includes** `costPrice` and `marginPct`
(`inventory-types.ts:103–104`) — correctly, because A3 is explicitly told
*"do not hide the cost/margin column from staff"*, and that is the right call
for a four-person shop. You cannot hide margin from the person who counts the
money.

But the corollary has to be deliberate: **the cost book is exportable by every
rank-1 account, by default, in CSV, forever.** And `ProductDto.costPrice` is
**optional**, so a `Product` row is assignable to a `ProductDto` with no cast
and no type error (M-01). The safe path and the unsafe path have the same
shape, so nothing forces a mapping function.

**Required:**

1. One `toProductDto()` / `toStaffProductDto()` in the server layer. No other
   module constructs one.
2. An explicit Prisma `select` so `costPrice` is never read from the database at
   all on a path that does not need it.
3. **Orchestrator request:** split the type so the mistake stops compiling —
   `ProductDto` with no cost field, `StaffProductDto extends ProductDto` adding
   it. Then a public route *cannot* carry cost even if a raw row is passed in.
4. If there is a CSV export, it is `MANAGER`-only, it is audit-logged with a row
   count, and it says who exported the cost book.

The supplier-invoice reconciliation is a real need. Make it easy for a manager
and impossible for a technician, rather than easy for everyone.

### AC-19 · "The system says we have one. The shelf has none. Which is right?"

**Who:** the owner, on a Saturday, with a customer waiting.
**Goal:** not to steal. **To know.**

**Verdict: the ledger SURVIVES this — and only if these four things exist.**

This is the case the whole system is built for, and it is the reason
`available` is a defined term and the ledger is append-only. The question has
an answer, and it takes four steps: what does the ledger say, what does the
`StockLevel` say, when did they diverge, and who touched the product in
between.

**It fails today, at three points, all of them fixable:**

1. **`reserved` has no ledger derivation.** `StockMovement` records deltas to
   `onHand`; `reserved` moves without a ledger row. So for half the invariant
   there is no "when did they diverge" question to ask. (M-15)
2. **Nothing reconciles.** The query that would find the drift exists and is
   not run by anything. A nightly job that runs it and alerts is the single
   highest-value addition in this document — it converts H-03, H-08 and H-09
   from *"detected by a customer"* to *"detected overnight"*. (M-15)
3. **The reservation trail is unattributed.** `Reservation` records no actor,
   so the answer to "who let this go" is a shrug. (M-10)

**And one thing makes it worse:** `StockCountLine.expected` **is** snapshotted
at creation precisely so *"a concurrent sale does not silently rewrite history"*
(`schema.prisma:873–875`). That is exactly the right instinct, applied to a
column. `StockLevel` has no equivalent protection. **Give `StockLevel` the same
treatment and every finding in this document becomes detectable within a day.**

---

## Scoreboard

**Revision 2 — re-scored against the landed implementation.** The verdicts moved
a lot in the implementation's favour, and the one that moved furthest is AC-10,
which inverted.

### The design survives

| Case | Why |
| --- | --- |
| **AC-02** booking enumeration | reference **and** phone; 404 for both wrong-phone and unknown, so no oracle; 10/min |
| **AC-03** search flood | **partly.** The response is bounded (`pageSize` capped at 100 in three places), so there is no catalogue dump. The four `contains` predicates are still unindexable and `%` is still accepted — but I can no longer take the site down with it. Downgraded to M-06 |
| **AC-04** unguarded inventory route | **SURVIVED.** All thirteen routes call `withAdmin`/`withAdminRead`. The *edge* still does not cover the prefix, so the thirteenth route is the risk — H-07 |
| **AC-05** verbose error / `?debug=1` | `fail()` serialises `code`/`message`/`fields` only — `logMeta` and `cause` never leave the server, in **either** environment |
| **AC-06** bot damper bypass | one header defeats it — and it was never the control |
| **AC-07** double-tap | the check is **inside** the transaction, the unique index arbitrates, `P2002` returns the original. Only the response payload is wrong — H-06 |
| **AC-08** oversell race | the guard is in the `WHERE` clause under `SERIALIZABLE`; exactly one commit wins, the loser refuses with the real `available`. **The single best-engineered code in the project** |
| **AC-09** negative / mass-assignment | `checkQuantity` takes `Math.abs()` and the *kind* sets the sign; `kind` is validated first; `onHandAfter`/`available` **have no field to assign into** |
| **AC-11** hiding shrinkage | `actorId` + denormalised `actorName` + mandatory reason + checkable `reference` |
| **AC-13** pin stock invisible for years | `clampTtlMinutes` clamps to `[MIN, MAX]` with a default, and the Zod schema bounds it again |
| **AC-14** post the count twice | a conditional `updateMany` claim on `status ∈ {DRAFT,COUNTING,REVIEW}` **and** `idempotencyKey: count:<id>:<productId>` on every adjustment. Replay-safe |
| **AC-16** "just note it down" | the *shape* is right — a booking-reference picker makes the useful reason the fast one. **But the mechanic cannot submit it at all** — H-01 |
| **AC-17** legitimate price change | `MANAGER`-gated and audited; already the strictest correct choice |

### The design does not survive

| Case | Finding | Severity |
| --- | --- | --- |
| **AC-19** the system says we have one, the shelf has none | the hooks are not wired, so nothing is ever written | **Critical (C-01)** |
| **AC-10** write off the owner's stock | **inverted** — the route is `MANAGER`, so a *technician* cannot log a consume and the ledger rots instead | **High (H-01)** |
| **AC-11b** a partial hold is silently clamped | the job consumes 2 of 4 and nothing is flagged | **High (H-03)** |
| **AC-15** consume against a cancelled booking | `onBookingCompleted` never asserts the booking's status | **High (H-02)** |
| **AC-18** cost book exportable by everyone | `toProductDto(row, includeCost)` is now the single mapper and every route is guarded — **largely fixed**; the residual is a `TECHNICIAN` cannot reorder-list (L-04) | Low |
| **AC-19b** cannot explain the discrepancy | no reconciliation job, no DB constraints, `Reservation` has no actor | Medium (M-02, R5) |

### What inverted, and why that matters more than a leak

AC-10 was the case I most expected to find: a front-desk account writing off the
owner's tyres. **It is not there** — every mutation is `MANAGER`-gated. The
implementation over-corrected. The consequence is the mirror image and it is
worse for the business:

> A mechanic with a customer's car on the lift physically removes an oil filter
> and is told *"Only a manager can change stock."* The manager is across the shop.
> By Friday the count is short and the ledger has no idea.

Combined with C-01 — where nothing calls the consume hook — **a completed job
currently has no path to the ledger at all.** Not a permissive path and a
restrictive one. None. The two findings compound, and fixing only one of them
makes the shop's numbers worse rather than better, because a writable-but-empty
ledger is more dangerous than an unwritable one: it looks authoritative.

### The pattern across everything that remains

**Almost none of it is a missing check.** The engine validates quantity, reason,
kind, sign, TTL, page size, DOT format and cost visibility, and it refuses
rather than clamps in every case I could construct. What is missing is:

- a **wiring** from the booking lifecycle to the hooks (C-01),
- a **role decision** about who may record a routine consume (H-01),
- an **assertion** that a job is actually finished before its parts leave (H-02),
- a **refusal** when a hold is partial (H-03),
- a **response payload** that reports the real level on a replay (H-06),
- a **schema constraint** and a **reconciliation job** underneath everything
  (M-02).

Each is a few lines. None of them is a design flaw in the stock engine, which is
the part that was hardest to get right and which the implementation got right,
with the reasoning written into the source for the next person to read.