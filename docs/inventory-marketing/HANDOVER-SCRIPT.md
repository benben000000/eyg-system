# HANDOVER SCRIPT — the 90 seconds that decide the review

> **Owner:** A6 · marketing & merchandising · **Status:** ready for owner sign-off
> **For:** the person handing the keys back. Mechanic, bay staff, whoever is at the till.
> **Companion docs:** `REVIEW-SOP.md` (the policy) · this file is the **script**

---

## 0. Print this page. That is the whole deliverable

This is not a document to study. It is a card to keep next to the till, and it is written
in the words you actually say out loud.

---

## 1. When

| | |
| --- | --- |
| **When** | While the customer is **paying or signing**. Before they pick up their keys. |
| **Not** | After they have left. Not by email the next day. Not on the way out the door. |
| **How long** | **30 seconds.** The whole conversation. If you are still talking at 60, it has become a pitch. |
| **Who asks** | The person who did the work, or whoever is at the till. **Never "someone will send you a link."** |
| **How** | Spoken, face to face, **plus the paper card in their hand**. |

### 1.1 Why the paper card, and not a QR code

`reviews.ts` rule 1 says it directly: *"Ask at handover, on a paper card or by SMS, **never
by a QR code the customer has to scan while their car is being worked on.**"*

A customer standing at a counter with a QR code and a phone out is a customer who is now
**doing something else**, at the exact moment you were relying on their goodwill. A card in
the hand is a card they deal with **on the drive home**, when they are relaxed and the
memory of good service is freshest.

**Card in the hand. QR optional, never the only route.** If the shop prints a QR, it prints
the words as well — so that a customer who cannot scan, or whose phone is dead, or who is
in a hurry, still gets there.

---

## 2. The card

### 2.1 Front

```text
┌─────────────────────────────────────────┐
│                                         │
│   Kumusta? Kung Okay sa amin, tulong     │
│   lang kami sa isang maliit na review.   │
│                                         │
│   Kung hindi Okay, sabihin mo lang —     │
│   ayos lang namin. Salamat!              │
│                                         │
└─────────────────────────────────────────┘
```

> *"Kumusta? Kung Okay sa amin, tulong lang kami sa isang maliit na review sa Google.
> Kung hindi Okay, sabihin mo lang — ayos lang namin. Salamat!"*

### 2.2 Back

```text
┌─────────────────────────────────────────┐
│                                         │
│   Scan the code, or search:              │
│   "EYG Tire & Auto Care"                 │
│   on Google Maps.                        │
│                                         │
│   Tap "Write a review".                  │
│                                         │
│   No filter, no script — just what you   │
│   actually experienced. Thank you.       │
│                                         │
│   [ QR ]                                 │
│                                         │
└─────────────────────────────────────────┘
```

### 2.3 🚫 The card must not contain

| Never | Why |
| --- | --- |
| A star rating, or "5 stars please" | Google policy. Gating. |
| "We're the only tyre shop on EGSA" | 🚫 **False.** Jed-M Tires & Batteries & Service Center is at *4 Lanes Egsa, Tuyo* — the same street (`competitors.md` §1.1). Never print this. |
| A star count, a review count, or a rating | `site.ts` keeps `ratingCount: 0` deliberately. Do not print a number that is not real. |
| Any phone number other than the real one | 🚫 **TODO-VERIFY** — `site.ts` has two numbers (`+639627176894` primary, `+639985323508` secondary on the EYG TIRE TRADING arm). Confirm which one goes on the card. |
| "Free service if you review" | 🚫 Google policy. Even a free wipe. |

⚠️ **SUGGESTED — REQUIRES OWNER CONFIRMATION:** the card's design, size, print run and
where it lives. It needs to be on the counter and it needs to be *handed over*, not left in
a holder.

---

## 3. The script

**Four beats. Learn beats 1 and 4; the middle two are already the shop's habit.**

### 3.1 Beat 1 — close the job properly *(the shop already does this)*

```
"Bay [2], [plate]. Tapos na yung [service] — [x] hours.
Nasa taas yung [number]. Iyan yung pinag-usapan natin, walang dagdag."

"Bay 2, [plate]. The [service] is done — [x] hours.
The [number] is on top. That's what we agreed, nothing added."
```

**Always say the price out loud.** `legal-compliance-ph.md` §4.2: *"disclose every charge in
the job order before work begins."* The shop's own claim — *"We tell you the price before we
start"* — is flagged in `PROMO-PLAYBOOK.md` §11 as an **operating rule, not a slogan.** Say
the number every time.

### 3.2 Beat 2 — show the evidence *(the differentiator, and it is free)*

```
"Ito yung luma. Ikaw na bahala — gusto mo ba i-strap?"

"Here's the old one. It's yours — do you want to strap it?"
```

