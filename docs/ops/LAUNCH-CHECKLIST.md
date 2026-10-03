# LAUNCH CHECKLIST

**EYG Tire & Auto Care** · the ordered, tickable go-live gate

> **Nothing goes live until every box in sections 1–16 is ticked.**
>
> The order is not alphabetical and it is not arbitrary. DNS is before the
> phone number because a phone number with no site is a phone number. The
> restore drill is before the launch because a backup you have not restored is
> a hypothesis. The printed card is last because it is the thing that saves you
> when everything above has failed.
>
> **Owner:** `___________`  ·  **Target date:** `___________`
> **Two-person rule:** every box needs a name, not a tick. A tick with no name
> is an assumption.

---

## 0. The three that actually matter

If you do nothing else on this page, do these three.

| | Item | Why it is first |
| --- | --- | --- |
| ☐ | **§5 The real phone number is in `site.ts`** | A customer who taps a call button that rings nobody has already been lost. This is the single most expensive failure on the site. |
| ☐ | **§13 The restore drill passed** | The first time you discover your backups do not work is the day you lose every booking. |
| ☐ | **§16 The printed fallback card exists** | Five minutes of work that covers every possible failure of everything above. |

---

## 1. Secrets and environment

Nothing deploys until these exist. `src/lib/env.ts` refuses to boot without
them, which is correct.

- ☐ **`DATABASE_URL`** created and reachable
  - Pooled connection string (serverless opens a pool per invocation)
  - `?connection_limit=5&pool_timeout=10` appended
  - **Provider is Neon, not Supabase free** (it pauses after 1 week — see
    [COST-OPTIMISATION.md](COST-OPTIMISATION.md) §4.5)
  - _Owner:_ `______`

- ☐ **`AUTH_SECRET`** — `openssl rand -base64 48`
  - Stored in the `production` Vercel environment
  - Stored in the shop's password manager
  - _Owner:_ `______`

- ☐ **`PII_ENCRYPTION_KEY`** — `openssl rand -hex 32`
  - **In an envelope with the shop's registration papers.** See
    [DEPLOYMENT.md](DEPLOYMENT.md) §4.5. Losing this makes customer PII
    permanently unreadable.
  - _Owner:_ `______`

- ☐ **`WEBHOOK_SIGNING_SECRET`** — `openssl rand -base64 32`
  - _Owner:_ `______`

- ☐ **`BACKUP_PASSPHRASE`** generated and stored **physically**, offline
  - Separate from every other secret. Never with the backups.
  - See [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) §3
  - _Owner:_ `______`

- ☐ **Every secret set in the `production` environment**, not just Preview
  - _Owner:_ `______`

- ☐ **`node scripts/validate-env.mjs` passes**
  - Currently fails on three keys missing from `.env.example`. Fixed upstream,
    then the `--allow-undocumented` flag removed from `ci.yml`.
  - _Owner:_ `______`

## 2. GitHub setup

- ☐ **Branch protection on `main`**
  - Require a PR before merging
  - Require approvals: 1
  - **Require review from Code Owners**
  - Require conversation resolution
  - Require branches to be up to date
  - **Do not allow bypassing**
- ☐ **All eight required status checks selected**
  - `1 · validate-env` · `2 · lint` · `3 · typecheck` · `4 · prisma-validate`
  - `5 · security-audit` · `7 · build` · `8 · docker-build` · `9 · lighthouse`
  - `6 · test` **is not required yet** — flip `continue-on-error: false` once
    the QA suite lands
- ☐ **`CODEOWNERS` handles replaced** with real accounts
  - **Every line currently points at a `@acme/*` placeholder.** Leaving these
    makes every PR unmergeable
