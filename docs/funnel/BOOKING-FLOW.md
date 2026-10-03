# BOOKING FLOW — the 4-step scheduler

**Route:** `/book` · **Owner:** funnel agent (spec) · frontend-pages + backend-core (build)
**Contract:** `SlotQuery`, `SlotAvailabilityDto`, `CreateBookingInput`, `BookingDto`
**Config:** `BOOKING` in `src/config/site.ts` — `slotMinutes: 60`, `horizonDays: 60`,
`minLeadMinutes: 90`, `capacityPerSlot: 3` *(TODO-VERIFY)*, `breakWindows: 12:00–13:00`,
`holdMinutes: 10`, `maxServicesPerBooking: 8`, `referencePrefix: "EYG-"`

Steps: **1 Vehicle → 2 Services → 3 Date & Time → 4 Contact & Confirm**
Target completion: **under 60 seconds** on a mid-tier Android over 3G.
Nothing in steps 1–2 requires the network. Nothing in the flow requires an account,
a card, or a deposit.

---

## 1. Wireframes

### 1.1 Step 1 — Vehicle (mobile, 360 px)

```
┌────────────────────────────────┐
│ ☰  EYG            📞  Book     │  ← sticky header, 64px
├────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← progress bar, 4px, brand-500
├────────────────────────────────┤
│ Step 1 of 4 · Vehicle      25% │
│ What are we working on?        │
│ We use this to pick parts and  │
│ price. You can skip it.        │
│                                │
│ Year *                         │
│ ┌──────────────────────────┐   │
│ │ 2019                     │   │  ← inputmode=numeric
│ └──────────────────────────┘   │
│ Make *                         │
│ ┌──────────────────────────┐   │
│ │ Search make…          ▾  │   │  ← combobox, listbox popup
│ └──────────────────────────┘   │
│ Model *                        │
│ ┌──────────────────────────┐   │
│ │ Search model…         ▾  │   │
│ └──────────────────────────┘   │
│ › Not in the list? Enter it    │  ← tertiary, ESCAPE HATCH
│                                │
│ Variant (optional)             │
│ ┌──────────────────────────┐   │
│ │ e.g. 1.5 CVT              │   │
│ └──────────────────────────┘   │
│ Plate (optional)               │
│ ┌──────────────────────────┐   │
│ │ ABC 1234                  │   │
│ └──────────────────────────┘   │
│ Mileage in km (optional)       │
│ ┌──────────────────────────┐   │
│ │ 45000                     │   │
│ └──────────────────────────┘   │
│                                │
│ Skip for now — I'll tell you   │  ← ghost, nulls `vehicle`
│ at the counter                 │
├────────────────────────────────┤
│ [📞] │  Continue to Services  │  ← wizard-merged bar, 68px
└────────────────────────────────┘
```

### 1.2 Step 2 — Services (mobile)

```
┌────────────────────────────────┐
│ Step 2 of 4 · Services     50% │
│ What needs doing?              │
│ Tick everything you want in    │
│ one visit.                     │
│                                │
│ ── Service bay ──────────────  │  ← .eyg-checker divider
│ [x] Change Oil        POPULAR  │
│     Engine oil + oil filter.   │
│     From ₱650–₱950 · 45 min    │
│                                │
│ [x] PMS A              90 min  │
│     Full preventive service.   │
│     ₱1,250                     │
│                                │
│ [ ] PMS B                     │
│     Bigger interval service.   │
│     ₱1,850                     │
│                                │
│ [ ] Wheel Alignment            │
│     ₱500 · 30 min              │
│                                │
│ ── Brakes ──────────────────   │
│ [ ] Brake Pad Replacement      │
│     Ask us                     │
│                                │
│ ── Bundles ─────────────────   │
│ ┌──────────────────────────┐   │
│ │ RAINY SEASON PICK         │   │
│ │ PMS A + undercoating      │   │
│ │ 3 services                │   │
│ │ ₱13,200–₱19,200  save 8% │   │
│ │ [Select Rainy Season…]    │   │
│ └──────────────────────────┘   │
│                                │
│ › Have a promo code?           │
├────────────────────────────────┤
│ 2 selected · about 2 hr 30 min │  ← selection summary, sticky in step
│ Estimate ₱1,900–₱2,200         │
├────────────────────────────────┤
│ [📞] │ Continue to Date & Time │
└────────────────────────────────┘
```

### 1.3 Step 3 — Date & Time (mobile)

```
┌────────────────────────────────┐
│ Step 3 of 4 · Date & Time   75%│
│ Pick a day and an hour.        │
│                                │
│ ‹  14–27 Nov  ›                │
│ ┌────┐┌────┐┌────┐┌────┐       │
│ │Tue ││Wed ││Thu ││Fri │       │
│ │ 18 ││ 19 ││ 20 ││ 21 │       │
│ └────┘└────┘└────┘└────┘       │
│                                │
│ Wednesday 19 November           │
│ ┌──────────┐┌──────────┐       │
│ │ 8:00 AM  ││ 9:00 AM  │       │
│ │ 3 bays   ││ 2 bays   │       │
│ │          ││★Recommend│       │
│ └──────────┘└──────────┘       │
│ ┌──────────┐┌──────────┐       │
│ │10:00 AM  ││ 1:00 PM  │       │
│ │ 1 bay    ││ Full     │       │
│ └──────────┘└──────────┘       │
│ ★ Two bays free — easier to    │
│   shift if your plans change.  │
│                                │
│ We'll hold 9:00 AM for 10 min  │  ← `BOOKING.holdMinutes`
│ while you fill in your details.│
├────────────────────────────────┤
│ [📞] │Continue to Your details │
└────────────────────────────────┘
```

### 1.4 Step 4 — Contact & Confirm (mobile)

