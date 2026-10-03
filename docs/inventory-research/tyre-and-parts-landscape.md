# TYRE & PARTS LANDSCAPE — a Balanga/Bataan tyre shop

### A1 research · compiled 2026-10-03 · all checks performed 2026-10-03 (Asia/Manila)

---

## 0. How to read this document

| Tag | Meaning |
| --- | --- |
| ✅ **VERIFIED** | Read directly off a primary source at the URL and date given. |
| 🟡 **SECONDARY** | Read off a credible but non-primary source (retailer, directory, press). Stated as that retailer/directory states it. |
| 🧠 **INFERRED** | My reasoning from verified facts. Not a claim about the world. |
| ❓ **UNVERIFIED** | I could not confirm it. **Do not print it, sell on it, or build on it.** |

**No number in this document is a price.** Prices live in `pricing-benchmarks.md`.
**No number in this document is a catalogue row.** The catalogue lives in `starter-catalogue.md`.

---

## 1. The service list the shop has actually confirmed

`src/config/site.ts` → `BUSINESS.confirmedServices`, sourced from the shop's own
Facebook page (`docs/research/facebook-intel.md` §5). These ten are the only
services with evidence behind them:

```
1. Preventive Maintenance Service
2. Change Oil
3. Brake Cleaning and Maintenance
4. Underchassis Maintenance and Repair
5. Wheel Alignment and Camber Correction
6. Wheel Balancing
7. Tire Mounting and Repair
8. Nitrogen Tire Inflation
9. Battery Replacement
10. OBD Scanning and Resetting
```

### 1.1 What each service *physically consumes*

This table is the bridge from the service list to a bill of materials, and it is
the single most important thing in this document for A2/A4. Every row is an
opinion about physical reality, not a research claim — mark it accordingly.

| # | Service | Parts it consumes | Parts that BLOCK the job if short | Parts that only WARN |
| --- | --- | --- | --- | --- |
| 1 | PMS | oil filter, engine oil (L), air filter, **drain-plug washer**, brake/parts cleaner, grease | oil filter, engine oil | air filter, drain-plug washer |
| 2 | Change Oil | engine oil (L), oil filter | engine oil, oil filter | — |
| 3 | Brake Cleaning & Maintenance | brake/parts cleaner (aerosol), brake fluid (top-up), grease | brake/parts cleaner | brake fluid |
| 4 | Underchassis Maintenance & Repair | — (labour + consumables only) | — | — |
| 5 | Wheel Alignment & Camber Correction | — (no consumable; alignment is labour + a machine) | — | — |
| 6 | Wheel Balancing | balancing weights (clips/weights), valve core | balancing weights | valve cores |
| 7 | Tire Mounting and Repair | valve (replacement), tyre sealant/patch, **spares** | valve, tyre repair kit | sealant |
| 8 | Nitrogen Tire Inflation | — (nitrogen is a gas the shop makes; **not inventory**) | — | — |
| 9 | Battery Replacement | battery (EA), **old-battery core return** | battery | terminal protector |
| 10 | OBD Scanning & Resetting | — (no consumable) | — | — |

> **🔴 Finding for A2/A4 — Nitrogen is not a stock item.**
> "Nitrogen Tire Inflation" is one of the ten confirmed services, and it is the
> single most tempting place to invent a fake `OIL`/gas SKU. Nitrogen is supplied
> from a compressor/cylinder on the premises, not from a SKU. **Do not create a
> nitrogen product.** If the shop later buys pre-filled cylinders wholesale, that
> is a `CONSUMABLE`, and only then.
>
> **🔴 Finding for A4 — Brake Cleaning is a CONSUMABLE job, not a BRAKE-parts job.**
> "Brake Cleaning and Maintenance" on a small tyre shop is overwhelmingly aerosol
> brake cleaner and a brake-fluid top-up. It is *not* the same booking as
> "Brake Pad Replacement". If the seed data has a single `brake-pad-replacement`
> service absorbing the brake-cleaning BOM, a customer who booked "Brake Cleaning"
> will consume a customer's worth of brake pads. Split them or set
> `qtyPerService: 0` on the pads.

> **🧠 Why `Underchassis Maintenance and Repair` has no parts row.**
> It is a labour-and-inspection service. Undercoating, rustproofing and
> underbody repair are *possible* expansions (the site-level legal doc flags them
> as unverified), but the confirmed Facebook text does not promise them. **No
> undercoating SKU until the owner signs the service list.** See
> `open-questions.md` Q-07.

### 1.2 What the services do **not** justify stocking

The single largest catalogue mistake available to this build is widening past the
confirmed service list. Explicitly **out of scope** until the owner confirms:

