# EYG INVENTORY SYSTEM — ORCHESTRATOR BRIEF

### The contract for the parallel build. Read this first. Nobody deviates

---

## 0. What we are building

A **stock system for a tyre and auto-care shop**, not a generic warehouse app.

The difference matters, and every agent must internalise it:

| Generic inventory | This shop |
| --- | --- |
| "SKU, qty, price" | Tyre **sizes** (`205/55R16`), **DOT codes** that expire, oil by the **litre**, a spare that makes 5 |
| Stock is just a number | Stock is **consumed by a booking** — the bay pulls parts against a job |
| Stockouts are a supply problem | A stockout means a **customer is standing at the counter with their car up on the lift** |
| Margin is a report | Margin is **survival** — this is a small shop on thin tyre margins |
| Nobody cares about history | History is the **only defence** when the system and the shelf disagree |

**The one invariant that must never break:**

```
available = onHand − reserved        and available is NEVER negative
```

Overselling the last oil filter means a customer arrives, the bay is occupied,
and the part is not there. Every write path must **refuse**, never clamp.

---

## 1. Already built — do not rebuild it

This sits on the existing production site. The booking engine, auth, admin guard,
rate limiter, CSRF and notification layer all exist.

| Existing | Reuse it |
| --- | --- |
| `Booking` (`PENDING`→`CONFIRMED`→`CHECKED_IN`→`IN_PROGRESS`→`READY`→`COMPLETED`) | Reservations hang off a booking |
| `Service`, `ServiceCategory` | The bill of materials hangs off a service |
| `withAdmin(role, handler)` in `src/lib/server/admin-guard.ts` | **Every** inventory route goes through it |
| `rateLimit({ action, ip, policy })` in `src/lib/ratelimit.ts` | New tiers: `inventory.read`, `inventory.write`, `inventory.count` |
| `checkCronAuth` + `/api/cron/tick` | Expiry sweeps and reorder digests |
| `prisma.$transaction` + `withSerializableRetry` in `src/lib/server/db.ts` | Concurrency guard |
| `makeReference(prefix)` | Stock-count references |
| `notify*` in `src/lib/integrations/notify.ts` | Low-stock alerts to the owner |

**The integration that makes this worth building:** `ServicePartRequirement` lets
the booking flow answer *"can we do this job on Tuesday?"* **before** promising
the customer, auto-reserve the parts, and consume them on completion. That is
the whole point. An inventory system that is not wired to bookings is a
spreadsheet with extra steps.

---

## 2. Orchestrator-owned files — **NEVER EDIT**

| File | Owner |
| --- | --- |
| `prisma/schema.prisma` | orchestrator (inventory models already added) |
| `src/lib/inventory-types.ts` | orchestrator |
| `src/config/site.ts` | orchestrator |
| `src/lib/types.ts` | orchestrator |
| `src/app/globals.css` | orchestrator |
| `package.json`, `tsconfig.json`, `next.config.ts`, `vercel.json` | orchestrator |
| `docs/AGENT-BRIEF.md` | orchestrator (site-level rules still apply) |

You **may** add files inside your own directory. If you need a change in an
orchestrator-owned file, **report it** — do not make it.

---

## 3. Agent roles

Eight agents, parallel, exclusive file ownership.

### A1 · RESEARCH

**Owns** `docs/inventory-research/`
**DO** — research how Philippine tyre shops actually run stock: what a small
Balanga shop really carries (SKUs, pack sizes, the tyre sizes that fit the local
car fleet), tyre DOT-code rules and shelf life, oil decant/spec norms in PH, how
Michelin/BFGoodrich distributor stock works, real PH prices for filters/oil/brake
pads/tyres, BIR/DTI record-keeping obligations for stock, and at least 4
benchmark inventory systems (MotoParts, TecAlliance, Snapcat, Autodoc) and a
Philippine competitor or two. Produce an **SKU starter catalogue** of ~40 real
items with realistic cost/sell in PHP, clearly marked as estimates.
**DO NOT** — invent a number and present it as researched. Every figure gets a
source URL and a date, or it is labelled `SUGGESTED`. Do not write application
code. Do not scrape behind logins or violate a ToS.

### A2 · INVENTORY BACKEND (core)

