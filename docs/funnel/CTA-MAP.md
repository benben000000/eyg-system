# CTA MAP — EYG Tire & Auto Care

**Owner:** funnel agent · **Scope:** every call-to-action on the site
**Contract:** `src/lib/types.ts`, `src/config/site.ts`, `src/app/globals.css`
**Status:** buildable. No TBD. Business facts referenced as `TODO-VERIFY` are
owned by the orchestrator and are **not** restated as real values here.

---

## 0. How to read this file

- **Placement** is a logical slot, not a component filename. Map it to whatever the
  frontend agent calls the component. The **`cta_id`** column is the contract —
  analytics, QA and copy tests all key off the id, never off the class name.
- **Variant**:

  | Variant | Style | Use for |
  | --- | --- | --- |
  | `emergency` | Racing-red plate, `shadow-cta`, hazard-hatch top edge, min 56 px tall | life-or-limb / stranded only |
  | `primary` | `bg-brand-500` + `text-ink-950` + `shadow-cta` | one per screen, the main conversion |
  | `secondary` | `border border-ink-400` + `text-ink-950`, transparent bg | the alternate lane |
  | `tertiary` | `text-ink-950 underline decoration-2 underline-offset-4` | third choice, always a real link |
  | `ghost` | `text-ink-700` / `text-ink-300` on dark, no border | low-stakes navigation, footer |

- **Fold** at 360 × 640 CSS px, the reference viewport for "above the fold" on this site.
- **Priority**: `P0` the page fails its job without it · `P1` strong measured lift ·
  `P2` nice, ships last.
- Microcopy sits **above** the button (it is read first) unless marked *below*.

---

## 1. The naming decision — why these labels

This is the single highest-leverage decision on the site, so the reasoning is written
out rather than assumed.

| Candidate label | Verdict | Reason |
| --- | --- | --- |
| **Book a Service Bay** | ✅ **primary conversion label** | 1. It names the *scarce resource*. The real constraint is 3 bays and a 90-minute lead time, and the customer already thinks in those terms — "kailangan ko ng bay". 2. It implies a **time**, which is what the product actually is, and it pairs naturally with the price range sitting next to it: *a bay, at this price, at this time*. 3. It sets the right expectation for Lane B. Nobody is promising work in 5 minutes. 4. It survives being read at a glance on a 5" cracked screen in daylight — three short words, no compound. 5. It is honest about what happens next: you are reserving a slot, not buying a product. |
| Book Now | ❌ rejected as primary | "Now" is the **emergency keyword** in this market — it belongs to *Call Shop Now* on the roadside banner. Using it for planned PMS creates a direct semantic collision: two different actions claiming the same word. It also promises immediacy the shop cannot honour (3 bays, `minLeadMinutes: 90`, closed Sundays). A customer who taps it at 4:50 PM and gets "Wednesday" feels lied to. |
| Get a Quote | ❌ rejected as primary | The shop's whole differentiator is price *transparency* — most of the catalogue is priced. "Get a Quote" implies the price is hidden, which argues against the business on its own homepage. It is also a weaker commitment than a booking: the visitor leaves with a number, not a bay. **Kept as a secondary** — and only on services with `pricing: "CALL_FOR_PRICE"`, where it is literally true. |
| Reserve a Bay | ❌ rejected | Reads like a hotel or a venue reservation. Wrong register for a pit stop. |
| Check My Estimate | ✅ accepted, **only** as the estimator's post-result CTA | At that point in the funnel the object of the verb exists and is specific. "Check" invites a small commitment with no cost. It would be wrong on the homepage, where there is no estimate yet. |
| Call Shop Now | ✅ accepted, emergency lane only | The unit of urgency is a human on a phone. "Shop" is the word locals use. "Now" is correct here and only here. |
| Send this to the shop | ✅ accepted, quote capture | Says exactly what happens: a human gets the estimate. No "free", no "instant", no lock-in. |
| Select {service} & pick date | ✅ accepted, per-service | Required by the brief. Sets the next two clicks in the label itself, so nobody taps blind. |

