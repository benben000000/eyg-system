# A7 · QA — INVENTORY TEST STRATEGY

**Owner:** QA & CI/CD agent · **Scope:** `tests/inventory/**`, `vitest.inventory.config.ts`,
`.github/workflows/ci.yml` (inventory job), `docs/inventory-qa/**`

This document says **what is tested, what each test can actually prove, and what is
deliberately not tested.** A suite that claims more than it proves is worse than no
suite, because it produces a green tick that means nothing.

---

## 1. The invariant, and the one test that matters

```
available = onHand - reserved        and available is NEVER negative
```

Overselling the last oil filter does not mean a spreadsheet is wrong. It means a
customer arrives, the bay is occupied, and the part is not there. Everything else in
this suite exists to make sure that number never goes below zero.

`tests/inventory/integration/concurrency.test.ts` is the load-bearing file. Everything
else is supporting cast.

---

## 2. The layers, and what each one is allowed to claim

| Layer | Where | What it proves | What it cannot |
| --- | --- | --- | --- |
| **Atomicity contract** | `concurrency.test.ts` §1 | The fake models a single SQL statement as all-or-nothing, and the SQL recogniser refuses anything it does not understand. Without this, nothing below it means anything. | Anything about the engine. |
| **Algorithm differential** | `concurrency.test.ts` §2 | The compare-and-swap survives every declared interleaving **and** read-then-write does not. The two are asserted to *differ*, which is what gives the suite teeth. | That A2 wrote the conditional version. |
| **The real engine** | `concurrency.test.ts` §5 | A2's actual `reserve()` / `postMovement()` under the same declared schedules, with `serializable: false` so no isolation level is rescuing it. Also reads back the parsed statement to confirm the `"onHand" - "reserved" >= n` guard is really in the `WHERE` clause. | The isolation level. |
| **Contract ↔ schema** | `ids-and-reasons`, `reservations`, `counts`, `reorder`, `availability`, `ageing` | The hand-maintained TypeScript unions and the Prisma enums describe the same domain; a count's snapshot is captured where the schema says it is; a reservation TTL is 24h in both the code and the index. | Implementation behaviour. |
| **Contract wording** | `stock-engine`, `leakage`, `api-contract` | The contract still says what it is supposed to say. A rewrite of `PostMovementRejection` into a "clamped success" fails the build. | Implementation behaviour. |
| **Security** | `security/leakage`, `security/authz` | The leak scanner can actually detect a leak (against planted ones); `costPrice` is optional everywhere it must be filterable; every write verb is behind `withAdmin` with a `MANAGER` floor and CSRF on. | Live session behaviour — see §7. |

---

## 3. Why a typed in-memory fake rather than testcontainers

`tests/inventory/support/fake-prisma.ts` replaces `@/lib/server/db`. Reasons, in order
of weight:

1. **Speed and determinism.** The whole inventory suite runs in under two seconds
   with no container, no port and no shared database.
2. **The assertions are about the code.** Every test asks "does the guarded write
   hold?" or "does a refusal write anything?" — not "does Prisma emit valid SQL".
3. **The fake can express the invariant directly.** A predicate is evaluated and the
   write applied in one synchronous block with no `await` between, which is what a
   single SQL statement does. That is the whole fidelity claim, and §1 of the
   concurrency suite proves it before anything relies on it.

### 3.1 The SQL recogniser, and why it must throw

A2 writes its invariant-bearing write as raw SQL, because `"onHand" - "reserved" >= n`
is not expressible in Prisma's `where`. That is the right call, and it means a
Prisma-shaped fake cannot execute the one statement the whole concurrency claim
rests on.

So the fake recognises exactly that statement's grammar:

```
UPDATE "StockLevel"
   SET "onHand"|"reserved" = <col> [+-] <n> | <n>,
       "updatedAt" = now()
 WHERE <cond> [AND <cond>]*
RETURNING "onHand", "reserved"
```

where a `<cond>` is `"col" = n`, `"col" >= n`, or the derived `"onHand" - "reserved" >= n`.

**Anything outside that grammar throws.** It does not fall back to "match
everything", does not skip the guard, and does not return an empty array. A recogniser
that quietly no-opped on an unfamiliar statement would turn every concurrency
assertion green while the engine did nothing at all. Two tests exist purely to keep
that property (`the SQL recogniser REFUSES a statement it does not understand` and
`a malformed statement is REFUSED rather than approximated`).

