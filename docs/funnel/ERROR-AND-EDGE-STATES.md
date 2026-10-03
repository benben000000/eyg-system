# ERROR, EMPTY & EDGE STATES

**Owner:** funnel agent · Applies to every route.
**Contract:** `API_ERROR_CODES`, `ApiResult`, `ApiFailure.error.fields`, `ApiMeta.retryAfter`,
`ApiMeta.requestId`

Every row below has five parts: **trigger → what the user sees → exact copy → recovery →
telemetry**. A state without a recovery action is not a state, it is a dead end, and a
dead end on this site costs a customer who is already in a hurry.

---

## 0. Global principles

1. **The phone always survives.** Every error state on every route keeps a
   `tel:`-reachable `Call Shop Now` within one thumb-reach, unless the state *is* a
   successful booking. There is no exception to this rule.
2. **Never blank the page.** An error replaces a region, not the document. The header,
   the nav and the footer stay exactly where they were.
3. **Never lose typed data.** Every form state preserves its values on failure and
   offers the same button back. The only thing a customer has to retype is what they
   themselves deleted.
4. **Say what happened, say what to do, don't apologise to a system.** No `Oops!`, no
   `Uh oh`, no `Something went wrong`, no `Please try again later` on its own.
5. **Show the support reference.** `ApiMeta.requestId` is displayed in `text-body` 12 px
   `muted-foreground` on every 5xx and on the `error.detail` slot. It is the only way
   the owner can find the request in the logs, and it is the difference between a
   customer who calls and a customer who gives up.
6. **Colour is never the only signal.** Every error, success and warning state pairs its
   colour with an icon **and** a text label (`ACCESSIBILITY-SPEC.md` §1).
7. **Never a spinner over 400 ms.** Skeletons for first load, a determinate inline bar
   for a submit the user is waiting on, then the error state. Never an infinite spinner.

---

## 1. HTTP error pages

### 1.1 `404` — unknown page

| Field | Value |
| --- | --- |
| **Trigger** | Any route not in the page map, or a deleted page. Also a 404 from a nested API the page depends on **when nothing can be rendered without it**. |
| **User sees** | Full page. `h1`, one paragraph, `Call Shop Now` (emergency, primary), `Go to the homepage` (secondary), `See all services` (tertiary). Hazard hatch strip at the top. `pb-action-bar` padding applies. |
| **Copy** | `h1`: `We don't have that page.` · body: `The link may be old, or we may have moved something. Here's the way back.` · request ref (only when the 404 came from a server render with a requestId): `Reference: {requestId}` |
| **Recovery** | `Go to the homepage` → `/` · `See all services` → `/services` · `Call Shop Now` → `LINKS.call` |
| **Telemetry** | `error_shown{code:"NOT_FOUND", page:<path>, source:"route"}` |
| **Never** | A branded splash that hides the nav. A search box pretending the site is large. A `404` in giant numerals as the headline. |

### 1.2 `404` — deleted or deactivated service

| Field | Value |
| --- | --- |
| **Trigger** | `/services#svc-{slug}` for a service with `isActive: false`, or a service removed from a basket mid-session, or an estimator selection containing a dead id. |
| **User sees** | In-place notice above the service grid, `role="status"`. The grid still renders every other active service. If the service was the whole page (`/services?service={slug}`), the notice replaces the detail region and the grid follows below it. |
| **Copy** | `This service isn't on our list right now. It may have been renamed or retired.` · link: `See current services` |
| **Recovery** | `See current services` → `/services` (fragment preserved if the category is still valid) |
| **Telemetry** | `error_shown{code:"NOT_FOUND", reason:"service_deactivated", service_slug}` |
| **Never** | A hard 404 redirect. Losing the customer's other selections. A "coming soon" on a retired service. |

### 1.3 `404` — expired or unknown promo code

| Field | Value |
| --- | --- |
| **Trigger** | `promoCode` present in the estimator or the booking that the server cannot resolve, is past `endsAt`, is before `startsAt`, or has `isActive: false`. |
| **User sees** | Inline error directly under the promo input. **The estimate still renders**, undiscounted. The booking still proceeds, undiscounted. |
| **Copy** | not found: `We don't have a code "{code}". Check the spelling, or ask us on Messenger.` · ended: `{CODE} ended on {dateLong}.` · not started: `{CODE} starts on {dateLong}.` · already used: `You've already used {CODE} on a previous booking. One per customer.` · wrong scope: `{CODE} applies to services and labour, not to tyres.` |
| **Recovery** | Edit and re-apply · `See what's on now` → `/deals` (only on the `ended` variant) · `ask us on Messenger` |
| **Telemetry** | `error_shown{code:"NOT_FOUND", reason:"promo", promo_code, stage}` where `stage ∈ {estimator, booking}` |
| **Never** | Silently dropping the code with no message. Blocking the estimate or the booking over a discount. Saying the code is "invalid" (that implies the customer typed it wrong). |

### 1.4 `403` — forbidden

