# GEO & LOCAL SEO — EYG Tire & Auto Care

> **Owner:** marketing agent · **Goal:** win `auto care near me` in
> **Bataan / Balanga City**, and become the shop the Fourlanes corridor thinks of
> before it thinks of the chains.
> **The one-line strategy:** a local searcher is asking a *trust* question, not
> a *ranking* question. Optimise the profile so the answer to "are these people
> real, near me, and will they overcharge me?" is yes, yes, and visibly no.

---

## 1. Why this market is winnable

A car searcher in Balanga types something like `tire shop near me` at 7:40 PM on
a Tuesday. Three things follow:

1. **They are on a phone, in traffic, and in a hurry.** They will not read.
   They will look at photos, read the review count and the hours, and tap call.
2. **They are choosing between a place they know and a place they do not.**
   Local Pack wins this, and Local Pack is won by *profile completeness +
   reviews + recency*, not by website content.
3. **They will not read far.** The first 40 characters of a listing and the
   first three photos decide it.

The consequence: **this is a profile project, not a website project.** The
website exists to catch people who tap through. It is not where the ranking
comes from.

### The competitive shape

| Competitor type | Their advantage | Where we beat them |
| --- | --- | --- |
| Dealer / chain | Brand trust, stock depth, price ads | No sales pressure, no "come in for a quote" |
| Independent shop (nearby) | Same | Proximity, speed, being *known* |
| roadside-only operator | Availability | Does the actual work at the shop |
| "Any shop" (unbranded) | Nothing — this is the segment we own | Everything |

The unbranded segment is the whole strategy. Most tyre buyers in Balanga do not
care whose brand is on the sidewall; they care that the person doing the work
tells them the truth and quotes a fair number.

---

## 2. Google Business Profile — the optimisation stack

Work top to bottom. Each layer compounds on the one below it.

### 2.1 Categories

**Primary (choose exactly one):**
> `Tire shop`

This is the highest-relevance category for the core query. Do not dilute it.

**Secondary (add up to 9, in this order):**

1. `Auto repair shop`
2. `Car detailing service` *(only if the shop genuinely does detailing)*
3. `Wheel alignment service` ⚠️ confirm this category exists in GBP for PH
4. `Brake repair shop` ⚠️ confirm availability
5. `Oil change station`
6. `Tire shop` *(already primary — do not duplicate)*
7. `Auto electrical service` ⚠️ only if genuinely offered
8. `Roadside assistance service` ⚠️ confirm
9. `Vehicle inspection service`

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION.** Google changes the category list
per market, and some of the above may not exist in the Philippine category
list. Add only what is real — a false category earns impressions the shop cannot
convert, and it is a violation if it misleads.

**Attributes to switch on** (Settings → Business information):

- Wheelchair accessible entrance — if true
- Parking available (free, on-site) — if true
- Payments accepted: Cash, GCash, Maya, Credit card, Debit card
- Service options: In-store service ✅, Same-day service ✅
- Wheelchair-accessible parking — if true

**Do not claim:** "Women-owned", "LGBTQ-friendly", "Veteran-owned" etc. — none
apply and they are disqualifiable in some locales.

### 2.2 Business name

Use exactly:

```
EYG Tire & Auto Care
```

**Do not add keywords, locations, or "Best Tire Shop Balanga".** Keyword-stuffed
business names get the profile suspended and the ranking penalised. Google
already knows the location from the address.

### 2.3 NAP — Name, Address, Phone

This is the single highest-leverage local signal. **It must be byte-identical
everywhere.** Pull the canonical values from `src/config/site.ts`:

| Field | Canonical value |
| --- | --- |
| Name | EYG Tire & Auto Care |
| Street | EGSA Fourlanes, Tuyo |
| City | Balanga City |
| Province | Bataan |
| Postcode | 2100 |
| Country | Philippines |
| Phone | ⚠️ `TODO-VERIFY` in `site.ts` — get the real number from the owner |

⚠️ **The phone number is still a placeholder (`+639000000000`).** Do not submit
the profile, and do not print any QR code or GBP link, until the real number is
in `site.ts` and confirmed on the profile. A profile with a dead number is worse
than no profile.

Formatting rules:
- No "Philippines +63" prefixes in the address field
- No emojis
- No website-with-keyword suffixes
- Phone in international format or local format — **pick one and never change it**

### 2.4 Services (20 entries)

