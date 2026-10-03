# OWASP MAPPING — INVENTORY EXTENSION

**Agent:** A8 · Security & Integration Review
**Date:** 2026-10-03
**Extends:** `tests/security/security-checklist.md` (the site-level mapping).
That file is the baseline for the whole application; this one covers the ten
categories **as they apply to the inventory system** — the stock engine, the
reservations, the cycle counts and the booking integration.

> **Note on the brief.** `docs/qa/security-checklist.md` does not exist. The
> site-level checklist is at `tests/security/security-checklist.md` and is
> referenced from `docs/qa/RELEASE-CHECKLIST.md`. This document extends that
> file rather than a missing one. See FINDINGS R12.

**How to read each row.** *Control* is the specific mechanism, not a category
name. *Implements* is the file and line. **A control with no file is a wish** —
so where a control is not yet implemented, the row says so and the *Residual*
column says what the gap costs. Nothing in this document claims a control that
is not in a file or in a test.

Severity of residual risk is ranked by business impact on a small tyre shop.

---

## A01 — Broken Access Control

| | |
| --- | --- |
| **Risk** | An anonymous visitor, a customer, or a rank-1 staff account reads cost prices or another customer's reservations, or changes stock they should not be able to change. |
| **Control ①** | `withAdmin(role, handler)` wraps every inventory route: `requireRole(minimum)` → `requireCsrf(session)` → handler → `writeAuditLog`, in that order, in one place so a new route cannot skip a step. |
| **Implements** | `src/lib/server/admin-guard.ts:57–90` (`withAdmin`), `:93–95` (`withAdminRead` = `FRONT_DESK`, no CSRF on reads), `src/lib/server/auth.ts:335–342` (`requireRole`), `:378–391` (`requireCsrf`) |
| **Control ②** | Role ladder: `FRONT_DESK` 1, `TECHNICIAN` 1, `MANAGER` 2, `OWNER` 3. Inventory uses per-`kind` gating — consume/release/reserve at `FRONT_DESK`; adjust/shrink/opening/cost-write at `MANAGER`. |
| **Implements** | `src/lib/server/auth.ts:95–100` (`ROLE_RANK`), `:102–104` (`roleAtLeast`); pattern precedent `src/app/api/admin/bookings/[id]/status/route.ts:63` |
| **Control ③** | The public availability read returns only DTOs that **cannot** carry cost, reserved counts or reservation ids. |
| **Implements** | `src/lib/inventory-types.ts:263–288` (`PartAvailabilityDto`, `ServiceAvailabilityDto`), `:388–400` (`ProductAvailabilityDto`) |
| **Control ④** | Booking lookup ownership: reference **and** matching phone; 404 for both "unknown" and "wrong phone" so it is not an existence oracle. |
| **Implements** | `src/app/api/booking/[reference]/route.ts:38–52`, `src/lib/server/booking.ts` (`lookupBooking`) |
| **Control ⑤** | Edge guard: `ADMIN_IP_ALLOWLIST` + session-cookie presence on `/admin` and `/api/admin`; the handler's `requireRole` is the authoritative check. |
| **Implements** | `src/middleware.ts:349–374`, `src/lib/session-cookie.ts:34` |
| **Gap** | **The edge guard does not reach the inventory surface.** `ADMIN_PREFIXES` is `["/admin","/api/admin"]`, so `/api/inventory/*` gets no IP allowlist, no cookie-presence check and no CSRF-cookie check; and `/inventory/**` is outside it entirely. **Verified: all thirteen routes do call `withAdmin`/`withAdminRead`, so nothing is exposed today.** The gap is that the net is absent, so correctness rests on thirteen individual guard calls rather than on a prefix. And every mutation is `MANAGER`-gated, which over-corrects: a technician cannot record that they used a filter. |
| **Residual** | **HIGH** — H-01, H-05, H-07, L-04. The routes are guarded; the *structure* is not, and the role split is one notch too tight in the direction that makes staff abandon the system. The middleware is shallow by design and that is correct — the problem is that its coverage stops short of the inventory tree, and that `withAdmin("MANAGER")` is a single threshold covering every movement kind. |
| **Proof** | `tests/inventory/security/inventory-route-auth.test.ts`; A7's authorisation suite |

---

## A02 — Cryptographic Failures

