# Facebook & OSINT Intel — EYG Tire & Auto Care

**Owner:** research agent · **Compiled:** 2026-10-02 · **All checks performed 2026-10-02 (Asia/Manila)**

> This is the factual foundation for every other agent. Read §2 before writing a single
> claim. Anything not marked **CONFIRMED** must not ship as fact.

---

## 1. Technique log — what worked, what was blocked

Facebook does not serve logged-out page bodies to plain HTTP clients. These are the exact
results. **Do not re-try the failures.**

| # | Technique | Result | Verdict |
|---|---|---|---|
| 1 | `mbasic.facebook.com/people/EYG-Tire-Auto-Care/61582418828014` | HTTP 200 but served a *"Facebook is not available on this browser"* interstitial with `og:title="Log in or sign up to view"`. Zero page data. | ❌ **BLOCKED** |
| 2 | `m.facebook.com/people/EYG-Tire-Auto-Care/61582418828014` | Byte-identical failure to #1. | ❌ **BLOCKED** |
| 3 | `facebook.com/p/EYG-Tire-Auto-Care-61582418828014` | ✅ **Partial success.** Returns the Comet client shell (~990 KB) **plus** server-rendered `<meta>`: `og:title`, `og:description`, `og:image`, `og:url`, `canonical`, `description`. Page body (About tabs, posts, photos) is client-fetched and absent. | ⚠️ **META ONLY** |
| 4 | `facebook.com/p/EYG-Tire-Auto-Care-61582418828014/about_contact_and_basic_info` | ❌ Login wall. No About fields. | ❌ **BLOCKED** |
| 5 | `facebook.com/plugins/page.php?href=…&tabs=about` | ⚠️ Returns page **name + follower count only** (`308 followers`). No About, hours, phone, or category. | ⚠️ **PARTIAL** |
| 6 | **`facebook.com/{pageId}/posts/{postId}/`** | ✅ **WORKS.** Returns full `og:description` (≈250 chars), `description`, and — importantly — a `<meta name="keywords">` tag listing the page's own service taxonomy. | ✅ **WORKS** |
| 7 | **`facebook.com/plugins/post.php?href={encoded post URL}&show_text=true&width=500`** | ✅✅ **BEST METHOD.** Returns the *complete, untruncated* post body server-side, plus embedded `schema.org/SocialMediaPosting` JSON-LD containing `dateCreated` (exact timestamp), `foundingDate` (page creation date), follower count, like/comment/share counts, and every image URL at `p960x960`. | ✅✅ **WORKS — USE THIS** |
| 8 | DuckDuckGo HTML endpoint (`html.duckduckgo.com/html/?q=…`) | ✅ Worked for ~4 queries, then hard-blocked with an `anomaly.js` image-CAPTCHA (`cc=botnet`). Retry from PowerShell = instant block. | ⚠️ **RATE-LIMITED** |
| 9 | `lite.duckduckgo.com/lite/?q=…` | ❌ Same CAPTCHA. | ❌ **BLOCKED** |
| 10 | `mojeek.com/search?q=…` | ❌ JS challenge. | ❌ **BLOCKED** |
| 11 | `bing.com/search?q=…` | ⚠️ HTTP 200 and full SERP in HTML, but the fetch is ~500 KB of script; result extraction is impractical and Bing's cached Facebook snippets are **stale** (see §4). | ⚠️ **LOW VALUE** |
| 12 | Built-in `websearch` tool | ❌ Returned "No search results found" for every EYG query across 4 attempts. | ❌ **UNUSABLE** |
| 13 | `balanga.com.ph` listing (City of Balanga + Yoonet official directory) | ✅✅ **Full NAP + email in `schema.org/AutomotiveBusiness` JSON-LD.** Sourced from official City of Balanga business tax records. | ✅✅ **WORKS** |
| 14 | `michelin.com.ph` / `bfgoodrich.com.ph` dealer locator detail page | ✅✅ Returns `schema.org/AutomotiveBusiness` JSON-LD with the registered dealer address **and `geo` lat/lng**, plus the dealer-type classification ("4W tire dealer"). | ✅✅ **WORKS** |

**The reusable recipe for any Facebook post:**

```
https://www.facebook.com/plugins/post.php?href=<URL-ENCODED https://www.facebook.com/{PAGE_ID}/posts/{POST_ID}/>&show_text=true&width=500
```

Then strip tags. Post text lives in `div[data-testid="post_message"]`, and the dates /
follower counts live in the inline `application/ld+json` blocks.

---

## 2. The confirmed record

### 2.1 Identity — there are TWO Facebook pages, not one

This is the single most important finding. **Do not conflate them.**

