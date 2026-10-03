# APPLICATIONS — EYG TIRE & AUTO CARE

Version 1.0 · October 2026

Production specs. Every measurement is a spec, not a suggestion. All colours
are the tokens from `src/app/globals.css`; no hex is invented here.

## Global rules for every application below

1. Clear space is **`2x`**, where `x` = the cap height of the "E" in the lockup

   (68 source units → 136 units ≈ **29 % of the lockup width**).

2. The lockup is **never** reproduced below **240 px / 32 mm** wide. Below that,

   switch to `logo-wordmark.svg` or `logo-mark.svg`.

3. **Ink `#06060A` is the default field.** The logo is designed for it.
4. **Nothing is ever printed from the raster JPG.** Use the SVGs.
5. Every artefact that carries a claim is checked against the `TODO-VERIFY`

   list in `src/config/site.ts` before it goes to print.

---

## 1. Signage

### 1.1 Exterior fascia / pylon — primary

| Spec | Value |
| --- | --- |
| Field | `#06060A` painted steel or ACM panel, or `#06060A` vinyl on a `#17171D` substrate |
| Artwork | `logo-primary.svg` — **full lockup** |
| Lockup width | ≥ **900 mm** (fascia) / ≥ **600 mm** (pylon) |
| Min clear space | 2 × 250 mm |
| Phone number type | Saira 900 / Arial Black, **cap height ≥ 150 mm**, `#FCC605` |
| Services line | Barlow 700 caps, +0.16em tracking, `#FFFFFF`, cap height 60 mm |
| Speed stripe | Optional, at the base, `#FCC605`, full width of the panel |
| Materials | ACM (Alucobond), powder-coated mild steel, or channel letter with an acrylic face |
| Fabrication | **Fabricated, never printed.** A 3 m vinyl banner fades and tears. |
| Illumination | Only if the panel is back-lit; use 4000–5000 K to keep the yellow from going orange. Below 3500 K the yellow reads amber and the brand dies. |

### Layout of the fascia panel

```text
  ┌───────────────────────────────────────────────────────────┐
  │                                                           │
  │   ▓▓ EYG TIRE                        ┌──────────────┐    │ ← 2x clear space
  │     & AUTO CARE                      │              │    │
  │     ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂                 │  (phone)     │    │
  │                                    │  150mm caps   │    │
  │                                                           │
  └───────────────────────────────────────────────────────────┘
```

**On the phone number:** on any roadside signage, the phone number must be
**the largest type on the panel** — larger than the logo. The logo is
recognition; the number is the conversion.

### 1.2 Window vinyl

| Spec | Value |
| --- | --- |
| Artwork | `logo-primary.svg` or `logo-mark.svg` |
| Material | Cast vinyl, matte finish (gloss reflects and kills the yellow) |
| Colour | `#FCC605` + `#FFFFFF` on clear |
| Min lockup width | 320 mm |
| Eye level | Centre of the lockup at **1.4–1.6 m** from the floor |
| Hours on glass | Saira 700 caps, 80 mm cap height, `#FFFFFF`, with a 2 mm white keyline for legibility against the interior |

### 1.3 Bay door / bay number

| Spec | Value |
| --- | --- |
| Artwork | `logo-mark.svg` + bay number |
| Bay number type | Saira 900, cap height 250 mm, `#FCC605` |
| Plate | `#06060A` acrylic, 400 × 400 mm |
| Clear space | 2 × 100 mm |

### 1.4 Directional / A-frame

| Spec | Value |
| --- | --- |
| Artwork | `logo-primary-light.svg` or `logo-mono-black.svg` on a white/yellow A-frame |
| Board | 600 × 900 mm, 5 mm coroplast, `#FFFFFF` face |
| Headline | **Whatever the weather is doing right now**: "BAY FULL", "OPEN UNTIL 5 PM", "WALK-INS WELCOME" |
| Hazard hatch | Permitted here — this is the single most legitimate roadside use of `.eyg-hazard` |
| Wind | Weight the base. A sign that blows into the road is a liability. |

