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

## 16. Lighthouse ran for the first time, and these are the first real numbers

The performance gate had never executed. `staticDistDir: "./.next"` told LHCI
to serve that directory itself and ignore the `next start` server the job spends a
step starting — and `.next` is a server build with no `index.html` in it, so every
audit failed identically:

    LH:<every audit>:warn Caught exception: ERRORED_DOCUMENT_REQUEST

That reads like the site being too slow to load. It is the opposite: no document
ever arrived. The `curl /api/health` check passed throughout, because it tested
the server LHCI was not using.

### 16.1 What it measured, once it was pointed at the server

Three pages, two runs each, simulated slow-4G with a 4x CPU slowdown. Against the
budget in `.github/lighthouserc.json`:

    category            required    measured
    performance           >= 0.90   0.77  0.83  0.84
    accessibility         >= 0.95   0.90  0.91
    best-practices        >= 0.90   0.81  0.84  0.87
    seo                   >= 0.95   0.91

and two specific audits:

    color-contrast                    failing (maxLength 0 required)
    largest-contentful-paint          failing (max 2500 ms)

**These thresholds were not weakened.** Lowering them to the measured values would
make the pipeline green and the site no better, and a gate that means whatever
makes it pass is not a gate. The numbers are recorded here instead, so the work is
a list rather than a discovery.

The deploy guard will stay red while these are outstanding. That is the guard
working: this is a site that has not been measured, with a known contrast failure
and a known LCP, and it should not ship on the strength of a green tick it has not
earned.

### 16.2 Two config faults, both of which were failing regardless of the site

`"preset": "lighthouse:recommended"` in the `assert` block contradicted the rest
of the same file. `skipAudits` skips `canonical`, `hreflang` and `inspector-issues`;
the preset asserts `auditRan` on those same three. They could not both hold, so
those assertions failed on every run no matter what the site did. The preset also
contributed audits this file never anticipated — `bf-cache`,
`forced-reflow-insight`, `legacy-javascript-insight`,
`network-dependency-tree-insight` — none of which are declared here.

Removed. The 45 explicit assertions are the entire budget, which is what the file
already looked like. A preset layered on top of an explicit list is a second source
of truth that disagrees with the first — the same shape as the coverage thresholds
that were duplicated between `vitest.config.ts` and the CI command line.

A guard now fails the job immediately, with the reason, if `staticDistDir` ever
returns — including the specific check that `.next/index.html` exists.

### 16.3 Ruled out by measurement, not by argument

  * **No database.** The lighthouse job declares no Postgres and its `DATABASE_URL`
    points at a dead port. With and without a migrated database, all three audited
    pages returned 200 in 17-79 ms.
  * **The headless user agent.** `headlesschrome` is in the middleware's scraper
    list and Lighthouse runs headless Chrome. Both a desktop Chrome UA and a
    `HeadlessChrome` UA returned 200 on all three pages — and the scraper list is
    only consulted for `/api/*`.
  * **Unreachable third-party images.** Every absolute URL in the three pages was
    listed: all hyperlinks and XML namespaces. No external image sources, so
    nothing that could stall a load event.

### 16.4 Left alone, deliberately

`collect.settings` sets `"preset": "desktop"` alongside `formFactor: "mobile"`
and `screenEmulation.mobile: true`. Every key the preset sets is explicitly
overridden except `emulatedUserAgent`, so it is inert-but-misleading rather than
wrong. Removing it would change the emulated user agent and therefore the
measurement, and this was not the moment to make an unmeasured change to a
performance gate. Worth doing, with the scores before and after.

### 16.5 The precise failing set, per page

After the preset was removed, the run reports exactly this and nothing else. Three
pages, two runs each, worst value shown:

    assertion                      /       /services   /book     budget
    categories:performance         0.87    0.83        0.85      >= 0.90
    categories:seo                 0.91    0.91        0.91      >= 0.95
    categories:accessibility       0.90    -           -         >= 0.95
    color-contrast                 3       4           4         0
    largest-contentful-paint       3875ms  4218ms      4164ms    <= 2500ms
    first-contentful-paint         -       1830ms      -         <= 1800ms

