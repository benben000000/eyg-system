# COLOUR — EYG TIRE & AUTO CARE

Version 1.0 · October 2026

> **The contract is `src/app/globals.css`.** Every hex below is a live token
> under `@theme`. If this document and `globals.css` disagree, `globals.css`
> wins. Never hardcode a hex in a component — use `bg-brand-500`,
> `text-ink-950`, `text-muted-foreground`, and so on.

---

## 1. How the brand colours were derived

| Colour | Provenance |
| --- | --- |
| **EYG Yellow `#FCC605`** | **Measured, not chosen.** The modal (most frequent) colour of the official 720 × 720 profile mark `brand/raw/eyg-profile.jpg`: **2.7 % of all pixels**, with a sampled range of `#987603` → `#FFE141`. The centre of that range is `#FCC605`. |
| **Ink `#06060A`** | The logo's backdrop as a design colour. The JPEG itself renders the field at `#2A2720` (69.5 % of pixels) because a 3D render's ambient light plus JPEG chroma subsampling lifts the blacks — **that is an artefact of the file, not a brand colour.** The brand ink is the cool near-black token. |
| **White `#FFFFFF`** | The wordmark's fill, measured from the raster's brightest cluster. |

Everything else — ink's ramp, the racing red and pit green ramps, the semantic
aliases — is a supporting system built around those three anchors.

---

## 2. EYLN YELLOW — the primary accent

`--color-brand-*`. One colour does three jobs: **primary action**, **accent /
highlight**, and **the speed-stripe**.

| Token | Hex | RGB | HSL | CMYK *(approx)* | Contrast vs `#FFFFFF` | Contrast vs `#06060A` |
| --- | --- | --- | --- | --- | --- | --- |
| `--color-brand-50` | `#FFFAEB` | 255, 250, 235 | 45° 100% 96% | 0 / 2 / 8 / 0 | **1.04** ❌ | **19.39** ✅ AAA |
| `--color-brand-100` | `#FFF1C2` | 255, 241, 194 | 46° 100% 88% | 0 / 5 / 24 / 0 | **1.13** ❌ | **17.93** ✅ AAA |
| `--color-brand-200` | `#FFE684` | 255, 230, 132 | 48° 100% 76% | 0 / 10 / 48 / 0 | **1.24** ❌ | **16.28** ✅ AAA |
| `--color-brand-300` | `#FFDC47` | 255, 220, 71 | 49° 100% 64% | 0 / 14 / 72 / 0 | **1.35** ❌ | **15.01** ✅ AAA |
| `--color-brand-400` | `#FFD11A` | 255, 209, 26 | 48° 100% 55% | 0 / 18 / 90 / 0 | **1.46** ❌ | **13.86** ✅ AAA |
| **`--color-brand-500`** ★ | **`#FCC605`** | **252, 198, 5** | **47° 98% 50%** | **0 / 21 / 98 / 1** | **1.59** ❌ | **12.73** ✅ AAA |
| `--color-brand-600` | `#D9A800` | 217, 168, 0 | 46° 100% 43% | 0 / 23 / 100 / 15 | **2.20** ❌ | **9.20** ✅ AAA |
| `--color-brand-700` | `#A67F00` | 166, 127, 0 | 46° 100% 33% | 0 / 23 / 100 / 35 | **3.71** ⚠️ | **5.45** ✅ AA |
| `--color-brand-800` | `#6D5300` | 109, 83, 0 | 46° 100% 21% | 0 / 24 / 100 / 57 | **7.27** ✅ AA | **2.78** ⚌ |
| `--color-brand-900` | `#3A2C00` | 58, 44, 0 | 46° 100% 11% | 0 / 24 / 100 / 77 | **13.63** ✅ AAA | **1.48** |

★ **The brand colour. Use `--color-brand-500` unless you have a specific
reason.**

### Pantone — nearest match

> #### NEAREST ONLY — VERIFY WITH A PHYSICAL SWATCH BEFORE ANY PRINT RUN
>
> These are computed approximations from the sRGB value, not a measured
> Pantone match. Screen-to-Pantone is a lossy conversion and Pantone solids are
> printed with pigments that shift again on uncoated stock.

| Hex | Pantone candidates (nearest, **unverified**) | Notes |
| --- | --- | --- |
| `#FCC605` | **PANTONE 116 C** · PANTONE 109 C | 116 C is the conventional "process/road yellow". Print **spot** if you must match exactly. |
| `#D9A800` | PANTONE 110 C · PANTONE 137 C | |
| `#A67F00` | PANTONE 1375 C | |
| `#FFD11A` | PANTONE 108 C | |