- Suspension (shocks, bushings, CVL) — no confirmed service consumes them
- Engine repair parts (pistons, belts, gaskets) — no confirmed service
- Air-conditioning (the site's own service content is unverified here)
- Glass, roadside, motorcycles
- Wheels/rims retail (a tyre shop *balances* wheels; it does not necessarily sell them)

🧠 A tyre shop that stocks 300 SKUs of unconfirmed parts has a worse reorder
signal than one that stocks 40 SKUs it sells weekly. `Product.isActive` exists;
default the unconfirmed range to inactive, or do not create it.

---

## 2. The Philippine car fleet → tyre size map

### 2.1 Fitment facts (verified)

| Vehicle | OE tyre size(s) | Source |
| --- | --- | --- |
| Toyota Vios 3rd gen 1.3 (NSP151) | `175/65R14`, `185/60R15` | wheel-size.com, page updated 2026-06-15 ✅ |
| Toyota Vios 3rd gen 1.5 (NSP151) | `175/65R14`, `185/60R15`, `195/50R16` | wheel-size.com, 2026-06-15 ✅ |
| Toyota Innova AG10 2.0 (2022+) | `205/65R16`, `215/60R17`, `225/50R18` | wheel-size.com, page updated 2026-06-11 ✅ |
| Toyota Innova 2016–2021 | `205/65R16`, `215/55R17` | size-tire.com ✅ |
| Toyota Innova 2008–2015 | `205/65R15` | size-tire.com ✅ |
| Toyota Hilux | `205/65R16`, `265/65R16`-class (varies by variant) | 🧠 INFERRED from the shop's own documented work on a Hilux FX (`facebook-intel.md` §2.7) + expressway.ph size index |
| Nissan Urvan / NV350 | `195/80R15`-class commercial; `215/60R16` on later | ❓ UNVERIFIED for the exact Urvan variant |

🧠 **The most decision-relevant fact about this fleet: Toyota owns an enormous
share of it, and Toyota fitments cluster on a handful of sizes.** The Toyota
filter fitments in §4.1 are dramatically narrower than the vehicle count would
suggest. A small shop can carry a small filter range and be right most of the time.

### 2.2 The top tyre sizes in the Philippine market

**Method note — read this before you use the ranking.** I did **not** find a
Philippine tyre-market size-share dataset with published numbers that I could
cite. The commercial reports I located (`6wresearch.com`, `indexbox.io`) either
sell the numbers or present them without a retrievable methodology. I have
**not** reproduced their figures.

What I *did* find is something better than a share statistic: **the size filter
inventory of a working Philippine tyre e-commerce operation.** TireDepot.ph
(TireDepot.ph, a Metro-Manila online tyre retailer, Shopify-backed) publishes its
complete in-stock size set with per-size prices. The frequency with which a size
appears in a live, stocked PH catalogue is a defensible proxy for volume, because
a retailer stocks what it sells.

**PH tyre size index** — `expressway.ph/tires`, published & updated by its named
author (Aditya Aman), page marked "© 2026", accessed 2026-10-03. 🟡 SECONDARY
(expressway.ph disclaims affiliation with any operator or agency). It publishes
its own ranked "Most Popular Tire Sizes", which is a *site* ranking, not a market
share:

```
expressway.ph ranked most-popular PH sizes (2026):
 1 185/65R15   2 185/60R15   3 195/65R15   4 195/55R16   5 205/55R16
 6 205/65R16   7 215/55R17   8 215/60R16   9 225/65R17  10 225/55R18
11 235/55R18  12 235/60R18  13 245/70R16  14 265/65R17  15 265/60R18
16 255/70R16  17 265/70R16  18 265/60R17
```

### 2.3 My ranked shortlist of ~15 sizes by likely volume in this catchment

**Method:** (a) which sizes appear in the live TireDepot.ph stocked catalogue,
(b) which sizes expressway.ph ranks, (c) which sizes the documented local fleet
actually wears. Confidence is stated per row. **This is an editorial ranking built
on visible evidence, not a published market-share figure — and it is wrong
somewhere. Treat it as a starting order for the first stock buy, not as a fact.**

| Rank | Size | Who wears it | Confidence | Evidence |
| --- | --- | --- | --- | --- |
| 1 | `185/65R15` | Toyota Avanza, Suzuki Swift Dzire, Honda Civic, Nissan Livina, Hyundai Accent, Mitsubishi Mirage | **High** | #1 on expressway.ph; stocked by 13 distinct pattern/brand lines on TireDepot.ph; 185/65R14 Deestone is *confirmed sold* by EYG's own tyre arm (`facebook-intel.md`) |
| 2 | `205/55R16` | Toyota Vios/Corolla 1.8 top trims, Honda Civic, Nissan Sentra, most modern sedans | **High** | #5 expressway.ph; 13 stocked lines on TireDepot.ph; Michelin Energy XM2+ in this size was the single most in-stock premium line I observed |
| 3 | `185/60R15` | **Toyota Vios** — the single most common car in PH | **High** | #2 expressway.ph; stocked lines incl. Yokohama BluEarth ES32 at ₱6,130 (partspro.ph), Bridgestone Ecopia EP300, Michelin Energy XM2+ |
| 4 | `205/65R16` | **Toyota Innova 2016+**, Toyota Rush, Mitsubishi Xpander (larger variants), Nissan X-Trail | **High** | #6 expressway.ph; confirmed OE for Innova AG10; stocked by 9 lines on TireDepot.ph |
| 5 | `195/65R15` | Nissan Sentra, Mazda 3, Ford Focus, Hyundai Elantra, Chevrolet Sail | **Medium-High** | #3 expressway.ph; stocked by 8 lines |
| 6 | `195/55R16` | Honda Civic FD/FB, Hyundai Accent, Toyota Corolla Altis 1.8, Nissan Almera | **Medium-High** | #4 expressway.ph; stocked by 6 lines |
| 7 | `215/60R16` | Mitsubishi Montero Sport, Isuzu D-Max, Toyota Fortuner (some), Nissan Patrol | **Medium** | #8 expressway.ph; stocked by 11 lines |
| 8 | `225/65R17` | Nissan X-Trail 2014+, Toyota Fortuner 2016+, Honda CR-V | **Medium** | #9 expressway.ph; stocked by 9 lines |
| 9 | `215/55R17` | Mitsubishi Montero Sport, Honda CR-V, Toyota Corolla Cross, Toyota Innova (some) | **Medium** | #7 expressway.ph; stocked by 9 lines |
| 10 | `205/55R15` | Toyota Innova 2008–2015, Toyota Waga-ish MPVs, Mitsubishi Adventure | **Medium** | expressway.ph index; stocked by 8 lines. 🧠 Note: legacy Innova owners are a *real* installed base in a provincial town |
| 11 | `185/65R14` | **Confirmed EYG stock.** Toyota Wigo/Swift, Hyundai i10, Nissan Tiida, Kia Picanto-era cars | **Medium** | EYG sold a Deestone 185/65-14 (`facebook-intel.md`). Deestone, CST, Maxxis, Linglong, Radar all list it on TireDepot.ph |
| 12 | `265/65R17` | **Confirmed EYG stock.** Radar Renegade R/T+ — Hilux/Fortuner/Patrol class, and a commercial/ride-hail fitment | **Medium** | EYG posted a Radar Renegade R/T+ 265/65R17 stock post 2024-09-22 with a product photo ✅ (`facebook-intel.md`). BFGoodrich lists 265/65R17 112H at ₱10,150 |
| 13 | `205/65R15` | Toyota Innova 2008–2015, Nissan Serena, Nissan Cefiro, Toyota Camry (older) | **Medium** | expressway.ph index; stocked by 9 lines; a Giti Van LT 205/65R16C and Van 600 LT 205/70R15C sit alongside (partspro.ph) for the same commercial crowd |
| 14 | `195/60R15` | Toyota Corolla Altis 1.8, Honda Accord, Mazda 2, Mitsubishi Lancer (older) | **Low-Medium** | expressway.ph index; stocked by 8 lines |
| 15 | `205/60R16` | Honda Civic, Toyota Altis hybrid, Nissan Sylphy | **Low-Medium** | expressway.ph index; stocked by 7 lines |

**Sizes a small shop should NOT stock even though they are "popular":**

| Size | Why not |
| --- | --- |
| `225/55R18`, `235/55R18`, `235/60R18`, `245/70R16` | 17–19" rim. Smallest price band observed ₱6,095–₱11,058 online (TireDepot.ph / partspro.ph). Capital is dead in a tyre sitting on a rack. Corolla-Altis-hybrid / Fortuner-top-trim buyers are a thin local market. |
| `11R22.5` | ✅ EYG *confirmed* selling this (Blacklion Mix, post 2024-09-10, marked SOLD). It is a **made-to-order / occasional** size, not a stocking size. Model it as a supplier-orderable item, not a shelf item. See `open-questions.md` Q-03. |
| `265/70R16`, `265/70R17`, `33×12.5R20` etc. | Off-road/light-truck. Band ₱7,380–₱22,843 online. `reorderQty: 0`, `reorderPoint: 0`, order on demand. |

### 2.4 The "set of 4 vs set of 5" problem — stated plainly

A small tyre shop in the Philippines overwhelmingly sells **1 or 2 tyres**, not 4.
Reasons:

1. **Cost.** `205/55R16` at ~₱6,315 (Michelin Energy XM2+, TireDepot.ph, 2026-10-03)
   means a set of four is ~₱25,000 of tyre alone. A provincial customer's car is
   usually worth less than that.
2. **The spare.** Most of this fleet's spares are **temporary space-savers or
   under-boot trays**, not full-size matchings. A Vios 3rd-gen spare does not
   make 5. There is no genuine "buy 5" SKU in this market.
3. **USTMA guidance is axle-paired, not set-paired.** The US Tire Manufacturers
   Association's *Tire Care & Safety* guide
   (`ustires.org/system/files/2025-09/Tire Care and Safety Guide.pdf`,
   accessed 2026-10-03) ✅ states: replace **two** at a time minimum, with the
   **two newer tyres on the rear axle**; if replacing one, pair it with the
   deepest-tread tyre and both go on the rear axle. It also states it is
   "recommended and preferred that all four tires be replaced at the same time"
   for optimal performance — as a recommendation, not a rule.

**🧠 Consequence for the schema (report to the orchestrator, do not work around it):**

`Product.unit` already has `EA | PAIR | SET`. **`EA` is the right default for
almost every tyre line in this catalogue**, with `qtyPerService` on a
"Tyre Mounting and Repair" BOM set to `1`. A `PAIR` line is only correct if the
shop genuinely bundles and prices a pair. A `SET` line is *almost certainly wrong
for this shop* and would corrupt every reservation arithmetic downstream.

Where a "set" is genuinely sold (bundle SKUs), model it as a **separate product**
with its own SKU and its own cost — do not model it as `qty: 4` of the single
tyre. Reason: the four tyres may come from **four different DOT lots**, and
`Product.dotCode` is a single value on the `Product` row. See
`dot-codes-and-shelf-life.md` §6 — this is the most important schema consequence
in this whole research package and it needs an orchestrator decision.

---

## 3. Engine oil — what is actually sold in the Philippines

### 3.1 Brands genuinely present in PH retail

✅ Verified as stocked by Philippine sellers I actually read price lists from:

| Brand | PH presence confirmed how | Prices I actually saw (2026-10-03) |
| --- | --- | --- |
| **PETRONAS Syntium** | ✅ **The shop's own choice.** `facebook-intel.md` records an EYG post of "Engine-oil retail — PETRONAS engine oil", 2026-05-02, with a product photo | ❌ **No PH price obtained.** `blade.ph` stocks Eneos/Mitasu/Motul/Castrol/Pertua, not Syntium. **UNVERIFIED** |
| **Motul** | blade.ph motor-oil collection ✅ | 1L: Multipower Plus 5W-40 ₱575 · Multipower Plus 10W-40 ₱575 · Multigrade Plus 10W-40 ₱389 · Multipower 15W-50 ₱499 · Specific CRDi 5W-40 ₱749 |
| **Castrol** | blade.ph ✅ | Magnatec Non-Stop Protection 10W-40 part-synthetic 1L ₱469 |
| **Shell Helix** | Shell PH sells the range (`shell.com.ph`, ✅ brand pages exist); gogulong.ph (a PH tyre retailer) states a **"6 years warranty from the date of manufacture"** and links to a Michelin-family warranty page | 🟡 Old (2023) distributor package prices seen on Scribd: HX7 5W-40 4L ₱2,075; HX5 15W-40 4L ₱1,690; HX3 4L ₱1,265; Helix Ultra D 5W-40CF 6L ₱5,380. **These are 3 years old and from an unverifiable document — DO NOT USE AS A PRICE.** |
| **Caltex Havoline** | `caltex.com.ph` product pages ✅ | ❌ **No PH price obtained.** A grey-import listing at pieza.ph showed Caltex Havoline ProDS Eco5 5W-30 4L at ₱12,241 — that is an import price, not a PH price |
| **Total** | ❌ Not observed in any PH seller I read | ❌ **UNVERIFIED** |
| **Eneos / Mitasu / Pertua / Zic / Repsol / Valvoline** | blade.ph ✅ — these are *real* PH-shelf brands and, for a shop buying on price, often the honest answer | Eneos Sustina 5W-30 1L ₱784 · Eneos Synthetic 10W-40 4L ₱1,999 · Eneos Pro Racing 5W-40 4L ₱2,799 · Mitasu MJ101 5W-30 1L ₱849 / 4L ₱2,899 · Mitasu MJ122 10W-40 1L ₱769 / 4L ₱2,699 · Pertua CVO 1L ₱299 / 4L ₱1,164 |

> **🔴 Honest gap, and the orchestrator must know about it.**
> **I could not obtain a current Philippine distributor or SRP price list for
> PETRONAS Syntium, Shell Helix, Caltex Havoline or Total.** Shell's PH product
> pages render no price to a fetcher; the brand sites publish technical data, not
> prices. Every oil figure in `starter-catalogue.md` is therefore
> **`SUGGESTED — REQUIRES OWNER CONFIRMATION`** and must be replaced with the
> owner's actual distributor invoice before launch. This is the single largest
> unverified block in the catalogue and it is item **Q-01** in `open-questions.md`.

### 3.2 Viscosity grades and pack sizes that matter

**🟡 SECONDARY — Caltex's own Philippine product page** (`caltex.com.ph/products/havoline-synthetic-blend-sae-5w-30.html`,
accessed 2026-10-03) states Havoline Synthetic Blend SAE 5W-30 is
**"Available in 1L and 4L"** ✅ as a fact about pack size in this market.

