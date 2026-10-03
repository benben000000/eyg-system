# SECURITY CHECKLIST — EYG Tire & Auto Care

**Framework:** OWASP Top 10 (2021), mapped to this specific application.
**Static gate:** `node tests/security/owasp-lite-scan.mjs` (errors fail the build).
**Automated proof:** `tests/integration/**` and `tests/e2e/**`.

For each risk: **the risk → the control → the file that implements it → the
residual risk.** A control with no file is a wish.

Severity: **Critical / High / Medium / Low / Info**.

---

## A01 — Broken Access Control

| | |
| --- | --- |
| **Risk** | A customer, or an anonymous visitor, reads or changes another customer's booking; or reaches `/admin`. |
| **Control** | ① Route-level staff guard in middleware (IP allowlist + session-cookie presence). ② Authoritative re-check in the handler via `requireUser()`. ③ Session tokens stored **hashed** (`Session.tokenHash`), never raw. ④ Public writes are keyed to the submitting session/IP, not to an enumerable id. ⑤ Booking lookup by `reference` requires the reference *and* the phone number. ⑥ The availability board exposes **counts only**, never identities. ⑦ Zod `.strict()` on every write body, so no mass-assignment of `status`/`createdIp`. |
| **Files** | `src/middleware.ts:271–293` · `src/lib/session-cookie.ts` · `src/lib/server/auth.ts` · `src/lib/server/admin-guard.ts` · `src/lib/server/booking.ts` (`lookupBooking`) · `src/lib/server/validation/booking.ts` (`.strict()`) · `src/lib/server/slot-math.ts` (count-only capacity) |
| **Proof** | `tests/integration/api-booking.test.ts` → "never returns another customer's PII", "never stores staff-only or infrastructure fields in the response"; `tests/integration/csrf.test.ts` → the `ipAllowed` block; `tests/integration/api-availability.test.ts` → "never exposes another customer's identity through the board". |
| **Residual** | **Medium.** The middleware guard is deliberately shallow — it sees whether a cookie *exists*, not whether it is valid. A forged `eyg_session` cookie passes middleware and is rejected by the handler. That is the correct layering, but it means **the handler's `requireUser()` is the real control and must never be skipped**. The IP allowlist being empty in production would expose the whole admin surface: `ADMIN_IP_ALLOWLIST=` empty = **open**. Release checklist §G blocks on this. |

---

## A02 — Cryptographic Failures

| | |
| --- | --- |
| **Risk** | Secrets in the client bundle; PII readable in a database dump; traffic interceptable. |
| **Control** | ① `import "server-only"` at the top of every server module, so a Client Component import is a **build** error, not a runtime leak. ② `NEXT_PUBLIC_*` is the only public channel, and `tests/unit/env-schema.test.ts` sweeps for secret-looking values and names under it. ③ PII columns are encrypted at rest with a 32-byte `PII_ENCRYPTION_KEY` (`pii.v1.<…>` envelope) — verified: a lead row stores `pii.v1.…`, never `09171234567`. ④ Session tokens stored as SHA-256 hashes. ⑤ The captcha answer lives in a server-side record keyed by an HMAC-signed nonce, so it is never in the token. ⑥ HSTS with `includeSubDomains; preload` in production. ⑦ Argon2id for the admin password. ⑧ The environment **fails closed**: removing `AUTH_SECRET`, `PII_ENCRYPTION_KEY`, `WEBHOOK_SIGNING_SECRET` or `DATABASE_URL` throws at boot, naming the key and never the value. |
| **Files** | `src/lib/env.ts` · `src/lib/public-env.ts` · `src/lib/integrations/crypto.ts` (PII envelope) · `src/lib/captcha.ts:92–94` · `src/middleware.ts:83–86` · `tests/setup.ts` (the guard) |
| **Proof** | `tests/unit/env-schema.test.ts` (8 assertions on public keys, secret leakage, frozen export) · `tests/unit/captcha-token.test.ts` → "the ANSWER is never smuggled into the token payload", "uses node:crypto timingSafeEqual" · `tests/integration/api-leads.test.ts` → "ENCRYPTS the phone at rest" |
| **Residual** | **Medium.** Two `NEXT_PUBLIC_*` keys are public *by design* and carry risk: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Both **must** be restricted (HTTP referrer allowlist for Maps; site+secret binding for Turnstile). An unrestricted Maps key is a billable-usage key in the wild. Second residual: the captcha challenge store is **process-local**, so a multi-region active/active deploy can issue a challenge on instance A and fail to verify it on instance B. The customer then re-tries — an annoyance, not a security hole, but it is a known seam. |

