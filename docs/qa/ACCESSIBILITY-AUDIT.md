# ACCESSIBILITY AUDIT — EYG Tire & Auto Care

**Standard:** WCAG 2.2 Level AA
**Target device:** a ₱3,000 Android on 3G, one hand, outdoors, in traffic
**Method:** automated axe-core (`tests/e2e/a11y.spec.ts`) + manual audit below
**Status at time of writing:** automated pass not yet run (no
`@playwright/test` in `package.json`); manual items below are from static
analysis of `src/app/globals.css`, `src/components/**` and `src/middleware.ts`,
plus a token-pair contrast computation.

> **This document is honest about what was checked and what was not.** An item
> marked `NOT YET AUDITED` is a gap, not a pass. Fill them in before release —
> `docs/qa/RELEASE-CHECKLIST.md` §E blocks on it.

---

## 1. The `#FCC605`-on-white contrast question — answered definitively

**Question:** does brand yellow on white pass WCAG?

**Answer: no, and not close.**

| Foreground | Background | Ratio | Required | Verdict |
| --- | --- | --- | --- | --- |
| `#FCC605` brand yellow | `#FFFFFF` white | **1.59 : 1** | 4.5 : 1 (text), 3 : 1 (large text **and** non-text) | **FAIL both** |
| `#06060A` ink | `#FCC605` brand yellow | **12.73 : 1** | 4.5 : 1 | **PASS AAA** |
| `#06060A` ink | `#F6F6F7` surface-muted | 17.83 : 1 | 4.5 : 1 | PASS AAA |
| `#52525E` muted-fg | `#FFFFFF` white | 7.70 : 1 | 4.5 : 1 | PASS AAA |
| `#52525E` muted-fg | `#F6F6F7` surface-muted | 7.13 : 1 | 4.5 : 1 | PASS AAA |
| `#71717E` ink-400 | `#FFFFFF` white | 4.81 : 1 | 4.5 : 1 | PASS AA |
| `#A67F00` brand-700 | `#FFFFFF` white | **3.71 : 1** | 4.5 : 1 | **FAIL for normal text** |
| `#D9A800` brand-600 | `#FFFFFF` white | **2.20 : 1** | 3 : 1 | **FAIL** |
| `#A0A0A9` ink-300 | `#06060A` ink-950 | 7.80 : 1 | 4.5 : 1 | PASS AAA |
| `#A0A0A9` ink-300 | `#17171D` ink-800 | 6.88 : 1 | 4.5 : 1 | PASS AA |
| `#71717E` ink-400 | `#06060A` ink-950 | **4.20 : 1** | 4.5 : 1 | **FAIL for normal text** |

Relative luminance of `#FCC605` is **0.6109**. For 4.5 : 1 against it a
foreground would need a relative luminance of **2.92** — brighter than white.
That is impossible, which is the arithmetic proof that **no colour can be text
on brand yellow at AA** except a near-black.

### The mandatory usage restriction

> **`--color-brand-500` (`#FCC605`) must NEVER be used as a foreground colour on
> `--color-surface` (`#FFFFFF`), `--color-surface-muted` (`#F6F6F7`) or
> `--color-background`.** It is a *background* colour only, paired with
> `--color-ink-950` (`#06060A`) text at 12.73 : 1.
>
> It also fails **SC 1.4.11 Non-text Contrast (3:1)**, so it must not be the
> *only* visual signal for an input boundary, a focus indicator, or a required
> field marker. Pair it with ink.

Enforcement, in order of preference:

1. **Linting.** Add a token rule so `text-brand-500` on a light surface is a
   build error. Until that exists, a grep in CI:
   `grep -rn "text-brand-500\|text-yellow-\|text-\[#FCC605\]" src/`
2. **Never** use brand-600/700 for body text on white (3.71 : 1 and 2.20 : 1).
   `--color-brand-700` is currently used only as the `--shadow-cta` bottom edge,
   which is decorative and therefore exempt — but it must not become text.
3. In dark mode brand yellow IS the correct foreground (12.73 : 1 on ink), which
   is why the site leads dark. The restriction is about the **light** theme.

---

## 2. Findings against the design tokens

### A11Y-001 — the focus ring fails SC 1.4.11 on light surfaces · **FAIL**

| | |
| --- | --- |
| **File** | `src/app/globals.css` |
| **Line** | 230 (`:focus-visible { outline: 3px solid var(--color-brand-500) }`) and 76 (`--color-ring`) |
| **Severity** | **High** |

`--color-ring` is `--color-brand-500`. On the dark theme (`--color-background:
--color-ink-950`) that is 12.73 : 1 and fine. On `[data-theme="light"]` the
background is `#FFFFFF` and the ring is **1.59 : 1** — effectively invisible. The
same applies to `--color-surface-muted` (1.55 : 1), so a focused input on a card
has no perceivable boundary.

