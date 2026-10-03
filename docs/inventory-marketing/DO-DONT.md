# DO / DON'T — inventory marketing

> **Owner:** A6 · marketing & merchandising · **Status:** the governing ban list
> **Read this before writing any campaign, any counter line, or any component that reads
> `Product` or `StockLevel`.**
> **If a rule here and a rule in `PROMO-PLAYBOOK.md` disagree, this file is the stricter
> one and this file wins.**

---

## 0. The three that would end the shop

Not stylistic. These three, and nothing else on this page, are worth re-reading.

| # | The rule | Why it is first |
| --- | --- | --- |
| **1** | 🚫 **Never market a product the system says is short.** | A customer who drives to EGSA Fourlanes for a tyre the website said was there is the exact failure this entire inventory build exists to prevent. Every other mistake on this page is a bad afternoon. This one is the reason the project exists. |
| **2** | 🚫 **Never publish a price at or below `costPrice` without the owner approving that specific SKU, in writing, before it goes up.** | It is the shop's margin, and the margin *is* the business. Nobody — not a mechanic, not a campaign builder, not an urgency — gets to decide this. |
| **3** | 🚫 **Never sell a tyre without disclosing its age if it is in band C or D.** | One customer with a photo of a 2019 DOT code is worth more than every clearance sale combined. |

---

## 1. Campaigns — the DO

| ✅ | Why |
| --- | --- |
| **Drive every campaign from a field, not from a spreadsheet.** | A spreadsheet rots the day a tyre sells. `STOCK-CAMPAIGNS.md` §6. |
| **End a campaign on a field.** `isLow` flips, `canFulfil` flips, `available` hits 0. | Nobody has to remember to take a post down. `STOCK-CAMPAIGNS.md` §1.5 |
| **Publish the complete installed price — tyre + mounting + balancing + valve — in one number.** | `legal-compliance-ph.md` §4.4. It removes the industry's defining accusation. |
| **Name the season, not the discount.** "Rainy Season Safety Bundle", not "Save 30%". | `PROMO-PLAYBOOK.md` §3. |
| **Put the discount in the labour, not in the tyre.** | Labour goes to 25% and is almost pure margin. A 10% tyre discount costs 13 points of it. `TYRE-CLEARANCE-PLAYBOOK.md` §6.1 rule 5. |
| **Lead a clearance post with the DOT year, then the discount.** | A disclosure is not something a customer learns to wait for. A number is. |
| **Say "in stock now, more on order" when `isLow` is true and `available > 0`.** | True, useful, and it costs nothing in margin. `STOCK-CAMPAIGNS.md` §1.3. |
| **Use the confidence the system actually has.** `canFulfil === true` is a fact. Say it. | The strongest inventory-truth sentence a tyre shop has. |
| **Run one category discount at a time.** | `PROMO-PLAYBOOK.md` §7. Two tyre offers is a guessing game at the counter. |
| **Give the counter board a real lever that is not a discount.** A free pressure check, a rotation, a rim wipe. | Costs almost nothing, visible to the customer, breaks no published price. `PROMO-PLAYBOOK.md` §7. |
| **Ask every customer for a review, at handover, and offer nothing.** | The highest-ROI thing in this build. `REVIEW-SOP.md`. |
| **Draft the post-expiry copy before the campaign launches.** | `PROMO-PLAYBOOK.md` §9. The step every shop skips and every customer notices. |

---

## 2. Campaigns — the DON'T

| ❌ | Why |
| --- | --- |
| 🚫 **A product with `isLow === true` in any campaign, post, card, board, or bundle** | §0 item 1 |
| 🚫 **A countdown. Any countdown. Anywhere.** Not on the site, not on a Facebook post, not in an SMS. | `PROMO-PLAYBOOK.md` §6. A countdown that resets is a lie, and Facebook audiences in this market recognise it immediately. |
| 🚫 **"3 people are viewing" / "12 people booked today" / "47 people are looking at this"** | There is no such counter in the system. It is fabricated, and in a town this size the customer knows the shop's real numbers. |
| 🚫 **"Only 2 left!"** — on any public surface | A count is true for an instant and lives for a week. **True only at the counter, on the phone, to someone in the shop.** |
| 🚫 **"Selling fast!" / "Hurry" / "Last chance" / "Grab it"** | Manufactured urgency. `PROMO-PLAYBOOK.md` §8. |
| 🚫 **"While stocks last" when `available === 0`** | There are no stocks to last. |
| 🚫 **A discount paired with a scarcity message** | Double-counting. It destroys both signals and it pays twice for the same unit. `STOCK-CAMPAIGNS.md` §1.3. |
| 🚫 **Silently extending a published `endsAt`** | It teaches customers that EYG's dates mean nothing. Which costs more than the campaign earned. |
| 🚫 **Recycling the expired "First 20 customers get FREEBIES" post** | It expired 2025-12-09. Re-running it is a false "current offer" — and a self-inflicted comment disaster. `competitors.md` §6 item 8. |
| 🚫 **A clearance that teaches the customer to wait** | `TYRE-CLEARANCE-PLAYBOOK.md` §6. One discount event per SKU per 90 days. |
| 🚫 **A stale post.** If the last unit sold, the post goes **the same day.** | "A stale clearance post costs more trust than it ever earned." |

