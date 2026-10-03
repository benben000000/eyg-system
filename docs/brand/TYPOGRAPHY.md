# TYPOGRAPHY — EYG TIRE & AUTO CARE

Version 1.0 · October 2026

> **The contract is `src/app/globals.css` under `@theme`.** Every size, line
> height, tracking and weight below is a live token. Use the **class**
> (`text-h1`, `eyg-eyebrow`), never the number. If this document and
> `globals.css` disagree, `globals.css` wins.

---

## 1. The two families (plus one)

| Token | Family | Weights used | Job | Why this one |
| --- | --- | --- | --- | --- |
| `--font-display` | **Saira** | **800**, **900** (upright; italic available) | Headings, display, price callouts | Saira's extended, slightly condensed, forward-leaning geometry is the **same gesture as the wordmark**. A different face would fight the logo; this one continues it. Its 900 weight survives at small sizes without going spindly, which matters when the audience is on a phone in sunlight. |
| `--font-sans` | **Barlow** | 400 / 500 / 600 / 700 | All body copy, UI, forms, navigation, everything read | Barlow is a neutral, slightly condensed grotesque with **excellent x-height and open apertures** — it stays legible at 16 px on a low-DPI screen and it is a workhorse, not a personality. Deliberately unremarkable: it lets Saira do the shouting. |
| `--font-mono` | **Barlow Mono** | 400 / 600 | Booking references (`EYG-XXXX`), VINs, plate numbers, diagnostic codes, timestamps | Fixed-width so a reference number can be read aloud over the phone without ambiguity (`0` vs `O`, `1` vs `I`). |

### 1.1 Loading

- All three are **self-hosted via `next/font`** — **zero third-party font CDN

  requests**, no Google Fonts, no render delay from an external origin. This
  matters on 3G.

- Fonts are preloaded and `font-display: swap` is handled by `next/font`.
- `body { font-synthesis-weight: none; }` is set globally — the browser will

  **not** fake a 900 weight. If Saira 900 is unavailable, the design falls back
  to Arial Black, not to a synthesised oblique.

- Fallback stacks, exactly as tokenised:
  - `--font-display`: `var(--font-saira), "Arial Black", system-ui, sans-serif`
  - `--font-sans`: `var(--font-barlow), system-ui, -apple-system, "Segoe UI", sans-serif`
  - `--font-mono`: `var(--font-barlow-mono), ui-monospace, "SFMono-Regular", monospace`

### 1.2 The logo typeface is NOT a text setting

The wordmark is **not** set in Saira, and it must never be simulated in Saira.
It is real outlined artwork in `public/brand/*.svg`. Saira is *chosen* to sit
beside it — not to imitate it. Never typeset "EYG TIRE & AUTO CARE" as text
anywhere; use the SVG.

---

## 2. The scale

Every step is **fluid** (`clamp()`), mobile-first: the `min` is the phone
value, the `max` is the desktop value, and the middle term is the fluid
interpolation. There is no breakpoint jump.

| Token / class | Size | Line height | Tracking | Weight | Type |
| --- | --- | --- | --- | --- | --- |
| `.text-display-1` | `clamp(2.5rem, 1.4rem + 5.2vw, 5.5rem)` | **0.92** | **−0.03em** | **900** | Saira |
| `.text-display-2` | `clamp(2rem, 1.3rem + 3.4vw, 3.75rem)` | **0.96** | **−0.025em** | **900** | Saira |
| `.text-h1` | `clamp(1.875rem, 1.4rem + 2.2vw, 3rem)` | **1.06** | **−0.02em** | **800** | Saira |
| `.text-h2` | `clamp(1.5rem, 1.25rem + 1.2vw, 2.125rem)` | **1.14** | **−0.015em** | **800** | Saira |
| `.text-h3` | `clamp(1.25rem, 1.12rem + 0.6vw, 1.625rem)` | **1.2** | **−0.01em** | **700** | Saira |
| `.text-body-lg` | `1.0625rem` (17 px) | **1.65** | 0 | 400 | Barlow |
| `.text-base` | `1rem` (16 px) | **1.6** | 0 | 400 | Barlow |
| `.eyg-eyebrow` / `--text-eyebrow` | `0.75rem` (12 px) | `1rem` | **+0.16em** | **700** | Barlow |