---

## 2. Uniform

| Piece | Artwork | Placement | Colour |
| --- | --- | --- | --- |
| **Front, left chest** | `logo-mark.svg` | Mark ≥ **25 mm** | `#FFFFFF` (`logo-mono-white.svg`) |
| **Back** | `logo-wordmark.svg` or mono wordmark | Width ≥ **180 mm** | `#FFFFFF` |
| **Back, under the wordmark** | "Balanga's tyre & auto care pit stop." | Barlow 700 caps, +0.16em, ≥ 20 mm cap | `#FFFFFF` at 70 % |
| **Sleeve** | `logo-mark.svg` | ≥ 20 mm | `#FFFFFF` |
| **Apron (bay staff)** | `logo-primary.svg` | Chest, ≥ 60 mm wide | `#FFFFFF` mono |

- **Embroidery must use the mono file only.** The lug holes and the tread

  wedges disappear entirely below ~30 mm and turn the mark to mush.

- Stitch colour for the yellow on a dark garment: use a **yellow thread**, not a

  printed substitute — screen yellow on fabric is dull.

- Do not put the wordmark on a high-visibility garment's reflective band. The

  retro-reflective material is for the road, not for the logo.

- **No name/role text under 12 mm cap height.**

---

## 3. Service-bay boards

### 3.1 The main board (behind the counter, 600 × 400 mm)

```text
  ┌────────────────────────────────────────────────────────────┐
  │  SERVICES                                                   │ ← eyebrow, yellow, 40mm cap
  │  ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂    │ ← speed stripe, fades right
  │                                                            │
  │   TYRES · WHEEL ALIGNMENT · BRAKES · SHOCKS · UNDERCOATING  │ ← Saira 800, 55mm cap
  │   CAR AIRCON · VULCANIZING · CVL & BUSHINGS · CHANGE OIL   │
  │                                                            │
  │   [          ]      Book a bay: eygtireautocare.ph          │ ← Barlow 400, 28mm cap
  └────────────────────────────────────────────────────────────┘
```

| Spec | Value |
| --- | --- |
| Field | `#06060A` |
| Board | 5 mm PVC foam or 6 mm ACM, printed CMYK + white overprint on black |
| Eyebrow | Saira 700 caps, +0.16em, `#FCC605`, 40 mm cap |
| Speed stripe | 20 mm tall, `#FCC605` → transparent, 90° gradient, right end chamfered 4 % |
| Service list | Saira 800 caps, `#FFFFFF`, 55 mm cap, line spacing 1.3 |
| URL | Barlow 400, `#A0A0A9`, 28 mm cap |
| Clear space | 2 × 55 mm |

### 3.2 The "bay closed" board

A separate, small board. **This is the one place the hazard hatch lives
permanently.**

| Spec | Value |
| --- | --- |
| Size | 300 × 200 mm |
| Field | `#17171D` with a 40 mm `.eyg-hazard` border (45°, 30 mm pitch) |
| Text | **"BAY CLOSED"** — Saira 900 caps, `#FFFFFF`, 60 mm cap |
| Sub-line | The reason, in words: "Cleaning up — back at 2 pm". Barlow 700, `#FFFFFF` |
| Word | **"BAY CLOSED"** — the hatch alone is not the message (colour/texture is never the sole signal) |

### 3.3 Price board

- Prices in **Saira 900 with tabular figures**, `#FCC605` on `#06060A`.
- **Every price has a "from" or a range.** `FROM ₱1,200` or `₱1,200–₱1,600`.
- Small print: *"Estimates for a standard passenger vehicle. We confirm the

  final price before work starts."* Barlow 400, ≥ 7 pt.

- **Never** show a price that is not in `content/` or `src/config/site.ts`.

---

## 4. Print collateral

### 4.1 A5 job card / estimate (148 × 210 mm)

