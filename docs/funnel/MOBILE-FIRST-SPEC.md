# MOBILE-FIRST SPEC

**Owner:** funnel agent · Primary reference device: **a ₱3,000 Android on 3G** —
the brief's stated floor, and the real customer.

---

## 1. Viewport and layout budget

| Property | Value |
| --- | --- |
| Design reference | 360 × 640 CSS px (smallest realistic) · 390 × 844 (the common case) |
| Breakpoint to desktop | `min-width: 768px` — the action bar is `display: none` at and above it |
| Content width | `100%` up to 640 px, then `--container-page` (`76rem`) centred |
| Prose width | `--container-prose` (`44rem`) max, for `/about` and legal pages |
| Gutter | 16 px at ≤ 480 px, 20 px at ≤ 767 px, 24 px at ≥ 768 px |
| Body min width | 320 px. **The document must not scroll horizontally at 320 px** (except the three declared single-axis scrollers) |
| Viewport unit | `100dvh`, never `100vh`. `100vh` is taller than the visible viewport on mobile Safari and creates a phantom gap at the bottom of every full-bleed section |
| Zoom | `maximum-scale` and `user-scalable` are **never** set. Pinch zoom is never disabled |

**`overflow-x` handling.** `globals.css` sets `body { overflow-x: clip }`. This is
load-bearing: `clip` does not create a scroll container, so `position: sticky` on the
header and the action bar keeps working. `overflow-x: hidden` **does** create one and
silently breaks all sticky positioning. Do not change it.

---

## 2. The persistent bottom quick-action bar

### 2.1 Geometry

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← 1px top border, brand-500
│ ┌──────────────────────┬───────────────┐ │  ← 8px side padding, 8px gap
│ │ 📞  Call Shop Now    │ 💬  Message   │ │
│ └──────────────────────┴───────────────┘ │  ← 56px tall buttons
└─────────────────────────────────────────┘
   68px  +  env(safe-area-inset-bottom)
