# DO NOT — EYG TIRE & AUTO CARE

Version 1.0 · October 2026

The violations list. Print this. Tape it above the shop's design desk.

Every item below has either already been seen go wrong, or is a foreseeable
failure given the pressures a small shop under time pressure actually operates
under.

---

## 1. The fifteen hard rules

### 1.1 Logo — never

| # | ❌ NEVER | ✅ INSTEAD |
| --- | --- | --- |
| 1 | **Colour the `EYG TIRE` wordmark yellow.** | It is **white**. Only the subline, the speed stripe, the rim ring and the hub are yellow. Yellow-on-yellow makes the two lines merge into one unreadable mass. |
| 2 | **Rename the brand.** Not "EYG Tyre", not "EYG Tires", not "E.Y.G.", not "EYG Tire Center". | It is **EYG Tire & Auto Care**. Exactly. |
| 3 | **Drop the ampersand**, or write "and". | It is `& AUTO CARE`, always with the ampersand. |
| 4 | **Stretch, squash, condense, or rotate the logo.** | Scale uniformly. Never angle it, never tilt it, never perspective it. |
| 5 | **Add effects** — drop shadow, bevel, glow, emboss, gradient fill, pattern fill, motion blur, 3D. | Flat colour. The supplied mark is a **3D render**; that look is an accident of lighting, not the identity. |
| 6 | **Reposition inside the lockup** — swap the subline above the wordmark, left-align the subline, centre it, move the speed stripe to the top, crop the stripe "to tidy up". | The subline sits **below**, right-aligned. The stripe sits **at the bottom**, tapering thin-left to thick-right. Always. |
| 7 | **Outline, box, circle or shield the logo.** | Clear space does that job. A border is a sign of insecurity. |
| 8 | **Use the primary lockup below 240 px / 32 mm.** | Switch to `logo-wordmark.svg` (≥ 170 px / 22 mm) or `logo-mark.svg` (≥ 40 px / 9 mm). |
| 9 | **Put it on a yellow, red, green, or photographic background without a solid ink plate.** | Ink plate at 100 % opacity with `2x` clear space, or crop the photo. |
| 10 | **Place the raster JPG on a light surface.** | Its baked field is a lifted `#2A2720`, and it will show as a grey rectangle. Use the SVG. |
| 11 | **Straighten the wheel.** | Its **+11.4° tilt** is the speed. |
| 12 | **Re-draw or re-space the letterforms.** | The extended italic and its 13° shear are the identity. The E's thin middle arm is deliberate. |
| 13 | **Use more than one EYG logo in a composition.** | One. |
| 14 | **Put the logo on a light background using the dark file** (or the reverse). | `logo-primary.svg` on ink. `logo-primary-light.svg` on white. |
| 15 | **Set "EYG Tire & Auto Care" as live text anywhere.** | Use the SVG. Saira is not the wordmark. |

### 1.2 Colour — never

| # | ❌ NEVER | ✅ INSTEAD |
| --- | --- | --- |
| 16 | **Set yellow text on white or any light surface.** `#FCC605` on white is **1.59 : 1** — it fails AA by a factor of three. | Yellow on ink (**12.73 : 1**), or ink on yellow. |
| 17 | **Carry meaning with colour alone** — error/success, open/closed, free/taken, selected/available. | **Colour + icon + word.** Always all three. Under deuteranopia, racing red and pit green are 58 RGB units apart: the same colour. |
| 18 | **Distinguish two yellow steps by colour** (300 vs 400 vs 500 vs 600 — all within 46 units for a deuteranope). | Use weight, size, position, or a border. |
| 19 | **Use racing red as decoration**, or the hazard hatch for anything that is not genuinely urgent. | Red is for errors and destructive actions. Hatch is for "closing soon", "bay full", "limited stock". |
| 20 | **Use the yellow ramp to signal status.** | Yellow means *EYG / action / speed*. Never *success*. Never *error*. |
| 21 | **Use yellow for a border or UI boundary on white** — 1.59 : 1 is below the 3 : 1 non-text minimum. | `--color-border-strong` or `ink-400`, or yellow on ink. |
| 22 | **Invent a hex.** | Use the token. If the value you want does not exist, that is a request to the orchestrator, not a hardcoded colour. |
| 23 | **Trust a Pantone value from this document for a print run.** | Every one is a computed approximation. **Verify with a physical swatch.** |
| 24 | **Correct `#06060A` to `#000000`.** | The violet cast is deliberate. It separates EYG's black from a printer's `K100` and from every other shop on the road. |