| Field | Value |
| --- | --- |
| **Trigger** | `/admin` without a session, or an expired/locked staff session, or a session cookie that fails rotation. |
| **User sees** | A staff-facing page, deliberately plain (no marketing chrome beyond the logo). `h1`, one line, one call button. |
| **Copy** | `h1`: `You can't see that page.` · body: `If you think you should be able to, call us and we'll help.` · button: `Call Shop Now` |
| **Recovery** | `Call Shop Now` → `LINKS.call` · (a visible `Sign in` link is allowed **only** on `/admin` and only when no session cookie exists at all — never on a 403 caused by a *failed* session, which would loop) |
| **Telemetry** | `error_shown{code:"FORBIDDEN", page, reason:"no_session" \| "session_expired" \| "session_locked"}` |

### 1.5 `429` — rate limited

| Field | Value |
| --- | --- |
| **Trigger** | `ApiErrorCode === "RATE_LIMITED"` from booking, quote, lead, promo-claim or contact, **or** an edge/middleware 429. `ApiMeta.retryAfter` is present. |
| **User sees** | The form **stays populated**. The submit button is replaced by a countdown panel, `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. A `Call Shop Now` secondary appears. The mobile action bar switches to `single-call` (full-width) — see `CTA-MAP.md` §5. |
| **Copy** | `h3`: `Slow down a moment.` · body: `Too many attempts from this connection. Try again in {n} seconds.` · `{n}` counts down from `retryAfter` and is re-announced **once per 10 seconds only** (a per-second announcement is hostile to a screen-reader user) · secondary: `In a hurry? Call the shop and we'll book it for you.` |
| **Recovery** | Automatic re-enable at 0, with focus moved back to the submit button and announced `You can try again now.` · manual: `Call Shop Now` |
| **Telemetry** | `error_shown{code:"RATE_LIMITED", page, step?, retry_after}` |
| **Never** | A CAPTCHA wall as the "solution". A silent retry. Clearing the form. Rendering the raw `retryAfter` with no human framing. A per-second live-region announcement. |

### 1.6 `500` / `INTERNAL_ERROR`

| Field | Value |
| --- | --- |
| **Trigger** | `ApiErrorCode === "INTERNAL_ERROR"`, an unhandled server render throw, or a fetch that exhausts retries. |
| **User sees** | For a **page** render: the full error page. For a **region**: an inline panel that replaces only the failed region, with the rest of the page intact. Forms keep their values. |
| **Copy** | `h1` (page): `Something broke on our side.` · body: `This isn't your fault. Try again, or call us and we'll sort it out.` · buttons: `Try again` (secondary, reloads) + `Call Shop Now` (emergency, primary) · ref: `Reference: {requestId}` — inline region: `We couldn't reach the booking system. This is on our side, not yours. Try again in a moment, or call the shop and we'll book it for you in one minute.` + `Try again` |
| **Recovery** | `Try again` → `router.refresh()` for a page, re-fetch for a region · `Call Shop Now` |
| **Telemetry** | `error_shown{code:"INTERNAL_ERROR", page, region?, request_id}` and a `console.error` in dev only (never in prod — the brief forbids console noise) |

### 1.7 Maintenance mode

| Field | Value |
| --- | --- |
| **Trigger** | A `MAINTENANCE` env flag, or `ApiErrorCode === "MAINTENANCE"` from the API, or an unhealthy `/api/health`. |
| **User sees** | Full page for public routes. **The shop is still trading**, so the page says so, and the phone is the primary action. `/admin` shows a distinct staff-facing maintenance screen (not in the public copy deck). |
| **Copy** | `h1`: `We're doing some work on the site.` · body: `The shop is still open and still taking calls. Book or call on the usual number.` · buttons: `Call Shop Now` (primary) + `Try again` (secondary) |
| **Recovery** | `Call Shop Now` · `Try again` (relinks the client when health returns) |
| **Telemetry** | `error_shown{code:"MAINTENANCE", page}` once per session (not per render — a maintenance page in a `useEffect` loop will produce thousands of events) |
| **Never** | A 503 splash that looks like the shop is closed. Removing the phone number. A full-screen takeover with no escape. |

### 1.8 Offline

| Field | Value |
| --- | --- |
| **Trigger** | `navigator.onLine === false`, or any fetch rejecting with a `TypeError` and `navigator.onLine === false`, or exceeding the hard timeout with the connection known-down. |
| **User sees** | A dismissible (but **not** blocking) top strip on content pages: `You're offline. This page needs a connection. Calling works without one.` with a `Try again` tertiary. A full panel only where the region cannot render at all (the slot list, the quote result, a form submit). The mobile action bar switches to `single-call` full width. |
| **Copy** | strip: `You're offline.` / `This page needs a connection. Calling works without one.` / `Try again` · step 3 panel: `You're offline, so we can't load today's bays.` / `Calling works without data.` · step 4 panel: `No connection. We saved your details.` / `We'll send it the moment you're back online. If you're in a hurry, call instead.` / `Try again now` |
| **Recovery** | Automatic: on the `online` event, re-run the failed fetch once (15 s timeout) and announce `Back online. Trying again.` · manual: `Try again` / `Try again now` · always: `Call Shop Now` |
| **Telemetry** | `error_shown{code:"SERVICE_UNAVAILABLE", reason:"offline", page, step?}` fired **once per offline episode**, tracked with a session-scoped flag so flapping does not spam |
| **Never** | Caching a stale booking success and showing it as if it just happened. Auto-submitting a booking the moment the connection returns **without** an explicit "Back online. Your details are saved. Send now? [Send] [Not now]" prompt — silently sending something the customer did not re-confirm is worse than failing. |

