# NEON + VERCEL SETUP

### The exact steps, in order, with the traps this codebase actually has

Read §1 before anything else. There is one failure mode here that produces a
**green deploy and a broken site**, and it is not obvious.

---

## 1. ⚠️ THE TRAP: nothing runs your migrations on Vercel

`vercel.json`:

```json
"installCommand": "npm ci",
"buildCommand":   "prisma generate && node scripts/generate-og.mjs && next build"
```

`prisma generate` builds the client. It does **not** touch the database — it only
reads `schema.prisma`. Neither does `postinstall`, which is also
`prisma generate`.

So on a fresh database:

- the build **succeeds**
- the deploy reports **green**
- the site deploys
- the first request that touches the database throws `relation "Product" does not exist`

Nothing in the pipeline runs `prisma migrate deploy`. `npm run db:deploy` exists,
but nothing invokes it.

**Therefore: apply the migrations yourself, from your machine, before or
immediately after the first deploy.** Do not add `migrate deploy` to
`buildCommand` — that runs on every deployment including previews, and a preview
migrating your production database is the classic way to lose data.

Two migrations ship in this repo:

| Migration | What it does |
| --- | --- |
| `20261003090000_init` | all 39 tables, 54 indexes, 52 constraints |
| `20261003100000_reservation_walkin_hold` | makes `Reservation.bookingId` nullable, adds `heldFor` |

---

## 2. Create the Neon project