and three assertions failing `auditRan` — the audit did not produce a result at
all, on some or all pages:

    inspector-console              /  /services  /book
    interaction-to-next-paint      /  /services  /book
    no-robots-txt                  -   -          /book

**The four category/metric failures are the site.** They are real, they are
measured, and the thresholds were left alone. Fixing them means front-end work:
contrast ratios on 3-4 elements per page, and an LCP of ~4s against a 2.5s budget
on a simulated slow-4G connection with a 4x CPU slowdown.

**The three `auditRan` failures are a different question** and are deliberately not
changed here. An assertion of `minScore: 1` on `auditRan` says "this audit must
have run", so these are statements about the harness:

  * `interaction-to-next-paint` — INP measures the delay of the next interaction.
    LHCI performs no interaction, so there is nothing to measure. This budget
    demands a metric the harness is not equipped to produce, and it will fail the
    same way forever regardless of the site.
  * `inspector-console` — needs the DevTools protocol attached; it did not run here.
  * `no-robots-txt` — failed for `/book` and passed for the other two pages on the
    SAME ORIGIN, where the same `/robots.txt` is served. A per-URL difference on a
    shared resource is a race, not a site defect.

They are recorded rather than removed because the fix cannot be verified on this
machine — there is no Chrome, so `auditRan` cannot be exercised locally — and
because dropping an assertion is the one move in this file that cannot be
distinguished from making the gate pass. Each needs one confirming run with the
assertion removed and the audit's own report inspected.

So the state of the performance gate is: **harness faults fixed, site defects
measured and outstanding, three assertions of unproven satisfiability flagged.**
The deploy guard stays red until the four real ones are addressed, which is what it
is for.
## 17. Why the SEO metadata is in the body, and what the site actually weighs

Two open questions from §16, answered by measurement rather than by argument.
Nothing in the site changed as a result — this section records what was ruled out
so the same ground is not covered twice.

### 17.1 The metadata defect, narrowed to a single line of code

The defect is real: `<title>`, `<meta name="description">`, `<link rel="canonical">`
and the Open Graph tags render in the BODY, at the end of the document, where
`document.head` cannot see them. Lighthouse scores `meta-description` 0 for
exactly that reason, which is why SEO sits at 91 with no individual SEO audit
failing — the category has nothing to score.

`</head>` closes at byte 2,564. `<title>` begins at 109,371, immediately after
React's LAST boundary-reveal script:

    </script><div hidden id="S:5"></div><script nonce="...">$RC("B:5","S:5")</script><title>…

So the shell closes `</head>` first, and the metadata arrives in the trailing
stream. Everything below is a change-and-re-fetch, not an argument.

**Changed on the committed code; no page moved:**

| change                                              | result                    |
| --------------------------------------------------- | ------------------------- |
| remove this layout's custom `<head>`                  | no change                 |
| remove the root `src/app/loading.tsx` boundary        | no change                 |
| remove `output: "standalone"` from `next.config.ts`   | no change                 |

**Probe routes with identical markup and metadata, differing in one respect.
Each rendered its metadata CORRECTLY, in `<head>`:**

| probe                                        | result    |
| -------------------------------------------- | --------- |
| nothing awaited, no directive                 | IN HEAD   |
| `export const dynamic = "force-dynamic"`      | IN HEAD   |
| `await` in the page component                 | IN HEAD   |
| `await` inside `<Suspense>`                   | IN HEAD   |
| `await searchParams`                          | IN HEAD   |

That kills the standing theory. **Dynamic rendering is not the cause** —
`force-dynamic` is a flag, not a suspension, and it is fine. The cause is the
await itself.

**Confirmed by two further builds:**

1. Replace this layout's `await headers()` with a literal nonce string. `/` puts
   its metadata in `<head>`: `<title>` at byte 1,980, `</head>` at 4,954.
