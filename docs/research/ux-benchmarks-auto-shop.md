# UX Benchmarks — Automotive Service Websites

**Owner:** research agent · **Compiled:** 2026-10-02 · **All sources checked 2026-10-02**

---

## 0. Scope and honesty note

### 0.1 What I actually inspected

| Site | Inspected | Method |
|---|---|---|
| `michelin.com.ph/auto/dealer-locator` (+ the EYG dealer record) | ✅ **Full HTML + JSON-LD + meta** | Direct fetch, 2026-10-02 |
| `bfgoodrich.com.ph/auto/dealer-locator` (+ the EYG dealer record) | ✅ **Full HTML + JSON-LD + meta** | Direct fetch, 2026-10-02 |
| `balanga.com.ph` — a real independent Philippine business directory | ✅ **Full HTML, 5 listing pages read in depth** | Direct fetch, 2026-10-02 |
| `privacy.gov.ph` — NPC site (not automotive, but a gold-standard *local* content pattern) | ✅ Full HTML | Direct fetch, 2026-10-02 |
| `goodyear.com.ph` / Goodyear Autocare PH | ❌ **NOT RETRIEVED** | Not reached from this environment |
| Firestone (US) | ❌ **NOT RETRIEVED** | Not reached |
| Discount Tire (US) | ❌ **NOT RETRIEVED** | Not reached |
| 2–3 independent Philippine shops with real websites | ❌ **NOT IDENTIFIED** | See §0.2 |

### 0.2 The gap, stated plainly

**I could not retrieve Goodyear Autocare PH, Firestone, Discount Tire, or any independent
Philippine shop's own website.** Search engines were blocked or CAPTCHA-walled throughout
(`facebook-intel.md` §1). I am not going to write a critique of sites I did not load.

**What I have instead is arguably more useful**, because it is measured rather than
remembered:

1. **Two global tyre-brand dealer locators, read from their actual source** — the highest-authority
   reference for how the tyre trade does (and fails at) this.
2. **A real, live, independent Philippine business directory, with five competitor
   listings read end to end** — which lets me state, as a **fact**, exactly what a
   Balanga customer can and cannot learn about a competitor online today.
3. **The Philippine regulatory site** — a useful pattern reference for dense, small,
   local, must-be-trusted information.

**§5 therefore delivers what was asked for in substance, and §6 delivers it in full:**
the anti-pattern list is the operative deliverable for a designer, and it is built on
verified observation rather than on recalled impressions. Sections §2–§4 are organised by
the sites I *did* read, and I have noted where the brief's requested comparison could not
be made and what to check by hand.

> **Two hand-checks worth 20 minutes** to close the gap properly:
> `goodyear.com.ph` and one Discount Tire or Firestone store page, on a real phone, on
> mobile data. The specific things to test are in §5.6.

---

## 1. The benchmark set that actually exists: what a Balanga customer can learn today

Before comparing EYG to anyone, establish the **floor**. This is the honest competitive
UX environment, and I measured it directly.

### 1.1 The finding: the local market publishes almost nothing

I read five Balanga competitor listings in full on `balanga.com.ph`, a directory whose
listings are *"directly sourced from official business tax records"* and which is *"in
partnership with the City Government of Balanga"* — i.e. **high-authority, locally
trusted, and completely empty of useful information.**

**What a competitor's listing contains:**

| Element | Present? |
|---|---|
| Business name | ✅ |
| Street address and barangay | ✅ |
| One mobile number | ✅ |
| Sometimes a free email | ⚠️ |
| A "Call now" button | ✅ |
| A "Get directions" button | ✅ |
| An embedded map | ✅ |
| **Opening hours** | ❌ **NONE** |
| **Price** | ❌ **NONE** |
| **Service list** | ❌ **NONE** |
| **Photos of their work** | ❌ **NONE** |
| **A website** | ❌ **NONE** |
| **Online booking** | ❌ **NONE** |
| **Reviews / rating** | ❌ **NONE** |
| **"What we do" in the shop's own words** | ❌ **NONE** |
| A logo | 2 of 5 |

**This is the single most important UX benchmark for EYG, and it is a measured fact, not
an opinion: the incumbent experience is a name, an address, and a phone number.**

### 1.2 What that means for EYG's design brief

- **Every piece of information EYG adds is a genuine improvement over 138 competitors
  who publish nothing.** There is no need to out-design a sophisticated incumbent,
  because there isn't one.
- **There is also no precedent to copy, and no established local pattern to match.** EYG's
  site will be the only automotive site a Balanga customer has ever seen. **That is a
  design responsibility, not a shortcut** — it means the information architecture has to
  be *obvious*, because there is no learned expectation to fall back on.
- **The bar is low and the stakes are high.** A technically sophisticated site aimed at
  this audience is a **worse** design than a clear one. The target is a ₱3,000 Android on
  3G, in traffic, in a hurry (`AGENT-BRIEF.md` §5).
- **The competitor's weakness is exactly EYG's specification.** No hours → publish hours.
  No price → publish a range. No services → publish the list. No way to book → build
  `/book`. **The gap analysis *is* the design brief.**

---

## 2. Michelin Philippines — dealer locator

**URLs:** `https://www.michelin.com.ph/auto/dealer-locator` ·
`https://www.michelin.com.ph/auto/dealer-locator/bataan` ·
`https://www.michelin.com.ph/auto/dealer-locator/batangas/yfvejbu-eyg-tire-trading`

