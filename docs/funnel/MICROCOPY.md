# MICROCOPY — the complete string deck

**Owner:** funnel agent · **Status:** paste-ready. Every string below ships as written
unless the `notes` column says a value is interpolated from config or the database.
Keys are the contract: components look strings up by key, not by index.

**Voice rules applied to every line in this file**

- Short sentences. One idea per sentence. No sentence over 20 words.
- Second person. Present tense. Active voice.
- Filipino automotive vocabulary where locals actually use it: PMS, PMS A/B, wheel
  alignment, tire rotation, vulcanizing, undercoating, change oil, brake pad, shock
  absorbers, CVL, bushing, car aircon, roadside, breakdown, ayusin, bay, CW.
- No jargon that a car owner in Balanga would not say to a mechanic.
- No hype. No superlative that needs proof. No exclamation-mark stacking — **maximum
  one `!` per screen**, and the shop should rarely earn it.
- Never blame the customer. Never blame the technology. Say what happened, say what
  they can do.
- No `TODO`, no `Lorem`, no placeholder copy, no `example.com`.

---

## 1. Global / chrome

| key | string | notes |
| --- | --- | --- |
| `a11y.skip` | `Skip to main content` | first focusable element on every page |
| `brand.name` | `EYG Tire & Auto Care` | from `BUSINESS.legalName` |
| `brand.short` | `EYG` | `BUSINESS.shortName` |
| `brand.tagline` | `Balanga's tyre & auto care pit stop.` | `BUSINESS.tagline` |
| `nav.menu` | `Menu` | hamburger, ≤ 767 px |
| `nav.close` | `Close menu` | |
| `nav.services` | `Services` | |
| `nav.book` | `Book a Service Bay` | primary label, page map locked |
| `nav.deals` | `Deals` | |
| `nav.gallery` | `Gallery` | |
| `nav.about` | `About` | |
| `nav.contact` | `Contact` | |
| `nav.privacy` | `Privacy` | footer only |
| `nav.terms` | `Terms` | footer only |
| `header.call.label` | `Call` | visible; `aria-label` is the long form below |
| `header.call.aria` | `Call EYG Tire & Auto Care at {BUSINESS.phoneDisplay}` | |
| `header.call.sub` | `Open {hoursSummary}` | e.g. `Open Mon–Sat 8–5` |
| `header.book` | `Book a Service Bay` | ≥ 768 px only |
| `status.open` | `Open now · until {closesAt}` | |
| `status.closed` | `Closed now · opens {weekday} at {opensAt}` | |
| `status.closing` | `Closing soon · {minutesLeft} minutes left` | hazard hatch, ≤ 60 min remaining |
| `status.opening` | `Opening soon · back at {opensAt}` | hazard hatch, first 30 min |
| `hours.label` | `Shop hours` | |
| `hours.today` | `Today` | |
| `hours.closedDay` | `Closed` | Sunday |
| `hours.shortWeek` | `Mon` `Tue` `Wed` `Thu` `Fri` `Sat` `Sun` | |
| `bar.call` | `Call Shop Now` | mobile action bar, left |
| `bar.message` | `Message` | visible; `aria-label` below |
| `bar.message.aria` | `Message EYG Tire & Auto Care on Messenger` | |
| `bar.directions` | `Get directions` | `/contact` mode, left |
| `bar.phone.aria` | `Call the shop` | icon-only, `/book` merged bar |
| `bar.close` | `Hide` | never rendered on content routes; exists for the overlay-suppression path |

---

## 2. Emergency roadside banner

| key | string | notes |
| --- | --- | --- |
| `roadside.eyebrow` | `Roadside` | `eyg-eyebrow`, brand-500 |
| `roadside.headline` | `Stranded on the road? Call us now.` | the only `h2` in the banner |
| `roadside.secondary` | `Roadside tyre help along the EGSA stretch and around Tuyo. Save this number before you need it.` | max 2 lines at 360 px |
| `roadside.call` | `Call Shop Now` | `emergency` variant |
| `roadside.callSub` | `{BUSINESS.phoneDisplay}` | shown when it fits; never hidden |
| `roadside.message` | `Message on Messenger` | `ghost` variant |
| `roadside.closed.headline` | `The shop is closed right now. We open {weekday} at {opensAt}.` | closed-hours variant |
| `roadside.closed.secondary` | `Send us a message and we'll reply in the morning. If you're stranded, the number on your roadside assistance is the fastest way in.` | |
| `roadside.closed.pill` | `Closed now · opens {weekday} {opensAt}` | |
| `roadside.closed.callSub` | `We usually answer fast when we're open.` | sub-note on the secondary call button |

---

## 3. Homepage `/`