### 1.9 Session timeout

| Field | Value |
| --- | --- |
| **Trigger** | `/admin` session past `Session.expiresAt`, or `UNAUTHENTICATED` from `/api/admin/**`. |
| **User sees** | A staff page, plain. The bookings board is replaced by an inline expiry panel above it — the board does not unmount, so the staff member can still read what was on screen. |
| **Copy** | `h2`: `Your session ended.` · body: `Sign in again to make changes. Nothing you were looking at was lost.` · buttons: `Sign in` (primary) + `Call Shop Now` (secondary) |
| **Recovery** | `Sign in` → `/admin` (the `returnTo` query is dropped — deep-linking a staff session into a redirect is a CSRF surface) |
| **Telemetry** | `error_shown{code:"UNAUTHENTICATED", page:"/admin", reason:"session_timeout"}` |
| **Public routes** | `UNAUTHENTICATED` cannot occur on `/`–`/deals` — there are no public sessions. If it does, treat it as `INTERNAL_ERROR`. |

### 1.10 Coming soon

| Field | Value |
| --- | --- |
| **Trigger** | A feature that is genuinely announced but not built (e.g. a payments page, an online tyre catalogue). |
| **User sees** | A page that is **honest about the gap** and still converts. Never a disabled primary button. Never a form that posts nowhere. |
| **Copy** | `h1`: `{Feature} is not ready yet.` · body: `We're building it. In the meantime, this gets you the same thing:` · then the real working path: `Call Shop Now` (primary) + `Book a Service Bay` (secondary) |
| **Recovery** | `Call Shop Now` · `Book a Service Bay` |
| **Telemetry** | `error_shown{code:"NOT_FOUND", reason:"coming_soon", feature}` |
| **Never** | A `Coming soon` styled as the page's primary CTA. An email-capture gate in front of it. A `disabled` submit. |

### 1.11 Spam / CAPTCHA failure

| Field | Value |
| --- | --- |
| **Trigger** | `ApiErrorCode === "SPAM_REJECTED"` (the `website` honeypot was filled) or `CAPTCHA_FAILED` (wrong math answer). |
| **User sees** | For `CAPTCHA_FAILED`: a new question under the existing form, values intact, `role="alert"`. For `SPAM_REJECTED`: **the form is accepted and shows success**, but nothing is persisted and nothing is sent. The customer is never told a bot filter fired. |
| **Copy** | `That answer is not right. Try the new question.` |
| **Recovery** | New challenge, retry. |
| **Telemetry** | `error_shown{code:"CAPTCHA_FAILED", page, step?}` / `error_shown{code:"SPAM_REJECTED", page}` — the latter carries **no** user-agent or IP into analytics; the server log has them. |
| **Never** | "You have been blocked." · An IP ban message. Showing a different result to a real person because of a false positive on the honeypot. |

### 1.12 `403` from an origin check (CSRF / cross-site POST)

| Field | Value |
| --- | --- |
| **Trigger** | A booking/quote POST with a mismatched `Origin`, rejected in middleware. |
| **User sees** | The standard `FORBIDDEN` region with the 403 copy, plus the call escape. |
| **Recovery** | Reload the page (which re-establishes the origin) then retry. Copy adds: `Reload the page and try again.` |
| **Telemetry** | `error_shown{code:"FORBIDDEN", reason:"origin_mismatch", page}` |

---

## 2. Loading states — skeletons, not spinners

**Rule: no spinner is ever visible for more than 400 ms.** A spinner under 400 ms is
invisible anyway, so in practice the site ships **zero** spinners. Every async region has
a skeleton, a determinate bar (submit only) or a pending label.

Skeleton mechanics: base fill `bg-ink-200` (light) / `bg-ink-800` (dark), a 1.2 s
opacity pulse between 0.55 and 1.0, `animation-iteration-count: infinite`. Under
`prefers-reduced-motion: reduce` the pulse is removed entirely and the fill is static at
0.8. Skeletons are `aria-hidden="true"`; the *container* carries
`aria-busy="true"` and a visually hidden label.

**Timing contract**

| Rule | Value |
| --- | --- |
| Minimum skeleton display | 400 ms (prevents a flash that reads as a glitch) |
| Maximum skeleton display | 6 000 ms — after that, **render the error state**, never keep pulsing |
| Submit | Determinate inline bar, not a skeleton, not a spinner |
| Refetch of a visible region (e.g. changing date) | Skeleton **in place**, the surrounding chrome stays — the page never unloads |

