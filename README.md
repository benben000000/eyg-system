# EYG Tire & Auto Care

**Brand guideline + production website for a tyre and auto-care shop at EGSA
Fourlanes, Tuyo, Balanga City, Bataan.**

Two deliverables in one repository:

1. **`docs/brand/BRAND-GUIDELINES.md`** — the brand system.
2. **The website** — a conversion machine for a shop whose customers are
   stranded, in a hurry, and price-conscious.

---

## Status

| Gate | Result |
| --- | --- |
| `next build` | ✅ passes — 15 pages, 44 API routes |
| `tsc --noEmit` | ✅ 0 errors (`strict` + `noUncheckedIndexedAccess`) |
| `eslint .` | ✅ 0 errors, 12 warnings (5 documented `<img>` in comparison widgets, 7 style) |
| `vitest run` | ✅ **562 passed**, 6 `.todo`, 0 failed |
| OWASP-lite scan | ✅ 0 errors, 6 warnings, 2 justified suppressions |
| Live smoke test | ✅ 12 pages render, 7 security headers, no secret leaks |
| First Load JS | 105 kB shared / 141 kB homepage (budget: 180 kB) |

---

## Quick start

```bash
npm ci
cp .env.example .env.local     # then fill in the secrets (see below)
docker compose up -d           # Postgres 16
npm run db:push                # or: npm run db:migrate && npm run db:seed
npm run dev                    # http://localhost:3000
```

`npm install` on npm ≥11 needs install scripts approved first:

```bash
npm install-scripts approve prisma argon2 sharp esbuild @prisma/client @prisma/engines
npm rebuild
```

---

## ⚠️ Before this goes live — the owner checklist

Every value below is tagged `[UNVERIFIED]` in `src/config/site.ts`. The site
degrades honestly (an unconfirmed phone renders a disabled CTA, an unconfirmed
rating renders no stars) — but it is not finished until these are real.

| # | What | Where | Why it blocks |
| --- | --- | --- | --- |
| 1 | **Payment methods** | `BUSINESS.paymentMethods` | Empty array; the "Pay with" block is hidden until filled |
| 2 | **Service prices** | `prisma/seed.ts`, `src/content/catalog.ts` | ~43 figures are research estimates, flagged in comments |
| 3 | **Bay count** | `BOOKING.capacityPerSlot` (currently `1`) | Parameterises the whole slot-race invariant |
| 4 | **Coordinates** | `BUSINESS.address.lat/lng` | Drives the map and the LocalBusiness schema |
| 5 | **Roadside / towing** | `BUSINESS.roadsideAssured: false` | The brief's primary funnel has **no evidence** behind it |
| 6 | **Warranty terms** | `trust.workmanshipGuaranteeDays: 0` | No number is printed until agreed |
| 7 | **Accreditation answer** | `docs/marketing/GBP-LISTING.md` Q19 | Only a true answer is legal |
| 8 | **Google Business Profile** | — | Not yet claimed. Highest-ROI local-SEO action available |
| 9 | **Michelin / BFGoodrich listing correction** | — | Both file EYG under *Batangas* ~130 km away and omit it from Bataan |
| 10 | **NPC registration number** | `/privacy` | Left blank rather than fabricated |

`scripts/predeploy-check.mjs` refuses to deploy while any of these remain.

---

## Brand

The logo is a yellow-on-black motorsport lockup. Brand yellow was **measured**,
not guessed: `#FCC605` is the modal colour of the official 720×720 profile mark
(2.7 % of pixels, range `#987603` → `#FFE141`). Ink is `#06060A`.

| | |
| --- | --- |
| Display | **Saira** 700/800/900 italic — matches the forward-leaning wordmark |
| Body | **Barlow** 400–700 |
| Primary | `#FCC605` on ink — **12.73:1** contrast, the identity case |
| Restriction | `#FCC605` on white is **1.59:1**. Text and focus rings on light surfaces use a darkened brand step (`--color-brand-ring`) |

All tokens live in `src/app/globals.css` under `@theme`. Never hardcode a hex.