⚠️ **PRICES OMITTED DELIBERATELY.** GBP shows services with prices in the
search results panel. Publishing a wrong price there produces a customer who
arrives expecting to pay that figure, which is precisely the trust failure this
whole strategy exists to avoid. Prices get added **after** the owner confirms
them — and only as a range with a note.

Enter all 20 without prices first. Then, once the owner confirms a number, add
the confirmed ones with the note *"From ₱X. Final price after inspection."*

| # | Service name (as typed into GBP) | Notes |
| --- | --- | --- |
| 1 | Tire change | |
| 2 | Tire repair and vulcanizing | |
| 3 | Tire rotation | |
| 4 | Wheel balancing | |
| 5 | Wheel alignment | |
| 6 | Tire pressure check | |
| 7 | New tire sales | |
| 8 | Brake pad replacement | |
| 9 | Brake disc inspection | |
| 10 | Brake fluid replacement | |
| 11 | Change oil | |
| 12 | Oil filter replacement | |
| 13 | Preventive maintenance service | |
| 14 | Car aircon repair | |
| 15 | Car aircon regas | |
| 16 | Undercoating | |
| 17 | Shock absorber replacement | |
| 18 | CVL and bushing replacement | |
| 19 | Roadside assistance | ⚠️ confirm before adding |
| 20 | Vehicle check-up | |

Each entry gets a 200–300 character description. The descriptions are written
in `docs/marketing/GBP-LISTING.md` §3 — copy them from there, do not improvise.

### 2.5 Products (10 entries)

GBP "Products" is meant for actual sellable items. For a service shop, use it
for the things a customer genuinely buys at the counter.

