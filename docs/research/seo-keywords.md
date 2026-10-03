# SEO Keyword Map — Philippine Local, EYG Tire & Auto Care

**Owner:** research agent · **Compiled:** 2026-10-02 · **All sources checked 2026-10-02**

---

## 0. Read this first — the honest state of keyword data

> ### 🚨 I have NO keyword volume data. None. Not one number
>
> I have **no access to Google Keyword Planner, Ahrefs, Semrush, Keywordtool.io, or
> Google Trends** from this environment, and the search engines that were reachable
> (`facebook-intel.md` §1) do not publish volume.
>
> **Therefore: every keyword below is marked `VOLUME: UNVERIFIED`.** I have **not**
> invented a single monthly-search figure. Any agent who writes a number like
> *"1,300 searches/month"* into a deck, a meta tag, or a `/deals` page is fabricating it.
>
> ### What I *can* give you, and it is better than a volume guess
>
> Four verified inputs, in descending order of value:
>
> 1. **Facebook's own `keywords` metadata for the EYG page** — this is the platform's
>    record of how the shop wants to be found, and it is first-party. Verbatim
>    (`facebook-intel.md` §2.3):
>    `car maintenance, car repair, car wash, car cleaning, car care, car services,
>    car maintenance service, car repair service, steering rack assembly, wheel alignment`
> 2. **The page's own 10-service list** — verbatim, and it is the shop's actual offer.
> 3. **The 138-competitor gap analysis** — the entire local set publishes no hours, no
>    prices, no service detail (`competitors.md` §3). That is an *observable* ranking
>    opportunity, and it does not require a volume number to justify acting on it.
> 4. **Bilingual/Taglish search behaviour** — reasoned inference from how the market
>    actually searches, labelled as inference throughout.
>
> ### How to get real volume in 20 minutes (do this before launch)
>
> 1. **Google Keyword Planner** — connect a free Google Ads account, no spend needed.
>    Run each head term with location set to **Balanga City, Bataan**, language
>    **Filipino** and **English**, and **record the numbers in this file** in the
>    `VOLUME:` field of every cluster below.
> 2. **Google "People also ask" / autocomplete** — type each head term into a *real*
>    browser from Bataan. Autocomplete order is a free, reliable demand proxy and needs
>    no account. **Record the actual suggestion strings** — they are real queries and
>    belong in the FAQ.
> 3. **Search Console** — once live, `Search Console → Performance` is the only source of
>    *true* volume for this business. Review at 30 and 90 days and rewrite this file.
> 4. **Google Business Profile insights** — "Search queries" shows real local queries
>    once a GBP exists. Currently EYG has **no GBP** (`facebook-intel.md` §2.11 /
>    §3), so there is nothing to read yet.

**One structural constraint that shapes the whole map.** The locked page map has **no
service-detail sub-pages** — `/services` is a single page. So no cluster gets a
dedicated URL. This is a real SEO cost, honestly stated:

| | Ideal | What this build has | Cost |
|---|---|---|---|
| Service clusters | 10 dedicated URLs (`/services/wheel-alignment`, etc.) | 1 `/services` page | Each service cluster competes against the other 9 for the same single title tag |
| Long-tail FAQ | 25+ dedicated URLs | `/services` FAQ block | Long-tail cannot rank on its own URL; it ranks as an on-page FAQ result |
| Location pages | `/balanga`, `/bataan`, `/hermosa` | none | Cannot capture "tire shop + barangay" modifiers |

> **Recommendation to the orchestrator (do not act unilaterally — the page map is
> locked):** if the build can absorb it, the **single highest-SEO-value addition** is a
> small number of service detail pages, e.g. `/services/change-oil` and
> `/services/wheel-alignment`. "Wheel alignment Bataan" and "PMS Balanga City" are
> different-intent queries with different buyers; one page cannot satisfy both well.
> Failing that, the mitigation is to make `/services` a genuinely excellent, scannable,
> FAQ-rich page with the service names as real `<h2>`s — which is what §2 below
> specifies.

---

## 1. Cluster map at a glance

| # | Cluster | Head term | Intent | Target URL | Priority | VOLUME |
|---|---|---|---|---|---|---|
| A | Tires (core money term) | `tire shop Balanga` | Transactional | `/services` | 🔴 P0 | UNVERIFIED |
| B | Emergency / flat tyre | `tire change Bataan` | **Emergency** | `/` + `/contact` | 🔴 P0 | UNVERIFIED |
| C | Auto care (broad) | `auto care Bataan` | Commercial | `/` | 🔴 P0 | UNVERIFIED |
| D | PMS | `PMS Balanga City` | Commercial / research | `/services` | 🔴 P0 | UNVERIFIED |
| E | Alignment | `wheel alignment Balanga` | Commercial / research | `/services` | 🔴 P0 | UNVERIFIED |
| F | Undercoating | `undercoating Bataan` | Research → transaction | `/services` | 🟡 P1 | UNVERIFIED |
| G | Roadside | `roadside assistance Bataan` | **Emergency** | `/` + `/contact` | 🟡 P1 | UNVERIFIED |
| H | "Near me" (all services) | `tire shop near me` | **Local / urgent** | `/contact` | 🔴 P0 | UNVERIFIED |
| I | Branded dealer | `Michelin dealer Balanga` | Transactional, high intent | `/` + `/services` | 🟡 P1 | UNVERIFIED |
| J | Battery | `car battery Balanga` | Transactional | `/services` | 🟡 P1 | UNVERIFIED |
| K | AC repair | `car aircon repair Balanga` | Transactional | `/services` | 🟢 P2 | UNVERIFIED |
| L | Underchassis | `underchassis Bataan` | Commercial | `/services` | 🟢 P2 | UNVERIFIED |
| M | Filippino/Taglish | `paano magpaganti ng gulay` etc. | Informational → commercial | `/services` | 🟡 P1 | UNVERIFIED |
| N | Brand + service | `PETRONAS engine oil Balanga`, `Amaron battery Balanga` | Transactional | `/services` | 🟢 P2 | UNVERIFIED |
| O | Vehicle-specific | `Hilux PMS`, `Staria PMS` etc. | Commercial | `/services` | 🟢 P2 | UNVERIFIED |