**Rule for every label on this site:** the label must contain the *verb the customer
will do*, not the verb the business does. We do not sell "PMS" or "slots" or
"conversions" — we sell a bay, a price and a text message.

---

## 2. Emergency roadside banner

Placement: **first thing in the main flow of every content route**, directly under the
sticky header, above the `<h1>`. Not sticky. Not a modal. Not dismissible — a stranded
customer who dismissed it has no way to get it back.

```html
<section class="eyg-hazard-top border-b-2 border-brand-500 bg-ink-950" aria-labelledby="roadside-h">
  <p class="eyg-eyebrow text-brand-500">Roadside</p>
  <h2 id="roadside-h" class="text-h3 text-white">Stranded on the road? Call us now.</h2>
  <p class="text-body text-ink-200">
    Roadside tyre help along the EGSA stretch and around Tuyo. Save this number before you need it.
  </p>
  <a href="tel:{BUSINESS.phoneE164}" class="btn btn-emergency" data-cta-id="emergency-banner-call">
    Call Shop Now
  </a>
  <a href={LINKS.messenger} class="btn btn-ghost text-ink-100" data-cta-id="emergency-banner-message">
    Message on Messenger
  </a>
</section>
```

**Exact strings**

| Slot | String |
| --- | --- |
| Eyebrow | `Roadside` |
| Headline (the only `h2`, 20–24 px) | `Stranded on the road? Call us now.` |
| Secondary line (max 2 lines at 360 px) | `Roadside tyre help along the EGSA stretch and around Tuyo. Save this number before you need it.` |
| Primary label | `Call Shop Now` |
| Primary sub-label, only if space allows | `{BUSINESS.phoneDisplay}` — displayed, never hidden, because some people read the number before trusting the button |
| Ghost label | `Message on Messenger` |

**Closed-hours variant** (shop closed at render time per `BUSINESS_HOURS` +
`Holiday` rows). Same markup, `data-open="false"`, and the order of the two actions
**inverts** — we do not put a `tel:` in the primary slot when nobody will answer it:

| Slot | String |
| --- | --- |
| Headline | `The shop is closed right now. We open {weekday} at {opens}.` |
| Secondary | `Send us a message and we'll reply in the morning. If you're stranded, the emergency number on your roadside assistance is the fastest way in.` |
| Primary label | `Message on Messenger` |
| Secondary label | `Call Shop Now` (with the sub-note `We usually answer fast when we're open.`) |
| Status pill (rendered beside the eyebrow) | `Closed now · opens {weekday} 8:00 AM` or `Open now · until 5:00 PM` |

**Why "Call Shop Now" and not "Call Us"** — "Call us" is ambiguous with the Facebook
page and with a landline. "Call Shop Now" names the *destination* (the shop, not a
person, not a hotline queue) and the *urgency*. It also survives translation to Taglish
("tawag sa shop") without losing force.

**Banner presence rules**

| Route | Banner |
| --- | --- |
| `/` | Yes, above the hero `<h1>` |
| `/services` `/deals` `/contact` `/gallery` `/about` | Yes, top of main |
| `/book` steps 1–4 | **No.** The wizard footer already owns the phone as a 48 px icon button (see §5). Two bars = the collision the frequency cap forbids. |
| `/book` success | No |
| `/privacy` `/terms` | Yes — a stranded customer does not care which legal page they landed on |
| `/admin` | No |
| 404 / 500 / 403 / 429 / maintenance / offline | Replaced by the single-button state in §5 |

---

## 3. Full CTA inventory

`→` marks the destination. `({...})` marks a value interpolated from config/DB.

### 3.1 Global chrome