| key | string | notes |
| --- | --- | --- |
| `home.title` | `Tyres and PMS, priced before we start.` | `h1`, `text-display-1` |
| `home.sub` | `EYG Tire & Auto Care, EGSA Fourlanes, Tuyo, Balanga City. See the price range, pick a bay, and we'll text you when it's ready.` | |
| `home.hero.bookSub` | `No account needed. Takes about a minute.` | above primary CTA |
| `home.hero.book` | `Book a Service Bay` | primary |
| `home.hero.callSub` | `Open Monday to Saturday, 8 AM to 5 PM.` | above secondary CTA |
| `home.hero.call` | `Call the shop` | secondary |
| `home.hero.quoteSub` | `Not ready to book? Get a range first.` | above tertiary CTA |
| `home.hero.quote` | `Check prices first` | tertiary → `/#price-estimator` |
| `home.trust.1` | `Real price ranges, before you book.` | proof strip |
| `home.trust.2` | `We ask before adding anything to your bill.` | |
| `home.trust.3` | `Three bays, booked by the hour.` | |
| `home.trust.4` | `We text you when your car is ready.` | |
| `svc.eyebrow` | `WHAT WE DO` | |
| `svc.heading` | `Everyday car care, done in one bay.` | `h2` |
| `svc.sub` | `PMS A and B, tyre change, vulcanizing, wheel alignment, brakes, undercoating, car aircon.` | |
| `svc.card.badgePopular` | `MOST BOOKED` | when `isPopular` |
| `svc.card.badgeFeatured` | `SHOP FAVOURITE` | when `isFeatured` |
| `svc.card.included` | `What's included` | |
| `svc.card.more` | `+{n} more` | disclosure |
| `svc.card.duration` | `about {formatDuration(durationMin)}` | hidden when null |
| `svc.card.cta` | `Select {shortName} & pick date` | per-service CTA, required by the brief |
| `svc.card.ctaAria` | `Select {name} and pick a date` | full name, when `shortName` is shorter |
| `svc.card.help` | `We'll confirm the final price before we start.` | above the CTA |
| `svc.card.callPrice` | `We price this after we see the car. Call and ask.` | `CALL_FOR_PRICE` only |
| `price.eyebrow` | `PRICES` | |
| `price.heading` | `Price ranges, not surprises.` | `h2` |
| `price.sub` | `Every service shows what it costs before you book. If something extra turns up, we ask first.` | |
| `book.eyebrow` | `BOOK A BAY` | |
| `book.heading` | `Pick a day and a time that suits you.` | `h2` |
| `book.sub` | `Three bays. Book online and we'll text you to confirm.` | |
| `book.ctaSub` | `About a minute. No account, no payment.` | above CTA |
| `book.cta` | `Book a Service Bay` | primary |
| `why.eyebrow` | `THE SHOP` | |
| `why.heading` | `A real shop in Tuyo, Balanga City.` | `h2` |
| `why.sub` | `On EGSA Fourlanes, easy to spot from the main road. Open Monday to Saturday, 8 AM to 5 PM.` | |
| `why.ask` | `Ask any question before you book. We don't mind.` | above CTA |
| `why.cta` | `Call and ask` | secondary |
| `faq.eyebrow` | `BEFORE YOU COME` | |
| `faq.heading` | `The things people ask us most.` | `h2` |
| `faq.more` | `See all services` | tertiary |
| `loc.eyebrow` | `FIND US` | |
| `loc.heading` | `EGSA Fourlanes, Tuyo, Balanga City.` | `h2` |
| `loc.help` | `{ADDRESS_ONE_LINE}` | above CTA |
| `loc.cta` | `Get directions` | secondary |
| `home.repeatCallSub` | `Still deciding? Just ask us.` | above the 4th call CTA |
| `home.repeatCall` | `Call Shop Now` | emergency |

---

## 4. Estimator

| key | string | notes |
| --- | --- | --- |
| `est.eyebrow` | `PRICE ESTIMATE` | |
| `est.heading` | `What would this cost me?` | `h2` |
| `est.sub` | `Pick your car and the work. You get a range, not a locked price. We confirm the real number before we start.` | |
| `est.engine.label` | `What kind of engine?` | |
| `est.engine.help` | `This changes oil, filters and some part prices.` | |
| `est.engine.gasoline` | `Gasoline` | |
| `est.engine.diesel` | `Diesel` | |
| `est.engine.hybrid` | `Hybrid` | |
| `est.engine.electric` | `Electric` | |
| `est.engine.unknown` | `Not sure` | default |
| `est.vehicle.label` | `Your car` | |
| `est.vehicle.help` | `Optional. It helps us pick the right parts.` | |
| `est.vehicle.year` | `Year` | |
| `est.vehicle.make` | `Make` | |
| `est.vehicle.model` | `Model` | |
| `est.vehicle.notSure` | `Not sure` | chip on make and model |
| `est.services.label` | `What needs doing?` | |
| `est.services.help` | `Tick everything you want in one visit.` | |
| `est.tyres.label` | `New tyres?` | |
| `est.tyres.help` | `Just the fitting and balancing, or tyres too?` | |
| `est.tyres.count` | `How many tyres?` | |
| `est.tyres.size` | `Tyre size` | |
| `est.tyres.sizeHelp` | `You'll find it on the sidewall. Example: 205/55 R16.` | |
| `est.tyres.sizeRequired` | `Add your tyre size, or call us and read it to us.` | required when count > 0 |
| `est.bundle.label` | `Or a bundle` | |
| `est.bundle.help` | `A bundle is cheaper than the same parts bought separately.` | |
| `est.promo.toggle` | `Have a promo code?` | collapsed disclosure |
| `est.promo.label` | `Promo code` | |
| `est.promo.apply` | `Apply` | |
| `est.promo.invalid` | `We don't have a code "{input}". Check the spelling, or ask us on Messenger.` | |
| `est.promo.expired` | `{CODE} ended on {date}.` | |
| `est.promo.alreadyUsed` | `You've already used {CODE} on a previous booking. One per customer.` | |
| `est.promo.notEligible` | `{CODE} applies to services and labour, not to tyres.` | |
| `est.promo.unreachable` | `We couldn't check that code right now. The estimate below is without the discount.` | |
| `est.result.single` | `Your estimate` | variant heading |
| `est.result.singleSub` | `Parts and labour. {duration} in the bay.` | |
| `est.result.split` | `Here's what we can price now.` | |
| `est.result.splitLabel` | `Services and labour` | |
| `est.result.wide` | `Here's a wider range.` | |
| `est.result.wideNote` | `The top of this range is for a car that needs more than the usual parts. We'll tell you before we start.` | |
| `est.result.human` | `We'll price this for you.` | **no figure rendered** |
| `est.result.humanSub` | `Send us the details and we'll give you a fixed number, usually the same day.` | |
| `est.result.humanBrakes` | `Brake parts are priced on the car — the brand, the thickness, and whether the disc needs turning all change the number.` | |
| `est.line.willPrice` | `we'll price` | replaces the figure on a variable line |
| `est.line.qty` | `{q} ×` | prefix on multi-quantity lines |
| `est.total.label` | `Estimate` | **never** `Total` |
| `est.total.discountLabel` | `{CODE} on labour` | |
| `est.total.savings` | `You save about {formatPeso(amount)} with {CODE}.` | |
| `est.total.checked` | `Prices checked at {HH:MM}.` | replaces any countdown |
| `est.total.hold` | `We hold these prices until {HH:MM}.` | only when not approximate and not converted |
| `est.total.slots` | `That's {n} bay slots.` | |
| `est.disclaimer` | `This is a range, not a final price. It uses the price list we have today. We confirm the total with you before any work starts, and we won't add anything without your go-ahead.` | **unconditional, on every variant, above every CTA** |
| `est.cta.bookSub` | `Your selection is carried over. Nothing is booked yet.` | |
| `est.cta.book` | `Book a Service Bay with this` | when `nextStep.label` is not overridden |
| `est.cta.sendSub` | `We'll text you a fixed price. No booking, no payment.` | |
| `est.cta.send` | `Send this to the shop` | when `nextStep.label` says so |
| `est.cta.call` | `Call the shop` | tertiary |
| `est.cta.inlineText` | `Send me this estimate by text` | **always visible**, mobile substitute for exit-intent |
| `est.deactivated` | `We had to remove {ServiceName} from this estimate — it's not on our list right now.` | |
| `est.deactivatedLink` | `See current services` | |