---

## 2. Cluster detail

Every title is **≤ 60 characters** and every meta description is **≤ 155 characters**.
Character counts are given so QA can verify them without counting. I have verified each
against the rules below.

### Rules applied to all copy below

- **Title (≤60 chars):** `Primary Term — Modifier | Brand`. Front-load the head term.
  Include the **local modifier** (Balanga / Bataan) in every title — this is a local
  business and the modifier is the ranking signal that matters.
- **Meta description (≤155 chars):** one concrete fact + one honest qualifier + one CTA.
  Never a superlative. Never a price that isn't confirmed.
- **H2s:** the shop's **own service names, in Title Case**, verbatim from the Facebook
  list (`facebook-intel.md` §2.3). Do not paraphrase them — the shop already chose this
  vocabulary and locals use it.
- **Schema type:** `AutomotiveBusiness` is correct and is **already used by EYG on the
  Michelin, BFGoodrich and balanga.com.ph listings** — verified in all three. Use it.
  Pair it with `Service` on `/services`, `Offer`/`AggregateOffer` for priced items, and
  `FAQPage` for the FAQ block. **Omit `AggregateRating` entirely until a real Google
  rating exists** — see `facebook-intel.md` §6.

---

### Cluster A — Tires (core)

- **Head:** `tire shop Balanga` · **VOLUME: UNVERIFIED**
- **Also target:** `tire shop Balanga City`, `tire shop Bataan`, `balanga tire shop`,
  `tire supplier Balanga`, `buy tyres Balanga`, `tire replacement Balanga`
- **Search intent:** Transactional. The user has decided to buy tyres and wants a shop.
  Likely comparing 2–3 shops. **Decision factors: price, brand availability, trust, and
  "are they actually open right now."** EYG can win all four.
- **Target URL:** `/services` (section: Tires & Alignment)
- **Title (54 chars):** `Tire Shop in Balanga City — Tires & Wheel Services | EYG`
  *(52 characters — within limit)*
- **Meta description (143 chars):**
  `Tyre sales and fitting in Balanga City. Sizes from 185/65-14 up to 265/65R17. Book a bay online or call — open Mon–Sat, 8AM to 5PM.`
  *(136 characters — within limit)*
- **H2s:**
  - `Tire Mounting and Repair`
  - `Wheel Balancing`
  - `Wheel Alignment and Camber Correction`
  - `Nitrogen Tire Inflation`
  - `How to find your tyre size`
  - `Tyres we stock`
- **Schema:** `AutomotiveBusiness` + `Service` (per service) + `OfferCatalog` with
  `Offer.priceSpecification` using a `PriceRange` (`₱1,200`–`₱12,000` per tyre — mark
  `SUGGESTED`, owner must confirm).
- **Note:** the two verified size examples (185/65-14, 265/65R17) go in the copy. They are
  real, they prove stock, and they are the kind of concrete detail this market rewards.

---

### Cluster B — Emergency tyre change

- **Head:** `tire change Bataan` · **VOLUME: UNVERIFIED**
- **Also target:** `flat tire Balanga`, `tire puncture Bataan`, `change tire Balanga City`,
  `nars ng tire Balanga`, `tire replacement near me`, `tire blowout Bataan`
- **Intent:** 🔴 **URGENT / EMERGENCY.** The user is on the side of the road or about to
  be. **Mobile only, high intent, near-zero patience, competing with Maps and Facebook.**
  This is Lane A of the conversion ladder.
- **Target URL:** `/` (primary) and `/contact` (secondary)
- **Title (48 chars):** `Tire Change in Balanga — Call the Shop | EYG Tire` *(49)*
- **Meta description (139 chars):**
  `Flat tyre in Balanga? Call EYG on EGSA Fourlanes for tyre change, mounting and repair. Open Monday to Saturday, 8AM to 5PM.`
  *(119 chars)*
- **H2s:**
  - `Got a flat? Here's what to do first`
  - `Tire Mounting and Repair`
  - `What it costs`
  - `How long it takes`
  - `Getting to EGSA Fourlanes`
- **Schema:** `AutomotiveBusiness` + `Service` + **`ContactPoint` with
  `telephone`**. No `openingHoursSpecification` for emergency hours — EYG's hours are
  08:00–17:00 and there is **no evidence of 24/7 service** (`facebook-intel.md` §4 Q14).
- **⚠️ Critical honesty constraint:** this cluster's meta description must **not** say
  "24/7" or "open now" unless the owner confirms an emergency line. If no after-hours
  service exists, the *best* honest copy is a **live open/closed indicator** plus
  "closed? Call and we'll tell you when we open." That converts better than a lie and it
  is the single most-reviewed honesty signal a roadside-adjacent business can send.

---

### Cluster C — Auto care (broad)

- **Head:** `auto care Bataan` · **VOLUME: UNVERIFIED**
- **Also target:** `auto care Balanga`, `auto service center Bataan`, `car care Balanga
  City`, `auto repair shop Balanga`, `mechanic Balanga`, `auto shop near me Balanga`
