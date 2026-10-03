# Service Catalogue — EYG Tire & Auto Care

**Owner:** research agent · **Compiled:** 2026-10-02
**Upstream:** `docs/research/facebook-intel.md` §2.3 (verified service list) ·
`docs/research/legal-compliance-ph.md` §4 (price-representation rules) ·
`docs/research/risks-dos-donts.md` §6 (shop-floor protocol)

---

## 🚨 READ BEFORE YOU BUILD `/services`

### 1. Every price in this file is a GUESS

> ### ⚠️ `SUGGESTED — REQUIRES OWNER CONFIRMATION`
>
> **EYG has never published a single price.** Not on Facebook, not in any directory, not
> in any post. The confirmed fact is the *absence* of prices
> (`facebook-intel.md` §2.9).
>
> **Every PHP figure below is a Philippine-industry estimate I constructed.** Not one is
> EYG's. They exist so the page has a shape to be reviewed against — **not** so they can
> be shipped.
>
> **Publishing a price is a legal representation, not a formatting decision**
> (`legal-compliance-ph.md` §4.3). The low end of every range must be genuinely payable.
> The variable that moves the price must be named. **No price goes live until the owner
> signs off the whole table at once.**

### 2. Only 10 of these 20 services are verified

The Facebook service list is **confirmed verbatim** (`facebook-intel.md` §2.3). The other
ten come from the orchestrator's brief and are marked accordingly.

| Verified | In the brief, **not** verified |
|---|---|
| Preventive Maintenance Service · Change Oil · Brake Cleaning and Maintenance · Underchassis Maintenance and Repair · Wheel Alignment and Camber Correction · Wheel Balancing · Tire Mounting and Repair · Nitrogen Tire Inflation · Battery Replacement · OBD Scanning & Resetting | Engine Tune-Up · AC Repair · Shock Absorbers · CVL / Bushings · Glass · Roadside Assistance · Tyre Sales (stock) · Tyre Rotation · Undercoating · Motorcycle Service |

**Plus two individually evidenced jobs** (real, photographed):
**Steering Rack Assembly replacement** and **AGM battery installation**.

### 3. The three hard bans

| 🚫 Ban | Reason |
|---|---|
| **No "undercoating" until confirmed** | The verified service is *"Underchassis Maintenance and Repair"* — a **different thing**. Yet undercoating is a strong Bataan category (Subic, Baguio, Cubao trips), which is exactly why faking it gets found out. `seo-keywords.md` Cluster F |
| **No "24/7 roadside" copy at all** | Zero evidence it exists, and it is attached to a **safety scenario**. `risks-dos-donts.md` §5 |
| **No brand badges beyond Michelin + BFGoodrich** | `tireBrands` in `site.ts` lists 5 unevidenced brands. `facebook-intel.md` §2.7 |

### 4. Structural requirements for every service block

- **Name:** the shop's own words, **Title Case**, in the shop's own order (D2)
- **One-line summary:** what it is, in one sentence
- **4–6 bullets "What's included"** — the work actually performed
- **3–4 bullets "What's not included"** — 🔴 **the differentiator, and the legal shield** (`risks-dos-donts.md` D4)
- **Duration:** a **realistic range**, not a best case
- **Price range in PHP**, with the **variable that moves it named**, marked `SUGGESTED`
- **`pricing` mode** per `ServiceDto` in `src/lib/types.ts`: `FIXED` · `RANGE` · `CALL_FOR_PRICE`
- **A "needs owner confirmation" flag** where applicable

---

# CATEGORY 1 — TIRES & ALIGNMENT

*These are the services that earned the business.*

---

## 1.1 Tire Mounting and Repair ✅ VERIFIED

**One-line:** Fit new tyres to your rims, and patch or replace what can be safely repaired.

**What's included**
- New tyre fitted to the rim
- Valve inspected and replaced if worn
- Wheel nuts torqued to the manufacturer's specification
- Tyre pressure set to the door-jamb placard value — **not** a generic number
- Spare tyre checked if accessible
- Old tyre returned to you

**What's not included**
- Wheel balancing (separate service, listed below)
- Alignment — recommend it after any tyre change
- Rim repair or refurbishment
- Tyre disposal, unless agreed and priced in advance

**Duration:** 20–40 min per wheel · 45–90 min for a full set of four
**Pricing:** `RANGE` · labour only

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Mounting & fitting: **₱150–₱350 per wheel** (₱600–₱1,400 for four)
> Tyre repair / patch: **₱250–₱500** per tyre
> **Industry note:** Philippine shops commonly bundle mounting into the tyre price. EYG's
> verified stock posts advertise tyres by size with no fitting price shown
> (`facebook-intel.md` §2.11.3) — so **whether EYG quotes mounting separately is an open
> question**, and it materially changes what a customer compares. Confirm.

**🔴 Owner confirmation needed:** separate or bundled? Disposal fee? Free or charged?

---

## 1.2 Wheel Balancing ✅ VERIFIED

**One-line:** Balance each wheel so it spins evenly and stops the vibration through the steering wheel.

**What's included**
- Every wheel removed and spin-balanced
- Weight check on each tyre and wheel
- Weights replaced where worn
- Tyre pressures re-set after refitting
- Test drive to confirm the vibration is gone

**What's not included**
- Wheel alignment — a vibration can also be alignment, and we will tell you if it is
- Wheel or tyre damage caused by a previous impact
- Hunter-style road-force balancing (a higher-spec process — ask if you need it)

**Duration:** 25–45 min for four wheels · up to 60 min for large truck/SUV rims
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Standard balance: **₱100–₱200 per wheel** (₱400–₱800 for four)
> **Variable:** rim size and whether the wheel is steel or alloy. Truck and bus rims cost
> more and take longer.
> **Industry note:** balancing is the classic add-on in the bait-and-switch sequence. **EGY
> must quote it up front, not at handover** (`risks-dos-donts.md` §3.2, D5). A 20-inch
> alloy set can be 2–3× a 15-inch steel set — which is exactly why the range needs a
> named variable.

**🔴 Owner confirmation needed:** per-wheel or per-set pricing? Alloy surcharge?

---

## 1.3 Wheel Alignment and Camber Correction ✅ VERIFIED

**One-line:** Set all four wheels to the manufacturer's alignment specification, including camber.

**What's included**
- Four-wheel alignment on a computerised rack
- Camber and caster checked and corrected
- Toe measured front and rear
- A printed before-and-after specification sheet
- Written confirmation if anything could not be brought into spec

