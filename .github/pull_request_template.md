<!--
  EYG Tire & Auto Care — pull request template
  ============================================================================
  Every box here exists because a customer is one tap-to-call away from not
  getting help. Keep it short enough that people actually fill it in — a
  template nobody completes is worse than no template, because it looks like
  rigour.
  ============================================================================
-->

## What this changes

<!-- One or two sentences. A reviewer who reads only this line should know
     whether to merge. If you cannot write it in two sentences, the change is
     probably two changes. -->

## Why

<!-- The problem, not the solution. "Customers on 3G see the booking form fail to
     submit" — not "added a retry to the fetch". -->

## Type of change

- [ ] Bug fix (something a customer would notice as broken)
- [ ] New feature
- [ ] Copy or content change
- [ ] Infrastructure, CI or deployment
- [ ] Dependency bump
- [ ] Refactor with no behaviour change
- [ ] Docs or runbook

## How this was verified

<!-- Be specific. "Ran it" is not verification. -->

- [ ] I ran it locally and it works
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes (zero warnings)
- [ ] `npm run build` passes
- [ ] I made a test booking and cancelled it
- [ ] I checked it on a phone-sized viewport (375 px wide)
- [ ] I checked it with `prefers-reduced-motion: reduce`
- [ ] I checked it works with JavaScript disabled (for anything above the fold)
- [ ] Not applicable — docs/config only

## Checklist — the things that have actually gone wrong before

- [ ] **No invented facts.** No phone number, price, rating, warranty period,
      brand partnership or "years in business" that the shop owner has not
      confirmed. Anything unverified is marked `TODO-VERIFY` in
      `src/config/site.ts` and must stay that way until the owner signs off.
- [ ] **No placeholder text shipped.** No Lorem, no `TODO`, no `example.com`,
      no `000-000-0000`, no dead `href="#"`.
- [ ] **A phone number is still reachable within one thumb-reach.** If this
      change touches any page above the fold, confirm the call button is there.
- [ ] **Every submit has pending / success / error states.** A form that fails
      silently is the worst failure this site can have.
- [ ] **No layout shift.** Every image has an explicit width and height.
- [ ] **Colour is never the only signal.** Every colour state is paired with
      an icon or text.
- [ ] **Keyboard and screen-reader pass.** Focus rings visible, real
      `<button>` and `<a>` elements, `aria-*` correct, landmarks present.
- [ ] **No secret is exposed.** Anything `NEXT_PUBLIC_*` is public in every
      cached bundle forever. Server secrets stay server-side.
- [ ] **Mobile-first.** Checked on a ₱3,000 Android over 3G, not just on a
      laptop on office wifi.

## If this touches infrastructure

- [ ] `docker compose up` still works from a clean clone
- [ ] No secret is baked into a Docker layer — secrets come from the runtime
      environment
- [ ] Migrations are **additive only** (no `DROP`, `RENAME`, or `ALTER TYPE`
      in the same deploy as the code that stops using the column). See
      `docs/ops/DEPLOYMENT.md` §6.3 for the two-deploy expand/contract pattern.
- [ ] `node scripts/predeploy-check.mjs` passes **without**
      `--allow-placeholders`
- [ ] `node scripts/validate-env.mjs` passes

## Screenshots

<!-- Before / after for anything visual. For a layout change, a screenshot at
     375 px wide is worth more than a paragraph. Delete this section if there
     is nothing visual. -->

| Before | After |
| --- | --- |
|  |  |

## Anything the reviewer should know

<!-- The thing you would say out loud in the review. The trade-off you made. The
     bit you are unsure about. Better to flag it here than to have it found in
     production. -->

## Checklist before you request review

- [ ] The branch is up to date with `main`
- [ ] I rebased rather than merged `main` into my branch
- [ ] The commit messages say why, not what
- [ ] I have read my own diff top to bottom
- [ ] There are no debugging `console.log`s or commented-out blocks left behind
