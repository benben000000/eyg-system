# STARTER CATALOGUE — 48 rows for a Balanga tyre shop
### A1 research · compiled 2026-10-03

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  EVERY PESO FIGURE IN THIS FILE IS  SUGGESTED — REQUIRES OWNER CONFIRMATION  ║
║                                                                               ║
║  Not one peso below is a researched price. Each is an ESTIMATE derived from    ║
║  the *online retail* benchmarks in `pricing-benchmarks.md`, reduced by an       ║
║  assumed trade discount that I could not source (see `pricing-benchmarks.md`    ║
║  §6). The owner replaces the entire costPrice column with his actual           ║
║  distributor invoice before anything is ordered.                                ║
║                                                                               ║
║  The retail anchor for each row is given in the "anchor" column so the owner   ║
║  can check my arithmetic in about ninety seconds per row.                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 0. How to read this

| Column | Meaning |
| --- | --- |
| `sku` | Unique. **Derived from the size**, because that is what the mechanic types. See §1 |
| `kind` | Matches the `ProductKind` enum exactly |
| `unit` | Matches the `UnitOfMeasure` enum exactly |
| `size` | Tyre only. Canonical form, `W/AAR RIM` e.g. `205/55R16` — matches ✅ the schema's stated format |
| `anchor` | 🔴 **The researched online-retail price this row is derived from**, with source and date. `—` means **there is no anchor and this number is close to invented** |
| `costPrice` | **SUGGESTED — REQUIRES OWNER CONFIRMATION** |
| `sellPrice` | **SUGGESTED — REQUIRES OWNER CONFIRMATION** |
| `reorderPoint` / `reorderQty` | **SUGGESTED** |
| `shelfLifeDays` | `null` = does not expire. **SUGGESTED** where non-null |
| `notes` | Fitments, blocking status, warnings |

**🟡 Why `unit: "EA"` for a 4-litre oil can.** ✅ RMO 03-03 §5.12(a) requires
quantities *"in correct units"*. **The thing on the shelf is a sealed can, not a
litre.** The litre is a property of the can, and the schema has no field for it
(`open-questions.md` **Q-02**). `LITRE` is correct for *decanted* stock — which is
why decants are deliberately **not** modelled in v1 (`tyre-and-parts-landscape.md`
§3.3).

---

## 1. SKU convention

```
TYR-<BR>-<W><A>R<RIM>-<PAT>      tyre       e.g. TYR-MIC-20555R16-XM2P
OIL-<BR>-<PRODUCT>-<GRADE>-<PACK> engine oil e.g. OIL-PTR-SYN5000-5W30-4L
FLT-OIL-<BR>-<FIT>              oil filter e.g. FLT-OIL-ACD-YZZE1
FLT-AIR-<BR>-<FIT>              air filter e.g. FLT-AIR-ACD-INNOVA
BRK-PAD-<BR>-<PARTNO>           brake pad  e.g. BRK-PAD-ICR-181898
BRK-ROT-<BR>-<PARTNO>-PR        rotor PAIR e.g. BRK-ROT-HIQ-SD4003-PR
BRK-FLUD-<SPEC>-<VOL>           brake fluid e.g. BRK-FLUD-DOT4-1L
BAT-<BR>-<LINE>-<GROUPSIZE>     battery    e.g. BAT-AMR-JADE-DIN80AGM
WIP-<BR>-<SIZE>                 wiper      e.g. WIP-NWB-18
TAR-<ITEM>-<SPEC>               tyre acc.  e.g. TAR-VALV-CAP-100
CON-<ITEM>-<BR>-<SIZE>          consumable e.g. CON-BRKCLN-BDX-500
TOL-<FUNCTION>-<MODEL>          tool       e.g. TOL-BAL-VERA-5T
```

🟢 **`size` duplicates the SKU by design.** The mechanic's real search is
`20555`; `Product.size` is indexed ✅ (*`@@index([size])`*) and A3's finder reads
it. The SKU exists for the shelf label. Duplication between an indexed human
field and a unique code is not a data problem — it is the point.

---

## 2. THE CATALOGUE

### 2.1 TYRES — 11 rows, `unit: EA`