---

## 3. The counter — the DO

| ✅ | Why |
| --- | --- |
| **Read the DOT code off the sidewall** and write it on the job order. Do not copy it from the record. | The tyre is the truth. `TYRE-CLEARANCE-PLAYBOOK.md` §1.4. |
| **Disclose the year before the price.** | Order is the difference between consent and disclosure-after-the-fact. |
| **Quote the complete installed price.** | §4.4. |
| **Show the old tyre.** "Ito yung luma, ikaw na bahala." | The best trust device in the trade, and it costs nothing. |
| **Say the number out loud, every time.** | "We tell you the price before we start" is an **operating rule**, not a slogan. `PROMO-PLAYBOOK.md` §11 item 4. |
| **When we are short: "Wala sa rack. Ordering ko, sabihin ko sa 'yo."** Then route to `PREORDER-FLOW.md`. | The reorder and the sale are the same conversation. |
| **Ask for the review on every job**, with the card in the hand. | `REVIEW-SOP.md` §2.1. |

---

## 4. The counter — the DON'T

| ❌ | Why |
| --- | --- |
| 🚫 **"Baka may konti pa, try mo na."** | That is the oversell, spoken out loud. The single sentence this build exists to make impossible. |
| 🚫 **Improvising a discount to close a sale** because the shop across the road will | `PROMO-PLAYBOOK.md` §7 — "the counter deal must be authorised, not improvised." Give the team the rim wipe instead. |
| 🚫 **Selling a tyre below cost** | §0 item 2. Not even "just this once, just to be nice". |
| 🚫 **"Safe for 2 more years" / "as good as new" / "factory seconds"** | A lifespan claim is an **express warranty**. "As good as new" is unverifiable. `TYRE-CLEARANCE-PLAYBOOK.md` §5.5. |
| 🚫 **Silently disposing of the customer's old tyre** | It is their property. It goes back, or disposal is agreed and priced in advance. §4.4. |
| 🚫 **Adding a repair the customer did not approve** | "If the tyre is damaged beyond use, **say so and stop**." §4.4 |
| 🚫 **Asking only the customers who were happy** | Google policy violation. Gets the profile killed. `REVIEW-SOP.md` §2.1. |
| 🚫 **Offering anything for a review** — not a discount, not a free wipe, not a priority slot | Google policy. |
| 🚫 **"Five stars, please."** | Google policy. And it contradicts the shop's own claim. |
| 🚫 **Arguing with a customer in a public review reply, or discussing a price in public** | Move it to Messenger, then to the phone. |
| 🚫 **"Genuine parts only" / "certified technicians" / "authorised dealer"** | `competitors.md` §6 items 1–3. **Say the part brand and model you fitted instead** — that is verifiable, and it is what the shop already does. |
| 🚫 **"We are the only tyre shop on EGSA Fourlanes"** | 🚫 **Demonstrably false.** Jed-M Tires & Batteries & Service Center is at *4 Lanes Egsa, Tuyo* — same street. `competitors.md` §1.1. **Never say this in any form.** |
| 🚫 **Naming or disparaging a competitor** | In a market of 138 businesses that is a customer-facing insult and a defamation exposure. `competitors.md` §6 item 13. |
| 🚫 **"24/7 roadside assistance"** | 🚫 `site.ts` has `roadsideAssured: false`. There is no evidence for it. **The highest-risk unverified claim in the whole project.** |

---

## 5. The component — the DO

