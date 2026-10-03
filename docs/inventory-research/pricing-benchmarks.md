# PRICING BENCHMARKS — Philippines

### A1 research · compiled 2026-10-03 · **all URLs and prices checked 2026-10-03 (Asia/Manila)**

---

## 0. THE LEGEND — READ THIS BEFORE YOU USE A SINGLE NUMBER

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  SUGGESTED — REQUIRES OWNER CONFIRMATION                                       ║
║  Every peso figure in `starter-catalogue.md` carries this tag.                 ║
║  It is an ESTIMATE derived from the public retail benchmarks below.            ║
║  It is NOT a researched cost and NOT a researched sell price.                 ║
║  The owner replaces every one of them with his actual distributor invoice.     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**The single most important sentence in this document:**

> **Everything I found is a RETAIL price from an ONLINE seller. None of it is a
> TRADE price from a Metro Manila distributor. Those are two different numbers
> and only the owner knows the second one.**

Everything in §2–§6 below is a **retailer listing price**, retrieved directly
from the retailer's own storefront API, on the date shown. §7 is where the
derived, `SUGGESTED` numbers live. §9 lists everything I could **not** verify.

---

## 1. Method and sources

### 1.1 Two Philippine storefronts, both read programmatically

I did not scrape search-result snippets or marketplace PDFs. I read the
retailers' own storefront data endpoints and printed the **per-variant** prices,
which is the only way to get a real per-tyre-size figure out of a Shopify store.

| Source | Endpoint used | What it gave | Currency proof |
| --- | --- | --- | --- |
| **TireDepot.ph** | `tiredepot.ph/products/<handle>.js` | Per-**size** PHP price + live `available` flag for each variant, across 9 brands | Shopify presentment currency ₱PHP |
| **PartsPro.PH** | `partspro.ph/collections/<h>/products.json` and `/search/suggest.json` | Per-product PHP prices for 55 oil filters, 250 brake pads, 250 tyres, air filters, batteries, wipers, fluids, grease, spark plugs | In-page `Currency = "PHP"`, `CurrencyFormat = "₱ {{amount}} PHP"` |

> **⚠️ A data-integrity note worth recording, because I nearly got it wrong.**
> PartsPro's **collection** endpoint (`/collections/x/products.json`) returns
> prices as decimal peso **strings** (`"2035.00"` = ₱2,035.00), while the
> **single-product** endpoint (`/products/x.js`) returns **centavos**
> (`203500` = ₱2,035.00). Same store, same product, two scales. I verified this
> by cross-reading one product both ways before trusting any figure. A2/A3 must
> never assume a price scale from a retailer endpoint.

### 1.2 Source register

