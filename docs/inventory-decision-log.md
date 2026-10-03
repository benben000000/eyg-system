# INVENTORY — ORCHESTRATOR DECISION LOG

### The judgement calls, and why. Read this before changing anything in here

Six agents built the inventory in parallel. Several of them found real holes in
*my* work — the schema, the contract and the integration wiring — and this file
records what I changed as a result and, more importantly, **why**.

---

## 1. `StockLot` — the architecture changed because a product-level DOT code is a lie

**What the research agent found.** `Product.dotCode` is one value per product. A
shelf is many lots: 20 tyres from March, 10 from August. With a single dot code
the shop cannot answer "which tyres are over two years old", so:

- **FIFO is impossible** — consumption would take new rubber first and age the shelf.
- **A DOT-based clearance campaign fires on the wrong tyres.** The marketing agent
  wrote an entire playbook keyed on tyre age. Every rule in it was unshippable.

Rubber age is not a discount mechanic. It is a safety claim. Getting it wrong
means selling an older tyre *believing it is newer*, which is a Consumer Act
problem, not a pricing one.

**What I did.** Added `StockLot`: one delivery of one product, carrying its own
`dotCode`, `receivedAt`, `expiresAt` and `unitCost`. `StockMovement.lotId` ties
each ledger row to the batch it moved.

**What I removed.** `Product.lastReceivedAt`, which I had added *earlier the same
day*. A single scalar cannot express "20 tyres arrived in March, 10 in August",
so shelf life derived from it is wrong for the older tyres — precisely the ones a
clearance campaign targets. One scalar, one wrong answer, silently. I introduced
the error and then deleted it; the lot is the correct shape.

**The invariant is unchanged.** `available = onHand − reserved` still lives on
`StockLevel`, per product. Lots describe *where stock came from*, not a second
source of truth for *how much there is*. Two balances would be two answers.

**FIFO: implemented.** I wrote here that consumption did not allocate across
lots. That was wrong — I had checked before the backend agent finished, and it
shipped `oldestOpenLot()`: RECEIVE opens a lot, CONSUME draws the oldest open
lot by `receivedAt` with `createdAt` as tie-breaker, and the movement records
which one via `StockMovement.lotId`. So a `CONSUMED` row does name its batch,
and the clearance playbook can be trusted on age.

The correction matters more than the feature: the log is the record of *why*, and
a wrong entry in it is a wrong decision waiting to be re-made.

---

## 2. A shipped-but-dead cron job

`/api/cron/inventory-expiry` was fully built, heavily documented, correctly
guarded — and **never ran**. It was absent from `CRON_JOBS` and from the tick
plan.

This is the failure mode that is invisible until it is expensive: a reservation
hold has a TTL, and nothing was enforcing it. Every abandoned booking would have
left its parts invisible to every other customer, permanently, with no error and
no log line. `expire-holds` (the *booking bay* hold sweep) is a different table
and was running, which is exactly why the gap was easy to miss.

Fixed: `runInventoryExpiry` added to the maintenance layer, registered in
`CRON_JOBS`, added to the tick's `ALWAYS` set.

---

## 3. The booking hooks were never called

The booking-integration agent said it plainly: *"Nothing calls these hooks yet.
Until the four mount points are wired, the inventory is still a spreadsheet with
extra steps — which is precisely the outcome the brief names as the thing to
avoid."* The security agent independently graded the same thing **Critical (C-01)**.

Wired, all four:

| Trigger | Action |
| --- | --- |
| `CONFIRMED` | reserve every BOM part with a TTL |
| `COMPLETED` / `READY` | consume — the parts left the shelf |
| `CANCELLED` / `NO_SHOW` / back to `PENDING` | release — the parts are still there |
| Customer cancels via the booking link | release |
| Every cron tick | expire |

All fire-and-forget. The booking change has already committed, and a stock
outage must never be able to fail a status change a mechanic is making in front
of a customer. Every hook is individually idempotent, so a retry is safe.

---

## 4. Three security findings that my wiring made live

The security agent's report landed *after* I had wired the hooks, which changed
the urgency of two findings.

**H-02 — a dead booking could consume. Fixed.** `onBookingConfirmed` refuses
anything that is not `CONFIRMED`. `onBookingCompleted` had **no status gate at
all**. Latent while nothing called it; a real defect the moment something did. A
cancelled booking's parts would have left the shelf for a job that never happened.

The gate is a **DEAD list** (`CANCELLED`, `NO_SHOW`), not an allowed list. A new
terminal status must be classified deliberately here rather than admitted by
default — the same reasoning behind a closed default.

