# RELEASE CHECKLIST — INVENTORY (EYG Tire & Auto Care)

**Owner:** whoever is holding the deploy · **Gate:** every box must be ticked, or
waived **in writing** by the orchestrator with a reason and an owner.

Companion to `docs/qa/RELEASE-CHECKLIST.md`. That one covers the site; this one covers
the stock system, because the failure modes are different in kind. A broken booking
form loses a lead. A broken stock engine loses money quietly, for six weeks, before
anyone can prove which number was wrong.

Order is cheapest-and-most-reversible first. Print it. Do not ship with ticks you did
not earn.

---

## A · Code gates

- [ ] `npx vitest run --config vitest.inventory.config.ts` is green. **Or** every
      failure is an open row in `docs/qa/DEFECT-LOG-TEMPLATE.md` with an owner and a
      severity. No exceptions for "it is only inventory".
- [ ] `npm run typecheck` is clean. No `any`, no `@ts-ignore`, no `eslint-disable` added
      to silence a real problem.
- [ ] `node scripts/check-client-boundaries.mjs` is clean. A hook in a Server
      Component fails at **runtime** and only on the route that imports it — build and
      `tsc` both miss it. It has 500'd this site's homepage once already.
- [ ] No `.todo` in the inventory suite has grown a sibling assertion that was quietly
      deleted. Grep `it.todo` and read the names:
      `npx vitest run --config vitest.inventory.config.ts 2>&1 | Select-String todo`.
- [ ] **The placeholder-assertion guard is in place.** Confirm
      `vitest.inventory.config.ts` contains `forbidPlaceholderAssertions`. Without it,
      `expect(true).toBe(true)` is a legal way to make a red concurrency test green.

---

## B · The invariant — the part that is not optional

- [ ] **`concurrency.test.ts` §5 is green against the real engine.** Two simultaneous
      reservations for the last unit produce exactly one success, with
      `serializable: false` so no isolation level is doing the work.
- [ ] **The guard is present in the SQL, verified by reading the parsed statement** —
      not by trusting it. The test asserts `"onHand" - "reserved" >= n` is in the
      `WHERE` clause. Re-read it if the engine's SQL ever changes.
- [ ] **The naive implementation still fails the same schedules.** If
      `REGRESSION SENTINEL` goes green, the suite can no longer distinguish the two
      designs and has stopped proving anything. That is a **release blocker**, not a
      curiosity: it means the concurrency claim is now unfalsifiable.
- [ ] **The ephemeral-Postgres race has been run at least once** (§G). The fake proves
      the statement; only a real database proves the isolation level. "The suite is
      green" is not a substitute, and neither is "the code looks right".

---

## C · Data gates

- [ ] `prisma migrate deploy` succeeds against a **staging copy of production** from
      an empty database. `db push` does not prove the migration history is replayable.
- [ ] **A backup was taken immediately before the migration, and the restore drill has
      been completed** — not just scheduled. An untested backup is not a backup.
- [ ] **The ledger and the held level agree, by hand, on staging.** Pick three products
      with history and check:
      ```sql
      SELECT p.sku, l."onHand", l."reserved",
             (SELECT "onHandAfter" FROM "StockMovement" m
               WHERE m."productId" = l."productId"
               ORDER BY m."createdAt" DESC LIMIT 1) AS last_running_total
        FROM "StockLevel" l JOIN "Product" p ON p.id = l."productId"
       WHERE l."onHand" <> 0;
      ```
      Every row must show `onHand = last_running_total`. The suite proves this
      arithmetic; a human proves it on the shop's actual data, which is the only place
      a *wrong sign convention* would show up.
- [ ] `SELECT count(*) FROM "StockMovement"` is plausible for the shop's age, and
      `SELECT count(*) FROM "StockMovement" WHERE reason IS NULL OR reason = ''` is
      **zero** for human-initiated rows. A movement with no reason is a number nobody
      can defend six weeks later.
- [ ] **No `StockMovement` row was ever updated or deleted.** Verify with
      `AuditLog` or by comparing against a pre-deploy export. The ledger is
      append-only; a row that changed is a broken guarantee, not a fixed bug.