```
┌────────────────────────────────┐
│ Step 4 of 4 · Confirm       100%│
│ Check this, then we'll book it.│
│                                │
│ ┌── Your booking ────────────┐ │
│ │ 2019 Toyota Innova         │ │
│ │ Wed 19 Nov · 9:00 AM       │ │
│ │ Change Oil, PMS A          │ │
│ │ Estimate ₱1,900–₱2,200     │ │
│ │              [Change]      │ │
│ └────────────────────────────┘ │
│                                │
│ Your name *                    │
│ ┌──────────────────────────┐   │
│ │ Maria Santos               │   │  autocomplete=name
│ └──────────────────────────┘   │
│ Mobile number *                │
│ ┌──────────────────────────┐   │
│ │ +63 917 123 4567           │   │  inputmode=tel
│ └──────────────────────────┘   │
│ Email (optional)               │
│ ┌──────────────────────────┐   │
│ │ maria@email.com            │   │  autocomplete=email
│ └──────────────────────────┘   │
│ Anything we should know?       │
│ ┌──────────────────────────┐   │
│ │ e.g. knock, my brakes sq… │   │
│ └──────────────────────────┘   │  maxlength=500
│                                │
│ [ ] Yes, text me about this    │  ← REQUIRED, UNCHECKED
│     booking. I agree to get    │
│     one text with my booking   │
│     details and any change to  │
│     my appointment. I can     │
│     reply STOP any time.      │
│                                │
│ [ ] Send me offers from EYG…   │  ← OPTIONAL, UNCHECKED
│                                │
│ Prefer to confirm by phone?    │
│ Call now →                     │  ← the escape hatch, always visible
│                                │
│ 3 + 4 = [__]                   │  ← GET /api/booking/challenge
├────────────────────────────────┤
│ [📞] │      Confirm booking    │
└────────────────────────────────┘
```

### 1.5 Success (mobile)

```
┌────────────────────────────────┐
│  ✓                             │
│  BOOKING RECEIVED              │  ← eyebrow
│  You're booked for             │
│  Wednesday 19 November,        │
│  9:00 AM.                      │  ← h1, 32px
│                                │
│ ┌── Reference ───────────────┐ │
│ │ EYG-7F3K9A                 │ │
│ │ Read: E-Y-G dash 7-F-3-K…  │ │
│ └────────────────────────────┘ │
│                                │
│ What happens next              │
│ 1. We're texting you now.      │
│ 2. Bring your plate and a      │
│    valid ID.                   │
│ 3. We'll call before 9:00 AM   │
│    if anything changes.        │
│ 4. We'll show you the price    │
│    before we start.            │
│                                │
│ What the text will say:        │
│ ┌──────────────────────────┐   │
│ │EYG booked. Wed 19 Nov 9:00│   │
│ │AM. Ref EYG-7F3K9A. Change│   │
│ │Oil, PMS A, est 2050. Reply│   │
│ │CANCEL to cancel.          │   │
│ └──────────────────────────┘   │
│                                │
│ [  Add to calendar  ]          │
│ [  Get directions to the shop ]│
│ [  Call the shop             ] │
│ Book another service →         │
└────────────────────────────────┘
```

### 1.6 Desktop (≥ 768 px) — two columns, no action bar

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ EYG TIRE & AUTO CARE        [📞 Call] [Book a Service Bay]│
├────────────────────────────────┬─────────────────────────────┤
│  Wizard column (max 44rem)     │  Summary rail               │
│  [step content]               │  ┌───────────────────────┐  │
│                                │  │ 2019 Toyota Innova    │  │
│  [ Continue to … ]  ← inline,  │  │ Wed 19 Nov · 9:00 AM  │  │
│  NOT a bottom bar              │  │ Change Oil, PMS A     │  │
│                                │  │ Est. ₱1,900–₱2,200   │  │
│                                │  │                       │  │
│                                │  │ Call: +63 900 …0000   │  │
│                                │  └───────────────────────┘  │
│                                │  Open Mon–Sat 8–5           │
│                                │  Get directions             │
└────────────────────────────────┴─────────────────────────────┘
```
The mobile action bar is `display: none` at ≥ 768 px; the phone is then reachable from
the sticky header and the summary rail. The wizard's Continue button is inline in the
wizard column, so FC-1 is satisfied with no bar at all.

---

## 2. Step 1 — Vehicle

Vehicle data maps to `CreateBookingInput.vehicle`. The whole object is **optional**.

| # | Field | Label | Helper text | Placeholder | Input | Validation rule | Error message | Autofill | Mobile keyboard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `vehicle.year` | `Year` | `Model year, like 2019.` | `2019` | `<input type="text" inputmode="numeric" maxlength="4">` | `/^(19\|20)\d{2}$/` and `1980 ≤ y ≤ currentYear + 1` | `Enter a 4-digit year, like 2019.` or `That year looks off. Use the year on your registration.` | none | `numeric` |
| 1.2 | `vehicle.make` | `Make` | `Start typing. Most cars are already here.` | `Search make…` | combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, listbox popup with `role="listbox"`/`role="option"`, `aria-autocomplete="list"`) | must match a catalogue make, **or** the free-text path below is used | `Type at least 2 letters, or use "Not in the list".` | `autocomplete="off"` `autocorrect="off"` | default |
| 1.3 | `vehicle.model` | `Model` | `{make}-specific. Start typing.` | `Search model…` | combobox, options filtered by make | matches a model for the chosen make, **or** free-text | `Pick a model, or use "Not in the list".` | off | default |
| 1.4 | `vehicle.variant` | `Variant (optional)` | `Like Hybrid, VR-X, or 1.5.` | `Optional` | `<input type="text" maxlength="40">` | `length ≤ 40` | `Keep this under 40 characters.` | off | default |
| 1.5 | `vehicle.plate` | `Plate number (optional)` | `We use this to find your car when you arrive.` | `ABC 1234` | `<input type="text" autocapitalize="characters" spellcheck="false" maxlength="10">` | `/^[A-Za-z0-9 \-]{2,10}$/` | `Use letters, numbers and spaces only, like ABC 1234.` | off | default |
| 1.6 | `vehicle.mileageKm` | `Mileage in km (optional)` | `Helps us pick the right oil and filters.` | `45000` | `<input type="text" inputmode="numeric" maxlength="7">` | `0 ≤ n ≤ 2000000`, integer | `Enter mileage as a number, like 45000.` | off | `numeric` |

**Validation timing.** Validate on `blur` and on `input` once a field has been blurred
(never while the user is still typing the first characters). On step 1 → 2, focus the
first invalid field and announce it.

**The unknown-vehicle escape hatch (P0, must not block).**

Rendered directly beneath the Model field, always visible, `tertiary` variant,
label `Not in the list? Enter it yourself`. Activating it:

1. Inserts two free-text fields — `Make` and `Model` — **pre-filled with whatever the
   customer already typed**, and moves focus to them.
2. Marks the booking `vehicle.source = "manual"` in the draft.
3. Validation drops to: make ≥ 2 chars, model ≥ 1 char. Nothing else. There is **no**
   "we don't recognise that car" error, and no block on the *unknown* value.
4. Copy above the pair: `No problem. Type what you call it — we'll work it out at the
   counter.`

A second, always-visible ghost link sits at the bottom of the step:
`Skip for now — I'll tell you at the counter`. Activating it sets `vehicle = undefined`
and advances. Copy above it: `You can still book. We just won't know your car in advance.`