Grades observed across Philippine sellers, in rough order of how often they appear:

| Grade | Applies to | Notes for this shop |
| --- | --- | --- |
| `0W-20` / `0W-16` | Newer Japanese + Korean small engines | ❌ Thin locally. Hyundai Accent/Kona, some Toyota hybrids. Probably order-on-demand |
| `5W-30` | The modern default for most of this fleet | **The highest-volume grade. Stock it.** |
| `5W-40` | Honda/Toyota naturally-aspirated hot climates | **Second-highest. Stock it.** 5W-40 is the correct default for most of Bataan — hot, high-altitude-ish, stop-start traffic |
| `10W-40` | Older vehicles, most Filipino-brand blends, diesel | High volume in the *value* tier. Cheap insurance for a Vios 2008 |
| `15W-40` | Very old engines | ❌ Skip |
| `20W-50` | Ancient / heavily-worn engines | ❌ Skip. Selling this signals shoddy work |
| `20W-40` | Motorcycle oils (JASO MA) — **not car oil** | 🟡 Blade.ph's "Petron SAE 20W-40 Sprint 4T" is a *motorcycle* oil at ₱159/1L. Do not mix tiers in the catalogue. |

**Pack sizes observed in PH:**

| Pack | Observed where | Real? |
| --- | --- | --- |
| **1 L bottle** | Motul, Castrol, Eneos, Mitasu, Petron 4T — ✅ ubiquitous | ✅ Yes. The top-up unit |
| **4 L** | Caltex ✅ states it; Eneos, Mitasu, Shell — ✅ ubiquitous | ✅ Yes. The PMS unit |
| **5 L** | ✅ Common for PETRONAS Syntium in PH | ✅ Yes. ⚠️ The Philippine habit is to sell a "PMS" as 4L + a 1L top-up, or 5L. **Both must be representable.** |
| **6 L / 8 L / 10 L** | Shell Helix Ultra D 6L (diesel, 2023 doc); Ravenol coolant 5L | 🟡 Diesel-only in this fleet. Low priority |