**H-06 — a replayed request reported the wrong stock. Fixed.** `replayOutcome`
returned `reserved: 0` on the reasoning that the ledger records movements and not
promises. That makes `available` equal `onHand`: with 10 on hand and 6 reserved,
a retried consume answered **"10 available, not low"**.

That is the same shape as overselling — it tells the caller stock exists that is
already promised to somebody else. `reserved` is one cheap read on a path that
only runs when a submit is retried. It now reads the live level.

**H-03 — a partial consume was silent. Fixed.** `Math.min(requested, row.qty)`
consumed what was held and reported nothing. A bill of materials asking for 4
filters against a hold of 2 consumed 2, closed the booking as `COMPLETED`, and
the mechanic believed the car got four.

Consuming what is physically held is *correct* — those parts did leave the shelf,
so the ledger must say so. The silence was the bug. `ConsumeShortfall` now travels
with the result so the staff panel can say "needed 4, consumed 2, 2 short — order
or substitute before handing the car back."

---

## 5. RA 7394 Article 71 — a statutory warranty, not a business choice

The research agent read the Consumer Act and found that `workmanshipGuaranteeDays:
0` in `site.ts` is not a neutral "not yet decided". Article 71:

> Service firms shall guarantee workmanship and replacement of spare parts for a
> period not less than ninety (90) days which shall be indicated in the pertinent
> invoices.

Kept the field at `0` — inventing a policy the owner has not agreed to is exactly
the thing I refuse to do elsewhere. Added `STATUTORY_WORKMANSHIP_GUARANTEE_DAYS =
90` as a **separate** constant, so "the owner has not decided" (0) can never be
rendered as "this shop offers no warranty".

**The owner must confirm** what the shop's own invoices actually say. That is
item 11 on the confirmation register.

Article 68(b)(5) additionally requires purchase records to be retained for the
life of the warranty. The append-only ledger is therefore a **statutory record**,
not a nicety — which is a much stronger reason never to mutate or delete a
`StockMovement` than the one I originally wrote.

---

## 6. Contract gaps closed (all raised by agents, all mine to fix)

| Gap | Raised by | Resolution |
| --- | --- | --- |
| `Booking.partsBlocked` did not exist — `blocked` was computed then discarded, so a booking taken *while blocked* was indistinguishable from a normal one | funnel | Added, plus a shortfall snapshot |
| No `expectedAt` — "we can do this on Tuesday" was unshippable because every ETA would be invented | funnel | Added; only ever sourced from a real `PurchaseOrder` |
| No `PurchaseOrder` — "Mark as ordered" could persist nothing | funnel + marketing, independently | Added |
| `canPromise` ambiguous (units vs `qtyNeeded`) | funnel | Documented |
| `ageDays` ambiguous — *elapsed* or *remaining*? Silent failure: clearance fires on **new** stock | marketing | Documented as elapsed |
| `Product.notes` — untyped free text with no field-level auth | marketing | Stripped from every non-staff DTO, like `costPrice` |
| No `receivedAt` — shelf life derived from catalogue-entry date | frontend | Superseded by `StockLot.receivedAt` |
| Count lines carried no cost, so the review fanned out up to 25 requests | frontend | `costPrice` + `varianceValue` on the line |
| `robots.txt` allowed `/inventory` | frontend | Disallowed |
| `/api/inventory/**` had no middleware guard at all | frontend | Added to `ADMIN_PREFIXES` |

I also **reverted one of my own changes**: I made `StockCountDto.summary.varianceValue`
required, which broke the backend agent's deliberate design of gating it behind
`includeCost`. A zero on a customer-facing payload is worse than an omitted field.

---

## 7. UNRESOLVED — the seed catalogue conflict

The backend agent seeded **28 generic placeholder SKUs** (`FLT-OIL-01`,
`BAT-60AH`, …) while the research agent was independently producing a **48-row
catalogue** with researched retail anchors. Neither could see the other.

Problems in the placeholder seed, per the research agent:

- Two rows are mis-kinded (`OIL-BRAKE-500ML` and `OIL-COOLANT-1L` filed as `OIL`).
- Several are consumed by **no confirmed service** (`OIL-ATF-1L`, `FLT-FUEL-01`,
  `FLT-CAB-01`, `CON-SILICONE-DASH`).
- None carry a brand or a research anchor, and the parts are presumably unlabelled
  on the shelf.

