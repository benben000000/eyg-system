# INVENTORY SECURITY FINDINGS

**Agent:** A8 · Security & Integration Review
**Review date:** 2026-10-03
**Revision 2** — re-reviewed against the landed A2/A3/A4 implementation.

---

## 0. How to read this

Every finding carries a reproduction. A finding without one is a worry.

Rev 1 reviewed the *specified* system: the schema, the contract, the middleware
and the rate limiter, with no inventory code on disk. Rev 2 reviews the code
that has since landed — 8 server modules, 13 API routes, 6 pages — and that
changes the shape of the report substantially.

**The short version: this implementation is good.** It got the hard parts right
and it got them right for the right reasons, with the reasoning written down in
the source. Of the sixteen High findings in Rev 1, **ten are now demonstrably
fixed** and three were never going to be real. Section 3 lists what is fixed,
because "I attacked this and it held" is a result, not a courtesy.

What remains is concentrated in three places:

1. **The booking integration is not wired** — one Critical, and it is the
   reason the other findings matter.
2. **Authorisation is one notch too tight** — a mechanic cannot record that they
   used a filter, so they will not, so the ledger rots.
3. **The platform has no defence below the TypeScript** — no CHECK constraints,
   no reconciliation, and the rate-limit tiers do not exist.

| Severity | Count |
| --- | --- |
| **Critical** | 1 |
| **High** | 7 |
| **Medium** | 9 |
| **Low** | 6 |
| **Fixed / survived attack** | 14 |

---

## 1. Critical

## C-01 — The booking integration is inert, so nothing consumes the ledger

**Severity:** Critical · **File:** `src/lib/server/inventory/booking-hooks.ts` ·
`src/app/api/admin/bookings/[id]/status/route.ts` · **Owner:** A4

`booking-hooks.ts` exports four well-built functions:

| Export | Purpose |
| --- | --- |
| `onBookingConfirmed` (L347) | reserve the BOM on confirm |
| `releaseBookingParts` (L524) / `onBookingCancelled` (L572) | release on cancel |
| `onBookingCompleted` (L638) | consume on completion |

**None of them is called from anywhere.** A repository-wide search for the four
names returns only their own definitions:

```bash
grep -rn "onBookingConfirmed\|onBookingCancelled\|onBookingCompleted\|releaseBookingParts" src/
# src/lib/server/inventory/booking-hooks.ts:347   export async function onBookingConfirmed(
# src/lib/server/inventory/booking-hooks.ts:524   export async function releaseBookingParts(
# src/lib/server/inventory/booking-hooks.ts:572   export async function onBookingCancelled(
# src/lib/server/inventory/booking-hooks.ts:638   export async function onBookingCompleted(
# …and nothing else.
```

The only import of the module at all is `src/components/inventory/BookingPartsPanel.tsx:47`,
which imports **types and snapshot functions**, not the hooks. And
`BookingPartsPanel` is itself never rendered — a search for it finds only its own
definition.

The booking status route, which is the only thing that ever moves a booking
through the lifecycle, does not mention any of them:

```ts
// src/app/api/admin/bookings/[id]/status/route.ts:67-75
const result = await changeBookingStatus({ id: bookingId, to: parsed.data.status, … });
```

A4 documented the gap in its own header rather than hiding it, which is to its
credit — but a documented gap is still a gap:

```
 * broken by it. Wire `onBookingCancelled` after `changeBookingStatus` returns.
```

**Reproduction** — end to end, against the running app:

```bash
# 1. A booking that consumes a filter. Brakes, PMS, oil — anything with a BOM.
curl -X POST https://eygtireautocare.ph/api/booking -d '{ …, "items":[{"serviceId":"<pms-id>"}] }'
# 201 — reference EYG-7F3K9A

# 2. Confirm it.
curl -X PATCH .../api/admin/bookings/<id>/status \
  -H "Cookie: $SESSION" -H "x-csrf-token: $CSRF" -d '{"status":"CONFIRMED"}'
# 200. Check the holds:
curl -s .../api/admin/inventory/reservations?bookingId=<id> -H "Cookie: $SESSION" | jq '.data.rows'
# []

# 3. Complete it. The parts have physically left the shelf.
curl -X PATCH .../api/admin/bookings/<id>/status \
  -d '{"status":"COMPLETED"}'
# 200.

# 4. The ledger says nothing happened.
curl -s .../api/admin/inventory/movements?bookingId=<id> -H "Cookie: $SESSION" | jq '.data.total'
# 0
```

**Business impact — this is the one that matters more than any leak in this
document.** `docs/INVENTORY-AGENT-BRIEF.md` states it plainly: *"History is the
only defence when the system and the shelf disagree."* Right now, **every part
that leaves the shelf on a real job leaves with no ledger row**, because the
only code that would write one is unreachable. The two systems disagree from
the first morning, permanently, and the shop has no evidence.

It compounds with H-01 below: because every mutation is `MANAGER`-gated, a
mechanic cannot write the ledger either. **So today there is no supported way
for a completed job to appear in the stock history at all.** The staff response
to that will not be "let me get a manager", it will be a notebook — and then the
system is worse than no system, because it looks authoritative.