- ☐ **A `production` GitHub Environment exists** with required reviewers
- ☐ **Repository secrets set:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`, `DATABASE_URL`, `BACKUP_PASSPHRASE`
- ☐ **Repository variable set:** `PRODUCTION_SITE_URL`
- ☐ **Dependabot or Renovate enabled — not both** (see `renovate.json` header)
- ☐ **Dependency graph enabled** (Settings → Code security → Dependency graph)
  - `dependency-review.yml` is a no-op without it
- ☐ **Two-factor authentication on every account** with repo access
- ☐ **`node scripts/install-hooks.mjs` run by everyone who clones**
- ☐ _Owner:_ `______`

## 3. Domain, DNS and SSL

- ☐ **Domain registered** — `eygtireautocare.ph`
- ☐ **TTL set to 300 on every record**, 24 hours in advance
- ☐ **`@` record** → Vercel
- ☐ **`www` record** → Vercel
- ☐ **`staging` record** → Vercel
- ☐ **Waited 24 hours after the TTL change** before cutover
- ☐ **`https://eygtireautocare.ph` serves a valid certificate**
  - `curl -sI https://eygtireautocare.ph | head -1`
- ☐ **`http://` redirects to `https://`** (301/308, at the edge)
- ☐ **`www` and apex both work**, and one 308-redirects to the other
  - **Two URLs serving the same content splits local SEO**
- ☐ **HSTS present:** `curl -sI … | grep -i strict-transport`
- ☐ **HSTS preload submitted** at <https://hstspreload.org>
  - Only after `staging.` is properly HTTPS. **Effectively irreversible.**
- ☐ _Owner:_ `______`

## 4. The environment contract is honest

- ☐ **`.env.example` documents every key `src/lib/env.ts` requires**
  - The three currently missing: `RATE_LIMIT_READ_PER_MINUTE`, `ADMIN_EMAIL`,
    `ADMIN_PASSWORD`
- ☐ **Every `.env.example` key is actually read** by the app
- ☐ **No committed `.env` file** — `git ls-files | grep '\.env$'` is empty
- ☐ **No `.dump`, `.sql`, `.pem`, `.key` committed**
- ☐ **`gitleaks` is green** on the full history
- ☐ _Owner:_ `______`

## 5. 🔴 The real phone number

**The most important section on this page.** A customer who taps a call button
that rings nobody is a customer who has already been lost, and they will not try
again.

- ☐ **The owner has confirmed the number, in writing**
- ☐ **`BUSINESS.phoneE164`** — `+639171234567` (digits only, no spaces)
- ☐ **`BUSINESS.phoneDisplay`** — `+63 917 123 4567`
- ☐ **`BUSINESS.phoneLandline`** — set or explicitly `null`
- ☐ **`BUSINESS.whatsappNumber`** — `639171234567` (**no `+`**)
- ☐ **Every `TODO-VERIFY` flag next to the phone removed**
- ☐ **`LINKS.call` is derived from `phoneE164`**, not a duplicated literal
- ☐ **Searched the whole repo** for the placeholder:

  ```bash
  grep -rn '639000000000\|000-000-0000\|000 000 0000' src/ content/
  ```

- ☐ **`node scripts/predeploy-check.mjs` passes with no
  `--allow-placeholders`**
- ☐ **`node scripts/generate-og.mjs` re-run**
- ☐ **Live site verified:**

  ```bash
  curl -s https://eygtireautocare.ph | grep -o 'tel:[^"]*'
  curl -s https://eygtireautocare.ph/contact | grep -o 'tel:[^"]*'
  curl -s https://eygtireautocare.ph | grep -o 'wa\.me/[0-9]*'
  ```

- ☐ **📱 Tapped the link on a real phone and it rang the shop**
  - A number that renders correctly and rings a dead SIM is worse than one that
    renders wrong, because nobody thinks to check
- ☐ **The WhatsApp link opens the right chat**
- ☐ **The number is within one thumb-reach on a 375 px viewport**, on every page
- ☐ _Owner:_ `______`

## 6. 🔴 Real hours

- ☐ **The owner has confirmed the real opening hours**
- ☐ **`BUSINESS_HOURS` matches**, day by day
  - Currently Mon–Sat 08:00–17:00, Sunday closed — **all unconfirmed**
