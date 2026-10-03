# CONTENT CALENDAR — 90 DAYS

> **Owner:** marketing agent · **Source bank:** `src/content/marketing/social.ts`
> (30 posts) · **Cadence:** ~6 Facebook posts + 1 GBP post per week
> **Rule:** every post comes from the bank, or it is something real that happened
> in the bay. Nothing else goes on the page.

---

## 1. How to read this

### The cadence rule

**The bank holds 30 posts. The 90-day calendar uses them at roughly 6 per week,
with the remaining slots left for what actually happens in the shop.**

This is deliberate. Posting 30 consecutive days is how a three-person shop burns
out in three weeks and then goes silent for a year. A page that posts 6 times a
week for 90 days beats a page that posts 20 times in October and nothing in
November — not just because it is consistent, but because consistency is what
the algorithm reads as *a business*.

| Slot | Count | What goes there |
| --- | --- | --- |
| Bank posts (scheduled) | ~30 across 90 days | From `social.ts`, sequenced by theme |
| Customer moments | ~30 across 90 days | Whatever genuinely happened that week |
| Season hooks | ~10 | Rain, holidays, toll days — see §4 |
| Quarterly campaigns | 4–6 | Tied to `promotions.ts` |

**"Customer moments" are the posts that beat the bank posts.** A real tyre that
came in shredded, a real question a customer asked at the counter, a real before
and after. Always photograph them the same day, always ask permission before
naming a customer, and never caption a set-up as an outcome.

### Day codes

| Code | Day | Typical post |
| --- | --- | --- |
| M | Monday | Text / community / educational |
| T | Tuesday | Photo / educational |
| W | Wednesday | Reel / trust |
| Th | Thursday | Photo / offer |
| F | Friday | Carousel / educational |
| Sa | Saturday | **Customer moment** (busiest day — phone in hand, shoot it) |
| Su | — | **Nothing.** Monday to Saturday only, matching the shop. |

---

## 2. The seasonal spine (Philippines, Central Luzon)

Everything in this calendar hangs off these dates.

| Window | Hook | Content angle | Campaigns |
| --- | --- | --- | --- |
| **Jun – Nov** | **Rainy season** | Grip, visibility, brakes, standing water, wipers | `rainy-season-safety-bundle` |
| **Mar – May** | **Dry / hot season** | Tyre pressure in heat, slow leaks, cooling system | — |
| **Late Mar / Apr** | **Holy Week** | Vehicles idle for 4 days — the classic check-up window. ⚠️ Confirm shop closure. | `mid-year-check-up` (book-ahead) |
| **May** | **Summer holidays** | Long trips, tyre checks before leaving | — |
| **Aug – Oct** | **9G / 10G toll days** *(actual dates announced yearly — verify)* | Traffic volume, "do not wait until Undas", booked-out bays | — |
| **Oct** | **Undas season opens** | Book early. Heavy traffic = heavy wear. | `tyre-clearance` |
| **Nov** | **Christmas season** | Year-end service, gifts of service, budgets | `bring-a-neighbour` |
| **Dec** | **Christmas + New Year** | Last-minute servicing before travel, gift cards | `bring-a-neighbour` |
| **Jan** | **New Year, post-holiday** | Post-travel inspections, New Year resolutions | — |

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION:** Holy Week and Christmas
operating hours. Philippine law limits business operations during these
periods. The owner must confirm actual closure dates; do not guess them in copy.

⚠️ **SUGGESTED — REQUIRES VERIFICATION:** 9G / 10G toll-free dates change every
year and are announced by NLEX. Verify the actual dates before scheduling.

---

## 3. The 90-day calendar

**Theme per fortnight.** Each fortnight has a job, and the bank's posts are
pulled from `social.ts` by `dayOffset`.

### DAYS 1–14 — "GET FOUND" · Week of the setup

**Job:** teach the algorithm what the page is, and prove to the algorithm the
shop exists. Heavy on educational because that is what earns saves and shares.

