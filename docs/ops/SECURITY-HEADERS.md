# SECURITY HEADERS

**EYG Tire & Auto Care**

Every header this site sends, why it exists, how to verify it, and — the part
that matters more than the list — **how to add a third-party origin without
quietly breaking the CSP and taking the whole site down with a blank page.**

---

## Contents

1. [The full header set](#1-the-full-header-set)
2. [Content-Security-Policy](#2-content-security-policy)
3. [Verification](#3-verification)
4. [Adding a third-party origin](#4-adding-a-third-party-origin)
5. [Where the headers are defined](#5-where-the-headers-are-defined)
6. [HSTS preload](#6-hsts-preload)
7. [CORS](#7-cors)
8. [What is deliberately NOT set](#8-what-is-deliberately-not-set)

---

## 1. The full header set

Defined in `next.config.ts` (`securityHeaders`) and mirrored in `vercel.json`
because the two are applied through different pipelines.

| Header | Value | What it stops |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | A customer on café wifi or a hostile network being silently downgraded to HTTP, where their phone number and booking details travel in the clear. `includeSubDomains` covers `www.` and any future subdomain. `preload` is covered in §6. |
| `X-Content-Type-Options` | `nosniff` | A browser guessing that your `.js` file is actually HTML, and executing an attacker's payload because you uploaded an image with the wrong MIME type. |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking — an invisible iframe over the booking form, so a customer thinks they are clicking "Confirm booking" and is not. `SAMEORIGIN`, not `DENY`: the Google Maps embed needs to frame itself. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaking the full URL — including a `?ref=` or a search query — to Google Analytics or Facebook when a customer clicks away. Strips the path cross-origin, keeps the origin same-origin. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()` | A compromised or injected script quietly turning on the microphone. `geolocation=(self)` because the contact page legitimately uses it. `payment=(self)` because GCash/Maya flows may need it. |
| `X-Download-Options` | `noopen` | On old IE, a downloaded file executing in the site's origin instead of downloading. Cheap, harmless, still worth it. |
| `Cross-Origin-Opener-Policy` | `same-origin` | `window.opener` abuse — a malicious page navigating this one and reaching back into it. Also severs `window.opener`, which stops reverse-tabnabbing. |
| `X-XSS-Protection` | `0` | **This is deliberate.** The legacy XSS auditor was itself exploitable and it broke legitimate pages. Modern browsers ignore it. Setting `0` explicitly disables it and removes the "vulnerable page" console noise. Do not "fix" this to `1; mode=block`. |
| `X-Powered-By` | *absent* | `poweredByHeader: false` in `next.config.ts`. Free reconnaissance otherwise. |
| `Cache-Control` (fonts) | `public, max-age=31536000, immutable` | Self-hosted fonts re-downloading on every navigation. The single biggest LCP win available. |
| `Cache-Control` (`/og/*`) | `public, max-age=604800, stale-while-revalidate=86400` | Social cards being re-rendered on every share. A week is right; they change with the logo, not with the weather. |
| `Cache-Control` (`/api/*`) | `no-store, max-age=0` | **Important.** A cached `/api/availability` or `/api/health` is a lie. `/api/health` is polled by monitoring; a cached 200 behind a dead process means the alert never fires. |
| `X-Robots-Tag` (`/api/*`) | `noindex, nofollow` | An API route appearing in search results as a page. |

---

## 2. Content-Security-Policy

### 2.1 Why it is not in `next.config.ts` or `vercel.json`

**Because it must be built per-request with a fresh nonce.** Next.js inlines
`eval`-free scripts and inline JSON-LD, both of which need a per-response token.
A static header would either need `unsafe-inline` (which defeats the entire
point) or a hardcoded nonce (which is public the moment the page loads).

The CSP is built in `src/middleware.ts` (owned by the backend agent) and sets
the nonce on both the header and the `<script>` tags it emits.

> **If the CSP is missing or has no nonce, `scripts/smoke-test.mjs` fails.**
> That check is what stops a deploy from silently removing it.

### 2.2 The directives and what each one is for

| Directive | Why it exists here |
| --- | --- |
| `default-src 'self'` | **The backstop.** Anything not explicitly allowed is denied. This is the directive doing the actual work. |
| `script-src 'self' 'nonce-…' 'strict-dynamic'` | `strict-dynamic` means a script loaded by a nonced script is trusted, and browsers that support it **ignore host allowlists**. That is what makes it possible to add analytics without editing the CSP. `'self'` is the fallback for older browsers. |
| `style-src 'self' 'unsafe-inline'` | Tailwind 4 and Next inject styles at runtime. `'unsafe-inline'` is a real weakening — see §2.4. |
| `img-src 'self' data: blob: https:` | Facebook CDN images (`**.fbcdn.net`), Unsplash, Google user-content, and `data:` for inline placeholders. |
| `font-src 'self'` | Fonts are self-hosted. No third-party font CDN means no third party sees your visitors. |
| `connect-src 'self' https://*.ingest.sentry.io` | The site's own API calls, plus Sentry's ingest endpoint if error reporting is on. |
| `frame-src 'self' https://www.google.com https://www.youtube.com` | The Google Maps embed on `/contact`, and any video. |
| `object-src 'none'` | No `<object>` or `<embed>`. Kills Flash-era plugin content and a class of injection. |
| `base-uri 'self'` | A `<base>` tag injection cannot redirect every relative link on the page to an attacker's domain. |
| `form-action 'self'` | **Directly protects the booking form.** A compromised script cannot rewrite `<form action>` to post a customer's name, phone and vehicle details somewhere else. This is the most valuable directive on a site whose main job is collecting personal data. |
| `frame-ancestors 'self'` | Clickjacking, in CSP form. Mirrors `X-Frame-Options` for modern browsers. |
| `upgrade-insecure-requests` | Any `http://` asset becomes `https://`. |
| `report-uri` / `report-to` | Sends violation reports somewhere real, so a broken CSP is a signal rather than a silent void. |

### 2.3 Verify it in place

```bash
curl -sI https://eygtireautocare.ph | grep -i content-security-policy
```

Then check the two things that are actually wrong in practice:

```bash
# 1. Does the nonce in the header match the one in the <script> tags?
curl -s https://eygtireautocare.ph | grep -o "nonce=\"[^\"]*\"" | head -3
# Compare with the nonce in the header. They must be identical for THIS response.

# 2. Does the nonce change between responses? It must.
for i in 1 2; do
  curl -sI https://eygtireautocare.ph | grep -o "nonce-[a-zA-Z0-9+/=]*" | head -1
done
# Two different values. Identical values mean the nonce is hardcoded, which
# means the CSP provides no XSS protection at all.
```

`smoke-test.mjs` automates exactly this second check.

### 2.4 The `'unsafe-inline'` in `style-src`

It is there because Tailwind 4 and Next inject styles at runtime. This is a
genuine weakening of the CSP, and it is worth being honest about it:

- **`'unsafe-inline'` in `style-src` is far less dangerous than in
  `script-src`.** A CSS injection can exfiltrate data via attribute selectors and
  background-image URLs in a limited way. It cannot execute JavaScript.
- It is not removable without either a nonce-based style pipeline or moving all
  styles to a static CSS file, both of which are framework-level changes.
- If a future dependency lets you drop it, drop it.

### 2.5 `'strict-dynamic'`

This is what makes the CSP maintainable. It means:

> "A script that was loaded by a nonced script is trusted, and host allowlists
> are ignored."

So adding Google Analytics or Sentry does **not** require editing the CSP at
all — the loader is nonced, and it can then load the vendor's script. The
`script-src` host list stays short and stays meaningful.

Without `strict-dynamic`, every analytics integration becomes a permanent CSP
edit and a permanent chance to fat-finger it.

---

## 3. Verification

### 3.1 The full header check

```bash
curl -sI https://eygtireautocare.ph
```

Expected:

```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: strict-origin-when-cross-origin
x-xss-protection: 0
permissions-policy: camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()
x-download-options: noopen
cross-origin-opener-policy: same-origin
content-security-policy: default-src 'self'; script-src 'self' 'nonce-...' 'strict-dynamic'; ...
```

### 3.2 Automate it

```bash
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph
```

Asserts: the baseline five headers, a CSP is present, `default-src` exists, and
the nonce rotates between two consecutive responses. **This runs in CI on every
deploy**, so a header cannot be dropped without failing the pipeline.

### 3.3 External checkers

- [securityheaders.com](https://securityheaders.com/?q=https://eygtireautocare.ph&followRedirects=on)
- [observatory.mozilla.org](https://observatory.mozilla.org/) — a stricter
  grading scale
- `npx lhci autorun` — the best-practices category includes a CSP check

Do not chase a perfect score on a third-party grader. The score rewards
`strict-dynamic` and nonce-based styles, both of which have real trade-offs
above. Fix what you understand and can justify.

### 3.4 In the browser

DevTools → Console. A working CSP is **silent**. Any violation is:

```
Refused to load the image 'https://...' because it violates the following
Content Security Policy directive: "img-src 'self' data: blob: https:".
```

**Any violation in production means something is broken and nobody told you.**
That is what `report-uri` / `report-to` is for. If it is set up, a violation
arrives as a Sentry issue and you find out before a customer does.

---

## 4. Adding a third-party origin

The procedure, because doing this wrong produces a site that renders as a blank
white page with one console error.

### 4.1 The rule

> **Add the origin to the narrowest directive it needs, and nothing else.**
>
> Adding `https://vendor.example` to `script-src` when it only serves images
> gives that vendor the ability to execute code on your site.

| What the vendor does | Add to | Example |
| --- | --- | --- |
| Serves images | `img-src` | `https://images.vendor.example` |
| Loads a script | `script-src` | `https://js.vendor.example` |
| Sends data to an API | `connect-src` | `https://api.vendor.example` |
| Loads a stylesheet | `style-src` | `https://fonts.vendor.example` |
| Is embedded | `frame-src` | `https://www.vendor.example` |
| Sends error reports | `connect-src` | `https://ingest.vendor.example` |

### 4.2 The procedure

```bash
# 1. Identify what the vendor actually needs
#    Read their integration docs. Do not guess. Do not add "just in case".

# 2. Find the exact hostname. NOT the parent domain.
curl -s https://eygtireautocare.ph | grep -oE 'https://[a-z0-9.-]+vendor\.example[^"'"'"' )]*' | sort -u

# 3. Add it to src/middleware.ts — the narrowest directive, nothing more

# 4. Locally, verify
npm run dev
curl -sI http://localhost:3000 | grep -i content-security-policy

# 5. Open the affected page. Watch the console. Zero violations.
#    DevTools → Console → filter on "Content Security Policy"

# 6. Verify the vendor is ACTUALLY loaded, not just allowed
#    DevTools → Network → filter on the vendor's domain → confirm the request
#    200s. An allowed-but-unused entry is still a hole.

# 7. Deploy, then verify in production
node scripts/smoke-test.mjs --base-url=https://eygtireautocare.ph
```

### 4.3 Test the failure modes

An origin that is too narrow and an origin that is too wide both "work". Only one
of them is correct.

```bash
# Too narrow: the vendor is blocked and the feature is dead
# → Console: "Refused to load ... because it violates ... "
# → Network tab: the request is blocked
# Fix: widen that ONE directive.

# Too wide: the vendor is allowed and you have handed over the keys
# → Everything works
# → You have also allowed that vendor's OTHER endpoints, including any
#   user-content endpoints that serve HTML
# Fix: use the exact hostname, and prefer a vendor that serves from a
#      dedicated, content-only domain (CDN) over one on their main site.
```

### 4.4 The decision checklist

Before adding **any** third party:

- [ ] **Do we need it?** Every third party is a supply-chain dependency that can
      see every customer who visits. For a tyre shop, the bar should be high.
- [ ] Does it load on **every** page or one? Load analytics and pixels only where
      they are needed.
- [ ] Does it need cookies? If yes, `/privacy` must disclose it (Data Privacy
      Act RA 10173 — this is a legal obligation, not a formality).
- [ ] Is there a self-hosted or first-party alternative? Fonts: already
      self-hosted. Maps: the keyless iframe embed needs no third-party JS.
      Analytics: Plausible or a first-party GA proxy needs no cookie banner.
- [ ] Do we need a **nonce** instead? If the loader script is ours,
      nonce-loading it means we never edit the CSP again (§2.5).

### 4.5 Vendors already considered

| Vendor | Needed for | CSP impact | Alternative |
| --- | --- | --- | --- |
| Google Maps embed | `/contact` | `frame-src https://www.google.com` | Already keyless. A static map image loses the "get directions" interactivity. |
| Google Analytics 4 | Analytics | `script-src` + `connect-src` | **Plausible** (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) — no cookie, no banner, one small script. |
| Cloudflare Turnstile | Bot protection | `script-src` + `frame-src` | **Already have a first-party alternative:** the arithmetic CAPTCHA. No third party at all. Turnstile is optional. |
| Sentry | Errors | `connect-src https://*.ingest.sentry.io` | Self-hosting is possible but not worth it at this scale. |
| Facebook pixel | Ads | `script-src` + `img-src` | Consider not running ads at all — see [COST-OPTIMISATION.md](COST-OPTIMISATION.md) §5. |

**The arithmetic CAPTCHA is the interesting one.** A tyre shop does not need
Cloudflare to stop bots, and not depending on Cloudflare is one fewer party that
can see every visitor. It works offline, costs nothing, and has no latency. It
is the default in this codebase for exactly that reason.

---

## 5. Where the headers are defined

| Header group | Defined in | Applied by |
| --- | --- | --- |
| Baseline security headers | `next.config.ts` → `securityHeaders` | Next's middleware/edge |
| CSP with nonce | `src/middleware.ts` | Next middleware, per request |
| Font caching | `next.config.ts` → `headers()` | Next |
| `/api/*` no-store | `vercel.json` | Vercel edge |
| `/og/*` caching | `vercel.json` | Vercel edge |
| Everything on non-Vercel | `next.config.ts` | The Node server |

> **Keep `next.config.ts` and `vercel.json` in sync.** Vercel applies them
> through different pipelines and its own is the last word at the edge. A header
> added to one and not the other exists in one environment and not the other.
>
> `next.config.ts` is orchestrator-owned. Devops does not edit it.

### Adding a header

1. Add it to `next.config.ts` `securityHeaders` (orchestrator applies).
2. Add it to `vercel.json` `headers` if Vercel will override.
3. `npm run dev` and `curl -sI`.
4. Add an assertion to `scripts/smoke-test.mjs`.
5. Deploy and verify.

Step 4 is the one that gets skipped, and it is the one that means the next
person's header does not silently vanish.

---

## 6. HSTS preload

`Strict-Transport-Security: …; preload` tells the browser to **never** try HTTP
again for two years, without first checking for the header.

`preload` only does anything once the domain is on the browser preload list.
To be added:

1. <https://hstspreload.org>
2. Enter `eygtireautocare.ph`
3. It checks you have a valid HSTS header with `max-age` ≥ 31536000 and
   `includeSubDomains`
4. Submit

**This is effectively irreversible for the domain.** It means no `http://`
request to any subdomain will ever work again, ever. Consequences to accept
first:

- Every subdomain must have a valid certificate **before** you submit.
- Any internal or staging host on a subdomain that is not HTTPS-only will break.
- Removal from the list takes months and requires all browsers to update.

**For a shop with one apex domain and a `www`, the risk is low and the benefit
is real.** Submit it after `staging.eygtireautocare.ph` is properly HTTPS, and
not before.

Verify it took effect: <https://hstspreload.org> will show "preloaded", and
`chrome://net-internals/#hsts` will list the domain.

---

## 7. CORS

**This API sets no CORS headers, and that is correct.**

CORS is a browser mechanism. `curl` and a server ignore it entirely, so a CORS
header is not access control — it is a browser policy for a different threat
(a page on another origin making a request with the customer's cookies).

This API:

- is **same-origin only** — every route handler reads the request's origin and
  the site is the only origin;
- uses `httpOnly` cookies for `/admin`;
- never accepts a credential from a cross-origin call.

If a route genuinely needs to accept a cross-origin POST, it must be an
unauthenticated, deliberately public endpoint — and the rate limiter
(`RATE_LIMIT_PUBLIC_PER_MINUTE`) is the control that matters, not CORS.

**Do not add `Access-Control-Allow-Origin: *` anywhere.** On a booking API that
is an invitation to have someone else's script submit bookings.

---

## 8. What is deliberately NOT set

| Header | Why not |
| --- | --- |
| `X-XSS-Protection: 1; mode=block` | The legacy auditor was itself exploitable and broke legitimate pages. Set `0` (i.e. absent) — see §1. |
| `Access-Control-Allow-Origin: *` | See §7. |
| `Cross-Origin-Embedder-Policy` | Requires `Cross-Origin-Resource-Policy` on every subresource, which breaks the Google Maps iframe and Google Fonts-style third parties. High breakage, low value for a marketing site. |
| `Cross-Origin-Resource-Policy: same-origin` | Would block the Google Maps iframe and the Facebook CDN images. |
| `Expect-CT` | Deprecated. Chrome removed it. Adding it is cargo-culting. |
| `Public-Key-Pins` | A misconfigured HPKP bricks the site permanently. Do not. Certificate Transparency is strictly better and needs no opt-in. |
| `Strict-Transport-Security` on `localhost` | Breaks local development. Only set it in production — `next.config.ts` already applies it to every response, and the dev server does not send it. |

---

## 9. Reporting a vulnerability

**Do not open a public issue.** A public issue describing an exploitable bug is
a disclosure, not a bug report.

Email the address in the repository's security contact, or use GitHub's private
advisory reporting (`Security` → `Report a vulnerability`) if it is enabled.

Include: what an attacker can do, the steps to do it, and the impact. Give a
reasonable window to fix before disclosing publicly.

**For customer data specifically** (Data Privacy Act RA 10173, and the general
duty to a customer who handed you their phone number): if there is a breach,
escalate immediately — [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) §SEV1-SEC.
The notification clock starts at discovery, not at confirmation.

---

## Related

| Document | Read it when |
| --- | --- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environment variables, platforms |
| [OBSERVABILITY.md](OBSERVABILITY.md) | CSP violation reporting via Sentry |
| [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | A breach, a leaked secret |
| [COST-OPTIMISATION.md](COST-OPTIMISATION.md) | Before adding a paid third party |