**This is the industry's best practice and nobody local does it.** `legal-compliance-ph.md`
§4.4: *"Show the customer the old tyre. Standard practice in the industry. It is also the
best trust device available and costs nothing."* And `social.ts` `dayOffset: 2` — *"we show
you the old part"* — is already one of the shop's trust pillars.

**On a clearance tyre, add the disclosure — one extra sentence, no more:**

```
"Made 20XX. I show you yung DOT — nasa sidewall yan.
Mas luma, kaya mas mura. Same ang fitting."

"Made 20XX. Here's the DOT code — it's on the sidewall.
Older, so cheaper. Same fitting."
```

📌 **The disclosure comes BEFORE the price, and before the review ask.** Order is not a
detail: it is the difference between consent and a complaint. Full rules in
`TYRE-CLEARANCE-PLAYBOOK.md` §5.

### 3.3 Beat 3 — set the next date *(a service, not a pitch)*

```
"Next mo around [month]. Sabihin mo lang, i-book ko na."

"Your next one's due around [month]. Just tell me, I'll book it."
```

**Skip this entirely if the customer is in a hurry.** A person on EGSA Fourlanes at 5pm
wants their car, not a relationship. Read the moment.

### 3.4 Beat 4 — the ask *(30 seconds, this is the whole thing)*

```
"Salamat sa pagbisita. Kung maganda ang experience mo, isang maliit na
review lang ang tulong para makita kami ng mga kapitbahay namin.
Kung may kulang, sabihin mo lang dito — ayos lang kami. Walang pressure."

"Thank you for coming in. If your experience was good, one small review
really helps so your neighbours can find us. If something was lacking, just
say it here — that's fine. No pressure."

[hand over the card]
```

### 3.5 Then — ask a question, not a rating

This is the one mechanic-level instruction that produces a review worth reading.

> ### 🚫 Never: "How were we, 1 to 5?" · "Can you give us five stars?"
>
> ### ✅ Ask: **"Ano ang pinaka-nakatulong sa'yo sa amin?"**
>
> ### ✅ *"What helped you most about us?"*

Why: the customer's answer becomes the content of the review. Ask for a rating and you get
a rating — which reads as bought and carries no information. Ask *what helped* and you get:

> *"Yung sinabi niya ng price before mag-start."*
> *"Nagpakita ng luma na tire."*
> *"Hindi na ako tinutulong na magbayad ng labis."*

Those three sentences are worth more than the shop's entire Facebook page, and each one is
only available if the mechanic asked the right question while pointing at the actual work.

**If they say something is wrong: stop, write it down, fix it or explain it, and then ask
the review only if the outcome is genuinely resolved.** An unresolved complaint is the one
case where you do not send the T+2h message. (`REVIEW-SOP.md` §3.2.)

---

## 4. What to say if they say no, or shrug

| They say | Say | Note |
| --- | --- | --- |
| "Ako na lang, bayad muna." *"Me first, payment."* | **"Sige, salamat."** *(hand over the card anyway)* | A shrug is not a no. They may do it on the drive home. |
| "Busy lang." *"Busy."* | **"No problem, sir. Ito lang yung card."** | Do not push. Rule 1 says ask everyone — **not** pester. |
| "Hindi ako nag-review, nakakalito." *"Never review, it misleads."* | **"Fair. Salamat sa sinabi mo."** | Say nothing else. Log it. They said no and they mean no. |
| "Bakit? Anong meron?" *"Why? What's in it for you?"* | **"Wala, kasi wala pa kaming review. Para makita kami ng kapitbahay natin."** *"Nothing — we just have no reviews yet. So our neighbours can find us."* | **The honest answer is the only answer.** Do not invent a benefit for them. |

### 4.1 🚫 Never, in response to any of these

| Never | Why |
| --- | --- |
| "Pareho lang naman, isang click." *"It's one click."* | It makes the ask feel like a burden. |
| "Pera na 'yan, tulong ka." *"You'll get paid."* | 🚫 Offering anything for a review. Google policy. |
| "Para sa kapitbahay mo." *"For your neighbours."* — **as a guilt lever** | It is fine as a *reason* (`REVIEW-SOP.md` §3.4). It is not fine as a pressure. Say it once, warmly, then stop. |
| "Ako na bahala sa rating." *"I'll handle the rating."* | That is asking for five stars. Banned. |
| Following up twice about it | One ask at handover. That is the ask. |

---

## 5. The card handoff — a 3-second physical detail that matters

> **Put it in their hand. Do not put it on the counter.**

A card left on a counter is a card that never leaves the shop. A card handed over is
usually in a pocket before they reach the car — and a pocket is a place a review request
survives for 40 minutes of driving time.

If they take it: **say nothing more.** Walk them out.

---

## 6. After they leave — two things, 60 seconds