| ✅ | Why |
| --- | --- |
| **Filter every payload at the server**, before it leaves the process. Not in the component. | A cost field that reaches the client has already leaked. `legal-compliance-ph.md` §4.2. |
| **Return a derived 3-state, never a raw count.** | `CUSTOMER-BROWSING-UX.md` §3. |
| **Compute availability in the product's own unit.** `unit === "PAIR"` is "in stock" only at `available >= 2`. | `UNITS` is in the contract. This is the most-missed detail in a catalogue build. |
| **Expose `StockLevel.updatedAt`** and render "stock checked [time]". | `cycleCountDays` means it is not live. Say what is true. |
| **Re-check `canFulfil` at the moment of the interaction**, not at page load. | A booking is only promised when `canFulfil` is true. |
| **Refuse to price a product whose `costPrice` is 0.** | `schema.prisma`: `costPrice 0 = unknown`. A margin from an unknown cost is a fiction. |
| **Ship all four states.** Skeleton, success, empty, error. The error state shows a tap-to-call number. | `docs/AGENT-BRIEF.md`. A catalogue that 500s silently fails the shop's only differentiator. |
| **Put the availability state in words, never colour alone.** | WCAG 2.2 AA, 1.4.1. It also fails a tyre customer in the sun on a phone. |
| **Route `available === 0` to the pre-order flow.** | A stockout is a lead with a date attached. `PREORDER-FLOW.md`. |

---

## 6. The component — the DON'T

### 6.1 Never expose these on a customer surface

| Field | Why |
| --- | --- |
| 🚫🚫 `costPrice` | The #1 cost-leak risk. A8 will test for it. |
| 🚫🚫 `marginPct` | **Derived from `costPrice`. Filtering only `marginPct` leaks the cost by division.** |
| 🚫🚫 `onHand` | Includes `reserved` — stock promised to someone else. |
| 🚫🚫 `reserved` | **Exposes a customer's booking to the public.** |
| 🚫 `isLow` | Internal replenishment. Publishing it is how fake urgency gets born. |
| 🚫 `isOversold` | Should never be true. If it is, it is a loud internal alarm, not a customer state. |
| 🚫 `supplierName`, `supplierId` | Tells the customer to go direct — **and** proves nothing, since the evidenced brand status is a dealer-locator record, not authorisation. |
| 🚫 `sku`, `barcode` | Internal structure. |
| 🚫 `reorderPoint`, `reorderQty` | A free map of the shop's weaknesses for a competitor. |
| 🚫 `minSellPrice` | 🔴 **It is literally the shop's floor price.** |
| 🚫 `shelfLifeDays`, `cycleCountDays`, `notes` | Internal. **`notes` is the highest leak risk in the model** — a note reading *"good margin, push this"* is a business document. |
| 🚫 `createdAt`, `updatedAt` | Noise. `updatedAt` leaks operational cadence. |
| ⚠️ `dotCode` | 🚫 On anything except a **disclosed clearance line**, where only the **year** is shown in words. |
| ⚠️ `ageDays`, `isNearExpiry` | Only where the disclosure is already made. Never as urgency. |

### 6.2 Never build

| ❌ | Why |
| --- | --- |
| 🚫 **A pre-order that creates a `Reservation` or a `StockMovement`** | It breaks the invariant `available = onHand − reserved`. `PREORDER-FLOW.md` §1.1. **This is the most expensive bug this build could ship.** |
| 🚫 **A pre-order that increments `onHand` when an order is placed** | The system would believe a tyre is on the shelf that is 80 km away, and say "Ready to fit". 🔴 **The worst failure mode in the whole project.** |
| 🚫 **A booking `CONFIRMED` on a blocking part that is short** | A4's rule. A pre-order cannot make `canFulfil` true. |
| 🚫 **A stock count shown to a customer.** Ever. | Trains customers to wait for scarcity. |
| 🚫 **A "last chance" / "ending soon" label computed from a date that gets rolled** | Breaks a promise that was public. |
| 🚫 **A live "3 people viewing" counter** | Fabricated. There is no data behind it and there never should be. |
| 🚫 **A `README` or a doc file** | Not part of this build. |
| 🚫 **Placeholder data shipped as if real** — `TODO`, `Lorem`, `example.com`, `href="#"` | `INVENTORY-AGENT-BRIEF.md` §4. |
| 🚫 **Optimistic UI on a stock write** | A3's rule, and it is right: the shelf is the truth and it is on the server. |
| 🚫 **Clamping a negative anywhere** | Refuse, never clamp. Every time. |

---

## 7. The review engine — the bans

The highest-ROI thing in the build has the strictest rules, because the penalty is the
whole asset.

