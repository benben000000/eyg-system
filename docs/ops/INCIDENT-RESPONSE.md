# INCIDENT RESPONSE

**EYG Tire & Auto Care** · Balanga City, Bataan · `+63 917 123 4567`

Written to be followed at 2am by someone tired. Read the first section, do the
first five steps, then come back and read the rest.

> **This site has one job:** get a customer who is stranded on EGSA Fourlanes to
> a human on the phone. Every decision below is ranked by that, not by
> engineering elegance. A degraded booking form that still shows the phone
> number beats a perfect site that 500s.

---

## 0. The first five minutes

Do these in order. Do not skip step 3.

### 1. Is the site actually down?

```bash
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=1
```

This tells you which check failed, which is most of the diagnosis. "Site is
down" is not a symptom; "`/api/health` returns 500" is.

### 2. Is it us or is it the network?

```bash
# From your phone, on mobile data — not the office wifi
curl -sI https://eygtireautocare.ph | head -3

# Is anyone else seeing it?
# Status page / Vercel status / a quick check from a different network
```

If it works on wifi and not mobile data, the problem is local.

### 3. Get the phone number on the front page. **Now.**

This is the step that saves the day, and it takes 30 seconds.

- If `/admin` is reachable, check whether a maintenance page is set.
- If not: `npx vercel rollback --yes` (see §4). The previous deployment is almost
  always fine.
- If nothing is working: **print the fallback card and put it on the counter
  right now.** The template is in [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) §16.
  It takes five minutes to write and it is the difference between a customer
  calling the shop and a customer standing in the rain.

> **If a customer is standing in the shop right now:** do not debug. Hand them
> the phone. Continue investigating after they are served. See §SEV2.

### 4. Was it a deploy?

```bash
# Recent deploys
npx vercel ls
gh run list --workflow=deploy-production.yml --limit=5
```

A deploy in the last 30 minutes is the prime suspect. Roll back (§4).

### 5. Is the database reachable?

```bash
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph   # check /api/ready
```

`/api/health` failing = the process is down.
`/api/health` passing but `/api/ready` failing = the database is the problem.

---

## 1. Severity

| Level | Definition | Examples | Response |
| --- | --- | --- | --- |
| **SEV1** | **The site is down, or the database is gone.** No bookings, no phone link, no pages. | 5xx on every page; DB unreachable; a leaked credential; a `DROP` migration applied | Wake someone up. Page the owner. |
| **SEV2** | **Booking is broken; the rest works.** A customer can still call. | `/book` 500s; `/api/booking` throws; SMS never arrives; slots show as full when they are not | Fix during the day, but treat as urgent. |
| **SEV3** | **Degraded but usable.** | Images slow; one page slow; a missing review feed; a broken redirect | Fix in the next normal cycle. |
| **SEV4** | Cosmetic. | A typo; a wrong alt text; a 404 on an unused route | Backlog. |

**When in doubt, call it a SEV2 and treat it as a SEV1.** Over-escalating costs
an hour. Under-escalating costs a customer.

### Who is on call

| Role | Who | Covers |
| --- | --- | --- |
| Primary on-call | `@acme/devops` | Everything technical |
| Business owner | shop owner | Anything involving a price, a claim, or a customer complaint |
| Escalation | `@acme/lead` | SEV1, anything involving customer data, anything involving money |

There is no rotation and no follow-the-sun. This is a two-person team and a
business with 308 followers. The honest model is: **one person is responsible
for keeping the lights on, and the other is a phone call away.**

Out of hours, the escalation path is a phone call, not a Slack message.

---

## 2. The scenarios

### SEV1 — The site is down

**Symptoms.** `/api/health` returns 5xx or times out. Every page fails.

**First five minutes.**

1. Run the smoke test. Capture the output.
2. Put the phone number on the front page (§0 step 3).
3. Check the deploy history. A deploy in the last hour → roll back.

**Diagnosis tree.**

```bash
# Is the health endpoint itself failing?
curl -sS -w '\nHTTP %{http_code}\n' https://eygtireautocare.ph/api/health

# 404/405 on /api/health → the deployment is broken or the route is missing
# 500 with a boot error   → the environment is invalid (see DEPLOYMENT.md §12)
# timeout                 → the platform is down (check the Vercel/Fly status page)
```

| Cause | Fix |
| --- | --- |
| A bad deploy | `npx vercel rollback --yes`, then smoke test |
| Invalid environment | `npx vercel env ls production`, fix the named key, redeploy |
| Database unreachable | Check the provider's status page and the connection limit |
| Provider outage | Wait. Communicate. See §6. |
| Build artifact broken | Roll back; investigate off-hours |

**Recovery.**

```bash
npx vercel rollback --yes
sleep 10
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=3
```

