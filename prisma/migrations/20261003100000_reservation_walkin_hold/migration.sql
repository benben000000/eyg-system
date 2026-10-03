-- ============================================================================
-- WALK-IN STOCK HOLDS
--
-- Makes `Reservation.bookingId` nullable and adds `heldFor`.
--
-- WHY
-- ---
-- The frontend shipped a Reserve action whose reason list included "Held for a
-- walk-in waiting". The backend correctly refuses RESERVE at /movements, because
-- a hold there would move `reserved` with no Reservation row and nothing the cron
-- sweep could ever release. Both were right, and together they exposed a gap:
-- bookingId was REQUIRED, so "hold two 205/55R16, this customer is back at four"
-- had nowhere to live.
--
-- That is an everyday thing for a tyre shop to need. Without it the mechanic
-- writes it on paper, which is precisely what this system was built to replace.
--
-- A walk-in hold is fully governed: same TTL, released by the same sweep, counted
-- in the same reorder and availability maths. It just has no job to be consumed
-- against — settle it with a CONSUME and a reason, or let it expire.
--
-- NOTE ON THE UNIQUE CONSTRAINT
-- -------------------------------
-- `@@unique([productId, bookingId])` exists so one product cannot be held twice
-- for the same booking. Under Postgres NULL semantics a NULL bookingId does not
-- collide with anything, so several walk-in holds of the SAME product are
-- permitted — which is correct: two different walk-ins may each be waiting on a
-- pair, and that is a real situation, not a duplicate.
-- ============================================================================

ALTER TABLE "Reservation"
  ALTER COLUMN "bookingId" DROP NOT NULL;

ALTER TABLE "Reservation"
  ADD COLUMN "heldFor" TEXT;

-- A hold must be attributable. A reservation nobody can identify is a mystery
-- when someone asks why a tyre is spoken for.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "reservation_hold_is_attributable"
    CHECK ("bookingId" IS NOT NULL OR NULLIF(TRIM("heldFor"), '') IS NOT NULL);

-- Walk-in holds are indexed by name: "is the Dela Cruz hold still on?" is a
-- question the counter actually asks.
CREATE INDEX "reservation_heldFor_idx" ON "Reservation" ("heldFor");