| | Page A | Page B |
|---|---|---|
| **Display name** | **EYG Tire & Auto Care** | **EYG TIRE Trading** |
| **Page ID** | `61582418828014` | `100065426441998` |
| **Delegate/vanity ID** | `862178490306310` | — |
| **Public URL** | `facebook.com/people/EYG-Tire-Auto-Care/61582418828014` | `facebook.com/people/EYG-TIRE-Trading/100065426441998` |
| **Short URL** | `facebook.com/p/EYG-Tire-Auto-Care-61582418828014` | `facebook.com/p/EYG-TIRE-Trading-100065426441998` |
| **Page created** | **2025-10-19** 20:44 (from FB's own JSON-LD `foundingDate`) | **2021-03-18** 17:26 (from FB's own JSON-LD `foundingDate`) |
| **Audience** | **308 followers** (confirmed 2026-10-02 via both `og:description` and the page plugin) | **575–576 followers** ("1 was here") |
| **Role** | The **auto-care service centre** — PMS, alignment, brakes, battery, OBD | The **tyre retail/wholesale & battery dealership** — stock, brand distributor claims |
| **Address used in its posts** | **EGSA Fourlanes, Tuyo. Balanga City, Bataan** | **183 Calero St., Ibayo, Balanga City, Bataan** |
| **Page self-description** | *(not exposed — see §5)* | *"Trusted tire dealer (Michelin, Blackhawk, Arivo, MRF etc.) & official Amaron battery distributor."* |

> ⚠️ **CONTRADICTED — the orchestrator brief.** `docs/AGENT-BRIEF.md` §1 states EYG "Opened
> 2025 (announced 'officially open our doors' **March 2025**, Fourlanes / Earthfield Bataan
> Centre)". Facebook's own `foundingDate` for the Auto Care page is **2025-10-19**, and the
> "NOW OPEN" post is dated **2025-12-09**. **March 2025 is not supported by any source I
> could reach.** `src/config/site.ts` currently says `foundedYear: 2024`, which is also
> unsupported. Do not publish a founding year until the owner confirms.
> **UNVERIFIED — needs owner confirmation.**

### 2.2 Business hours — **CONFIRMED**

Verbatim, from the Auto Care page's own post footer (repeated on every recent post):

> "We are open from **Monday to Saturday, 8:00 AM to 5:00 PM.** Visit us in-store or
> message us to inquire"

Independently corroborated on the EYG TIRE TRADING page's stock posts:

> "⏰ Monday to Saturday / 8:00AM to 5:00PM"

**Therefore: Sunday is CLOSED. Mon–Sat 08:00–17:00. Same at both locations.**

✅ This confirms `BUSINESS_HOURS` in `src/config/site.ts` is correct. The orchestrator
should **remove the `TODO` ambiguity and add a source comment** pointing at
`docs/research/facebook-intel.md` §2.2.

### 2.3 Full service list — **CONFIRMED, verbatim**

This is the page's own standard post footer, labelled *"Services:"*. Reproduced exactly,
in the page's own order. **This is the authoritative catalogue for `content/services.md`.**

1. Preventive Maintenance Service
2. Change Oil
3. Brake Cleaning and Maintenance
4. Underchassis Maintenance and Repair
5. Wheel Alignment and Camber Correction
6. Wheel Balancing
7. Tire Mounting and Repair
8. Nitrogen Tire Inflation
9. Battery Replacement
10. OBD Scanning & Resetting

**Also confirmed, from individual job posts (services performed but not in the footer list):**

- **Steering rack assembly replacement** — Toyota Hilux FX, post 2026-07-02
- **Amaron Jade AGM DIN80 battery installation** — Hyundai Staria, post 2026-08-07
- **Engine-oil retail** — PETRONAS engine oil, post 2026-05-02

**Service taxonomy the page tags itself with** (Facebook `keywords` meta, verbatim):

- From the Hilux post: `toyota hilux fx, car maintenance, car repair, car wash, car cleaning, car care, car services, car maintenance service, car repair service, toyota hilux, steering rack assembly, wheel alignment, egsa, tuyo, balanga city, bataan`
- From the PETRONAS post: `petronas engine oil, egsa fourlanes, car maintenance, car repair, petronas, engine oil, car care, mercedes-amg, f1 team, pet`

> ✅ The keyword tags are **Facebook's own SEO metadata for this page**. They are the best
> available signal for how the shop wants to be found. `docs/research/seo-keywords.md` uses
> them.

**NOT on the service list — do not put these on the site as offered services without
owner sign-off:** undercoating as a *product*, AC/aircon repair, shock absorbers, CVL /
bushings, glass, roadside assistance, motorcycle service, engine tune-up. The brief
specifies several of these; they may well be offered, but **the Facebook page does not say
so.** Flag in `content/services.md` as *needs owner confirmation*.

### 2.4 Phone numbers — **two DIFFERENT numbers, two DIFFERENT businesses**

| Number | Where found | Belongs to | Status |
|---|---|---|---|
| **+63 962 717 6894** | Hiring post, both `Urgent Hiring` (2025-06-19) and `Senior Mechanic` (2025-12-26). Post text: *"📍 Location: EGSA Fourlanes, Tuyo, Balanga City, Bataan 📞 Contact: +63 962 717 6894"* | **EYG Tire & Auto Care** (the EGSA service centre) | **CONFIRMED for the service centre** |
| **0998 532 3508** | `balanga.com.ph` (official City of Balanga business-tax-record directory), in `schema.org` `telephone` field | **EYG Tire Trading** (183 Calero St.) | **CONFIRMED for the tyre shop** |