**Rationale, written down so nobody "tightens" it later:** a shop that refuses to book
unknown cars converts 0 % of the customers it cannot look up in a dropdown, and those
are exactly the customers with a problem today. `CreateBookingInput.vehicle` is
optional in the contract, so the escape hatch is already contract-legal. Making it
harder than this would be a design regression.

**Second vehicle.**

A vehicle switcher appears once step 1 is complete (or once a vehicle is known):

```
Booking for   2019 Toyota Innova 1.5        [Change]  [+ Add another vehicle]
```

`+ Add another vehicle` opens a **non-modal sheet** (`role="region"`, focus moved in,
`Esc` closes) listing:

1. Vehicles you used before — from `localStorage["eyg.vehicles"]`, capped at 4 entries,
   keyed by nothing (no phone number is stored in this key), fields stored: `year`,
   `make`, `model`, `variant`, `plate` only.
2. `Add a new vehicle` — reuses the step-1 form.

**Rule: one booking is one car.** Choosing "Add another vehicle" does **not** merge two
cars into the current booking. It says:

> `One booking is one car. Finish this one first, then start again — we'll keep your
> second date and vehicle ready.`

Rationale: `CreateBookingInput` carries a single `vehicle` and a single `startAt`. A
two-car, one-slot booking is not expressible in the contract, and pretending otherwise
would hand the front desk a booking they cannot fulfil. When the customer finishes the
first booking they land on the success screen with `Book another service`, which
restores the first vehicle and the same date, so the second car is ~40 seconds of work.

**Same-slot hint (honest only).** If a customer has two vehicles in the sheet and the
API reports `capacityLeft >= 2` for the chosen slot, one informational line appears:

> `Two bays are free at {time}, so both cars can go in together. We'll still book them
> as two separate bookings so each car gets its own bay time.`

If `capacityLeft < 2` the line is **not** rendered. We never promise a two-bay slot we
do not have.

---

## 3. Step 2 — Services

| # | Field / control | Label | Helper | Validation | Error | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Service selection | `What needs doing?` | `Tick everything you want in one visit.` | `1 ≤ n ≤ BOOKING.maxServicesPerBooking (8)` | empty: `Choose at least one service to pick a time.` / over: `That's more than 8 services. Book them separately, or call us and we'll sort it out.` | rows are `role="checkbox"` with `aria-checked`; row is one target, ≥ 56 px |
| 2.2 | Package selection | `Or pick a bundle` | `A bundle is cheaper than buying the parts separately.` | mutually exclusive with a conflicting individual service — selecting a bundle replaces overlapping services and says so | — | see 2.5 |
| 2.3 | Promo code | `Have a promo code?` (disclosure) | `Codes are checked when you apply them.` | see §3.4 | see §3.4 | never auto-apply from a URL without telling the user |
| 2.4 | Quantity (tyres, per-axle services) | inline stepper on the row | `How many?` | `1 ≤ q ≤ 4` for tyres | `Tyres come in sets of up to 4.` | **contract gap — see §10** |

**2.1 Service row anatomy (fixed, every row):**

```
┌──────────────────────────────────────────────────────┐
│ [✓]  Change Oil                          MOST BOOKED  │  ← badge if isPopular
│      Engine oil and a new oil filter.                │  ← ServiceDto.summary, 2 lines
│      ₱650–₱950  ·  about 45 min                       │  ← formatPesoRange + duration
│      [✓]  1  [2]  [3]  [4]      ← only for qty>1    │
└──────────────────────────────────────────────────────┘
```

- Price: `formatPesoRange(priceMin, priceMax)` → `₱1,250` · `₱1,250–₱1,800` · `Ask us`
  when `pricing === "CALL_FOR_PRICE"`.
- Below the price when `priceNote` is present: the note verbatim, e.g.
  `Parts and labour. Oil and filter included.`
- Duration chip: `about {formatDuration(durationMin)}`. Hidden when `durationMin` is null.
- `CALL_FOR_PRICE` rows additionally show: `We price this after we see the car. Call
  and ask.` with a `tel:` link — a dead row with no route out is a dead end.
- The row is the checkbox. The row is **not** a link. Selecting a row does not navigate.

**2.2 Multi-select, running total and duration.**