2. Re-introduce the same `await headers()` one level down, in a child server
   component that renders the theme script and `<Providers>`. The layout becomes
   synchronous and the metadata goes **straight back into the body** — identical
   offsets to the committed code on all six pages.
3. Wrap that child in `<Suspense fallback={null}>`, which is the obvious next
   idea and the one worth writing down. **No effect.** All six pages still emit
   metadata in the body.

So: **any `await headers()` anywhere in the render tree moves this site's
metadata into the body**, because the document suspends before the shell
flushes. That is the finding, and it is narrower and stranger than "dynamic
pages do this".

**The fix, and why it was not applied.** Getting the metadata back into `<head>`
means no request-scoped read in the render tree at all. The CSP nonce is
per-request, so the inline scripts would have to be authorised by CSP **hash**
instead. `themeBootstrap` is a fixed string and its hash is trivial. The problem
is `next-themes`, which generates its own inline script and would need its exact
output hashed and pinned to a library version — a build that pins a hash of
third-party output breaks on a patch bump, silently, by blocking a script.

The failure mode of getting it wrong is a blank page: `script-src` carries
`'strict-dynamic'`, so an un-nonced, un-hashed script is not merely degraded, it
is refused. There is no browser on this machine to enforce CSP against, so
verifying it means shipping it and finding out in front of a customer.

**Not attempted blind.** The `ServerProviders` refactor that proved point 2 was
reverted; it was worth writing to find the answer and worth nothing to keep,
because it moved no bytes and moved no tags.

**What is actually at stake.** None of this affects rendering, and none of it
affects a demonstration. Browsers relocate these elements, so the pages look
correct. Only machines that read `document.head` — search engines — are affected.
For a site being shown to a room, this is worth nothing. It is worth fixing before
the domain is pointed at real traffic, and it is a two-hour job for someone who
can open a browser and watch the console.

### 17.2 What a first-time visitor downloads, measured

No Lighthouse locally — there is no Chrome — so this measures the build output
directly: serve the production build, fetch each page, resolve every referenced
asset to a file on disk, and price it compressed. No build artefacts invented.

Two earlier attempts at this were wrong before they were right, and both failures
were quiet rather than obvious:

- the first resolved `/_next/static/...` to `.next/_next/static/...` and matched
  only `<script>` tags with `nonce` before `src`. It reported the stylesheet as
  0 KB and found no scripts at all — an obviously broken result that still
  printed as a table.
- the second reported **raw** bytes. Those overstate everything, because the
  pages carry a large inline RSC payload that compresses very well.

| page        | TTFB  | HTML raw | HTML brotli | inline RSC | CSS brotli | JS raw   |
| ----------- | ----- | -------- | ----------- | ---------- | ---------- | -------- |
| `/`         | 85 ms | 251.8 KB | 21.4 KB     | 138.4 KB   | 12.7 KB    | 662.7 KB |
| `/services` | 60 ms | 696.0 KB | 32.7 KB     | 413.1 KB   | 12.7 KB    | 667.8 KB |
| `/book`     | 25 ms | 162.4 KB | 22.1 KB     |  91.6 KB   | 12.7 KB    | 792.4 KB |
| `/deals`    | 25 ms | 198.6 KB | 19.3 KB     | 108.0 KB   | 12.7 KB    | 701.3 KB |
| `/contact`  | 24 ms | 175.1 KB | 18.6 KB     |  92.1 KB   | 12.7 KB    | 704.6 KB |
| `/gallery`  | 18 ms | 165.2 KB | 16.4 KB     |  67.2 KB   | 12.7 KB    | 724.5 KB |

**HTML is not the problem, and it looks like it is.** 696 KB of `/services` is
almost entirely the inline React Server Component payload, and 413 KB of that is
RSC. Over the wire it is 32.7 KB. Anyone reading the raw column will reach for
the wrong optimisation.

**Everything Next built, compressed:**

