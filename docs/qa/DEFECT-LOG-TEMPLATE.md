# DEFECT LOG — TEMPLATE AND CURRENT OPEN DEFECTS

**Owner:** QA & Security agent. Every row below is a **real defect found by a
test that is deliberately left failing.** The test is the specification; the fix
makes it green. Do not edit the test to make the row disappear.

Reproduce with: `npx vitest run <file> -t "<test name>"`.

---

## How to file a new defect

Copy this block, fill every field, and add a failing (or `.todo`) test that
proves the current behaviour is wrong.

```markdown
### DEF-NNN — one-line statement of what is wrong

| | |
| --- | --- |
| **Severity** | Critical / High / Medium / Low |
| **Area** | unit logic / API / UI / a11y / security / performance / ops |
| **Owner** | the agent who owns the file |
| **File** | `src/path/file.ts` |
| **Line** | 123 |
| **Failing test** | `tests/unit/foo.test.ts` → "test name" |
| **OWASP (if security)** | A03:2021 … |
| **WCAG (if a11y)** | SC 1.4.11 … |

**What happens**  — the observed behaviour, precisely.

**What should happen** — the expected behaviour, precisely.

**Reproduction**
```

the smallest command that shows it

```

**Business impact** — who loses what. One sentence. "A customer is quoted ₱1,530
and charged ₱2,900" beats "pricing inconsistency".

**Fix**
```ts
// the specific change, not a description of one
```

**Verification** — which test turns green.

```

Severity is about *consequence*, not effort:

| | |
| --- | --- |
| **Critical** | Data loss, PII leak, money lost, or the site is down for customers. |
| **High** | A customer is misinformed or blocked: a wrong price, an unreachable number, a booking that silently fails. |
| **Medium** | Real friction or a legal/SEO risk with a workaround. |
| **Low** | Polish, inconsistency, an internal-code smell. |

---

# OPEN DEFECTS

## DEF-001 — The open/closed badge ignores holidays

| | |
| --- | --- |
| **Severity** | **High** |
| **Area** | Business logic / UI |
| **Owner** | backend-core or frontend-core (`src/components/layout/hours.ts`) |
| **File** | `src/components/layout/hours.ts` |
| **Line** | 84–134 (`getOpenStatus`) |
| **Failing test** | `tests/unit/open-status.test.ts` → "reports CLOSED with the holiday name on a closed holiday" |

**What happens.** `getOpenStatus` reads only `BUSINESS_HOURS` from
`src/config/site.ts`. It never looks at the `Holiday` model — which exists in
`prisma/schema.prisma` and which `computeAvailability` **does** honour. On a
closed holiday the homepage pill, the emergency banner and `/contact` all say
**"Open now"**, and the only place a customer learns otherwise is the booking
board.

**What should happen.** A `Holiday` row with `isClosed: true` for today's Manila
date forces `isOpen: false`, with the holiday's name in the detail line.

**Reproduction**
```

Add: Holiday { name: "Christmas Day", date: 2026-12-25, isClosed: true }
Open / on 25 December at 10:00 Manila → the badge reads "Open now".

```

**Business impact.** A customer drives 1.5 h from Manila to a closed door on a
public holiday, on the strength of a badge the site itself rendered.

**Fix.** Give `getOpenStatus` a `holidays` parameter (pure, injected — not a
database read inside a presentational helper) and check it before the day-of-week
rule, exactly as `computeAvailability` does.

**Verification.** The named test turns green.

---

## DEF-002 — A window that crosses midnight is computed wrongly

| | |
| --- | --- |
| **Severity** | Medium |
| **Area** | Business logic |
| **Owner** | backend-core |
| **File** | `src/components/layout/hours.ts` |
| **Line** | 90 (`minutes >= opens && minutes < closes`) |
| **Failing test** | `tests/unit/open-status.test.ts` → "a 22:00–02:00 window must be open at 23:00 and 01:00, but is not" |

**What happens.** The comparison uses a single "minutes since local midnight"
value. A Saturday `22:00 → 02:00` window evaluates `1380 >= 1320 && 1380 < 120`
→ false, and 01:00 evaluates `60 >= 1320` → false. The shop would advertise
**"Closed" through its entire evening shift**.

**What should happen.** `closes > 1440` (or a `closesAt < opensAt` flag) must
wrap: a slot is open when `minutes >= opens || minutes < closes - 1440`.

**Business impact.** Zero today (hours are 08:00–17:00) — but **Saturday-evening
tyre-fitting hours are the single most likely schedule change this shop will ever
make**, and it would break the badge on the busiest nights, silently.

