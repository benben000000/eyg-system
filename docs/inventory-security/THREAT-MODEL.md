# INVENTORY THREAT MODEL

**Agent:** A8 · Security & Integration Review
**Scope:** the EYG inventory system (stock engine, reservations, cycle counts,
booking integration) as specified by `docs/INVENTORY-AGENT-BRIEF.md` and the
orchestrator-owned contract in `src/lib/inventory-types.ts`.
**Review date:** 2026-10-03.

---

## 0. Honest statement of scope

**Revision 2 — 2026-10-03.** This document was first written against the
*specified* system, before any inventory code existed. The implementation has
since landed and the document has been revised. State at review:

| Artefact | Owner | State |
| --- | --- | --- |
| `src/lib/inventory-types.ts` | orchestrator | present, final |
| `prisma/schema.prisma` (inventory models, L616–910) | orchestrator | present, final |
| `src/middleware.ts`, `src/lib/session-cookie.ts` | orchestrator | present, **does not cover the inventory tree** |
| `src/lib/ratelimit.ts`, `src/lib/env.ts` | orchestrator | present, **no inventory tiers** |
| `prisma/migrations/**` | orchestrator | **absent — no CHECK constraints exist** |
| `src/lib/server/inventory/**` (8 modules) | A2 | **landed** |
| `src/app/api/inventory/**` (13 routes) | A2 | **landed** |
| `src/lib/server/inventory/booking-hooks.ts` | A4 | **landed, not wired to anything** |
| `src/app/inventory/**` (6 pages) | A3 | **landed** |

So this document is still two things at once:

1. A threat model of the system — the invariants, the trust boundaries and the
   attack paths, which the implementation must survive and mostly does.
2. A review of the committed code. `FINDINGS.md` carries the results.

**The headline is good news.** Of the sixteen High findings raised against the
*specification*, ten are demonstrably fixed in the landed code and three were
never going to be real. The engine got the hard parts right. What remains is
concentrated in the integration seam, one authorisation notch, and the absence of
any defence below the TypeScript layer. Sections 9 and 10 of this document —
what the design gets right, and the requirements it imposes — are now largely
**satisfied**, and are kept because they must not be traded away to make
something convenient later.

---

## 1. What an attacker actually wants here

Not the database. Not the admin panel. Three very specific things:

| # | Target | Why it is worth more than a password |
| --- | --- | --- |
| 1 | **The stock number** | Knowing the shop is one filter short of an oil filter is worth more than the filter. It sets supplier negotiation, it sets which bay jobs the shop refuses, and it tells a competitor exactly what to undercut. |
| 2 | **`costPrice`** | The shop's entire buying price, per SKU. A competitor with it does not need to guess margins — they know them. This is the single most damaging value in the schema. |
| 3 | **An unconsumable promise** | If `available` can be pushed negative, the shop sells a brake pad it does not have, with the car on the lift. That is not a data breach; it is a safety event and a customer complaint that ends the business's reputation. |

Everything else in this document is in service of those three.

The attacker profiles are, in descending order of realism for a Balanga tyre
shop:

- **P1 — A staff account with a stolen or borrowed session.** The most
  likely. A mechanic's phone is unlocked on the bench. `FRONT_DESK` is rank 1
  and `TECHNICIAN` is also rank 1.
- **P2 — A curious customer with no account at all.** They can read whatever
  is public, and they will read a lot.
- **P3 — Someone who phoned the shop.** Social engineering is cheaper than
  exploitation and the staff are friendly by design. See `ABUSE-CASES.md`.
- **P4 — A scripted attacker.** Rate-limit bypass, catalogue enumeration,
  replay.
- **P5 — A person with database access.** `pgAdmin`, a backup file, a stolen
  `DATABASE_URL`. This profile is why the ledger must be append-only and why
  the invariant needs a database-level defence.

---

## 2. The system, as specified