---

## A03 — Injection

| | |
| --- | --- |
| **Risk** | SQL injection, XSS, command injection, or a template injection through customer text. |
| **Control** | ① **Prisma's parameterised client only.** The static scan fails the build on `$queryRawUnsafe` / `$executeRawUnsafe` / interpolated `Prisma.sql`. No raw SQL exists. ② XSS: React escapes by default; the only two `dangerouslySetInnerHTML` uses are `JsonLd.tsx` (which escapes every `<` to `\u003c`) and the CSP-nonce'd theme bootstrap. ③ Email HTML goes through `escapeHtml` / `escapeAttr` — proven by an injection payload in every field. ④ No `eval`, no `new Function`. ⑤ CSP with a nonce, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, and no `unsafe-eval`. ⑥ `X-Frame-Options: DENY`. ⑦ Free text is length-capped and control characters are stripped so a lead cannot inject a log line or a header. ⑧ No `child_process`, no `vm`, no deserialisation of untrusted input. |
| **Files** | `src/lib/integrations/email.ts:107` (`escapeHtml`) · `src/components/ui/JsonLd.tsx:17` · `src/middleware.ts:43–68` (CSP) · `src/lib/server/validation/primitives.ts` |
| **Proof** | `node tests/security/owasp-lite-scan.mjs` → 0 errors (2 findings suppressed **with written reasons**) · `tests/unit/email-shell.test.ts` → "every free-text field is escaped in the HTML part" · `tests/integration/csrf.test.ts` → "sets a Content-Security-Policy with no unsafe-eval and a nonce on script-src" |
| **Residual** | **Low.** `style-src` needs `'unsafe-inline'` because Tailwind v4 and `next/font` inject inline styles. That is materially smaller than inline script but it is not zero, and it is a **required** trade-off with the current build. Also: the CSP `img-src` allows `https://*.fbcdn.net` and `images.unsplash.com` — necessary for Facebook OG images and gallery photography, and both are third-party requests that deserve a privacy note in the policy. |

---

## A04 — Insecure Design

| | |
| --- | --- |
| **Risk** | The business logic itself is attackable: two customers take one bay; a bot books every slot; a promo is stuffed; the estimator is used to harvest prices. |
| **Control** | ① **The race.** Capacity is re-checked **inside** a `SERIALIZABLE` transaction; the loser gets a clean `409 SLOT_UNAVAILABLE` with a refreshed board. ② `withSerializableRetry` handles Prisma `P2034`. ③ The board **omits** a full slot entirely, so a dead button never reaches submit. ④ Three independent bot layers on every public write: honeypot, minimum-time-to-submit, and a single-use HMAC challenge whose nonce is burned even on a wrong answer (so the small integer space cannot be brute-forced). ⑤ Tiered rate limits, **fails closed** on write tiers, keyed on the *verified* IP **and** a hashed phone — so a bot farm cannot rotate phones to dodge the budget. ⑥ `RATE_LIMIT_BOOKING_PER_HOUR=8` caps a single IP; the capacity check caps the world. ⑦ Consent is recorded truthfully and is never silently widened. |
| **Files** | `src/lib/server/booking.ts:404–491` (the race guard) · `src/lib/server/slot-math.ts:191` (omit a full slot) · `src/lib/captcha.ts:154–173` (single-use burn) · `src/lib/ratelimit.ts` · `src/lib/request.ts:43–59` (verified IP) |
| **Proof** | `tests/integration/api-booking.test.ts` → "two concurrent requests for the last bay: exactly one 201 and one 409" and "fifty concurrent requests can never exceed the bay count" · `tests/integration/rate-limit.test.ts` → "always keys on the IP, even when a subject is supplied", "FAILS CLOSED on a write tier when the store is unreachable" · `tests/unit/captcha-token.test.ts` → "BRUTE FORCE REJECTED — the nonce is burned on a wrong answer" |
| **Residual** | **Medium, and deliberately discussed.** ① **The limiter is not the capacity control.** 8/hour/IP = 192/day/IP, while the shop has 3 bays × 6 slots = 18 bookable bays a day. Capacity is enforced by the serialisable check, not the limiter — which is correct, but means a lower `RATE_LIMIT_BOOKING_PER_HOUR` will not protect the bays any better. ② **Slot hoarding**: a bot can still take 3 real bays per slot, and cancelling is a separate flow. The residual control is `SELF_CANCEL_CUTOFF_MINUTES = 120` plus manual review of `PENDING` older than 24 h. ③ **Promo stuffing**: the seeded codes carry the terms "one per phone number, one per vehicle" in prose, but nothing enforces it in code. `evaluatePromo` has no per-customer redemption counter. A customer can redeem `FIRSTPMS` on every booking they make. **This is a real, unfixed business-logic gap.** ④ **Estimator abuse**: `POST /api/quote` is rate-limited at 12/hour/IP and an unknown service id is a `400`, not a price — so enumerating the catalogue yields nothing. But an *authenticated-free* caller can still walk the *known* ids and read every price. That is not secret (the prices are published), so this is Info, not a finding. ⑤ **DEF-012**: the CSRF allowlist is derived from the request's own `Host` header, so a caller who can choose a `Host` can authorise their own `Origin`. Medium; see the defect log. |