**Decision: the researched catalogue wins; the placeholders must not ship.**
Unlabelled placeholder parts presented as real stock is precisely what the brief
bans, and a mechanic at an unlabelled box cannot identify the part — no schema
change fixes that, it is a ₱300 afternoon of labelling.

**But this is not yet done**, for an honest reason: **every peso figure in the
researched catalogue is `SUGGESTED — REQUIRES OWNER CONFIRMATION`**, and four
PETRONAS oil rows have *no* Philippine price anchor at all. Seeding 48 products
with invented peso prices is only safe because the UI refuses to present them as
real. That guard must exist before the seed is swapped.

---

## 8. The invariant, restated for whoever maintains this

```
available = onHand − reserved        and available is NEVER negative
```

The guard lives in a single conditional `UPDATE`, inside `SERIALIZABLE`, with
`withSerializableRetry` around it:

```sql
UPDATE "StockLevel"
   SET "reserved" = "reserved" + $qty
 WHERE "productId" = $productId
   AND "onHand" - "reserved" >= $qty     -- evaluated by the database
RETURNING "onHand", "reserved"
```

Every write path **refuses rather than clamps**. A rejection is a feature: it is
how the UI can say "3 left" instead of "failed".

The release path is guarded on `reserved >= qty` as well. A double release is the
**mirror image of overselling** — a negative `reserved` *inflates* `available`,
and the shop promises the same unit twice. The backend agent spotted that; it was
not in my brief.

---

## 9. What is still not proven

- **The concurrency suite has never been executed.** The SQL is right and reads
  correctly, and the security agent could not break it — but only a *run* settles
  it, and only an executed suite counts as evidence.
- ~~No `prisma/migrations/` directory exists.~~ **Closed** — see §10. The invariant
  is now enforced by Postgres CHECK constraints, not only by TypeScript. There is no defence below the TypeScript layer.
- **Every peso figure in the catalogue is unconfirmed.**

---

## 10. The invariant moved below the application

The backend agent flagged this and it is the most important thing in this log:

> *"Today every guarantee about the invariant lives in one TypeScript directory;
> a direct `UPDATE` would corrupt the running total permanently."*

They were right, and so was the QA gate, which had been asking for CHECK
constraints that did not exist. There was **no `prisma/migrations/` directory at
all** — every guarantee about `available = onHand − reserved` was a TypeScript
convention. One `psql` session, one future code path that forgot the guarded
statement, and the running total is corrupt forever, with the engine only able
to notice afterwards.

`prisma/migrations/20261003090000_init/` now carries the baseline DDL **and** the
constraints:

| Constraint | Refuses |
| --- | --- |
| `StockLevel_reserved_le_onhand` | overselling |
| `StockLevel_reserved_non_negative` | a double release inflating `available` — the mirror of overselling |
| `StockLevel_onhand_non_negative` | stock created from nothing |
| `StockMovement_qty_nonzero` | a zero-quantity phantom ledger entry |
| `Reservation_qty_positive` | a hold that promises nothing |
| `Product_cost_non_negative` | a negative cost silently poisoning every margin report |
| `ServicePartRequirement_qty_positive` | a blocking part that can never be short, quietly disabling an availability guarantee |
| plus lots, count lines and purchase-order lines | |

Constraints, not triggers: a failed CHECK raises and rolls the statement back. It
does not clamp and does not half-apply.

**What deliberately stays in TypeScript:** `onHandAfter` is a historical fact about
one moment, so it is not constrained against the current balance — a later movement
legitimately makes them differ. And nothing constrains DOT codes or ages at the
database level, because a tyre's age is a shop policy the owner must confirm, not
a fact the database is in a position to assert.

---

## 11. Walk-in holds — a gap two correct agents created between them

The frontend agent shipped a **Reserve** action on the product screen whose reason
list included *"Held for a walk-in waiting"*. The backend agent correctly refused
`RESERVE` at `/api/inventory/movements`, with a good explanation: a hold there moves
`reserved` with no `Reservation` row, so nothing the cron sweep could ever release.

**Both were right.** Together they exposed something neither could see alone:
`Reservation.bookingId` was **required**, so "hold two 205/55R16, this customer is
back at four" had nowhere to live. That is an everyday thing for a tyre shop to need,
and without it the mechanic writes it on paper — which is precisely what this system
was built to replace.

So `bookingId` is now nullable and `heldFor` carries the name. A walk-in hold has the
same TTL, is released by the same sweep, and counts in the same reorder and
availability maths. It simply has no job to be consumed against: settle it with a
`CONSUME` and a reason, or let it expire.