> 🔴 **`Product.dotCode` is deliberately LEFT NULL on every tyre row.**
> ✅ Michelin PH and ✅ 49 CFR §574.5 give a week-precise age, but the schema
> stores one `dotCode` per **product** while a shelf holds **many DOT lots per
> product**. Writing a single `dotCode` would be a lie with a UI on it.
> See `dot-codes-and-shelf-life.md` §6 and `open-questions.md` **Q-13**.

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TYR-MIC-18560R15-XM2P` | Michelin Energy XM2+ 185/60R15 88H | TYRE | EA | Michelin | 185/60R15 | ₱5,383.50 · TireDepot.ph · 2026-10-03 | **3,661** | **4,700** | 2 | 4 | null | ⚠️ THIN. The Toyota Vios size. Anchor is 97% of Michelin SRP — no room above this. **Line of first choice for stock depth** |
| `TYR-RDR-18565R15-SPRNT` | Radar Dimax Sprint 185/65R15 92H XL | TYRE | EA | Radar | 185/65R15 | ₱3,058.60 · TireDepot.ph · 2026-10-03 | **2,080** | **2,690** | 2 | 4 | null | Value tier for the #1 size. Radar is on EYG's own claimed brand list ✅. `isBlocking` on a mounting BOM |
| `TYR-MIC-18565R15-XM2P` | Michelin Energy XM2+ 185/65R15 88H | TYRE | EA | Michelin | 185/65R15 | ₱6,382.60 · TireDepot.ph · 2026-10-03 | **4,340** | **5,600** | 2 | 4 | null | Premium tier, same size as above. **Sell both or neither** — one tyre brand per size reads as indecision |
| `TYR-MIC-20555R16-XM2P` | Michelin Energy XM2+ 205/55R16 91V | TYRE | EA | Michelin | 205/55R16 | ₱6,314.70 · TireDepot.ph · 2026-10-03 | **4,294** | **5,500** | 2 | 4 | null | ⚠️ THIN. #2 size. Anchor 97% of SRP. **Do not sell below ₱4,900 — below that the line is underwater** |
| `TYR-RDR-20555R16-SPRNT` | Radar Dimax Sprint 205/55R16 94W XL | TYRE | EA | Radar | 205/55R16 | ₱3,476.80 · TireDepot.ph · 2026-10-03 | **2,364** | **3,090** | 2 | 4 | null | Value tier for #2. ✅ **The single highest-volume tyre line recommended** |
| `TYR-MMX-20555R16-MAP5` | Maxxis Mecotra MA-P5 205/55R16 91V | TYRE | EA | Maxxis | 205/55R16 | ₱4,252.50 · TireDepot.ph · 2026-10-03 | **3,051** | **3,950** | 1 | 2 | null | Mid tier for #2. 🟡 **Maxxis is NOT on either the confirmed (`Michelin, BFGoodrich`) or the shop-claimed (`Blackhawk, Arivo, MRF`) brand list** — see `facebook-intel.md` |
| `TYR-RDR-19565R15-SPRNT` | Radar Dimax Sprint 195/65R15 95H XL | TYRE | EA | Radar | 195/65R15 | ₱3,239.00 · TireDepot.ph · 2026-10-03 | **2,202** | **2,850** | 2 | 4 | null | Expressway.ph's #3 size. Sentra / Mazda 3 / Elantra / Sail crowd |
| `TYR-BFG-20565R16-ADVT` | BFGoodrich Advantage Touring 205/65R16 95H | TYRE | EA | BFGoodrich | 205/65R16 | ₱5,294.00 · TireDepot.ph · 2026-10-03 | **3,600** | **4,550** | 2 | 2 | null | ✅ **BFGoodrich is a CONFIRMED brand** (bfgoodrich.com.ph locator). The Innova 2016+ size ✅ confirmed OE. ⚠️ Anchor was OUT of stock at time of check — the price is real, the availability is not |
| `TYR-ARV-18565R14-ARZ1` | Arivo Premio ARZ1 185/65R14 86H | TYRE | EA | Arivo | 185/65R14 | ₱1,932.00 · TireDepot.ph · 2026-10-03 | **1,503** | **1,950** | 2 | 4 | null | 🟡 Arivo is on EYG's **own unverified** brand claim. ✅ EYG confirmed selling a **Deestone 185/65-14** — the size is proven even if this brand is not |
| `TYR-DST-18565R14-NKR201` | Deestone Nakara R201 185/65R14 86H | TYRE | EA | Deestone | 185/65R14 | ₱2,550.20 · TireDepot.ph · 2026-10-03 | **1,986** | **2,590** | 1 | 2 | null | 🟢 **CLOSEST LINE TO PROVEN EYG STOCK.** ✅ EYG sold a Deestone 185/65-14 (post 2024-09-10). Same brand, same size. **Start here before anything else** |
| `TYR-BFG-26565R17-ADVT` | BFGoodrich Advantage Touring 265/65R17 112H | TYRE | EA | BFGoodrich | 265/65R17 | ₱10,150.00 · TireDepot.ph · 2026-10-03 | **6,902** | **8,600** | 1 | 2 | null | 🔴 **CAPITAL TRAP.** ~₱7,000 per unit at cost. ✅ EYG confirmed selling a **Radar Renegade R/T+ 265/65R17** — ✅ **but TireDepot returned 404 for the R/T+, so there is no anchor. Q-03** |

### 2.2 ENGINE OIL — 6 rows, `unit: EA`

> 🔴 **THE WEAKEST BLOCK IN THE FILE.**
> ✅ **PETRONAS is EYG's own confirmed oil brand** (`facebook-intel.md`, post
> 2026-05-02). **I could not obtain a single Philippine PETRONAS price.** The
> anchors below are for *other brands* at a *different retailer*, used only to
> establish magnitude. These four PETRONAS cost figures are **the closest thing
> to invented numbers in this file.** → **Q-01**

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `OIL-PTR-SYN5000-5W30-4L` | PETRONAS Syntium 5000 5W-30, 4 L can | OIL | EA | PETRONAS | — | 🔴 **none** (see note above). Magnitude ref: Mitasu MJ101 5W-30 4L ₱2,899 (blade.ph) | **1,000** | **1,490** | 8 | 8 | 1,095 | ✅ Shop's confirmed oil brand. **The PMS unit — sell the can, not four 1 L bottles.** ⚠️ 12–15% pack-size discount is the margin lever (`pricing-benchmarks.md` §4.1) |
| `OIL-PTR-SYN5000-5W40-4L` | PETRONAS Syntium 5000 5W-40, 4 L can | OIL | EA | PETRONAS | — | 🔴 **none**. Magnitude ref: Eneos Pro Racing 5W-40 4L ₱2,799 (blade.ph) | **1,060** | **1,580** | 6 | 8 | 1,095 | 🟢 **5W-40 is the correct default grade for Bataan** — hot, stop-start, traffic. Stock before 5W-30 if the owner disagrees |
| `OIL-PTR-SYN800-10W40-4L` | PETRONAS Syntium 800 10W-40, 4 L can | OIL | EA | PETRONAS | — | 🔴 **none**. Magnitude ref: Mitasu MJ122 10W-40 4L ₱2,699; Eneos Synthetic 10W-40 4L ₱1,999 (blade.ph) | **1,180** | **1,720** | 4 | 8 | 1,095 | The legacy/older-vehicle tier. Vioses from 2008 are still on the road in Bataan |
| `OIL-PTR-SYN5000-5W30-1L` | PETRONAS Syntium 5000 5W-30, 1 L bottle | OIL | EA | PETRONAS | — | 🔴 **none**. Magnitude ref: Eneos Sustina 5W-30 1L ₱784 (blade.ph) | **270** | **440** | 12 | 12 | 1,095 | **Top-up unit only.** Never substitute a 1 L for a 4 L without telling the customer — ✅ RA 7394 Art. 69(b) |
| `OIL-MTL-MPP-5W40-1L` | Motul Multipower Plus 5W-40, 1 L | OIL | EA | Motul | — | ₱575.00 · blade.ph · 2026-10-03 | **391** | **620** | 6 | 12 | 1,095 | ⚠️ Sell price is **7.8% ABOVE the researched online retail.** Acceptable only if the trade price is below blade.ph's — it should be. **Owner must verify** |
| `OIL-CST-MAG-10W40-1L` | Castrol Magnatec Non-Stop Protection 10W-40, 1 L | OIL | EA | Castrol | — | ₱469.00 · blade.ph · 2026-10-03 | **319** | **520** | 6 | 12 | 1,095 | ⚠️ Sell price is **10.9% ABOVE the researched online retail.** Same caution. 🟡 MOTORCYCLE oil (JASO) is also sold on blade.ph under Castrol/Petron/Mitasu — **do not mix tiers in one catalogue** |

### 2.3 FILTERS — 7 rows

> ✅ Every oil-filter anchor is from ✅ **partspro.ph** (an established PH online
> parts retailer), collection `oil-filter-1`, 55 lines, read 2026-10-03, verified
> as a PHP store in-page. **ACDelco** is the mainstream replacement-grade brand a
> Balanga shop can actually buy. ⚠️ **No genuine/OEM filter is in this catalogue
> on purpose — see `tyre-and-parts-landscape.md` §4.1. Q-04.**

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FLT-OIL-ACD-YZZE1` | Oil filter — Toyota Vios / Corolla 1.3–1.8 / Altis / Yaris / Wigo / Avanza / Rush (`90915-YZZE1` equiv) | FILTER | EA | ACDelco | — | ₱210.00 · partspro.ph · 2026-10-03 | **130** | **215** | 12 | 24 | 1,465 | 🟢 **THE PROFIT ENGINE.** Consumed on every PMS; fits in a shoebox; ~40% margin on a ₱215 ticket. 🔴 `isBlocking: true` |
| `FLT-OIL-ACD-INNOVA` | Oil filter — Toyota Camry / FJ Cruiser / Fortuner / Hilux / Hiace / Innova / Land Cruiser | FILTER | EA | ACDelco | — | ₱345.00 · partspro.ph · 2026-10-03 | **214** | **350** | 8 | 24 | 1,465 | ✅ EYG has photographed work on a Toyota Hilux FX. The Innova/Hilux/van line. `isBlocking: true` |
| `FLT-OIL-ACD-CIVIC` | Oil filter — Honda Accord 2.4/3.0 / CR-V / City 1.3 / Civic 05- 1.8 | FILTER | EA | ACDelco | — | ₱235.00 · partspro.ph · 2026-10-03 | **146** | **240** | 8 | 24 | 1,465 | Honda Civic is a named local vehicle (`prisma/seed.ts` demo data). `isBlocking: true` |
| `FLT-OIL-ACD-XPANDER` | Oil filter — Mitsubishi Mirage G4 / Lancer / Galant / **Xpander** | FILTER | EA | ACDelco | — | ₱225.00 · partspro.ph · 2026-10-03 | **140** | **230** | 6 | 24 | 1,465 | Xpander is a named local vehicle. `isBlocking: true` |
| `FLT-OIL-ACD-ACCENT` | Oil filter — Hyundai Santa Fe / Tucson / **Accent** / Elantra / Sonata (+ Kia Rio, Forte, Optima) | FILTER | EA | ACDelco | — | ₱240.00 · partspro.ph · 2026-10-03 | **149** | **245** | 6 | 24 | 1,465 | Accent is a named local vehicle. `isBlocking: true` |
| `FLT-OIL-ACD-SUZUKI` | Oil filter — Suzuki Swift / Jimny / Grand Vitara 98–16 / Samurai | FILTER | EA | ACDelco | — | ₱210.00 · partspro.ph · 2026-10-03 | **130** | **215** | 6 | 24 | 1,465 | Ertiga is a named local vehicle. 🟡 the Ertiga/Celerio filter at partspro.ph is ₱245 — verify fitment before promising either |
| `FLT-AIR-ACD-INNOVA` | Air filter — Toyota Fortuner 2015- / Hilux 2015- / Innova 2016- | FILTER | EA | ACDelco | — | ₱840.00 · partspro.ph · 2026-10-03 | **521** | **850** | 2 | 6 | 1,465 | 🔴 **The most expensive PMS consumable — 4× the oil filter.** `isBlocking: **false**` — never hold a PMS for an air filter. 🟢 Q-18: **do these fit in the Innova and Hilux?** Confirm before ordering 6 |