> 🚨 **CRITICAL — `src/config/site.ts` currently ships `phoneE164: "+639000000000"` and
> `whatsappNumber: "639000000000"`. These are placeholders that will silently break every
> `tel:` and `wa.me` link on the site. This is the single highest-priority fix in the whole
> build.** The orchestrator must set these to the owner's confirmed number(s). My
> recommendation, flagged as needing sign-off: **primary = +63 962 717 6894** for the
> EGSA service centre (it is the number the shop itself publishes for the Auto Care
> business), **secondary/tyre stock line = 0998 532 3508.**

### 2.5 Email — **CONFIRMED (one only)**

**`lgguillermo3@gmail.com`**

Source: `https://www.balanga.com.ph/business-directory/automobile-services-and-transportation/eyg-tire-trading`
— `schema.org` `email` field, and rendered as a visible `mailto:` link on that page. The
directory states listings are *"directly sourced from official business tax records"*.

> ⚠️ It is a **free Gmail address**, and it is registered to the **EYG TIRE TRADING** entity,
> not necessarily the Auto Care site. It is the *only* email address I could verify.
> **UNVERIFIED — needs owner confirmation** whether it is the right address for the website,
> and whether a domain email (`@eygtireautocare.ph`) exists.
> 🚨 `src/config/site.ts` invents `hello@eygtireautocare.ph` and
> `service@eygtireautocare.ph`. **Those are fabricated. Remove or replace them.**

### 2.6 Addresses — the discrepancy is real, and it is explainable

| Address | Source | Verdict |
|---|---|---|
| **EGSA Fourlanes, Tuyo, Balanga City, Bataan** | Live `og:description` of the Auto Care page + every recent service post | ✅ **The service centre. Use this on the website.** |
| **183 Calero St., Ibayo, Balanga City, Bataan 2100** | `balanga.com.ph` (City of Balanga tax records), Michelin + BFGoodrich locators, and every tyre-stock post | ✅ **The tyre dealership's registered business address.** |
| Landmark for Calero St. (bonus) | Verbatim in posts: *"Beside Genesis Terminal and in front of Total Gasoline Station"* | ✅ **CONFIRMED** |
| Landmark for EGSA (bonus) | Verbatim in posts: *"EGSA Fourlanes, Tuyo. Balanga City, Bataan"* — the brief's *"Right along the EGSA Fourlanes expressway stretch in Tuyo"* is a fair paraphrase but **not verbatim** | ⚠️ Mark as paraphrase, not quote |

**Michelin's listing is filed in the WRONG PROVINCE with the WRONG COORDINATES.** Both
`michelin.com.ph` and `bfgoodrich.com.ph` host EYG under the path segment `/batangas/`,
set `addressLocality: "BATANGAS"`, and publish
`geo: { latitude: 13.75647, longitude: 121.05831 }`.

- 13.756 N, 121.058 E is **Batangas City, ~130 km south of Balanga.**
- Balanga City is approximately **14.676 N, 120.511 E** (the value already in
  `src/config/site.ts` as `TODO-VERIFY`, and it is correct).
- `michelin.com.ph/auto/dealer-locator/bataan` **exists** as a page title
  (*"Tire Dealers in Bataan | Michelin PH"*, updated 2026-07-23) but EYG is **not** listed
  under it. BFGoodrich's Bataan index was last updated **2026-01-19**.

**Interpretation (evidence-based, not a guess):** Michelin's dealer record was created
against the wrong city, so the listing is invisible to anyone searching "Bataan" on
Michelin. This is a **free, high-value SEO win** — but the fix must be requested *from the
shop*, because only the authorised dealer can correct their own listing.

> 📌 **Action for the orchestrator → owner:** ask EYG to request a correction of the
> Michelin and BFGoodrich dealer records (city, address, and the Batangas coordinates) and
> ask to be listed under Bataan. Until then, the website is the **only** accurate
> location surface EYG controls. Get the NAP right and it will outrank both.

### 2.7 Brand relationships — **partly confirmed, mostly NOT**

