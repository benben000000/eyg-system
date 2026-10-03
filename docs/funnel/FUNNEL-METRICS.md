# FUNNEL METRICS — events, diagnosis and the weekly review

**Owner:** funnel agent · Applies to every route.
**Implementation:** a first-party `track()` wrapper, ~40 lines, zero third-party SDK
(`MOBILE-FIRST-SPEC.md` §8.1).

---

## 1. Event schema

### 1.1 Transport rules

| Rule | Detail |
| --- | --- |
| Queue | Every event is appended to an in-memory array immediately. Nothing is sent during the critical path. |
| Flush | `window.load` + a 5 s interval + `visibilitychange` → `document.hidden`. Uses `navigator.sendBeacon` when available, `fetch(…, {keepalive: true})` otherwise. |
| Failure | A failed beacon is dropped, **never retried more than twice**, **never surfaced**. Analytics must never break a booking. |
| Identity | A random `session_id` (UUID) in `sessionStorage`, rotated after 30 min idle. No cross-session user ID, no fingerprinting, no cookie banner (the brief forbids interstitials and there is nothing to consent to — first-party, aggregated, no PII). |
| **PII** | **No event property may contain a name, phone number, email address, plate number, free-text note, or raw query string.** `service_slug`, `category_slug`, `promo_slug`, `package_slug`, `cta_id`, `step`, `date`, `reason` and `variant` are all safe. A `search` property is lowercased and truncated to 40 chars. Violating this is a data-protection incident, not a style issue. |
| Timezone | Every timestamp is UTC ISO 8601 on the wire, and `Asia/Manila` in every report and every on-screen string. |
| Environment | `environment: "prod" \| "staging"`. Staging events are never mixed into prod dashboards. |

### 1.2 Common properties (on every event)

```ts
{
  session_id: string,        // UUID, sessionStorage
  ts: string,                // ISO 8601 UTC
  page: string,              // "/", "/services", "/book", …
  step?: 1|2|3|4,            // booking only
  device: "mobile"|"tablet"|"desktop",   // pointer:coarse + width, not UA sniffing
  theme: "dark"|"light",
  reduced_motion: boolean,
  save_data: boolean,
  online: boolean,
  is_returning: boolean,     // sessionStorage flag: has completed a booking before
  referrer_host: string|null,// hostname only, never the full path or query
  utm_source?: string, utm_campaign?: string,
  environment: "prod"|"staging",
}
```

### 1.3 The events

#### `booking_started`

**Fires** once per session, the first time a `book.continue` CTA is activated on `/book`
(including a deep link that lands directly on step 2+), **and** on the first field
interaction in step 1.

| Property | Type | Notes |
| --- | --- | --- |
| `entry` | `hero` \| `service_card` \| `estimator` \| `promo` \| `header` \| `deep_link` \| `direct` | the `cta_id` or the deep-link source |
| `start_step` | `1`–`4` | 2+ means a deep link |
| `from_query` | `string` | sanitised, `source` value only, never the raw query |

**Not** fired on a `/book` page view with no interaction. A page view is not intent.

---

#### `booking_step_completed`

**Fires** when a step's `Continue` is pressed and that step validates, **before** the
next step renders. Also fires for step 4 on a successful `POST` with
`step: 4, outcome: "confirmed"` — no: step 4 completion is `booking_completed`. This event
covers steps 1–3 only.

| Property | Type | Notes |
| --- | --- | --- |
| `step` | `1`\|`2`\|`3` | |
| `step_name` | `vehicle`\|`services`\|`date_time` | |
| `duration_ms` | `number` | time since `booking_started` (cumulative) |
| `step_duration_ms` | `number` | time since the previous `booking_step_completed` |
| `validation_retries` | `number` | how many failed submits on this step |
| `vehicle_source` | `catalogue`\|`manual`\|`skipped` | step 1 |
| `service_count` | `number` | step 2 |
| `service_ids` | `string[]` | slugs, not ids |
| `package_slug` | `string`\|null | step 2 |
| `promo_applied` | `boolean` | step 2 |
| `date` | `string` | `YYYY-MM-DD`, step 3 |
| `slot_label` | `string` | `SlotDto.label`, step 3 |
| `slot_capacity_left` | `number` | verbatim, step 3 |
| `slot_was_recommended` | `boolean` | `isBest`, step 3 — the single most useful nudge metric |
| `slots_seen` | `number` | how many slots were in the payload |

---

#### `booking_abandoned`

**Fires** on `visibilitychange` → hidden, **after** `booking_started` and **without** a
`booking_completed`, when a step is ≥ 1 in progress. Guarded so it fires at most once per
session, and never when the tab is hidden for < 3 s (switching apps is not abandoning).

