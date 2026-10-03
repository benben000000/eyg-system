# COST OPTIMISATION

**EYG Tire & Auto Care** · real numbers, not vendor list prices

---

## 1. The honest starting position

This is a tyre shop in Balanga City with 308 Facebook followers. It does not
need a Kubernetes cluster. The correct target is **USD 0–20/month**, and most
configurations that reach USD 0 do it by not adding infrastructure nobody asked
for.

**A hosting bill is a real cost against a real revenue.** USD 14/month is
roughly the margin on two PMS jobs. The expensive mistake is not choosing the
expensive platform; it is paying for the expensive platform *and* not noticing
it is slow, because slow is not a line item.

---

## 2. What it should cost

### 2.1 The recommended stack: USD 0

| Component | Service | Tier | Cost |
| --- | --- | --- | --- |
| Hosting + CDN | Vercel | Hobby | USD 0 |
| Database | Neon / Supabase | Free tier | USD 0 |
| Rate limiting | Postgres counter (built in) | — | USD 0 |
| Bot protection | Arithmetic CAPTCHA (built in) | — | USD 0 |
| Email | Resend | Free (3,000/mo) | USD 0 |
| SMS | Twilio | Pay per message | ~USD 1 |
| Error tracking | Sentry | Free (5,000/mo) | USD 0 |
| Uptime monitoring | UptimeRobot | Free (50 monitors) | USD 0 |
| Logs | Axiom | Free (5 GB/mo) | USD 0 |
| Backups | Cron + object storage | Free tier | USD 0 |
| **Total** | | | **~USD 1/month** |

The free tiers are not a compromise here. They are generous because the workload
is small: a few hundred visitors a month and a booking form.

### 2.2 The paid upgrade path

When a free tier is genuinely not enough — and for this business that will be
**the database, and only the database**:

| Trigger | Upgrade | Cost | Why this trigger |
| --- | --- | --- | --- |
| Free DB hits 500 MB, or read replicas are needed | Neon Pro / Supabase Pro | USD 19–25/mo | A backup that cannot be scheduled on the free tier is not a backup. |
| More than 10,000 visitors/mo | Vercel Pro | USD 20/mo | Removes the 100 s build limit and the function-duration caps. |
| SMS volume > ~1,500 messages/mo | Twilio pay-as-you-go | ~USD 0.35/Philippines SMS | Per-message pricing already; no plan change needed. |
| 5,000 Sentry errors/mo | Sentry Team | USD 26/mo | Almost always means the §2.5 noise filters are not in place. Fix that first — it is free. |

### 2.3 The alternatives

| Platform | Realistic monthly | Verdict |
| --- | --- | --- |
| **Vercel Hobby + free DB** | **~USD 1** | **Recommended.** Static-first, cron included, zero patching. |
| Fly.io (1 machine, shared CPU, 1 GB) | USD 5–8 + DB | Use when a cron needs > 60 s or the DB must be co-located. |
| Render (starter web + starter Postgres) | USD 14 | **Render does not run cron jobs.** You need an external scheduler on top. |
| A VPS (Hetzner CX22) + self-managed | USD 5 + DB | Cheapest at scale, but now someone patches OpenSSH at 2am. Not for two people. |
| AWS / GCP / Azure | USD 40–150 | **Grossly oversized.** Do not do this. |

---

## 3. Platform comparison

### 3.1 Vercel Hobby — the default

**USD 0.** Included: 100 GB bandwidth, 1000 build minutes, cron jobs, preview
deployments, the edge CDN, automatic SSL.

**The limits that will actually bite:**

| Limit | Hobby | When it hits |
| --- | --- | --- |
| Serverless function execution | 100 s/day on Hobby | A cron that runs long, or a slow image transformation |
| Build duration | 600 s (10 min) | A large dependency tree with a cold cache |
| Cron jobs | **2 per deployment** | `vercel.json` declares 3 — **this will fail**. See §5.1. |
| Bandwidth | 100 GB/mo | Image-heavy without AVIF/WebP |
| Log retention | 1 hour | Debugging yesterday |

The one-hour log retention is the real Hobby limitation, and
[OBSERVABILITY.md](OBSERVABILITY.md) §4 exists because of it. Ship logs to
Axiom on day one — free.