### 1.3 Type — never

| # | ❌ NEVER | ✅ INSTEAD |
| --- | --- | --- |
| 25 | **Set body text below 16 px.** | 16 px is the floor, not the target. |
| 26 | **Set display type below 20 px** (26 px for prices). | Extended Saira strokes close up and it stops reading. |
| 27 | **Give a compressed display step extra leading.** | `display-1` is 0.92 on purpose. Reduce the margin instead. |
| 28 | **Set website headings in Saira italic.** | Upright on the site. The italic belongs to the logo. |
| 29 | **Skip a heading level** (H3 → H5). | Screen-reader users navigate by heading level. |
| 30 | **Put two `.text-display-1` on one page.** | One. It is the promise the page makes. |
| 31 | **Use proportional digits in a price, time or quantity column.** | `.tabular`. |
| 32 | **Set a paragraph in all caps.** | `.eyg-eyebrow` only. |
| 33 | **Set a "disclaimer" smaller than body text.** | Small print that is actually small print is not read, and is not a disclaimer. |
| 34 | **Manually ` / ` a heading** to control the wrap. | `text-wrap: balance` is already on. |

### 1.4 Claims & content — never

| # | ❌ NEVER | ✅ INSTEAD |
| --- | --- | --- |
| 35 | **Publish a value still flagged `TODO-VERIFY`.** | Not on a poster, not on Facebook, not on a card, not on a receipt. Phone, email, coordinates, Messenger, warranty days, rating, years, bays, technicians, partner brands, handles. |
| 36 | **Claim "authorised dealer", "certified" or "licensed"** without a document. | Name the brands you stock, in plain text, as a factual statement. |
| 37 | **Invent a price, a rating, a review, a customer name or a quote.** | Publish a range, labelled as a range. |
| 38 | **Use stock photography as EYG's own work.** | Real bay, real tyres, real people. |
| 39 | **Publish a customer face without a signed release.** | Get the release, or blur the face before upload. |
| 40 | **Publish a number plate, full or partial.** | Blur or crop **before** upload, not in the caption. RA 10173 plus basic professionalism. |
| 41 | **Publish a child's face, name, or any identifying detail.** | If a child is unavoidably in frame, blur the face. |
| 42 | **Publish "Inquire for price".** | A range. |
| 43 | **Publish a promo with no end date.** | A deadline, or it is not a promo. |
| 44 | **Ship placeholder text.** | No `Lorem`, no `TODO`, no `example.com`, no `000-000-0000`, no `href="#"`, no dead `#`. |

### 1.5 Motion — never

| # | ❌ NEVER | ✅ INSTEAD |
| --- | --- | --- |
| 45 | **Animate the logo.** | It does not spin, slide, pulse, glow or draw itself in. Ever. |
| 46 | **Animate the phone number.** | It is the one element that must be perfectly still and perfectly findable. No pulse. No bounce. |
| 47 | **Animate `.eyg-stripe`, `.eyg-hazard` or `.eyg-checker`.** | Background-position animation on those is a strobe risk and looks cheap. |
| 48 | **Fade in body paragraphs on scroll.** | It delays reading and it is painful on 3G. |
| 49 | **Cause layout shift.** | **CLS = 0.** Always set explicit width and height on images; reserve space for anything late-loading. |
| 50 | **Autoplay video, GIF or Lottie.** | Poster frame only. |
| 51 | **Loop anything more than twice.** | A pulsing element becomes background noise and stops being read. |
| 52 | **Override `prefers-reduced-motion`.** | The global rule is unconditional. Every state must be legible with motion removed. |

### 1.6 Layout & interaction — never