---

## A05 — Security Misconfiguration

| | |
| --- | --- |
| **Risk** | Stack traces in the browser, a framework fingerprint, missing headers, a debug endpoint, verbose errors. |
| **Control** | ① `poweredByHeader: false`. ② `withApi()` converts **any** throw into an opaque `INTERNAL_ERROR` in production; the real cause is logged with a `requestId` and never serialised. ③ Prisma errors are mapped by **code** (`P2002`→409, `P2025`→404, `P2034`→retryable 409) with `meta.target` only, which is a schema identifier, not user data. ④ Every response carries `x-request-id`. ⑤ Full header set in `next.config.ts` **and** middleware, so a static asset and a page both get them. ⑥ CSP nonce regenerated per response. ⑦ `next build && next start` in the E2E config, so the tests run the production build. ⑧ `.env` is never committed; `env.ts` refuses to boot on a placeholder secret. |
| **Files** | `src/lib/http.ts:196–214` · `src/lib/http.ts:56–78` · `next.config.ts:19–44` · `src/middleware.ts:70–87` · `src/lib/logger.ts:37–57` (secret redaction) |
| **Proof** | `tests/integration/api-booking.test.ts` → "never leaks a stack trace, a Prisma code or a connection string" · `tests/integration/api-availability.test.ts` → the same, plus the cache-policy assertions · `tests/integration/csrf.test.ts` → the whole header block |
| **Residual** | **Low.** ① There is no `next.config.ts` entry for `Content-Security-Policy`; it lives in `middleware.ts` because it needs the nonce. A reader looking only at `next.config.ts` will think CSP is missing. ② `/api/health` and `/api/ready` are public by design (`PUBLIC_API_PREFIXES`). They must return **booleans and status codes only** — a readiness probe that leaks a connection string is a classic. Review before release. ③ `X-XSS-Protection: 0` is correct (the legacy auditor is itself a vulnerability) but will look "wrong" in a scanner. |

---

## A06 — Vulnerable and Outdated Components