**Impact.** A keyboard-only customer in light mode cannot see where they are.
SC 2.4.7 Focus Visible fails outright, and SC 1.4.11 fails with it.

**Fix** (orchestrator-owned — `globals.css` is in the "never edit" table, so this
is a *request*):

```css
--color-ring: var(--color-ink-950);   /* light theme */
[data-theme="dark"] { --color-ring: var(--color-brand-500); }
```

or, keeping yellow in light mode, use a two-tone ring (`outline: 3px solid
var(--color-ink-950); box-shadow: 0 0 0 6px var(--color-brand-500)`) so it is
visible on **both** surfaces.

### A11Y-002 — default borders fail SC 1.4.11 · **FAIL**

| | |
| --- | --- |
| **File** | `src/app/globals.css` |
| **Line** | 73–74 |
| **Severity** | Medium |

`--color-border: #E3E3E6` on white is **1.24 : 1**; `--color-border-strong:
# C7C7CD` is **1.65 : 1**. WCAG 2.2 SC 1.4.11 requires **3 : 1** for the
boundary of an interactive control. A text input whose only boundary is
`--color-border` is **not identifiable**.

**Fix.** `--color-border-strong` needs to reach 3 : 1 on white —
`#A0A0A9` (2.6 : 1) is close but short; `#71717E` is 4.81 : 1 and already exists
in the ramp. Use it for form-control borders, and keep `#E3E3E6` for decorative
dividers only (which are exempt as they are not control boundaries).

### A11Y-003 — `ink-400` as text on ink · **FAIL**

| | |
| --- | --- |
| **Severity** | Low |
| **Detail** | `--color-ink-400` (`#71717E`) on `--color-ink-950` is 4.20 : 1. Fine for large text (≥18.66 px bold or ≥24 px), fails for body copy. |

**Fix.** Use `--color-ink-300` (`#A0A0A9`, 7.80 : 1) for secondary text in dark
mode. `ink-400` is fine for icons, rules and disabled states.

---

## 3. Item-by-item manual audit (WCAG 2.2 AA)

`P` = pass · `F` = fail · `?` = **not yet audited** (needs a human at a screen)

### Perceivable

| # | SC | Criterion | Verdict | Notes / fix |
| --- | --- | --- | --- | --- |
| 1 | 1.1.1 | Non-text Content | **P** | `GalleryImage.alt` is a required column (`prisma/schema.prisma:455`); `JsonLd` and the theme bootstrap carry no content. Automated check in `a11y.spec.ts` ("every image has an alt attribute") plus `seo.ts` alt helpers. |
| 2 | 1.2.1–1.2.5 | Audio / video | **P** | No audio or video anywhere in the app. The gallery is before/after **images**. Nothing to caption. |
| 3 | 1.3.1 | Info and Relationships | **P** | Semantic HTML throughout (`header`/`main`/`footer`, real `nav`, one `h1` per page, definition-row tables in email). Heading-order check in `a11y.spec.ts`. |
| 4 | 1.3.2 | Meaningful Sequence | **P** | No `tabindex` > 0 anywhere; the DOM order is the visual order (CSS grid/flex only). |
| 5 | 1.3.3 | Sensory Characteristics | **P** | Copy never says "click the button on the right". Labels name the control. |
| 6 | 1.3.4 | Orientation | **P** | No `orientation` lock anywhere. |
| 7 | 1.3.5 | Input Purpose | ? | Autocomplete tokens on the booking form need a human check (`name`, `tel`, `email`, `vehicle` are not standard tokens; `street-address` is not collected). |
| 8 | 1.4.1 | Use of Color | **P** | Open/closed state pairs the colour with the word "Open now" / "Closed now". Slot availability pairs the chip with a `capacityLeft`-derived label. Required fields are marked in text, not only colour. |
| 9 | 1.4.2 | Audio Control | **P** | No audio. |
| 10 | 1.4.3 | Contrast (Minimum) | **F** | See §2 — the token-level failures. Brand yellow on white is 1.59 : 1. |
| 11 | 1.4.4 | Resize Text | ? | `globals.css` uses `clamp()` fluid type with rem units, which is correct in principle. Needs a 200% zoom walkthrough — automated partly in `responsive.spec.ts`. |
| 12 | 1.4.5 | Images of Text | **P** | The logo lockup is styled text (`src/lib/integrations/email.ts` lockup pattern is the same idea), not an image. No image-of-text anywhere. |
| 13 | 1.4.10 | Reflow | ? | Automated in `responsive.spec.ts` at 320 px across all nine routes; the human check is 320×256 CSS px. |
| 14 | 1.4.11 | Non-text Contrast | **F** | The focus ring (1.59 : 1 on white) and the default input border (1.24 : 1). See A11Y-001/002. |
| 15 | 1.4.12 | Text Spacing | ? | No `!important` height/line-height overrides on text containers — needs a visual check. |
| 16 | 1.4.13 | Content on Hover or Focus | ? | Tooltips (`@radix-ui/react-tooltip`) need dismissal-on-hover/Escape/pointer-cancel checks. |

