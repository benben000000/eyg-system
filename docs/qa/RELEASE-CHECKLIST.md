# RELEASE CHECKLIST — EYG Tire & Auto Care

**Owner:** whoever is holding the deploy. **Gate:** every box must be ticked,
or explicitly waived **in writing** by the orchestrator with a reason.

Order matters. The gates are sequenced cheapest-and-most-reversible first, so a
failure costs minutes rather than a rollback.

Print this. Tick it with a pen if that helps. Do not ship with ticks you did not
earn.

---

## A · Code gates (cheap, run first)

- [ ] `npm run typecheck` — `tsc --noEmit` is clean. No `any`, no `@ts-ignore`, no `eslint-disable` added to silence a real problem.
- [ ] `npm run lint` — `next lint --max-warnings=0` is clean.
- [ ] `npm test` — the Vitest suite is green, **or** every failure is an open, accepted row in `docs/qa/DEFECT-LOG-TEMPLATE.md` with an owner and a severity.
- [ ] `node tests/security/owasp-lite-scan.mjs --strict` — zero errors, zero warnings.
- [ ] `npm audit --audit-level=high` — no high or critical advisories in the runtime dependency tree. (`npm audit` covers A06:2021 Vulnerable and Outdated Components.)
- [ ] `npm ci` was used, never `npm install`. `package-lock.json` is committed and matches `package.json`. A drifting lockfile is a supply-chain hole (A08).
- [ ] Dependabot/Renovate is enabled and has not been ignored for more than 14 days.
- [ ] `prisma/schema.prisma` has not changed without a migration. `prisma migrate status` reports a clean database.

---

## B · Data gates

- [ ] A **staging copy of production** exists and `prisma migrate deploy` succeeds against it from an empty database (not `db push` — push does not prove the migration history is replayable).
- [ ] Migrations applied to staging were **verified**, not just run: open `/admin` and confirm the board loads, and `SELECT count(*)` on `Booking`, `Customer`, `Service`, `Promotion`.
- [ ] **Backup taken** immediately before the migration, and **the restore drill has been completed** — not just scheduled. Restored into a scratch database, opened, row counts compared. An untested backup is not a backup.
- [ ] `POSTGRES_BACKUP_URL` / the managed-platform PITR window is confirmed for the *production* database, and the retention period covers the busiest booking week.
- [ ] Seed data is idempotent: `prisma db seed` run twice leaves the catalogue unchanged (no duplicate services, no duplicated promo codes — `Promotion.code` is `@unique`).

---

## C · Business facts (the ones a customer will read on the page)

- [ ] **No `TODO-VERIFY` left anywhere in `src/config/site.ts`.** Grep it:
      `grep -rn "TODO-VERIFY" src/ prisma/ public/`
- [ ] The **real phone number** is in `BUSINESS.phoneE164`, `phoneDisplay` and `whatsappNumber`, and the `tel:` link on the homepage dials it. This is the single highest-value fact on the site; a wrong number means zero bookings.
- [ ] The **real hours** are in `BUSINESS_HOURS`, `Prisma\BusinessHours`, `Prisma\Holiday` and match the Google Business Profile to the minute.
- [ ] The **address** in `BUSINESS.address` matches the GBP exactly (NAP consistency is local SEO and a consumer-protection matter).
- [ ] **Every peso figure** on `/services` and `/deals` has been confirmed by the owner. `src/content/marketing/promotions.ts` flags each one as "SUGGESTED — REQUIRES OWNER CONFIRMATION"; that flag must be gone, not just overridden.
- [ ] The **active promo windows** (`startsAt`/`endsAt`) are real dates the owner has agreed to, and none has silently expired.
- [ ] **Trust claims** (`trust.workmanshipGuaranteeDays`, `ratingValue`, `ratingCount`, `yearsServing`, `tireBrands`, `isPartner`) are all owner-confirmed. `ratingCount: 0` must render as *no reviews shown*, never as `0 reviews` next to a `4.9` star.
- [ ] The **unsubscribe endpoint** exists and actually unsubscribes. An opt-out link that 404s is a Data Privacy Act problem, not a cosmetic one.

---

## D · Legal and consent

- [ ] The **privacy policy matches what actually happens**: it names every category of personal data collected (name, phone, email, vehicle make/model/plate/mileage, booking history, IP, user agent, UTM parameters), the lawful basis (contract — necessary to perform the booking; consent — marketing), the retention period, and the fact that PII is encrypted at rest.
- [ ] The **consent copy** on the booking form distinguishes transactional SMS (a booking confirmation the customer asked for) from marketing SMS (opt-in), and neither checkbox is pre-ticked.
- [ ] The **cookie/analytics disclosure** matches reality: if Plausible or GA is loaded, it is named. If neither is configured, no cookie banner is shown.
- [ ] `/terms` names the business, the prices' nature (estimates confirmed after inspection), the cancellation policy, and the warranty — all owner-confirmed.

---

## E · Accessibility