**What's not included**
- Parts: tie rods, ball joints, rack ends, bushings, control arms
- Any suspension repair
- Shocks or struts
- CVL / axle work
- Alignment after a major suspension or steering repair — often needs doing twice

**Duration:** 45–75 min · allow 90 min if a component is worn
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Four-wheel alignment: **₱700–₱1,500** (some shops quote **₱1,200–₱2,000** for
> computerised camber-and-caster)
> **Variable:** 2-wheel vs 4-wheel; whether camber and caster correction is included; SUV
> and truck height
> **Industry note:** Philippine pricing is genuinely split — many shops advertise a cheap
> "front alignment" and quote full 4-wheel on the car. **If EYG does 4-wheel, say 4-wheel
> and price it as 4-wheel.** That is a real differentiator against shops still doing
> 2-wheel. **The verified Facebook list says "Wheel Alignment and Camber Correction"**,
> which implies a computerised rack with camber — so the higher band is the honest one.
> **EGY has a real photographed alignment job on a Toyota Hilux FX**
> (`facebook-intel.md` §2.11.3) — real proof, for this exact service.

**🔴 Owner confirmation needed:** 2W or 4W? Is the rack computerised? Price for SUVs/trucks?

---

## 1.4 Nitrogen Tire Inflation ✅ VERIFIED

**One-line:** Fill your tyres with nitrogen instead of air — slower pressure loss and better fuel economy.

**What's included**
- Valves inspected; nitrogen-compatible valves fitted where needed
- Nitrogen filled to the correct pressure
- Pressure re-checked after the tyres heat up on the road
- A sticker on the door jamb recording the nitrogen pressures
- Top-up included on the same visit

**What's not included**
- **The cost of the nitrogen itself is separate** — it is sold per tyre
- Valve replacement on a wheel that needs a new rim
- Pressure sensors (TPMS) — fit, and reset on request

**Duration:** 10–20 min for four tyres
**Pricing:** `CALL_FOR_PRICE` — **the charge is per litre, and it moves with cost**

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Nitrogen: **₱80–₱180 per tyre**, or **₱300–₱700 for a full set**
> **Variable:** rim size — a truck or bus tyre holds far more gas and costs more to fill.
> **Industry note:** nitrogen is a **very common bait-and-switch in the Philippine tyre
> trade** because the "free nitrogen with your new tyres" offer quietly becomes a
> per-tyre charge at handover. **EGY must state the per-tyre nitrogen price before the
> work, on the job order.** This is a specific, high-value honesty signal for a Bataan
> shop whose competitors do not publish prices at all.

**🔴 Owner confirmation needed:** per tyre or per set? Free with a tyre purchase, or
always charged? Do you top up free on the same visit?

---

## 1.5 Tire Sales ✅ STOCK CONFIRMED · pricing `CALL_FOR_PRICE`

**One-line:** Tyres in stock, from 185/65-14 up to truck and SUV sizes.

**What EYG has actually been verified selling** (`facebook-intel.md` §2.7, §2.11.3)

| Size | Product | Evidence |
|---|---|---|
| `265/65R17` | **Radar Renegade R/T+** | Stock post 2024-09-22 + product photo |
| `11R22.5` | **Blacklion Mix** | Stock post 2024-09-10 (single unit, SOLD) |
| `185/65-14` | **Deestone** | Stock post 2024-09-10 (SOLD) |
| — | **PETRONAS engine oil** | Post 2026-05-02 |
| — | **Amaron Jade AGM** batteries | Post 2026-08-07 |

**Brands — the only ones that may be printed**

| Brand | Status |
|---|---|
| **Michelin** | ✅ **VERIFIED** — listed in the official Michelin Philippines dealer locator |
| **BFGoodrich** | ✅ **VERIFIED** — listed in the official BFGoodrich Philippines dealer locator |
| PETRONAS (oil) · Amaron (batteries) | ✅ Confirmed stocked, with photographs |
| Radar · Blacklion · Deestone | ✅ Confirmed stocked, with photographs |
| Blackhawk · Arivo · MRF | ⚠️ Self-claimed on the older FB page only — **UNVERIFIED** |
| **Bridgestone · Goodyear · Dunlop · Maxxis · Yokohama** | ❌ **NO EVIDENCE — DO NOT PRINT.** Currently in `site.ts`; must be removed |

> **The strongest single sentence EYG can write, and it is checkable:**
> **"A listed Michelin and BFGoodrich dealer in Bataan."**
> Anyone can verify it. No local competitor can say it.
> 🚫 **Never** "authorised dealer", "official dealer", "accredited", or "franchise" — a
> dealer-locator record is a dealer record (`legal-compliance-ph.md` §1.2, N32).

**🔴 The completeness rule.** 🔴 **EGY must quote the COMPLETE INSTALLED price** — tyre +
mounting + balancing, ideally the valve, in **one number** — whenever a customer asks for a
tyre. This single practice removes the industry's defining accusation from EYG's
transactions (`risks-dos-donts.md` D5, `legal-compliance-ph.md` §4.4). If fitting is
charged separately, say so in the same breath: *"₱4,500 the tyre, plus ₱400 fitting, total
₱4,900."*

**`pricing: CALL_FOR_PRICE`** — tyre pricing is per size, compound and brand, and there
is no honest flat range. Publish the **size lookup** and the **brand list** instead, and
let the customer quote themselves. That is more useful than a range and it cannot be
wrong.

**🔴 Owner confirmation needed:** the full current stock list and brand range; whether EYG
can order any size in; whether there is a fitting charge on top of the tyre.

---

## 1.6 Tire Rotation ⚠️ NOT VERIFIED — needs owner confirmation

**One-line:** Move the tyres front-to-back and swap sides to even out the wear.

**What's included**
- Four tyres rotated per the manufacturer's pattern (typically front-to-rear and
  side-to-side)
- Pressures re-set
- A note of the wear pattern we found

**What's not included**
- Balancing — usually worth doing at the same time
- Alignment
- A repair to a tyre that is worn past its limit — we will tell you, not sell you

**Duration:** 20–40 min · 45–60 min for large tyres
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Rotation: **₱200–₱500** (many shops include it free with a balance)
> **Industry note:** rotation is commonly bundled with balancing, and buyers should ask
> whether it is included. **It is rarely advertised in the Philippines**, which is a
> genuine opportunity — but EYG's list does not mention it, so it may not be a service
> EYG offers. **Ask.**

**🔴 Owner confirmation needed:** offered at all? Priced separately or bundled?