> **Recommendation:** for signage and merchandise, specify **Pantone 116 C**
> spot and print an actual swatch proof against a proof of the artwork before
> approving. For coated print, build the CMYK equivalent from a press
> calibration, not from this table.

### CMYK honesty note

The CMYK column above is a **naive arithmetic conversion with no ICC
transform**. Real CMYK depends on the substrate, the ink set, the press and a
profile. Treat it as a starting point for a designer's colour picker, never as
a press value. Convert with an FOGRA39 (coated) or GRACoL2006 (uncoated) profile
in the prepress application, and proof it.

### Where each yellow step is allowed

| Step | Use |
| --- | --- |
| `50`–`200` | Tints for hairlines, chart fills, subtle backgrounds on dark surfaces |
| `300` | Secondary end of the `.eyg-stripe` gradient |
| `400` | Hover tint on dark surfaces. **Never** to distinguish state from `500`. |
| **`500`** | **Primary.** Buttons, focus rings, accent, stripe, subline, rim, hub |
| `600` | Pressed/active, text on yellow, the `--shadow-cta` solid edge |
| `700` | The CTA's 6 px 3D edge, borders on yellow |
| `800` / `900` | Text on yellow tints; never used in the product UI |

### ⚠️ The one exception: logotypes

The `& AUTO CARE` subline is yellow (`#FCC605`). On
`logo-primary-light.svg` that is **1.59 : 1 against white** — a contrast
failure under WCAG 1.4.3.

**This is permitted and must not be "corrected".** WCAG 2.2 §1.4.3
(Logotype) explicitly exempts text that is *part of a logo or brand name*
from contrast minimums, because the brand mark is a fixed asset and altering
it would alter the identity.

**The exemption covers the logo only.** It does **not** extend to:

- ❌ yellow `--eyg-eyebrow` labels or headings on a white page,
- ❌ yellow link text,
- ❌ yellow price text,
- ❌ any yellow copy outside the artwork.

If you place `logo-primary-light.svg` on white, keep the white space around it
clear of yellow text.

---

## 3. INK — the primary dark

`--color-ink-*`. A cool, faintly violet near-black. Used for every dark surface,
all body text in light mode, and the logo's negative space.

| Token | Hex | RGB | HSL | CMYK *(approx)* | Contrast vs `#FFFFFF` | Contrast vs `#06060A` |
| --- | --- | --- | --- | --- | --- | --- |
| `--color-ink-50` | `#F6F6F7` | 246, 246, 247 | 240° 6% 97% | 0 / 0 / 0 / 3 | **1.08** ❌ | **18.73** ✅ AAA |
| `--color-ink-100` | `#E3E3E6` | 227, 227, 230 | 240° 6% 90% | 1 / 1 / 0 / 10 | **1.28** ❌ | **15.79** ✅ AAA |
| `--color-ink-200` | `#C7C7CD` | 199, 199, 205 | 240° 6% 79% | 3 / 3 / 0 / 20 | **1.68** ❌ | **12.02** ✅ AAA |
| `--color-ink-300` | `#A0A0A9` | 160, 160, 169 | 240° 5% 65% | 5 / 5 / 0 / 34 | **2.59** ❌ | **7.80** ✅ AAA |
| `--color-ink-400` | `#71717E` | 113, 113, 126 | 240° 5% 47% | 10 / 10 / 0 / 51 | **4.81** ✅ AA | **4.20** ✅ AA |
| `--color-ink-500` | `#52525E` | 82, 82, 94 | 240° 7% 35% | 13 / 13 / 0 / 63 | **7.70** ✅ AAA | **2.63** |
| `--color-ink-600` | `#3D3D47` | 61, 61, 71 | 240° 8% 26% | 14 / 14 / 0 / 72 | **10.73** ✅ AAA | **1.88** |
| `--color-ink-700` | `#2A2A32` | 42, 42, 50 | 240° 9% 18% | 16 / 16 / 0 / 80 | **14.23** ✅ AAA | **1.42** |
| `--color-ink-800` | `#17171D` | 23, 23, 29 | 240° 12% 10% | 21 / 21 / 0 / 89 | **17.85** ✅ AAA | **1.13** |
| `--color-ink-900` | `#0E0E12` | 14, 14, 18 | 240° 13% 6% | 22 / 22 / 0 / 93 | **19.26** ✅ AAA | **1.05** |
| **`--color-ink-950`** ★ | **`#06060A`** | **6, 6, 10** | **240° 25% 3%** | **40 / 40 / 0 / 96** | **20.23** ✅ AAA | — |