- [ ] **Seed data is idempotent.** `prisma db seed` twice leaves the catalogue
      unchanged. `Product.sku`, `StockCount.reference` and `StockMovement.idempotencyKey`
      are all `@unique`; a seed that re-inserts them fails on the second run.

---

## D · Authorisation and cost leakage

- [ ] **Every inventory route except the public availability read rejects an
      unauthenticated caller.** Checked statically today
      (`api-contract.test.ts`); check it live with a real cookie-less request.
- [ ] **`FRONT_DESK` cannot adjust stock, consume, or post a count.** Grep the routes:
      every `POST`/`PATCH`/`DELETE` must be `withAdmin("MANAGER", …)` or higher.
      `withAdminRead` is `withAdmin("FRONT_DESK", handler, { csrf: false })` — using it
      on a write hands the shop's single stock write to any counter account with **no
      CSRF token**.
- [ ] **`MANAGER` cannot change a `costPrice`.** That is the `OWNER` floor.
- [ ] **The public availability endpoint carries no cost, asserted on the raw bytes:**
      ```bash
      curl -s "http://localhost:3000/api/inventory/availability?serviceIds=<id>" | tee /tmp/avail.json
      grep -E '"(costPrice|marginPct|estimatedCost|costValue|varianceValue)"' /tmp/avail.json && echo "LEAK"
      ```
      `grep` on the file, not `jq` on the parsed object. `JSON.parse` keeps whatever you
      did not ask about.
- [ ] **A staff read MAY carry cost.** Both directions must be confirmed, or the test
      above proves nothing: a filter that removes a field the codebase never had is not
      a filter.
- [ ] **Every error body is clean.** A 400 from any inventory route, including its
      `error.fields` map, carries no cost key, no sentinel value, no stack frame, no
      `PrismaClient`, no connection string and no SQL.
- [ ] **`?debug=1`, `?include=cost`, `?fields=all` change nothing.** The response must be
      byte-identical without them.
- [ ] **No staff response is cacheable by a shared cache.** `cache-control` contains
      `private` or `no-store` on everything but the public read. A cached cost field
      served to the next anonymous caller is a leak with a delay.

---

## E · The promise the shop makes

- [ ] **A short NON-BLOCKING part does not block a booking.** Confirm on staging: set a
      non-blocking PMS part to zero, submit the booking, and prove the front desk is
      still allowed to take the job. A booking engine that blocks on oil it can pour
      from the case is worse than no booking engine.
- [ ] **A short BLOCKING part DOES block**, and the shortfall names the part, the
      quantity needed and the quantity actually available.
- [ ] **`canFulfil` is only `true` when every part is covered.** Check `available` is
      read as `onHand - reserved`, not `onHand`. Six filters on the shelf, all six
      promised, is zero filters the shop can sell.
- [ ] **A booking is never promised when `canFulfil` is `false`.** This is a customer-
      facing promise, not an internal flag.
- [ ] **Unit arithmetic respects the unit.** A PMS uses one oil filter. A set of five
      tyres is five units, not one. Oil is in LITRES and `StockLevel.onHand` is an
      `Int`, so a 1.4 L draw is 2 — and the UI must show the unit on every number.

---

## F · Reservations, counts, expiry

- [ ] **Reserve → cancel → release** returns `available` to exactly what it was and
      leaves `onHand` untouched. Verified by hand on staging.
- [ ] **Reserve → complete → consume** leaves `available` **unchanged** — the part was
      already promised, so finishing the job must not increase what the shop can sell.
- [ ] **An expired hold is released by the sweep** with nobody remembering to. Run the
      cron job twice and prove the second run is a no-op: **a double-release inflates
      `available` and lets the shop promise the same unit twice**, which is the mirror
      image of overselling and just as expensive.
- [ ] **Posting a count twice does not double-adjust.** Verify on staging:
      `SELECT count(*) FROM "StockMovement" WHERE kind IN ('ADJUST_UP','ADJUST_DOWN')`
      must equal the number of variance lines, not twice it.