A summary panel is pinned to the bottom of the step (in-flow on mobile, sticky in the
step; in the desktop summary rail on ≥ 768 px). It recomputes on every toggle, with no
network call:

```
2 selected · about 2 hr 30 min
Estimate  ₱1,900–₱2,200
```

**Quantity maths** (mirrors `QUOTE-ESTIMATOR.md` §4 so both screens agree exactly):

```php
$fixedMin = 0; $fixedMax = 0; $rawMin = 0;
foreach ($selected as $s) {                     // $q = quantity (default 1)
  $fixedMin += ($s->priceMin ?? 0) * $q;
  $fixedMax += ($s->priceMax ?? $s->priceMin ?? 0) * $q;
  $rawMin   += ($s->durationMin ?? 0) * $q;
}
$buffer = (int)(ceil(($rawMin * 0.15) / 15) * 15);
$totalMin = $fixedMin + $buffer;
```
`duration` shown = `about {formatDuration($rawMin + $buffer)}`;
`slots` shown = `{ceil(($rawMin + $buffer) / BOOKING.slotMinutes)} bay slots`.

`formatDuration(min)`: `< 60` → `about 45 minutes`; else `about 2 hr 30 min`
(minutes omitted when 0; rounded to the nearest 15 first).

Any selected `CALL_FOR_PRICE` service appends one line under the total:
`+ 1 item we'll price when we see the car.` and switches the total label to
`Services and labour we can price now`. We never print a number that pretends to cover
an unpriced item.

**2.3 Zero-selection state.** Step 2 cannot advance with nothing selected. The primary
label in the bar becomes `Choose at least one service` (`cta_id: book.step2-choose-first`),
helper above it: `Pick the work you need, then pick a time.` Activating it focuses the
first service row and announces `No services selected yet.` via the wizard's polite live
region.

**2.4 Two services that conflict.** If a customer ticks a service that a selected
bundle already covers, we do not silently drop it. Copy:

> `{ServiceName} is already in {PackageName}. We'll leave the bundle as it is and ignore
> the extra one. [Remove {ServiceName}] [Switch to paying separately]`

Both actions are real. Default: keep the bundle.

**2.5 Running total honesty rules.**

- The total is always labelled `Estimate` — never `Total`, never `Price`.
- A range is rendered `₱1,900–₱2,200`. A single figure is rendered only when
  `min === max` **and** no `CALL_FOR_PRICE` item is selected. Otherwise, single figures
  are a lie we would have to walk back at the counter.
- The discount line reads `WET10: −₱110` and the line beneath it
  `You save ₱110 on labour with WET10.` Never a bare `Save 20%!`.
- If a promo makes the estimate exceed `compareAt` (a mis-configured promo), the
  discount is clamped to the subtotal and the promo is silently *not* applied, with the
  line `This code can't be used on that item.` — never a negative total.

---

## 4. Step 3 — Date & Time

### 4.1 API

```
GET /api/availability?date=YYYY-MM-DD&serviceIds=id1,id2&durationMin=210
→ ApiResult<SlotAvailabilityDto>
```

`SlotAvailabilityDto`: `date`, `timezone` (`Asia/Manila`), `totalCapacity`, `slots: SlotDto[]`,
`isClosed`, `closedReason?`.
`SlotDto`: `startAt` (ISO +08:00), `endAt`, `label` (`"9:00 AM"`), `capacityLeft`, `isBest`.

**`durationMin` is a required addition to `SlotQuery` — see §10.** With `slotMinutes: 60`
and a 3-hour job, capacity cannot be computed from the start time alone. The client
always sends the duration computed in §3 so `capacityLeft` is honest for *this* job.

### 4.2 Date picker

| Property | Spec |
| --- | --- |
| Range | today → today + `BOOKING.horizonDays` (60). Never more. |
| Visible window | 14 days per page, horizontal scroll-snap, `scrollbar-width: none` |
| Chip anatomy | `Tue` (11 px, uppercase, `eyebrow`) over `18` (18 px, 700). A second micro-line when `capacityLeft === 0` for every slot: `Full` in `racing-600` + a 10 px icon. |
| Fully-booked day | Chip renders `disabled` with `Full`. It is still focusable and still announced (`role="radio"`, `aria-checkable`, `aria-disabled="true"`, `aria-label="Thursday 20 November, no bays free"`). Disabled is never invisible. |
| Past / closed day | Not rendered. `isClosed: true` → the day chip renders `Closed` and selecting it shows `closedReason` in a panel: `{closedReason}` + `See open days`. |
| Break window | `breakWindows: 12:00–13:00` — no `SlotDto` is emitted by the server; if one is, the client treats `startAt` in that window as unavailable and does not render it. Client and server must agree; the server is authoritative. |
| Lead time | `minLeadMinutes: 90`. Today is only offered while a slot ≥ now + 90 min remains. When nothing today qualifies, today's chip is hidden and the first chip is tomorrow, with a one-line note: `Today's bays are taken. Earliest we have is tomorrow.` |
| Default selection | The **first** chip in the first window, and the API is called for it on mount. The customer sees real numbers immediately instead of an empty state. |
| Keyboard | `role="radiogroup"`, arrow keys move *and select* (roving `tabindex`), Home/End jump, PageUp/PageDown move ±7 days. Escape blurs back to the wizard heading. |

### 4.3 Slot list

| Property | Spec |
| --- | --- |
| Container | `role="radiogroup"`, `aria-labelledby` = the date heading. **`aria-live="polite"` on the container** so a screen reader hears the slot count change after each date fetch. |
| Chip | min 44 px tall, min 88 px wide, `role="radio"`, `aria-checkable="true"`. Visible content: `label` (16 px, 700, tabular) + capacity line (12 px). Accessible name: `9:00 AM, 2 bays free` / `1:00 PM, full`. |
| Capacity line | Exactly what the API said: `3 bays` · `2 bays` · `Last bay` (at `capacityLeft === 1`) · `Full` (at 0, disabled). **Never** a client-side countdown, a "hurry", or a number the client computed. |
| `isBest: true` | Chip gets a `brand-500` 2 px ring, a `★ Recommended` tag, and the reason line directly beneath the grid. **Maximum one per day** — if the server sends more than one, the client renders only the first and logs `error_shown{code:"INTERNAL_ERROR", reason:"multiple_is_best"}`. |
| Reason line text | `capacityLeft >= 2` → `Two bays free — easier to shift if your plans change.` / `capacityLeft === 1` → `Last bay free at this time.` / fallback (no `isBest` in payload) → `Earliest slot we have.` |
| Empty day | `No bays left on {date}. Next open: {nextDate} at {nextTime}.` + `See {nextDate}` (tertiary) + `Call the shop` (secondary). |
| Hold | Selecting a slot starts the `BOOKING.holdMinutes` (10 min) soft hold. A hairline progress bar under the step heading drains over 10 minutes, labelled `We'll hold 9:00 AM for 10 minutes while you fill in your details.` At zero: the hold is released, the slot chip returns to unselected, and the panel reads `Your 10-minute hold on 9:00 AM ended. Pick a time again — nothing was booked.` |
| Hold expiry is not a loss | The service selection, the vehicle and the date are all preserved. Only the slot is cleared. |

