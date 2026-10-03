# QA & SECURITY — TEST STRATEGY

**Owner:** QA & Security agent · **Scope:** `tests/**`, `vitest.config.ts`, `playwright.config.ts`, `docs/qa/**`, `tests/security/**`

This document explains **what is tested, why, how, and what is deliberately not
tested.** A test suite that claims more than it proves is worse than no suite,
because it produces a green tick that means nothing.

---

## 1. The three layers, and why there are three

| Layer | Runner | Files | What it can prove | What it cannot |
| --- | --- | --- | --- | --- |
| **Unit** | Vitest (jsdom + node) | `tests/unit/**` | Pure logic, deterministic, fast. Slot arithmetic, open/closed, phone and peso formatting, captcha HMAC, quote honesty, countdown monotonicity, email shell, SMS length/encoding. | Anything that needs a browser, a network or a real database. |
| **Integration** | Vitest (node) + a typed in-memory Prisma fake | `tests/integration/**` | The HTTP contract: status codes, the `ApiResult` envelope, validation and its `fields` map, the 409 race, rate-limit behaviour, CSRF origin rejection, honeypot, min-time, and **what information does and does not leave the process**. | SQL correctness, transaction isolation, real driver semantics. |
| **E2E** | Playwright (Chromium) | `tests/e2e/**` | The parts only a browser can: rendering on a 393×852 phone, the thumb-reachable action bar, the 4-step wizard end to end, the 404 page, axe-core, Core Web Vitals smoke, and **zero `console.error` / unhandled rejections on any page**. | Deterministic timings; anything below the UI. |

### Why a fake Prisma rather than testcontainers

`tests/integration/**` mocks `@/lib/server/db` with a hand-written, typed,
in-memory client. Reasons, in order of weight:

1. **Speed and determinism.** The whole integration layer runs in ~4 s with no
   container, no port, no `docker compose up`, and no flakiness from a shared
   database. A reviewer can run it on a plane.
2. **The assertions are about the CODE, not the ORM.** Every integration test
   here asks "does the handler return the right status and the right body?" or
   "does the capacity check run inside the transaction?". Prisma's parameterised
   query builder already guarantees SQL injection safety; re-proving it with a
   real database proves nothing extra.
3. **The fake can express the invariant directly.** `prismaMock.$transaction`
   is a **promise-chain mutex**, which is precisely what `SERIALIZABLE` isolation
   buys you: the loser's `count()` observes the winner's committed row. A plain
   `async fn` does *not* model that, and a fake that does not model it will let a
   race bug through — see §4.

### What the fake therefore CANNOT prove, and who must

| Gap | Owner of the proof |
| --- | --- |
| Real `SERIALIZABLE` isolation under genuine concurrency | §4 — the ephemeral-Postgres job |
| Unique-constraint behaviour (`P2002` → 409) against a real index | §4 |
| Migration correctness (`prisma migrate deploy` on a clean database) | `docs/qa/RELEASE-CHECKLIST.md` |
| CSP enforcement by a real browser | `tests/e2e/a11y.spec.ts` + axe |

---

## 2. Determinism rules (non-negotiable)

Every suite obeys these. They are not style preferences; they are the difference
between a test suite people trust and one they re-run until green.

1. **No wall-clock reads.** Anything time-dependent takes an injected clock or
   runs under `vi.useFakeTimers()` with a pinned `vi.setSystemTime()`.
   `computeAvailability({ now })`, `verifyCaptcha()` (faked), `useCountdown()`
   (faked `Date` **and** `performance`).
2. **`process.env.TZ` is pinned and flipped deliberately.** `vitest.config.ts`
   sets `TZ=Asia/Manila`; the timezone suites deliberately re-run the same input
   under `Pacific/Kiritimati` (UTC+14), `Pacific/Niue` (UTC−11), `UTC` and
   `America/New_York` and demand **byte-identical** output. That is the only way
   to prove a generator is timezone-*explicit* rather than accidentally correct
   on the author's laptop.