**Owns** `src/lib/server/inventory/*`, `src/app/api/inventory/**`,
`src/app/api/cron/*expiry*|*reorder*`
**DO** — implement the atomic stock engine. The core is a single conditional
`UPDATE StockLevel SET reserved = reserved + n WHERE productId = x AND
onHand - reserved >= n RETURNING *`, inside a `SERIALIZABLE` transaction with
`withSerializableRetry`. Refuse on shortfall. One write path (`postMovement`),
one ledger row, one mandatory reason. Implement reservations with TTL, release,
consume, cycle counts, and `getServiceAvailability()`. Every route calls
`withAdmin` except a read-only availability endpoint, which is rate-limited and
returns **no cost data**.
**DO NOT** — never clamp a negative. Never `update` a `StockMovement`. Never
delete one. Never trust a client-supplied `available` or `onHandAfter`. Do not
expose `costPrice` to any non-staff surface.

### A3 · FRONTEND (operator UI)

**Owns** `src/app/inventory/**`, `src/components/inventory/**`
**DO** — build the operator experience for someone standing at a shelf with a
customer waiting. Product list with instant search across SKU/name/size/barcode,
keyboard-first (type-to-find, `/` to focus, arrow keys, Enter to open), a
low-stock view, product detail with the full movement ledger, receive/consume/
adjust dialogs with a **mandatory reason**, a tyre-size finder, and the stock
count screen. Every number shows its unit. Every mutation shows a clear
before→after. Optimistic UI is **not** allowed on stock writes — confirm from
the server.
**DO NOT** — do not hide the cost/margin column from staff. Do not let a
quantity field accept a negative. Do not build a dashboard a mechanic cannot
use with one hand on a phone. No placeholder data shipped as if real.

### A4 · BOOKING INTEGRATION

**Owns** `src/lib/server/inventory/booking-hooks.ts`,
`src/components/inventory/BookingPartsPanel.tsx`, `src/app/book` wiring
**DO** — wire inventory into the existing booking lifecycle. On confirm: check
availability from the BOM, reserve blocking parts with a TTL, surface a shortfall
to staff with a clear "we may need to order this in" state. On cancel/expire:
release. On `COMPLETED`: consume, writing ledger rows against the booking. Add a
staff-only panel on the booking showing what is reserved vs consumed. Make the
customer-facing flow honest: a booking is only *promised* when
`ServiceAvailabilityDto.canFulfil` is true.
**DO NOT** — do not block a customer from booking a service just because a
non-blocking part is short. Do not silently consume the wrong quantity. Do not
change the customer-facing booking steps — this is additive.

### A5 · FUNNEL & UX DESIGNER

**Owns** `docs/inventory-funnel/`
**DO** — design the inventory's conversion and trust story. The customer-facing
half is a **trust lever**: "we have your size in stock" is the single strongest
promise a tyre shop can make, and it should appear on the services page, in the
booking flow, and in the estimate. Design the operator-side half: the reorder
funnel, the low-stock → order → receive loop, and what the owner should see at
6am. Write the exact microcopy, the empty/loading/error states, the keyboard
map, and the DO/DON'T tables. Specify how to present a **shortfall honestly**
without scaring a customer who just wants their car fixed.
**DO NOT** — never design a fake-urgency mechanic ("Only 2 left!"), never
expose cost/margin on a customer surface, never block a sale for a non-blocking
part, and never show a stock number to a customer that is a promise the shop
cannot keep.

### A6 · MARKETING & MERCHANDISING

**Owns** `docs/inventory-marketing/`, `src/content/inventory/`
**DO** — turn real stock into revenue. Design the **tyre clearance** campaign
driven by genuine aged stock (DOT-code-based, honest about age), the
**pre-order / "tell me when it lands"** flow, low-stock urgency that is truthful,
and seasonal stock planning for PH (rainy season, Holy Week, Christmas). Provide
seed content for a tyre-size finder and a parts catalogue that a customer can
browse. Write the SOP the shop follows to request a review at handover — the
review engine is the actual growth strategy.
**DO NOT** — never market a price below cost without the owner approving the
margin, never advertise stock the system says is short, never run a countdown
that resets.

### A7 · CI/CD & QA