```

| Property | Value |
| --- | --- |
| Content height | `var(--mobile-action-bar-height)` = `4.25rem` = **68 px** (already in `globals.css`) |
| Total height | `68px + env(safe-area-inset-bottom)`. On a Pixel 7 (`24px`) → 92 px. On an iPhone 14 (`34px`) → 102 px |
| Button height | **56 px** (≥ the 44 px floor, `MOBILE-FIRST-SPEC.md` §4) |
| Side padding / gap | 8 px / 8 px |
| Width split | **55 / 45** on `full`. The call button is the wider one because it is the primary lane and the left thumb reaches it. Reversed on `/contact` (45 directions / 55 call) so the primary is still the larger target |
| Radius | `var(--radius-pill)` (`999px`) for a pill-bar look on `full`; `var(--radius-card)` (`12px`) on `single-call` and `wizard-merged`, where the shape is a full-bleed slab |
| Position | `fixed inset-x-0 bottom-0`, `z-index: var(--z-mobile-bar)` (`90`) |
| Background | `bg-ink-950` with `border-top: 1px solid var(--color-brand-500)`. Dark in **both** themes — a light bar over a dark footer flashes on scroll |
| Text | `text-body` 15 px / 700 for the call label, 15 px / 600 for the message label, `text-brand-500` on the call, `text-white` on the message |
| Elevation | `box-shadow: 0 -4px 16px -4px rgb(0 0 0 / 0.4)` — it must read as sitting **above** the content |
| Font size | **15 px, never smaller.** "Call Shop Now" is 13 characters; at 14 px it still fits a 160 px button at 360 px viewport width |

**Icon:** 20 × 20 `<svg>` with a 2 px stroke, `aria-hidden="true"`. Icon + label, never
icon alone. On the `wizard-merged` mode the call slot is icon-only (48 × 48) with
`aria-label="Call the shop"` and a `title`, because the bar's other half is a text button
and the pair has to fit.

### 2.2 Scroll behaviour

**The bar never hides on scroll.** No hide-on-scroll-down, no auto-hide, no shrink, no
fade. `FC-8` in `CTA-MAP.md`.

The reasoning, so nobody "improves" it: a stranded customer is on a phone in a dark car
park at 2 AM. The single hardest interaction in that situation is finding a control that
has quietly disappeared because the page decided they were "reading". The bar costs 68 px
of a 640 px viewport — 10.6 % — and it buys the only conversion this business needs at
2 AM. That trade is settled.

The **header** does collapse on scroll (§4), which is where the space is recovered. The
bottom is for the thumb, not for the eye.

### 2.3 When it collapses

Only on the four conditions in `barMode()` (`CTA-MAP.md` §5): an error/offline state
(→ `single-call` at 100 %), a route change to `/admin` or the booking success screen
(→ `none`), an open modal or fullscreen map (→ `none`), and `/book` (→ merged into the
wizard footer). Removal is delayed 120 ms; addition is immediate; removal is skipped
entirely if focus is inside the bar.

### 2.4 After the customer books

The bar is **hidden** on the success screen. Reason, not just cleanliness: the
`Confirm booking` button and a persistent `Call Shop Now` button sitting 100 px apart is
a mis-tap waiting to happen on the one screen where the customer has just spent money and
attention. The success screen carries its own `Call the shop` and `Get directions to the
shop` CTAs in the primary and secondary positions, both well above the fold.

On navigating back into `/book` (the browser back button), the bar returns, because the
customer is booking again and the phone matters again. No `localStorage` flag is needed
and none is used.

### 2.5 Tablet and desktop

```
@media (min-width: 768px) {
  .action-bar { display: none; }
  :root { --action-bar-current-height: 0px; }
}
```

At ≥ 768 px the phone is reachable from:

1. the sticky header, right side, as a `Call` pill — **always visible, never scrolls
   away**;
2. a `Call {phoneDisplay}` primary button in the footer, mid-page on every page except
   `/book` and `/admin`;
3. the persistent contact card in the `/book` desktop summary rail.

iPad portrait (768 px) is treated as desktop for the bar, because the iPad's own
dock/keyboard means the bottom 100 px is not a reliable reach zone, and the header is
always visible on a tablet anyway. The `Book a Service Bay` button appears in the header
at ≥ 768 px, so both conversions are one tap from the top of the screen on a device that
is not being held in one hand in traffic.

### 2.6 Content compensation

`padding-bottom: var(--action-bar-current-height)`, measured by a `ResizeObserver` and
published to `:root`. Full spec and the reasoning are in `ACCESSIBILITY-SPEC.md` §7.2.
The summary:

- the bar **measures itself** — a hardcoded `102px` breaks at 200 % zoom and on a device
  with a different inset;
- `scroll-padding-bottom` is set to the same value, which is what stops a focused field
  or an error-summary anchor from landing under the bar;
- the var is set to `0px` on unmount, so the success screen has no phantom padding.

---

## 3. Header behaviour — sticky vs scroll-away

| State | Trigger | Header | Action |
| --- | --- | --- | --- |
| **Expanded** | `scrollY ≤ 8` | 64 px (`var(--header-height)`): logo lockup, `Call` pill, menu button | — |
| **Compact** | `scrollY > 120` **and** scrolling **down** | 52 px: logo mark only, `Call` icon button, menu button | Background goes from transparent to `bg-ink-950/95` + `backdrop-blur` + 1 px `border-brand-500` bottom |
| **Restored** | scrolling **up** past `scrollY ≤ 8` | back to 64 px expanded | |
| **On `/book`** | any | 48 px: a 4 px `brand-500` progress bar under the header + `Step 2 of 4` + the step name. The logo shrinks to the mark | The wizard's own progress rail replaces the site nav; there is no hamburger on `/book` — navigating away mid-booking is a `Start over` decision, not a menu item |
| **At the top** | `scrollY ≤ 8` | background `transparent` over the hero | Allows the hero image to run to the top edge |

Rules:

- **`position: sticky; top: 0`** — never `fixed`. `sticky` reserves its own space, so
  there is no layout shift when it collapses. A `fixed` header without a reserved
  placeholder is a guaranteed CLS failure.
- The collapse is `height` + `opacity`, **not** `transform: translateY(-100%)`, because a
  translate does not change the sticky element's occupied space and leaves a gap.
- Height transition 160 ms `var(--ease-rapid)`. Under `prefers-reduced-motion: reduce`
  it is instant (`globals.css` already handles the duration).
- The header never hides on scroll-down. Only its *height* changes. Same reasoning as
  the bar.
- `padding-top: env(safe-area-inset-top)` via the existing `.pt-safe` utility, so the
  status bar on a notched phone does not overlap the logo.
- `position: sticky` does not work inside an ancestor with `overflow: hidden` or
  `transform`. `body` uses `overflow-x: clip` which is safe. Do not wrap page content in
  a `transform`.

---

## 4. Thumb reach and tap targets

### 4.1 The reach zone

On a 360 × 640 phone held in one hand, the comfortable one-thumb arc covers roughly the
**bottom 60 %** of the screen and the **bottom 90 %** of the width. Design rules:

| Zone | y range | What goes there |
| --- | --- | --- |
| **Comfort** | 480–640 px | the action bar, the wizard Continue button, the `Confirm booking` button, the `Call Shop Now` on error pages |
| **Stretch** | 300–480 px | section CTAs, slot chips, date chips, service selection rows |
| **Avoid** | 0–300 px | the logo, the nav toggle, purely decorative content, and **no CTA that exists only here** |

- The `Call Shop Now` on every error page is the **last element in `main`**, not the
  first, so it lands in the comfort zone. The primary visual weight (size, colour,
  hazard edge) is at the top for visual balance, but the tap target is placed again at
  the bottom where the thumb is.
- On `/`, the hero's primary CTA is in the `stretch` zone, which is why the action bar
  exists: the customer who cannot comfortably reach the hero button has the bar.
- Floating bottom-right buttons (chat widgets, "back to top") are **not shipped**. A
  floating widget overlaps the action bar and the last row of any list, and a
  chat-widget overlay on a site whose phone number is the point is self-sabotage.

### 4.2 Tap target padding

- Minimum **44 × 44 CSS px**. Preferred 48 × 48. Primary CTAs 56 px tall
  (`ACCESSIBILITY-SPEC.md` §9).
- **≥ 8 px gap** between adjacent targets. A date chip row with a 4 px gap produces
  mis-taps on the two dates either side of the intended one — the exact failure mode
  that makes a customer book the wrong day.
- A visually small icon gets its hit area with an invisible pseudo-element rather than by
  growing the icon:
  ```css
  .icon-hit::after { content: ""; position: absolute; inset: -8px; }
  ```
  The parent must be `position: relative`.
- Checkbox and radio hit areas are expanded to 44 × 44 with padding, keeping the 20 px
  visual box.
- **No tap highlight is relied upon.** `globals.css` sets
  `-webkit-tap-highlight-color: transparent`; every tappable element therefore needs a
  **visible active state**: `active:scale-[0.98]` on buttons (under 150 ms, and removed
  under reduced motion) or a background shift. A tap that produces no visual feedback
  on a slow device reads as "the app is broken" and gets tapped three more times.
- Forms must not trigger zoom-on-focus. iOS Safari zooms when a focused input's computed
  font size is < 16 px. **Every input, select and textarea is `font-size: 16px`
  minimum**, on mobile. This is not a style preference, it is a functional bug.

---

## 5. Form behaviour on mobile

### 5.1 Autofill

`autocomplete`, `inputmode`, `enterkeyhint`, `autocapitalize` and `spellcheck` per
field are tabulated in `ACCESSIBILITY-SPEC.md` §5.2. Mobile-specific additions:

| Field | Extra |
| --- | --- |
| `phone` | `type="tel" pattern="[0-9+ ()-]*"`, value normalised on `blur` to `formatPhPhone()` → `+63 917 123 4567`; the raw value is preserved while typing |
| `plate` | `autocapitalize="characters"` so iOS upper-cases it; the server upper-cases anyway |
| `year`, `mileage` | `inputmode="numeric"`, no `type="number"` — a number input brings spinners that eat 40 px of horizontal space and hijack the keyboard on some Android IMEs |
| `name` | `autocapitalize="words"` |
| `email` | `type="email"` brings the `@` key |
| `notes` | `enterkeyhint="done"`, `rows="3"`, `maxlength="500"` with a live character counter (`aria-live="polite"`, throttled to once per 5 s) |

- **Never `autofocus`.** It opens the keyboard on load, scrolls past the hero, and is a
  CLS source.
- Browser autofill for `autocomplete="tel"` on a returning customer fills the previous
  booking's number, which is almost always the right number. Do not clear it.
- `<input>` elements need `name` attributes that match the autofill heuristic
  (`name`, `tel`, `email`). Omitting `name` breaks Chrome's autofill.

### 5.2 Keyboard avoidance

Two mechanisms, both required:

1. **`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`**
   — no `maximum-scale`, no `user-scalable=no`, and `viewport-fit=cover` so
   `env(safe-area-inset-*)` is non-zero.
2. **A `visualviewport` listener** that publishes the keyboard height:

```ts
// mounted once, layout level
const vv = window.visualViewport;
if (!vv) return;                                  // desktop / older iOS: no-op
const set = () => {
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.documentElement.style.setProperty("--kb", `${Math.round(kb)}px`);
};
vv.addEventListener("resize", set);
vv.addEventListener("scroll", set);
set();
```

| Situation | Behaviour |
| --- | --- |
| Keyboard open, **content route** (`full` / `contact`) | The bar translates up by `--kb` and docks just above the keyboard. Both buttons stay reachable. `--action-bar-current-height` is unchanged, so page padding is correct |
| Keyboard open, **`/book`** | The bar is **hidden** (the on-screen keyboard *is* the bottom surface) and the wizard's Continue button moves into the keyboard accessory row via the same `--kb` transform. FC-1 is preserved: one bar, never two |
| Keyboard open, **`single-call`** (error/offline) | The bar **stays put** and does not translate. A customer typing into a form on an error page is already in trouble; having the phone jump under their thumb is worse than a 200 px offset |
| Keyboard open on a `waze`/map fullscreen | The bar is hidden with the overlay (FC-1) |
| `visualViewport` unsupported | Graceful degradation: no transform, and `<input>` focus scrolls natively. Nothing breaks; the bar simply sits under the keyboard for the duration, and every form has a `Call the shop` escape **inside the form body**, not only in the bar |

**Every form on the site has an in-body phone escape.** The `Call Shop Now` bar can be
covered by a keyboard; `book.s4.callEscapeLink` (`Prefer to confirm by phone? Call now`)
cannot, because it scrolls with the content. This is a correctness requirement, not a
redundancy.

### 5.3 Step transitions

- Instant, no page transition, no slide animation between wizard steps. The heading
  changes, focus moves, the live region announces. On a 3G connection, an animated
  transition is 200 ms of the customer's time spent watching a decoration.
- `sessionStorage` draft is written on every state change, debounced 250 ms.

---

## 6. Pull to refresh

| Route | Native browser PTR | Custom PTR | Why |
| --- | --- | --- | --- |
| `/` | yes | **no** | The hero and the emergency banner are always current server-rendered; a reload costs a 3G round trip and loses the scroll position for no informational gain |
| `/contact` | yes | no | The open/closed status and the hours are the fastest-changing content on the site. A refresh genuinely helps. **Also** registers a `visibilitychange` + focus revalidation of the open/closed status without a full reload |
| `/deals` | yes | no | Promos have end dates; a stale page shows an expired offer |
| `/services` | yes | no | Same |
| `/gallery` | yes | no | New photos get added |
| `/book` | **no** | **no** | **A refresh destroys the in-progress booking.** The draft is in `sessionStorage` (which survives a reload) but a refresh on a 3G connection with a half-filled form is a data-loss event. The custom "reload" affordance is not shipped |
| `/book` success | yes | no | A refresh re-fetches the booking from the server; the draft has already been cleared |
| `/admin` | no | no | Staff tool; a reload mid-edit loses work |

- **No custom pull-to-refresh is shipped anywhere.** A JS-driven PTR fights the native
  one on Android, adds a bundle dependency, and the only route that genuinely needs it
  (`/book`) is the one route it must not have.
- The `/book` draft in `sessionStorage` is the protection, not a PTR handler
  (`BOOKING-FLOW.md` §9).

---

## 7. Offline and slow-network behaviour

### 7.1 Service worker policy

**No service worker ships in v1.** Reasons, stated so it is not relitigated:

- the site's entire job is to get a phone number dialled or a slot booked; both need the
  network;
- a stale cached shell showing yesterday's "3 bays free" is actively dangerous;
- it adds install-prompt and update-jank failure modes on exactly the low-end Android
  devices the brief targets;
- HTTP caching alone gives 90 % of the benefit for 0 % of the risk.

What ships instead: `Cache-Control: public, max-age=0, s-maxage=300,
stale-while-revalidate=86400` on HTML, and the availability API with
`stale-while-revalidate=60` so a customer who loses signal mid-scroll still sees the
slots they were already looking at, clearly labelled as cached if it is more than
2 minutes old (`Prices and bays last checked {time}.`).

### 7.2 Offline matrix

| State | Behaviour | Copy |
| --- | --- | --- |
| Browsing `/`, `/services`, `/about`, `/gallery` while offline after a successful load | Content stays; a dismissible strip appears | `You're offline. This page needs a connection. Calling works without one.` + `Try again` |
| `/book` steps 1–2 offline | **Fully functional.** Pure client state, no fetch | none |
| `/book` step 3 offline | Slot grid → failure panel; the date strip stays usable | `You're offline, so we can't load today's bays.` / `Calling works without data.` / `Call Shop Now` + `Try again` |
| `/book` step 4 submit offline | Draft saved; `online` listener armed; **one** auto-retry with a 15 s timeout, and an explicit confirm before sending | `No connection. We saved your details.` / `We'll send it the moment you're back online. If you're in a hurry, call instead.` / `Try again now` |
| Estimator offline | The estimator is **fully functional offline** — it is arithmetic over data already in the page. The only online parts are promo validation and the capture form. Promo fields show `We couldn't check that code right now. The estimate below is without the discount.` | |
| Any `tel:` CTA offline | **Works.** The dialler is an OS app. This is the structural reason FC-8 is non-negotiable | — |
| Back online | Failed fetches retry **once**; `Back online. Trying again.` is announced assertively | |