| | |
| --- | --- |
| **Risk** | A CVE in a runtime dependency, especially the SDKs with network access. |
| **Control** | ① `npm audit --audit-level=high` is a release gate. ② Dependabot/Renovate on (devops owns `.github/**`). ③ `npm ci`, never `npm install`, so the lockfile is authoritative. ④ The SDKs with the widest blast radius (Twilio, Resend, nodemailer, Upstash) are behind a single `await import()` **inside a "is it configured?" guard**, so a provider that is not configured is never even loaded. ⑤ The lockfile is committed. |
| **Files** | `package.json` · `package-lock.json` · `src/lib/integrations/{sms,email}.ts` (guarded dynamic imports) · `vitest.config.ts` (the SDK stub plugin) |
| **Proof** | `npm audit` in CI. The QA suite additionally **stubs** `twilio`/`resend`/`nodemailer`/`@upstash/*` so a test can never reach a provider, whatever the environment says. |
| **Residual** | **Medium.** ① `argon2` and `twilio` are **native** addons; they do not build on every platform and their build toolchain is a supply-chain surface of its own. ② The workspace's `node_modules` was observed in an inconsistent state during this audit (`twilio` resolving to `./lib` with no resolvable entry), which means **at least one install was partial**. A clean `rm -rf node_modules && npm ci` must pass before release. ③ Renovate's `minimumReleaseAge` should be set so a compromised release cannot land unchallenged in the same hour. |

---

## A07 — Identification and Authentication Failures

| | |
| --- | --- |
| **Risk** | Credential stuffing, session fixation, session theft, user enumeration. |
| **Control** | ① The **customer** surface has no accounts at all — no password to steal, no session to fixate. The booking is identified by a `reference` **plus** the phone number. ② `/admin` is the only authenticated surface. ③ Login limiter: 8 attempts per 15 minutes per IP **and** username. ④ `User.failedLogins` + `User.lockedUntil` → lockout after repeated failures. ⑤ Argon2id, not bcrypt or MD5. ⑥ Session token is 32 random bytes, stored as a **hash**, so a database read does not yield a usable session. ⑦ Cookie: `httpOnly`, `sameSite=lax` (tightened to `strict` for `/admin` if the login flow permits), `secure` in production, `path=/`. ⑧ The session cookie is **regenerated on login** (fixation defence). ⑨ `x-request-id` is only echoed when it matches `/^[A-Za-z0-9._-]{8,128}$/`, so a hostile request id cannot inject into a log line. ⑩ No `NEXT_PUBLIC_*` key smells like a credential (enforced by a test and by the static scan). |
| **Files** | `src/lib/server/auth.ts` · `src/app/api/admin/session/*` · `src/lib/session-cookie.ts` · `src/lib/request.ts:27` (SAFE_REQUEST_ID) · `prisma/schema.prisma` (`failedLogins`, `lockedUntil`, `twoFactorSecret`) |
| **Proof** | `tests/unit/env-schema.test.ts` → "no NEXT_PUBLIC_* key name contains SECRET, TOKEN, PASSWORD, CREDENTIAL or PRIVATE" · `tests/integration/rate-limit.test.ts` → "uses the documented per-IP budgets from .env.example" · `tests/unit/booking-reference.test.ts` → a reference never contains I/O/0/1 |
| **Residual** | **Medium.** ① **User enumeration**: whether a failed admin login says "no such user" or "wrong password" must be checked in `src/lib/server/auth.ts` — the same message and the same timing for both. ② 8 attempts / 15 min **per IP** is weak against a distributed credential-stuffing run; `User.lockedUntil` is the second layer and both must hold. ③ `twoFactorSecret` exists in the schema but nothing in the codebase appears to require TOTP at login. If `/admin` handles customer PII, TOTP is worth turning on. ④ Lockout is a denial-of-service vector against the owner: an attacker who knows the owner's username can lock the account out. Cap the lockout duration and alert. ⑤ The captcha token has **no purpose binding** — a challenge minted for the newsletter form can be redeemed on `/api/booking`. Single-use limits the damage to one submission, so this is Low, but binding the HMAC payload to a purpose is a cheap fix and there is an `it.todo` recording it. |

---

## A08 — Software and Data Integrity Failures