**Skeleton shapes** — each mirrors the real layout's box model so there is no shift.

| Region | Skeleton |
| --- | --- |
| Service grid | 6 cards, 208 px each: 48 px circle, 60 %-width 20 px bar, 85 %-width 16 px bar, 3 × 70 % 12 px bars, 40 % 18 px price bar, 44 px 60 %-width button bar |
| Package row | 3 cards, 176 px: 32 %-width 18 px title bar, 90 % 14 px bar, 3 × 22 px item bars, 2 × 50 % 16 px bars |
| Estimator result | 3 line rows (60 % + 30 %) + a 28 px total bar + a 44 px button bar |
| Estimator inputs | 3 × 44 px input bars, 4 × 44 px checkbox rows |
| Date strip | 7 chips, 56 × 64 px, 8 px gap |
| Slot grid | 3 rows × 3 chips, 88 × 56 px, 8 px gap |
| Reviews | 3 cards, 132 px: 40 px avatar circle, 55 % 16 px bar, 95 % 14 px bar, 70 % 14 px bar |
| Gallery | 3 tiles, `aspect-ratio: 4 / 3`, `width`/`height` set |
| Map | One 16:9 block with a centred `Loading the map` label (a map cannot be skeletonised into a shape, and a wrong-shaped placeholder causes CLS) |
| Admin board | 8 rows × 44 px, left 30 % bar + right 20 % bar |
| Location card | 1 address bar + 1 hours bar + 2 button bars |

**Never skeletonised:** the header, the mobile action bar, the emergency banner, the
footer, the `404`/`500` pages. Those render instantly from the server or not at all — a
shimmering phone number is the worst possible first impression on a site whose whole
promise is that the number works.

---

## 3. Empty states

An empty state is not an error and must not look like one. No red, no warning icon, no
`0 results` styling.

| # | Condition | Heading | Body | Actions | Telemetry |
| --- | --- | --- | --- | --- | --- |
| E1 | No published reviews | `We haven't put reviews up yet.` | `We're a new shop and we don't have a public review page yet. The comments on our Facebook are real — have a look.` | `See us on Facebook` (secondary) | `error_shown{code:"NOT_FOUND", reason:"empty_reviews"}` |
| E1a | **Preferred** for E1 | — | — | On `/` and `/about`, the reviews section is **not rendered at all** when there are 0 rows. A section headlined "reviews" with a paragraph explaining there are none is worse than no section. Only `/` keeps a `Read what people say → Facebook` text link in the proof strip. | — |
| E2 | No published gallery images | `We're shooting the bay this week.` | `Check back soon, or message us and we'll send you photos of your own car while we work on it.` | `Message on Messenger` (primary) + `Call the shop` (secondary) | `error_shown{code:"NOT_FOUND", reason:"empty_gallery"}` |
| E2a | On `/` | — | — | The gallery section is not rendered. The homepage gets a `See the bay →` link to `/gallery` instead. | — |
| E3 | No active promotions on `/deals` | `No promos running right now.` | `Tyre clearance and rainy-season bundles come and go. Leave your email and we'll tell you the day one starts.` | `Tell me when one starts` (primary) + `See regular prices` (secondary) | `error_shown{code:"NOT_FOUND", reason:"empty_promos"}` |
| E4 | Service search / filter returns 0 | `No services match "{query}".` | `We probably still do it. These are the closest:` + 3 real nearest matches as tertiary links + `Clear filters` | `Call and ask about your car` (secondary) | `error_shown{code:"NOT_FOUND", reason:"empty_search", query}` — **the query goes in as a truncated, lowercased, 40-char string; never PII** |
| E5 | A date has no slots at all | `No bays left on {date}.` | `Next open: {nextDate} at {nextTime}.` | `See {nextDate}` (tertiary) + `Call the shop` (secondary) | `error_shown{code:"SLOT_UNAVAILABLE", date, next_date}` |
| E6 | A date is a closed day | `{closedReason}` (verbatim from `SlotAvailabilityDto.closedReason`) | — | `See open days` (tertiary) + `Call the shop` (secondary) | `error_shown{code:"NOT_FOUND", reason:"closed_day", date}` |
| E7 | Unknown make/model in the estimator | `We don't have {make} {model} in our list yet.` | `That's fine — tell us what you need and we'll confirm the price by text.` | `Enter it yourself` (primary) + `Send this to the shop` (secondary) | `error_shown{code:"NOT_FOUND", reason:"unknown_vehicle", make, model}` |
| E8 | A service was deactivated while in the basket | `We had to remove {ServiceName} from this estimate — it's not on our list right now.` | — | `See current services` (tertiary) + continue without it | `error_shown{code:"NOT_FOUND", reason:"service_deactivated", service_slug}` |
| E9 | Basket emptied by E8 leaving nothing | `There's nothing left in this booking.` | `Pick a service and we'll get a time going.` | `Choose services` (primary) | `error_shown{code:"NOT_FOUND", reason:"basket_emptied"}` |
| E10 | No search term and no category (impossible state guard) | Render the full catalogue | — | — | `error_shown{code:"INTERNAL_ERROR", reason:"catalogue_empty"}` — **a fully empty catalogue is a content bug, not an empty state.** Page copy: `Our service list is being updated. Call and we'll tell you what we do today.` + `Call Shop Now` |