- [ ] `docs/qa/ACCESSIBILITY-AUDIT.md` — every item has a **pass**, or a **fail with an owner and a fix**. Zero items in the "not yet audited" state.
- [ ] The axe-core E2E run is green on all ten routes in both themes, with **zero serious or critical** violations.
- [ ] Keyboard-only walkthrough of the booking wizard and the lightbox completed on a real machine.
- [ ] Screen-reader smoke test completed: NVDA on Windows and VoiceOver on iOS, at minimum on the homepage and the booking form.
- [ ] **The brand-yellow contrast question is resolved and documented** (see the audit, §Contrast): `#FCC605` on `#FFFFFF` is **1.59:1** and must never carry text.
- [ ] Focus is visible on every interactive element, including inside the mobile action bar and the modals.
- [ ] 200% zoom and 320px width: no clipping, no horizontal scroll.
- [ ] `prefers-reduced-motion` respected.

---

## F · Performance

- [ ] `docs/qa/PERFORMANCE-BUDGET.md` — every budget met **or** consciously waived:
  - [ ] Homepage JS ≤ 180 KB gzipped
  - [ ] Initial-route JS ≤ 120 KB gzipped
  - [ ] CLS ≤ 0.1
  - [ ] LCP ≤ 2.5 s on a mid-tier Android over simulated Slow 4G
  - [ ] INP ≤ 200 ms
  - [ ] Every image ≤ 200 KB, served AVIF/WebP, with intrinsic width/height
  - [ ] ≤ 2 font families, ≤ 4 font files, `display: swap`, self-hosted
  - [ ] ≤ 2 third-party scripts
- [ ] Measured on a **real mid-tier Android** (or Lighthouse CI), not only in a desktop headless browser. A number from CI is a smoke alarm, not a budget.

---

## G · Security

- [ ] `tests/security/security-checklist.md` — every OWASP Top 10:2021 row has a **control**, an **implementation file** and a **residual risk**. Every row is either implemented or explicitly accepted.
- [ ] `AUTH_SECRET`, `PII_ENCRYPTION_KEY`, `WEBHOOK_SIGNING_SECRET` are set in production, are ≥32 chars, are **not** the same value, and are not in the repository, the build log, or a `.env` that was committed.
- [ ] `ADMIN_IP_ALLOWLIST` is **not empty** in production. Empty means "the admin board is open to the internet".
- [ ] Security headers are present on a live response: CSP with a nonce, HSTS, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, and **no `X-Powered-By`**.
- [ ] The rate-limit driver is **shared**, not per-instance (`activeRateLimitDriver()` logged at boot and reviewed).
- [ ] Webhook endpoints verify their signature. Test one with a bad signature and confirm a 401.
- [ ] `/admin` requires both the IP allowlist and a valid session; a forged `eyg_session` cookie is rejected by the handler, not just the middleware.
- [ ] Login lockout verified by hand: 10 wrong passwords, then the 11th correct one is refused.

---

## H · The funnel, on staging, with real data

Five end-to-end bookings, by hand, on staging, before promoting:

- [ ] Booking 1 — a PMS, next available slot, **phone number**, name only. Confirmed. Reference checked against the SMS.
- [ ] Booking 2 — a tyre package with `tyreCount: 4`. Confirmed. Item snapshot correct.
- [ ] Booking 3 — with a promo code. Confirmed, and **the discount in the SMS matches the discount on the board**.
- [ ] Booking 4 — from `/deals` via the claim CTA, proving the promo survives the handoff into `/book`.
- [ ] Booking 5 — the **race**: two browsers, the last bay, submitted together. One confirms, one gets a clear "that slot just filled up" message.
- [ ] Each booking produced: a row in `Booking`, a `BookingEvent` history entry, a `Notification` ledger row, and an SMS the customer can read down the phone.
- [ ] Cancelling booking 1 releases its bay and the slot reappears on the board immediately.
- [ ] A roadside lead reaches the front desk with a readable name and a dialable number.

---

## I · Rollback

- [ ] **The rollback path is confirmed, not assumed.** Either:
  - [ ] the previous Vercel deployment can be promoted in < 5 minutes (record the deployment URL), or
  - [ ] a documented DB rollback exists (restore from the verified backup, or a `down` migration), **and it has been rehearsed on staging**.
- [ ] If a migration is not backward-compatible, the rollout plan is **expand → migrate → contract**, never a single breaking deploy. Flagged here so someone has to make the call in advance.
- [ ] The customer-facing **"site is down" card is printed and in the office.** Contents: the shop's real phone number, a QR code to the live `NEXT_PUBLIC_SITE_URL`, and the Facebook page. When the site is broken, the top of the funnel is a phone call, not a broken link.

---

## J · Sign-off

| Role | Name | Date | Confirms |
| --- | --- | --- | --- |
| Engineering | | | Sections A, B |
| Owner / shop | | | Section C, D |
| QA & Security | | | Sections E, F, G |
| Operations | | | Sections H, I |

**Do not release with an empty cell in this table.**