### 4.4 The `isBest` selection rule (documented so nobody hard-codes a fake)

This is the only nudge in the funnel and it must be reproducible. Server-side, per day:

1. Candidates = slots with `capacityLeft >= 1`, `startAt >= now + minLeadMinutes`,
   not inside `breakWindows`, not inside a `BayClosure` window.
2. Exclude any slot that ends within 30 minutes of `BUSINESS_HOURS.closes` (a customer
   who books the last slot of the day is the customer who runs over).
3. Prefer the **earliest** candidate with `capacityLeft >= 2` — this is the anti-race
   nudge: a slot with a spare bay is one the customer can move out of if a taxi takes
   twice as long.
4. Else fall back to the earliest candidate with `capacityLeft >= 1`.
5. Mark exactly one. Copy states the reason, so the nudge is disclosed, not hidden.

The client never marks a slot itself. If the server sends no `isBest`, the client shows
no tag and the `Earliest slot we have.` line. There is no client-side "recommended"
fallback that invents one.

---

## 5. Step 4 — Contact & Confirm

| # | Field | Label | Helper | Placeholder | Input | Validation | Error | Autofill | Keyboard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | `name` | `Your name` | `So we know who's coming.` | `Maria Santos` | `<input type="text">` | `2 ≤ len ≤ 80`, at least one letter | `Enter your name so we know who to look for.` | `autocomplete="name"` `autocapitalize="words"` | `next` |
| 4.2 | `phone` | `Mobile number` | `We'll text you this confirmation.` | `+63 917 123 4567` | `<input type="tel" inputmode="tel" pattern="[0-9+ ()-]*">` | `isValidPhPhone()` — `/^(\+?63\|0)9\d{9}$/` after `normalisePhone` | `Enter a PH mobile number, like 09 17 123 4567.` / `That number is 1 digit short. PH mobile numbers are 11 digits.` | `autocomplete="tel"` | `next` |
| 4.3 | `email` | `Email (optional)` | `For your receipt. Skip it if you prefer.` | `maria@email.com` | `<input type="email" inputmode="email">` | `isValidEmail()` if non-empty | `That email looks incomplete. Check it or leave it blank.` | `autocomplete="email"` `autocapitalize="off"` `spellcheck="false"` | `next` |
| 4.4 | `notes` | `Anything we should know?` | `Optional. e.g. knock first, my brakes squeak, I'm coming from Baguio.` | blank | `<textarea rows="3" maxlength="500">` | `len ≤ 500` | `Keep this under 500 characters.` (`aria-live="polite"` counter) | none | `done` |

Phone display: the value is normalised on `blur` to `formatPhPhone()` →
`+63 917 123 4567`. While typing, the raw value is preserved. The E.164 form is what
is submitted.

### 5.1 Consent — written out in full

Both render **unchecked**. Neither is a toggle switch. Each is a real `<input
type="checkbox">` with ≥ 44 px target and the full sentence as its visible label
(so it is read by sighted users, screen-reader users and whoever prints the page).

**4.5 `consentSms` — REQUIRED for web bookings, unchecked.**

> **Yes, text me about this booking.** I agree to get one text message with my booking
> details and any change to my appointment. Message and data rates may apply. I can
> reply STOP at any time to stop getting texts.

Required-unchecked error: `Tick the box above if you want the text confirmation. Or call
us instead and we'll note the same bay.`

**Why required, and the escape hatch.** This is the only channel through which the shop
can tell a customer their bay moved, and a web booking with no way to reach the
customer is an unfulfillable promise. It is **not** a dark pattern because (a) it is
specific, not bundled; (b) it is not pre-checked; (c) the data-rate and STOP terms are
in the sentence; and (d) **a phone call achieves the identical outcome and is offered
directly beneath the checkbox**, in the same weight as the submit button:

```
Prefer to confirm by phone?  Call now →
```

That line is always visible. It is not behind a disclosure. If the owner or counsel
decides consent must be optional, the only acceptable change is to make it optional —
never to pre-check it, and never to hide the call escape hatch.

**4.6 `consentMarketing` — OPTIONAL, unchecked, off the critical path.**

> **Send me offers from EYG Tire & Auto Care.** A few messages a month about promos on
> tyres and maintenance. I can opt out any time.

It is rendered *below* the submit area's keyboard tab stop ordering? No — it sits
directly under the SMS checkbox but is **never required**, never blocks submit, and is
never in a pre-checked state. Its absence changes nothing about the booking.