---

## 4. Form field validation — the complete table

Timing: validate on `blur`; after the first blur, re-validate on `input`; on step
advance, validate everything and focus the first invalid field. Errors are associated via
`aria-describedby` and `aria-invalid="true"`, rendered in `racing-600` (light) /
`racing-400` (dark) with a 14 px alert icon **and** the text.

### 4.1 Booking step 1 — vehicle

| Field | Condition | Exact error |
| --- | --- | --- |
| Year | empty | `Enter a 4-digit year, like 2019.` |
| Year | not 4 digits | `Enter a 4-digit year, like 2019.` |
| Year | < 1980 | `That year looks off. Use the year on your registration.` |
| Year | > current year + 1 | `That year looks off. Use the year on your registration.` |
| Make | empty, free-text not used | `Type at least 2 letters, or use "Not in the list".` |
| Make | < 2 chars | `Type at least 2 letters, or use "Not in the list".` |
| Model | empty, free-text not used | `Pick a model, or use "Not in the list".` |
| Variant | > 40 chars | `Keep this under 40 characters.` |
| Plate | invalid characters | `Use letters, numbers and spaces only, like ABC 1234.` |
| Mileage | non-numeric | `Enter mileage as a number, like 45000.` |
| Mileage | < 0 or > 2 000 000 | `That mileage looks off. Leave it blank if you're not sure.` |
| Whole step | nothing entered at all, user pressed Continue | *No error.* The step allows `vehicle: undefined`. If they typed something half-finished, the incomplete fields are flagged; fully empty is valid. |
| Whole step | partially filled, pressed Continue with "Skip" available | `Fill in the fields you started, or use "Skip for now".` |

### 4.2 Booking step 2 — services

| Condition | Exact error |
| --- | --- |
| 0 selected, pressed Continue | `Choose at least one service to pick a time.` (the Continue label becomes this; it is not a red error because it is an instruction) |
| > `maxServicesPerBooking` (8) | `That's more than 8 services. Book them separately, or call us and we'll sort it out.` |
| Bundle + a conflicting individual service | `{ServiceName} is already in {PackageName}. We'll leave the bundle as it is and ignore the extra one.` + `Remove {ServiceName}` + `Switch to paying separately` |
| A selected service went inactive | `We had to remove {ServiceName} from this booking — it's not on our list right now.` |

### 4.3 Booking step 3 — date & time

| Condition | Exact error |
| --- | --- |
| No slot selected, pressed Continue | `Pick a day and a time. We'll hold it for 10 minutes.` |
| The selected slot is no longer in the availability payload on step entry | `That time is gone. Pick another one — nothing was booked.` + auto-refetch |
| The hold expired | `Your 10-minute hold on {time} ended. Pick a time again — nothing was booked and nothing was charged.` |
| Availability 5xx | `We couldn't load the bays for {date}. Pick another day, or call us.` + `Try again` |
| Availability `MAINTENANCE` | `We're doing some work on the booking system. Call the shop and we'll book it for you.` + `Call Shop Now` |

### 4.4 Booking step 4 — contact

| Field | Condition | Exact error |
| --- | --- | --- |
| Name | empty | `Enter your name so we know who to look for.` |
| Name | < 2 chars | `Enter your name so we know who to look for.` |
| Name | > 80 chars | `Keep your name under 80 characters.` |
| Name | digits only | `That doesn't look like a name. First name is enough.` |
| Phone | empty | `Enter a PH mobile number, like 09 17 123 4567.` |
| Phone | fails `isValidPhPhone()` (not `+63 9XXXXXXXXX` / `09XXXXXXXXX`) | `Enter a PH mobile number, like 09 17 123 4567.` |
| Phone | 10 digits after `normalisePhone` | `That number is 1 digit short. PH mobile numbers are 11 digits.` |
| Phone | contains letters | `Numbers only, please. Like 09 17 123 4567.` |
| Email | invalid and non-empty | `That email looks incomplete. Check it or leave it blank.` |
| Email | > 254 chars | `That email is too long. Leave it blank if you'd rather not.` |
| Notes | > 500 chars | `Keep this under 500 characters.` (with a live counter) |
| `consentSms` | unchecked | `Tick the box above if you want the text confirmation. Or call us instead and we'll note the same bay.` |
| `consentMarketing` | unchecked | **No error. Never.** |
| CAPTCHA | wrong answer | `That answer is not right. Try the new question.` |

### 4.5 Estimator