Then confirm a real booking works end to end. A rollback that restores 200s but
leaves `/book` broken is not a recovery.

**Close it.** Write down: what broke, when, how long, what fixed it, and the one
change that would have caught it. That last part is the only part that matters
tomorrow.

---

### SEV2 — The booking form is down and a customer is standing in the shop

**This is the scenario this section exists for.** It is the most likely SEV2 in
this business and the most consequential.

#### Situation

It is 10:40 on a Saturday. A customer's tyre is flat on EGSA Fourlanes. They
walked or drove into the shop. They tried to book on the website. It failed.
They are standing in front of you.

#### What the customer needs

**A booking.** Not an explanation, not a link to a status page, not "let me
check". The person in front of you needs to know when their car is being worked
on, and they need it in the next sixty seconds.

#### Do this, in this order

**1. Book them by hand. Right now. Before debugging anything.**

```bash
npm run db:studio
```

Create a `Booking` row:

| Field | Value |
| --- | --- |
| `reference` | `EYG-WALKIN-001` (unique — use the sequence) |
| `customerName` | Their name, as they give it |
| `customerPhone` | E.164: `+639171234567` |
| `customerEmail` | Only if they offer it. Do not ask. |
| `startAt` | The slot you are giving them |
| `status` | `CONFIRMED` |
| `channel` | `WALK_IN` |
| `consentSms` | Only if they say yes |

Then `BookingEvent` with `to: CONFIRMED`, so the audit trail is honest.

**Why this is first:** the customer is in the room. The database is not. Every
minute spent debugging is a minute they are standing there.

**2. Say this to them.**

> "Sorry about that — the website is having trouble. I've got you down for
> [time] right now. Is a text number best for your confirmation?"

That sentence does three things: acknowledges, solves, and confirms you will
keep contact. Do not apologise more than once; over-apologising reads as panic.

**3. If a hand-entered booking is not possible** (the database is also down —
SEV1):

- Write it on paper. Name, phone, vehicle, service, time.
- Tell them: *"I've written you in for [time]. We'll text you when it's
  confirmed — if you don't hear from us by [hour], please call."*
- Enter it into the system as soon as it is back.
- **Call them yourself if the text does not arrive.** A paper booking nobody
  confirms is how a customer arrives at a slot that is not theirs.

**4. Only now, diagnose.**

```bash
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph
# Look for: "POST /api/availability answers JSON" or "POST /api/quote answers JSON"
```

| Symptom | Cause | Fix |
| --- | --- | --- |
| `POST /api/booking` returns HTML | The handler threw — an unhandled error | Roll back; check the logs |
| `/book` renders but the submit 500s | Same | Roll back |
| `/book` 404s | The route file is missing or was moved | Roll back |
| Availability always returns "no slots" | `BayClosure` over-covers, or a bad timezone | [RUNBOOK.md](RUNBOOK.md) §5 |
| Submission succeeds, no SMS arrives | Twilio not configured, or the number is wrong | [RUNBOOK.md](RUNBOOK.md) §4.3 |
| Submission succeeds twice | No idempotency key | Roll back; reconcile the duplicates |

**5. After the fix, contact everyone affected.**

```sql
SELECT reference, "customerName", "customerPhone", "createdAt"
FROM "Booking"
WHERE "createdAt" > '<first failed attempt>' AND channel = 'WEB';
```

Call each one. A customer who tried to book during the outage and got nothing is
a customer who assumed you were closed.

#### Prevention

This failure is not acceptable to repeat, and the prevention is boring:

- [ ] The smoke test covers `POST /api/booking` — **not just availability and
      quote**. It currently does not; that is a known gap in §7.
- [ ] The printed fallback card exists and is at the counter.
- [ ] Someone at the shop knows they can book by hand.
- [ ] The availability endpoint is covered by a test.

---

### SEV3 — Degraded

**Symptoms.** One page is slow. Images take 5 seconds. A review feed is empty.
An OG image 404s in a Facebook share.

**Handle it.** Open an issue. Fix it in the next normal cycle. Do not page
anyone.

**The exceptions** — these are SEV3 until they are not:

| Symptom | Becomes |
| --- | --- |
| Lighthouse LCP > 4 s | SEV2 if conversion is visibly affected |
| `/og/default.png` 404s | **SEV2.** Every shared Facebook link renders as a bare URL. It is the shop's cheapest marketing channel. |
| `robots.txt` disallows everything | SEV2. The shop disappears from Google. |
| `sitemap.xml` 500s | SEV2, same reason. |
| A redirect loop | SEV2. Google drops the site; customers see a browser error. |
| A cert expired | SEV1. Browsers show a full-page warning; most people do not proceed. |

