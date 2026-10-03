# REVIEW SOP — the highest-ROI thing in this project

> **Owner:** A6 · marketing & merchandising · **Status:** ready for owner sign-off
> **Scope:** how the shop asks for a review, when, what it says, and what it must never do
> **Companion doc:** `HANDOVER-SCRIPT.md` (the 30-second conversation)

---

## 0. The honest ranking of this build

Every other document in `docs/inventory-marketing/` is a campaign. **This one is the
strategy.**

| This | versus | Why this is worth more |
| --- | --- | --- |
| **A review engine** | any campaign | Compounds. A discount ends on its `endsAt`. A review is permanent, it raises local search rank every month, and it is **the only marketing asset that makes the next four campaigns cheaper to run.** |
| 26 reviews in 90 days | | ⚠️ `CONTENT-CALENDAR.md` §9 target — **SUGGESTED, REQUIRES OWNER CONFIRMATION**, a planning estimate by a marketer and not a measured benchmark. |
| Every other campaign in this folder | | They take a percentage off a fixed demand pool. This one changes how much of that pool finds the shop at all. |

And the shop's own situation makes it non-negotiable: **138 registered automotive
businesses in Balanga City, and not one of the five listings read in full publishes a
price, hours, a service list or a way to book** (`../research/competitors.md` §3). **Review
count is the last proxy signal a local search engine and a nervous commuter both use.** It
is the one trust number that is both true and checkable.

---

## 1. 🔴 THE BLOCKER — read this before writing a single message

> ### 🚫 `BUSINESS.social.googleBusiness` is `null`, tagged `[UNVERIFIED] — Google
>
> ### Business Profile not yet claimed.`
>
> **`../marketing/GBP-LISTING.md` §6, line by line: *"⚠️ The short review URL is not
> created yet."***

**There is no Google Business Profile to review.** Until the owner claims it, verifies it,
and creates the short review link:

| Do **not** | Why |
| --- | --- |
| Send a customer to "write a review" on Google | There is nothing there to write one on. The customer lands on a map pin that may be unclaimed, may be someone else's, or may not exist — and they experience that as EYG sending them nowhere. |
| Print the review QR on the handover card | Same dead end, but now the customer is standing at the counter watching it fail. |
| Publish "Rated X ★ by Y customers" | 🚫 **A Google manual-action risk and a Consumer Act exposure.** `competitors.md` §6 item 10. `site.ts` deliberately has `ratingCount: 0` so `AggregateRating` renders nothing. **Leave it at 0.** |

### 1.1 The prerequisite — this is Owner Action #1, and it is not optional

| Step | Action | Why it comes first |
| --- | --- | --- |
| 1 | **Claim or create the Google Business Profile** for the exact NAP in `site.ts`. | There is nothing to review without it. ⚠️ **TODO-VERIFY** — a GBP already exists unclaimed, or must be created. |
| 2 | **Verify the NAP matches `site.ts` exactly** — `EGSA Fourlanes, Tuyo, Balanga City, Bataan 2100`, `+639627176894`. | NAP mismatch is the most common and most fixable local-SEO defect (`competitors.md` §2.6). |
| 3 | **Fix the hours.** `Mon–Sat 08:00–17:00, Sun closed` ⚠️ **TODO-VERIFY** — confirm against `BUSINESS_HOURS`. | A wrong "Open now" on a Google profile costs walk-ins. |
| 4 | **Create the short review URL** (GBP → Reviews → Get more reviews). | ⚠️ GBP-LISTING: roughly **3× more effective** than a general `g.page` search link. This is the URL that goes in every template below. |
| 5 | Put the short URL into `site.ts` as the single source of truth. | Never hardcode a review URL in a component. |

**Until step 4 exists, use the fallback**, which is honest and still works:

> **Search "EYG Tire & Auto Care" on Google Maps, tap "Write a review".**

Slower than a link. Still works. 🚫 **Never send a customer to a URL that returns 404.**

### 1.2 The reviews this shop most needs

The shop's real objection is not price, it is **fear of being overcharged**
(`competitors.md` §5.1). So the review types that matter, in priority order:

| Priority | The review | Why it is worth chasing specifically |
| --- | --- | --- |
| 1 | **Price transparency** — *"They told me the price before they started."* | Directly counters the objection that costs this shop the most sales |
| 2 | **Specificity** — *"Rodel showed me the old tyre and the tread depth."* | Only a real customer produces this. A generic review has none. |
| 3 | **Repeat** — a second or third visit | Proves the shop is not a one-off. Highest persuasion weight. |
| 4 | **The recommendation** — the customer sent someone | `bring-a-neighbour` is the shop's primary growth engine |

**Chase these by asking the right question, not by asking for a rating.** See §5.

---

## 2. The four rules — absolute, from `PROMO-PLAYBOOK.md` §8 and `GBP-LISTING.md` §6

> ### 1. Ask **everyone**
>
> ### 2. Offer **nothing** in exchange
>
> ### 3. Ask for "an **honest** review" — never "a 5-star review"
>
> ### 4. Reply to **every** review within 48 hours

### 2.1 Why rule 1 is not negotiable

**Selective review requests violate Google policy.** Asking only the happy customers is
gating, it is detectable, and the penalty is on the profile — which is the whole asset.
`reviews.ts` states it directly:

> *"Selective review requests are a policy violation."*

**This includes the "they were happy, right?" filter.** The mechanic who asks the person
who laughed is doing the thing that gets a profile killed. **Every completed job gets the
ask.** The unhappy customer gets it too — *and the complaint gets fixed at the counter,
which is where it was going to end up anyway.*

### 2.2 Why rule 2 is absolute

| Banned "incentive" | Status |
| --- | --- |
| "₱100 off your next service if you review" | 🚫 Google policy. Can cost the profile. |
| A free rim wipe, a free pressure check, a free rotation | 🚫 **Even though these cost nothing.** The value is the value. |
| Priority booking | 🚫 |
| "Review us and get a freebie at Christmas" | 🚫 This is the shop's own expired opening promo, and Google reads it as a scheme |

**The authorised lever is a free service that is given to everyone, unconditionally, with no
reference to a review.** `PROMO-PLAYBOOK.md` §7: *"a free pressure check, a free rotation,
a free wipe of the rims. Those cost almost nothing, are visible to the customer, and do not
break the published price."* None of those three mentions a review. Ever.

### 2.3 Why rule 3 is a policy rule and not a style choice

"Could you give us five stars?" is flagged in Google policy as review gating. And it is also
bad practice: it produces a distribution of ratings that looks bought, which is exactly what
a Balanga customer is scanning for. **"An honest review" is also the honest request** — the
shop's brand claim is *"every number we publish, we can stand behind"* (`competitors.md`
§5.5), and a review-solicitation script that demands five stars undercuts it in the one
place a customer reads the script.

### 2.4 Republishing is a **second** act of consent

A Google review is public by default. Putting it on the EYG website or Facebook is a new
publication, on a different surface, with a different audience.

| Consent | Covers |
| --- | --- |
| Leaving a Google review | Google Maps only |
| ✅ **Explicit, separately given** | Quoting the customer's words on the site or Facebook, and using their name |

`reviews.ts` rule 5. And `Testimonial.isPublished` ships `false` on every seed row — so a
placeholder review can never reach a public page. **Do not change that default to make the
page look finished.**

### 2.5 Deletion

If a customer asks for a review to be removed, **remove it and stop asking.** No
persuasion, no "are you sure", no retention offer. This is not negotiable and it is not a
tone issue.

---

## 3. The three-touch sequence

One ask, three moments, **zero repetition of the ask itself**.

```
T+0        HANDOVER      A person, 30 seconds, invoice in hand. Face to face.
T+2h       MESSAGE       One SMS or one Messenger message. Same day.
T+7d       FOLLOW-UP     One message, ONLY if there is still no review.
```

### 3.1 T+0 — Handover

The full script is in `HANDOVER-SCRIPT.md`. Summary:

- **Timing:** while the customer is paying or signing, **before** they walk out. Not after.
- **Who:** the person who did the work, or whoever is at the till. Not "someone will send
  you a link".