| # | Day | Post from bank | Format | Pillar | Why here |
| --- | --- | --- | --- | --- | --- |
| 1 | M | `dayOffset: 0` — how to read your tyre size | carousel | educational | The highest-save post in the bank. Opens the quarter. |
| 2 | T | `dayOffset: 1` — this is the bay | photo | trust | The anti-overcharge photo. Establishes the shop as real. |
| 3 | W | `dayOffset: 2` — we show you the old part | reel | trust | The single most persuasive trust asset. |
| 4 | Th | `dayOffset: 13` — Bataan rain | text-only | community | Local voice. Makes the page feel like a neighbour. |
| 5 | F | `dayOffset: 3` — door-jamb pressure | photo | educational | Free service offer with no code. |
| 6 | Sa | **Customer moment** | photo | — | Whatever happened. Saturday is the shoot day. |
| 7 | M | `dayOffset: 4` — how a job goes, four steps | carousel | trust | Removes process anxiety. |
| 8 | T | **GBP post 1** | update | — | The tyre-pressure tip, from `dayOffset: 3`. |
| 9 | W | `dayOffset: 5` — **Rainy Season Safety Bundle** | photo | offer | Seasonal campaign goes live. Deepest post of the fortnight. |
| 10 | Th | `dayOffset: 6` — why one tyre is bald | carousel | educational | Follow-up to the tyre content. |
| 11 | F | `dayOffset: 7` — torque wrench | photo | trust | Appeals to customers who already know cars. |
| 12 | Sa | **Customer moment** | photo | — | |
| 13 | M | `dayOffset: 8` — **Tyre Clearance** | photo | offer | Second campaign. ⚠️ Never on the same day as another discount. |
| 14 | T | `dayOffset: 19` — cheap vs tipid | text-only | community | Strongest positioning post. No offer needed. |

**Customer Moments to chase this fortnight:** a tyre that came in below the wear
bar; a customer who brought a car they had been quoted ₱2,000 elsewhere; the
bay at night.

---

### DAYS 15–30 — "TRUST THE PRICE" · Week of the explain

**Job:** attack the overcharging fear directly. This is the theme that wins
Balanga.

| # | Day | Post from bank | Format | Pillar | Why here |
| --- | --- | --- | --- | --- | --- |
| 15 | M | `dayOffset: 11` — **First Visit PMS 15%** | photo | offer | The trust engine. 15% is deliberately shallow. |
| 16 | T | `dayOffset: 12` — PMS A vs PMS B | carousel | educational | Directly supports the offer above. |
| 17 | W | `dayOffset: 10` — small shop, same faces | photo | trust | ⚠️ **Needs real faces + consent.** Fallback: `dayOffset: 26`. |
| 18 | Th | `dayOffset: 20` — a job we do not do | text-only | trust | Refusing work is the strongest trust signal available. |
| 19 | F | `dayOffset: 24` — pull to one side | photo | educational | Positions the shop as one that thinks. |
| 20 | Sa | **Customer moment** | photo | — | A written inspection sheet on the bench. |
| 21 | M | `dayOffset: 14` — the check sheet | photo | trust | Blur all customer data. |
| 22 | T | `dayOffset: 9` — can you see the grooves | photo | educational | Rainy-season content, still in season. |
| 23 | W | `dayOffset: 17` — when the road is empty | text-only | community | Practical. Converts commuters to off-peak bookings. |
| 24 | Th | **GBP post 2** | offer | — | The live campaign. |
| 25 | F | `dayOffset: 15` — vulcanize or replace | carousel | educational | High comment volume — people post puncture photos. |
| 26 | Sa | **Customer moment** | photo | — | |
| 27 | M | `dayOffset: 16` — **Bring a Neighbour** | photo | offer | Referral. Can run alongside another offer. |
| 28 | T | `dayOffset: 22` — hot day, check pressures | photo | community | ⚠️ Seasonal — swap for `dayOffset: 25` if not hot. |
| 29 | W | `dayOffset: 25` — first car, the list | carousel | educational | Reaches a brand-new audience. |
| 30 | Th | `dayOffset: 18` — squeal vs grind | reel | trust | **Real audio, real bay.** Never stock engine noise. |

---

### DAYS 31–45 — "SHOW THE WORK"

**Job:** proof. This is the fortnight where the page stops being a catalogue.