```bash
curl -sI https://eygtireautocare.ph | grep -iE 'content-type|strict-transport'
curl -s https://eygtireautocare.ph/robots.txt
curl -s -o /dev/null -w '%{http_code}\n' https://eygtireautocare.ph/sitemap.xml
curl -s -o /dev/null -w '%{http_code}\n' https://eygtireautocare.ph/og/default.png
```

---

### SEV1-SEC — A secret leaked

**This overrides every other severity.** A leaked credential is a breach the
moment it lands in a public place, regardless of what the website is doing.

#### The rule

**Revoke first. Clean history second. Never the other way round.**

Once a secret is in a public git history, treat it as public. Removing the
commit does not unpublish it — forks, caches, `archive.org` and every scraper
that saw it in the intervening minutes still have it. Rotation is the only
remedy that actually works.

#### Procedure

**1. Stop the bleeding.**

```bash
# Revoke at the provider. Do this in the provider's console, not in code.
#   RESEND_API_KEY     → resend.com → revoke
#   TWILIO_AUTH_TOKEN  → console.twilio.com → revoke
#   UPSTASH_REDIS_REST_TOKEN → console.upstash.com → delete
#   SENTRY_AUTH_TOKEN  → sentry.io → revoke
#   VERCEL_TOKEN       → vercel.com → revoke
#   DATABASE_URL       → the provider → rotate the password
```

**2. Check whether it was actually used.** A credential that was public for
four minutes in a repository with no traffic is very different from one that sat
in `main` for a month.

```sql
-- Bookings created outside normal hours
SELECT "createdAt", reference, channel FROM "Booking"
WHERE "createdAt" > '<exposure start>' AND "createdAt" < '<rotation time>'
ORDER BY "createdAt" DESC;

-- Admin activity
SELECT "createdAt", action, entity, ip FROM "AuditLog"
WHERE "createdAt" > '<exposure start>' AND "createdAt" < '<rotation time>';

-- Auth activity
SELECT email, "lastLoginAt", "failedLogins" FROM "User" ORDER BY "lastLoginAt" DESC NULLS LAST;
```

For `AUTH_SECRET`: rotate, and **every session is now invalid.** That is fine
and is the correct outcome. Say so in the internal note.

For `PII_ENCRYPTION_KEY`: **do not rotate casually.** It is the key that decrypts
the PII columns. See [DEPLOYMENT.md](DEPLOYMENT.md) §4.5 — you need the physical
copy and a re-encryption plan.

**3. Rotate.**

```bash
AUTH_SECRET=$(openssl rand -base64 48)
PII_ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_SIGNING_SECRET=$(openssl rand -base64 32)

npx vercel env rm AUTH_SECRET production
npx vercel env add AUTH_SECRET production          # enter the new value
# … repeat for each
npx vercel --prod
```

**4. Then, and only then, clean the history.**

```bash
# Identify the commit
git log --all -S '<the leaked fragment>' --oneline

# If it was ever on main, treat it as public and do not bother rewriting
# history for a short-lived fork branch.
```

Rewriting `main` history invalidates every clone and every open PR. Only do it
when the exposure window was long and the repository is genuinely public.

**5. Notify.**

Whether you must tell anyone depends on what leaked and for how long. **Ask the
owner.** Do not make that call alone, and do not wait for permission to
mitigate — mitigate first, talk second.

**6. Add the detection so it cannot happen silently.** `gitleaks` now runs on
every push (§ `secret-scan.yml`). If it did not catch this one, its rules need
extending. That is a required follow-up, not a nice-to-have.

---

## 3. Common causes and their fixes

| Symptom | Likely cause | First thing to try |
| --- | --- | --- |
| 500 on every page | A bad deploy | Roll back |
| 500 with "invalid environment" | A missing/invalid env var | `vercel env ls production` |
| `/api/health` 200, pages 500 | The DB is down or over its connection limit | Provider dashboard; `pg_isready` |
| Everything slow | Cold ISR + no cache after a deploy | Wait 60s, then measure again |
| `/book` 404 | A route file was moved or deleted | Roll back |
| Availability returns no slots | `BayClosure` over-covers, or a timezone bug | [RUNBOOK.md](RUNBOOK.md) §5 |
| Bookings succeed, no SMS | Twilio unset or the wrong `FROM` | `vercel env ls` |
| A cert error | An expired cert or a DNS misconfiguration | Provider dashboard |
| A redirect loop | `next.config.ts` redirects vs. the platform's | Roll back |
| It works on wifi, not mobile data | Local network, not the site | Test on a phone hotspot |
| It is fine now and was broken before | A provider blip | Do not chase it. Note the time and check the provider's status page |

---

## 4. Rollback

