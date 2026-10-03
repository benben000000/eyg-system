# EYG TIRE & AUTO CARE — ORCHESTRATOR BRIEF

### The single source of truth. Every agent reads this first. Nobody deviates

---

## 0. The mission

Build **two deliverables for one client**:

1. **A brand guideline** (`docs/brand/BRAND-GUIDELINES.md`) — a real, usable brand
   system for EYG Tire & Auto Care so the shop looks like one business across
   Facebook, signage, uniforms, invoices and the website.
2. **A production website** (`/`) — a conversion machine for a Philippine tyre
   and auto-care shop.

Everything else in this repo serves those two things.

---

## 1. The client (hard facts — already researched)

| Field | Value |
| --- | --- |
| Name | **EYG Tire & Auto Care** |
| Handle | `EYGTireAutoCare` |
| Category | Tyre shop + auto care centre (PMS, alignment, brakes, undercoating, A/C) |
| Address | **EGSA Fourlanes, Tuyo, Balanga City, Bataan 2100** |
| Region | Region III, Central Luzon — ~1.5 h from Manila, strong commuter + provincial traffic |
| Facebook | `facebook.com/people/EYG-Tire-Auto-Care/61582418828014` |
| Followers | 308 (small shop, high trust per person — lean into *named people*, not corporate scale) |
| Opened | 2025 (announced "officially open our doors" March 2025, Fourlanes / Earthfield Bataan Centre) |
| Top-of-funnel reality | A phone call during working hours. Most customers are **stranded, in a hurry, price-conscious, on mobile, in traffic near EGSA** |

Anything marked `TODO-VERIFY` in `src/config/site.ts` (phone, email, hours,
coordinates, partner brands, warranty days) is **unconfirmed**. Do not invent
values. Do not ship a claim the owner has not signed off on.

---

## 2. The brand (already extracted — do not re-guess)

Logo is a **yellow-and-black motorsport lockup**: heavy forward-italic
`EYG TIRE`, a yellow `& AUTO CARE` subline, a 5-spoke wheel with a
checkered-flag interior, and an angled speed-stripe underline.

**Brand yellow is `#FCC605`** — measured, not guessed (modal colour of the
official 720×720 profile mark, 2.7 % of pixels, range `#987603`→`#FFE141`).
Ink is `#06060A`. White `#FFFFFF`.

**Type**: `Saira` (800/900, italic) for display — matches the forward-leaning
italic wordmark. `Barlow` for body/UI. Both self-hosted via `next/font`.

All tokens already live in `src/app/globals.css` under `@theme`.
**Never hardcode a hex in a component.** Use `bg-brand-500`, `text-ink-950`,
`text-muted-foreground`, etc.

### The three brand devices

1. **Speed stripe** — the angled yellow bar (`.eyg-stripe`). Underlines H1s.
2. **Hazard hatch** — 45° yellow/black diagonal (`.eyg-hazard`). Only for urgency:
   clearance, "closing soon", roadside.
3. **Checker micro-pattern** (`.eyg-checker`) — section dividers, tire-tread motifs.

---

## 3. Page map (locked — do not rename)

| Route | Purpose | Primary conversion |
| --- | --- | --- |
| `/` | Convert now. Emergency → services → proof → book → location | **Book a bay** |
| `/services` | Full catalogue, package bundles, honest price ranges | **Select service & pick date** |
| `/book` | 4-step scheduler: vehicle → services → slot → contact | **Confirm booking** |
| `/deals` | Seasonal promos, tyre clearance, bundles | **Claim offer** |
| `/contact` | Map, landmark, live open/closed, payment methods | **Call / directions** |
| `/gallery` | Before/after, bay, diagnostics | **Book** |
| `/about` | Who they are, the bay, the guarantees | **Book** |
| `/admin` | Staff: bookings board | — |
| `/privacy`, `/terms` | Legal | — |
| 404 / 500 / 403 / 429 / maintenance | Error states | **Call** |

Old/alternate paths 301 to these (already configured in `next.config.ts`).

---

## 4. The conversion ladder (every page must serve it)

```
LANE A  EMERGENCY (bypasses everything)
  stranded → tap-to-call / WhatsApp  →  human answers  →  done
LANE B  PLANNED
  needs PMS / tyres → instant quote → pick slot → book → SMS confirm
LANE C  RE-ENGAGEMENT
  came for a promo → claim → routed to /book with promo pre-applied
```

**Hard rule: a phone number must be reachable within one thumb-reach on every
viewport, always.** On mobile that is a persistent bottom bar.

---

## 5. Non-negotiables (the "don'ts")