- **Medium:** spoken, plus a **paper card** handed over. Never a QR the customer has to scan
  while their car is being worked on (`reviews.ts` rule 1).
- **Duration:** 30 seconds. If it takes longer than 45 seconds, it is a pitch, not an ask.

### 3.2 T+2h — the message

**SMS** (`GBP-LISTING.md` §6, template key `copy.ts` → `SMS_TEMPLATES.REVIEW_REQUEST`):

```
EYG Tire: thanks for coming in today. A Google review helps us more than
anything: {{url}} Reply STOP to opt out.
```

⚠️ **The `{{url}}` is the short review URL from §1.1 step 4.** Until it exists, it is the
maps-search fallback sentence, in full, never a broken short link.

**Messenger** — slightly warmer, because Messenger is a conversation and SMS is a receipt:

```
Salamat sa pagbisita kanina, {{first name}}.

Kung Okay sa amin, tulong lang kami sa isang maliit na Google review.
Kung may kulang, sabihin mo lang dito — ayusin namin. Walang pressure.

{{url}}
```

**Rules on both:**

| Rule | Why |
| --- | --- |
| 🚫 **Never to a customer with an unresolved complaint** | `GBP-LISTING.md` §6. Fix it first, then ask — or don't ask. |
| 🚫 **Never a promo, an offer, or a cross-sell in a review message** | It turns a favour into a marketing blast. |
| **Only to a number that opted in.** | 🚫 **Never send a promotional SMS to someone who has not opted in** (`VOICE-AND-TONE.md` §5.4). The consent record is itself personal information and must be evidenced (`legal-compliance-ph.md` §3). |
| **`Reply STOP to opt out`** on the SMS, always. | |
| **One message. Not two channels for the same job.** | SMS *or* Messenger, whichever they used to book. |

### 3.3 T+7d — the follow-up

**Only if there is still no review.** Silence after one ask is the correct customer
experience, and a second ask on day 3 is the thing that makes a review feel like a debt.

```
Hi {{first name}} — {{ mechanic }} here from EYG Tire.

Nag-aalala lang kami kung may napindot ka noon. Kung Okay sa amin, isang
Google review lang: {{url}}. Kung hindi, okay lang — walang problema.

{{url}}
```

*(Small — just checking you tapped it if you had a minute. If you were happy with us, one
small Google review: {{url}}. If not, all good — no problem.)*

| ✅ Send the follow-up when | 🚫 Never send it when |
| --- | --- |
| The customer replied positively at handover | There is an unresolved complaint |
| The job was a straightforward completion | They already left a review |
| It was a high-value job (tyres, brakes, battery) | They opted out |
| | The first message already got no response *and* there is a sign they are annoyed |

### 3.4 The counter / Facebook public ask

One post, roughly monthly, not a daily nag. `CONTENT-CALENDAR.md` schedules it at D47 and
D81.

```
Salamat sa mga napunta sa amin.

Kung may minute kayo, isang Google review ang malaking tulong sa amin. Hindi
man lang kami malaki, pero marami sa Balanga ang nakakakita sa reviews.

Kung maganda ang inyo — sulat lang. Kung may kulang — sulat din. Kasi ang
totoo lang namin ang kailangan, at kung mali kami, ayusin namin.

Walang pressure, walang filter. Salamat.
```

**The line that makes this post work: *"Kung maganda ang inyo — sulat lang. Kung may kulang
— sulat din."*** A review request that admits it wants the bad ones is the only one a
price-conscious local will believe.

---

## 4. Replying to reviews — the half that is skipped

> **A review with no reply is worth less than no review at all.** It reads as *"we put it
> up and walked away."*

### 4.1 Reply to every one, inside 48 hours

### 4.2 The reply shape

| Step | Content | Length |
| --- | --- | --- |
| 1 | **Their name.** | |
| 2 | **Their specific thing.** Quote one detail from the review. A reply that does not mention what they actually wrote is visibly a template. | 1 sentence |
| 3 | **What we did about it**, if there was a problem. | 1–2 sentences |
| 4 | **The invite.** | 1 short sentence |

### 4.3 The 3-star and 1-star reply