| # | Page | Placement (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Fold | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | all | Sticky header, right (`header-call`) | `Call` + phone glyph | secondary | `LINKS.call` (`tel:`) | — | above | **P0** |
| G2 | all | Sticky header, right (`header-book`) | `Book a Service Bay` | primary | `/book` | — | above | **P0** (≥768 px only — see §5) |
| G3 | all | Mobile action bar, left (`mobilebar-call`) | `Call Shop Now` | emergency | `LINKS.call` | — | sticky | **P0** |
| G4 | all | Mobile action bar, right (`mobilebar-message`) | `Message` + chat glyph | secondary | `LINKS.messenger` | — | sticky | **P0** |
| G5 | all | Footer (`footer-call`) | `Call {({BUSINESS.phoneDisplay})}` | primary | `LINKS.call` | `Tap to call. A person picks up.` | below | **P0** |
| G6 | all | Footer (`footer-book`) | `Book a Service Bay` | secondary | `/book` | — | below | P1 |
| G7 | all | Footer (`footer-directions`) | `Get directions` | secondary | `LINKS.directionsGoogle` | `{ADDRESS_ONE_LINE}` | below | P1 |
| G8 | all | Footer (`footer-facebook`) | `See us on Facebook` | ghost | `{BUSINESS.social.facebook}` | — | below | P2 |
| G9 | all | Skip link (`skip-to-main`) | `Skip to main content` | ghost | `#main` | — | n/a | **P0** (a11y) |

G1/G2 collapse into a 52 px compact header past 120 px of scroll (see
`MOBILE-FIRST-SPEC.md` §3). G1's accessible name is
`Call EYG Tire & Auto Care at {BUSINESS.phoneDisplay}` — the visible text says `Call`,
the icon carries the number.

### 3.2 Homepage `/`

| # | Placement (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Fold | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | `home.roadside-call` / `home.roadside-message` | `Call Shop Now` / `Message on Messenger` | emergency / ghost | `LINKS.call` / `LINKS.messenger` | see §2 | above | **P0** |
| H2 | Hero (`home.hero-book`) | `Book a Service Bay` | primary | `/book` | `No account needed. Takes about a minute.` | above | **P0** |
| H3 | Hero (`home.hero-call`) | `Call the shop` | secondary | `LINKS.call` | `Open Monday to Saturday, 8 AM to 5 PM.` | above | **P0** |
| H4 | Hero (`home.hero-quote`) | `Check prices first` | tertiary | `/#price-estimator` | `Not ready to book? Get a range first.` | above | P1 |
| H5 | Popular services rail (`home.service-select`, `service_slug`) | `Select {shortName} & pick date` | primary | `/book?step=2&service={slug}` | `From {formatPeso(priceMin)} · about {duration}` | below | **P0** |
| H6 | Estimator result (`home.estimator-book`) | `Book a Service Bay with this` | primary | `/book?from=quote&…` | `Your selection is carried over. Nothing is booked yet.` | below | **P0** |
| H7 | Estimator result (`home.estimator-send`) | `Send this to the shop` | secondary | quote capture sheet | `We'll text you a fixed price. No booking, no payment.` | below | P1 |
| H8 | Trust/why-us strip (`home.why-call`) | `Call and ask` | secondary | `LINKS.call` | `Ask any question before you book. We don't mind.` | below | P2 |
| H9 | Booking preview (`home.book-cta`) | `Book a Service Bay` | primary | `/book` | `Three bays. Pick a day, pick an hour.` | below | **P0** |
| H10 | FAQ (`home.faq-more`) | `See all services` | tertiary | `/services` | — | below | P2 |
| H11 | Location (`home.directions`) | `Get directions` | secondary | `LINKS.directionsGoogle` | `{ADDRESS_ONE_LINE}` | below | P1 |
| H12 | Near the footer (`home.footer-call-repeat`) | `Call Shop Now` | emergency | `LINKS.call` | — | below | **P0** (4th and last phone CTA in the flow) |

### 3.3 `/services`