| Element | Spec |
| --- | --- |
| Head | `logo-wordmark.svg`, ≥ 45 mm wide, ink on white |
| Address line | Barlow 400, 7.5 pt, `#52525E` — the exact NAP from `site.ts`, matching Google Business Profile |
| Ref number | Barlow Mono 600, 8 pt — `EYG-4F2A` format |
| Table | Barlow 400, 8.5 pt, **tabular figures** |
| Totals | Barlow 700, 10 pt |
| Disclaimer | Barlow 400, 7 pt, `#52525E`, max 3 lines |
| Paper | 100 gsm uncoated, or 120 gsm for a carbonless duplicate |
| Print | CMYK + black overprint. **Never** print `#06060A` as a 4-colour black — specify K100 + 60 C for the violet cast. |

### 4.2 80 mm thermal receipt

| Element | Spec |
| --- | --- |
| Width | 80 mm, monospace thermal |
| Head | `logo-wordmark.svg` reversed to white on black, 55 mm wide, **or** the wordmark as white type if the printer has no vector driver |
| Body | 7 pt minimum, 6 pt absolute floor |
| Ref | Barlow Mono, `EYG-` prefix |
| Footer | "Prices confirmed before work started." + a rebooking line |

### 4.3 Business card — 90 × 54 mm

**Front**: `#06060A` full bleed, a 4 mm `#FCC605` left edge bar, `logo-wordmark.svg`
reversed in white at 55 mm wide, positioned on the left two-thirds.

**Back**: white, and only:

```text
  [Name]                                  ← Saira 800, 9 pt, ink-950
  [Role]                                  ← Barlow 700 caps, +0.16em, 7 pt, ink-500
  ─────────────────────────────────
  [phone]  ·  [email]                     ← Barlow 400, 7 pt
  EGSA Fourlanes, Tuyo · Balanga City, Bataan 2100
```

- **No logo on the back** — one lockup per card face.
- **No claims, no ratings, no year count, no partner logos** until each is

  `TODO-VERIFY`-cleared.

- Stock: 350 gsm soft-touch, ink base. Ink base so the edge reads black, not

  white.

### 4.4 Invoice

Same as §4.1, A4, with the wordmark head ≥ 55 mm wide and the full NAP block.
Legal name exactly as in `site.ts`: **"EYG Tire & Auto Care"**.

---

## 5. Digital & social

### 5.1 Facebook cover — 820 × 312 px

```text
  ┌──────────────────────────────────────────────────────────────────┐
  │ ███ (4% checker, full bleed)                                    │
  │ ▌ ▓ EYG TIRE                    EGSA FOURLANES · TUYO            │
  │ ▌   & AUTO CARE                BALANGA CITY · BATAAN              │
  │ ▌   ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂                                            │
  └──────────────────────────────────────────────────────────────────┘
   ▌ = 16 px #FCC605 left edge bar, full height
```