> **🔴 Consequence for `UnitOfMeasure.LITRE` arithmetic.**
> A `Product` with `unit: "LITRE"` and a 4L bottle needs the pack volume as an
> attribute for the mechanic to know how much to put in the car. The schema has
> no `packSizeLitres` field. **Do not hack it into `notes`.** Report it —
> see `open-questions.md` **Q-02 (blocking for the BOM arithmetic)**.

### 3.3 Decanting — the practice and the risk

🧠 INFERRED, and it is a real risk, not a worry: a shop that does PMS will open a
4L can and decant into 1L bottles, because customers buy by the litre and the
job needs a known quantity. Decanted oil has a **different shelf life** from
sealed oil. See `dot-codes-and-shelf-life.md` §4 for the sourced figures and the
storage rules. The practical consequence for inventory:

- A decanted 1L bottle is a **different stock item** from the sealed 4L can, or
  at minimum needs an `openedAt` date. The schema has neither.
- **Do not model decants in v1.** Model sealed packs only, and let the mechanic
  record shrinkage via `SHRINK`. Then decide.

---

## 4. Filters — types, and the fitments that actually matter

### 4.1 Oil filters — verified PH retail prices

✅ All from **partspro.ph** (`partspro.ph`, an established Philippine online
auto-parts retailer, Shopify storefront, PHP currency confirmed in-page as
`Currency = "PHP"`, `CurrencyFormat = "₱ {{amount}} PHP"`), collection
`oil-filter-1`, accessed 2026-10-03. Prices are the retailer's own listed prices
and are **online retail, not trade price**.

| Fitment (verbatim from the retailer) | Listed price |
| --- | --- |
| Toyota Vios, Avanza 05-18, Yaris, Wigo 13-18, Corolla 1.3/1.6/1.8, Altis 01-10, Rav4 1.8/2.0 | **₱210** |
| Toyota Fortuner 2.5 D4D 2.7L, Hilux, Innova, Revo | **₱225** |
| Mitsubishi Mirage G4, Lancer 89-18, Galant, **Xpander** | **₱225** |
| Ford Ecosport, Fiesta 1.4/1.5/1.6, Focus 13- 1.6L | ₱225 |
| Toyota Camry 2.4, Previa, Rav4 2.4L | ₱225 |
| Honda Accord 2.4 VTi / 3.0 V6, CRV, City 1.3, Civic 05- 1.8L | **₱235** |
| Toyota Wigo 18-, Rush 18-, Alto, Celerio, Ciaz, Ertiga 16- | ₱245 |
| Suzuki Alto, Celerio, Ciaz, Ertiga | ₱220 |
| Mitsubishi Outlander, Space Gear, Grandis, Galant | ₱240 |
| Nissan Cefiro, Safari, Frontier, Maxima, Patrol, Terrano, Urvan 06-07 | ₱240 |
| **Hyundai** Santa Fe, Tucson, **Accent**, Elantra, Sonata, Matrix, Kia Rio/Forte/Optima/Carens/Soul/Sportage | **₱240** |
| Honda City 96-99, Civic 92-00, CR-Z, Jazz 1.3L | ₱240 |
| **Suzuki** Swift, Jimny, Grand Vitara 98-16, Samurai | ₱210 |
| **Toyota** Camry, FJ Cruiser, Fortuner, Hilux, Hiace, **Innova**, Land Cruiser, Yaris | **₱345** |
| Nissan Navara NP300, NV350 Urvan | ₱300 |
| Isuzu Mux, D-Max 18- 1.9L | ₱345 |
| **MG 3 / MG ZS 1.5** | **₱320** |
| Ford Ranger/Everest/Mazda BT-50 (2006-11 / 06-14) | ₱270 / ₱295 |
| ACDelco Oil Filter Ford Ranger 2.2/3.2L | ₱295 |

🟡 SECONDARY, and *very* useful for the Chinese-EV question: **the ACDelco line
at partspro.ph explicitly covers MG 3 / ZS 1.5 at ₱320.** PartsPro carries
filter fitments for the Chinese-brand cars, which means the local aftermarket
already treats MG as a mainstream fitment. That is a real, checkable signal, not
an assumption.

**The brand question — verified, and it matters:**

| Filter brand | PH evidence | Note |
| --- | --- | --- |
| **ACDelco** | ✅ partspro.ph, 55 oil-filter lines | The mainstream replacement-grade brand a Balanga shop can actually buy |
| **VIC** | ✅ partspro.ph: VIC C-809 (Honda Accord/CR-V/City/Jazz/Civic) **₱250**; VIC C-110 (Toyota Corolla 1.3/Altis/Vios 1.5/Echo/Rush) **₱250** | A genuine Philippine aftermarket-equivalent brand. Real, stocked, and the honest answer to "OEM-equivalent at a lower price" |
| **Toyota Genuine** | 🟡 Part numbers verified: `90915-YZZE1` (Vios Gen2/3/4, Corolla, Altis, Wigo, Avanza, Rush, Yaris) and `90915-YZZD1` (Camry, Tacoma, 4Runner, Highlander, Land Cruiser). An aftermarket listing of `90915-YZZE1` at partspro-adjacent sellers shows **₱130**; partspro.ph VIC C-110 (same fitment) is **₱250** | ⚠️ The ₱130 figure is from `meloautoparts.com` — a marketplace seller, not a parts wholesaler. Treat as a floor, not a price |