**Fix.** Accept an `hours` override on `getOpenStatus` and handle a wrapping
window. The test file shows the exact arithmetic.

---

## DEF-003 — The badge says "Sunday: 8:00 AM – 5:00 PM" on a closed day

| | |
| --- | --- |
| **Severity** | Medium |
| **Area** | UI / copy |
| **Owner** | frontend-core |
| **File** | `src/components/layout/hours.ts` |
| **Line** | 74–77 (`hoursText`) |
| **Failing test** | `tests/unit/open-status.test.ts` → "reports today's hours in the shop's own words" |

**What happens.** `hoursText()` ignores the `closed` flag, so `today` renders
`"Sunday: 8:00 AM – 5:00 PM"`. The weekly schedule rendered directly beneath it
in the same component correctly reads `"Closed"`. Two contradictory statements,
one component, one screen.

**Business impact.** A customer reads "Sunday: 8:00 AM – 5:00 PM" and drives to
the shop on a Sunday. This is the exact scenario the closed flag exists to
prevent, defeated by a missing `?`.

**Fix.** `hoursText` takes the whole row and returns `"Closed"` when
`entry.closed`.

---

## DEF-004 — `formatPhPhone` produces a garbled number

| | |
| --- | --- |
| **Severity** | High |
| **Area** | Unit logic |
| **Owner** | orchestrator (`src/lib/utils.ts` is orchestrator-owned) |
| **File** | `src/lib/utils.ts` |
| **Line** | 37–44 |
| **Failing test** | `tests/unit/phone.test.ts` → "formats a mobile as '+63 917 123 4567'" |

**What happens.**
```ts
formatPhPhone("09171234567")  // → "+63 9171 234 567"   ✗
                              // → should be "+63 917 123 4567"
```

`e164.slice(4)` keeps the leading `9` in the first group, then formats 3-3-3.

**Business impact.** This is the string the front desk reads back to a customer
and the string that goes into an SMS. It is read aloud, digit by digit, on a
noisy line in a shop. `+63 9171 234 567` is 3+4+3 digits and gets transcribed
wrong.

**Fix** (orchestrator-owned, so this is a *request*, not an edit):

```ts
const national = e164.slice(3);            // "9171234567"
return `+63 ${national.slice(0,3)} ${national.slice(3,6)} ${national.slice(6)}`;
```

---

## DEF-005 — A `CALL_FOR_PRICE` service quotes "₱0 – ₱0"

| | |
| --- | --- |
| **Severity** | High |
| **Area** | Business logic / pricing |
| **Owner** | backend-core |
| **File** | `src/lib/server/quote.ts` |
| **Line** | 242–243 |
| **Failing test** | `tests/unit/quote-math.test.ts` → "must contribute a real band, never ₱0 (DEF-005)" |

**What happens.**

```ts
const unitMin = svc.priceMin ?? 0;
const unitMax = svc.priceMax ?? unitMin;   // 0 when priceMax is null too
```

A `CALL_FOR_PRICE` service (priceMin and priceMax both null) contributes
**₱0 – ₱0** to the itemised estimate, with `isVariable: true` on the line.

**Business impact.** A customer selecting Undercoating sees **"Undercoating ₱0"**
in an itemised quote and can reasonably conclude the undercoating is free. It is
then charged at the counter. That is a misrepresented price, not a UI nit.

**Fix.** Give `CALL_FOR_PRICE` services a real band — either a configured
per-service estimate range in the catalogue, or a shop-level floor/ceiling
(`CALL_FOR_PRICE_MIN_PHP`) applied consistently and shown as a band. The brief
requires "a wide band with `isVariable`", not a zero.

---

## DEF-006 — A percent-off discount does not scale the upper bound

| | |
| --- | --- |
| **Severity** | High |
| **Area** | Pricing |
| **Owner** | backend-core |
| **File** | `src/lib/server/quote.ts` |
| **Line** | 286–290 |
| **Failing test** | `tests/unit/quote-math.test.ts` → "a percent discount must scale BOTH bounds proportionally" |

**What happens.** One peso amount is computed from the floor and subtracted from
**both** bounds:

```ts
const discount  = Math.round(subtotalMin * promo.percentOff / 100);
const min = subtotalMin - discount;
const max = subtotalMax - discount;     // ← flat subtraction
```

15% off a ₱1,800–₱3,400 basket yields **₱1,530 – ₱3,070**, when the true 15%-off
band is **₱1,530 – ₱2,890**. The ceiling is ₱180 higher than the shop intends to
honour.

**Business impact.** The estimator is the funnel's honesty gate. A customer who
reads the top of the band as a ceiling has been quoted a number the shop does not
intend to honour. At the counter that is a dispute, or a DTI complaint.