**Do not merge these into one box.** Bundled consent is not specific consent, and
`CreateBookingInput` models them as two separate booleans for exactly this reason.

### 5.2 The SMS/WhatsApp confirmation promise — required, above the submit

Rendered directly above the submit button, always, in a bordered panel. Never collapsed.

> **We'll text you right away.**
> You'll get one message like this:
> `EYG booked. Wed 19 Nov 9:00 AM. Ref EYG-7F3K9A. Change Oil, PMS A, est 2050. Reply
> CANCEL to cancel.`
> If you'd rather not get a text, call us instead — we can still take the bay.

The panel is a **preview of a real template**, not a paraphrase. The template rendered
here is the same string the backend sends. If a customer says "you promised a text" and
no text arrives, that is a real failure — `error_shown{code:"SMS_FAILED"}` plus a
`notifications.status = "failed"` row, both surfaced in the Monday review.

### 5.3 CAPTCHA

`GET /api/booking/challenge` → `{ captchaToken, question, }`. Rendered as a single
addition with a `Select` of answers — never a distorted image, never a reCAPTCHA
checkbox, never a puzzle. Label: `Quick check: {question}`, `enterkeyhint="done"`.
Failure: `That answer is not right. Try the new question.` with a new token.
`CreateBookingInput.website` (honeypot) stays empty for humans and is never labelled.

### 5.4 Review panel

Rendered above the fields, not below them, so the customer confirms against real data
before typing. Desktop: in the right rail. Mobile: a card at the top of step 4.

```
Your booking
2019 Toyota Innova 1.5        [Change]     → focus step 1 vehicle block
Wed 19 November · 9:00 AM     [Change]     → focus the date strip
Change Oil, PMS A             [Change]     → focus step 2
Estimate ₱1,900–₱2,200
```
Each `Change` is a real button that moves focus (not just scroll) to the field it
edits, and announces `{Section} — editing. Step 4 of 4.` through the wizard's live
region. Editing does not lose the current values.

### 5.5 Submit

```ts
const body: CreateBookingInput = {
  name, phone, email, startAt,           // slot.startAt verbatim, ISO +08:00
  serviceIds,                            // unique ids, in selection order
  packageId, promoCode, vehicle, notes,
  consentSms, consentMarketing,
  website: "",                           // honeypot — always empty for humans
  captchaAnswer, captchaToken,
  idempotencyKey,                        // ← contract change request, §10
};
// POST /api/booking
```

**Response:** `ApiResult<BookingDto>`.

Before the POST the client sets `source: "web"` … actually `source` is server-owned on
the Prisma model; the client does not send it. The client sends UTM only if a contract
field exists — it does not, so UTM travels in a signed `first-party` referrer the
backend reads. **Contract note, §10.**

Success criteria: `res.ok === true` **and** `data.status` is `PENDING` or `CONFIRMED`.
Anything else (including `data.status === "CANCELLED"`) is treated as a failure and
renders the error panel — we never show a success screen for a booking that is not
booked.

---

## 6. Slot race — exact behaviour

This is the one failure a customer will actually hit, because two people tapped the
same 9:00 AM on the same phone model in the same second.

**Trigger.** `ApiErrorCode === "SLOT_UNAVAILABLE"` (or `CONFLICT` with
`error.fields.startAt`), returned from `POST /api/booking`.

**What the user sees, in order:**

1. The submit button returns to its idle label. No spinner left on screen.
2. An inline error panel replaces the form's error slot, `role="alert"`, focus moved to
   it. Above the fold on mobile — the page scrolls it into view.
3. **The header, the exact copy:**

```
That bay was just taken.

Nothing was booked and you were not charged. Everything you
typed is still here.
```

4. **The reason, one line, in `muted-foreground`:**
   `9:00 AM on Wednesday 19 November is full now. Someone else confirmed it a moment
   before you did.`

5. **Actions:**

| Order | Label | Variant | Action | Microcopy above |
| --- | --- | --- | --- | --- |
| 1 | `See other times on Wed 19 Nov` | primary | re-run `GET /api/availability` for the same date, focus the slot grid, announce the new count in the polite live region | `Two slots are still open that day.` — **only rendered if the refetch returned ≥ 1 slot with `capacityLeft >= 1`; otherwise omitted** |
| 2 | `Try Thu 20 Nov` | secondary | jump to the next date with `capacityLeft >= 1` | only if such a date exists in the horizon |
| 3 | `Call us to hold that bay` | secondary | `tel:` with a prefilled body | `Someone can put your name on it while you drive in.` |
| 4 | `Start over` | tertiary | reset to step 1 | `Only if you want to.` — rendered last, in ghost |

6. **Nothing is cleared.** `vehicle`, `serviceIds`, `date` and all contact fields stay in
   the reducer and in `sessionStorage`. The slot is the only thing released.
7. **No apology theatre, no "oops!", no blaming the customer, no auto-redirect.** We do
   not silently move them to a different time; a customer who is not told which bay they
   got will drive in at the wrong hour.

**Telemetry:** `error_shown{code:"SLOT_UNAVAILABLE", page:"/book", step:4}`,
`slot_race_lost{date, start_at, capacity_at_submit}`, `booking_step_completed{step:3}`
is **not** re-fired, and `booking_completed` is **not** fired.

---

## 7. Success screen

Triggered by `ApiResult<BookingDto>` with `ok: true`. Fires `booking_completed`.