- ☐ **Open/closed state is correct right now** — check `/contact`
- ☐ **Philippine public holidays added to the `Holiday` table**
  - Ninoy Aquino, Rizal, Bonifacio, National Heroes, Christmas, Good Friday,
    All Saints, All Souls, Rizal
  - **Add them all at once, in January.** Close dates at least a week ahead —
    customers book in advance
- ☐ **A `BayClosure` mechanism exists** for one-off closures
- ☐ _Owner:_ `______`

## 7. 🔴 Real prices, confirmed with the owner

Every price is a promise. An invented number that turns out to be wrong costs a
customer who drove 1.5 hours to Balanga.

- ☐ **The owner has confirmed every `priceMin` and `priceMax`**
- ☐ **Every price has a `priceNote`** — `per axle`, `per set`, `incl. labour`
  - **The most common cause of an argument at the counter is an ambiguous price**
- ☐ **Variable work uses `RANGE`; firm work uses `FIXED`**
  - A range on firm work reads as "we are not sure what it costs", which loses
    the customer
- ☐ **Unknown prices use `CALL_FOR_PRICE`**, not a guess
  - Honest, and it converts
- ☐ **Discounts leave a margin.** `priceMin - valueOff` > cost
- ☐ **`/services` shows the right numbers** — `curl -s …/services | grep '2,499'`
- ☐ **A real quote was requested at the new price** and the number was right
- ☐ _Owner:_ `______`

## 8. 🔴 Unverified claims removed

The orchestrator brief: _do not ship a claim the owner has not signed off on._

- ☐ **`trust.ratingValue`** — currently **4.9, unverified**
  - If the owner has not confirmed a rating, set it to `0` and render no stars
- ☐ **`trust.ratingCount`**, `yearsServing`, `bays`, `technicians`
  - `0` correctly means "no claim made". Confirm that is the intent
- ☐ **`foundedYear: 2024`** vs. the brief's "opened 2025"
  - **These conflict.** Confirm which is right
- ☐ **`workmanshipGuaranteeDays: 30`** — is there a written warranty?
- ☐ **`tireBrands`** — Michelin, Bridgestone, Goodyear, Dunlop, Maxxis, Yokohama
  - **Only list brands actually sold.** An unauthorised-dealer badge is both a
    legal problem and a lie
- ☐ **`SITE.twitter`** — is there a Twitter/X account?
- ☐ **`social.messenger`** — is `EYGTireAutoCare` the right username?
- ☐ **`email` / `emailSupport`** — do these addresses exist?
- ☐ **Coordinates (`lat`/`lng`)** — do they point at the shop?
- ☐ **`capacityPerSlot: 3`** — how many bays are actually usable?
- ☐ **`grep -rn 'TODO-VERIFY' src/` returns nothing**
- ☐ _Owner:_ `______`

## 9. Real photos, with consent

- ☐ **Every photo is real work done by this shop**
  - The brief forbids stock photos presented as their own work
- ☐ **Every customer in a photo has given written consent**
  - Written, specific, and revocable. A Facebook post is not consent.
- ☐ **Faces of people who have not consented are blurred, or the photo is not used**
- ☐ **`alt` text on every image** — meaningful, or `alt=""` if decorative
- ☐ **`width`/`height` on every image** — CLS, and optimiser cost
- ☐ **Every image optimised** — AVIF/WebP via `next/image`
- ☐ **`public/og/*.png` regenerated** — `node scripts/generate-og.mjs`
- ☐ **All four cards exist:** `default.png`, `services.png`, `book.png`, `deals.png`
- ☐ **`/og/default.png` returns 200**
  - A 404 means every shared Facebook link renders as a bare URL
- ☐ _Owner:_ `______`

## 10. Google Business Profile

For a local tyre shop this is worth more than the website. It is free.

- ☐ **Profile claimed and verified** (postcard or video)
- ☐ **Name, address and phone match `site.ts` exactly**
  - **NAP mismatch is the most common cause of local SEO damage**