| | |
| --- | --- |
| **Risk** | Secrets in the client bundle; PII readable in a database dump; **the shop's buying price readable by a competitor**. |
| **Control ①** | `import "server-only"` at the top of every server module, so a Client Component import is a **build** error rather than a runtime leak. This is what mechanically prevents `src/lib/server/inventory/*` from reaching the browser bundle. |
| **Implements** | `src/lib/server/admin-guard.ts:15`, `src/lib/server/db.ts:12`, `src/lib/ratelimit.ts:30` (pattern to copy) |
| **Control ②** | `NEXT_PUBLIC_*` is the only public channel; the inventory types are **not** re-exported through `src/lib/types.ts` as public DTOs with a cost field. |
| **Implements** | `src/lib/public-env.ts`, `tests/unit/env-schema.test.ts` |
| **Control ③** | Session tokens are stored as SHA-256 hashes, so a database read yields no usable cookie — relevant because the inventory surface is staff-only and its session is the whole authorisation story. |
| **Implements** | `src/lib/server/auth.ts:81–83`, `:136–168` |
| **Control ④** | Argon2id above the OWASP baseline (`m=65536, t=3, p=4`), plus `User.failedLogins`/`lockedUntil` lockout with exponential backoff. |
| **Implements** | `src/lib/server/auth.ts:45–51`, `:229–231`, `:261–305` |
| **Control ⑤** | HSTS with `includeSubDomains; preload` in production; `X-Content-Type-Options: nosniff`. |
| **Implements** | `src/middleware.ts:82–84`, `:75` |
| **Gap** | **`costPrice` is `cleartext` in the `Product` row.** There is no column-level encryption and no row-level security, unlike `Customer.phone`, which is encrypted at rest via the `pii.v1.<…>` envelope. For a customer phone number, PII law compels the encryption. For the buying price of every SKU, the same treatment is defensible and is **not** applied. A stolen backup is a complete competitor briefing. |
| **Residual** | **MEDIUM** — `costPrice` is not protected at rest. Lower priority than leaking it over HTTP (which is H-14/H-15/M-01), but it is the gap in *this* category and it is the only cleartext business-critical column in the schema. Recommend `notes`-style encryption for `costPrice`, or at minimum a documented decision that backups are the accepted risk. |
| **Proof** | `tests/unit/env-schema.test.ts`, `tests/integration/csrf.test.ts` |

---

## A03 — Injection

| | |
| --- | --- |
| **Risk** | SQL injection through a search term or a product name; XSS through a staff `reason` or a customer `notes`; template injection through free text. |
| **Control ①** | Prisma's parameterised client. The site scanner fails the build on `$queryRawUnsafe` and on interpolated `Prisma.sql`. |
| **Implements** | `tests/security/owasp-lite-scan.mjs:135–141` (`raw-sql` rule) |
| **Control ②** | **The inventory concurrency guard requires raw SQL, and the scanner permits exactly the safe form.** `Prisma.sql` tagged templates bind parameters through the driver; the scanner's `except` clause allows `Prisma.sql` without interpolation and the `test` pattern catches interpolation. |
| **Implements** | Required shape documented at H-16: `tx.$queryRaw(Prisma.sql\`UPDATE "StockLevel" SET "reserved" = "reserved" + \${qty} … WHERE "productId" = \${productId} AND "onHand" - "reserved" >= \${qty} RETURNING …\`)`. **The scanner must not be weakened to accommodate this.** |
| **Control ③** | Zod `.strict()` on every inventory write body, so no mass-assignment of `isActive`, `costPrice` or a status field. The house convention is `validation/primitives.ts` + a per-module schema. |
| **Implements** | `src/lib/server/validation/primitives.ts:33–58` (`cleanText`, `cappedText`), `:17` (`.strict()` rationale) |
| **Control ④** | Control characters stripped and free text length-capped. This matters more for inventory than for marketing copy: `reason`, `reference` and `notes` are staff free text that lands in a permanent ledger row. |
| **Implements** | `src/lib/server/validation/primitives.ts:25` (`CONTROL_CHARS`), `:52–58` (`cappedText`) |
| **Control ⑤** | React escapes by default; the only `dangerouslySetInnerHTML` uses are JSON-LD (which escapes `<` to `\u003c`) and the CSP-nonce'd theme bootstrap. A `reason` rendered in the movement ledger is therefore safe. |
| **Implements** | `src/components/ui/JsonLd.tsx:17`, `src/app/layout.tsx`; CSP at `src/middleware.ts:43–68` |
| **Gap** | **Search is the injection-adjacent surface.** `Product` is indexed on `name`, `sku`, `size`, `brand`, `barcode` — all B-tree on bare columns. A leading-wildcard `ILIKE '%term%'` cannot use them, so every keystroke of A3's instant search is a sequential scan of the whole catalogue, and a term of `%` matches everything. That is a resource-exhaustion and enumeration problem rather than an injection one (parameters are still bound), which is why it is filed under A04 as well. |
| **Residual** | **MEDIUM** — the parameterisation is sound; the *cost* of the unindexed query is the issue (M-08). Also: a maliciously long `reason` in a 5 000-line count post is a storage-amplification vector (L-05) and needs a hard cap, not just a Zod `max`. |
| **Proof** | `node tests/security/owasp-lite-scan.mjs`, `tests/inventory/security/quantity-validation.test.ts` |