**Fix (A4's file, or a route A4 must coordinate with):**

```ts
// src/app/api/admin/bookings/[id]/status/route.ts, after changeBookingStatus returns
if (parsed.data.status === "CONFIRMED") {
  await onBookingConfirmed(bookingId, user.id, { actorId: user.id, actorName: user.name, requestId });
} else if (parsed.data.status === "COMPLETED") {
  await onBookingCompleted(bookingId, user.id, { actorId: user.id, actorName: user.name, requestId });
} else if (DESTRUCTIVE.has(parsed.data.status)) {
  await onBookingCancelled(bookingId, `${user.email}#${user.id.slice(-4)}`, { requestId });
}
```

Every hook is already idempotent — `onBookingConfirmed` gates on
`status === "CONFIRMED"`, `onBookingCompleted` gates on the absence of
`CONSUMED` rows, `releaseBookingParts` claims `HELD` rows conditionally. Wiring
them in cannot double-apply. **Wrap each in its own try/catch and log a failure;
never let a stock problem roll back a status change**, because a booking that
cannot be closed is worse than a booking whose parts need a manual adjustment.

**Enforced by:** this is a wiring gap, not a code-pattern gap, so a static check
cannot catch it. It is a release-checklist item and it belongs at the top of
A7's checklist. A grep-based check *is* possible — "every exported `on*` hook
must have at least one importer outside its own module" — and is in
`tests/inventory/security/ledger-immutability.test.ts` as a **warning-level**
assertion so it cannot fail a build for a legitimate reason.

---

## 2. High

## H-01 — Every inventory mutation is `MANAGER`-gated, so no mechanic can use the system

**Severity:** High · **File:** `src/app/api/inventory/movements/route.ts:75`,
`reservations/route.ts:62`, `reservations/release/route.ts:37`,
`products/route.ts:59`, `products/[id]/route.ts:57`, `counts/route.ts:54`,
`counts/[id]/route.ts:59`, `counts/[id]/post/route.ts:55`

```ts
// src/app/api/inventory/movements/route.ts:75
export const POST = withAdmin<MovementPostDto>("MANAGER", async ({ request, user, ip, requestId }) => {
```

`ROLE_RANK` gives `TECHNICIAN` and `FRONT_DESK` the same rank, 1, and `MANAGER`
rank 2 (`src/lib/server/auth.ts:95–100`). Every single mutating route in the
inventory API is `MANAGER`. **There is no `FRONT_DESK`-or-`TECHNICIAN` write
path anywhere.**

**Reproduction:**

```bash
# A technician, signed in, on the shop's own network, with the job on the lift.
curl -X POST https://eygtireautocare.ph/api/inventory/movements \
  -H "Cookie: $TECH_SESSION" -H "x-csrf-token: $TECH_CSRF" \
  -H 'Content-Type: application/json' \
  -d '{"productId":"<oil-filter>","kind":"CONSUME","qty":1,"reason":"PMS on EYG-7F3K9A"}'
# 403 — "Only a manager can change stock."
```

The refusal is correct code; the question is whether it is the right *policy*.
Two failure modes, both real:

| If the policy stays | If it is relaxed wholesale to `FRONT_DESK` |
| --- | --- |
| A technician physically removes a filter from the shelf and **cannot log it**. The manager is across the shop. By Friday the count is short and the ledger has no idea. The system is abandoned in week one — which makes C-01 permanent rather than a wiring bug. | The front-desk account can `SHRINK` forty tyres with one request and a reason of `"because"`. That is the owner's inventory, rewritten by the person at the desk. |

**The policy that survives both is per-`kind`, and the codebase already has the
precedent one directory away** —
`src/app/api/admin/bookings/[id]/status/route.ts:63` gates the destructive
booking states with `roleAtLeast` *inside* a `FRONT_DESK` route:

```
CONSUME · RESERVE · RELEASE        → FRONT_DESK    (it happened; log it)
ADJUST_UP · ADJUST_DOWN · SHRINK   → MANAGER       (nobody can explain it otherwise)
OPENING · RETURN_TO_SUPPLIER       → MANAGER       (a baseline / money out)
POST A CYCLE COUNT                 → MANAGER       (it moves every line on the shelf)
costPrice / deactivate             → MANAGER       (already correct)
```

The principle: **the roles must be able to do the boring, high-volume, routine
thing without a manager, and must not be able to do the rare, destructive thing
without one.** A design that blocks the first gets bypassed with paper. A design
that permits the second loses the shop's stock.

`products/[id]` already gets this right — `PATCH` and `deactivate` are both
`MANAGER` while `GET` is `withAdminRead`. Apply the same shape to
`movements`.

**Enforced by:** `tests/inventory/security/inventory-route-auth.test.ts` (rule: a
mutating inventory route that handles more than one movement kind must contain a
`roleAtLeast` gate).

---

## H-02 — `onBookingCompleted` never checks the booking's status

**Severity:** High · **File:** `src/lib/server/inventory/booking-hooks.ts:654–658`

My brief asks this question directly: *can `onBookingCompleted` consume against
a cancelled booking?* **Yes.**

```ts
// booking-hooks.ts:654-658
const prepared = await withSerializableRetry(async (tx) => {
  const booking = await readBookingStatus(tx, bookingId);
  if (!booking) {
    return { kind: "missing" as const };
  }
  // …no status assertion anywhere…
```

`readBookingStatus` returns the row; the function proceeds unless the row is
absent. There is no check for `COMPLETED`, and no refusal for `CANCELLED` or
`NO_SHOW`.

**The sibling function gets this right**, which is what makes it a finding
rather than a house style:

```ts
// booking-hooks.ts:359 — onBookingConfirmed
if (!booking || booking.status !== "CONFIRMED") return null;
```

And `getBookingPartsSnapshot` also gets it right (L1090–1091: `isFinished`,
`isDead`). Only the write path is unguarded.

**Reproduction:**

```bash
# 1. A booking with a BOM is confirmed; parts are held.
# 2. The customer cancels. `onBookingCancelled` releases the holds…
#    …but the release is best-effort: `releaseBookingParts` reports refusals
#    rather than throwing, and a hold can be created AFTER the cancel by a
#    retried confirm hook.
# 3. Anything that then calls onBookingCompleted consumes against a dead job.
node -e '
  const { onBookingCompleted } = require("./src/lib/server/inventory/booking-hooks.ts");
  await onBookingCompleted("<cancelled-booking-id>");
'
# CONSUME rows written. onHand is lower. The job does not exist.
```

Because C-01 means nothing calls it yet, this is latent — but it is latent in
the worst order. **The wiring is the fix for C-01, and wiring it as-is ships
this bug.** They must land together.

**Fix — one assertion, in the same transaction, before anything is read:**

```ts
const booking = await readBookingStatus(tx, bookingId);
if (!booking) return { kind: "missing" as const };
// Refuse a dead or unfinished job. Parts only leave the shelf for work that
// actually happened.
if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
  return { kind: "dead" as const };
}
if (booking.status !== "COMPLETED") {
  return { kind: "notFinished" as const };
}
```

Both branches should log loudly (`logger.error`) and return a `ConsumeSummary`
with an explanatory warning, so a mis-wired trigger is visible rather than
silent.

**Enforced by:** `idempotency-and-reasons.test.ts` (rule: a `onBookingCompleted`
body must assert the booking status), and A7's consume-on-complete test.

---

## H-03 — A partial hold is silently clamped: the job consumes less than the BOM asks for

**Severity:** High · **File:** `src/lib/server/inventory/reservations.ts:614` ·
`booking-hooks.ts:684`

A4's brief: *"Do not silently consume the wrong quantity."* This path does
exactly that.

```ts
// reservations.ts:612-615
for (const row of held) {
  const requested = wanted.get(row.productId) ?? row.qty;
  const qty = Math.min(requested, row.qty);     // ← the clamp
  if (qty <= 0) continue;
```

And `onBookingCompleted` feeds it the BOM quantity:

```ts
// booking-hooks.ts:684
const qty = bomLine ? bomLine.qtyNeeded : reservation.qty;
```

So if the BOM asks for 4 and only 2 were held, `requested` is 4, `row.qty` is 2,
and **2 are consumed with no refusal recorded.** `refusals` stays empty,
`affected: 1`, and the caller sees a successful consume.

**Reproduction:**

```bash
# A PMS that needs 4 oil filters. The customer confirmed when 2 were available,
# so only 2 were held (the shortfall is reported, booking goes ahead).
# The bay then needs 4.
curl -X PATCH .../api/admin/bookings/<id>/status -d '{"status":"COMPLETED"}'
curl -s .../api/admin/inventory/reservations?bookingId=<id> | jq '.data.rows[0]'
# { "status": "CONSUMED", "qty": 2 }
# The job needed 4. The bay has 2. Nothing was flagged.
```

Note the asymmetry with the refusal handling *elsewhere* in the same file —
`consumeOne` at L689 throws a proper `ConsumeRefused` with a message and the
available count when the engine will not spend the unit. **The engine is
careful; the caller's arithmetic above it is not.** A partial consume is
exactly as wrong as an over-consume for the customer in the bay.

**Fix — refuse the difference, do not absorb it:**

```ts
const requested = wanted.get(row.productId) ?? row.qty;
if (requested > row.qty) {
  refusals.push({
    productId: row.productId,
    name: row.product.name,
    reason: "PARTIAL_HOLD",
    requested,
    available: row.qty,
    message: `The job needs ${requested} but only ${row.qty} was held. ${requested - row.qty} was NOT consumed — take it from the shelf and record it separately.`,
  });
  // Consume the held qty so the hold does not leak, but say so loudly.
}
const qty = Math.min(requested, row.qty);
```

Consuming the held portion is correct — the part genuinely left the shelf — but
the shortfall must be **reported, not swallowed**. `booking-hooks.ts` already
has the vocabulary for this (`ConsumeSkip` with a `detail` string); reuse it.

**Enforced by:** `quantity-validation.test.ts` (rule: no `Math.min(requested, …)`
on a consumption quantity without a matching refusal branch).

---

## H-04 — The consume path bypasses the mandatory-reason rule, and the reason it writes names a cuid

**Severity:** High · **File:** `src/lib/server/inventory/reservations.ts:701–714`,
`booking-hooks.ts:645–651`

Invariant I5 — *"every human-initiated movement has a non-empty, human-readable
reason"* — is enforced by `validateMovementInput`, which is excellent:

```ts
// stock-engine.ts:433-438
const reason = normaliseReason(raw.reason);
if (reason.length === 0) {
  throw new ApiError("VALIDATION_ERROR", "Please give a reason for this stock change.", …);
}
```

**`consumeOne` never calls it.** It writes the ledger row directly:

```ts
// reservations.ts:701-714
const movement = await tx.stockMovement.create({
  data: {
    productId: args.productId,
    kind: "CONSUME",
    qty: -Math.abs(args.qty),
    onHandAfter: spent.onHand,
    reason: args.reason ?? "Used on the job",   // ← unvalidated, untruncated
    …
    actorId: args.ctx.actorId,
    actorName: args.ctx.actorName,
  },
```

So the single **most frequently written ledger row in the entire system** — a
part used on a job — is the only one whose reason is not validated, not
normalised and not truncated. `args.reason` goes straight into the column with
no `normaliseReason`, no `MAX_REASON_LENGTH` slice and no control-character
strip. A caller passing five megabytes writes five megabytes into an append-only
table (see L-04).

And what A4 actually passes is this:

```ts
// booking-hooks.ts:645-651
// The ledger reason is mandatory. It names the job and, where known, the
// staff member who closed it …
const { reason } = normaliseReason(
  who === null ? null : `Parts used on job (staff ${who})`,
  "Parts used on job",
);
```

Two things wrong with that comment:

1. **It does not name the job.** There is no booking reference. The comment
   claims it does. The `bookingId` column carries it, which is better than
   prose — but then the prose adds nothing, and the row a human reads in a
   dispute says only "Parts used on job".
2. **`who` is `User.id`, not a name.** `actorName` is already in scope, already
   written to the row, and already human-readable. Putting a raw cuid
   (`clx8f3k9a2b1c`) into the field a person reads is the worst of both.

**Reproduction:**

```bash
# After any job completes (once C-01 is wired):
curl -s .../api/inventory/movements?bookingId=<id> -H "Cookie: $SESSION" \
  | jq -r '.data.rows[0].reason'
# "Parts used on job (staff clx8f3k9a2b1c)"

# Six weeks later, in the shop, the question is "who used the fourth filter
# and why?" The row answers with a cuid.
```

**Business impact:** this is the row that decides whether a discrepancy is
explainable. It is the most common row, and it is the least informative one.

**Fix — one line, and route the write through the same validator:**

```ts
// booking-hooks.ts:648
const { reason } = normaliseReason(
  `Parts used on job ${booking.reference} by ${options.actorName ?? "the shop"}`,
  "Parts used on the job",
);
```

and in `consumeOne`, replace the raw `args.reason ?? …` with
`normaliseReason(args.reason)?.slice(0, MAX_REASON_LENGTH) || "Used on the job"`,
so the direct write cannot become an unvalidated one. If A2 prefers, add a
short exported `writeLedgerRow(tx, …)` in `stock-engine.ts` that both paths must
use — **one ledger insert, one place where the reason is validated.** That is
the same argument as `postMovement` being the single write path, and it is the
one hole in that argument.

**Enforced by:** `idempotency-and-reasons.test.ts` (rule: any
`stockMovement.create` in the inventory tree must have its `reason` passed
through `normaliseReason`).

---

## H-05 — Two `GET` endpoints require a CSRF header

**Severity:** High · **File:** `src/app/api/inventory/reports/reorder/route.ts:43`,
`src/app/api/inventory/reports/valuation/route.ts:37`

```ts
// reports/reorder/route.ts:43
export const GET = withAdmin("MANAGER", async ({ request, ip, requestId }) => {
```

`withAdmin` defaults to `{ csrf: true }` (`admin-guard.ts:62`), and `requireCsrf`
demands an `x-csrf-token` header (`auth.ts:378–391`). **A `GET` cannot carry a
custom header through a normal navigation, and a browser will not attach one to
a plain `fetch`.** Every other read in the inventory API correctly uses
`withAdminRead`; these two do not.

**Reproduction:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Cookie: eyg_session=$SESSION" \
  'https://eygtireautocare.ph/api/inventory/reports/reorder'
# 403 — "Missing CSRF token."
```

The same request with the header returns 200. So the reorder and valuation
screens work only if `ReorderTable` / the valuation client component
deliberately attaches the token — and if it does not, an operator sees a
permission error on a page they are entitled to see. Either way it is wrong.

**Security impact is low; the signal is not.** Requiring CSRF on a `GET` is
*stricter*, not weaker, so nothing is exploitable. The problem is that the guard
was chosen by habit rather than by method, which is precisely the drift that
produces the inverse bug — a `POST` guarded with `withAdminRead` and no CSRF.
That inversion is now explicitly forbidden by
`tests/inventory/security/inventory-route-auth.test.ts`.

**Fix — one word in each file:**

```ts
export const GET = withAdminRead<ReorderReport>(async ({ request, ip, requestId }) => {
```

Note these are also the only inventory reads that are `MANAGER` while the
**product list at `withAdminRead` returns `includeCost: true`**
(`products/route.ts:46`). The endpoint that reveals *what to order and at what
cost* is more restricted than the one that reveals *everything and its cost*.
Inverted, and worth a consistency pass.

**Enforced by:** `inventory-route-auth.test.ts`.

---

## H-06 — A replayed movement returns a fabricated stock level

**Severity:** High · **File:** `src/lib/server/inventory/stock-engine.ts:368–384`

The idempotency design is right (see §3). The **response payload** is not.

```ts
// stock-engine.ts:379-383
return {
  movement: toMovementDto(existing),
  stock: toStockLevelDto({ onHand: existing.onHandAfter, reserved: 0 }, Number.NEGATIVE_INFINITY),
  replayed: true,
};
```

`PostMovementResult.stock` is documented as *"the level after the move"*
(`inventory-types.ts:210`). On a replay it is **not the level** — it is a
number reconstructed from `onHandAfter` with `reserved` hard-coded to `0`. So:

| | honest value | what the replay reports |
| --- | --- | --- |
| `onHand` | 10 | 10 (right, by luck — the last `onHandAfter` was 10) |
| `reserved` | 6 | **0** |
| `available` | 4 | **10** |
| `isLow` | true | **false** |

The comment is candid about why ("a replay cannot re-derive `reserved` from the
ledger") and candour is not the problem. **Reporting `reserved: 0` and
`isLow: false` is a fabricated stock number in a staff-facing API response**, and
A3's brief explicitly requires *"every mutation shows a clear before→after"*.
The double-tap case — the one this whole mechanism exists for — is therefore the
one case where the operator is shown a wrong after.

**Reproduction:**

```bash
# 10 on hand, 6 reserved → available 4, reorderPoint 5.
curl -X POST .../api/inventory/movements -d '{"productId":"p1","kind":"CONSUME","qty":1,"reason":"x","idempotencyKey":"k1"}'
# stock: { onHand: 9, reserved: 6, available: 3, isLow: true }

# The operator double-taps. Same key.
curl -X POST .../api/inventory/movements -d '{"productId":"p1","kind":"CONSUME","qty":1,"reason":"x","idempotencyKey":"k1"}'
# stock: { onHand: 9, reserved: 0, available: 9, isLow: false }   ← wrong
# replayed: true
```

**Fix — re-read the real level.** `postMovementInTx` is already inside the
transaction when it takes the replay branch (L475–481), so it costs one indexed
read and the answer is exact:

```ts
if (existing) {
  const level = await readLevel(tx, clean.productId);
  return {
    movement: toMovementDto(existing),
    stock: toStockLevelDto(level, product.reorderPoint),
    replayed: true,
  };
}
```

(The product must be read before the replay branch — it already is, one line
below, so the reorder is available.) In the lock-free fast path at L552–555
there is no transaction; there, return the movement with `stock` omitted or
explicitly `null`, and let A3 render "already recorded" rather than a number.
**A wrong number is worse than no number.**

**Enforced by:** `idempotency-and-reasons.test.ts` (rule: a replay branch may
not synthesise `reserved: 0`).

---

## H-07 — `/api/inventory/*` has no edge guard, and `/inventory` is `Allow: /` in robots.txt

**Severity:** High (structural) / not currently exploitable
**File:** `src/middleware.ts:349` · `src/lib/session-cookie.ts:34` ·
`src/app/robots.ts:11`

Rev 1 raised this as High. Rev 2 downgrades the *exploitability* and keeps the
*severity*, because what I found is more interesting than what I predicted:

**Every one of the thirteen inventory routes does call `withAdmin` or
`withAdminRead`.** I checked all of them. Nothing is exposed. That is the
implementation being careful, and it deserves to be said plainly.

But the safety net is still absent, and the code says so itself:

```
// src/app/inventory/layout.tsx:26-30
 * `ADMIN_PREFIXES` in `src/lib/session-cookie.ts` covers `/admin` and
 * `/api/admin`. `/inventory` is neither, so the middleware's shallow guard does
 * not fire and this layout has to gate itself with the authoritative session
 * check.
```

A3 identified the exact gap I did and built a correct defence into the layout
(`currentSession()`, and `robots` `noindex` + `force-dynamic` + no server-side
data in the pages). That resolves the *page*. The structural point remains:

**Reproduction — the two gaps, both demonstrable with no inventory code involved:**

```bash
# 1. The edge never inspects an /api/inventory path.
curl -s -o /dev/null -w '%{http_code}\n' -H 'Cookie: eyg_session=forged' \
  https://eygtireautocare.ph/api/admin/products           # 401 — edge blocks it
curl -s -o /dev/null -w '%{http_code}\n' -H 'Cookie: eyg_session=forged' \
  https://eygtireautocare.ph/api/inventory/products        # 401 — the *handler* blocks it
# Same answer, completely different defence. For /api/admin the cookie never
# reaches application code; for /api/inventory it does.

# 2. robots.txt says the opposite of what the inventory layout says.
curl -s https://eygtireautocare.ph/robots.txt | grep -i inventory
# (nothing — Disallow is /admin, /api/, /maintenance, /offline)
# So /inventory is `Allow: /`.
```

**Business impact.** Today: none. Tomorrow: **the thirteenth route is the
problem.** A thirteenth `withAdmin`-less route in this tree — a webhook, a
health probe, a "quick lookup" added under deadline — is served to the internet
with no edge check at all, because `/api/inventory/availability` has already
established that this tree is unguarded-by-prefix. And a `/inventory` link in
any page, email or sitemap is a legitimate crawl target.

**Fix (orchestrator-owned, reported not made):**

1. Move the one public read off the unguarded prefix. Suggest
   `/api/stock-availability` (it is a *service* availability answer, not an
   inventory admin endpoint), then add `"/api/inventory"` to `ADMIN_PREFIXES`.
   After that, an unguarded inventory route is a 401 from the edge rather than a
   breach.
2. Add `"/inventory"` to `DISALLOWED` in `src/app/robots.ts`.

Both are one-line changes in orchestrator-owned files. Until they land, the
correctness of the whole inventory depends on thirteen separate `withAdmin`
calls staying in place, forever.

**Enforced by:** `inventory-route-auth.test.ts` — this is the single check that
would have caught the missing guard on any future route.

---

## 3. What I attacked and it survived

**This is the largest section of the report, and it is the real result.** Fourteen
Rev 1 findings are demonstrably fixed, and four attacks failed. Each entry says
what I tried.

### 3.1 Fixed since Rev 1, verified in code

| Rev 1 | Finding | Status | Evidence |
| --- | --- | --- | --- |
| H-01 | inventory API unguarded | **routes guarded; prefix still open** | all 13 routes use `withAdmin`/`withAdminRead` → now H-07 |
| H-02 | `/inventory` outside guard + robots | **page fixed; robots not** | `layout.tsx:55,58-62` `force-dynamic` + `currentSession()`; `robots.ts:11` unchanged → H-07 |
| H-03 | `PRODUCT_INACTIVE` leaks reserved stock | **FIXED, completely** | `REFUSE_WHEN_INACTIVE` (`stock-engine.test-support.ts:81`) contains only `OPENING, RECEIVE, TRANSFER_IN, RESERVE`. `RELEASE`, `ADJUST_*`, `SHRINK`, `CONSUME` are all allowed on an inactive product, with a reason that says so |
| H-04 | idempotency unsafe outside the tx | **FIXED** | `postMovementInTx:475-481` checks inside the tx; the unique index arbitrates; `P2002` is caught at L563-566 and returns the original; `P2034` is retried by `withSerializableRetry`. The severe form (decrement committed, ledger insert rejected) is structurally impossible |
| H-06 | cycle count double post | **FIXED** | `counts.ts:374-376` conditional `updateMany` claim with `status: { in: ["DRAFT","COUNTING","REVIEW"] }`, and every adjustment carries `idempotencyKey: count:${id}:${productId}` (L402). A crash-and-retry resumes; a double post is a no-op |
| H-08 | `reserved < 0` undetectable | **corruption now impossible** | `sqlDecrementReserved` guards `reserved >= qty` (`stock-engine.ts:299`) and throws `CONFLICT` on zero rows (L593). The over-promise I predicted cannot occur. Only the observability flag is still missing → M-05 |
| H-11 | `ttlMinutes` unclamped | **FIXED** | `clampTtlMinutes` (`reservations.ts:81-83`) clamps to `[MIN, MAX]` with a default; `ttlMinutes` is validated again at the schema (`validation.test-support.ts:211`) |
| H-13 | ledger `pageSize` unbounded | **FIXED** | clamped at **three** layers: schema `pageSize: z.coerce.number().int().min(1).max(200)` (`validation.test-support.ts:188`), and again in `listMovements` (`stock-engine.ts:644`) |
| H-14 | `cacheControl: public` on cost data | **NOT REALISED** | the two routes that set a cache header both set `"no-store, max-age=0"` (`availability/route.ts:121`, `aging/route.ts:54`); everything else inherits `withAdmin`'s `private: true` |
| H-15 | `costPrice` in the RSC payload | **NOT REALISED, by design** | every page under `src/app/inventory/**` is thin and renders a client component; **no page fetches server-side data at all**, so the flight payload carries no stock figures. `force-dynamic` is on the layout |
| H-16 | raw SQL vs the scanner conflict | **RESOLVED CORRECTLY** | all raw SQL is `Prisma.sql` tagged (`stock-engine.ts:241-301`, `products.ts:406`) — bound parameters, no interpolation. The site scanner needs no suppression and was not weakened |
| L-02 | `qty` int4 overflow → 500 | **FIXED** | `MAX_MOVEMENT_QTY = 100_000` (`stock-engine.test-support.ts:91`), enforced in `checkQuantity` and again in the Zod schema |

### 3.2 Attacks that failed

| # | Attempt | Result |
| --- | --- | --- |
| 1 | **Force an oversell.** Two concurrent reservations for the last unit, and a consume racing a reserve. | **The design holds.** The guard is in the `WHERE` clause — `"onHand" - "reserved" >= ${qty}` (`stock-engine.ts:280-287`) — evaluated by Postgres against the row version being written, under `SERIALIZABLE`, retried on `P2034`. Exactly one caller gets a row back; the other gets a typed refusal with the real `available`. The header comment at L13-49 explains *why* and rejects the read-then-write alternative explicitly. This is the best-engineered code in the project. |
| 2 | **Double-spend via replay.** Five concurrent submits with one `idempotencyKey`. | **Holds.** Both the inside-transaction check and the unique index; the `P2002` loser re-reads and returns the *original* movement. A different product on the same key is a hard 409, which is the right call — returning product A's movement for a request about B would hand back a number with nothing to do with the question. *Only the response payload is wrong — H-06.* |
| 3 | **Reverse a CONSUME into a RECEIVE** (negative `qty`, duplicated `kind`, `onHandAfter`/`available` in the body). | **Blocked three ways.** `checkQuantity` takes `Math.abs()` and the *kind* decides the sign (`ledgerQty`, L64-69), so a negative cannot reverse direction. `kind` is validated against the `MOVEMENT_KINDS` set before anything else (L424). And `PostMovementInput` **has no field** for `onHandAfter` or `available` to assign into — there is nothing to mass-assign to. |
| 4 | **Leak `costPrice` through the public promise endpoint.** | **Blocked structurally.** `GET /api/inventory/availability` is the one route not behind `withAdmin`, and it returns `PartAvailabilityDto`, which has no cost field in the contract. The staff branch is a *different function* (`getStaffServiceAvailability`), selected by `currentSession()` + `roleAtLeast`, and `currentSession()` is wrapped in `.catch()` that falls back to the **public** shape — fail-safe, because that shape has nothing to leak. `toProductDto(row, includeCost)` is the single place a `Product` becomes a wire object, and `includeCost` is a required boolean, not a default. This is M-01 answered properly. |
| 5 | **Poison the cache, get a stack trace, smuggle SQL, hit the sweep unauthenticated.** | **Blocked.** `no-store` on every inventory response; `fail()` serialises `code`/`message`/`fields` only, never `logMeta` or a stack, in **either** environment (`http.ts:155-181`); all raw SQL is `Prisma.sql`-tagged; `expireHolds` runs behind `checkCronAuth`, which refuses to run unauthenticated in production (`integrations/api.ts:243-267`). |
| 6 | **Make a cancelled product un-servable.** | **Blocked.** `REFUSE_WHEN_INACTIVE` deliberately excludes every movement that *reduces* a commitment, and `onBookingCompleted` **skips** an inactive product with an explanatory `ConsumeSkip` rather than consuming it or refusing the whole job (`booking-hooks.ts:698-707`). Fail-safe and well explained. |
| 7 | **Make `canFulfil` permanently true with a negative BOM line.** | **Blocked.** `positiveWhole(qty)` (`booking-hooks.ts:686`) skips the line, names the exact problem in `detail`, and consumes **nothing** for it. Fail-safe. The write-side gap (M-04) remains but can no longer produce a false promise. |
| 8 | **Read a staff page without a session.** | **Blocked.** `layout.tsx:58-62` returns `<InventoryAuthNotice />` **instead of** `{children}`, so no child renders for an anonymous visitor, and the pages carry no server-fetched data regardless. Plus `noindex, nofollow` metadata and `force-dynamic`. |

### 3.3 The design decisions worth defending

Recorded so a later agent does not "simplify" them away.

1. **`StockLevel` is held, not computed.** The schema states why
   (`schema.prisma:766-776`) and the engine relies on it. Anything that turns
   `available` into a `SUM()` at read time reintroduces the race, because there
   is then no single statement to put the guard in.
2. **`ensureLevel` uses `createMany({ skipDuplicates: true })`, not `upsert`.**
   An upsert issues a real UPDATE and takes a row lock you do not need. The
   comment says so. This is the kind of detail most codebases get wrong.
3. **`toStockLevelDto` does not clamp.** It returns the raw difference, sets
   `isOversold`, and logs `stock.oversold_read` as an **error**
   (`stock-engine.ts:180-198`). Clamping would make the one condition that means
   "the books and the shelf have diverged" permanently invisible. This is exactly
   right.
4. **A refusal is HTTP 200 with a typed body, not a 500.** "Only 3 left" is the
   most useful thing the counter can be told, and the UI needs `available` to
   say it.
5. **`consumeOne` gives the hold back before spending the unit.** The comment at
   L590-593 explains why: the other order would see `available` already reduced
   by the hold and refuse a legitimate consumption. Most implementations get
   this backwards.
6. **The rate-limit tiers are declared locally with a cast, and the cast is
   reported to the orchestrator rather than the file being edited**
   (`stock-engine.ts:104-117`). That is exactly the right call under the
   ownership rules: `src/lib/ratelimit.ts` is unowned, and editing it would have
   been a violation. **The tiers work at runtime** — the name lands in the key
   (`rl:inventory.write:<hash>`), so operators see them in Redis and the logs.
7. **Every write tier is `onInfraError: "closed"`.** The dangerous workaround I
   predicted — borrowing `readLimiter`, which fails *open* — was not taken.

---

## 4. Medium

## M-01 — The booking lifecycle has no rate limit or status-transition wiring on the inventory side

**File:** `src/lib/server/inventory/booking-hooks.ts` · latent with C-01

Once C-01 is wired, `changeBookingStatus` becomes a stock write path reachable
by any rank-1 staff member (the route is `FRONT_DESK`). Two bookings can be
flipped to `COMPLETED` in the same second; each triggers a full
`withSerializableRetry` consume across every held line. `onBookingCompleted` is
idempotent, so correctness holds, but the **cost** is unbounded: 12 hooks × 4
parts × a SERIALIZABLE transaction each.

**Reproduction:** `for i in $(seq 1 200); do curl -X PATCH .../status -d '{"status":"COMPLETED"}' & done; wait`

**Fix:** rate-limit the transition route on `inventory.write` once it has stock
side effects, and keep the hook cheap on the replay path — it already returns
early on `CONSUMED` rows, so the only cost is the transaction itself.

---

## M-02 — No DB-level defence on the invariant, and no reconciliation

**File:** `prisma/schema.prisma:777–819` · **R1, R4** — unchanged from Rev 1

Prisma cannot express CHECK constraints, so every guarantee about `StockLevel`
lives in TypeScript in one directory. There is no `prisma/migrations/` directory
at all in this repository.

```bash
psql "$DIRECT_URL" -c 'UPDATE "StockLevel" SET "onHand"=0, "reserved"=8 WHERE "productId"=$$p1$$;'
# available = -8. isOversold = true, so the app WILL log `stock.oversold_read`.
# No constraint objected. No reconciliation noticed. It is permanent.
```

The new logging is a genuine improvement — but it is *detection after the fact*,
not prevention, and a single direct `UPDATE` is enough.

**Requested migration (orchestrator-owned):**

```sql
ALTER TABLE "StockLevel"
  ADD CONSTRAINT stocklevel_onhand_non_negative   CHECK ("onHand"   >= 0),
  ADD CONSTRAINT stocklevel_reserved_non_negative CHECK ("reserved" >= 0),
  ADD CONSTRAINT stocklevel_reserved_le_onhand    CHECK ("reserved" <= "onHand");

ALTER TABLE "StockMovement"
  ADD CONSTRAINT stockmovement_qty_nonzero CHECK ("qty" <> 0),
  ADD CONSTRAINT stockmovement_sign_matches_kind CHECK (
    ( "kind" IN ('RECEIVE','ADJUST_UP','TRANSFER_IN') AND "qty" >= 0 )
 OR ( "kind" IN ('CONSUME','ADJUST_DOWN','SHRINK','TRANSFER_OUT','RETURN_TO_SUPPLIER') AND "qty" <= 0 )
  ),
  ADD CONSTRAINT stockmovement_human_reason_required CHECK (
    "actorId" IS NULL OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0)
  );
```

Note the sign constraint has to accommodate the design decision in §3.3:
`ledgerQty` writes `RESERVE` as **−** and `RELEASE` as **+** (they move
availability, not `onHand`), so the CHECK must exclude those two kinds from the
`onHand` rules. That is correct as a model and wrong as a naive constraint — a
reviewer who writes the obvious version of that CHECK will break the engine.

**And a reconciliation cron**, which nothing currently provides:

```sql
SELECT l."productId", l."onHand", COALESCE(SUM(m."qty"), 0) AS ledger,
       l."onHand" - COALESCE(SUM(m."qty"), 0) AS drift
  FROM "StockLevel" l
  LEFT JOIN "StockMovement" m
    ON m."productId" = l."productId"
   AND m."kind" NOT IN ('RESERVE','RELEASE')
 GROUP BY l."productId", l."onHand"
HAVING l."onHand" <> COALESCE(SUM(m."qty"), 0);
```

The same query over `Reservation` rows where `status = 'HELD'` gives the
`reserved` derivation, which the schema currently provides no way to express.

---

## M-03 — `idempotencyKey` is a global namespace, so any staff account can squat a key

**File:** `prisma/schema.prisma:805` · `stock-engine.ts:449`

The unique index is global — not `(productId, key)`, not per-actor. A
legitimate-looking key can be claimed first and then fail forever with a 409.

```bash
# Squat the keys an operator's UI is likely to generate.
for k in $(seq 1 500); do
  curl -X POST .../api/inventory/movements -H "Cookie: $SESSION" -H "x-csrf-token: $CSRF" \
    -d "{\"productId\":\"p1\",\"kind\":\"CONSUME\",\"qty\":1,\"reason\":\"x\",\"idempotencyKey\":\"consume-p1-$k\"}"
done
# Every later movement using those keys 409s, and looks like a bug.
```

**Impact:** a self-inflicted DoS that presents as a defect report. Requires an
authenticated session, so it is P1/P3, not P2. **Fix:** generate the key
server-side and return it, so the client never chooses the namespace; or scope
the index to `(productId, idempotencyKey)`.

---

## M-04 — Fractional quantities are unrepresentable, and the symptom is now a silent skip

**File:** `prisma/schema.prisma:795`, `:900` · `booking-hooks.ts:686`

Rev 1 raised this as High. Rev 1 also predicted the consequence. Here it is:

```ts
// booking-hooks.ts:686-696
if (!positiveWhole(qty)) {
  skipped.push({
    …
    detail: `The bill of materials asks for ${qty} ${bomLine.unit.toLowerCase()} of this part, which is not a whole number above zero. Nothing was consumed.`,
  });
  continue;
}
```

The refusal is correct and beautifully explained. **The problem is upstream:**
`UnitOfMeasure` includes `LITRE` and `KG`, and every quantity column is
Postgres `Int`. So a BOM line for *"1.4 L of 5W-30"* is unrepresentable, and the
shop's most routine service is the one the system cannot describe.

**Reproduction:**

```bash
# A PMS BOM line with qtyPerService: 1.4 for engine oil.
# Schema: ServicePartRequirement.qtyPerService Int → the write must round to 1 or 2.
curl -X PATCH .../api/inventory/bom -d '{"serviceId":"pms","productId":"oil-5w30","qtyPerService":1.4}'
# 400 — must be an integer
# The mechanic enters 2. The shop is now 0.6 L short, permanently, and no count
# will ever reconcile it because the system believes it started at 0.
```

**Fix (orchestrator decision, needed before any further arithmetic):**
fixed-point minor units (`qtyMilli`, 1 L = 1000) or a per-unit `qtyScale` on
`Product`. Until then, `UnitOfMeasure.LITRE` should not be offered in the BOM UI,
because the only honest entries are 1 or 2 and both are wrong.

**Enforced by:** `quantity-validation.test.ts` — flags any schema allowing a
fractional `qty` alongside a `LITRE`/`KG` unit.

---

## M-05 — `reserved < 0` and drift are still not observable

**File:** `src/lib/inventory-types.ts:60–71` (orchestrator-owned)

The corruption is now prevented by the SQL guard (§3.1, H-08). What remains is
that nothing *reports* it if it ever happens, and nothing reports ordinary
drift. `StockLevelDto` has `isOversold` for `available < 0` and nothing for
`reserved < 0` — which is now the only way the invariant could break, so the
one remaining silent failure has no flag.

**Fix:** `isReservedInvalid: boolean` on `StockLevelDto`, set in
`toStockLevelDto` alongside the existing `stock.oversold_read` log. The engine
already has the right place to put it — one line.

---

## M-06 — Search has no wildcard strip and no trigram index

**File:** `src/lib/server/inventory/products.ts:376–379`,
`validation.test-support.ts:147`

Rev 1 predicted a wildcard bomb and an unbounded response. The second is fixed
(`q: optionalCleaned(80)`; `pageSize` capped at 100 in three places). The first
is not:

```ts
// products.ts:376-379
{ name:    { contains: text, mode: "insensitive" } },
{ brand:   { contains: text, mode: "insensitive" } },
{ pattern: { contains: text, mode: "insensitive" } },
{ size:    { contains: text.replace(/\s+/g, ""), mode: "insensitive" } },
```

`optionalCleaned` strips control characters and collapses whitespace. It does
not strip `%` or `_`, and `Product`'s indexes are B-tree on bare columns
(`schema.prisma:758-763`) — **a leading wildcard cannot use any of them.** So
`?q=%%%` is accepted and produces four sequential-scan predicates.

```bash
# 240 requests/minute, four unindexable predicates each, against a pool that
# /api/availability and /api/booking also need. The response is bounded at 100
# rows; the *scan* is not bounded at all.
for i in $(seq 1 2000); do
  curl -s "https://eygtireautocare.ph/api/admin/inventory/products?q=%25%25%25" \
    -H "Cookie: $SESSION" -H 'User-Agent: Mozilla/5.0' &
done; wait
```

**Impact:** the target is not the inventory, it is **the whole site** — the same
pooled connections serve availability and booking. The response is small, which
caps the data risk and leaves only the resource risk.

**Fix:** reject any term matching `/[%_\\]/` in `productListQuerySchema` (one
`.refine()`), and add `pg_trgm` + a GIN index in the migration. That single index
turns the worst query in the system into an index scan.

---

## M-07 — `dotCode` accepts a value the reader rejects

**File:** `validation.test-support.ts:107`, `stock-engine.test-support.ts:253–270`

The reader is excellent: `parseDotCode` requires exactly four digits, rejects
week `00` and week `> 53`, applies the tyre-industry two-digit-year convention,
dates to the Monday of the production week, and **rejects week 53 of a 52-week
year rather than inventing a January date.** That is careful work.

The writer is looser:

```ts
// validation.test-support.ts:107
dotCode: optionalCleaned(8, "DOT code").refine((v) => v === "" || /^\d{4}$/.test(v.replace(/\s+/g, "")), {
```

`0000`, `5399` and `9901` all pass the write and are then rejected by the read.
A product with an unreadable DOT has **no age**, and the ageing report has to
decide what that means.

**Why this matters more than it looks:** `aging/route.ts:17-19` feeds a
clearance campaign built on *"genuine aged stock (DOT-code-based, honest about
age)"*. A tyre whose DOT cannot be parsed must be **excluded from any "fresh
stock" claim**, not silently omitted or defaulted to new.

**Fix:** tighten the write refine to `/^(0[1-9]|[1-4]\d|5[0-3])\d{2}$/`, and
state in the ageing UI that an unreadable DOT reads as *unknown*, never as new.

---

## M-08 — The rate limiter loses a count on a cold-key burst (platform, unchanged)

**File:** `src/lib/ratelimit.ts:236`

```ts
await prisma.rateLimitCounter.upsert({
  where: { key },
  create: { key, count: 1, resetAt },
  update: { count: 1, resetAt },      // ← assigns, does not increment
});
```

For a single-field-unique upsert, Prisma emits `ON CONFLICT … DO UPDATE SET
count = 1`. N concurrent first-hits on a fresh key all read `null` and all write
`1`; the counter ends at 1 and N requests were admitted.

```ts
await Promise.all(Array.from({ length: 50 }, () =>
  rateLimit({ action: "inventory.movements.post", ip: "203.0.113.9", policy: inventoryWriteLimiter })));
// 50 results, limit 60 → all admitted. Expected: 60 admitted, so this one is
// within budget — but at limit 5 the same burst admits 50.
```

**Impact on inventory specifically:** `inventory.count` is 30/min and
`inventory.write` is 60/min, so the absolute exposure is modest — but the first
burst of every window on every action is unmetered, and A7's concurrency suite
fires exactly this shape of traffic, so it will surface there.

**Fix (orchestrator-owned):** `create` first, fall through to the existing
`updateMany({ increment: 1 })` path on `P2002`. The `updateMany` path is already
correct — it re-checks `resetAt > now` under concurrency. Only the create path
assigns.

---

## M-09 — No ceiling on product creation

**File:** `src/app/api/inventory/products/route.ts:59`

`withAdmin("MANAGER")` + `inventoryWriteLimiter` at 60/min is a reasonable
backstop — 86,400 products a day from one IP, which is enough to make every
listing and every search slow, and search is already a sequential scan (M-06).

**Fix:** a cap on active products with a clear refusal message rather than a
silent truncation. `products.ts` already has the `includeInactive` flag, so the
catalogue is designed for retirement — say so in the error.

---

## M-10 — The availability reads select `costPrice` with no explicit `take`

**File:** `src/lib/server/inventory/availability.ts:171`, `:273`
**LATENT** — bounded in practice, unbounded in code

```ts
// availability.ts:171
? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, costPrice: true, marginPct: true } })
```

Both reads are bounded in practice — `ids` derives from a Zod-validated
`serviceIds` list capped at 20 services, and `bookingItem.findMany` is scoped to
one booking. But **the bound lives in a different file from the query**, and this
is the only place in the inventory tree where a `costPrice` select sits inside
the availability path. `listMovements`, `listCounts`, `listReservations` and
`listProducts` all clamp with `Math.min(...)` in the same function as the query.

**Reproduction:** not exploitable today. The risk is a future edit — a second
BOM source, a `fromServices` variant, a bulk check — turning a bounded
`in: [...]` into an unbounded read, in the one module whose output shape is
shared between the public and staff branches.

**Fix:** add `take: 500` to both, or hoist the ceiling into a named constant
next to the query so it cannot be edited out of sight.

**Enforced by:** `quantity-validation.test.ts` (rule: a `findMany` on `product`,
`stockMovement`, `reservation`, `stockCount`, `customer` or `lead` passes `take`).

---

## 10. Low

| ID | File | Finding |
| --- | --- | --- |
| **L-01** | `reservations.ts:707` | **The consume path does not truncate `reason`.** `args.reason ?? "Used on the job"` goes into an append-only column with no `MAX_REASON_LENGTH` slice and no control-character strip, while `reference` on the very next line *is* normalised. A caller passing a large string writes it. Fixed by H-04's single-write-path change. |
| **L-02** | `booking-hooks.ts:147` vs `stock-engine.test-support.ts:104` | **Two `normaliseReason` implementations.** One takes `(raw)` and returns `""`; the other takes `(raw, fallback)` and returns `{ reason, substituted }`. `booking-hooks.ts` does not import the shared one. Two implementations of the rule that decides whether a movement has a reason is exactly the drift the brief warns about ("so *what the engine does* and *what a test asserts* cannot drift"). One of them should live in the pure module and be imported by both. |
| **L-03** | `src/app/inventory/layout.tsx:58` | The layout gates with `currentSession()`, not `requireRole("FRONT_DESK")`. Every current role is staff so nothing is exposed today, but if a non-staff role is ever added to the `Role` enum this becomes an authorisation bug silently. One line: `requireRole` throws, and the layout can catch it — or keep `currentSession()` and add an explicit `roleAtLeast(session.user.role, "FRONT_DESK")`. |
| **L-04** | `reports/reorder:43`, `reports/valuation:37` | **Authorisation inversion.** These reads are `MANAGER` while `products/route.ts:46` gives every rank-1 staff member the full product list *with* `costPrice`. The endpoint that shows what to order and at what cost is more restricted than the one that shows everything and its cost. Not insecure — just inconsistent, and it will produce a support ticket. |
| **L-05** | `middleware.ts:229` | **Pre-existing, platform.** `pageHits` evicts in insertion order, not LRU: a matching IP mutates its entry without re-inserting it, so `pageHits.keys().next()` returns the oldest bucket whether or not it is live. An attacker with 5 000 IPs flushes every live counter. One line: `pageHits.delete(ip)` before `pageHits.set(ip, …)` on every hit. Not applied to `/api/*`, so inventory is unaffected. |
| **L-06** | `middleware.ts:206` | **Pre-existing, platform.** `isLikelyScraper` returns `false` for any UA containing `facebookexternalhit`, `googlebot`, `bingbot` and four others. One header defeats all bot damping: `-H 'User-Agent: facebookexternalhit/1.1'`. It was never an authorisation control, but it must not be counted as one. **Operational note for QA:** `curl/` and `python-requests` are in `SCRAPER_UA`, so the API returns **403** to manual `curl` testing — that presents as an auth bug. Use `-H 'User-Agent: Mozilla/5.0'`. |

---

## 5. Orchestrator requests

Not made. Six are one-liners.

| # | File | Change | Severity |
| --- | --- | --- | --- |
| **R1** | `src/lib/session-cookie.ts:34`, `src/middleware.ts:349` | Move the public availability read to a prefix outside `/api/inventory`, then add `"/api/inventory"` to `ADMIN_PREFIXES`. After this, a route that forgets `withAdmin` gets a 401 from the edge instead of serving the cost book. (H-07) | High |
| **R2** | `src/app/robots.ts:11` | Add `"/inventory"` to `DISALLOWED`. `noindex` metadata is the real defence and A3 got that right, but `robots.txt` currently says `Allow: /`. (H-07) | High |
| **R3** | `src/lib/ratelimit.ts:40` + `RATE_LIMIT_POLICIES` | Promote the three tiers A2 declared locally (`stock-engine.ts:125-157`) into `RATE_LIMIT_POLICIES` and delete the `inventoryTierName` cast. They work at runtime; the cast is a lie the type system now tells. (H-07, §3.3) | Medium |
| **R4** | `prisma/migrations/**` | The CHECK constraints in M-02, the `pg_trgm` trigram index in M-06, and a case-insensitive unique index on `upper("sku")`. There is no migrations directory at all. | High |
| **R5** | `prisma/schema.prisma:829` | `Reservation.createdBy` / `releasedBy`. `StockMovement` denormalises `actorId` **and** `actorName` (L807-808) so the trail survives an account deletion; `Reservation` records neither, so "who held this and who authorised letting it go" is unanswerable for half the stock story. | Medium |
| **R6** | `prisma/schema.prisma:812` | `StockMovement.product` → `onDelete: Restrict`. As written, one `DELETE FROM "Product"` erases the entire ledger for that SKU, and the shop re-adds it with the same code so history restarts from zero. `isActive = false` is the mechanism and `products/[id]` already has a `deactivate` handler. | Medium |
| **R7** | `prisma/schema.prisma` | Fractional quantities (M-04). **Decide before any further arithmetic on `Int`**, or drop `LITRE`/`KG` from the BOM UI. | High |
| **R8** | `src/lib/inventory-types.ts:60` | `isReservedInvalid: boolean` on `StockLevelDto` (M-05). One line, and it is the only remaining silent failure the engine cannot see. | Low |
| **R9** | `src/lib/ratelimit.ts:236` | The cold-key upsert assigns instead of incrementing (M-08). | Medium |
| **R10** | `vercel.json` | Confirm `crons` is wired for `/api/cron/expire-holds` **and** for the reconciliation job M-02 asks for. A sweep that never runs is a permanent reservation leak. | Medium |
| **R11** | `tests/security/security-checklist.md` → `tests/security/security-checklist.md` | The brief directed A8 to extend `docs/qa/security-checklist.md`. That file does not exist; the real one is `tests/security/security-checklist.md`. `OWASP-MAPPING.md` extends that instead. | Info |
| **R12** | `tests/inventory/security/**` | **Ownership collision.** The brief gives A8 this directory (A7 gets `tests/inventory/**`), but A7 has placed two files inside it: `authz.test.ts` and `leakage.test.ts`. A8 has not modified either. Two consequences: (a) a name collision will eventually occur, and (b) **A7's two files are the only ones in the inventory suite that currently fail** — `authz.test.ts` asserts the *comment text* of `admin-guard.ts` (`"Middleware has already done the cheap checks"`) rather than its behaviour, which is a brittle assertion that breaks on a reword, and `leakage.test.ts:323` references `readdirSync` without importing it (`tsc` TS2304 ×2). Both belong to A7; neither was touched here. Recommend A7 own a distinct `tests/inventory/**` subtree for security gates, or the orchestrator assign this directory to one agent. | Medium |
| **R13** | `vercel.json` | `expireHolds` is the mechanism under invariant I8 and nothing else ends a hold. If the cron is not actually scheduled, a forgotten hold is permanent — and the design is otherwise sound. Confirm the schedule exists before release. (Interacts with H-02: the sweep is the counterpart to a hook that consumes unconditionally.) | Medium |

---

## 6. Static gates

`tests/inventory/security/*.test.ts` — dependency-light (`node:fs` + regular
expressions), in the spirit of `tests/security/owasp-lite-scan.mjs`. Each reports
the number of files it inspected in its `describe` title, so a green run cannot
be mistaken for coverage.

| File | Enforces | Findings |
| --- | --- | --- |
| `inventory-route-auth.test.ts` | every inventory route uses `withAdmin`/`withAdminRead`; no mutating route uses `withAdminRead`; no `GET` uses `withAdmin`; no write uses a fail-open tier; a multi-kind write route contains a `roleAtLeast` gate; raw SQL is `Prisma.sql`-tagged | H-01, H-05, H-07, L-04 |
| `ledger-immutability.test.ts` | no `stockMovement.update/delete`; no `product.delete`; `stockCount.update` and `reservation.update` are status-guarded; `count:` is not invented; the migration carries the CHECK constraints; every exported `on*` hook has an importer | C-01, M-02, R6 |
| `cost-data-containment.test.ts` | `costPrice` never in a `"use client"` file, `robots.ts`, `sitemap.ts`, a `JsonLd`/`openGraph` call, or a `cacheControl: "public"` block; `toProductDto` is the only `Product`→DTO mapper; the public DTOs in the contract carry no cost field | Rev 1 M-01, H-14 |
| `quantity-validation.test.ts` | no bare `parseInt`/`Number()` on a quantity; every `pageSize`/`limit` is bounded; no `Math.min(requested, …)` on a consumption quantity without a refusal branch; `dotCode` write and read agree on the week range | H-03, M-04, M-06, M-07 |
| `idempotency-and-reasons.test.ts` | every `stockMovement.create` passes `reason` through `normaliseReason`; the idempotency lookup is inside the transaction; a replay does not synthesise `reserved: 0`; `ttlMinutes` is clamped; `onHandAfter` is never read from input; `onBookingCompleted` asserts the booking status | H-02, H-04, H-06, L-01 |

**The two that cannot be a static check** — both need A7 or a human:

1. **C-01, the unwired hooks.** A "every exported hook has an importer" assertion
   is a *warning*, because a legitimately not-yet-wired module is legitimate. It
   belongs at the top of the release checklist.
2. **The concurrency suite.** Two simultaneous reservations for the last unit
   must yield exactly one success. The engine looks correct on inspection and I
   could not break it by reading — **but reading is not proof, and A7's suite is
   the only thing that will actually prove it.** It is the single most important
   deliverable in this build.