- [ ] **A count that says 0 while stock is promised does not create a negative
      balance.** `SELECT min("onHand" - "reserved") FROM "StockLevel"` must be `>= 0`.
- [ ] **A count line's `expected` was snapshotted at creation**, so a sale during the
      count shows as a variance instead of silently rewriting history.
- [ ] **The cron sweeps are authenticated** (`checkCronAuth`) and idempotent.

---

## G · Ageing, clearance and the honest claim

- [ ] **DOT codes are read as `WWYY`** — week first, then year, with the 2000 pivot.
      `0624` is week 6 of 2024, not June 2004. Spot-check three real tyres against
      their sidewall codes and confirm the reported age matches.
- [ ] **An unreadable DOT code (`9999`, `XXXX`, blank) is `null`, never a date in the
      far future.** A tyre with no code that reports age 0 is advertised as brand new.
- [ ] **`shelfLifeDays` is measured from RECEIPT, not from `createdAt`.** Confirm
      `Product.lastReceivedAt` is maintained on every `RECEIVE`, and that oil received
      last week with 20 months of shelf life is not on the expiry list.
- [ ] **Nothing on the clearance page is stock the system says is short**, and no
      countdown resets. A tyre campaign that advertises a tyre the shop cannot
      immediately supply is a consumer-protection problem, not a marketing one.

---

## H · Rollback

- [ ] **The previous deployment can be promoted in under five minutes**, or a rehearsed
      DB rollback exists. Record the deployment URL.
- [ ] If a migration is not backward-compatible, the plan is **expand → migrate →
      contract**, never a single breaking deploy.
- [ ] **The shop knows what to do if the numbers are wrong.** This is the one that gets
      skipped and the one that matters. Printed, in the office:
      - the last known-good stock count date and who took it;
      - how to stop taking bookings that promise parts (`MAINTENANCE` mode, and who can
        switch it on);
      - the owner's phone number and the supplier's, for the honest "we may need to
        order this in" call.
- [ ] **A reconciliation has been done at least once after deploy**: read the ledger
      for three products and confirm the running total matches the shelf. If the system
      and the shelf disagree on day one, nobody will believe the system on day thirty.

---

## I · Sign-off

| Role | Name | Date | Confirms |
| --- | --- | --- | --- |
| Engineering | | | Sections A, B |
| Owner / shop | | | Sections C, G |
| QA & Security | | | Sections D, E, F |
| Operations | | | Section H |

**Do not release with an empty cell in this table.**

---

### Standing defects at the time of writing

Open items that are **known**, **documented**, and **not release blockers** unless §B
says otherwise. Each is asserted by a test so it cannot quietly become permanent.

| # | What | Where | Severity |
| --- | --- | --- | --- |
| 1 | No ephemeral-Postgres race has been run. The isolation level is unproven. | `TEST-STRATEGY.md` §5 | **High** — this is §B's last box |
| 2 | The inventory rate-limit policies are defined in `src/lib/server/inventory/stock-engine.ts`, not as tiers in `src/lib/ratelimit.ts`, so they are not where anyone tunes budgets. | `api-contract.test.ts` | Low |
| 3 | `ReorderRowDto.isStockout`'s doc comment contradicts itself: *"true = at/below reorder point, false = already below zero."* A boolean with two meanings is a boolean the UI will get wrong, and "below zero" can never be true under the invariant. | `reorder.test.ts` | Medium |
| 4 | `prisma/migrations/` does not exist, so the whole inventory guarantee lives in TypeScript alone. Requested: `CHECK (reserved <= onHand)`, `CHECK (onHand >= 0)`, `CHECK (reserved >= 0)`. | A8's suite reports it | Medium — prevention beats detection |
| 5 | `Product.dotCode`'s schema comment reads *"e.g. \"2418\" = week 18 of 2024"*, which contradicts the `WWYY` format the field's own name and every real sidewall use. | `ageing.test.ts` | Low — the implementation is right; the comment misleads |
