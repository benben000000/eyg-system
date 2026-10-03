# DEPLOYMENT

**EYG Tire & Auto Care** · Balanga City, Bataan · owner: `@acme/devops`

Everything an operator needs to get this site from a fresh clone to a live
shop, and to get it back when it breaks.

> **Before you read further:** if the site is *currently* down, stop reading
> this and open [`INCIDENT-RESPONSE.md`](INCIDENT-RESPONSE.md). That document is
> written for someone panicking at 2am. This one is not.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Local development](#2-local-development)
3. [Staging](#3-staging)
4. [Environment variables — every key, where to get it](#4-environment-variables)
5. [The database](#5-the-database)
6. [Migrations](#6-migrations)
7. [DNS and SSL](#7-dns-and-ssl)
8. [Platform walkthroughs](#8-platform-walkthroughs)
9. [Enabling standalone output](#9-enabling-standalone-output)
10. [Rollback](#10-rollback)
11. [Post-deploy verification](#11-post-deploy-verification)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Why | Check |
| --- | --- | --- | --- |
| Node.js | **20.11.0** (`.nvmrc`) | `engines: >=20.11.0`. Node 22+ changes the OpenSSL behaviour Prisma relies on. | `node -v` |
| npm | 10.x (ships with Node 20) | The lockfile is npm v3 format. Do not switch to pnpm or yarn — the lockfile is the reproducibility guarantee. | `npm -v` |
| Docker | 24+ | Only for the container path. Not needed on Vercel. | `docker --version` |
| Git | 2.40+ | | `git --version` |
| PostgreSQL client | 16 | `pg_dump` / `pg_restore` for the backup scripts. | `pg_dump --version` |

```bash
nvm use              # reads .nvmrc
npm ci               # NOT `npm install` — ci is reproducible
node scripts/install-hooks.mjs
```

`npm ci` is not a style preference. It installs exactly the lockfile and fails
loudly if `package.json` and `package-lock.json` disagree. `npm install`
silently rewrites the lockfile, which means the build you test is not the build
that deploys.

---

## 2. Local development

### 2.1 The two-command path (recommended)

```bash
cp .env.example .env.docker.local
printf 'AUTH_SECRET=%s\nPII_ENCRYPTION_KEY=%s\nWEBHOOK_SIGNING_SECRET=%s\n' \
  "$(openssl rand -base64 48)" \
  "$(openssl rand -hex 32)" \
  "$(openssl rand -base64 32)" \
  >> .env.docker.local

docker compose up -d
```

Then open <http://localhost:3000>.

That is two commands after the clone, plus one to generate the secrets. The
database comes up, the schema is applied, and `docker compose` seeds it.

### 2.2 Without Docker

You need a Postgres 16 running somewhere:

```bash
createdb eyg
cp .env.example .env.local
# edit .env.local: DATABASE_URL, AUTH_SECRET, PII_ENCRYPTION_KEY, WEBHOOK_SIGNING_SECRET

npm ci
npx prisma migrate deploy     # or `npx prisma migrate dev` the first time
npm run db:seed
npm run dev
```

### 2.3 With the optional Redis rate limiter

The default rate limiter is a Postgres counter: correct, one write per request,
slower under load. Redis is a drop-in speedup:

```bash
docker compose --profile rate-limit up -d
```

Note: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are for **Upstash's
hosted REST API**, not for a local Redis. Leave them empty locally; the app
falls back to Postgres, which is the correct behaviour. `src/lib/env.ts` rejects
setting only one half of the pair, because a half-configured Upstash silently
degrades and that is confusing at 2am.

### 2.4 The day-to-day commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, hot reload |
| `npm run build` | `prisma generate` then `next build` — the real build |
| `npm start` | Serve the production build |
| `npm run lint` | `next lint --max-warnings=0`. Zero warnings is the rule. |
| `npm run typecheck` | `tsc --noEmit`. Zero tolerance. |
| `npm test` | `vitest run` |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create + apply a migration in development |
| `npm run db:deploy` | Apply migrations. **The only correct command in production.** |
| `npm run db:studio` | Prisma Studio, browse the data |
| `node scripts/generate-og.mjs` | Regenerate the social cards |
| `node scripts/smoke-test.mjs` | Prove the running site works |
| `node scripts/validate-env.mjs` | Check the env contract |

### 2.5 Docker, directly

```bash
docker build -t eyg-tire:1.0.0 .
docker run --rm -p 3000:3000 --env-file .env.production eyg-tire:1.0.0
docker run --rm --entrypoint sh eyg-tire:1.0.0 -c "id"   # should print uid 1001
```

Image size target: **under 900 MB**. The CI job warns above that. See
[COST-OPTIMISATION.md](COST-OPTIMISATION.md) §4.

---

## 3. Staging

Staging exists to catch "works on my laptop" before a customer does. It must be
a **different database** from production — pointing staging at the production
database is the single most expensive mistake available in this repo.

### 3.1 Create it

On Vercel:

```bash
npx vercel pull --yes --environment=staging
npx vercel env add DATABASE_URL staging      # paste the STAGING connection string
npx vercel env add AUTH_SECRET staging
npx vercel env add PII_ENCRYPTION_KEY staging
npx vercel env add WEBHOOK_SIGNING_SECRET staging
npx vercel env add NEXT_PUBLIC_SITE_URL staging
```

Point `staging.eygtireautocare.ph` at Vercel in DNS (§7).

### 3.2 What differs from production

| Variable | Production | Staging | Why |
| --- | --- | --- | --- |
| `DATABASE_URL` | production DB | **separate** DB | Never share. |
| `NEXT_PUBLIC_SITE_URL` | `https://eygtireautocare.ph` | `https://staging.eygtireautocare.ph` | Canonical tags and the sitemap. |
| `ADMIN_IP_ALLOWLIST` | shop IPs | your IPs | Staging `/admin` is still customer data. |
| `LOG_LEVEL` | `info` | `debug` | |
| `CAPTCHA_ENABLED` | `true` | `false` | You will get tired of solving arithmetic. |
| `SENTRY_DSN` | set | unset | Do not pollute production's error budget with staging noise. |
| `TWILIO_*` | set | unset | **Staging must never text a real customer.** |
| `RESEND_API_KEY` | set | unset | Same reason — no real emails to real inboxes. |
| `FEATURE_*` | all off | all on | Previews are where flags get exercised. |

The last two are not optional. A staging deploy that texts a real customer's
phone because a test booking ran against the live Twilio number is the kind of
incident that ends a client relationship.

### 3.3 Seed staging, then verify

```bash
DATABASE_URL="$STAGING_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$STAGING_DATABASE_URL" npm run db:seed

node scripts/smoke-test.mjs --base-url=https://staging.eygtireautocare.ph --retries=5
```

---

## 4. Environment variables

`src/lib/env.ts` parses `process.env` **once at module load and throws** on an
invalid combination. A bad environment does not produce a degraded app; it
produces an app that refuses to start. That is deliberate.

> ### ⚠️ The env contract is currently out of sync
>
> `node scripts/validate-env.mjs` fails on three keys that exist in the Zod
> schema but are **not** in `.env.example`:
>
> - `RATE_LIMIT_READ_PER_MINUTE`
> - `ADMIN_EMAIL`
> - `ADMIN_PASSWORD`
>
> CI currently allowlists them so the rest of the check is enforced. **Add these
> three lines to `.env.example`** (orchestrator-owned), then delete the
> `--allow-undocumented` flag from `.github/workflows/ci.yml`. Full list in
> [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md).

### 4.1 Required — the app will not boot without these

| Variable | Example | Where to get it | Rotate by |
| --- | --- | --- | --- |
| `DATABASE_URL` | `postgresql://eyg:PASS@host:5432/eyg?schema=public&connection_limit=5` | The provider's console: Neon, Supabase, RDS, or `docker compose`. | Provider console. |
| `AUTH_SECRET` | 48 random bytes | `openssl rand -base64 48` | **Logs every user out.** Do it deliberately. |
| `PII_ENCRYPTION_KEY` | 32 random bytes hex | `openssl rand -hex 32` | **Customer PII becomes unreadable.** See §4.5. |
| `WEBHOOK_SIGNING_SECRET` | 32 random bytes | `openssl rand -base64 32` | Webhooks from Twilio/Resend start failing. |
| `NEXT_PUBLIC_SITE_URL` | `https://eygtireautocare.ph` | Your domain. **No trailing slash.** | Rebuild required (inlined at build time). |

### 4.2 Rate limiting

| Variable | Default | Notes |
| --- | --- | --- |
| `RATE_LIMIT_PUBLIC_PER_MINUTE` | 10 | Public write endpoints. |
| `RATE_LIMIT_BOOKING_PER_HOUR` | 8 | The real one. 8 bookings from one IP in an hour is a bot. |
| `RATE_LIMIT_QUOTE_PER_HOUR` | 12 | |
| `RATE_LIMIT_LOGIN_PER_15MIN` | 8 | |
| `RATE_LIMIT_READ_PER_MINUTE` | 240 | **Not yet in `.env.example`** — see the warning above. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | unset | [console.upstash.com](https://console.upstash.com) → Create → REST. **Both or neither.** |

Tuning these is the highest-leverage anti-spam control. A competitor scraping
your price list costs you nothing; a bot filling every slot costs you a day of
bookings. See [RUNBOOK.md](RUNBOOK.md) §7.

### 4.3 Notifications

| Variable | Where | If unset |
| --- | --- | --- |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys | Email is skipped. **Never both Resend and SMTP** — `env.ts` rejects it. |
| `EMAIL_FROM` | `EYG Tire & Auto Care <bookings@eygtireautocare.ph>` | Needs a verified domain or Resend's onboarding address. |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_SECURE` | Any SMTP provider | `SMTP_HOST` requires `SMTP_USER` + `SMTP_PASSWORD`. |
| `TWILIO_ACCOUNT_SID` / `_AUTH_TOKEN` / `_FROM_NUMBER` | [console.twilio.com](https://console.twilio.com) | SMS logs as `"skipped"`. The site still books. |
| `WHATSAPP_PHONE_NUMBER_ID` / `_ACCESS_TOKEN` / `_VERIFY_TOKEN` | [developers.facebook.com](https://developers.facebook.com) → WhatsApp | `wa.me` links still work without it. |
| `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile | Falls back to the built-in arithmetic CAPTCHA. No third party. |

Twilio needs **all three** or none; a partial triple means texts silently never
arrive, and `env.ts` fails fast on it for exactly that reason.

### 4.4 Reviews, maps, analytics

| Variable | Where | If unset |
| --- | --- | --- |
| `GOOGLE_PLACE_ID` | Google Maps → your listing → Share → Embed → copy `place_id` | The reviews section renders its empty state. |
| `GOOGLE_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) → enable *Places API (New)* | Same. |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Graph API, a Page token with `pages_read_engagement` | Facebook reviews skipped. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Same console, restricted to your domain | The map falls back to an iframe. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 → Admin → Data streams | No analytics. Disclose its absence in `/privacy`. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | [plausible.io](https://plausible.io) | An alternative to GA with no cookie banner. |

### 4.5 `PII_ENCRYPTION_KEY` — read this once

It encrypts customer names, phone numbers and vehicle details at rest. It is
**not** stored anywhere recoverable by us.

- Losing it means the encrypted columns are permanently unreadable. Booking
  *history metadata* survives; contact details do not.
- Therefore: **write it down, physically, in the same envelope as the shop's
  registration papers.** Not in the repo. Not in a password manager alone.
- Before rotating: export the affected data (`docs/ops/BACKUP-AND-RECOVERY.md`
  §8), re-encrypt, verify, then replace.
- `AUTH_SECRET` is different: rotating it just invalidates sessions.

### 4.6 Admin

| Variable | Notes |
| --- | --- |
| `ADMIN_IP_ALLOWLIST` | Comma-separated CIDRs or IPs. **Empty = `/admin` open to the world**, holding every customer's name, phone and vehicle. The deploy workflow refuses to run with it unset. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed-only. **Not yet in `.env.example`** — see the warning at the top. |

To find your own IP: `curl ifconfig.me`. To find the shop's: ask, or check the
router's WAN address.

### 4.7 Where secrets live per platform

| Platform | Mechanism | Notes |
| --- | --- | --- |
| Vercel | `npx vercel env add <NAME> production` | Encrypted at rest. **Production / Preview / Development are separate.** |
| GitHub Actions | Settings → Environments → `production` → Secrets | Only readable by a job with `environment: production`. |
| Fly.io | `fly secrets set NAME=value` | Readable at runtime only. |
| Render | Blueprint `sync: false`, or the dashboard | |
| Docker | `--env-file` or the orchestrator's secrets | **Never `docker run -e` on a shared shell** — it is in `ps` output. |

**Never** put a `NEXT_PUBLIC_*` secret anywhere. It is inlined into the client
bundle and is public forever, in every cached copy, on every CDN edge.
`scripts/predeploy-check.mjs` fails the deploy if you try.

---

## 5. The database

Postgres 16. Mapped port bound to `127.0.0.1` in compose — nothing outside the
machine can reach a dev database.

```bash
# Connect
docker compose exec postgres psql -U eyg -d eyg

# Useful queries
docker compose exec postgres psql -U eyg -d eyg -c \
  'SELECT status, count(*) FROM "Booking" GROUP BY status;'

docker compose exec postgres psql -U eyg -d eyg -c \
  'SELECT reference, "customerName", "startAt" FROM "Booking" ORDER BY "createdAt" DESC LIMIT 20;'
```

**Export-first policy.** Before any destructive change, before any migration,
before a deploy you are unsure about:

```bash
node scripts/db-backup.mjs --label=before-whatever-i-am-about-to-do
node scripts/db-restore.mjs --latest --list-only     # confirm it is readable
```

See [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md).

---

## 6. Migrations

### 6.1 The three commands, and when each is correct

| Command | Use | Never |
| --- | --- | --- |
| `npx prisma migrate dev --name x` | Development. Creates a migration, applies it, seeds. | **In production.** It can prompt, it can reset the database, and it runs `db push` under the hood when it decides the history is wrong. |
| `npx prisma migrate deploy` | **Production and CI.** Applies committed migrations, in order, once each. | Anywhere else — it does not create migrations, so a forgotten one silently does nothing. |
| `npx prisma db push` | A throwaway preview database. | **Anywhere with real data.** It reconciles by dropping and recreating. It is data loss with a friendly message. |

`deploy-production.yml` contains no `db push`. That is on purpose and it should
stay that way.

### 6.2 The normal change

```bash
# 1. Edit prisma/schema.prisma
# 2. Create the migration
npx prisma migrate dev --name add_tyre_size_to_booking
# 3. Commit BOTH files — the schema and the SQL under prisma/migrations/
git add prisma/schema.prisma prisma/migrations/
```

Committing the schema without the migration is the most common way to ship a
schema change that does not exist in production. CI job 4 catches it:

```
prisma-validate → Detect schema drift → schema.prisma differs from prisma/migrations
```

### 6.3 The expand/contract pattern for anything destructive

The old code is still serving traffic while a migration runs. A migration that
drops or renames a column breaks it immediately — and then the rollback cannot
restore the data, because the column is already gone.

Never in one deploy:

```sql
DROP COLUMN "tyreSize";         -- ❌
ALTER TABLE "Booking" RENAME ...  -- ❌
ALTER TABLE "Booking" ALTER "x" TYPE ...  -- ❌
```

The deploy workflow scans for exactly these and refuses. The correct shape is
two deploys:

```
Deploy 1 (expand)
  ALTER TABLE "Booking" ADD COLUMN "tyreSizeCm" INTEGER;   -- nullable, additive
  -- old code still reads "tyreSize"; new code writes both

Deploy 2 (migrate reads/writes to the new column)
  -- application code only, no schema change

Deploy 3 (contract)
  ALTER TABLE "Booking" DROP COLUMN "tyreSize";            -- only now is it safe
```

`deploy-production.yml` blocks the contract step unless it is a separate deploy
whose code no longer references the old column. The preflight smoke test plus
`prisma migrate status` are what prove it.

### 6.4 Recovering from a failed migration

```bash
# 1. Find out where it stopped
npx prisma migrate status

# 2. If the migration is transactional and rolled back cleanly
npx prisma migrate deploy      # just re-run it

# 3. If a migration failed mid-way and left the schema half-applied
npx prisma migrate resolve --rolled-back 20260301120000_add_tyre_size
npx prisma migrate deploy

# 4. If the data is wrong — restore. Do not hand-patch production.
node scripts/db-restore.mjs --latest --target="$DATABASE_URL" --confirm=<count> --i-know-what-i-am-doing
```

---

## 7. DNS and SSL

### 7.1 Records

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| `A` | `@` | Vercel's anycast IP — **or CNAME** | 300 |
| `CNAME` | `www` | `cname.vercel-dns.com` | 300 |
| `CNAME` | `staging` | `cname.vercel-dns.com` | 300 |
| `TXT` | `@` | `v=spf1 include:_spf.vercel-dns.com ~all` | 300 |

Vercel shows the exact target value once the project exists. Copy it; do not
guess.

### 7.2 Order of operations

DNS TTL of 300 seconds is the single most useful thing you can do before
starting. Do it **24 hours ahead**. Propagating a record with a 3600 TTL
against a 300 TTL is an afternoon of waiting you can avoid for free.

### 7.3 SSL

Automatic, and there is nothing to configure. Vercel issues a Let's Encrypt
certificate when the domain resolves. `Strict-Transport-Security` in
`next.config.ts` pins the browser to HTTPS for two years with
`includeSubDomains` and `preload`.

Verify:

```bash
curl -sI https://eygtireautocare.ph | grep -i strict-transport
# Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**Check `preload` is actually working** before you rely on it:
<https://hstspreload.org>. Submission to the preload list takes weeks and is
effectively irreversible for the domain.

### 7.4 www vs. apex

Pick one canonical and redirect the other **at the edge**, not with a Next.js
redirect. Two URLs serving the same content splits your local SEO. `www` is
safer to redirect from (the apex is where the Google Business Profile lives):

```
www.eygtireautocare.ph  →  eygtireautocare.ph   (308)
```

---

## 8. Platform walkthroughs

### 8.1 The default: Vercel

**Why Vercel is the default.** Four reasons, in order of weight for this
specific business:

1. **It is free at this scale.** The site is static-first with a small
   Postgres. Hobby is USD 0. Fly with an equivalent setup is ~USD 5-8/month,
   Render ~USD 14. For a shop with 308 Facebook followers, USD 14/month of
   hosting is a real cost against a real revenue.
2. **Cron works.** Five scheduled jobs, no external scheduler, no second
   service to monitor.
3. **Region `sin1` (Singapore)** is ~2.5 ms from Balanga City and is the only
   Southeast Asia region. `hnd1` (Tokyo) is the fallback. **Never** `iad1` —
   that is 180 ms of added latency on every tap-to-call, which is the site's
   primary conversion.
4. **No server to patch.** A two-person team should not be responsible for
   OpenSSH updates on a production box.

```bash
# One-time
npm i -g vercel
vercel link                        # creates .vercel/project.json (gitignored)
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add PII_ENCRYPTION_KEY production
vercel env add WEBHOOK_SIGNING_SECRET production
vercel env add NEXT_PUBLIC_SITE_URL production
# ... and every optional key you have a value for

vercel domains add eygtireautocare.ph     # then add the CNAME it gives you

# Deploy
vercel --prod
```

Configure the `production` GitHub Environment with required reviewers so a
deploy is a deliberate act, not a consequence of merging.

**The cron limit.** Hobby allows 2 cron jobs per deployment. `vercel.json`
declares 3. If a deploy fails with `CRON_JOBS_LIMIT`, either upgrade or merge
the jobs into a single `/api/cron/tick` route that dispatches on the day of the
week. Documented, not discovered.

### 8.2 Continuous deployment from GitHub

1. Repo → Settings → Environments → New: `production`
2. Tick **Required reviewers**, add yourself
3. Add the secrets (§4.7)
4. Add environment *variables* (not secrets) — `PRODUCTION_SITE_URL`
5. Settings → Branches → protect `main`:
   - Require a PR before merging
   - Require approvals: 1
   - **Require review from Code Owners**
   - Require conversation resolution
   - Require status checks: the eight from §13
   - Require branches to be up to date
   - **Do not allow bypassing**

Then `.github/workflows/deploy-production.yml` handles everything: CI gate →
predeploy check → migrations → build → preflight smoke test → deploy → live
smoke test → automatic rollback on failure.

`VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` come from
`vercel link`, which writes them to `.vercel/project.json`.

### 8.3 The Docker alternative (Fly.io)

```bash
fly launch --no-deploy --copy-config --region sin
fly postgres create --name eyg-pg --region sin --initial-size 10
fly secrets set --from-env .env.production
fly deploy
```

`fly.toml` is configured: `shared-cpu-1x` / 1 GB / `auto_stop_machines`, a
`/api/health` HTTP check, forced HTTPS. The image documents a 180-260 MB steady
RSS, so 1 GB has room for the cold-start spike without paying for a second
machine.

Fly Postgres does **not** include automated backups on current plans. Run
`fly machine run scripts/db-backup.mjs` as a scheduled task instead.

### 8.4 The Docker alternative (Render)

`render.yaml` is a Blueprint: web service + Postgres 16 + a `fromDatabase`
reference so the web service waits for the database.

Two things to know before using it:

- **Render does not run cron jobs.** The five `/api/cron/*` handlers have no
  scheduler. Use an external scheduler (GitHub Actions on a `schedule:`,
  cron-job.org) that GETs the route with the shared cron secret.
- The Blueprint's `databases:` block creates a Render-managed Postgres. For a
  real shop, use a provider you control the backups for (Neon, Supabase, RDS),
  set `DATABASE_URL` as a `sync: false` secret, and delete that block.

### 8.5 Previews for PRs

`preview.yml` builds every PR against an isolated, seeded database and posts the
URL as a PR comment. It declares **no** `environment:`, so it has no access to
any production secret — and a check in that workflow fails the build if anyone
ever adds one.

To get public preview URLs for fork PRs: Vercel → Settings → Environments →
enable **Preview Deployments**. Public exposure of previews is a deliberate
choice: previews contain seeded fake data and are indexed unless the preview
domain is blocked in `robots.txt`.

---

## 9. Enabling standalone output

`next.config.ts` does **not** set `output: "standalone"`, and it is
orchestrator-owned so devops does not change it. The Docker image therefore
ships the full `.next` tree and runs `next start`.

Cost of leaving it: roughly **400 MB** of image size and **~300 ms** of cold
start. That matters on Fly; it does not matter on Vercel.

The one-line change, if the orchestrator wants it:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  // ... the rest unchanged
};
```

Then the Dockerfile's `runner` stage becomes:

```dockerfile
COPY --from=builder --chown=nextjs:eyg /app/.next/standalone ./
COPY --from=builder --chown=nextjs:eyg /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:eyg /app/public ./public
CMD ["dumb-init", "--", "node", "server.js"]
```

and the `prod-deps` stage is no longer needed.

---

## 10. Rollback

### 10.1 Code only (the common case)

```bash
# Vercel: instant, re-aliases a previous deployment
npx vercel rollback --yes

# Fly
fly releases           # find the previous release
fly rollback            # or: fly deploy --image <previous-image>

# Render
# Dashboard → Deploys → pick the previous → Manual Deploy
```

Always smoke-test after a rollback. A rollback that silently fails is worse
than no rollback, because everyone believes the site is fine:

```bash
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=3
```

### 10.2 When the schema moved too

If the deploy included an additive migration, the old code still works — the new
column is simply unused. Roll back the code only.

If the deploy included a **contract** migration (`DROP`), rollback is not
possible without a restore. This is exactly why §6.3 exists.

```bash
node scripts/db-backup.mjs --list
node scripts/db-restore.mjs --latest --target="$DATABASE_URL" --confirm=<count> --i-know-what-i-am-doing
```

The restore refuses to run without `--target`, refuses to run against a
production-looking host without `--i-know-what-i-am-doing`, and takes a
pre-restore safety dump of whatever is there now.

### 10.3 Rolling forward instead

Often better. Fix forward:

```bash
git revert <bad-sha>       # if it is already on main
git log --oneline -20      # find what broke it
# fix, PR, let CI and the smoke test prove it, then merge
```

A revert commits and proves itself through the pipeline. A manual rollback at
2am does not.

---

## 11. Post-deploy verification

The deploy workflow already does this automatically. To do it by hand:

```bash
# The full gate
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=3

# Individually
curl -s https://eygtireautocare.ph/api/health | jq
curl -sI https://eygtireautocare.ph/ | grep -iE 'strict-transport|x-frame|content-security'
curl -s https://eygtireautocare.ph/robots.txt
curl -s https://eygtireautocare.ph/sitemap.xml | head -20

# A real booking, end to end, then cancel it
# (LAUNCH-CHECKLIST.md has the five test bookings)
```

What the smoke test asserts, and why each one matters:

| Check | Fails when |
| --- | --- |
| `/api/health` 200 JSON, `no-store` | The process is up and not serving a cached lie. |
| `/api/ready` 200 JSON | The database is reachable and migrations applied. |
| `/`, `/services`, `/book`, `/deals`, `/contact`, `/gallery`, `/about`, `/privacy`, `/terms` | A page 500s. |
| Brand string + `tel:` link present on `/` and `/contact` | **The phone number disappeared.** |
| No `+639000000000` | A placeholder is live. |
| Unknown route → 404 | A missing route crashes instead of rendering `not-found.tsx`. |
| `POST /api/availability`, `POST /api/quote` return JSON | A route handler threw and returned an HTML error page. |
| Baseline security headers + CSP | A header was dropped in a deploy. |
| CSP nonce rotates per response | The nonce is hardcoded, which defeats the CSP. |
| No secret value in any HTML | A secret leaked into the client bundle. |
| `/` under 2500 ms | Something regressed badly. |

---

## 12. Troubleshooting

### The app exits immediately with "invalid environment"

That is `src/lib/env.ts` refusing to boot. It prints **the keys, never the
values**. Fix the named variable. Common causes: `AUTH_SECRET` under 32
characters; `PII_ENCRYPTION_KEY` under 32; `DATABASE_URL` not starting
`postgresql://`; `RESEND_API_KEY` and `SMTP_HOST` both set; only one half of the
Upstash pair; only some of the three Twilio values.

### `prisma migrate deploy` says "database schema is not empty"

Something created tables outside the migration history — usually a `db push`.
The fix is in [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) §7, and it
involves baselining. Do not reach for `prisma migrate reset` on a database
with real bookings.

### The build fails with "Environment variable not found: DATABASE_URL"

The builder needs the stubs in the Dockerfile's `builder` stage, or the workflow
env. Both are present. If you are building by hand outside Docker:

```bash
DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
AUTH_SECRET="build-time-stub-not-a-secret-0000000000" \
PII_ENCRYPTION_KEY="build-time-stub-not-a-secret-0000000000" \
WEBHOOK_SIGNING_SECRET="build-time-stub" \
npm run build
```

These are stubs for a compiler, not credentials. They are committed in the
Dockerfile on purpose; nothing secret is baked into a layer.

### `sharp` fails to load

```bash
npm rebuild sharp
npm ci   # if the lockfile and platform disagree
```

### Lighthouse fails but the site is fine

`lighthouse` job runs against `127.0.0.1`, where every route is a cold render.
The first request pays ISR + JIT. The CI job already retries twice. If it is
still marginal, the site is marginal for a real first-time visitor too — that
is the point of the budget.

### The smoke test passes in CI but fails against production

Almost always a `NEXT_PUBLIC_SITE_URL` mismatch, or a cached ISR page serving
the previous deploy. Check `curl -s https://eygtireautocare.ph | grep -i canonical`.

### `/admin` is reachable by anyone

`ADMIN_IP_ALLOWLIST` is empty. The deploy workflow refuses to run with it unset,
so this only happens on a hand-rolled deploy. Set it, then redeploy.

---

## 13. Status checks to require on `main`

| # | Check | Blocks deploy | Notes |
| --- | --- | --- | --- |
| 1 | `1 · validate-env` | ✅ | |
| 2 | `2 · lint` | ✅ | Zero warnings. |
| 3 | `3 · typecheck` | ✅ | Zero tolerance. |
| 4 | `4 · prisma-validate` | ✅ | Catches schema drift. |
| 5 | `5 · security-audit` | ✅ | |
| 6 | `6 · test` | ⬜ | `continue-on-error: true` until the QA suite lands. **Flip it.** |
| 7 | `7 · build` | ✅ | |
| 8 | `8 · docker-build` | ✅ | Runs the container and the smoke test. |
| 9 | `9 · lighthouse` | ✅ | Budgets are hard assertions. |

---

## Related

| Document | Read it when |
| --- | --- |
| [RUNBOOK.md](RUNBOOK.md) | Day-to-day operations |
| [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | Something is on fire |
| [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) | Any data question |
| [SECURITY-HEADERS.md](SECURITY-HEADERS.md) | Adding a third-party script |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Wiring Sentry or alerting |
| [COST-OPTIMISATION.md](COST-OPTIMISATION.md) | The bill arrived |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Before the shop goes live |