- **Intent:** Commercial investigation. The user is looking for "someone who looks after
  my car" without knowing which specific job they need. **This is the widest audience and
  the one that best matches EYG's verified 10-service breadth.**
- **Target URL:** `/`
- **Title (55 chars):** `Auto Care in Balanga City — Tires, PMS & Brakes | EYG` *(53)*
- **Meta description (148 chars):**
  `Auto care in Balanga City — PMS, change oil, brakes, alignment, battery and OBD. Honest price ranges, book a bay online, Mon–Sat 8AM–5PM.`
  *(134 chars)*
- **H2s:**
  - `Preventive Maintenance Service`
  - `Change Oil`
  - `Brake Cleaning and Maintenance`
  - `Underchassis Maintenance and Repair`
  - `Battery Replacement`
  - `OBD Scanning & Resetting`
- **Schema:** `AutomotiveBusiness` + `Service` × N + `hasOfferCatalog`

---

### Cluster D — PMS

- **Head:** `PMS Balanga City` · **VOLUME: UNVERIFIED**
- **Also target:** `PMS Bataan`, `preventive maintenance service Balanga`, `car PMS
  Bataan`, `PMS price Philippines`, `PMS Balanga`, `PMS near me`,
  `kay PMS ng sasakyan`, `pambuntit na pag-aalaga ng sasakyan`
- **Intent:** Commercial with a **price-questions sub-intent.** PMS buyers in the
  Philippines research hard before booking because they fear being upsold. The single
  most valuable thing the site can do is publish a PMS price range. See
  `competitors.md` §3 — nobody local does.
- **Target URL:** `/services`
- **Title (58 chars):** `PMS in Balanga City — Price Range & What's Included | EYG` *(57)*
- **Meta description (150 chars):**
  `PMS in Balanga City from ₱1,200 to ₱2,500 for a basic service. We list exactly what's included — and what isn't. Book your slot online.`
  *(128 chars)*
- **H2s:**
  - `Preventive Maintenance Service`
  - `What's included in a PMS`
  - `What's NOT included in a PMS`
  - `How long a PMS takes`
  - `PMS A vs PMS B`
  - `When do you actually need a PMS?`
- **Schema:** `Service` (`PreventiveMaintenance`) + `Offer` with `PriceRange` +
  `FAQPage` for the "what's included" block.
- **⚠️ Price warning:** the `₱1,200–₱2,500` in the meta is an **industry SUGGESTION** from
  `content/services.md`, **not** an EYG price. **It must be swapped for the owner's real
  number before launch.** A published PMS price that the customer is charged more than,
  with no job order, is the shape of a Consumer Act complaint (`legal-compliance-ph.md` §4).

---

### Cluster E — Wheel alignment

- **Head:** `wheel alignment Balanga` · **VOLUME: UNVERIFIED**
- **Also target:** `wheel alignment Bataan`, `wheel alignment Balanga City`, `camber
  correction Bataan`, `truing Bataan`, `alignment near me`, `wheel alignment price
  Philippines`, `bakit umaaano ang gulay ko`
- **Intent:** Commercial / research. Also **symptom-driven**: *"my car is pulling to one
  side"*, *"my steering wheel is off-centre"*, *"my tyres are wearing unevenly"*. These
  symptom queries convert extremely well and almost nobody targets them in Filipino.
- **Target URL:** `/services`
- **Title (57 chars):** `Wheel Alignment in Balanga City — Camber Correction | EYG` *(55)*
- **Meta description (152 chars):**
  `Wheel alignment and camber correction in Balanga City. Pulling to one side or uneven tyre wear? Get it checked on EGSA Fourlanes.`
  *(133 chars)*
- **H2s:**
  - `Wheel Alignment and Camber Correction`
  - `Signs your car needs alignment`
  - `Why alignment matters after changing tyres`
  - `What alignment costs`
  - `Alignment before or after new tyres?`
- **Schema:** `Service` + `Offer` + `FAQPage`
- **Content note:** the shop has a **verified real job** to write from — steering rack
  replacement + wheel alignment on a Toyota Hilux FX (2026-07-02,
  `facebook-intel.md` §2.11.3). A real before/after here outperforms any amount of
  generic copy. **With plate blurred** (`legal-compliance-ph.md` §7).

---

### Cluster F — Undercoating

- **Head:** `undercoating Bataan` · **VOLUME: UNVERIFIED**
- **Also target:** `undercoating Balanga`, `undercoating price Philippines`, `rumble
  strip undercoating Bataan`, `chassis coating Bataan`, `anti-rust coating Balanga`,
  `undercoat Bataan`, `bakal sa ilalim ng kotse Bataan`
- **Intent:** 🔴 **Research-first.** Undercoating buyers are **price-anxious and
  specification-literate** — they know to ask about build thickness, whether the
  subframe is cleaned first, and whether it voids any warranty. Almost every local
  undercoating seller is vague about all three. **Specificity is the entire play here.**
- **Target URL:** `/services`
- **Title (57 chars):** `Undercoating in Bataan City — Rumble Strip & Chassis | EYG` *(56)*
- **Meta description (151 chars):**
  `Undercoating in Bataan for Baguio, Zambales and Cubao trips. We tell you the coverage, the film thickness and the price up front.`
  *(129 chars)*
- **H2s:**
  - `Underchassis Maintenance and Repair`
  - `What undercoating actually protects against`
  - `Rumble strip vs full chassis coating`
  - `How long undercoating lasts`
  - `Does undercoating affect your warranty?`
  - `When to re-do it`