| Claim | Source | Verdict |
|---|---|---|
| **Amaron** — *"official Amaron battery distributor"* | EYG TIRE TRADING page About (via search-engine snippet) | ⚠️ **PARTIALLY CONFIRMED.** Amaron batteries are genuinely *sold and installed* (DIN80 Amaron Jade AGM, verified post + photo). **The word "official distributor" is the shop's own self-description only — I could not verify it against Amaron Philippines.** Do not print "official Amaron distributor" until Amaron confirms in writing. |
| **Michelin, Blackhawk, Arivo, MRF** | EYG TIRE TRADING page About | ⚠️ **PARTIALLY CONFIRMED.** EYG **is** listed in the Michelin and BFGoodrich PH dealer locators (see §2.6) — that is real, checkable evidence of a Michelin/BFG relationship. Blackhawk, Arivo and MRF are **the shop's own claim**, unverified. |
| **Radar Renegade R/T+ 265/65R17** | Stock post 2024-09-22 + product photo | ✅ **CONFIRMED sold** |
| **Blacklion Mix 11R22.5** | Stock post 2024-09-10 (marked SOLD) | ✅ **CONFIRMED sold** (single-unit, truck/bus size) |
| **Deestone 185/65-14** | Stock post 2024-09-10 (marked SOLD) | ✅ **CONFIRMED sold** |
| **PETRONAS engine oil** | Post 2026-05-02 + product photo | ✅ **CONFIRMED stocked** |
| **Amaron Jade AGM** | Post 2026-08-07 + install photo | ✅ **CONFIRMED stocked** |
| Bridgestone, Goodyear, Dunlop, Maxxis, Yokohama | **Nowhere.** Not on either page, not in any post, not in any directory. | ❌ **NOT FOUND** |

> 🚨 **`src/config/site.ts` `tireBrands: ["Michelin","Bridgestone","Goodyear","Dunlop","Maxxis","Yokohama"]` is wrong on 5 of 6 entries.** It looks like a generic brand list. Replace with the brands actually evidenced
> above, and only after the owner confirms the current range. Shipping unverified tyre-brand
> badges is exactly the "trust badge for a brand you are not authorised to sell" failure
> the brief bans.

### 2.8 Opening announcement & the only promo ever posted — **CONFIRMED**

Post `1234870912037112`, **dated Tuesday, 9 December 2025, 9:27 PM** (DDG crawl date
2025-12-09 corroborates). Verbatim:

> 🖤💛 **EYG TIRE & AUTO CARE** 💛🖤
> is NOW OPEN! 🎉
> Come and visit us today and experience quality tire & auto care services.
> 🎁 **Special Opening Treat: The first 20 customers will receive FREEBIES!** 👍📣
> Please LIKE and SHARE 👍
> We look forward to serving you—see you soon!
> MESSENGER EYG TIRE Trading

Engagement: 3 comments, 3 shares. Album: `a.730304879160387`.

**What this tells us:**
- The Auto Care arm **opened 9 December 2025** — 7 weeks after the page was created.
- It was announced **on the older EYG TIRE TRADING page**, and directs people to
  **Messenger "EYG TIRE Trading"**. So the two pages are deliberately cross-linked and
  operated by one owner.
- 🚨 **The "first 20 customers get FREEBIES" offer is 10 months expired.** It must NOT be
  reused on `/deals`. A 10-month-old "special opening treat" is the archetypal **fake
  urgency** failure — see `docs/research/risks-dos-donts.md` §3.

### 2.9 Prices and promo codes — **NOT FOUND**

- **No PHP amount appears in any post, any `og:` tag, or the page About.**
- **No promo code has ever been posted.**
- The only "promo" ever posted is the expired opening freebie (§2.8).
- Pricing on the website must therefore be built from **industry ranges marked
  `SUGGESTED — REQUIRES OWNER CONFIRMATION`** (see `content/services.md`). **Do not invent
  EYG prices.** Publishing a wrong price is a Consumer Act problem, not just a trust
  problem.

### 2.10 Employment signals — useful for the About page, must be verified

| Post | Date | Content |
|---|---|---|
| `1095138446010360` | 2025-06-19 | "Urgent Hiring… Senior Mechanic — Vehicle diagnostics, Repair & maintenance. Tire mechanic background is a plus. 📍 EGSA Fourlanes, Tuyo, Balanga City, Bataan 📞 +63 962 717 6894" |
| `1247552900768913` | 2025-12-26 | Same Senior Mechanic ad, re-run |
| (Staria post snippet) | ~2026-08 | *"EYG Tire & Auto Care Corporation is looking for a customer-focused and organized professional… Handle customer inquiries, quotations, and follow-ups · Assist customers with tire, battery, PMS, and automotive service needs · Maintain accurate customer and vehicle records"* |

> ⚠️ **"EYG Tire & Auto Care Corporation"** appears in a job-ad snippet. If EYG is
> **incorporated**, that is the registered legal name and it must be what appears on
> receipts, the Terms page and the footer — and "Corporation" changes the NPCRS paperwork
> (Secretary's Certificate + SEC COR) versus a sole proprietorship (DTI Certificate of
> Registration). See `docs/research/legal-compliance-ph.md` §1.
> **UNVERIFIED — needs owner confirmation. This is the single most important open question.**

**Hiring for a mechanic in June 2025 and again in December 2025**, then announcing
"OPEN" in December 2025, is consistent with a shop that was staffing up. It is **not**
evidence of team size, and `trust.technicians` in `site.ts` must stay at 0 until confirmed.