### 2.4 BRAKES — 6 rows

> ✅ Anchors from ✅ **partspro.ph**, collection `brake-pads` (250 lines) and the
> site's search endpoint for rotors, read 2026-10-03.
> 🔴 **THE ICER PRICE IS A 45% MARKDOWN.** partspro.ph shows ICER Vios pads at
> **₱1,200 against a ₱2,200 "was" price.** A sale price is not a shelf price.
> **The sell price below is deliberately ABOVE the online retail** — because the
> online retail is promotional. **Owner must confirm what he actually pays
> before this row is trusted.**

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `BRK-PAD-ICR-181898` | Front brake pad — Toyota Vios Gen3 1.5L (181898) | BRAKE | EA | ICER | — | ₱1,200.00 *(was ₱2,250)* · partspro.ph · 2026-10-03 | **720** | **1,250** | 4 | 12 | null | ⚠️ Sell is **4.2% above online retail**, deliberately, because online is a 45%-off promo. 🔴 **`isBlocking: true`** — safety-critical. If the pads are short, the car does not leave |
| `BRK-PAD-ICR-182180` | Front brake pad — Toyota Vios Gen3 1.3L (182180) | BRAKE | EA | ICER | — | ₱1,200.00 *(was ₱2,200)* · partspro.ph · 2026-10-03 | **720** | **1,250** | 4 | 12 | null | Same. The single highest-volume brake line in this catalogue |
| `BRK-PAD-HIQ-SP4360` | Front brake pad — Mitsubishi Xpander 2018- (SP4360) | BRAKE | EA | Hi-Q | — | ₱1,730.00 · partspro.ph · 2026-10-03 | **1,038** | **1,790** | 2 | 8 | null | ⚠️ Sell 3.5% above online. `isBlocking: true` |
| `BRK-PAD-HIQ-SP4425` | Front brake pad — Suzuki Ertiga (SP4425) | BRAKE | EA | Hi-Q | — | ₱1,975.00 · partspro.ph · 2026-10-03 | **1,185** | **2,090** | 2 | 8 | null | Ertiga is a named local vehicle. `isBlocking: true` |
| `BRK-ROT-HIQ-SD4003-PR` | Front brake rotor **PAIR** — Toyota Vios 1.3 '08–13 (SD4003 ×2) | BRAKE | **PAIR** | Hi-Q | — | ₱1,925.00 each / ₱3,850 pair · partspro.ph · 2026-10-03 | **2,310** | **3,290** | 1 | 2 | null | 🟢 **`unit: "PAIR"` is genuinely correct here** — nobody buys one rotor. This is the *only* place in the whole catalogue where `PAIR` is right for a mechanical part, and the only place a set makes sense. 🟡 ⚠️ margin is **29.8%** — thinner than the pads |
| `BRK-FLUD-DOT4-1L` | Brake fluid DOT 4, 1 L | BRAKE | EA | Ravenol | — | ₱1,400.00 · partspro.ph · 2026-10-03 | **840** | **1,150** | 2 | 6 | 365 | ⚠️ margin **27.0%**. 🟡 `isBlocking: **false**` for PMS; **true** for a brake-fluid service. 🔴 **DOT 3/4 only — DOT 5.1 is silicone and must never be mixed.** Keep DOT 5.1 (₱789 at partspro.ph) off the shelf, or label it physically separate. `shelfLifeDays 365` is **SUGGESTED — no sourced figure** |

### 2.5 BATTERIES — 4 rows