⚠️ **Do not add branded products unless the shop is actually authorised to sell
them.** `BUSINESS.tireBrands` in `site.ts` lists six brands and is marked
`TODO-VERIFY`. A brand in a GBP product listing implies a supply relationship.
If the shop is not an authorised dealer, list the *product category* ("Tyre —
185/65 R15"), never the brand.

| # | Product name | Price shown | Description |
| --- | --- | --- | --- |
| 1 | Tire — 185/65 R15 | Add later | Passenger car tyre, common local hatchback size. Message for current stock and price. |
| 2 | Tire — 195/65 R15 | Add later | Popular sedan size. |
| 3 | Tire — 205/55 R16 | Add later | Common midsize sedan and SUV size. |
| 4 | Wiper blades — pair | Add later | Front pair. Several brands available. |
| 5 | Engine oil — by the litre | Add later | Tell us your make, model and year and we will tell you the grade. |
| 6 | Oil filter | Add later | Fitted free with any oil change. |
| 7 | Brake pads — front axle | Add later | Quoted per vehicle. We will measure before replacing. |
| 8 | Valve stems | Add later | Replaced as standard in a tyre changeover. |
| 9 | Engine coolant | Add later | Checked and topped up with every PMS. |
| 10 | Cabin air filter | Add later | Usually inexpensive. Often overdue on older cars. |

### 2.6 Photo plan

Photos are the highest-converting element of a local profile, and they are the
cheapest thing on this list. A competitor with three blurry photos loses to a
profile with fifteen clear ones every single time.

**Shot list — 12 photos for the launch, then one a week forever.**

| # | Shot | Why it works |
| --- | --- | --- |
| 1 | Frontage from the EGSA road, sign legible | Answers "is this the actual shop" |
| 2 | The bay, wide, lights on | Answers "is this a real workshop" |
| 3 | The counter / waiting area | Answers "will I be comfortable waiting" |
| 4 | A tyre rack, straight on | Answers "do you have stock" |
| 5 | A technician working, hands visible | Answers "do real people work here" |
| 6 | The team, faces visible ⚠️ consent required | Answers "are these people I can trust" |
| 7 | A brake pad measured with a caliper | Answers "do you measure or guess" |
| 8 | A torque wrench | Answers "is the work done properly" |
| 9 | The inspection sheet on the bench | Answers "will I understand the bill" |
| 10 | An alignment machine | Answers "do you have the equipment" |
| 11 | Night shot, lights on | Answers "are you actually open when you say you are" |
| 12 | The map pin view / the landmark from the street | Answers "will I find you" |

**Technical requirements**
- Format: JPG or PNG. Not HEIC (Google does not process it reliably).
- Under 10 MB each.
- Name files descriptively: `eyg-bay-01.jpg`, not `IMG_4471.jpg`.
- **No stock photography. Ever.** A tyre shop photo with a visible brand logo
  that is not ours, or a photo of a bay that is not our bay, is misleading and
  will be reported.
- Blur every plate, every face you lack consent for, every customer name.

**Cadence:** minimum **one new photo a week**. Businesses that stop uploading
lose ranking velocity. If a real job happened that week, that is your photo.
Set a repeating reminder in the owner's calendar for Monday morning.

### 2.7 Q&A — seed all 20

Owners can post their own Q&A, and pre-seeding prevents the first three
questions being "do you guys do X?" answered by a competitor or a troll.
**All 20 seeded Q&As with their answers are in `docs/marketing/GBP-LISTING.md`
§4 — post them verbatim, in the first 14 days.**

The rule for answering: answer every question, including the hostile ones, in
the same tone. Never argue, never delete a legitimate complaint, never respond
within an hour of a bad review (that is what makes it worse).

### 2.8 GBP posts (the "What's New" cadence)

Minimum **one post per week**. Maximum useful: two.

The four GBP post types, and which one this shop should use most:

| Type | Use it for | This shop's share |
| --- | --- | --- |
| **Offer** | A live promotion with terms | 25% |
| **Update** | Seasonal tip, weather, new stock | 40% |
| **Event** | Shop hours changes, closures | 10% — rare |
| **Product** | Nothing — we do not sell retail products to walk-ins | 0% |

Weekly rotation (a 4-week loop, one update per week):

| Week | Post type | Topic |
| --- | --- | --- |
| 1 | Update | The tyre-pressure tip from `social.ts` (day 3 post) |
| 2 | Offer | The live campaign, whatever it is |
| 3 | Update | The warning-lights post from `social.ts` (day 27 post) |
| 4 | Offer | The live campaign, or the seasonal bundle |

⚠️ Offers posted to GBP must match the website exactly. The **Never run two
discounts at once** rule in `PROMO-PLAYBOOK.md` §7 applies to GBP posts too.

### 2.9 Review velocity

**Reviews are the ranking lever. Volume, recency and sentiment — in that order
of importance.**

#### Targets

| Month | New reviews | Cumulative target |
| --- | --- | --- |
| Month 1 | 6 | 6 |
| Month 2 | 6 | 12 |
| Month 3 | 8 | 20 |
| Month 4–6 | 8/month | 44 |
| Month 7–12 | 10/month | 104 |

**Velocity target: at least 2 reviews per week, every week, without exception.**
A profile gaining 3 a week beats a profile with 50 that gained 3 last March,
every time.

#### The request protocol

Ask **every single customer at handover** — including the unhappy ones. This is
not negotiable and not optional. Selective review requests are a Google policy
violation and, more practically, a shop that only asks the happy ones does not
get the informative reviews that make a profile convincing.

**Never** in exchange for anything — not a discount, not a free wipe, not a
priority booking.

| Channel | Script | Frequency |
| --- | --- | --- |
| Verbal, at handover, invoice in hand | The Taglish script in `reviews.ts` → `REVIEW_REQUEST_HANDOVER.spokenScript` | Every job |
| Paper card in the handover folder | `reviews.ts` → `cardFront` / `cardBack` | Every job |
| SMS, ~2 hours after completion | `copy.ts` → `REVIEW_REQUEST` | Every job |
| Facebook message | Only if they asked to be messaged | Opt-in only |

SMS template (`assertSmsFits` verified at 129 characters):
```
EYG Tire: thanks for coming in today. A Google review helps us more than
anything: {{url}} Reply STOP to opt out.
```

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION:** the short review URL. Create a
Google review link from the profile dashboard. It must not be the general
`g.page` search link — a direct review-request link converts roughly 3× better.

#### Reply policy

Reply to **every** review within 48 hours.

| Review type | Response |
| --- | --- |
| 5★ positive | Thank them by name, mention something specific they said, invite them back |
| 3–4★ mixed | Thank them for the honesty. Address the specific issue. Say what changed. |
| 1–2★ negative | Apologise once, without excuses. Move to phone or in person. State the fix. Never argue. |
| Spam / fake | Flag for removal, do not reply publicly |

Never reply to a 1–2★ review within the first hour. Overnight, measured
responses are read as calm; same-hour reads as panic.

#### The rating number in `site.ts`

`BUSINESS.trust.ratingValue` is `4.9` and `ratingCount` is `0` in `site.ts`.
**4.9 with a count of zero is a fabricated rating and must not be published
anywhere.** It is marked `TODO-VERIFY`. Compute the aggregate from the real
Google reviews only, and only once there are at least 5.

---

## 3. The 20 local-citation sites

Register on all of these. Full NAP, consistent, no duplicates.

⚠️ **All URLs below are submission entry points and should be verified at signup
— several of these rebrand or redirect. Where a site no longer accepts free
listings, it is noted. Treat this as a work list, not a guarantee.**

### Tier 1 — the ones that actually move local ranking

| # | Site | URL | Notes |
| --- | --- | --- | --- |
| 1 | **Google Business Profile** | `https://business.google.com` | Already covered in §2. The single highest-leverage listing. |
| 2 | **Facebook Page** | `https://www.facebook.com/business` | ⚠️ TODO-VERIFY — confirm "Page info → Category → Auto repair shop" and full NAP on the About section |
| 3 | **Apple Business Connect** | `https://businessconnect.apple.com` | Appears in Apple Maps, which iPhone users are pointed at. Free. |
| 4 | **Bing Places** | `https://www.bingplaces.com` | Imports from Google Business. Do it — takes two minutes. |
| 5 | **Google Maps (via GBP)** | `https://maps.google.com` | Not a separate listing. Review the pin's position weekly. |

### Tier 2 — Philippine / local directories

| # | Site | URL | Notes |
| --- | --- | --- | --- |
| 6 | **Yellow Pages Philippines (FHL)** | `https://www.yellow-pages.ph` | Powered by Fluent Search. Local search engine partner. |
| 7 | **Philippine Yellow Pages (alternative)** | `https://www.philippineyellowpages.com` | Verify still accepting submissions. |
| 8 | **DTI / MSME registry listing** | `https://business.gov.ph` | ⚠️ Register the business officially — useful for credibility, some directory aggregators read it. |
| 9 | **Lalamove / Grab directory-adjacent** | *n/a* | ⚠️ Not a free listing. Consider a **Grab Merchant** enrolment (`https://business.grab.com/ph`) — high local visibility. |
| 10 | **Bataan provincial directory** | `https://www.bataanchakwe.com` ⚠️ verify live | Provincial directory — very low volume, but very local relevance. |
| 11 | **Balanga City directory** | `https://www.balangacity.gov.ph` ⚠️ verify | City government business directory. |
| 12 | **Foursquare** | `https://foursquare.com` | Powers many "nearby" aggregators. |
| 13 | **Apple Maps** | `https://maps.apple.com` | Via Business Connect. Free listing. |
| 14 | **Here WeGo** | `https://www.here.com` | Feeds vehicle and mapping systems. |

### Tier 3 — aggregators and directories

| # | Site | URL | Notes |
| --- | --- | --- | --- |
| 15 | **Yello** | `https://www.yello.com` | Free basic listing. |
| 16 | **Chamber of Commerce** | `https://www.bizapedia.com` ⚠️ verify PH support | Business registry aggregator. |
| 17 | **Cybo / Philippine business listings** | `https://www.cybo.com` | Free PH listing, real traffic in provincial areas. |
| 18 | **Wikimapia** | `https://wikimapia.org` | Low priority, but free and geographically relevant. |
| 19 | **OpenStreetMap** | `https://www.openstreetmap.org` | Free, permanent, feeds many map systems. Add the shop as `shop=tyres`. |
| 20 | **Waze for Business** | `https://www.waze.com/business` | ⚠️ No longer self-serve for new advertisers. Worth a support enquiry — Waze is heavily used for driving in PH. |

### Submission order & rule

**Week 1:** Google Business Profile (§2 in full) — everything else can wait.
**Week 2:** Facebook About/category, Apple Business Connect, Bing Places.
**Week 3:** Tier 2, items 6–14.
**Week 4:** Tier 3, items 15–20.

> **THE ONE RULE:** identical NAP everywhere. Copy-paste from
> `src/config/site.ts` every time. Do not retype. Do not "improve" the address.
> A typo in the city name on one directory is a measurable ranking cost and it
> is invisible to you.

### Ongoing citation hygiene

- Re-check the pin position on Google Maps **weekly** (drag if it moved).
- Watch for **duplicate listings** — the most common local-SEO disease. Search
  the shop name in quotes on Google and on Facebook; claim or delete duplicates.
- Never create a listing for the same shop twice "to be safe". It splits the
  ranking.

---

## 4. `eygtireautocare.ph` — technical local SEO checklist

⚠️ **Domain status is unconfirmed.** `SITE.url` defaults to
`https://eygtireautocare.ph`. Confirm the domain is actually registered and
controlled before relying on any of this.

### 4.1 Non-negotiable technical items

| # | Item | Status |
| --- | --- | --- |
| 1 | HTTPS with valid SSL, HTTP → 301 redirect | Required |
| 2 | Canonical `<link>` on every page, self-referencing | Required |
| 3 | `<meta name="viewport">` on every page | Required |
| 4 | `hreflang` not needed (single locale) — but `<html lang="en-PH">` is | Required |
| 5 | `LocalBusiness` / `AutoRepair` JSON-LD on every page | Implemented in `@/lib/seo` → `localBusinessJsonLd()` — **verify it renders** |
| 6 | `FAQPage` JSON-LD on pages that render FAQs | Implemented → `faqJsonLd()` — **verify it renders** |
| 7 | `BreadcrumbList` JSON-LD on `/services`, `/deals`, `/book`, `/contact` | Implemented → `breadcrumbJsonLd()` |
| 8 | `robots.txt` — allow all, reference the sitemap | Owned by frontend-core |
| 9 | `sitemap.xml` auto-generated with `lastModified` | Owned by frontend-core |
| 10 | **Static or SSR (never CSR-only)** for all public content | Required — Google does not reliably index client-rendered local pages |
| 11 | Core Web Vitals: LCP < 2.5 s, CLS < 0.1, INP < 200 ms | Required — target a ₱3,000 Android on 3G |
| 12 | Every image has `alt` and explicit `width`/`height` | Required |

### 4.2 Mobile performance (this market is 100% mobile)

- Total page weight under **1 MB** on first load.
- No render-blocking third-party scripts.
- **No chat widget that blocks the page.** Messenger, if used, must be
  click-to-load. A third-party chat bubble that shifts layout on a slow phone
  costs more conversions than it creates.
- Tap targets ≥ 44 × 44 px.
- The phone number must be thumb-reachable on every viewport — this is a
  conversion requirement and a local-SEO signal (click-to-call tracking).

### 4.3 On-page local signals

| Page | Required local content |
| --- | --- |
| `/` | Full NAP in the footer. "EGSA Fourlanes, Tuyo, Balanga City, Bataan" in the copy, not just in schema. |
| `/services` | Each service has its own local line ("PMS in Balanga"). |
| `/contact` | Embedded map, directions link, NAP in plain text (not an image). Landmark description. |
| `/deals` | Every promo carries a real end date and full terms. |
| `/about` | Real people, real photos, real address. This page ranks for branded + trust queries. |
| `/gallery` | Real job photos with descriptive alt text. E.g. `alt="Front brake pad thickness measured with a caliper at EYG Tire and Auto Care in Tuyo, Bataan"`. |

**Target keyword clusters** (do not stuff — use naturally, one primary per page):

| Cluster | Target page |
| --- | --- |
| tire shop Balanga, tire change Bataan, tire vulcanizing Balanga | `/` `/services` |
| PMS Balanga, change oil Balanga, preventive maintenance Bataan | `/services` |
| wheel alignment Balanga, tire balancing Tuyo | `/services` |
| roadside assistance Balanga, tire change Tuyo, emergency tire Bataan | `/` |
| cheap tire shop Balanga *(yes, chase this — it is a real query)* | `/deals` — answer honestly with the price transparency angle |
| EYG Tire and Auto Care | `/about` |

### 4.4 The schema to ship

Already implemented in `src/lib/seo.ts`. **Verify it renders on every public
page** — JSON-LD that exists in a file but not in the HTML does nothing.

```json
{
  "@context": "https://schema.org",
  "@type": "AutoRepair",
  "@id": "https://eygtireautocare.ph/#business",
  "name": "EYG Tire & Auto Care",
  "url": "https://eygtireautocare.ph",
  "telephone": "<TODO-VERIFY: real number>",
  "email": "hello@eygtireautocare.ph",
  "image": "https://eygtireautocare.ph/og/default.png",
  "logo": "https://eygtireautocare.ph/brand/logo-primary.svg",
  "priceRange": "₱₱",
  "currenciesAccepted": "PHP",
  "paymentAccepted": "Cash, GCash, Maya, Credit Card, Debit Card, Credit Installment",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "EGSA Fourlanes, Tuyo",
    "addressLocality": "Balanga City",
    "addressRegion": "Bataan",
    "postalCode": "2100",
    "addressCountry": "PH"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "<TODO-VERIFY>",
    "longitude": "<TODO-VERIFY>"
  },
  "areaServed": [
    { "@type": "City", "name": "Balanga City" },
    { "@type": "AdministrativeArea", "name": "Bataan" }
  ],
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    "opens": "08:00",
    "closes": "17:00"
  }],
  "sameAs": ["https://www.facebook.com/people/EYG-Tire-Auto-Care/61582418828014/"]
}
```

**Also ship `AutoService` schema on `/services` with one entry per service** —
Google reads it and it can earn service-name rich results:

```json
{
  "@context": "https://schema.org",
  "@type": "AutoService",
  "provider": { "@id": "https://eygtireautocare.ph/#business" },
  "areaServed": { "@type": "City", "name": "Balanga City" },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Auto services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": "Tire rotation" },
        "priceCurrency": "PHP",
        "price": "<TODO-VERIFY>"
      }
    ]
  }
}
```

⚠️ **Do not put prices in schema until the owner confirms them.** A wrong
price in structured data is a direct consumer-law exposure.

---

## 5. The review engine, end to end

### 5.1 Flywheel

```
Job completed
  → ask at handover, verbally + paper card     (60 seconds, every job)
  → SMS 2 hours later                           (automated, REVIEW_REQUEST)
  → customer posts a Google review
  → owner replies within 48 hours
  → the review lifts the profile
  → the profile wins "near me"
  → the next person from that search finds the shop
  → next job
```

### 5.2 Monthly review ops (30 minutes, first Monday)

- [ ] Reply to every unanswered review
- [ ] Check the pin position; drag if it drifted
- [ ] Check the top 5 search terms in GBP performance (once available)
- [ ] Log this month's reviews in the owner-confirmation register
- [ ] Photograph one real job for the profile

### 5.3 Handling the "we have no reviews yet" problem

**Do not** seed reviews. **Do not** buy them. **Do not** encourage customers to
review only when happy.

The legitimate route to the first ten reviews:

1. The shop opened in 2025 with real customers. **Ask them.** Go back through
   the counter book, the receipts, the SMS thread. "Kumusta, nakita ko pong may
   appointment kayo dati. Kung okay sa inyo, tulong sa isang review." Most people
   are flattered.
2. Ask every walk-in for two weeks straight.
3. Ask every *repeat* customer first — they are the least likely to be angry and
   the most likely to say yes.

⚠️ **SUGGESTED — REQUIRES OWNER ACTION:** the owner needs to identify 15 past
customers by name and phone from before the website existed. This is the single
highest-return hour of work in this entire document.

---

## 6. Metrics — what to check, and when

| Metric | Where | Check | Target |
| --- | --- | --- | --- |
| GBP actions (calls, website, directions) | GBP Insights | Weekly | +15% month over month |
| Discovery searches | GBP Insights | Weekly | "tire shop balanga" in top 5 |
| Review count | GBP dashboard | Weekly | +2/week |
| Average rating | GBP dashboard | Weekly | ≥ 4.5 |
| "Near me" rank | Manual search, incognito | Monthly | Top 3 in Balanga |
| Website calls | Call tracking (dynamic number) | Weekly | Tracked |
| Organic sessions | Search Console | Monthly | +20% QoQ |
| Citations live | Your own tracker sheet | Monthly | 20/20 |

⚠️ **SUGGESTED — REQUIRES OWNER DECISION:** whether to install call tracking.
Dynamic number insertion works well but reports numbers that are not real. For a
shop this size, a simple "how did you hear about us?" on the booking form is
more honest and nearly as useful.

---

## 7. First 30 days, in order

| Week | Do this |
| --- | --- |
| **1** | Confirm the phone number, hours, coordinates with the owner. Claim/verify Google Business Profile. Enter name, NAP, hours, categories, attributes, payments. Enable the short review URL. |
| **2** | Shoot all 12 photos. Enter 20 services (no prices). Post the first 10 seeded Q&As. Post the first GBP "Update". |
| **3** | Post the last 10 Q&As. Add Apple Business Connect, Bing Places, Facebook About/category. Contact 15 past customers for reviews. |
| **4** | Tier 2 + Tier 3 citations (10 more sites). Post the second GBP post. Aim for 6+ reviews. Run the first GBP post + first Facebook campaign post. |

---

**Related:** `GBP-LISTING.md` (all 20 services, 10 products, 20 Q&As written
out) · `META-ADS.md` (paid, Geo-targeting) · `CONTENT-CALENDAR.md` ·
`PROMO-PLAYBOOK.md` · `CAMPAIGN-ROADMAP.md`.