**Never** silently re-submit a booking on reconnect. The customer must see
`Back online. Your details are saved. Send now? [Send] [Not now]`.

### 7.3 Slow 3G timeouts

| Duration | Behaviour |
| --- | --- |
| 0–6 s | Determinate inline progress bar + `Sending…` / `Confirming…` |
| > 6 s | `This is taking longer than usual. Your details are saved — nothing is lost.` The form **stays enabled** |
| > 20 s | Soft timeout. The request is **not** aborted. A `Try again` button appears. `We haven't heard back yet. Your details are still here. Try again, or call us and we'll book it for you.` |
| > 90 s | Hard timeout. `error_shown{code:"SERVICE_UNAVAILABLE"}`, form still populated, full error panel with `Try again` + `Call the shop` |

- **A slow request is never aborted and never silently retried.** A silent auto-retry on
  a POST is how you create two bookings.
- `fetch` requests use a 90 s `AbortController`. Availability uses 10 s (a customer will
  not wait 90 s for a calendar). Estimator capture uses 30 s.

### 7.4 Data-saver and reduced payloads

- Respect `navigator.connection.saveData` → skip the gallery lazy-load preloads and the
  review images entirely; render the sections as text.
- `prefers-reduced-data` (Firefox) → same.
- **No video on the site.** A single autoplaying hero video is the fastest way to burn a
  customer's data allowance on a site about tyre prices. The hero is a static image.