| # | Source | Class | Retrieved | What it is worth |
| --- | --- | --- | --- | --- |
| P1 | `tiredepot.ph/products/bfgoodrich-advantage-touring.js` | PH online tyre retailer, Metro Manila | ✅ 2026-10-03 | BFGoodrich mid-tier per-size retail. **All variants showed `available: false` at time of check** |
| P2 | `tiredepot.ph/products/michelin-energy-xm2-plus.js` | same | ✅ 2026-10-03 | Michelin value/premium per-size retail, with live availability |
| P3 | `tiredepot.ph/products/michelin-primacy-3-zp.js` | same | ✅ 2026-10-03 | Michelin premium per-size retail |
| P4 | `tiredepot.ph/products/michelin-primacy-4-st.js` | same | ✅ 2026-10-03 | Michelin SUV/crossover per-size retail |
| P5 | `tiredepot.ph/products/radar-dimax-sprint.js` | same | ✅ 2026-10-03 | Radar value per-size retail |
| P6 | `tiredepot.ph/products/radar-rpx-800.js` | same | ✅ 2026-10-03 | Radar mid per-size retail |
| P7 | `tiredepot.ph/products/radar-renegade-a-t-trail.js` | same | ✅ 2026-10-03 | Radar A/T per-size retail. ⚠️ **Radar Renegade R/T+ (EYG's confirmed line) returned HTTP 404 — not in this catalogue** |
| P8 | `tiredepot.ph/products/deestone-nakara-r201.js` | same | ✅ 2026-10-03 | Deestone per-size retail. ✅ EYG's confirmed brand |
| P9 | `tiredepot.ph/products/maxxis-mecotra-ma-p5.js` | same | ✅ 2026-10-03 | Maxxis per-size retail |
| P10 | `tiredepot.ph/products/arivo-premio-arz1.js` | same | ✅ 2026-10-03 | Arivo per-size retail. 🟡 EYG's *own* About text claims Arivo |
| P11 | `tiredepot.ph/products/arivo-premio-comfort-6.js` | same | ✅ 2026-10-03 | Arivo per-size retail |
| P12 | `tiredepot.ph/products/linglong-comfort-master.js` | same | ✅ 2026-10-03 | Linglong per-size retail |
| P13 | `tiredepot.ph/products/cst-marquis-mr-c5.js` | same | ✅ 2026-10-03 | CST per-size retail |
| P14 | `tiredepot.ph/products/bridgestone-ecopia-ep300.js` | same | ✅ 2026-10-03 | Bridgestone per-size retail, heavily discounted (74–79% of compare-at) |
| P15 | `partspro.ph/collections/oil-filter-1/products.json` (55 lines) | PH online auto-parts retailer | ✅ 2026-10-03 | Oil-filter fitment→price map |
| P16 | `partspro.ph/collections/brake-pads/products.json` (250 lines) | same | ✅ 2026-10-03 | Full brake-pad price ladder by brand |
| P17 | `partspro.ph/collections/tires/products.json` (250 lines) | same | ✅ 2026-10-03 | Second independent PH tyre price source — Giti, Yokohama, Nitto |
| P18 | `partspro.ph/search/suggest.json` — wiper, brake fluid, rotor, valve, coolant, grease, spark plug | same | ✅ 2026-10-03 | Wipers, fluids, rotors, accessories, consumables |
| P19 | `motolite.com/pages/automotive-battery` | **Brand, first-party Philippines** | ✅ 2026-10-03 | Official battery line prices |
| P20 | `motolite.com/products/motolite-excel-agm` | Brand, first-party | ✅ 2026-10-03 | ⚠️ Conflicts with P19 on the AGM price — see §3.2 |
| P21 | `amaron-ph.com` (home + `/product/amaron-jade/`) | **Brand, first-party Philippines** | ✅ 2026-10-03 | Official battery line price **ranges** |
| P22 | `amaron-ph.com/tips-for-buying-batteries` | Brand, first-party | ✅ 2026-10-03 | Core-return practice + warranty-document requirement |
| P23 | `blade.ph/collections/motor-oil/products.json` (52 lines) | PH online retailer | ✅ 2026-10-03 | The only PH *per-line* oil prices I could obtain |
| P24 | `pieza.ph/product/caltex-havoline-prods-eco5-5w-30-passenger-car-motor-oils-4-liters/` | PH online retailer | ✅ 2026-10-03 | Caltex Havoline 4L — **almost certainly a grey/import price** |
| P25 | `galleon.ph` — Castrol EDGE 5W-20 5 qt | **Grey-import reseller** (international-shipping terms on page) | ✅ 2026-10-03 | ⚠️ Import price. **Do not use as a PH benchmark** |
| P26 | `carcareph.com/guides/auto-parts/car-battery-price-philippines/` | **Content-marketing guide** (published 2026-06-03) | ✅ 2026-10-03 | Broad bands only. Useful as a sanity check, not a source |
| P27 | `scribd.com` — "Shell Helix Oil Change Packages" | **Unverifiable third-party upload of a 2023 distributor document** | ✅ 2026-10-03 | ❌ **REJECTED as a price source.** Recorded here only because it might exist |
| P28 | `biggo.com` (PH), `lazada.com.ph`, `shopee.ph` search snippets | Marketplace aggregators | ✅ 2026-10-03 | ❌ **REJECTED.** Seller-to-seller noise, no single listing I could pin |

---

## 2. TYRES — per-size PHP retail, by brand

All from **TireDepot.ph**, read 2026-10-03. Prices are the retailer's live
**sell** price per size. `IN` / `OUT` is the variant's own availability flag at
the moment of reading — which is itself evidence that PH online tyre stock turns
over fast.

### 2.1 `185/65R15` — the #1 size in this catchment

| Brand | Pattern | Sell price | Compare-at | Avail |
| --- | --- | --- | --- | --- |
| Arivo | Premio ARZ1 | **₱2,377.20** | ₱2,830 | IN |
| Arivo | Premio Comfort 6 | **₱2,503.20** | ₱2,980 | IN |
| Linglong | Comfort Master | ₱2,503.20 | ₱2,980 | IN |
| CST | Marquis MR-C5 | ₱2,800.98 | ₱3,458 | OUT |
| Maxxis | Mecotra MA-P5 | ₱2,862.54 | ₱3,534 | OUT |
| Deestone | Nakara R201 | **₱2,993.00** | ₱3,650 | IN |
| Radar | Dimax Sprint 92H XL | **₱3,058.60** | ₱3,730 | IN |
| Bridgestone | Ecopia EP300 88H | ₱3,840.60 | ₱5,190 | OUT |
| BFGoodrich | Advantage Touring 88H | ₱4,844.00 | — | OUT |
| Michelin | Energy XM2+ 88H | **₱6,382.60** | ₱6,580 | IN |
| Radar | Renegade A/T Trail 92H XL | ₱3,485.00 | ₱4,250 | OUT |

### 2.2 `205/55R16` — the #2 size, the modern-sedan default

| Brand | Pattern | Sell price | Compare-at | Avail |
| --- | --- | --- | --- | --- |
| Arisun | Aggressor ZP01 | ₱1,976.40 | ₱2,440 | IN |
| Linglong | Sport Master | ₱2,578.80 | ₱3,070 | OUT |
| Maxxis | Mecotra MA-P5 91V | ₱4,252.50 | ₱5,250 | OUT |
| Radar | Dimax Sprint 94W XL | ₱3,476.80 | ₱4,240 | OUT |
| Deestone | Vincente R302 | ₱3,034.00 | ₱3,700 | OUT |
| CST | Medallion MD-A7 | ₱3,393.09 | ₱4,189 | IN |
| Bridgestone | Ecopia EP300 91V | ₱5,410.88 | ₱7,312 | OUT |
| **Michelin** | **Energy XM2+ 91V** | **₱6,314.70** | ₱6,510 | **IN** |
| Radar | RPX-800 94W XL | ₱4,961.00 | ₱6,050 | OUT |
| **BFGoodrich** | **Advantage Touring 91V** | **₱5,872.00** | — | OUT |
| Bridgestone | Potenza Adrenalin RE004 | ₱5,192.58 | ₱7,017 | OUT |
| **Michelin** | **Primacy 3 ZP** | **₱10,476.00** | ₱10,800 | IN |

### 2.3 The rest of the shortlist

| Size | Value band | Mid band | Premium band |
| --- | --- | --- | --- |
| `185/60R15` | Arivo ARZ1 XL ₱2,226 · Linglong ₱2,343.60 · CST ₱2,897.37 | Deestone Nakara — *not offered* · Maxxis ₱3,052.89 · Radar Dimax Sprint XL ₱2,919.20 | Bridgestone EP300 84V ₱4,172.86 · **Michelin XM2+ 88H ₱5,383.50** |
| `195/65R15` | Arivo ARZ1 ₱2,486.40 · Arivo Comfort 6 ₱2,620.80 · Linglong ₱2,578.80*(not listed in this size)* | Maxxis MA-P5 91V ₱3,574.53 · Radar Dimax Sprint 95H XL ₱3,239.00 | Bridgestone EP300 91V ₱4,605.02 · **Michelin XM2+ 91V ₱6,586.30** |
| `205/65R16` | Arivo ARZ1 95H ₱3,015.60 · Arivo Comfort 6 ₱3,175.20 · Linglong ₱3,175.20 | Deestone Nakara ₱3,821.20 · Maxxis ₱4,101.03 · Radar Dimax AS-8 ₱3,739.20 · Deestone Vincente ₱3,034.00 | BFGoodrich ₱5,294.00 · Bridgestone EP300 ₱5,480.44 |
| `215/60R16` | Arivo ARZ1 99H XL ₱3,183.60 · Arivo Comfort 6 ₱3,351.60 | Maxxis ₱4,280.04 · Radar Dimax Sprint 99V XL ₱4,346.00 | BFGoodrich ₱5,972.00 · Bridgestone EP300 95V ₱5,254.74 · Michelin XM2+ 95H ₱8,730.00 |
| `185/65R14` | Arivo ARZ1 ₱1,932.00 · Arivo Comfort 6 ₱2,032.80 · Linglong ₱2,074.80 | Deestone Nakara 86H ₱2,550.20 · Maxxis ₱2,860.92 · Radar Dimax Sprint 86H ₱2,870.00 · CST ₱2,595.24 | BFGoodrich 90H ₱4,409.00 |
| `205/65R15` | Arivo ARZ1 94V ₱2,671.20 · Arivo Comfort 6 ₱2,814.00 · Linglong ₱2,814.00 | Deestone — *not offered* · Maxxis ₱3,396.33 · Radar Dimax Sprint 99H XL ₱3,452.20 · CST ₱3,376.08 | Bridgestone EP300 94V ₱4,747.84 · **Michelin XM2+ 99V ₱5,771.50** |
| `195/55R16` | Arivo ARZ1 ₱2,755.20 | Radar Dimax Sprint 91V XL ₱3,435.80 | BFGoodrich ₱4,814.00 · Michelin XM2+ 83V ₱6,993.70 |
| `195/60R15` | Arivo ARZ1 ₱2,452.80 · Arivo Comfort 6 ₱2,578.80 · Linglong ₱2,856.00 | Maxxis ₱3,546.18 · Deestone Nakara ₱3,140.60 · Radar Dimax Sprint 92V XL ₱3,107.80 | Michelin XM2+ 88H — *see 185/60R15 row* |
| `215/55R17` | Arivo Comfort 6 ₱3,225.60 · Arivo ARZ1 ₱3,066.00 | Maxxis — *not offered* | BFGoodrich ₱6,575.00 |
| `225/65R17` | Arivo ARZ1 ₱3,805.20 · Arivo Comfort 6 ₱4,006.80 · Linglong ₱3,637.20 | Radar Dimax Sprint 106V XL ₱5,461.20 | BFGoodrich ₱7,888.00 |
| `265/65R17` | — *not offered by any brand read* | Radar RPX-800 — *not offered* | **BFGoodrich Advantage Touring 112H ₱10,150.00** (OUT) |
| `205/55R15` | Arivo ARZ1 — *not offered* | Maxxis — *not offered* | Bridgestone Ecopia EP300 — *not offered in 205/55R15* |

### 2.4 Second independent PH source — PartsPro.PH (a different market tier)

✅ partspro.ph, read 2026-10-03. These are **Giti and Yokohama** — mid and
premium brands — at a *different* retailer's shelf:

| Product | PartsPro price | Comparable TireDepot product | Ratio |
| --- | --- | --- | --- |
| **Giti Comfort T20 185/65R15 88H** | ₱5,210 | Michelin XM2+ 185/65R15 ₱6,382.60 | 0.82× |
| **Giti Comfort T20 205/55R16 91V** | **₱7,270** | Michelin XM2+ 205/55R16 ₱6,314.70 | **1.15×** |
| Giti Comfort T20 195/65R15 91V | ₱5,945 | Michelin XM2+ 195/65R15 ₱6,586.30 | 0.90× |
| Giti Synergy H2 195/60R15 88H | ₱5,595 | — | — |
| Giti Comfort T20 175/65R14 84H | ₱4,915 | — | — |
| Giti Comfort T20 185/65R14 86H | ₱5,210 | Deestone Nakara 185/65R14 ₱2,550 | 2.04× |
| Giti Comfort F50 225/55R18 100V | ₱10,065 | — | — |
| Giti Comfort T20 235/60R16 100H | ₱8,595 | — | — |
| **Yokohama BluEarth ES32 185/60R15 84H** | **₱6,130** | Michelin XM2+ 185/60R15 ₱5,383.50 | **1.14×** |
| Yokohama BluEarth AE01 185/55R15 82V | ₱6,080 | — | — |
| Yokohama BluEarth ES32 195/60R15 88H | ₱6,400 | — | — |
| Yokohama BluEarth ES32 195/50R16 84V | ₱7,710 | — | — |
| **Yokohama Geolandar A/T4 G018 265/65R17 112T** | **₱15,810** | BFGoodrich 265/65R17 ₱10,150 | 1.56× |
| Giti Xross HT71 265/65R17 112H | ₱10,800 | — | — |

---

## 3. BATTERIES

### 3.1 Amaron — official brand-published ranges (P21)

✅ read 2026-10-03. Pollux Distributors, Inc. is the exclusive PH distributor
(✅ stated on amaron-ph.com).

| Line | Type | Official range |
| --- | --- | --- |
| Amaron GO | MF, Silven-X alloy | **₱3,900 – ₱6,200** |
| Amaron FLO | MF | ₱5,200 – ₱7,400 |
| Amaron PRO | MF | ₱6,100 – ₱10,400 |
| Amaron DURO | Zero-maintenance | ₱6,600 – ₱6,900 |
| Amaron HIWAY | — | ₱8,100 – ₱13,400 |
| **Amaron JADE** | **AGM** | **₱9,500 – ₱14,900** |

### 3.2 Motolite — official brand-published prices (P19)

✅ read 2026-10-03. Philippine-manufactured (Philippine Batteries Inc. ✅).

| Line | Official price |
| --- | --- |
| Champion PM | ₱4,020 |
| **Enduro** | **₱4,740** |
| LM Enforcer | ₱4,380 |
| TruckMaster | ₱5,520 |
| Excel | ₱5,850 |
| Gold | ₱5,980 |
| Excel EFB | ₱8,090 |
| Excel AGM | ₱16,690 |

> **🔴 Two facts that must be reported, not smoothed over.**
>
> **1. Motolite contradicts itself.** `motolite.com/pages/automotive-battery`
> lists **Excel AGM at ₱16,690**. `motolite.com/products/motolite-excel-agm`
> shows **₱21,200**. Both read 2026-10-03. **Any AGM price derived from Motolite's
> site is unusable.**
>
> **2. PartsPro lists an AGM DIN80 at ₱24,975.** That is
> (a) an online-retail price, (b) on an ACDelco line rather than Amaron, and
> (c) roughly **2.5× the ceiling of Amaron's official JADE range**. It is an
> import price. **Do not put it anywhere near a Balanga shop's catalogue.**

### 3.3 The battery price reality

🟡 **P26 (CarCarePH guide, 2026-06-03)** says: standard/MF ₱2,500–₱4,500;
AGM ₱5,000–₱8,500; overall ₱2,500–₱8,500; Motolite MF "approximately ₱3,500 to
₱6,500"; Amaron "₱4,500–₱8,000"; AGM "₱8,000 to ₱15,000 or more".

**The guide's bands sit *below* both brands' official ranges.** Two readings, and
I cannot choose between them from here:

- **(a)** Street prices in PH run below the brand's own website — which is normal
  for a market with heavy grey-channel supply; or
- **(b)** the brand sites quote a list price and the guide is quoting street price.

Either way, **the shop's sell price for a battery is very likely below the brand
website's number, and the brand website's number is not a floor.**
→ `open-questions.md` **Q-05**.

---

## 4. OILS

### 4.1 What I actually found

✅ **The only per-line Philippine oil prices I obtained are from blade.ph**
(Shopify, motor-oil collection, 52 lines, read 2026-10-03). blade.ph is a small
PH online retailer whose motor-oil category carries real brands. Its prices are
online retail, not trade.

| Product | Pack | blade.ph |
| --- | --- | --- |
| Motul Multipower Plus 5W-40 | 1 L | **₱575** |
| Motul Multipower Plus 10W-40 | 1 L | **₱575** |
| Motul Multigrade Plus 10W-40 | 1 L | ₱389 |
| Motul Multipower 15W-50 | 1 L | ₱499 |
| Motul Specific CRDi 5W-40 | 1 L | ₱749 |
| Castrol Magnatec Non-Stop Protection 10W-40 (part-syn) | 1 L | **₱469** |
| Eneos Sustina 5W-30 Premium | 1 L | ₱784 |
| Eneos Synthetic 10W-40 SN/CF | 4 L | ₱1,999 |
| Eneos Pro Racing Fully Synthetic 5W-40 | 4 L | ₱2,799 |
| Mitasu MJ101 SN 5W-30 ILSAC GF-5 100% syn | 1 L / 4 L | ₱849 / ₱2,899 |
| Mitasu MJ122 10W-40 syn-blend | 1 L / 4 L | ₱769 / ₱2,699 |
| Mitasu MJ212 CI-4 5W-40 100% syn | 1 L / 4 L | ₱819 / ₱2,799 |
| Mitasu MJ231 CL-4 15W-40 | 1 L | ₱609 |
| Pertua CVO | 1 L / 4 L | ₱299 / ₱1,164 |
| Repsol Leader CI-4 10W-30 semi-syn | 1 L | ₱344 |
| Eneos Special Synthetic 10W-40 | 1 L | ₱359 |
| Mitasu MJ411 GL-5 75W-90 gear oil LSD | 1 L | ₱979 |
| Mitasu MJ945 20W-50 4T motorcycle oil | 800 ml | ₱359 |
| Petron Sprint 4T 20W-40 **motorcycle** oil | 1 L | ₱159 |

**Derived pack-size economics (arithmetic on the above, not a new claim):**

| Brand | 1 L | 4 L | Implied per-litre at 4 L | Volume discount |
| --- | --- | --- | --- | --- |
| Mitasu MJ101 5W-30 | ₱849 | ₱2,899 | ₱724.75 | **14.6%** |
| Mitasu MJ122 10W-40 | ₱769 | ₱2,699 | ₱674.75 | **12.3%** |

> **🧠 This is the only genuinely useful oil finding.** The **4 L pack carries a
> 12–15% unit discount** over the 1 L bottle. That means the shop's oil margin
> **depends on how it sells the pack**. Selling a PMS on four separate 1 L bottles
> at 1 L pricing gives away ~13 points of margin versus selling the 4 L can.
> **Recommendation: sell the 4 L/5 L can as the PMS unit and hold 1 L only as a
> paid top-up.** This is a merchandising decision the owner must own, and it is
> worth more than any single line in the catalogue.

### 4.2 The brands the brief asked about, honestly

| Brand | PH prices obtained? | State |
| --- | --- | --- |
| Shell Helix | ❌ **No.** The only figure located was a **2023 Shell distributor package document on Scribd** (HX7 5W-40 4L ₱2,075 etc.) — unverifiable upload, three years stale. **REJECTED.** | ❌ UNVERIFIED |
| Motul | ✅ Yes — 1 L lines, blade.ph, §4.1 | 🟡 Online retail |
| PETRONAS | ❌ **No PH price.** blade.ph stocks "Petron Sprint 4T" — that is **PETRONAS' motorcycle oil**, ₱159/1L. **Not car engine oil, and not the Syntium range.** | ❌ UNVERIFIED — and this is the shop's confirmed brand |
| Caltex | 🟡 One price: Havoline ProDS Eco5 5W-30 4L at **₱12,241** (pieza.ph). ⚠️ Almost certainly a grey/import price — more than double what a 4 L semi-synthetic should cost. | ⚠️ Suspect, do not use |
| Total | ❌ **Not observed anywhere in Philippine retail I read.** | ❌ UNVERIFIED — and the brief assumed it is sold here |
| Castrol | ✅ One line: Magnatec 10W-40 1L ₱469 (blade.ph). Plus a grey import at galleon.ph (Castrol EDGE 5W-20 5 qt ₱4,101) — **import, rejected**. | 🟡 One line only |

### 4.3 What this means for the catalogue

🔴 **Every oil line in `starter-catalogue.md` is a `SUGGESTED` estimate.** I could
not obtain a single current Philippine trade price for a mainstream passenger-car
engine oil. The catalogue's oil cost figures are derived from blade.ph's
*retail* prices by an assumed trade discount, which is a guess on top of a guess.

**This is open question Q-01 and it is the highest-risk number in the entire
catalogue.** The owner is one phone call to his PETRONAS distributor away from
resolving it. Nothing else in the project matters as much.

---

## 5. FILTERS, BRAKES, WIPERS, FLUIDS, CONSUMABLES

All ✅ partspro.ph, read 2026-10-03. Online retail.

### 5.1 Oil filters — full fitment→price map

See `tyre-and-parts-landscape.md` §4.1 for the full 55-line table. The price
distribution:

| Band | Price | Fitments |
| --- | --- | --- |
| Value | **₱210 – ₱245** | Vios/Corolla/Altis/Yaris; Fortuner/Hilux/Innova; Mirage/Lancer/Galant/Xpander; Swift/Jimny/Grand Vitara; Wigo/Rush/Celerio/Ertiga |
| Mid | ₱265 – ₱300 | Cefiro/Safari/Urvan/Patrol; Accent/Elantra/Sonata/Santa Fe; City/Civic 92-00; Navara NP300/NV350; Tamaraw/Lite Ace; Starex/Kia |
| Upper-mid | ₱320 – ₱375 | **MG 3/ZS ₱320**; Camry/FJ Cruiser/Fortuner/Hilux/Innova ₱345; Isuzu Mux/D-Max ₱345; Hyundai/Kia ₱365–₱475 |
| Diesel | ₱600 – ₱1,375 | Trailblazer/Colorado diesel; Captiva diesel; Sonic A/T; Chevrolet Spin 1.3 diesel |

🟡 **Marketplace floor** for a Toyota-equivalent filter: `90915-YZZE1` at
**₱130** on `meloautoparts.com` (read 2026-10-03). That is a marketplace seller,
not a parts wholesaler. It establishes a **floor of ₱130** and nothing else.

### 5.2 Brake pads — the three-tier ladder

See `tyre-and-parts-landscape.md` §5.1 for the 22-row table. Summary:

| Tier | Brands | Price band | Note |
| --- | --- | --- | --- |
| **Value** | **ICER**, Hi-Q | **₱1,190 – ₱1,995** | The volume tier. ICER Vios 1.3 at ₱1,200 (was ₱2,200) |
| **Mid** | Hi-Q+ | ₱1,800 – ₱2,600 | Innova / Xpander class |
| **Premium** | **Brembo**, ACDelco | ₱2,035 – ₱53,250 | Brembo P83101N (Vios 1.5) ₱2,035; ACDelco Kia Picanto ₱22,250; Brembo Tesla Model Y EV pad ₱87,450 |

> **🔴 The ICER markdown problem, restated because it is the most tempting bad
> number in this document.** ICER Vios pads: listed **₱1,200**, compare-at
> **₱2,200** — a **45% markdown**. Hi-Q Vios pads: ₱1,190–₱1,325 with no
> compare-at. If I had scraped the "sale" price and written ₱1,200 into the
> catalogue as a sell price, the shop would lose money on its highest-volume
> brake line on day one. **Sale prices are not benchmark prices.** Every
> discounted figure above is flagged in `starter-catalogue.md`.

### 5.3 Brake rotors

| Product | Price |
| --- | --- |
| Hi-Q Rear Rotor, Corolla Altis/Prius/Celica 07-14 (SD4060) | ₱1,335 |
| Hi-Q Front Rotor, Sentra 1.6 92-95 (SD4268) | ₱1,800 |
| Hi-Q Front Rotor, Avanza 2006- (SD4632) | ₱1,885 |
| Hi-Q Front Rotor, **Vios 1.3 '08-13** (SD4003) | **₱1,925** |
| Hi-Q Front Rotor, Camry/Alphard/Estima (SD4021) | ₱2,905 |
| Hi-Q Front Rotor, Ranger Wildtrak T6 / BT-50 (SD5336) | ₱4,280 |
| Brembo Front Rotor, Hilux 2015- | ₱11,000 |
| Brembo Front Rotor, Mazda 3 | ₱11,550 |
| Brembo Front Rotor, Land Cruiser 200 | ₱11,000 – ₱25,300 |

### 5.4 Wipers

| Product | Price |
| --- | --- |
| **NWB Design Wiper Blade 18"** | **₱1,090** |
| PIAA Silicone Rear Rubber RS / RL 16" | ₱1,165 |
| PIAA Silicone Super Silicone 26" | ₱1,265 |
| PIAA Aero Vogue Flex 17" / 19" | ₱1,293 |
| PIAA Aero Vogue Flex 20" | ₱1,414 |
| PIAA Aero Vogue Flex 24" | ₱1,551 |

> 🧠 **The wiper margin problem.** At a ₱1,090 online retail for a common 18"
> blade, a 25% retail margin leaves **₱273** for the shop. Wipers are a
> convenience-attach, not a profit line. Stock three sizes and stop. → flagged in
> the margin analysis.

### 5.5 Fluids, consumables, accessories

| Product | Price |
| --- | --- |
| Pro-99 Brake Fluid DOT 5.1, 1 L | ₱789 |
| AMSOIL Brake Fluid DOT 3&4, 12 oz | ₱860 |
| Liqui Moly Brake Fluid DOT 4, 250 ml | ₱960 |
| Ravenol Brake Fluid DOT 4, 1 L | ₱1,400 |
| Ravenol Brake Fluid DOT 4 LV, 1 L | ₱1,380 |
| Ravenol Brake Fluid DOT 5.1, 1 L | ₱1,820 |
| MAG1 Non-Chlorinated Brake Parts Cleaner 397 g | ₱450 |
| **Bendix Brake/Parts Cleaner & Degreaser 500 ml** | **₱245** |
| Ardeca Brake & Parts Cleaner 500 ml | ₱290 |
| Wurth Brake Cleaner 500 ml | ₱410 |
| Flamingo Carburator Cleaner 450 ml | ₱165 |
| Flamingo Tire Sealant & Inflator 450 ml | ₱220 |
| **ARB Tire Valve Caps** | ₱699 |
| **ARB Speedy Seal Tire Repair Kit** | **₱3,500** |
| Pro-99 Long Life Coolant Pink, 1 L | ₱178 |
| Pro-99 Long Life Coolant Green, 10 L | ₱1,290 |
| Ravenol Radiator Coolant OTC, 5 L | ₱1,620 |
| ACDelco Dex-Cool Premix, 4 L | ₱1,870 |
| MAG1 White Lithium Grease 340 g | ₱820 |
| MAG1 Multi-Purpose Lithium Grease Gold 453 g | ₱450 |
| **Pro-99 Multi-Purpose MP3 Grease, 1 kg** | **₱375** |
| Wurth HHS 2000 Spray Grease 500 ml | ₱950 |
| MOTOTEK High Temperature Grease 10 g | ₱15 |
| **NGK Standard Spark Plug BP6ES, pack of 4** | **₱580** |
| NGK G-Power Platinum BPR6EGP / LKR6AGP, pack of 4 | ₱1,100 |
| NGK Iridium Max BKR6EIX-P, pack of 4 | ₱3,180 |
| Denso Iridium Power IK22, pack of 4 | ₱3,300 |
| ACDelco Air Filter, Fortuner/Hilux 2015-/Innova 2016- | ₱840 |
| ACDelco Oil Filter, MG 3 / ZS 1.5 | ₱320 |
| VIC Oil Filter C-110 (Corolla 1.3 / Altis / Vios 1.5 / Echo / Rush) | ₱250 |
| VIC Oil Filter C-809 (Accord / CR-V / City / Jazz / Civic) | ₱250 |

---

## 6. HOW I DERIVED THE `SUGGESTED` FIGURES — the assumption, stated

Every peso in `starter-catalogue.md` comes from this method. **The method is
mine. The inputs are the retailers above.**

```
costPrice  ≈  researched ONLINE RETAIL price  ×  tradeDiscountFactor
sellPrice  ≈  the largest round peso number the market would plausibly accept,
              never above researched online retail by much, never below cost + floor
marginPct  =  round( (sellPrice − costPrice) / sellPrice × 100 )
```

**`tradeDiscountFactor` — the assumption I am least comfortable with:**

| Category | Factor I used | Why | Confidence |
| --- | --- | --- | --- |
| Tyres (mid/premium) | 0.68 | 🧠 Philippine tyre distributors give dealers roughly a quarter to a third off SRP; online retailers add platform, payment and shipping on top | 🧠 **Inferred. Not sourced.** |
| Tyres (value/Chinese-brand) | 0.78 | Smaller ticket, thinner channel margin, more price-transparent | 🧠 Inferred |
| Oil | 0.76 | Consumer packaged goods; blade.ph is already close to trade | 🧠 Inferred |
| Filters | 0.62 | partspro.ph's ACDelco lines look like trade-plus-25% | 🧠 Inferred |
| Brake pads / rotors | 0.60 | Same ACDelco/Hi-Q/Brembo channel; the ladder's internal ratios are consistent with it | 🧠 Inferred |
| Batteries | 0.72 | Distributor to dealer, **before** core credit | 🧠 Inferred |
| Wipers, fluids, consumables | 0.60 | Consumer/accessory channel | 🧠 Inferred |

> **The orchestrator and the owner must read this table before trusting
> `starter-catalogue.md`.** If the real trade discount is 0.55 rather than 0.68,
> eight of the forty margins in that file are wrong. **The catalogue is a
> starting structure with plausible magnitudes, not a priced catalogue.**
> → `open-questions.md` **Q-01** and **Q-09**.

---

## 7. 🔴 THE MARGIN REALITY — why this catalogue is dangerous

Tyre margins in the Philippines are thin, and the catalogue is built to make that
visible rather than hide it.

### 7.1 The thin-margin mechanics, arithmetically

🧡 Using TireDepot.ph's **compare-at** prices as a proxy for the tyre brand's own
SRP, and its **sell** prices as a live e-commerce price:

| Pattern | Size | compare-at (≈ brand SRP) | sell (online retail) | online retail as % of SRP |
| --- | --- | --- | --- | --- |
| Michelin Energy XM2+ | 205/55R16 | ₱6,510 | ₱6,314.70 | **97.0%** |
| Michelin Energy XM2+ | 185/65R15 | ₱6,580 | ₱6,382.60 | **97.0%** |
| Bridgestone Ecopia EP300 | 185/65R15 | ₱5,190 | ₱3,840.60 | **74.0%** |
| Bridgestone Ecopia EP300 | 205/55R16 | ₱7,312 | ₱5,410.88 | **74.0%** |
| Bridgestone Potenza RE004 | 205/55R16 | ₱7,017 | ₱5,192.58 | 74.0% |
| Arivo Premio ARZ1 | 205/65R16 | ₱3,590 | ₱3,015.60 | 84.0% |
| Arivo Premio ARZ1 | 185/65R15 | ₱2,830 | ₱2,377.20 | 84.0% |
| Deestone Nakara R201 | 185/65R15 | ₱3,650 | ₱2,993.00 | 82.0% |
| Maxxis Mecotra MA-P5 | 205/55R16 | ₱5,250 | ₱4,252.50 | 81.0% |
| Radar Dimax Sprint | 205/55R16 | ₱4,240 | ₱3,476.80 | 82.0% |

🧠 **Three distinct pricing behaviours, and the shop needs all three to survive:**

| Channel | Price as % of SRP | Implication |
| --- | --- | --- |
| **E-commerce, discounted** (Bridgestone, Arivo, Maxxis, Radar, Deestone) | **74–84%** | This is what the customer can find online today. **A Balanga shop cannot sell above this and stay competitive on those brands.** |
| **E-commerce, near-SRP** (Michelin Energy XM2+) | **97%** | Michelin is the only line where the online price is essentially the brand price. Premium lines are defended by service and brand, not by price. |
| **PartsPro.PH** (Giti, Yokohama) | up to **156% of the BFGoodrich equivalent** | A different market tier entirely. **Do not read PartsPro tyre prices as "the PH price".** |

### 7.2 ⚠️ The Bridgestone problem, stated as a risk to the catalogue

If Bridgestone Ecopia EP300 in `205/55R16` sells online at ₱5,410.88 against an
apparent SRP of ₱7,312, then a **legitimate** Bridgestone-dealer sell price in
the Philippines is somewhere near ₱5,400–₱6,000, and there is almost no room
above a ₱5,410 dealer cost. **A Bridgestone line in this catalogue is likely to
be below water or on it.** The margin analysis in `starter-catalogue.md` flags
this explicitly.

### 7.3 🧠 Where the money actually is

| Category | Marital fate | Why |
| --- | --- | --- |
| **Tyres** | 🔴 **Survival, not profit.** Capital-heavy, thin, and price-checked online by every customer with a phone | Above |
| **Oil filters** | 🟢 **The profit engine.** ~₱210 retail, tiny capital, consumed on every PMS, fits in a shoebox | §5.1 |
| **Brake pads (ICER/Hi-Q)** | 🟢 **The second engine.** ₱1,200–₱1,995 retail, good capital turn, safety-critical so it is never price-shopped to zero | §5.2 |
| **Batteries** | 🟢 **Cash-heavy but margin-rich** — and the **core credit is a real, cash-returning asset** | `tyre-and-parts-landscape.md` §7.3 |
| **Wipers** | 🟡 **Convenience attach.** ₱1,090 retail, low margin, low volume | §5.4 |
| **Rotors** | 🔴 **Capital trap.** ₱11,000–₱25,300 for Brembo. Hi-Q at ₱1,335–₱1,925 is the only sane stock | §5.3 |
| **Brake fluid, cleaner, grease, coolant** | 🟢 **Small, fast, fat.** ₱178–₱960, consumed on almost every job | §5.5 |

---

## 8. THE DISPERSION FINDING — a genuine strategic insight

🧠 For `205/55R16` on the same day, from the same country:

```
₱1,976   Arisun Aggressor ZP01
₱2,578   Linglong Sport Master
₱3,034   Deestone Vincente R302
₱3,393   CST Medallion MD-A7
₱3,477   Radar Dimax Sprint
₱4,101   Maxxis Mecotra MA-P5
₱4,961   Radar RPX-800
₱5,193   Bridgestone Potenza Adrenalin RE004
₱5,411   Bridgestone Ecopia EP300
₱5,872   BFGoodrich Advantage Touring
₱6,315   Michelin Energy XM2+
₱7,270   Giti Comfort T20   (PartsPro, a different retailer)
₱10,476  Michelin Primacy 3 ZP
```

**A 5.3× spread between the cheapest and the most expensive listing of one tyre
size in the Philippines, on one day.**

This is the strongest single argument for what this inventory build is *for*:

- The customer cannot price a tyre without three browser tabs open.
- Every competitor can see every other competitor's price instantly.
- **The only defensible difference left is service and availability** — which is
  exactly what `ServiceAvailabilityDto.canFulfil` and the booking flow promise.
- A shop that publishes a price it cannot honour, or says "we have your size" and
  does not, loses to a shop with a worse price and an honest stock number.

→ This is the argument A5 and A6 should be building their copy on.

---

## 9. ❌ EVERYTHING I COULD NOT VERIFY

**This list is the honest core of this document. Nothing here may be printed,
quoted, sold on, or used to justify a price.**

| # | What I could not get | Why it matters | How to resolve |
| --- | --- | --- | --- |
| U-01 | **Any PETRONAS Syntium price in the Philippines** | PETRONAS is ✅ the shop's own oil brand (`facebook-intel.md`) | Owner reads his distributor's price list. **Q-01** |
| U-02 | **Any Shell Helix price in the Philippines** | Shell is a major PH brand | Owner asks his Shell distributor, or reads a physical price list |
| U-03 | **Any Caltex Havoline price in the Philippines** | Caltex is a major PH brand | The one price found (₱12,241 for 4 L) is an import price |
| U-04 | **Any Total oil price in the Philippines** | The brief assumed Total is sold here | ❓ It may not be. **Q-10** |
| U-05 | **Any Castrol passenger-car price beyond one 1 L line** | Castrol is a major PH brand | Owner asks his distributor |
| U-06 | **The shop's actual trade cost, for any product** | **Every catalogue number depends on it** | Owner opens one invoice. **Q-01** |
| U-07 | **Balancing weights, valve cores, inner tubes, tyre plugs in PH** | Wheel Balancing is ✅ a confirmed service | Owner looks in his storeroom. **Q-08** |
| U-08 | **Amaron / Motolite warranty duration in months** | Needed to display any warranty | Ask the distributor; both brands' public sites omit it |
| U-09 | **A Philippine tyre-size market-share dataset** | My ranking is editorial | No source exists that I could inspect. §2.3 of the landscape doc |
| U-10 | **Radar Renegade R/T+ pricing** — HTTP 404 on TireDepot.ph | It is ✅ EYG's confirmed stock line | Owner reads his own invoice. **Q-03** |
| U-11 | **Blacklion Mix 11R22.5 pricing** | ✅ EYG confirmed selling it | Owner reads his own invoice. **Q-03** |
| U-12 | **RMO/ACCRA petrol vs diesel trade terms** | Determines whether oil margin survives | Owner asks his ACCRA representative. **Q-11** |
| U-13 | **Motolite Excel AGM price** — the brand's own site contradicts itself (₱16,690 vs ₱21,200) | Blocks any AGM line | Phone Motolite |
| U-14 | **Bookkeeping-retention period for BIR records** — sources conflict (5 years per one secondary summary of RR 7-2024; 10 years per another) | Affects nothing in the inventory build directly but blocks the legal doc | See `ph-record-keeping-legal.md` §2.4 |

---

## 10. One paragraph for the owner

I can tell you what a tyre costs **at retail, online, today, anywhere in the
Philippines** — and I have done it, size by size, brand by brand, with the URLs
and the dates. What I cannot tell you is what **you** pay, because that is not a
public number. Every peso in the starter catalogue is a reasoned guess built on
top of the retail figures above, and it is labelled as such. Before you spend
anything: get your PETRONAS distributor's list, your tyre distributor's list, and
one ACDelco or VIC invoice, and replace the catalogue's cost column with them.
That single afternoon of work is worth more than every number in this document
put together.