| Field | Condition | Exact error |
| --- | --- | --- |
| Services | 0 selected, user tried to book/capture | `Tick at least one service so we can price it.` |
| `tyreSize` | `tyreCount > 0` and empty | `Add your tyre size, or call us and read it to us.` |
| `tyreSize` | present but not matching `^\d{3}\/\d{2}\s?R\d{2}$` after trimming | `That doesn't look like a tyre size. It's on the sidewall, like 205/55 R16.` — **and the estimate still renders without tyres.** A malformed size must not block a price for labour. |
| `vehicleYear` | invalid format | `Enter a 4-digit year, like 2019.` — estimate still renders |
| Promo | see §1.3 | estimate still renders |

### 4.6 Contact form `/contact`

| Field | Condition | Exact error |
| --- | --- | --- |
| Name | empty | `Enter your name so we know who to reply to.` |
| Message | empty | `Tell us what's up so we can answer.` |
| Message | < 5 chars | `A little more detail helps us answer properly.` |
| Message | > 1000 chars | `Keep this under 1,000 characters.` |
| Phone | present and invalid | `That number doesn't look right. Numbers only, like 09 17 123 4567.` |
| Email | present and invalid | `That email looks incomplete. Check it or leave it blank.` |
| All optional except name + message | — | The form is 2 required fields. This is deliberate: a contact form that demands a phone number is a lead-gen form, not a contact form. |

### 4.7 Newsletter (deals, no promos running)

| Field | Condition | Exact error |
| --- | --- | --- |
| Email | empty | `Enter your email so we know where to send it.` |
| Email | invalid | `That email looks incomplete. Check the spelling.` |
| Already subscribed | — | `You're already on the list. Nothing to do.` (success copy, not an error) |

### 4.8 Server-side field errors (`ApiFailure.error.fields`)

Shape: `Record<string, string[]>` keyed by field name. Rendering rules:

1. The **server's** message wins over the client's, verbatim, because the server sees the
   normalised value. Only if `fields` is absent do we fall back to the client string.
2. Every key in `fields` is rendered in a summary panel at the top of the form:
   `Check these:` followed by an anchor list, each item `href="#field-{key}"`. The panel
   is `role="alert"`, `tabindex="-1"`, focused on render.
3. The field itself also shows the message inline with `aria-describedby`.
4. `ApiErrorCode === "VALIDATION_ERROR"` is the only code that renders field-level copy.
   Any other code renders a region-level message instead — do not invent field errors for
   a `CONFLICT`.
5. A key in `fields` that does not map to a visible field is dropped from the summary
   and logged. It is never rendered as an orphan.

---

## 5. Content-lifecycle edges

### 5.1 Phone that cannot receive SMS

| Field | Value |
| --- | --- |
| **Trigger** | Delivery failure after the booking is created: `Notification.status === "failed"` with a carrier-level `error`, checked by the backend after `POST /api/booking` returns. |
| **User sees** | The booking **succeeds** and the success screen renders. Immediately under the SMS preview panel: `We couldn't send that text — some numbers don't receive them. Your booking is still confirmed.` with a `Call the shop` primary and a `Send it another way` secondary (`LINKS.whatsapp`). Never a failure banner over a successful booking. |
| **Recovery** | `Call the shop` · `Send it another way` (prefilled `wa.me` link with the reference) |
| **Telemetry** | `error_shown{code:"SERVICE_UNAVAILABLE", reason:"sms_delivery_failed", booking_status:"CONFIRMED"}` |
| **Never** | Reporting the booking as failed. Telling the customer their number is wrong. Asking for a different number on a confirmed booking. |
| **Also** | Front desk is alerted in `/admin` with a visible badge on the booking row, so a human follows up. That is the real recovery. |

### 5.2 Email that bounces

| Field | Value |
| --- | --- |
| **Trigger** | `Notification.status === "failed"` on the `email` channel, or `customerEmail` invalid at booking time. |
| **User sees** | Nothing at booking time — email is optional and no receipt is promised in the UI copy (`Email (optional)` / `For your receipt. Skip it if you prefer.`). On `/admin`, a badge on the booking row: `Email bounced`. No customer-facing state. |
| **Recovery** | Internal: front desk sends it manually or asks for a correct address on the next visit. |
| **Telemetry** | `error_shown{code:"SERVICE_UNAVAILABLE", reason:"email_bounced", channel:"email"}` (server-side only; the address is **never** sent to analytics) |
| **Never** | Showing a hard bounce error to the customer at booking time for an optional field. |

### 5.3 Promo expiring between viewing and applying

| Field | Value |
| --- | --- |
| **Trigger** | A promo was shown (on `/deals` or in an estimate) and by the time the customer applies it, `now > endsAt`. |
| **User sees** | The `/deals` card flips to the expired variant in place: `{title} ended on {dateLong}.` + `Here's what's on now.` + `See current prices`. If they apply the code in the estimator, they get §1.3's `ended` message and the estimate renders undiscounted. |
| **Recovery** | `See current prices` → `/services` · re-apply a live code |
| **Telemetry** | `error_shown{code:"NOT_FOUND", reason:"promo", promo_code, state:"expired"}` + `promo_viewed{promo_slug, state:"expired"}` (so the Monday review can see promos that were still being viewed after their end date — a pricing or scheduling failure, not a code failure) |
| **Never** | Honouring it "just this once". Hiding the fact that it expired. Removing the card so the customer thinks they imagined it. |