### Operable

| # | SC | Criterion | Verdict | Notes / fix |
| --- | --- | --- | --- | --- |
| 17 | 2.1.1 | Keyboard | ? | `a11y.spec.ts` counts focusable controls on `/book`. A human must tab through the whole wizard. |
| 18 | 2.1.2 | No Keyboard Trap | ? | Radix `Dialog`/`Tabs` implement focus traps with Escape. Verify the lightbox and the mobile-nav drawer by hand. |
| 19 | 2.1.4 | Character Key Shortcuts | **P** | No single-character shortcuts anywhere. |
| 20 | 2.2.1 | Timing Adjustable | **P** | **No session timeout anywhere.** No auth-gated customer flow, no countdown that ends a session. The only timer is the promo countdown, which is informational and does not expire anything. WCAG 2.2.1 has no 20-hour rule — but the *policy* is: **no customer-facing session may time out in under 20 hours**, and today nothing times out at all. |
| 21 | 2.2.2 | Pause, Stop, Hide | **P** | `prefers-reduced-motion: reduce` in `globals.css:247` pins animation/transition to 0.01 ms. Automated in `a11y.spec.ts`. There is no auto-playing carousel, no marquee that moves (`.Marquee` must be verified — if it animates it must honour reduced motion). |
| 22 | 2.3.1 | Three Flashes | **P** | No flashing content. The `.eyg-hazard` hatch is static. |
| 23 | 2.4.1 | Bypass Blocks | **P** | `<SkipLink targetId="main" />` in `src/app/layout.tsx:142`, and `<main id="main" tabIndex={-1}>`. Automated as the first-tab assertion in `navigation-and-cta.spec.ts`. |
| 24 | 2.4.2 | Page Titled | **P** | Per-route metadata in `src/lib/seo.ts`; asserted in `home.spec.ts`. |
| 25 | 2.4.3 | Focus Order | ? | `tabindex={-1}` on `<main>` is correct (programmatic focus target, not in the tab order). Every other control must be DOM-ordered. Needs a walkthrough. |
| 26 | 2.4.4 | Link Purpose (In Context) | **P** | Links name their destination. No "click here". |
| 27 | 2.4.5 | Multiple Ways | **P** | Header nav + footer nav + sitemap.xml + the mobile action bar. |
| 28 | 2.4.6 | Headings and Labels | **P** | Section headings are real `<h2>`s; form fields have `<Field>`/`Input` with labels. |
| 29 | 2.4.7 | Focus Visible | **F** | See A11Y-001. Fails in the light theme. |
| 30 | 2.4.11 | Focus Not Obscured (Minimum) | ? | **The sticky mobile action bar and sticky header are the risk.** A focused element must not be fully hidden behind them. `scroll-padding-top` is set in `globals.css:197`; the action bar needs a `scroll-margin-bottom` equivalent. Check by hand. |
| 31 | 2.5.1 | Pointer Gestures | **P** | The before/after slider (`BeforeAfterSlider.tsx`) is a drag **plus** a keyboard/button path. Verify. |
| 32 | 2.5.2 | Pointer Cancellation | **P** | Actions fire on `click`, not `mousedown`. |
| 33 | 2.5.3 | Label in Name | ? | A visible "Book a bay" inside a button whose `aria-label` is "Reserve a bay" would fail. Check every icon button has either no `aria-label` (text content becomes the name) or a label containing the visible text. |
| 34 | 2.5.4 | Motion Actuation | **P** | No device-motion or device-tilt input. |
| 35 | 2.5.7 | Dragging Movements | ? | The before/after slider needs an explicit non-drag alternative (arrow keys or two buttons). Verify. |
| 36 | 2.5.8 | Target Size (Minimum) — **WCAG 2.2 new** | ? | Automated at 44 × 44 in `a11y.spec.ts`. Note the AA bar in 2.2 is 24 × 24; the brief asks for 44 × 44, which is the AAA/Apple figure and the right target for a thumb. |
| 37 | **2.5.7 / 2.5.8** | **Consistent Help** | ? | The phone number is on every page (mobile action bar + header/footer). Consistent help is satisfied; the *availability* of a help mechanism is a WCAG 3.2.6 best practice and is met by the always-reachable `tel:` link. |

### Understandable