> **🧠 The filter decision the shop actually has to make.**
> Genuine Toyota at ₱130-ish versus VIC C-110 at ₱250 is a *price-band* story, not
> a like-for-like. Selling "Toyota Genuine" at a ₱250 retail when the same
> fitment sells as VIC at ₱250 retail destroys the entire reason a customer
> chose the OEM part. Either (a) stock VIC/ACDelco and sell it as the
> equivalent, honestly named, or (b) stock genuine and price it above VIC. **Do
> not list the genuine part number and price it at the equivalent's price.** That
> is both a margin error and an honesty problem. → `open-questions.md` **Q-04**.

### 4.2 Air filters

✅ partspro.ph: "ACDelco Air Filter for Toyota Fortuner 2015-, Hilux 2015-,
Innova 2016-" at **₱840**.

🧠 **This is the most expensive consumable in a PMS and the easiest one to get
wrong.** An air filter at ₱840 retail against a ₱210 oil filter changes the shape
of the PMS price. Most small PH shops do **not** stock air filters as fast-moving
lines; they order them. **Recommendation: stock the two most common (Innova/Hilux
class), `reorderQty: 0` on the rest.**

### 4.3 The filter shortlist a shop of this size needs

🧠 Six oil filters covers ~80% of this catchment. The set:

| # | Filter | Covers |
| --- | --- | --- |
| F1 | Toyota Vios/Corolla 1.3–1.8/Altis/Yaris (`90915-YZZE1` equiv) | Vios, Corolla, Altis, Yaris, Wigo, Avanza, Rush |
| F2 | Toyota Camry/Fortuner/Hilux/Hiace/Innova/Land Cruiser | The Innova/Hilux crowd — EYG's own documented vehicles |
| F3 | Honda Civic/City/Accord/CR-V | Honda Civic is a named local vehicle |
| F4 | Mitsubishi Mirage G4/Lancer/Galant/**Xpander** | Xpander is a named local vehicle |
| F5 | Hyundai Accent/Elantra/Santa Fe | Accent is a named local vehicle |
| F6 | Suzuki Swift/Jimny/Ertiga/Celerio | Ertiga is a named local vehicle |

Nissan Navara NP300 + Urvan NV350 filters, and the Isuzu D-Max filter, are the
right **next three** if the owner says pickups and vans are common on EGSA.

---

## 5. Brakes

✅ All partspro.ph, collection `brake-pads`, accessed 2026-10-03. Online retail.

### 5.1 Brake pads — the real price ladder

| Product | Retail |
| --- | --- |
| **ICER** Front, Toyota Vios Gen3 1.3 (182180) | **₱1,200** (was ₱2,200) |
| **ICER** Front, Toyota Vios Gen3 1.5 (181898) | **₱1,200** (was ₱2,250) |
| ICER Rear, Toyota Altis/Vios (181899) | ₱1,200 |
| ICER Front, Suzuki Vitara / Mitsubishi Xpander (182175) | ₱1,200 |
| ICER Front, Hyundai Accent/Reina (182035) | ₱1,200 |
| ICER Front, Nissan Navara NP300/Terra (182249) | ₱1,200 |
| ICER Front, Toyota Hilux/Fortuner/Innova (182252) | ₱2,600 |
| ICER Front, Isuzu D-Max/MUX / Chevrolet Trailblazer | ₱2,750 |
| **Hi-Q** Front, Toyota Corolla Altis/Vios (SP1232) | **₱1,225** |
| Hi-Q Rear, Toyota Altis/Vios (SP2094) | ₱1,190 |
| Hi-Q Front, Toyota Avanza/Suzuki APV (SP1589) | ₱1,240 |
| Hi-Q Front, Toyota Hi-Lux Vigo/Innova (SP1276) | ₱1,295 |
| Hi-Q Front, Toyota Innova E/V (SP4264) | ₱1,675 |
| Hi-Q Front, **Mitsubishi Xpander 2018-** (SP4360) | **₱1,730** |
| Hi-Q Front, Honda City/CR-Z/Jazz/Mobilio (SP1463) | ₱1,815 |
| Hi-Q Front, **Suzuki Ertiga** (SP4425) | ₱1,975 |
| Hi-Q Front, Nissan Urvan/NV350 (SP1447) | ₱1,620 |
| **Brembo** Front Ceramic, Toyota Vios 1.5 (P83101N) | **₱2,035** |
| Brembo Front, Toyota Vios 1.3 (P83165N) | ₱2,640 |
| Brembo Front, Toyota Hilux 2015- (P83167N) | ₱2,915 |
| Brembo Rear Ceramic, Toyota Vios 1.5 (P83133N) | ₱2,255 |
| Brembo Front Ceramic, Mitsubishi Xpander/Livina (P79032N) | ₱2,065 |

🟢 **This is the single most useful price ladder in the whole document.** It is a
real three-tier structure and it maps cleanly onto a shop's counter:

| Tier | Brand | Band | Who asks for it |
| --- | --- | --- | --- |
| **Value** | ICER, Hi-Q | ₱1,190 – ₱2,000 | The Vios, Ertiga, Accent crowd. Price-shoppers. **This is the volume tier.** |
| **Mid** | Hi-Q+ | ₱1,800 – ₱2,600 | The Innova / Xpander crowd |
| **Premium** | Brembo / ACDelco | ₱2,035 – ₱53,250 | The Civic / Type-R crowd, and anyone who asks by brand |

> **🔴 Warning about the ICER discount.** ICER Vios pads at partspro.ph are
> listed at ₱1,200 against a ₱2,200 "was" price — a **45% markdown**. A price
> scraped from a discounted online listing is a **promotional price, not a shelf
> price.** A Balanga shop cannot buy at that and sell at that. See
> `pricing-benchmarks.md` §6. Do not put ₱1,200 in the catalogue as a sell price
> without the owner confirming what he actually pays.

### 5.2 Brake discs / rotors

| Product | Retail |
| --- | --- |
| Hi-Q Rear Rotor, Corolla Altis/Prius/Celica 07-14 (SD4060) | ₱1,335 |
| Hi-Q Front Rotor, Nissan Sentra 1.6 92-95 (SD4268) | ₱1,800 |
| Hi-Q Front Rotor, **Toyota Avanza 2006-** (SD4632) | **₱1,885** |
| Hi-Q Front Rotor, **Toyota Vios 1.3 '08-13** (SD4003) | **₱1,925** |
| Hi-Q Front Rotor, Ford Ranger Wildtrak T6 / Mazda BT-50 (SD5336) | ₱4,280 |
| Hi-Q Front Rotor, Camry/Alphard/Estima/Lexus ES350 (SD4021) | ₱2,905 |
| Brembo Front Rotor, Toyota Hilux 2015- | ₱11,000 |
| Brembo Front Rotor, Mazda 3 | ₱11,550 |
| Brembo Front Rotor, Toyota Land Cruiser 200 | ₱15,950 – ₱25,300 |

🧠 **Rotors are the capital trap in the parts catalogue.** A Brembo rotor at
₱11,000–₱25,300 is more than the tyre on the car. A shop of this size stocks
**Hi-Q rotors for the Vios and Avanza only** and orders everything else.

🧠 **Rotors are also the clearest "set" product in the whole shop.** Nobody buys
one rotor. Front rotors are sold **as an axle pair** — `unit: "PAIR"` is
genuinely correct here, and probably only here.

### 5.3 Brake fluid

| Product | Retail |
| --- | --- |
| Pro-99 DOT 5.1, 1 L | ₱789 |
| AMSOIL DOT 3 & 4, 12 oz | ₱860 |
| Liqui Moly DOT 4, 250 ml | ₱960 |
| Ravenol DOT 4 LV, 1 L | ₱1,380 |
| Ravenol DOT 4, 1 L | ₱1,400 |
| Ravenol DOT 5.1, 1 L | ₱1,820 |
| Ravenol R325+ racing DOT 4, 500 ml | ₱2,600 |

🧠 **DOT 3/4, not DOT 5.1, is the volume line in this fleet.** DOT 5.1 is a
performance silicone fluid that is **damaging if mixed with DOT 3/4** and is not
required by any vehicle in this shortlist. Stock DOT 4. Keep DOT 5.1 as
order-on-demand or not at all. A shop that stocks both must physically separate
them and label the shelf — **that is a safety issue, not a UX issue.**

---

## 6. Wipers

✅ All partspro.ph, accessed 2026-10-03:

| Product | Retail |
| --- | --- |
| NWB Design Wiper Blade **18"** | **₱1,090** |
| PIAA Silicone Rear Rubber Wiper RS 16" | ₱1,165 |
| PIAA Silicone Rear Rubber Wiper RL 16" | ₱1,165 |
| PIAA Silicone Wiper Super Silicone 26" | ₱1,265 |
| PIAA Silicone Aero Vogue Flex 17" | ₱1,293 |
| PIAA Silicone Aero Vogue Flex 19" | ₱1,293 |
| PIAA Silicone Aero Vogue Flex 20" | ₱1,414 |
| PIAA Silicone Aero Vogue Flex 24" | ₱1,551 |

🧡 **"18 inch" is an inch, and the local fleet's most common wiper size is
16"–19".** Philippine wiper sizes are conventionally sold in inches even though
every metric car in the country is metric. A3's tyre-size finder needs a **wiper
finder** too, or a clear note that wiper sizing is in inches.

The wiper brands visible in PH retail are **NWB, PIAA, and (from Lazada listings)
Bosch, Trico, Aerowiper.** ❓ Which of these the shop actually buys and at what
trade price is **UNVERIFIED**.

🧠 **Rear wipers are the sellable line.** Most Philippine hatchbacks and MPVs
(Ertiga, Innova, Xpander, Staria) have rear wipers; most sedans do not. A shop
that stocks front wipers only will be told "no rear wiper" roughly as often as it
gets a front-wiper sale.

---

## 7. Batteries — group sizes actually sold in the Philippines

### 7.1 Official prices (verified, brand-owned)

✅ **Motolite** (motolite.com, the brand's own Shopify storefront, accessed
2026-10-03). Motolite is manufactured in the Philippines by Philippine Batteries
Inc. ✅ (stated on the same page).

| Line | Official listed price |
| --- | --- |
| Motolite Champion PM | **₱4,020** |
| Motolite Enduro | **₱4,740** |
| Motolite LM Enforcer | ₱4,380 |
| Motolite TruckMaster | ₱5,520 |
| Motolite Excel | ₱5,850 |
| Motolite Gold | ₱5,980 |
| Motolite Excel EFB | ₱8,090 |
| Motolite Excel AGM | ₱16,690 |

> ⚠️ **Internally inconsistent on Motolite's own site.** The collections page
> lists Motolite Excel AGM at **₱16,690**; the individual product page
> (`motolite.com/products/motolite-excel-agm`) shows **₱21,200**. Both were read
> on 2026-10-03. **Do not quote an AGM price from this source.** → open question.

✅ **Amaron** (amaron-ph.com, the brand's own site, accessed 2026-10-03;
exclusive PH distribution by Pollux Distributors Inc. ✅ per the same site). Amaron
publishes **ranges**, not per-group prices:

| Line | Official price range |
| --- | --- |
| Amaron GO | **₱3,900 – ₱6,200** |
| Amaron FLO | ₱5,200 – ₱7,400 |
| Amaron PRO | ₱6,100 – ₱10,400 |
| Amaron DURO | ₱6,600 – ₱6,900 |
| Amaron HIWAY | ₱8,100 – ₱13,400 |
| **Amaron JADE** (AGM) | **₱9,500 – ₱14,900** |

🟡 SECONDARY — partspro.ph lists "ACDelco Battery **AGM DIN80 / BCI 94R / DIN
H7 / L4 / AGM80L4**" at **₱24,975** (accessed 2026-10-03). This is an online
retail price roughly **2.5× the top of Amaron's official AGM range**, which is
strong evidence it is an import/grey price and not what a Balanga shop pays.

🟡 SECONDARY — CarCarePH's guide (`carcareph.com/guides/auto-parts/car-battery-price-philippines/`,
dated 2026-06-03) gives broad bands: standard lead-acid ₱2,500–₱4,500; AGM
₱5,000–₱8,500; overall ₱2,500–₱8,500. **A content-marketing guide, not a
distributor list.** Its band is *below* Amaron's official range, which is itself
evidence that street pricing in PH runs below the brand's own site.

### 7.2 The group sizes that matter

🧠 **The battery group size is a fitment lookup, and getting it wrong destroys the
battery.** For this fleet the working set is:

| Group size (JIS/DIN/BCI) | Typical fitment |
| --- | --- |
| `NS40` / `DIN 55B24L` | Toyota Vios, Honda City, Hyundai Accent, most small sedans |
| `55D23L` / `DIN 60` | Toyota Corolla Altis, Honda Civic, Nissan Sentra |
| `70B26L` / `DIN 65` / `N50` | Mitsubishi Xpander, Toyota Rush, larger MPVs |
| **`DIN 80` / `BCI 94R` / `H7` / `L4` / `AGM80L4`** | **Hyundai Staria, larger MPVs, start-stop vehicles. ✅ EYG's own documented install** |
| `3SM` / `N70` | Nissan Navara NP300, Isuzu D-Max, Toyota Hilux — light commercial |
| Commercial / truck groups | The `11R22.5` crowd — a different supplier entirely |

> **🔴 `DIN 80` is confirmed.** `facebook-intel.md` records an "Amaron Jade AGM
> **DIN80** battery installation — Hyundai Staria" on a Hyundai Staria, post
> 2026-08-07, with an install photo. The exact battery EYG installed is a
> documented, evidenced fact. That is the single best anchor for the battery
> catalogue. → `open-questions.md` **Q-05**.

### 7.3 🔴 The core-return credit — a margin item nobody budgets for

✅ **Amaron Philippines, first-party, `amaron-ph.com/tips-for-buying-batteries`,
accessed 2026-10-03**, verbatim:

> *"Consider the old battery disposal. Make the environmentally-conscious
> decision to deposit your used battery with an authorized local dealer,
> manufacturer, or a certified recycler at designated collection centres. What's
> even better is that you can receive compensation for your efforts as a
> responsible citizen! **Your dealer will either provide you with a financial
> reward for the old battery or subtract the corresponding amount from the cost of
> a new battery purchase.**"*

This is a **core deposit / trade-in**, and it means:

1. **A battery's true cost is `purchase − core credit`.** A shop that budgets
   `costPrice` at the invoice price understates its real margin.
2. **The core credit is cash the shop holds and must return.** It is not revenue.
3. **The schema has no field for a core credit.** `costPrice Int @default(0)`.
   Setting `costPrice` to the *net* figure is the only thing available, and it
   silently changes the meaning of the number. **Report it** —
   see `open-questions.md` **Q-06**.

### 7.4 The warranty — what a claim actually requires

✅ **Amaron Philippines, first-party, same page**, verbatim:

> *"Make sure to keep the **Warranty Card and a copy of the sales receipt**. These
> will be very helpful to speed up warranty claims..."*
> *"Make sure to ask the shop keeper how long is the full replacement warranty
> period. **The warranty period for Private use and Commercial use are
> different.**"*

✅ **Motolite**, first-party (`motolite.com/pages/automotive-battery` and
`/pages/e-warranty`, accessed 2026-10-03): warranties exist "that covers factory
defects for a specific period", registered in the RES-Q app by **serial number or
plate number**. ❓ **The specific month counts for both brands are not published on
either brand's public site.** I will not guess them.

**🧠 The operational consequence, and it is load-bearing:** *a battery warranty
claim is a document-matching exercise between what the shop gave the customer and
what the distributor wants.* That means:

- The **invoice is the warranty**. It is not paperwork — it is the product.
- If the shop sells a battery over Messenger and hand-writes a receipt, **the
  warranty is only as good as that receipt.**
- The serial/plate number must be captured at sale and filed.
- **This is why the inventory system needs the invoice reference at the moment of
  sale**, not reconstructed later.

---

## 8. Tyre accessories

| Item | PH evidence | Real? |
| --- | --- | --- |
| **Valve caps** | ✅ partspro.ph: ARB Tire Valve Caps ₱699 | ✅ Real, but ₱699 is a premium ARB price. Generic caps are a ₱1–100 commodity |
| **Tyre repair kit / vulcanising solution** | ✅ partspro.ph: ARB Speedy Seal Tyre Repair Kit ₱3,500 | ✅ **Genuinely sold and consumed by "Tire Mounting and Repair"** — this is a real BOM line |
| **Tyre sealant / inflator** | ✅ partspro.ph: Flamingo Car Care Tire Sealant & Inflator 450ml ₱220 | ✅ Real, cheap, consumed on repair jobs |
| **Inner tubes** | ❌ **No PH price obtained.** Tube-type fitment on this fleet is nearly extinct (all these vehicles are tubeless) | ❌ **Do not stock tubes.** Only the motorcycle/truck side of the shop would |
| **Balancing weights** | ❌ **No PH price obtained.** Sold by the kg/box from distributors | ⚠️ Real consumable for "Wheel Balancing", but I could not price it. → open question |
| **Valve cores** | ❌ No price obtained | Consumable, tiny, near-worthless to stock — but a missing valve core stops a mounting job |
| **Nitrogen** | n/a | **Not a stock item.** §1.1 |

🧠 **On balancing weights specifically:** a small shop buys a box of clip-on or
adhesive weights and issues them by the gram. Modelling this as
`Product.unit: "KG"` with `kind: "CONSUMABLE"` is technically what the schema
allows (`UNITS` includes `KG`) — but a *box* of weights is not a KG of weights,
and the box's tare has to live somewhere. **Recommendation: do not model weights
in v1.** Let the balancing labour carry them. Flag to A2/A3 as a deliberate gap,
not an oversight. → `open-questions.md` **Q-08**.

---

## 9. What a shop of this size actually stocks — the shape of the answer

🧠 Entirely inferred, but it is the shape every small independent tyre shop in
the Philippines converges on, and it is what the starter catalogue encodes.

### Tier 1 — the shelf (deep, always available, the promise)

- **Tyres, 8–12 lines**, the top sizes in §2.3, in **two price tiers** (a value
  brand and a premium brand) so the counter always has an answer
- **Engine oil, 3–5 lines**: 5W-30 4L, 5W-40 4L, 10W-40 4L (or 5L), and at least
  two 1L top-ups
- **Oil filters, 5–6 lines** covering §4.3
- **Brake pads, 3–4 lines** across Vios / Innova-Xpander / Civic-Ertiga
- **Batteries, 2–3 lines** across the §7.2 group sizes

### Tier 2 — the shelf, but thin (order-on-demand within 24–48h)

- Air filters
- Brake rotors (Hi-Q, Vios and Avanza only)
- Brake fluid DOT 4
- Coolant
- Wiper blades, 3 sizes

### Tier 3 — not stocked at all (supplier-orderable; the shop quotes and sources)

- AGM / EFB batteries in the upper bands
- Brembo and other premium brake lines
- Rotors for anything other than Vios / Avanza
- 11R22.5 and other commercial sizes
- 17"+ and 18"+ performance fitments
- Suspension, engine parts, AC parts

**🧠 The commercial reality behind the tiering:** the shop's gross margin on a tyre
is thin (§ margin analysis in `starter-catalogue.md`), and its gross margin on a
filter is fat. A shelf full of tyres at ₱25,000 of capital per set is the single
most efficient way for a small shop to run out of cash. **That is the argument
for depth on filters, brakes and batteries and thin depth on tyres** — and it is
why `reorderPoint` on a tyre should be **1 or 2**, not 4.

---

## 10. Confirmed EYG stock evidence — the facts I am allowed to build on

All from `docs/research/facebook-intel.md`, which verified these against the
shop's own Facebook posts and product photos on **2026-10-02**.

| Fact | Status | Source detail |
| --- | --- | --- |
| **Radar Renegade R/T+ 265/65R17** — stock post 2024-09-22 with a product photo | ✅ **CONFIRMED SOLD** | Post carries a photo of the actual tyre |
| **Blacklion Mix 11R22.5** — stock post 2024-09-10, marked SOLD | ✅ **CONFIRMED SOLD** (single unit, truck/bus) | Blacklion is a **commercial** brand |
| **Deestone 185/65-14** — stock post 2024-09-10, marked SOLD | ✅ **CONFIRMED SOLD** | 14" — an **older-car** fitment, and a real signal about the local installed base |
| **PETRONAS engine oil** — post 2026-05-02 with a product photo | ✅ **CONFIRMED STOCKED** | The shop's oil brand is PETRONAS |
| **Amaron Jade AGM DIN80** — installed on a Hyundai Staria, post 2026-08-07, with photo | ✅ **CONFIRMED STOCKED & INSTALLED** | DIN80 confirmed; Jade = the AGM line |
| Brands: **Michelin, BFGoodrich** | ✅ **CONFIRMED** via michelin.com.ph and bfgoodrich.com.ph dealer locators | The only two brands with a locator record for EYG |
| Brands: **Blackhawk, Arivo, MRF** | ⚠️ **UNVERIFIED** — the shop's own About-text claim, not confirmed by any third party | Arivo is confirmed as a real PH tyre brand (Arivo Premio ARZ1 / Comfort 6 are stocked on TireDepot.ph ✅) |
| Vehicle work photographed: Toyota Hilux FX steering rack, Hyundai Staria AGM install | ✅ | Confirms the shop works on pickups and MPVs |
| Documented fault-finding on **265/65R17 truck/SUV** and **11R22.5 commercial** tyres | ✅ | Confirms capability in sizes "most small shops cannot" handle |
| Address of the tyre arm: **183 Calero St., Ibayo, Balanga City** | ✅ | Separate registered address from the EGSA Fourlanes service centre |

> **🔴 For the orchestrator.** Two facts here collide with `src/config/site.ts`:
> `tireBrands` is `["Michelin","BFGoodrich"]` ✅ correct, but `BUSINESS.trust.yearsServing`
> is `0` ✅ correct, and the **`site.ts` comment "Also omits it from the Bataan
> index"** shows the locator records EYG's *tyre* arm under Batangas. The
> inventory build should not touch `site.ts`. Flagging only.

---

## 11. Source register

| # | Source | Class | Retrieved |
| --- | --- | --- | --- |
| L1 | `wheel-size.com` — Toyota Vios NSP151 / Innova AG10 fitment tables | Fitment database | ✅ 2026-10-03 |
| L2 | `size-tire.com` — Toyota Innova 2008–2022 fitment | Fitment database | ✅ 2026-10-03 |
| L3 | `expressway.ph/tires` — PH size index, ranked "most popular" 18 sizes; Michelin Energy XM2+ size table | Independent PH publisher; **self-declared as unaffiliated with any operator or agency** | ✅ 2026-10-03 |
| L4 | `tiredepot.ph/products/*.js` — per-size PHP variant prices + live in-stock flags for Arivo, BFGoodrich, Bridgestone, CST, Deestone, Linglong, Maxxis, Michelin, Radar | PH online tyre retailer (Metro Manila), Shopify | ✅ 2026-10-03 |
| L5 | `partspro.ph` — oil filters (55), brake pads (250), air filters, tyres (250), batteries, wipers, brake fluid, coolant, grease, spark plugs | PH online auto-parts retailer; in-page currency confirmed `PHP` | ✅ 2026-10-03 |
| L6 | `ustires.org` — *Tire Care & Safety* guide (2025-09 edition) | **US Tire Manufacturers Association** — industry body | ✅ 2026-10-03 |
| L7 | `ecfr.gov` — 49 CFR §574.5, §574.8 | US federal regulation | ✅ 2026-10-03 |
| L8 | `michelin.com.ph` — "How long do tires last?", tyre code guide, PH warranty policy | Brand, first-party **Philippines** | ✅ 2026-10-03 |
| L9 | `motolite.com` — battery line price list | Brand, first-party Philippines | ✅ 2026-10-03 |
| L10 | `amaron-ph.com` — line price ranges, battery-buying tips, core-return text | Brand, first-party Philippines (Pollux Distributors) | ✅ 2026-10-03 |
| L11 | `caltex.com.ph` — Havoline pack sizes and specs | Brand, first-party Philippines | ✅ 2026-10-03 |
| L12 | `blade.ph` — 52-line PH motor-oil collection with prices | PH online retailer (mixed marketplace; motor-oil category only) | ✅ 2026-10-03 |
| L13 | `carcareph.com` — car battery price guide | **Content-marketing guide**, not a distributor list | ✅ 2026-10-03 |
| L14 | `docs/research/facebook-intel.md` (this project, prior agent, 2026-10-02) — EYG's own confirmed stock, brands, service list, hours | First-party, pre-existing in this repo | ✅ 2026-10-02 |
| L15 | `channelmop.com`… **NOT USED** — I explicitly did not reproduce any figure from `6wresearch.com` or `indexbox.io` because no method was retrievable | Paid/commercial market reports | ❌ Method not retrievable |
| L16 | `docs/research/competitors.md` (prior agent) — Balanga competitive set | First-party, pre-existing in this repo | ✅ 2026-10-02 |

**What I could not verify and did not fake:**

1. **A Philippine tyre-size market-share dataset.** No retrievable, methodologically
   inspectable source. The ranking in §2.3 is mine, built on visible evidence.
2. **A current PH distributor/SRP price list for PETRONAS Syntium, Shell Helix,
   Caltex Havoline, or Total.** Brand sites publish specs, not prices.
3. **Balancing weights, valve cores, and inner tubes in PH.** No price obtained.
4. **Amaron and Motolite warranty durations in months.** Not published publicly.
5. **The price the shop actually pays, for anything.** Every price in this
   project is a *retailer's* price, not the shop's cost.

---

## 12. What the shop owner must confirm, in one paragraph

The shop sells **Michelin and BFGoodrich** tyres (locator-confirmed) and has
**actually sold** Radar, Deestone and Blacklion. It uses **PETRONAS** oil and
**Amaron Jade AGM DIN80** batteries. It has photographed work on a **Toyota Hilux
FX** and a **Hyundai Staria**. Everything else in this document is a
well-evidenced *guess* about a fleet of Toyota Vioses. Before a single peso goes
into a purchase order, the owner needs to answer: which of the fifteen sizes does
he actually turn over, which oil does he actually get from his distributor and at
what price, does he stock genuine or equivalent filters, what does he get for
used-battery cores, and how many service bays does he actually run. Those are
questions 1 through 9 in `open-questions.md`.