**Fix.**

```ts
const factor = 1 - promo.percentOff / 100;
const min = Math.max(0, Math.round(subtotalMin * factor));
const max = Math.max(min, Math.round(subtotalMax * factor));
```

and compute `savings.amount` as `subtotalMin - min` so the three numbers agree.

---

## DEF-007 — Three of the six seeded promotions are inert

| | |
| --- | --- |
| **Severity** | High |
| **Area** | Pricing / business |
| **Owner** | backend-core (`src/lib/server/quote.ts`) with marketing (`promotions.ts`) |
| **File** | `src/lib/server/quote.ts` |
| **Line** | 147–148 |
| **Failing test** | `tests/unit/quote-math.test.ts` → "honours every promo kind the seed actually uses" |

**What happens.** `evaluatePromo` only reads arithmetic from two kinds:

```ts
const percentOff = promo.kind === "PERCENT_OFF" ? … : 0;
const fixedOff   = promo.kind === "FIXED_OFF"   ? … : 0;
```

Cross-referencing `src/content/marketing/promotions.ts`:

| Code | Kind | Carries | `evaluatePromo` says |
| --- | --- | --- | --- |
| `RAINYSAFE` | `BUNDLE` | `valueOff: 950` | `NOT_ELIGIBLE` — **inert** (priority 100, the hero promo) |
| `TIRESAVE` | `CLEARANCE` | `valuePct: 10` | `NOT_ELIGIBLE` — **inert** (priority 90) |
| `MYCHECK` | `SEASONAL` | `valueOff: 300` | `NOT_ELIGIBLE` — **inert** |
| `NEIGHBOUR` | `FIXED_OFF` | `valueOff: 300` | `APPLIED` |
| `FIRSTPMS` | `PERCENT_OFF` | `valuePct: 15` | `APPLIED` |
| `BDAYEYG` | `PERCENT_OFF` | `valuePct: 12` | `APPLIED` |

**Business impact.** `/deals` advertises "Rainy Season Safety Bundle — ₱950
off" as the hero promotion. A customer types `RAINYSAFE` into the booking form
and **nothing happens**. Half the seeded promotions are a promise the code does
not keep.

**Fix.** Either read `valuePct`/`valueOff` for every kind that carries them
(`BUNDLE`, `CLEARANCE`, `SEASONAL`, `TIRES`), or restrict the seed to
`PERCENT_OFF`/`FIXED_OFF`. Whichever is chosen, add a test that every code in
`PROMO_CODES` evaluates to `APPLIED` — that test is the one currently failing.

---

## DEF-008 — A non-finite price serialises to `null`

| | |
| --- | --- |
| **Severity** | Low |
| **Area** | Robustness |
| **Owner** | backend-core |
| **File** | `src/lib/server/quote.ts` |
| **Line** | 282–290 |
| **Failing test** | `tests/unit/quote-math.test.ts` → "never emits a non-finite min/max" |

**What happens.** Nothing sanitises the arithmetic. A non-finite value becomes
`null` in `JSON.stringify`, so a client renders `₱null`, violating
`QuoteEstimateDto.min: number`.

**Business impact.** None today — `priceMin` is `Int?` in Postgres so NaN cannot
arrive from the database. It is one `Float` column away, and the failure mode is a
visible `₱null` on the highest-trust surface on the site.

**Fix.** `const safe = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0);`
applied to every amount before it reaches the DTO.

---

## DEF-009 — `PROMO_BLURB` sends a UCS-2 SMS and costs 3×

| | |
| --- | --- |
| **Severity** | Medium |
| **Area** | Copy / cost |
| **Owner** | marketing |
| **File** | `src/content/marketing/copy.ts` |
| **Line** | 327 |
| **Failing test** | `tests/unit/sms-length.test.ts` → "every template is GSM-7 encodable" |

**What happens.**

```
"{{sender}}: {{title}} — {{value}} until {{end}}. "
                 ↑ U+2014 EM DASH
```

U+2014 is **not** in the GSM 03.38 basic character set. One character downgrades
the whole message to UCS-2, which means a 1-segment promo blurb is billed as
**3 segments** (70/70/57) and a GSM-unaware handset renders `?` instead of the
dash.

`smsLength()` uses `.length` (UTF-16 code units) and `assertSmsFits()` only
compares that to 160 — so neither guard can see it.

**Business impact.** Direct cost on every promo SMS, plus a visible `?` in the
message.

**Fix.** Replace the em dash with `-` (or ` to `). Long term, `smsLength()` must
count GSM-7 **septets**, and `assertSmsFits()` must reject any non-GSM-7
character — the test file carries a correct GSM 03.38 counter.