| # | SC | Criterion | Verdict | Notes / fix |
| --- | --- | --- | --- | --- |
| 38 | 3.1.1 | Language of Page | **P** | `<html lang="en-PH">` in `layout.tsx:132`. |
| 39 | 3.2.1 | On Focus | **P** | Focus does not change context. The booking wizard moves **between steps on an explicit button press**. |
| 40 | 3.2.2 | On Input | **P** | No control changes context on input. |
| 41 | 3.2.3 | Consistent Navigation | **P** | The header nav is identical on every page; the mobile action bar is identical on every page. |
| 42 | 3.2.4 | Consistent Identification | **P** | The phone CTA, the book CTA and the WhatsApp CTA look the same everywhere (one `<Button>` component). |
| 43 | 3.2.6 | Consistent Help | ? | See 37. |
| 44 | 3.3.1 | Error Identification | **P** | `ApiFailure.error.fields` is a `Record<field, string[]>` (see `src/lib/types.ts:14`) and `zodFields()` maps every zod issue to its input path. The 400 path is verified in `tests/integration/api-booking.test.ts`. |
| 45 | 3.3.2 | Labels or Instructions | **P** | Every field has a `<label>`; the CAPTCHA question *is* the instruction. |
| 46 | 3.3.3 | Error Suggestion | **P** | `zodFields()` messages are written for customers ("Use the format YYYY-MM-DD.", "Enter a valid plate number."), not for developers. |
| 47 | 3.3.4 | Error Prevention (Legal) | ? | The estimate is explicitly an estimate and is confirmed at the counter; consent is captured before marketing contact. Needs a legal sign-off, not a QA sign-off. |
| 48 | 3.3.7 | Redundant Entry | **P** | The 4-step wizard collects the vehicle once and reuses it; the phone is not asked for on every step. |
| 49 | 3.3.8 | Accessible Authentication (Minimum) | **P** | The **customer** surface has no authentication at all — that is the accessible outcome. `/admin` is staff-only and outside the customer journey; note that `/admin` must not be the only way to do anything a customer needs. |

### Robust

| # | SC | Criterion | Verdict | Notes / fix |
| --- | --- | --- | --- | --- |
| 50 | 4.1.2 | Name, Role, Value | **P** | Radix primitives supply roles. `<MobileActionBar>`, `<OpenStatusPill>`, `<Stepper>`, `<Lightbox>`, `<Modal>` all need role checks — automated partly via axe. |
| 51 | 4.1.3 | Status Messages | **P** | Needs `aria-live`. **Verify**: the booking wizard's pending/success/error states and the estimate updates must announce. `role="status"` for the estimate, `role="alert"` for a form error. A human must confirm with a screen reader. |
| 52 | 4.1.1 | Parsing (removed in 2.2) | n/a | Superseded by 4.1.2. |

---

## 4. Manual checks that must be done by a human before release

These cannot be automated and are currently unverified.

- [ ] **Screen-reader smoke test — NVDA (Windows) + VoiceOver (iOS/macOS).**
      Minimum scope: homepage → `/book` → complete a booking → hear the
      reference. Then `/services` price list and the `/gallery` lightbox.
      Record the exact announcement for: the open/closed badge, the selected
      slot, the estimate total, and the form errors.
- [ ] **Keyboard-only booking.** Unplug the mouse at `/book` and complete a
      booking. Watch for: focus order, the focus ring's visibility, focus trapped
      in the stepper, and focus lost after the confirmation.
- [ ] **Keyboard-only lightbox.** Open, arrow through the images, close with
      Escape, and confirm focus returns to the trigger.
- [ ] **200% browser zoom** on every route, plus **320 × 256 CSS px** reflow.
- [ ] **Text spacing override** (1.4.12 bookmarklet).
- [ ] **`prefers-reduced-motion`** with the OS setting on: confirm the marquee
      (`.Marquee`) and any `framer-motion` animation actually stop.
- [ ] **Windows High Contrast / forced-colors mode.** The brand is yellow on
      black; forced-colors overrides both, so check the emergency banner stays
      legible.
- [ ] **Focus Not Obscured (2.4.11)**: tab to the last field of the booking form
      with the mobile action bar visible on a 393 × 852 viewport.

---

## 5. How to re-verify

```bash
npx playwright test --project=mobile  tests/e2e/a11y.spec.ts
npx playwright test --project=desktop tests/e2e/a11y.spec.ts
```

Target: **zero serious and zero critical** axe violations on all nine routes in
both themes. A `moderate` or `minor` violation must be triaged: either fixed or
written into this document with a reason it is acceptable.

Automated checks currently in the suite: one `h1` per page, no skipped heading
levels, landmarks present and uniquely named, every form control has an
accessible name, every `<img>` has `alt`, 44 × 44 tap targets on mobile,
`prefers-reduced-motion` removes transitions, and the lightbox exposes
`role="dialog"`.