| # | Day | Post from bank | Format | Pillar | Why here |
| --- | --- | --- | --- | --- | --- |
| 31 | F | `dayOffset: 21` — the tyre has a birthday | photo | educational | Under-used topic. High save rate. |
| 32 | Sa | **Customer moment** | photo | — | |
| 33 | M | `dayOffset: 23` — **Mechanic of the Month** | photo | offer | ⚠️ **Needs a real consenting family.** If not available → customer moment. |
| 34 | T | **GBP post 3** | update | — | The warning-lights content, from `dayOffset: 27`. |
| 35 | W | `dayOffset: 26` — what it's like when you walk in | photo | trust | |
| 36 | Th | **Customer moment** — before/after | photo | trust | ⚠️ **Never caption a before/after as an outcome.** Describe, do not promise. |
| 37 | F | `dayOffset: 27` — the four warning lights | carousel | educational | Save-worthy. Drives inbound DMs. |
| 38 | Sa | **Customer moment** | photo | — | |
| 39 | M | **GBP post 4** | offer | — | |
| 40 | T | `dayOffset: 28` — holiday travel checklist | carousel | community | ⚠️ **Schedule ~2 weeks before Undas**, not during. |
| 41 | W | **Customer moment** | reel | — | A tyre being vulcanized, time-lapsed. |
| 42 | Th | **Review spotlight** | photo | trust | A real review, screenshot, with the customer's permission. ⚠️ **Only once real reviews exist.** |
| 43 | F | **Bank post: any unused** | — | — | |
| 44 | Sa | **Customer moment** | photo | — | |
| 45 | M | **Campaign status** | text-only | offer | "The rainy bundle ends on the 30th" — see §6. |

---

### DAYS 46–60 — "THE MONEY" · the earning fortnight

**Job:** review requests go hard. This is the fortnight where the review count
moves, and reviews move ranking.

| # | Day | Post from bank | Format | Pillar | Why here |
| --- | --- | --- | --- | --- | --- |
| 46 | T | `dayOffset: 16` — bring a neighbour (re-run) | photo | offer | Referrals compound. Two runs per quarter is right. |
| 47 | W | **Review request push** | photo | trust | Post asking publicly for reviews. Legitimate. Do not offer anything. |
| 48 | Th | `dayOffset: 12` — PMS A vs B (re-run) | carousel | educational | Educational posts have a long tail. |
| 49 | F | **GBP post 5** | update | — | Rotate to a fresh bank topic. |
| 50 | Sa | **Customer moment** | photo | — | |
| 51 | M | `dayOffset: 20` — a job we do not do (re-run) | text-only | trust | Trust posts should run twice. |
| 52 | T | `dayOffset: 5` — Rainy bundle (re-run) | photo | offer | ⚠️ Only if still inside the window. If ended → **do not re-run**. |
| 53 | W | **Review spotlight** | photo | trust | ⚠️ Real review + permission only. |
| 54 | Th | `dayOffset: 24` — pull to one side (re-run) | photo | educational | |
| 55 | F | `dayOffset: 19` — cheap vs tipid (re-run) | text-only | community | |
| 56 | Sa | **Customer moment** | photo | — | |
| 57 | M | **GBP post 6** | offer | — | |
| 58 | T | `dayOffset: 7` — torque wrench (re-run) | photo | trust | |
| 59 | W | **Customer moment** | reel | — | |
| 60 | Th | **Campaign end / roll** | text-only | offer | See §6 — how a promo ends. |

---

### DAYS 61–75 — "SEASONAL" · the tie-in fortnight

**Job:** get onto the seasonal news feed. Google and Facebook both boost timely
content. A post about the weather this week beats a post about tyres every time
when the weather is turning.

| # | Day | Post from bank | Format | Pillar | Why here |
| --- | --- | --- | --- | --- | --- |
| 61 | F | `dayOffset: 13` — Bataan rain (re-run) | text-only | community | ⚠️ Time this to an actual weather event. |
| 62 | Sa | **Customer moment** | photo | — | |
| 63 | M | **Weather-reactive** | photo | community | ☔ Actual rain photo of the Fourlanes, taken today. |
| 64 | T | `dayOffset: 9` — grooves (re-run) | photo | educational | |
| 65 | W | `dayOffset: 9` — tyre pressure in the rain | photo | educational | New write; same topic. |
| 66 | Th | **GBP post 7** | update | — | |
| 67 | F | `dayOffset: 17` — when the road is empty (re-run) | text-only | community | |
| 68 | Sa | **Customer moment** | photo | — | |
| 69 | M | `dayOffset: 3` — door-jamb pressure (re-run) | photo | educational | |
| 70 | T | **GBP post 8** | offer | — | |
| 71 | W | `dayOffset: 15` — vulcanize or replace (re-run) | carousel | educational | |
| 72 | Th | **Customer moment** | photo | — | |
| 73 | F | `dayOffset: 29` — **Mid-Year Check-Up, book ahead** | photo | offer | ⚠️ **Post in Jan/Feb for a May–July window.** If already inside the window, skip. |
| 74 | Sa | **Customer moment** | photo | — | |
| 75 | M | **Customer moment** | reel | — | A full tyre changeover, start to finish. |