Three bugs in this harness were found by these tests and are worth recording, because
each would have produced a **green lie**:

| Bug | Symptom | Why it was dangerous |
| --- | --- | --- |
| `"productId" = 'prd_…'` compared with `Number()` | `NaN === NaN` is `false`, so **every** guarded `UPDATE` matched zero rows | The engine would have "correctly refused" every reservation. 37 green tests, zero writes. |
| The `SET "onHand" = 40` (OPENING) form parsed as relative | The opening baseline became `0 - 40` | A first-ever count would have produced a negative shelf. |
| A shared lock token across transactions | No write conflict was ever detected | `serializable: true` silently degraded to `serializable: false` while passing a test written for the stricter model. |

---

## 4. The concurrency suite: what it proves, in one paragraph

Two simultaneous reservations for the last unit must produce **exactly one success**.
The suite proves this three ways, and the third is what makes the first two worth
anything:

1. **Against the real engine**, with both callers pinned onto the guarded statement.
2. **Against a naive read-then-write implementation**, where both callers succeed and
   `available` goes to `-1`. That test asserts the *bug is present*, on purpose.
3. **A summary test that runs every declared interleaving through both and demands
   they differ.** If the naive form ever stopped overselling, the conditional form
   would be proving nothing, and the suite would say so.

### 4.1 Declared schedules, not hoped-for ones

`Promise.all([reserveA(), reserveB()])` interleaves nondeterministically. It
reproduces a race *some* of the time, which is the worst possible property for a
test: it will be green the day it matters.

So the schedule is a declared input. A test names the operations that must
rendezvous, and every actor arriving at one waits until all of them have arrived:

| Schedule | Barrier | What it forces |
| --- | --- | --- |
| both callers read the same committed snapshot | `post:stockLevel:read` | Both decide against `onHand=1, reserved=0` |
| …then both writes collide | `+ pre:stockLevel:write` | Snapshot pinned **and** write slot claimed together |
| both writes claimed simultaneously | `pre:stockLevel:write` | The guard is evaluated against state the loser has not seen |
| full lockstep through read and write | `post:read`, `post:write` | Both reach the write; only one may proceed |

`pre:` and `post:` are both needed, and the difference is not pedantry. A barrier
*before* a read cannot promise the two callers observed the same value — the second
may not evaluate its predicate until after the first has written, so the "race" was
never tested. A barrier *after* a read can. There is a test for exactly this
(`a post: barrier really does pin both callers to the SAME snapshot`).

Arrivals are compared as a **prefix**, not an equality, because a losing caller that
re-reads after losing its write appends more arrivals, and that is correct behaviour
worth seeing rather than hiding.

### 4.2 For the real engine there is only one schedule, and that is the point

A2's `reserve` has no separate read to interleave. It issues
`UPDATE … WHERE "onHand" - "reserved" >= n RETURNING *` and reads the answer out of
the same statement. There is no check-then-act window to widen, because there is no
"then". Pinning both callers onto that one statement is therefore the strongest
available schedule.

### 4.3 What it still cannot prove

**Blunt version: this suite proves the STATEMENT, not the ISOLATION LEVEL.**

A fake models a database; it is not a database. Outstanding:

- Real `SERIALIZABLE` semantics under genuine concurrency, and real `P2034` on
  Postgres `40001`.