| | |
| --- | --- |
| **Risk** | A tampered dependency, an unsigned webhook, or a CI artefact that does not match what was tested. |
| **Control** | ① `npm ci` with a committed lockfile; `postinstall: prisma generate`. ② **Webhooks are signature-verified** with `WEBHOOK_SIGNING_SECRET` using a timing-safe comparison, and `/api/webhooks/*` is exempt from the CSRF origin check precisely *because* it authenticates with a signature instead. ③ Webhook handlers tolerate duplicate deliveries (Twilio/Resend retry). ④ Deployed artefacts are the CI-built ones; the E2E suite runs `next build && next start`, so what was tested is what ships. ⑤ Migrations are reviewed and applied with `migrate deploy`, not `db push`. ⑥ `package.json` and `tsconfig.json` are orchestrator-owned, so a dependency cannot be swapped without an explicit review. |
| **Files** | `src/lib/integrations/webhook-verify.ts` · `src/middleware.ts:106–112` (the signed-webhook exemption) · `src/app/api/webhooks/{twilio,resend,whatsapp}/route.ts` · `playwright.config.ts` (`npm run build && next start`) |
| **Proof** | `tests/integration/csrf.test.ts` → "exempts the signed webhooks, which authenticate with a signature instead" · the release checklist §A (`npm ci`) and §B (migration verification) |
| **Residual** | **Low, but must be verified by hand.** ① The `it.todo` in `captcha-token.test.ts` aside, the **webhook signature path has no automated test**. Send a webhook with a valid body and a wrong signature and confirm a 401. This is release-checklist §G. ② There is no CI artefact attestation or provenance. For a single-owner site with a fixed deploy target, the risk is small; a stolen npm publish token is the realistic path, which is a Dependabot/Renovate concern (A06). ③ Nothing in the repo verifies that the `prisma/migrations/` directory matches `schema.prisma` at boot — it is a release-checklist item, not a code control. |

---

## A09 — Security Logging and Monitoring Failures

| | |
| --- | --- |
| **Risk** | A breach that cannot be detected, traced or reconstructed. |
| **Control** | ① **Security-relevant events are logged**: `ratelimit.blocked` (with tier + driver), `captcha.honeypot`, `captcha.too_fast`, `captcha.future_stamp`, `csrf.rejected`, `bot.blocked`, `bot.page_rate_limited`, `admin.ip_blocked`, `admin.csrf_cookie_missing`, `booking.created`, `quote.requested`, `api.error` (status ≥ 500 or CONFLICT), `api.unhandled`, `booking.notify_failed`, `ratelimit.fail_closed`. ② Every log line carries `requestId`, so a support ticket ("your booking says X") maps to a trace. ③ **PII is scrubbed** before serialisation: any key matching `secret|token|password|authorization|cookie|api_key|encryption_key|signature|salt|hash` becomes `[redacted]`; arrays are capped at 20; depth is capped at 4. ④ The IP is a **verified** address (`src/lib/request.ts`), never a client-set header, so the audit trail is trustworthy. ⑤ `AuditLog` records `userId`, `action`, `entity`, `entityId`, `ip`, `userAgent` for every staff action. ⑥ Sentry is wired (`SENTRY_DSN`) for error aggregation. |
| **Files** | `src/lib/logger.ts` (levels, redaction, `child({requestId})`) · `src/lib/errors.ts` · `src/lib/ratelimit.ts:364` · `src/lib/captcha.ts:219` · `src/middleware.ts:255,262,267,274,290` · `prisma/schema.prisma` (`AuditLog`) |
| **Proof** | `tests/unit/env-schema.test.ts` (no secret in the rendered output) · `tests/integration/csrf.test.ts` (the blocked paths return a `requestId`) |
| **Residual** | **Medium.** ① **No alerting.** Events are logged; nobody is paged. A sustained `ratelimit.blocked` spike or a first-time admin login from a new IP is invisible. At minimum, Sentry alerts on `api.unhandled` and a daily digest of blocked events is warranted — the `/api/cron/daily-digest` route exists and needs a schedule and a recipient. ② **Retention is undefined.** There is no log-retention policy and no decision about what must be kept to answer a Data Privacy Act access or erasure request. ③ `logger.error("ratelimit.fail_closed", { ...logFields }, { err })` passes the error as a **second** argument, which `logger.error(msg, fields)` ignores — **the underlying infrastructure error is dropped from the log**. That is a real observability bug: the one log line written precisely when something is broken does not say what broke. ④ `logger.warn` is used for a page-load rate-limit that returns 429 to real customers. If the limiter is mis-tuned, humans get 429s and there is no distinction in the log between "script" and "customer". |

---

## A10 — Server-Side Request Forgery

