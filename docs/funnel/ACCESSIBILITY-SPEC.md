# ACCESSIBILITY SPEC — acceptance criteria

**Target:** WCAG 2.2 Level AA, verified on real assistive tech, not just on an audit tool.
**Tokens:** `src/app/globals.css` (`@theme`, `[data-theme]`), `src/config/site.ts`
**Reference viewport for every test:** 360 × 640 (the customer's phone), then 1280 × 800.

Legend: **[P0]** ships-blocker · **[P1]** before launch · **[P2]** nice.
Every criterion is written so it can be *tested*, not just read.

---

## 1. Contrast

All ratios below are computed from the sRGB values in `globals.css` and are correct for
both themes, because the semantic tokens re-point the same hexes at different surfaces.

### 1.1 Text contrast (WCAG 1.4.3 — 4.5:1 normal, 3:1 for ≥ 24 px / ≥ 19 px bold)

| Foreground | Background | Ratio | Verdict |
| --- | --- | --- | --- |
| `brand-500` `#FCC605` on `ink-950` `#06060A` | dark | **12.73:1** | ✅ AAA. Use for eyebrows, links on dark, brand-500 text |
| `ink-950` on `brand-500` | any | **12.73:1** | ✅ AAA. **The only legal text colour on a yellow button** |
| `ink-300` `#a0a0a9` (`muted-foreground`, dark) on `ink-950` | dark | **7.80:1** | ✅ AAA |
| `ink-500` `#52525e` (`muted-foreground`, light) on white | light | **7.13:1** | ✅ AAA |
| `brand-800` `#6d5300` on white | light | **7.27:1** | ✅ AAA. **The only legal brand-yellow *text* on a light background** |
| `brand-900` `#3a2c00` on white | light | **10.6:1** | ✅ AAA |
| `pit-700` `#15803d` on white | light | **5.02:1** | ✅ AA. **Success text on light** |
| `pit-400` `#4ade80` on `ink-950` | dark | **11.61:1** | ✅ AAA. **Success text on dark** |
| `racing-600` `#dc2626` (`destructive`) on white | light | **4.83:1** | ✅ AA. **Error text on light** |
| `racing-400` `#f87171` on `ink-950` | dark | **7.32:1** | ✅ AAA. **Error text on dark** |
| **white on `brand-500`** | any | **1.59:1** | ❌❌ **BANNED** |
| **`brand-500` on white** | light | **1.59:1** | ❌❌ **BANNED** |
| **`brand-700` `#a67f00` on white** | light | **3.71:1** | ❌ **BANNED for text.** Decorative only — the `--shadow-cta` bottom edge, the `.eyg-stripe` gradient tail, the `.eyg-hazard` hatch |
| `racing-600` on `ink-950` | dark | **4.19:1** | ❌ **BANNED.** Use `racing-400` on dark |
| `pit-600` `#16a34a` on white | light | **3.30:1** | ❌ **BANNED.** Use `pit-700` |

**[P0] Hard rules**

1. **Never white on yellow and never yellow on white.** A yellow CTA is
   `bg-brand-500 text-ink-950`. Full stop. A `text-white` anywhere inside a
   `bg-brand-500` ancestor is a launch blocker and must be caught by a lint rule
   (`no-restricted-syntax` on the class pair, or a `stylelint` custom rule).
2. **Error and success text is theme-dependent**: light → `racing-600` / `pit-700`;
   dark → `racing-400` / `pit-400`. Never the semantic `destructive` / `success` token
   directly, because on one of the two themes those tokens fail.
3. `--color-foreground` / `--color-muted-foreground` are always safe to use — that is
   what the semantic indirection is for.

### 1.2 Non-text contrast (WCAG 1.4.11 — 3:1)

| Element | Token | Ratio | Verdict |
| --- | --- | --- | --- |
| Input border, light theme | `ink-400` `#71717e` on white | **4.81:1** | ✅ required minimum |
| Input border, dark theme | `ink-400` on `ink-950` | **4.20:1** | ✅ required minimum |
| `--color-border` `#e3e3e6` on white | 1.28:1 | ❌ **BANNED for control boundaries** |
| `--color-border-strong` `#c7c7cd` on white | 1.68:1 | ❌ **BANNED for control boundaries** |
| `ink-500` on `ink-950` (dark) | 2.63:1 | ❌ **BANNED** |
| `ink-600` on `ink-950` (dark) | 1.88:1 | ❌ **BANNED** |
| Selected slot chip ring | `brand-500` on `ink-950` | 12.73:1 | ✅ |
| Checkbox / radio checked state | `brand-500` fill + `ink-950` tick | 12.73:1 | ✅ |
| Focus ring (see §4) | two-tone | ≥ 3:1 on every surface | ✅ |

**[P0]** Every interactive control (input, select, textarea, checkbox, radio, chip,
switch) declares a **2 px border of at least `ink-400` in both themes**, independent of
`--color-border`. `--color-border` is for decorative dividers only.

> **Token request for the orchestrator (§8, item 1):** `--color-border` and
> `--color-border-strong` are 1.28:1 and 1.68:1 on white and 1.30:1 / 1.88:1 on
> `ink-950`. Neither can legally bound a form control. Until they are changed, the
> component-level rule above is mandatory and the `input` base style must override the
> token rather than inherit it.

### 1.3 Colour is never the only signal **[P0]**

Every state that changes colour also changes **an icon and a word**:

| State | Colour | Icon | Text (required) |
| --- | --- | --- | --- |
| Error | `racing-*` | `circle-alert` 14 px | the field's own error sentence |
| Success | `pit-*` | `circle-check` 16 px | `Booking received` / `Done.` |
| Warning / closing soon | `brand-500` | `clock` | `Closing soon · 25 minutes left` |
| Closed | `ink-500` | `circle-slash` | `Closed now · opens Mon 8:00 AM` |
| Full slot | `racing-*` | `circle-x` | `Full` |
| Recommended slot | `brand-500` | `star` | `★ Recommended` |
| Promo ending | `brand-500` + `.eyg-hazard` edge | `hourglass` | `Ends 30 November` |

---

## 2. Landmarks and page structure

**[P0]** Every page has exactly this skeleton, in this DOM order:

```html
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <header role="banner">…</header>
  <nav aria-label="Main">…</nav>            <!-- desktop; aria-label required -->
  <main id="main" tabindex="-1">
    <section role="region" aria-labelledby="roadside-h">…</section>  <!-- emergency -->
    <h1>…</h1>
    …
  </main>
  <nav aria-label="Quick actions" class="action-bar">…</nav>  <!-- mobile bar -->
  <footer role="contentinfo">…</footer>
</body>
```

- **One `<h1>` per page. No exceptions, including 404/500/403/429/maintenance/offline.**
- The **mobile action bar is a landmark placed after `</main>` and before `<footer>`**,
  so its tab position matches its visual position. It is never `aria-hidden` and never
  `inert`.
- `<nav>` elements **must** have distinct `aria-label`s (`Main`, `Footer`, `Quick
  actions`). Two unlabelled `<nav>`s is the single most common SR landmark failure.
- `main` has `tabindex="-1"` so the skip link actually moves focus (anchors alone do
  not focus a non-focusable element in every browser).
- The emergency banner is `role="region"` + `aria-labelledby`, and its headline is a
  **`<p>`, not a heading**. Reason: it is visually above the `<h1>`; making it an `<h2>`
  would put a level-2 heading before the level-1 and break heading order for every screen
  reader user. It costs nothing — SRs reach it as the first content in `main`.

### 2.1 Heading order **[P0]**

- `h1` × 1 → `h2` per section → `h3` inside → never skip a level.
- Service names inside a card grid are `h3`; service names on `/services` are `h2` inside
  a category `section`; category names are `h2`; the page title is the `h1`.
- Carousel/slider controls (if any ship) are `h2` and their slides are `h3`.
- Automated check: a heading-level assertion in the QA suite fails CI on any skip.

### 2.2 Visually hidden **[P0]**

One utility only, `sr-only`, defined as:

```css
.eyg-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
  border: 0;
}
```

Used for: skip link text, skeleton labels, the live region, the character counter, the
`*` next to required labels, and the full text of truncated labels. **Never** used to
hide content that sighted users need.

---

## 3. Skip link **[P0]**

- First focusable element in the DOM on every route.
- Visually hidden until focused, then: `fixed top-3 left-3`, `bg-brand-500`,
  `text-ink-950`, `min-height 44px`, `z-modal` (70), 2 px `ink-950` ring.
- Text: `Skip to main content`.
- Becomes visible on `:focus-visible` **and** on `:focus` (some browsers only fire
  `:focus-visible` after a click; a skip link clicked by a touch user must still appear —
  this is a deliberate deviation from the `:focus-visible` convention).
- Selecting the whole page (`Ctrl/Cmd+A`, then Tab) must reveal it.
- The skip link must be the **first thing a keyboard user tabs to** on `/book`, on every
  error page and on every route. Verify with a fresh page load, not an in-app navigation.

---

## 4. Focus **[P0]**

### 4.1 The ring

`globals.css` already sets `:focus-visible { outline: 3px solid var(--color-ring);
outline-offset: 2px; border-radius: 2px }`. `--color-ring` is `brand-500`. That is
correct on every surface **except yellow**, where a yellow ring on a yellow button is
invisible.

```css
/* Component rule — required, because the token cannot know the surface */
:where(.bg-brand-50, .bg-brand-100, .bg-brand-200, .bg-brand-300,
       .bg-brand-400, .bg-brand-500):focus-visible {
  outline: 3px solid var(--color-ink-950);
  outline-offset: 2px;
  box-shadow: 0 0 0 6px var(--color-background);   /* outer halo on dark surfaces */
}
```

Two-tone rule in plain terms: **the focus ring must be ≥ 3:1 against the element it
surrounds, and ≥ 3:1 against what is behind it.** Test each focus ring against its own
background; do not assume the token is enough.

### 4.2 Focus never moves unexpectedly **[P0]**

| Event | Focus behaviour |
| --- | --- |
| Route change (client nav) | `document.title` updates; focus moves to the new `<h1 tabindex="-1">`; the route is announced by the page change, not by a live region |
| Wizard step change | Focus moves to the step's `<h2 tabindex="-1">`. **Never** to the first input — on mobile that opens the keyboard, scrolls past the step heading, and hides the copy the customer needs to read |
| Estimator result | Focus **stays** where it is. The result is announced via the polite live region. Moving focus to a number the user is still editing is hostile |
| Modal opens | Focus moves into it; focus is trapped; `Esc` closes; focus returns to the trigger |
| Sheet opens (`role="region"`, non-modal) | Focus moves to the first control; **no trap**; `Esc` closes; focus returns to the trigger |
| Mobile action bar re-renders | Focus is **never** moved, never stolen, never blurred. The bar has a stable `key` and its buttons are stable nodes |
| Action bar is removed (→ success screen) | Focus is moved to the success `<h1 tabindex="-1">` in the same commit, **before** the removal is observed. Focus is never left on a removed node (which silently drops the user to the document start) |
| Form submit fails | Focus moves to the `role="alert"` summary panel (`tabindex="-1"`) |
| Form submit succeeds | Focus moves to the success `<h1 tabindex="-1">` |
| `429` countdown reaches 0 | Focus moves back to the submit button and it is announced `You can try again now.` |

### 4.3 Focus never disappears **[P0]**

- `outline: none` and `outline: 0` are forbidden outside the `:focus-visible` default
  that already ships in `globals.css`. A grep for `outline:\s*(none|0)` must return
  nothing.
- No element is removed while it holds focus except via an explicit, simultaneous focus
  move (see §4.2).
- The action bar never uses `overflow: hidden` on a wrapper around its buttons — it would
  clip the ring.

---

## 5. Forms

### 5.1 Label association **[P0]**

- Every control has an explicit `<label for>`. Placeholder text is **never** the label.
- Helper text: `<p id="{field}-help">` referenced by `aria-describedby`.
- Error text: `<p id="{field}-error" role="alert">` — **no.** A `role="alert"` on every
  field error produces overlapping, out-of-order announcements and is the most common
  form a11y bug. Instead:
  - field error: `<p id="{field}-error">`, referenced by `aria-describedby`, **not** a live
    region. It is announced when the field takes focus, which is when the customer needs
    it.
  - one **summary panel** per form: `role="alert"`, `tabindex="-1"`, focused on render,
    containing an anchor list (`href="#field-{key}"`). This is the single announcement.
- Errored control: `aria-invalid="true"`. Valid controls: `aria-invalid` is **absent**,
  never `"false"`.
- `aria-describedby` points at helper **and** error (`"{field}-help {field}-error"`) so
  both are read.
- Required fields: the `*` is `aria-hidden="true"` and the word `required` is not needed —
  `required` on the input is the signal. Optional fields say `(optional)` in the visible
  label, not just in the helper.

### 5.2 Autofill & mobile keyboard **[P0]** (also in `MOBILE-FIRST-SPEC.md` §6)

| Field | `autocomplete` | `inputmode` | `enterkeyhint` | `autocapitalize` | `spellcheck` |
| --- | --- | --- | --- | --- | --- |
| name | `name` | — | `next` | `words` | default |
| phone | `tel` | `tel` | `next` | none | `false` |
| email | `email` | `email` | `next` | `none` | `false` |
| plate | `off` | `text` | `next` | `characters` | `false` |
| year | `off` | `numeric` | `next` | none | `false` |
| mileage | `off` | `numeric` | `next` | none | `false` |
| notes | `off` | — | `done` | `sentences` | default |
| promo | `off` | `text` | `done` | `characters` | `false` |

**[P0] Never `autofocus`.** On a phone it opens the keyboard on page load, pushes the
hero out of view, and is a CLS source. The only exception is a modal's first control
inside a `useEffect` after mount, on desktop only.

### 5.3 Error summary behaviour **[P0]**

```
role="alert"  aria-labelledby="form-errors-heading"  tabindex="-1"
  <h2 id="form-errors-heading">Check these:</h2>
  <ul>
    <li><a href="#book-s4-phone">Mobile number — Enter a PH mobile number, like 09 17 123 4567.</a></li>
  </ul>
```

- Rendered on the first failed submit only, not on every `blur`.
- Focus moves to the panel. Activating a link moves focus to the field.
- Removed on the next successful submit, and when the field it references becomes valid.
- Never blocks the form from being re-submitted.

---

## 6. Async results and live regions **[P0]**

**Exactly two persistent live regions, both mounted in `layout.tsx` at page load.**

```html
<!-- polite: async results, announcements -->
<div class="eyg-sr-only" role="status" aria-live="polite" aria-atomic="true"
     id="eyg-status"></div>
<!-- assertive: errors and interruptions only -->
<div class="eyg-sr-only" role="alert" aria-live="assertive" aria-atomic="true"
     id="eyg-alert"></div>
```

A live region created in the same render as its content is **not reliably announced**.
Both must exist in the initial HTML. The dynamic parts (the slot grid, the form error
summary) are separate elements with their own roles.

### 6.1 What goes in each

| Event | Region | Exact announcement |
| --- | --- | --- |
| Availability fetched for a date | polite | `{n} times free on {dateLong}.` (or `No times free on {dateLong}. Next is {nextDateLong}.`) |
| Slot selected | polite | `{time} selected. Two bays free. We'll hold it for 10 minutes.` |
| Hold expired | assertive | `Your 10-minute hold on {time} ended. Pick a time again.` |
| Service toggled in step 2 | polite | `{n} selected. Estimate {range}. About {duration}.` |
| Estimate recomputed | polite | `Estimate updated. {range}. About {duration}.` |
| Estimate needs a human | polite | `Some parts need checking. We'll price them when we see the car.` |
| Availability fetch failed | assertive | `We couldn't load the bays for {date}. Pick another day, or call us.` |
| 429 countdown | polite, **throttled** | `You can try again in {n} seconds.` — **once per 10 s maximum** |
| Form submit started | polite | `Sending your booking.` |
| Form submit failed | assertive | the error sentence |
| Booking confirmed | polite (and focus moves to the `h1`, which announces the title) | *(no live-region text needed — the `h1` move covers it)* |
| Offline / online | assertive | `You're offline.` / `Back online.` |
| Route change | — | **not** announced via a live region. The document title change is the announcement. Duplicating it is noise. |

### 6.2 Anti-noise rules **[P0]**

- Never more than one polite announcement per 1 000 ms. Later messages in the same
  window are dropped.
- Never announce the same string twice in a row.
- Never announce on a skeleton mount — only on completion.
- `aria-atomic="true"` on the polite region so a full sentence is read, not a diff.
- Slot list changes: the **slot container itself** is `aria-live="polite"` (as specified
  in `BOOKING-FLOW.md` §4.3) *in addition* to the global region, because the customer may
  be focused inside it. Guard against double-reading: when the focus is inside the slot
  grid, write to the slot container only; otherwise write to the global region only.

---

## 7. The sticky bar — not swallowing focus or content

This is the highest-risk a11y surface on the site because it is `position: fixed`, always
present, and overlays content.

### 7.1 Structure **[P0]**

```html
<nav aria-label="Quick actions"
     class="action-bar fixed inset-x-0 bottom-0 z-mobile-bar"
     style="--bar-h: {measured}px">
  <a href="tel:{phone}" class="action-bar__btn action-bar__btn--call"
     data-cta-id="mobilebar-call">…</a>
  <a href={messenger} class="action-bar__btn"
     data-cta-id="mobilebar-message">…</a>
</nav>
```

- It is a `<nav>` with a distinct label. It is **not** `role="dialog"`, not a
  `<dialog>`, not `aria-hidden`, not `inert`.
- Buttons are real `<a>`/`<button>` elements with real `href`s. Nothing inside it is a
  `<div onclick>`.
- It appears **after `</main>` in the DOM**, so tab order follows visual order.
- Stable node identity: the bar is rendered once in `layout.tsx` and its children are
  keyed by `cta_id`. A re-render must never unmount a focused child.

### 7.2 Content compensation — the `padding-bottom` rule **[P0]**

The bar covers 68 px + `env(safe-area-inset-bottom)`. A static `padding-bottom` is wrong
the moment the bar wraps to two rows (long labels, 200 % zoom, a 320 px viewport, or a
browser with a large font setting).

**The bar measures itself and publishes the result.**

```css
:root { --action-bar-current-height: 0px; }

@layer base {
  body { padding-bottom: var(--action-bar-current-height); }

  /* Keeps scrollIntoView and focus-scrolling from parking content under the bar. */
  html {
    scroll-padding-bottom: calc(var(--action-bar-current-height) + 1rem);
    scroll-padding-top: calc(var(--header-height) + 1rem);   /* already in globals.css */
  }
}

/* ≥ 768 px: the bar does not exist. */
@media (min-width: 768px) {
  .action-bar { display: none; }
  :root { --action-bar-current-height: 0px; }
}
```

```ts
// one ResizeObserver, mounted once in the layout
const ro = new ResizeObserver(([e]) => {
  const h = e?.target instanceof HTMLElement ? e.target.offsetHeight : 0;
  document.documentElement.style.setProperty(
    "--action-bar-current-height", `${h}px`
  );
});
const bar = document.querySelector<HTMLElement>("[data-action-bar]");
if (bar) ro.observe(bar);
```

**Rules that fall out of this and must not be broken:**

1. **`scroll-padding-bottom` is the mechanism, not `padding-bottom`.** Without it, an
   anchored heading or a focused field after a validation failure lands *underneath* the
   bar and cannot be read. This is the single most common bug in this pattern.
2. `padding-bottom` goes on `<body>` (or the last flow element), never on a `position:
   fixed` ancestor and never on `overflow: hidden` — all of which defeat it.
3. When the bar is hidden (`barMode() === "none"`, e.g. on the success screen), the
   observer's element is unmounted, so the var must be set to `0px` **on unmount**. A
   leftover `102px` of phantom padding at the bottom of the success screen is a visible
   bug.
4. `scrollbar-gutter: stable` on `html` so hiding the bar cannot shift the layout
   horizontally on desktop.
5. **Do not change `body { overflow-x: clip }` to `overflow-x: hidden`.** `clip` does not
   create a scroll container; `hidden` does, and it silently breaks
   `position: sticky` for the header, the selection tray and the action bar. This is
   noted as a do-not-touch on `globals.css` (`MOBILE-FIRST-SPEC.md` §8).

### 7.3 Focus and the bar **[P0]**

- The bar **never hides on scroll, on focus, on blur, or on a timer.** `FC-8` in
  `CTA-MAP.md` is an accessibility decision as much as a conversion one: a phone number
  that disappears while a keyboard user tabs is a phone number that does not exist.
- The bar's buttons are ≥ 44 × 44 px (§9), so they can be reached by a touch user with
  limited fine motor control even while the on-screen keyboard is open.
- When the bar's mode changes (route change, error state), the removal is delayed 120 ms
  and the addition is immediate, so a fast tap during a transition never lands on a
  vanishing button. The delayed removal must also check "is focus inside the bar?" and
  skip the removal if so.
- On `/book`, the bar is **merged** into the wizard footer. There is never a bottom bar
  and a wizard footer at the same time.
- **Focus entering the bar does not scroll the page.** The browser may scroll the focused
  button into view; `scroll-padding-bottom` prevents it from being scrolled *under* the
  keyboard.
- `aria-modal` is never set on the bar. It is not a modal.

### 7.4 `env(safe-area-inset-*)` **[P1]**

- `padding-bottom: env(safe-area-inset-bottom)` on the bar itself.
- The measurement in §7.2 includes it (it is part of `offsetHeight`), so compensation is
  automatic.
- `padding-top: env(safe-area-inset-top)` on the header via the existing `.pt-safe`
  utility, so the status bar on a notched phone does not overlap the logo.
- Verify on a device with a home indicator (iPhone 14+, Pixel 7+) at 200 % text size.

---

## 8. Keyboard operation of the booking wizard

**Every task must be completable with `Tab`, `Shift+Tab`, `Arrows`, `Home`, `End`,
`PageUp`, `PageDown`, `Space`, `Enter` and `Esc`. No mouse. No drag. No swipe-only
control.**

### 8.1 Wizard frame

| Key | Behaviour |
| --- | --- |
| `Tab` / `Shift+Tab` | Natural DOM order. Never a positive `tabindex` anywhere on this site. |
| Wizard stepper | Each step is a link to the same step in-page (`?step=N`). Activating it moves **focus** to that step's `h2`, not just scroll. Completed steps are reachable; a future step is `aria-disabled="true"` but still focusable, with `aria-label="Step 3: Date & Time. Not available yet."` — an unfocusable future step is a keyboard trap in reverse. |
| Continue | `Enter` from any field submits the step (the button is the form's submit button, so this is native). |
| Footer bar buttons | In the tab order **after** the step's content, because the bar is last in the DOM. |
| `Esc` | On a non-modal sheet: close and return focus to the trigger. Anywhere else: no effect. There is no overlay to escape from. |

### 8.2 Step 1 — vehicle comboboxes

Native `<input role="combobox">` + a `role="listbox"` popup.

| Key | Behaviour |
| --- | --- |
| `↓` / `↑` | Open the popup / move the active option, wrapping |
| `Enter` | Select the active option, close the popup, keep focus in the input |
| `Esc` | Close the popup, keep the typed text |
| `Tab` | Close the popup, move on. **Never** auto-select the highlighted option |
| `Home` / `End` | First / last option when the popup is open |
| Type-ahead | Filtering is native to the input |
| `aria-activedescendant` | Tracks the highlighted option. **The input keeps DOM focus** — focus is never moved into the listbox, which would break typing |

The `Model` combobox is disabled (and `aria-disabled="true"`, still focusable with an
explanation) until a `Make` is chosen, so the reason for its emptiness is discoverable:
`aria-label="Model. Choose a make first."`

### 8.3 Step 3 — the date picker **[P0]**

The date strip is `role="radiogroup"` with a **roving `tabindex`** (one stop for the
whole strip, not 14).

| Key | Behaviour |
| --- | --- |
| `Tab` | Into the strip: focus lands on the selected date (or today if none is selected) |
| `←` / `→` | Previous / next day |
| `↑` / `↓` | Previous / next **week** (7 days) |
| `Home` | Today (or the first bookable day if today is past `minLeadMinutes`) |
| `End` | The last date in the 60-day horizon |
| `PageUp` / `PageDown` | Previous / next 7 days (identical to `↑`/`↓`, kept for consistency with native date inputs) |
| `Space` / `Enter` | Select the focused date, fetch availability, announce the slot count politely, move **focus to the slot group** |
| `Esc` | Leave the strip, focus returns to the step `<h2>` |
| `Shift+Tab` from the first chip | Out of the strip into the step heading |

- Each chip: `role="radio"`, `aria-checked`, and a full accessible name
  (`"Wednesday 19 November, 2 bays free"`), because `Tue / 19` alone is meaningless out
  of context.
- A `Full` or `Closed` chip is `aria-disabled="true"` but **still focusable** — a
  disabled, unfocusable chip is invisible to a keyboard user, and "why is there a gap in
  my calendar" is exactly the question they need answered.
- Availability is prefetched for the focused date when the arrow keys enter a new day
  (one request, debounced 250 ms), so `Space` is instant. If the prefetch is not ready,
  `Space` still works and the slot group shows a skeleton — it never silently does
  nothing.
- **A non-visual alternative is mandatory**: a `Skip to available times` link appears
  above the strip, which focuses the slot group directly, and the group's accessible
  name includes the date. A keyboard user must never have to arrow through 14 days to
  reach the times.

### 8.4 Step 3 — the slot grid

`role="radiogroup"`, roving `tabindex`, `aria-live="polite"` on the container.

| Key | Behaviour |
| --- | --- |
| `Tab` | Into the group: focus lands on the selected slot, or the `isBest` slot, or the first available |
| `←` `→` `↑` `↓` | Move by position in the visual grid (2 or 3 columns) — a **2-D** grid needs 2-D arrows |
| `Home` / `End` | First / last slot in the day |
| `Space` / `Enter` | Select, start the 10-minute hold, announce it politely |
| `Esc` | Back to the date strip |
| `Tab` from the last chip | Out to the Continue button |

A `Full` slot is `aria-disabled="true"` and focusable, with
`aria-label="1:00 PM, full. Two bays are already booked."` — naming the *reason* is what
makes a disabled control acceptable under WCAG 2.2.

### 8.5 Step 4 — checkboxes and CAPTCHA

- Consent checkboxes are native `<input type="checkbox">` with a ≥ 44 px target and a
  visible focus ring. Not a switch, not a styled `<div>`.
- The label is the **full sentence**, so a screen-reader user hears the whole consent
  text, not `Yes, text me about this booking. checkbox`.
- The honeypot (`website`) is `aria-hidden="true"`, `tabindex="-1"`,
  `autocomplete="off"`, visually hidden with `position: absolute; left: -9999px` — **not**
  `display: none` (some bots skip `display: none`) and **not** `eyg-sr-only` (which is
  still in the a11y tree in some SRs).
- The CAPTCHA is a native `<select>` of answers. No custom widget, no image, no puzzle.
  A `<select>` is fully keyboard-operable and fully announced.

### 8.6 Selection quantity stepper (tyres, per-axle)

`−` and `+` as real `<button type="button">` with `aria-label="Fewer tyres"` /
`"More tyres"`, plus a `role="status"` readout `2 tyres`. `↑`/`↓` also work if it is a
native `<input type="number">`; prefer the native number input with
`inputmode="numeric"` for mobile and the buttons for precision. Do not build a custom
stepper with no number input — that is the most common unusable control on mobile forms.

---

## 9. Touch targets **[P0]**

| Element | Minimum | Preferred |
| --- | --- | --- |
| Any interactive control | **44 × 44 CSS px** | 48 × 48 |
| Primary CTA (`primary`, `emergency` variant) | 44 × 44 | 56 px tall |
| Mobile action bar button | 44 × 44 | 56 px tall |
| Consent checkbox (hit area) | 44 × 44 | 48 × 48 |
| Service row | 44 × 44 | 56 px |
| Slot chip | 44 × 44 | 56 × 88 px |
| Date chip | 44 × 64 | 56 × 64 |
| Nav link (mobile) | 44 × 44 | 48 × 48 |
| Footer link | 44 px tall | — |
| Icon-only button | 44 × 44 | 48 × 48 |

- **Gap between adjacent targets: ≥ 8 px** (`MOBILE-FIRST-SPEC.md` §4).
- Visual size may be smaller than the target; if so, the extra area is filled with an
  invisible `::after` (`position: absolute; inset: -8px`) — never by making the visible
  icon bigger, which would break the visual system.
- Inline links inside a paragraph are **exempt** from 44 px (WCAG 2.5.8), but the
  paragraph's line-height must still be ≥ 24 px so consecutive links are not adjacent
  targets. In the consent copy and the legal pages, set `line-height: 1.65` and
  `margin-bottom` on the paragraph, not on the link.

---

## 10. Images and icons **[P0]**

- Every `<img>` has an `alt`. Decorative → `alt=""`. Meaningful → describes **the
  service or the bay**, not the file.
- `GalleryImage.alt` is required in the data model. Never auto-generate alt text from
  the filename or a caption.
- **Icons are always accompanied by a visible text label or an `aria-label`.** An
  icon-only control is allowed only with an explicit `aria-label`.

| Icon | Required accessible name |
| --- | --- |
| phone | `Call EYG Tire & Auto Care at {phoneDisplay}` |
| chat / messenger | `Message EYG Tire & Auto Care on Messenger` |
| pin | `Get directions to EYG Tire & Auto Care, EGSA Fourlanes, Tuyo, Balanga City` |
| calendar | `Add to calendar` |
| clock | decorative inside a status pill that already has text — `alt=""` |
| star | decorative inside `★ Recommended` — `alt=""` |
| check (success) | decorative next to the text `Booking received` — `alt=""` |
| alert (error) | decorative next to the error sentence — `alt=""` |
| chevron / arrow | decorative inside a labelled button — `alt=""` |
| close | `Close` |
| truck / bay | decorative |

- Icons are inline `<svg aria-hidden="true" focusable="false">`. Never
  `<svg><title>` as the only name source.
- `width` and `height` on every image and every `<svg>` with intrinsic dimensions. No
  layout shift.
- The hero image has an explicit `aspect-ratio` container and `fetchpriority="high"`.

---

## 11. Zoom, reflow and text scaling **[P0]**

Tested at **200 % browser zoom** *and* at **200 % OS font size** (Android
`Display size → Large`).

| Criterion | Requirement |
| --- | --- |
| Reflow (1.4.10) | At 1280 px at 400 % (= 320 CSS px) **no horizontal scrolling of the document** and no two-dimensional content, except: the date strip, the category chip row and the `waze`/reviews carousels, which are single-dimensional horizontal scrollers with `role="group"` and keyboard support |
| Text spacing (1.4.12) | With line-height 1.5×, paragraph spacing 2×, letter-spacing 0.12 em, word-spacing 0.16 em applied, nothing is clipped and no button label is truncated |
| Text resize | No `text-overflow` on a CTA label. If a label is long, it **wraps**; the button grows in height. The action bar is explicitly allowed to grow to two rows (§7.2) |
| `px` sizing | No `px` font sizes anywhere — all type uses the `--text-*` tokens (fluid `clamp()`), so they scale with the root font size |
| Fixed heights | No fixed `height` on any text container. `min-height` only |
| `-webkit-text-size-adjust` | Already `100%` in `globals.css` — do not change it to `none`, or iOS will shrink text in landscape and break the whole system |

**The action bar at 200 % zoom**: the two buttons wrap to two stacked rows
(`Get directions` / `Call Shop Now`, or `Call Shop Now` on its own line with `Message`
below). The ResizeObserver updates `--action-bar-current-height` and the page
compensates automatically. The bar must not clip, and the ring must not be cut off.

---

## 12. Reduced motion **[P0]**

`globals.css` already sets animation/transition durations to `0.01ms` under
`prefers-reduced-motion: reduce`. That is necessary but not sufficient — the following
must also be true, because the media query alone does not stop a scroll-jacking library
or a JS-driven transition:

- [ ] **No scroll-jacking.** `window.scrollTo` is used only for in-page anchors, the
      stepper, and error-summary links.
- [ ] **No auto-playing carousel.** If a gallery slider ever ships it is
      `autoplay off`, with pause/play and `prefers-reduced-motion` respected. A slider
      that moves on its own is also a WCAG 2.2.2 failure (no pause control).
- [ ] **No parallax**, no scroll-linked transforms, no `IntersectionObserver` scale effects.
- [ ] **No animated price counter.** The estimator's figure appears at its final value
      instantly. A counting number is motion, is unreadable, and is how you hide a price
      change from a customer.
- [ ] **No animated skeleton pulse** under reduced motion — static `opacity: 0.8` fill.
- [ ] **The speed stripe (`.eyg-stripe`), the hazard hatch (`.eyg-hazard`) and the
      checker (`.eyg-checker`) never animate.** They are static brand devices; an
      animated hazard hatch is a seizure risk (WCAG 2.3.3) as well as a brand violation.
- [ ] **Step transitions** between wizard steps are a 120 ms opacity fade at most, and
      under reduced motion it is instant. The step change is communicated by focus move +
      live region, **not** by the animation. A screen-reader user and a reduced-motion
      user must both know the step changed.
- [ ] `scroll-behavior: smooth` in `globals.css` is already neutralised by the media
      query. Do not re-add it inline with `style="scroll-behavior: smooth"`.
- **No flashing.** Nothing on this site flashes more than three times per second
  (WCAG 2.3.1). The hazard hatch is a static 45° pattern, not an animated stripe.

---

## 13. Targeted acceptance tests

Run these manually, on real hardware, before launch. An automated audit passing is
necessary and not sufficient.

| # | Test | Pass condition |
| --- | --- | --- |
| T1 | VoiceOver (iOS Safari) + NVDA (Firefox) through the full booking flow | Every step reachable, every error announced once, the slot grid usable, the confirmation readable |
| T2 | Keyboard only, `Tab` from a cold load on `/book` | First stop is the skip link; second is the header call; the whole flow completes; no trap anywhere |
| T3 | 200 % zoom on `/book` step 3 at 360 × 640 | The bar is two rows, nothing is clipped, the last footer link is reachable and visible |
| T4 | `prefers-reduced-motion: reduce` (DevTools emulation) | No animation of any kind; the step change is still communicated |
| T5 | Windows High Contrast Mode / `forced-colors: active` | Controls remain visible via `forced-color-adjust` boundaries; the brand yellow does not erase the focus ring |
| T6 | Android TalkBack, one-handed, outdoor brightness | The action bar is reachable with a thumb; tap targets are ≥ 44 px; text is legible at the site's largest type size |
| T7 | Screen reader off, keyboard only, at 320 CSS px | No horizontal document scroll except the three declared scrollers |
| T8 | `Tab` into the action bar while it re-renders (simulate a route change mid-focus) | Focus is never lost to the document start |
| T9 | Every error route (404/403/429/500/maintenance/offline) with a screen reader | The `h1` is the first thing read; the phone is reachable within 2 tabs |
| T10 | axe-core on all 9 routes, both themes | 0 critical, 0 serious. Note: axe will **not** catch the white-on-yellow issue — §1.1's lint rule is the only thing that catches it |
| T11 | Android with a 34 px safe-area inset, 200 % font | The bar clears the home indicator; the header clears the status bar |
| T12 | Reduce the OS font to its maximum on the estimator | The result card and both CTAs remain fully visible and tappable |

---

## 14. Do-not-ship list (accessibility)

- ❌ `outline: none` without a `:focus-visible` replacement
- ❌ `autofocus` on any field
- ❌ A placeholder as the only label
- ❌ `role="alert"` on every field error
- ❌ A live region created in the same render as its text
- ❌ `aria-live` on a `ScrollTrigger`/`Swiper` internals
- ❌ A positive `tabindex` anywhere
- ❌ An icon-only button with no `aria-label`
- ❌ `aria-label` on a `<nav>` that duplicates the visible text exactly (it must be
      *distinct* from the other nav)
- ❌ `display: none` on the honeypot
- ❌ A slider without a pause control
- ❌ A `<div onclick>` anywhere
- ❌ A custom date picker without keyboard support (the native input is a valid and
      better answer on this audience's devices — if a custom one is used, it must meet
      T1 and T2)
- ❌ `outline` clipping from an `overflow: hidden` wrapper
- ❌ White text on a yellow background, or yellow text on white
- ❌ `aria-hidden` on the action bar
- ❌ Any focusable element that is invisible (a `Full` slot chip must stay focusable)