★ **The brand ink. `--color-ink-950` is `--color-foreground`, `--color-primary`
in light mode, `--color-surface-inverse`, the logo's negative space and the
site's dark background.**

### Pantone — nearest match (**unverified**)

| Hex | Nearest candidates |
| --- | --- |
| `#06060A` | **PANTONE Black 6 C** · PANTONE 432 C · (dry-process black) |
| `#17171D` | PANTONE 433 C · PANTONE Black 7 C |
| `#52525E` | PANTONE 7545 C |

> **Do not specify a Pantone black for the ink.** For large-format and vinyl,
> specify the hex/RGB and let the substrate define the result — a "black" ink
> on a sunny EGSA roadside in 34 °C heat is a different black from a Pantone
> book in an air-conditioned office.

### The violet cast

`#06060A` is **not neutral black** — it carries ~2 % blue-violet. This is
deliberate: it separates the brand's black from a printer's `K 100` black and
from every other shop's black on the road. Do not "correct" it to `#000000`.

---

## 4. RACING RED — urgent / error

`--color-racing-*`. **Never decorative.** Permitted uses: form errors, failed
payments, "bay closed", destructive actions, clearance *urgency* labels (with
the hazard hatch), and the `destructive` semantic alias.

| Token | Hex | RGB | HSL | CMYK *(approx)* | vs `#FFFFFF` | vs `#06060A` |
| --- | --- | --- | --- | --- | --- | --- |
| `--color-racing-50` | `#FEF2F2` | 254, 242, 242 | 0° 93% 94% | 0 / 2 / 2 / 0 | **1.03** ❌ | **20.4** ✅ AAA |
| `--color-racing-100` | `#FEE2E2` | 254, 226, 226 | 0° 93% 94% | 0 / 11 / 11 / 0 | **1.22** ❌ | **16.56** ✅ AAA |
| `--color-racing-200` | `#FECACA` | 254, 202, 202 | 0° 93% 79% | 0 / 21 / 21 / 0 | **1.52** ❌ | **13.9** ✅ AAA |
| `--color-racing-300` | `#FCA5A5` | 252, 165, 165 | 0° 93% 82% | 0 / 35 / 35 / 1 | **2.22** ❌ | **10.7** ✅ AAA |
| `--color-racing-400` | `#F87171` | 248, 113, 113 | 0° 94% 71% | 0 / 55 / 55 / 3 | **2.71** ❌ | **7.4** ✅ AA |
| `--color-racing-500` | `#EF4444` | 239, 68, 68 | 0° 84% 60% | 0 / 72 / 72 / 6 | **3.76** ⚠️ | **5.38** ✅ AA |
| **`--color-racing-600`** ★ | **`#DC2626`** | **220, 38, 38** | **0° 72% 51%** | **0 / 83 / 83 / 14** | **4.83** ✅ AA | **4.19** ✅ AA |
| `--color-racing-700` | `#B91C1C` | 185, 28, 28 | 0° 74% 42% | 0 / 85 / 85 / 27 | **6.47** ✅ AA | **3.13** ✅ |
| `--color-racing-800` | `#991B1B` | 153, 27, 27 | 0° 71% 35% | 0 / 82 / 82 / 40 | **8.26** ✅ AAA | **2.28** |
| `--color-racing-900` | `#7F1D1D` | 127, 29, 29 | 0° 62% 31% | 0 / 77 / 77 / 50 | **9.57** ✅ AAA | **1.76** |

★ **`--color-destructive` = `--color-racing-600`.** It is the *only* racing step
permitted for text and UI borders. `500` and lighter may only be used as a
surface or border, never as text on white (3.76 : 1 fails AA for body text).

**Pantone nearest (**unverified**): `#DC2626` → **PANTONE 199 C** · PANTONE
485 C. `#B91C1C` → PANTONE 200 C.

---

## 5. PIT GREEN — confirmed / open / success

`--color-pit-*`. "Pit lane green" — the flag side of motorsport. Permitted uses:
booking confirmed, slot held, "open now", payment received, check marks.