```
                       ┌──────────────────────────────────────────────┐
                       │  PUBLIC INTERNET                              │
                       │  customer on 3G, competitor, scripted scraper │
                       └───────────────┬──────────────────────────────┘
                                       │
  ╔════════════════════════════════════▼═══════════════════════════════════╗
  ║ TRUST BOUNDARY 1 — the edge. src/middleware.ts                          ║
  ║  · security headers + CSP nonce                                         ║
  ║  · bot damping (User-Agent substring match)                            ║
  ║  · CSRF origin/referer allowlist (mutating methods only)                ║
  ║  · admin guard: ONLY for ADMIN_PREFIXES = /admin, /api/admin           ║
  ║  · page limiter: NOT applied to /api/*                                  ║
  ║  *** /api/inventory/*  and  /inventory/*  match NO prefix here. ***     ║
  ╚═══════════════════════════════════════��══════════════════════════════════╝
             │                                              │
   ┌─────────▼──────────┐                    ┌──────────────▼───────────────┐
   │ PUBLIC API         │                    │ STAFF API                    │
   │ /api/availability  │                    │ /api/inventory/**  (A2)      │
   │ /api/booking       │                    │ withAdmin(role, handler)     │
   │ /api/quote         │                    │   1. requireRole(minimum)    │
   │ (PUBLIC_API_PREFIX)│                    │   2. requireCsrf(session)    │
   │                    │                    │   3. rateLimit(tier)         │
   │ + the ONE          │                    │   4. handler                 │
   │ public inventory   │                    │   5. writeAuditLog           │
   │ availability read  │                    │                              │
   └─────────┬──────────┘                    └──────────────┬───────────────┘
             │                                              │
             │            ╔═════════════════════════════════▼════════════════╗
             │            ║ TRUST BOUNDARY 2 — the stock engine (A2)         ║
             │            ║                                                 ║
             │            ║  postMovement()   — THE single write path        ║
             │            ║  reserve()  release()  consume()                  ║
             │            ║  postCount()  getServiceAvailability()             ║
             │            ║                                                 ║
             │            ║  withSerializableRetry(fn)   [SERIALIZABLE]        ║
             │            ║      └─ conditional write, RETURNING, then refuse  ║
             │            ╚═════════════════════════┬════════════════════════╝
             │                                      │
   ┌─────────▼──────────────────────────────────────▼──────────────────────┐
   │ TRUST BOUNDARY 3 — PostgreSQL. prisma/schema.prisma                 │
   │                                                                        │
   │   Product ──1:1── StockLevel   (onHand, reserved)  ← running total   │
   │      │                          THE ONLY cached state.               │
   │      │                                                                  │
   │      ├──*── StockMovement      ← APPEND-ONLY LEDGER (the truth)      │
   │      │       qty(signed), onHandAfter, reason, idempotencyKey@unique,  │
   │      │       actorId, actorName, bookingId                            │
   │      │                                                                  │
   │      ├──*── Reservation        ← soft hold, expiresAt, status         │
   │      ├──*── StockCount/Line    ← cycle count, expected snapshot      │
   │      └──*── ServicePartRequirement  ← the BOM (qtyPerService)          │
   │                                                                        │
   │   *** NO CHECK CONSTRAINTS. NO TRIGGERS. The invariant is asserted   │
   │       only in TypeScript. ***                                          │
   └──────────────┬──────────────────────────────────────��──────────────────┘
                  │
   ┌──────────────▼───────────────────────────────────────────────────────┐
   │ TRUST BOUNDARY 4 — the booking lifecycle (A4, booking-hooks.ts)      │
   │   confirm   → reserve(BOM)     the promise                             │
   │   cancel    → release          the hold returns                       │
   │   COMPLETED → consume          the shelf gives up the part            │
   │   TTL sweep → expire           nobody has to remember                 │
   │                                                                        │
   │   Two triggers can fire consume for the same booking: the status       │
   │   route and a cron auto-complete. There is no shared idempotency      │
   │   token between them. See FINDINGS H-05.                              │
   └────────────────────────────────────────────────────────────────────────┘
                  │
   ┌──────────────▼───────────────────────────────────────────────────────┐
   │ TRUST BOUNDARY 5 — the operator UI (A3)                               │
   │   /inventory/**  ← NOT under /admin, so no edge guard and no robots    │
   │                        disallow. Server Components fetch the server    │
   │                        modules DIRECTLY — the HTTP API's withAdmin    │
   │                        is never in the path. requireRole() must be     │
   │                        called in the page, and force-dynamic declared. │
   │   RSC flight payload ⇒ costPrice is greppable in the raw HTML.        │
   └────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The three trust boundaries that matter

**B1 — the edge.** Cheap, spoofable by a motivated caller, and **structurally
blind to the inventory tree.** `isAdmin()` matches `ADMIN_PREFIXES`
(`/admin`, `/api/admin`). Neither `/api/inventory` nor `/inventory` matches.
The edge therefore provides *zero* protection to the inventory surface. Its
CSRF origin check is the one thing that still applies (step 4 is unconditional
for `POST`/`PUT`/`PATCH`/`DELETE`), but that defends against a browser, not a
script.

**B2 — the stock engine.** This is the real boundary. Everything the attacker
wants — a fabricated number, a double-spend, a leaked cost — is decided by
TypeScript running inside a `SERIALIZABLE` transaction. There is no second
opinion from the database. If the TypeScript is wrong, the number is wrong,
forever, and the ledger (which is also TypeScript) will confidently explain
why.

**B3 — the booking lifecycle.** Where A4's hooks meet A2's primitives. The
danger here is not privilege escalation, it is **trigger multiplicity**: the
same logical consume can be initiated from two independent places with no
shared idempotency token, and only one of them has a natural conditional
guard available (the reservation status transition).

---

## 3. The invariants being defended

These are the things an attack aims to break. Each one is stated so that a test
can assert it and a reviewer can check it.

### I1 — `available = onHand − reserved`, and `available ≥ 0`. **NEVER negative.**

Stated in `src/lib/inventory-types.ts:8–14`, `prisma/schema.prisma:8–11`.
Every decrement must be a **single conditional write** whose predicate
contains the guard, not a read followed by a write.

**Why a read-then-write is a defect, not a style choice.** Two concurrent
reservations for the last unit both read `reserved = 0`, both compute
`0 − 1 ≥ 1`, both write. `SERIALIZABLE` turns this into one `P2034` and one
retry — but **only if the read and the write are in the same transaction**.
The read outside and the write inside is still a race. And
`withSerializableRetry` (`src/lib/server/db.ts:137`) retries `P2034`, so the
loser *re-reads* and correctly refuses. That is the design. The moment the
read escapes the transaction, the retry re-reads stale truth and the loser
succeeds too.

### I2 — `reserved ≥ 0`, and `reserved ≤ onHand`.

**Not stated anywhere in the contract, and not detectable.** `StockLevelDto`
(L60–71) exposes `isOversold` for `available < 0` and nothing for
`reserved < 0`. A double-`RELEASE` drives `reserved` negative, which drives
`available` **above** `onHand`, which is an over-promise rather than an
oversell — arguably worse, because it is a promise the shop makes and cannot
keep. See FINDINGS H-08.

### I3 — `StockMovement` is append-only. Never updated, never deleted.

`prisma/schema.prisma:789`. The brief is unambiguous (A2 DO NOT, A4 DO NOT,
§4 DON'T). Two schema paths violate the *spirit* even with no route in place:

- `StockMovement.product onDelete: Cascade` (L812) — **deleting a `Product`
  deletes its entire ledger.** Deactivation is the mechanism; deletion must
  never exist.
- Any `prisma.stockMovement.update*` anywhere, including a maintenance
  script or a future count-correction route.

### I4 — One ledger row per logical movement. `idempotencyKey` is unique and
the check is **inside** the transaction.

`prisma/schema.prisma:805` — `idempotencyKey String? @unique`. The unique
index is the only thing standing between a double-tapped "consume" and a
double-spend, and it is a *global* namespace (not per-product, not per-actor).

### I5 — Every human-initiated movement has a non-empty, human-readable reason.

`PostMovementInput.reason: string` is **required** (contract L187). The schema
column is `String?` (L800) with no length cap and no not-null for the kinds
that need one. The contract is stricter than the schema, which is the correct
direction — but only if it is enforced at the route, not assumed.

### I6 — No client-supplied truth.

`onHandAfter`, `available`, `reserved`, `onHand`, `costPrice`, `sellPrice`,
`marginPct`, `isNearExpiry`, `ageDays` are **server-computed or server-owned**.
The contract already omits all of them from `PostMovementInput` except
`costPrice`/`sellPrice` on the *product* write (which is legitimately
staff-supplied — see H-21 for who may set it).

### I7 — `costPrice` never reaches a non-staff surface.

`src/lib/inventory-types.ts:92`, A2 DO NOT, A5 DO NOT, A6 DO NOT. Note this
is stated four separate times across four agents, which is how you know it is
the invariant most likely to be broken by accident.

### I8 — A reservation cannot outlive its TTL, and a release is exactly-once.

`expiresAt` is the mechanism (`prisma/schema.prisma:835`). It is *not*
sufficient on its own: a cascade delete of the `Booking` removes the
`Reservation` row (L842) and the sweeper will never find it, so `reserved` is
never decremented. **TTL correctness depends on rows continuing to exist.**

### I9 — A product can always be un-reserved, written off, or deleted from the
catalogue.

This is the invariant that `PRODUCT_INACTIVE` (L204) most likely breaks, and
it is the one nobody writes a test for until the shop has lost a bay's worth
of filters. See H-03.

### I10 — Stock mutation refuses on infrastructure failure. Never fails open.

`src/lib/ratelimit.ts:22–28` documents the platform's position: write tiers
**fail closed** with 503, read tiers **fail open**. `readLimiter` is
`onInfraError: "open"` (L95). A stock mutation behind `readLimiter` is an
unbounded write path during a Redis outage.

---

## 4. Attack surface, ranked by expected value to the attacker

| # | Surface | Attacker | What they win | Guarded today by |
| --- | --- | --- | --- | --- |
| 1 | `costPrice` in any response, any page, any cache | P1, P2, P5 | the shop's buying price, per SKU | nothing structural — see M-01, H-14, H-15 |
| 2 | `POST /api/inventory/movements` replay / double-tap | P1, P4 | double-spend, a fabricated ledger | `idempotencyKey @unique` (H-04) |
| 3 | Concurrent `reserve` for the last unit | P4 (P1 by accident) | oversell, a customer with no part | conditional write + SERIALIZABLE (I1) |
| 4 | Negative / overflow `qty` | P1, P4 | turn a CONSUME into a RECEIVE | contract `NEGATIVE_QUANTITY` (L202) |
| 5 | `/inventory` UI, unguarded page fetch | P2 | full catalogue + margin | nothing (H-02) |
| 6 | Ledger endpoint with unbounded `pageSize` | P1 | the whole stock history + staff free text | `queryInt` exists but no ceiling (H-13) |
| 7 | `ttlMinutes` unclamped | P1, P4 | pin stock invisible for years | nothing (H-11) |
| 8 | `LIKE '%term%'` search flood | P4 | pool exhaustion, whole site down | `readLimiter` at 240/min (M-08) |
| 9 | Cycle-count double post | P1, P4 | double adjustment | nothing (H-06) |
| 10 | Release on an inactive product | P1 (by accident) | permanent stock leak | nothing — and the contract pushes toward it (H-03) |

---

## 5. Assets, and what "compromise" means for each

| Asset | Where it lives | Sensitivity | If lost |
| --- | --- | --- | --- |
| `Product.costPrice` | `Product` row | **Critical** — competitive intelligence | the shop's margin is public to anyone who can read one JSON body |
| `Product.sellPrice`, `size`, `brand` | `Product` row | Low — prices are published | nothing |
| `StockLevel.reserved` | `StockLevel` row | **Critical** — a promise counter | stock permanently invisible, or a promise the shop cannot keep |
| `StockMovement` ledger | append-only table | **Critical** — the only defence in a dispute | "we cannot explain why" becomes the answer to every discrepancy |
| `Reservation` | table | High — reveals what is held for which job | a customer learns what parts are reserved for a stranger's car |
| `AuditLog` | table | High | no attribution |
| Staff credentials / session | `User`, `Session` | High | all of the above |

**`Reservation` deserves a note.** It is the only model that joins a customer
(through `Booking`) to a specific physical part in the shop. A customer who can
read another customer's `Reservation` learns that a stranger's car is waiting
on brake pads, which reveals that someone's vehicle is in the shop and what is
being fitted. That is intimate, and it is exactly the kind of thing a bored
person with a reference number goes looking for.

---

## 6. Threat actors, with what they can reach

### P1 — Staff account, borrowed or stolen session

- Reaches: every `/api/admin/*` route, every `/api/inventory/*` route, and
  **every `/inventory/*` page** (which has no edge guard at all).
- Rank: `FRONT_DESK` and `TECHNICIAN` are **both rank 1** (`auth.ts:95–100`).
  So "a mechanic's phone" is a rank-1 account that can read cost and margin
  and, if the movement route is guarded at `FRONT_DESK`, shrink the owner's
  tyre stock.
- Wants: to take a part for themselves, to hide a shrinkage, to fix a
  discrepancy without a reason.
- Note: for a four-person shop, "a technician can read the cost price" is an
  **accepted** risk — you cannot hide margin from the person who counts the
  money. What is *not* acceptable is a technician **writing** `costPrice`, and
  a front-desk account **writing off** stock. Both are in FINDINGS.

### P2 — Anonymous customer

- Reaches: `PUBLIC_API_PREFIXES` + whatever else has no guard. Today that is
  `/api/availability`, `/api/booking`, `/api/quote`, `/api/captcha`,
  `/api/reviews`, `/api/health` — and, unless guarded by the handler,
  `/api/inventory/*` and `/inventory/*`.
- Wants: the stock depth (to know what to order elsewhere), the DOT codes (to
  buy a fresher tyre from a competitor), and another customer's booking.

### P3 — Social engineer (the most dangerous one here)

- Reaches: everything, with a legitimate session and a plausible reason.
- A tyre shop trains staff to be helpful. "Can you just note down that we took
  one of these" is not a crime scene, it is a Tuesday. See `ABUSE-CASES.md`
  §S1–§S4. The controls here are **procedural**, and the only technical
  control that helps is the mandatory reason plus the actor recorded on every
  ledger row.

### P4 — Scripted attacker

- Reaches: public reads, and any inventory route with a missing `withAdmin`.
- Wants: enumerate the catalogue, walk `pageSize` to dump the ledger, flood
  `LIKE '%…%'`, bypass the bot damper.
- Note: the bot damper is a User-Agent substring match with an **allowlist
  that includes `facebookexternalhit`**. One header defeats it (L-01).

### P5 — Database access (a stolen backup, `pgAdmin`, a leaked `DATABASE_URL`)

- Reaches: everything, including `costPrice`.
- Cannot be stopped by application code, but can be *mitigated*: the schema
  carries cost in cleartext, there is no row-level security, and there are no
  CHECK constraints, so one `UPDATE` from a psql prompt permanently corrupts
  the running total with no alarm (H-09).

---

## 7. Trust-boundary crossings, enumerated

Each row is a place where data crosses from untrusted to trusted, or trusted
to untrusted. The right column is the control that must exist.

| # | Crossing | Untrusted input becomes | Control that must hold |
| --- | --- | --- | --- |
| X1 | Edge → route handler | request path, method, body, query | `withAdmin` / `withAdminRead`; CSRF origin; the tiered limiter |
| X2 | Route → validation | `PostMovementInput` | Zod `.strict()`, `qty` int/positive/capped, `reason` non-empty, `kind` from the enum |
| X3 | Validation → stock engine | a signed delta + a reason + a key | inside `withSerializableRetry`; `SERIALIZABLE`; conditional write with the guard in the predicate |
| X4 | Stock engine → ledger | one `StockMovement` row | `onHandAfter` computed from the row read **inside** the tx; `actorId`/`actorName` from the session, never the body |
| X5 | Stock engine → customer | `ServiceAvailabilityDto`, `PartAvailabilityDto` | no `costPrice`, no `reserved`, no `Reservation` ids; `sellPrice` only; rate-limited; `no-store` |
| X6 | Stock engine → staff | `ProductDto`, `MovementDto`, `ReservationDto`, `ReorderRowDto`, `ValuationDto` | `withAdmin`/`withAdminRead`; `no-store`; never `cacheControl: public` |
| X7 | Booking lifecycle → stock engine | reserve / release / consume | a conditional `updateMany` on `Reservation.status` whose `count === 1` is the gate |
| X8 | Staff UI → browser | product rows incl. `costPrice` | `force-dynamic`; no `revalidate`; `robots` disallow |
| X9 | Server Component → client bundle | the RSC flight payload | **the payload is the leak surface.** `costPrice` in a prop is `costPrice` in the HTML. |
| X10 | Application → database | the only copy of the invariant | CHECK constraints + a ledger reconciliation job |

---

## 8. Abuse and denial-of-wallet

| Attack | Cost to the attacker | Cost to the shop | Ceiling today |
| --- | --- | --- | --- |
| Catalogue enumeration via search | one request | one unindexable `ILIKE '%x%'` scan | none — no `limit` cap is specified |
| Ledger dump via `pageSize=100000` | one request | the entire stock history + staff free text | none — `MovementQuery.pageSize` has no max |
| Wildcard bomb `?q=%%%` | one request | a full-table scan and a full response | none |
| `LIKE` flood to exhaust the pool | 240 req/min (`readLimiter`) | **the entire site** — availability, booking, admin all share the pool | `readLimiter`; **fails open** |
| Product creation flood | 10 req/min (`publicLimiter`) | table bloat, every listing slower | none |
| Reservation pinning via `ttlMinutes` | one request | stock invisible for the TTL | none — unclamped |
| `qty: 2147483648` | one request | a 500 with a logged stack, repeatable | Zod `.int()` if used |
| Bot damper bypass | one header | full read access to any unguarded read | `User-Agent: facebookexternalhit` |

The most important row is the third. **A database connection pool is a shared,
finite resource, and inventory search is the most expensive query this
application will ever run.** `/api/availability` is protected by a 5-minute
cache. `LIKE '%term%'` on `Product` cannot be. The two must not be the same
budget.

---

## 9. What this design gets right

Stated so a reviewer knows what must not be traded away to make something
convenient.

1. **`StockLevel` is held, not computed at read time** (`schema.prisma:766–776`).
   This is the decision that makes a single conditional UPDATE possible, which
   is in turn the only reason overselling is *hard* rather than merely
   *unlikely*. Do not "simplify" this into `SUM(movements)` at read time.
2. **`idempotencyKey @unique` on the ledger** (`schema.prisma:805`). Someone
   thought about the double-tap before it was a bug report.
3. **`Reservation` instead of decrementing `onHand`** (`schema.prisma:821–828`).
   The hold/return/expire model is the correct abstraction for a booking, and
   `expiresAt` makes the leak self-healing.
4. **`StockCountLine.expected` is snapshotted at creation**
   (`schema.prisma:869–879`) precisely so "a concurrent sale does not silently
   rewrite history". That is the right instinct applied to the wrong column
   (see M-15: `StockLevel` has no equivalent protection).
5. **`Reservation @@unique([productId, bookingId])`** (`schema.prisma:844`).
   Genuinely prevents a second hold row for the same part on the same job.
6. **The public DTOs are clean.** `PartAvailabilityDto`,
   `ServiceAvailabilityDto` and `ProductAvailabilityDto` carry `sellPrice`
   and no `costPrice`. No `reserved`. No reservation ids. The contract author
   did the hard part.
7. **`actorName` is denormalised** onto `StockMovement` (`schema.prisma:807–808`)
   so the ledger survives an account deletion. Small decision, correct.
8. **Fail-closed on writes** (`ratelimit.ts:22–28`) is the right default and it
   is documented as a deliberate product call rather than an accident.

---

## 10. Requirements this imposes on A2, A3 and A4

Not findings — the bar. Each is mechanically checkable and each has a test in
`tests/inventory/security/`.

**A2 · stock engine**

1. The idempotency check, the stock mutation and the `StockMovement` insert
   are **one statement inside one transaction**. A `findFirst` by
   `idempotencyKey` outside the transaction is a double-spend.
2. `P2002` on `idempotencyKey` is caught, the transaction is rolled back, and
   the *original* row is re-read and returned. Never surfaced as a 500.
3. Every decrement is a single conditional write with the guard **in the
   `WHERE` clause**, inside `withSerializableRetry`.
4. `POSTED` / `CONSUMED` / `RELEASED` transitions are conditional
   `updateMany` calls whose returned `count` is the gate. Never
   `if (row.status === "X")` followed by `update`.
5. `PRODUCT_INACTIVE` never applies to `RELEASE`, `ADJUST_DOWN`, `SHRINK`, or
   `OPENING`. Read H-03 before writing this line.
6. `ttlMinutes` is clamped server-side and **ignored entirely** on any
   customer-reachable path.
7. No `prisma.product.delete*` and no `prisma.stockMovement.update*` anywhere
   in the codebase.
8. The rate-limit tier for every mutating inventory route is **fail-closed**.
   `readLimiter` is not it.

**A3 · operator UI**

1. Every page under `src/app/inventory/**` calls `requireRole("FRONT_DESK")`
   as its first server-side statement. The page's data path does **not** go
   through the HTTP API, so `withAdmin` is not in the path.
2. Every such page declares `export const dynamic = "force-dynamic"`.
3. `costPrice` is never passed to a `"use client"` component as a prop it does
   not need, and never into `JsonLd` / `openGraph`.
4. Optimistic UI is not allowed on stock writes (brief §3, A3 DO).
5. No quantity input accepts a negative or an empty value.

**A4 · booking integration**

1. `onBookingCompleted` begins with a conditional
   `updateMany({ where: { …, status: "HELD" }, data: { status: "CONSUMED" } })`
   and aborts unless `count === 1`.
2. It re-reads the booking status **inside the transaction** and refuses a
   `CANCELLED` / `NO_SHOW` booking.
3. The customer's booking DTO gains **no** parts, no BOM and no reservation
   information. `ServicePartRequirement` is the shop's consumption recipe; it is
   competitor intelligence.
4. `ttlMinutes` is server-derived on the customer path.

**Orchestrator · platform**

1. `ADMIN_PREFIXES` must cover the inventory API prefix, or the public
   availability read must live outside it (H-01).
2. `/inventory` must be added to the robots disallow and to `ADMIN_PREFIXES`
   (H-02).
3. `RateLimitTierName` must gain the inventory tiers (H-07).
4. The migration must add CHECK constraints on `StockLevel` and `StockMovement`
   (H-09), and the fractional-quantity fix must be decided before A2 builds
   arithmetic on `Int` (H-10).

---

## 11. Cross-references

| Document | Contents |
| --- | --- |
| `FINDINGS.md` | every finding, ranked, with file, line, reproduction, impact and fix |
| `OWASP-MAPPING.md` | OWASP 2021 → the inventory control → the file → residual risk |
| `ABUSE-CASES.md` | the scenarios a motivated person would actually try, and which the design survives |
| `../../tests/inventory/security/` | five static gates that arm as the code lands |

**Site-level baseline:** `tests/security/security-checklist.md`. This document
does not replace it; it extends it to the inventory and is referenced from it.