- The raw `UPDATE … RETURNING` statement as Postgres executes it (the recogniser
  models the semantics it can see; it does not model MVCC, row versions, or
  predicate evaluation against a concurrent transaction's uncommitted writes).
- `P2002` against a real unique index.

The reproduction is an `it.todo` in §6 of the concurrency suite, and the procedure is
§5 below. **This is the single highest-value outstanding test in the build** — and it
is the same gap, with the same owner, as the booking slot race in
`docs/qa/TEST-STRATEGY.md` §4.

---

## 5. The ephemeral-Postgres race — the authoritative version

```bash
# 1. Ephemeral Postgres
docker run --rm -d --name eyg-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=eyg_test postgres:16-alpine

# 2. Migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eyg_test npx prisma migrate deploy

# 3. The last filter in the shop
psql "$DATABASE_URL" -c "
  INSERT INTO \"Product\" (id, sku, name, \"updatedAt\")
  VALUES ('prd_race', 'RACE-1', 'Race filter', now()) ON CONFLICT DO NOTHING;
  INSERT INTO \"StockLevel\" (id, \"productId\", \"onHand\", \"reserved\", \"updatedAt\")
  VALUES ('lvl_race', 'prd_race', 1, 0, now()) ON CONFLICT DO NOTHING;"

# 4. Fire 20 reservations for the last unit in the same millisecond, then assert:
#    exactly 1 caller with no shortfall
#    SELECT "reserved" FROM "StockLevel" WHERE "productId" = 'prd_race'          -> 1
#    SELECT count(*) FROM "Reservation" WHERE "productId"='prd_race' AND status='HELD' -> 1
#    SELECT "onHand" - "reserved" FROM "StockLevel" WHERE "productId"='prd_race' -> >= 0
#
# 5. REPEAT at isolationLevel: Serializable AND at the default ReadCommitted.
#    The difference between the two runs is the entire claim.
```

**Owner:** devops / backend-core. **Blocked on:** nothing technical — only the
fixture product and a loop in a script.

---

## 6. The `.todo` ledger

Every `it.todo` in this suite names the exact export it waits on. Grep for them:

```bash
npx vitest run --config vitest.inventory.config.ts 2>&1 | Select-String "todo"
```

Categories, by why they are still dark:

| Waits on | Why |
| --- | --- |
| An ephemeral Postgres harness | Isolation level, `P2034` under contention. See §5. |
| A public availability **behavioural** test | The route exists; the suite asserts its *shape* today and its *bytes* once a session fixture exists. |
| Client-component prop scanning | Needs A3's files to be stable enough to assert against. |
| Live CSRF / session behaviour | `tests/integration/csrf.test.ts` covers the mechanism; the inventory-specific wiring is asserted statically in `api-contract.test.ts`. |

A `.todo` is a promise with a name on it. It is not a skipped test, and
`tests/inventory/support/module-resolver.ts` exists specifically so that "the
implementation does not exist yet" and "the implementation is wrong" can never be
confused for one another.

---

## 7. Determinism rules

1. **No wall-clock reads.** Every fixture is pinned to Wednesday 2026-03-11 09:00
   Manila. The DOT-code decoder is proved timezone-stable across
   `Asia/Manila` / `UTC` / `Pacific/Kiritimati` / `America/New_York`.
2. **No network.** `twilio`, `resend`, `nodemailer`, `@upstash/*` resolve to throwing
   stubs via the base config's plugin.
3. **No ordering assumptions.** No shared mutable fixtures: every fixture is produced
   by a builder function, and `useFakeDatabase()` installs a fresh database per test.
4. **No placeholder assertions.** `vitest.inventory.config.ts` ships a plugin that
   fails the run on `expect(true).toBe(true)`. That is legal TypeScript and legal
   Vitest; nothing else in the toolchain would catch it, and it is the exact shape of
   "fixing" a red concurrency test by deleting it.
5. **No `any`.** The fake is fully typed and `tsconfig.json` has `strict` +
   `noUncheckedIndexedAccess`.
6. **The fake refuses to guess.** An unrecognised `where` operator, an unrecognised
   statement, or a placeholder/parameter arity mismatch all throw with the statement
   quoted.

---

## 8. Running it

```bash
npx vitest run --config vitest.inventory.config.ts          # the gate
npx vitest run --config vitest.inventory.config.ts --coverage
npx vitest run tests/inventory/integration/concurrency.test.ts
```

CI: the `inventory` job in `.github/workflows/ci.yml`, appended after `lighthouse`.
It runs the client-boundary guard, a typecheck, and the suite, and uploads
`inventory-junit.xml` as its own artefact. It needs no database and no build.

---

## 9. When a test fails

A failing test is information, not an obstacle.

* **The test is right and the code is wrong** — leave it failing, open a defect with
  a file and a line number, report it. That is the entire point of this role.
* **The test is wrong** — fix the test and say so.
* **Never** weaken an assertion to make a run green.
* **The implementation does not exist yet** — `it.todo`, naming the export.

See `docs/inventory-qa/DO-DONT.md` for the table form of the same rules.