### 5.4 Service deactivated while it sat in the basket

| Field | Value |
| --- | --- |
| **Trigger** | `POST /api/booking` with a `serviceIds` entry whose `Service.isActive === false`, or the client revalidating the basket on step entry. |
| **User sees** | The submit returns `NOT_FOUND` with `fields: { serviceIds: ["…"] }`. The wizard shows an inline notice, `role="alert"`, **the removed service's row is struck through and marked removed** (not silently deleted), and everything else is preserved. |
| **Copy** | `We had to take {ServiceName} off this booking — it's not on our list right now. Everything else you picked is still here.` + `Remove it and continue` (primary) + `See current services` (tertiary) |
| **Recovery** | `Remove it and continue` re-submits with the reduced `serviceIds` — **using the same `idempotencyKey`**, so if the original booking actually did land, no duplicate is created · `See current services` |
| **Telemetry** | `error_shown{code:"NOT_FOUND", reason:"service_deactivated", service_slug, step:4}` |
| **If nothing remains** | E9: `There's nothing left in this booking.` + `Choose services` |
| **Never** | Re-pricing the whole booking silently. Dropping the item from the UI so the customer thinks they never asked for it. Failing the whole submission. |

### 5.5 Bay closure announced after a slot was picked

| Field | Value |
| --- | --- |
| **Trigger** | A `BayClosure` window is created covering the picked `startAt`, and the server rejects the booking with `SLOT_UNAVAILABLE` or `CONFLICT`. |
| **User sees** | The slot-race state (`BOOKING-FLOW.md` §6) with a reason line adjusted for this case. |
| **Copy** | `That bay is closed today. We didn't book it and you weren't charged.` · reason: `We had to close the {n} bays at {time} for {reason}.` (from `BayClosure.reason`, or `{reason} — we'll confirm the details` if null) |
| **Recovery** | `See other times on {date}` · `Try {nextDate}` · `Call us` |
| **Telemetry** | `error_shown{code:"SLOT_UNAVAILABLE", reason:"bay_closure", date, closure_id}` |

### 5.6 Clock skew — device time more than 10 minutes off the server

| Field | Value |
| --- | --- |
| **Trigger** | Client `Date.now()` differs from the `Date` header by > 10 min. |
| **User sees** | Nothing visible. The date strip uses **server** dates for the first paint and silently re-syncs. A customer whose phone clock is wrong must not be told "no bays available" because of it. |
| **Recovery** | Automatic. |
| **Telemetry** | `error_shown{code:"INTERNAL_ERROR", reason:"clock_skew", skew_seconds}` (rate-limited to once per session) |
| **Never** | A "check your device clock" error. This is our problem to absorb, not theirs. |

### 5.7 Very long session — the slot hold and the price snapshot both expire

| Field | Value |
| --- | --- |
| **Trigger** | `BOOKING.holdMinutes` (10 min) elapsed while the customer is still on step 4, **and** the estimate snapshot is > 30 min old. |
| **User sees** | On returning to step 3: hold-expiry copy. On step 4: a line under the total — `Prices were checked over 30 minutes ago. We'll confirm today's price before we start.` No forced re-run. |
| **Recovery** | Re-pick a slot. Nothing else is lost. |
| **Telemetry** | `error_shown{code:"SLOT_UNAVAILABLE", reason:"hold_expired"}` |
| **Never** | Timing the customer out of a partially-completed booking. Deleting the draft. Requiring them to start over. |

### 5.8 Duplicate booking — the customer taps twice at the counter

| Field | Value |
| --- | --- |
| **Trigger** | `POST /api/booking` returns a booking whose `customerPhone` + `startAt` + overlapping `serviceIds` already exists and was created < 5 min ago. With `idempotencyKey` (CR-3) this is caught client-side. Without it, the server catches it and returns the **existing** `BookingDto` with `meta` unchanged. |
| **User sees** | The normal success screen, with one extra line under the reference: `You already have a booking at {time} today. This is the same one — reference {reference}. If you meant to book something else, call us.` |
| **Recovery** | `Book another service` · `Call the shop` |
| **Telemetry** | `booking_completed{duplicate:true, first_reference}` |
| **Never** | Creating a second real booking. Showing two success screens. Silently ignoring the second request. |

### 5.9 An open tab, a stale form, and a fresh tab

| Field | Value |
| --- | --- |
| **Trigger** | The customer has two tabs on `/book` step 4 and submits the older one. |
| **User sees** | Nothing special — both are valid bookings, the second is a duplicate (§5.8). |
| **Recovery** | As §5.8. |
| **Telemetry** | As §5.8. |
| **Note** | Do **not** add cross-tab lockout. It breaks a legitimate flow (customer opens `/services` in a new tab to check something) and buys nothing here. |