| kind       | files | raw     | gzip    | brotli  |
| ---------- | ----- | ------- | ------- | ------- |
| JavaScript | 105   | 1388.2 KB | 451.7 KB | 390.9 KB |
| CSS        | 1     |   94.9 KB |  15.5 KB |  12.7 KB |
| fonts      | 30    |  389.3 KB | 390.0 KB | 389.4 KB |
| **total**  | 136   | 1872.4 KB | 857.2 KB | 793.0 KB |

**The shared floor — what every route pays before any page-specific code:**

| chunk                            | brotli   |
| -------------------------------- | -------- |
| `chunks/framework-*.js`          |  47.9 KB |
| `chunks/4bd1b696-*.js`           |  45.6 KB |
| `chunks/1255-*.js`               |  37.2 KB |
| `chunks/polyfills-*.js`          |  34.3 KB |
| the one stylesheet               |  12.7 KB |
| **floor**                        | **129.9 KB** |

Add 16–33 KB of brotli HTML and a cold first visit is **~151 KB**. That is a
reasonable number for a site of this size. It is not the 2.5-second LCP problem.

**Where the LCP budget actually goes.** The LCP element is a text paragraph. A
text LCP waits on HTML, then the render-blocking stylesheet, then the webfont for
that text — and fonts are already compressed, so brotli does nothing for them.
They are 389.4 KB across 30 files, with the largest at 36.4 KB, and the stylesheet
carries **44 `@font-face` blocks** (Saira 700/800/900, Barlow 400/500/600/700,
each across three subsets). The server is not the bottleneck — TTFB is 18–85 ms
against a 2.5 s budget. The candidate is font delivery, and the first thing worth
trying is fewer weights, not a smaller bundle.

**One flagged item that is real:** `chunks/polyfills-42372ed130431b0a.js` is
110 KB raw / 34.3 KB brotli and is loaded by every page. That is the standard
Lighthouse `legacy-javascript` penalty. It is Next's own output, not something
this repo chose, and reducing it means supporting fewer browsers — a decision,
not a bug.

### 17.3 Correcting §16

§16 recorded "Lighthouse says LCP is 3.5–4.3 s and the LCP element is a text
paragraph, so likely font/render-blocking CSS". The render-blocking CSS half of
that is **wrong**: 12.7 KB brotli is not 158 ms of blocking on any plausible
connection. The font half survives. Leaving the wrong half in a log is how the
next person spends a day chasing a 12 KB stylesheet.

## 18. The metadata fix was attempted and it is not possible in Next.js

§17.1 narrowed the defect to a single line: `await headers()` in the root layout.
It also named the fix — hash-authorise the inline scripts, drop the nonce, make the
layout synchronous. That fix was then built, measured, and reverted. This section
is why, because the answer is not "we ran out of ideas".

### 18.1 What was built

Four changes, all of them correct in isolation:

1. `themeBootstrap` moved to `src/lib/theme-bootstrap.ts` so the middleware can
   hash it, with `'sha256-…'` added to `script-src`.
2. `'strict-dynamic'` dropped from `script-src`, because it makes browsers ignore
   `'self'` — and Next does not nonce its own chunks, so nothing would load.
3. The root layout made synchronous: no `headers()`, no nonce prop.
4. `next-themes` deleted and replaced with ~60 lines in-repo, so no third party
   generates an inline script that would need authorising.

The result on the two pages that do not touch the database was exactly what was
hoped for. `/` and `/gallery` put `<title>`, the description, the canonical and
`og:title` in `<head>` — for the first time in this project's history.

**Then the script-authorisation check refused 70 of the 71 inline scripts on `/`.**

### 18.2 Why: Next delivers the RSC payload as per-request inline script

Enumerated, page by page, judged exactly as a browser judges `script-src`:

```text
requestAnimationFrame(function(){$RT=performance.now()      React: resolve
$RB=[];$RV=function(a){$RT=performance.now();for(...        React: retry
$RC("B:1","S:1")  $RC("B:2","S:2")  $RC("B:3","S:3")        React: complete boundary
(self.__next_f=self.__next_f||[]).push([0])                  Next: RSC payload
self.__next_f.push([1,"1:\"$Sreact.fragment\"\n2:I[456       Next: RSC payload
self.__next_f.push([1,"17:I[8751,[\"2619\",\"static/ch       Next: RSC payload
… 60 more, one per payload chunk
```