---

### DAYS 76–90 — "REVIEW + RENEW"

**Job:** close the quarter on proof, and arm the next one.

| # | Day | Post from bank | Format | Pillar | Why here |
| --- | --- | --- | --- | --- | --- |
| 76 | T | `dayOffset: 18` — squeal vs grind (re-run) | reel | trust | |
| 77 | W | **Review spotlight** | photo | trust | ⚠️ Real review + permission. |
| 78 | Th | `dayOffset: 21` — tyre birthday (re-run) | photo | educational | |
| 79 | F | **GBP post 9** | update | — | |
| 80 | Sa | **Customer moment** | photo | — | |
| 81 | M | **Review push** | text-only | trust | "If you have been in and have a minute…" — no incentive, no filter. |
| 82 | T | `dayOffset: 28` — holiday checklist (re-run) | carousel | community | ⚠️ ~2 weeks before Undas. |
| 83 | W | `dayOffset: 25` — first car list (re-run) | carousel | educational | |
| 84 | Th | **Customer moment** | photo | — | |
| 85 | F | `dayOffset: 10` — same faces (re-run) | photo | trust | ⚠️ Real faces + consent. |
| 86 | Sa | **Customer moment** | photo | — | |
| 87 | M | `dayOffset: 22` — hot day (re-run) | photo | community | ⚠️ Seasonal swap. |
| 88 | T | **GBP post 10** | offer | — | |
| 89 | W | **Customer moment** | reel | — | |
| 90 | Th | **Quarter review + thank you** | text-only | community | Thank the customers by name if permitted. Announce what is next. |

---

## 4. Bank usage map

Which of the 30 bank posts are scheduled, and which are held in reserve.

| `dayOffset` | Pillar | Primary use | Re-runs |
| --- | --- | --- | --- |
| 0 | educational | Day 1, opening carousel | Day 43 |
| 1 | trust | Day 2, the bay | — |
| 2 | trust | Day 3, old part reel | — |
| 3 | educational | Day 5, pressure | Day 69 |
| 4 | trust | Day 7, four steps | — |
| **5** | **offer** | Day 9, rainy bundle | Day 52 (⚠️ in-window only) |
| 6 | educational | Day 10, bald tyre | — |
| 7 | trust | Day 11, torque wrench | Day 58 |
| **8** | **offer** | Day 13, clearance | — |
| 9 | educational | Day 22, grooves | Day 64 |
| 10 | trust | Day 17 ⚠️ consent | Day 85 |
| **11** | **offer** | Day 15, first PMS | — |
| 12 | educational | Day 16, PMS A/B | Day 48 |
| 13 | community | Day 4, Bataan rain | Day 61 |
| 14 | trust | Day 21, check sheet | — |
| 15 | educational | Day 25, vulcanize | Day 71 |
| **16** | **offer** | Day 27, refer | Day 46 |
| 17 | community | Day 23, off-peak | Day 67 |
| 18 | educational | Day 30, squeal/grind | Day 76 |
| 19 | community | Day 14, cheap vs tipid | Day 55 |
| 20 | trust | Day 18, job we don't do | Day 51 |
| 21 | educational | Day 31, tyre birthday | Day 78 |
| 22 | community | Day 28, hot day ⚠️ seasonal | Day 87 |
| **23** | **offer** | Day 33 ⚠️ consent needed | — |
| 24 | educational | Day 19, pull to one side | Day 54 |
| 25 | educational | Day 29, first car | Day 83 |
| 26 | trust | Day 35, walk in | — (fallback for 10) |
| 27 | educational | Day 37, warning lights | — |
| 28 | community | Day 40, holiday checklist | Day 82 |
| **29** | **offer** | Day 73 ⚠️ Jan/Feb only | — |