### 3.2 Fly.io — USD 5–8/month

`shared-cpu-1x` (256 MB) is too small; the Dockerfile documents a 180–260 MB
steady RSS with a ~420 MB cold-start spike. Use `shared-cpu-1x` with
`memory = "1gb"`, which Fly allows.

```toml
[[vm]]
  size = "shared-cpu-1x"
  memory = "1gb"
  cpus = 1

[[services]]
  auto_stop_machines = "stop"    # ← the single most important line
  auto_start_machines = true
  min_machines_running = 0
```

**`auto_stop_machines = "stop"` is what makes Fly viable at this scale.** The shop
is idle from 22:00 to 06:00. A stopped machine costs nothing; a running one
costs ~USD 7/month whether or not anyone visits. Without it, Fly is USD 8/month
of paying for an empty server.

Cold start after a stop: 3–10 seconds. Fine — the shop's customers are on a
phone, on a road, not waiting on a page that already loaded.

### 3.3 Render — USD 14/month

`starter` web (512 MB) + `basic-256mb` Postgres. Reliable and simple, but:

- **No cron jobs.** Every `/api/cron/*` handler needs an external scheduler.
- 512 MB is tight against a ~420 MB spike. A cold start may OOM.
- 750 hours/month of instance time. One instance is fine.

### 3.4 A VPS — USD 5/month, and the hidden costs

```bash
# All of this is now your job:
apt-get upgrade && reboot          # the 2am reboot
certbot renew                      # SSL
fail2ban, unattended-upgrades      # security
pg_dump backups, WAL archiving     # data
log rotation, disk monitoring      # the disk filling at 3am
```

Cheaper on paper, and it converts a five-minute problem into a five-hour one
the first time a certificate expires or a disk fills. **Not worth it for this
business.**

---

## 4. The resource that actually costs money

### 4.1 Memory — the dominant cost on a container platform

The Dockerfile documents:

| Metric | Value |
| --- | --- |
| Steady RSS | 180–260 MB |
| Prisma query engine | ~40 MB of that |
| Cold-start spike | up to ~420 MB (ISR regeneration + JIT) |
| Configured cap | `--max-old-space-size=768` |
| Container limit | 512 MB (compose) / 1 GB (Fly) |

**Size the host at 2× steady.** A 512 MB container that spikes to 420 MB
steady-plus-spike will be OOM-killed by the shop's first Saturday-morning
booking rush.

`--max-old-space-size=768` is deliberate: without an explicit cap, Node's
default on a 64-bit host is ~4 GB, so a leak becomes a host-wide OOM kill
rather than a single-process failure.

### 4.2 Image size

| | Size | Cost effect |
| --- | --- | --- |
| With full `.next` (current) | ~600–900 MB | Slower cold start, more disk, larger registry |
| With `output: "standalone"` | ~200–300 MB | ~300 ms faster cold start |

CI warns above 900 MB. `next.config.ts` is orchestrator-owned and does not set
`output: "standalone"`; the change is one line and is documented in
[DEPLOYMENT.md](DEPLOYMENT.md) §9.

Image size only matters if you are deploying a container. On Vercel it does not.

### 4.3 Function invocations

Every serverless request costs an invocation. This matters more than people
expect:

| Source | Invocations/mo |
| --- | --- |
| Real visitors | ~2,000 |
| Uptime monitor at 60 s, × 2 regions | **~86,400** |
| Lighthouse in CI | ~200 |
| Cron jobs | ~1,500 |

**The uptime monitor is 40× the real traffic.** At a 5-minute interval it drops
to ~17,000 — a meaningful difference if you ever hit a limit.

The fix, if it matters: poll `/api/health` from outside the platform (a
GitHub Actions `schedule:`, cron-job.org) so the probe is not a platform
function invocation. Or just accept it — on Hobby, bandwidth is the limit, not
invocations.

### 4.4 Images

`next.config.ts` already sets `formats: ["image/avif", "image/webp"]`. AVIF is
~30% smaller than WebP and ~70% smaller than JPEG. For a gallery site this is
the single biggest bandwidth saving available.

Cost control:

- Gallery images: serve from the CDN, never from the serverless function.
- `sizes` on every `<Image>` so a phone does not download a 2048px image.
- **Every image needs explicit `width` and `height`.** Not for CLS reasons —
  CLS is the SEO budget, but a missing dimension also causes the image optimiser
  to be invoked with defaults, which costs more.