### The part that would have been easy to miss

Making `bookingId` nullable would have introduced a **new** version of the exact bug I
had just spent the whole build closing. `expireHolds` groups work with
`distinct: ["bookingId"]` — so every walk-in hold collapses into a single `null` group,
none of them is ever released, and the parts stay promised to a customer who may never
come back. Forever. Silently.

A feature that leaks is worse than a feature that does not exist, because it looks
like it works. The sweep now handles walk-ins separately, grouped by name, and the
database refuses a hold that names nobody:

```sql
CHECK (bookingId IS NOT NULL OR NULLIF(TRIM(heldFor), '') IS NOT NULL)
```

Grouping by name also keeps a release attributable. Two walk-ins may each be waiting
on a pair of the same size; releasing by product alone would take back a promise that
belongs to somebody else.

### The cost of a NULL bookingId on the unique key

`@@unique([productId, bookingId])` exists so one product cannot be held twice for the
same booking. Under Postgres NULL semantics a `NULL` bookingId collides with nothing,
so several walk-in holds of the **same** product are permitted. That is correct, not a
loophole: two different people waiting on the same part is a real situation, and a
constraint that forbade it would be lying about the domain.

---

## 12. The rate-limit tiers, promoted out of a cast

The backend agent declared the three inventory tiers locally, behind a single
`as RateLimitTierName` cast, because `ratelimit.ts` was not its file to edit. It filed
the change request rather than reaching around the ownership boundary, which was the
right call.

A cast is a promise the compiler cannot keep. Add a sixth tier and the inventory tiers
silently stop being first-class — no error, no warning, just a string that happens to
match. `inventory.read`, `inventory.write` and `inventory.count` are now real members
of `RateLimitTierName` with real policies in `RATE_LIMIT_POLICIES`, and the cast is
gone.

They are namespaced with a dot on purpose: `rl:inventory.write:…` sorts apart from
customer traffic in the logs, which matters when you are trying to work out whether a
stock endpoint or a booking flood is what exhausted the limit. And they are separate
from the `booking` tier so a customer booking flood cannot exhaust the budget a
mechanic uses to log consumption.

---

## 13. Corrections to this log

Two entries in this file were wrong when first written. Both are recorded here rather
than quietly edited, because a decision log that hides its own mistakes stops being
usable.

1. **"FIFO consumption is not implemented."** Wrong — I had checked before the backend
   agent finished. It shipped `oldestOpenLot()`: RECEIVE opens a lot, CONSUME draws the
   oldest by `receivedAt`, and the movement records which one via `StockMovement.lotId`.
   The clearance playbook can be trusted on age.
2. **"No `prisma/migrations/` exists."** True at the time, and the reason §10 exists.

The first one matters more than the feature it describes. The log is the record of
*why*, and a wrong entry in it is a wrong decision waiting to be re-made by whoever
reads it next.

---

## 14. What is STILL unproven — read this before deploying

- **Not one CHECK constraint has been executed.** This environment has no Postgres, so
  the entire migration in §10 is written from the schema and the engine's sign table,
  never run. A wrong CHECK does not degrade gracefully — it refuses every write it
  should have allowed. Before deploy: seed, then one RECEIVE, one CONSUME, one RESERVE,
  one RELEASE; then attempt one deliberate violation of each and confirm it is refused.
- **`stockmovement_sign_matches_kind` is the highest-risk constraint.** It encodes an
  eleven-way mapping. If one kind is wrong, every stock movement of that kind fails at
  the counter and the only symptom is a 500 nobody can explain.
- **The concurrency suite cannot yet exercise the guarded conditional UPDATE.** The
  test harness had no `$queryRaw`, so the single most important test in the build —
  two simultaneous reservations for the last unit — was modelled, not executed. The
  QA agent is building the recogniser now.
- **Every peso figure in the catalogue is unconfirmed**, and four PETRONAS rows have
  no Philippine anchor at all.
- **The seed conflict is unresolved** (§7): 28 generic placeholders versus 48 researched
  rows. The researched catalogue must win, and it must not ship until the UI refuses to
  present unconfirmed prices as real.

## 15. The container runs on Next's defaults, and its database was empty

Both of these were found by the container smoke test, which had never run: the
base image tag `node:20.11.0-alpine3.21` was never published, so `docker-build`
had never got as far as compiling the app, let alone starting it. Fixing the tag
unlocked four latent faults in sequence, and each one had been sitting in the
repository the whole time.