Read **`docs/brand/BRAND-GUIDELINES.md`** — 12 sections covering logo anatomy and
clear space, colour with Pantone/CMYK and colour-blind simulation, the type
scale, photography standards, motion, signage and uniform specs, co-branding
rules, and a 59-item Do/Don't list.

Assets: `public/brand/` — traced SVGs (no embedded fonts, no rasters),
a 1200×630 OG card, and a 180×180 touch icon. The owner should still supply the
true vector original before anything is cut into vinyl or embroidered.

---

## Architecture

```
src/
  app/          15 routes + 44 API route handlers
  components/
    ui/         33 design-system primitives (the only place styling lives)
    layout/     Header, Footer, MobileActionBar, EmergencyBanner, hours
    home/       Homepage sections
    pages/      Per-page components
    widgets/    Booking wizard, estimator, reviews, lightbox, map, countdown
  lib/
    config/site.ts    ← business facts (orchestrator-owned)
    types.ts          ← API contract (orchestrator-owned)
    server/           Prisma singleton, auth, availability, booking, quote
    integrations/     Email, SMS, WhatsApp, webhooks, reviews, cron
    ratelimit.ts      Upstash → Postgres → in-memory, tiered
    captcha.ts        HMAC-signed arithmetic challenge
  middleware.ts       CSP nonce, security headers, CSRF, bot damping, admin guard
prisma/schema.prisma  25 models
```

### Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma +
PostgreSQL 16 · Zod · jose + argon2id · Upstash Redis · Resend/SMTP · Twilio

---

## Security

Implemented, not aspirational:

- **CSRF** — allowlist built only from `NEXT_PUBLIC_SITE_URL` and
  `CSRF_ALLOWED_ORIGINS`. **Never from the `Host` header**, which an attacker
  controls. Fails closed on an empty allowlist. `NEXT_PUBLIC_SITE_URL` is now
  required in production, because it is what the allowlist derives from.
- **Nonces + CSP** — `script-src 'self' 'nonce-…' 'strict-dynamic'`,
  `frame-ancestors 'none'`, `object-src 'none'`.
- **Rate limiting** — tiered (public / booking / quote / login / read), keyed on
  a verified IP plus a hashed form of the action. Fails **open** on reads and
  **closed** on writes.
- **Bot defence** — honeypot, a 2-second minimum submit time, an HMAC-signed
  single-use arithmetic captcha, and UA damping.
- **Booking race safety** — `SERIALIZABLE` transaction with a capacity re-check
  inside it; a conflict becomes a 409 with a refreshed slot list, never a
  double-booked bay.
- **PII** — AES-256-GCM at rest, masked in logs, never returned for another
  customer. `/admin` is auth-gated, IP-allowlisted and `Disallow:`ed.
- **No secret ever reaches a client bundle**, and the smoke test scans every
  rendered page for one.

### OWASP-lite scan

```
0 error(s), 6 warning(s), 2 suppressed   EXITCODE=0
```

Both suppressions are `dangerouslySetInnerHTML` and each carries a written
justification that must be re-verified after any edit: the JSON-LD component
(which escapes every `<` to `<`) and the theme bootstrap (a constant with no
interpolation, carrying the CSP nonce).

---

## Graceful degradation

Nothing third-party is required for the site to work. With **no** API key and
**no** database:

| Missing | Behaviour |
| --- | --- |
| Twilio / Resend | Notifications record `skipped`; the site is fully usable |
| Google / Facebook reviews | `[]` with `average: null`; the UI shows a designed empty state, never a fabricated rating |
| Upstash Redis | Postgres-backed counters, then in-memory |
| Database (availability) | Shop hours still served; the board closes with *"call the shop and we will fit you in"* — never a generic 500 |
| Database (bookings/closures) | The day closes rather than offering a bay that may be taken |

---

## Tests

```
Test Files  17 passed (17)
     Tests  562 passed | 6 todo (568)
```

Every finding the QA agent raised is either fixed or has a `.todo` naming the
exact export it waits on:

| Defect | Status |
| --- | --- |
| DEF-012 — CSRF allowlist derived from `Host` (**critical**) | fixed + regression test |
| SEC-02 — `SITE_URL` fallback in production | fixed: boot now fails |
| DEF-001 — holidays ignored → "Open now" on Christmas Eve | fixed |
| DEF-002 — midnight-crossing hours always "closed" | fixed |
| DEF-003 — `closed` flag ignored in the hours line | fixed |
| DEF-004 — PH phone formatted 4-3-4, not 3-3-4 | fixed |
| DEF-005 — `CALL_FOR_PRICE` quoted "₱0–₱0" | fixed (indicative band) |
| DEF-006 — % discount scaled only the floor | fixed (both bounds) |
| DEF-007 — `BUNDLE`/`CLEARANCE`/`SEASONAL` promos ignored | fixed |
| DEF-008 — `NaN` reaching the wire as `null` | fixed |
| DEF-009 — em dash made an SMS cost 3× | fixed + GSM-7 gate |
| DEF-010 — unfilled `{{placeholder}}` could be sent | fixed |
| DEF-011 — a 3-service booking threw, so **no SMS was sent** | fixed |
| DEF-013/014 — illegal route exports broke `next build` | fixed |
| DEF-015 — reference alphabet confusable when read aloud | fixed (20 glyphs) |
| A11Y-002 — focus ring at 1.59:1 on light | fixed |
| A11Y-003 — input borders at 1.28:1 | fixed |
| Conditional hook in `BeforeAfterSlider` | fixed |
| `children` prop on 3 React 19 components | fixed |
| Stale `services` dep in the booking confirmation | fixed |
| Stale-closure focus restore in `useFocusTrap` | fixed |
| Page titles double-suffixed | fixed (`{ absolute: … }`) |

Run: `npm test`. Playwright specs exist under `tests/e2e/` but were **not
executed** — no browser is available in this environment.

---

## Operations

`docs/ops/` — deployment (Vercel / Fly / Render / Docker), incident response,
backup & restore, security headers, observability, cost, and a hard
**launch checklist**.

CI: `validate-env → lint → typecheck → prisma-validate → security-audit →
test → build → docker-build → lighthouse`, then an auto-rollback-on-failed-smoke
deploy. CodeQL, dependency review, gitleaks and Dependabot on top.

Secrets: `openssl rand -base64 48` for `AUTH_SECRET`,
`openssl rand -hex 32` for `PII_ENCRYPTION_KEY`. Store the PII key in a physical
envelope with the registration papers — it is the only key that cannot be rotated
without re-encrypting customer data.

---

## Documentation map

| Path | What it is |
| --- | --- |
| `docs/AGENT-BRIEF.md` | The contract this build was executed against |
| `docs/brand/` | **Brand guidelines** — the client deliverable |
| `docs/research/` | Facebook intel, competitors, SEO keywords, RA 10173, DO/DON'T |
| `docs/funnel/` | CTA map, booking flow, microcopy deck, edge states, a11y spec |
| `docs/marketing/` | GBP listing, promo playbook, content calendar, Meta ads, macros |
| `docs/ops/` | Deploy, runbook, incidents, backups, observability |
| `docs/qa/` | Test strategy, release checklist, accessibility audit, perf budget |
| `content/` | Service catalogue, packages, FAQs as research-grounded drafts |

---

## Honest limitations

Stated plainly, because the brief demanded it:

1. **No database was reachable in the build environment.** Every Prisma
   interaction is verified by type, by unit test against fakes, and by the
   graceful-degradation paths observed live — but the `SERIALIZABLE` booking
   race and `prisma migrate deploy` have not been executed against real
   Postgres. Do that before launch.
2. **No Docker in this environment**, so `docker build` and the container smoke
   test never ran. The first CI run is the real test.
3. **No browser**, so the 6 Playwright specs are unexecuted.
4. **No Lighthouse run** — the budgets in `lighthouserc.json` are declared and
   enforced by CI, but the scores themselves were not measured here.
5. **34 peso figures** across the promotions and packages are research
   estimates. Every one carries a `SUGGESTED — REQUIRES OWNER CONFIRMATION`
   comment. A wrong published price is a Consumer Act exposure.
6. **Roadside assistance is unevidenced.** The site ships the honest version
   rather than promising a 24/7 service nobody confirmed.