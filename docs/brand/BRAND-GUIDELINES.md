# EYG TIRE & AUTO CARE — BRAND GUIDELINES

Version 1.0 · October 2026 · Balanga City, Bataan, Philippines

> **The contract is the code.** Every colour, size, easing, radius and layout
> value in this document is a live token in `src/app/globals.css`. If this
> document and `globals.css` ever disagree, **`globals.css` is correct** and this
> document is a bug. The machine-readable dump is `docs/brand/tokens.json`.

---

## Contents

| # | Section | Document |
| --- | --- | --- |
| 1 | [Brand story & positioning](#1-brand-story--positioning) | this file |
| 2 | [Logo](#2-logo) | this file + [LOGO-ASSETS.md](./LOGO-ASSETS.md) |
| 3 | [Colour](#3-colour) | this file + [COLOR.md](./COLOR.md) |
| 4 | [Typography](#4-typography) | this file + [TYPOGRAPHY.md](./TYPOGRAPHY.md) |
| 5 | [Layout & grid](#5-layout--grid) | this file |
| 6 | [Photography & imagery](#6-photography--imagery) | this file |
| 7 | [Motion](#7-motion) | this file |
| 8 | [Icons & pictograms](#8-icons--pictograms) | this file |
| 9 | [Applications](#9-applications) | this file + [APPLICATIONS.md](./APPLICATIONS.md) |
| 10 | [Partner & co-branding](#10-partner--co-branding) | this file |
| 11 | [Accessibility](#11-accessibility) | this file |
| 12 | [Do / Don't](#12-do--dont) | this file + [DO-NOT.md](./DO-NOT.md) |
| — | Voice & tone | [VOICE-AND-TONE.md](./VOICE-AND-TONE.md) |

---

## 1. Brand story & positioning

### 1.1 Who EYG is

**EYG Tire & Auto Care** is a tyre and auto-care shop on **EGSA Fourlanes, Tuyo,
Balanga City, Bataan 2100** — a ~1.5 hour drive from Manila, on the road that
every Balanga commuter and every trucker between Manila and Bataan already
drives. The shop opened its doors in **2025**. It is a small business with a
Facebook following of roughly 300 people, which means **trust here is personal,
not corporate**: the people who answer the phone are the people who turn the
wheels.

The category EYG competes in is not "tyre shops". It is *being stranded on a
highway with a flat, at 6 pm, with a truck behind you and a phone at 1 bar.*

### 1.2 The promise

> #### Straight answers, fair prices, and the bay is ready when you arrive

Three promises, in priority order:

1. **Straight answers.** You get a real price before the work starts. If the

   car does not need it, we say so.

2. **Fair prices.** Published ranges, not "inquire for price".
3. **Ready when you arrive.** Book a slot, drive in, get worked on. The phone

   is answered by a person who knows what bay is free.

### 1.3 Positioning line

> ### **Balanga's tyre & auto care pit stop.**

*This is `BUSINESS.tagline` in `src/config/site.ts` and is the single approved
descriptor line. Use it verbatim or not at all.*

Secondary lines, all derived from confirmed facts only:

- *Tyres · Alignment · Brakes · Undercoating · Car aircon* — the service list,

  never as a claim.

- *Right along EGSA Fourlanes, Tuyo.* — the landmark line (`BUSINESS.address.landmark`).
- *Book a bay.* / *Call the shop.* — action lines, never slogans.

### 1.4 Elevator pitch (10 seconds, at the counter or on the phone)

> "EYG Tire & Auto Care — we're on EGSA Fourlanes in Tuyo, Balanga. Tyres,
> wheel alignment, brakes, undercoating and car aircon. Book a bay online or
> call us and we'll tell you straight what your car needs and what it costs."

### 1.5 50-word description

> EYG Tire & Auto Care is a tyre and auto-care shop on EGSA Fourlanes, Tuyo,
> Balanga City, Bataan. We fit tyres, do wheel alignment, brakes, undercoating
> and car aircon. Straight answers, fair prices, and a booked bay waiting when
> you arrive. Book online or call.

(49 words.)

### 1.6 150-word description

> EYG Tire & Auto Care is a tyre and auto-care shop on EGSA Fourlanes in Tuyo,
> Balanga City, Bataan. We opened our doors in 2025 for the people who drive
> this road every day: commuters between Balanga and Manila, delivery riders,
> and trucks on their way to the port.
>
> We fit tyres, do wheel alignment, replace brake pads and shock absorbers,
> apply undercoating, service car aircon, and handle the small jobs that keep a
> car safe — vulcanising, CVL and bushing replacement, change oil.
>
> Two things we promise. First, straight answers: you get a real price before we
> start, and if your car does not need the work we will tell you. Second, a bay
> ready when you arrive — book a slot online, or call and a person answers.
>
> Cash, GCash, Maya, card, or credit instalment. Balanga's tyre & auto care pit stop.

### 1.7 Positioning map

```text
                    FAST / SPECIALIST
                          ▲
              alignment  │  undercoating
                          │
   LOCAL ◄────────────────┼────────────────► REGIONAL
     (hopsam)             │              (expressway traffic)
                          │
              tyres       │  brakes
                          ▼
                   PRICE-SENSITIVE
```

EYG sits **local, fast, price-transparent.** It is not a luxury/lifestyle
garage, and it is not a discount tyre stall. It is the shop you call when you
are already on the road.

### 1.8 Brand personality — five words

#### Direct. Practical. Motored. Honest. Filipino

| Word | What it means in practice |
| --- | --- |
| **Direct** | One sentence per idea. No "we're excited to". State the price and the time. |
| **Practical** | Photos of the actual bay, actual tyres, actual receipts. |
| **Motored** | The yellow/black lockup, the speed-stripe, the italic display type. Grid lines, not gradients. |
| **Honest** | No invented ratings, no fake reviews, no "certified", no claims the owner has not signed off. |
| **Filipino** | Taglish-friendly English and the vocabulary locals actually use. |

### 1.9 What EYG is NOT

- ❌ A dealership or a franchise chain.
- ❌ A luxury detailing studio.
- ❌ A discount tyre stall that under-quotes.
- ❌ An emergency roadside-assistance fleet (yet — see `TODO-VERIFY` in `site.ts`).

---

## 2. Logo

![EYG Tire & Auto Care lockup](../public/brand/logo-primary.svg)

### 2.1 What the mark actually is

The official mark is a **720 × 720 raster profile picture**, not a vector. It
was read pixel-by-pixel and measured for this guideline. Its anatomy:

| Element | Description |
| --- | --- |
| **Field** | Near-black backdrop, measured at the logo's colour as `#2A2720` in the JPEG (lifted blacks from a 3D render + JPEG chroma noise). **Brand ink is `#06060A`** — the field value in the supplied raster is a render artefact, not a brand colour. |
| **Wheel mark** | A **tilted elliptical wheel**, centre (85, 317.5) on the 720 grid, semi-axes 27.8 × 50.2, rotated **+11.4°** clockwise (top leaning right). Reads as a wheel seen at speed, not head-on. |
| — Tyre | A **hairline** white/ink elliptical outline (≈2.6 units thick). The tyre body itself is the negative space between this outline and the rim — a black donut. |
| — Rim | A **yellow ring**, outer ellipse 22 × 40, band ≈8 units, concentric with the tyre. |
| — Hub | A **5-spoke hub** mapped onto the rim's inner ellipse so the spokes follow the wheel's eccentric perspective, with a dark centre bore and 5 dark lug holes between the spokes. |
| — Tread arc | **11 white wedges** fanning around the tyre's upper-right, from roughly 11 o'clock to 4 o'clock, growing longer clockwise. This is the motion device: the wheel is turning. |
| **EYG TIRE** | Ultra-extended, ultra-bold **forward italic** capitals, **white**, cap height 68 units, total width 489 units (**7.2 : 1** width-to-cap). Shear **13°**. The E's middle arm is thinner than its top and bottom bars. The G has a horizontal crossbar intruding from the right. |
| **& AUTO CARE** | The same italic family at a lighter weight, **yellow**, cap height 30 units (44 % of the wordmark cap), width 372 units, generous tracking (0.14 em letter, 0.41 em word). Sits right-aligned under the wordmark. |
| **Speed stripe** | A tapered **yellow wedge** under the whole mark. Horizontal top edge; a needle point at the left (x≈126) that thickens to the right, ending in a soft diagonal at x≈617. Bottom edge rises 23 units over 470 units of run. |

**Weight hierarchy:** wordmark (heaviest) → subline (bold) → speed stripe
(medium) → wheel rim/hub (medium) → tyre outline and tread (hairline). Never
invert it.

### 2.2 The three permitted lockup variants

Only these three. Nothing else is a logo.

| # | Variant | File | When to use |
| --- | --- | --- | --- |
| **1** | **Primary lockup** — wheel + wordmark + subline + speed stripe | `logo-primary.svg` (dark field) / `logo-primary-light.svg` (light field) | Everything default: website header, Facebook cover and profile, signage, invoices, uniforms, estimates. |
| **2** | **Mark only** — the wheel alone | `logo-mark.svg` | Square/avatar contexts: Facebook profile picture, Instagram grid, app tile, bay-number decal, tyre-shaped merchandise. Minimum useful size is much smaller. |
| **3** | **Wordmark only** — `EYG TIRE` / `& AUTO CARE` | `logo-wordmark.svg` | Long, thin horizontal strips where the wheel would fall below minimum size: the top of a service-receipt, an email signature line, a 60 px website footer. |

Plus two **mono** reductions for reproduction limits (single-colour print,
engraving, laser, one-colour embroidery, fax-quality photocopy):

| Variant | Files |
| --- | --- |
| Mono white (for dark / photo-negative reproduction) | `logo-mono-white.svg` |
| Mono black (for light / single-colour print) | `logo-mono-black.svg` |

### 2.3 Clear space

Let **`x` = the cap height of the "E" in EYG TIRE.** On the 720 source grid
`x = 68 units`. In any reproduction, measure `x` on the artwork itself.

```text
                 ┌───────────────────────────────┐
      2x        │                               │  2x
                 │        ┌───────────────┐      │
                 │  2x    │               │ 2x   │
                 │   ┌───────────────────────┐  │
                 │   │ ▓  WHEEL  EYG TIRE    │  │
                 │   │ ▓            & AUTO    │  │
                 │   │ ▓  ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂  │  │  ← speed stripe is
                 │   │ ▓                       │  │     part of the mark,
                 │   └───────────────────────┘  │     NOT clear space
                 │  2x                       2x │
                 └───────────────────────────────┘
```

#### Rule: keep a clear margin of `2x` on all four sides of the lockup

- `2x` = 136 source units = **29 % of the lockup width**.
- Measured numerically: the artwork box is 585 × 168; the exclusion zone is

  **857 × 440** source units.

- Nothing enters the zone — not a photo edge, not a rule, not a fold, not a

  tyre in the photograph, not a second logo.

**Minimum clear space between the logo and any type**: `1x`.
**Minimum clear space between two logos**: `2x`.

### 2.4 Minimum sizes

Measured on the **mark's cap height `x`**, with the whole lockup width `W`
(≈ 7.2 × x + wheel).

| Variant | Minimum **print** | Minimum **screen** | At minimum, expect… |
| --- | --- | --- | --- |
| **1. Primary lockup** | **32 mm wide** | **240 px wide** | The tyre outline is ≈0.4 mm — print **vector only** at this size. On screen the tread wedges begin to close up. |
| **3. Wordmark only** | **22 mm wide** | **170 px wide** | Legible; the speed stripe is absent, so the lockup no longer reads as a lockup. |
| **2. Mark only** | **9 mm** | **40 px** | Below 24 px the tread arc is dropped entirely — use `favicon.svg`, which is the pre-simplified 1:1 tile. |
| **Favicon tile** | not for print | **16 px** | Reads as a yellow 5-spoke rim on black. Nothing else survives. |

#### Reproduction floor rules

- The primary lockup **must not** be reproduced below 240 px / 32 mm.
- Embroidery, laser engraving, hot-foil, vinyl cutting and single-colour

  screen print use `logo-mono-black.svg` or `logo-mono-white.svg` **only**.

- The 5-lug-hole detail on the hub is present in `logo-primary*` and

  `logo-mark`; it is **deliberately omitted** in both mono files because it
  fills in at small sizes. Do not re-add it.

### 2.5 Backgrounds the logo may sit on

| Background | Allowed | Use |
| --- | --- | --- |
| Ink `#06060A` | ✅ **Preferred** | Primary. The mark is designed for this. |
| Ink 900 `#0E0E12` → Ink 800 `#17171D` | ✅ | Acceptable, keeps the yellow hot. |
| White `#FFFFFF` | ✅ **With the light file only** | Use `logo-primary-light.svg`. |
| Surface muted `#F6F6F7` | ✅ light file | Printing on white-ish stock, bay boards in daylight. |
| Brand yellow `#FCC605` | ⚠️ **Mark only, mono ink** | The yellow wordmark on yellow ground is invisible. Full lockup is never permitted. |
| Brand 300 `#FFDC47` → Brand 100 `#FFF1C2` | ⚠️ mono ink only | Same rule. |
| Racing / pit ramps | ❌ | Never. |
| Photography | ⚠️ **Only on a solid ink plate** | See below. |
| Gradients, patterns, textured walls | ❌ | Never directly. |
| Third-party brand colours | ❌ | Never. |

**On photography:** place the logo on a **solid `#06060A` panel at 100 % opacity**
with the `2x` clear space intact. If you cannot place a solid panel, do not
place the logo — crop the photo instead. A logo on a busy tyre stack is a
broken logo.

**On yellow:** only the mono ink/black versions, mark only, and only as a
`20–40 %` tint watermark on a yellow field (see [APPLICATIONS.md](./APPLICATIONS.md)).

### 2.6 Misuse — described precisely

Each of the following is a real failure mode we have seen or can foresee. Full
visual checklist in [DO-NOT.md](./DO-NOT.md).

1. **Never re-colour the wordmark yellow.** `EYG TIRE` is **white**. Only the

   subline, the speed stripe, the rim ring and the hub are yellow. Making the
   wordmark yellow makes it indistinguishable from the subline beneath it.

2. **Never remove the ampersand or rename the mark.** It is not "EYG TIRES", not

   "EYG Tyre", not "EYG Auto Care", and not "E.Y.G.".

3. **Never set the mark at an angle, curve it, outline it, or apply a

   gradient/pattern fill to it.**

4. **Never add effects**: drop shadows (except the mono knock-out on dark),

   bevels, glows, emboss, 3D, motion blur. The supplied raster is a 3D render —
   that look is *not* part of the identity.

5. **Never re-draw or re-space the letterforms.** The extended italic and its

   13° shear are the identity. Do not "fix" the E's thin middle arm; it is
   deliberate.

6. **Never stack the subline above the wordmark**, never left-align the subline

   to the wordmark's left edge, and never centre it.

7. **Never stretch, squash, condense or rotate.** Scale uniformly only.
8. **Never place the mark on a light background using the dark-field file**, or

   on a dark background using the light file.

9. **Never surround the lockup with a box, border, circle or shield**, and never

   put the speed stripe on the top instead of the bottom.

10. **Never crop the speed stripe** "to tidy up" — it is part of the mark and it

    must always taper left-to-right, thin end on the left.

11. **Never use the JPG profile picture as a logo on a light background** — it

    has a baked black field with lifted JPEG blacks.

12. **Never alter the wheel's 11.4° tilt** to "straighten" it. The tilt is the

    wheel's speed.

13. **Never let the tread arc's white merge into a photographic white

    highlight.**

14. **Never claim or imply a tyre-brand partnership by placing a third-party

    logo adjacent to the EYG lockup** (see §10).

15. **Never place more than one EYG logo in a composition.**

---

## 3. Colour

Full tables, conversions and the colour-blind safety analysis are in
**[COLOR.md](./COLOR.md)**. Summary:

| Role | Token | Hex | Contrast vs white | Contrast vs ink |
| --- | --- | --- | --- | --- |
| **Brand yellow** — primary accent | `--color-brand-500` | `#FCC605` | **1.59 : 1** ❌ | **12.73 : 1** ✅ AAA |
| Yellow, pressed / on yellow | `--color-brand-600` | `#D9A800` | **2.20 : 1** ❌ | **9.20 : 1** ✅ AAA |
| **Ink** — primary dark | `--color-ink-950` | `#06060A` | **20.23 : 1** ✅ AAA | — |
| Ink 900 — dark surface | `--color-ink-900` | `#0E0E12` | **19.26 : 1** ✅ AAA | — |
| Body text (light) | `--color-muted-foreground` | `#52525E` | **7.70 : 1** ✅ AAA | — |
| Body text (dark) | `--color-ink-300` | `#A0A0A9` | **2.59 : 1** ❌ | **7.80 : 1** ✅ AAA |
| **Racing red** — error / urgency | `--color-racing-600` | `#DC2626` | **4.83 : 1** ✅ AA | **4.19 : 1** ✅ AA |
| **Pit green** — confirmed / open | `--color-success` = `--color-pit-600` | `#16A34A` | **3.30 : 1** ⚠️ AA large only | **6.14 : 1** ✅ AA |
| Hairline | `--color-border` | `#E3E3E6` | **1.28 : 1** — decorative only | — |

### The three hard colour rules

1. **Brand yellow is never used for body text on a light background.**

   `#FCC605` on white is **1.59 : 1**. Yellow text on white fails WCAG AA by a
   factor of three. Yellow is a *surface*, never a light-background text
   colour.

2. **Yellow always carries ink text.** `--color-accent-foreground` is

   `#06060A`. Ink on yellow is 12.73 : 1.

3. **Colour is never the sole carrier of meaning.** Every red/green state must

   also carry an icon and a word. Under deuteranopia, racing red and pit green
   are only **58 RGB units apart** — effectively the same colour. See
   [COLOR.md §6](./COLOR.md).

> **One deliberate exception.** The `& AUTO CARE` subline inside the logo is
> yellow, and on `logo-primary-light.svg` that is 1.59 : 1 against white. This
> is permitted: WCAG 2.2 §1.4.3 (Logotype) exempts text that is part of a logo
> from contrast minimums, because altering it would alter the identity. **Do
> not "fix" it, and do not extend the exemption to any yellow copy outside the
> artwork.**

---

## 4. Typography

Two families, one job each. Full detail in **[TYPOGRAPHY.md](./TYPOGRAPHY.md)**.

| Token | Family | Weight | Use |
| --- | --- | --- | --- |
| `--font-display` | **Saira** | 800 / 900, italic available | Headings, display, price callouts, eyebrows on signage |
| `--font-sans` | **Barlow** | 400 / 500 / 600 / 700 | All body copy, UI, forms, everything that is read |
| `--font-mono` | **Barlow Mono** | 400 / 600 | Booking refs `EYG-XXXX`, VINs, plates, diagnostic codes |

**Saira was chosen because its forward-leaning extended italic is the same
gesture as the wordmark.** Barlow is a neutral, slightly condensed grotesque
with excellent legibility at small sizes and full Tagalog/Latin Extended
support — it stays invisible so the headline does the work.

### The scale (live tokens — use the class, not the number)

| Token | Size | Line height | Tracking | Weight | Role |
| --- | --- | --- | --- | --- | --- |
| `.text-display-1` | `clamp(2.5rem, 1.4rem + 5.2vw, 5.5rem)` | 0.92 | −0.03em | 900 | One per page. The hero promise. |
| `.text-display-2` | `clamp(2rem, 1.3rem + 3.4vw, 3.75rem)` | 0.96 | −0.025em | 900 | Section opener, promo headline |
| `.text-h1` | `clamp(1.875rem, 1.4rem + 2.2vw, 3rem)` | 1.06 | −0.02em | 800 | Page title |
| `.text-h2` | `clamp(1.5rem, 1.25rem + 1.2vw, 2.125rem)` | 1.14 | −0.015em | 800 | Section title |
| `.text-h3` | `clamp(1.25rem, 1.12rem + 0.6vw, 1.625rem)` | 1.2 | −0.01em | 700 | Card / service title |
| `.text-body-lg` | `1.0625rem` | 1.65 | 0 | 400 | Lead paragraph |
| `.text-base` | `1rem` | 1.6 | 0 | 400 | Body |
| `.eyg-eyebrow` / `--text-eyebrow` | `0.75rem` | `1rem` | **+0.16em** | 700 | Uppercase label |

### Three setting recipes

**A service price.** Display face, tabular numerals, peso sign attached:

```text
  ₱1,200                        ← Saira 900, text-h2, .tabular, ink-950
  PMS A · up to 4 hours         ← Barlow 400, text-base, .muted-foreground
```

Never use the display face below `text-h3` (26 px). A peso figure smaller than
26 px reads as a caption, not a price.

**A promo.** Eyebrow in yellow-on-ink, headline, one line of body, deadline as
an eyebrow:

```text
  PEAK SEASON TYRE CLEARANCE     ← .eyg-eyebrow, brand-500 on ink-950
  4+4 on selected sizes          ← .text-display-2, white on ink-950
  Ends 30 November.              ← .text-body-lg, ink-300
```

Never use `.eyg-hazard` for a price. Hazard hatching is for **urgency only**.

**A disclaimer.** Deliberately quiet: Barlow, `text-base`, `--color-muted-foreground`,
max width `--container-prose` (44 rem), always preceded by an eyebrow so the
reader is warned it is small:

```text
  PRICE NOTE                     ← .eyg-eyebrow, muted-foreground
  Prices are estimates for a standard passenger vehicle and may change
  after inspection. We confirm the final price with you before starting.
```

### Hierarchy rules

- **Exactly one `.text-display-1` per page.** It is the promise. Nothing competes.
- **Never skip a level** (H3 → H5). Screen-reader users navigate by heading level.
- **Display type is never italic in the website.** The wordmark is italic; the

  site's display type is upright. Using italic Saira in body-adjacent headings
  makes it look like a logo and dilutes the mark.

- **Body copy is never below 16 px.** On a 3G Android in sunlight, 16 px is the

  floor, not the target.

- **Measure is capped at `--container-prose` (44 rem ≈ 65–70 characters).**
- **Numbers are tabular** (`.tabular`) in any column of prices, times, or

  quantities. Proportional digits jitter and make a price table look broken.

---

## 5. Layout & grid

### 5.1 Containers

| Token | Value | Use |
| --- | --- | --- |
| `--container-page` | **76 rem** (1216 px) | Every page's outer content width. Centred, with `1.5rem` minimum side padding at mobile and `2rem` above 768 px. |
| `--container-prose` | **44 rem** (704 px) | Long-form reading: privacy, terms, disclaimers, "about" body copy. |

The page container is **76 rem, not 80**. At 80 rem the display type at
`5.5rem` starts to set lines longer than the brand can carry, and the speed
stripe gets too long to read as a mark.

### 5.2 Vertical rhythm

The spacing system is Tailwind's default 4 px base step. EYG uses these
rungs and no others:

| Token | Value | Use |
| --- | --- | --- |
| `1` / `2` / `3` | 0.25 / 0.5 / 0.75 rem | Inside chips, icon gaps, hairline offsets |
| `4` / `5` / `6` | 1 / 1.25 / 1.5 rem | Between related items; card padding |
| `8` / `10` / `12` | 2 / 2.5 / 3 rem | Between blocks inside a section |
| `16` / `20` / `24` | 4 / 5 / 6 rem | Between sections |
| `28`+ | 7 rem + | Between major page acts only (hero → content) |

**Every heading that uses `.eyg-stripe` needs at least `3` (0.75 rem) of space
below it.** The stripe is drawn at `bottom: -0.5rem`, so it occupies the
0.5 rem below the text baseline block; anything closer collides with it.

### 5.3 The speed-stripe device (`.eyg-stripe`)

The signature graphic. Applied as `::after`:

```text
  position   absolute, inset-inline 0, bottom -0.5rem, height 4px
  gradient   90deg  #FCC605 0% → #FFDC47 60% → transparent 100%
  clip-path  polygon(0 0, 100% 0, 96% 100%, 0 100%)
```

#### Rules

- One stripe per heading. Never two stripes stacked.
- Never on body text, buttons, or a card body — only on `display-1`,

  `display-2`, `h1` and `h2`.

- Always tapers and fades to the **right**. Never mirrored.
- The gradient fade is intentional: a stripe that ends at full opacity reads as

  a rule, not as speed.

### 5.4 The hazard hatch (`.eyg-hazard`)

`repeating-linear-gradient(-45deg, #FCC605 0 12px, transparent 12px 24px)`.

**Urgency only.** Permitted: "closing soon", "last 3 slots today", "roadside
assistance", "clearance — limited stock", live "bay busy" states.
Forbidden: prices, headers, backgrounds behind body copy, any decorative use.
Never put body text directly on it — put it on an ink plate *inside* the hatch.

### 5.5 The checker micro-tile (`.eyg-checker`)

`conic-gradient(#C7C7CD 25%, transparent 0 50%, #C7C7CD 0 75%, transparent 0)`
at `background-size: 16px 16px`.

This is a 16 px four-quadrant conic tile in `--color-border-strong`, so it reads
as a fine pinwheel/wheel-tread micro-texture, **not** as a true alternating
checkerboard (every tile repeats with the same orientation). That is the
implemented behaviour and this document follows it. Use it as:

- A 4–8 px band between two sections, or
- A low-opacity fill behind a hero, or
- The tread motif on a bay board.

Never at more than 12 % opacity over content, and never as a large field.

### 5.6 The eyebrow (`.eyg-eyebrow`)

Uppercase, `0.75rem`, weight 700, `0.16em` tracking, `--font-sans`.
It is the label **above** a heading, never a replacement for it, and it is the
one place where yellow-on-ink is used as text (12.73 : 1 ✅).

### 5.7 Corner-radius language

| Token | Value | The idea |
| --- | --- | --- |
| `--radius-eyebrow` | **2 px** | **Deliberate motorsplay squareness.** Eyebrows, chips, tags, small labels — and the focus-ring radius. Nothing else. |
| `--radius-card` | **12 px** | Default for cards, tiles, inputs, list rows. |
| `--radius-panel` | **18 px** | Hero shells, modals, drawers, section panels. |
| `--radius-pill` | **999 px** | **Status pills and tags only.** Never a card, never a panel, never a button. |

**The rule that makes the brand feel motorsport: the smaller the thing, the
squarer it is.** A 12 px radius on a 16 px chip looks like a mistake; a 2 px
radius on a 16 px chip looks like a livery decal. Big things are soft; small
things are square. Radii never appear on the logo.

### 5.8 Elevation

| Token | Use |
| --- | --- |
| `--shadow-plate` | Resting card on a light field. |
| `--shadow-lift` | Hover, `focus-within`, open menu, dragged item. |
| `--shadow-cta` | Primary yellow button at rest. 6 px solid `--color-brand-700` edge + inset white highlight + drop shadow. |
| `--shadow-cta-hover` | Primary button pressed/hovered: edge compresses 6 px → 4 px. |

Dark-theme shadows are overridden to pure black at higher opacity — never reuse
the light values on ink.

---

## 6. Photography & imagery

### 6.1 The before/after standard

This is the single most valuable asset the shop owns and the easiest to fake.
Rules:

1. **Shoot the actual bay, the actual car, the actual tyres.** No stock

   photography. Ever. Not "a mechanic" stock, not "a tyre shop" stock.

2. **Same camera position, same lens, same lighting, same crop** for the before

   and the after. If you cannot match them, do not publish the pair.

3. **The "before" must be genuinely before.** Show the worn tread, the

   misaligned wheel, the old pad. Do not stage a fake before.

4. **No customer faces without a signed release.** See §6.5.
5. **One pair per post.** A carousel of five before/afters with different

   lighting destroys credibility more than showing one perfect pair.

6. **Caption it honestly.** Car make/model, service done, what the customer

   actually paid (only if they agreed). No invented testimonials.

### 6.2 How to shoot each subject

| Subject | Angle | Framing | Must show | Never show |
| --- | --- | --- | --- | --- |
| **Tyres** | 3/4 front, camera at hub height | Tight; the tyre fills 70 % of frame | Tread face **and** sidewall — the size code must be legible | A tyre balanced on a bare floor |
| **The bay** | Straight on from the entrance, eye level | Wide, level horizon | Floor markings, the lift, tool wall, lighting | A photograph taken from a moving car through glass |
| **Diagnostic screen** | Straight on, screen fills frame | Square, no keystone | The actual reading, legible | A blurred screen, a stock dashboard |
| **Engine bay** | Straight down, centred | Square, top-down | Clean, well-lit, hoses routed | Grease, personal tools, licence plates |
| **A technician** | Mid-shot, three-quarter | Vertical or 1:1 | Face or hands in action; a name badge if they consent | Faces without release |

### 6.3 Lighting

- **Shop lights on.** Mixed lighting is the fastest way to make a shop look

  cheap. Turn off any single bulb that reads differently.

- **No on-camera flash.** Ever. It flattens a bay and blows out yellow.
- **Window light is good.** Shoot near the entrance during the day for the

  cleanest, most trustworthy images.

- **Colour target:** the yellow in the photo must match `#FCC605`. If a photo's

  yellow looks orange, the white balance is wrong. Set it against a white
  service-bay wall.

- Aim for the tyre to be the brightest object in the frame. Dark surround,

  bright subject, ink shadows — that is the brand's own logic.

### 6.4 Framing

- **Aspect:** 4:5 for Facebook feed, 1:1 for profile/grid, 16:9 for cover.

  Shoot 16:9 and crop; never upsize.

- **Always set explicit dimensions** on every published image. Layout shift is

  a conversion killer.

- **Composition:** subject on a third, dark negative space in the remaining

  two-thirds, and that space is where the type and the logo go.

- **Never crop through a wheel**, and never crop so tight that the viewer can't

  tell what service is being shown.

### 6.5 What must never be published

❌ **Customer faces** without a signed, dated release held on file.
❌ **Number plates** — full or partially. Blur or crop *before* upload, not in
the caption. This applies to Philippines' Data Privacy Act (RA 10173) and to
simple professionalism; a customer's plate is their data.
❌ **Children's data.** No child, no child's name, no school uniform, no
after-school queue shot. If a child is unavoidably in a frame, blur the face.
❌ **A customer's name, contact number, or booking reference** in a photo
without permission.
❌ **Interior documents** — a customer's VIN, OR/CR, registration, or insurance
paperwork in frame.
❌ **Stock photos presented as EYG's work.** Ever. This is the fastest way to
lose a Facebook page that runs on personal trust.
❌ **Any claim about results** the customer has not confirmed in writing.

### 6.6 Image treatment

- A **subtle** brand-yellow duotone or a slight contrast lift is allowed on

  hero photography. Never a heavy filter, never a colour cast that shifts the
  yellow.

- **Never** place the logo over an image without a solid ink plate (§2.5).
- **Never** use `.eyg-checker` as a photo overlay at more than 8 % opacity.
- Every published image needs meaningful alt text describing **the service**,

  not the file name. `alt="Worn front-left tyre before replacement"` — not
  `alt="IMG_4821.jpg"`.

---

## 7. Motion

### 7.1 The three easings

| Token | Curve | Character | Use |
| --- | --- | --- | --- |
| `--ease-rapid` | `cubic-bezier(0.2, 0, 0, 1)` | Hard out, no overshoot | Hover, press, colour change. 120–180 ms. |
| `--ease-snap` | `cubic-bezier(0.16, 1, 0.3, 1)` | Exponential deceleration | **The default.** Entrances, reveals, panel open. 180–320 ms. |
| `--ease-brake` | `cubic-bezier(0.5, 0, 0.75, 0)` | Decelerating brake | **Exits only.** Close, dismiss, route away. 120–200 ms. |

*(These are the literal `@theme` values in `globals.css`.)*

### 7.2 What animates

| Element | Animates | Duration | Easing |
| --- | --- | --- | --- |
| Button press / CTA | 2 px translate + `--shadow-cta` → `--shadow-cta-hover` | 140 ms | rapid |
| Card hover | `--shadow-plate` → `--shadow-lift`, 1 px rise | 180 ms | rapid |
| Panel / modal / drawer | opacity + 8 px rise (or 12 px for panels) | 280–320 ms | snap |
| Dropdown / popover | opacity + 4 px rise | 180 ms | snap |
| Toast | slide in from bottom 16 px | 240 ms in / 160 ms out | snap / brake |
| Accordion | grid-template-rows or height | 240 ms | snap |
| Focus ring | none — instant | 0 ms | — |
| Form validation message | opacity + 4 px | 160 ms | rapid |
| Live "bays free" counter | opacity cross-fade only | 200 ms | rapid |

### 7.3 What must not animate

❌ The logo. Ever. It does not spin, slide, pulse, glow, or "draw in".
❌ The speed stripe, hazard hatch or checker texture. Background-position
animation on those is a strobe risk and looks cheap.
❌ The phone number. It is the one element on the page that must be perfectly
still and perfectly findable. No pulse, no bounce, no attention animation.
❌ Any text longer than a heading. Paragraph-level fade-ups delay reading and
hurt on 3G.
❌ Layout that shifts. **CLS = 0.** Always set width/height on images and
reserve space for anything that loads late.
❌ Parallax, marquees, carousels that auto-advance, or anything over 400 ms
on the conversion path.
❌ Motion that blocks the tap target. The mobile action bar is fixed and does
not animate in or out.
❌ Anything that loops more than twice. A pulsing element becomes background
noise and stops being read.

### 7.4 The reduced-motion rule

`globals.css` enforces this globally and unconditionally:

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

#### Rules (2)

1. Motion is an enhancement. Every state change must be fully legible with

   motion removed — the user must still see that a panel opened, that a
   submission succeeded, or that a booking was confirmed.

2. Components **must not** opt out with `!important` and must not re-enable

   motion under the query.

3. Nothing that carries information may be *only* motion. If the only signal

   that a booking was confirmed is a slide-in animation, it has failed.

4. Auto-playing video, GIF, or Lottie: **never** auto-play. Poster frame only.
5. The hazard hatch is a static texture, not an animated one. It must never

   scroll or pulse — it is already the most attention-grabbing element on the
   page when it is used.

---

## 8. Icons & pictograms

### 8.1 The style

A **stroked line-icon** set, one family, one weight:

| Property | Value |
| --- | --- |
| Style | Outline / stroked. **No filled icons, no duotone, no two-tone.** |
| Stroke | **2 px** at a 24 px viewBox (`stroke-width="2"`), `stroke-linecap="round"`, `stroke-linejoin="round"` |
| Colour | `currentColor` only. Never a hard-coded hex. |
| Corner radius | Matches `--radius-eyebrow` thinking: **sharp, 2 px-ish joins**. Not rounded-friendly. |
| Optical size | 24 × 24 viewBox, 20 px default render, 16 px minimum. |
| Alignment | Centred optically in the 24 box; optical centre is usually **0.5 px above** the geometric centre for round shapes. |

The set in production is **Lucide** (`lucide-react`, already a dependency),
which is exactly this style: 24 px grid, 2 px stroke, round caps. **Do not mix
icon libraries.** One family only.

### 8.2 Alignment to the display font

- Icon strokes are **2 px**; the Saira 900 stem at `text-h3` (26 px) is ≈8 px.

  At that scale the icon is deliberately lighter than the type — the type leads.

- An icon next to an eyebrow inherits `--radius-eyebrow` geometry: squared

  terminals, tight optical spacing (`0.5rem`, not `0.75rem`).

- Icon + label pairs are set on a **20 px / 24 px** rhythm, not the 4 px body

  step.

- **Never** use an icon larger than the cap height of the text it sits beside,

  and never smaller than the x-height.

### 8.3 Sourcing rules

- ✅ Lucide (already installed) — service and UI icons.
- ❓ A custom icon is allowed **only** when the concept genuinely does not

  exist in the library (e.g. a Philippine-specific plate format). Custom icons
  must be drawn on the 24 px / 2 px grid with round caps, exported as
  `currentColor` strokes, and reviewed against the whole set before shipping.

- ❌ Never import a coloured/duotone icon set. Never use emoji as UI icons.
- ❌ Never mix a filled icon with a stroked one in the same row.

### 8.4 Iconography content rules

- An icon **always** accompanies text that conveys state or meaning. Icon alone

  is acceptable only for universally read affordances (close `×`, chevron,
  plus/minus).

- Payment icons come from `BUSINESS.paymentMethods` (`banknote`,

  `smartphone`, `wallet`, `credit-card`, `calendar`) — never invented.

- Service icons must be obviously literal. A customer in a hurry must

  recognise "brake pad" in under one second. Abstract "efficiency" glyphs are
  banned.

---

## 9. Applications

Full production specs — dimensions, colours, safe margins, materials — are in
**[APPLICATIONS.md](./APPLICATIONS.md)**. Summary of the core ones:

| Application | Spec |
| --- | --- |
| **External signage** | Primary lockup, `2x` clear space, ≥32 mm lockup width. Ink field mandatory. Fabricated, never vinyl-on-glass. |
| **Facebook cover** | 820 × 312 px. Ink field + checker texture at ≤8 % + lockup left, address right. Safe area: 400 px centre. |
| **Facebook profile** | Mark only (`logo-mark.svg`) on ink. 320 × 320 minimum source. |
| **Post template** | 1080 × 1080 (feed) or 1080 × 1350 (feed, taller). 64 px outer safe margin. Eyebrow → headline → one photo → one line. |
| **Uniform** | Mono white or mono black only. Left chest: mark at ≥25 mm. Back: wordmark at ≥180 mm. |
| **Service-bay board** | 600 × 400 mm. Ink field, eyebrow list of services in yellow, hazard hatch strip only for "bay closed". |
| **Job card / receipt** | A5 or 80 mm thermal. Wordmark at the head (≥40 mm), `tabular` prices, reference `EYG-` prefix in mono. |
| **Business card** | 90 × 54 mm. Ink face, yellow left edge, mono wordmark. **No claims, no unverified numbers.** |
| **Google Business Profile** | Mark as avatar. Name field: legal name exactly as in `site.ts`. Never keyword-stuff the name. |

---

## 10. Partner & co-branding

### 10.1 Tyre-brand logos

Tyre-brand logos (Michelin, Bridgestone, Goodyear, Dunlop, Maxxis, Yokohama —
the list currently in `BUSINESS.tireBrands`, **all of which is
`TODO-VERIFY`**) are **third-party trademarks**. They are not part of the EYG
identity and may never be drawn in EYG colours.

### 10.2 The authorisation rule — read this twice

> **A tyre-brand logo may appear on EYG material only if the shop is a current,
> documented, authorised dealer or installer for that brand.**

This is a legal and ethical line, not a style preference:

- ❌ **Never** place a tyre-brand logo to imply authorisation the shop does not

  have. It is a misrepresentation to the customer and a trademark problem for
  both parties.

- ❌ **Never** place a tyre-brand logo in a context that could be read as an

  endorsement, certification, accreditation, or partnership.

- ❌ **Never** use a tyre-brand logo as a decorative element, a background

  pattern, or a bullet icon.

- ✅ **Allowed:** naming the brands the shop genuinely stocks, in body copy or

  in a plain text list, e.g. *"We fit Michelin, Bridgestone and Goodyear."*
  Text names are factual statements about stock. Logos are trademark
  representations.

- ✅ **Allowed, with permission:** an "Authorised Dealer" strip, only for brands

  with a written dealer agreement on file, only using the brand's own current
  artwork, only with the brand's brand-guidelines clear space respected, and
  never larger than 40 % of the EYG lockup's height.

- ✅ **Always** keep the tyre-brand logo **visually subordinate**: smaller than

  the EYG lockup, in a separate zone, never interlocking, never touching.

### 10.3 Placement

```text
      ┌──────────────────────────────────────────────┐
      │                                              │  ← 2x clear space
      │   ┌────────────────────────────┐             │
      │   │  ▓ EYG TIRE & AUTO CARE    │             │
      │   │  ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂  │             │
      │   └────────────────────────────┘             │
      │                                              │
      │   ────────────────────────────────────       │  ← 1x gap, hairline rule
      │   STOCK:  (brands in plain text)             │
      │                                              │
      └──────────────────────────────────────────────┘
```

- The EYG lockup comes **first** — top-left, largest.
- The partner zone sits **below**, separated by at least a `1x` hairline rule.
- The partner logo's own clear space (usually ≥ its own cap height) is

  respected on all sides.

- Partner logos are **never** inside the EYG lockup's exclusion zone.
- If two partner logos sit side by side, they are optically aligned on the same

  baseline and sized to equal optical weight, not equal height.

### 10.4 The endorsement disclaimer

Wherever a partner or authorised-dealer claim appears, the following must be
legible on the same artefact:

> *EYG Tire & Auto Care is an independent business. Tyre brand names are the
> trademarks of their respective owners and do not imply endorsement.*

Put it in `text-base` Barlow, `--color-muted-foreground`, and never smaller
than 10 px on screen or 6 pt in print.

---

## 11. Accessibility

Target: **WCAG 2.2 AA.** This is a conversion requirement, not a charity — the
audience is on a mid-range Android, on 3G, in direct sun, often one-handed,
often in a hurry.

### 11.1 Contrast

| Content | Minimum | EYG's value |
| --- | --- | --- |
| Body text | **4.5 : 1** | ink-500 `#52525E` on white = **7.70 : 1** ✅ |
| Large text (≥24 px, or ≥18.66 px bold) | **3 : 1** | brand-600 `#D9A800` on ink-950 = **9.20 : 1** ✅ |
| UI component boundaries & focus rings | **3 : 1** | brand-500 on ink-950 = **12.73 : 1** ✅ |
| Graphics & icons | **3 : 1** | ink-300 `#A0A0A9` on ink-950 = **7.80 : 1** ✅ |
| **Disabled** states | exempt | May fall below; still must be distinguishable without colour. |

### 11.2 The yellow rule, restated

`#FCC605` is **1.59 : 1 on white**. It is therefore:

- ✅ Legal as a **background** with `#06060A` text on it (12.73 : 1).
- ✅ Legal as **text on ink** at any size.
- ❌ **Illegal as text on white or any light surface**, at any size, ever.
- ⚠️ Legal as a **background for 3 px UI borders** only (3 : 1 non-text minimum

  is 12.73 : 1 against ink but 1.59 : 1 against white — so **a yellow border on
  white is not sufficient on its own**; pair it with a `--color-border-strong`
  or `ink-400` outline).

### 11.3 Focus treatment

Implemented in `globals.css`:

```css
:focus-visible {
  outline: 3px solid var(--color-brand-500);  /* #FCC605 */
  outline-offset: 2px;
  border-radius: 2px;                          /* = --radius-eyebrow */
}
```

- **3 px yellow ring, 2 px offset, 2 px radius.** Non-negotiable.
- `:focus-visible` only — a keyboard user sees the ring, a mouse user does not

  get a ring on click.

- **Never `outline: none`** without a replacement that is at least as visible.
- **Focus is never removed from the mobile action bar's phone link.** The call

  button must be reachable and visible with a keyboard.

- Focus must be visible on **both** themes: brand yellow works on ink

  (12.73 : 1) and on white as a *ring* only if something dark is adjacent — on
  light backgrounds the ring sits against white (1.59 : 1), which is **not
  sufficient on its own**. Always keep a 2 px `ink-950` offset ring underneath,
  or rely on the element's own `border-border-strong`.

### 11.4 Colour is never the only signal

Mandatory. For every state that carries meaning:

| State | Colour | **Also required** |
| --- | --- | --- |
| Error / failed | racing red | An icon (`alert-circle` / `x`) **and** a word ("Could not send", "Wrong number") |
| Success / confirmed | pit green | An icon (`check-circle`) **and** a word ("Booked", "Confirmed") |
| Open now / closed now | green / red | The word "Open" / "Closed" **and** the hours |
| Slot taken / free | grey / green | The word "Free" / "Taken" |
| Selected step | ink or yellow | `aria-current`, a visible step number, and a check on completed steps |
| Clearance / urgency | yellow hatch | The word "Clearance" or "Limited" — never the hatch alone |

Rationale: under deuteranopia, racing red `#DC2626` and pit green `#16A34A`
separate by only **58** RGB units — they are effectively the same colour to a
red-green colour-blind viewer. The icon and the word are not redundancy; they
are the signal.

### 11.5 Keyboard & structure

- Semantic HTML. One `<h1>` per page. Heading levels never skip.
- Every interactive element is a real `<button>` or `<a>`. Never a `<div>` with

  a click handler.

- Landmarks: `<header> <nav> <main> <footer>`, one `<main>` per page.
- All form inputs have a programmatic `<label>`. Errors are tied with

  `aria-describedby` and announced with `aria-live="polite"`.

- Every image has meaningful `alt`, or `alt=""` if decorative.
- Skip link to `<main>` on every page.
- Tap targets ≥ **24 × 24 px** (WCAG 2.2 AA). The **phone** target is ≥

  **44 × 44 px** — it is the primary conversion.

### 11.6 The phone-number rule

The number must be **reachable within one thumb-reach on every viewport,
always** — enforced by the persistent `--mobile-action-bar-height` (4.25 rem)
bottom bar with `env(safe-area-inset-bottom)` padding. Consequences:

- `z-index` for the bar is `--z-mobile-bar: 90`, the highest chrome value, so

  no toast or modal may cover it.

- The bar never animates in or out.
- `padding-bottom: var(--mobile-action-bar-height)` (`.pb-action-bar`) on the

  footer so nothing is ever hidden behind it.

---

## 12. Do / Don't

The visual checklist lives in **[DO-NOT.md](./DO-NOT.md)**. The short version:

### ✅ DO

| | |
| --- | --- |
| ✅ | Keep `2x` clear space (2 × the cap height of the "E") on every side. |
| ✅ | Use `logo-primary.svg` on ink, `logo-primary-light.svg` on white. |
| ✅ | Set yellow on ink and ink on yellow. Never yellow on white. |
| ✅ | Pair every colour state with an icon **and** a word. |
| ✅ | Use the three tokens: `text-display-1`, `text-h1`, `eyg-eyebrow` — and the fluid sizes. |
| ✅ | Use `.eyg-stripe` once per heading, fading right. |
| ✅ | Use `.eyg-hazard` only for real urgency. |
| ✅ | Resize the logo proportionally, always. |
| ✅ | Show real photos of the real bay. Blur plates and faces before upload. |
| ✅ | Respect `prefers-reduced-motion` — never override it. |
| ✅ | Let the phone number stay still, visible, and thumb-reachable. |

### ❌ DON'T

| | |
| --- | --- |
| ❌ | Colour the `EYG TIRE` wordmark yellow. |
| ❌ | Put the logo on yellow, on racing red, on pit green, or on a photo without a solid ink plate. |
| ❌ | Stretch, rotate, curve, outline, shadow, 3D, or animate the logo. |
| ❌ | Use the primary lockup below 240 px / 32 mm. |
| ❌ | Rename the brand. It is "EYG Tire & Auto Care". Not EYG Tyre, EYG Tires, or E.Y.G. |
| ❌ | Set yellow text on a light background (1.59 : 1). |
| ❌ | Use colour as the only signal for error/success/open/closed. |
| ❌ | Use the hazard hatch for anything that is not urgent. |
| ❌ | Put a tyre-brand logo anywhere unless the shop is a documented authorised dealer. |
| ❌ | Publish a customer face, a number plate, or a child's data without consent/blur. |
| ❌ | Invent a price, a rating, a warranty, a year count, or a partnership. |
| ❌ | Use stock photography as EYG's work. |
| ❌ | Ship placeholder text, `TODO`, `000-000-0000`, or `href="#"`. |
| ❌ | Autoplay video, or let a loop run more than twice. |

---

## Maintenance

| Who | What |
| --- | --- |
| **Orchestrator** | Owns `src/app/globals.css` and `src/config/site.ts`. **Any token change requires a corresponding edit to this document and `tokens.json` in the same PR.** |
| **Brand** | Owns `docs/brand/`, `public/brand/`, `src/app/icon.svg`. |
| **Shop owner** | Must sign off on every `TODO-VERIFY` value in `src/config/site.ts` before it appears on any printed or published artefact. |

**Run `node docs/brand/build-assets.mjs` to regenerate every logo asset and
the two PNGs from source.** Requires `sharp` (already a devDependency).