The first three are React DOM's streaming runtime and the rest is the entire React
Server Component payload. Every one is emitted **per request**, with content that
depends on what the page rendered. Their text is not knowable when the CSP is
built, so no hash can match them.

React would never hydrate. The page would be a dead HTML shell — which is why the
whole change was reverted rather than shipped and discovered by a customer.

This is not a subtlety. It is the reason the nonce exists.

### 18.3 The documentation says Next applies the nonce for you, and it does not

Next's own CSP guide states:

> Next.js extracts the nonce during rendering… and attaches it to framework
> scripts (React, Next.js runtime), page-specific JavaScript bundles, and inline
> styles and scripts generated by Next.js. **Because of this automatic behavior,
> you don't need to manually add a nonce to each tag.**

Measured on this repo, Next 15.5.27, with `Content-Security-Policy` set on the
**request** headers exactly as the guide's sample does: **0 of 18** Next chunk
scripts carried a nonce, and 0 of 75 inline scripts did.

Two upstream issues report the same thing, and one is still open against a
version far newer than this repo's:

- **vercel/next.js#95433** — "App Router framework inline scripts are not nonced
  from CSP request header". Reproduced by the reporter on **Next 16.2.10**.
- **vercel/next.js#93903** — "App Router component chunk scripts are missing CSP
  nonce", traced to `create-component-styles-and-scripts.tsx` not passing
  `ctx.nonce`.
- **vercel/next.js#63015** — the long-running "[App Router] Content Security
  Policy Broken". A comment in it records the same dead end reached independently:
  > "Since I cannot add nonce to a code that I myself did not write, I tried hash
  > method. I found all the hash of the inline scripts. Yet it still fails
  > because everytime I rebuild, there's one more inline script with a new hash
  > value."

**So upgrading is not the answer.** This repo is on 15.5.27; the latest is 16.3.8;
the bug is still reported against 16.2.10.

### 18.4 The trade-off, stated plainly

Next's guide also says: *"To use a nonce, your page must be dynamically
rendered."* Dynamic rendering is what puts the metadata in the body. The two
requirements are the same requirement.

| choice                                  | metadata in `<head>` | XSS defence intact | page hydrates |
| --------------------------------------- | ------------------- | ------------------ | ------------- |
| per-request nonce (what this repo does)  | no                  | yes                | yes           |
| hash-authorised, no nonce                | yes                 | yes                | **no**        |
| `'unsafe-inline'` in `script-src`        | yes                 | **no**             | yes           |

There is no fourth row. The middle one looks like a free win right up until a
customer loads the page.

### 18.5 What would actually fix it

In rough order of cost:

1. **The upstream bug.** `vercel/next.js#95433` is the whole ballgame. When it
   lands, delete `await headers()` from the layout, delete the nonce from the CSP,
   and the metadata moves itself. Nothing else needs building. Worth watching.
2. **A static CSP.** With no nonce, `script-src` must either list `'unsafe-inline'`
   or drop out of the policy. Both give up the defence that stops an injected
   inline script. Not worth it for a garage website.
3. **Accept it.** Which is what is happening.

### 18.6 What it actually costs, for scale

Nothing renders differently. Browsers relocate these elements, so every page looks
correct to a person and works in a demo. The cost is confined to machines that read
`document.head`: search engines. `meta-description` scores 0 in Lighthouse, which
is what pins the SEO category at 91 rather than higher.

For a site whose domain is not yet pointed at real traffic, that is a fair trade
against a page that renders at all.

## 19. A JSON comment key cost a deploy

`vercel.json` refused to build:

```text
The `vercel.json` schema validation failed with the following message:
should NOT have additional property `//cron`
```

The key was added deliberately, two commits ago, to carry a note about the cron
schedule. JSON has no comment syntax, so the note went in under a `"//cron"`
property on the theory that most tooling ignores unknown keys. That theory was
wrong in the one place it mattered: Vercel validates this file against a published
schema and refuses the entire deployment if any top-level key is not in it.

The cost is not the failed build. It is that the note had to live somewhere
Vercel will not read, and it could have been put there from the start.

**Where the note lives now.** This section.

## 19.1 What the cron is doing, and what must change before launch

`vercel.json` runs `/api/cron/tick` on `0 2 * * *` — once a day at 2am.

Vercel's Hobby plan rejects a cron that fires more than once a day, so the
original `*/10 * * * *` failed the deploy outright. That was the only entry in the
file requiring a paid plan, and it was checked rather than assumed: functions are
at most 1 GB / 60 s, both inside Hobby, and there is no image-optimisation or
analytics flag.

`/api/cron/tick` expires stock holds, sweeps rate limits and syncs reviews. Once
a day is ample for a demonstration and useless for production.

**RESTORE `*/10 * * * *` BEFORE ACCEPTING REAL BOOKINGS.** A hold is meant to
lapse within minutes. On a ten-minute tick a lapsed hold is swept within ten
minutes; on a daily tick a service bay can sit unsellable for nearly 24 hours.
Pro is required for the ten-minute tick, and Pro is required for production
regardless.

## 19.2 The guard

`scripts/check-csp`-style discipline applied to this file:
`scripts/check-vercel-config.mjs` validates `vercel.json` against the schema
Vercel publishes at the `$schema` URL inside the file, and runs in CI.

It is proven to fail before it passes. Re-adding `"//cron"` produces:

```text
FAIL  vercel.json contains JSON-comment keys: "//cron"
FAIL  these keys are not in Vercel's schema: //cron
```

and a plausible-but-invented key such as `frameworkPreset` produces the same
failure. The cron is asserted too, so the schedule is a checked fact rather than
something to re-derive.

The schema is **fetched, not vendored**. A vendored copy of "properties Vercel
accepts" goes stale the moment Vercel ships a key, and a stale allowlist that
rejects a valid key is its own outage. When the fetch fails the check degrades to
a short vendored floor plus a warning, rather than reporting a validation it did
not perform.

## 20. The first Vercel deploy failed because a build demanded secrets

§19 removed a JSON comment key that had stopped Vercel validating `vercel.json`.
The next deploy got past that and failed during the build:

```text
Error: Command "prisma generate && node scripts/generate-og.mjs && next build" exited with 1
```

```text
• AUTH_SECRET: is required
• PII_ENCRYPTION_KEY: is required
• WEBHOOK_SIGNING_SECRET: is required
• NEXT_PUBLIC_SITE_URL: is required in production (the CSRF allowlist is derived from it)
[Error: Failed to collect page data for /api/admin/bookings/[id]/status]
```

All four at once. None of them was set on the project, because none of them was
needed to compile.

### 20.1 The actual defect

`next build` sets `NODE_ENV=production` and imports every route module to collect
page data. That means `src/lib/env.ts` — which throws at module load when its
schema fails — is evaluated **while compiling**. So:

- three **runtime secrets** had to be present in the **build** environment, purely
  because the module that reads them is imported during compilation;
- `NEXT_PUBLIC_SITE_URL` had to be present, with a **hard production failure**,
  even though `src/config/site.ts` has carried `https://eygtireautocare.ph` as a
  default the whole time (`process.env.NEXT_PUBLIC_SITE_URL ?? "https://eygtireautocare.ph"`).

The second one is the design error. The first was defensible; the second was not.
A build cannot compile unless an operator has already configured production
secrets, which makes the very first deploy of a new project fail on the one thing
the operator had not been told yet. It is also strictly stricter than the rest of
the codebase, which is how the inconsistency survived.

