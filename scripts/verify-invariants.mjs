/**
 * verify-invariants.mjs — prove the stock invariant is actually enforced.
 *
 * ============================================================================
 * WHY THIS EXISTS
 *
 * Every CHECK constraint in `prisma/migrations/` was written from the schema and
 * the engine's own sign table. They had never been executed against a real
 * Postgres when they were first applied.
 *
 * That matters more than it sounds. A wrong CHECK constraint does not degrade
 * gracefully — it REFUSES every write it should have allowed. If
 * `stockmovement_sign_matches_kind` has one kind wrong, then every stock
 * movement of that kind fails at the counter, and the only symptom is a 500
 * that nobody can explain.
 *
 * So this script attempts each violation and requires it to be refused, then
 * attempts a correct write and requires it to be ALLOWED. A constraint that
 * refuses nothing, or refuses something valid, fails here.
 *
 * USAGE
 *   node scripts/verify-invariants.mjs
 *
 * Reads DATABASE_URL from the environment (or `.env`). Safe to re-run: it
 * creates a throwaway product and removes it afterwards.
 *
 * RE-RUN IT AFTER EVERY MIGRATION. A new migration can add a column that makes a
 * correct write fail, and the only thing that catches that before it reaches a
 * customer is this.
 * ============================================================================
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failures = 0;

const PROBE_PREFIX = "__invariant_probe_";

function pass(label, detail) {
  console.log(`  PASS  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

function fail(label, detail) {
  console.log(`  FAIL  ${label}`);
  if (detail) console.log(`        ${detail}`);
  failures += 1;
}

/**
 * Attempt a write that MUST be refused, and name the constraint that should
 * catch it. Anything other than that specific refusal is a different problem and
 * is reported as such rather than quietly passing.
 */
async function mustRefuse(label, sql, expectedConstraint) {
  try {
    await prisma.$executeRawUnsafe(sql);
    fail(label, `the write SUCCEEDED — ${expectedConstraint} is not protecting anything`);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes(expectedConstraint)) {
      pass(label, `refused by ${expectedConstraint}`);
    } else if (/Foreign key|foreign key/.test(msg)) {
      fail(
        label,
        "hit the FOREIGN KEY before the CHECK, so this proves nothing. " +
          "Check the probe product still exists.",
      );
    } else if (/already exists/.test(msg)) {
      fail(label, "a previous probe row was left behind; clean up and re-run");
    } else {
      fail(label, `refused, but not by the expected constraint: ${msg.split("\n")[0]}`);
    }
  }
}

/** A write that MUST be allowed. */
async function mustAccept(label, sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
    pass(label);
  } catch (e) {
    fail(label, `a valid write was REFUSED: ${String(e?.message ?? e).split("\n")[0]}`);
  }
}