| ❌ | Why |
| --- | --- |
| 🚫 **Offering anything in exchange for a review** | Google policy. Can cost the profile. |
| 🚫 **Asking for five stars, or "a 5-star review"** | Google policy violation. Gating. |
| 🚫 **Asking only the happy ones, or filtering on "were they okay?"** | Google policy. The classic profile killer. |
| 🚫 **Gating — "review us and we'll give you a discount"** | Same. |
| 🚫 **Sending a review request to a customer with an unresolved complaint** | Fix it first, or do not ask. |
| 🚫 **Republishing a review to the site or Facebook without a separate explicit consent** | A Google review is public on Google. That is a second act of consent. |
| 🚫 **Only publishing the 5-star ones** | A perfect wall of 5s reads as bought. **Publish the 3s.** |
| 🚫 **Arguing, or discussing a price, in a public reply** | A public argument about money loses local search rank. |
| 🚫 **A star rating, a review count, or "rated 4.9 by 200+ customers" on any surface** | `site.ts` deliberately has `ratingCount: 0` so `AggregateRating` renders nothing. **That guard is load-bearing. Do not "fix" it.** |
| 🚫 **Asking by email only** | Handover beats email. `REVIEW-SOP.md` §7. |
| 🚫 **A QR code as the only way to review, while the car is being worked on** | `reviews.ts` rule 1. |
| 🚫 **Sending a review request to a URL that 404s** | 🔴 **THE GBP IS NOT CLAIMED.** `site.ts`: `social.googleBusiness: null`, `[UNVERIFIED]`. Use the maps-search sentence until the short URL exists. |

---

## 8. Placeholder discipline

| Convention | Meaning |
| --- | --- |
| `⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION` | A number or a window a marketer produced. **Never publish it.** Matches `PROMO-PLAYBOOK.md` §11 and `promotions.ts`. |
| `🚫 TODO-VERIFY` | A fact the owner must check. **Never assert it, never publish it.** |
| `NOT VERIFIED` | Research could not confirm it. **Do not fill the gap.** `competitors.md` §0. |
| `⚠️ GAP — reported to the orchestrator` | A missing model or contract field. **Reported, never worked around in someone else's file.** |

**Every peso figure, every margin, every lead time, every window and every campaign depth
in `docs/inventory-marketing/` is one of the four above.** None of them is a researched
fact about EYG. They are a starting point for a conversation with the owner.

---

## 9. The one-page summary

```text
╔══════════════════════════════════════════════════════════════╗
║  EYG INVENTORY MARKETING — THE WHOLE THING IN ONE PAGE        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. THE SHELF IS THE INPUT TO THE CAMPAIGN.                   ║
║     isLow === true → out of every campaign. Always.           ║
║                                                              ║
║  2. BELOW COST IS THE OWNER'S DECISION, IN WRITING,          ║
║     PER SKU, BEFORE IT IS PUBLISHED.                          ║
║                                                              ║
║  3. NO TYRE IS SOLD WITHOUT ITS YEAR DISCLOSED                ║
║     IF IT IS AGED. ORDER: YEAR, THEN PRICE.                   ║
║                                                              ║
║  4. NO COUNTDOWNS. NO RESET TIMERS. NO "3 PEOPLE VIEWING".    ║
║                                                              ║
║  5. NO STOCK COUNTS ON A PUBLIC SURFACE. SHOW A STATE.        ║
║                                                              ║
║  6. costPrice / marginPct / onHand / reserved / minSellPrice  ║
║     NEVER LEAVE THE SERVER.                                   ║
║                                                              ║
║  7. A PRE-ORDER IS NOT A RESERVATION.                         ║
║     It creates no hold and no stock. Ever.                    ║
║                                                              ║
║  8. "WE HAVE YOUR SIZE" IS THE STRONGEST SENTENCE            ║
║     THIS SHOP HAS. EARN IT BEFORE YOU SAY IT.                ║
║                                                              ║
║  9. ASK EVERY CUSTOMER FOR A REVIEW AT HANDOVER.              ║
║     OFFER NOTHING. ASK FOR AN HONANT ONE.                     ║
║     (Yes: honest. No: "honest" is the word. Say it right.)    ║
║                                                              ║
║ 10. EVERY NUMBER IS SUGGESTED UNTIL THE OWNER SIGNS IT.       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 10. Related

`TYRE-CLEARANCE-PLAYBOOK.md` · `PREORDER-FLOW.md` · `STOCK-CAMPAIGNS.md` ·
`SEASONAL-PLAN.md` · `CUSTOMER-BROWSING-UX.md` · `REVIEW-SOP.md` · `HANDOVER-SCRIPT.md` ·
`../marketing/PROMO-PLAYBOOK.md` · `../marketing/GBP-LISTING.md` · `../brand/DO-NOT.md` ·
`../research/competitors.md` · `../research/legal-compliance-ph.md` · `INVENTORY-AGENT-BRIEF.md`