---

# CATEGORY 2 — PREVENTIVE MAINTENANCE

---

## 2.1 Preventive Maintenance Service (PMS) ✅ VERIFIED

**The flagship service.** Service #1 on EYG's own list.

**One-line:** A scheduled service at a set interval — oil, filters, checks, and a report on
what your car actually needs.

**What's included**
- Engine oil drained and replaced to the correct grade and volume
- Oil filter replaced
- **A full multi-point inspection** with a written checklist
- Brake pad and disc thickness measured and reported
- Tyre tread depth measured and reported
- Fluid levels topped up (brake, coolant, washer)
- Battery and charging system tested
- Drive belt and hose condition checked
- Air filter condition assessed
- **A written report with anything that needs attention flagged** — not just the urgent things

**What's not included**
- 🔴 **Parts beyond the oil filter** — air filter, spark plugs, brake pads, belts, hoses
  and wipers are quoted separately
- 🔴 **Coolant, brake fluid or transmission fluid change** unless included
- 🔴 **Any repair.** We report it; you decide
- Wheel alignment and balancing
- Undercarriage wash
- Cabin or fuel filter

**Duration:** 1.5–2.5 hours for most cars · 3+ hours if anything is found
**Pricing:** `RANGE` · **this is the single most important price on the site**

> ### **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
>
> **Basic PMS (conventional oil + filter):** **₱1,200–₱2,500**
> **PMS with synthetic oil:** **₱2,500–₱5,500**
> **PMS with full synthetic:** **₱4,000–₱8,000**
>
> **Variables that move the price — state these on the page:**
> 1. **Oil type** — conventional, synthetic blend, or full synthetic. The single biggest
>    driver, and the one customers most often do not understand
> 2. **Vehicle** — engine size, and whether it needs a larger oil filter
> 3. **Anything found during the inspection** — quoted separately, never added silently
>
> **Industry note.** ₱1,200–₱2,500 is the widely-quoted basic band for a compact car in
> the Philippines and matches the orchestrator's guidance. Synthetic is materially higher
> and the gap is the main source of "the shop charged me more than the quote" complaints —
> **so the oil grade must be named in the advert, not discovered at the counter.**
> 🔴 **If EYG's real PMS is at the top of the range, say so. If it is below it, say that
> instead. A shop that publishes ₱1,200 and quotes ₱2,400 is doing the exact thing this
> project exists to avoid.** The two numbers must be reconcilable.

**Duration realism.** Overpromising time is a named complaint trigger
(`risks-dos-donts.md` §6). An honest *"2–3 hours"* that takes 3 is not a complaint. An
advertised 1 hour that takes 3 is.

**🔴 Owner confirmation needed:** what is the *base* PMS at EYG, in pesos, for a typical
compact car? Which oil grades do you stock? Does the price include a written inspection
report? Is a labour bay charge separate?

---

## 2.2 Change Oil ✅ VERIFIED

**One-line:** Engine oil and filter replaced, with a multi-point check at the same time.

> ⚠️ **Relationship to PMS.** "Change Oil" and "Preventive Maintenance Service" are
> **both** on EYG's verified list as **separate items**. That is normal — many shops offer
> oil-only as a cheaper entry point. **The page must make the distinction explicit, or the
> customer will not know which one they are booking.** Do not quietly merge them, and do
> not quietly list the same thing twice.

**What's included**
- Engine oil drained and replaced to the correct grade and volume
- Oil filter replaced
- Oil level checked cold and hot
- A look for leaks around the sump, oil filter housing and the dipstick
- Fluid levels topped up
- **A written note of anything we noticed**

**What's not included**
- **Oil cost is separate** — you may bring your own oil, or buy from us
- Oil filter beyond the one
- Any other service
- A full multi-point inspection, unless the PMS is booked

**Duration:** 30–60 min
**Pricing:** `RANGE` — labour, with oil either supplied or customer-supplied

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Labour only: **₱300–₱600**
> With conventional oil + filter supplied: **₱900–₱1,800**
> With synthetic oil + filter: **₱1,800–₱3,500**
>
> **Variables:** oil grade · engine size / oil volume · whether the customer supplies
>
> **Industry note:** "change oil" labour in the Philippines is commonly quoted at
> **₱200–₱500**, with the oil as a separate line. **Whether EYG allows customer-supplied
> oil is a real policy question** — many shops do, some refuse it on warranty grounds, and
> **publishing which one EYG does is a genuine trust signal.** Confirm.

**🔴 Owner confirmation needed:** labour fee · can customers bring their own oil? · which
brands do you stock? · Is oil included in the "Change Oil" price or listed separately?

---

## 2.3 Engine Tune-Up ⚠️ NOT VERIFIED — needs owner confirmation

**One-line:** A deeper diagnostic pass to find and fix a misfire, rough idle, or a loss of
power.

**What's included**
- Full diagnostic scan and live-data review
- Spark plugs inspected and replaced
- Ignition coils tested
- Throttle body and air intake cleaned
- Fuel injector cleaning
- PCV / emissions valves checked
- A written report of what was found and what was done

**What's not included**
- Injector replacement
- Coil replacement beyond what is included
- Turbocharger, fuel pump or catalytic work
- **Head gasket, timing chain or major internal work** — a different job entirely
- Engine rebuild

**Duration:** 2–4 hours, and it can go longer. Honest ranges matter more than optimistic ones here
**Pricing:** `CALL_FOR_PRICE` — genuinely job-specific

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Basic tune-up (plugs + basic diagnostics): **₱1,500–₱3,500**
> Full tune-up incl. injectors and intake cleaning: **₱3,000–₱7,000**
> **Variable:** engine size · number of cylinders · how long the car has been neglected
> **Industry note:** tune-ups are quoted per job in the Philippines, not per hour, because
> the scope genuinely varies. **Publishing a single number invites the customer to arrive
> expecting that number.** A range with the variable named is honest; a single figure is not.

**🔴 Owner confirmation needed:** is tune-up offered? What is included at the entry price?
Do you do injection cleaning, and is it priced separately? Diagnostic fee — is there a
charge, and is it deducted if you proceed with the work?

---

## 2.4 OBD Scanning & Resetting ✅ VERIFIED

**One-line:** Read the car's own diagnostic computer, and clear codes once the fault is fixed.

**What's included**
- Full OBD-II scan across all modules
- Stored, pending and permanent fault codes read and **explained in plain language**
- Live-data review while the engine runs
- A **printed report you keep** — this is the most important part
- **Clearing codes after the repair**, plus a road test to confirm the fix