```bash
# Code only — the common case, and it is instant
npx vercel rollback --yes

# Verify. Always. A rollback that silently failed is worse than none.
sleep 10
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph --retries=3
```

If the schema moved, read
[DEPLOYMENT.md](DEPLOYMENT.md) §10.2 before touching anything.

`deploy-production.yml` does this automatically on a failed live smoke test,
including re-verifying the rollback. If the rollback also fails, that is a
SEV1 with no automated path left — escalate.

---

## 5. Escalation

| When | To | How |
| --- | --- | --- |
| SEV1 | `@acme/lead` | Phone, then message |
| A leaked secret | `@acme/lead` **and** the owner | Phone. Immediately. |
| Anything involving money | The owner | Phone |
| A customer complaint or injury | The owner | Phone, before replying publicly |
| A data-loss question | `@acme/lead` | Phone |
| SEV2, during business hours | Fix it | — |

Out of hours, a phone call is the escalation. A message in a channel nobody is
watching is not an escalation.

---

## 6. Communication

### 6.1 The rule that matters most

**Get the phone number in front of the customer before you explain anything.**

A customer who cannot reach the shop has already failed, regardless of how good
your status page is. A customer who can reach the shop has been served, even if
the website is down.

### 6.2 Internal (Slack/Discord)

```
🔴 SEV2 — booking form down, rest of site up
Since:   10:40 (started during the Saturday rush)
Impact:  Customers cannot book online. Phone bookings unaffected.
         One walk-in affected so far, booked by hand.
Now:     Rolled back to <sha>, smoke test passing.
Next:    Diagnosing whether <sha> caused it. Update in 30 min.
Owner:   @acme/devops
```

Facts, not reassurance. The owner is deciding whether to post something on
Facebook, and they need the real impact, not "we are on it".

### 6.3 Public — status page

Post when customers are affected, not when you are stressed.

```
We are aware of a problem with online bookings. The site and the phone line are
working normally — if you need a bay today, please call or message us and we
will sort you out.

Updated: <time>
```

**Do not** post a raw error message, a stack trace, an incident number, a
post-mortem before it is finished, or anything blaming a provider by name before
their status page does.

### 6.4 Facebook — the one that actually matters

Most of this shop's audience sees Facebook first and the website second. A
Facebook post reaches more people than the whole website.

```
Website issue this morning — online booking is sorted now, but if you were
planning a tyre or PMS while we were fixing it, just message or call and we'll
make sure you're looked after.

Thanks for your patience 🙏
```

Write it from the shop, in plain language, as a person. No incident numbers, no
`SEV2`, no status-page links.

### 6.5 To a customer directly

**If their booking failed:**

> Hi [Name] — you tried to book on the website around [time] and it didn't go
> through, and I'm sorry about that. Can I book you in for [time] instead?
> [Phone / Messenger]

Own it, offer the fix, do not explain the architecture.

**If you do not know who they are:**

> Hi! We had a problem with the booking form earlier today. If you tried to book
> and it didn't work, message us your preferred time and we'll sort you out.

**Never** disclose another customer's details to explain a failure, even to prove
you were right.

---

## 7. After the incident

Within 24 hours, for anything SEV1 or SEV2:

1. **Write it down.** What happened, when, how long customers were affected,
   what the impact was in bookings, what fixed it.
2. **One action item that prevents this specific failure.** Not five. One.
   A site that accumulates post-mortem action items has no post-mortem action
   items.
3. **Check the smoke test covers it.** If the failure was not covered, that is
   the action item.

### Known gaps in the current coverage

Honest, so nobody assumes the gate is stronger than it is:

| Gap | Consequence | Fix |
| --- | --- | --- |
| The smoke test does not POST to `/api/booking` | The SEV2 scenario above is not caught automatically | Add a deliberately-invalid `POST /api/booking` that must return JSON, not HTML. Backend agent owns the route; devops owns the assertion. |
| Availability is only tested with an invalid payload | A valid-but-wrong response shape passes | Add a valid probe for a date far in the future |
| No synthetic "book a real slot" check | A silent booking failure goes unnoticed | Playwright (QA agent owns `playwright.config.ts`) |
| No alerting on SMS delivery failure | A booking succeeds and the customer never hears about it | Alert on `Notification.status = 'failed'` — [OBSERVABILITY.md](OBSERVABILITY.md) §5 |

---

## Related

| Document | Read it when |
| --- | --- |
| [RUNBOOK.md](RUNBOOK.md) | The specific task you need to do |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Rollback details, env vars, platforms |
| [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md) | Data is missing or wrong |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Setting up the alerting that would have caught this |
| [SECURITY-HEADERS.md](SECURITY-HEADERS.md) | A security question |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | The fallback card, §16 |