### 2.11 Photo assets for the brand/gallery agents

**⚠️ READ FIRST — `fbcdn.net` URLs are signed and expire.** The `_nc_ohc`, `_nc_oc`,
`_nc_sid`, `oh` and `oe` query parameters are short-lived. They will 403. **Download them
immediately**, then re-host in `public/`. Below are the **permanent base filenames** (the
`<hash>_<owner>_<id>_n.jpg` triple) so you can find them again, and one currently-valid
full URL each as a starting point.

#### 2.11.1 Brand & cover

| Asset | Base filename | Notes |
|---|---|---|
| **Profile picture (720×720)** | `597563110_122109795609080627_2286900714830529120_n.jpg` | Already saved as `brand/raw/eyg-profile.jpg`. Yellow/black motorsport lockup. |
| **Cover photo (1987×1118)** | `595149660_122109794919080627_1837342542808680589_n.jpg` | The page banner. **Not yet downloaded.** |
| **Legacy page avatar (50×50 source)** | `410311113_726391312885077_4394910775736284865_n.jpg` | EYG TIRE TRADING's own avatar — *different* from the Auto Care mark. Confirm which is the master. |

#### 2.11.2 Photo-grid tiles on the Auto Care page (profile photos, 1536×1536 sources)

From the `/p/` shell, the page's own photo grid. All are profile/cover-style images, **not**
job photos — do not use them as gallery "work" shots.

```
776985226_122135932809080627_3208448920226143367_n.jpg
830198295_122139867933080627_9046483815130388106_n.jpg
792441270_122137004109080627_5466737025158806709_n.jpg
776252998_122135932923080627_7888962334182706389_n.jpg
776324106_122135932983080627_2912650508985899072_n.jpg
776130319_122135933079080627_7889283734469034248_n.jpg
776222325_122135932935080627_5566183338694794785_n.jpg
779048691_122135932995080627_7822176702481439811_n.jpg
795847814_122138871027080627_8485782778819036425_n.jpg
```

#### 2.11.3 Actual job photos — **this is your `/gallery` material**

**Toyota Hilux FX — steering rack + alignment** (post `122132407335080627`, 2026-07-02).
Album `a.122111105361080627`.
```
734768117_122132407401080627_947936334751832469_n.jpg   <- lead image, 2048x1536
732747593_122132407395080627_1925080151012567424_n.jpg
733529466_122132407419080627_4560206285456727548_n.jpg
733810390_122132407515080627_2202026100241529459_n.jpg
737619939_122132407425080627_2297977803467241261_n.jpg
```

**Hyundai Staria — Amaron Jade AGM DIN80 install** (post `122135103615080627`, 2026-08-07).
Album `a.122111105361080627`.
```
767268718_122135103669080627_5572051908911529429_n.jpg   <- lead image, 2048x1536
766952580_122135103753080627_3753880750145975156_n.jpg
767001856_122135103687080627_6063108549245130844_n.jpg
767130838_122135103729080627_7253748945423045844_n.jpg
769135874_122135103717080627_5329129108155067308_n.jpg
```

**PETRONAS engine oil range** (post `122127537963080627`, 2026-05-02).
Album `a.122111105361080627`.
```
686462710_122127538017080627_8189526890140414070_n.jpg   <- lead image, 2048x1536
686070315_122127538077080627_7415568136731696467_n.jpg
686397305_122127538047080627_3800824045913590808_n.jpg
686465454_122127538107080627_3079763716481531878_n.jpg
687040313_122127538089080627_2344605449848400016_n.jpg
```

**Opening announcement creative** (post `1234870912037112`, 2025-12-09). Album
`a.730304879160387`.
```
596801418_1234870622037141_9204331299475981853_n.jpg   <- 1540x679 banner
```

**Tyre stock photos — EYG TIRE TRADING** (Calero St. business). Album
`a.404664205057791`. *Useful for `/deals`, not for `/gallery`.*
```
485800103_1028666142657591_6097733836029011757_n.jpg   <- Radar Renegade 265/65R17, 960x1280
485806576_1028666192657586_8282907877022192827_n.jpg
485770102_1028665979324274_6883580499376729509_n.jpg
485808024_1028666112657594_8062078809837704314_n.jpg
486179642_1028438626013676_7678826258375810528_n.jpg   <- Deestone 185/65-14
486468492_1028438642680341_8326263988678084817_n.jpg
```

**Additional images found on the two hiring posts** (usable for an `/about` or team strip,
subject to consent — see `legal-compliance-ph.md` §7):
```
604859068_1247552137435656_2232989414069290390_n.jpg   <- Senior Mechanic ad, 1024x1536
509437523_1095137882677083_7557696427859833066_n.jpg   <- Urgent Hiring ad, 528x525
```

#### 2.11.4 🚨 Photo-consent blocker — read before you publish any of these

**Every job photo above was posted to a public Facebook page by the shop.** That does
**not** mean the people and vehicles in them consented to appearing on a commercial
website. Two specific risks:

1. **Plates.** The photos almost certainly show licence plates. A plate is LTO-issued and
   traceable to a named owner. Do not publish an unblurred plate on a website.
2. **Faces.** Faces are biometric-adjacent personal information. Under the Data Privacy
   Act the shop is the controller of these images.

**Required before any of these go live on `/gallery`:**
- [ ] Crop or blur **all** licence plates (or crop below the bumper line).
- [ ] Blur faces, or get a written, specific, revocable release from the owner.
- [ ] **Do not** put customer names next to photos. Name+photo+car model is a dossier.
- [ ] Add an alt text that describes the *work*, not the person:
      ✅ `"Brake pad and rotor replacement on the front axle of a silver sedan"`
      ❌ `"Customer Juan Dela Cruz with his new tyres"`
- [ ] Use the **vehicle class** in copy ("a Toyota Hilux FX"), which the shop already
      publishes, and drop the person's name entirely.

The shop's own post template already does the right thing — it names the vehicle, not the
customer. **Copy that discipline.**

### 2.12 Tone of voice — the shop's actual register

**Observed voice, sampled across 8+ posts.** The shop writes in a consistent, distinctive
house style. Reproduce it.

**Signature structural template** (used on every Auto Care post, 2026):

```
[emoji]: [Vehicle model]

🛠️ Done:
▪️ [verb phrase 1]
▪️ [verb phrase 2]

📍 [Brand] & Auto Care:
[Address line 1]
[Address line 2]

🛠️ Our Services:            <- actually labelled with a bold CJK-styled header
🟡 [Service 1]
🟡 [Service 2]
...
We are open from [hours]. Visit us in-store or message us to inquire
```

**Stock-post template** (EYG TIRE TRADING, 2024):

```
[emoji][emoji] [STATUS]!! [qty] of [size] [BRAND] [MODEL] [emoji][emoji]

📍EYG TIRE TRADING
   [street address]
   [landmark]

⏰ Monday to Saturday
   [hours]
```

**Actual voice characteristics — copy these:**

| Trait | Evidence |
|---|---|
| **Ends lines with `!!` and a `🔥`** | "NOW AVAILABLE!! 265/65R17 RADAR RENEGADE R/T+ 🛞🔥" |
| **Leads with a black-yellow heart pair `🖤💛 … 💛🖤`** | Used on the opening + both hiring posts — it is a **brand mark in emoji form**. Reuse it. |
| **Heavy emoji, used structurally not decoratively** | Every section header has its own emoji. Emoji = section break. |
| **Action verbs in past tense for completed work** | "Replaced Steering Rack Assembly", "Installed DIN80 Amaron Jade AGM battery", "SOLD!!" |
| **Title Case For Service Names** | "Preventive Maintenance Service", "Wheel Alignment and Camber Correction" — not sentence case. Keep this in the catalogue. |
| **Concrete, no adjectives** | Names the exact tyre size and compound. No "quality service", no "we care about you". |
| **Invites a message or a store visit** | "Visit us in-store or message us to inquire" — the shop's own closing CTA. |
| **Fluent, correct English — no forced Taglish on Facebook** | The page is entirely in English. The Taglish in the brief is for the *website*, which serves a different reader. Do not retro-Taglish the FB voice. |
| **Tyre sizes always formatted `WIDTH/PROFILE-RIM`** | `265/65R17`, `185/65-14`, `11R22.5` |

**What the shop does NOT do — do not add it:** no "certified", no "licensed", no
"authorised dealer", no "guaranteed", no "we use genuine parts only", no countdown timers,
no "limited slots". Its credibility comes from **naming the exact part and the exact size**,
which is a much stronger signal than adjectives. See `content/copy-notes.md`.

---

## 3. NOT FOUND — do not claim these