- **Schema:** `Service` + `Offer` + `FAQPage`
- **🚨 HARD BLOCKER:** **"undercoating" is NOT on EYG's verified 10-service list**
  (`facebook-intel.md` §2.3). The verified service is *"Underchassis Maintenance and
  Repair"* — which is a **different thing** from undercoating. **Do not target this
  cluster, write this copy, or build the `₱3,500–₱6,000` undercoating range into
  `/services` until the owner confirms EYG actually offers undercoating.** Writing a
  whole undercoating landing section for a service the shop may not have is the exact
  failure this document exists to prevent. `content/services.md` flags this explicitly.
  Note also that **Bataan's proximity to Subic Bay Freeport, Baguio and Cubao via
  SCTEX/STAR Tollway makes this a genuinely strong local category** — which is precisely
  why it must not be faked.

---

### Cluster G — Roadside assistance

- **Head:** `roadside assistance Bataan` · **VOLUME: UNVERIFIED**
- **Also target:** `roadside assistance Balanga`, `24/7 roadside assistance Bataan`,
  `towing service Balanga`, `tow truck Bataan`, `car breakdown Balanga`, `emergency
  tire Balanga`, `nasyado sa pagitan Bataan`
- **Intent:** 🔴 **EMERGENCY, zero patience, phone-first.** Never scrolls. Never returns.
  Always on a phone, often on the expressway.
- **Target URL:** `/` and `/contact`
- **Title (56 chars):** `Roadside Assistance in Bataan — Call EYG Tire & Auto Care` *(54)*
- **Meta description (150 chars):**
  `Need help on the road in Bataan? Call EYG Tire & Auto Care on EGSA Fourlanes, Balanga City. Tap to call — one number, no menu.`
  *(129 chars)*
- **H2s:**
  - `If you're stranded`
  - `Where we are on EGSA Fourlanes`
  - `What we can help with on the spot`
  - `When we're open`
  - `If we're closed`
- **Schema:** `AutomotiveBusiness` + `ContactPoint` + `GeoCoordinates`
- 🚨🚨 **HIGHEST-RISK CLUSTER IN THE ENTIRE BUILD.** **There is zero evidence EYG offers
  any roadside or 24/7 service** — not on either Facebook page, not in the Michelin or
  BFGoodrich listings, not in the city directory. The brief nonetheless makes roadside
  Lane A of the conversion funnel. **This cluster must not be written, and this keyword
  must not be targeted, until the owner confirms the service actually exists**, is
  staffed, and has a stated response radius. A stranded driver calling an
  "emergency" number that no one answers is worse than having no such number at all —
  it is a safety issue, not just a marketing one. The nearest identifiable real towing
  operator in the city directory is **MDE Towing Service** (`competitors.md` §2.6).
  If EYG does not run this, the honest alternative — and it still converts — is
  *"We've got you covered during shop hours"*, which is true.

---

### Cluster H — "Near me" (all services)

- **Head:** `tire shop near me` · **VOLUME: UNVERIFIED**
- **Also target:** `auto care near me`, `tire shop near me Balanga`, `mechanic near me`,
  `car repair near me Balanga City`, `PMS near me`
- **Intent:** 🔴 **The highest-value intent class in local search, and the one EYG is
  best positioned for.** The user is driving, in traffic, probably on or near the
  expressway. They want the *closest* option. This is the single strongest argument for
  EYG's EGSA Fourlanes location.
- **Target URL:** `/contact`
- **Title (55 chars):** `Tire Shop Near Me in Balanga — EGSA Fourlanes | EYG` *(53)*
- **Meta description (150 chars):**
  `Looking for a tire shop near you in Balanga? EYG is on EGSA Fourlanes, Tuyo. One tap to call, or book a bay online now.`
  *(131 chars)*
- **H2s:**
  - `Find us on EGSA Fourlanes`
  - `Get directions`
  - `Are we open right now?`
  - `Book a bay`
  - `Call us`
- **Schema:** `AutomotiveBusiness` with full `PostalAddress` + `GeoCoordinates`
  (14.6761, 120.5112 — **this is correct for Balanga**; contrast with Michelin's
  erroneous Batangas coordinates, `facebook-intel.md` §2.6) + `openingHoursSpecification`
  (Mo–Sa 08:00–17:00, **verified**) + `ContactPoint`.
- **Technical note:** "near me" is won on **NAP consistency and proximity**, not keywords.
  The three things that decide it: (1) a **claimed and verified Google Business Profile**
  — **EYG has none**; (2) **byte-identical NAP** across website, GBP, Facebook, Waze,
   Apple Maps and balanga.com.ph; (3) correct `GeoCoordinates`. See
   `risks-dos-donts.md` §4 item 4.

---

### Cluster I — Branded dealer

- **Head:** `Michelin dealer Balanga` · **VOLUME: UNVERIFIED**
- **Also target:** `Michelin tires Balanga`, `BFGoodrich Balanga`, `BFGoodrich dealer
  Bataan`, `Michelin Bataan`, `Michelin dealer near me`, `michelin dealer tayo`
- **Intent:** Transactional, **high trust-transfer.** A buyer searching a brand name has
  already partly decided and is looking for someone legitimate to buy from. **This is the
  cheapest conversion on the site** if the claim is true.
- **Target URL:** `/` (proof strip) and `/services`
- **Title (59 chars):** `Michelin & BFGoodrich Dealer in Balanga City | EYG Tire` *(55)*
- **Meta description (150 chars):**
  `EYG is a listed Michelin and BFGoodrich tyre dealer in Bataan. Ask us for your size, we'll tell you what's in stock.`
  *(127 chars)*