---

## DEF-010 — `assertSmsFits` does not detect an unsubstituted placeholder

| | |
| --- | --- |
| **Severity** | Medium |
| **Area** | Copy / reliability |
| **Owner** | marketing |
| **File** | `src/content/marketing/copy.ts` |
| **Line** | 420–430 |
| **Failing test** | `tests/unit/sms-length.test.ts` → "the documented send gate — refuses a message that still has a placeholder" |

**What happens.** `renderSms` deliberately leaves a missing token as `{{token}}`
(correct: a typo must be visible in preview). But `assertSmsFits` — documented as
"the notification layer and the QA unit test call this" — checks **length only**.

**Business impact.** A booking confirmation can go out reading
`EYG Tire: booked. Ref EYG-7F3K9A on {{date}}, {{time}}…` and still pass the
gate, because it is short. The customer receives a message with template braces
in it.

**Fix.** `assertSmsFits` must throw when `/{{\w+}}/` still matches after
rendering, naming the token.

---

## DEF-011 — `BOOKING_CONFIRMED` does not fit in one SMS segment

| | |
| --- | --- |
| **Severity** | High |
| **Area** | Copy / reliability |
| **Owner** | marketing |
| **File** | `src/content/marketing/copy.ts` |
| **Line** | 251–253 |
| **Failing test** | `tests/unit/sms-length.test.ts` → "BOOKING_CONFIRMED fits 160 with three real service names" |

**What happens.** The template has 70 characters of literal overhead. With the
module's own documented worst case — sender + a real reference + a real date + a
real time + three real service names + "+N more" — it renders **169 characters**,
9 over the limit:

```
EYG Tire: booked. Ref EYG-7F3K9A on Wed 11 Mar, 9:00 AM. Brake Pad Replacement
(front axle), Tyre Balance, PMS A + 5 more. EGSA Fourlanes, Tuyo. Reply CALL
to change it.
```

`assertSmsFits` therefore **throws on every booking with three ordinary
services**, so the confirmation SMS is never sent.

**The source comment is wrong**: "Longest rendered message is BOOKING_CONFIRMED
at 147 chars … every other template has 30+ characters of slack." That was
measured with short placeholders, not real data.

**Business impact.** The funnel's final step silently fails. The customer never
receives the reference they are supposed to quote at the counter, and the shop
front-desk has to look it up by name.

**Fix.** Cut the literal to leave room — the date, the street and the
`Reply CALL` instruction are three candidates. The test also asserts every
template leaves ≥70 characters of slack for its values, which is the structural
fix: **budget the template against a realistic payload, not a placeholder.**

---

## DEF-012 — The CSRF allowlist is derived from the request's own `Host`

| | |
| --- | --- |
| **Severity** | Medium |
| **Area** | Security |
| **Owner** | backend-core |
| **File** | `src/middleware.ts` |
| **Line** | 97 |
| **Failing test** | `tests/integration/csrf.test.ts` → "a Host header the attacker controls must not be able to authorise its own Origin" |
| **OWASP** | A01:2021 Broken Access Control / A05:2021 Security Misconfiguration |

**What happens.**

```ts
const allowed = new Set<string>([
  env.siteUrl,
  `http${env.isProduction ? "s" : ""}://${host ?? ""}`,
  `https://${host ?? ""}`,
  `http://${host ?? ""}`,          // ← plaintext http is trusted in production
]);
```

`host` comes from the request's `Host` header. An attacker who can point a
hostname at the origin sends `Host: evil.example` + `Origin: https://evil.example`
and the check **passes** (confirmed: the middleware returns 200, not 403).

**What it is not.** This is *not* drive-by CSRF — a victim browser cannot set
`Host`, so the classic `<form>` attack is still blocked (and
`tests/integration/csrf.test.ts` proves it is).

**What it is.** An open cross-origin write primitive for anyone who can reach
the origin directly with a chosen `Host` — which is exactly the shape of a
host-header-poisoning attack. It also means the allowlist is not doing the job
it exists to do.

**Business impact.** A booking or lead can be created from an origin the shop
never approved. Combined with a spam run, that fills the front desk's board with
bookings nobody made.

**Fix.**

```ts
const allowed = new Set<string>([env.siteUrl]);
if (!env.isProduction) {
  // localhost / LAN only, and only over http.
  for (const candidate of [`http://localhost:${port}`, `http://${host ?? ""}`]) allowed.add(candidate);
}
// Never add `http://${host}` in production, and never add `https://${host}`.
```

---

## Closed defects

*(none yet — move rows here with the date, the commit, and which test turned
green.)*