### Never

- ❌ Invent facts: phone numbers, prices, hours, brand partnerships, ratings,
  years in business, "certified", "licensed", "authorised dealer".
- ❌ Fake reviews, invented customer names, stock photos presented as their work.
- ❌ Placeholder text shipped: no "Lorem", no `TODO`, no `example.com`,
  no `000-000-0000`, no dead `#` links, no `href="#"`.
- ❌ A form that fails silently. Every submit has pending / success / error states.
- ❌ Blocking the page with a modal, cookie wall or interstitials.
- ❌ Layout shift, CLS. Always set width/height on images.
- ❌ `any`, `@ts-ignore`, or `eslint-disable` to silence a real problem.
- ❌ Colour as the only signal — pair every colour state with an icon or text.
- ❌ Unhandled promise rejections, un-captured analytics, console noise in prod.
- ❌ Secrets in client bundles. Anything `NEXT_PUBLIC_*` is public forever.
- ❌ Trust badges for brands the shop is not actually authorised to sell.

### Always

- ✅ Mobile-first, thumb-reachable, works on a ₱3,000 Android over 3G.
- ✅ WCAG 2.2 AA: contrast ≥ 4.5:1, focus rings, landmarks, `aria-*`, alt text.
- ✅ `prefers-reduced-motion` respected everywhere.
- ✅ Semantic HTML, one `<h1>` per page, real `<button>`/`<a>` elements.
- ✅ Real empty states, real loading skeletons, real error states.
- ✅ Types end-to-end. `strict`, `noUncheckedIndexedAccess` are on.
- ✅ Server Components by default; `"use client"` only where interaction demands.
- ✅ Copy in plain, respectful Taglish-friendly English. Short sentences.
  Filipino automotive vocabulary where locals use it: *PMS, PMS A/B, wheel
  alignment, tire rotation, vulcanizing, undercoating, change oil, brake pad,
  shock absorbers, CVL/bushings, car aircon, roadside, breakdown, ayusin/check,
  CVO (deferred down payment)*.
- ✅ Every image has meaningful `alt` or `alt=""` if decorative.

---

## 6. Orchestrator-owned files — **NEVER EDIT THESE**

If you need a change, do not make it. Put the request in your final report
and the orchestrator will apply it.

| File | Owner |
| --- | --- |
| `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` | orchestrator |
| `src/app/globals.css` (design tokens) | orchestrator |
| `src/config/site.ts` (business facts) | orchestrator |
| `src/lib/types.ts` (API contract) | orchestrator |
| `prisma/schema.prisma` (data model) | orchestrator |
| `.env.example` | orchestrator |

You **may** freely add new files inside your assigned directories.
You **may** edit files created by other agents **only** if your brief says so.

---

## 7. Directory ownership map

| Agent | Owns (exclusive) |
| --- | --- |
| **research** | `docs/research/`, `content/` |
| **brand** | `docs/brand/`, `public/brand/`, `src/app/icon.svg`, `src/app/apple-icon.png` |
| **funnel** | `docs/funnel/` |
| **marketing** | `docs/marketing/`, `src/content/marketing/` |
| **backend-core** | `src/lib/server/`, `src/lib/env.ts`, `src/middleware.ts`, `prisma/seed.ts`, `src/app/api/{availability,booking,quote,captcha,admin}/**` |
| **backend-integrations** | `src/lib/integrations/`, `src/app/api/{reviews,leads,promos,webhooks,cron,health}/**`, `src/lib/reviews/` |
| **frontend-core** | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/{error,not-found,global-error,loading}.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/components/{ui,layout,home,error}/**`, `src/lib/utils.ts`, `src/lib/seo.ts` |
| **frontend-pages** | `src/app/{services,book,deals,contact,gallery,about}/**`, `src/app/{privacy,terms}/**` |
| **widgets** | `src/components/widgets/**` |
| **devops** | `.github/**`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `vercel.json`, `scripts/**`, `docs/ops/**`, `.gitignore`, `renovate.json` |
| **qa** | `tests/**`, `vitest.config.ts`, `docs/qa/**`, `playwright.config.ts` |

If a file you need does not exist yet, **create it inside your own directory**
and import from there. Never block waiting for another agent.

---

## 8. Report format

Every agent ends with a report containing:

1. **Shipped** — files created, one line each.
2. **Contracts used** — the exact imports you relied on.
3. **Requests for the orchestrator** — anything you could not do without editing
   an orchestrator-owned file, or any `TODO-VERIFY` item you needed.
4. **Risks / what to check by hand** — at most 5 bullets.