**What's not included**
- 🔴 **Diagnosing and fixing the underlying fault** — scanning tells you what is wrong, not
  what to do
- Part replacement
- A labour fee if you choose not to proceed (see below)
- Sensor calibration or coding

**Duration:** 20–40 min
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Scan with printed report: **₱300–₱800**
> Some shops charge a **diagnostic fee of ₱500–₱1,500** and deduct it from the repair bill
> if you proceed — **a practice worth adopting, and worth publishing.**
>
> **Industry note:** the "fee waived if you proceed" model is a genuine trust device that
> the local market does not use, because **nobody in Balanga publishes anything at all**
> (`competitors.md` §3). **If EYG does this, it is a standout, and it should be on the
> page in those words.**

**Why this matters disproportionately for EYG.** OBD is a **real, photographed capability**,
it is cheap to deliver, and it produces a **tangible artefact — a printed report the
customer keeps.** That artefact is a reason to come back and a reason to recommend the shop.
**It is the cheapest trust device in the catalogue.**

**🔴 Owner confirmation needed:** fee · is it deducted from the repair? Do you print a
report? Do you offer a free pre-check?

---

## 2.5 Brake Cleaning and Maintenance ✅ VERIFIED

**One-line:** Clean, lubricate and adjust the braking system, and measure what is left.

**What's included**
- Brake pads and discs measured and reported with actual millimetres
- Caliper cleaned
- Brake dust and corrosion cleaned from the disc face
- Slider pins lubricated
- Handbrake cable and mechanism checked and adjusted
- Brake fluid level and condition checked
- New pads and/or discs fitted if requested
- **Caliper and disc hardware inspected for play, rust and scoring**

**What's not included**
- 🔴 **Brake fluid replacement** — a separate fluid service, on its own interval
- Disc machining or re-surfacing
- Caliper or caliper bracket replacement
- ABS repairs
- Handbrake cable replacement
- Line or hose replacement

**Duration:** 1–2 hours for pad replacement, both sides · longer if discs are involved
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Brake cleaning / service (labour): **₱500–₱1,200**
> Pad replacement, front or rear, labour only: **₱800–₱1,800** per axle
> Discs, pads and hardware fitted: **₱3,000–₱6,500** per axle
>
> **Variables:** front or rear · disc machining · vehicle make and model (some have
> expensive rear discs) · whether hardware and shims are included
> **Industry note:** **rear disc replacement is the classic Philippine bait-and-switch.**
> A customer comes in for front pads and is told the rears are worse. Sometimes true —
> often not. **The rule that protects EYG: measure and report both axles in writing, then
> let the customer decide.** Never add a rear axle that was not agreed
> (`risks-dos-donts.md` §3.2). **A local competitor, FB-M Brake and Clutch Bonding
> Services, already trades on brakes** (`competitors.md` §1.2) — so if EYG does brake
> work it should do it *better*, not just do it.

**🔴 Owner confirmation needed:** labour rates per axle · discs included or not · is
hardware and shims included? Do you do brake fluid?

---

# CATEGORY 3 — UNDERCOATINGS & PROTECTION

---

## 3.1 Underchassis Maintenance and Repair ✅ VERIFIED

**The verified service.** Note carefully what this is **not**.

**One-line:** Clean, inspect, treat and repair the underside of the car — rust, leaks,
and worn components.

**What's included**
- Car on a hoist or ramp for full underbody access
- Underbody washed down and degreased
- Visual inspection photographed, covering: fuel tank, exhaust, driveshaft, subframe,
  suspension links, steering and brake lines
- **Rust treatment and surface protection** on sound surfaces
- Photo evidence of what was found
- Written report with photos

**What's not included**
- 🔴 **Undercoating** — see §3.2. This is a **different service** and EYG's verified list
  does not include it
- Rust perforation repair or panel welding
- Structural or chassis cutting
- Replacing rusted-through components — quoted separately
- Engine, gearbox or differential repair

**Duration:** 1.5–3 hours
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Underchassis clean, inspect and treat: **₱1,500–₱4,000**
>
> **Variables:** vehicle size and ground clearance · extent of rust · whether a hoist or
> a ramp is used · whether anti-rust coating is included
> **Industry note:** underchassis work is priced on condition as much as on vehicle, so a
> range is honest and a single price is not. **The photo evidence is the trust device** —
> a customer who has never seen their own fuel tank cannot verify the claim, but a customer
> who has been *shown* it can.

**⚠️ Handling question — 🚨 HIGHEST-PRIORITY CONFIRMATION ITEM.** The orchestrator's brief
requires `/services` to include **undercoating**. The verified Facebook list says only
*"Underchassis Maintenance and Repair."* **These are genuinely different services**:
undercoating is an applied protective coating for road salt, mud and trips; underchassis
maintenance is inspection, cleaning, rust treatment and repair.

**Ask the owner: does EYG do undercoating?** If yes, add §3.2 with real prices. If no,
keep the undercoating SEO cluster **unwritten** (`seo-keywords.md` Cluster F) and answer
the undercoating question honestly in the FAQ — an honest *"not yet, but here's what we do
cover"* still converts.

---

## 3.2 Undercoating 🚫 **NOT CONFIRMED — DO NOT PUBLISH** ⚠️

**Status: 🚨 BLOCKED pending owner confirmation.** Included here so the shape is ready if
the answer is yes, and so nobody invents it from the orchestrator's brief.

**If confirmed, this would be:**

**One-line:** A sprayed protective coating on the underside and, optionally, wheel arches —
protection against road salt, mud, and the Bataan–Baguio and Bataan–Cubao climbs.

**Would include**
- Full underbody wash, degrease and dry
- Rust treatment on sound surfaces
- Masking of suspension, exhaust, and electrical components
- Multi-coat application, with cure time between coats
- Optional wheel-arch and sill coverage
- **Photo evidence before and after**

**Would not include**
- Rust perforation repair
- Chassis welding
- Painting — a cosmetic service, different again
- Engine bay, underbody *scraping*, or bare-metal rust removal
- Any structural work