---

## A04 — Insecure Design

This is the category the inventory lives or dies in. A04 is not a bug class; it
is "the design permits the abuse". For a stock system the design questions are:
can the same unit be spent twice, can the last unit be sold twice, and can a
promise be made that cannot be kept.

| | |
| --- | --- |
| **Risk** | Overselling the last oil filter. Double-consuming on a double-tap. A hold that never expires. A count posted twice. A promise made against a stale number. |
| **Control ①** | **The conditional write.** Every decrement is a single `UPDATE` whose `WHERE` clause contains the guard, inside `withSerializableRetry` (`SERIALIZABLE`). Under concurrency exactly one commit wins the re-check; the loser retries, re-reads, and refuses. **The guard must be in the predicate, not in TypeScript before the write.** |
| **Implements** | `src/lib/server/db.ts:137–166` (`withSerializableRetry`, `P2034` retry with jittered backoff), `:144–149` (`SERIALIZABLE`, `maxWait: 5_000`, `timeout: 15_000`); required shape at H-16; design stated in `docs/INVENTORY-AGENT-BRIEF.md` A2 DO |
| **Control ②** | **`StockLevel` is held, not computed.** `available` is not `SUM(movements)` at read time. This is the decision that makes control ① expressible in one statement. |
| **Implements** | `prisma/schema.prisma:766–776` (the schema states the reason), `:777–787` (`StockLevel`, `productId @unique`) |
| **Control ③** | **`idempotencyKey @unique`** on the ledger, plus `Reservation @@unique([productId, bookingId])` so the same part cannot be held twice on the same job. |
| **Implements** | `prisma/schema.prisma:805`, `:844` |
| **Control ④** | **A `SERIALIZABLE` re-check precedent already exists in the booking engine** — capacity is re-checked inside the transaction and the loser gets a clean 409. A2 is extending a proven pattern, not inventing one. |
| **Implements** | `tests/security/security-checklist.md` A04 §①; `tests/integration/api-booking.test.ts` → "two concurrent requests for the last bay: exactly one 201 and one 409" |
| **Control ⑤** | **Refuse, never clamp.** `MovementRefusalReason` is a typed union; `PostMovementRejection` carries `available` so the UI can say "3 left" rather than "failed". A rejection is a feature, not an error. |
| **Implements** | `src/lib/inventory-types.ts:199–222` |
| **Control ⑥** | **TTL on every hold.** `Reservation.expiresAt` plus the `/api/cron/expire-holds` sweep already in production, so a forgotten release self-heals. |
| **Implements** | `prisma/schema.prisma:835`, `src/app/api/cron/expire-holds/route.ts:30,44` |
| **Gap ①** | **The contract's own refusal enum creates the H-03 leak.** `PRODUCT_INACTIVE` is a blanket refusal, so `RELEASE` against a deactivated product is refused, `reserved` never decrements, and stock is permanently invisible. The invariant has no carve-out and the schema has no constraint. |
| **Gap ②** | **No storage-layer invariant.** No CHECK constraint on `onHand ≥ 0`, `reserved ≥ 0`, `reserved ≤ onHand`, `qty ≠ 0`, sign-matches-kind, or reason-required-if-actor-present. One direct `UPDATE` corrupts the running total permanently and silently. |
| **Gap ③** | **No reconciliation.** Nothing recomputes `StockLevel` from `StockMovement`, and `reserved` has no ledger derivation at all — so half the invariant cannot be checked even in principle. |
| **Gap ④** | **`ttlMinutes` is client-suppliable** and the contract names the risk ("a hold that never expires becomes a permanent leak") in a comment attached to a client-controlled field. |
| **Gap ⑤** | **Fractional quantities are unrepresentable.** `Int` everywhere, `LITRE` and `KG` units. A 1.4 L oil change cannot be recorded, so it is mis-recorded, and the ledger becomes a record of a different event. |
| **Gap ⑥** | **`qtyPerService` is unvalidated.** A negative BOM line makes `available < qtyNeeded` permanently false, so `canFulfil` is permanently true — a promise the shop cannot keep, which is the exact failure A05 is told to design against. |
| **Gap ⑦** | **`available` must not be cached.** The house pattern is a 5-minute in-process cache (`availability.ts:40–50`), which is correct for bay capacity and wrong for a stock promise. |
| **Residual** | **HIGH — rev 2.** C-01, H-02, H-03, M-02, M-04. Note that **gaps 1, 4 and 7 above are now FIXED** (`REFUSE_WHEN_INACTIVE` carves out RELEASE/ADJUST/SHRINK; `clampTtlMinutes` bounds the TTL; `available` is served `no-store` and is never cached). **Every remaining gap is in the integration seam or below the TypeScript layer — not in the stock engine**, which got the hard parts right. |
| **Proof** | `tests/inventory/security/ledger-immutability.test.ts`, `idempotency-and-reasons.test.ts`; **A7's concurrency suite is the primary proof** and is the most important deliverable in the whole build |