| # | Placement (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Fold | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Page header (`services.header-book`) | `Book a Service Bay` | primary | `/book` | `Pick a day after you choose your services.` | above | **P0** |
| S2 | Every service card (`services.card-select`, `service_slug`) | `Select {shortName} & pick date` | primary | `/book?step=2&service={slug}` | `Price range above · about {duration}` | mixed — **the button must sit inside the first 640 px of every card** | **P0** |
| S3 | Filter bar (`services.filter-clear`) | `Clear filters` | ghost | resets query | — | above | P2 |
| S4 | Filter bar, zero results (`services.zero-call`) | `Call and ask about your car` | secondary | `LINKS.call` | `We probably still do it. Just ask.` | above | **P0** (on the zero-result state only) |
| S5 | Package card (`services.package-select`, `package_slug`) | `Select {shortName} & pick date` | primary | `/book?step=2&package={slug}` | `Saves about {savingsPct}% · {items.length} services` | mixed | **P0** |
| S6 | Category jump (`services.category-jump`, `category_slug`) | `{categoryName}` | tertiary | `#cat-{slug}` | — | above | P2 |
| S7 | Sticky bottom of the page (`services.sticky-book`) | `Review and pick a date` | primary | `/book?step=2` | `{n} selected · about {duration} · {priceRange}` | sticky | **P1** — appears only when ≥1 service is selected |

`S7` is a **selection tray**, not a second bar. It occupies the same slot as the mobile
action bar and is subject to the frequency cap FC-1. It never renders on the same
viewport as `mobilebar-call`; when it renders, the action bar is suppressed and its
phone entry is the small phone icon in the tray (same merge as `/book`).

### 3.4 `/book`

| # | Placement (`cta_id`) | Exact label | Variant | Destination | Microcopy above | Fold | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Wizard footer, right (`book.continue`), steps 1–3 | `Continue to {next step name}` | primary | next step | `{stepContextLine}` | sticky | **P0** |
| B2 | Wizard footer, left (`book.footer-call`) | *(icon only, 48 × 48)* | emergency | `LINKS.call` | `aria-label="Call the shop"` + `title="Call the shop"` | sticky | **P0** |
| B3 | Wizard footer, right (`book.confirm`), step 4 | `Confirm booking` | primary | `POST /api/booking` | `We'll text you a confirmation. Nothing is charged now.` | sticky | **P0** |
| B4 | Progress stepper (`book.step-jump`, `step`) | `Step {n}: {name}` | tertiary | in-page focus move | — | above | P1 |
| B5 | Step 2, empty selection (`book.step2-choose-first`) | `Choose at least one service` | primary | focus first service row | `Pick the work you need, then pick a time.` | above | **P0** (state-dependent) |
| B6 | Vehicle escape hatch (`book.vehicle-manual`) | `Not in the list? Enter it yourself` | tertiary | reveal free-text fields | — | below | **P0** |
| B7 | Vehicle skip (`book.vehicle-skip`) | `Skip for now — I'll tell you at the counter` | ghost | nulls `vehicle` | `You can still book. We just won't know your car in advance.` | below | **P0** |
| B8 | Add second car (`book.vehicle-add`) | `Add another vehicle` | secondary | vehicle sheet | `One booking is one car. Finish this one first.` | below | P1 |
| B9 | Slot race recovery (`book.slot-race-see-others`) | `See other times on {date}` | primary | refetch availability | `Nothing was booked and you were not charged.` | above | **P0** (state-dependent) |
| B10 | Slot race recovery (`book.slot-race-call`) | `Call us to hold that bay` | secondary | `LINKS.call` | `Someone can hold it while you come in.` | above | **P0** (state-dependent) |
| B11 | Submit failure (`book.retry`) | `Try again` | primary | resubmit | `Your details are still here. We didn't lose them.` | inline | **P0** (state-dependent) |
| B12 | Success (`success.calendar`) | `Add to calendar` | primary | client-built `.ics` Blob | `One tap. It lands in your phone's calendar.` | above | **P0** |
| B13 | Success (`success.directions`) | `Get directions to the shop` | secondary | `LINKS.directionsGoogle` | `{ADDRESS_ONE_LINE}` | above | **P0** |
| B14 | Success (`success.call`) | `Call the shop` | secondary | `LINKS.call` | `Open {hours}. If you're running late, call.` | above | **P0** |
| B15 | Success (`success.another`) | `Book another service` | tertiary | reset to step 2 keeping the vehicle | — | below | P1 |