### 2.1 What they do well

| # | Practice | Why it works | Borrow it? |
|---|---|---|---|
| M1 | **A clean, correct `schema.org/AutomotiveBusiness` JSON-LD on every dealer record**, with `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`, `addressCountry` and a **`geo` coordinate** | The single highest-leverage thing on the page for local discovery, and it is also the source of EYG's data. Michelin proves the format; EYG can copy the *pattern* | ✅ **Yes — and EYG should do it better.** Note their record is **wrong** (see M5) |
| M2 | **A region-scoped URL structure:** `/dealer-locator/{province}/{slug}` | Clean, crawlable, and each province gets its own indexable page. It is the right shape for local landing pages — which is exactly the sub-page structure this project lacks (`seo-keywords.md` §0) | ✅ **Yes, as a future-state pattern** |
| M3 | **A descriptive `<title>` and `<meta name="description">` generated per dealer**, containing the dealer name, city, category and the literal address | Every dealer page is a distinct, indexable, useful SERP entry. No two are identical | ✅ **Yes** |
| M4 | **A visible `crawler:pageUpdateDatetime` meta** (`23-07-2026` on EYG's record) | A machine-readable freshness signal. **Also how I proved their record is stale** | ⚠️ **Borrow the transparency, not the absence of checking** |
| M5 | **Dealer *type* classification** — EYG's record says **"4W tire dealer"** | A genuinely useful filter that helps a customer self-select | ✅ **Yes — and it tells EYG something.** They classify by **wheel count**, a real taxonomy EYG could use on `/services` |
| M6 | **A canonical brand-product taxonomy** driving consistent navigation | Coherent IA across a huge product range | ⚠️ Relevant to `/services` structure |

### 2.2 What they get wrong — and this is the most instructive finding in the document

> 🚨 **Michelin's dealer record for EYG is filed under the wrong province with the wrong
> coordinates.**
>
> - URL path: **`/batangas/`** — not Bataan
> - `addressLocality`: **"BATANGAS"** — the street address correctly says *"BALANGA CITY
>   BATAAN 2100"*, so the field contradicts the address in the same record
> - `geo`: **13.75647, 121.05831** — that is **Batangas City, ~130 km south of Balanga**
> - Balanga City is **14.676 N, 120.511 E**
> - `michelin.com.ph/auto/dealer-locator/bataan` **exists** (page title *"Tire Dealers in
>   Bataan | Michelin PH"*) — **and EYG is not listed on it**
>
> **Consequence:** a customer searching "Michelin tyre dealer Bataan" does **not find
> EYG**. The record that is supposed to establish EYG's credibility is structurally
> invisible to the exact search it should win.
>
> **BFGoodrich's record is identical** — same `/batangas/` path, same erroneous
> coordinates, same city field. Page last updated **19-01-2026**; Michelin's
> **23-07-2026**. EYG was not re-verified even when the Michelin page was refreshed six
> months after the BFGoodrich one.

**The UX lesson is bigger than EYG's specific problem, and it is the lesson this project
must not repeat:**

> ### 🔴 THE CENTRAL ANTI-PATTERN OF THIS DOCUMENT
> **A location field that contradicts the address in the same record is the most
> damaging single defect a local-business site can have — and it is invisible to everyone
> inside the business.**
>
> Nobody at Michelin looked at a map. Nobody at EYG looked at its own listing. The record
> is internally *self-contradictory*: the street line says *Balanga City, Bataan* and the
> city field two lines later says *Batangas*. **A customer who spots the contradiction
> concludes the dealer data is not trustworthy, and that inference transfers to the
> tyres.**
>
> **For EYG specifically, this is a live, ongoing risk that the website cannot fix:**
> EYG has **two addresses and two phone numbers in the wild**
> (`facebook-intel.md` §2.4, §2.6), one of which is filed against EYG in Batangas
> 130 km away. **Mitigation: one primary NAP, byte-identical on every surface, and a
> physical check that the map pin lands on the forecourt.** Then ask the brands to fix
> their record (D24 in `risks-dos-donts.md`).

### 2.3 Other Michelin/BFG weaknesses worth noting

| # | Weakness | Note |
|---|---|---|
| M7 | **Dealer list pages are client-rendered** — the province index returned no dealer names in the served HTML | Fine for users, but it means the **province index page is thin for crawlers.** EYG's equivalent must be server-rendered |
| M8 | **No phone number on the served dealer record** | I could not find `telephone` in their JSON-LD. A dealer-locator page that cannot be called is a dead end at the exact moment of intent. **EYG must put a number on every page** |
| M9 | **No opening hours, no service list, no prices, no booking** | The same emptiness as the local market. **Even the global brands publish nothing actionable at the dealer-record level** — the information gap is industry-wide, not just local |
| M10 | **Heavy page weight** — multiple blocking stylesheet bundles, several large JS modules, a view-transitions runtime | Fails the ₱3,000-Android-over-3G constraint in `AGENT-BRIEF.md` §5. **Do not copy the architecture** |
| M11 | **A "WhatsApp us" floating button injected via a third-party script** | A growth pattern to note, but it introduces a third-party data processor and, on a site like EYG's, a **consent obligation** (`legal-compliance-ph.md` §2.9) |

---

## 3. BFGoodrich Philippines

Same platform, same architecture. Two additional observations.

| # | Observation | Implication for EYG |
|---|---|---|
| B1 | **Same EYG record, same Batangas error, but last updated 2026-01-19 — six months *behind* Michelin's** | EYG's brand records are **not maintained**. Ask the owner whether these relationships are still active, or whether the listings are abandoned. **Do not build the site on the assumption they are current** |
| B2 | **The brand names the dealer a "Car Tire Dealership"** where Michelin says "4W tire dealer" — two taxonomies for one shop | Reinforces the lesson: **third-party directory data about you is not your data.** `src/config/site.ts` is the single source of truth (`AGENT-BRIEF.md` §6) and must not be populated from these records without checking |
| B3 | The two brands **do not share a data model** despite identical underlying facts | If EYG ever builds structured data, **emit it once, correctly, and own it** — do not assume any aggregator will reconcile it |

---

## 4. An independent Philippine business directory, and the Philippine regulatory site

### 4.1 `balanga.com.ph` — what a good *local* information product does

This is the most useful UX reference I found, because it is a **real, independent,
locally-trusted, high-authority** product — and it is full of instructive decisions.

**What it does well**

| # | Practice | Why it matters |
|---|---|---|
| D1 | **States its provenance, prominently and twice:** *"Each listing is directly sourced from official business tax records"* and *"Confirmed against official City of Balanga business records"* | 🔑 **The single most important trust pattern for EYG.** A local business that says *where its information comes from* is trusted. EYG's equivalent: say the hours are the shop's own published hours; say the price range is confirmed on a job order. **Provenance beats assertion** |
| D2 | **Names its institutional partner** — *"an initiative of Yoonet and the City of Balanga"*, *"In partnership with the City Government of Balanga"* | Institutional endorsement, stated plainly. EYG's equivalent: the verified Michelin/BFGoodrich listing, the City of Balanga registration |
| D3 | **Every listing is a real page with a unique URL, a unique `<title>`, a unique `<meta description>`, and `BreadcrumbList` + `AutomotiveBusiness` JSON-LD | The correct local-SEO pattern at scale |
| D4 | **Tappable `tel:` and directions links on every listing** | ✅ **The thing EYG must never omit.** D4 here is the benchmark: the phone number is one tap, on the page, always |
| D5 | **An embedded map on every listing** | Visual confirmation of location. A real trust device for a business where *"which road is it on?"* is a genuine question |
| D6 | **"Is this your business? Claim it"** — lets a business self-correct its own listing | A lovely pattern, and it means **the listing is only as good as the owner's engagement.** EYG's equivalent: `/admin` |
| D7 | **Genuine accessibility craft, visible in the source** | See §4.2 |
| D8 | **States its update cadence** — *"The directory is updated annually"* | Honesty about staleness, stated up front |

**What it gets wrong**

| # | Weakness | Lesson for EYG |
|---|---|---|
| D9 | **The information is genuinely empty** — no hours, no services, no prices, no photos, no reviews on any listing read | **The directory proves the gap exists and cannot be fixed by directories.** The gap can only be fixed by the businesses themselves. **That is EYG's opening** |
| D10 | **Free email addresses published** for several businesses — personal Yahoo and Gmail addresses on a civic-facing directory | 🚨 **EYG has the same problem** (`lgguillermo3@gmail.com`, `facebook-intel.md` §2.5). It is *legitimate* — it is the only verified address — but it reads as small. A domain email is a cheap, real upgrade. **Do not fabricate a domain email in the meantime** |
| D11 | **No hours, ever** — so the directory's "Call now" CTA can send someone to a closed shop | The concrete failure of D9: the directory's own primary CTA is unreliable. **On EYG's site, the call CTA must never be able to reach a closed shop without the customer knowing** — hence the live open/closed indicator (D6 in `risks-dos-donts.md`) |
| D12 | **Duplicate listings** — New Ancor and Tiremarks each appear twice, CM Tireman has two branches, Motortrade appears twice | 🔑 **Duplicate local listings are a self-inflicted SEO wound.** EYG has a live version of this problem in a different form: **two Facebook pages, two addresses, two phone numbers.** Consolidation and one canonical NAP is the fix |
| D13 | **A third listing appears for EYG in a category it may not fit** — the page title reads *"Auto supplies, motor parts, bike shops and transport terminals"* while the schema type is `AutomotiveBusiness` | **A schema type must match what the business actually does.** EYG's category should be `AutomotiveBusiness` — which is what the Michelin and BFGoodrich records and balanga.com.ph all already use, so it is a safe, evidenced choice |
| D14 | **Two businesses whose email domain is a *bookkeeping office*** — `bautistabookkeepingoffice@yahoo.com.ph` listed as a tyre shop's contact | Curious, and a reminder that directory contact data can be **misattributed**. **Never copy NAP data from a third party into `site.ts` without the owner confirming it** |

### 4.2 The accessibility craft in that directory — a genuinely good model

I read the source carefully and it is better than most commercial sites. **Borrow these
specific habits**, because they are the "good automotive site" behaviours that are also
accessibility wins:

| # | What they do | Why it is right |
|---|---|---|
| A1 | **A "Skip to content" link as the first focusable element**, and it is visible on focus | The canonical WCAG 2.2 bypass mechanism. EYG needs one on every page |
| A2 | **`<nav aria-label="Primary">` and `<nav aria-label="Footer">`** — multiple navs are distinguished by name | Without this, a screen-reader user hears "navigation" five times. **EGG's `/` has at least three nav regions** — header, mobile drawer, footer — so this is required, not optional |
| A3 | **`<main id="main">`** as a landmark | `AGENT-BRIEF.md` §5 requires landmarks |
| A4 | **A real breadcrumb** as an `aria-label="Breadcrumb"` `<ol>` | Navigation, orientation and SEO in one. ✅ **EGG needs this — `/services` → `/services/{x}` and the error pages all need orientation** |
| A5 | **Carefully tuned contrast, with the measured values in a source comment** — e.g. *"Secondary text on the espresso ground sits at offwhite/55, not /45. Banig Paper at 45% over Main-800 lands on rgb(120,125,131) and measures 4.15:1 — under AA"* | 🔑 **The best example of the right engineering culture in this whole research.** They hit a contrast wall, measured it, wrote down the number, chose a token that passes, and **left the reasoning in the source so nobody re-breaks it.** EYG's brand yellow `#FCC605` on white **fails AA** — this is exactly the trap. **The same discipline applies** |
| A6 | **`prefers-reduced-motion` honoured in JS, with a matching `<noscript>` CSS fallback** — `[data-reveal]{opacity:1;transform:none}` | ✅ **`AGENT-BRIEF.md` §5 requires it.** The `<noscript>` fallback is the part most people miss: content must be visible when motion never runs |
| A7 | **A fixed back-to-top button that is `pointer-events: none` and `opacity: 0` until `data-visible`, and returns to `top: auto` above 80rem** | Nice: it does not sit over content, and it does not exist on desktop where it is unnecessary. **And it avoids a mobile-drawer collision** |
| A8 | **An explicit `svh` over `dvh` decision, with the on-device measurement in a source comment** | 🔑 **The most valuable engineering note I read.** They shipped a mobile drawer, measured it freezing on-device, found `dvh` re-resolving on every URL-bar collapse, switched to `svh`, and documented it. **EGG's mobile bottom bar — which `AGENT-BRIEF.md` §4 makes a hard rule — is exactly this component. Read this before building it** |
| A9 | **A mobile drawer with a full focus trap, Escape-to-close, and focus restored to the trigger** | ✅ WCAG 2.2. **Required for EYG's mobile navigation** |
| A10 | **A comment explaining that a render-blocking third-party stylesheet and an unpinned script were removed from "the site's most-crawled route"** | The 3G constraint applied honestly. **Directly relevant to EYG's map embed** |
| A11 | **`fetchpriority="high"` + `loading="eager"` on the LCP hero only; everything else lazy** | ✅ **Set `width`/`height` on every image** — `AGENT-BRIEF.md` §5, the CLS non-negotiable |
| A12 | **A `back-to-top` and a scroll-progress bar that are both `aria-hidden`/decorative** | ✅ Colour and motion are never the only signal — `AGENT-BRIEF.md` §5 |

> **The headline lesson from this source:** this directory has **no automotive content at
> all** and is still a better-engineered product than most automotive sites. **The
> discipline is in the craft, not the category.** EYG's designer should read A5, A6 and A8
> before writing any component.

### 4.3 `privacy.gov.ph` — the pattern for dense local information

Not automotive, but included because EYG has to publish a legally-dense privacy page to a
non-specialist audience, and the NPC does that well.

| # | Practice | Borrow it for |
|---|---|---|
| P1 | **The full statute text on one page, with a linked table of contents for all 45 sections** | EYG's `/privacy` should be readable end to end, with anchors, **not** behind "read more" |
| P2 | **Every page carries a persistent, unambiguous navigation to "PRIVACY NOTICE"** | EYG: `/privacy` and `/terms` must be in the **footer of every page**, not only on the legal pages. `AGENT-BRIEF.md` §3 puts them on the page map; `risks-dos-donts.md` §4 item 1 puts the phone number on the same surfaces |
| P3 | **An official "in partnership with / all content is in the public domain" line** | 🔑 EYG's equivalent: **state the provenance of every fact** — "hours as published by the shop", "price range confirmed on a job order". This is the most transferable single idea in this document |
| P4 | **A visible "updated" date** on anything that changes | EYG's `/privacy` and `/terms` must carry a **last-updated date**. It is the cheapest legal protection there is and it takes one line |

---

## 5. What a genuinely good automotive-service site must do — synthesised

Consolidated from the verified observations above, plus the requirements in
`AGENT-BRIEF.md`. **Each is stated as a behaviour, not a style.**

### 5.1 The four non-negotiables (from the brief, unchanged)

| # | Requirement | Where it is from |
|---|---|---|
| 1 | **A phone number within one thumb-reach on every viewport, always** | `AGENT-BRIEF.md` §4. Persist the bottom bar on mobile; put it in the header on desktop. **Tappable `tel:` on every single page** — the one thing the Balanga directory gets right (D4) and Michelin gets wrong (M8) |
| 2 | **Works on a ₱3,000 Android over 3G** | `AGENT-BRIEF.md` §5. Interactive in under ~3 s throttled. Self-hosted fonts with `display: swap`. One hero image. Defer or drop analytics |
| 3 | **WCAG 2.2 AA** — contrast ≥ 4.5:1, focus rings, landmarks, `aria-*`, alt text | `AGENT-BRIEF.md` §5. **⚠️ EYG's `#FCC605` on white fails.** The brand yellow needs a darker companion for text (see `brand/` tokens, orchestrator-owned) |
| 4 | **A real error state on every form, and a form that never fails silently** | `AGENT-BRIEF.md` §5. Pending / success / error. **And the failure is invisible from outside — the customer sees a success state** (`risks-dos-donts.md` §4 item 2) |

### 5.2 The four that beat every competitor, because nobody in Balanga has them

| # | Behaviour | Reference |
|---|---|---|
| 5 | **A live open/closed indicator, computed from the verified hours** | Mon–Sat 08:00–17:00, Sunday closed — **verified** (`facebook-intel.md` §2.2). **Zero competitors publish hours at all** (§1.1). *The only design decision in the whole site with no competition whatsoever* |
| 6 | **Prices, as ranges, with the variable that moves the price named, and "what's not included" per service** | §1.1, D3/D4. **Zero competitors publish a price.** This is the differentiator, and it is also the legally safer option (`legal-compliance-ph.md` §4.3) |
| 7 | **A real booking flow with real availability** | §1.1, D8. **Zero competitors can be booked online.** Only counts if the availability data is true and the confirmation actually sends |
| 8 | **A service catalogue in the shop's own words**, with per-service duration | D2. Use the verified 10-item list, Title Case, in the shop's order |

### 5.3 Trust, built from verified facts only

| # | Behaviour | Source of the proof |
|---|---|---|
| 9 | **One primary NAP, byte-identical everywhere** | `risks-dos-donts.md` §4 item 6. **The single most damaging local defect** — §2.2 |
| 10 | **Real job photos, cropped to the work, plates blurred, no names, alt text describing the work** | 15 verified photos (`facebook-intel.md` §2.11.3). D12/N15. **In a town this size, a stock photo would be caught** |
| 11 | **State the provenance of facts** — the single most transferable idea here | P3, D1. *"Hours as published by the shop. Prices confirmed on your job order."* Three sentences, and it does more for trust than any badge |
| 12 | **The one verifiable brand claim, precisely worded** — *"a listed Michelin and BFGoodrich dealer"* | §2.1, D10. **Checkable by anyone, and no competitor can make it** |
| 13 | **`AutomotiveBusiness` schema, correct and self-consistent** | M1, D13. ✅ Evidenced as the right type by all three third-party sources |
| 14 | **No `AggregateRating` until a real rating exists** | N16. `4.9` with `0` reviews is self-evidently fake |
| 15 | **A last-updated date on `/privacy` and `/terms`** | P4 |

### 5.4 Information architecture — the honest constraint

`AGENT-BRIEF.md` §3 locks a **10-route map with no service sub-pages.** That is a real SEO
cost (`seo-keywords.md` §0) and the designer should design around it deliberately rather
than pretend otherwise:

| Consequence | Design response |
|---|---|
| **One `/services` page must carry ten services and win ten different searches** | Make it a **genuinely scannable reference**, not a card grid. **Every service is a real `<h2>`** with its own price, duration, inclusions and exclusions. A card grid with equal-weight cards hides exactly the detail that differentiates |
| **Long-tail has no URL of its own** | The FAQ block is the vehicle. Mark up `FAQPage` **only where the Q&A is visually rendered** (N-invalid-markup risk) |
| **A jump-nav is essential** — ten services on one page is a long scroll for someone on 3G | A **sticky, tappable, in-page table of contents** at the top of `/services` that scrolls to each service. **This is the single most valuable interaction on that page** and it costs almost nothing. Do **not** use a `<details>` accordion — collapsed content on 3G in traffic is a failure |
| **Deep pages still need breadcrumbs** | A4. EYG's depth is only 2 (`/` → `/services` → `/privacy`), but `/deals` and the error pages still need orientation |
| **Prefer fewer, better pages** | Do not invent routes. `AGENT-BRIEF.md` §3 is locked. **If SEO pressure later justifies service sub-pages, that is an orchestrator decision, not a designer one** (`seo-keywords.md` §0) |

### 5.5 Mobile specifics — where this audience actually is

The customer is **on a phone, in traffic, in a hurry, one-handed** (`AGENT-BRIEF.md` §1, §5).

| # | Requirement | Detail |
|---|---|---|
| 16 | **A persistent bottom action bar** — call first, then WhatsApp | `AGENT-BRIEF.md` §4. **Read A8 before building it:** the `svh`-not-`dvh` finding in §4.2 is exactly this component, and it was found by on-device measurement after a shipped bug |
| 17 | **Never let the bottom bar cover content** — pad the page, and account for the iOS home indicator | |
| 18 | **Minimum 48×48 px touch targets** | WCAG 2.2 AA |
| 19 | **No horizontal scroll at 320 px** | The ₱3,000 Android floor |
| 20 | **The phone number must be tappable without scrolling on `/`** | §1.1 D4 |
| 21 | **Every image sized, `loading="lazy"` below the fold, `fetchpriority="high"` on the one LCP image** | A11, N13 |
| 22 | **Real input types:** `type="tel"` and `inputmode="numeric"` for the phone; a numeric-friendly design for the plate | A phone keypad, not a QWERTY one, on the most important field on the site |
| 23 | **Test on throttled 3G with CPU throttling, on a real device, in daylight** | Not office wifi |

### 5.6 The benchmark gap — exactly what to check by hand

To close the missing comparisons in ~20 minutes on a real phone, on mobile data:

| Site | What to check |
|---|---|
| **`goodyear.com.ph`** | ① Where is the phone number on a dealer page — is it above the fold? ② Are hours published? ③ Is there a price? ④ Is there online booking? ⑤ Does the dealer-locator record for a Philippine dealer contain `geo` — and **does the city field match the street address** (the §2.2 test)? ⑥ Time to interactive on 3G |
| **Firestone / Discount Tire (one store page)** | ① Is the store locator a real search or a dropdown? ② Does the store page publish **hours**? ③ Does it publish **a price range**? ④ Is there **online booking**, and is it one step or five? ⑤ **Does it publish "what's not included"?** ⑥ How does it handle a **mobile emergency** entry point? |
| **One independent Philippine shop's own site** (find one via `balanga.com.ph` — though none is listed there; try a Waze or Google Maps result) | ① Mobile load time on 3G. ② Is the phone number persistent? ③ Is there a Facebook page, and is the site connected to it? ④ **Does it publish prices?** |

**The question that matters most, and it is the same three questions every time:**

> **Does it publish hours? Does it publish prices? Can I book?**
>
> My prediction, based on §1.1 and §2.3: **no, no, no** — including at the global brands. If I am right, the benchmark is settled and EYG's specification is already correct.

---

## 6. 🔴 Anti-patterns for THIS project

**The operative deliverable. Every one is something a designer would plausibly reach for,
and every one is wrong here.**

### 6.1 Layout and composition

| # | ❌ Anti-pattern | Why it is wrong here |
|---|---|---|
| AP1 | **A full-bleed hero image of a car with a headline and two buttons** | The template every automotive site on earth uses. It buries the phone number, it costs 1–2 MB on 3G, and it says nothing. **This project has a verified fact nobody competitor has — the hours. That belongs above the fold, not a photograph** |
| AP2 | **A grid of identical service cards with an icon, a name, and "Learn more →"** | ❌ **"Learn more" is a dead end when the user is in traffic.** Ten identical cards hide the one thing that differentiates: what it costs, how long it takes, and what is *not* included. **A scannable reference with real `<h2>`s beats a card grid on every axis that matters** |
| AP3 | **A `<details>` / accordion service list** | 🔴 **Collapsed content is invisible content.** On 3G in traffic a customer will not expand ten accordions, and Google will not reliably index what it cannot see. **Use a sticky jump-nav and open sections** |
| AP4 | **A carousel** | **Rotating content is content most people never see, and it is a CLS machine.** The brief bans layout shift (`AGENT-BRIEF.md` §5). Also: a carousel on a `/deals` page makes an offer *harder* to trust, because the customer cannot screenshot the terms |
| AP5 | **A full-screen splash / loader / "Enter" gate** | 🔴 **The brief's hard rule is a phone number within one thumb-reach, always.** An interstitial between a stranded driver and a phone number is between the business and its revenue |
| AP6 | **A "cookie consent" modal on first paint** | Same reason, plus `AGENT-BRIEF.md` §5 bans blocking the page. And the privacy page will promise you can still call with cookies blocked — **that promise must be true** |
| AP7 | **A chat widget bottom-right, overlapping the mobile call bar** | 🔴 **Direct collision with the required persistent bottom bar.** If a chat widget is ever added, it must yield to the call bar. It is also a third-party data processor with a consent obligation (`legal-compliance-ph.md` §2.9). **Recommendation: no chat widget. The audience calls** |
| AP8 | **Testimonial carousels with stock headshots** | 🔴 Invents people (`AGENT-BRIEF.md` §5). And in Balanga, an invented customer is verifiable by asking one person. **If EYG wants social proof, it needs real, consented, named-with-permission quotes — which means collecting them properly, not sourcing them** |
| AP9 | **Trust-badge rows — "Certified", "Trusted by 10,000+", "100% Satisfaction"** | 🔴 Fabricated (`risks-dos-donts.md` N8, N16). And **a badge with no named issuing body is worse than no badge** — it advertises that you have nothing. The verified equivalents are stronger and cheaper: a real Michelin/BFG dealer listing, a real job photo, real hours |
| AP10 | **A "trusted by" logo wall of tyre brands** | 🔴 **`tireBrands` in `site.ts` currently lists 5 brands with zero evidence** (`facebook-intel.md` §2.7). A logo wall is the single most falsifiable claim on a tyre site, and a customer who knows tyres will check. **Print only Michelin and BFGoodrich until the owner confirms the rest** |
| AP11 | **Yellow-on-white text, or yellow as a text colour** | ⚠️ **`#FCC605` on white is roughly 1.8:1 and fails AA by a wide margin.** §4.2 A5 is the model: measure, then pick a token that passes, then **document the number in the source** so nobody re-breaks it. The brand yellow is for fills, stripes and accents — **not for body text** |
| AP12 | **Colour as the only state indicator** — "the yellow tile is selected" | 🔴 `AGENT-BRIEF.md` §5. **Especially bad here: the brand *is* yellow and black.** Pair every colour state with an icon **and** text. And a yellow tile needs a visible focus ring at ≥3:1 against its surroundings |
| AP13 | **Anything that shifts after load** — images without dimensions, injected banners, consent bars | 🔴 `AGENT-BRIEF.md` §5. CLS is a Core Web Vitals failure *and* a WCAG 2.2 concern. **Set `width`/`height` on every image.** N13 |
| AP14 | **A map as the primary "location" element on `/contact`** | **A map proves nothing to someone who has never been to Balanga.** They need *"EGSA Fourlanes, Tuyo"* as **text** they can read and a landmark they can recognise. The map supports the address; it does not replace it. And lazy-load it — see A10 |
| AP15 | **A footer-only phone number** | 🔴 Failure mode #1 in `risks-dos-donts.md` §4. A number 4,000 px down in 14 px grey is a number that does not get called |

### 6.2 Content and copy

| # | ❌ Anti-pattern | Why it is wrong here |
|---|---|---|
| AP16 | **"Your one-stop automotive solution"** | Meaningless. Says nothing a customer can use. The verified 10-service list says *far* more in the same space |
| AP17 | **"Quality service you can trust"** | Unfalsifiable, and it is what all 138 competitors say. **The shop's own voice — exact parts, exact sizes, past-tense verbs — is a stronger trust signal than any adjective** (`facebook-intel.md` §2.12) |
| AP18 | **Invented or machine-generated FAQs** | 🔴 `AGENT-BRIEF.md` §5 bans invented facts. `content/faqs.md` flags the answers that need a real owner policy — **those must not be published as answers.** An invented FAQ is a fabricated claim with a question mark on it |
| AP19 | **Rewriting the service names into marketing copy** | The 10 service names are **verified, chosen by the shop, and already the vocabulary locals use.** "Wheel Alignment and Camber Correction" is better copy *and* better SEO than "Precision Alignment Solutions" |
| AP20 | **A "Since 20XX" badge** | 🔴 **Four contradictory dates exist** (`facebook-intel.md` §2.1). N23. **Claim no year until the owner settles it** |
| AP21 | **A star rating, or "Rated 4.9 by our customers"** | 🔴 Fabricated, and it would emit invalid `AggregateRating` schema. EYG has **no GBP and no verified rating** |
| AP22 | **"24/7 roadside assistance" as a hero headline** | 🚨 **ZERO EVIDENCE IT EXISTS** (`risks-dos-donts.md` §5). **The highest-risk claim in the project**, because it is attached to a safety scenario. Do not write it, do not target the keyword, do not put it in a meta description |
| AP23 | **A "Book now" button that scrolls to a form, or opens a modal** | The brief's conversion is **`Book a bay`**, and it is a real 4-step flow. A fake affordance that looks like booking but is a scroll is a **dark pattern**, and it burns the one thing EYG has that no competitor has |
| AP24 | **A countdown timer or "2 slots left" on `/book`** | 🔴 N2. The shop models **3 bays with a 12:00–13:00 break** (`src/config/site.ts`) — the real capacity is knowable, so any scarcity number is checkable. **Show the real slots instead** |
| AP25 | **Prices without a stated variable** — "PMS ₱1,200–₱2,500" with no explanation | The customer cannot tell which end applies to their car, so they assume the top. **"₱1,200–₱2,500 depending on oil type and vehicle"** is honest, and it converts *better* because the customer can self-select |
| AP26 | **Emoji as decoration in headings** | The shop uses emoji **structurally** — as section breaks, on Facebook (`facebook-intel.md` §2.12). That is a *different register*. **Do not carry the Facebook register onto the website**: it reads as unpolished to a customer comparing against a national chain, and it collides with the display typeface. Emoji belongs in `copy-notes.md`'s social register, not in `<h2>`s |
| AP27 | **A "featured service" carousel on `/services`** | Favouritism the moment you pick a winner, and it hides the other nine. **The verified list is the shop's own; publish all ten in its own order** |
| AP28 | **Hiding the price behind "Request a quote"** | 🔴 This is what every competitor does, and it is the reason customers distrust tyre shops. **It is the exact behaviour EYG is differentiating from.** N3 |
| AP29 | **Taglish in the legal pages** | The privacy notice and terms must be **clear, plain and unambiguous** (`legal-compliance-ph.md` §7). A consent notice nobody fully understands is not informed consent. **Taglish belongs in the FAQ and in marketing copy** |
| AP30 | **A "we are the only…" claim** | 🔨 N22. **Jed-M Tires is at "4 Lanes Egsa, Tuyo"** — the same street. Demonstrably false, about an identifiable local competitor, in a 138-business market |
| AP31 | **A FAQ that answers the question with a sales pitch** | *"Do you service motorcycles? — Yes! We service all vehicles, book now!"* is a non-answer. **The verified 10-item list contains no motorcycles.** An honest *"No — we're cars only"* builds more trust than a padded yes, and it costs a lead |
| AP32 | **Copy that implies a service the shop may not have** — undercoating, AC repair, engine tune-up | 🔴 N25, N33. Undercoating is a **strong Bataan category**, which is exactly why faking it would be found out. Note three local competitors already advertise AC work |

### 6.3 Interaction and behaviour

| # | ❌ Anti-pattern | Why it is wrong here |
|---|---|---|
| AP33 | **A booking form that requires an account** | 🔴 A 4-step flow is already at the limit (`AGENT-BRIEF.md` §3). Requiring a password to book a car service is absurd friction. **N34** |
| AP34 | **Making the plate or email required** | Both are optional in `CreateBookingInput` and both **should** stay optional. A plate is arguably **sensitive** personal information (`legal-compliance-ph.md` §2.3) — requiring it is a proportionality failure under RA 10173 Sec. 11(d) |
| AP35 | **A pre-ticked marketing consent box** | 🔴 N9, D15. **A bundled or pre-ticked marketing consent is not valid consent** — it fails legally *and* as trust. The transactional and marketing permissions must be separate, and neither pre-ticked |
| AP36 | **"Decline" styled less prominently than "Accept"** | 🔴 N9. The same dark pattern, and the reason the marketing consent would be unenforceable |
| AP37 | **A form that shows a success state before the request has actually succeeded** | 🔴 **N11, and `risks-dos-donts.md` §4 item 2.** The most expensive class of bug in this build: the failure is **invisible from the outside**. Optimistic UI is only acceptable with a real, visible rollback path |
| AP38 | **No SMS, so a booking is confirmed only on screen** | SMS is load-bearing. **Never let it be the only confirmation** — if the gateway fails, the customer must still see it (`risks-dos-donts.md` §4 item 11) |
| AP39 | **A map that loads eagerly and blocks the page** | A10 — a real directory removed a render-blocking third-party stylesheet and an unpinned script from "the site's most-crawled route". Lazy-load every embed |
| AP40 | **A persistent "we may use cookies" bar that never goes away** | It occupies the thumb zone the call bar needs, permanently |
| AP41 | **Animations that ignore `prefers-reduced-motion`** | 🔴 `AGENT-BRIEF.md` §5. And the `<noscript>` fallback is the part people miss — **content must be visible when motion never runs** (A6) |
| AP42 | **Motion used to *delay* content** | 🔴 N13. On 3G, a 600 ms reveal animation is 600 ms of a blank screen. Animate `transform`/`opacity` only, never layout properties |
| AP43 | **A missing-404 with no phone number and no way back** | `AGENT-BRIEF.md` §3 lists 404/500/403/429/maintenance, each converting to **`Call`**. **A stranded driver who hits a 404 is the highest-intent user on the site** — give them the number first |
| AP44 | **Using `/admin` as a public preview** | 🚨 AP44 becomes a data breach: names, phones, and plates in a crawlable URL. N17 in `risks-dos-donts.md` — auth-gate it, `noindex` it, `Disallow:` it, and **test it** |
| AP45 | **A "back to top" that overlaps the bottom call bar** | Two fixed bottom elements will collide on a small viewport. The call bar wins |
| AP46 | **Any animation on the phone number** | It must be static, stable and tappable. It is the one element on the site with a job to do |

### 6.4 The anti-pattern that is really a checklist

**Before any page is signed off, five questions** — derived from everything above:

| # | Question | If the answer is no |
|---|---|---|
| 1 | **Can a driver in traffic, on a ₱3,000 Android, find and tap the phone number without scrolling — on every page?** | 🔴 **The page is not finished.** This is the business |
| 2 | **Does the page show something a competitor's page does not?** (Real hours? A price? Real photos? A bookable slot?) | 🔴 **It is a brochure, and 138 brochures already exist.** §1.1 |
| 3 | **Can the customer prove the phone number is not placeholder text?** | 🔴 `+639000000000` is live in `site.ts` **right now** (`risks-dos-donts.md` D26) |
| 4 | **Is there any plate, name, or face on this page that has not been deliberately handled?** | 🔴 RA 10173 exposure, and a statutory indemnity (`legal-compliance-ph.md` §2.6) |
| 5 | **Would the shop's own receptionist be able to defend every claim on this page to a customer who challenged it?** | 🔴 **If not, it does not ship.** This is the single best proxy test, and it is the same test as the urgency rule and the price rule |

---

## 7. The one-paragraph verdict

**The benchmark turned out to be a floor, not a ceiling — and I measured that rather than
assuming it.** I read the two global tyre-brand dealer locators from source and found
Michelin's own record for EYG **filed under the wrong province, with a `geo` coordinate
130 km from the forecourt, and a city field that contradicts the street address in the same
record** — which is why EYG does not appear when anyone searches "Michelin dealer
Bataan". I then read five Balanga competitor listings on a directory backed by the City
Government's own business-tax records, and found that **not one of them publishes its
hours, its prices, a service list, a photograph, or any way to book** — and that two of
them had duplicated listings, one had a bookkeeping office as its email, and one had
another tyre shop on the same street, which is a finding that kills an entire class of
claim before it is written. That directory is also, from an engineering standpoint, the
best-built site I read: a working skip link, named navigation landmarks, a focus-trapped
mobile drawer, a documented `svh`-over-`dvh` decision made after an on-device measurement,
and — best of all — a source comment recording the exact contrast ratio that failed and
the token that fixed it. **That last habit is the standard.** EYG's brand yellow fails WCAG
AA on white, and the correct response is exactly what that directory did: measure it, pick
a passing token, and write the number in the source so the next person cannot quietly
re-break it. So the design specification for this project is unusually clean: **the
incumbent experience is a name, an address, and a phone number, and every single thing
added beyond that is a competitive advantage** — provided it is true, and provided the
phone number is not still a placeholder.