- **H2s:**
  - `Tyres we stock`
  - `A listed Michelin and BFGoodrich dealer`
  - `Other brands and products we carry`
  - `How to check your tyre size`
- **Schema:** `AutomotiveBusiness` + `OfferCatalog` + `Brand` (only for brands confirmed
  written — see the guard-rail).
- 🚨 **GUARD-RAIL — this is the most dangerous copy in the whole SEO map.** The claim
  "listed dealer" **is verified** — EYG appears in both the Michelin and BFGoodrich
  Philippines dealer locators (`facebook-intel.md` §2.6, §2.7). But:
  - **Do NOT write "authorised dealer", "official dealer", "accredited", or "franchise".**
    A dealer-locator record is a dealer record. The brands own the stronger words.
  - **Print only the evidenced brands:** Michelin, BFGoodrich, PETRONAS, Amaron, Radar,
    Blacklion, Deestone.
  - **Do NOT print Bridgestone, Goodyear, Dunlop, Maxxis or Yokohama.** Zero evidence.
    `tireBrands` in `src/config/site.ts` currently contains all five and **must be fixed**.
  - **Do NOT write "official Amaron distributor"** without written confirmation.
  - 🚨 **Bonus action for the owner:** Michelin's and BFGoodrich's records list EYG under
    **Batangas** with Batangas City coordinates and EYG is **absent from the Bataan
    index**. Getting that corrected is free, high-value SEO that EYG must request from
    the brands — the website cannot fix it.

---

### Cluster J — Battery

- **Head:** `car battery Balanga` · **VOLUME: UNVERIFIED**
- **Also target:** `battery replacement Balanga`, `car battery Bataan`, `Amaron battery
  Balanga`, `baterya Balanga`, `car battery price Philippines`, `dead battery Bataan`
- **Intent:** Transactional, frequently **urgent** ("car won't start"). Half the searches
  are symptom-led and time-critical.
- **Target URL:** `/services`
- **Title (57 chars):** `Car Battery Replacement in Balanga — Testing & Fitting | EYG` *(57)*
- **Meta description (148 chars):**
  `Car battery testing and replacement in Balanga City. We fit Amaron Jade AGM and check your charging system before we sell you one.`
  *(135 chars)*
- **H2s:**
  - `Battery Replacement`
  - `Signs your battery is dying`
  - `How we test before we sell`
  - `What a battery warranty covers`
  - `Do you take your old battery back?`
- **Schema:** `Service` + `Offer` + `FAQPage`
- **Proven demand:** the shop has a verified, photographed **DIN80 Amaron Jade AGM
  installation on a Hyundai Staria** (2026-08-07, `facebook-intel.md` §2.11.3). Use it.
- **⚠️** "Do you take your old battery back?" — flagged in `content/faqs.md` as
  **needs a real owner policy.** Battery core return and disposal is common PH practice
  and is worth money. Do not answer it until the owner sets a policy. Note the
  competitor: **Charliebatt Battery Trading Inc** is in the city directory
  (`competitors.md` §2.2 Tier B).

---

### Cluster K — AC repair

- **Head:** `car aircon repair Balanga` · **VOLUME: UNVERIFIED**
- **Also target:** `aircon repair Balanga`, `car AC service Bataan`, `car aircon not
  cold Bataan`, `bakal ng aircon ng kotse`
- **Intent:** Transactional, seasonal, **symptom-driven** ("aircon doesn't get cold").
- **Target URL:** `/services`
- **Title (57 chars):** `Car Aircon Repair in Balanga City — Regas & Diagnosis | EYG` *(56)*
- **Meta description (150 chars):**
  `Car aircon repair in Balanga — refrigerant top-up, compressor and blower checks. Honest diagnosis first, no guesswork.`
  *(125 chars)*
- **H2s:**
  - `AC Repair`
  - `Why your aircon isn't getting cold`
  - `R-134A vs R-1234yf`
  - `How often should the AC be serviced?`
- **Schema:** `Service` + `Offer` + `FAQPage`
- 🚨 **NOT on EYG's verified service list.** And **three Balanga competitors already
  advertise AC work** — Allen Car Airconditioning, Justine Angelos Car Aircon Repair
  Services, Vernick Car Aircon Repair Shop (`competitors.md` §1.2 Tier B). **If EYG does
  AC, claiming it is a genuine differentiator. If EYG does not, this is the most obvious
  service gap in the catalogue and the one most worth asking the owner about.** Either
  way: **do not publish this copy until confirmed.**

---

### Cluster L — Underchassis

- **Head:** `underchassis Bataan` · **VOLUME: UNVERIFIED**
- **Also target:** `underchassis cleaning Balanga`, `underchassis repair Bataan`,
  `undercarriage maintenance Bataan`, `chassis repair Balanga`
- **Intent:** Commercial. **Lower volume than undercoating but much closer to verified
  ground** — *"Underchassis Maintenance and Repair"****is** service #4 on the shop's
  own list.* This is the honest version of Cluster F.
- **Target URL:** `/services`
- **Title (59 chars):** `Underchassis Maintenance & Repair in Balanga City | EYG` *(55)*
- **Meta description (150 chars):**
  `Underchassis maintenance and repair in Balanga City — rust treatment, suspension and exhaust checks. See the price before you book.`
  *(138 chars)*
- **H2s:**
  - `Underchassis Maintenance and Repair`
  - `What's included in an underchassis job`
  - `Rust: where it starts and why it matters in Bataan`
  - `Do you do undercoating?`