3. **No network.** `fetch` is spied on and asserted *not* called wherever a
   request could plausibly be made (availability, booking, quote, leads). The
   optional SDKs (`twilio`, `resend`, `nodemailer`, `@upstash/*`) are replaced by
   a Vite plugin that resolves to a **throwing** stub, so a test can never send a
   real SMS or email even if the environment has credentials.
4. **No ordering assumptions.** `beforeEach` resets every mutable fixture
   (`store`, `db`, `counters`, `rateCounters`, `txQueue`, the availability
   server-side cache). Tests are order-independent; re-run a single test in
   isolation and it behaves identically.
5. **No shared mutable fixtures across files.** Each spec owns its own fake.
6. **No `any`.** `tsconfig.json` has `strict` and `noUncheckedIndexedAccess`;
   the fakes are fully typed and every assertion narrows its own union.

---

## 3. Running the suites

```bash
npm test                                  # Vitest, the default `npm test`
npm run test:watch                        # watch mode
npm run test -- --coverage                # with coverage thresholds
npx vitest run tests/unit                 # one layer
npx vitest run tests/unit/availability.test.ts
TZ=Pacific/Kiritimati npx vitest run tests/unit/availability.test.ts   # CI matrix

node tests/security/owasp-lite-scan.mjs          # exit 1 on error
node tests/security/owasp-lite-scan.mjs --json
node tests/security/owasp-lite-scan.mjs --strict # warnings fail too

npx playwright test --project=mobile
npx playwright test --project=desktop
npx playwright test --project=mobile tests/e2e/booking-flow.spec.ts
```

### The "no guessable secret" guard

`tests/setup.ts` **throws before any test runs** if `AUTH_SECRET`,
`PII_ENCRYPTION_KEY` or `WEBHOOK_SIGNING_SECRET` is missing, shorter than 32
characters, or matches a placeholder pattern (`change-me`, `your-…`, `todo`,
`xxx`, a single repeated character, …).

This is not ceremony. Every HMAC, session, CSRF and captcha test **proves
something only when the secret is unpredictable**. Against
`CHANGEME-CHANGEME-CHANGEME-…` a whole class of forgery attacks would pass, and
the green run would be a lie. `vitest.config.ts` injects deterministic,
high-entropy test-only values so the guard passes for the right reason.

---

## 4. The slot-race test — the one that needs a real database

**The invariant:** *two customers clicking the last remaining bay at the same
instant produce exactly one booking and one clean 409.*

`tests/integration/api-booking.test.ts` proves this with 2 concurrent requests
and with 50, using a mutex-backed fake. That proves the **code order**: the
capacity check happens *inside* the transaction, and the transaction body is not
re-entrant.

It does **not** prove the **isolation level**. That needs a real database:

```bash
# 1. Start an ephemeral Postgres (the CI job owns this; see package.json request)
docker run --rm -d --name eyg-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=eyg_test postgres:16-alpine

# 2. Migrate and seed
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eyg_test npx prisma migrate deploy
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eyg_test npx prisma db seed

# 3. Fill a slot to capacity-1
psql "$DATABASE_URL" -c "
  INSERT INTO \"Booking\" (id, reference, \"customerName\", \"customerPhone\", \"startAt\", status, \"createdAt\", \"updatedAt\")
  SELECT 'seed_'||g, 'EYG-SEED'||g, 'Seed', '+639171234567', '2026-03-11T09:00:00+08:00'::timestamptz,
         'CONFIRMED', now(), now()
  FROM generate_series(1, 2) g;"

# 4. Fire both requests in the same millisecond
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/booking \
  -H 'content-type: application/json' -H "x-form-rendered-at: $(($(date +%s%3N)-5000))" \
  -H 'origin: http://localhost:3000' \
  -d '{"name":"Race A","phone":"09171234501","startAt":"2026-03-11T09:00:00+08:00","serviceIds":["<a real service id>"],"consentSms":true,"captchaAnswer":<solved>,"captchaToken":"<token>"}' &
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/booking \
  -H 'content-type: application/json' -H "x-form-rendered-at: $(($(date +%s%3N)-5000))" \
  -H 'origin: http://localhost:3000' \
  -d '{"name":"Race B","phone":"09171234502","startAt":"2026-03-11T09:00:00+08:00","serviceIds":["<a real service id>"],"consentSms":true,"captchaAnswer":<solved>,"captchaToken":"<token>"}' &
wait

# 5. Assert: exactly one 201, exactly one 409, and
psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM \"Booking\" WHERE \"startAt\"='2026-03-11T09:00:00+08:00' AND status IN ('PENDING','CONFIRMED')"
#    → must be exactly capacityPerSlot (3)
```

