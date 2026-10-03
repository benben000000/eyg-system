# INSTANT QUOTE ESTIMATOR — spec

**Route:** `/` section `#price-estimator` and `/services#price-estimator` (same
component, one `id`)
**Contract:** `QuoteEstimateInput`, `QuoteEstimateDto`, `CreateQuoteInput`, `QuoteRequestDto`
**Engine:** deterministic arithmetic over `ServiceDto.priceMin/priceMax` from the
database. **No prices are hardcoded in the frontend.** The numbers in the worked
examples below are **QA fixtures only** and must not ship as copy.

---

## 1. What this thing is, and what it is not

It is a **range calculator**. It takes what the customer already knows about their car
and their needs, adds up the price list the shop actually uses, and shows a range.

It is **not** a quote. A quote in this trade is a number a person stands behind. This
component never says `quote`, never says `instant price`, never says `locked`, and
never produces a single peso figure that the shop is not contractually able to honour
at the counter.

The single most important line on the whole component is the disclaimer, and it is
rendered unconditionally, on every result, before any CTA:

> This is a range, not a final price. It uses the price list we have today. We confirm
> the total with you before any work starts, and we won't add anything without your
> go-ahead.

---

## 2. Inputs

Maps 1:1 to `QuoteEstimateInput`. Everything except `engine` and `serviceIds` is
optional — the calculator must produce a useful result with only those two.

| Field | Control | Label | Helper | Options / placeholder | Default | Required |
| --- | --- | --- | --- | --- | --- | --- |
| `engine` | radio group, `role="radiogroup"`, 2-column grid | `What kind of engine?` | `This changes oil, filters and some part prices.` | `Gasoline` · `Diesel` · `Hybrid` · `Electric` · `Not sure` | `Not sure` | **yes** (`"unknown"`) |
| `vehicleYear` | number input, `inputmode="numeric"` | `Year` | `Optional. It helps us pick the right parts.` | `2019` | empty | no |
| `vehicleMake` | combobox | `Make` | `Optional. Start typing.` | `Search make…` + `Not sure` | empty | no |
| `vehicleModel` | combobox | `Model` | `Optional.` | `Search model…` + `Not sure` | empty | no |
| `serviceIds` | checkbox list, grouped by `ServiceDto.category` | `What needs doing?` | `Tick everything you want in one visit. We can do it all in one visit.` | full catalogue | empty | **yes** (≥ 1) |
| `tyreCount` | stepper 0–4 | `New tyres?` | `Just the fitting and balancing, or tyres too?` | `0` `1` `2` `3` `4` | `0` | no |
| `tyreSize` | text | `Tyre size` | `You can find it on the sidewall. Example: 205/55 R16.` | `205/55 R16` | empty | required if `tyreCount > 0` |
| `packageId` | single-select card row, exclusive with overlapping services | `Or a bundle` | `A bundle is cheaper than the same parts bought separately.` | `PackageDto[]` | none | no |
| `promoCode` | text + `Apply` | `Promo code` | `Optional. Only one code per booking.` | `WET10` | empty | no |

**`Not sure` is a first-class option everywhere.** The engine radio's last option is
`Not sure`, and the make/model fields each have a `Not sure` chip. A customer who taps
`Not sure` gets a **valid, narrower-confidence** result, never a wall.