---

## A05 — Security Misconfiguration

| | |
| --- | --- |
| **Risk** | Verbose errors, a debug parameter, an unguarded cache directive, a staff page a crawler can reach. |
| **Control ①** | `withApi()` converts **any** throw into an opaque `INTERNAL_ERROR` in production. `fail()` serialises only `code`, `message` and `fields` — `logMeta` and `cause` are logged with a `requestId` and **never** sent. Prisma errors are mapped by code with `meta.target` only, which is a schema identifier rather than user data. |
| **Implements** | `src/lib/http.ts:190–209`, `:155–181`, `:56–78`; proven by `tests/integration/api-booking.test.ts` → "never leaks a stack trace, a Prisma code or a connection string" |
| **Control ②** | Every response carries `x-request-id`; `x-request-id` is echoed only when it matches `/^[A-Za-z0-9._-]{8,128}$/`, so a hostile request id cannot inject into a log line. |
| **Implements** | `src/lib/http.ts:124`, `src/lib/request.ts:27` (`SAFE_REQUEST_ID`) |
| **Control ③** | `withAdmin` returns `Cache-Control: no-store, max-age=0` by default, so staff payloads are never cached. |
| **Implements** | `src/lib/server/admin-guard.ts:86` via `http.ts:125` |
| **Control ④** | Bot damping and a per-instance page limiter on the edge. |
| **Implements** | `src/middleware.ts:178–237`, `:315–318`, `:323–326` |
| **Control ⑤** | Cron routes authenticate with a constant-time bearer secret and **refuse to run unauthenticated in production**. This is the control that runs the TTL sweep and the (proposed) reconciliation job, so it matters more for inventory than for anything else on the site. |
| **Implements** | `src/lib/integrations/api.ts:243–267` (`checkCronAuth`), `:210–217` (`safeEqual`), `src/app/api/cron/expire-holds/route.ts:30,44` |
| **Gap ①** | `withAdmin` honours `result.cacheControl` verbatim, and the house pattern for a public read is `cacheControl: "public, max-age=30, stale-while-revalidate=120"` (`src/app/api/availability/route.ts:76`). One copy-paste on an inventory route publishes the cost book to a shared cache. |
| **Gap ②** | `robots.ts` disallows `["/admin","/api/","/maintenance","/offline"]` with `allow: "/"`, so the A3 path `/inventory` is **crawlable**. |
| **Gap ③** | Server Component pages need their own `force-dynamic`. `withAdmin`'s `no-store` protects the API response, not the page's HTML, and an omitted `force-dynamic` prerenders cost data at build time into a file cached forever. |
| **Residual** | **MEDIUM — rev 2, down from HIGH.** Gaps 1 and 3 above are **NOT REALISED**: both cacheable-looking responses set `no-store` (`availability:121`, `aging:54`), everything else inherits `withAdmin`'s `private: true`, and **no page under `src/app/inventory/**` fetches server-side data at all**, so the RSC flight payload carries no cost figures. `force-dynamic` and `noindex` are both on the layout. What remains: `robots.ts` still says `Allow: /` for `/inventory` (R2), and two `GET` routes use `withAdmin` rather than `withAdminRead`, so they demand a CSRF header a browser will not attach on a navigation (H-05). The error-handling layer is genuinely excellent — I could not extract a stack trace, a Prisma code or a connection string from it in **either** environment. |
| **Proof** | `tests/inventory/security/cost-data-containment.test.ts`; `tests/integration/csrf.test.ts` → the whole header block |

---

## A06 — Vulnerable and Outdated Components