**Six bank posts carry a consent or asset blocker and cannot run until the owner
supplies the asset:** `dayOffset: 10` (real faces), `dayOffset: 23` (real
consenting family), `dayOffset: 2` (real removed part). Each has a documented
fallback in §5.

---

## 5. Substitution rules

A calendar is a plan, not a cage. Swap freely, on these rules:

| Situation | Swap to |
| --- | --- |
| No real photo available today | Any `text-only` bank post (there are 5) |
| Post blocked on consent | Its documented fallback in `social.ts` → `note` |
| Campaign not running | Any educational or trust post. **Never fill an offer slot with a soft offer.** |
| Owner had a genuinely great day | **Customer moment. Always beats the bank.** |
| Rainstorm today | `dayOffset: 13` (Bataan rain), immediately |
| Genuinely nothing happened | Post nothing. A quiet week is fine. Silence for a week is not. |

**Never:** post a set-up photo and caption it as an outcome · caption a
before/after as a guaranteed result · invent a customer · invent a number ·
post a countdown.

---

## 6. Ending a campaign in the calendar

The week a promo ends, three posts are scheduled:

| Day | Post |
| --- | --- |
| **7 days out** | The announcement. Named, specific, honest. (Template in `PROMO-PLAYBOOK.md` §9 Step 1.) |
| **2 days out** | Reminder. One offer, one date. |
| **End date** | Thank you. Name what the offer was. Point at what replaces it. |
| **Next day** | **Nothing about the offer at all.** Move straight to educational or trust. |

> The rule: **never** say *"the promo has ended, prices are back to normal."*
> That sentence tells a loyal customer their entire relationship was a
> promotional period.

---

## 7. WhatsApp and the same content

⚠️ **Requires owner consent and a broadcast list of people who asked to be
added.** Never add a number that did not opt in.

| Day | WhatsApp broadcast |
| --- | --- |
| Monday | This week's tip (one educational item, plain text) |
| Thursday | This week's offer — ⚠️ only if a campaign is live |
| Ad hoc | **Closure, delay, or back-in-stock notices.** This is the highest-value WhatsApp use. |

Rules: max 2 broadcasts a week · always opt-out (`STOP`) · never send a
broadcast to a number that has not opted in · never forward a customer's number
to anyone.

---

## 8. Monthly ops

### Every Monday, 20 minutes

- [ ] Review the previous week's posts. Any under-performing format, change it.
- [ ] Log every customer moment from last week. That is your content backlog.
- [ ] Check the campaign: is it still inside its window?
- [ ] Check reviews: reply to anything unanswered
- [ ] Photograph one real job for the GBP profile

### First Monday of the month, 30 minutes

- [ ] GBP Insights: discovery search terms, actions
- [ ] Google Maps pin position — drag if it drifted
- [ ] Citation check — any listing missing NAP?
- [ ] Duplicate listing sweep (search the shop name in quotes)
- [ ] Review velocity: on track for +2/week?
- [ ] Next month's campaigns confirmed with the owner

### Quarterly

- [ ] Re-read `PROMO-PLAYBOOK.md` §4 — has the margin floor moved?
- [ ] Rotate the seasonal spine for the next quarter
- [ ] Prune the bank: delete anything never posted, add what worked
- [ ] Audit the calendar against what actually happened

---

## 9. Success measures for this calendar

Not follower count. Followers are vanity here.

| Measure | 90-day target |
| --- | --- |
| Posts published | **50+** (bank + customer moments) |
| Customer moments captured | **30+** |
| Inbound Messenger/DM conversations | 60+ |
| Google reviews | **+26** (2/week) |
| Phone calls from the page | Tracked from week 1 |
| Save/share rate on educational posts | Above page average |
| Offers run | 4–6, with **zero** category conflicts |

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION:** the numeric targets above are
planning estimates by a marketer, not measured benchmarks. Replace them with the
shop's own baseline after one quarter of data.

---

**Related:** `social.ts` (the 30-post bank) · `PROMO-PLAYBOOK.md` ·
`GEO-LOCAL-SEO.md` §2.8 · `MESSENGER-MACROS.md` (what to say when a post
generates a DM).