async function main() {
  console.log("=== 1. did the schema land? ===\n");

  const [{ tables }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  console.log(`  tables in "public": ${tables}`);

  const constraints = await prisma.$queryRawUnsafe(
    `SELECT conname FROM pg_constraint
      WHERE contype = 'c' AND connamespace = 'public'::regnamespace
      ORDER BY conname`,
  );

  const REQUIRED = [
    // The invariant itself, and its mirror image.
    "stocklevel_reserved_le_onhand",
    "stocklevel_reserved_non_negative",
    "stocklevel_onhand_non_negative",
    // The ledger.
    "stockmovement_qty_nonzero",
    "stockmovement_sign_matches_kind",
    "stockmovement_human_reason_required",
    // Holds.
    "reservation_qty_positive",
    // Money.
    "product_cost_non_negative",
    "product_sell_non_negative",
    // The bill of materials.
    "servicepartrequirement_qty_positive",
  ];

  const present = new Set(constraints.map((c) => c.conname));

  console.log(`\n  ${constraints.length} CHECK constraints present`);
  for (const c of constraints) console.log(`    ${c.conname}`);

  console.log("\n=== 2. are the required ones all present? ===\n");
  for (const name of REQUIRED) {
    if (present.has(name)) pass(name);
    else fail(name, "MISSING — this protection does not exist in the database");
  }

  console.log("\n=== 3. do they refuse what they should? ===\n");

  const sku = `${PROBE_PREFIX}${Date.now()}`;
  const product = await prisma.product.create({
    data: { sku, name: "invariant probe", kind: "OTHER", unit: "EA" },
    select: { id: true },
  });
  console.log(`  probe product ${sku} created\n`);

  await prisma.stockLevel.create({
    data: { productId: product.id, onHand: 10, reserved: 0 },
  });

  const movement = (id, kind, qty, reason, onHandAfter = 10) =>
    `INSERT INTO "StockMovement"
       (id, "productId", kind, qty, "onHandAfter", reason, "createdAt")
     VALUES ('${id}', '${product.id}', '${kind}'::"StockMovementKind", ${qty},
             ${onHandAfter}, ${reason === null ? "NULL" : `'${reason}'`}, now())`;

  // Sign convention. The single highest-risk constraint: eleven kinds, and a
  // mistake means the counter rejects legitimate work all day.
  await mustRefuse(
    "a NEGATIVE RECEIVE (a receipt adds to the shelf)",
    movement("probe_neg_receive", "RECEIVE", -5, "negative receive"),
    "stockmovement_sign_matches_kind",
  );
  await mustRefuse(
    "a POSITIVE CONSUME (a consumption removes from the shelf)",
    movement("probe_pos_consume", "CONSUME", 5, "positive consume"),
    "stockmovement_sign_matches_kind",
  );
  await mustRefuse(
    "a POSITIVE RESERVE (a hold takes availability away, so it is negative)",
    movement("probe_pos_reserve", "RESERVE", 4, "positive reserve"),
    "stockmovement_sign_matches_kind",
  );

  // A reason is how "why is the number wrong" gets answered six weeks later.
  await mustRefuse(
    "a movement whose reason is blank",
    movement("probe_blank_reason", "RECEIVE", 5, "   "),
    "stockmovement_human_reason_required",
  );
  await mustRefuse(
    "a movement with no reason at all",
    movement("probe_null_reason", "RECEIVE", 5, null),
    "stockmovement_human_reason_required",
  );

  // A zero row is a phantom entry that makes the history lie about itself.
  await mustRefuse(
    "a zero-quantity movement",
    movement("probe_zero", "RECEIVE", 0, "zero receive"),
    "stockmovement_qty_nonzero",
  );

  // THE INVARIANT. available = onHand - reserved, never negative.
  await mustRefuse(
    "reserved (5) GREATER than onHand (2) — overselling",
    `INSERT INTO "StockLevel" (id, "productId", "onHand", reserved, "updatedAt")
     VALUES ('probe_oversell', '${product.id}', 2, 5, now())`,
    "stocklevel_reserved_le_onhand",
  );
  await mustRefuse(
    "a NEGATIVE reserved — the mirror of overselling, which INFLATES availability",
    `UPDATE "StockLevel" SET reserved = -1, "updatedAt" = now()
      WHERE "productId" = '${product.id}'`,
    "stocklevel_reserved_non_negative",
  );
  await mustRefuse(
    "a NEGATIVE onHand — stock from nothing",
    `UPDATE "StockLevel" SET "onHand" = -1, "updatedAt" = now()
      WHERE "productId" = '${product.id}'`,
    "stocklevel_onhand_non_negative",
  );

  // Money. A negative cost silently poisons every margin report derived from it.
  await mustRefuse(
    "a negative cost price",
    `UPDATE "Product" SET "costPrice" = -100 WHERE id = '${product.id}'`,
    "product_cost_non_negative",
  );

  console.log("\n=== 4. and they must ALLOW a correct write ===\n");

  await mustAccept(
    "a valid RECEIVE of +4",
    movement("probe_ok_receive", "RECEIVE", 4, "correct receive", 14),
  );
  await mustAccept(
    "a valid CONSUME of -1",
    movement("probe_ok_consume", "CONSUME", -1, "correct consume", 13),
  );
  await mustAccept(
    "a valid RESERVE of -2",
    movement("probe_ok_reserve", "RESERVE", -2, "correct reserve", 13),
  );

  // ── cleanup ──────────────────────────────────────────────────────────────
  await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
  await prisma.stockLevel.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
  console.log("\n  probe cleaned up\n");

  if (failures === 0) {
    console.log("RESULT: the database enforces the invariant.");
    console.log("        Overselling is a write Postgres refuses, not a bug the code avoids.");
    process.exitCode = 0;
  } else {
    console.log(`RESULT: ${failures} problem(s). DO NOT go live.`);
    console.log("        See docs/inventory-decision-log.md §14 for why these are load-bearing.");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("probe failed:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());