### Exit-intent capture

| key | string | notes |
| --- | --- | --- |
| `cap.title` | `Want a fixed number?` | `role="region"`, not a dialog |
| `cap.sub` | `Send this to the shop and we'll text you the exact price. Nothing is booked and nothing is charged.` | |
| `cap.name` | `Your name` | optional |
| `cap.nameHelp` | `Optional. We can look you up by number.` | |
| `cap.phone` | `Mobile number` | |
| `cap.phoneHelp` | `We'll text you the fixed price.` | |
| `cap.consent` | `Yes, text me about this estimate. I agree to get one text message with a price for my car. Message and data rates may apply. I can reply STOP any time.` | **unchecked** |
| `cap.consentError` | `Tick the box if you want the text. Or call us instead.` | |
| `cap.captcha` | `Quick check: {question}` | |
| `cap.send` | `Send to the shop` | primary |
| `cap.decline` | `No thanks, I'll book instead` | secondary, equal weight |
| `cap.success` | `Sent. We'll text you a fixed price for {vehicleLabel}, usually the same day. Your reference is {reference}. Your estimate is still on screen — you can still book with it.` | inline; no navigation |
| `cap.error` | `We couldn't send that. Your details are still here.` + `Try again` | |

---

## 5. Services `/services`

| key | string | notes |
| --- | --- | --- |
| `services.title` | `Tyre and auto care services in Balanga City.` | `h1` |
| `services.sub` | `Every price below is a range we actually work within. Pick what you need, then pick a day.` | |
| `services.bookSub` | `Pick a day after you choose your services.` | above CTA |
| `services.book` | `Book a Service Bay` | primary |
| `services.filter.label` | `Filter` | |
| `services.filter.clear` | `Clear filters` | ghost |
| `services.filter.count` | `{n} services` | `aria-live="polite"` |
| `services.zero.heading` | `No services match "{query}".` | |
| `services.zero.body` | `We probably still do it. These are the closest:` | |
| `services.zero.call` | `Call and ask about your car` | secondary |
| `services.category.all` | `All` | |
| `services.package.badge` | `{PackageDto.badge}` | verbatim |
| `services.package.items` | `{n} services` | |
| `services.package.savings` | `Saves about {savingsPct}%` | only when `savingsPct` is non-null |
| `services.package.compareAt` | `{formatPeso(compareAtMin)}` | strikethrough, only when `compareAtMin > priceMin` |
| `services.package.cta` | `Select {shortName} & pick date` | |
| `services.tray.label` | `{n} selected · about {duration}` | |
| `services.tray.price` | `Estimate {formatPesoRange(min,max)}` | |
| `services.tray.cta` | `Review and pick a date` | |
| `services.allLabel` | `All services` | |
| `services.estLink` | `Not sure what you need? Get a price range first.` | tertiary → `#price-estimator` |

---

## 6. Booking flow `/book`

### 6.1 Frame

| key | string | notes |
| --- | --- | --- |
| `book.title` | `Book a service bay` | `h1` |
| `book.progress` | `Step {n} of 4` | polite live region |
| `book.stepNames` | `Vehicle` · `Services` · `Date & Time` · `Contact` | stepper labels, also in `Continue to {…}` |

### 6.2 Step 1 — Vehicle

| key | string | notes |
| --- | --- | --- |
| `book.s1.heading` | `What are we working on?` | `h2`, focus target |
| `book.s1.sub` | `We use this to pick parts and price. You can skip it.` | |
| `book.s1.year` | `Year` | |
| `book.s1.yearHelp` | `Model year, like 2019.` | |
| `book.s1.yearPlaceholder` | `2019` | |
| `book.s1.yearError` | `Enter a 4-digit year, like 2019.` | |
| `book.s1.yearErrorRange` | `That year looks off. Use the year on your registration.` | |
| `book.s1.make` | `Make` | |
| `book.s1.makeHelp` | `Start typing. Most cars are already here.` | |
| `book.s1.makePlaceholder` | `Search make…` | |
| `book.s1.makeError` | `Type at least 2 letters, or use "Not in the list".` | |
| `book.s1.model` | `Model` | |
| `book.s1.modelHelp` | `{make}-specific. Start typing.` | |
| `book.s1.modelPlaceholder` | `Search model…` | |
| `book.s1.modelError` | `Pick a model, or use "Not in the list".` | |
| `book.s1.manual` | `Not in the list? Enter it yourself` | **escape hatch, P0** |
| `book.s1.manualHelp` | `No problem. Type what you call it — we'll work it out at the counter.` | |
| `book.s1.manualMake` | `Your make` | |
| `book.s1.manualModel` | `Your model` | |
| `book.s1.variant` | `Variant (optional)` | |
| `book.s1.variantHelp` | `Like Hybrid, VR-X, or 1.5.` | |
| `book.s1.variantPlaceholder` | `Optional` | |
| `book.s1.variantError` | `Keep this under 40 characters.` | |
| `book.s1.plate` | `Plate number (optional)` | |
| `book.s1.plateHelp` | `We use this to find your car when you arrive.` | |
| `book.s1.platePlaceholder` | `ABC 1234` | |
| `book.s1.plateError` | `Use letters, numbers and spaces only, like ABC 1234.` | |
| `book.s1.mileage` | `Mileage in km (optional)` | |
| `book.s1.mileageHelp` | `Helps us pick the right oil and filters.` | |
| `book.s1.mileagePlaceholder` | `45000` | |
| `book.s1.mileageError` | `Enter mileage as a number, like 45000.` | |
| `book.s1.switcher.label` | `Booking for` | |
| `book.s1.switcher.change` | `Change` | |
| `book.s1.switcher.add` | `Add another vehicle` | secondary |
| `book.s1.switcher.help` | `One booking is one car. Finish this one first, then start again — we'll keep your second date and vehicle ready.` | |
| `book.s1.switcher.bothHelp` | `Two bays are free at {time}, so both cars can go in together. We'll still book them as two separate bookings so each car gets its own bay time.` | only when `capacityLeft >= 2` |
| `book.s1.skip` | `Skip for now — I'll tell you at the counter` | ghost, **P0** |
| `book.s1.skipHelp` | `You can still book. We just won't know your car in advance.` | |