| Slot | String |
| --- | --- |
| Check icon | 40 px `pit-400` circle with a tick. Plus the word, never the icon alone. |
| Eyebrow | `Booking received` |
| `<h1>` | `You're booked for {dateLong} at {time}.` — e.g. `You're booked for Wednesday 19 November at 9:00 AM.` |
| Reference panel label | `Reference` |
| Reference value | `{BookingDto.reference}` — e.g. `EYG-7F3K9A` |
| Reference helper | `Read it out: E-Y-G, dash, then {spelled-out 6 characters}.` (alphabet excludes I, O, 0, 1 so it can be dictated over the phone) |
| Vehicle line | `{vehicleLabel}` or `Vehicle: we'll ask at the counter` when `vehicle` is null |
| Services line | comma-joined `BookingDto.items[].name × quantity` |
| Estimate line | `Estimate {formatPesoRange(estimateMin, estimateMax)}` — never `Total` |
| `<h2>` | `What happens next` |
| List 1 | `We're texting you now. The message has your reference and the time.` |
| List 2 | `Bring your plate and a valid ID. If you gave us a plate number, we'll have your car file open.` |
| List 3 | `We'll call before {time} if anything changes. If you're running late, call us — we can usually hold a bay for {BOOKING.minLeadMinutes} minutes.` |
| List 4 | `We'll show you the price before we start. Nothing goes on the invoice without your OK.` |
| SMS preview heading | `What the text will say` |
| SMS preview body | the exact template from §5.2, rendered from `BookingDto` |
| Primary CTA | `Add to calendar` · microcopy `One tap. It lands in your phone's calendar.` · builds a `.ics` Blob client-side (`DTSTART` from `startAt`, `DTEND` from `endAt ?? startAt + durationMinutes`, `SUMMARY: EYG Tire & Auto Care — {first item name}`, `LOCATION: {ADDRESS_ONE_LINE}`, `DESCRIPTION` = reference + estimate). No server route needed. |
| Secondary CTA | `Get directions to the shop` · microcopy `{ADDRESS_ONE_LINE}` |
| Tertiary CTA | `Call the shop` · microcopy `Open {BUSINESS_HOURS summary}.` |
| Ghost | `Book another service` · keeps the vehicle and the date, clears services and slot |
| **Not rendered** | Any "leave us a 5-star review" request, any "share this", any upsell, any newsletter prompt, any confetti. |

The mobile action bar is **hidden** on this screen (`barMode → "none"`), and
`--action-bar-current-height` is set to `0px` so the page-bottom padding compensates
correctly. Otherwise the bar's `Call Shop Now` would sit directly under a
`Confirm booking`-shaped area and invite a mis-tap.

---

## 8. Slow network, offline, and failure timing

| Condition | Behaviour | Exact copy |
| --- | --- | --- |
| Steps 1–2 offline | **Fully functional.** Pure client state, no fetch. | none needed |
| Step 3 offline | Slot grid is replaced by a failure panel with the phone as the primary action | `You're offline, so we can't load today's bays.` / `Calling works without data.` / primary `Call Shop Now` · secondary `Try again` |
| Step 4 submit while offline | Draft saved to `sessionStorage["eyg.booking.draft"]`, `online` listener armed, one auto-retry when the connection returns, 15 s timeout | `No connection. We saved your details.` / `We'll send it the moment you're back online. If you're in a hurry, call instead.` / primary `Call Shop Now` · secondary `Try again now` |
| Slow 3G, in flight < 6 s | Inline progress bar (not a spinner) under the button + `Sending…` | — |
| Slow 3G, > 6 s | Same, plus a reassurance line | `This is taking longer than usual. Your details are saved — nothing is lost.` |
| Slow 3G, > 20 s | Soft timeout: the form **stays enabled**, a `Try again` button appears, the request is NOT aborted | `We haven't heard back yet.` / `Your details are still here. Try again, or call us and we'll book it for you.` / primary `Try again` · secondary `Call the shop` |
| Hard timeout, 90 s | `error_shown{code:"SERVICE_UNAVAILABLE"}`, form stays populated, error panel with `Try again` | `We couldn't reach the booking system.` / `This is on our side, not yours. Try again in a moment, or call the shop and we'll book it for you in one minute.` |
| `RATE_LIMITED` | `retryAfter` from `ApiMeta` drives a live countdown; the form stays populated | `Too many attempts from this connection. Try again in {n} seconds.` / `In a hurry? Call the shop and we'll book it for you.` |
| Availability fetch fails (step 3) | Slot grid shows a failure state; date strip stays usable so the customer can pick another day and trigger a retry naturally | `We couldn't load the bays for {date}.` / `Pick another day, or call us.` |
| Availability returns `isClosed` | Panel with the reason and a jump to the next open day | `{closedReason}` / `See open days` |
| Availability returns 0 slots for a whole day | Empty state (§4.3) | `No bays left on {date}. Next open: {nextDate} at {nextTime}.` |

**No spinner over 400 ms anywhere** (`ACCESSIBILITY-SPEC.md` §6). Skeletons are used
for first load; a determinate inline bar is used for a submit the user is waiting on.

**Double-submit protection (three layers):**

1. `submitting` ref guard set synchronously on click, checked before the fetch.
2. Button gets `disabled` + `aria-disabled="true"` + `aria-busy="true"` and its label
   swaps to `Confirming…`. `disabled` is paired with an `aria-live` announcement so a
   screen-reader user knows why the button stopped responding.
3. `idempotencyKey` (crypto.randomUUID, generated once per attempt and **reused on
   retry**) sent to the server, which must return the original `BookingDto` for a
   repeated key rather than creating a second booking. **This is a contract change
   request — §10.** Without it, a double-tap on 3G creates two bookings and one
   customer at the counter.

---

## 9. Back button, deep links and draft persistence