`h1`–`h6` all resolve to `--font-display` and weight 800 (700 for `h3`) via
the base layer. `body` is `--font-sans` at `1rem` / `1.6`.

### 2.1 Resolved values at key viewports

| Class | 360 px (small Android) | 768 px (tablet) | 1280 px (laptop) |
| --- | --- | --- | --- |
| `text-display-1` | 2.94 rem ≈ **47 px** | 4.09 rem ≈ **65 px** | 5.5 rem = **88 px** |
| `text-display-2` | 2.44 rem ≈ **39 px** | 2.96 rem ≈ **47 px** | 3.75 rem = **60 px** |
| `text-h1` | 2.03 rem ≈ **32 px** | 2.48 rem ≈ **40 px** | 3 rem = **48 px** |
| `text-h2` | 1.62 rem ≈ **26 px** | 1.87 rem ≈ **30 px** | 2.125 rem = **34 px** |
| `text-h3` | 1.29 rem ≈ **21 px** | 1.46 rem ≈ **23 px** | 1.625 rem = **26 px** |
| `text-body-lg` | **17 px** | 17 px | 17 px |
| `text-base` | **16 px** | 16 px | 16 px |

---

## 3. Why the scale is shaped this way

### 3.1 The display steps are compressed (line-height < 1)

`display-1` at **0.92** and `display-2` at **0.96** are *tighter than the
typeface's own line spacing*. This is deliberate and it is the single most
identifiable thing about the system: Saira's caps are tall and flat, so a
normal leading would leave a dead band of air above and below, and the
display type would stop matching the **tight, low, wide** wordmark. Compressing
to 0.92 puts the visual top of the caps where the layout expects them.

**Consequence — a hard rule:** a compressed display step **must not be given
extra leading**. If it looks airy, reduce the margin, not the line-height.
And never set more than **two lines** at `display-1`.

### 3.2 Tracking tightens as size grows

| Step | Tracking | Why |
| --- | --- | --- |
| `display-1` (88 px) | −0.03em | At large optical sizes, negative tracking *adds* apparent tightness and stops the counters from opening up. Extended italic faces especially need it. |
| `h2` (34 px) | −0.015em | |
| `h3` (26 px) | −0.01em | Nearly neutral at this size. |
| `body` (16 px) | 0 | Never track body text. |
| `eyebrow` (12 px) | **+0.16em** | The only positive tracking in the system. Eyebrows are small uppercase labels; without tracking they read as a smudge. |

### 3.3 Weight is part of the size

Weight steps **down** as size steps down: `900` at `display-1/2`, `800` at
`h1/h2`, `700` at `h3`, `400` for body. A 700 heading at 88 px looks thin and
lost; a 900 body at 16 px turns to mud. The scale encodes this so nobody has
to think about it.

### 3.4 Fluid, mobile-first

The `clamp()` minimums are set at the **smallest realistic phone (360 px
viewport)** — the audience is on a mid-range Android on 3G, so the phone value
is the design's primary case, and desktop is the enhancement. The result: no
media-query breakpoints in the type system at all.

### 3.5 `text-wrap`

Set globally in `globals.css`:

- `h1, h2, h3, h4, h5, h6 { text-wrap: balance; }` — prevents an orphan word

  alone on the last line of a heading.

- `p, li { text-wrap: pretty; }` — prevents single-word last lines in body.
- `h1, h2 { overflow-wrap: break-word; }` — a long Filipino service name

  ("undercoating") cannot cause horizontal overflow at any viewport.

---

## 4. Hierarchy rules

1. **Exactly one `.text-display-1` per page.** It is the promise the page

   makes. Nothing competes with it.

2. **Never skip a level.** H3 → H5 breaks screen-reader navigation, which is

   the primary navigation mechanism for a non-sighted user on the booking flow.

3. **Never go below `.text-h3` in the display face.** Below ~26 px Saira's

   extended italic strokes start to close up and it stops being distinguishable
   from a condensed grotesque.