- ☐ **Address:** EGSA Fourlanes, Tuyo, Balanga City, Bataan 2100
- ☐ **Hours match `BUSINESS_HOURS`** and the holiday table
- ☐ **Category:** Tyre shop + Auto care centre
- ☐ **10+ real photos**, including the bay, the team and real work
- ☐ **Opening hours, services listed, and the phone number**
- ☐ **`GOOGLE_PLACE_ID` set** so `/api/reviews` can pull reviews
- ☐ **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set** and **restricted to this domain**
  - An unrestricted key is a bill someone else pays
- ☐ **The map on `/contact` points at the shop, not at Balanga City generally**
- ☐ _Owner:_ `______`

## 11. SEO

- ☐ **`robots.txt` is correct**

  ```bash
  curl -s https://eygtireautocare.ph/robots.txt
  ```

  - `/admin`, `/api/` disallowed
  - `Sitemap: https://eygtireautocare.ph/sitemap.xml` present
  - **Not** `Disallow: /` — that removes the shop from Google entirely
- ☐ **`sitemap.xml` returns 200 and lists the real pages**

  ```bash
  curl -s https://eygtireautocare.ph/sitemap.xml | grep -c '<url>'
  ```

- ☐ **`sitemap.xml` submitted** to Google Search Console
- ☐ **Google Search Console verified** — and the domain property, not only the
  URL-prefix property
- ☐ **Canonical tag on every page** points at the production origin

  ```bash
  curl -s https://eygtireautocare.ph | grep -o '<link rel="canonical"[^>]*>'
  ```

- ☐ **`NEXT_PUBLIC_SITE_URL` is `https://eygtireautocare.ph`** — no trailing
  slash, no localhost, no staging
- ☐ **Title and meta description on every page**, unique
- ☐ **OG tags render** — paste the URL into the Facebook "Share" debugger
- ☐ **No `noindex` anywhere** on a public page
- ☐ **Old URLs 301 correctly** (`/home`, `/services-and-pricing`,
  `/book-appointment`, `/contact-and-location`, `/promotions`)
- ☐ _Owner:_ `______`

## 12. Analytics and privacy

- ☐ **Analytics installed** — GA4, or preferably Plausible (no cookie, no
  banner)
- ☐ **Consent respected.** If there is a cookie, there is a banner.
  - RA 10173 makes this a legal obligation, not a formality
- ☐ **`/privacy` discloses:**
  - [ ] What is collected (name, phone, email, vehicle)
  - [ ] Why (to take a booking and contact you about it)
  - [ ] **Every third party that receives it** — analytics, SMS, email
  - [ ] How long it is kept
  - [ ] How to ask for it to be deleted — `service@…`
  - [ ] Contact for privacy questions
- ☐ **`/privacy` reflects reality** — if Google Analytics is not installed, it
  does not claim to be
- ☐ **`NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` set**
- ☐ **Analytics confirmed working** — a page view appears in the real-time view
- ☐ _Owner:_ `______`

## 13. 🔴 Backups running and restore tested

**A backup you have never restored is a hypothesis.** This section is not
complete until the drill has actually been run.

- ☐ **Backup cron installed and running**
  - Off-the-hour (`02:17`), `TZ=Asia/Manila`
  - See [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) §4.2
- ☐ **Backups landing in the configured directory**

  ```bash
  node scripts/db-backup.mjs --list
  ```

- ☐ **Backups are encrypted** — `.dump.enc` with an AES-256-GCM header
- ☐ **Every dump passes its checksum**

  ```bash
  node scripts/db-backup.mjs --verify
  ```

- ☐ **Off-site copy exists and is verified** — not just local
- ☐ **The passphrase is in a physical envelope** with the registration papers
- ☐ **🔴 THE RESTORE DRILL WAS RUN AND PASSED**

  ```bash
  node scripts/db-restore.mjs --latest \
    --target=postgresql://…@localhost:5432/eyg_restore_drill --cleanup
  ```

  - Bookings count plausible · tables ≥ 10 · newest booking date correct
  - **Result recorded:**
    `Drill ____-__-__ — PASS — N bookings, N tables, Ns`