**Publish the bad review.** `reviews.ts` placeholders reserve a slot for a genuine 3- or 4-star
and say explicitly: *"A shop that only publishes 5-star reviews reads as suspicious. Do not
seed a fake 3-star review — wait for a real one."*

**Never argue. Never explain a policy. Never mention a price in public.**

| ✅ Reply like this | ❌ Never |
| --- | --- |
| *"Salamat, Mara. Sinabi mo na sa Facebook na humihingi ka ng quote bago magpa-align — tama ka, ganon namin ginawa. Kung kailangan mo ulit, sabihin mo."* | *"We do not offer discounts on alignment. Our pricing is posted and we stand behind it."* |
| *"Salamat sa feedback mo. Hindi namin naipaliwanag nang maayos ang last visit — pasensya na. Nakipag-ugnayan ka na namin noong [date]. Kung hindi pa ayos,.reply lang dito."* | *"This appears to be a misunderstanding. Our records show..."* |
| *"Salamat, Tino. Yung pang 2nd brake pad, ginawa namin nang libre. Pasensya na sa tanong."* | *"We've been in business for X years and have never had a complaint."* 🚫 also an unverifiable year claim |

**Public rule: never discuss a price, a discount, or a dispute in a public reply.** Move it
to Messenger, then to the phone. A public argument about money is the fastest way to lose a
local search ranking.

---

## 5. The question that shapes the review

**Do not ask for a rating. Ask a question that produces content.**

The customer's answer becomes the review. The mechanic asks it at handover while pointing
at the actual work.

| Instead of | Ask | What the review becomes |
| --- | --- | --- |
| "How were we, 1–5?" | **"Ano ang pinaka-nakatulong sa'yo sa amin?"** *"What helped you most?"* | A specific, positive, specific-content review |
| "Would you recommend us?" | **"Ano yung saan mo kami nire-recommend sa kaibigan mo?"** *"What would you tell a friend about us?"* | The exact language for `bring-a-neighbour` |
| "Can I get five stars?" *(banned)* | **"Kung Okay ka, tulong lang kami sa isang maliit na review."** | Whatever they actually experienced |

**This is why handover beats email**, and §7 is the single-paragraph answer the brief asks
for.

---

## 6. Logging — the part that turns reviews into an asset

`reviews.ts` rule 4: *"Log the name, date, service and the exact words. Keep the raw
source."*

| Field | Why |
| --- | --- |
| Date, customer name, vehicle, service | Joins the review to a real job record |
| **The exact words**, unedited | A paraphrase is not evidence of consent, and a paraphrase is not a quote |
| **The raw source** — a screenshot, the Google URL, the date | 📌 `legal-compliance-ph.md` §5: the record is 5 years' worth of evidence. A review with no source is a review you cannot verify |
| **Consent to republish** — a separate explicit yes/no | §2.4. **Two consents, not one.** |
| Which mechanic did the work | Feeds the "Mechanic of the Month" content at `CONTENT-CALENDAR.md` D33 |

**Once a quarter:** the owner reads every review in a customer's own words. The phrases they
reuse are the shop's real marketing copy. "Tinignan nila yung old tire" beats anything
written in an office.

---

## 7. Why asking at handover works better than asking by email

**One paragraph, as asked:**

> Because conversion is a function of friction and of timing, and neither favours email. At
> handover the customer has just physically experienced the outcome — the car is clean, the
> old tyre is in their boot, the number on the receipt is the number they agreed to — and
> they are standing in front of the person who did the work, so the ask is thirty seconds of
> talking to a human who is already being given a favour, which is why it sounds like a
> favour and not a transaction. An email arrives days later, when the memory has faded to
> "some place I went", it competes with every other unread message in the inbox, and it can
> only be actioned on a laptop rather than the phone already in the customer's hand. It also
> silently excludes everyone who did not leave an email address, which in a shop where the
> top-of-funnel is a phone call is most of them. And handover is the only moment at which the
> mechanic can *point at the thing* while asking — "we showed you the old tyre, can you say
> that?" — which is how a review acquires the one detail that makes it worth reading. A
> generic email request produces a generic review; a handover ask produces *"they showed me
> the tread depth and told me before they started"*, and that sentence is the entire reason
> a competitor with a lower price does not get the job.