---

## 8. Performance budget — ≤ 3G, mid-tier Android

**Target device class:** Snapdragon 6-series / 4 GB RAM, Chrome, **Slow 4G** throttled in
Lighthouse (1.6 Mbps down, 750 kbps up, 150 ms RTT).

| Metric | Target | How it is achieved |
| --- | --- | --- |
| **LCP** | **< 2.5 s** | The LCP element on `/` is the **hero `<h1>` text**, not an image. The hero image is `fetchpriority="high"`, preloaded, AVIF, and explicitly sized |
| **CLS** | **< 0.1** (target < 0.02) | Every image has `width`/`height`. Every `aspect-ratio` container is reserved. No ad or widget injection. No font swap shift (`next/font` self-hosted, `display: "swap"` with a **metric-matched** fallback via `adjustFontFallback`) |
| **INP** | **< 200 ms** | Total blocking JS budget below. Event handlers are passive. No long tasks > 50 ms on interaction. The booking wizard's reducer is the only stateful client code on the critical path |
| **TTFB** | < 800 ms | Static generation for all content routes; `/book` step 3 is a client fetch, not a server render |
| Initial HTML (compressed) | ≤ 40 KB | RSC payload. No data inline in the document |
| Initial CSS (compressed) | ≤ 30 KB | Tailwind v4, purged |
| **Total JS on `/` (compressed)** | **≤ 120 KB** | See below |
| Total JS on `/book` (compressed) | ≤ 170 KB | The wizard + the estimator + the calendar. Still no third-party SDK |
| Fonts | ≤ 90 KB total | Saira 800 + 900 italic subset to Latin, Barlow 400/500/600/700 subset to Latin. **`font-display: swap`** with metric-matched fallbacks. Only the display weight of Saira is preloaded |
| Hero image, 360 px viewport | ≤ 90 KB AVIF | `sizes="(max-width: 767px) 100vw, 50vw"` |
| Hero image, 1280 px viewport | ≤ 180 KB AVIF | |
| Below-fold images | ≤ 60 KB each | `loading="lazy" decoding="async"` |
| Below-fold sections | deferred | `content-visibility: auto` + `contain-intrinsic-size` on every section below the fold |
| Requests on first load | ≤ 20 | |
| Third-party JS | **0 bytes** | See below |