| Field | Status | Note |
|---|---|---|
| Phone number on the Auto Care page's About tab | **NOT FOUND** | Only in hiring post body (§2.4) |
| Email on the Facebook page | **NOT FOUND** | Only the directory email (§2.5) |
| Any price | **NOT FOUND** | See §2.9 |
| Any promo code | **NOT FOUND** | |
| Website URL on the page | **NOT FOUND** | |
| Google Business Profile / Google Maps listing | **NOT FOUND** | Not found on any source. **If one doesn't exist, creating it is the highest-ROI growth action available** — see `risks-dos-donts.md` §4. |
| Instagram / TikTok | **NOT FOUND** | No evidence any exist. `social.instagram` / `social.tiktok` are already `null` — keep them null. |
| `@eygtireautocare` X/Twitter handle | **NOT FOUND** | `SITE.twitter` in `site.ts` is fabricated. Remove it. |
| Bay count, technician count, years in business | **NOT FOUND** | All `TODO-VERIFY` in `site.ts` must stay 0 / unset. |
| Star rating / review count | **NOT FOUND** | `trust.ratingValue: 4.9, ratingCount: 0` in `site.ts` is **fabricated and dangerous**. A `4.9` with `0` reviews is self-evidently fake and would emit invalid `AggregateRating` schema. **Delete it.** |
| `foundedYear: 2024` | **CONTRADICTED** | FB `foundingDate` says 2025-10-19 for the Auto Care page, 2021-03-18 for EYG TIRE TRADING. |
| "30-day workmanship guarantee" | **NOT FOUND** | `trust.workmanshipGuaranteeDays: 30` in `site.ts` is **fabricated**. Never publish a warranty the owner hasn't agreed to in writing. |
| Facebook "About" long description / category | **NOT FOUND** | Login-walled (§1 #4). Only the search-engine snippet survived, which quoted *"🏎️ EYG Tire & Auto Care EGSA Fourlanes, Tuyo. Balanga City, Bataan Services Offered: Preventive Maintenance Service…"* — consistent with §2.3. |

---

## 4. Contradictions — the full list, for the owner

Present these as questions. **Do not resolve any of them by guessing.**

1. **Two businesses, one brand, two addresses, two phone numbers.** Is *EYG Tire Trading*
   (Calero St.) the tyre-sales arm and *EYG Tire & Auto Care* (EGSA Fourlanes) the
   service centre? Should the website show one address or both? If both, which is the
   "primary" NAP for schema.org and Google?
2. **Which phone number is the website's primary?** `+63 962 717 6894` (Auto Care) or
   `0998 532 3508` (EYG Tire Trading), or a third?
3. **Is the business "EYG Tire & Auto Care" or "EYG Tire & Auto Care Corporation"?**
   Corporation status changes the NPCRS paperwork and the legal name on receipts.
4. **When did the shop actually open?** Facebook says the Auto Care page was created
   2025-10-19 and the doors opened 2025-12-09. The brief says March 2025. EYG TIRE TRADING
   has existed since at least 2021-03-18. Do we claim 2021, 2025, or no year at all?
   (Recommendation: **claim no year until answered.** "Serving Balanga since…" with an
   unverified year is a lie with a date on it.)
5. **Is `lgguillermo3@gmail.com` the right contact email?** Is there an
   `@eygtireautocare.ph` domain? Does the owner control it?
6. **Are the Michelin and BFGoodrich dealer records current?** Both are filed under
   Batangas with Batangas City coordinates, and neither lists EYG under Bataan. Has the
   shop actually been in business with them, and has anyone asked them to fix it?
7. **Can EYG claim "official Amaron distributor"?** Needs written confirmation from Amaron
   Philippines. What is the *actual* current tyre range? (Michelin and BFGoodrich are
   evidenced; Blackhawk, Arivo, MRF are self-claimed; Bridgestone, Goodyear, Dunlop,
   Maxxis, Yokohama have **no** evidence.)
8. **Does the shop offer services beyond the 10 on the Facebook list?** Specifically:
   undercoating, AC/aircon repair, engine tune-up, shock absorbers, CVL/bushings, glass,
   roadside assistance, motorcycle service. The brief requires several of these on
   `/services`; Facebook does not confirm them.
9. **Is Sunday genuinely closed every week?** The posts say "Monday to Saturday" with no
   exception, but roadside service implies someone is reachable. If there is an emergency
   line, that is a different conversion path.
10. **Is there a Google Business Profile, and is it claimed and verified?** I found none.
    If one exists, its NAP must be reconciled with the website's.
11. **Do you take old tyres for disposal, and is there a fee?** Common PH practice,
    absent from every post. `content/faqs.md` flags it as needing a real policy.
12. **What are your actual prices?** Nothing is published anywhere. Every number in
    `content/services.md` is a **SUGGESTED** industry range awaiting sign-off.
13. **Do you offer GCash / Maya / credit instalment?** Listed in `site.ts` `paymentMethods`
    but evidenced nowhere. Confirm or delete.
14. **Roadside assistance — do you actually run a 24/7 tow/roadside service?** The brief
    builds a whole conversion lane on it. Nothing on the Facebook page supports it. This
    is the highest-risk unverified claim in the entire build, because the site's primary
    conversion lane is *stranded driver → call → rescue**.

---

## 5. Source register

Every fact above traces to one of these. Checked **2026-10-02**.

| # | Source | What it gave | Class |
|---|---|---|---|
| S1 | `https://www.facebook.com/p/EYG-Tire-Auto-Care-61582418828014` | Live `og:title`/`og:description`/`og:image`; "308 followers · 32 talking about this · 📍 EGSA, Fourlanes Balanga City, Bataan"; cover + grid photo URLs | Facebook, first-party |
| S2 | `https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2F61582418828014&tabs=about` | Name + "308 followers" | Facebook, first-party |
| S3 | `https://www.facebook.com/plugins/post.php?href=…%2F61582418828014%2Fposts%2F122135103615080627…` | **Full service list + hours**; page `foundingDate` 2025-10-19; 5 job photos; post date 2026-08-07 | Facebook, first-party |
| S4 | `…/posts/122132407335080627…` (Hilux) | Steering rack + wheel alignment; `keywords` taxonomy; 2026-07-02 | Facebook, first-party |
| S5 | `…/posts/122127537963080627…` (PETRONAS) | Engine oil retail; `keywords`; 2026-05-02 | Facebook, first-party |
| S6 | `…/100065426441998%2Fposts%2F1234870912037112…` | "NOW OPEN" text; freebie offer; 2025-12-09; cross-link to Messenger | Facebook, first-party |
| S7 | `…/100065426441998%2Fposts%2F899735982217275…` (Radar) | Calero St. address + landmark; Mon–Sat 8–5; `foundingDate` **2021-03-18**; 575 followers | Facebook, first-party |
| S8 | `…/100065426441998%2Fposts%2F891051626419044…` (Deestone) | Confirms Calero St. address + Mon–Sat 8–5 | Facebook, first-party |
| S9 | `…/100065426441998%2Fposts%2F1095138446010360` and `/1247552900768913` (`og:description`) | **+63 962 717 6894**; EGSA Fourlanes; mechanic vacancies 2025-06-19 / 2025-12-26 | Facebook, first-party |
| S10 | `https://www.balanga.com.ph/business-directory/automobile-services-and-transportation/eyg-tire-trading` | **09985323508**; **lgguillermo3@gmail.com**; Calero St., Ibayo; `AutomotiveBusiness` JSON-LD; *"sourced from official business tax records"*, *"in partnership with the City Government of Balanga"* | City of Balanga + Yoonet — official |
| S11 | `https://www.michelin.com.ph/auto/dealer-locator/batangas/yfvejbu-eyg-tire-trading` | EYG TIRE TRADING as a **"4W tire dealer"**; `#183 CALERO ST., IBAYO BALANGA CITY BATAAN 2100`; `addressLocality: BATANGAS`; `geo 13.75647, 121.05831`; page updated 2026-07-23 | Brand, first-party |
| S12 | `https://www.bfgoodrich.com.ph/auto/dealer-locator/batangas/yfvejbu-eyg-tire-trading` | Identical record; page updated 2026-01-19 | Brand, first-party |
| S13 | `https://www.michelin.com.ph/auto/dealer-locator/bataan` | Bataan index exists (title only) — **EYG absent from it** | Brand, first-party |
| S14 | `https://html.duckduckgo.com/html/?q=%22EYG+Tire+%26+Auto+Care%22+Balanga` | EYG TIRE TRADING About snippet; stale "302 followers · 60 talking about this"; post permalinks | Search engine cache — **secondary, stale** |
| S15 | `https://www.facebook.com/61582418828014/posts/122135103615080627/` (`og:description`, `keywords`) | Truncated service footer; keyword taxonomy | Facebook, first-party |
| S16 | `https://privacy.gov.ph/data-privacy-act/` | Full text RA 10173 | National Privacy Commission — official |

**Sources that returned nothing usable** (recorded so nobody re-tries them): mbasic FB,
m.facebook FB, FB `/about_contact_and_basic_info`, DDG after 4 queries, DDG lite, Mojeek,
Official Gazette (403), built-in `websearch` (0 results on 4 queries), PRC website
(transport error), DTI BNR FAQ PDF (timeout).

---

## 6. One-page handoff

**Safe to publish today (all CONFIRMED):**
- Mon–Sat 08:00–17:00, Sunday closed
- EGSA Fourlanes, Tuyo, Balanga City, Bataan — as the Auto Care service centre
- The 10-item service list, verbatim, in the page's own order
- "Since" date: **omit entirely**
- Brand-colour yellow/black heart motif `🖤💛 … 💛🖤`

**Safe to publish after one phone call to the owner:**
- Phone number (→ `+63 962 717 6894`), WhatsApp number, email (→ `lgguillermo3@gmail.com`)
- Legal name and whether it's a Corporation
- All prices
- Every service not on the 10-item list
- Every tyre brand and every "distributor" claim
- Any warranty, any rating, any years-in-business
- Whether roadside assistance exists at all

**Must be deleted from `src/config/site.ts` before launch:**
`phoneE164: "+639000000000"` · `whatsappNumber: "639000000000"` · `email:
"hello@eygtireautocare.ph"` · `emailSupport: "service@eygtireautocare.ph"` ·
`trust.ratingValue: 4.9` · `trust.ratingCount: 0` ·
`trust.workmanshipGuaranteeDays: 30` · `foundedYear: 2024` ·
`SITE.twitter: "@eygtireautocare"` · 5 of 6 entries in `tireBrands` ·
`BUSINESS.social.messenger: "m.me/EYGTireAutoCare"` (unverified; the page directs
customers to Messenger **"EYG TIRE Trading"**) · the entire `paymentMethods` array
(unevidenced).

Each of these is either a placeholder, a fabrication, or a contradicted value. Every one of
them is a conversion-killer or a legal exposure. That list is the orchestrator's single
highest-priority action item from this agent.