| Property | Type | Notes |
| --- | --- | --- |
| `last_step` | `1`–`4` | the furthest step reached |
| `furthest_step` | `1`–`4` | max reached, may be > `last_step` after a Back |
| `elapsed_ms` | `number` | since `booking_started` |
| `service_count` | `number` | 0 means they never got to step 2 |
| `slot_selected` | `boolean` | |
| `reason` | `hidden`\|`unload` | `hidden` = tab/app switch; `unload` = navigation away |
| `has_draft` | `boolean` | `sessionStorage` draft present — a returning session, recoverable |

**Re-fires** in a *new* session with the same `session_id`? No — one per session, and
`booking_started` carries a `restarted: true` flag if the customer resumes a saved draft.
That distinction is the most important one in the funnel: an abandon that comes back is
not an abandon.

---

#### `booking_completed`

**Fires** on `ApiResult<BookingDto>` with `ok: true` and `status ∈ {PENDING, CONFIRMED}`.

| Property | Type | Notes |
| --- | --- | --- |
| `reference` | `string` | `EYG-XXXXXX` |
| `status` | `PENDING`\|`CONFIRMED` | |
| `service_count` | `number` | |
| `package_slug` | `string`\|null | |
| `promo_applied` | `boolean` | |
| `vehicle_source` | `catalogue`\|`manual`\|`skipped` | |
| `elapsed_ms` | `number` | end-to-end |
| `entry` | as `booking_started` | |
| `steps_visited` | `number` | 4 = linear, < 4 = the customer went Back |
| `slot_was_recommended` | `boolean` | |
| `hold_expired` | `boolean` | |
| `duplicate` | `boolean` | the §5.8 duplicate-merge path |
| `estimate_shown` | `boolean` | did they use the estimator first |
| `engine` | `gasoline`\|`diesel`\|`hybrid`\|`electric`\|`unknown`\|null | |

**Never** fire this on a failure, a timeout, or a page unload. It means one thing: a bay
is reserved.

---

#### `quote_estimated`

**Fires** when the estimator result card renders with a non-empty selection. Debounced
400 ms after the last change, and again only if the result actually differs.

| Property | Type | Notes |
| --- | --- | --- |
| `variant` | `single`\|`split`\|`wide`\|`human` | the four render branches — the health metric of the price list |
| `min` | `number` | **omit entirely when 0** (the `human` case) |
| `max` | `number` | |
| `spread` | `number` | `(max-min)/min`, 3 dp |
| `over_spread_cap` | `boolean` | `spread > 0.40` |
| `line_count` | `number` | |
| `variable_lines` | `number` | how many lines say "we'll price" |
| `variable_ids` | `string[]` | **the single most actionable property on this site** |
| `widest_service_id` | `string`\|null | the line driving the spread |
| `engine` | as above | |
| `vehicle_known` | `boolean` | |
| `tyre_count` | `number` | |
| `promo_applied` | `boolean` | |
| `duration_min` | `number` | |
| `engine_iterations` | `number` | 1 = no tweaking. High values = the first result was not useful |

---

#### `quote_captured`

**Fires** on a successful `POST /api/quote` (`ApiResult<QuoteRequestDto>`).

| Property | Type | Notes |
| --- | --- | --- |
| `reference` | `string` | |
| `variant` | `single`\|`split`\|`wide`\|`human` | |
| `min`, `max` | `number` | omitted when 0 |
| `trigger` | `exit_intent`\|`inline_link`\|`variant_human`\|`variant_split` | how they got there |
| `service_count` | `number` | |
| `engine` | as above | |
| `vehicle_known` | `boolean` | |

`trigger: "exit_intent"` on **mobile must never appear**. If it does, the trigger guard
is broken (`QUOTE-ESTIMATOR.md` §11.2) — treat a non-zero mobile exit-intent count as a
bug, not a win.

---

#### `cta_clicked`

**Fires** on any CTA in `CTA-MAP.md` §3. This is the event that makes the diagnosis
playbook in §2 possible.