### 15.1 A file the app needs, absent from the image (twice)

The first was `vitest.config.ts`: `.dockerignore` excluded it by exact name while
`vitest.inventory.config.ts` — which imports it — survived, and `tsconfig.json`
includes every `.ts` file, so `next build` type-checked the survivor in the image
and failed:

    Type error: Cannot find module './vitest.config'

The second was `next.config.ts` itself, which the runner stage never copied at all.
`next start` therefore ran on Next's built-in defaults, and `poweredByHeader:
false` was among the things it discarded. Also lost: `compress`,
`productionBrowserSourceMaps`, `images.*`, `experimental.optimizePackageImports`
and the `headers()` block — though the middleware sets most of those headers
itself, which is exactly why the smoke test's header checks passed and hid the
rest.

The general shape is worth naming: **a file is excluded from the image, and
something still in the image refers to it.** Nothing on a workstation can see it,
because in a checkout both files are present. `npm run check:docker-context`
walks the build context the way Docker assembles it and resolves every relative
import against what actually survived — against the context, not the filesystem,
because asking the filesystem finds the file on disk and reproduces the blindness
the check exists to remove.

### 15.2 Copying the config on its own would have been worse

`next start` transpiles `next.config.ts` at runtime using the `typescript` package,
which is a devDependency that `npm ci --omit=dev` removes. Measured:

    next start, config present, typescript absent:
      warning  Installing TypeScript as it was not found while loading
               "next.config.ts".
      error    Failed to load next.config.ts
               Error: Cannot find module 'typescript'

So the obvious one-line fix would have traded a missing response header for a
container that does not boot. Both are now copied out of the builder, with the
reasoning in the Dockerfile so the pair is not pruned as one stray line.
`typescript` is deliberately not moved into `dependencies`: it is a build tool
that happens to be needed to read a config at boot.

### 15.3 A stub one character short, in two jobs

`WEBHOOK_SIGNING_SECRET` requires 16 characters. The container was launched with a
15-character value and the lighthouse job with a 15-character value, and in both
cases the app booted, validated, and refused — reporting a *container* problem and
a *server did not start* problem respectively, neither of which points at the
cause. `npm run check:stubs` reads the minimums out of `src/lib/env.ts` rather
than restating them.

That check then had a bug of its own worth recording. It collected secrets into a
Map keyed by variable name, per file, and reported one value per variable — but a
single workflow legitimately declares different stubs for different jobs. The map
kept whichever was parsed last, so the lighthouse job's 15-character stub was
silently replaced by a 28-character value from the docker-run step, and the check
reported **green while a real job was failing on it**. Every declaration is now
collected with its line number and every one checked. It found the lighthouse stub
on its first run against the unfixed repository.

### 15.4 The container's database was never migrated

The job started an empty Postgres and started the container against it. `/api/ready`
checks `_prisma_migrations` and correctly answered 503 — "can you serve?", with
the honest answer "there is no database". Nothing else failed because most routes
are static, which is precisely what made the gap easy to miss. The job now runs
`prisma migrate deploy` against the container's published port, the same command
the deploy pipeline runs.

### 15.5 Known and NOT fixed: `next start` with `output: "standalone"`

Next prints, on every `next start`:

    ? "next start" does not work with "output: standalone" configuration.
      Use "node .next/standalone/server.js" instead.

It works today — the container smoke test passes end to end — and it has through
15.x. It is nevertheless a configuration Next declares unsupported, so a future
minor could remove it, and this is a production image.

It is recorded rather than changed because the change cannot be verified on this
machine: there is no Docker, and the container path is the one thing currently
green. Trading a verified path for an unverified one to silence a warning is not a
good trade. The recipe, measured rather than recalled:

    .next/standalone/                 102 MB, 3237 files   (node_modules alone)
    full node_modules              1,103 MB, 52,553 files
    .next/standalone/.next/static    absent — must be copied in
    .next/standalone/public          absent — must be copied in

so the runner stage becomes:

    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/prisma ./prisma
    COPY --from=builder /app/scripts ./scripts
    CMD ["node", "server.js"]

and the `next.config.ts` and `typescript` copies from §15.2 become unnecessary,
because `server.js` has the configuration baked in and reads no config file. The
lighthouse job needs the matching change: its artifact is `path: .next`, so
`.next/standalone/server.js` is already there, but `public/` is restored separately
and `.next/static` would have to be copied alongside.

When this is done, delete §15.2 rather than leaving it as history — the copies it
describes would be carrying a type-checking package for no reason.