| | |
| --- | --- |
| **Risk** | A CVE in a runtime dependency, especially the SDKs with network access. |
| **Control ①** | The four SDKs with the widest blast radius (Twilio, Resend, nodemailer, Upstash) sit behind a single `await import()` **inside an "is it configured?" guard**, so an unconfigured provider is never loaded. |
| **Implements** | `src/lib/integrations/{sms,email}.ts`, `src/lib/ratelimit.ts:283–313` (`upstashHit` returns `null` and degrades to Postgres when `!env.rateLimit.hasUpstash`) |
| **Control ②** | `npm ci` with a committed lockfile; `npm audit --audit-level=high` is a release gate; Dependabot/Renovate on. |
| **Implements** | `package.json:8` (`postinstall: prisma generate`), release checklist §A |
| **Control ③** | The QA suite **stubs** `twilio`/`resend`/`nodemailer`/`@upstash/*`, so a test can never reach a provider. Relevant to inventory because `onInfraError` behaviour depends on which driver answers. |
| **Implements** | `vitest.config.ts:62–96` (`STUBBED_SDKS`, `stubOptionalSdks`), `:141` (`server.deps.inline`) |
| **Gap** | Nothing inventory-specific. The one inventory-relevant dependency note: `pg_trgm` for the trigram index (M-08) is a Postgres **extension**, and `CREATE EXTENSION` requires a role with the right privilege on a managed provider. It must be verified before the migration relies on it. |
| **Residual** | **LOW** — inherited from the site baseline. `argon2` and `twilio` are native addons (a build-toolchain surface). Note the site's own recorded observation that `node_modules` was once in an inconsistent state: `rm -rf node_modules && npm ci` must pass before release. |
| **Proof** | `npm audit` in CI |

---

## A07 — Identification and Authentication Failures

| | |
| --- | --- |
| **Risk** | Credential stuffing, session theft, lockout denial-of-service, user enumeration — against the only authenticated surface that matters for inventory. |
| **Control ①** | **No double-submit bypass.** The session cookie is `httpOnly` (a cross-site attacker cannot read it), the CSRF cookie is `sameSite=lax` (also unreadable cross-site), and `requireCsrf` verifies an HS256 JWT whose `sid` must equal the live `session.sessionId`, with `algorithms: ["HS256"]` pinned so `alg: none` is refused. Three independent layers, and I could not get past any of them. |
| **Implements** | `src/lib/server/auth.ts:365–391` (`issueCsrfToken`, `requireCsrf`), `:188–198` (`sessionCookieOptions`), `:394–403` (`setCsrfCookie`), `src/lib/server/admin-guard.ts:69–73` |
| **Control ②** | **The middleware's no-Origin gap is not exploitable.** `originAllowed` permits a mutating request with neither `Origin` nor `Referer` (only `/api/webhooks` is meant to get that), but the handler still demands a session-bound CSRF header, which a script with only a stolen cookie cannot produce. |
| **Implements** | `src/middleware.ts:161–167` — see "What I could not break" #2 and #3 |
| **Control ③** | **No user enumeration.** `login()` returns the same message, status and work for an unknown email as for a wrong password, and burns a dummy argon2id verify on the unknown path so response time cannot distinguish the two. |
| **Implements** | `src/lib/server/auth.ts:53–54` (`DUMMY_HASH_PROMISE`), `:241` (`GENERIC_LOGIN_ERROR`), `:261–292` |
| **Control ④** | Lockout with exponential backoff (1 m, 5 m, 15 m, 1 h, capped) plus a `login` limiter at 8 per 15 min per IP **and** per username. |
| **Implements** | `src/lib/server/auth.ts:229–231`, `:281–286`, `src/lib/ratelimit.ts:82–88` |
| **Control ⑤** | Session token is 32 random bytes from the CSPRNG; only the SHA-256 hash is persisted, so "log everyone out" is a `DELETE` rather than a key rotation. Absolute TTL 30 days with sliding renewal that never exceeds it. |
| **Implements** | `src/lib/server/auth.ts:76–79`, `:116–127`, `:136–168`, `:170–178` |
| **Gap** | **The rate-limit budget an inventory route would use does not exist**, so an authenticated staff session has no per-tier budget on the inventory surface. More sharply: the two workarounds available today are `bookingLimiter` (which starves stock receipts when customers are booking) and `readLimiter` (which **fails open** during an infrastructure outage). |
| **Residual** | **MEDIUM** — the authentication layer is strong and I found no bypass. The inventory-specific residual is A07-adjacent rather than A07-proper: once `inventory.write` exists it must be `onInfraError: "closed"`, or an inventory write path is unbounded whenever the rate-limit store is unreachable. Inherited site residual: lockout is a DoS vector against the owner, and `twoFactorSecret` exists in the schema with nothing requiring it. |
| **Proof** | `tests/integration/rate-limit.test.ts` → "FAILS CLOSED on a write tier when the store is unreachable"; `tests/unit/captcha-token.test.ts` |

---

## A08 — Software and Data Integrity Failures

