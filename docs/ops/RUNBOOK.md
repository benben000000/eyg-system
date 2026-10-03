# RUNBOOK

**EYG Tire & Auto Care** · day-to-day operations

Procedures for the things that actually come up. Each one is written as a
sequence you can follow without thinking, because you will be doing it on a
phone, in a shop, with a customer waiting.

> Something is broken right now? → [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)

---

## Contents

1. [How to change the phone number](#1-how-to-change-the-phone-number)
2. [How to add a promotion](#2-how-to-add-a-promotion)
3. [How to close the shop for a holiday](#3-how-to-close-the-shop-for-a-holiday)
4. [How to add a service](#4-how-to-add-a-service)
5. [How to block a time slot](#5-how-to-block-a-time-slot)
6. [How to export bookings](#6-how-to-export-bookings)
7. [How to respond to a bad review](#7-how-to-respond-to-a-bad-review)
8. [Daily and weekly checks](#8-daily-and-weekly-checks)
9. [Running the cron jobs manually](#9-running-the-cron-jobs-manually)
10. [Adjusting rate limits](#10-adjusting-rate-limits)
11. [Changing prices](#11-changing-prices)

---

## 1. How to change the phone number

The single most consequential edit in this repository. A customer who taps a
call button that rings nobody is a customer who is now standing on EGSA
Fourlanes with a flat tyre.

### 1.1 Every place the number lives

`src/config/site.ts` is the single source of truth — but only if nothing else
duplicates it. **Check the full list every time**, because a hardcoded copy in a
component is the failure mode this procedure exists to prevent.

| # | Location | What to change |
| --- | --- | --- |
| 1 | `src/config/site.ts` → `BUSINESS.phoneE164` | `+639171234567` format, digits only, no spaces. Used for `tel:` links. |
| 2 | `src/config/site.ts` → `BUSINESS.phoneDisplay` | Human-readable: `+63 917 123 4567`. |
| 3 | `src/config/site.ts` → `BUSINESS.phoneLandline` | `null`, or the landline in E.164. |
| 4 | `src/config/site.ts` → `BUSINESS.whatsappNumber` | `639171234567` — **no `+`**, no spaces. `wa.me` needs this exact shape. |
| 5 | Derived | `LINKS.call` and `LINKS.whatsapp` are computed from the fields above. **Do not edit them.** If `LINKS.call` is a literal string, something has bypassed the source of truth — fix that first. |
| 6 | `src/content/marketing/*.ts` | Any copy that types the number inline instead of importing `BUSINESS`. |
| 7 | `/privacy` and `/terms` | Contact details, if stated. |
| 8 | Google Business Profile | **A separate system.** A mismatch here breaks local SEO and gets the shop penalised. |
| 9 | Facebook page | About section, cover image, pinned post. |
| 10 | `docs/ops/LAUNCH-CHECKLIST.md` | The printed fallback card. |
| 11 | `public/og/*.png` | **Only if a card embeds the number.** `node scripts/generate-og.mjs` after. |
| 12 | `vercel.json` / `fly.toml` / `render.yaml` | `TWILIO_FROM_NUMBER` — the SMS sender, not the public number. Different thing. |
| 13 | Any signage | Physical. Not a code change, and the thing customers see most. |

### 1.2 The procedure

```bash
# 1. Edit src/config/site.ts (orchestrator-owned — go through the right person)

# 2. Remove the TODO-VERIFY flag if it has one. The deploy gate blocks a
#    production deploy while a placeholder remains.
node scripts/predeploy-check.mjs

# 3. Regenerate the social cards
node scripts/generate-og.mjs

# 4. Prove nothing broke
npm run typecheck && npm run lint && npm run build

# 5. Smoke test, including the phone assertion
node scripts/smoke-test.mjs --retries=3
# The check is: "missing a tel: call link" and
#               "still serving the placeholder phone +639000000000"

# 6. PR → CI → deploy → live smoke test
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=3

# 7. Update the Google Business Profile, Facebook, signage, printed card.
```

### 1.3 Verify it worked

```bash
curl -s https://eygtireautocare.ph | grep -o 'tel:[^"]*'
# must be tel:+639171234567

curl -s https://eygtireautocare.ph/contact | grep -o 'tel:[^"]*'

curl -s https://eygtireautocare.ph | grep -o 'wa\.me/[0-9]*'
# must be wa.me/639171234567  (no plus sign)
```

Then **actually tap the link on a real phone.** A number that renders correctly
and rings a disconnected SIM is worse than one that renders wrong, because
nobody suspects to check.

### 1.4 If the WhatsApp link is broken but the call link works

`whatsappNumber` is missing the country code or has a `+`. It must be
`639171234567`: country code `63`, then the mobile number, digits only, no `+`,
no spaces, no dashes.

---

## 2. How to add a promotion

### 2.1 The data model

A promotion lives in the `Promotion` table (`prisma/schema.prisma`). It is data,
not code — which means it can be added without a deploy, and it should be.

### 2.2 Through Prisma Studio

```bash
npm run db:studio
```

Create a `Promotion`:

| Field | Value | Notes |
| --- | --- | --- |
| `slug` | `summer-pms-2026` | URL-safe, unique, lowercase-hyphenated. |
| `title` | `Summer PMS Package` | What the customer sees first. |
| `subtitle` | `PMS A + cabin filter, ₱2,499` | The number, if there is one. |
| `description` | Long form | Plain, short sentences. Taglish-friendly. |
| `kind` | `PERCENT_OFF` \| `FIXED_OFF` \| `BUNDLE` \| `CLEARANCE` \| `SEASONAL` \| `TIRES` | |
| `badge` | `Limited` | Short. Uppercase is fine. |
| `code` | `SUMMER26` | Unique. Optional — used by the quote form. |
| `valuePct` | `15` | Only for `PERCENT_OFF`. |
| `valueOff` | `500` | Only for `FIXED_OFF`. PHP, integer pesos. |
| `terms` | `["Valid until 30 June 2026", "Cannot be combined"]` | An array. |
| `startsAt` / `endsAt` | Dates | **Always set `endsAt`.** An open-ended promo is a pricing mistake that lives forever. |
| `priority` | `10` | Higher shows first. |
| `isActive` | `true` | |
| `imageUrl` | `/images/promo-summer.jpg` | Optional. Needs consent for real photos. |

### 2.3 Rules

- **`endsAt` is not optional.** `/api/cron/expire-promos` deactivates expired
  promos nightly, but a promo with no end date never expires.
- **The price must be confirmed by the owner.** The brief forbids shipping a
  claim the owner has not signed off on. If the number is a guess, it is not a
  promotion.
- **Discounts cannot exceed the margin.** Check: `priceMin - valueOff` must stay
  above cost. A ₱2,499 PMS that costs ₱2,600 to deliver is a loss with a
  marketing budget.
- **Every promo routes to `/book` with the code pre-applied** (LANE C in the
  conversion ladder). A promotion that cannot be booked is a poster.
- **Expiry is verified by the smoke test**, not by eye. After deploying, check
  the promo still renders on `/deals`.

### 2.4 Expire early

```bash
npm run db:studio   # set isActive = false
```

Or, to be certain nothing can book it, delete the row. Check first:

```sql
SELECT count(*) FROM "Booking" WHERE "promoCode" = 'SUMMER26';
```

If bookings exist, **deactivate, do not delete** — the `BookingItem` snapshot
references it and deleting breaks the history.

---

## 3. How to close the shop for a holiday

### 3.1 Two separate things

| Concern | Where it lives | Effect |
| --- | --- | --- |
| The *site* should not offer slots | `Holiday` table | `/book` shows "Closed", availability returns nothing |
| The *search engine* should not index it | `BusinessHours` | Only for a permanent change |

A one-day holiday is a `Holiday` row. Changing `BUSINESS_HOURS` in
`src/config/site.ts` means a code change, a review and a deploy — wrong weight
for a holiday.

### 3.2 Add the closure

```bash
npm run db:studio
```

`Holiday`:

| Field | Value |
| --- | --- |
| `name` | `Araw ng Bayan` (or `Christmas Day`, `Mauna ang Alaala`) |
| `date` | The date (midnight UTC — `@db.Date`, so no timezone surprises) |
| `isClosed` | `true` |
| `note` | `Closed. Emergency roadside: call the number on the website.` |

**Add every occurrence.** Ninoy Aquino Day, Rizal Day, Bonifacio Day, National
Heroes Day, Christmas, Good Friday, All Saints, All Souls, Rizal — the
Philippine list. Add them all in January, once.

**Lead time.** Customers book days ahead. Close the date at least a week in
advance, or someone drives to Tuyo for nothing.

### 3.3 Block a working day, or just part of one

See §5 (blocking a time slot). A `BayClosure` with `startsAt`/`endsAt` covering
a half-day is the right tool.

### 3.4 Half-days

`isClosed: false` with a `note` gives "open in the morning" without changing the
hours model. If that is not accurate, use a `BayClosure` for the afternoon and
`isClosed: false` on the `Holiday`.

### 3.5 Emergency closure (typhoon, flood)

EGSA Fourlanes floods. This is not a hypothetical.

```bash
# 1. Insert a BayClosure for the next 3 days
# 2. Update the Facebook page — most customers see that first
# 3. Consider a SiteSetting if one exists, or the maintenance page
```

`/api/cron/expire-holds` runs every 10 minutes and releases soft holds inside a
closure, so customers are not left with a "pending" booking that will never
happen.

**Customers whose bookings fall inside the closure need a phone call.** That is
the part no code does. Export them (§6) and call.

---

## 4. How to add a service

### 4.1 In the right order

`Service` has `categoryId`, so the category must exist first.

### 4.2 Create the category (if new)

`ServiceCategory`:

| Field | Value |
| --- | --- |
| `slug` | `brakes` |
| `name` | `Brakes` |
| `blurb` | `Pads, discs, fluid.` |
| `icon` | An icon name from the set `lucide-react` uses |
| `accentFrom` / `accentTo` | Brand hexes only — `theme` tokens, never a hardcoded hex |
| `sortOrder` | `30` |
| `isActive` | `true` |

### 4.3 Create the service

`Service`:

| Field | Value | Notes |
| --- | --- | --- |
| `categoryId` | The category | Required. |
| `slug` | `front-brake-pads` | Unique, URL-safe. **Never rename a published slug** — add a 301 in `next.config.ts` instead. |
| `name` | `Front Brake Pads` | |
| `shortName` | `Brake Pads` | For tight layouts. |
| `summary` | One line. | Shown in listings. |
| `description` | Full. | Plain English. Say what is and is not included. |
| `pricing` | `FIXED` \| `RANGE` \| `CALL_FOR_PRICE` | |
| `priceMin` / `priceMax` | Integer pesos | `null` for `CALL_FOR_PRICE`. **Confirmed by the owner.** |
| `priceNote` | `per axle` | The unit. Ambiguity here is how a price dispute starts. |
| `durationMin` | `60` | Drives slot length. Must be realistic or the schedule overbooks. |
| `includes` | `["Pads", "Labour"]` | Array. |
| `excludes` | `["Rotors"]` | Array. **Be honest — this is what prevents an argument at the counter.** |
| `isPopular` | `false` | |
| `requiresVehicle` | `true` | Forces the vehicle step in `/book`. |
| `sortOrder` | `10` | |
| `isActive` | `true` | |

### 4.4 Filipino automotive vocabulary

Use the words locals actually use. Someone searching "ayusin ng brakes" should
find this page. Common terms: PMS, PMS A/B, wheel alignment, tire rotation,
vulcanizing, undercoating, change oil, brake pad, shock absorbers, CVL/bushings,
car aircon, roadside, breakdown, ayusin/check, CVO.

### 4.5 The rule about packages and prices

**A price is a promise.** Every `priceMin` and `priceMax` must be confirmed by
the owner before it goes live. The orchestrator brief is explicit: do not ship a
claim the owner has not signed off on. If the price is unknown, use
`CALL_FOR_PRICE` and say so plainly — that is honest and it converts. An invented
number that turns out to be wrong costs a customer who drove to Tuyo.

### 4.6 After creating

```bash
npm run db:studio    # verify it appears
# Refresh /services on the live site (ISR revalidates; force it if needed)
curl -s https://eygtireautocare.ph/services | grep -i "front brake pads"
```

---

## 5. How to block a time slot

Three tools, three different jobs.

| Tool | Use for | Scope |
| --- | --- | --- |
| `BayClosure` | A bay is out of service, a half-day closure | A time range |
| `Holiday` | A named public holiday | A whole day |
| `BOOKING.breakWindows` in `site.ts` | The lunch break | Every day (code change) |

### 5.1 Block a range

```bash
npm run db:studio
```

`BayClosure`:

| Field | Value |
| --- | --- |
| `title` | `Bay 2 — wheel balancer repair` |
| `startsAt` | `2026-03-14T08:00:00+08:00` |
| `endsAt` | `2026-03-14T12:00:00+08:00` |
| `reason` | `Wheel balancer down` |
| `isActive` | `true` |

**Mind the timezone.** `Asia/Manila` (UTC+8). The shop's local morning is
`00:00Z`. Storing `08:00+08:00` is correct and unambiguous — **always store with
the offset**, never a bare local time.

### 5.2 Block a single slot

`BayClosure` covers a range. For one 60-minute slot:

```
startsAt = the slot start
endsAt   = the slot start + 60 minutes
```

### 5.3 Reduce capacity rather than close

If one bay goes down, do not close the day. Reduce
`BOOKING.capacityPerSlot` (in `site.ts`, code change) or, better, check whether
the availability endpoint already accounts for `capacityPerSlot` per closure.
Over-promising slots is how a shop ends up with three cars and two bays at 9am.

### 5.4 Verify

```bash
curl -s "https://eygtireautocare.ph/api/availability?service=front-brake-pads&date=2026-03-14" | jq
```

The blocked slot must be absent. If it appears, the availability query is not
reading `BayClosure` — that is a backend bug, not a data problem.

### 5.5 Emergency: a customer needs tomorrow but it is full

There is no backdoor by design. Options, in order:

1. Call them and book manually; create the `Booking` row in Studio with
   `channel = PHONE`.
2. Block a slot, then create the booking against it.

Both leave a record. Never "just squeeze them in" — the next appointment then
arrives late because of it.

---

## 6. How to export bookings

Bookings are the only irreplaceable data this business has. Export before any
risky operation, before a migration, and whenever the owner asks.

### 6.1 Full backup (the right default)

```bash
node scripts/db-backup.mjs --label=before-whatever
node scripts/db-restore.mjs --latest --list-only   # confirm it is readable
```

Encrypted, checksummed, with a manifest. See
[BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md).

### 6.2 A readable CSV for the owner

```bash
docker compose exec postgres psql -U eyg -d eyg -c "\copy (
  SELECT
    reference,
    \"customerName\",
    \"customerPhone\",
    \"customerEmail\",
    \"startAt\",
    status,
    channel,
    \"createdAt\"
  FROM \"Booking\"
  ORDER BY \"startAt\" DESC
) TO STDOUT WITH CSV HEADER" > bookings.csv
```

For a managed database, connect with `psql` directly using `DATABASE_URL`.

**This CSV contains customer PII.** It does not go in the repository, not in
Slack, not in email. Store it where the shop's other confidential papers live
and delete it when it is no longer needed.

### 6.3 Just today's bookings

```sql
SELECT reference, "customerName", "customerPhone", "startAt", status
FROM "Booking"
WHERE "startAt" >= CURRENT_DATE AND "startAt" < CURRENT_DATE + INTERVAL '1 day'
ORDER BY "startAt";
```

### 6.4 Who still needs calling

After a cancellation or a closure:

```sql
SELECT reference, "customerName", "customerPhone", "startAt"
FROM "Booking"
WHERE status = 'CONFIRMED'
  AND "startAt" BETWEEN '<closure-start>' AND '<closure-end>'
ORDER BY "startAt";
```

Call each one. Then set the status to `CANCELLED` with a `cancelReason`. A
booking left `CONFIRMED` through a closure is a customer who drives to the shop
for a service that cannot be done.

---

## 7. How to respond to a bad review

### 7.1 Principles

The shop has 308 followers. In a community that size, **every person who reads
the reviews already knows who you are.** Reputation there is personal, not
statistical.

1. **Reply to everything.** A one-star review with no reply tells the neighbourhood
   you do not care.
2. **Reply once, publicly. Then take it private.** Do not argue in public.
3. **Never argue about facts you cannot prove.** If it is not your fault, say so
   once, kindly, and move to private.
4. **Never reveal another customer's details** — not even to prove you were
   right. One privacy breach outweighs any review.
5. **A specific complaint is usually true.** The most useful review you will get
   is the one that says "waited 40 minutes past my slot". Fix it.
6. **Do not offer compensation publicly.** Move it to a call.

### 7.2 The pattern

**Public reply** (within 24 hours):

> Hi [Name], sorry about the wait past your slot — that's on us and we know how
> frustrating it is when you're already running late. I've spoken to the team and
> we're tightening the 9am slot so it doesn't happen again. Could I ask you to
> message us your booking reference? We'd like to make it right.
>
> — EYG Tire & Auto Care

**Then** take it to Messenger or a phone call.

- Acknowledge. Do not explain first — acknowledging is what they want.
- Explain only if it changes anything.
- Fix the specific thing.

### 7.3 Escalate when

| Signal | Action |
| --- | --- |
| Mentions injury, damage to a vehicle, or the police | **SEV2.** Escalate to the owner immediately. Do not reply publicly until the owner has seen it. See [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md). |
| Names an individual employee | Do not name them back. "I've spoken with the team." |
| Review appears on Google, not Facebook | Google Business Profile reviews are public and rank. Respond within 24 hours. |
| A pattern across three or more reviews | Stop replying individually. Fix the process, then respond to each one saying it is fixed. |
| Review is fake or defamatory | Reply once, factually, then report to the platform. Do not retaliate. |

### 7.4 Syncing reviews

`GOOGLE_PLACE_ID` + `GOOGLE_API_KEY` let `/api/cron/sync-reviews` pull Google
reviews in. Without them, the reviews section renders its empty state — which is
honest, and better than a placeholder.

Never write a fake review, and never write a review on a customer's behalf. The
orchestrator brief forbids both, and it is also fraud.

---

## 8. Daily and weekly checks

### 8.1 Daily (2 minutes, with coffee)

```bash
# Is it up, and does it actually book?
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph

# Any new errors?
# Sentry → Issues → filter to the last 24h
```

Then look at the bookings board and confirm tomorrow's slots are right.

### 8.2 Weekly (10 minutes, Monday)

```bash
# Are backups running, and are they intact?
node scripts/db-backup.mjs --list
node scripts/db-backup.mjs --verify

# Are we close to any limit?
# - CI minutes
# - Vercel function invocations
# - Postgres storage and connections
# - Twilio / Resend monthly quota
```

Then:

- Read the last week's error rate in Sentry.
- Check `Dependabot`/`Renovate` for anything red.
- Confirm the promotions on `/deals` still have a valid `endsAt`.
- Skim the reviews.

### 8.3 Monthly

- **Restore drill.** A backup you have not restored is a hypothesis. See
  [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) §6.
- Rotate `AUTH_SECRET` if anyone left. Logs everyone out — do it at a quiet time.
- Review access: who has a GitHub account, who has Vercel access, who has the
  database password.
- Reconcile the bill against [COST-OPTIMISATION.md](COST-OPTIMISATION.md).

---

## 9. Running the cron jobs manually

Vercel Hobby allows 2 cron jobs. `vercel.json` declares 3. If you hit
`CRON_JOBS_LIMIT`, merge them into a single `/api/cron/tick` that dispatches on
the day of the week.

Until then, trigger one directly:

```bash
curl -sS -X POST "https://eygtireautocare.ph/api/cron/expire-holds" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or on the cron job's own schedule:

| Job | Schedule | What it does | If it is not running |
| --- | --- | --- | --- |
| `expire-holds` | every 10 min | Releases soft holds that were never completed | Slots stay blocked by abandoned carts |
| `no-show-sweep` | 10:17 daily | Marks missed appointments `NO_SHOW` | The board fills with ghosts |
| `backup` | 02:13 daily | Writes an encrypted dump | **You are one disk failure from losing every booking** |

The off-the-hour minute (`:13`, `:17`) is deliberate. Every scheduled job in the
world fires at `:00` and the shared pool queues hard.

Check whether they are actually running:

```bash
# Vercel → Logs → Filter: /api/cron
# Or query the Notification table
docker compose exec postgres psql -U eyg -d eyg -c \
  'SELECT channel, status, count(*) FROM "Notification"
   WHERE "createdAt" > now() - interval \'7 days\' GROUP BY 1,2;'
```

---

## 10. Adjusting rate limits

The single most effective anti-spam control.

### 10.1 The numbers

| Variable | Default | Raise when | Lower when |
| --- | --- | --- | --- |
| `RATE_LIMIT_PUBLIC_PER_MINUTE` | 10 | A crawler 429s on `/contact` | Spam reports |
| `RATE_LIMIT_BOOKING_PER_HOUR` | 8 | **A shop with 3 bays and 2 staff shares an office IP** | A bot books every slot |
| `RATE_LIMIT_QUOTE_PER_HOUR` | 12 | | |
| `RATE_LIMIT_LOGIN_PER_15MIN` | 8 | | |
| `RATE_LIMIT_READ_PER_MINUTE` | 240 | Lighthouse or a monitor is tripping it | |

### 10.2 Tuning for a shared IP

This is the most common real problem. If the shop's whole office is behind one
connection, every booking in a day comes from one IP — and `8/hour` becomes a
ceiling on the business, not on spam.

**Fix it properly, do not just raise the number.** The booking limit should be
keyed on something a human has and a bot does not:

```
rate limit key = phone number (for booking and quote)
              + IP       (for everything else)
```

If that is not implemented, the fallback is:

1. Raise `RATE_LIMIT_BOOKING_PER_HOUR` to `25` for this deployment.
2. Lower `RATE_LIMIT_PUBLIC_PER_MINUTE` to `5` to compensate.
3. Add a CAPTCHA to `/book`. Turnstile is free and invisible to humans.
4. Watch for the pattern in the logs.

### 10.3 Which backend is in use

```bash
docker compose exec postgres psql -U eyg -d eyg -c \
  'SELECT key, count, "resetAt" FROM "RateLimitCounter" ORDER BY count DESC LIMIT 20;'
```

Rows appearing here mean the **Postgres** fallback is active. If
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both set, that table
stays empty and limits live in Redis.

Half a pair is a boot failure, not a silent degradation — `src/lib/env.ts`
rejects it.

### 10.4 Changing a limit

It is an environment variable. No code change, no build:

```bash
# Vercel
npx vercel env rm RATE_LIMIT_BOOKING_PER_HOUR production
npx vercel env add RATE_LIMIT_BOOKING_PER_HOUR production    # enter the value
```

Then redeploy. `next start` reads the environment at boot; a Vercel env change
needs a new deployment to take effect.

Verify:

```bash
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph
```

---

## 11. Changing prices

Prices are data, not code. This is the safest change in the system — and also
the one with the most ways to go wrong.

### 11.1 Through Studio

`npm run db:studio` → `Service` → edit `priceMin` / `priceMax` / `priceNote`.

### 11.2 Rules

1. **Integer pesos.** `priceMin: 2499` means ₱2,499. There are no cents in
   Philippine retail practice.
2. **A range needs a reason.** `priceMin`/`priceMax` is for genuinely variable
   work (a sedan vs. an SUV). If the shop quotes a firm price, use
   `pricing: FIXED` and one number — a range reads as "we are not sure what it
   costs", which loses the customer.
3. **`priceNote` carries the unit.** `per axle`, `per set`, `incl. labour`. The
   single most common cause of an argument at the counter is an ambiguous price.
4. **Do not rename a `slug`.** A `slug` change 404s every shared link and drops
   the page out of search. Add a 301 in `next.config.ts` (orchestrator-owned).
5. **Existing bookings are unaffected.** `BookingItem` stores a name and price
   snapshot. Changing today's price does not rewrite yesterday's booking — which
   is exactly right.

### 11.3 Where prices also appear

A price change is not finished until the marketing copy agrees:

- `/services` — reads from the database.
- `/deals` — `Promotion.valuePct` / `valueOff` and the `subtitle`, which are
  typed strings and will go stale.
- `src/content/marketing/promotions.ts` — if that file hardcodes a price.
- `public/og/*.png` — only if a card shows one.
- The printed price list in the shop.
- The Facebook page.

### 11.4 Verify

```bash
curl -s https://eygtireautocare.ph/services | grep -i "2,499"
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph
```

Then **book it.** Put through a real test booking at the new price and confirm
the quote and the confirmation message both show the right number. A price that
renders on the page but arrives wrong in the confirmation SMS is worse than a
price that is merely wrong on the page.

---

## Related

| Document | Read it when |
| --- | --- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploying anything |
| [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | Something is on fire |
| [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) | Any data question |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Setting up alerts |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Before go-live |