There is an `it.todo` in `api-booking.test.ts` recording these steps so the
authoritative version cannot be forgotten. **Owner:** backend-core / devops.

---

## 5. The E2E environment

`playwright.config.ts` runs `next build && next start` — a real production build,
because `next dev` does not exercise chunking, the CSP nonce flow, the error
boundaries or `poweredByHeader`.

Required to run locally:

```bash
# A migrated, seeded database
docker compose up -d db          # or any Postgres 16+
cp .env.example .env.local        # fill in AUTH_SECRET etc. — placeholders are refused
npx prisma migrate deploy && npx prisma db seed

npx playwright install --with-deps chromium
npx playwright test
```

`playwright.config.ts` sets `CAPTCHA_ENABLED=true` so the wizard is exercised
with the challenge **on** — a booking test that runs with the captcha disabled
tests nothing. It also blanks `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
`RESEND_API_KEY` so an E2E run cannot text or email a real person.

---

## 6. Coverage thresholds

`vitest.config.ts` sets v8 coverage with `statements: 70, branches: 65,
functions: 70, lines: 70`, scoped to `src/lib/**` and `src/app/api/**/route.ts`.
`src/lib/env.ts` is excluded: it is the boot guard, it is exercised by
re-importing the module, and it has no branches worth a percentage.

Thresholds apply **only** under `--coverage`, so a plain `npm test` cannot fail
because `@vitest/coverage-v8` is not installed.

---

## 7. When a test fails

A failing test is information, not an obstacle.

* **If the test is right and the code is wrong** — leave the test failing, open
  a row in `docs/qa/DEFECT-LOG-TEMPLATE.md`, and report it. That is the entire
  point of this role. Twelve defects are currently open that way.
* **If the test is wrong** — fix the test and say so in the commit message.
* **Never** weaken an assertion to make a run green. If `expect(x).toBe(true)`
  is the only way to pass, the test is deleted, not neutered.
* **If the implementation does not exist yet** — the test is `it.todo` with a
  comment naming the **exact file and export** it is waiting on, so the owning
  agent can be handed a precise to-do.

---

## 8. The CI matrix

| Job | Runs | Why |
| --- | --- | --- |
| `unit` | `vitest run tests/unit` on Node 20 and 22 | Catch platform differences. |
| `unit-tz` | the same suite with `TZ=Pacific/Kiritimati` and `TZ=Pacific/Niue` | Prove the schedule is timezone-explicit, not accidentally correct. |
| `integration` | `vitest run tests/integration` | The API contract and the race. |
| `integration-db` | the race script in §4 against ephemeral Postgres | Prove isolation. |
| `owasp` | `node tests/security/owasp-lite-scan.mjs --strict` | The static gate. |
| `audit` | `npm audit --audit-level=high` | Vulnerable components (A06). |
| `typecheck` | `tsc --noEmit` | No `any`, no `@ts-ignore`. |
| `e2e` | `playwright test` on a seeded staging database | The funnel. |

`.github/**` is owned by **devops**, not by QA. This agent does not edit it; the
matrix above is the request.