| Token | Hex | RGB | HSL | CMYK *(approx)* | vs `#FFFFFF` | vs `#06060A` |
| --- | --- | --- | --- | --- | --- | --- |
| `--color-pit-50` | `#F0FDF4` | 240, 253, 244 | 141° 84% 93% | 4 / 0 / 4 / 1 | **1.06** ❌ | **20.2** ✅ AAA |
| `--color-pit-100` | `#DCFCE7` | 220, 252, 231 | 141° 84% 93% | 13 / 0 / 8 / 1 | **1.10** ❌ | **18.42** ✅ AAA |
| `--color-pit-200` | `#BBF7D0` | 187, 247, 208 | 142° 84% 85% | 24 / 0 / 16 / 3 | **1.30** ❌ | **16.2** ✅ AAA |
| `--color-pit-300` | `#86EFAC` | 134, 239, 172 | 142° 77% 73% | 44 / 0 / 28 / 6 | **1.40** ❌ | **14.41** ✅ AAA |
| `--color-pit-400` | `#4ADE80` | 74, 222, 128 | 142° 71% 58% | 67 / 0 / 42 / 13 | **1.87** ❌ | **12.1** ✅ AAA |
| `--color-pit-500` | `#22C55E` | 34, 197, 94 | 142° 71% 45% | 83 / 0 / 52 / 23 | **2.28** ❌ | **8.88** ✅ AAA |
| **`--color-pit-600`** ★ | **`#16A34A`** | **22, 163, 74** | **142° 76% 36%** | **87 / 0 / 55 / 36** | **3.30** ⚠️ | **6.14** ✅ AA |
| `--color-pit-700` | `#15803D` | 21, 128, 61 | 142° 72% 29% | 84 / 0 / 52 / 50 | **5.02** ✅ AA | **4.03** ✅ AA |
| `--color-pit-800` | `#166534` | 22, 101, 52 | 145° 65% 24% | 78 / 0 / 49 / 60 | **8.14** ✅ AAA | **2.05** |
| `--color-pit-900` | `#14532D` | 20, 83, 45 | 145° 64% 20% | 76 / 0 / 46 / 67 | **9.77** ✅ AAA | **1.66** |

★ **`--color-success` = `--color-pit-600`.**

⚠️ **Important:** `--color-pit-600` on white is **3.30 : 1**. That passes AA for
large text (≥24 px, or ≥18.66 px bold) and for UI components, but **fails AA
for body text**. For green body text on a white background use
**`--color-pit-700` (5.02 : 1)**.

**Pantone nearest (**unverified**): `#16A34A` → PANTONE 349 C · PANTONE 361 C.
`#15803D` → PANTONE 349 C.

---

## 6. Colour-blind safety

Simulated with the **Machado, Oliveira & Fernandes (2009)** matrices at
severity 1.0 for protanopia (P), deuteranopia (D) and tritanopia (T). These
are approximations — every viewer is different — but they reliably show which
pairs collapse.

### 6.1 Simulation results

| Token | Original | Protanopia | Deuteranopia | Tritanopia |
| --- | --- | --- | --- | --- |
| `--color-brand-500` ★ | `#FCC605` | `#F6B900` | `#FFCC0A` | `#FFA58C` |
| `--color-brand-400` | `#FFD11A` | `#FDC410` | `#FFD51F` | `#FFB29A` |
| `--color-brand-300` | `#FFDC47` | `#FFD13F` | `#FFDF4B` | `#FFC3AF` |
| `--color-brand-600` | `#D9A800` | `#D29D00` | `#E0AE05` | `#FF8B75` |
| `--color-racing-600` ★ | `#DC2626` | `#423B25` | `#695924` | `#FF1827` |
| `--color-pit-600` ★ | `#16A34A` | `#A08A46` | `#83774E` | `#02A187` |
| `--color-ink-950` | `#06060A` | `#05060A` | `#05060A` | `#050707` |
| `--color-ink-300` | `#A0A0A9` | `#9EA1A9` | `#9EA0A9` | `#9EA1A3` |
| `--color-muted-foreground` | `#52525E` | `#50535F` | `#4F535E` | `#505456` |

### 6.2 Pair separation (Euclidean RGB distance under simulation, 0–441)