---

## 8. The SOP — one page the shop can print

```
REVIEW SOP — EYG Tire & Auto Care

BEFORE YOU START
  [ ] Google Business Profile claimed, NAP verified, short review URL created.
      Until that is done, use the maps-search sentence. Never a broken link.

AT HANDOVER  (T+0)  — paper card + these words:
  "Salamat sa pagbisita. Kung maganda ang experience mo, isang maliit na
   review lang ang tulong para makita kami ng mga kapitbahay namin.
   Kung may kulang, sabihin mo lang dito — ayos lang kami. Walang pressure."

  Ask the question, not the rating:
  "Ano ang pinaka-nakatulong sa'yo sa amin?"

  [ ] EVERY customer. Including the annoyed one. ESPECIALLY the annoyed one.
  [ ] Something offered in exchange? NO. Not ever, not even a free wipe.
  [ ] Never say "five stars".
  [ ] Not if there is an unresolved complaint — fix it first, or do not ask.

AT +2 HOURS  — ONE message, SMS or Messenger (not both):
  "EYG Tire: thanks for coming in today. A Google review helps us more than
   anything: {{url}} Reply STOP to opt out."
  [ ] Not to anyone who opted out.
  [ ] No promo, no offer, no cross-sell in it.
  [ ] Not to a customer with an unresolved complaint.

AT +7 DAYS  — only if there is still no review:
  [ ] One message. Then stop. Never a third.

ALWAYS
  [ ] Reply to every review within 48 hours.
  [ ] Never argue in public. Never discuss a price in a public reply.
  [ ] Publish the 3- and 4-star ones. A perfect wall of 5s reads as bought.
  [ ] Republishing to the site or Facebook = a SEPARATE explicit consent.
  [ ] Customer asks for removal: remove it and stop asking.

NEVER
  [ ] "Only 2 left" / any countdowns / any invented scarcity
  [ ] "We're on the map" / "find us on Google" — as if that were a favour
  [ ] A reward, a discount, a priority slot
  [ ] A rating figure, a star average, or a review count that is not real
      (site.ts keeps ratingCount at 0 on purpose)
```

---

## 9. Owner-confirmation register

| # | Item | Status |
| --- | --- | --- |
| 1 | 🔴 **Google Business Profile claimed / verified** | 🚫 **TODO-VERIFY — BLOCKER.** Nothing in §3 ships before this. |
| 2 | 🔴 **Short review URL created** | 🚫 **TODO-VERIFY — BLOCKER** |
| 3 | GBP NAP matches `site.ts` exactly | 🚫 **TODO-VERIFY** |
| 4 | GBP opening hours match `BUSINESS_HOURS` | 🚫 **TODO-VERIFY** |
| 5 | The owner is genuinely willing to ask **every** customer | ⚠️ **OWNER COMMITMENT REQUIRED** — this is an operating rule, not a slogan. `reviews.ts` flags it the same way. |
| 6 | Whether reviews may be republished on the site / Facebook | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 7 | Whether a phone number is collected at handover for the follow-up | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. **Data Privacy Act: the consent record is itself personal information.** |
| 8 | +26 reviews / 90 days | ⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION.** `CONTENT-CALENDAR.md` §9 |
| 9 | Who replies to reviews, and how fast | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 10 | The printed handover card design and where it is printed | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. One of the few things worth spending money on. |

---

## 10. Related

`HANDOVER-SCRIPT.md` (the 30-second conversation) · `../../src/content/marketing/reviews.ts`
(the `QUOTE_SENTINAL` guard and `REVIEW_REQUEST_HANDOVER`) ·
`../marketing/GBP-LISTING.md` §6 · `../marketing/PROMO-PLAYBOOK.md` §8, §9 ·
`../marketing/CONTENT-CALENDAR.md` D47, D81, D42 · `../brand/VOICE-AND-TONE.md` §5.4 ·
`../research/legal-compliance-ph.md` §2, §3 (consent must be evidenced)