| # | ❌ NEVER | ✅ INSTEAD |
| --- | --- | --- |
| 53 | **Block the page with a modal, a cookie wall, or an interstitial.** | It blocks the one action that matters. |
| 54 | **Let the mobile action bar be covered** by a toast, a modal, or a sticky element. | `--z-mobile-bar: 90` is the highest chrome value. |
| 55 | **Let a form fail silently.** | Every submit has pending, success and error states. |
| 56 | **Remove `:focus-visible` without a replacement.** | 3 px `#FCC605` outline, 2 px offset, 2 px radius. Non-negotiable. |
| 57 | **Make a tap target smaller than 24 × 24 px.** The phone target must be ≥ 44 × 44 px. | WCAG 2.2 AA. |
| 58 | **Use a `<div>` with a click handler.** | A real `<button>` or `<a>`. |
| 59 | **Serve a form that fails on a ₱3,000 Android over 3G.** | Mobile-first, thumb-reachable, fast. |

---

## 2. The failure catalogue — described precisely

These are the specific, recognisable ways EYG's identity gets broken. If you
see one on a competitor's board, you will recognise it.

**The yellow wordmark.** `EYG TIRE` in yellow over the yellow subline. Both
lines now sit at the same value and the lockup reads as one yellow smear. It is
the single most common error, and it is instantly recognisable as *not* EYG.

**The straightened wheel.** Someone "corrected" the wheel's tilt so it looks
tidy. Now it reads as a cartwheel or a lifebuoy, not a tyre in motion. The
tilt is not a mistake to be fixed.

**The chopped stripe.** Someone cropped the speed stripe at 80 % so it would fit
a banner. The stripe's whole job is to run out to the edge and fade — cut short,
it becomes a decorative underline.

**The recoloured wordmark on light.** `EYG TIRE` in `#06060A` but the subline
left yellow, on a white background. Now the subline is **1.59 : 1** — literally
invisible to anyone with low vision or a dim screen, and a WCAG AA failure.

**The stamp.** A logo pushed into a circular or rounded-rectangle badge with a
border, because "logos need frames". Now the clear space is gone and it looks
like a channel watermark.

**The busy-background logo.** The lockup placed over a photo of a tyre stack.
The white tyre outline disappears into a white highlight and the whole mark
lurches. Use a solid ink plate or crop the photo.

**The 24-hour shop.** "OPEN 24 HOURS · BEST PRICES · CERTIFIED TECHNICIANS" in
neon yellow across the shutter, with a rating that does not exist. Every claim
is `TODO-VERIFY`, and one of them is definitely false.

**The partner wall.** Michelin, Bridgestone, Goodyear, Dunlop, Maxxis and
Yokohama logos tiled across the shutter. Unless there is a written dealer
agreement for **each** one, that is a misrepresentation on a public street — and
it implies endorsement the shop does not have.

**The colour-only status.** A green dot for "open", a red dot for "closed", a
yellow dot for "busy", and no words. Under deuteranopia, the red and green are
the same colour. A red-green colour-blind driver reads "open" at 6 pm on a
closed shop.

**The animated phone number.** A CTA that pulses, bounces or shimmers to attract
attention. It reads as a scam banner and it is the one element the customer
needs to be able to hit without thinking.

**The speed-reading hero.** A five-paragraph intro, a stock garage photo, three
full-screen carousels, and the phone number below the fold. This page has no
conversion at all.

---

## 3. The pre-flight checklist

Run this before anything is published, printed, or posted.

### Logo

- [ ] It is one of the three permitted lockups (or the mark alone).
- [ ] Clear space is `2x` on all four sides — nothing intrudes.
- [ ] It is not below 240 px / 32 mm.
- [ ] It is `logo-primary.svg` on ink, `logo-primary-light.svg` on white.
- [ ] `EYG TIRE` is white (or ink on light). The subline is yellow.
- [ ] It is horizontal, undistorted, flat, with no shadow, bevel or outline.
- [ ] Only **one** EYG logo in the composition.

### Colour

- [ ] No yellow text on a light background.
- [ ] Every state has **colour + icon + word**.
- [ ] Body text is at least 4.5 : 1; large text and UI at least 3 : 1.
- [ ] Every hex used is a token, not a typed-in value.

### Type

- [ ] Display face only above 20 px; prices at 26 px or larger.
- [ ] Body at 16 px or larger.
- [ ] One `.text-display-1` per page; no skipped heading levels.
- [ ] Prices and times are `.tabular`.
- [ ] The wordmark is artwork, not text.