**B-label rule:** the Continue label always names the destination
(`Continue to Services`, `Continue to Date & Time`, `Continue to Your details`).
Never `Next`, never `Submit`, never `Continue` on its own.

### 3.5 `/deals`

| # | Placement (`cta_id`) | Exact label | Variant | Destination | Fold | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Page header (`deals.header-book`) | `Book a Service Bay` | primary | `/book` | above | **P0** |
| D2 | Promo card (`deals.claim`, `promo_slug`) | `Claim {promoTitle}` | primary | `/book?step=2&promo={code}` | mixed | **P0** |
| D3 | Promo terms (`deals.promo-terms`) | `Read the terms` | tertiary | `<details>` disclosure | above | **P0** (must be visible above the claim button, not behind it) |
| D4 | Expired promo (`deals.promo-expired`) | `See current prices` | secondary | `/services` | above | **P0** (state-dependent) |
| D5 | No promos running (`deals.none-book`) | `See regular prices` | primary | `/services` | above | **P0** (state-dependent) |
| D6 | No promos running (`deals.none-tellme`) | `Tell me when one starts` | secondary | newsletter form | above | P1 |

### 3.6 `/contact`, `/gallery`, `/about`

| # | Page | Placement (`cta_id`) | Exact label | Variant | Destination | Fold | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | `/contact` | Map card (`contact.directions-google`) | `Open in Google Maps` | primary | `LINKS.directionsGoogle` | above | **P0** |
| C2 | `/contact` | Map card (`contact.directions-waze`) | `Open in Waze` | secondary | `LINKS.directionsWaze` | above | P1 |
| C3 | `/contact` | Hours card (`contact.call`) | `Call the shop` | primary | `LINKS.call` | above | **P0** |
| C4 | `/contact` | Contact form (`contact.send`) | `Send message` | primary | `POST /api/leads` | below | P1 |
| C5 | `/contact` | Contact form microcopy | `Someone replies within one working day. For anything urgent, call.` | — | — | below | **P0** |
| C6 | `/contact` | Payments card (`contact.payment-ask`) | `Ask about installments` | tertiary | `LINKS.whatsapp` | below | P2 |
| G1 | `/gallery` | Hero (`gallery.book`) | `Book a Service Bay` | primary | `/book` | above | **P0** |
| G2 | `/gallery` | Empty state (`gallery.empty-message`) | `Message on Messenger` | primary | `LINKS.messenger` | above | **P0** (state-dependent) |
| G3 | `/gallery` | Empty state (`gallery.empty-call`) | `Call the shop` | secondary | `LINKS.call` | above | P1 |
| A1 | `/about` | Hero (`about.book`) | `Book a Service Bay` | primary | `/book` | above | **P0** |
| A2 | `/about` | Guarantees (`about.call-claim`) | `Ask about our guarantee` | secondary | `LINKS.call` | below | P2 |
| A3 | `/about` | Team (`about.call-team`) | `Call the shop` | secondary | `LINKS.call` | below | P2 |

### 3.7 Error routes

All five error routes collapse to a **single** conversion. There is nothing else to do
on a 500 page, and offering three buttons would be theatre.

| Placement (`cta_id`) | Exact label | Variant | Destination | Fold | Pri |
| --- | --- | --- | --- | --- | --- |
| `error.call` | `Call Shop Now` | emergency | `LINKS.call` | above | **P0** |
| `error.retry` (429, 500, maintenance only) | `Try again` | secondary | reload / the origin route | above | P1 |
| `error.home` (404 only) | `Go to the homepage` | secondary | `/` | above | **P0** |
| `error.services` (404 only) | `See all services` | tertiary | `/services` | above | P1 |