| | |
| --- | --- |
| **Risk** | A ledger that can be rewritten; a webhook or cron that can be triggered by anyone; a CI artefact that does not match what was tested. |
| **Control ①** | **The ledger is append-only by contract** — "Never `update` a `StockMovement`. Never delete one" appears in the brief for A2, for A4, and in the §4 DON'T list. Enforced by `tests/inventory/security/ledger-immutability.test.ts`. |
| **Implements** | `docs/INVENTORY-AGENT-BRIEF.md` §3 A2 DO NOT, §4 DON'T; `prisma/schema.prisma:789` ("Append-only. Never updated, never deleted") |
| **Control ②** | **Deactivation, not deletion.** `Product.isActive Boolean @default(true)` is the mechanism for retiring a line while keeping its history. |
| **Implements** | `prisma/schema.prisma:746` |
| **Control ③** | **Cron routes are secret-authenticated and fail closed in production**, so the TTL sweep cannot be triggered or skipped by an outsider. |
| **Implements** | `src/lib/integrations/api.ts:243–267`, `src/app/api/cron/expire-holds/route.ts:44` |
| **Control ④** | Webhooks are signature-verified with `WEBHOOK_SIGNING_SECRET` and `/api/webhooks/*` is exempted from the CSRF origin check *because* it authenticates with a signature instead. Same discipline extends to cron: no cookie, a secret. |
| **Implements** | `src/lib/integrations/webhook-verify.ts`, `src/middleware.ts:161–167` |
| **Control ⑤** | `npm ci` + committed lockfile; migrations applied with `migrate deploy`, never `db push`; the E2E suite runs `next build && next start`. |
| **Implements** | `package.json:17`, `playwright.config.ts` |
| **Gap ①** | **`onDelete: Cascade` on `StockMovement.product` (`:812`) means deleting a `Product` deletes its entire ledger** — the schema honours the letter of append-only and breaks the spirit in one statement. |
| **Gap ②** | **`Reservation` records no actor**, so half the stock trail — who held a unit, who authorised releasing it — is unattributed. `StockMovement` gets this right (`actorId` **and** denormalised `actorName`) and `Reservation` does not. |
| **Gap ③** | **`StockCount.reviewedBy`/`postedBy` are untyped loose strings** with no comment saying they hold `User.id`, so "who approved this variance" is answerable only by guessing the convention. |
| **Gap ④** | The TTL sweep that underwrites H-11 and invariant I8 must actually be scheduled. `vercel.json` `crons` is an orchestrator-owned file and its inventory entries were not verifiable at review time. |
| **Residual** | **MEDIUM** — H-16 is the sharpest risk here, and it is an *integration* risk rather than a design gap: the concurrency guard needs raw SQL, the site scanner fails on raw SQL, and the wrong resolution of that tension reintroduces the oversell race. M-11, M-10, L-06 are the rest. |
| **Proof** | `tests/inventory/security/ledger-immutability.test.ts`; release checklist §A, §B |

---

## A09 — Security Logging and Monitoring Failures

| | |
| --- | --- |
| **Risk** | A stock discrepancy, a leak or a double-spend that cannot be detected, traced or reconstructed. For inventory this is not theoretical — **the ledger is the only defence in a dispute**, so an unlogged or unattributable write is a business loss, not just an observability gap. |
| **Control ①** | **The ledger *is* the audit trail, and it carries the actor.** `StockMovement.actorId` (User.id) plus a denormalised `actorName`, so the trail survives an account being deleted — the comment at `schema.prisma:807–808` says exactly that. `bookingId` and `reference` make every stock movement reconcilable against a job and a supplier invoice. |
| **Implements** | `prisma/schema.prisma:803–808` |
| **Control ②** | `writeAuditLog` on every mutating admin action, with `userId`, `action`, `entity`, `entityId`, verified `ip` and `userAgent`. Never throws, so an audit failure cannot roll back the user's action — but it *is* logged loudly so the gap is visible. |
| **Implements** | `src/lib/server/auth.ts:426–447`; precedent `src/app/api/admin/bookings/[id]/status/route.ts:78–85` |
| **Control ③** | Every log line carries a `requestId`, and the IP is the **verified** address from `clientIp()`, never a client-set header — so the trail is trustworthy for attribution. |
| **Implements** | `src/lib/request.ts:43–59`, `src/lib/http.ts:124`, `src/middleware.ts:300` |
| **Control ④** | PII is scrubbed before serialisation: any key matching `secret\|token\|password\|authorization\|cookie\|api_key\|encryption_key\|signature\|salt\|hash` becomes `[redacted]`; arrays capped at 20, depth at 4. |
| **Implements** | `src/lib/logger.ts` (levels, redaction, `child({requestId})`) |
| **Control ⑤** | Refusals are first-class and typed, so a spike in `INSUFFICIENT_STOCK` is a countable event rather than a silent clamp. |
| **Implements** | `src/lib/inventory-types.ts:199–222`, `http.ts:171` (≥500 or `CONFLICT` is logged) |
| **Gap ①** | **`reserved` has no derivation and therefore no reconcilable trail.** `StockMovement` records deltas to `onHand`; `reserved` moves without a ledger row, so "why is `reserved` 4?" is answerable only from `Reservation` rows, which themselves record no actor (M-10). |
| **Gap ②** | **No reconciliation job and therefore no drift detection.** The query that would surface H-03, H-08 and H-09 exists and is not run by anything (M-15). |
| **Gap ③** | **`reason` is unbounded free text and lands in a permanent row** (L-05). It is simultaneously the most valuable field in the schema for a dispute and an unbounded PII sink. |
| **Gap ④** | Inherited: no alerting. Events are logged; nobody is paged. `/api/cron/daily-digest` exists and needs a schedule and a recipient. |
| **Residual** | **MEDIUM** — the logging substrate is good and the ledger-as-audit-trail decision is the right one. The inventory-specific gap is that half the invariant (`reserved`) is invisible to both the ledger and any reconciliation query, so a leak in `reserved` is detectable only by a customer. |
| **Proof** | `tests/inventory/security/ledger-immutability.test.ts`, `idempotency-and-reasons.test.ts` |

