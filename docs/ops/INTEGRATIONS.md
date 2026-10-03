# INTEGRATIONS — OPERATIONS RUNBOOK

**Owner:** backend-integrations · **Scope:** everything in this app that talks to the outside world.

> **The one rule this document exists to protect:** the website must work, completely, with **zero** third-party credentials configured. A missing key, a 500 from a provider, or a revoked account degrades one feature. It never takes the site down, and it never produces a fake number, a fake review, or a fake rating.

---

## 0. Contents

1. [Degradation matrix](#1-degradation-matrix)
2. [Environment contract](#2-environment-contract)
3. [Email (Resend → SMTP → no-op)](#3-email-resend--smtp--no-op)
4. [SMS (Twilio)](#4-sms-twilio)
5. [WhatsApp (zero-config deep links first)](#5-whatsapp-zero-config-deep-links-first)
6. [Reviews (Google + Facebook)](#6-reviews-google--facebook)
7. [Leads + PII encryption](#7-leads--pii-encryption)
8. [Promotions](#8-promotions)
9. [Webhooks](#9-webhooks)
10. [Rate limits](#10-rate-limits)
11. [Health, readiness, cron](#11-health-readiness-cron)
12. [Data stored and retention](#12-data-stored-and-retention)
13. [Seams](#13-seams)
14. [Owner action items](#14-owner-action-items-checklist)
15. [2am runbooks](#15-what-to-do-when-it-breaks-at-2am)

---

## 1. Degradation matrix

Read this table first. Every row is a real code path, not a hope.

| Integration | Key present | Key missing | Provider error | What the customer sees |
| --- | --- | --- | --- | --- |
| Email | Sent via Resend or SMTP | `Notification.status = skipped`, reason `no-provider-configured`, `log.warn` | `failed` after bounded retries; `log.error` with a short code | Booking succeeds. The shop reads the row on the admin board. |
| SMS | Sent via Twilio | `Notification.status = skipped` | `failed` with a Twilio code (e.g. `unreachable-carrier`) | Booking succeeds. `wa.me` button still works. |
| WhatsApp link | Always | Always | n/a — it is a `wa.me` URL | Full WhatsApp lane, no credentials at all. |
| WhatsApp API | Sent (replies only) | `skipped` | `failed` | Falls back to the `wa.me` link. |
| Google reviews | Synced hourly | `skipped`, **zero network calls** | Stale cache served; `log.warn` | Real reviews, slightly old. Or the designed empty state. |
| Facebook reviews | Synced hourly | `skipped` | `skipped` with `app-review-required` | Nothing from Facebook. Reviews come from Google or manual rows. |
| Lead capture | Row written, shop notified | Row written, alert recorded `skipped` | Row still written, alert `failed` | `201` + a `wa.me` link. Never an error page. |
| Promo claim | Row written, blurb sent | Row written, blurb `skipped` | Row written, blurb `failed` | `201` with the terms. |
| Webhooks | 200 + status applied | **401 on every request** (fail closed) | 401 | Provider retries. Nothing is corrupted. |
| Cron | Runs | 503 in production; runs with a warning elsewhere | 200 with `summary.ok = false` | Nothing — jobs are background. |
| PII encryption | Encrypted | **Passthrough** + `log.error` in production | n/a | Nothing; the site stays up. |

**Never fabricated, anywhere:** reviews, ratings, review counts, prices, plate numbers, appointment times, "as recently as" dates. An unparseable value renders as `to be confirmed` or `not given`. A database outage returns an empty list, not a placeholder.

---

## 2. Environment contract

Source of truth: `.env.example`. Read at runtime through `src/lib/integrations/env.ts`, which **never throws** — every getter has a documented default.

| Variable | Required | If unset |
| --- | --- | --- |
| `DATABASE_URL` | yes (app-level) | Integrations return empty results. `/api/ready` reports `down`. |
| `PII_ENCRYPTION_KEY` | yes in production | PII stored in cleartext. `log.error` on every write. |
| `WEBHOOK_SIGNING_SECRET` | yes for webhooks | All webhook receivers 401. |
| `CRON_SECRET` | yes in production | Cron returns 503 in production, runs in dev. |
| `RESEND_API_KEY` | one of Resend/SMTP | Email falls to SMTP, then `skipped`. |
| `SMTP_HOST` + `SMTP_USER` + `SMTP_PASSWORD` | one of Resend/SMTP | — |
| `EMAIL_FROM` | no | Falls back to a hardcoded default. **Set it.** |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` | no | SMS `skipped`. |
| `TWILIO_WEBHOOK_BASE_URL` | no | Signed-URL check falls back to `NEXT_PUBLIC_SITE_URL`. Behind a proxy, set it. |
| `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN` | no | `wa.me` links only. |
| `WHATSAPP_VERIFY_TOKEN` | no | `wa.me` links work; the **webhook receiver 401s everything**. |
| `GOOGLE_PLACE_ID` + `GOOGLE_API_KEY` | no | Reviews come from the `Review` table only. |
| `FACEBOOK_PAGE_ACCESS_TOKEN` (+ `FACEBOOK_PAGE_ID`) | no | Same. Also read directly from `process.env` — **not in `.env.example` yet**, see owner action items. |
| `SHOP_ALERT_PHONE` | no | Falls back to `BUSINESS.phoneE164`, which is `TODO-VERIFY`. |
| `SHOP_ALERT_EMAIL` | no | Falls back to `BUSINESS.emailSupport`, which is `TODO-VERIFY`. |
| `RESEND_WEBHOOK_SECRET` | no | Falls back to `WEBHOOK_SIGNING_SECRET`. |
| `LOG_LEVEL` | no | `info`. |
| `REVIEWS_CACHE_TTL_MS` | no | 30 minutes. |

> **`src/lib/env.ts` (backend-core) throws at boot** if `DATABASE_URL`, `AUTH_SECRET`, `PII_ENCRYPTION_KEY` or `WEBHOOK_SIGNING_SECRET` are missing. That is the app contract, not an integration concern. The integrations layer reads `process.env` directly and tolerates anything blank, which is why a blank `.env.local` still boots the whole site.

---

## 3. Email (Resend → SMTP → no-op)

**Code:** `src/lib/integrations/email.ts`

### What it does
Sends transactional and (consent-gated) marketing email. Provider order is **Resend → Nodemailer SMTP → no-op**, decided per call from the environment and memoised. Both provider clients are `import()`ed lazily, so a deployment missing either package still boots.

### Setup — Resend (recommended)
1. Create an account at <https://resend.com> and verify the sending domain
   (`eygtireautocare.ph`) via DNS: SPF, DKIM and a DMARC record.
2. Create an API key → set `RESEND_API_KEY`.
3. Set `EMAIL_FROM="EYG Tire & Auto Care <bookings@eygtireautocare.ph>"`.
4. Point the webhook at `https://<domain>/api/webhooks/resend` and subscribe to
   `email.delivered`, `email.bounced`, `email.complained`. Copy the signing
   secret into `RESEND_WEBHOOK_SECRET` (or rely on `WEBHOOK_SIGNING_SECRET`).

### Setup — SMTP fallback
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`.
`SMTP_USER` + `SMTP_PASSWORD` are both required when `SMTP_HOST` is set; the app
refuses to boot on a half-configured pair.

### The template
- Table-based layout only, `max-width: 600px`, every style inline. No flexbox, no
  `<style>`-dependent layout, no background images — Outlook desktop uses the Word
  rendering engine and ignores all three.
- Dark header block `#06060A` with the EYG lockup as **styled text** (no image, so it
  survives a blocked-image client) and a 4px `#FCC605` speed stripe. Works in both
  light and dark `prefers-color-scheme` without branching.
- The NAP block is read from `src/config/site.ts`. Never hardcoded.
- **Every message has a real `text/plain` alternative.** `renderEmail()` derives both
  parts from one structured object, so they cannot drift. `sendEmail()` refuses to
  send HTML-only: a caller who hand-writes HTML gets a tag-stripped text part, and
  if even that is empty a minimal stub is sent instead (logged as
  `email.text_alternative_missing`).

### Idempotency
Every send carries an `idempotencyKey`, passed to Resend as `idempotency_key` and
recorded in the `Setting`-backed ledger. A duplicate call returns
`status: "duplicate"` and sends nothing. A **failed** send releases the claim so a
genuine retry tries again.

### Rate limits
None imposed by us. Resend: 2 req/s, 100 emails/day on the free tier. Resend's own
429 is retried twice with exponential backoff, then recorded as `failed`.

### Cost
Resend free: 3,000 emails/month, 100/day. That is roughly 100 booking confirmations
a day — comfortably enough. Above that: $20/month for 50,000.

### Data stored
`Notification` row: masked recipient, subject, redacted body, status, provider id.
`Subscriber` row for marketing sends (email, `isActive`, `source`).
Never the full recipient address in the `Notification.recipient` column — it is
masked by `maskRecipient()`.

### 2am runbook
| Symptom | Check | Fix |
| --- | --- | --- |
| `email.no_provider` in the logs | `RESEND_API_KEY` or `SMTP_*` unset | Set the key. Messages already recorded as `skipped` are not retried automatically. |
| `email.smtp_send_failed` | `SMTP_HOST`, port, credentials, app password | Gmail/Google requires an **app password**, not the account password. |
| Customers report the email in spam | Check SPF/DKIM/DMARC on the sending domain, and the DMARC `p=` policy | Publish DMARC records. Resend has a domain-check dashboard. |
| `email.text_alternative_derived` | Someone called `sendEmail` with raw HTML and no `text` | Migrate the caller to `sendEmailContent()` / `renderEmail()`. |
| `email.text_alternative_missing` | A template rendered empty | Fix the content, not the transport. |

---

## 4. SMS (Twilio)

**Code:** `src/lib/integrations/sms.ts`

### What it does
Transactional confirmations, reminders, cancellations, quote-ready notices, roadside
ETA, and consent-gated promo/review requests. **Hard 160-character limit, enforced
twice:**

1. `renderSms()` in `src/content/marketing/copy.ts` throws when a template overflows.
   `notify.ts` catches that, records `Notification.status = failed` with
   `template-over-length`, and sends **nothing**. A truncated confirmation is a broken
   promise, so the design is fail-loud, not fail-quiet.
2. `fitSmsBody()` in `sms.ts` is the last line of defence. It walks **code points**
   (not UTF-16 units), so a cut can never land inside a surrogate pair, and it prefers
   the last sentence or word boundary inside the budget. Every truncation is logged
   with `sms.truncated` and the original/final lengths.

### Setup
1. <https://www.twilio.com/try-twilio> → Console → get a PH mobile number or an
   alphanumeric sender.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. All three or
   none — the app refuses to boot on a partial triple.
3. Messaging Service: in the console, set a **Status Callback URL** to
   `https://<domain>/api/webhooks/twilio`. Override the public URL when behind a
   proxy with `TWILIO_WEBHOOK_BASE_URL=https://<domain>`.
4. Register the opt-out: **Messaging → Advanced Opt-Out** → Keywords `STOP`, `CANCEL`,
   `END`, `UNSUBSCRIBE`, `REVOKE`, `OPT OUT`.

### Sender ID
- A **magic number** (`TWILIO_FROM_NUMBER` starting with `+`) works immediately.
- An **alphanumeric sender** matches `/^[A-Za-z][A-Za-z0-9 ]{0,10}$/` and is detected
  automatically (`smsConfig().fromIsAlphanumeric`). ⚠️ **See owner action items** — PH
  alphanumeric senders need registration.

### Consent and opt-out
- `marketing: true` requires `consentMarketing: true` **and** `consentSms !== false`,
  and the body carries `Reply STOP to opt out.`
- `marketing: false` (transactional) still requires `consentSms !== false`. A
  transactional message about a booking the customer made is exempt from the opt-out
  requirement but not from having the number from the customer.
- **Legal basis (Philippines):** Data Privacy Act of 2012 (RA 10173) and the National
  Privacy Commission advisory on unsolicited commercial communications. Transactional
  messages are those the customer initiated in relation to a service they are using.
  Promotional messages are not, and must carry the sender identity and a working
  opt-out.
- Refusals are recorded as `Notification.status = blocked` with the reason — never
  silently dropped, so the shop can see that a customer was not texted and follow up
  by call.

### Third-party PII guard
`thirdPartyPiiRisk()` refuses any message that contains a customer's **full name AND**
a **vehicle description** when the recipient number was not supplied by that customer.
This is why the roadside ETA template carries neither: it is read by whoever is nearby.
The guard fails **closed** — a caller that does not set
`recipientSuppliedByCustomer: true` is treated as "not supplied".

### Rate limits
Twilio PH: ~1 message/second per sender, 10,000/day. Our own limiter caps a lead form
at 4/hour and a promo claim at 5/hour, so a stranger cannot turn the shop's number into
their SMS bill. Twilio error 429 is mapped to `rate-limited` and recorded as `failed`.

### Cost
Twilio PH SMS: roughly **₱0.55 per segment** (check current pricing — it changes).
A 160-character GSM-7 message is one segment. Going over 160 splits it into two and
doubles the cost, which is why the limit is hard. Alphanumeric sender registration is
a one-off monthly fee.

### Data stored
`Notification` row: masked recipient (`+63…67`), redacted body, status, provider id.
The unmasked number lives on `Booking.customerPhone` / `Customer.phone` — that is the
shop's own CRM record, not the integration's.

### 2am runbook
| Symptom | Check | Fix |
| --- | --- | --- |
| `sms.no_provider` | `TWILIO_*` unset | Set all three. Skipped messages are not auto-retried. |
| `sms.twilio_send_failed` with `invalid-to-number` | The number is not a PH mobile | `validateRecipient()` only accepts `09XX`/`+63 9XX`. A landline is a dead end — use the call lane. |
| `sms.twilio_send_failed` with `not-messaging-enabled` | The Twilio number has no Messaging Service attached | Console → Phone Numbers → your number → configure Messaging. |
| `twilio.rejected` with `mismatch` | `TWILIO_WEBHOOK_BASE_URL` is wrong behind a proxy | Set it to the public origin. The signature is computed over the URL Twilio posted to. |
| `sms.truncated` in the logs | A template overflowed with real data | Cap `{{services}}` at three items + "+N more" (already done in `summariseServices`) or shorten the template. |
| `template-over-length` | A template is genuinely too long | Shorten it in `src/content/marketing/copy.ts`. Do not raise the limit. |
| A customer says they never got it | `Notification` row for their booking | Check `status`: `delivered` (Twilio said yes), `failed` + code (carrier problem), `blocked` (no consent — call them). |

---

## 5. WhatsApp (zero-config deep links first)

**Code:** `src/lib/integrations/whatsapp.ts`

### The primary path needs nothing
`buildWhatsAppLink(message?)` returns `https://wa.me/<number>?text=<prefilled>`. The
number and the default text come from `LINKS.whatsapp` in `src/config/site.ts`, so
the copy has one home. No Meta account, no template approval, no 24-hour window, no
API key. Every notifier returns this link in its result object, so a UI can always
offer a working WhatsApp button regardless of what the API did.

### The optional path
Set `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN` to enable the Cloud API
sender. `WHATSAPP_VERIFY_TOKEN` is required for the webhook receiver.

**24-hour customer service window.** Outside a window opened by an inbound customer
message, Cloud API only accepts *template* messages (approval + per-conversation
billing). A window opens when a customer messages the business number and lasts 24
hours. `sendWhatsApp()` therefore **refuses** unless the caller asserts
`insideCustomerServiceWindow: true`, and records `blocked` with
`outside-24h-window` otherwise. This module never initiates a conversation, so it
cannot accidentally spend a paid conversation on a broadcast.

### Setup
1. <https://developers.facebook.com> → Business app → WhatsApp → API setup.
2. Add a phone number, note the **Phone Number ID**, create a permanent access token.
3. Webhook → `https://<domain>/api/webhooks/whatsapp`, subscribe to
   `messages` and `message_status`. Set the **Verify Token** to the same value as
   `WHATSAPP_VERIFY_TOKEN` — the `GET` handshake echoes `hub.challenge` only when
   they match, compared in constant time.
4. Signature: `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the raw body>`,
   keyed with `WHATSAPP_VERIFY_TOKEN` in this implementation.

**Fail-closed:** with no `WHATSAPP_VERIFY_TOKEN`, the POST receiver rejects everything
with 401. An unverified public webhook is a forgery oracle, and the integration is
optional, so refusing is the correct default.

### Inbound customer messages
Counted and logged, **never auto-persisted**. A reply from a stranger must not be able
to create rows in the shop's books. Turning a reply into an automatic `Lead` is an
owner decision, listed below.

### Rate limits
Cloud API: 80 messages/second (application), 1,000 conversations/phone/month on
Business. We send replies only, so this is never the constraint.

### Cost
Free tier: 1,000 conversations/month. Above that, per-conversation pricing applies —
which is another reason the 24-hour guard exists.

### Data stored
`Notification` row (channel `whatsapp`), masked recipient, body, `wamid` as
`providerId`.

### 2am runbook
| Symptom | Check | Fix |
| --- | --- | --- |
| `whatsapp.rejected` with `no-secret` | `WHATSAPP_VERIFY_TOKEN` unset | Set it. Until then the receiver rejects everything — `wa.me` links are unaffected. |
| `whatsapp.rejected` with `mismatch` | The app secret and the verify token are different values | This implementation signs with `WHATSAPP_VERIFY_TOKEN`. Keep them equal, or swap the key in `verifyWhatsAppSignature`. |
| `hub.challenge` handshake fails | `hub.verify_token` mismatch | Must equal `WHATSAPP_VERIFY_TOKEN` exactly. |
| `blocked: outside-24h-window` | The customer has not messaged us in 24h | Expected. Send a `wa.me` link instead of an API message. |
| `whatsapp.inbound_message` with no shop alert | By design | Add a rule (see owner action items) if you want replies to raise a lead. |

---

## 6. Reviews (Google + Facebook)

**Code:** `src/lib/reviews/{google,facebook,aggregate,cache}.ts`, `src/app/api/reviews/route.ts`

### Google
- **Setup:** claim the Google Business Profile → **Get Place ID** → enable **Places API
  (New)** on a Google Cloud project → create an API key.
  **Restrict the key** to the Places API and add server-side IP restrictions
  (Vercel egress ranges). An unrestricted Places key found in a public repo is a
  billing incident waiting to happen.
  Set `GOOGLE_PLACE_ID` and `GOOGLE_API_KEY`.
- **Endpoint:** `GET places.googleapis.com/v1/places/{placeId}` with
  `fieldMask=id,rating,userRatingCount,reviews` — 8–10 reviews per call.
- **Degradation:** no key → `skipped`, **zero network calls**. Any HTTP failure → stale
  cache served, `log.warn`. 403 and 429 are retried once then recorded.
- **PII discipline:** only `authorAttribution.displayName` is kept — the name the
  reviewer chose to publish. `photoAttributions`, the author `resourceName` and
  `googleMapsUri` are dropped in the normaliser, not at the API edge, so no consumer
  can leak them by accident. `authorAvatarUrl` is forced to `null` on the wire.
- **Upsert:** on `(source, externalId)`. `isPublished` and `isFeatured` are **never**
  overwritten by a sync — a staff decision must not be reverted by a cron job.
- **Cost:** Places API (New) SKU: ~$32 per 1,000 requests. Hourly = 720/month = ~$23/month.
  Reduce with `REVIEWS_CACHE_TTL_MS`.

### Facebook — read this before enabling anything

> ⚠️ **Scraping Facebook violates the Facebook Terms of Service and the Data Privacy
> Act of 2012.** There is no code path in `facebook.ts` that fetches an HTML page or
> calls an undocumented endpoint, and there never will be.
>
> ⚠️ **Graph API access requires a Meta App Review.** `FACEBOOK_PAGE_ACCESS_TOKEN` alone
> is not enough. To read a page's recommendations you need:
> 1. A Business app with the `pages_read_engagement` permission.
> 2. **App Review approval** for that permission (screenshots + a working video).
> 3. The app in **Live** mode.
> 4. A page admin generating the token.
>
> Until all four are done, Graph answers `403` with `(#10)` or `(#200)`. That is
> reported as `needsAppReview: true` and a skip — **never** a crash, **never** a
> fallback scrape.

Also note: Facebook **recommendations carry no star rating**. A recommendation with no
usable rating is **dropped**, not defaulted to 5. That is the whole point of the module.

**What the shop actually gets today, with no API key at all:** a "send us your review"
link via `notifyReviewRequest`, plus `MANUAL` rows in the `Review` table for anything
the mechanic copies across from Messenger at the counter. For a 308-follower shop in
Balanga that is the higher-quality signal anyway.

### Aggregate
`getPublishedReviews({ limit, serviceTag, minRating, cursor })` orders
**`isFeatured DESC, publishedAt DESC, id ASC`**. The `id` tiebreak is load-bearing: two
reviews published in the same millisecond must not swap places between requests, or the
ETag churns and the browser refetches forever.

The **summary is computed over the whole matching set**, never the page. An average
taken from the first six of two hundred reviews is a lie, and it is the exact lie this
module exists to avoid. `average` is `null` when there is nothing to average — never
`0`, never `5`.

### Cache
- In-process, TTL 30 min (`REVIEWS_CACHE_TTL_MS`), stale window 24 h
  (`REVIEWS_CACHE_STALE_MS`).
- **Stale-while-revalidate:** a stale value is returned instantly and a background
  refresh runs. A Google outage **never blanks the homepage**.
- Single-flight: ten concurrent cold requests make one call.
- `invalidateReviewsCache()` is called by `sync-reviews` when anything changed, so
  staff see a new review immediately rather than up to 30 minutes later.
- **Known limitation:** per-process. On an active/active fleet each instance keeps its
  own cache. That is fine for a 30-minute read cache; it would need Redis only if the
  shop ever runs multi-region active/active.

### `GET /api/reviews`
`Cache-Control: public, max-age=300, stale-while-revalidate=3600` + a content `ETag`
(`If-None-Match` → 304). Rate limited on the `reads` tier (240/min, **fails open** on
infrastructure error — availability of a cached read beats a 503 for a stranded
customer).

### Data stored and retention
`Review`: source, external id, author display name, rating, title, body, service tag,
publishedAt, isFeatured, isPublished, syncedAt. Revalidated hourly; rows are never
deleted by a sync.

### 2am runbook
| Symptom | Check | Fix |
| --- | --- | --- |
| Reviews vanished from the homepage | `log.error("reviews.load_failed")` | The database is down or unmigrated. `GET /api/ready` with the probe secret. |
| Google stopped syncing | `google.fetch_failed` code | `403` = key not authorised for Places API (New). `429` = quota or rate limit. `not-initialised` = check `GOOGLE_PLACE_ID`. |
| Stale reviews keep showing | Expected during a Google outage | Stale-while-revalidate is doing its job. Fix Google; the cache self-heals. |
| `facebook:app-review-required` | Expected until App Review is granted | Nothing to fix at 2am. See owner action items. |
| Zero reviews but the shop has some on Google | Place ID wrong, or the API key lacks Places access | Verify the Place ID in the Google Business Profile dashboard. |
| Reviews show as unpublished | A staff member unpublished them | A sync never flips `isPublished`. Check the admin board. |

---

## 7. Leads + PII encryption

**Code:** `src/app/api/leads/route.ts`, `src/lib/integrations/crypto.ts`

### Defences, all of which run on every request
1. **Rate limit** — per-kind tier: roadside 4/h, newsletter 3/h, contact and tire-size
   6/h. All **fail closed** on infrastructure error: what they protect is a message to
   the shop's own phone number.
2. **Zod** — a discriminated union on `kind`. `contact` and `tire-size` require a
   message; `newsletter` requires an email and refuses a phone; every phone is
   validated as a PH mobile.
3. **Honeypot** — `website` must be empty.
4. **Min time to submit** — ≥ 2 s since render. A *missing* stamp is **not** punished
   (privacy-hardened browsers and bookmarklet posts do not send one); only an
   impossibly fast or absurdly future-dated stamp is rejected.
5. **Captcha** — required for `roadside` and `tire-size`. Turnstile when
   `TURNSTILE_SECRET_KEY` is set, otherwise the offline arithmetic challenge from
   `GET /api/captcha`. `newsletter` skips it: there is no third party to notify.

### PII encryption at rest
`name`, `phone`, `email` and `message` are encrypted with AES-256-GCM before the row is
written. Envelope (`src/lib/integrations/crypto.ts`):

```
pii.v1.<iv-b64url>.<tag-b64url>.<ciphertext-b64url>
```

The GCM auth tag is kept **separate** from the ciphertext ("auth style"), so tampering
fails closed instead of decrypting to garbage.

- **Key:** 64 hex chars, base64 of 32 bytes, or a 32-byte UTF-8 string. Anything else
  throws `PiiKeyError` — a wrong-length key is a config bug and must not silently
  degrade to "unencrypted".
- **Key absent in development:** a **no-op passthrough**, logged once per process. A
  blank `.env.local` must still work.
- **Key absent in production:** also a passthrough so the site stays up, but logged at
  `log.error` on every call with `action: "set PII_ENCRYPTION_KEY — PII is being stored
  in cleartext"`. **This is an owner action item.**
- **Readers must call `decryptPii()`.** `Lead.name` / `.phone` / `.email` / `.message`
  are ciphertext strings when a key is set. The admin board is responsible for this.
- `Review.authorName` is decrypted on the way out too, so a manually-entered encrypted
  name still renders.
- **No searchable encryption.** AES-GCM is randomised, so there is no exact-match lookup
  on a phone number. `blindIndex(value)` produces a keyed HMAC for that if it is ever
  needed; it is not a substitute for encryption.

### Notification
Every accepted lead fires `notifyNewLeadAlert()` to the shop: **email always, plus SMS
for `roadside`**. A stranded customer is a phone call, and at 2am the email is not what
the mechanic is looking at.

### Failure behaviour
No database → the lead is still answered `201` with a `wa.me` link and the failure is
logged. Telling a stranded customer "our database is down" is a worse outcome than
losing the row. No Twilio/Resend → the row is written and the notification recorded as
`skipped`; the shop sees it on the board.

### Data stored and retention
`Lead`: kind, encrypted name/phone/email/message, non-PII meta (reference, UTM, page,
which captcha ran), status, createdAt. The `meta` column is whitelisted and length-
capped because the UTM set is attacker-controlled. Retention: 24 months, then purge.

### 2am runbook
| Symptom | Check | Fix |
| --- | --- | --- |
| Leads arrive but the shop is not alerted | `NEW_LEAD_ALERT` rows in `Notification` | `skipped` = no provider. `blocked` = policy. `failed` = provider error with a code. |
| `pii.passthrough_in_production` | `PII_ENCRYPTION_KEY` unset | **Set it.** Then decide whether to re-encrypt existing rows (a one-off script). |
| `leads.persist_failed` | Database | `GET /api/ready`. |
| Everyone gets `429` on the roadside form | Real, and correct | A stranded customer is better served by a phone call than a form. Check `RateLimit-*` headers. |
| `bot.too_fast` for a real customer | Their clock is off, or they used autofill+submit | Harmless. The check is a floor, not a wall. |

---

## 8. Promotions

**Code:** `src/app/api/promos/route.ts`, `src/app/api/promos/[slug]/claim/route.ts`

### `GET /api/promos`
Ordered by `priority DESC` (a staff decision). Each promo carries a computed `isLive`
plus explicit `isUpcoming` / `isExpired` / `daysRemaining`, and `startsAt` / `endsAt`
echoed as `+08:00` ISO strings so a countdown never has to guess the offset. The shop
has no DST, so `+08:00` is exact.

**`terms` is always present.** A row with an empty `terms` array gets an explicit
"Ask us for the full terms before you book. Prices are confirmed after inspection."
substitute. A discount is never handed out without its conditions — that is both a DTI
requirement and the thing that prevents an argument at the counter.

**Impressions:** `viewCount` is incremented once per **uncached** request for live
promos, in a fire-and-forget write that can never delay or fail the response. A
CDN-cached hit does not increment. The number is "impressions on uncached requests",
documented rather than quietly overstated. Use the `claimCount` for real intent.

### `POST /api/promos/[slug]/claim`
- Rate limit 5/hour (**fails closed** — a claim sends an SMS).
- Zod against exactly the `PromoClaimInput` shape from `src/lib/types.ts`; unknown
  fields are stripped, not forwarded.
- Honeypot, min-time-to-submit, and a **mandatory** captcha (this endpoint always
  messages a third party).
- A claim on an expired, pre-armed or deactivated promo is `409 CONFLICT` with
  `details.promoStatus`, so the UI can say "that offer ended" instead of "something went
  wrong". Quietly accepting a claim on a dead promo creates a promise the counter
  cannot honour.
- Creates the `PromoClaim`, increments `claimCount` under a status guard, and enqueues
  `PROMO_BLURB`. The blurb **always carries the terms** (first two in the SMS, the full
  list in the email and behind the link).

### 2am runbook
| Symptom | Check | Fix |
| --- | --- | --- |
| `/deals` is empty | `promos.list` returning `[]` | Either no active rows, or the database is down. `isActive` + the date window. |
| A promo shows as live when it should not | `endsAt` vs. now | The window is inclusive of `endsAt`; check the `+08:00` conversion. |
| Claims fail with 409 | `details.promoStatus` | `expired` / `upcoming` / `inactive` — the window is wrong, not the code. |
| `promoValueLabel` says "Ask us for the price" | `valuePct` and `valueOff` are both null | A bundle or seasonal promo with no figure set. Set one, or accept the label. |
| `template-over-length` on a promo blurb | A long title | Shorten `title`, or the terms suffix overflows. `notifyPromoBlurb` caps terms at two lines. |

---

## 9. Webhooks

**Code:** `src/lib/integrations/webhook-verify.ts`, `src/app/api/webhooks/*/route.ts`

### The rule that matters
**Signatures are computed over the raw bytes.** `request.json()` re-serialises,
reorders keys, drops duplicate keys and normalises unicode — a signature computed over
a parsed body mismatches roughly half the time, and the tempting "fix" is to disable
verification. So every receiver reads `await req.text()` first and derives its parsed
forms from that string.

Every comparison is `crypto.timingSafeEqual`. Every failure returns a generic 401 with
no hint about which check failed; the reason goes to the log only.

| Receiver | Signature | Secret |
| --- | --- | --- |
| `/api/webhooks/twilio` | `X-Twilio-Signature` = base64(HMAC-SHA1(token, url + sortedParams)) | `TWILIO_AUTH_TOKEN` |
| `/api/webhooks/resend` | `svix-id` / `svix-timestamp` / `svix-signature` over `${id}.${ts}.${rawBody}` | `RESEND_WEBHOOK_SECRET` or `WEBHOOK_SIGNING_SECRET` |
| `/api/webhooks/whatsapp` | `X-Hub-Signature-256: sha256=<hex>` over the raw body, plus the `hub.verify` handshake | `WHATSAPP_VERIFY_TOKEN` |

Resend additionally rejects a timestamp more than 300 s from now (replay protection) and
accepts **multiple** `v1,` signatures so a secret rotation works without a forgery window.

### Idempotency on events
Every event is claimed in the `Setting`-backed ledger on the provider's own id:
`SmsSid:status`, the Svix `svix-id`, or `wamid:status`. A provider retry gets
`duplicate` and is acknowledged without re-applying. The status update is itself an
`update` on one row, so it is idempotent by nature; the ledger keeps the log honest.

Terminal states never walk backwards: a late `delivered` after a `failed` is provider
noise, not new information, and is ignored.

### Resend suppression — the most important write on the site
`email.bounced` and `email.complained` both run `suppressSubscriber()`:

- `Subscriber.isActive = false`
- `Subscriber.unsubscribedAt = now`
- `AuditLog` row with `action: "subscriber.suppressed"` and the reason (there is no
  reason column on `Subscriber`, and the schema is not ours to change)
- Creates the `Subscriber` row when missing, so a bounce on a never-subscribed
  transactional address still stops future sends

**One-directional, by design.** `suppressSubscriber()` never sets `isActive` back to
`true`, and `sendEmail()`'s `upsertSubscriber()` refuses to resurrect a suppressed
address. A complaint is permanent for that address; unsubscribing by hand is the only
way back. One complaint can cost the shop the ability to email a booking confirmation
at all, which is why this is the strictest rule in the codebase.

### 2am runbook
| Symptom | Check | Fix |
| --- | --- | --- |
| `twilio.rejected` / `resend.rejected` with `mismatch` | URL or secret drift | Twilio: `TWILIO_WEBHOOK_BASE_URL` behind a proxy. Resend: the webhook secret in the Resend dashboard. |
| `resend.rejected` with `expired` | Clock skew between the app and Resend | More than 5 minutes. Check the host's NTP. |
| `resend.rejected` with `no-secret` | `WEBHOOK_SIGNING_SECRET` unset | **Fail closed on purpose.** Set it. |
| `Notification` rows stuck at `sent` | The status callback URL is not set in the provider console | Set it. Nothing else updates delivery status. |
| A customer says an email never arrived, and their row says `skipped` | No email provider was configured | Set `RESEND_API_KEY` or `SMTP_*`. |
| `suppression_unavailable` | Resend sent a bounce with no `to` array | The `Notification.recipient` column is stored masked on purpose, so it cannot be suppressed from. Reconcile from Resend's log. |
| Webhooks returning 401 in bulk, right after a deploy | The secret was rotated | Add the new secret alongside the old; the Svix verifier accepts multiple signatures. |

---

## 10. Rate limits

The engine is `@/lib/ratelimit` (backend-core): **Upstash → Postgres → in-memory**,
with spoof-resistant keys (`rl:<tier>:<HMAC(action|ip)>[:<HMAC(subject)>]`). The IP
comes from a proxy-set header via `clientIp()`, never from a client-controllable one.

Tiers used by this layer (`src/lib/integrations/rate-limit.ts` → `ROUTE_POLICIES`):

| Tier | Limit | Window | On infrastructure error |
| --- | --- | --- | --- |
| `reads` | 240 | 1 min | **fails OPEN** — a cached read beats a 503 |
| `public` | `RATE_LIMIT_PUBLIC_PER_MINUTE` (10) | 1 min | fails CLOSED |
| `lead` | 6 | 1 h | fails CLOSED |
| `roadside` | 4 | 1 h | fails CLOSED |
| `newsletter` | 3 | 1 h | fails CLOSED |
| `promoClaim` | 5 | 1 h | fails CLOSED |
| `webhook` | 1,200 | 1 min | fails OPEN — a provider must never be throttled into retry storms |
| `cron` | 120 | 1 h | fails CLOSED |

**Why writes fail closed:** what they protect is a message to a third party from the
shop's own phone number. Availability of the *website* does not justify an open SMS
relay.

Responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `Retry-After` (RFC 9333).

Housekeeping: `sweep-rate-limits` deletes expired `RateLimitCounter` rows via
backend-core's `sweepRateLimitCounters()` (re-exported as `sweepExpiredCounters()` —
**no duplicate implementation**), expired idempotency-ledger rows, and `Notification`
rows abandoned in `queued` by a process that died mid-send.

---

## 11. Health, readiness, cron

### `GET /api/health` — liveness
`{ status, version, uptime, requestId }`. **No database call, no network call**, and it
imports nothing that can throw. A load balancer must not pull an instance because
Postgres is slow — that turns a partial outage into a total one.

### `GET /api/ready` — readiness
Checks the database (`SELECT 1`, 3 s timeout) and migrations
(`_prisma_migrations`), plus the **configuration** of email/SMS/reviews. Reports each
as `up | down | degraded` with a latency number.

Provider configuration affects `degraded`, never `down`: a Google or Resend outage must
not make an instance un-ready, because nothing depends on it being up.

- **200** ready or degraded · **503** down
- Dependency detail is returned **only** when the caller holds the probe secret
  (`Authorization: Bearer …`, `x-probe-secret`, or `x-cron-secret`). Otherwise, and
  always in production, the response is the coarse status and the `failing` list.
- Never contains a connection string, a host, a stack, a query, or a provider's raw
  error message — only stable codes: `timeout`, `unavailable`, `not-initialised`,
  `failed-migration`, `no-provider-configured`.

### Cron
`GET|POST /api/cron?job=<name>` plus four individual routes. Both paths call the same
functions.

| Route | Job | Suggested schedule | Does |
| --- | --- | --- | --- |
| `/api/cron/sync-reviews` | `sync-reviews` | `0 * * * *` | Google (+ Facebook if approved) → upsert → invalidate the reviews cache when anything changed |
| `/api/cron/expire-holds` | `expire-holds` | every 10 min | Cancels `PENDING` bookings older than `BOOKING.holdMinutes`, so an abandoned form does not consume a bay. Also sweeps rate-limit counters. |
| `/api/cron/sweep-rate-limits` | `sweep-rate-limits` | `17 * * * *` | Expired counters, expired ledger rows, abandoned `queued` notifications |
| `/api/cron/daily-digest` | `daily-digest` | `15 12 * * *` (20:15 PHT) | Counts-only summary to `SHOP_ALERT_PHONE` / `SHOP_ALERT_EMAIL` |

**Auth:** `CRON_SECRET` as `Authorization: Bearer …`, `x-cron-secret` or
`x-probe-secret`, compared in constant time. With **no secret configured, production
returns 503 and runs nothing.** Outside production it runs unauthenticated with a loud
warning so `curl localhost:3000/api/cron?job=sync-reviews` just works.

**Status codes:** 200 job ran (`summary.ok` tells you whether it worked) · 400 unknown
or missing job · 401 bad or missing secret · 503 no secret in production. **An unknown
job is always a 400, never a 500**, and the allowlist is the only thing dispatchable.

Every job is idempotent. `daily-digest` additionally claims one digest per Manila
calendar day, and releases the claim if neither channel went out so a retry works.

```bash
# Vercel / any scheduler
curl -X POST https://eygtireautocare.ph/api/cron/sync-reviews \
  -H "Authorization: Bearer $CRON_SECRET"

# preview the digest without sending it
curl "https://eygtireautocare.ph/api/cron/daily-digest?preview=true" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 12. Data stored and retention

| Data | Where | Retention | Notes |
| --- | --- | --- | --- |
| Customer name / phone / email | `Booking`, `Customer`, `QuoteRequest` | 5 years (tax) | Shop CRM record, in the clear. |
| Lead name / phone / email / message | `Lead` | 24 months, then purge | **Encrypted at rest.** |
| Notification recipient | `Notification.recipient` | 18 months | **Masked** (`+63…67`, `jo***@eyg…`). |
| Notification body | `Notification.body` | 18 months | Passed through `redactString()`. |
| Idempotency ledger | `Setting` rows prefixed `idem:` / `evt:` | 24 h / 7 days | SHA-256 of the key, never the key. |
| Rate-limit counters | `RateLimitCounter` | 1 h | Hashed keys only. |
| Suppression + reason | `Subscriber` + `AuditLog` | Indefinite | A suppression must outlive any retry. |
| Reviews | `Review` | Indefinite | Public content the reviewer published. |
| Digest contents | Nowhere | — | Counts only. No customer name, number or message, ever. |

`Notification.recipient` being masked is deliberate and it has one consequence: a
Resend bounce with no `to` array cannot be suppressed from the ledger, and the receiver
logs `suppression_unavailable` instead. Reconcile those from Resend's own log.

---

## 13. Seams

| What | Where | Swap point |
| --- | --- | --- |
| Prisma client | `@/lib/server/db` → `prisma` | `src/lib/integrations/db.ts` · `resolveClient()`. One pool site-wide. |
| Rate limiting | `@/lib/ratelimit` | `src/lib/integrations/rate-limit.ts` is a thin adapter, not an engine. |
| Rate-limit sweep | `sweepRateLimitCounters()` | `src/lib/integrations/seams.ts` · `prismaSweepCounters()`. **Re-exported, not duplicated.** |
| Captcha | `@/lib/captcha` | Used directly by `POST /api/leads` and the promo claim. |
| HTTP envelope | `@/lib/http` (`ok`, `fail`, `withApi`) | Used by every route. |
| Errors | `@/lib/errors` (`ApiError`) | Every thrown client-facing error. |
| Request context / IP | `@/lib/request` | `src/lib/integrations/api.ts` · `contextFrom()`. |
| Message copy | `src/content/marketing/{copy,email}.ts` | Never inlined in the notifier. |
| Booking → notify | `fromBookingDto(dto, consent)` in `notify.ts` | Preferred. `resolveNotifyBooking(id)` is the fallback; delete it once every call site passes a DTO. |
| Hold expiry | inline in `maintenance.ts` · `runExpireHolds()` | `src/lib/server/booking.ts` exists but exposes no age-based sweep (`bookingCounts()` counts by status). Replace when `expireStaleHolds()` lands. |

The notification layer imports **nothing** from `src/lib/server/booking.ts`, so a
change there cannot break a send.

---

## 14. Owner action items (checklist)

Ordered by how long they take. Items 1–3 are needed before launch.

### 1. ☐ Email — domain verification and deliverability
- Verify `eygtireautocare.ph` on Resend (SPF, DKIM, DMARC).
- Publish a DMARC record with `p=none` first, move to `p=quarantine` after a week of
  clean reports.
- Confirm the phone number and email in `src/config/site.ts` — both are `TODO-VERIFY`
  and are currently placeholders (`+63 900 000 0000`). **Nothing sends correctly until
  these are real.**
- Set `EMAIL_FROM` to a real mailbox.

### 2. ☐ SMS — PH sender registration ⚠️
- **Alphanumeric sender ID:** request registration from Twilio. PH alphanumeric
  senders require a **registered business name, DTI/BIR registration, and the
  express-courier/express-tender designation or a registered trade name**. Expect a lead
  time of several business days and a monthly fee. Until it is approved, use a Twilio
  **magic number** and rely on the `EYG Tire` prefix inside the message body
  (`SMS_SENDER_PREFIX` in `src/content/marketing/copy.ts`).
- **DHL/express-sender caveat:** a sender that brands itself as a courier or express
  service may be treated as impersonating a delivery company. Do **not** use a courier
  name as the sender ID without the courier's written consent.
- Register **Advanced Opt-Out** keywords: `STOP`, `CANCEL`, `END`, `UNSUBSCRIBE`,
  `REVOKE`, `OPT OUT`.
- Set the Messaging **Status Callback URL** to `https://<domain>/api/webhooks/twilio`,
  and `TWILIO_WEBHOOK_BASE_URL` if behind a proxy.
- **Legal:** RA 10173 + the NPC advisory on unsolicited commercial communications. Every
  marketing message must identify the sender and carry a working opt-out. Already
  enforced in code; this is the operational half.

### 3. ☐ Confirm the business facts
`src/config/site.ts` is the single source of truth and these are all `TODO-VERIFY`:
`phoneE164`, `phoneDisplay`, `whatsappNumber`, `email`, `emailSupport`, `lat`/`lng`,
`plusCode`, `messenger`, `trust.*` (rating value, rating count, years, bays,
technicians), and `foundedYear`. **A wrong phone number here breaks the entire
conversion ladder** — the whole site's top-of-funnel is "call the shop".

### 4. ☐ Google — API key with IP restrictions
- Claim and verify the Google Business Profile (do this even if you skip the API — it
  is the single highest-ROI local-SEO action available).
- Get the **Place ID**.
- Enable **Places API (New)** on a Google Cloud project.
- Create a key and **restrict it**: Places API (New) only, plus server-side IP
  restrictions for the Vercel egress ranges. An unrestricted key in a public repo is a
  billing incident.
- Set `GOOGLE_PLACE_ID` and `GOOGLE_API_KEY`.
- Review the Place's **Q&A** section and reply to the seed questions.

### 5. ☐ Facebook — App Review (optional, low value for now)
Only worth doing if the shop wants Facebook recommendations on the site.
- Create a Business app; add `pages_read_engagement`.
- **App Review:** screenshots of the product, a working demo video, and a plain-English
  justification. Expect days to weeks.
- Move the app to **Live** mode; generate a **page-admin** access token.
- Add `FACEBOOK_PAGE_ACCESS_TOKEN` and `FACEBOOK_PAGE_ID` to `.env.local` **and** to
  `.env.example` (these two are read directly from `process.env` and are not in
  `.env.example` yet — see the report).
- **Never scrape Facebook.** It is a ToS violation and a Data Privacy Act breach.

### 6. ☐ WhatsApp (optional)
- Meta Business app → WhatsApp → API setup; add a number, note the Phone Number ID,
  create a permanent token.
- Set `WHATSAPP_VERIFY_TOKEN` to a random 24+ character string and use the **same**
  value as the webhook Verify Token.
- Point the webhook at `https://<domain>/api/webhooks/whatsapp`, subscribe to
  `messages` and `message_status`.
- **Decide:** should an inbound customer WhatsApp message raise a `Lead` automatically?
  Today it is only logged. Recommend **no** until a staff member reviews the flow, but
  a stranded driver texting the number is the highest-value event in the system.

### 7. ☐ Secrets to generate
```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -hex 32      # PII_ENCRYPTION_KEY  (64 hex chars)
openssl rand -base64 32   # WEBHOOK_SIGNING_SECRET
openssl rand -base64 32   # CRON_SECRET
openssl rand -hex 24      # WHATSAPP_VERIFY_TOKEN
```
Rotating `AUTH_SECRET` logs every staff member out. That is intentional.

### 8. ☐ Cron scheduling
Configure the four jobs (`docs/ops/INTEGRATIONS.md` § Cron for crontab). On Vercel, add
them to `vercel.json` with `CRON_SECRET` set — Vercel sends it as
`Authorization: Bearer $CRON_SECRET`, which this app already accepts.

### 9. ☐ Reputation groundwork
Ask every satisfied customer for a Google review in the week after their visit
(`notifyReviewRequest` automates this for consented customers). Do **not** incentivise
reviews — Google penalises it, and it is not worth the risk to a 308-follower page.

---

## 15. What to do when it breaks at 2am

**First three moves, every time, in this order:**
1. `curl https://eygtireautocare.ph/api/health` — is the process up? (No database call,
   so a `200` here with a broken database is expected and fine.)
2. `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/ready` — this is
   the one that tells you which dependency is down. Without the secret you get the
   coarse status only; **that is deliberate**.
3. Grep the logs for `log.error` and the `requestId` from the response header.

Then, by symptom:

| The site is down | The site is up but nobody is getting texts | The site is up but reviews are empty | The site is up and something is wrong in a booking |
| --- | --- | --- | --- |
| Check `/api/ready` for `database: down` or `migrations: not-initialised`. If migrations are the problem, run `npm run db:deploy`. | `sms.no_provider` → `TWILIO_*` unset. `sms.twilio_send_failed` + a code → see §4. `blocked` → the customer did not consent; **call them**. | `google.fetch_failed` → §6. If the database is down, the endpoint returns an empty array and the UI shows its designed empty state. That is correct, not a bug. | Find the `Notification` rows for that booking. `failed` + a Twilio code → carrier. `blocked` → consent. `skipped` → no provider configured. `duplicate` → the idempotency ledger correctly refused a double-send. Then **call the customer**; that is what the shop does anyway. |

### Things that are NOT emergencies
- **`skipped` everywhere.** No third-party keys are configured. Working as designed.
- **`degraded` on `/api/ready`.** Email/SMS/reviews are not configured. The site is fine.
- **`facebook:app-review-required`.** Expected until App Review is granted.
- **Stale reviews during a Google outage.** Stale-while-revalidate is doing its job.
- **A `template-over-length` failure.** A content bug that the fail-loud design caught
  before a customer saw a truncated message. Fix the template; do not raise the limit.
- **`blocked: third-party-pii`.** The safety guard stopped a message that would have
  leaked a customer's name and vehicle to somebody else's phone. Working as designed.
- **`suppression_unavailable` in the Resend receiver.** The recipient column is masked
  on purpose. Reconcile from Resend's own log.

### Things that ARE emergencies
- **`pii.passthrough_in_production` in the logs.** Customer PII is being stored in
  cleartext. Set `PII_ENCRYPTION_KEY`, then plan a one-off re-encrypt of the `Lead`
  table.
- **`webhook.*.no_secret`.** A webhook receiver is accepting nothing, so delivery
  status and bounce suppression are both dark. A spam complaint that is never
  suppressed can cost the sending domain.
- **Any `Notification` row with `status: queued` for more than an hour.** Run
  `POST /api/cron/sweep-rate-limits` — it marks them `failed` so "queued" always means
  something.
- **`cron.job_completed` with `ok: false` for every run.** A scheduler is almost
  certainly not firing. Check `vercel.json` / the platform's cron config and that
  `CRON_SECRET` is set.