| Spec | Value |
| --- | --- |
| Canvas | 820 × 312 px (display) / 1640 × 624 px (retina — **export at 2×**) |
| Field | `#06060A` |
| Texture | `.eyg-checker` at **4 %** opacity, 16 px tile |
| Left bar | 16 px, `#FCC605`, full height |
| Lockup | `logo-primary.svg`, **left-aligned, 3:1 vertical centre**, ≥ 240 px wide |
| Right text | Saira 700 caps, `#FFFFFF` + `#FCC605`, left-aligned to the right third |
| Address only | Never a phone number (it's covered by the profile image), never a promo |
| **Safe area** | Facebook overlays the profile picture bottom-left on mobile. Keep **400 px centred** clear of anything that must survive. Nothing important below y = 780 in the 820 × 1560 retina export. |

### 5.2 Facebook / Instagram profile

| Spec | Value |
| --- | --- |
| Artwork | `favicon.svg` or `logo-mark.svg` on `#06060A` |
| Export | 1024 × 1024 px minimum source (then let the platform downscale) |
| Safe zone | The 66 % centre circle — keep all meaningful content inside it |
| Never | The full lockup. It becomes a smear at 32 px. |

### 5.3 Post template — feed

Two exports: **1080 × 1080** (square) and **1080 × 1350** (4:5, taller, and
the one that actually wins reach).

```text
  ┌───────────────────────────┐  1080 × 1350
  │                           │
  │  ▂▂▂ (16px yellow top bar)│  ← optional, top edge
  │                           │
  │  TYRE CARE / SERVICE      │  Saira 700 caps, +0.16em, 48px, #FCC605
  │  Brake pads, front axle   │  Saira 900, 84px, #FFFFFF   ← max 3 lines
  │  ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂   │  ← speed stripe, 8px, fades right
  │                           │
  │  [      PHOTO      ]      │  1080 × 720 max, the real work
  │                           │
  │  Text on INK PLATE ONLY   │  Barlow 400, 34px, #A0A0A9
  │  never over the photo     │
  │                           │
  │  ┌─────────────────────┐  │
  │  │ Call / book a bay   │  │  primary CTA: #FCC605 bg, #06060A label
  │  └─────────────────────┘  │
  │                           │
  └───────────────────────────┘
```

| Spec | Value |
| --- | --- |
| Outer safe margin | **64 px** on every edge |
| Text safe margin | **96 px** |
| Eyebrow | Saira 700 caps, +0.16em, 48 px, `#FCC605` |
| Headline | Saira 900, 84 px, `#FFFFFF`, max 3 lines, `text-wrap: balance` |
| Body | Barlow 400, 34 px, `#A0A0A9` |
| Photo | The real work, shot per §6 of the main guidelines. **Never stock.** |
| CTA | `#FCC605` background, `#06060A` label, `--radius-eyebrow` (2 px) corners, min 96 px tall |
| Never | Text directly over a photo. Always on an ink plate at ≥ 90 % opacity. |
| Never | A price without a "from"/range, or a claim without sign-off |

### 5.4 Story / Reel cover — 1080 × 1920

Same template, taller. The bottom **250 px** is covered by the UI — keep it
empty. The top **180 px** is covered by the status bar — keep it empty.

### 5.5 Open Graph card — 1200 × 630

Shipped as `public/brand/logo-og.png`. Ink field, 4.5 % checker, 16 px yellow
left bar, full lockup at 1.34×, a speed-stripe divider, then
`BALANGA CITY · BATAAN` (yellow) and `EGSA FOURLANES · TUYO` (white). All type
is path geometry, so the render is identical on every machine.

### 5.6 Favicon / app icon

`favicon.svg` (1:1 ink tile, rim + 5-spoke hub), `apple-touch-icon.png`
(180 × 180), `src/app/icon.svg` (Next.js file convention). See
[LOGO-ASSETS.md §4](./LOGO-ASSETS.md) for why the tile is a simplification.

---

## 6. Google Business Profile

| Field | Spec |
| --- | --- |
| **Name** | `EYG Tire & Auto Care` — **exactly** the legal name from `site.ts`. **Never** keyword-stuff ("EYG Tire Auto Care Balanga Best Cheap"). Google penalises it and it looks desperate. |
| **Avatar / logo** | `favicon.svg` rendered at 512 × 512 |
| **Cover** | `logo-og.png`, cropped to 4:1 for the cover slot; keep the lockup in the left half |
| **Category** | The one the shop genuinely fits. Do not claim categories the shop does not operate. |
| **Address (NAP)** | `EGSA Fourlanes, Tuyo, Balanga City, Bataan 2100` — must be **character-identical** to the website, Facebook and every print piece. |
| **Hours** | Exactly `BUSINESS_HOURS`: **Monday–Saturday 8:00–17:00, Sunday closed.** No "24 hours". No "Open 24h" schema on the site either. |
| **Phone** | The confirmed `TODO-VERIFY` number, in `+63 …` E.164 for the link, displayed as the owner confirms. |
| **Description (750 char)** | The 150-word description from the main guidelines, trimmed. Services, road location, what the customer should do next. No unverifiable claims. |
| **Services list** | Only what the shop actually performs. Price **ranges**, labelled as estimates. |
| **Photos** | Real bay, real work, real team (with releases). Landscape 4:3 and square 1:1. Never stock. |
| **Posts** | Weekly minimum. Real work, named people, real prices. |
| **Q&A** | Answer every question. A price question left unanswered reads as "expensive". |
| **Never** | Claim "24 hours", "on-site service", "free pickup", or "authorised dealer" for any brand without documentation. |

---

## 7. Vehicle livery

| Spec | Value |
| --- | --- |
| Front doors | `logo-primary.svg`, ≥ 250 mm wide, `#06060A` panel with the lockup reversed |
| Rear panel | Wordmark, ≥ 500 mm |
| Yellow accent | A single `#FCC605` band along the lower body line, 60 mm, continuing the speed stripe's direction |
| Material | Cast vinyl, matte. **Never** a full-wrap gloss print — it turns `#FCC605` orange in sun and `#06060A` purple. |
| Legibility test | Stand 20 m away in daylight. Can you read the **wordmark** and the **phone number**? If not, it is too small. |
| Fleet | If more than one vehicle is wrapped, they are identical. Never two different lockup sizes on two vehicles. |

---

## 8. Environmental / wayfinding

| Item | Spec |
| --- | --- |
| Floor bay markings | `#FCC605` line, 50 mm wide, `#FFFFFF` bay number, 300 mm cap |
| "BAY FULL" board | See §3.2 |
| Directional to the bay | Saira 700 caps, `#FCC605` on `#06060A`, ≥ 40 mm cap |
| Wall graphics | `logo-mark.svg` at 400 mm, or a 6 % `.eyg-checker` field. **Never** the full lockup tiled. |
| Forecourt menu board | See §3.3 |
| Trolley / tool chest | `logo-mark.svg`, ≥ 80 mm, `logo-mono-white.svg` |

---

## 9. Owner action items

| # | Item | Blocks |
| --- | --- | --- |
| 1 | **The true vector logo original** | Everything in §1, §4, §5, §7 and §8. See [LOGO-ASSETS.md](./LOGO-ASSETS.md). |
| 2 | **Confirmed phone number** (`TODO-VERIFY`) | Every printed surface: fascia, A-frame, uniform, business card, receipt, vehicle, Google. |
| 3 | **Confirmed email + Messenger handle** (`TODO-VERIFY`) | Business card, website footer, receipt, Google. |
| 4 | **Authorised-dealer agreements**, if any, for the tyre brands listed in `BUSINESS.tireBrands` | Any "authorised dealer" strip or co-branded panel. |
| 5 | **Warranty terms, rating, years in business, bay count, technician count** (`TODO-VERIFY`) | Trust blocks on the website, signage, Google, receipts. |
| 6 | **Signage measurements** — bay width, door height, fascia run, sight lines from both carriageways of EGSA Fourlanes | §1 and §3. Signwriters cannot quote without them. |
| 7 | **The existing painted shutter colour**, if any | §3.1 and §8. New work must match what customers already see. |
| 8 | **A print vendor's stock and ink set** | Every Pantone reference in [COLOR.md](./COLOR.md) is "nearest / verify". The vendor's actual stock decides it. |
| 9 | **Signed customer photo releases**, stored on file | §5.3 and §5.4 — no face goes on a post without one. |
| 10 | **Trademark registration** for "EYG", "EYG Tire & Auto Care" and the wheel mark | Uniform, vehicle livery, merchandise, storefront registration. |
| 11 | **A local printer's proof** of `#FCC605` on the intended substrate | §1.2, §3.1, §8 — see the Pantone caveat. |