### 8.1 Third-party JavaScript: none **[P0]**

No analytics SDK in the bundle, no chat widget, no Facebook pixel, no reCAPTCHA, no
Google Maps JS API, no date-picker library.

- **Analytics** is a ~40-line first-party `track()` wrapper that appends to a queue and
  flushes with `navigator.sendBeacon` on `visibilitychange` and on a 5 s timer, only
  after `load` has fired. It never throws and never blocks.
- **Maps** are an `<iframe>` embed (`LINKS.mapsEmbed`) with `loading="lazy"`, plus real
  `<a>` links to Google Maps and Waze. The iframe is **not** on `/` or `/book`.
- **Facebook / Messenger / WhatsApp** are plain `<a href>` links. No SDK.
- **Date picker** is custom and small (arrows + roving tabindex,
  `ACCESSIBILITY-SPEC.md` §8.3). A library would be 30–50 KB for a control the customer
  uses twice.
- **Icons** are `lucide-react` via `optimizePackageImports` (already in `next.config.ts`)
  and tree-shaken to the ~30 icons actually used.

### 8.2 The 3G-specific rules

- **The hero image is never lazy-loaded.** `fetchpriority="high"` and a `<link
  rel="preload">` for the mobile `srcset`. The one image that matters is the one that
  loads first.