### 4.5 The database

The free tier is genuinely enough, with one exception:

| Provider | Free tier | Enough until |
| --- | --- | --- |
| Neon | 0.5 GB, autosuspend after 5 min | ~50k bookings |
| Supabase | 500 MB, pauses after 1 week idle | ~50k bookings |
| **Supabase free** | **Pauses after 1 week of inactivity** | **Never.** A paused database drops connections and needs a cold start on the first query. |

**A database that pauses is a database that fails at 3am on a Monday.** Use Neon,
whose free tier suspends after 5 minutes and resumes in ~1 second, or pay the
USD 19. Do not use Supabase's free tier for this site.

**Autosuspend has a second-order effect**: it drops connections, so the Prisma
pool exhausts and the first request after a suspend fails. Use a connection
pooler (Neon's pooled connection string ends in `-pooler`) and set:

```
?connection_limit=5&pool_timeout=10
```

`connection_limit=5` matters most: Vercel serverless functions each open their
own pool, and a provider's free tier often allows only ~5 concurrent
connections. The default Prisma pool size is `num_cpus * 2 + 1`, which will
exhaust it immediately under serverless concurrency.

---

## 5. Where costs actually spike

### 5.1 The five real spikes

| Spike | Cause | Prevention |
| --- | --- | --- |
| **Cron job limit** | Vercel Hobby allows **2**; `vercel.json` declares 3 → **the deploy fails outright** | Merge into one `/api/cron/tick` that dispatches by day of week. See §5.1. |
| **Vercel Pro because of build minutes** | A cold cache plus a slow build hits the 600 s limit | The Next cache and Prisma cache are keyed in `ci.yml`. Do not remove them. |
| **Sentry quota from 404 spam** | Bots probing `/wp-admin` fire thousands of events | Ignore `404`. This is [OBSERVABILITY.md](OBSERVABILITY.md) §2.5. |
| **SMS spam** | A bot submits the booking form in a loop | The `RATE_LIMIT_BOOKING_PER_HOUR` limit. **Also** alerts on `Notification.status = 'failed'`, because a bot's 400s are not failures. |
| **Database storage** | Photos in `GalleryImage` as base64, or unbounded `Lead` rows | Images as URLs, never in the database. Prune `Lead`/`Subscriber`/`PromoClaim` rows older than 24 months. |

### 5.2 The cron job limit — fix before you need to

`vercel.json` declares three cron entries and Hobby allows two. **A deploy will
fail with `CRON_JOBS_LIMIT`.**

Two options:

**Option A — merge into one dispatcher** (recommended):

```ts
// src/app/api/cron/tick/route.ts  (backend-integrations owns this)
export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (!timingSafeEqual(secret ?? "", `Bearer ${env.webhookSigningSecret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const day = new Date().getUTCDate();
  if (day % 10 === 1) await expireHolds();       // every 10 min
  if (day % 2 === 1) await noShowSweep();
  await backup();
  await expirePromos();
  await syncReviews();
  return Response.json({ ok: true, lastRunWithinBudget: true });
}
```

`vercel.json` then has a single entry:

```json
"crons": [{ "path": "/api/cron/tick", "schedule": "*/10 * * * *" }]
```

**Option B — upgrade to Pro (USD 20/mo).** Only worth it if the split jobs
genuinely need independent schedules.

### 5.3 The failure mode nobody budgets for

**Paying for a service and not using it.** Common here:

| Service | Why it is unused | Action |
| --- | --- | --- |
| Upstash Redis | The Postgres rate limiter is fine at this scale | Do not enable it. Save the free tier and the config. |
| Cloudflare Turnstile | The arithmetic CAPTCHA already works, with no third party | Do not enable it. |
| A paid error tracker | Sentry's free tier is 5,000 errors | Do not upgrade until the noise filters are in place. |
| GA4 | Plausible needs no cookie banner | Prefer Plausible. RA 10173 makes a cookie banner a real obligation. |

---

## 6. The optimisation checklist

### 6.1 Free, do today

- [ ] `formats: ["image/avif", "image/webp"]` — already in `next.config.ts`
- [ ] Explicit `width`/`height` on every image (CLS **and** optimiser cost)
- [ ] Correct `sizes` on every `<Image>`
- [ ] `connection_limit=5&pool_timeout=10` in `DATABASE_URL`
- [ ] Use a **pooled** connection string with serverless
- [ ] Neon, not Supabase free (it pauses for a week)
- [ ] `LOG_LEVEL=info` in production — `debug` costs log volume for nothing
- [ ] Ignore `404` and `/api/health` noise in Sentry
- [ ] Ship logs off-platform — Vercel Hobby keeps one hour

### 6.2 Free, do before launch

- [ ] Merge the cron jobs to satisfy the Hobby limit (§5.2)
- [ ] Self-hosted fonts — no third-party CDN, no extra DNS lookup
- [ ] No client-side analytics SDK for anything a server component can do
- [ ] Image CDN, not serverless functions, for the gallery
- [ ] `auto_stop_machines` on Fly, if Fly is the platform

### 6.3 Cheap, when revenue allows

- [ ] Neon Pro (USD 19) — **the highest-value upgrade on this list.** The free
      tier's limits are the ones that would hurt on the worst day.
- [ ] Vercel Pro (USD 20) — when builds hit 10 minutes or traffic passes
      10,000 visits/month
- [ ] An external uptime poller, if function invocations ever become a constraint

### 6.4 Do not buy

- Kubernetes, ECS, or any orchestrator
- A dedicated server
- A paid error tracker before the noise filters are in place
- A CDN in front of a CDN
- Premium support on anything at this scale — the vendor will not answer

---

## 7. Monitoring the bill

### 7.1 Monthly, 15 minutes

```bash
# 1. Vercel → Settings → Usage. Check:
#    - Function invocations vs. the quota
#    - Bandwidth vs. 100 GB
#    - Build minutes used vs. 1000

# 2. Database provider → the storage graph. A sudden jump means images are
#    being stored in the database.

# 3. Twilio → the monthly spend. A jump means the booking rate limit is off.

# 4. Sentry → the event count. Approaching 5,000 means the noise filters are
#    not working, and the next month will need a USD 26 plan.

# 5. Reconcile against §2.1. Anything above USD 20 needs an explanation.
```

### 7.2 Set a hard alert

```yaml
- alert: MonthlySpendAnomaly
  expr: spend_usd_month > 20
  for: 1h
  labels: { severity: page }
  annotations:
    summary: "Monthly infrastructure spend is above USD 20 (expected ~USD 1)"
```

For a business this size, USD 20 is not a rounding error — it is margin. An
alert at that number catches a runaway cron, a bot loop, or a provider quietly
moving to a paid tier.

---

## 8. What the money should go to instead

Worth saying plainly, because the most reliable cost reduction here is not
technical:

| Investment | Cost | Likely return |
| --- | --- | --- |
| **Google Business Profile, fully completed** | Free | The single highest-ROI asset for a local tyre shop. Photos, hours, correct NAP. |
| **Real photos of real work** | Free | Stock photos presented as their own work is forbidden by the brief, and it also does not convert. |
| **Google Ads, local, small radius** | USD 100–300/mo | Only after Business Profile and reviews are right. Ads on top of a weak profile waste the money. |
| **A second phone line for bookings** | USD 10/mo | Direct, trackable, and it works when the website is down. |
| **Paid uptime + alerting beyond the free tier** | USD 0–10/mo | Only if the free tier is being ignored. Fix the process first. |

**The order matters.** Google Business Profile and real photos are free and
outrank anything in this document. Infrastructure is the last line of the
budget, not the first.

---

## 9. Summary

| | Cost | When to change it |
| --- | --- | --- |
| **Today** | **~USD 1/month** | — |
| **First upgrade** | Neon Pro, USD 19 | When the free DB tier becomes the constraint |
| **Second** | Vercel Pro, USD 20 | When builds hit 10 min, or traffic passes 10k/mo |
| **Floor for a properly run shop** | **USD 20–40/month** | |
| **If anyone proposes more** | Ask what problem it solves | A tyre shop with 308 followers does not need more infrastructure |

---

## Related

| Document | Read it when |
| --- | --- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Platform setup |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Free-tier limits on Sentry and Axiom |
| [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) | Storage costs |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Before go-live |