| Property | Type | Notes |
| --- | --- | --- |
| **`cta_id`** | `string` | **required**, from the `CTA-MAP.md` table. Never a class name, never an index |
| `placement` | `header`\|`hero`\|`section`\|`inline`\|`sticky`\|`footer`\|`error` | |
| `variant` | `primary`\|`secondary`\|`tertiary\|`emergency`\|`ghost` | |
| `fold` | `above`\|`below`\|`sticky` | measured at 360 × 640, decided at build time, not at runtime |
| `service_slug` | `string`\|null | per-service CTAs |
| `package_slug` | `string`\|null | |
| `promo_slug` | `string`\|null | |
| `category_slug` | `string`\|null | |
| `step` | `1`–`4`\|null | booking CTAs |
| `has_estimate` | `boolean` | for `estimator-*` and `book.confirm` |

**Frequency cap on the event itself:** max 3 per `cta_id` per session. A customer
hammering a call button is one person, not three leads, and uncapped call events
inflate every rate in the Monday review.

---

#### `call_clicked`

**Fires** on activation of any `tel:` link. Shares every `cta_clicked` property plus:

| Property | Type | Notes |
| --- | --- | --- |
| `cta_id` | `string` | |
| `intent` | `emergency`\|`booking`\|`question`\|`directions`\|`generic` | from the placement |
| `source_route` | `string` | |
| `is_open_at_click` | `boolean` | computed from `BUSINESS_HOURS` + `Holiday` **at click time** |
| `prefill` | `string`\|null | e.g. `"service_deactivated"` — why the customer is calling |

**Critical limitation, stated up front:** a `call_clicked` event measures an **intent to
dial**, not a completed call. There is no call tracking, no dynamic number insertion
(that would be a dark pattern on a shop's own line anyway), and no way to know whether
anyone answered. **A call is only confirmed by a human writing it down.** The Monday
review must ask the front desk for the number of calls answered and the number of
bookings created by phone, and those two numbers are the ground truth. Every funnel
metric on this page is a proxy; the front desk's notebook is the instrument. Never quote
a conversion rate derived only from `call_clicked` without the answered-call count
alongside it.

---

#### `whatsapp_clicked`

Same shape as `call_clicked`. Properties: `cta_id`, `channel` (`whatsapp`|`messenger`),
`prefill` (`service_deactivated`|`promo_question`|`installment_question`|`default`),
`booking_id` when the link carried a reference.

The `wa.me` link always carries a prefilled message. **Never** a bare `wa.me/{number}`
with no context — the shop receives dozens of "hi" messages a week and a prefilled
message makes each one answerable.

---

#### `directions_clicked`

Properties: `cta_id`, `provider` (`google`|`waze`|`maps_search`), `placement`, `source_route`.
Also fires on a **map iframe** interaction proxy (a click inside the embed on desktop).
There is a separate `map_interacted` boolean, because a directions click that is really
a pan is a different signal.

---

#### `promo_viewed`

**Fires** when a promotion card enters the viewport ≥ 50 % for ≥ 1 s (`IntersectionObserver`).

| Property | Type | Notes |
| --- | --- | --- |
| `promo_slug` | `string` | |
| `code` | `string`\|null | |
| `placement` | `hero`\|`grid`\|`estimator`\|`deals_page`\|`related_service` | |
| `state` | `active`\|`ending_soon`\|`expired` | `expired` = viewed after `endsAt` — a **content bug**, see §2 #6 |
| `days_to_end` | `number`\|null | |
| `is_seasonal` | `boolean` | |

---

#### `promo_claimed`

**Fires** on a successful `POST /api/promos` claim, **and** when a promo code is applied
in the estimator or the booking (a second path, marked separately — claiming on a card
and using a code in a booking are different intents).

| Property | Type | Notes |
| --- | --- | --- |
| `promo_slug` | `string` | |
| `code` | `string`\|null | |
| `surface` | `deals_card`\|`estimator`\|`booking_step2`\|`deep_link` | |
| `applied` | `boolean` | true = the code actually reduced the estimate |
| `not_eligible` | `boolean` | valid code, wrong scope |
| `rejected_reason` | `not_found`\|`expired`\|`not_started`\|`already_used`\|null | |
| `time_to_claim_ms` | `number` | from `promo_viewed` to the claim — the number that tells the owner whether the promo page is doing work |

---

#### `error_shown`

**Fires** for every state in `ERROR-AND-EDGE-STATES.md`. Fire-and-forget, deduplicated
per session per `(code, reason)`.

| Property | Type | Notes |
| --- | --- | --- |
| `code` | `ApiErrorCode` | from the contract |
| `reason` | `string` | snake_case, the `reason` column in `ERROR-AND-EDGE-STATES.md` |
| `page` | `string` | |
| `region` | `string`\|null | which region failed |
| `step` | `1`–`4`\|null | |
| `request_id` | `string`\|null | **5xx only** — the one time a server identifier is allowed into analytics |
| `retry_after` | `number`\|null | 429 only |
| `recovered` | `boolean` | set to true on the *next* successful action after the error. Written as a separate `error_recovered` event, not a mutation |

---

#### Supporting events

| Event | Fires when | Key properties |
| --- | --- | --- |
| `slot_race_lost` | `SLOT_UNAVAILABLE` from `POST /api/booking` | `date`, `start_at`, `capacity_at_submit`, `elapsed_ms` (how long the form was open — the race window), `recovered` |
| `error_recovered` | the action following an error succeeds | `code`, `reason`, `ms_to_recover` |
| `share_link_created` | an `.ics` is generated on the success screen | `reference` |
| `page_view` | a route commits | `route`, `referrer_host`, `is_deep_link`, `scroll_depth_25/50/75/100` (sent on unload) |
| `nav_direction` | a `←` / `→` / `↑` / `↓` key inside the date or slot radiogroups | `control: "date"\|"slot"`, `from`, `to`, `via: "key"` |
| `consent_toggled` | either consent checkbox changes | `which: "sms"\|"marketing"`, `to: boolean` |
| `vehicle_search_failed` | a make/model combobox returns 0 results | `field: "make"\|"model"`, `query` (truncated 40, lowercased) — **the catalogue's coverage gap report** |
| `outbound_click` | any anchor leaving the site | `href_host`, `cta_id` — one event covering Facebook, Google Maps, Waze and Messenger |
| `js_error` | `window.onerror` / `unhandledrejection` | `message` (truncated 200), `source_file` (path only) |

`js_error` must not include a stack trace with file contents or query strings, and must
be sampled at 100 % (this is a small site; a sampling rate is premature optimisation that
hides exactly the bug you need).

---

## 2. Diagnosis playbook

### The scenario: impressions are up, calls are down

Impressions (Search Console + social reach) rose. `call_clicked` fell, or fell relative
to the traffic. Six causes, in order of likelihood, each with exactly what to check.

---

**#1 — The phone number is wrong, unverified, or stops being answered.** *(likelihood: very high)*

`BUSINESS.phoneE164` is `"+639000000000"`, flagged `TODO-VERIFY`. If that placeholder
shipped, **every call CTA on the site dials a number that does not belong to anyone.** It
is the single largest possible loss of conversion on this site, it is invisible in
analytics (the click fires perfectly), and it is the default state of the config file
right now.

**Check:**
1. `BUSINESS.phoneE164` / `phoneDisplay` / `whatsappNumber` in `src/config/site.ts` — do
   the `TODO-VERIFY` flags still exist? **If yes, this is the answer. Stop here.**
2. Compare `BUSINESS.phoneE164` digit-for-digit against the Google Business Profile and
   the official Facebook page. A digit transposed is the classic version of this bug.
3. Pull the call log. Count the calls that arrived from the number in `site.ts`. If that
   count is ~0 while `call_clicked` is in the hundreds, the number is not the shop's.
4. Ask the front desk: "how many calls did you get from the website last week?" If they
   say "we don't get website calls", confirm it.
5. `call_clicked{is_open_at_click: true}` vs the front desk's answered-call count. If
   `call_clicked` is high and answered calls are near zero, the number is wrong or
   unanswered.
6. Does the same click pattern appear on a *landing* URL with no other change? No — a
   number bug affects every URL equally, which is a useful tell.

**Fix:** replace the three `TODO-VERIFY` values with the real number in `site.ts`, then
have the orchestrator remove the flags. Add a **production build gate** that fails when
`phoneE164 === "+639000000000"`.

---

**#2 — A sticky surface or a layout shift is swallowing the tap.** *(very likely)*

Impressions up means more traffic, including more traffic on a small screen. If a sticky
bar, a cookie-ish element, a promo strip, or a new sticky header covers the call button,
or the button moved below the fold because the page got taller, taps land on the wrong
element. `FC-1` and `FC-9` exist because this failure mode is easy to ship by accident.

**Check:**
1. Open `/` at **360 × 640** and `/contact` at 360 × 640, on a real device. Tap the
   exact centre of `Call Shop Now`. Repeat on `/services`, `/deals`, `/gallery`, `/about`,
   `/book` and a 404 page. Nine manual taps take 60 seconds and settle it.
2. DevTools → Inspect: is the call button `document.elementFromPoint(x, y)` at its own
   centre? If not, something is on top. This is the definitive test.
3. Compare `cta_clicked{cta_id: "mobilebar-call"}` against `call_clicked`. If
   `mobilebar-call` fires but `call_clicked` does not, the tap is being intercepted.
4. Check CLS by day for the last 30 days. A CLS spike in the same window as the
   impression spike points straight here.
5. Compare `cta_clicked{cta_id: "header-call"}` (which is at the top, never covered) with
   `cta_clicked{cta_id: "mobilebar-call"}` (which is at the bottom). If the header rate
   held and the bar rate collapsed, the bar is the problem.
6. If a third-party widget was added (a chat bubble, a pixel that injects a div), that is
   the cause. `MOBILE-FIRST-SPEC.md` §4.1 bans floating widgets for exactly this reason.
7. Confirm `barMode()` still returns the expected value on every route after whatever
   changed (`CTA-MAP.md` §5` matrix`).

**Fix:** reinstate FC-1, remove the offending element, re-measure. Log it as
`error_shown{reason: "click_intercepted"}` if you instrument an
`elementFromPoint` assertion in dev only.

---

**#3 — The page got slower or heavier.** *(likely)*

More traffic on a heavier page converts worse even when nothing is broken. The budget in
`MOBILE-FIRST-SPEC.md` §8 exists to catch exactly this regression, and it is the one
cause on this list that is invisible in analytics.

**Check:**
1. Compare p75 **LCP / INP / CLS** for the two weeks, split by `device: "mobile"`.
   Compare the impression-rise week to the week before, not to last quarter.
2. Find the LCP element for the top 3 landing routes. If it is now an **image** rather
   than the `h1` text, someone added or resized a hero image.
3. Diff the JS bundle size week over week (`next build` output, `.next/static/chunks`).
   Anything over +15 KB on a route that did not need it is the suspect.
4. Run Lighthouse with the **Slow 4G** profile and a Moto G Power CPU throttle on the
   top landing route. If LCP > 2.5 s, this is it. Check whether a font, an icon set or a
   component was added without a `content-visibility` or `loading="lazy"`.
5. Count first-load requests and total transferred bytes. Over 20 requests or over
   1.5 MB on 3G is out of budget.
6. Check whether a third-party script appeared. `MOBILE-FIRST-SPEC.md` §8.1 sets the
   budget at **zero** third-party bytes. Any non-zero number is a regression, full stop.
7. Check the Web Vitals field data (CrUX) if there is enough traffic, not just the lab.
   Lab and field disagree often, and the field is what the customer felt.

**Fix:** return to the budget. `content-visibility: auto` on below-fold sections,
`loading="lazy"` on everything but the hero, `fetchpriority="high"` on the hero, and
strip any third-party tag that was added for "tracking".

---

**#4 — The traffic mix changed, not the page.** *(likely, and the most misdiagnosed)*

Impressions rose from queries that were never going to call, or from a cheap campaign
with a bad landing page, or from a viral Facebook post that brought people looking for
something the shop does not do. Conversion rate per impression drops while absolute
bookings stay flat — which reads as "calls are down" on a percentage chart and is not a
site problem at all.

**Check:**
1. Search Console → Queries, filtered to the impression-rise window. Compute the share of
   impressions on **branded** terms (`eyg`, `eyg tire`) vs **non-branded** (`tire shop
   balanga`, `pms bataan`, `wheel alignment near me`). A branded share of 70 %+ means
   you are counting your own existing customers as new reach.
2. Which queries grew? Cross-reference the top 10 against what the shop actually does.
   `pms near me` is high intent. `tire shop` is medium. `how much is a tire change` is
   research, and it will not call on a phone.
3. Referrer mix on `call_clicked` and `booking_completed`. If impressions grew from
   Facebook and calls grew from organic, the paid/social traffic is not calling.
4. **Absolute numbers, not rates.** If `call_clicked` is down 5 % while impressions are
   up 40 %, bookings may be flat or up. The shop is fine and the report is wrong. Check
   the front desk's notebook before touching the site.
5. Check paid search: spend vs `call_clicked` and `booking_completed` by campaign. A
   campaign with a landing page that is not one of the nine routes is sending people to a
   404.
6. Compare `booking_started` (the intent signal, which is traffic-independent) against
   impressions. If `booking_started` per 1,000 impressions held steady, **the funnel is
   healthy and only the traffic quality changed.**

**Fix:** none on the site. Adjust the reporting, and fix the campaign's landing page.

---

**#5 — A trust gap: the page promises more than the shop delivers.** *(moderately likely)*

This audience's stated fears are being overcharged, being upsold, and the car being
damaged. If the site makes a claim the shop cannot keep at the counter — or displays an
unverified number, or hides the price, or shows a review section with nothing in it — the
customer leaves quietly. It shows up as "they read the page and called nobody", which is
indistinguishable from a layout problem in a funnel report.

**Check:**
1. `error_shown{code: "NOT_FOUND", reason: "empty_reviews" | "empty_gallery" |
   "empty_promos"}`. A rising count means a trust section is rendering empty. It should
   not be rendering at all (`ERROR-AND-EDGE-STATES.md` §3, E1a/E2a/E3).
2. `BUSINESS.trust.ratingCount === 0` — is any star or number rendering? If
   `4.9` appears with zero reviews, that is a live lie and it must come down today.
3. Do prices render? Check that every `FIXED`/`RANGE` service shows a figure, that
   `CALL_FOR_PRICE` says `Ask us` and **not** a number, and that no single figure is shown
   while a `CALL_FOR_PRICE` item is in the basket.
4. Hours: do the site's `BUSINESS_HOURS` match the Google Business Profile and any
   `Holiday` rows? `is_closed_at_click` on `call_clicked` — if customers are mostly
   clicking when the site says **closed**, the hours are wrong and they are tapping anyway
   (which means the calls are happening and being missed) or they are not tapping.
5. Is the address exact? Compare the NAP on the site, the GBP and the official Facebook
   page. A wrong landmark or a wrong pin loses the in-person visit.
6. Scroll-depth: compare 25/50/75/100 by device. If mobile scroll depth collapsed at the
   price section, customers are reading a price and leaving — which is a **price** problem
   or a **trust** problem, not a traffic problem. Check whether the price ranges on the
   landing page match the ranges in the estimator; a mismatch is a fast trust-killer.
7. Check the estimator's `quote_estimated{variant: "human"}` rate. If many customers hit
   "we'll price this for you", the catalogue has too many `CALL_FOR_PRICE` services and
   the site cannot answer the customer's actual question. That is a pricing-data problem
   pretending to be a UX problem.

**Fix:** remove the unverified claim, fix the hours, show the prices, or hide the empty
section. Then re-measure.

---

**#6 — A conversion got harder, or the hours/availability got wrong.** *(less likely, high cost)*

Someone added a step, a field, a required checkbox, a CAPTCHA, an account wall, a cookie
banner, or a promo interstitial. Or the availability API started returning empty days, or
`capacityPerSlot` was changed to a value the bays cannot support, or a `BayClosure` was
left in the table and closed the calendar for a fortnight.

**Check:**
1. Diff `booking_step_completed` by step, week over week. **A change in the drop-off at
   exactly one step is the signature of a UX change.** If step 2 → 3 conversion fell 20
   points, something happened in step 2 or 3.
2. Count form fields per step in the live DOM. A new required field appears in the diff.
   The consent boxes are the two legal additions; anything beyond that needs a reason.
3. `validation_retries` on `booking_step_completed`. A jump means new validation is
   blocking people.
4. Interstitial audit: grep the bundle for `role="dialog"` and any full-viewport overlay
   that appears on scroll. `FC-5` permits exactly one non-modal, non-trapping surface
   (the exit-intent sheet) and it must not fire on mobile.
5. `error_shown{code: "MAINTENANCE"}` and `code: "SERVICE_UNAVAILABLE"` by day. A
   weekend of 500s or a maintenance flag left on would do this.
6. `error_shown{code: "SLOT_UNAVAILABLE", reason: "bay_closure"}` and the `BayClosure`
   table. A closure left active with a wide `endsAt` makes the whole calendar look empty
   and every customer bails at step 3.
7. `slot_race_lost` by day. If this number exploded, `capacityPerSlot` (currently 3,
   `TODO-VERIFY`) is higher than the real number of bays. The shop is over-selling its
   capacity and the front desk is refusing people who were told a bay was theirs.
8. `BOOKING.minLeadMinutes` / `breakWindows` / `horizonDays` — a config change that
   removes today's slots makes the calendar look empty for the exact customers who need
   it urgently.
9. `error_shown{code: "RATE_LIMITED"}` by route. A rate limit on the availability endpoint
   returns an empty calendar, which looks identical to "no bays" to the customer.
   `ERROR-AND-EDGE-STATES.md` §7 requires availability to return 200 with an empty array
   rather than a 429 — check that this is still true.

**Fix:** revert the step, remove the interstitial, fix the closure row, or lower
`capacityPerSlot` to the real number of bays.

---

### 2.1 Fast triage order (10 minutes, in this order)

1. Is `phoneE164` still the `TODO-VERIFY` placeholder? → It is #1. Done.
2. Nine manual taps at 360 × 640 with Inspect open. → It is #2. Done.
3. Front desk's count of answered calls for the last 14 days, absolute number. → This
   tells you whether there is a problem at all. Do this before touching the code.
4. `booking_started` per 1,000 impressions, this week vs last. Flat → #4 (traffic mix).
   Down → the funnel broke.
5. `booking_step_completed` by step, week over week. A single step's drop → #6.
6. p75 LCP/INP on mobile, this week vs last. A regression → #3.
7. `empty_reviews` / `empty_gallery` counts and the rating render. → #5.
8. `slot_race_lost` and the `BayClosure` table. → #6.

---

## 3. Weekly review checklist

Run it **Monday morning, 30 minutes, with the owner if possible.** The owner's
notebook is the instrument; this is the checklist around it.

### Numbers (before the meeting)

- [ ] **Answered calls** last week, from the front desk. Not `call_clicked` — the real number.
- [ ] **Calls that went unanswered** (missed calls needing a call-back). A rising trend here with flat `call_clicked` is a *staffing* problem, not a site problem.
- [ ] **Bookings created by phone** vs by web. If phone books more than web, the site is a marketing page, not a booking funnel, and that is a fine outcome to state plainly.
- [ ] `booking_started` → `booking_completed`, week over week, by device.
- [ ] The step-by-step drop-off (1→2→3→4→complete), week over week. **A single step's change is the headline, not the total.**
- [ ] `call_clicked` by `cta_id`. Compare `header-call` (top of page) with `mobilebar-call` (bottom). A widening gap means the bar is failing (§2 #2).
- [ ] `error_shown` by `code` and `reason`, top 5, with day-over-day movement.
- [ ] `slot_race_lost` count and rate.
- [ ] `quote_estimated` by `variant`. A rising `human` or `wide` share is a **price-list** problem.
- [ ] `quote_estimated{variable_ids}` top 10. **This is the shop's to-do list for the week.**
- [ ] `vehicle_search_failed` top 10 make/model queries. **The catalogue's coverage gap list.**
- [ ] `promo_viewed{state: "expired"}` > 0 → a promo is still being shown after its end date. Fix today.
- [ ] `consent_toggled{which: "marketing", to: true}` rate — the marketing list's real size.
- [ ] Any `TODO-VERIFY` value still shipping in the UI. **Non-negotiable check.**

### Site health

- [ ] Lighthouse (Slow 4G, mobile) on `/`, `/services`, `/book`, `/deals`: LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- [ ] Field Web Vitals (CrUX) p75 for the top 3 routes.
- [ ] JS budget: `/` ≤ 120 KB, `/book` ≤ 170 KB compressed. **Zero third-party bytes.**
- [ ] `barMode()` matrix spot-checked on 3 routes.
- [ ] One full booking completed by hand on a real phone, offline and online.
- [ ] The phone number called from a **cold** device, not a cached one. It rings the shop.

### The three numbers that matter

1. **Answered calls** — the top-of-funnel truth.
2. **Bays booked** — the output. Count them from the `/admin` board, not from events.
3. **₱ invoiced** — the only number that pays wages. Everything else is a leading
   indicator, and a leading indicator that disagrees with this one is wrong.

### The Monday questions (5)

1. **How many people called the number on the site this week, and did a human answer?**
   *Why:* it is the only direct measure of the primary conversion, and it catches #1
   (wrong number) and #6 (hours) in one question. There is no event that substitutes
   for it. If the answer requires asking the front desk, that is the point.

2. **Of the people who started a booking online, how many finished, and exactly which
   step lost them?**
   *Why:* the step-level drop-off is the single most actionable funnel number, and it
   isolates cause #6 immediately. "Bookings are down" is not a finding. "Step 2 → 3 fell
   20 points because 6 of 9 customers hit a wide price range and left" is a finding.

3. **What did customers ask for that we could not price?**
   *Why:* `quote_estimated{variable_ids}`, `vehicle_search_failed` and the front desk's
   call notes, cross-referenced. Each entry is a concrete, doable job: add a price range,
   add a make/model to the list, or learn the part. This is how the price list improves
   without anyone guessing.

4. **What did we get wrong last week — a complaint, a slow reply, a price surprise, a
   no-show?**
   *Why:* the brief's core fear is being overcharged or having the car damaged. One
   unresolved complaint costs more than a month of traffic. This question is also the only
   one that catches `notification.status = "failed"` — the SMS that never arrived to a
   customer who was promised one.

5. **What is the one thing we will change this week, and who owns it by Friday?**
   *Why:* one change, one owner, one date. A review that produces five items produces
   none. The owner names the item before the meeting ends, and the next Monday opens by
   asking whether it shipped.

---

## 4. Targets

Stated as **directional ranges for a small shop in Balanga City**, not as quotas, and
to be replaced with real numbers after 8 weeks of data. The absolute volume will be
small; the *rates* are what are controllable.

| Metric | First 8 weeks | Steady state | Note |
| --- | --- | --- | --- |
| Homepage → any CTA | 6–9 % | 10–14 % | Emergency lane dominates; the bar does most of the work |
| Mobile bar tap-through (`mobilebar-call` → a real call) | 25–40 % of bar clicks | 35–50 % | Bar taps are the highest-intent action on the site |
| Hero CTA click-through | 3–5 % | 6–9 % | |
| Services → `/book` | 8–14 % | 15–22 % | |
| Estimator use → booking | 12–20 % | 20–30 % | |
| **Booking completion (started → confirmed)** | **35–50 %** | **55–70 %** | **The headline metric.** Below 35 % means a step is broken, not that the traffic is bad |
| Step 1 → 2 | 85–92 % | 92–96 % | The escape hatch exists; this should be high |
| Step 2 → 3 | 70–85 % | 85–92 % | A drop here is a pricing or a catalogue-coverage problem |
| Step 3 → 4 | 80–90 % | 88–95 % | A drop here is an availability or capacity problem |
| Step 4 → confirmed | 80–90 % | 88–95 % | A drop here is consent friction, CAPTCHA friction, or a payment-hallucination error state |
| Slot race rate | < 3 % | < 1.5 % | Above 3 % means `capacityPerSlot` is too high |
| `quote_estimated{variant: "human"}` | < 25 % | **< 10 %** | Above 25 % the catalogue cannot answer the customer's question |
| `quote_estimated{spread > 0.40}` | < 20 % | **< 8 %** | Each one is a price range to pin down |
| Mobile LCP p75 | < 3.0 s | < 2.5 s | |
| Error rate (`error_shown` per 1,000 sessions) | < 25 | < 10 | |
| `booking_abandoned` with `has_draft: true` returning within 7 days | > 15 % | > 25 % | The draft persistence working. If this is 0 %, `sessionStorage` is broken |
| SMS delivery success | > 95 % | > 98 % | Below 95 % and the "we'll text you" promise is not being kept |

**A note on sample size.** A shop booking 20–60 jobs a month will see single-digit
counts per week. **Do not act on a week-over-week move smaller than 20 % unless it is
in a rate that is computed from a large denominator** (like impressions or
`booking_started`). A "40 % drop in calls" that is a move from 6 to 4 is noise. The
Monday review exists to prevent decisions being made on noise, and that is its most
important job.

---

## 5. Anti-patterns in measurement

Metrics are where dark patterns hide, because nobody is watching.

| Refused | Why | Instead |
| --- | --- | --- |
| Dynamic number insertion / call tracking (swap in a special number for the ad) | On a small shop's own line it means staff answer a number they do not recognise, and it makes the site untrustworthy when the customer notices | One real number, always. The front desk's notebook |
| Counting a `call_clicked` as a conversion | A tap on a `tel:` link proves the customer *intended* to dial. It does not prove the shop exists, that it rang, or that anyone answered | Report `call_clicked` always beside the answered-call count. Never a conversion rate from `call_clicked` alone |
| Uncapped event volume | One panicking customer generates 30 call events and inflates every rate | Cap at 3 per `cta_id` per session |
| Any PII in analytics | A data-protection incident, and it makes the data useless for the questions above | §1.1's list. Server-side PII lives in the database, where it is queryable by a human who needs it |
| A "conversion" goal that is a scroll or a 30-second dwell | Optimising for it produces a slow, sticky, dishonest site | The only goals: `booking_completed`, `quote_captured`, and the front desk's answered calls |
| Comparing a week-over-week rate on a small denominator | Decisions made on noise | §4's note on sample size; use 4-week rolling windows |
| Hiding failed events | An error rate of 0 % means the instrumentation is broken, not the site | Fire-and-forget, never suppressed, deduplicated per `(code, reason)` only |
| Attribution to a single "last click" | Every shop gets credit for a returning customer's second visit | Report `entry` and `is_returning` alongside every conversion so repeat customers are visible rather than double-counted |
| Optimising for `booking_started` | It is a proxy that can be raised by making step 1 harder to fail | Report it as a diagnostic, never as a target. The target is `booking_completed` |

---

## 6. Instrumentation QA checklist

- [ ] No event property contains a name, phone, email, plate, note, or raw query string.
- [ ] No `stack` property, no `href` with a query, no full referrer URL.
- [ ] Analytics is zero bytes in the critical path and flushes only after `load`.
- [ ] A failed beacon does not throw, does not retry more than twice, and does not
      surface in the UI. Verified by blocking the collector endpoint and completing a
      booking.
- [ ] `cta_id` values match `CTA-MAP.md` §3 exactly. A CI assertion compares the set of
      `cta_id`s in the DOM against the spec and fails on a mismatch — this is how a
      renamed button gets caught before the data silently breaks.
- [ ] Every `error_shown` in `ERROR-AND-EDGE-STATES.md` has a matching event code.
- [ ] `call_clicked` is capped at 3 per `cta_id` per session.
- [ ] `phoneE164` placeholder detection fails the production build.
- [ ] Events in staging never reach a prod dashboard.
- [ ] The funnel works with JavaScript disabled: the number, the address, the hours and
      the primary CTAs are all in the raw HTML.
