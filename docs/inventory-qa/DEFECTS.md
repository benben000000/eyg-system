# INVENTORY QA — DEFECT REGISTER

The two defects the QA suite found in **orchestrator-owned** files, and what was done
about them.

The suite deliberately **pinned both in place** rather than quietly working around
them. `reorder.test.ts` asserted that the contract *contained* the ambiguous
sentence; `ageing.test.ts` asserted the schema *contained* the misleading DOT
example. A test that pins a defect in place cannot itself be "fixed" — it fails,
loudly, until someone acts on the thing it is complaining about.

That is a better design than it first looks. A workaround would have made the suite
green while the defect shipped. This made the suite red until the defect was
genuinely resolved.

**Both are now RESOLVED**, and the tests that pinned them now pin the *resolution*,
so neither can come back silently.

---

## QA-D1 — the DOT example was backwards, in two places a mechanic would read

**Severity** low (the code was right; the prose was not)
**File** `prisma/schema.prisma` — `Product.dotCode`, and `StockLot.dotCode`

**Was**

```
Production week/year, e.g. "2418" = week 18 of 2024. Tyres degrade.
```

**Why it matters**

Real DOT codes are `WWYY` — **week** then **year** — per 49 CFR 574.5. So `"2418"`
is week 24 of **2018**, not week 18 of 2024.

Read the comment's way and every tyre on the shelf looks a year older than it is. And
the failure is worst where rubber age becomes a *safety claim*: a customer being told
their tyre is newer than it is.

Two of the six occurrences were **user-facing error copy**, shown to a mechanic
scanning a code that would not parse:

- `stock-engine.ts` — the validation field message
- `format.ts` — the decode-failure message

A mechanic who typed a valid code and was told *"expected four digits such as 2418
for week 18 of 2024"* would take that as authoritative.

**The decoder was always correct.** `normaliseDotCode` reads the week from the first
two digits and the year from the last two. Only the prose lied — which is worse than
a code bug, because prose is believed.

**Resolution.** Every occurrence now uses the unambiguous example `"1824"` = week 18
of 2024, and states the format as `WWYY` with week read first. The tests assert the
format, the example, *and* that the misleading example has not returned.

---

## QA-D2 — one boolean, two meanings

**Severity** low
**File** `src/lib/inventory-types.ts` — `ReorderRowDto.isStockout`

**Was**

```
/** true = at/below reorder point, false = already below zero. */
```

**Why it matters**

The true branch described *"time to reorder"*. The false branch described a state
the invariant makes **unreachable**, because `available` is never negative.

A boolean that means one thing when true and something else when false is a boolean
the reorder list will get wrong — and it fails quietly, as a manager ordering against
a line the shop has plenty of.

**Resolution.** The doc states exactly one thing: `available <= reorderPoint`, zero
included. The test asserts both that the resolution is present and that the
impossible second meaning has not crept back.

---

## QA-D3 — ageing was a scan, not a query

**Found** as a complaint in a test title rather than an assertion:
*"the schema gives tyres a DOT code column and indexes nothing on it — ageing is not
a query"*

**Resolution**

- `StockLot` carries `@@index([productId, dotCode])`. The per-lot DOT code is what
  ageing actually reads, because a shelf holds many DOT ages at once — which is
  precisely why the lot was split out of `Product` in the first place.
- `Product.dotCode` gained `@@index([dotCode])`, documented as superseded by the lot
  but kept so a single loose tyre can still be recorded and found.

The test title changed to match the code, and now asserts both indexes exist.

---

## Note for the next person

`ProductDto.lastReceivedAt` was removed and then restored during this pass, and the
reasoning is worth keeping.

It was removed because a single scalar cannot express *"20 tyres arrived in March, 10
in August"* — so shelf life derived from it is wrong for exactly the older stock a
clearance campaign targets. `StockLot.receivedAt` is the honest date, per lot.

It was restored because the derivation is sound: it reads the ledger's most recent
`RECEIVE`, which is history rather than a mutable column, and it answers one useful
question — *"when did we last get this?"*

It is now documented as **DISPLAY ONLY**, explicitly not the shelf-life basis, with a
pointer to `StockLot.receivedAt`. The danger was never the field; it was using it for
the one thing it cannot answer.