4. **Display type is upright on the website.** Saira italic exists in the

   family but the *website* uses upright — the italic is the logo's alone.
   Setting headings in italic Saira makes them look like a logo and dilutes
   the mark.

5. **Two lines maximum at `display-1`; three at `display-2`.** Longer copy

   belongs in `body-lg` under a shorter headline.

6. **Never all-caps a paragraph.** All-caps is for `.eyg-eyebrow` only.
7. **Body is never below 16 px**, and lead paragraphs use `body-lg` (17 px).
8. **Measure is capped at `--container-prose` (44 rem ≈ 65–70 characters).**
9. **Numerals are tabular** (`.tabular`) in every price, time, or quantity

   column. Proportional digits jitter as values change, and on a live booking
   slot list that jitter reads as a bug.

10. **`text-wrap: balance` is already on headings — do not add manual line

    breaks** to a heading, or the balance pass fights them.

---

## 5. Setting recipes

### 5.1 A service price

```text
   ₱1,200                        ← .text-h2 (Saira 800, 26–34px) + .tabular
                                   ← colour: ink-950 on white / white on ink
   PMS A · up to 4 hours         ← .text-base (Barlow 400, 16px)
                                   ← colour: --color-muted-foreground
```

- The peso sign is **attached** (`₱1,200`, no space) — this is a Philippine

  typographic norm.

- **Never** set a price in the display face below `text-h3`. A peso figure at

  16 px reads as a caption, not as a price.

- `.tabular` is **mandatory** in any list of prices.
- If a price is an **estimate**, say so in the same visual group — never in

  smaller type at the bottom of the card.

- A struck-through old price uses `--color-muted-foreground` with

  `line-through`; the live price uses the full-contrast colour. Never both in
  red.

### 5.2 A promo

```text
   PEAK SEASON TYRE CLEARANCE      ← .eyg-eyebrow  (Barlow 700, 12px, +0.16em)
                                    ← colour: brand-500 on ink-950   12.73:1 ✅
   4+4 on selected sizes           ← .text-display-2 (Saira 900, 39–60px)
                                    ← colour: white on ink-950
   Ends 30 November.               ← .text-body-lg (Barlow 400, 17px)
                                    ← colour: ink-300 on ink-950   7.80:1 ✅
   [ Claim offer ]                 ← primary CTA: brand-500 bg, ink-950 label,
                                      --shadow-cta
```

- **The eyebrow is yellow on ink** — this is the one place yellow is used as

  text, and it is the brand's most robust colour pair.

- `.eyg-hazard` may frame a **deadline** ("ends 30 November") as a 24 px strip

  — never as a background behind body text.

- A promo **without an end date is not a promo.** Never publish one.

### 5.3 A disclaimer

```text
   PRICE NOTE                      ← .eyg-eyebrow
                                     ← colour: --color-muted-foreground
   Prices are estimates for a standard passenger vehicle and may change
   after inspection. We confirm the final price with you before starting.
                                     ← .text-base (Barlow 400, 16px, lh 1.6)
                                     ← measure capped at 44rem
                                     ← colour: --color-muted-foreground  7.70:1 ✅
```

- Disclaimers are **never** smaller than `text-base`. Small print that is

  actually small print is not read and is not a disclaimer.

- Measure is capped at `--container-prose` (44 rem).
- An **eyebrow always precedes a disclaimer**, so the reader is warned before

  the text gets quiet.

- Never bury a disclaimer in a link. Never make it dismissible.
- Colour is `--color-muted-foreground` — still **7.70 : 1**, fully AA. Quiet

  is not the same as illegible.

---

## 6. Off-system typography (non-digital)

The same rules, converted for print, signage and embroidery.