---

## A10 — Server-Side Request Forgery

| | |
| --- | --- |
| **Risk** | A user-supplied URL makes the **server** fetch something internal — `http://169.254.169.254/latest/meta-meta/` on a cloud host returns instance credentials. |
| **Control ①** | **The inventory surface introduces no URL-shaped field at all.** `CreateProductInput`, `UpdateProductInput`, `PostMovementInput`, `ReserveInput`, `MovementQuery`, `CreateCountInput` and `RecordCountInput` contain no `url`, `imageUrl`, `link`, `source` or `href`. There is no "import a product from a supplier's feed" feature, and adding one must go through a scheme+host+resolved-IP allowlist. |
| **Implements** | `src/lib/inventory-types.ts:143–166`, `:168–170`, `:183–197`, `:226–238`, `:292–296`, `:336–341`, `:374–382` (verified field-by-field) |
| **Control ②** | Zod `.strict()` on query objects, so `?url=` is a 400 before anything reads it. The inventory query params must inherit this. |
| **Implements** | `src/lib/server/validation/availability.ts:51` (precedent — `/api/availability` and `/api/quote` already do this) |
| **Control ③** | `barcode`, `dotCode`, `sku`, `reference`, `reason` and `notes` are stored as **text and never fetched**. `Product.logoUrl`-style fields do not exist in the inventory schema. |
| **Implements** | `prisma/schema.prisma:700–764` — no URL column on any inventory model |
| **Control ④** | `notify*` sends to fixed provider endpoints behind an "is it configured?" guard; the reorder digest and low-stock alert must use the same helper, never a caller-supplied endpoint. |
| **Implements** | `src/lib/integrations/notify.ts`, `src/lib/server/notify.ts`, `src/lib/integrations/sms.ts` |
| **Residual** | **LOW** — genuinely not applicable today, and this is the category most likely to be broken by a *future* feature. The two to watch, in order: (1) a "add product from a supplier's feed / scan a QR code from a supplier PDF" import feature, which is SSRF by default; (2) A6's OG images for the tyre clearance campaign, if a `dotCode` or supplier name ever reaches a remote image URL. Both must go through an allowlist with a resolved-IP-is-not-private check, no redirect following, a timeout and a size cap — the note already recorded in the site checklist A10 §②. |
| **Proof** | `tests/inventory/security/cost-data-containment.test.ts` (rule: no URL-shaped field in the inventory types) |

---

## Cross-cutting: the inventory gate

```bash
npx vitest run tests/inventory/security        # the five inventory gates
node tests/security/owasp-lite-scan.mjs         # the site baseline, unchanged
```

The inventory gates are **armed but currently unsatisfied**: at review time no
inventory route or page exists, so each gate inspects an empty set and reports
`0 file(s) inspected` rather than claiming a pass. That distinction is printed
in every test's name so a green run cannot be mistaken for coverage. The
moment A2/A3/A4 lands, the same gates evaluate real code and fail on H-01,
H-02, H-04, H-05, H-06, H-12, H-13, H-14, H-15, M-01, M-03, M-04, M-08 and
L-02.

| Gate | OWASP categories | Findings it enforces |
| --- | --- | --- |
| `inventory-route-auth.test.ts` | A01, A05, A07, A03 | H-01, H-02, H-12, H-16, H-07, M-03 |
| `ledger-immutability.test.ts` | A08, A04, A09 | H-06, H-09, H-16, M-11, M-15, L-04, L-06 |
| `cost-data-containment.test.ts` | A02, A01, A05, A10 | H-14, H-15, M-01, M-04, H-02 |
| `quantity-validation.test.ts` | A03, A04 | H-13, M-05, M-08, M-12, L-02 |
| `idempotency-and-reasons.test.ts` | A04, A08, A09 | H-04, H-05, H-08, H-11, M-06, M-07, L-05 |