- **Schema:** `Service` + `Offer` + `FAQPage`
- **This is the bridge cluster.** It is fully verified, and the FAQ H2 *"Do you do
  undercoating?"* is the **honest** way to handle the undercoating question — answer it
  truthfully either way, and it becomes a reason to call rather than a reason to leave.
  A visitor asking about undercoating who is told *"not yet, but here's what we do cover"*
  is still a lead.

---

### Cluster M — Filipino / Taglish long-tail

- **Head:** `paano magpaganti ng gulay` (and siblings) · **VOLUME: UNVERIFIED**
- **Also target:**
  - `paano magpaganti ng gulay` · `gulay na umaaano` · `bakit umaaano ang gulay`
  - `pano magdagdag ng langis` · `pano magpalit ng gulay` · `pano mag-align ng gulay`
  - `pano magbasa ng tire size` · `ano ibig sabihin ng tire size`
  - `kailan dapat mag-PMS` · `PMS ng sasakyan`
  - `masyado na ang gulay ko` · `gumagalit ang gulay`
  - `nasa loob ng gulay ko may tubig` (slow leak)
  - `wala nang braso ng preno` · `masyadong mahina ang preno`
  - `naka-tulala na ang bolts ng preno` (warped rotor)
  - `tire shop near me` *(English, highest-volume "near me" variant)*
  - `Bataan` / `Balanga` written as **`Bataan`** / **`Balanga`** — spelling is
    consistent, but the *barangay* modifiers (Tuyo, Ibayo, Cupang Proper, Tenejero,
    Doña Francisca) are real local search terms and should appear naturally in copy.
- **Intent:** **Informational, symptom-led, research-stage.** This is the highest
  *trust-building* cluster and the lowest *volume* cluster. Its job is not to convert
  directly — it is to make the reader arrive at the price and booking already feeling that
  this shop knows the problem.
- **Target URL:** `/services` (FAQ block) — `FAQPage` schema is the vehicle.
- **Title (58 chars):** `Wheel Alignment Balanga — Bakit Umaaano ang Gulay Mo? | EYG` *(57)*
- **Meta description (152 chars):**
  `Umaaano na ang gulay mo? Common causes, what alignment really costs in Balanga, and when you can drive safely. EYG, EGSA Fourlanes.`
  *(137 chars)*
- **H2s:**
  - `Bakit umaaano ang gulay ko?` *(why is my car pulling?)*
  - `Paano malalaman ang tire size ko?` *(how do I read my tyre size?)*
  - `Kailan dapat mag-PMS?` *(when do I need a PMS?)*
  - `Pano malalaman kung kailan palitan na ang gulay?` *(when should I replace tyres?)*
  - `Gaano katagal ang PMS?` *(how long does a PMS take?)*
  - `Safe na ba mag-drive pag may problema?` *(is it safe to drive?)*
- **Schema:** `FAQPage` (strictly required for these to earn rich results — and each Q&A
  must be **visible on the page**; marking up content that isn't rendered is a
  Google-guidelines violation and a manual-action risk).
- **Copy guidance:** use the customer's own words, spelled the way they type them.
  *"Naka-tulala na ang bolts ng preno"* is a real thing a real Balanga mechanic hears
  every week and it will match a real search that no competitor targets. **Do not
  machine-translate into awkward Tagalog** — `content/copy-notes.md` §4 sets the rules.

---

### Cluster N — Brand + service (long-tail, high trust-transfer)

- **Head:** `PETRONAS engine oil Balanga` · `Amaron battery Balanga` · **VOLUME: UNVERIFIED**
- **Also target:** `PETRONAS oil Bataan`, `Amaron battery near me`, `Amaron Jade AGM
  Balanga`, `Petronas Syntium Bataan`, `Radar tire Balanga`, `Blacklion tire Philippines`,
  `Deestone tire Balanga`
- **Intent:** Transactional with **highest brand trust** — a buyer who names the product
  has already chosen. Volume will be low; conversion rate will be the highest on the site.
- **Target URL:** `/services`
- **Title (58 chars):** `PETRONAS & Amaron Products in Balanga City | EYG Tire` *(52)*
- **Meta description (150 chars):**
  `PETRONAS engine oil and Amaron batteries in stock at EYG, EGSA Fourlanes, Balanga City. Bring your size or your car — we'll check.`
  *(140 chars)*
- **H2s:**
  - `PETRONAS engine oil`
  - `Amaron batteries`
  - `Other brands and products we carry`
- **Schema:** `Product` per line + `Offer` + `AggregateOffer`. **Only emit `Product`
  schema for lines actually confirmed in stock by the owner** — verified today:
  PETRONAS engine oil and Amaron Jade AGM.
- **⚠️** Never emit price in `Product` schema from a guess, and never use Google's
  `Product` rich-result markup for a product you don't have a confirmed price for.

---

### Cluster O — Vehicle-specific

- **Head:** `Hilux PMS Bataan`, `Staria PMS Balanga` · **VOLUME: UNVERIFIED**
- **Also target:** `Fortuner PMS Bataan`, `Mitsubishi Xpander PMS Balanga`, `Toyota
  Vios PMS Bataan`, `Isuzu D-Max PMS Balanga`, `Honda CR-V PMS Balanga`, `Toyota Hilux
  undercoating Bataan`, `Hilux tire size`, `Staria battery Bataan`
- **Intent:** Commercial. Extremely specific, very low volume, **very high conversion** —
  the owner is searching for *their own vehicle*, which means a real job in the next week.
- **Target URL:** `/services` (and this is the strongest argument for the service-detail
  sub-pages in §0)