- ☐ **The drill result is written down** — a dated log is evidence; "we have
  backups" is a claim
- ☐ **A backup-staleness alert exists** or a weekly manual check is scheduled
- ☐ _Owner:_ `______`

## 14. Rate limits tuned

- ☐ **`RATE_LIMIT_BOOKING_PER_HOUR` allows real behaviour**
  - The default is **8/hour**. The shop's office is likely one IP.
  - **Check before launch** — this can be a ceiling on the business, not on spam
- ☐ **Keyed on phone number as well as IP**, for the booking and quote endpoints
- ☐ **`ADMIN_IP_ALLOWLIST` is set**
  - **Empty means `/admin` is open to the world**, holding every customer's
    name, phone number and vehicle
  - The deploy workflow refuses to run with it unset — verify it was not simply
    skipped
- ☐ **The shop's own IP is in the allowlist** — otherwise staff cannot reach
  `/admin`
- ☐ **`CAPTCHA_ENABLED=true`** in production
- ☐ **Rate limits do not trip on a normal browsing session** — walk every page
- ☐ **A bot filling every slot is blocked** — submit the booking form 15 times
- ☐ _Owner:_ `______`

## 15. Observability

- ☐ **Uptime monitoring on `/api/health`**, from **two regions**, one outside
  the Philippines
  - **A Philippine-only probe reports "up" while Globe or Smart cannot resolve
    the domain for everyone in Balanga.** That is a SEV1 no server-side
    monitoring will see
- ☐ **1-minute interval, alert after 2 consecutive failures**
  - A single failure is a blip. Without `alert_after`, people learn to ignore it.
- ☐ **The assertion checks the body**, not just the status code
  - A Next error page returns **200 with HTML**
- ☐ **Sentry installed** with `sendDefaultPII: false`
- ☐ **🔴 PII scrubbing verified**
  - Trigger a test error with a customer's phone number in it
  - **Search the Sentry issue for `+63`. If it appears, scrubbing is not
    working and the site is not ready for real customer data.**
- ☐ **404 noise ignored** in Sentry — or the free tier burns in a day
- ☐ **Session replay OFF** — it would record customers typing their phone
  numbers
- ☐ **SMS delivery failure alerts** on `Notification.status = 'failed'`
  - A booking that succeeds and is never confirmed is worse than one that fails:
    the customer assumes they are not booked, and does not come
- ☐ **Night-shift suppression** with `timezone: Asia/Manila`
  - Not page someone at 03:00 for a threshold that is normal at 03:00
- ☐ **Logs shipped off-platform** — Vercel Hobby keeps one hour
- ☐ _Owner:_ `______`

## 16. 🔴 The printed fallback card

**The last line of defence, and the cheapest insurance on this page.**

If the site is down, the customer in the shop needs a phone number on paper.
Five minutes of work.

- ☐ **Printed**, A5 or business-card size, laminated if possible
- ☐ **The real phone number**, in large type — the one confirmed in §5
- ☐ **The address**, written out
- ☐ **Opening hours**
- ☐ **The Facebook page**
- ☐ **"Online booking is temporarily unavailable — please call or message us
  and we'll sort you out."**
- ☐ **By the till, at the front desk, and in the bay**
- ☐ **The owner has one in their pocket**
  - The owner is on a motorcycle on EGSA Fourlanes more than they are at the desk
- ☐ **The whole team knows they can take a booking by hand**
  - [RUNBOOK.md](RUNBOOK.md) §5.5 and
    [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) §SEV2 have the procedure
- ☐ _Owner:_ `______`

**Template:**

```
┌──────────────────────────────────────────┐
│  EYG TIRE & AUTO CARE                     │
│                                          │
│  📞  +63 917 123 4567                    │
│                                          │
│  EGSA Fourlanes, Tuyo                     │
│  Balanga City, Bataan 2100                │
│                                          │
│  Mon–Sat  8:00 AM – 5:00 PM              │
│  Sunday   Closed                         │
│                                          │
│  PMS · Wheel Alignment · Brakes           │
│  Tyres · Undercoating · Car A/C          │
│                                          │
│  fb.com/EYGTireAutoCare                  │
│                                          │
│  Online booking temporarily unavailable?  │
│  Call or message us — we'll sort you out.│
└──────────────────────────────────────────┘
```