### 6.3 Step 2 — Services

| key | string | notes |
| --- | --- | --- |
| `book.s2.heading` | `What needs doing?` | `h2` |
| `book.s2.sub` | `Tick everything you want in one visit.` | |
| `book.s2.bundleHeading` | `Or pick a bundle` | |
| `book.s2.bundleHelp` | `A bundle is cheaper than the same parts bought separately.` | |
| `book.s2.empty` | `Choose at least one service to pick a time.` | primary label when 0 selected |
| `book.s2.emptyHelp` | `Pick the work you need, then pick a time.` | |
| `book.s2.max` | `That's more than 8 services. Book them separately, or call us and we'll sort it out.` | |
| `book.s2.priceUnknown` | `+ 1 item we'll price when we see the car.` | under the total when a `CALL_FOR_PRICE` item is selected |
| `book.s2.totalLabel` | `Estimate` | |
| `book.s2.conflict` | `{ServiceName} is already in {PackageName}. We'll leave the bundle as it is and ignore the extra one.` | |
| `book.s2.conflict.remove` | `Remove {ServiceName}` | |
| `book.s2.conflict.separate` | `Switch to paying separately` | |
| `book.s2.promo.toggle` | `Have a promo code?` | |
| `book.s2.promo.applied` | `{CODE} applied. It saves about {formatPeso(amount)} on labour.` | |
| `book.s2.promo.notEligible` | `This code can't be used on that item.` | when a clamped/zero discount is suppressed |
| `book.s2.summary` | `{n} selected · about {formatDuration(minutes)}` | |

### 6.4 Step 3 — Date & Time

| key | string | notes |
| --- | --- | --- |
| `book.s3.heading` | `Pick a day and an hour` | `h2` |
| `book.s3.sub` | `Three bays. Times fill up, so pick the one you'll actually make.` | |
| `book.s3.range` | `Next {n} days` | date strip group label |
| `book.s3.prevWeek` | `Earlier days` | |
| `book.s3.nextWeek` | `Later days` | |
| `book.s3.dayFull` | `Full` | chip micro-label; icon + text, never colour alone |
| `book.s3.dayFullAria` | `{weekday} {date}, no bays free` | |
| `book.s3.dayClosed` | `Closed` | when `isClosed` |
| `book.s3.todayGone` | `Today's bays are taken. Earliest we have is {nextDate}.` | min-lead exhausted |
| `book.s3.slotsFor` | `{weekdayLong} {dateLong}` | group heading for the radio group |
| `book.s3.bays` | `{n} bays` | capacity line, verbatim from `capacityLeft` |
| `book.s3.lastBay` | `Last bay` | at `capacityLeft === 1` |
| `book.s3.full` | `Full` | at 0, disabled |
| `book.s3.recommended` | `★ Recommended` | on `isBest`, max one per day |
| `book.s3.reason2` | `Two bays free — easier to shift if your plans change.` | `capacityLeft >= 2` |
| `book.s3.reason1` | `Last bay free at this time.` | `capacityLeft === 1` |
| `book.s3.reasonFallback` | `Earliest slot we have.` | server sent no `isBest` |
| `book.s3.hold` | `We'll hold {time} for 10 minutes while you fill in your details.` | `BOOKING.holdMinutes` |
| `book.s3.holdEnded.heading` | `Your 10-minute hold on {time} ended.` | |
| `book.s3.holdEnded.body` | `Pick a time again — nothing was booked and nothing was charged.` | |
| `book.s3.empty.heading` | `No bays left on {date}.` | |
| `book.s3.empty.body` | `Next open: {nextDate} at {nextTime}.` | |
| `book.s3.empty.jump` | `See {nextDate}` | tertiary |
| `book.s3.empty.call` | `Call the shop` | secondary |
| `book.s3.closed` | `{closedReason}` | from `SlotAvailabilityDto.closedReason` |
| `book.s3.closedCta` | `See open days` | |
| `book.s3.loadError.heading` | `We couldn't load the bays for {date}.` | |
| `book.s3.loadError.body` | `Pick another day, or call us.` | |
| `book.s3.loadError.retry` | `Try again` | |
| `book.s3.offline.heading` | `You're offline, so we can't load today's bays.` | |
| `book.s3.offline.body` | `Calling works without data.` | |
| `book.s3.offline.call` | `Call Shop Now` | primary in this state |
| `book.s3.offline.retry` | `Try again` | secondary |

### 6.5 Step 4 — Contact & Confirm