---

## 6. Malformed deep links

| Input | Behaviour | Copy | Telemetry |
| --- | --- | --- | --- |
| `/book?step=9` | Clamp to step 4 | `Step 4 of 4: Contact.` in the live region; no error banner | `error_shown{code:"VALIDATION_ERROR", reason:"step_out_of_range", step}` |
| `/book?step=abc` | Step 1 | — | `error_shown{code:"VALIDATION_ERROR", reason:"step_not_a_number"}` |
| `/book?step=3` with no draft | Step 1 + notice | `We lost your last step. Let's start again — it takes about a minute.` + `Start again` | `error_shown{code:"NOT_FOUND", reason:"no_draft"}` |
| `/book?from=quote&services=svc-bogus,svc-oil` | Drop `svc-bogus`, keep the rest, show a notice | `We dropped one item we don't recognise.` + `See current services` | `error_shown{code:"NOT_FOUND", reason:"unknown_service_in_deeplink"}` |
| `/book?from=quote` with **all** ids unknown | Step 1, no error | — (nothing to restore) | `error_shown{code:"NOT_FOUND", reason:"deep_link_fully_unresolvable"}` |
| `/book?size=%2F%2F%2F` | `tyreSize` rejected, ignore | — | `error_shown{code:"VALIDATION_ERROR", reason:"bad_tear_size"}` |
| `/book?promo=<script>` | `escapeHtml` + length cap 24 + charset cap `[A-Z0-9-]` | `We don't have a code "…".` (the raw value is never echoed after sanitising — the sanitised form is shown) | `error_shown{code:"VALIDATION_ERROR", reason:"bad_promo"}` |
| Any URL > 2 KB | Ignore the query entirely, render the default route | — | `error_shown{code:"VALIDATION_ERROR", reason:"query_too_long"}` |
| `?utm_source=` containing PII | stored in the referrer, **never** rendered | — | — |

**No query parameter is ever reflected into a heading, a success banner, or an SMS.**
The one exception is a promo code, and it is charset-restricted and length-capped before
rendering.

---

## 7. Rate-limit and abuse specifics

| Rule | Value |
| --- | --- |
| Booking POST | 5 per phone number per 10 min, 20 per IP per hour. Over → 429 with `retryAfter` = the remaining window. |
| Quote capture | 3 per phone per hour. |
| Availability GET | 120 per IP per minute — it is the most-polled endpoint and must never lock a customer out of reading the calendar. It returns 200 with an empty `slots` array past the cap rather than a 429, because a customer browsing dates should not be told "slow down" for opening a calendar. |
| Contact form | 3 per IP per hour, honeypot first. |
| `CAPTCHA_FAILED` | 3 per IP per 10 min, then 429. |
| Escalation | A 429 on a `tel:` link is impossible (`tel:` opens the dialler), so the call path is never rate-limited. This is a structural guarantee, not a design decision. |

---

## 8. Telemetry for every state in this document

Every row's telemetry column uses the shared event schema in `FUNNEL-METRICS.md` §1.
Rules that apply to all of them:

- `error_shown` is **fire-and-forget**, queued, and never blocks or throws. A failed
  analytics beacon must never surface in the UI.
- Properties never include: name, phone, email, plate, free-text notes, or any raw query
  string. `service_slug`, `promo_slug`, `category_slug`, `step`, `date` and `reason` are
  fine.
- `error_shown` is **deduplicated per session per (code, reason)** for repeat states
  (offline flapping, maintenance re-renders). Genuinely distinct occurrences (three
  different slot races in one session) are not deduplicated.
- Every 5xx carries `request_id` so support can correlate. Analytics is the only place
  `requestId` is allowed to leave the server.

---

## 9. QA checklist

- [ ] Every row of §1 renders with its exact copy, verified against `MICROCOPY.md`.
- [ ] No error page loses the `tel:` link. Screenshot each of the five error routes.
- [ ] 429 countdown announces **once per 10 s**, not per second.
- [ ] `SPAM_REJECTED` shows a **success** screen to the human and persists nothing.
- [ ] Skeletons disappear and become an error state at exactly 6 000 ms.
- [ ] Zero spinners exist in the bundle (`grep -r "animate-spin"` on async regions).
- [ ] Form values survive every failure path, including a hard reload mid-error.
- [ ] An unknown vehicle never blocks step 1.
- [ ] A deactivated service is struck through, not silently removed.
- [ ] A double-tap on `Confirm booking` produces one booking (§5.8's copy appears).
- [ ] A promo that expires between view and apply gives §1.3's `ended` message.
- [ ] No query parameter reaches a heading, a success banner, or an SMS unescaped.
- [ ] Availability polling never returns 429 to a customer browsing the calendar.
- [ ] Every error state has a working `Try again` or `Call Shop Now` — no dead buttons.