The full copy for every error route is in `ERROR-AND-EDGE-STATES.md` §1.

---

## 4. Frequency caps

| ID | Rule | Enforcement |
| --- | --- | --- |
| **FC-1** | **Never two sticky surfaces at once.** The sticky layer has exactly one owner at any viewport. Candidates: mobile action bar (`z-mobile-bar`), wizard footer, services selection tray, admin top bar. Priority order on collision: `error/offline single-call` > `wizard footer` > `selection tray` > `mobile action bar`. The winner is the only one rendered. | A single `useStickyOwner()` hook returning the winning id; the others return `null`. This is a render-time decision, not a z-index decision. |
| **FC-2** | The emergency banner appears **once per page**, never sticky, never inside a modal, never on `/admin`, never on `/book`. | Render guard. |
| **FC-3** | **Phone-CTA density cap: 5 per page max** (header, hero, one mid-flow, sticky bar, footer). `/contact` gets 6 because contact is that page's job. Going past 5 reads as desperation and makes the page feel like a call-centre funnel. | Count at build time in review, not at runtime. |
| **FC-4** | **No two identical `cta_id` in the same viewport.** Duplicate ids break analytics attribution and screen-reader navigation. | `cta_id` must be unique in the DOM; suffixes (`-2`) are not allowed — the id is a type, not an instance. |
| **FC-5** | **Zero interstitials.** No cookie wall, no "subscribe before you continue", no app-install prompt, no full-screen gate. The brief forbids them and on a ₱3,000 Android over 3G they cost more than they return. The only permitted overlay is the exit-intent quote sheet (`QUOTE-ESTIMATOR.md` §6), which is non-modal, non-trapping, once per 30 days, and permanently reversible by a visible link. | No `role="dialog"` on scroll. |
| **FC-6** | **One intent per viewport.** `hero-primary-book` and `estimator-next-book` are the same intent — never both in view. On `/` the estimator sits below the booking section for this reason. | Layout. |
| **FC-7** | No CTA renders in the first **400 ms** after a client-side route change. Prevents mis-taps during the transition and kills transition CLS. | `useDelayedMount(400)`. |
| **FC-8** | The sticky bar **never hides on scroll.** No hide-on-scroll-down anywhere in the product. See §5 for the full collapse rule. | Non-negotiable. |
| **FC-9** | Promo and deal CTAs never outrank a service CTA on the same page. A discount never becomes the page's primary conversion on a page whose job is service discovery. | Layout + variant rule. |

---

## 5. The mobile quick-action bar — exact per-route rule

Implemented as one pure function so QA can unit-test the whole matrix.

```ts
type BarMode =
  | "none"                       // nothing rendered
  | "single-call"                // one 100%-width emergency call button
  | "full"                       // Call Shop Now + Message
  | "contact"                    // Get directions + Call Shop Now
  | "wizard-merged";             // phone icon + the wizard's own Continue/Confirm

function barMode(input: {
  route: string;
  step?: number;
  isOnline: boolean;
  isErrorPage: boolean;
  isOverlayOpen: boolean;        // any modal, sheet or map fullscreen
  isSuccess: boolean;
}): BarMode {
  if (input.isErrorPage || !input.isOnline) return "single-call";
  if (input.route === "/admin") return "none";
  if (input.isOverlayOpen) return "none";
  if (input.isSuccess) return "none";
  if (input.route === "/book") return "wizard-merged";
  if (input.route === "/contact") return "contact";
  return "full";
}
```