| key | string | notes |
| --- | --- | --- |
| `book.s4.heading` | `Check this, then we'll book it` | `h2` |
| `book.s4.sub` | `Nothing is charged now. You pay at the counter. We take cash, GCash, Maya, cards, and credit installment.` | |
| `book.s4.reviewLabel` | `Your booking` | |
| `book.s4.review.change` | `Change` | moves **focus**, not just scroll |
| `book.s4.name` | `Your name` | |
| `book.s4.nameHelp` | `So we know who's coming.` | |
| `book.s4.namePlaceholder` | `Maria Santos` | |
| `book.s4.nameError` | `Enter your name so we know who to look for.` | |
| `book.s4.phone` | `Mobile number` | |
| `book.s4.phoneHelp` | `We'll text you this confirmation.` | |
| `book.s4.phonePlaceholder` | `+63 917 123 4567` | |
| `book.s4.phoneError` | `Enter a PH mobile number, like 09 17 123 4567.` | |
| `book.s4.phoneErrorShort` | `That number is 1 digit short. PH mobile numbers are 11 digits.` | |
| `book.s4.email` | `Email (optional)` | |
| `book.s4.emailHelp` | `For your receipt. Skip it if you prefer.` | |
| `book.s4.emailPlaceholder` | `maria@email.com` | |
| `book.s4.emailError` | `That email looks incomplete. Check it or leave it blank.` | |
| `book.s4.notes` | `Anything we should know?` | |
| `book.s4.notesHelp` | `Optional. e.g. knock first, my brakes squeak, I'm coming from Baguio.` | |
| `book.s4.notesError` | `Keep this under 500 characters.` | |
| `book.s4.consentSms` | `Yes, text me about this booking. I agree to get one text message with my booking details and any change to my appointment. Message and data rates may apply. I can reply STOP at any time to stop getting texts.` | **required, unchecked** |
| `book.s4.consentSmsError` | `Tick the box above if you want the text confirmation. Or call us instead and we'll note the same bay.` | |
| `book.s4.consentMarketing` | `Send me offers from EYG Tire & Auto Care. A few messages a month about promos on tyres and maintenance. I can opt out any time.` | **optional, unchecked** |
| `book.s4.callEscape` | `Prefer to confirm by phone?` | **always visible**, weight of the submit button |
| `book.s4.callEscapeLink` | `Call now` | `tel:` |
| `book.s4.captcha` | `Quick check: {question}` | |
| `book.s4.captchaError` | `That answer is not right. Try the new question.` | |
| `book.s4.confirmSub` | `We'll text you a confirmation. Nothing is charged now.` | above the submit |
| `book.s4.confirm` | `Confirm booking` | primary |
| `book.s4.sending` | `Confirming…` | in-flight label |
| `book.s4.slow.heading` | `This is taking longer than usual.` | |
| `book.s4.slow.body` | `Your details are saved — nothing is lost.` | |
| `book.s4.retry` | `Try again` | |
| `book.s4.lost.heading` | `We lost your last step.` | deep-link with no draft |
| `book.s4.lost.body` | `Let's start again — it takes about a minute.` | |
| `book.s4.lost.cta` | `Start again` | |
| `book.s4.fromQuote` | `From your estimate — {n} items, about {duration}.` | deep-link banner |
| `book.s4.offline.heading` | `No connection. We saved your details.` | |
| `book.s4.offline.body` | `We'll send it the moment you're back online. If you're in a hurry, call instead.` | |
| `book.s4.offline.retry` | `Try again now` | |

### 6.6 SMS / WhatsApp confirmation

The promise panel, above the submit button, **always visible, never collapsed.**

| key | string | notes |
| --- | --- | --- |
| `sms.promise.heading` | `We'll text you right away.` | |
| `sms.promise.body` | `You'll get one message like this:` | |
| `sms.promise.preview` | `EYG booked. {dateShort} {time}. Ref {reference}. {items}. Est {peso}. Reply CANCEL to cancel.` | 1 GSM-7 segment, 99 chars at the fixture values |
| `sms.promise.alt` | `If you'd rather not get a text, call us instead — we can still take the bay.` | |
| `sms.reminder.heading` | `We'll text you when your car is ready.` | used in the success list |

Full template as sent:

```
EYG booked. Wed 19 Nov 9:00AM. Ref EYG-7F3K9A. Change Oil, PMS A, est 2050. Reply CANCEL to cancel.
```

- 1 SMS segment (GSM-7, 99 chars). Keep it under 160 for one segment, 320 for two.
- No emoji. No ALL-CAPS words beyond the brand's leading `EYG`.
- `Reply CANCEL` must be a real, handled command. If it is not implemented before
  launch, the template ships without that clause. **Do not promise a keyword that does
  not respond.**

### 6.7 Success

| key | string | notes |
| --- | --- | --- |
| `ok.eyebrow` | `Booking received` | with a tick icon **and** the word |
| `ok.title` | `You're booked for {dateLong} at {time}.` | `h1` |
| `ok.refLabel` | `Reference` | |
| `ok.refHelp` | `Read it out: E-Y-G, dash, then {spelled}.` | alphabet excludes I/O/0/1 so it can be dictated |
| `ok.vehicle` | `{vehicleLabel}` | |
| `ok.vehicleNull` | `Vehicle: we'll ask at the counter` | when `vehicle` is null |
| `ok.items` | `{items joined with " and "}` | `BookingDto.items[]` |
| `ok.estimate` | `Estimate {formatPesoRange(estimateMin, estimateMax)}` | never `Total` |
| `ok.nextHeading` | `What happens next` | `h2` |
| `ok.next1` | `We're texting you now. The message has your reference and the time.` | |
| `ok.next2` | `Bring your plate and a valid ID. If you gave us a plate number, we'll have your car file open.` | |
| `ok.next3` | `We'll call before {time} if anything changes. If you're running late, call us — we can usually hold a bay for 90 minutes.` | `BOOKING.minLeadMinutes` |
| `ok.next4` | `We'll show you the price before we start. Nothing goes on the invoice without your OK.` | |
| `ok.smsHeading` | `What the text will say` | |
| `ok.calendarSub` | `One tap. It lands in your phone's calendar.` | |
| `ok.calendar` | `Add to calendar` | |
| `ok.directionsSub` | `{ADDRESS_ONE_LINE}` | |
| `ok.directions` | `Get directions to the shop` | |
| `ok.callSub` | `Open {hoursSummary}.` | |
| `ok.call` | `Call the shop` | |
| `ok.another` | `Book another service` | |
| `ok.anotherHelp` | `Keeps your car and the date. Starts again on the services.` | |
| `ok.holdNotice` | `We'll hold this bay until {time}.` | only if the hold is still live |

### 6.8 Wizard frame strings

| key | string | notes |
| --- | --- | --- |
| `book.cta.s1` | `Continue to Services` | label names the destination |
| `book.cta.s2` | `Continue to Date & Time` | |
| `book.cta.s3` | `Continue to Your details` | |
| `book.cta.s4` | `Confirm booking` | |
| `book.startOver` | `Start over` | ghost, last |
| `book.startOverConfirm` | `Booking cleared. Starting again.` | live region |
| `book.editAnnounce` | `{Section} — editing. Step {n} of 4.` | focus moved |
| `book.stepAnnounce` | `Step {n} of 4: {name}.` | focus moved to step heading |