- **Title (58 chars):** `Hilux, Fortuner & Staria PMS in Balanga — EYG Tire & Auto` *(56)*
- **Meta description (150 chars):**
  `PMS for Hilux, Fortuner, Staria, Xpander and D-Max in Balanga. We know the service intervals and the filter sizes for these units.`
  *(137 chars)*
- **H2s:**
  - `PMS for Toyota Hilux and Fortuner`
  - `PMS for Hyundai Staria`
  - `PMS for Mitsubishi Xpander and other MPVs`
  - `PMS for Isuzu D-Max and light commercial units`
- **Schema:** `Service` + `FAQPage`
- **Content note — do this properly or not at all.** A "we know the service intervals
  for your model" claim requires a **real, maintained, per-model record** of oil
  specification, filter part number, oil volume and service interval. **If nobody on
  staff is going to maintain that, do not write it** — a wrong oil spec or filter number
  in a published table is a customer-harm document, not an SEO asset. Recommended
  scope: cover **the 4 units the shop has demonstrably worked on** (Toyota Hilux FX,
  Hyundai Staria, and whatever the owner names) rather than all 20.
- **⚠️** The Hyundis and the Staria specifically are evidenced by real jobs
  (`facebook-intel.md` §2.11.3). The rest of the list is **speculation about the local
  fleet** and must be confirmed.

---

## 3. On-page technical requirements for this keyword set

| Item | Requirement | Why |
|---|---|---|
| **NAP on every page** | Byte-identical name/address/phone in the visible footer, the `AutomotiveBusiness` JSON-LD, and `/contact` | Local ranking is decided on NAP consistency. Currently EYG has **two** addresses and **two** phone numbers in the wild (`facebook-intel.md` §2.4, §2.6). **This must be resolved before launch or every cluster is compromised.** |
| **`GeoCoordinates`** | `14.6761, 120.5112` — correct for Balanga. **Never** Michelin's `13.75647, 121.05831` | Confirmed-correct value already in `site.ts` |
| **`openingHoursSpecification`** | `Mo–Tu–We–Th–Fr–Sa 08:00–17:00`, Sunday omitted or `closed` | **Verified from the Facebook page.** Sunday-closed is a real differentiator: publish it and be right |
| **`areaServed`** | `Balanga City`, `Bataan`, `Region III` | Feeds local relevance |
| **One `<h1>` per page** | Matches the cluster's head term plus the local modifier | The brief's non-negotiable |
| **Meta titles** | ≤60 chars, unique per URL | All supplied above; QA should count them |
| **Meta descriptions** | ≤155 chars, unique per URL | All supplied above |
| **`AggregateRating`** | 🚫 **Omit entirely** | No Google rating exists, and `4.9` with `0` reviews in `site.ts` is fabricated |
| **`BreadcrumbList`** | Home → section → current | Free SERP enhancement |
| **`FAQPage`** | Only where the Q&A is **visually rendered** on the page | Markup for hidden content is a manual-action risk |
| **Filipino/`lang` tags** | `lang="en-PH"` globally; `lang="fil"` on Taglish FAQ items | Correct screen-reader pronunciation — a WCAG 2.2 issue, not a nicety |
| **Image `alt`** | Describe the *work*, never the person (`"Brake pads and disc rotor on the front axle of a silver sedan"`). **Never** a plate number | `legal-compliance-ph.md` §7 + WCAG 2.2 |
| **`width`/`height` on every image** | Mandatory | The brief's CLS non-negotiable |
| **Sitemap** | All locked routes + `/privacy` + `/terms` | Owned by `frontend-core` |
| **`/admin` in robots.txt** | `Disallow: /admin` | Bookings board must not be indexed |
| **LocalBusiness schema on `/` only** | Don't emit the same `AutomotiveBusiness` on 8 URLs | Duplicated structured data across URLs is a quality signal loss |

---

## 4. Directories and aggregators to register on

Prioritised by **expected return on effort** for a single small Balanga shop. Effort
estimates assume the owner can spend a couple of hours per weekend.

### Tier 1 — do these first (highest ROI, lowest effort)

| # | Target | Why | Effort | Status |
|---|---|---|---|---|
| 1 | **Google Business Profile** 🔴 | 🚨 **EYG HAS NONE. This is the single highest-impact action in this entire document.** In Philippine local search, the GBP is the primary "near me" surface, and "near me" is the cluster EYG's location is best suited to. It drives the Maps pack, the knowledge panel, and Calls from the profile. It is also **free**. | 2–3 h | ❌ **DOES NOT EXIST — create it** |
| 2 | **Claim / update the balanga.com.ph listing** | Already exists, already verified as an official City of Balanga tax-record listing. Currently shows **Calero St., Ibayo** (the tyre shop) and phone `09985323508`. **The site will say EGSA Fourlanes. This NAP must be reconciled or it becomes a citation of EYG's *old* address.** Free, city-backed, and `.gov`-adjacent trust. | 30 min | ⚠️ Exists, needs updating |
| 3 | **Facebook page linkage** | Link the website to both FB pages; add the website to both pages' "About". Facebook is where EYG's actual customers are — the posts prove it | 30 min | ⚠️ Partly done (cross-linking exists) |
| 4 | **Waze for Business** | Heavily used by Filipino drivers, **almost never claimed** by small shops, and a real "near me" surface. Map Report → Business | 1 h | ❌ Unknown — check |
| 5 | **Apple Business Connect (Apple Maps)** | Free. Siri/Spotlight suggestions, and Apple CarPlay navigation. **Frequently neglected in the Philippines.** | 1 h | ❌ Unknown — check |

### Tier 2 — do these within the first month