---

## 17. 🔴 Five test bookings, made and cancelled

**Done on a real phone, on mobile data, not office wifi.** Five, not one — the
first booking works and the fourth reveals the rate limit.

- ☐ **Booking 1 — a weekday daytime slot.** Confirm the SMS arrives within a
  minute. Check every field.
- ☐ **Booking 2 — a different service, a different vehicle.** Confirm the price
  range is right.
- ☐ **Booking 3 — the same slot as booking 1** to prove capacity works
- ☐ **Booking 4 — the fifth in quick succession**, to find the rate limit before
  a customer does
  - If booking 5 is blocked, tune the limit — see §14
- ☐ **Booking 5 — an invalid phone number and a past date.** Confirm a **clear
  error message**, not a silent failure
- ☐ **All five cancelled** in `/admin`, with a `cancelReason`
- ☐ **Test data deleted** so the shop does not open to fake bookings

### What each booking proves

| Booking | Proves |
| --- | --- |
| 1 | The happy path end to end, including SMS |
| 2 | Multi-service pricing and a second vehicle |
| 3 | Capacity is respected — two bookings cannot take one bay |
| 4 | The rate limit does not block real customers |
| 5 | Validation fails **loudly**, which the brief requires |

- ☐ _Owner:_ `______`

## 18. Accessibility and performance

- ☐ **Lighthouse CI green** on `/`, `/services`, `/book`
  - LCP < 2.5 s · CLS < 0.1 · INP < 200 ms
  - Accessibility ≥ 95 · SEO ≥ 95 · Best practices ≥ 90
- ☐ **Walked on a real phone**, on mobile data
  - The brief's standard: a ₱3,000 Android over 3G
- ☐ **Keyboard-only pass** on `/book` — tab through every step
- ☐ **Screen-reader pass** — VoiceOver or TalkBack, at least on `/book`
- ☐ **`prefers-reduced-motion: reduce`** respected
- ☐ **Contrast ≥ 4.5:1** on every text/background pair
- ☐ **Works with JavaScript disabled** above the fold — at minimum the phone
  number and the address must be visible
- ☐ **No colour-only signals** — every state has an icon or text
- ☐ _Owner:_ `______`

## 19. Security headers

- ☐ **Every header present** — see [SECURITY-HEADERS.md](SECURITY-HEADERS.md) §1

  ```bash
  curl -sI https://eygtireautocare.ph
  ```

- ☐ **CSP present with a nonce that rotates per response**

  ```bash
  for i in 1 2; do
    curl -sI https://eygtireautocare.ph | grep -o "nonce-[a-zA-Z0-9+/=]*" | head -1
  done
  # Two DIFFERENT values.
  ```

- ☐ **Zero CSP violations in the browser console** on every page
- ☐ **CSP violation reporting configured** (`report-uri` / `report-to`)
- ☐ **`form-action 'self'`** in the CSP — protects the booking form from a
  compromised script redirecting it
- ☐ **`X-Powered-By` absent**
- ☐ **No `Access-Control-Allow-Origin: *`** anywhere
- ☐ _Owner:_ `______`

## 20. The deploy pipeline

- ☐ **CI green on `main`** — all eight required checks
- ☐ **`.github/workflows/deploy-production.yml` has run once successfully**
- ☐ **`Vercel` production alias points at `eygtireautocare.ph`**
- ☐ **`node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph` passes**
- ☐ **A rollback has been tested** — not just read about

  ```bash
  npx vercel rollback --yes && node scripts/smoke-test.mjs --base-url=…
  ```

  **An untested rollback is a hope, not a plan.**
- ☐ **CI block on `main`** — someone proved they cannot push straight to
  production
- ☐ _Owner:_ `______`