---

## 7. Deals `/deals`

| key | string | notes |
| --- | --- | --- |
| `deals.title` | `Deals and promos` | `h1` |
| `deals.sub` | `Running offers only. When something ends, we take it down — this page is never out of date.` | |
| `deals.bookSub` | `Or just book a normal service.` | |
| `deals.book` | `Book a Service Bay` | primary |
| `deals.claim` | `Claim {title}` | |
| `deals.claimSub` | `Use code {code} when you book.` | |
| `deals.termsToggle` | `Read the terms` | **above** the claim button, not behind it |
| `deals.ends` | `Ends {dateLong}` | with `eyg-hazard` edge |
| `deals.expired.heading` | `{title} ended on {dateLong}.` | |
| `deals.expired.body` | `Here's what's on now.` | |
| `deals.expired.cta` | `See current prices` | |
| `deals.none.heading` | `No promos running right now.` | |
| `deals.none.body` | `Tyre clearance and rainy-season bundles come and go. Leave your email and we'll tell you the day one starts.` | |
| `deals.none.email` | `Email` | |
| `deals.none.emailHelp` | `Just promos. A few times a month at most.` | |
| `deals.none.submit` | `Tell me when one starts` | |
| `deals.none.done` | `Done. We'll email you when the next one starts.` | |
| `deals.none.services` | `See regular prices` | |
| `deals.savings` | `Saves about {pct}%` | only when non-null |

---

## 8. Contact `/contact`

| key | string | notes |
| --- | --- | --- |
| `contact.title` | `Find EYG Tire & Auto Care` | `h1` |
| `contact.sub` | `EGSA Fourlanes, Tuyo, Balanga City, Bataan 2100.` | `ADDRESS_ONE_LINE` |
| `contact.landmark` | `{BUSINESS.address.landmark}` | confirmed from the official page |
| `contact.directionsSub` | `Tap to open Google Maps with the route from where you are.` | |
| `contact.google` | `Open in Google Maps` | primary |
| `contact.waze` | `Open in Waze` | secondary |
| `contact.mapAria` | `Map showing EYG Tire & Auto Care on EGSA Fourlanes, Tuyo, Balanga City` | |
| `contact.callSub` | `A person picks up. It's the fastest way to reach us.` | |
| `contact.call` | `Call the shop` | primary |
| `contact.hoursHeading` | `Shop hours` | |
| `contact.hoursToday` | `Today: {summary}` | |
| `contact.hoursNote` | `Closed on Sundays.` | from `BUSINESS_HOURS` |
| `contact.paymentHeading` | `How you can pay` | |
| `contact.paymentSub` | `At the counter, after we've shown you the price.` | |
| `contact.paymentInstallment` | `Ask about installments` | tertiary → WhatsApp |
| `contact.formHeading` | `Send us a message` | |
| `contact.formSub` | `Someone replies within one working day. For anything urgent, call.` | |
| `contact.form.name` | `Your name` | |
| `contact.form.phone` | `Mobile number` | |
| `contact.form.phoneHelp` | `Optional. Only if you'd rather we call you.` | |
| `contact.form.email` | `Email` | |
| `contact.form.message` | `What's up?` | |
| `contact.form.messagePlaceholder` | `e.g. Do you take a Fortuner? How much for a set of 4 tyres?` | |
| `contact.form.send` | `Send message` | |
| `contact.form.sending` | `Sending…` | |
| `contact.form.ok` | `Got it. We'll reply within one working day.` | |
| `contact.form.error` | `We couldn't send that. Your message is still here — try again.` | |
| `contact.social` | `See us on Facebook` | |
| `contact.emailLink` | `{BUSINESS.email}` | TODO-VERIFY — never render a dead mailto |

---

## 9. Gallery `/gallery`

| key | string | notes |
| --- | --- | --- |
| `gallery.title` | `Inside the bay` | `h1` |
| `gallery.sub` | `Our own photos — the bays, the work, before and after. No stock pictures.` | |
| `gallery.bookSub` | `Seen enough? Book a bay.` | |
| `gallery.book` | `Book a Service Bay` | primary |
| `gallery.filter.all` | `All` | |
| `gallery.filter.before` | `Before` | |
| `gallery.filter.after` | `After` | |
| `gallery.filter.bay` | `The bay` | |
| `gallery.filter.diagnostics` | `Diagnostics` | |
| `gallery.filter.team` | `The team` | |
| `gallery.empty.heading` | `We're shooting the bay this week.` | |
| `gallery.empty.body` | `Check back soon, or message us and we'll send you photos of your own car while we work on it.` | |
| `gallery.empty.message` | `Message on Messenger` | primary in this state |
| `gallery.empty.call` | `Call the shop` | secondary |
| `gallery.zoom` | `View photo: {title}` | |
| `gallery.zoomClose` | `Close photo` | |
| `gallery.altRule` | *(alt text comes from `GalleryImage.alt`, required, never invented)* | |

---

## 10. About `/about`

| key | string | notes |
| --- | --- | --- |
| `about.title` | `About EYG Tire & Auto Care` | `h1` |
| `about.sub` | `A tyre and auto care shop on EGSA Fourlanes, Tuyo. Open since 2025.` | `BUSINESS.foundedYear` |
| `about.bookSub` | `Come see us.` | |
| `about.book` | `Book a Service Bay` | primary |
| `about.guaranteeHeading` | `Our workmanship guarantee` | |
| `about.guarantee.body` | `{BUSINESS.trust.workmanshipGuaranteeDays}-day guarantee on the work we do. If something we did isn't right, bring it back and we'll fix it at no charge.` | **30 days is TODO-VERIFY — do not render until the owner confirms** |
| `about.guaranteeBlocked` | `We stand behind our work. Call us and we'll tell you exactly what's covered.` | ship this instead while unverified |
| `about.payHeading` | `How you can pay` | |
| `about.paySub` | `Cash, GCash, Maya, credit or debit card, and credit installment. Nothing is charged online.` | from `BUSINESS.paymentMethods` |
| `about.payInstallment` | `Ask about installments` | |
| `about.brandsHeading` | `Tyre brands we carry` | |
| `about.brandsNote` | `Ask us what's in stock today. Stock changes weekly.` | never "authorised dealer" |
| `about.teamHeading` | `Who you'll meet` | |
| `about.callSub` | `Ask for anything — brake pads, aircon, or just a second opinion.` | |
| `about.call` | `Call the shop` | |