| Route / state | Mode | Left slot | Right slot | Width split |
| --- | --- | --- | --- | --- |
| `/` | `full` | `Call Shop Now` (emergency) | `Message` (secondary) | 55 / 45 |
| `/services` | `full` | `Call Shop Now` | `Message` | 55 / 45 |
| `/deals` | `full` | `Call Shop Now` | `Message` | 55 / 45 |
| `/gallery` | `full` | `Call Shop Now` | `Message` | 55 / 45 |
| `/about` | `full` | `Call Shop Now` | `Message` | 55 / 45 |
| `/contact` | `contact` | `Get directions` (secondary) | `Call Shop Now` (emergency) | 45 / 55 |
| `/privacy` `/terms` | `full` | `Call Shop Now` | `Message` | 55 / 45 |
| `/book` steps 1–3 | `wizard-merged` | 48 px phone icon (emergency) | `Continue to {next step}` (primary) | 48 px / 1fr |
| `/book` step 4 | `wizard-merged` | 48 px phone icon (emergency) | `Confirm booking` (primary) | 48 px / 1fr |
| `/book` success | `none` | — | — | — |
| `/admin` | `none` | — | — | — |
| 404 / 403 / 500 / 429 / maintenance | `single-call` | `Call Shop Now` (100 %) | — | 100 |
| Offline (any route) | `single-call` | `Call Shop Now` (100 %) | — | 100 |
| Any route with a modal/map fullscreen open | `none` | — | — | — |

**Accessible names.** The `Message` button is visually `Message` + a chat glyph; its
accessible name is `Message EYG Tire & Auto Care on Messenger` (`m.me/EYGTireAutoCare`
is `TODO-VERIFY` in `site.ts` — the visible label must not depend on it resolving).
The `Get directions` accessible name is `Get directions to EYG Tire & Auto Care, EGSA
Fourlanes, Tuyo, Balanga City`. Icon-only buttons always carry `aria-label`.

**When it collapses / hides.** Only on the four conditions in the function above. It
**never** collapses on scroll, never on a timer, never after N seconds, and never on
"scroll depth" heuristics. Hysteresis: when the mode changes, delay the *removal* by
120 ms and apply the *addition* immediately, so a fast tap during a route change cannot
land on a disappearing button.

**Where the phone number is *not* guaranteed.** If `BUSINESS.phoneE164` is still the
`TODO-VERIFY` placeholder, the bar must render the call button **disabled with a
visible note** rather than dialling a number that does not exist — but only in non-
production builds. In production a build must fail if `phoneE164` is still the
placeholder (see `FUNNEL-METRICS.md` §6, Monday question 1).

---

## 6. Anti-patterns — refused, with the replacement designed