| Pair | Protanopia | **Deuteranopia** | Tritanopia | Verdict |
| --- | --- | --- | --- | --- |
| **`racing-600` vs `pit-600`** (error vs success) | 127 | **58** | 303 | 🔴 **FAIL.** Under deuteranopia the "error" red and the "success" green both become **muddy olive-brown**. Effectively the same colour. |
| `brand-500` vs `ink-950` (yellow on black) | 223 | **191** | 173 | 🟢 Strong. Colour is not the only thing carrying it. |
| `brand-500` vs `racing-600` | 223 | **191** | 173 | 🟢 Strong. |
| `brand-500` vs `pit-600` | — | **~211** | — | 🟢 Strong. |
| `brand-500` vs `brand-400` | 21 | **23** | 19 | 🔴 **FAIL.** Indistinguishable. |
| `brand-500` vs `brand-600` | 46 | **43** | 35 | 🔴 **FAIL.** Indistinguishable. |
| `ink-500` vs `ink-300` (two grey text steps) | 133 | **133** | 134 | 🟡 Adequate, but do not rely on it for meaning. |
| `ink-950` vs `ink-800` (two dark surfaces) | 31 | **31** | 30 | 🟡 Separation is a *surface* cue (elevation/border), not a hue cue. Add a border. |

### 6.3 The rules that follow

> ## RULE 1 — Colour is never the sole carrier of meaning
>
>
> Every state must also carry **an icon** and **a word**.
>
>
> ## RULE 2 — Error and success are never distinguished by hue alone
>
>
> Under deuteranopia, `#DC2626` and `#16A34A` are 58 units apart. Pair them with
> `alert-circle` vs `check-circle`, and with the words.
>
>
> ## RULE 3 — Never distinguish two yellow steps (300/400/500/600) with colour
>
>
> They are within 46 units of each other for a deuteranope. Use weight,
> size, position or a border. `--shadow-cta`'s 6 px `brand-700` edge, for
> instance, works because of its **shape**, not its hue.
>
>
> ## RULE 4 — Yellow-on-ink and ink-on-yellow are the brand's most robust pair
>
>
> 12.73 : 1 contrast and 191 units of colour separation under deuteranopia. This
> is why the logo, the focus ring and the primary CTA are built this way.
>
>
> ## RULE 5 — Status is never encoded in the yellow ramp at all
>
>
> Yellow means *EYG / action / speed*. It never means *success* or *error*.

---

## 7. Semantic roles

The semantic aliases map a role to a ramp step. Use the role in components,
never the ramp step.

### 7.1 Light theme (default)

| Role token | Maps to | Contrast note |
| --- | --- | --- |
| `--color-background` | `#FFFFFF` | |
| `--color-foreground` | `--color-ink-950` | 20.23 : 1 ✅ |
| `--color-surface` | `#FFFFFF` | |
| `--color-surface-muted` | `#F6F6F7` | 1.06 : 1 — a surface, not a text colour |
| `--color-surface-inverse` | `--color-ink-950` | |
| `--color-border` | `#E3E3E6` | 1.28 : 1 — decorative hairlines only; **not** a UI boundary that must meet 3 : 1 |
| `--color-border-strong` | `#C7C7CD` | 1.68 : 1 — still not 3 : 1; pair with ink for form boundaries |
| `--color-muted-foreground` | `#52525E` | **7.70 : 1** ✅ AAA — the light-theme body/muted text colour |
| `--color-ring` | `--color-brand-500` | focus ring |
| `--color-primary` | `--color-ink-950` | primary button in light mode |
| `--color-primary-foreground` | `#FFFFFF` | |
| `--color-accent` | `--color-brand-500` | accent surface |
| `--color-accent-foreground` | `--color-ink-950` | **12.73 : 1** ✅ |
| `--color-destructive` | `--color-racing-600` | **4.83 : 1** ✅ AA |
| `--color-destructive-foreground` | `#FFFFFF` | 4.83 : 1 ✅ AA |
| `--color-success` | `--color-pit-600` | 3.30 : 1 — **large text / UI only on white**; use `--color-pit-700` for body |

### 7.2 Dark theme (`data-theme="dark"` — EYG's primary mode)

| Role token | Maps to | Contrast vs `#06060A` |
| --- | --- | --- |
| `--color-background` | `--color-ink-950` `#06060A` | — |
| `--color-foreground` | `#FFFFFF` | **20.23 : 1** ✅ AAA |
| `--color-surface` | `--color-ink-900` `#0E0E12` | 1.05 : 1 — surface |
| `--color-surface-muted` | `--color-ink-800` `#17171D` | 1.13 : 1 — surface |
| `--color-surface-inverse` | `#FFFFFF` | |
| `--color-border` | `#2A2A32` | 1.42 : 1 — decorative |
| `--color-border-strong` | `#3D3D47` | 1.88 : 1 — decorative; pair with ink-300 text |
| `--color-muted-foreground` | `--color-ink-300` `#A0A0A9` | **7.80 : 1** ✅ AAA |
| `--color-primary` | `--color-brand-500` | **12.73 : 1** ✅ AAA |
| `--color-primary-foreground` | `--color-ink-950` | **12.73 : 1** ✅ AAA |
| `--color-accent` | `--color-brand-500` | 12.73 : 1 |
| `--color-accent-foreground` | `--color-ink-950` | 12.73 : 1 |
| `--color-shadow-plate` | `0 1px 2px rgb(0 0 0/0.5), 0 4px 14px rgb(0 0 0/0.4)` | pure-black shadows on ink |
| `--color-shadow-lift` | `0 2px 4px rgb(0 0 0/0.5), 0 12px 32px rgb(0 0 0/0.5)` | |
| `color-scheme` | `dark` | tells the browser to render native controls dark |