**Blocked until verified** (all `TODO-VERIFY` in `src/config/site.ts`): any
years-in-business counter (`yearsServing: 0` — render the count only when > 0, and
`foundedYear` is the only year claim), any rating (`ratingValue` with
`ratingCount: 0` must render **no stars and no number**), `technicians`, `bays`
(`bays: 0` — the site says "three bays" from `BOOKING.capacityPerSlot`, which is
*also* TODO-VERIFY; if that is not confirmed, say `a few bays`).

---

## 11. Footer

| key | string | notes |
| --- | --- | --- |
| `footer.tagline` | `Balanga's tyre & auto care pit stop.` | |
| `footer.col.book` | `Book` | |
| `footer.col.services` | `Services` | |
| `footer.col.visit` | `Visit` | |
| `footer.col.legal` | `Legal` | |
| `footer.hours` | `Open Monday to Saturday, 8 AM to 5 PM. Closed Sunday.` | from `BUSINESS_HOURS` |
| `footer.address` | `{ADDRESS_ONE_LINE}` | |
| `footer.callSub` | `Tap to call. A person picks up.` | |
| `footer.call` | `Call {BUSINESS.phoneDisplay}` | primary |
| `footer.book` | `Book a Service Bay` | secondary |
| `footer.directions` | `Get directions` | secondary |
| `footer.facebook` | `See us on Facebook` | ghost |
| `footer.payment` | `Cash · GCash · Maya · Card · Credit installment` | |
| `footer.legal` | `© {year} EYG Tire & Auto Care. All rights reserved.` | |
| `footer.fineprint` | `Prices on this site are estimates and ranges, not quotes. The final price is confirmed with you before work starts.` | |
| `footer.madeIn` | *(none — do not ship a credits line)* | |

---

## 12. Loading, empty, error, offline

### 12.1 Loading (skeletons only — see `ERROR-AND-EDGE-STATES.md` §2)

| key | string | notes |
| --- | --- | --- |
| `load.services` | `Loading services` | visually hidden; `aria-busy` container |
| `load.slots` | `Loading available times` | |
| `load.dates` | `Loading days` | |
| `load.estimate` | `Working out your estimate` | |
| `load.reviews` | `Loading reviews` | |
| `load.gallery` | `Loading photos` | |
| `load.location` | `Loading the map` | |
| `load.general` | `Loading` | |
| `load.sending` | `Sending…` | submit only |
| `load.confirming` | `Confirming…` | submit only |
| `load.checking` | `Checking that code…` | promo only |

### 12.2 Empty states

| key | string | notes |
| --- | --- | --- |
| `empty.reviews.heading` | `We haven't put reviews up yet.` | only rendered if a reviews section is required with 0 rows |
| `empty.reviews.body` | `We're a new shop and we don't have a public review page yet. The comments on our Facebook are real — have a look.` | |
| `empty.reviews.cta` | `See us on Facebook` | **never** a placeholder star row |
| `empty.gallery.heading` | `We're shooting the bay this week.` | |
| `empty.gallery.body` | `Check back soon, or message us and we'll send you photos of your own car while we work on it.` | |
| `empty.deals.heading` | `No promos running right now.` | |
| `empty.search.heading` | `No services match "{query}".` | |
| `empty.search.body` | `We probably still do it. These are the closest:` | followed by 3 real suggestions |
| `empty.search.call` | `Call and ask about your car` | |
| `empty.slots.heading` | `No bays left on {date}.` | |
| `empty.vehicle.heading` | `We don't have {make} {model} in our list yet.` | |
| `empty.vehicle.body` | `That's fine — tell us what you need and we'll confirm the price by text.` | |
| `empty.vehicle.cta` | `Enter it yourself` | escape hatch |
| `empty.inbox` | *(none — no inbox exists)* | |

### 12.3 Error states (full text in `ERROR-AND-EDGE-STATES.md`)

| key | string | notes |
| --- | --- | --- |
| `error.404.title` | `We don't have that page.` | |
| `error.404.body` | `The link may be old, or we may have moved something. Here's the way back.` | |
| `error.500.title` | `Something broke on our side.` | |
| `error.500.body` | `This isn't your fault. Try again, or call us and we'll sort it out.` | |
| `error.403.title` | `You can't see that page.` | |
| `error.403.body` | `If you think you should be able to, call us and we'll help.` | |
| `error.429.title` | `Slow down a moment.` | |
| `error.429.body` | `Too many attempts from this connection. Try again in {n} seconds.` | |
| `error.maint.title` | `We're doing some work on the site.` | |
| `error.maint.body` | `The shop is still open and still taking calls. Book or call on the usual number.` | |
| `error.offline.title` | `You're offline.` | |
| `error.offline.body` | `This page needs a connection. Calling works without one.` | |
| `error.comingSoon.title` | `{Feature} is not ready yet.` | only for genuinely announced features |
| `error.comingSoon.body` | `We're building it. In the meantime, this gets you the same thing:` | |
| `error.call` | `Call Shop Now` | present on every error route |
| `error.retry` | `Try again` | 429 / 500 / maintenance only |
| `error.home` | `Go to the homepage` | 404 only |
| `error.services` | `See all services` | 404 only |
| `error.detail` | `Reference: {requestId}` | shown to support, `text-body` 12 px |

---

## 13. Legal pages

| key | string | notes |
| --- | --- | --- |
| `legal.privacy.title` | `Privacy` | `h1` |
| `legal.terms.title` | `Terms` | `h1` |
| `legal.lastUpdated` | `Last updated {dateLong}` | never "today" |
| `legal.bodyIntro.privacy` | `This page says what we collect when you use this site, and what we do with it. Plain language, no clauses for the sake of clauses.` | |
| `legal.bodyIntro.terms` | `These are the rules for using this site and for booking with us. They're written to be read.` | |
| `legal.notice` | `This page is a starting point, not legal advice. Have it checked before launch.` | **staging only — remove before production** |