**Owns** `tests/inventory/**`, `.github/workflows/*` inventory additions,
`docs/inventory-qa/`
**DO** — write the tests that matter. The **concurrency suite is the single most
important deliverable in this whole build**: two simultaneous reservations for
the last unit must yield exactly one success. Also test idempotent replay,
refusal-not-clamp, TTL expiry, release-on-cancel, consume-on-complete, BOM
derivation, unit-of-measure arithmetic (litres, sets of 5), cost leakage, and
authorisation. Add the gate to CI. Write the release checklist for inventory.
**DO NOT** — never weaken an assertion to make a test pass. Never write a test
that passes because it asserts nothing. Report failing tests; do not delete them.

### A8 · SECURITY & INTEGRATION REVIEW

**Owns** `docs/inventory-security/`, `tests/inventory/security/**`
**DO** — be the adversary. Attack the stock engine specifically: can a
double-tap double-consume? Can a staff account adjust stock without a reason? Can
`costPrice` leak through a JSON-LD block, a page prop, an error message, or a
`?debug=1` query param? Can an unprivileged booking lookup enumerate the whole
catalogue? Can a customer read another customer's reservation? Can a
`POST /api/inventory/movement` be replayed across two products? Produce a
ranked findings list mapped to OWASP.
**DO NOT** — do not fix findings in other agents' files; report them with file,
line and a reproduction.

---

## 4. Shared non-negotiables

These apply to **every** agent. The site-level rules in `docs/AGENT-BRIEF.md` are
still in force — especially "no invented facts", "no placeholder text shipped",
and "every async surface has all four states".

### DO

- **Refuse, never clamp.** A rejected move is a feature.
- **Every write has a reason.** Required, non-empty, human-readable.
- **Idempotency key on every stock mutation.** Networks retry; humans double-tap.
- **`costPrice` never reaches a customer surface.** Staff-only, server-filtered.
- **Four states everywhere**: loading skeleton, success, empty, error.
- **Unit-aware arithmetic.** 4 oil filters, 1.4 litres, a set of 5.
- **WCAG 2.2 AA**, keyboard-first for the operator, `prefers-reduced-motion`.
- **Type-safe end to end.** `strict` + `noUncheckedIndexedAccess`, no `any`.
- **Comment the *why*.** Especially the concurrency code.

### DON'T

- ❌ Ship `TODO`, `Lorem`, `example.com`, dead `href="#"`, or fake stock data
  presented as real.
- ❌ Put `"use client"` on a module that doesn't need it — see
  `scripts/check-client-boundaries.mjs`, which fails CI on a hook in a Server
  Component. That bug 500'd the homepage once already.
- ❌ Hardcode a hex colour; use the tokens in `globals.css`.
- ❌ `any`, `@ts-ignore`, or `eslint-disable` to silence a real problem.
- ❌ Expose a stack trace, SQL, or a connection string to a client.
- ❌ Block a customer sale for a non-blocking part.
- ❌ Delete or mutate a `StockMovement` row. The ledger is append-only.
- ❌ Trust any client-supplied quantity, price, or `onHandAfter`.
- ❌ Write a file another agent owns.
- ❌ Run `git commit` or create README files.

---

## 5. Directory ownership map

| Agent | Owns (exclusive) |
| --- | --- |
| **A1 research** | `docs/inventory-research/` |
| **A2 backend** | `src/lib/server/inventory/`, `src/app/api/inventory/**` |
| **A3 frontend** | `src/app/inventory/**`, `src/components/inventory/**` |
| **A4 booking-integration** | `src/lib/server/inventory/booking-hooks.ts`, `src/components/inventory/BookingPartsPanel.tsx` |
| **A5 funnel** | `docs/inventory-funnel/` |
| **A6 marketing** | `docs/inventory-marketing/`, `src/content/inventory/` |
| **A7 ci-cd/qa** | `tests/inventory/**`, `docs/inventory-qa/`, inventory CI additions |
| **A8 security** | `docs/inventory-security/`, `tests/inventory/security/**` |

**A2 and A4 both touch `src/lib/server/inventory/`** — A2 owns it, A4 owns
exactly one file inside it (`booking-hooks.ts`) which it may only *create*. A2
must not create that filename.

---

## 6. Report format

1. **Shipped** — files created, one line each.
2. **Contract used** — exact imports relied upon.
3. **Requests for the orchestrator** — any change needed in an orchestrator file.
4. **DO / DON'T you applied** — at least three each, with why.
5. **Risks** — max 5 bullets.