---

## Residual risk summary

**Revision 2 — re-scored against the landed implementation.**

| Category | Site baseline | Inventory (rev 1) | Inventory (rev 2) | Movement |
| --- | --- | --- | --- | --- |
| A01 Broken Access Control | Medium | **High** | **High** | routes are all guarded, but the edge covers neither prefix and the role is one notch too tight |
| A02 Cryptographic Failures | Medium | **Medium** | **Medium** | `costPrice` is still cleartext at rest; unchanged in transport, and the transport controls held |
| A03 Injection | Low | **Medium** | **Low** | parameterisation intact, all raw SQL is `Prisma.sql`-tagged, every page size bounded. Only the unindexable search query remains |
| A04 Insecure Design | Medium | **High** | **High** | the stock engine is now correct; the **integration seam** is not wired |
| A05 Security Misconfiguration | Low | **High** | **Medium** | no `cacheControl: public`, no data in the RSC payload, noindex on the layout. Two GETs require CSRF |
| A06 Vulnerable Components | Medium | **Low** | **Low** | nothing inventory-specific |
| A07 Identification & Auth | Medium | **Medium** | **Medium** | no bypass found; every mutation is `MANAGER`, which is an authorisation problem in A01 |
| A08 Data Integrity | Low | **Medium** | **High** | the ledger is append-only and correct — but **nothing writes to it on a job** |
| A09 Logging & Monitoring | Medium | **Medium** | **Medium** | the ledger is a good audit trail; `reserved` still has no derivation and nothing reconciles |
| A10 SSRF | Medium | **Low** | **Low** | no URL-shaped field exists; watch the next feature |

**Two categories moved up and two moved down.** A08 moved up for one reason:
`StockMovement` is genuinely append-only, correctly guarded, correctly attributed
— and `onBookingCompleted`, the function whose entire purpose is to write the
ledger row when a job finishes, is called from nowhere. An audit trail nobody
writes to is not an audit trail.

A03 and A05 moved down because the implementation took the controls seriously
rather than assuming them: `Prisma.sql` everywhere, `no-store` on both
cacheable-looking responses, and no server-fetched data on any page. Those were
the two categories where I expected shortcuts.

The two that did not move are the two worth the orchestrator's time. **A04** is
the category the inventory is judged on and its remaining gap is C-01 plus H-02
and H-03 — three assertions in a file that already exists and is already
correct in every other respect. **A01** needs one orchestrator decision about
which prefix the edge guards and one role decision about who may record a
consume. Both are single lines.

---

## What the review could not decide

Two things in this document are not mine to close.

1. **Whether reading proves the concurrency guard.** `stock-engine.ts:280-287`
   puts `"onHand" - "reserved" >= ${qty}` in the `WHERE` clause under
   `SERIALIZABLE`, which is correct by inspection, and the header comment
   explains why the obvious alternative is wrong. **I could not break it by
   reading it. Reading is not proof.** Two simultaneous reservations for the last
   unit must be *executed* and shown to yield exactly one success — that is
   A7's suite and it is the single most important deliverable in this build.
2. **Whether an unwired module is a bug or a sequencing choice.** C-01 is the
   largest finding and A4 documented it in its own file header. It is still the
   largest finding: the inventory does nothing on a booking until it is wired,
   and a stock system that only works when a human remembers to press the right
   button is a spreadsheet with extra steps.

---

## Sign-off

| Section | Reviewed by | Date | Accepted residual? |
| --- | --- | --- | --- |
| A01 Broken Access Control | A8 | 2026-10-03 | |
| A02 Cryptographic Failures | A8 | 2026-10-03 | |
| A03 Injection | A8 | 2026-10-03 | |
| A04 Insecure Design | A8 | 2026-10-03 | |
| A05 Security Misconfiguration | A8 | 2026-10-03 | |
| A06 Vulnerable Components | A8 | 2026-10-03 | |
| A07 Identification & Auth Failures | A8 | 2026-10-03 | |
| A08 Data Integrity Failures | A8 | 2026-10-03 | |
| A09 Logging & Monitoring Failures | A8 | 2026-10-03 | |
| A10 SSRF | A8 | 2026-10-03 | |

**A residual risk is accepted only by someone who has read it and written their
name next to it.** The twelve orchestrator requests in `FINDINGS.md` R1–R12 are
the list to work through first; six of the twelve are one-line changes.