```
[ ] Log it: date, name, vehicle, service, and the exact words they used.
    Not a paraphrase. THE WORDS.  (reviews.ts rule 4)
[ ] Unresolved anything? → T+2h message is CANCELLED. Fix it first.
```

If you logged an unhappy comment and fixed it, **that is the strongest review request you
will ever have** — because when you message them a week later with the fix, they have
already been treated better than the last shop would have treated them.

---

## 7. The whole thing, on one card

```text
┌──────────────────────────────────────────────────────────┐
│  AT HANDOVER — 30 seconds, every customer, no exceptions  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. CLOSE IT                                              │
│     "Bay 2, [plate]. Tapos na. [Number]. Walang dagdag."  │
│                                                          │
│  2. SHOW IT                                               │
│     "Ito yung luma. Ikaw na bahala."                      │
│     Clearance tyre only: "Made 20XX. Yan yung DOT."       │
│                                                          │
│  3. NEXT DATE (skip if they're in a hurry)                │
│     "Next mo around [month]."                             │
│                                                          │
│  4. ASK                                                   │
│     "Kung maganda ang experience mo, isang maliit na      │
│      review lang ang tulong para makita kami ng mga       │
│      kapitbahay namin. Kung may kulang, sabihin mo lang   │
│      dito — ayos lang kami. Walang pressure."             │
│                                                          │
│     [ GIVE THEM THE CARD ]                                │
│                                                          │
│  5. THE QUESTION, NOT THE RATING                          │
│     "Ano ang pinaka-nakatulong sa'yo sa amin?"             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  NEVER: five stars · anything in exchange · only asking   │
│  the happy ones · a QR while the car is being worked on   │
├──────────────────────────────────────────────────────────┤
│  AFTERWARDS: log the exact words. 60 seconds. Done.       │
└──────────────────────────────────────────────────────────┘
```

---

## 8. The three objections that will come up in week one

| What the team will say | The answer |
| --- | --- |
| *"Sir, magagalit yung customer. Baka masira ang rating."* | *"Mas malala 'yon kung hindi natin aking may nagsabi. Ang masama, may maling rating tayo at walang reply. Lahat ng customer, tanungin."* — Asking only the happy ones is the thing that gets a profile killed. **Every customer. That is the rule.** |
| *"Sir, ang busy, wala pong time."* | *"30 seconds. Yung card hawak mo na, ibibigay mo na lang. Hindi mo kailangang basahin ngayon."* — Thirty seconds at handover beats an email that never gets opened. |
| *"Sir, 'yung iba, di nila gagawa."* | *"Totoo. Pero kapag may nag-review na, 'yung iba na 'yung nagda-doubt. Ngayon wala pa tayo."* — And it works on the doubtful customer too, which is the one the shop is actually losing. |

---

## 9. Owner-confirmation register

| # | Item | Status |
| --- | --- | --- |
| 1 | 🔴 **Google Business Profile claimed, short review URL created** | 🚫 **TODO-VERIFY — BLOCKER.** Until then the card says *search "EYG Tire & Auto Care" on Google Maps*, not a broken link. `REVIEW-SOP.md` §1. |
| 2 | Which phone number goes on the card | 🚫 **TODO-VERIFY** — two numbers exist in `site.ts` |
| 3 | Card design, print run, and where it is kept | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION |
| 4 | Whether a QR is printed at all | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. **Never the only route.** |
| 5 | Whether a phone number is collected at handover for the T+2h / T+7d messages | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. **Data Privacy Act: the consent record is itself personal information and must be evidenced.** |
| 6 | The next-service-due date in beat 3 — where does it come from? | ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION. A rough month from `cycleCountDays` / service history is honest; a precise date from nothing is not. |
| 7 | The owner accepts the rule: **every** customer gets asked, including the annoyed ones | ⚠️ **OWNER COMMITMENT REQUIRED** — an operating rule, not a slogan |
| 8 | The "price before we start" promise | ⚠️ **OWNER COMMITMENT REQUIRED** — `PROMO-PLAYBOOK.md` §11 item 4 |

---

## 10. Related

`REVIEW-SOP.md` (the policy, the messages, the reply rules) ·
`../../src/content/marketing/reviews.ts` (`REVIEW_REQUEST_HANDOVER`, the `QUOTE_SENTINEL`
guard) · `../marketing/GBP-LISTING.md` §6 (the card, the script, the four rules) ·
`../marketing/PROMO-PLAYBOOK.md` §8, §11 · `TYRE-CLEARANCE-PLAYBOOK.md` §5 (the DOT
disclosure in beat 2) · `../brand/VOICE-AND-TONE.md` §2.5 (Filipino register), §5.5 (the
job card) · `../research/legal-compliance-ph.md` §4.4, §5