The origin of the hard failure is SEC-02, and the reasoning is recorded at the
schema: an unset `NEXT_PUBLIC_SITE_URL` used to fall back to
`http://localhost:3000`, and because the CSRF allowlist is derived from it
(`middleware.ts` pushes `env.siteUrl`), every form POST would 403 in production.
Failing boot was the right call **against a localhost fallback**. It was the wrong
call against a fallback that is the correct domain.

### 20.2 Two changes, both narrow

**Server-only secrets are stubbed during the build, and only during the build.**

`next build` sets `NEXT_PHASE=phase-production-build` — verified in
`node_modules/next/dist/build/index.js`, not assumed. When that is set, missing
server-only values are filled with self-identifying placeholders. They are never
served: the branch is false the moment a request arrives, and a hard-coded literal
in a source file is not a secret.

**`NEXT_PUBLIC_SITE_URL` unset falls back to `SITE.url`, not localhost.**

Same constant the metadata, sitemap and OG tags already use, so `document.head`
canonical URLs and the CSRF allowlist cannot disagree, and neither can end up on
localhost. A value that is **set but wrong** still fails loudly — no scheme, a
space, or a non-http protocol are all rejected, because a typo would otherwise
ship broken canonicals and a 404 sitemap with no other signal.

SEC-02 still holds. The protection was never "the variable must be set", it was
"the allowlist must not be localhost".

### 20.3 The bug this nearly shipped

The placeholders were written in the wrong order first:

```ts
{ ...process.env, ...BUILD_PHASE_PLACEHOLDERS }   // placeholders WIN — wrong
{ ...BUILD_PHASE_PLACEHOLDERS, ...process.env }   // real values win — correct
```

As written, a deploy that *had* secrets configured would have had them silently
replaced by the placeholders for the duration of the build. Harmless today only
because `NEXT_PUBLIC_*` is the sole thing Next inlines — a fact worth not relying
on.

It was caught by the test written alongside the fix, not by review, and the test
that caught it is in `tests/unit/env-schema.test.ts` under
*"a build compiles without secrets"*.

### 20.4 Verified, both directions

```text
build, zero env vars            SUCCEEDS — 70 routes emitted
runtime, zero env vars          refuses to serve, names all three secrets
                                no placeholder string in any output
runtime, real secrets           serves, no placeholder in the HTML
                                security headers still applied
```

The middle row is the one that matters. If a served process accepted the
placeholders, the site would encrypt customer phone numbers with a literal
published in this repository — which is a far worse outcome than not booting.
Five tests hold that line, and the whole file passes: 415 unit tests.

Reproducing this locally needed three attempts, and each earlier one failed
quietly rather than loudly, which is worth recording:

1. `set DATABASE_URL=` in cmd sets the variable to the **empty string**, it does
   not unset it. Anything checking `=== undefined` sees a defined empty value.
2. Next auto-loads `.env`, so "no environment" locally means "the developer's
   real credentials" unless the file is moved aside.
3. Moving only `.env` aside is not enough — **`.env.local` exists** and held
   `WEBHOOK_SIGNING_SECRET`. That is why "the six variables I was told to set"
   appeared sufficient locally when it never was, and why the first conclusion
   drawn from it ("the env vars are not the cause") was wrong.

### 20.5 What the operator still has to do

The build no longer needs anything. **Serving** the site does:

| variable                 | needed for                                        |
| ------------------------ | ------------------------------------------------- |
| `DATABASE_URL`           | Neon pooled URL                                   |
| `DIRECT_URL`             | `prisma migrate deploy` only                      |
| `AUTH_SECRET`            | sessions                                          |
| `PII_ENCRYPTION_KEY`     | encrypting customer phone numbers                 |
| `WEBHOOK_SIGNING_SECRET` | verifying Resend / Twilio / WhatsApp callbacks    |
| `CRON_SECRET`            | the daily tick; not in the schema, read by the route |
| `NEXT_PUBLIC_SITE_URL`   | only if the site is served on a domain other than `eygtireautocare.ph` |

Until they are set the app refuses to start, which is correct and is now a much
better error than a failed compile.