---

## 14. Do-not-say list

Never ship any of these. Each has a replacement.

| Never say | Why | Say instead |
| --- | --- | --- |
| `Best tyre shop in Bataan` / `#1` / `Trusted by thousands` | Unprovable, and the numbers (`yearsServing: 0`, `ratingCount: 0`) are `TODO-VERIFY` | Nothing. Be specific about what you do: `Tyres, alignment and PMS on EGSA Fourlanes.` |
| `4.9 stars` with no count | A rating with zero reviews is a lie with a decimal point | Render **no stars** while `ratingCount === 0`. When reviews exist: `4.9 from {n} reviews` with the reviews on the page. |
| `Free` on anything that is not free | — | Only a genuinely free item, confirmed by the owner |
| `Instant quote` | It is a range | `Instant estimate` / `Get a range` / `Price range` |
| `Locked-in price` / `Guaranteed price` on an estimate | The shop cannot guarantee a parts price on a car it has not seen | `We confirm the total with you before we start.` |
| `No hidden fees` | Unfalsifiable in the abstract | `We show the price range before you book and confirm the final total before we start.` |
| `Cheapest` / `Lowest price` | No comparison evidence exists | `Price range above, from {formatPeso(priceMin)}.` |
| `Certified` / `Authorised dealer` / `Accredited` / `Genuine parts guaranteed` | The brief forbids trust badges for brands the shop is not authorised for | `Ask us what's in stock today. Stock changes weekly.` |
| `Limited slots!` / `Only 2 left!` (client-generated) | Manufactured urgency | Whatever `capacityLeft` actually says |
| `Hurry!` / `Act now!` / `Don't miss out!` | Hype; the customer is in a hurry, they don't need to be told | Delete the sentence. |
| `Submit` | Says nothing about what happens next | `Confirm booking` / `Send message` / `Send to the shop` |
| `Learn more` / `Read more` / `Click here` | Hides the destination | Name the destination: `See all services` |
| `Oops!` / `Uh oh` / `Something went wrong` | Says nothing, sounds like a toy | `We couldn't load the bays for {date}. Pick another day, or call us.` |
| `It was your fault` / `You entered the wrong code` | Blaming the customer loses the sale | `That year looks off. Use the year on your registration.` |
| A `!` in more than one place per screen | Reads as a cheap sales page | At most one `!` per screen, and usually none |
| `We value your feedback` (auto-email asking for 5 stars after a booking) | Soliciting a specific rating is against most platform policies and poisons the data | Ask nothing. If a customer praises you, invite the review. |
| `Best value in Bataan` / `Trusted by commuters` | Invented | `On EGSA Fourlanes, easy to spot from the main road.` |
| `Sorry for the inconvenience` on a 500 | Vague and passive | `This isn't your fault. Try again, or call us.` |

---

## 15. Tone table — three hard situations

|  | **(a) Stranded at 2 AM** | **(b) Comparing three quotes** | **(c) Came back after complaining** |
| --- | --- | --- | --- |
| What they need first | A number that works, a human, and an ETA | A number they can trust and compare | To feel the last problem was actually fixed |
| Sentence length | 4–8 words | 10–16 words | 10–16 words |
| Register | Plain, calm, no urgency theatre | Precise, complete, no hedging | Warm, specific, no defensiveness |
| Emoji | None | None | None |
| Exclamation marks | 0 | 0 | 0 |
| Do | Lead with the action. State what happens next and when. | Give the range, the min and the max, the parts and labour split, and the duration. Say what is *not* included. | Acknowledge the specific thing that went wrong, by name, before anything else. Then state what has changed. |
| Don't | Don't say "we're closed". Don't apologise for the hour. Don't upsell. Don't send them to a form. | Don't hide behind "it depends". Don't give one number and a small asterisk. Don't claim to be cheapest. | Don't say "thanks for your patience". Don't say "we've always". Don't quote policy. Don't blame a supplier, a technician, or a system. |
| Example line | `Call Shop Now. Someone will pick up. We're on EGSA Fourlanes in Tuyo.` | `₱1,900–₱2,200. That's parts and labour, oil and filter included. About 2 hours in the bay. We confirm the final number before we start.` | `The noise on the left front was the CVL, not the wheel bearing. We replaced it on the 3rd and it's quiet. If it comes back, call me and I'll look at it again at no charge.` |
| Reassurance that works | `If we can't reach you, we'll tell you who can.` | `If something extra turns up, we ask first.` | `Bring it back. We'll fix it at no charge.` |
| Banned here | `We're sorry for the inconvenience!` · `Our team will respond shortly!` | `Best price guaranteed!` · `Limited slots!` | `We take all feedback seriously.` · `We appreciate your understanding.` |

**The through-line:** in all three, the customer is asking the same question — *can I trust
these people with my car and my money?* Every line above answers that question and
nothing else.

---

## 16. Interpolation and safety rules

| Rule | Detail |
| --- | --- |
| Never interpolate raw user input into a sentence that gets sent as SMS | Names with emoji, quotes, or 300 characters must not reach the SMS template. Truncate to 24 chars, strip non-alphanumerics outside `A-Za-z0-9 .'-`. |
| `formatPeso` is the only money formatter | From `src/lib/utils.ts`. `formatPesoRange` for every range. No manual thousands separators, ever. |
| `formatDuration` for every duration | `< 60` → `about {n} minutes`; else `about {h} hr {m} min`, dropping a zero `m` |
| Dates | `Wed 19 Nov` in SMS and chips; `Wednesday 19 November` in headings; `19 November 2026` in legal copy. All `en-PH`, `Asia/Manila`. |
| Times | `9:00 AM`, from `SlotDto.label` verbatim. Never `09:00`, never `9am`. |
| Unverified values | Any `TODO-VERIFY` field renders through a `verified()` guard that falls back to the honest alternative written in this file. It never renders the placeholder and never renders a wrong value. |
| The disclaimer | `est.disclaimer` is unconditional. It cannot be dismissed, collapsed, or conditioned on a flag. |