**Duration:** 4–8 hours, and it needs the car overnight or most of a day
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION — DO NOT PUBLISH UNTIL THE SERVICE
> IS CONFIRMED`**
> Basic undercoating (single layer, no arch): **₱3,500–₱6,000**
> Multi-coat with wheel arches: **₱6,000–₱12,000**
> **Variables:** vehicle size and length · number of coats · wheel-arch inclusion · extent
> of rust preparation
> **Industry note:** the orchestrator's ₱3,500–₱6,000 band is consistent with
> Philippine market rates for a single-layer treatment. **Buyers in this category are
> unusually specification-literate** — they will ask about film thickness, whether the
> subframe was cleaned first, and whether it affects any warranty. **A vague answer loses
> the sale; a specific one wins it.** If EYG does this, answer all three in public.

**🔴 Owner confirmation needed, before any of this is written:** does EYG offer
undercoating at all? What is the actual process — single coat or multi? Are wheel arches
included? Do you do it in-house or sub-contract? **Is the car in-house overnight?**

---

# CATEGORY 4 — ELECTRICAL & BATTERY

---

## 4.1 Battery Replacement ✅ VERIFIED

**One-line:** Test the battery and the charging system, then fit the right replacement.

**What's included**
- Battery load-tested, and the **result reported to you**
- **Charging and starting system tested** — alternator output, voltage drop, starter draw
  — because a new battery on a bad alternator dies in weeks
- Old battery removed
- New battery fitted, terminals cleaned and protected against corrosion
- Battery tested after fitting
- Old battery disposed of, or returned to you on request

**What's not included**
- 🔴 **The battery itself** — priced separately, and it is the largest part of the cost
- Alternator, starter or voltage-regulator repair
- Battery tray replacement
- A parasitic-drain hunt — ask, it is a different job
- Jump-starting

**Duration:** 20–40 min
**Pricing:** `RANGE` — labour, with the battery as a separate line

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Replacement labour + testing: **₱200–₱500**
> Amaron Jade AGM 60Ah: **₱6,000–₱9,500** *(AGM is a premium chemistry)*
> Amaron Jade 60Ah conventional: **₱4,000–₱6,500**
> Group 24/70 starter-type batteries: **₱5,500–₱9,000**
>
> **Variables:** battery chemistry — **AGM and conventional differ substantially in
> price** · capacity (Ah) · group size · the vehicle's start-stop or hybrid requirement ·
> whether the old battery is tradeable
> **Industry note:** **testing the charging system before selling a battery is the single
> highest-trust diagnostic in this business, and almost no small shop does it.** A battery
> is the most common "the shop sold me something and it died" complaint in the
> Philippines, and it is nearly always the alternator, not the battery. **Doing the test
> and publishing that you do it is a genuine, cheap, and defensible differentiator.**
> **EGY has a verified, photographed DIN80 Amaron Jade AGM installation on a Hyundai
> Staria** (`facebook-intel.md` §2.11.3) — real proof, for this exact service.

**🔴 Owner confirmation needed:** labour fee · which brands and chemistries · do you test
the alternator before fitting? Is the old battery taken back, and is there a core
deposit? **Do you offer a written battery warranty, and whose is it — yours or
Amaron's?** (These must be stated separately. `legal-compliance-ph.md` §4.2)

---

# CATEGORY 5 — SUSPENSION, STEERING & BODY

---

## 5.1 Shock Absorbers ⚠️ NOT VERIFIED — needs owner confirmation

**One-line:** Replace worn shock absorbers or struts, in pairs.

**What's included**
- Vehicle lifted, wheels removed
- Old units removed
- New units fitted
- Springs, mounts and bushings inspected
- Wheels refitted, torqued, and a road test
- Alignment recommended afterwards

**What's not included**
- 🔴 **Alignment** — effectively mandatory after strut work
- Spring, mount or bushing replacement
- Ball joints, tie rods, control arms
- Strut assemblies that require spring-compressor work we don't do in-house
- CVL / axle work

**Duration:** 2–4 hours, usually one side or both
**Pricing:** `CALL_FOR_PRICE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Shock absorber replacement, per unit fitted: **₱2,500–₱6,000** (labour + parts)
> **Struts (front, complete assemblies):** **₱8,000–₱18,000** per side
> **Variable:** front vs rear · shock vs strut · make and model — **Japanese and Korean
> light-commercial units are the expensive end** · whether springs are reused
> **Industry note:** shocks are quoted per unit in the Philippines, and the strong
> convention is **replacing in pairs, not singles.** EYG's own customer evidence includes
> a **Toyota Hilux FX** (`facebook-intel.md` §2.11.3), so a genuine Hilux price would be
> both useful and credible on the page.

**🔴 Owner confirmation needed:** offered at all? Do you do shocks, or sub-contract?
Do you replace in pairs? Which brands?

---

## 5.2 CVL / Bushings ⚠️ NOT VERIFIED — needs owner confirmation

**One-line:** Replace worn CV joints, driveshafts, and the rubber bushes that stop the noise.

**What's included**
- Inspection of the CV boots and the joints
- CV joint or driveshaft replacement where needed
- Engine and transmission mounts replaced
- Control-arm, stabiliser-link and other bushes replaced as needed
- Wheel bearings checked
- Road test

**What's not included**
- **Wheel bearing replacement** — a different job
- Transmission or differential overhaul
- Engine or gearbox removal
- Alignment

**Duration:** 2–6 hours depending on the job
**Pricing:** `CALL_FOR_PRICE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> CV boot kit: **₱1,200–₱2,500** (material + labour)
> CV joint / axle replacement: **₱2,500–₱6,000** per side
> Engine mount replacement: **₱1,500–₱4,000**
> Control-arm bushing set: **₱1,200–₱3,500**
> **Variable:** side · front or rear · vehicle make and model · whether a special-tool or
> sub-contract job
> **Industry note:** a **split CV boot** is one of the most common "should I worry about
> it?" questions in Philippine car ownership, and the honest answer is a firm *"no, not
> immediately, but book it."* **Answering that clearly on the site builds more trust than
> any service list** — and it is free.

**🔴 Owner confirmation needed:** offered at all? In-house or sub-contract? Which brands
of CV kits and bushes?

---

## 5.3 Glass ⚠️ NOT VERIFIED — needs owner confirmation

**One-line:** Windscreen, side and rear glass — chip repair, replacement and calibration.

**What's included**
- Chip or crack assessment, and an honest opinion on repair vs replace
- Adhesive removal and replacement
- New glass fitted
- Wipers replaced if required
- **ADAS camera re-calibration on supported vehicles**
- A written statement of whether calibration is included

**What's not included**
- 🔴 **Camera calibration** on vehicles needing a dealer-only process — quoted separately
- Rain sensors, tint, and heater elements
- Quarter glass and bonded glass
- Pin-chip repair beyond a certain size
- Paint or trim work

**Duration:** 1–3 hours, plus curing time
**Pricing:** `CALL_FOR_PRICE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Windscreen replacement: **₱2,500–₱7,000** *(SUVs and large vehicles cost materially
> more)*
> Chip repair: **₱400–₱900**
> Side glass: **₱1,500–₱3,500**
> ADAS calibration: **₱1,500–₱4,000**
> **Variable:** vehicle size · whether the glass is bonded or adhesive · camera
> calibration · tint
> **Industry note:** **ADAS calibration is the newest and least-understood cost in this
> trade**, and being caught out on it is a common customer dispute on modern cars. A
> windscreen shop that says plainly *"this car has a camera behind the mirror, so
> calibration is an extra ₱X, and here is what happens if you skip it"* is doing something
> almost no local shop does.

