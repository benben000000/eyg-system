# OBSERVABILITY

**EYG Tire & Auto Care**

The question this answers: **how do we know the site is broken before a
customer tells us?**

> **The one that matters.** Most of this site can be down for a week and nobody
> would know, because nothing breaks a customer's day until the moment they try
> to book. Set up the uptime check in §3 and the SMS-delivery alert in §5 first.
> Everything else is refinement.

---

## Contents

1. [The three questions](#1-the-three-questions)
2. [Sentry](#2-sentry)
3. [Uptime monitoring](#3-uptime-monitoring)
4. [Structured log shipping](#4-structured-log-shipping)
5. [Alerting](#5-alerting)
6. [Dashboards](#6-dashboards)
7. [Local development without Sentry](#7-local-development-without-sentry)
8. [Cost](#8-cost)

---

## 1. The three questions

Every observability tool should answer one of these, quickly. Anything that does
not answer one of them is not worth its cost.

| Question | Tool | Target |
| --- | --- | --- |
| **Is it up?** | Uptime monitor on `/api/health` | 99.5% |
| **Is it broken?** | Sentry | < 5 min to first alert |
| **What happened?** | Shipped logs | < 5 min to first alert |

Plus the two this shop specifically needs, which no generic setup gives you:

| Question | Tool | Why it is special |
| --- | --- | --- |
| **Can a customer actually book?** | Synthetic check + SMS delivery alert | The booking flow fails *silently*. A 200 with no SMS is not an error to any monitoring tool, and it is the worst failure this business has. |
| **Is anyone calling?** | Tap-to-call analytics | A sudden drop in calls means the phone number broke. |

---

## 2. Sentry

### 2.1 Create the project

1. [sentry.io](https://sentry.io) → create an organisation and a project
   (`eyg-tire-web`, platform: Node.js / Next.js)
2. Copy the **DSN** → `SENTRY_DSN`
3. Create an auth token (Settings → API Keys → *turborepo.replay* off,
   `project:releases` on) → `SENTRY_AUTH_TOKEN`
4. `SENTRY_ORG`, `SENTRY_PROJECT` from the project URL
5. Choose **Node 20 / Next.js 15**, keep the defaults

The project already has `@sentry/nextjs` as a dependency. The wiring is the
backend agent's; devops owns the configuration below.

### 2.2 Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `SENTRY_DSN` | production + staging + CI | The DSN is not a secret in the usual sense — it is a public write-only identifier — but keep it out of `NEXT_PUBLIC_*`, because `NEXT_PUBLIC_*` is inlined into the bundle and a DSN in the client bundle means anyone can spam your error quota. |
| `SENTRY_AUTH_TOKEN` | production only | Needed for source-map upload. **Never in staging.** It can write to the project. |
| `SENTRY_ORG` / `SENTRY_PROJECT` | production only | Together with the token. |

### 2.3 Source maps — the step everyone forgets

An unminified stack trace is unusable. A minified one is worse than nothing,
because it sends someone hunting through `t/a/e` for twenty minutes.

```bash
# In the build step, after `next build`:
npx sentry-cli releases new "eyg@$(node -p "require('./package.json').version")" --finalize
npx sentry-cli sourcemaps upload --release "eyg@$(...)" .next
```

`sentry-cli` is in the `@sentry/nextjs` package, so **no new dependency**.

> **This is the orchestrator's `package.json` and cannot be added by devops.**
> The `build` script is:
>
> ```json
> "build": "prisma generate && next build"
> ```
>
> The requested change is:
>
> ```json
> "build": "prisma generate && next build && sentry-cli releases new \"eyg@$npm_package_version\" --finalize && sentry-cli sourcemaps upload --release \"eyg@$npm_package_version\" .next"
> ```
>
> **Caveat for Vercel:** Vercel auto-uploads source maps when
> `SENTRY_AUTH_TOKEN` is set and `next.config.ts` has
> `sourcemaps: { hideSourceMaps: true }` plus the `withSentryConfig` wrapper.
> `productionBrowserSourceMaps: false` is already set in `next.config.ts`, which
> is the important half — the browser never downloads a `.map`. If the
> orchestrator does not add the wrapper, the explicit CLI upload is the
> fallback. Do not enable both: the error quota pays for the duplicate.

Verify after the first deploy:

```bash
# Trigger a deliberate error (dev only)
curl -s "https://eygtireautocare.ph/api/health?debug=throw"   # only if that exists

# Then in Sentry: the issue's stack trace must show .ts/.tsx filenames and
# line numbers, not bundle chunks.
```

### 2.4 PII scrubbing — non-negotiable

This site handles customer names, phone numbers, emails and vehicle details.
**A stack trace containing a customer's phone number is a data breach.**

Three layers, all required:

**Layer 1 — never send PII in the first place.** In the backend agent's code:

```ts
// ❌ Never: the customer's phone number is now in Sentry forever
logger.error("booking failed", { phone: customer.phone, error });

// ✅ Hash or omit. A request ID is enough to correlate with the database.
logger.error("booking failed", { requestId, bookingId, error });
```

**Layer 2 — Sentry's `beforeSend` scrubbing.** In `sentry.server.config.ts`:

```ts
const PII_KEYS = /phone|email|name|address|plate|vin|customer|notes|message/i;
const PHONE_PH = /\+?63\d{10}|\b09\d{9}\b/;
const EMAIL_PH = /[\w.+-]+@[\w-]+\.[\w.]+/;

Sentry.init({
  beforeSend(event) {
    // Scrub the message and every frame's context.
    if (typeof event.message === "string") {
      event.message = event.message.replace(PHONE_PH, "[phone]").replace(EMAIL_PH, "[email]");
    }
    if (event.request?.url) event.request.url = event.request.url.replace(PHONE_PH, "[phone]");
    event.request?.headers && delete event.request.headers.cookie;
    event.request?.headers && delete event.request.headers.authorization;

    // Recursively scrub `extra` and `contexts`.
    const scrub = (value, depth = 0) => {
      if (depth > 5 || !value || typeof value !== "object") return value;
      for (const [k, v] of Object.entries(value)) {
        if (PII_KEYS.test(k)) value[k] = "[redacted]";
        else if (typeof v === "string") value[k] = v.replace(PHONE_PH, "[phone]").replace(EMAIL_PH, "[email]");
        else scrub(v, depth + 1);
      }
      return value;
    };
    event.extra = scrub(event.extra ?? {});
    event.contexts = scrub(event.contexts ?? {});
    return event;
  },
});
```

**Layer 3 — server-side scrubbing at Sentry.** Settings → Security & Privacy →
Data Scrubbing. Add the same patterns. Layer 2 can be bypassed by a mistake;
layer 3 catches the mistake.

> **A quick audit before go-live.** Trigger one error with a customer's details
> in it, then search the Sentry issue for `+63`. If it appears, scrubbing is not
> working and the project is not ready for real customer data.

### 2.5 Sampling and noise

A Sentry project that fires 5,000 events a week from a tyre shop's website has
alarmed nobody. Every notification that is not actionable trains the team to
ignore notifications.

| Setting | Value | Why |
| --- | --- | --- |
| Traces sample rate | `0.1` | 10%. Full tracing is for debugging a specific slow path. |
| Profiles sample rate | `0.01` | |
| Replays | **Off** | A session replay records the customer's typing. On a booking form that means their name, phone and vehicle, on video. This is not a trade-off worth making. |
| Attachments | **Off** | Same reason. |
| Send default PII | **`false`** | The single most important toggle. |
| Ignore `404` | Yes | Every bot probing `/wp-login.php` is an event otherwise. |
| Ignore `/_next/static/*` | Yes | Asset 404s are not incidents. |
| Ignore health-check noise | Yes | `/api/health` polled every 30s from two regions is 5,760 events a month. |
| Ignore `429` | Yes | The rate limiter working is not an error. |

---

## 3. Uptime monitoring

### 3.1 What to monitor, and from where

**`/api/health`, not `/`.** Three reasons:

- `/` is a cached ISR page. It returns 200 from the edge even when the origin
  is dead. That is a monitoring system reporting green over a broken site.
- `/api/health` is `no-store`, touches nothing but the process, and returns
  JSON.
- It is the same endpoint the Docker `HEALTHCHECK` and the compose
  `service_healthy` use. One definition of "up" across every layer.

`/api/ready` is the deeper check — it also verifies the database. Alert on
`/api/health` at a high priority, and on `/api/ready` at a lower one. A site
that serves pages but cannot take a booking is a SEV2, not a SEV1.

### 3.2 Two regions, and why it matters here

One probe misses regional failure. **Two is the minimum, and one of them should
be outside the Philippines.**

| Probe | Where | Catches |
| --- | --- | --- |
| **Primary** | Singapore (`sin1`) — the region the site runs in | Anything that breaks the whole app |
| **Secondary** | **United States or Europe** | A Philippine ISP or DNS issue that only affects local customers |

The second probe is the one people skip, and it is the one that matters most
here. This shop's customers are on Philippine mobile networks. A probe hosted
only in Singapore will happily report "up" while Globe or Smart is failing to
resolve `eygtireautocare.ph` for everyone in Balanga. That is a SEV1 that no
amount of server-side monitoring will ever see.

A third probe from a **real Philippine vantage point** (UptimeRobot's Manila
node, or Better Stack's) is worth adding when the budget allows.

### 3.3 Configuration

Free tiers are genuinely enough:

| Service | Free tier | Notes |
| --- | --- | --- |
| **UptimeRobot** | 50 monitors, 5-minute interval | The default recommendation. Free, no account needed for the public status page. |
| **Better Stack** | 10 monitors, 3-minute interval | Better alerting and nicer logs. |
| **Pingdom** | 50 monitors | Reliable, more expensive. |
| **Cronitor** | Free | Cron-job-specific — good for §3.4. |

```yaml
monitor_name:  EYG — /api/health
urls:          [ https://eygtireautocare.ph/api/health ]
interval:      60        # seconds — a shop is small, be aggressive
timeout:       15
locations:     [ Singapore, United States ]
assertions:
  status_code: 200
  body_contains: '"status":"ok"'   # a 200 with the wrong body is still down
alert_contacts:
  - email: oncall@eygtireautocare.ph
  - slack: '#ops'      # if a webhook is configured
alert_after: 2         # consecutive failures before alerting
alert_repeat: 30       # minutes between repeat alerts
```

**Two consecutive failures before alerting.** A single failed request is a
network blip; two is a pattern. Without the `alert_after`, a flaky probe trains
everyone to ignore the alert, and then it does not alert when the site really
is down.

`body_contains: '"status":"ok"'` matters more than it looks: a Next.js error
page returns **200 with HTML**. Status-code-only monitoring sees green.

### 3.4 Monitor the cron jobs too

The five `/api/cron/*` handlers are invisible if they stop running. `expire-holds`
running every 10 minutes and a daily backup are both "quiet failures" — nothing
is visibly broken, data is just quietly wrong.

```yaml
# Heartbeat. If /api/cron/tick returns 200, the cron fired.
monitor_name: EYG — cron heartbeat
urls:         [ https://eygtireautocare.ph/api/cron/tick ]
interval:     900        # 15 minutes
assertions:
  status_code: 200
  body_contains: '"lastRunWithinBudget":true'
```

If the app has no `/api/cron/tick`, this needs building. Until then, monitor the
`Notification` table or use [RUNBOOK.md](RUNBOOK.md) §9's manual check.

### 3.5 The status page

Publish one. A free public status page means:

- You can link to it in a Facebook post instead of writing an apology.
- Customers who search "is eygtireautocare down" find an answer instead of a
  thread of speculation.
- It reduces the volume of "is it just me?" messages.

It is not an admission of weakness. Every serious site has one.

---

## 4. Structured log shipping

### 4.1 What is already there

`src/lib/logger.ts` emits **JSON lines to stdout/stderr**, one object per line:

```json
{"ts":"2026-03-01T02:17:31.442Z","level":"error","msg":"booking.confirm.failed","requestId":"req_8fa2","bookingId":"clx1a2b3"}
```

Already handled by that module:

| Property | Detail |
| --- | --- |
| Level filtering | `LOG_LEVEL`; `silent` in tests |
| Secret redaction | Any key matching `secret\|token\|password\|authorization\|cookie\|api-key\|encryption-key\|signature\|salt\|hash` becomes `"[redacted]"`, recursively to depth 4 |
| `Error` normalisation | Serialised as `{name, message}` — no stack in the log line, no accidental serialization of a Prisma object graph containing customer rows |
| Array capping | 20 elements — a runaway array cannot flood the log bill |
| `requestId` | `logger.child({requestId})` stamps every line in a request |
| stdout vs stderr | `error` → stderr, everything else → stdout. Most shippers treat stderr as higher severity. |
| `console.log` | Avoided by design; the brief forbids console noise in production |

**That is genuinely good instrumentation and it needs no change.** The remaining
work is getting the lines somewhere searchable.

### 4.2 Where the logs already go

| Platform | Where stdout/stderr ends up | Sufficient? |
| --- | --- | --- |
| **Vercel** | Dashboard → Logs, real-time, 24h (Pro) or 1h (Hobby) | **No.** Hobby gives you one hour. You cannot debug yesterday. |
| **Fly.io** | `fly logs` | Live only, and it drains. |
| **Render** | Dashboard logs, 7 days | Barely. |
| **Docker** | Wherever your log driver sends stdout | Depends entirely on the driver. |

For a business this size, one of these is enough — but **not Hobby on Vercel**,
where one hour of history is not a log.

### 4.3 Shipping to a log aggregator

| Service | Free tier | Good for |
| --- | --- | --- |
| **Axiom** | 5 GB/mo | Best value; good query language; generous free tier. **Recommended.** |
| **Better Stack** | 1M events/mo | Already used for uptime (§3); one vendor for both. |
| **Grafana Cloud (Loki)** | 5 GB/mo | Best if you want SQL-ish querying over logs. |
| **Sentry** | Included | Errors only. Do not abuse it as a log store. |
| **Papertrail** | 3 days free, then paid | Cheapest to start. |

**Axiom**, concretely:

```yaml
# In vercel.json / the platform's log config, or a drain
token: xapt-...            # Axiom ingest token
dataset: eyg-tire
```

```bash
# In CI, after a deploy, confirm logs arrive
curl -s "https://api.axiom.co/v1/datasets/eyg-tire/query" \
  -H "Authorization: Bearer $AXIOM_TOKEN" \
  -d 'query=_time > now() - 1h | limit 5 | fields ts, level, msg'
```

### 4.4 What to log, and what never to

```ts
// ✅ Log these — they make an incident diagnosable
logger.info("booking.created", { requestId, bookingId, reference, channel, serviceCount });
logger.warn("rate_limit.hit", { requestId, scope: "availability", limit });
logger.error("booking.confirm.failed", { requestId, bookingId, error });

// ❌ Never. Not even at debug level. Not even "temporarily".
logger.info("customer", { name, phone, email, vehicle });
logger.info("booking", booking);             // serialises the whole row graph
logger.debug("env", process.env);           // every secret in the system
logger.info("request.body", req.body);      // the booking form's entire payload
```

The last one is the mistake people make. A booking request body **is** a
customer record: name, phone, email, year, make, model, plate.

### 4.5 Retention

| Tier | Retain | Why |
| --- | --- | --- |
| Aggregator | 30 days | A SEV2 is investigated the same day. |
| Sentry | 90 days | Issues recur; the context is still useful. |
| Anything with PII | **0 days beyond the aggregator's own scrubbing** | Data minimisation (RA 10173). Do not archive logs containing customer data. |

---

## 5. Alerting

### 5.1 The rule that makes alerting work

> **An alert that is not actionable must not exist.**
>
> An alert that fires and nobody acts on trains the team to ignore alerts. Then
> the alert that would have saved a customer also gets ignored. This is how
> monitoring systems become actively harmful — they create a false sense of
> coverage over a blind spot.

Every alert below therefore has a **runbook link**. If you cannot write the runbook
step, do not create the alert.

### 5.2 The alerts, in priority order

**P1 — page a human, immediately, at any hour.**

```yaml
- alert: SiteDown
  expr: up{job="eyg-health"} == 0
  for: 2m
  labels: { severity: page }
  annotations:
    summary: "eygtireautocare.ph is not responding"
    runbook_url: "docs/ops/INCIDENT-RESPONSE.md#0-the-first-five-minutes"

- alert: DatabaseUnreachable
  expr: probe_success{job="eyg-ready"} == 0
  for: 3m
  labels: { severity: page }
  annotations:
    summary: "/api/ready is failing — the database is unreachable"
    runbook_url: "docs/ops/INCIDENT-RESPONSE.md#seV1--the-site-is-down"

- alert: BackupStale
  expr: time() - eyg_backup_last_success_timestamp_seconds > 90000  # 25 hours
  for: 1h
  labels: { severity: page }
  annotations:
    summary: "No successful backup in over 25 hours"
    runbook_url: "docs/ops/BACKUP-AND-RECOVERY.md#9-verifying-integrity"
```

The last one is the alert most systems omit and this business needs most. A
booking is a promise; the backup is the only way to keep it if the database
disappears. Without this, you find out that backups stopped working on the day
you need one.

**P2 — wake someone, but only during business hours.**

```yaml
- alert: BookingErrors
  expr: increase(eyg_booking_failures_total[1h]) > 5
  # Asia/Manila is UTC+8, so business hours are 01:00-11:00 UTC.
  annotations:
    summary: "{{ $value }} booking failures in the last hour"
    runbook_url: "docs/ops/INCIDENT-RESPONSE.md#seV2--the-booking-form-is-down-and-a-customer-is-standing-in-the-shop"
```

> **Why the `for` duration and the threshold are what they are.** `> 5` in an
> hour, not `> 1`: a single failed booking is usually a customer's typo, a full
> slot or a bad CAPTCHA answer. Five in an hour is a broken flow — and a broken
> flow means customers are being turned away **right now**, during opening
> hours, which is when it costs something.

**P2 — the one nobody thinks of, and the most expensive to miss:**

```yaml
- alert: SmsDeliveryFailing
  # Notification.status = 'failed'. A booking succeeds, the confirmation never
  # arrives, and the customer assumes they were not booked — and does not come.
  expr: increase(eyg_notification_failed_total[30m]) > 3
  labels: { severity: page }
  annotations:
    summary: "SMS confirmations are failing — customers are being booked but not told"
    runbook_url: "docs/ops/RUNBOOK.md#41-the-rule-about-packages-and-prices"
```

**A booking that succeeds and is never confirmed is worse than a booking that
fails.** The customer believes they are booked, does not come, and no one
contacted them. From the shop's side that is a no-show and lost revenue; from
the customer's it is being ignored. Nothing in a generic monitoring stack
catches this, because nothing threw.

**P3 — a morning digest, never a page.**

```yaml
- alert: CORSorHeaderRegression   # would be caught by CI
- alert: ErrorRateElevated
  expr: |
    sum(rate(eyg_http_5xx[24h])) / sum(rate(eyg_http_total[24h])) > 0.01
  labels: { severity: ticket }
```

**Night-shift suppression — the thing that stops 3am pages for nothing.**

The shop is open 08:00–17:00 Manila. Between 22:00 and 06:00 local, a small
site sees plenty of noise that is not an incident:

```yaml
groups:
  - name: shop-hours
    rules:
      - alert: BookingErrors
        expr: increase(eyg_booking_failures_total[1h]) > 5
    interval: 1m

      # Downgrade, do not silence. The alert still fires and still appears in
      # Slack; it just does not page anyone. Silencing means the next morning
      # nobody knows it happened.
      - alert: BookingErrors
        expr: increase(eyg_booking_failures_total[1h]) > 20
        labels: { severity: page }

      - matchers:
          - alertname = BookingErrors
        expr: |
          (hour() >= 6 and hour() < 8) or (hour() >= 22)
```

Use `timezone: Asia/Manila` explicitly. The default UTC will wake someone at
the wrong hour and it is the single most common cause of a team that starts
ignoring pages.

### 5.3 Where alerts go

| Channel | For |
| --- | --- |
| SMS to the owner's phone | P1 only. It wakes them up. It must be rare. |
| Slack/Discord webhook | Everything, with a severity label |
| Email | P3 digests only. Nobody reads email during an incident. |
| A phone call | SEV1. A message in a channel nobody watches is not an escalation. |

### 5.4 Anti-fatigue rules

1. **Every alert has a `runbook_url`.** If you cannot write the runbook step, do
   not create the alert.
2. **`for:` on everything.** No instant pages. A flapping service should not page
   anyone.
3. **Group before paging.** Five failing routes is one incident, not five.
4. **Silence has an expiry.** Every silence is time-boxed with a comment saying
   who is handling it and when it is reviewed. A permanent silence is a deleted
   alert.
5. **Downgrade at night, do not silence.** The signal is preserved; the human is
   not woken for it.
6. **Review after every incident.** If an alert fired and was not actionable, it
   gets fixed or deleted. If nothing fired and you were surprised, something was
   missing.

---

## 6. Dashboards

Six. Each answers one operational question.

**1. "Is the shop open and taking bookings?"**
`/api/health` status · `/api/ready` status · bookings created (24h) · slots
available today · current Manila time with the shop's open/closed state

**2. "Is the phone reachable?"** *(the one that catches the worst failure)*
Tap-to-call clicks (24h) · direction requests · WhatsApp clicks · a live
readout of the phone number rendered on the homepage. **A drop to zero calls
means the number broke** — and nothing else detects that.

**3. "Where does the traffic come from, and is it working?"**
Sessions by channel (organic / Facebook / direct / referral) · conversion rate ·
LCP, INP, CLS percentiles · mobile share (it will be ~85%)

**4. "Is it fast enough?"**
p50 / p75 / p95 / p99 for LCP, INP, CLS, TTFB, by page. **p95, not the average** —
the average hides the customer on a ₱3,000 Android on 3G, which is most of them.

**5. "Is anything broken?"**
Error rate by route · exceptions by fingerprint · unhandled rejections ·
`/api/cron/*` last-run times · rate-limit rejections (a spike is usually an
attack or a misconfigured limit)

**6. "What is it costing?"**
Vercel function invocations · Postgres rows and storage · Sentry event count ·
Twilio and Resend usage · AI image optimiser usage

### 6.1 Sharing them

Post to `#ops` on a schedule, or at minimum when something happens. A dashboard
nobody opens is the same as no dashboard.

The one number to put somewhere people will see it — the shop's own
`/admin` dashboard is ideal:

> **Bookings in the last 7 days: N · Live status: ● All systems operational**

---

## 7. Local development without Sentry

Leave `SENTRY_DSN` unset and the app runs with no error reporting. That is
correct, and it is the default in `.env.example`.

To test locally:

```bash
# 1. Copy .env.example to .env.local
# 2. Set LOG_LEVEL=debug
# 3. Leave SENTRY_DSN empty

# Errors print to stderr as JSON lines:
LOG_LEVEL=debug npm run dev
```

If the backend agent has added `sentry.server.config.ts` with
`enabled: process.env.NODE_ENV === "production"` or a
`SENTRY_DSN !== undefined` guard, Sentry stays off in development with no
further configuration. That guard is required — a development machine spamming
the production error quota is a real and common mistake.

Verify:

```bash
curl -s http://localhost:3000/api/health | jq
LOG_LEVEL=debug npm run dev 2>&1 | grep -c '"level":"error"'   # should be 0 at rest
```

---

## 8. Cost

| Service | Free tier | Realistic monthly cost here |
| --- | --- | --- |
| **UptimeRobot** | 50 monitors, 5-min | USD 0 |
| **Sentry** | 5,000 errors/mo | USD 0 |
| **Axiom** | 5 GB/mo | USD 0 |
| **Better Stack** | 10 monitors, 3-min | USD 0 |
| **Better Uptime** | 10 monitors, 3-min | USD 0 |
| **Grafana Cloud** | 5 GB/mo | USD 0 |

**The entire observability stack for this business is free.** The full plan —
UptimeRobot + Sentry + Axiom — fits inside USD 0/month, which is the reason
there is no excuse for shipping without it.

### Where the free tier runs out

| Limit | Realistic use | First to break |
| --- | --- | --- |
| Sentry 5,000 errors | ~50/week, without the §2.5 noise filters | **Bot 404 spam.** Ignore `404`, or you burn the quota in a day. |
| Axiom 5 GB | ~500 MB/mo of filtered JSON lines | Heavy `debug` logging in production. Keep `LOG_LEVEL=info`. |
| UptimeRobot 5-min interval | 4 monitors | Nothing. |
| Vercel function invocations | ~30k/mo at 1-min polling + real traffic | **The 60-second uptime poll.** Every poll is a function invocation. Use a monitor that does a plain HTTP GET outside the platform, or lengthen to 5 minutes. |

See [COST-OPTIMISATION.md](COST-OPTIMISATION.md) for the full picture.

---

## 9. Implementation order

Do these in order. The first two matter; the rest is refinement.

- [ ] **1. UptimeRobot on `/api/health`**, two locations, 60s interval,
      2 consecutive failures before alerting. **15 minutes. Free.**
- [ ] **2. `SENTRY_DSN` in production**, with `sendDefaultPII: false` and the
      §2.5 noise filters. **30 minutes. Free.**
- [ ] **3. `beforeSend` PII scrubbing** (§2.4). **Do this before any real
      customer uses the site**, not after. Trigger a test error, then search it
      for `+63`.
- [ ] **4. Tap-to-call analytics** on the phone number. This is the one signal
      that catches a broken phone number, and a broken phone number is the
      single most expensive thing on this site.
- [ ] **5. Source-map upload** (needs the orchestrator's `package.json` change).
- [ ] **6. SMS delivery failure alert.** The failure mode with no exception and
      no HTTP error code.
- [ ] **7. Log shipping** to Axiom. Useful for post-mortems; not urgent.
- [ ] **8. Backup staleness alert.** Until it exists, the weekly manual check in
      [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) §10 is the control.
- [ ] **9. Dashboards.** Build 1 and 2 first; the rest as the questions come up.

---

## Related

| Document | Read it when |
| --- | --- |
| [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | An alert fires |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Setting an env var, deploying |
| [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) | A data question |
| [SECURITY-HEADERS.md](SECURITY-HEADERS.md) | CSP violation reports |
| [COST-OPTIMISATION.md](COST-OPTIMISATION.md) | The bill arrived |