| Refused pattern | Why it is a dark pattern | What we ship instead |
| --- | --- | --- |
| `Learn more` as any primary CTA | It is a content-shape label, not an action. It hides the destination and it is the exact verb a visitor uses to skip. | Every CTA names its destination: `Book a Service Bay`, `Call Shop Now`, `Get directions`, `See all services`. Tertiary CTAs are also real destinations, never `Read more`. |
| `Submit` as a button label | The customer cannot tell what submitting does, whether it costs anything, or when they will hear back. | `Confirm booking` with the promise directly above it: `We'll text you a confirmation. Nothing is charged now.` Quote capture: `Send this to the shop`. Contact: `Send message` with `Someone replies within one working day.` above it. |
| A button that leads nowhere (`href="#"`, no handler, a disabled "coming soon" primary) | A dead-end button is a promise the business does not keep. | Every CTA resolves to a route, a `tel:`/`wa.me`/`m.me` link, or a documented POST. If a feature is not built, the button does not ship. `Coming soon` is reserved for genuinely announced upcoming promos (`ERROR-AND-EDGE-STATES.md` §9) and is never styled as a primary. |
| An entire card as a link, with a button inside it | Nested interactive elements break keyboard and screen-reader navigation and cause the classic "which one did I click" bug. | Cards are static. Only the labelled button is interactive. |
| A secondary CTA with lower contrast than body text | The hierarchy is expressed in colour alone and disappears in sunlight or for low-vision users. | Every variant meets ≥ 4.5:1 for its label (`ACCESSIBILITY-SPEC.md` §1). Hierarchy is carried by size, fill and position as well as colour. |
| A dismissible emergency banner | A stranded customer who swipes it away has no recovery path. | The banner is not dismissible on content routes. On error routes it is replaced by an undismissible single-call bar. |
| Two sticky bars (action bar + wizard footer + selection tray) | The second bar covers the first bar's targets and eats the bottom 130 px of a 640 px screen. | FC-1. One owner, resolved in render. |
| A booking form that requires an account, or asks for a card number | Pure friction for a shop that takes cash, GCash and cards *at the counter*. | No account. No payment on the site. The only gate is one specific, un-pre-checked SMS consent checkbox, with a call-the-shop escape hatch printed directly beneath it. |
| Pre-checked consent boxes | Bundled, silent, non-specific consent. Illegal in intent under RA 10173. | Both checkboxes render unchecked. Each has its own full sentence. The optional one is never on the critical path. |
| A fake-scarcity slot grid ("Only 2 left!") generated client-side | Manufactured urgency. The customer who drives in and finds three free bays learns we lie about everything, including the price. | `capacityLeft` is rendered exactly as `SlotAvailabilityDto` returns it. One slot per day may carry `isBest` → `Recommended`, and the **reason** is printed (`Two bays free — easier to shift if plans change.`). |
| A countdown timer on the estimate | Manufactured deadline on a price. | `expiresAt` is a factual catalogue-snapshot timestamp, copy is `Prices checked at {time}.`, and the number never changes. No timer, no urgency colour. |
| "Free" on anything that is not free, or "instant quote" for a range | Two lies that cost the relationship at the counter. | `Estimate` and `range` everywhere. The only "free" on the site is a genuinely free item, and only if the owner confirms it. |
| Hiding the phone behind a form | Puts a form between a stranded human and a human who can help. | The phone is one thumb-reach on every viewport, always (FC-8). The contact form is a *fourth* option on `/contact`, not a gate. |
| A "Are you sure you want to leave?" modal on back-navigation | Traps the user, breaks the browser back button, and is the single most hostile pattern on mobile web. | The booking draft is persisted to `sessionStorage` and restored. No exit guard, no `beforeunload` prompt (`BOOKING-FLOW.md` §9). |

---

## 7. CTA QA checklist

Run against every route at 360 × 640, 390 × 844 and 1280 × 800, light and dark themes,
`prefers-reduced-motion: reduce` on, keyboard only, VoiceOver + NVDA.

- [ ] Exactly one `primary`-variant button is in the first viewport.
- [ ] FC-1: at most one of {mobile action bar, wizard footer, selection tray} in the DOM.
- [ ] FC-3: at most 5 phone CTAs per page (6 on `/contact`).
- [ ] Every `cta_id` in §3 is present in the DOM with the exact label from this file.
- [ ] Every `tel:` CTA is a real `<a href="tel:…">`, not a `<button>` with a handler.
- [ ] Every CTA has a ≥ 44 × 44 px target and a visible `:focus-visible` ring.
- [ ] `barMode()` returns the expected value for all 11 rows of the §5 matrix.
- [ ] `barMode()` returns `single-call` when the network is forced offline.
- [ ] Emergency banner flips to the closed variant with the next-open string when the
      clock is moved past `BUSINESS_HOURS` close, and on Sundays.
- [ ] `pb-action-bar` padding equals the *measured* bar height at 200 % zoom (bar wraps
      to two rows) — see `ACCESSIBILITY-SPEC.md` §7.
- [ ] No `href="#"` and no `onClick` with no effect anywhere in the repo.
- [ ] Zero occurrences of `Learn more`, `Submit` (as a standalone label), `Read more`,
      `Click here`, `Hurry`, `Limited slots`, `Only X left` (unless API-sourced).