- **Below the fold never loads before it is needed.** No carousel preloading, no
  gallery preloading, no review image preloading.
- **The action bar renders server-side** (it is in `layout.tsx`, not a client island).
  A shimmering phone number is the worst first impression this site can give.
- **The phone number is in the first HTML response.** A customer on a bad connection
  must be able to long-press the number and copy it even before hydration.
- **No third-party font CDN.** `next/font` self-hosts, so there is no third-party
  connection to time out.
- **`fetchpriority="low"`** on analytics, and the flush never happens before `load`.
- **Route prefetch**: `next/link` prefetch is **disabled** for `/admin` and enabled with
  `prefetch={false}` on `/book` (a 40 KB wizard prefetch on 3G is a bandwidth steal).

---

## 9. Breakpoint reference

| Min width | Layout |
| --- | --- |
| 0–479 | Single column. Action bar visible. Wizard footer merged. Date strip scrolls horizontally with snap. Service grid 1-up |
| 480–767 | Single column, wider gutter. Service grid 1-up with wider cards. Service grid goes 2-up at 560 px |
| **768–1023** | Two column: wizard + summary rail (≥ 900 px). Action bar `display: none`. Header carries `Call` + `Book a Service Bay`. Service grid 2-up |
| 1024–1215 | Two column. Service grid 3-up. Container `76rem` |
| ≥ 1216 | Container `76rem` capped. Service grid 3-up. Summary rail sticks |