## 21. 🔴 The `TODO-VERIFY` list is empty

```bash
grep -rn 'TODO-VERIFY' src/ --include='*.ts' --include='*.tsx'
node scripts/predeploy-check.mjs          # no --allow-placeholders
```

**Both must be empty.** The full list, verbatim, is in §22.

- ☐ **Every item resolved with the owner**, and the flag deleted from
  `src/config/site.ts`
- ☐ _Owner:_ `______`

## 22. The owner is trained

They will be alone in the shop. Assume they have 90 seconds and a customer
waiting.

- ☐ **They can take a booking by hand** in `/admin`
  - [RUNBOOK.md](RUNBOOK.md) §5.5
- ☐ **They know the fallback card exists** and where it is
- ☐ **They know what to do if the booking form is down**
  - [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) §SEV2 — the exact scenario
- ☐ **They can add a promotion** — [RUNBOOK.md](RUNBOOK.md) §2
- ☐ **They can close the shop for a holiday** — §3
- ☐ **They can export bookings** — §6
- ☐ **They have the credentials**: `/admin`, the Facebook page, the Google
  Business Profile, the domain registrar, the hosting dashboard, the database
  console
- ☐ **They know who to call** and when it is not an emergency
- ☐ **They have been shown the smoke test** and can run it
- ☐ _Owner:_ `______`

---

## 23. Final sign-off

Every box above is either ticked or explicitly waived **in writing**, with a
name and a reason. An unticked box with no note is a failure.

```bash
node scripts/validate-env.mjs
node scripts/predeploy-check.mjs
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=3
node scripts/db-backup.mjs --verify
grep -rn 'TODO-VERIFY\|639000000000' src/   # must be empty
```

| | |
| --- | --- |
| **Sections 1–22 complete** | ☐ |
| **Outstanding waivers** | `_________________________________` |
| **Ready to go live** | ☐ |
| **Owner** | `_______________`  **Date:** `___________` |
| **Engineer** | `_______________`  **Date:** `___________` |

---

## 24. The launch sequence

In this order. Not on a Friday afternoon.

**T−1 day**

- [ ] All boxes ticked, waivers written down
- [ ] Announce to the team: "tomorrow, 9am, we go live"
- [ ] The Facebook page has a post drafted but not scheduled

**T−30 min**

- [ ] `node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=3`
- [ ] Uptime monitor reporting **green**
- [ ] The fallback card is **at the counter**, not in a drawer
- [ ] The owner has their phone charged

**T+0 — go live**

- [ ] The merge to `main`
- [ ] Watch the deploy workflow
- [ ] Watch the first 10 real requests in the logs

**T+1 hour**

- [ ] Smoke test again
- [ ] Confirm the first real booking arrives, by SMS
- [ ] Post on Facebook:
  > New website is live! Same shop, same phone number, and you can book a bay
  > online now. Message or call us if anything looks off 🙏
- [ ] **Add the site link to the Google Business Profile**
- [ ] **Ask the first five customers how they found us.** Write the answers
  down — this is the only launch metric that matters

**T+1 day**

- [ ] `node scripts/db-backup.mjs --list` — confirm the first production backup
- [ ] Sentry: zero errors
- [ ] **Tell the team what to watch**

**T+1 week**

- [ ] Read every review and reply
- [ ] Compare bookings to the same week before. **If bookings have not moved,
  the website is not doing its job** and the cheapest fix is usually
  [COST-OPTIMISATION.md](COST-OPTIMISATION.md) §8 — Business Profile and photos,
  not infrastructure.

---

## Related

| Document | Read it when |
| --- | --- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Any step here needs detail |
| [RUNBOOK.md](RUNBOOK.md) | Training the owner |
| [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | The launch goes wrong |
| [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) | §13 |
| [SECURITY-HEADERS.md](SECURITY-HEADERS.md) | §19 |
| [OBSERVABILITY.md](OBSERVABILITY.md) | §15 |
| [COST-OPTIMISATION.md](COST-OPTIMISATION.md) | The hosting bill |