### Content

- [ ] Every value is cleared of `TODO-VERIFY`.
- [ ] Every claim is documented and honest.
- [ ] Every price is a range, or says "from".
- [ ] Every promo has an end date.
- [ ] Every photo is EYG's own work.
- [ ] Every face is released; every plate is blurred; no children's data.
- [ ] No `Lorem`, no `TODO`, no `000-000-0000`, no `href="#"`.

### Interaction

- [ ] The phone number is reachable within one thumb-reach on every viewport.
- [ ] Every form has pending, success and error states.
- [ ] The focus ring is visible and not suppressed.
- [ ] `prefers-reduced-motion` is respected and not overridden.
- [ ] No modal, cookie wall or interstitial.
- [ ] CLS = 0; every image has explicit dimensions.

### Print

- [ ] **Vector** file used, not the raster JPG.
- [ ] Pantone and CMYK values **verified against a physical swatch**.
- [ ] `2x` clear space is on the page, not just around the artwork.
- [ ] Outlined type (already the case in this pack — confirmed).
- [ ] CMYK profile matched to the substrate.
- [ ] Legibility test: read it from 20 m in daylight.

---

## 4. When in doubt

1. **Does it survive at the smallest size it will be seen at?** If not, it is

   too detailed. Simplify.

2. **Can a customer in a moving car act on it in three seconds?** If not, cut

   it.

3. **Is it true?** If it is not, it does not ship, regardless of how good it

   looks.

4. **Is it a token?** If you cannot point to the token, you are inventing.
5. **When you break a rule, write it down.** Tell the owner what you changed

   and why, and update this file.

---

## 6. NO GLOW — the rule that was broken and fixed

**Never use `blur-*`, `drop-shadow`, or a low-opacity coloured shape as
decoration.** EYG's mark is a hard-edged motorsport lockup: flat planes, 1px
borders, and the angle of the speed stripe. A blurred halo reads as a
consumer-app or SaaS-dashboard treatment and cheapens the identity.

What was removed, and what replaced it:

| Was | Now | Why |
| --- | --- | --- |
| `size-80 rounded-pill bg-brand-500/10 blur-3xl` | `h-px w-72 bg-gradient-to-r from-brand-500/50 to-transparent` | A hard speed bar reads as motion; a blur reads as nothing |
| `rounded-pill` (999px) on status chips and badges | `rounded-eyebrow` (2px) | `--radius-eyebrow: 2px` is the deliberate squareness rule and was being ignored |
| `bg-pit-500/15` / `bg-racing-500/15` status wash | solid `bg-brand-500` when open; flat `bg-ink-900` when closed | A 15% wash on near-black is a neon halo, and it made "closed" look like an emergency |
| `dark:bg-pit-900/40` on the contact panel | flat `dark:bg-ink-900` | Same reason |

**Colour discipline that follows from this:**

- **Brand yellow is for the state we want to advertise** — open, selected,
  the primary CTA. Nothing else.
- **Red is for errors only.** A closed shop is not an error. Reserving red means
  the eye is not trained to ignore it.
- **Success green is for confirmation**, never for ambient state.
- Never communicate state with opacity alone. Pair every colour with a **shape**
  (a flat square marker, a border weight, an icon) so it survives greyscale,
  colour-blindness and the monochrome receipt a customer takes home.

**Depth without glow:** use a flat background step, a 1px border, and the
`--shadow-plate` / `--shadow-lift` tokens — which are short, opaque and
low-opacity. Never a coloured blur.

---

- [BRAND-GUIDELINES.md](./BRAND-GUIDELINES.md) — the system
- [LOGO-ASSETS.md](./LOGO-ASSETS.md) — the asset pack and its provenance
- [COLOR.md](./COLOR.md) — conversions and colour-blind safety
- [TYPOGRAPHY.md](./TYPOGRAPHY.md) — the scale and setting recipes
- [VOICE-AND-TONE.md](./VOICE-AND-TONE.md) — what we say and what we never say
- [APPLICATIONS.md](./APPLICATIONS.md) — production specs
- [tokens.json](./tokens.json) — machine-readable tokens