**Order of the form** (mobile, one column, no accordions — accordions hide the inputs
and the customer's eye):

1. Engine → 2. Vehicle (year/make/model, each skippable) → 3. Services →
4. Tyres (count + size) → 5. Bundle (optional) → 6. Promo (optional, collapsed by
default behind a `Have a promo code?` tertiary link) → result card.

**No "Calculate" button.** The estimate recomputes on every change, debounced 250 ms
client-side for typing, instantly for taps. A submit button on a calculator makes the
customer think they are ordering something. Debounce note: the first render of the
result card must be instantaneous (it is arithmetic on data already in the page); only
network-dependent parts (promo validation) show a pending state.

---

## 3. Pricing source of truth

```ts
// Per-line resolution, server-side. Frontend never re-implements this.
const ENGINE_SENSITIVE = new Set<string>([/* service ids where oil/filter/consumable
   volume depends on the engine type — change oil, PMS A, PMS B */]);

function resolveLine(s: ServiceDto, ctx: { engine: string }): ResolvedLine {
  if (s.pricing === "CALL_FOR_PRICE") {
    return {
      min: 0, max: 0, isVariable: true,
      variableNote: "Depends on the parts your car needs. We check the car first, then give you the number.",
    };
  }
  if (ctx.engine === "unknown" && ENGINE_SENSITIVE.has(s.id)) {
    return {
      min: s.priceMin, max: s.priceMax, isVariable: true,
      variableNote: "The price depends on your engine type. Tell us and we can pin this down.",
    };
  }
  return { min: s.priceMin, max: s.priceMax ?? s.priceMin, isVariable: false };
}
```

`pricing` is exhaustively `FIXED | RANGE | CALL_FOR_PRICE` (contract). `FIXED` yields
`min === max`. There is no fourth case and the client may not invent one.

---

## 4. The maths

### 4.1 Totals

```php
/** @return array{min:int,max:int,isApproximate:bool,lines:array,spread:float} */
function buildEstimate(
    QuoteEstimateInput $sel,
    array $catalogue,               // ServiceDto[] keyed by id
    ?array $promo,                  // Promotion|null
    DateTimeImmutable $now
): array {
    $lines  = [];
    $varIds = [];
    $fixedMin = 0; $fixedMax = 0; $rawMinutes = 0;

    // ── 1. Selected services ────────────────────────────────────────────────
    foreach ($sel->serviceIds as $id) {
        $s  = $catalogue[$id] ?? null;
        if ($s === null) { continue; }                 // deactivated → §8
        $q  = 1;
        $r  = resolveLine($s, ['engine' => $sel->engine]);

        $lines[] = [
            'id' => $s->id, 'name' => $s->name, 'quantity' => $q,
            'min' => $r['min'] * $q, 'max' => $r['max'] * $q,
            'isVariable' => $r['isVariable'], 'variableNote' => $r['variableNote'],
        ];
        if ($r['isVariable']) { $varIds[] = $s->id; }
        $fixedMin += $r['min'] * $q; $fixedMax += $r['max'] * $q;
        $rawMinutes += (int)($s->durationMin ?? 0) * $q;
    }

    // ── 2. Tyres ────────────────────────────────────────────────────────────
    $n = (int)($sel->tyreCount ?? 0);
    if ($n > 0) {
        $lines[] = [
            'id' => 'tyres', 'name' => "Tyres ($n)", 'quantity' => $n,
            'min' => 0, 'max' => 0, 'isVariable' => true,
            'variableNote' => $sel->tyreSize
                ? "We price tyres by size and brand. You gave us {$sel->tyreSize} — send this to the shop and we'll come back with a fixed number for the brands we stock."
                : 'We price tyres by size and brand. Add your tyre size and send this to the shop, or call us with the size from your sidewall.',
        ];
        $varIds[] = 'tyres';
    }

    // ── 3. Promo — applies to the priced (non-variable) portion only ─────────
    $discount = 0; $compareAt = null;
    if ($promo !== null && isPromoActive($promo, $now)) {
        $base = $fixedMin;                              // never discount a variable line
        if ($promo->kind === PromoKind::PERCENT_OFF) {
            $discount = (int) round($base * $promo->valuePct / 100);
        } elseif ($promo->kind === PromoKind::FIXED_OFF) {
            $discount = min((int)$promo->valueOff, $base);
        } else {
            $discount = 0;                              // BUNDLE/CLEARANCE/TIRES are
        }                                              // applied server-side at
                                                       // booking, not estimated here
        $discount = min($discount, $fixedMax);           // never negative, never > total
        $compareAt = $fixedMin;
    }

    $min = max(0, $fixedMin - $discount);
    $max = max(0, $fixedMax - $discount);

    // ── 4. Duration ─────────────────────────────────────────────────────────
    $buffer   = (int)(ceil(($rawMinutes * 0.15) / 15) * 15);   // 15% rounded up to 15
    $minutes  = $rawMinutes + $buffer;
    $slots    = (int) ceil($minutes / BOOKING_SLOT_MINUTES);   // 60

    // ── 5. Confidence ───────────────────────────────────────────────────────
    $spread      = $min > 0 ? ($max - $min) / $min : ($max > 0 ? 1.0 : 0.0);
    $isApproximate = count($varIds) > 0 || $spread > SPREAD_CAP;

    return compact('lines','min','max','isApproximate','spread','minutes','slots',
                   'fixedMin','fixedMax','discount','compareAt','varIds');
}

const SPREAD_CAP = 0.40;   // see §5
```

`QuoteEstimateDto` assembly:

```php
$dto = new QuoteEstimateDto(
    min: $r['min'], max: $r['max'], currency: 'PHP',
    isApproximate: $r['isApproximate'],
    lineItems: $r['lines'],
    savings: $r['discount'] > 0
        ? ['amount' => $r['discount'], 'compareAt' => $r['compareAt']]
        : null,
    expiresAt: $now->modify('+30 minutes')->format(DATE_ATOM),   // §6
    disclaimer: DISCLAIMER,
    nextStep: $r['isApproximate']
        ? ['label' => 'Send this to the shop', 'href' => "/book?from=quote&capture=1&…"]
        : ['label' => 'Book a Service Bay with this', 'href' => "/book?from=quote&…"],
);
```

`nextStep.label` is **server-authored on purpose** — the server knows whether the
estimate is trustworthy enough to push a booking or whether it needs a human first. The
client must render `nextStep` verbatim and must not substitute its own label. (See
`BOOKING-FLOW.md` §5.5 for the same reason at submit time.)

### 4.2 Display rules, in order of precedence

```ts
function renderTotal(r: ReturnType<typeof buildEstimate>): ResultCardVariant {
  // A. everything unpriceable — never print ₱0
  if (r.fixedMin === 0 && r.fixedMax === 0 && r.varIds.length > 0)
    return { kind: "human", heading: "We'll price this for you." };

  // B. some lines need a human
  if (r.varIds.length > 0)
    return { kind: "split", heading: "Here's what we can price now.",
             pricedFrom: r.fixedMin, pricedTo: r.fixedMax, pending: r.varIds };

  // C. confident and tight
  if (r.spread <= SPREAD_CAP)
    return { kind: "single", heading: "Your estimate",
             amount: r.min === r.max ? r.min : [r.min, r.max] };

  // D. wide, no variable lines → a catalogue data problem. Show the truth, flag it.
  return { kind: "wide", heading: "Here's a wider range.",
           amount: [r.min, r.max], note: WIDE_NOTE };
}
```

| Variant | Heading above the figure | Figure | Below the figure |
| --- | --- | --- | --- |
| `single` | `Your estimate` | `₱2,150` or `₱1,900–₱2,200` | `Parts and labour. About 2 hr 30 min in the bay.` |
| `split` | `Here's what we can price now.` | `₱1,100` (labelled `Services and labour`) | the variable lines, each with its `variableNote` |
| `wide` | `Here's a wider range.` | `₱3,000–₱5,000` | `The top of this range is for a car that needs more than the usual parts. We'll tell you before we start.` |
| `human` | `We'll price this for you.` | **no figure at all** | `Send us the details and we'll give you a fixed number, usually the same day.` |

**`variant: "human"` never renders a peso figure, and never renders `₱0`.** A `min` of
`0` reaching the screen is a bug, not a state. This is the single highest-risk dark
pattern on the page and it is designed out.

### 4.3 Line-item list

Each line, always, in this order and never collapsed:

```
Change Oil                              1 ×   ₱650 – ₱950
PMS A                                   1 ×   ₱1,250
Tyres (4)                               4 ×   we'll price
─────────────────────────────────────────────────────────────────
Services and labour we can price now          ₱1,900 – ₱2,200
WET10 on labour                            −   ₱110
```

- `isVariable: true` lines render `we'll price`, never `₱0`. The `variableNote` is the
  line directly beneath, `text-body` in `muted-foreground`, no icon, no colour.
- `savings` renders as one line: `WET10 on labour` / `−₱110`, plus a sentence beneath
  the total: `You save about ₱110 with WET10.` If `compareAt <= min`, `savings` is
  omitted entirely — a `compareAt` lower than the real price is a mis-configuration and
  the estimator refuses to render it.
- Quantity `q > 1` renders `2 ×` and multiplies the line.

---

## 5. The spread cap, and why

**Rule: the displayed range never spans more than 40 % of its own minimum.**

```
spread = (max - min) / min        spread > 0.40 → variant "wide" or "human"
```

40 % is chosen, not picked out of the air:

- **Below ~20 %** the range reads as a single number with noise, which is fine and
  builds trust. Most `RANGE` services land here.
- **20–40 %** the customer can still act on it: *"₱1,900 or maybe ₱2,200 — fine."*
  This is the band we want.
- **Above 40 %** the number stops doing any work. `₱3,000–₱5,000` is not a price, it is
  a refusal with a currency symbol. A price-conscious Balanga customer comparing three
  shops cannot compare a refusal, so they will simply drop us — which is the exact
  opposite of what a wide range is supposed to achieve.

**What we do when a range is too wide: we refuse to fake it.** We never clamp `max`
downward to hit the cap, because a displayed maximum below the real maximum is a lie we
would collect at the counter. Instead:

1. `variant: "wide"` — the honest wide range, plus a plain-language reason for the
   width, plus `isApproximate: true`.
2. `variant: "human"` — when the width comes from unknown parts, we drop the figure and
   route to a human.
3. **The wide case is also a business signal.** `wide` and `human` results increment a
   counter keyed by service id (`quote_estimated{widest_service_id}` in
   `FUNNEL-METRICS.md`). Monday's review looks at that list. A service that is wide
  every week is a service whose price list should be pinned down. The estimator is the
  shop's price-discovery instrument, and this is how we use it.

---

## 6. `expiresAt` — semantics, and a refused pattern

`QuoteEstimateDto.expiresAt` is required and non-nullable but its meaning is undefined
in the contract (**change request CR-5** in `BOOKING-FLOW.md` §10). Specified here as:

> `expiresAt` = **the moment the catalogue snapshot behind this estimate stops being
> valid**, set to `now + 30 minutes`. It is a caching and pricing-freshness boundary.

Rendered copy, unconditionally, under the total:

> `Prices checked at 2:41 PM.`

and, only when `isApproximate` is `false` and the user has not converted:

> `We hold these prices until {time}.`

**Refused: a live countdown.** No ticking clock, no colour change as it runs down, no
`Offer expires in 09:59`. Manufactured urgency on a price is the oldest dark pattern in
retail and it reads as a trap to exactly the price-conscious customer this business
needs. A customer who believes prices are fake stops believing the *fixed* prices too,
and the whole shop loses the advantage.

**Refused: the estimate changing while nobody changed the input.** A timer that moves
the number is a rigged slot machine. Same selection, same number, every time, until the
shop changes its price list.

---

## 7. Worked examples (QA fixtures — not shipping copy)

Prices below are **sample catalogue values used to unit-test `buildEstimate()`**. Real
values come from `Service.priceMin/priceMax` in the database. The owner has not signed
off on any price; these numbers exist so a developer can assert on arithmetic.

Fixture catalogue:

| id | name | pricing | min | max | durationMin | engineSensitive |
| --- | --- | --- | --- | --- | --- | --- |
| `svc-oil` | Change Oil | RANGE | 650 | 950 | 45 | yes |
| `svc-pms-a` | PMS A | FIXED | 1250 | 1250 | 90 | yes |
| `svc-pms-b` | PMS B | FIXED | 1850 | 1850 | 120 | yes |
| `svc-align` | Wheel Alignment | FIXED | 500 | 500 | 30 | no |
| `svc-rotate` | Tire Rotation | FIXED | 400 | 400 | 30 | no |
| `svc-fit` | Tire Fit & Balance (labour, per tyre) | FIXED | 150 | 150 | 20 | no |
| `svc-undercoat` | Undercoating | RANGE | 12000 | 18000 | 480 | no |
| `svc-pads` | Brake Pad Replacement | CALL_FOR_PRICE | — | — | 120 | no |
| `svc-ac` | Car Aircon Regas | RANGE | 1200 | 1600 | 90 | no |

`BOOKING.slotMinutes = 60`.

### Example A — the confident case

Input: `engine: "gasoline"`, `serviceIds: ["svc-pms-a","svc-align","svc-rotate"]`,
no tyres, no promo.

```
resolveLine(pms-a)  → 1250 / 1250   (engine given, not variable)
resolveLine(align)  →  500 /  500
resolveLine(rotate) →  400 /  400
fixedMin = fixedMax = 2150
discount = 0  →  min = max = 2150
rawMinutes = 90 + 30 + 30 = 150
buffer    = ceil(150 * 0.15 / 15) * 15 = ceil(22.5/15)*15 = 2*15 = 30
minutes   = 180        → "about 3 hours"
slots     = ceil(180/60) = 3
spread    = 0 / 2150 = 0
varIds    = []  →  isApproximate = false
```

Rendered:

```
Your estimate
₱2,150
Parts and labour. About 3 hours in the bay.
Prices checked at 2:41 PM.
```

Primary CTA: `Book a Service Bay with this` → `/book?from=quote&services=svc-pms-a,svc-align,svc-rotate`

### Example B — tyres, promo, partial confidence

Input: `engine: "gasoline"`, `serviceIds: ["svc-fit","svc-align"]`,
`tyreCount: 4`, `tyreSize: "205/55 R16"`, `promoCode: "WET10"` (PERCENT_OFF 10, scope
labour).

```
resolveLine(fit)   → 150 * 1 = 150/150          (service quantity is 1; the customer
resolveLine(align) → 500/500                      ticked it once for "4 tyres"? No —
                                                     quantity comes from CR-2. Fixture
                                                     uses one line, tyres counted
                                                     separately.)
tyres(4)          → 0/0, isVariable = true, variableNote = "We price tyres by size…"
fixedMin = fixedMax = 650
promo WET10: base = 650 → 650 * 10 / 100 = 65 → discount = min(65, 650) = 65
min = 650 - 65 = 585      max = 650 - 65 = 585
savings = { amount: 65, compareAt: 650 }
rawMinutes = 30 + 30 = 60   (the 4 tyres' 20 min each is NOT in durationMin,
                             it is variable too → duration is also flagged)
minutes = 60 + 9→15 = 75   → "about 1 hr 15 min"
varIds  = ['tyres']  →  isApproximate = true
```

Rendered: `variant "split"`

```
Here's what we can price now.
Services and labour
₱585
Change Oil — no. (see table)

Fit & Balance (labour)   1 ×   ₱150
Wheel Alignment          1 ×   ₱500
Tyres (4)                4 ×   we'll price
  We price tyres by size and brand. You gave us 205/55 R16 — send this
  to the shop and we'll come back with a fixed number for the brands
  we stock.
WET10 on labour                        −₱65
```

Primary CTA: `Book a Service Bay with this` · secondary: `Send this to the shop`
`nextStep.label = "Send this to the shop"` (server chose it, `isApproximate: true`).

> **Known defect in the fixture above, and a real product requirement.** The labour line
> `Fit & Balance` is per-tyre but the booking can only record it once (CR-2). Until CR-2
> lands, the estimator must **not** offer a per-tyre labour line with `quantity > 1`;
> it must price the labour line at `quantity = tyreCount` inside the estimate and the
> booking must carry `items[]`. This is exactly why CR-2 is not optional.

### Example C — everything needs a human

Input: `engine: "unknown"`, `serviceIds: ["svc-undercoat","svc-pads"]`.

```
resolveLine(undercoat) → 12000/18000, not engine sensitive → not variable
resolveLine(pads)      → CALL_FOR_PRICE → 0/0, isVariable = true
fixedMin = 12000   fixedMax = 18000
spread  = (18000-12000)/12000 = 0.50   →  > SPREAD_CAP
varIds  = ['svc-pads']  →  isApproximate = true
```

Two problems at once: a line we cannot price, and a spread of 50 %.

Rendered: `variant "split"` (the variable line wins — a wider-but-explicit presentation
is more honest than a wide bare range).

```
Here's what we can price now.
Services and labour
₱12,000 – ₱18,000
Undercoating        1 ×   ₱12,000 – ₱18,000
  The top of this range is for a car that needs more rust treatment than
  usual. We'll tell you before we start.
Brake Pad Replacement   1 ×   we'll price
  Depends on the parts your car needs. We check the car first, then give
  you the number.
```

Primary CTA becomes `Send this to the shop` (server's `nextStep`). `isApproximate: true`.

**Refused here:** collapsing this to `₱0 – ₱18,000`, or to `₱12,000 – ₱13,000` to
satisfy the cap, or to a single `₱15,000` with a "final price". All three are lies that
resolve at the counter, and all three are more expensive than the honest wide range.

### Example D — the empty-solution case (the anti-pattern trap)

Input: `engine: "unknown"`, `serviceIds: ["svc-pads","svc-pads"]` (only call-for-price).

```
fixedMin = fixedMax = 0     min = max = 0     varIds = ['svc-pads']
```

`renderTotal` branch A fires: `variant "human"`.

```
We'll price this for you.

Brake pads are priced on the car — the pad brand, thickness and whether
the disc needs turning all change the number. Send us your make and
model, or call, and we'll give you a fixed figure before you come in.
```

**No peso figure is rendered. `₱0` never appears.** This is the highest-severity failure
this component can have, and it is a single `if`.

---

## 8. Services deactivated mid-session

If a selected service id is no longer active:

- The estimate is recomputed **without** it.
- One line appears above the result, `role="status"`:
  `We had to remove {ServiceName} from this estimate — it's not on our list right now.`
  with a `See current services` tertiary link to `/services`.
- `error_shown{code:"NOT_FOUND", reason:"estimator_service_deactivated"}`.
- We never fail the whole estimate for one dead line.

---

## 9. Promo codes in the estimator

| Case | Behaviour | Copy |
| --- | --- | --- |
| Valid, applies | Discount line + `You save about ₱X with {CODE}.` | as above |
| Valid, but nothing eligible (e.g. tyres-only selection) | Line omitted entirely, no error | `{CODE} applies to services and labour, not to tyres.` |
| Not found | Inline error, estimate unchanged | `We don't have a code "{code}". Check the spelling, or ask us on Messenger.` |
| Expired / not started | Inline error, estimate unchanged | `{CODE} ended on {date}.` + `See what's on now` → `/deals` |
| Already used by this phone | Inline error, estimate unchanged | `You've already used {CODE} on a previous booking. One per customer.` |
| Server unreachable | Estimate still renders, un-discounted | `We couldn't check that code right now. The estimate below is without the discount.` |

The estimate is **never** blocked by a promo problem. A discount is a bonus; blocking
the answer to "how much will this cost me?" over a typo is indefensible.

---

## 10. Deep-linking an estimate into a booking

The result card's primary CTA builds:

```
/book?from=quote
        &engine=gasoline
        &services=svc-pms-a,svc-align,svc-rotate
        &quantity=svc-fit:4            (only where CR-2 quantity is present)
        &package=rainy-season-pick
        &promo=WET10
        &tyres=4
        &size=205%2F55%20R16
        &year=2019&make=Toyota&model=Innova
```

`/book` (Step 1 banner):

> **From your estimate** — 3 items, about 3 hours. `Change` links on each row.

and for a pre-applied code:

> `WET10 applied. It saves about ₱65 on labour.`

Requirements:

- Every parameter is optional and independently missing-safe. A truncated URL still
  produces a usable `/book`.
- Unknown ids are dropped, not fatal (`ERROR-AND-EDGE-STATES.md` §6).
- `from=quote` records the source server-side for attribution. `Booking.source` exists
  in the Prisma model but **not** in `CreateBookingInput` — **contract change request
  CR-8** (`BOOKING-FLOW.md` §10 family): add `source?: "web" | "quote" | "promo"` and
  `utm?: { source?: string; campaign?: string }` so attribution does not depend on
  referrer headers that proxies strip.
- The estimate is **not** re-fetched on `/book`. The prices shown in the booking summary
  come from the same calculation, recomputed against live catalogue data. If the recomputed
  total differs from the deep-linked one, the booking summary wins and shows a line:
  `Prices changed since your estimate. Here's today's range.` — no apology, no
  manipulation in either direction.

---

## 11. Exit-intent capture

### 11.1 What it is

A **non-modal, dismissible** one-field form that lets the customer send the estimate to
the shop instead of booking, so the shop can call back with a fixed number. It is the
conversion path for every `variant: "human"` and `variant: "split"` result, and the
safety valve that keeps the estimator from being a dead end.

### 11.2 Trigger rules (deliberately conservative)

| Platform | Fires when | Frequency |
| --- | --- | --- |
| Desktop (pointer: fine) | cursor leaves through the **top** edge of the viewport, **after** the result card has been in view for ≥ 8 s, **and** ≥ 1 service is selected, **and** `cta_id: estimator-capture` has not fired in this session | max 1 per 30 days per device |
| Mobile (coarse pointer) | **Never.** | — |

Mobile exit-intent is a myth. There is no reliable "leaving" signal on touch, and the
attempts that ship (scroll-velocity detectors, back-button intercepts, delayed scroll
traps) are hostile and get the site flagged. **The mobile equivalent is a permanent
inline link under the result card**, always present, never conditional:

> `Send me this estimate by text` → opens the same capture form in-place.

If we do not want a customer to leave with an unanswered number, the answer is a visible
link, not a trap.

### 11.3 Suppression

Do not fire on: `/book` (any step), `/admin`, any error/maintenance page, when a modal
or the keyboard is open, when `localStorage` records a dismissal within 30 days, when the
result variant is `single` **and** the user has already tapped a booking CTA, or on
the first page view of a session that arrived on a `from=quote` deep link (they already
converted once).

### 11.4 The form

Non-modal. A `role="region"` panel, `max-height: 320px`, no backdrop, no focus trap, no
scroll lock, `Esc` closes and returns focus to the estimate card. Announced with
`aria-live="polite"`. Never a `role="dialog"`.

| Field | Label | Helper | Input | Validation | Error |
| --- | --- | --- | --- | --- | --- |
| `name` | `Your name` | `Optional. We can look you up by number.` | `text`, `autocomplete="name"` | — | — |
| `phone` | `Mobile number` | `We'll text you the fixed price.` | `tel`, `inputmode="tel"`, `autocomplete="tel"` | `isValidPhPhone()` | `Enter a PH mobile number, like 09 17 123 4567.` |
| `consentSms` | `Yes, text me about this estimate.` + full sentence (§5.1 of `BOOKING-FLOW.md`) | — | checkbox, **unchecked** | required | `Tick the box if you want the text. Or call us instead.` |
| honeypot | `website` | hidden | `text` | — | — |
| captcha | `Quick check: {question}` | — | select | — | `That answer is not right. Try the new question.` |

Actions:

| Order | Label | Variant | Behaviour |
| --- | --- | --- | --- |
| 1 | `Send to the shop` | primary | `POST /api/quote` with `CreateQuoteInput` (`QuoteEstimateInput` + `name`/`phone`/`consentSms`) → `ApiResult<QuoteRequestDto>` |
| 2 | `No thanks, I'll book instead` | secondary | closes the panel, focuses the booking CTA, sets `localStorage["eyg.exitCapture.dismissedAt"]` |
| 3 | *(nothing else)* | — | — |

Success copy, inline (the panel does not navigate away and does not lose the estimate):

> `Sent. We'll text you a fixed price for {vehicleLabel}, usually the same day. Your
> reference is {QuoteRequestDto.reference}. Your estimate is still on screen — you can
> still book with it.`

`quote_captured` fires with `{ reference, variant, min, max, source }`.

### 11.5 Why this is not a dark pattern

- It is not a modal, so it never blocks the estimate or the booking button.
- `No thanks` is a first-class, equal-weight button, and it is **permanent** — the inline
  `Send me this estimate by text` link is always available afterwards.
- The dismissal lasts 30 days, not "this session", and it is not re-asked after a
  conversion.
- It asks for a phone number to send a price, and says so before the field. It never
  asks for money, a card, an account, or a "free consultation" that is a sales pitch.
- It never fires on mobile, where the technique is both unreliable and unconsenting.

---

## 12. Estimator QA checklist

- [ ] No service selected → the result card is absent, not zeroed.
- [ ] Every one of Examples A–D produces exactly the figures in §7 (unit test on
      `buildEstimate`).
- [ ] `min === 0 && varIds.length > 0` → **no peso figure rendered anywhere on screen.**
- [ ] `spread > 0.40` with no variable lines → `variant "wide"` and the reason line.
- [ ] `max` is never clamped downward to satisfy the cap.
- [ ] `nextStep.label` is rendered verbatim from the server payload.
- [ ] No countdown timer, no animated figure, no number that changes without an input
      change.
- [ ] `Not sure` on engine, make and model each produce a valid result.
- [ ] Both consent checkboxes in the capture form render unchecked.
- [ ] Desktop exit-intent never fires on mobile viewports (`pointer: coarse`).
- [ ] Exit-intent respects the 30-day dismissal and never traps focus.
- [ ] Deep link into `/book` with truncated params still renders a usable wizard.
- [ ] A dead service id is removed with a visible line, not a hard failure.
- [ ] Every disclaimer string appears on every result variant, above every CTA.
- [ ] Grep the bundle for `₱0` in estimator render paths — must return nothing.