| Application | Face | Setting |
| --- | --- | --- |
| **Signage / storefront** | Saira 900 (or Arial Black if Saira is unavailable) | Cap height ≥ 150 mm for the primary wordmark. Line-height 0.92. Tracking −0.02em. All caps. |
| **Service-bay board** | Saira 800 for headings; Barlow 700 caps for the service list | Heading cap ≥ 25 mm. List tracking +0.16em. Line spacing ≥ 1.4× cap. |
| **Uniform (front)** | Mark only. No type. | Left chest, mark ≥ 25 mm. |
| **Uniform (back)** | Saira 900 or Arial Black | Wordmark ≥ 180 mm across. Nothing under the wordmark except "Balanga's tyre & auto care pit stop." in Barlow 700 caps. |
| **Job card / receipt (80 mm thermal)** | Barlow 400 body, Barlow Mono for the reference | Minimum 7 pt. Never below 6 pt — the shop's own staff must be able to read it. |
| **Invoice / A5 job card** | Saira 800 for the header; Barlow 400 body | Header wordmark ≥ 40 mm. |
| **Business card** | Saira 900 | Name ≥ 9 pt, role ≥ 7 pt. |
| **Facebook / print posts** | Saira 900 headline; Barlow 700 caps eyebrow | See [APPLICATIONS.md](./APPLICATIONS.md). |

### 6.1 Off-system minimum sizes

| Content | Minimum |
| --- | --- |
| A5/A4 body | 9 pt |
| 80 mm thermal body | 7 pt (absolute floor 6 pt) |
| Small-print / disclaimer | 7 pt print / 16 px screen |
| Business-card name | 9 pt |
| Signage from a moving vehicle | Cap height ≥ 150 mm |
| Bay-board heading | Cap height ≥ 25 mm |

---

## 7. Accessibility notes

- **Body text is never below 16 px** — 16 px is the floor, not the target.

  The audience is on a mid-range Android, on 3G, in direct sun, one-handed.

- **Never** use Saira 900 below 20 px: the extended strokes close up.
- **Never** use `--color-brand-500` for text on a light background

  (**1.59 : 1**). Yellow text is only ever on ink, or ink text on yellow.

- **Muted text is `--color-muted-foreground`** (`#52525E`, 7.70 : 1 on white)

  or `--color-ink-300` (`#A0A0A9`, 7.80 : 1 on ink). Never step further down
  the ramp for "even quieter" text.

- **Never** disable the font-synthesis guard. A synthesised 900 is a faked

  weight; it breaks the display/wordmark relationship.

- **Zoom to 200 %** must not clip a heading. The fluid `clamp()` minimums and

  `overflow-wrap: break-word` on `h1`/`h2` guarantee this.

- **Underline links.** Do not rely on colour alone to mark a link inside body

  copy.

---

## 8. Do / Don't

### ✅ DO

- Use the **class**, never the pixel value.
- Use **Saira for anything that is a headline** and **Barlow for anything that

  is a sentence**.

- Keep `display-1` to one per page and to two lines.
- Pair every price column with `.tabular`.
- Use `.eyg-eyebrow` above a heading, in yellow on ink.
- Check every new colour pair against the tables in [COLOR.md](./COLOR.md).

### ❌ DON'T

- ❌ Set the wordmark as text in Saira. Use `public/brand/*.svg`.
- ❌ Use display type below 20 px.
- ❌ Set body below 16 px.
- ❌ Give a compressed display step extra leading to "fix" airiness.
- ❌ Use Saira italic for headings on the website — the italic is the logo's.
- ❌ Set a paragraph in all caps.
- ❌ Skip heading levels.
- ❌ Use two `.text-display-1` on one page.
- ❌ Use proportional digits in a price or time column.
- ❌ Put yellow text on white.
- ❌ Manually ` / ` a balanced heading.

---

## 9. Owner action items

| # | Item |
| --- | --- |
| 1 | **Identify the wordmark's original typeface** (see [LOGO-ASSETS.md §6](./LOGO-ASSETS.md)). If it is a commercial face, EYG needs a licence to use it in signage and merchandise. |
| 2 | Confirm **Saira** and **Barlow** are acceptable for all shop applications — both are open-licence (SIL OFL 1.1) and free for commercial use, including print and embedding. |
| 3 | Confirm the shop is comfortable with the **13° italic lean** carried from the logo into the display type. If not, the display face must be re-specified, not the logo. |
| 4 | If Saira is not available to the signwriter, the agreed fallback is **Arial Black** — it is already the tokenised fallback. Do not substitute anything else without re-checking the letterfit. |