> ✅ Anchors are **official brand-published prices** — the best-sourced block in
> this file. ✅ Amaron at `amaron-ph.com`, ✅ Motolite at `motolite.com`, both
> read 2026-10-03. Amaron publishes **ranges**, not per-group prices, so the
> anchor is the **bottom of the range** for the tier.
> 🔴 **THE CORE CREDIT IS NOT IN `costPrice`.** ✅ Amaron PH, first-party: *"Your
> dealer will either provide you with a financial reward for the old battery or
> subtract the corresponding amount from the cost of a new battery purchase."*
> **A battery's true cost is purchase price MINUS the core credit.** The margin
> figures below are therefore **overstated** unless the shop captures cores.
> → **Q-06**

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `BAT-AMR-GO-NS40` | Battery MF NS40 / 55B24L — Amaron GO | BATTERY | EA | Amaron | — | ₱3,900.00 *(bottom of official ₱3,900–₱6,200)* · amaron-ph.com · 2026-10-03 | **2,808** | **4,250** | 2 | 4 | 365 | Vios / City / Accent class. 🔴 **Self-discharges on the shelf — this is not oil.** `shelfLifeDays` is modelling, not decoration. **Capture the core credit or do not stock** |
| `BAT-AMR-GO-DIN60` | Battery MF DIN60 / 70B26L — Amaron GO | BATTERY | EA | Amaron | — | ₱4,600.00 *(within official ₱3,900–₱6,200)* · amaron-ph.com · 2026-10-03 | **3,240** | **4,900** | 2 | 4 | 365 | Corolla Altis / Civic / Sentra class. Same core-credit rule |
| `BAT-AMR-FLO-N50` | Battery MF 3SM / N50 light-commercial — Amaron FLO | BATTERY | EA | Amaron | — | ₱5,200.00 *(bottom of official ₱5,200–₱7,400)* · amaron-ph.com · 2026-10-03 | **3,744** | **5,950** | 1 | 4 | 365 | Navara / D-Max / Hilux / Urvan class. 🟢 Motolite's equivalent band (Champion PM ₱4,020 → Enduro ₱4,740) is the fallback if Amaron is unavailable |
| `BAT-AMR-JADE-DIN80AGM` | Battery AGM DIN80 / BCI 94R / DIN H7 / L4 — Amaron JADE | BATTERY | EA | Amaron | — | ₱9,500.00 *(bottom of official ₱9,500–₱14,900)* · amaron-ph.com · 2026-10-03 | **6,840** | **11,500** | 1 | 2 | 365 | 🟢 **THE ONLY PROVEN EYG BATTERY.** ✅ *Amaron Jade AGM DIN80 installed on a Hyundai Staria*, post 2026-08-07, with photo. 🔴 **BIGGEST TAIL RISK IN THE CATALOGUE** — ✅ RA 7394 Art. 68(b)(3): if Amaron *and* its distributor both fail to honour the warranty, *"the retailer shall shoulder the expenses and costs necessary to honor the warranty."* At ₱11,500 that is ₱11,500 of shop money per unreturnable unit. **Owner approval required — Q-05** |

### 2.6 WIPERS — 4 rows

> ✅ Anchors from ✅ partspro.ph, read 2026-10-03.
> 🔴 **THIN. Read the margin analysis §3 before ordering a single blade.**

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `WIP-NWB-18` | Wiper blade 18" — NWB Design | WIPER | **EA** | NWB | — | ₱1,090.00 · partspro.ph · 2026-10-03 | **654** | **890** | 6 | 12 | 730 | 🟢 Sell is **18% below** online retail — genuinely competitive. ⚠️ But margin is only **26.5%**. 🟡 **Wiper sizes are sold in INCHES on a metric fleet** — A3 needs a wiper finder or a clear note |
| `WIP-NWB-20` | Wiper blade 20" — NWB Design | WIPER | **EA** | NWB | — | 🔴 **no direct anchor.** 18" ₱1,090 · 19" (PIAA) ₱1,293 — 20" is a **SUGGESTED** step between them | **720** | **980** | 4 | 12 | 730 | ⚠️ ⚠️ **THE FIGURES ARE ESSENTIALLY GUESSED.** Order 2, not 12, until the owner prices a 20" blade |
| `WIP-PIAA-RL16` | Rear wiper blade 16" — PIAA Silicone RL | WIPER | **EA** | PIAA | — | ₱1,165.00 · partspro.ph · 2026-10-03 | **699** | **1,000** | 3 | 6 | 730 | 🟢 **Rear wipers are the sellable line here.** ✅ Ertiga, Innova, Xpander and Staria all have rear wipers; the sedans do not. `unit: "EA"` not `PAIR` — 🟡 the PIAA listing is a single blade |
| `WIP-PIAA-AVF24` | Wiper blade 24" — PIAA Silicone Aero Vogue Flex | WIPER | **EA** | PIAA | — | ₱1,551.00 · partspro.ph · 2026-10-03 | **931** | **1,290** | 1 | 6 | 730 | Larger sedans / MPVs. 🟡 **Low confidence on local demand — order 2** |

### 2.7 TYRE ACCESSORIES — 2 rows

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TAR-VALV-CAP-100` | Snap-in rubber valve cap (bag of 100) | TYRE_ACCESSORY | **EA** | — | — | 🔴 **NO PH ANCHOR.** Closest researched: ✅ ARB branded caps at ₱699 (partspro.ph) — a premium accessory brand at ~15× the commodity price | **85** | **180** | 2 | 3 | null | ⚠️ **The cost figure is a guess.** ✅ An ARB price is not an anchor for a generic cap. `unit: "EA"` = one bag. 🧢 Consumes on every tyre change — a valve cap is nearly free and its absence stops a mount |
| `TAR-SEAL-450ML` | Tyre sealant & inflator 450 ml | TYRE_ACCESSORY | EA | Flamingo | — | ₱220.00 · partspro.ph · 2026-10-03 | **132** | **250** | 4 | 12 | 730 | ✅ A real consumable for ✅ **Tire Mounting and Repair**. `isBlocking: **false**` — a puncture repair can be done without a bottle. 🟡 ✅ **A FAR higher-margin, more honest alternative to fitting a ₱3,500 ARB Speedy Seal kit** (`pricing-benchmarks.md` §5.5) |

### 2.8 CONSUMABLES — 3 rows

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CON-BRKCLN-BDX-500` | Brake / parts cleaner & degreaser 500 ml | CONSUMABLE | EA | Bendix | — | ₱245.00 · partspro.ph · 2026-10-03 | **147** | **250** | 8 | 24 | 1,095 | 🔴 `isBlocking: **true`** for ✅ **Brake Cleaning and Maintenance** — it is the entire consumable of that confirmed service. 🟡 Compare: MAG1 ₱450, Wurth ₱410, Ardeca ₱290. **Bendix is the cheapest researched option and the volume choice** |
| `CON-GRS-MP3-1KG` | Multi-purpose grease, lithium complex, 1 kg | CONSUMABLE | EA | Pro-99 | — | ₱375.00 · partspro.ph · 2026-10-03 | **225** | **385** | 3 | 6 | 1,095 | Consumed on ✅ **Wheel Balancing** and ✅ **Underchassis Maintenance and Repair**. 🔴 `isBlocking: **false**` |
| `CON-COOL-LL-GRN-10L` | Long-life coolant, green, 10 L | CONSUMABLE | EA | Pro-99 | — | ₱1,290.00 · partspro.ph · 2026-10-03 | **774** | **1,290** | 2 | 3 | 730 | 🟡 ⚠️ **Not consumed by any of the ten confirmed services.** Included because every car on the lift needs it eventually. **Default `isActive` to ask the owner — Q-19.** 1 L pink at ₱178 is the top-up (`pricing-benchmarks.md` §5.5) |