1. Sign in at [neon.com](https://neon.com) → **Create a project**
2. **Region: pick Singapore (`ap-southeast-1`)**

   `vercel.json` pins `regions: ["sin1"]`, which is Vercel's Singapore region.
   Matching the two keeps the database and the functions in the same zone —
   otherwise every query crosses an ocean and you pay latency on every request.

3. Name it anything (`eyg-production` is fine).
4. Leave the plan at **Free**. See §7 for when to leave.

---

## 3. Copy BOTH connection strings

This is the step people get wrong, and `.env.example` calls it *"the single most
common way a Prisma + Vercel app dies in production."*

In the Neon console → **Connection Details**, you will see two strings. Copy
**both**:

| Variable | Which string | Why |
| --- | --- | --- |
| `DATABASE_URL` | **Pooled connection** (host contains `-pooler`) | every query the running app makes |
| `DIRECT_URL` | **Non-pooled / direct connection** (host has no `-pooler`) | `prisma migrate deploy` only |

They look like this — note the difference is only the hostname:

```
DATABASE_URL = postgresql://USER:PASS@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/eyg-production?sslmode=require
DIRECT_URL   = postgresql://USER:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/eyg-production?sslmode=require
```

**Why both.** A serverless function opens a fresh connection per invocation.
Hundreds of bookings a day would exhaust Neon 10's connection limit within
minutes and take the site down with `too many connections` — no code bug, no
deploy, just dead.

Migrations are the exception: `migrate deploy` uses prepared statements and
advisory locks, and **a transaction pooler breaks both**. Hence the separate
direct URL.

### Add pooling parameters too

Append these to `DATABASE_URL` so a single serverless instance cannot open a
pile of connections of its own:

```
&pgbouncer=true&connection_limit=1
```

(Neon's `-pooler` endpoint already pools, so this is belt-and-braces — but it is
the difference between "one connection per instance" and "one per request".)

---

## 4. Point your local `.env` at Neon and migrate

Edit `C:\Ben File\Portfolio\.env`:

```dotenv
DATABASE_URL=postgresql://...-pooler...&sslmode=require&pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...(no -pooler)...?sslmode=require
```

Then, from the project root:

```powershell
npm run db:deploy
```

Expected output:

```
Applying migration `20261003090000_init`
Applying migration `20261003100000_reservation_walkin_hold`
All migrations have been successfully applied.
```

### ⚠️ The constraints have never been executed

Every CHECK constraint in that first migration was written from the schema and
the engine's own sign table. **They have never run against a real Postgres.**

A wrong CHECK does not degrade gracefully — it refuses every write it *should*
have allowed. `stockmovement_sign_matches_kind` is the highest-risk one: it
encodes an eleven-way mapping of movement kind to sign, and if one kind is wrong,
every stock movement of that kind fails at the counter with a 500 nobody can
explain.

**Proof it before you trust it.** In the Neon console → **SQL Editor**, run:

```sql
-- 1. The tables landed
SELECT count(*) AS tables FROM information_schema.tables
 WHERE table_schema = 'public';

-- 2. The constraints are actually there
SELECT conname FROM pg_constraint
 WHERE contype = 'c' AND connamespace = 'public'::regnamespace
 ORDER BY conname;

-- 3. The engine must REFUSE this (negative RECEIVE)
INSERT INTO "StockMovement"
  (id, "productId", kind, qty, "onHandAfter", reason, "createdAt")
VALUES ('test', 'test', 'RECEIVE'::"StockMovementKind", -5, 0, 'negative receive', now());
-- expect: ERROR violates check constraint "stockmovement_sign_matches_kind"

-- 4. The engine must REFUSE this (blank reason)
INSERT INTO "StockMovement"
  (id, "productId", kind, qty, "onHandAfter", reason, "createdAt")
VALUES ('test2', 'test', 'RECEIVE'::"StockMovementKind", 5, 0, '   ', now());
-- expect: ERROR violates check constraint "stockmovement_human_reason_required"

-- 5. And the invariant itself
INSERT INTO "StockLevel" (id, "productId", "onHand", reserved, "updatedAt")
VALUES ('t','p', 2, 5, now());
-- expect: ERROR violates check constraint "stocklevel_reserved_le_onhand"
```

Steps 3–5 **should fail**. If any of them succeeds, a constraint is wrong and the
app will reject legitimate writes at the counter. Fix it before going live.

### Seed

```powershell
npm run db:seed
```

This imports the real service catalogue from `src/content/catalog` (it does not
duplicate it) and creates your admin account using `ADMIN_EMAIL` and
`ADMIN_PASSWORD` from `.env`. **Set those two before you seed**, then change the
password after first login.

---

## 5. Vercel environment variables

Project → **Settings → Environment Variables**. Set these for **Production**:

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Neon **pooled** URL | **mark it Sensitive** |
| `DIRECT_URL` | Neon **direct** URL | not needed by the build as wired; harmless, and you will want it if you ever add auto-migrate |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | **must be set before the first build** |
| `AUTH_SECRET` | `openssl rand -base64 48` | rotating this logs everyone out |
| `PII_ENCRYPTION_KEY` | `openssl rand -hex 32` | **changing it makes existing encrypted PII unreadable** |
| `CRON_SECRET` | `openssl rand -base64 48` | without it, every cron route returns 503 |

That is the whole required set. Everything else degrades gracefully:

| Missing | Consequence |
| --- | --- |
| `UPSTASH_REDIS_*` | falls back to Postgres rate-limit counters — correct, one extra round trip |
| `TWILIO_*` | confirmations log as `"skipped"`; the site still works |
| `RESEND_API_KEY` / `SMTP_*` | same |
| `SENTRY_DSN` | no error reporting |
| `GOOGLE_*` / `FACEBOOK_*` | review sync disabled |

### Why `NEXT_PUBLIC_SITE_URL` must exist before the build

Two separate things read it:

1. **`scripts/generate-og.mjs`**, which runs inside `buildCommand`. It generates
   the OG images and needs the origin to do it.
2. **The CSRF allowlist is derived from it.** The app refuses to boot in
   production without it — which is deliberate. An allowlist derived from the
   `Host` header is forgeable.

---

## 6. Import to Vercel — and buy Pro FIRST

⚠️ **Do not connect this repository to a Vercel Hobby account.** `vercel.json`
declares:

```json
"crons": [{ "path": "/api/cron/tick", "schedule": "*/10 * * * *" }]
```

Vercel's documented behaviour on Hobby:

> *"Cron expressions that would run more frequently **will fail during
> deployment**."*

That is a **hard deploy failure**, not a degraded cron. Upgrade to **Pro ($20/mo)**
before importing, or temporarily comment out the `crons` block.

### Import

1. Vercel → **Add New → Project** → **Import** `benben000000/eyg-system`
2. Framework should be detected as **Next.js** — `vercel.json` pins
   `"framework": "nextjs"` anyway
3. Region should read **Singapore** — verify it, do not accept the default
4. Add the six env vars
5. **Deploy**

---

## 7. Neon Free is probably enough — know when it stops being

| | Free | Launch |
| --- | --- | --- |
| Compute | 100 CU-hours/project/mo | $0.106/CU-hour |
| Storage | 0.5 GB | $0.35/GB-month |
| Egress | 5 GB | 500 GB, then $0.10/GB |
| Scale to zero | after 5 min | after 5 min, can disable |

A 48-SKU catalogue with a few hundred bookings a month is nowhere near 0.5 GB.

**Two things to expect on Free:**

1. **A cold start on the first request after 5 idle minutes** — a couple of
   seconds. Harmless, occasionally noticeable.
2. **Hitting a limit suspends compute until the next billing month.** Read the
   Neon usage dashboard occasionally. Do not put an uptime monitor or a
   once-a-minute cron against it — a pinger that wakes the database every minute
   is the classic mistake that turns a free tier into a bill, because it
   prevents scale-to-zero and you start paying CU-hours for an idle database.

---

## 8. Node version

`.nvmrc` pins `20.11.0`; `engines` requires `>=20.11.0`.

If the Vercel build log warns that Node 20 has reached end-of-life, bump
`.nvmrc` and `engines` together to Node 22 and redeploy. Change both or they
will disagree.

---

## 9. Verify the deploy

| Check | How | Expected |
| --- | --- | --- |
| Site loads | open the URL | page renders |
| DB reachable | `/api/health` | 200 |
| Tables exist | any inventory page | no `relation does not exist` |
| Cron is alive | Vercel → Cron Jobs → trigger `/api/cron/tick` manually once | `results` array, `allOk: true` |
| Booking works | submit a real booking | row in Neon, `BookingEvent` written |
| Stock writes | receive 1 item in `/inventory` | ledger row, `onHand` moves |
| **Oversell refuses** | reserve the last unit twice | second is **refused**, not clamped |

That last one is the invariant. Test it deliberately.

---

## 10. The launch gate is separate from all of this

Infrastructure being green does not make the site launchable.
`scripts/predeploy-check.mjs` currently reports **1 blocking issue** — the
unconfirmed business facts: prices, payment methods, bay count, coordinates, and
the warranty policy.

Run it before you tell anyone the site is live:

```powershell
node scripts/predeploy-check.mjs
```