---

## 8. Application recipes

### 8.1 Buttons

| Button | Background | Text | Border | Shadow |
| --- | --- | --- | --- | --- |
| **Primary CTA** (dark theme) | `--color-brand-500` | `--color-ink-950` | none | `--shadow-cta` → `--shadow-cta-hover` |
| **Primary CTA** (light theme) | `--color-ink-950` | `#FFFFFF` | none | `--shadow-plate` |
| Secondary | transparent | current | `--color-border-strong` | none |
| Destructive | `--color-racing-600` | `#FFFFFF` | none | none |
| Disabled | `--color-surface-muted` | `--color-muted-foreground` | `--color-border` | none |

### 8.2 Surfaces

```text
ink-950 (page)  →  ink-900 (cards)  →  ink-800 (nested / muted)  →  brand-500 (accent)
```

On light: `#FFFFFF` (page) → `--color-surface-muted` (cards) → `--color-border`
(dividers).

### 8.3 The three motifs

```css
.eyg-stripe  /* 4px bar, 90deg #FCC605 → #FFDC47 → transparent,
                clip-path polygon(0 0,100% 0,96% 100%,0 100%), bottom -0.5rem */
.eyg-hazard  /* repeating-linear-gradient(-45deg, #FCC605 0 12px, transparent 12px 24px) */
.eyg-checker /* conic-gradient(#C7C7CD 25%, transparent 0 50%, #C7C7CD 0 75%, transparent 0)
                at background-size 16px 16px */
```

`.eyg-checker` is a four-quadrant conic tile, so every 16 px tile repeats with
the same orientation. It reads as a fine pinwheel / tread micro-texture, **not**
as a true alternating checkerboard. That is the implemented behaviour and this
document follows it.

---

## 9. Quick reference card

```text
  PRIMARY      brand-500   #FCC605   on ink-950 #06060A   12.73:1  AAA
  INK          ink-950     #06060A   on white  #FFFFFF    20.23:1  AAA
  BODY (lt)    ink-500     #52525E   on white  #FFFFFF     7.70:1  AAA
  BODY (dk)    ink-300     #A0A0A9   on ink-950 #06060A   7.80:1  AAA
  ERROR        racing-600  #DC2626   on white  #FFFFFF     4.83:1  AA
  SUCCESS      pit-600     #16A34A   on ink-950 #06060A   6.14:1  AA
  SUCCESS(lt)  pit-700     #15803D   on white  #FFFFFF     5.02:1  AA
  FOCUS        brand-500   #FCC605   3px solid, 2px offset, 2px radius

  NEVER: yellow text on white (1.59:1)
  NEVER: colour alone to carry meaning
```

---

## 10. Conversion & colour-science references

- WCAG 2.2 — relative luminance and contrast ratio:

  <https://www.w3.org/TR/WCAG22/#dfn-relative-luminance>

- Machado, Oliveira & Fernandes (2009), *A Physiologically-based Model for

  Simulation of Color Vision Deficiency*, IEEE TVCG 15(6).

- CIELAB / CIEDE2000 for measuring swatch distance — use a spectrophotometer,

  not a screen.

- **Pantone values in this document are computed approximations, not verified

  matches. Verify every one against a physical swatch before a print run.**

---

## 11. Owner action items

| # | Item |
| --- | --- |
| 1 | Supply the **official CMYK build and Pantone references** from the original logo designer. Every Pantone in this document is a computed approximation. |
| 2 | Confirm whether the EYG Yellow in the *original* artwork is a spot ink (most likely, given it was a 3D render) or a process build. |
| 3 | Approve **Pantone 116 C** as the print spot colour for signage/merchandise after a physical swatch proof. |
| 4 | Confirm the actual business colours used on any **existing painted signage or the current shutter** before reprinting, so new work matches what customers already see. |