### 2.9 TOOLS — 5 rows, shop-owned, **never sold**

> 🔴 **`sellPrice: 0` and they must be excluded from every customer-facing and
> sell-facing surface.** ✅ `ProductKind.TOOL // owned by the shop, not sold`.
> ✅ `cycleCountDays: 0` → *"Counted every N days. 0 = never (tools, rare
> parts)"* — the schema's own comment. **These five rows must not appear in the
> reorder list, the valuation-by-kind retail total, or the stock count.**
> 🔴 **`costPrice` below is an ASSET VALUATION, not a purchase price.** It is the
> figure the owner should see on his own balance sheet for the tool.
> **All five asset values are `SUGGESTED` and are almost certainly wrong** — the
> owner knows what his own machines cost.

| sku | name | kind | unit | brand | size | anchor (🔴 researched) | costPrice (asset value) | sellPrice | reorderPoint | reorderQty | shelfLifeDays | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TOL-BAL-VERA-5T` | Wheel balancer, 5T vertical, touch interface | TOOL | EA | — | — | 🔴 none | **48,000** | **0** | 0 | 0 | null | ✅ **Wheel Balancing** is a confirmed service. `cycleCountDays 0`. 🔴 Never counted, never reordered, never sold. 🟢 **Its absence is a reason a confirmed service cannot be promised** |
| `TOL-ALN-MACH-4W` | 4-wheel alignment machine, camera/3D, incl. printer | TOOL | EA | — | — | 🔴 none | **185,000** | **0** | 0 | 0 | null | ✅ **Wheel Alignment and Camber Correction** is a confirmed service. 🟢 This is the single most expensive asset in this catalogue by a factor of 4 |
| `TOL-TYRCHG-2024` | Tyre changer, 40" rim capability, hydraulic arm | TOOL | EA | — | — | 🔴 none | **165,000** | **0** | 0 | 0 | null | ✅ **Tire Mounting and Repair** is a confirmed service. 🟡 🟢 **If this machine is out of service, EVERY confirmed tyre service stops being promiseable.** A single-point-of-failure dependency worth surfacing on the dashboard |
| `TOL-N2GEN-2X` | Nitrogen generator + dual-cylinder filling station | TOOL | EA | — | — | 🔴 none | **72,000** | **0** | 0 | 0 | null | 🟢 **NOTHING** 🔴 **A nitrogen SKU IS INVENTORIED.** ✅ *Nitrogen Tire Inflation* is a confirmed service; the nitrogen is made here. **Never create a gas product.** See `tyre-and-parts-landscape.md` §1.1 |
| `TOL-TORQ-WRNCH-1-2` | Torque wrench, 3/8" drive, 40–200 Nm, click type | TOOL | EA | — | — | 🔴 none | **4,200** | **0** | 0 | 0 | null | ✅ Wheel nuts are safety-critical and ✅ Michelin USTMA guidance ties treadwear warranty to rotation discipline. 🟡 **Confirm the shop actually torque-specs; if not, that is a training gap, not a stock gap** |

---

## 3. 📊 MARGIN ANALYSIS — read this before ordering anything

**Every margin below is `SUGGESTED — REQUIRES OWNER CONFIRMATION`.**
`marginPct = (sellPrice − costPrice) / sellPrice`, per ✅ the schema's definition.

### 3.1 The headline

| Metric | Value | Note |
| --- | --- | --- |
| **Sellable rows** | **43** | The `~40` asked for |
| **Tool rows** | 5 | `sellPrice 0`, never sold |
| **Total rows** | **48** | |
| **Tyres** | 11 | 🔴 the capital |
| **Oil** | 6 | ⚠️ the least-sourced block |
| **Filters** | 7 | 🟢 the profit engine |
| **Brakes** | 6 | 🟢 the second engine |
| **Batteries** | 4 | 🟢 margin-rich, tail-risk-heavy |
| **Wipers** | 4 | 🔴 thin |
| **Tyre accessories** | 2 | 🟢 tiny but real |
| **Consumables** | 3 | 🟢 fat |
| **Tools** | 5 | not sold |

### 3.2 Margin by row — the ranked truth

| Rank | Row | costPrice | sellPrice | margin% | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | `TAR-VALV-CAP-100` | 85 | 180 | **52.8%** | 🟡 Looks best. **Cost is a guess — treat as unknown** |
| 2 | `TAR-SEAL-450ML` | 132 | 250 | **47.2%** | ✅ Real anchor, real margin |
| 3 | `BAT-AMR-JADE-DIN80AGM` | 6,840 | 11,500 | **40.5%** | 🔴 **Only true if the shop buys at the BOTTOM of the official range AND captures the core credit.** Otherwise underwater |
| 4 | `BRK-PAD-HIQ-SP4425` | 1,185 | 2,090 | 43.3% | ✅ Strong |
| 5 | `BRK-PAD-ICR-181898` | 720 | 1,250 | 42.4% | ⚠️ Margin **depends entirely on buying below the ₱1,200 promo** |
| 6 | `BRK-PAD-ICR-182180` | 720 | 1,250 | 42.4% | Same |
| 7 | `CON-GRS-MP3-1KG` | 225 | 385 | 41.6% | ✅ |
| 8 | `CON-BRKCLN-BDX-500` | 147 | 250 | 41.2% | ✅ |
| 9 | `CON-COOL-LL-GRN-10L` | 774 | 1,290 | 40.0% | ✅ |
| 10 | `FLT-OIL-ACD-YZZE1` | 130 | 215 | 39.5% | 🟢 **The best risk-adjusted line in the catalogue** |
| 11 | `FLT-OIL-ACD-SUZUKI` | 130 | 215 | 39.5% | ✅ |
| 12 | `FLT-OIL-ACD-CIVIC` | 146 | 240 | 39.2% | ✅ |
| 13 | `FLT-OIL-ACD-ACCENT` | 149 | 245 | 39.2% | ✅ |
| 14 | `FLT-OIL-ACD-XPANDER` | 140 | 230 | 39.1% | ✅ |
| 15 | `FLT-OIL-ACD-INNOVA` | 214 | 350 | 38.9% | ✅ |
| 16 | `FLT-AIR-ACD-INNOVA` | 521 | 850 | 38.7% | 🟡 Confirm fitment first — at ₱521 cost, a wrong guess is expensive |
| 17 | `OIL-PTR-SYN5000-5W30-1L` | 270 | 440 | 38.6% | ⚠️ No anchor |
| 18 | `OIL-CST-MAG-10W40-1L` | 319 | 520 | 38.7% | ⚠️ No anchor |
| 19 | `BAT-AMR-FLO-N50` | 3,744 | 5,950 | 37.1% | ⚠️ Core credit |
| 20 | `OIL-MTL-MPP-5W40-1L` | 391 | 620 | 37.0% | ⚠️ Sell above online |
| 21 | `BAT-AMR-GO-DIN60` | 3,240 | 4,900 | 33.9% | ⚠️ Core credit |
| 22 | `BAT-AMR-GO-NS40` | 2,808 | 4,250 | 33.9% | ⚠️ Core credit |
| 23 | `OIL-PTR-SYN800-10W40-4L` | 1,180 | 1,720 | 31.4% | ⚠️ No anchor |
| 24 | `BRK-ROT-HIQ-SD4003-PR` | 2,310 | 3,290 | **29.8%** | ⚠️ Rotors are thinner than pads |
| 25 | `OIL-PTR-SYN5000-5W40-4L` | 1,060 | 1,580 | 32.9% | ⚠️ No anchor |
| 26 | `OIL-PTR-SYN5000-5W30-4L` | 1,000 | 1,490 | 32.9% | ⚠️ No anchor |
| 27 | `WIP-PIAA-RL16` | 699 | 1,000 | 30.1% | 🔴 Thin |
| 28 | `WIP-PIAA-AVF24` | 931 | 1,290 | 27.8% | 🔴 **Thin + low confidence on demand** |
| 29 | `BRK-FLUD-DOT4-1L` | 840 | 1,150 | **27.0%** | 🔴 **Thin.** And the owner may find a much cheaper local DOT 4 |
| 30 | `WIP-NWB-20` | 720 | 980 | **26.5%** | 🔴 **Thin + guessed cost** |
| 31 | `WIP-NWB-18` | 654 | 890 | **26.5%** | 🔴 **Thin** |
| 32 | `TYR-RDR-20555R16-SPRNT` | 2,364 | 3,090 | 23.5% | ✅ The best tyre line |
| 33 | `TYR-DST-18565R14-NKR201` | 1,986 | 2,590 | 23.3% | ✅ |
| 34 | `TYR-ARV-18565R14-ARZ1` | 1,503 | 1,950 | 22.9% | ✅ |
| 35 | `TYR-RDR-19565R15-SPRNT` | 2,202 | 2,850 | 22.7% | ✅ |
| 36 | `TYR-RDR-18565R15-SPRNT` | 2,080 | 2,690 | 22.7% | ✅ |
| 37 | `TYR-MMX-20555R16-MAP5` | 3,051 | 3,950 | 22.8% | 🟡 Brand not evidenced for EYG |
| 38 | `TYR-MIC-18565R15-XM2P` | 4,340 | 5,600 | 22.5% | ✅ |
| 39 | `TYR-MIC-18560R15-XM2P` | 3,661 | 4,700 | **22.1%** | 🔴 **THIN. No room. `minSellPrice` = 4,000** |
| 40 | `TYR-MIC-20555R16-XM2P` | 4,294 | 5,500 | **21.9%** | 🔴 **THIN. `minSellPrice` = 4,900** |
| 41 | `TYR-BFG-20565R16-ADVT` | 3,600 | 4,550 | 20.9% | ✅ |
| 42 | `TYR-BFG-26565R17-ADVT` | 6,902 | 8,600 | **19.7%** | 🔴 **THINEST LINE IN THE FILE, and it holds ₱6,902 per unit. `minSellPrice` = 7,300** |
| 43 | *(tools)* | — | 0 | — | not sold |

### 3.3 🔴 The five danger flags, in the order the owner should act on them

#### 🔴 DANGER 1 — Every tyre line is thin, and two are dangerously so

| Line | margin | Capital per unit | `minSellPrice` |
| --- | --- | --- | --- |
| `TYR-BFG-26565R17-ADVT` | **19.7%** | ₱6,902 | **7,300** |
| `TYR-MIC-20555R16-XM2P` | **21.9%** | ₱4,294 | **4,900** |
| `TYR-MIC-18560R15-XM2P` | **22.1%** | ₱3,661 | **4,000** |

> **Why this is not fixable by marking up.** ✅ `pricing-benchmarks.md` §7.1
> shows the Michelin lines sell online at **97% of their apparent SRP**. A Balanga
> shop cannot sell a Michelin Energy XM2+ in `205/55R16` above **₱6,315** and win
> the customer, and cannot make money at ₱4,900 either. **Michelin is a
> brand-and-service sale, not a price sale, and the shop's margin has to come
> from mounting, balancing and alignment — the confirmed services.**
> **If the owner wants margin on tyres, the answer is the Radar and Arivo lines,
> not a markup on Michelin.**

#### 🔴 DANGER 2 — Bridgestone and several other brands are ALREADY BELOW WATER

🔴 **I deliberately did not include any Bridgestone line, and here is the
arithmetic.** ✅ `pricing-benchmarks.md` §7.1: Bridgestone Ecopia EP300 sells
online at **74% of its compare-at price** — `205/55R16` at **₱5,410.88 against
₱7,312**. Bridgestone Potenza Adrenalin RE004 at **74%** too (₱5,192.58 vs
₱7,017). Same for Maxxis (81%), Deestone (82%), Radar (82%), Arivo (84%).

> **A line that a competitor in the Philippines sells online at 74% of SRP has no
> dealer margin left in it.** If the shop buys Bridgestone at 68% of SRP (which is
> what I assumed for everything), it would have to sell at ₱4,972 to beat the
> online price and would make **1.5%**. If it sells at ₱5,410 it loses the
> price comparison. **Bridgestone Ecopia and Potenza are dead lines for this shop
> and are excluded on purpose.** Same reasoning for Maxxis Mecotra (81%) — which
> is why `TYR-MMX-20555R16-MAP5` is `reorderQty 2`, not 4, and is flagged
> 🟡 *brand not evidenced for EYG*.

#### 🔴 DANGER 3 — The ICER brake margin rests on a promotional price

| Researched | Figure |
| --- | --- |
| partspro.ph **sell** price | ₱1,200 |
| partspro.ph **compare-at** price | ₱2,200 |
| Discount | **45%** |
| My assumed trade cost (60%) | ₱720 |
| My `sellPrice` | ₱1,250 |

If the shop can actually buy ICER Vios pads at ₱720, the 42% margin is real. **If
the true trade price is even 70% of the ₱1,200 promo — ₱840 — the margin falls to
33%. At 85% (₱1,020) it falls to 18%.** 🔴 **Two of the highest-volume brake rows
in this catalogue rest on one unverified purchase price.** Q-01.

#### 🔴 DANGER 4 — The battery margin is fictional without the core credit

✅ Amaron PH, first-party: the customer's old battery is worth money back to the
dealer. **The cost figures above do not subtract it.**

| Line | Margin as written | Margin if core credit = ₱800 | Margin if core credit = ₱1,500 |
| --- | --- | --- | --- |
| `BAT-AMR-GO-NS40` | 33.9% | **44.3%** | 51.5% |
| `BAT-AMR-JADE-DIN80AGM` | 40.5% | 47.5% | 53.5% |

> **The core credit is the entire battery business.** Without it the lines are
> ordinary; with it they are the best margin in the catalogue. And ✅ RA 7394
> **Art. 68(b)(3)** makes the shop *"subsidiarily liable"* if the manufacturer and
> distributor both fail to honour the warranty — *"the retailer shall shoulder
> the expenses and costs necessary to honor the warranty."* At ₱11,500 sell that
> is a real, uncapped tail exposure on the JADE AGM line.
> 🔴 **Owner decision required before that line is ordered. Q-05.**

#### 🔴 DANGER 5 — The whole oil block is unanchored

**Six rows. Four of them PETRONAS. Not one with a Philippine price.** 🔴 If
PETRONAS Syntium 5000 5W-30 4 L actually costs ₱1,600 to the shop rather than
₱1,000, and it sells at ₱1,490, **the shop loses ₱110 on every can it sells** —
and it will sell four a week. **Before the first oil order, the owner must have a
PETRONAS distributor price in his hand.** This is **Q-01** and it is the single
most important open question in the project.

### 3.4 🟢 The finding the owner should actually take away

**Tyres are 26% of the SKUs and carry the thinnest margin in the catalogue. Oil
is 14% and is unanchored. Together that is 40% of the rows and the whole of the
risk.**

Meanwhile: **7 filters + 6 brakes + 3 consumables + 2 accessories = 18 rows —
42% of the catalogue — carry a 38–47% margin, turn over in days, and cost almost
nothing in capital.**

> 🧠 **The shelf plan that follows from this is not "more tyres". It is: a
> shallow tyre wall (2–4 units per line, two tiers per size) and a deep, well-
> organised filter-and-brake shelf that a mechanic can find in four seconds.** A
> customer who needs a filter will wait. A customer whose car is on the lift and
> who was promised a tyre cannot. ✅ That asymmetry is the whole inventory
> strategy.

### 3.5 First-buy capital — the number the owner actually needs

**`SUGGESTED — REQUIRES OWNER CONFIRMATION`.** Ordering one `reorderQty` of every
sellable row:

| Kind | Rows | Approx. cost at `costPrice` | Approx. retail at `sellPrice` |
| --- | --- | --- | --- |
| TYRE | 11 | **₱96,764** | ₱124,100 |
| OIL | 6 | **₱37,680** | ₱57,280 |
| FILTER | 7 | **₱23,286** | ₱40,980 |
| BRAKE | 6 | **₱44,724** | ₱74,520 |
| BATTERY | 4 | **₱22,680** | ₱35,750 |
| WIPER | 4 | **₱26,268** | ₱36,180 |
| TYRE_ACCESSORY | 2 | **₱1,839** | ₱3,540 |
| CONSUMABLE | 3 | **₱7,200** | ₱12,180 |
| **TOTAL (sellable)** | **43** | **≈ ₲260,600** | **≈ ₱384,500** |
| Blended margin | | | **≈ 32%** |

🔴 **Tyres alone are 37% of the first buy** and the thinnest-margin block. If the
owner cannot fund ₱260,000, **cut tyres first** — halve every tyre `reorderQty`
to 2 and the first buy drops to roughly **₱215,000** with almost no loss of
assortment.

---

## 4. `ServicePartRequirement` — the bill of materials this catalogue implies

**`SUGGESTED`.** Built from ✅ the ten confirmed services in `site.ts` and ✅ the
consumption analysis in `tyre-and-parts-landscape.md` §1.1.
🔴 **`isBlocking` is the single most consequential value in this table.**

| Service | Product | qtyPerService | isBlocking | Why |
| --- | --- | --- | --- | --- |
| Preventive Maintenance Service | `FLT-OIL-ACD-YZZE1` | 1 | **true** | The car does not leave without it |
| Preventive Maintenance Service | `FLT-OIL-ACD-INNOVA` | 1 | **true** | For Innova/Hilux/van bookings |
| Preventive Maintenance Service | `FLT-OIL-ACD-CIVIC` | 1 | **true** | For Civic bookings |
| Preventive Maintenance Service | `FLT-OIL-ACD-XPANDER` | 1 | **true** | For Xpander bookings |
| Preventive Maintenance Service | `FLT-OIL-ACD-ACCENT` | 1 | **true** | For Accent bookings |
| Preventive Maintenance Service | `FLT-OIL-ACD-SUZUKI` | 1 | **true** | For Ertiga/Swift bookings |
| Preventive Maintenance Service | oil (see below) | **varies by engine** | **true** | 🧠 Litres are vehicle-specific. **See Q-02 — the schema cannot express this** |
| Preventive Maintenance Service | `FLT-AIR-ACD-INNOVA` | 1 | **false** | 🟢 Never hold a PMS for an air filter |
| Preventive Maintenance Service | `CON-BRKCLN-BDX-500` | 1 | **false** | Cheap, fast-moving |
| Preventive Maintenance Service | `CON-GRS-MP3-1KG` | **0.02** | **false** | 🟡 A PMS uses grams of grease, not kilograms. **This is the `KG` unit's purpose and it is a real modelling problem. Q-02** |
| **Change Oil** | oil | **varies** | **true** | The entire service |
| **Change Oil** | oil filter | 1 | **true** | The entire service |
| **Brake Cleaning and Maintenance** | `CON-BRKCLN-BDX-500` | 1 | **true** | It *is* the consumable |
| **Brake Cleaning and Maintenance** | `BRK-FLUD-DOT4-1L` | **0.1** | **false** | A top-up, not a service requirement. 🔴 **DOT 3/4 vs DOT 5.1 must not be mixed** |
| **Brake Pad Replacement** *(⚠️ may not exist as a separate service — Q-20)* | brake pad line | 1 | **true** | 🔴 Safety-critical |
| **Wheel Balancing** | `CON-GRS-MP3-1KG` | 0.01 | **false** | 🟡 **Balancing weights are NOT modelled.** See §4.1 |
| **Tire Mounting and Repair** | tyre line (by vehicle) | 1 | **true** | The service *is* the tyre |
| **Tire Mounting and Repair** | `TAR-VALV-CAP-100` | 0.01 | **false** | 🧠 A bag per ~100 caps. Fractional on a bag. **Q-02** |
| **Tire Mounting and Repair** | `TAR-SEAL-450ML` | 1 | **false** | Optional |
| **Battery Replacement** | battery line (by group size) | 1 | **true** | The service *is* the battery |
| **Nitrogen Tire Inflation** | **NONE** | — | — | 🔴 **No product. Nitrogen is made on the premises from `TOL-N2GEN-2X`** |
| **Underchassis Maintenance and Repair** | `CON-GRS-MP3-1KG` | 0.02 | **false** | Grease only |
| **Wheel Alignment and Camber Correction** | **NONE** | — | — | Labour and a machine. No consumable |
| **OBD Scanning and Resetting** | **NONE** | — | — | No consumable |

### 4.1 🔴 What the BOM cannot yet express, ranked by damage

| # | Gap | Damage | Ask |
| --- | --- | --- | --- |
| 1 | 🟠 **Oil quantity per vehicle is vehicle-specific** (`qtyPerService Int`) | A 1.3 Vios needs ~3.3 L; an Innova 2.0 needs ~4.5 L. `ServicePartRequirement` has one integer per service. **A "Preventive Maintenance Service" booking cannot know how much oil to reserve** | **Q-02, BLOCKING** |
| 2 | 🟠 **No oil volume attribute on `Product`** | The mechanic cannot know a 4 L can holds 4 L | **Q-02, BLOCKING** |
| 3 | 🟡 **No oil product per viscosity grade, per service** | Which oil goes with which service is vehicle- and owner-choice | **Q-02** |
| 4 | 🟡 **Balancing weights are not modelled** | ✅ Wheel Balancing is a confirmed service and it consumes them | **Q-08 — deliberate gap, documented, not an oversight** |
| 5 | 🟡 **Fractional quantities on bag/pail units** | `qtyPerService: 0.02` on a 1 kg grease pail is honest but weird | **Q-02** |
| 6 | 🔴 **One `dotCode` per tyre `Product`** | FIFO and honest clearance are impossible | **Q-13, BLOCKING for A6** |

---

## 5. Open items in this file — the flat list

**Every peso figure below is an estimate awaiting owner confirmation. These are
the numbers the orchestrator must turn into a sign-off sheet.**

### 5.1 Blocking — the catalogue is not orderable without these

| ID | What | Rows affected |
| --- | --- | --- |
| **Q-01** | 🔴 **A PETRONAS distributor price list.** No PH price exists in any source I could reach. | 4 of 6 OIL rows |
| **Q-09** | 🔴 **The real trade-discount factor per category** (`pricing-benchmarks.md` §6). Every costPrice is `online retail × factor`. | all 43 sellable rows |
| **Q-01** | 🔴 **One real ACDelco/VIC invoice.** 7 filters + 6 brakes rest on an assumed 0.62/0.60 trade factor | 13 rows |
| **Q-01** | 🔴 **One real tyre distributor invoice.** Every tyre margin rests on an assumed 0.68/0.78 factor | 11 rows |
| **Q-03** | 🟠 **Radar Renegade R/T+ `265/65R17` price** — ✅ EYG confirmed selling it; TireDepot returned 404 | `TYR-BFG-26565R17-ADVT` substitute |
| **Q-04** | 🟠 **Genuine OEM vs equivalent filters** — the catalogue stocks equivalent only | all 7 FILTER rows |
| **Q-05** | 🔴 **Battery core credit per group size, and whether the owner accepts Art. 68(b)(3) subsidiarily-liability exposure** | all 4 BATTERY rows |
| **Q-06** | 🟠 **How the core credit is recorded** — `costPrice` is a single `Int` | all 4 BATTERY rows |
| **Q-13** | 🔴 **`dotCode` per product vs per lot** — blocks the DOT clearance campaign | all 11 TYRE rows |

### 5.2 Non-blocking — needed before the item is sold

| ID | What | Rows |
| --- | --- | --- |
| **Q-07** | Is undercoating / rustproofing / AC actually a service? | `CON-COOL-LL-GRN-10L` |
| **Q-08** | Balancing weights, valve cores: what does the shop actually buy? | not modelled |
| **Q-09** | The `tradeDiscountFactor` table in `pricing-benchmarks.md` §6 — is it close? | all 43 sellable rows |
| **Q-10** | Is **Total** oil sold in this area at all? The brief assumed it is | OIL range |
| **Q-11** | **ACCRA** — the petroleum industry representative's terms, which govern fuel-station pricing of oil | all OIL rows |
| **Q-12** | Engine-oil shelf life in a **Philippine** brand's datasheet (none published) | OIL `shelfLifeDays` |
| **Q-17** | 🟠 Is "on order" (PO placed, not yet received) visible anywhere? No field exists | A6's "tell me when it lands" |
| **Q-18** | 🔴 **Is the shop labelling parts?** An unlabelled box + no scanner = the mechanic reads a part number off nothing. AP-17 | all 7 FILTER + 6 BRAKE rows |
| **Q-19** | Default `isActive` for anything not tied to a confirmed service | `CON-COOL-LL-GRN-10L`, `WIP-PIAA-AVF24`, `WIP-NWB-20` |
| **Q-20** | 🟠 **Is "Brake Pad Replacement" a separate service from "Brake Cleaning and Maintenance"?** ✅ Only the latter is on the confirmed list | the entire BRAKE block |
| **Q-21** | 🟠 **Tool asset values** — all five are guesses and the owner knows his own machines | 5 TOOL rows |
| **Q-22** | 🟡 `TAR-VALV-CAP-100` cost — no anchor exists at all. Buy a bag and count | 1 row |
| **Q-23** | 🟡 `WIP-NWB-20` — no 20" NWB price found. Neither 18" nor 24" is a real anchor for it | 1 row |
| **Q-24** | 🟡 Does the **air filter** `FLT-AIR-ACD-INNOVA` actually fit the Innova and the Hilux? At ₱521 cost, a wrong guess is expensive | 1 row |
| **Q-25** | 🟡 Is **Maxxis** a brand the shop carries? Not on the confirmed or the shop-claimed list | `TYR-MMX-20555R16-MAP5` |
| **Q-26** | 🟡 **How many service bays does he actually run?** `BOOKING.capacityPerSlot: 1` is `[UNVERIFIED]` in `site.ts` and it parameterises the whole slot race | inventory demand assumptions |
| **Q-27** | 🟡 Supplier lead times in days, per supplier — every `reorderPoint` assumes a lead time and I guessed | all 43 sellable rows |

---

## 6. One-paragraph version

Forty-three things this shop could plausibly sell and five machines it owns, with
every peso marked as a guess because that is what it is — I found real prices for
everything except the oil, and the oil is the shop's own confirmed brand. The
ordering that falls out of the margins is not the one anyone expects: the tyres
are the thinnest-margin, capital-heaviest, most price-checked block in the file,
with two Michelin lines at 22% and a 265/65R17 sitting at 19.7% on six thousand
nine hundred pesos of capital per unit, while a hundred-and-thirty-peso oil filter
at forty per cent is the safest money on the shelf. Two traps are named and
priced: Bridgestone Ecopia and Potenza sell online at seventy-four per cent of
list price in the Philippines today, which means there is no dealer margin left
in them and I left them out on purpose; and the Amaron battery margins are
fiction unless the shop captures the core credit on the customer's old battery,
which the brand's own website says it should. And the one thing I cannot fix is
the shelf: I cannot label forty-three boxes, and a mechanic standing at an
unlabelled box reading a part number off nothing is the failure that no schema
prevents.