The single-column layout at 360 px must be verified with **every** string in
`MICROCOPY.md` at its real length. The longest strings (`book.s4.consentSms`,
`est.disclaimer`, `roadside.secondary`) must not overflow or be truncated — they wrap,
and their containers grow.

---

## 10. QA checklist

- [ ] `barMode()` matrix in `CTA-MAP.md` §5 verified at 360, 390, 768 and 1280 px.
- [ ] The bar is 68 px + the device's `env(safe-area-inset-bottom)`, measured on a
      Pixel 7 and an iPhone 14.
- [ ] `--action-bar-current-height` matches the measured bar at 200 % zoom (two rows).
- [ ] `--action-bar-current-height` is `0px` on `/admin` and on the booking success screen.
- [ ] Scrolling 2000 px down and up: the bar never hides, never shifts, never blurs.
- [ ] The bar does not cover the last footer link at any scroll position.
- [ ] Every input's computed `font-size` is ≥ 16 px on iOS (no zoom-on-focus).
- [ ] Focus on an input: the keyboard opens, the field stays visible, the bar either
      docks above the keyboard (content routes) or hides (`/book`) — never both.
- [ ] Airplane mode: steps 1–2 of `/book` complete; the estimator computes; every `tel:`
      link opens the dialler; the offline strip appears; the draft survives.
- [ ] `Save-Data: on` → no below-fold image requests on first load.
- [ ] Lighthouse (Slow 4G, Moto G Power profile): LCP < 2.5 s, CLS < 0.1, INP < 200 ms,
      TBT < 200 ms.
- [ ] Total compressed JS on `/` ≤ 120 KB, on `/book` ≤ 170 KB. Zero third-party bytes.
- [ ] No horizontal document scroll at 320 px except the date strip, the category chip
      row and the slider.
- [ ] No autoplaying video, no carousel autoplay, no floating widget overlapping the bar.
- [ ] `navigator.onLine` toggled mid-submit: the draft is preserved and an explicit
      `Send now? [Send] [Not now]` prompt appears — nothing sends on its own.
- [ ] A double-tap on `Confirm booking` on a throttled connection produces one booking.
- [ ] The phone number is present in the raw HTML of `/` (view-source, JS disabled).