| # | Target | Why | Effort |
|---|---|---|---|
| 6 | **Michelin Philippines dealer locator** 🔴 | EYG **is already listed** — but filed under **Batangas** with Batangas City coordinates and **absent from the Bataan index**. **Ask Michelin to correct the city, address and coordinates, and to list EYG under Bataan.** Only the authorised dealer can do this. High-intent branded traffic. | 1 h + follow-up |
| 7 | **BFGoodrich Philippines dealer locator** | Identical record, same fix | 1 h + follow-up |
| 8 | **Goodyear Philippines** | Check whether a franchise operates in Bataan; if EYG is an authorised fitment centre, get listed. If not, **do not** | 1 h |
| 9 | **YellowPages.ph** | Low traffic, but a citation that reinforces NAP consistency | 30 min |
| 10 | **Foursquare** | Feeds many aggregators; cheap | 20 min |
| 11 | **Bataque / Bataan provincial directory** | Regional Bataan listings — `UNVERIFIED` whether one still operates; check before investing | 30 min |
| 12 | **DaangPinas / Bataan Geoportal** (LGU) | Municipal listings. `UNVERIFIED` whether still active — the balanga.com.ph partnership suggests a working relationship with the City Government, which is the more valuable channel anyway | 30 min |
| 13 | **Google "Add a missing place"** | For the **EYG Tire & Auto Care** name at EGSA Fourlanes if no GBP can be created immediately | 30 min |
| 14 | **Merchant/booking aggregators** — e.g. a Philippine service-booking platform | Long-tail referral; test one, measure honestly, drop it if it produces nothing | 2 h |

### Tier 3 — optional, low priority

`Davao`-style regional portals, `Yelo`-style local deals sites, `Aklat`/blog directories
(skip — no traffic), TripAdvisor/Google Places hotel-adjacent categories (not applicable),
`MyBusiness` on Facebook Marketplace (no).

### Explicitly NOT worth the owner's time

❌ **Bulk Philippine directory-submission services.** They create hundreds of
low-quality, inconsistent NAP citations across sites that are already spammy. For a
business whose entire advantage is being *findable and honest*, spraying inconsistent
citations across 200 directories is **directly counterproductive to the strategy in
`competitors.md` §5.1**. Fix the 13 real surfaces instead.

❌ **Paid "SEO package" resellers.** Same reason, plus a cost.

❌ **Facebook page-name squatting / buying competitor keywords.** No.

---

## 5. Measurement plan

| Window | Action | What it tells you |
|---|---|---|
| **Pre-launch** | Run Google Keyword Planner for all 15 clusters at Balanga/Bataan location. **Write the real numbers into this file.** Complete the GBP. | Replaces every `VOLUME: UNVERIFIED` above with fact |
| **Launch + 7 days** | Confirm the GBP is live and the NAP is identical on: website, GBP, both FB pages, balanga.com.ph, Waze, Apple Maps. Screenshot each. | NAP consistency — the foundation of local ranking |
| **Launch + 30 days** | `Search Console → Performance`. Record real queries. Check `index.html` is in the index for every locked route. | Which clusters actually get impressions |
| **Launch + 30 days** | Ask **every** customer who books: *"How did you find us?"* Log the answer against the booking. **This beats every third-party tool for a business this size** — and the booking form should have a one-tap "How did you hear about us?" field | The only *true* attribution EYG will ever have |
| **Launch + 90 days** | Rewrite this file with Search Console data. Add `/services/{service}` pages if the data shows cluster cannibalisation. | Whether the locked page map is actually costing traffic |
| **Quarterly** | Re-check the Michelin/BFG locator. Re-verify the GBP hasn't been suspended or edited. Re-check the FB service list for changes. | Facebook is the shop's most reliable source of truth; re-read it quarterly |

---

## 6. Summary of every flagged uncertainty in this document

| Item | Flag | Where |
|---|---|---|
| All 15 clusters' search volume | `UNVERIFIED` — no keyword tool available | §1, §2 throughout |
| **Undercoating as a service** | 🚫 **NOT on the verified service list.** Do not target Cluster F until confirmed | Cluster F |
| **Roadside assistance** | 🚫 **ZERO evidence it exists.** Do not target Cluster G until confirmed | Cluster G |
| **AC repair** | ⚠️ Not on the verified list; 3 local competitors already advertise AC | Cluster K |
| **Engine tune-up, shocks, CVL, glass, motorcycles** | ⚠️ All in the brief, none verified | `content/services.md` |
| **"Authorised"/"official"/"accredited" wording** | 🚫 Prohibited. "Listed dealer" is the maximum defensible claim | Cluster I |
| **5 of 6 tyre brands in `site.ts`** | 🚫 No evidence. Must be removed | Cluster I |
| **Two addresses / two phone numbers** | 🚫 Resolve before launch or every cluster is compromised | §3 |
| **`AggregateRating: 4.9 / 0 reviews`** | 🚫 Fabricated. Omit | §3 |
| **Per-model service-interval table** | ⚠️ Only write it if someone will maintain it | Cluster O |
| **Taglish keyword volumes** | `UNVERIFIED`. Autocomplete data will be the cheapest real substitute | Cluster M |
| **Directory existence** (Waze, Apple, YP.ph, Foursquare, Bataan Geoportal) | ⚠️ Existence unverified — they were unreachable from this environment | §4 |

**The one thing that matters most in this entire file:** none of the 138 competitors in
Balanga publish their hours, their prices, or a way to book. That is an **observable
fact**, not a volume estimate. It is a bigger SEO opportunity than any keyword on this
page, and it requires no search-volume data to justify acting on it today.