**🔴 Owner confirmation needed:** offered at all? Do you do ADAS calibration, in-house or
sub-contract? Do you quote a supply-parts warranty on glass, and is it stated separately
from workmanship?

---

## 5.4 Steering Rack Replacement ✅ **JOB EVIDENCED**

**Not on the service list, but performed and photographed** — a Toyota Hilux FX,
2026-07-02 (`facebook-intel.md` §2.11.3). EYG has the capability and the evidence.

**One-line:** Replace a worn steering rack — the cause of heavy, vague or uneven steering
feedback.

**What's included**
- Rack removed, replaced, and the steering linkage reconnected
- **Full wheel alignment afterwards** — non-negotiable after rack work
- Tie rod ends and ball joints inspected
- Power-steering fluid checked
- Road test

**What's not included**
- 🔴 **Alignment** — included in the real job, but it must be stated so nobody thinks it is
  optional
- Power-steering pump or hose
- Column or EPS (electronic) components
- Tie rod ends, ball joints

**Duration:** 4–8 hours
**Pricing:** `CALL_FOR_PRICE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Steering rack replacement (part + labour): **₱8,000–₱25,000+**
> **Variable:** make and model · power steering vs EPS · availability and pricing of the
> rack assembly · whether the pump is included
> **Industry note:** a steering rack is a **high-value, high-cost, occasionally
> safety-critical** part. **A shop that will test and confirm the rack is the actual fault
  before quoting is worth more than one that just fits the part** — and EYG's verified
> Facebook post pairs the rack replacement *with* the wheel alignment, which suggests that
  discipline already exists. **That pairing is the story worth telling on the site.**

**🔴 Owner confirmation needed:** should this be listed as a service, or held as
"diagnostic work"? Typical price for a Hilux and a common sedan?

---

# CATEGORY 6 — AIR CONDITIONING

---

## 6.1 AC / Car Aircon Repair ⚠️ NOT VERIFIED — needs owner confirmation

**One-line:** Diagnose and repair a car aircon that is not cooling properly.

**What's included**
- Temperature and vent-output check
- Refrigerant level checked and **leak-tested**
- Compressor, condenser and evaporator assessed
- Belt and clutch condition checked
- **Cabin filter inspected and replaced if required**
- System vacuumed and recharged with the correct refrigerant
- **A written note of the refrigerant type found in the car**

**What's not included**
- 🔴 **Refrigerant type conversion** (R-134A to R-1234yf) — a real cost, quoted separately
- Compressor, condenser or receiver replacement
- Heater core work
- Electrical faults unrelated to the aircon
- A full system overhaul where corrosion is extensive

**Duration:** 1.5–3 hours for a regas and leak test
**Pricing:** `RANGE` for regas · `CALL_FOR_PRICE` for repair

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Aircon regas (R-134A): **₱1,200–₱2,200**
> Regas (R-1234yf): **₱1,800–₱3,200**
> Deep clean / antibacterial treatment: **₱500–₱1,200**
> Cabin filter: **₱300–₱700**
> **Variable:** refrigerant type · vehicle size · whether a leak is found · whether the
> compressor has failed
> **Industry note:** the honest, high-converting answer to *"why is my aircon not cold?"*
> is the **four causes, in order of likelihood**: **(1) the cabin filter, (2) the refrigerant
> level, (3) a compressor that has weakened, (4) a leak.** Publishing that list — in public,
> free — is a **genuinely useful thing EYG can do that no competitor does**, and it is the
> single best FAQ answer on the site if EYG does AC work.

**⚠️ COMPETITIVE CONTEXT — a real gap and a real risk.** Three Balanga businesses already
advertise AC work: **Allen Car Airconditioning** (San Jose, `0927 537 0380`), **Justine
Angelos Car Aircon Repair Services**, and **Vernick Car Aircon Repair Shop**
(`competitors.md` §1.2 Tier B). **If EYG does AC, this is a genuine differentiator and a
genuine reason to win that customer. If EYG does not, adding it to the site would be a
fabrication** — and a customer who drives over and is told "we don't do that" becomes a
review (`risks-dos-donts.md` N33).

**🔴 Owner confirmation needed — high priority:** does EYG do AC service? In-house?
Which refrigerants can you handle, and do you have R-1234yf? Do you do cabin filters?

---

# CATEGORY 7 — ROADSIDE & EMERGENCY

---

## 7.1 Roadside Assistance 🚫🚫 **DO NOT PUBLISH — ZERO EVIDENCE**

> ### 🚨🚨 THE HIGHEST-RISK ITEM IN THIS ENTIRE CATALOGUE
>
> **There is zero evidence EYG offers any roadside or after-hours service.** Not on either
> Facebook page. Not in the Michelin or BFGoodrich dealer records. Not among the 138
> businesses in the official City of Balanga directory (`facebook-intel.md` §3).
>
> **And yet the orchestrator's brief builds the whole primary conversion lane on it** —
> *stranded → tap-to-call → human answers → done* (`AGENT-BRIEF.md` §4).
>
> **Why this is not just another unverified claim.** It is the only unverified claim in the
> project attached to a **safety scenario**. A driver with a flat at 19:00 on a Sunday, who
> searched "roadside assistance Bataan" and found EYG, pulls over and calls. Nobody
> answers — the shop is closed, and **the shop's own verified hours say it is closed**
> (Mon–Sat 08:00–17:00). The advertisement is a lie that only the customer discovers.
>
> **And the lunch break.** `src/config/site.ts` models a **12:00–13:00 break** and
> **3 bays**. So the shop is also closed for an hour every midday. A "24/7" claim would
> contradict the shop's own configuration.

**Three resolutions. Only the owner can choose.**

| Option | What ships | Recommendation |
|---|---|---|
| **A — EYG runs real after-hours roadside** | The full Lane A funnel, honestly | Only if genuinely staffed and genuinely answered |
| **B — EYG does not** 🚨 **recommended** | **No roadside keyword. No "24/7". No emergency copy.** Instead: **"Got a flat? Here's what to do while you wait, and here's what we can do when we open."** | ✅ **Recommended.** The honest version still converts — it wins on **not wasting a stranded driver's time**, and that is a real differentiator in a market that publishes nothing |
| **C — EYG partners with a real operator** | A named roadside partner, with the **partner's** number clearly attributed | Requires a real agreement. Do not imply EYG does it |

**The nearest identifiable real towing operator in the city directory is MDE Towing
Service** (`competitors.md` §1.2).

**SEO consequence:** `seo-keywords.md` **Cluster G is unwritten and untargeted** until
this is resolved. Do not put "roadside" or "24/7" in any meta description (N30).

**🔴 Owner confirmation needed — the single most important question in this file:** Do you
run roadside or 24-hour service? If yes, with whom, over what area, and what is the
response time? If no, confirm so the site can be honest about it.

---

## 7.2 Jump-Start and Battery Boost ⚠️ NOT VERIFIED — needs owner confirmation

**One-line:** Get a flat battery car started at the shop.

**What's included**
- Battery tested
- Jump-start attempted
- Charging system tested if the car does not start

**What's not included**
- A replacement battery on the spot
- Towing to the shop
- Recovery from a fuel-empty situation
- Anything after hours

**Duration:** 10–20 min
**Pricing:** `RANGE`

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> During shop hours: **₱200–₱500**, or free with a battery purchase
>
> **Industry note:** "free jump-start" is a very common and very cheap trust device in
> Philippine auto shops. **If EYG does it free during shop hours, that should be on the
> page in those words** — it costs ₱0 and it is a reason to choose one shop over another.

**🔴 Owner confirmation needed:** offered? Free or charged? Shop hours only?

---

# CATEGORY 8 — NOT SERVICES (do not list without confirmation)

## 8.1 Motorcycle Service 🚫 **NO — RECOMMEND SAYING SO**

**EYG's verified list contains no motorcycles.** EYG sells `11R22.5` truck tyres
(`facebook-intel.md` §2.7) — a **commercial truck/bus size, not a motorcycle size**, which
suggests commercial rather than motorcycle work.

**Three local competitors do trade in motorcycles** (`competitors.md` §1.2) — so there is
market for it. **But a customer who drives a motorcycle 2 km on the strength of a website
claim and arrives to be told "we don't do those" is a review, not a lead**
(`risks-dos-donts.md` N33).

**🔴 Owner confirmation needed:** motorcycles? If no — **answer the FAQ honestly with
"No, we're cars and commercial vehicles only."** That is a good answer. It is short, it is
true, and it signals that EYG knows what it does.

---

## 8.2 Car Wash & Detailing ⚠️ PARTIAL SIGNAL — needs owner confirmation

**The one genuine signal:** Facebook's own `keywords` metadata for the EYG page includes
`car wash`, `car cleaning`, and `car care` alongside `car maintenance` and `car repair`
(`facebook-intel.md` §2.3). That is Facebook's record of how the shop wants to be found,
so it is a **real if indirect signal** that customers associate EYG with washing and
cleaning.

**But** none of those terms appears in the shop's actual 10-item service list. So this is
**suggestive, not confirmed.**

**If confirmed, "Cleaning & Care" would include**
- Exterior wash
- Interior vacuum
- Dashboard and trim clean
- Glass cleaned inside and out
- Tyre dressing
- Engine bay wipe-down

> **Price — `SUGGESTED — REQUIRES OWNER CONFIRMATION`**
> Basic wash: **₱100–₱300** (regular in Balanga — often priced per size or as a
> subscription)
> Interior + exterior: **₱400–₱1,000**
> Wash + vacuum + dashboard: **₱600–₱1,500**
> Full detailing: **₱2,000–₱6,000**
> **Variable:** vehicle size · level of service · add-ons
> **Industry note:** basic washes in the Philippines are competitively priced and often
> run on subscriptions. **Detailed washes compete directly with the many car-wash
> businesses in the city directory** — `jcj-car-wash`, `mgarage-carwash`, `yatzky-carwash`
> and others (`competitors.md` §1.2 Tier C). **If EYG enters this, it should be as a
> value-add on a service visit, not as a standalone wash business.** Otherwise EYG is
> competing with specialists on their terms.

**🔴 Owner confirmation needed:** is washing offered? Is it a service or a courtesy?

---

## 8.3 Car Air Conditioning — see §6.1

## 8.4 Emissions Testing — see the note below

**A BSC Emission Testing Center operates in Balanga City** (`competitors.md` §1.2). **No
evidence EYG does emissions testing.** If a customer arrives with a failed emissions result
and asks whether EYG can fix it, the honest answer is to name what EYG can and cannot do.
**This is a referral opportunity, not a service to claim.**

---

# 9. The master price table — for one owner sign-off session

**Every number below is a `SUGGESTED` industry estimate. One conversation with the owner
replaces the entire table.**

| Service | Verified? | Suggested range (PHP) | Variable that moves it | Owner signs |
|---|---|---|---|---|
| Tire Mounting and Repair | ✅ | ₱150–350/wheel · repair ₱250–500 | Wheel size; separate or bundled | ☐ |
| Wheel Balancing | ✅ | ₱100–200/wheel | Rim size; steel vs alloy | ☐ |
| Wheel Alignment & Camber | ✅ | ₱700–1,500 | 2W vs 4W; camber/caster; SUV | ☐ |
| Nitrogen Inflation | ✅ | ₱80–180/tyre · ₱300–700 set | Rim size | ☐ |
| Tire Sales | ✅ stock | `CALL_FOR_PRICE` | Size, compound, brand | ☐ |
| Tire Rotation | ⚠️ | ₱200–500 | Bundled with balance? | ☐ |
| **PMS — basic** | ✅ | **₱1,200–2,500** | Oil type; vehicle | ☐ |
| **PMS — synthetic** | ✅ | **₱2,500–5,500** | Oil grade; vehicle | ☐ |
| **PMS — full synthetic** | ✅ | **₱4,000–8,000** | Oil grade; vehicle | ☐ |
| Change Oil (labour) | ✅ | ₱300–600 | Bring own oil? | ☐ |
| Change Oil + oil | ✅ | ₱900–1,800 conv. · ₱1,800–3,500 syn. | Oil grade; engine size | ☐ |
| Engine Tune-Up | ⚠️ | ₱1,500–3,500 basic · ₱3,000–7,000 full | Engine; cylinders; condition | ☐ |
| OBD Scan + report | ✅ | ₱300–800 | Fee waived if proceeding? | ☐ |
| Brake Cleaning (labour) | ✅ | ₱500–1,200 | Front/rear | ☐ |
| Brake Pads (labour/axle) | ✅ | ₱800–1,800 | Axle; discs? | ☐ |
| Brake Pads + Discs (axle) | ✅ | ₱3,000–6,500 | Make/model; hardware | ☐ |
| Underchassis Clean & Treat | ✅ | ₱1,500–4,000 | Size; rust extent; hoist | ☐ |
| **Undercoating** | 🚫 | **₱3,500–6,000 basic** 🚫 | Coats; arches; rust prep | ☐ **BLOCKED** |
| Battery Replacement (labour) | ✅ | ₱200–500 | — | ☐ |
| Amaron Jade AGM 60Ah | ✅ stock | ₱6,000–9,500 | Ah; group; chemistry | ☐ |
| Amaron Jade 60Ah conv. | ✅ stock | ₱4,000–6,500 | Ah; group | ☐ |
| Shocks (per unit) | ⚠️ | ₱2,500–6,000 | Front/rear; shock vs strut | ☐ |
| Struts (per side) | ⚠️ | ₱8,000–18,000 | Vehicle; springs | ☐ |
| CV boot kit | ⚠️ | ₱1,200–2,500 | Side | ☐ |
| CV joint / axle (side) | ⚠️ | ₱2,500–6,000 | Front/rear; model | ☐ |
| Engine mounts | ⚠️ | ₱1,500–4,000 | Vehicle | ☐ |
| Control-arm bushes (set) | ⚠️ | ₱1,200–3,500 | Vehicle | ☐ |
| Glass — windscreen | ⚠️ | ₱2,500–7,000 | Size; bonded; camera | ☐ |
| Glass — chip repair | ⚠️ | ₱400–900 | Chip size | ☐ |
| ADAS calibration | ⚠️ | ₱1,500–4,000 | Vehicle; in-house? | ☐ |
| Steering rack replacement | ✅ job | ₱8,000–25,000+ | Model; EPS vs hydraulic | ☐ |
| AC regas (R-134a) | ⚠️ | ₱1,200–2,200 | Refrigerant; size | ☐ |
| AC regas (R-1234yf) | ⚠️ | ₱1,800–3,200 | Refrigerant; size | ☐ |
| AC deep clean | ⚠️ | ₱500–1,200 | Vehicle size | ☐ |
| Cabin filter | ⚠️ | ₱300–700 | Model | ☐ |
| Jump-start | ⚠️ | ₱200–500 or free | Shop hours only | ☐ |
| Car wash | ⚠️ | ₱100–300 basic · ₱400–1,000 int+ext | Size; subscription? | ☐ |
| Detailing | ⚠️ | ₱2,000–6,000 | Level of service | ☐ |
| **Roadside Assistance** | 🚫 | **DO NOT PRICE** 🚫 | — | 🚫 **BLOCKED** |

---

# 10. What `/services` must do — summary for the frontend agent

| # | Requirement | Source |
|---|---|---|
| 1 | **All 10 verified services first**, in the shop's order, with the shop's exact names in Title Case | D2 |
| 2 | **Every service shows: summary · what's included · what's NOT included · duration · price** | §0.4 |
| 3 | **Every price carries a visible "confirm on your job order" qualifier** until the owner signs off | `legal-compliance-ph.md` §4.3 |
| 4 | **Every price range names the variable that moves it** | AP25 |
| 5 | **`pricing: CALL_FOR_PRICE` for tyres, tune-up, shocks, CVL, glass, rack** — no honest range exists | `ServiceDto` in `src/lib/types.ts` |
| 6 | **A "needs confirmation" service must not render as a bookable item** until confirmed | N25, N33 |
| 7 | **"What's not included" is visually equal in weight to "what's included"** — not small grey text | D4. This is the differentiator and the legal shield |
| 8 | **A sticky in-page jump-nav** — ten services on one page, on 3G. **Not an accordion** | AP3, §5.4 |
| 9 | **Brands: Michelin + BFGoodrich only** until the owner confirms the rest | N, `facebook-intel.md` §2.7 |
| 10 | **No "authorised", "official distributor", "certified"** | N8, N32 |
| 11 | **No roadside / 24/7 anywhere on the page** | §7.1 |
| 12 | **Omit `AggregateRating` entirely** | N16 |
| 13 | **A persistent, tappable phone number on `/services` itself** | `risks-dos-donts.md` §4 item 1 |
| 14 | **The 15 verified job photos, plates blurred, no names, alt text describing the work** | D21, D12 |
| 15 | **Every claim on the page must be defensible by the shop's own receptionist** to a sceptical customer | `ux-benchmarks-auto-shop.md` §6.4 |

---

# 11. Handoff — the six questions for the owner

**One conversation resolves the whole catalogue.**

1. **Do you do undercoating?** (Different from underchassis maintenance.) If yes: process,
   coats, arches, in-house or sub-contract, and the real price. **Highest-value gap** —
   strong Bataan category, and it is why faking it would be found out.
2. **Do you do AC / car aircon repair?** Three Balanga competitors already advertise it.
   In-house? R-134a and R-1234yf? Cabin filters?
3. **Do you run roadside or 24-hour service?** With whom, over what area, what response
   time? **The single highest-risk unverified claim in the project.** If no — confirm, and
   the site gets the honest version.
4. **Which of these do you NOT do?** Shocks · CVL/bushings · glass · engine tune-up ·
   car wash · motorcycle · jump-start. **Tell me what to cut.** An honest shorter catalogue
   beats an inflated one.
5. **Confirm the whole §9 price table** — and specifically the **base PMS price** and the
   **base four-wheel alignment price**, since those two appear in meta descriptions and
   carry the most legal weight.
6. **Mounting: separate or bundled into the tyre price? And do you take customer-supplied
   oil?** Both change what a customer compares, and both are the classic bait-and-switch
   pivot points.

**Once answered, delete every `SUGGESTED — REQUIRES OWNER CONFIRMATION` marker, remove
the unconfirmed services, and this catalogue becomes publishable.**