| | |
| --- | --- |
| **Risk** | A user-supplied URL makes the **server** fetch something internal — `http://169.254.169.254/latest/meta-data/` on a cloud host returns the instance credentials. |
| **Control** | ① **No public endpoint takes a URL and dereferences it.** The only server-side fetches are to fixed, hardcoded providers: Cloudflare Turnstile (`verifyCaptcha`), Twilio, Resend, Google Places and the Facebook Graph API — all with a constant base URL. ② `/api/availability` and `/api/quote` reject **unknown query parameters** with `.strict()`, so `?url=` is a 400 before anything reads it. ③ Booking notes, lead messages and vehicle fields are stored as text and never fetched. ④ There is no `fetch(userInput)` anywhere. ⑤ No webhook or "import from URL" feature exists. |
| **Files** | `src/lib/captcha.ts:179` (Turnstile, fixed host) · `src/lib/server/validation/availability.ts:51` (`.strict()`) · `src/app/api/reviews/route.ts` (fixed Google/Facebook endpoints) |
| **Proof** | `tests/integration/api-availability.test.ts` → "a board is answered entirely from the database" and "a user-supplied URL in the query string is rejected without ever being fetched" (both spy on `fetch` and assert **not called**) · `tests/integration/api-booking.test.ts` → "a URL smuggled into notes is stored as text and never fetched" · `tests/integration/api-leads.test.ts` → "a lead is not a fetch proxy" · `tests/integration/api-quote.test.ts` → the same |
| **Residual** | **Medium, and this is the one to re-check on every new integration.** ① The **reviews proxy** (`/api/reviews`, `src/lib/reviews/{google,facebook}.ts`, `src/lib/integrations/http.ts`) is the highest-risk surface in the app: it performs outbound requests using credentials, and it is public. It must be checked specifically for: (a) does any parameter reach the URL? (b) is the response size capped? (c) is the timeout set? (d) is the response re-serialised to the client verbatim, or could a compromised/hostile upstream inject markup or a redirect? (e) is it cached, so a hostile upstream response is not amplified to every visitor? **QA has not read these modules end to end — this is a `NOT YET AUDITED` gap and it needs a named owner.** ② Any future "add a review by URL", "import from feed", or webhook-registration feature is SSRF by default and must go through an allowlist (scheme, host, resolved-IP-is-not-private, no redirects followed, timeout, size cap). ③ DNS rebinding: a hostname that resolves to `127.0.0.1` after the first lookup defeats a naive allowlist. There is no such code today, and there must not be. |

---

## Cross-cutting: the automated gate

```bash
node tests/security/owasp-lite-scan.mjs            # errors fail
node tests/security/owasp-lite-scan.mjs --strict   # warnings fail too
node tests/security/owasp-lite-scan.mjs --json     # machine-readable
```

Rules and the OWASP category each maps to are documented in the file header.
**Suppressions** (currently 2, both `dangerouslySetInnerHTML`, both with a
written justification) live in the same file and are printed on every run — a
suppression is a claim, and printing it means a reviewer can challenge it.

### Current scan result

```
0 error(s), 6 warning(s), 2 suppressed   — 249 files under src/
```

The six warnings are all triaged as **acceptable**:
* `src/app/error.tsx`, `src/app/global-error.tsx` — `console.error(error)` in a
  React error boundary. Correct; it should be forwarded to Sentry, not removed.
* `src/lib/logger.ts:317–319` — the logger itself. Deliberate, commented.
* `src/config/site.ts:147` — a hardcoded **https** fallback for the site URL.
  Correct: the fallback must be secure, and `NEXT_PUBLIC_SITE_URL` decides
  `http` for local development.

---

## Sign-off

| Section | Reviewed by | Date | Accepted residual? |
| --- | --- | --- | --- |
| A01 Broken Access Control | | | |
| A02 Cryptographic Failures | | | |
| A03 Injection | | | |
| A04 Insecure Design | | | |
| A05 Security Misconfiguration | | | |
| A06 Vulnerable Components | | | |
| A07 Identification & Auth Failures | | | |
| A08 Software & Data Integrity | | | |
| A09 Logging & Monitoring Failures | | | |
| A10 SSRF | | | |

**A residual risk is accepted only by someone who has read it and written their
name next to it.**