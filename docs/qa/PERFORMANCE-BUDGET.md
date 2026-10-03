# PERFORMANCE BUDGET — EYG Tire & Auto Care

**Target device:** a mid-tier Android (≈₱12,000, 4 GB RAM, a 2019 Snapdragon 665
or equivalent) on **Slow 4G** — Chrome DevTools "Slow 4G" preset, or Lighthouse
mobile throttling.

**Why that device, specifically.** The customer profile in
`docs/AGENT-BRIEF.md` §1 is: stranded, in a hurry, price-conscious, **on mobile,
in traffic near EGSA Fourlanes**. 1.5 h from Manila over LTE with one bar is the
real case, not a nice Wi-Fi apartment. A budget tuned for a developer's laptop is
a budget that is never met in production.

**Who this hurts if we miss it.** Every 1 s of LCP is roughly a measurable share
of bounce on a mobile landing page, and the top of the funnel is a stranded
driver who needs an answer *now*. We would lose the booking before the customer
ever saw the price.

---

## 1. The budgets

| Metric | Budget | Why this number |
| --- | --- | --- |
| **Homepage JS (all chunks, gzipped)** | **≤ 180 KB** | The whole first visit. 180 KB over Slow 4G ≈ 2.5 s of transfer on a 4G connection — the rest of the budget then goes to images and fonts. |
| **Initial-route JS (the `/` route's own chunks, gzipped)** | **≤ 120 KB** | What must parse before the hero is interactive. Server Components keep most of this off the critical path. |
| **CLS** | **≤ 0.1** | Google flags 0.1 as "needs improvement". The emergency banner, the slot grid and the price text must not move after paint. |
| **LCP** | **≤ 2.5 s** | The Core Web Vitals "good" threshold. This is the number the whole funnel hangs on. |
| **INP** | **≤ 200 ms** | The 2024 CWV replacement for FID. For a 4-step wizard on a slow phone, this is where a careless re-render shows up. |
| **TTFB** | **≤ 800 ms** | Server Components + a Postgres round trip. A cold start over 1 s means the visitor sees a blank frame. |
| **Image weight** | **≤ 200 KB each**, AVIF/WebP | `next.config.ts` already negotiates `["image/avif", "image/webp"]`. 200 KB is roughly a 1600 px hero at AVIF quality 60. |
| **Above-the-fold images** | **≤ 120 KB each** | They block LCP. They are the ones that must be right. |
| **Fonts** | **≤ 2 families, ≤ 4 files**, `display: swap` | `Saira` (display) + `Barlow` (body) = 2 families. Subsets and weights must be capped at 4 files total, or a ₱3,000 phone downloads 12 font files before the text renders. |
| **Third-party scripts** | **≤ 2** | Analytics + one widget (e.g. the Facebook pixel, if the owner insists). Each third-party script is a third-party connection, a privacy disclosure under the Data Privacy Act, and a single point of failure for LCP. |
| **Total first load** | **≤ 900 KB gzipped** | The sum of HTML + JS + CSS + fonts + above-the-fold images. |

### What "gzipped" means here

Every byte number in this document is **transfer size** — what actually crosses
the wire. In Playwright terms, the sum of the `content-length` (or body length)
of the responses, not the uncompressed file sizes. Do not quote `du -h` numbers
from `.next/static`; they are ~4× larger than what a customer downloads.

---

## 2. How we stay inside these numbers

### JS: 180 KB / 120 KB

1. **Server Components by default.** `"use client"` only where interaction
   demands it. Every `"use client"` file is a JS file the browser must parse. The
   rule from `AGENT-BRIEF.md` §5 is not advice; it is the budget mechanism.
2. **`optimizePackageImports` is already on** for `lucide-react` and `date-fns`
   (`next.config.ts:37`). Adding a package without it can add 40 KB for an icon.
3. **Never import a date library for one format.** `src/lib/server/time.ts`
   formats slot labels by hand, byte-identically on every runtime. That is both
   a determinism decision (QA asserts it) and a 12 KB decision.
4. **`framer-motion` is the single biggest risk on this budget.** It is ~35 KB
   gzipped. Reach for CSS transitions first; use `framer-motion` only for
   gestures that CSS cannot express, and import from `framer-motion` (the
   minimal build) not `framer-motion/dom`.
5. **Budget check in CI.** `tests/e2e/responsive.spec.ts` asserts the two JS
   budgets on every run. A PR that blows them is red.

### CLS ≤ 0.1

1. **Every `<img>` and `next/image` carries explicit `width` and `height`.** An
   image with unknown intrinsic size shifts everything below it. Asserted in
   `responsive.spec.ts`.
2. **Never inject content above existing content after paint.** The emergency
   banner must be server-rendered, not inserted by an effect.
3. **Reserve width for the countdowns and the open/closed pill.** They are
   rendered server-side from `getOpenStatus(new Date())` precisely so they cannot
   pop in. This is why the helper must be *pure* and take an instant (see
   DEF-001/DEF-002: the badge's content is decided on the server, and a
   client-side render would both mismatch hydration and shift the page).
4. **No web fonts causing FOUT-driven shift.** `next/font` (self-hosted,
   `display: swap`) plus `size-adjust` fallbacks, or the text reflows when the
   font swaps in.

### LCP ≤ 2.5 s on Slow 4G

1. **The LCP element should be the hero image or the hero headline as plain
   text**, never a lazily-loaded client component. If the LCP element is a
   `<Text>` inside a `"use client"` island, the budget is gone before the bundle
   arrives.
2. **`next/image` with `priority`** on the above-the-fold hero, `fetchPriority="high"`.
3. **No third-party script above the fold.** A synchronous tag in `<head>` for
   analytics costs the LCP element its budget directly.
4. **Keep the homepage a Server Component.** The mobile action bar, the header
   and the footer are static markup; they must not depend on a hydrated island
   to be visible.

### INP ≤ 200 ms

1. **The slot grid is the risk.** 8–24 slot buttons, each re-rendering a
   selection. Keep the state local, avoid re-validating the whole form on every
   keystroke.
2. **The quote estimator runs on every selection change.** Debounce the network
   call; compute the arithmetic locally and reconcile with the server response
   when it arrives.
3. **Never `await` a route transition inside a click handler.** Use `useTransition`
   so the input stays responsive.

### Fonts: 2 families / 4 files

`Saira` 800/900 italic for display, `Barlow` for body. That is 2 families. The
4-file cap means at most two weights per family, subset to Latin. If a third
weight or a Cyrillic/Greek subset is ever needed, something else must be cut.

### Third-party scripts: 2

Current expectation: **0** (Plausible is cookieless and optional; the Google
Maps embed is an `iframe`, not a script). Every addition needs a written
justification, because each one is a privacy disclosure under the Data Privacy
Act and a potential LCP regression. The `mapEmbed` iframe should be
`loading="lazy"` and must not be above the fold on any page other than
`/contact`.

---

## 3. How to measure

### Local, repeatable (what CI runs)

```bash
npm run build
npx serve .next            # or `next start`
npx lighthouse http://localhost:3000 \
  --preset=desktop --only-categories=performance \
  --form-factor=mobile --screenEmulation.mobile \
  --throttling-method=simulate \
  --throttling.rttMs=150 --throttling.throughputKbps=1638.4 --throttling.cpuSlowdownMultiplier=4 \
  --output=html --output-path=./lh-home.html
```

The four numbers to read: **LCP**, **CLS**, **INP** (or TBT as a proxy),
**Total Blocking Time**, and the total transfer size.

### On a real device (what actually counts)

A CI runner is a fast x86 core with a warm cache. It is optimistic by 30–50%.
Before release, open the site on the cheapest Android in the shop and:

1. Turn on Data Saver / throttle to Slow 4G in developer options.
2. Load `/` cold (clear the cache) and time the moment the hero headline is
   readable.
3. Do the same for `/book`.

Write the measured numbers in the release notes next to the budgets.

---

## 4. When a budget is blown

In this order. Do not skip to option 4.

### 1. Find out which one, and by how much

```bash
du -sh .next/static/chunks | sort -h | tail -20
# then open .next/analyze or run `ANALYZE=true next build` if the bundle
# analyser is added (a devops request — QA does not edit package.json)
```

The build output prints the First Load JS per route. Compare against the budget
for the *route that regressed*, not the whole app.

### 2. Is it a new dependency or a new `"use client"`?

Almost always one of the two. Check `git diff` for `"use client"` — each one is
a JS boundary and a hydration cost.

### 3. Is it one chunk, or everything?

* **One chunk grew** — find the import that pulled it in. A barrel file
  (`import { x } from "some-lib"` where `some-lib` re-exports everything) is the
  usual culprit. Import the deep path.
* **Everything grew by the same amount** — a `package.json` change. Check whether
  the new dependency is tree-shakeable and whether it is loaded eagerly.

### 4. Defer it

If the code is genuinely needed but not needed *now*:

* `next/dynamic` with `ssr: false` for a below-the-fold widget (the lightbox
  viewer, the reviews carousel).
* Move it to a Server Component and pass only the serialisable props.
* Lazy-load on interaction (`IntersectionObserver` or `requestIdleCallback`).

### 5. Budget the cost, do not silently accept it

If a feature genuinely costs 40 KB and the owner wants it, that is a business
decision, not an engineering one. Record it:

> **Budget waiver — <feature>.** Cost: +NN KB gzipped on `/book`. Approved by
> <name> on <date>. Compensation: <what was removed>. Re-review by <date>.

A waived budget with a compensation is engineering. A waived budget with nothing
is just a regression with a signature on it.

### 6. CLS specifically

CLS regressions are almost always a missing `width`/`height`, a font swap, or
content injected above the fold. `responsive.spec.ts` fails the build on an image
without intrinsic dimensions. If the shift comes from a third-party embed, the
embed needs an explicit height.

### 7. LCP specifically

If LCP regressed with no code change, check in this order:

1. Did an image lose `priority`?
2. Did a third-party script get added to `<head>`?
3. Did the hero become a client component?
4. Is TTFB up? That is a database or a cold-start problem, not a frontend one —
   escalate to backend-core, not to the bundle.

---

## 5. Current status

**Not yet measured.** The budgets above are the contract, not a report. To record
the real numbers, run §3 against a production build on a real device and fill in:

| Metric | Budget | Measured (device) | Measured (CI) | Date | Verdict |
| --- | --- | --- | --- | --- | --- |
| Homepage JS gzipped | 180 KB | | | | |
| Initial-route JS gzipped | 120 KB | | | | |
| Total first load | 900 KB | | | | |
| LCP (Slow 4G) | 2.5 s | | | | |
| CLS | 0.1 | | | | |
| INP | 200 ms | | | | |
| TTFB | 800 ms | | | | |
| Largest image | 200 KB | | | | |
| Font families / files | 2 / 4 | | | | |
| Third-party scripts | 2 | | | | |

Automated gates that already run in the E2E suite: the two JS budgets, CLS ≤ 0.1,
images with intrinsic dimensions, and third-party script origins ≤ 2 (currently
asserted at 0).
