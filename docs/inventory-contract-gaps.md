# INVENTORY — ORCHESTRATOR CONTRACT GAPS

### Closed 2026-10-03. Raised by the funnel, marketing and booking-integration agents

Six gaps in orchestrator-owned files were found by agents building against them.
All six are now closed. This file exists so nobody re-raises them, and so the
reasoning survives.

| # | Gap | Raised by | Resolution |
| --- | --- | --- | --- |
| 1 | **`Booking.partsBlocked` / `partsShortfallCount` did not exist.** `blocked` was computed in memory and thrown away, so a booking taken *while blocked* was indistinguishable from an ordinary one — and `isBlocking` would drift wrong on whichever side nobody audits. | funnel (§METRICS gap #1) | Added to `Booking`, plus a `partsShortfall` JSON snapshot for the staff panel. |
| 2 | **`ReserveResult.expectedAt` did not exist.** Without it the strongest honest line a tyre shop can say to a blocked customer — "we can do this on the {date}" — is unshippable, because every ETA would be invented. An invented ETA is worse than no ETA. | funnel | Added, optional. Only ever populated from a real `PurchaseOrder.expectedAt`. |
| 3 | **No `PurchaseOrder` model.** "Mark as ordered" could not persist anything, so a low-stock row either stayed on the dashboard forever or vanished with no record the shop is waiting. Flagged independently by two agents. | funnel + marketing | Added `PurchaseOrder` + `PurchaseOrderLine`, with per-line `unitCost` and `expectedAt`. |
| 4 | **`canPromise` semantics ambiguous** — units vs `qtyNeeded`. Two agents could reasonably read it differently, and every customer-facing stock number depends on it. | funnel | Documented: it is units of *this* product, and must never be compared across different units (a tyre set is 5 EA, an oil change is 4 LITRE). |
| 5 | **`ProductAvailabilityDto.ageDays` ambiguous** — "age elapsed" vs "days until stale". The failure is silent: a clearance campaign would fire on brand-new stock. | marketing | Documented as **elapsed**. Name unchanged so no caller breaks. |
| 6 | **`Product.notes` is untyped free text with no field-level authorisation.** It is the easiest place for a supplier name, a negotiated price, or a customer's plate number to end up. | marketing | Documented as a hard contract: strip it from every non-staff DTO, exactly like `costPrice`. A4 already omits it from the panel snapshot by projection. |

## Two risks that are NOT contract gaps

These are real and still open:

1. **The staff/customer availability split is enforced by which function you
   call, not by the type system.** `availability.ts` selects `supplier` and
   `costPrice` for the staff path. One careless reuse on a customer route leaks
   the shop's buying price. Pointed at A8 as a specific line to attack.
2. **Nothing calls the booking hooks yet.** Until the four mount points are
   wired, the inventory is still a spreadsheet with extra steps — which is
   precisely the outcome the brief names as the thing to avoid. The orchestrator
   owns this integration; it is tracked in `docs/inventory-qa/RELEASE-CHECKLIST.md`.

## The invariant, restated

```
available = onHand − reserved        and available is NEVER negative
```

Unchanged by any of the above. Every write path refuses rather than clamps.