| Action | Rule |
| --- | --- |
| Forward step 1→2→3→4 | `history.pushState({step}, "", "?step=N&…")`. Each step is its own history entry. |
| Browser back between steps | `popstate` → render that step, **never** refetch if the data is still in the reducer. Focus moves to that step's `<h2>` and announces `Step {n} of 4: {name}.` |
| Browser back on step 1 | Leaves `/book` to the referrer, or to `/` if none. No intercept. **No `beforeunload` prompt** — it is ignored on mobile browsers, and nagging someone who pressed back is hostile. The draft survives in `sessionStorage` for 24 h. |
| Deep link `/book?step=3` with no draft | The wizard renders step 3 with an empty slot list and one line above it: `We lost your last step. Let's start again — it takes about a minute.` + `Start again` (primary). We never blame the user and never silently show an empty step. |
| Deep link `/book?from=quote&services=…&promo=…&tyres=…&size=…` | Restores the estimator selection, shows the banner `From your estimate — {n} items, about {duration}.` with `Change` links per item, and pre-applies the promo **with a visible confirmation line**: `WET10 applied. It saves about ₱110 on labour.` |
| Draft persistence | `sessionStorage["eyg.booking.draft"]`, written on every state change (debounced 250 ms), holding `{step, vehicle, serviceIds, packageId, promoCode, tyreCount, tyreSize, name, phone, email, notes, consent flags, slotStartAt, holdStartedAt, savedAt}`. Cleared on `booking_completed` and on explicit `Start over`. `savedAt` older than 24 h → treated as absent. |
| Restoring contact details | Restores the whole draft without comment. It is the same device, and re-asking is friction. It is **not** a consent expansion: `consentSms` is restored only if the customer actually ticked it. |
| `Start over` | Requires no confirmation dialog. It clears the draft, returns to step 1, announces `Booking cleared. Starting again.` A destructive action the user explicitly asked for does not need a second gate. |

---

## 10. Contract change requests

None of these require changing the meaning of an existing field. All are additive.

| # | File | Change | Why it is required, not optional |
| --- | --- | --- | --- |
| CR-1 | `src/lib/types.ts` → `SlotQuery` | add `durationMin?: number` | `slotMinutes` is 60 and a PMS + alignment booking holds a bay for ~3 hours. `capacityLeft` computed from the start time alone will over-promise. The client already computes the duration in §3.2; it must be able to send it. Without this the shop will be double-booked. |
| CR-2 | `src/lib/types.ts` → `CreateBookingInput` | add `items?: Array<{ serviceId: string; quantity: number }>`; keep `serviceIds` as the derived unique-id list | `serviceIds: string[]` cannot express *4 tyres*, *2 shock absorbers*, or *both axles*. `BookingItem` has a `quantity` column, so the data model already supports it — the contract does not. A booking for four tyres currently records quantity 1. |
| CR-3 | `src/lib/types.ts` → `CreateBookingInput` and `CreateQuoteInput` | add `idempotencyKey?: string` | There is no way to make `POST /api/booking` safe against a double-tap on a 3G connection. Client-side disabling cannot survive a request that the user never sees the response to (backgrounded tab, dropped socket, aggressive proxy). This is the single highest-cost gap in the contract. |
| CR-4 | `src/lib/types.ts` → `SlotDto` | clarify or add `bayMinutes?: number` | The customer needs to know "this bay is yours for 3 hours", not "this bay is yours for 60 minutes". Either expose it, or confirm in the API doc that `label` describes the *start* only and the client must compute the end from its own duration estimate. Right now the copy in §4.3 implies the former. |
| CR-5 | `src/lib/types.ts` → `QuoteEstimateDto.expiresAt` | document the semantic | The field is required and non-nullable, but "expiry" reads as scarcity pressure, which this project refuses. Spec'd here as *catalogue snapshot time*, and the UI says `Prices checked at {time}.` If the backend instead uses it as a real TTL, the copy must not change. **Please pin this down before the frontend renders it.** |
| CR-6 | route map | add `POST /api/booking/challenge` as a documented public route | It is referenced in the existing contract comment but is not in the page/route map in `AGENT-BRIEF.md` §3, so it may be missed by the agent building `/api/booking/**`. |
| CR-7 | `src/lib/types.ts` → `BookingDto` | add `estimatedDurationMin?: number` | The success screen says `We'll hold your bay for about 3 hours` and the summary rail needs the same number. `endAt` is nullable and `SCHEDULED` bookings may have no `endAt` yet, so the client cannot always derive it. |

---

## 11. Booking-flow QA checklist

- [ ] Steps 1–2 work with the network fully disabled.
- [ ] "Not in the list? Enter it yourself" appears and never blocks; free text is accepted
      for any make/model.
- [ ] "Skip for now" advances with `vehicle === undefined`.
- [ ] "Add another vehicle" does not merge cars into one booking.
- [ ] 8 services max; the 9th is blocked with the exact over-limit message.
- [ ] Running total matches `QUOTE-ESTIMATOR.md` §4 for the same selection, to the peso.
- [ ] No `CALL_FOR_PRICE` service is ever included in a printed single figure.
- [ ] `capacityLeft` rendered exactly as returned; no client-side "only N left".
- [ ] Exactly one `isBest` chip per day; zero if the server sends none.
- [ ] Selecting a slot starts a 10-minute hold; expiry releases only the slot.
- [ ] Both consent boxes render unchecked; each is required exactly as specified.
- [ ] The call escape hatch under the consent box is visible without scrolling on
      360 × 640.
- [ ] The SMS preview panel is visible above the submit button without scrolling.
- [ ] Slot race: exact copy, actions 1–4 in order, no field cleared, no auto-redirect.
- [ ] Double-tap on `Confirm booking` produces exactly one `BookingDto`.
- [ ] Back 4 → 3 → 2 → 1 → out: no step loses data, no dialog appears.
- [ ] Success screen shows `BookingDto.reference` and hides the mobile action bar.
- [ ] `.ics` downloads with a valid `DTSTART` in `+08:00`.
- [ ] Keyboard-only: the whole flow completes with no mouse, including the date picker
      (arrows, Home/End, PageUp/PageDown) and the slot radio group.
- [ ] VoiceOver: slot count changes are announced once, politely, on every date change.
