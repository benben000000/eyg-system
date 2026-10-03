/**
 * A7 · CI/CD & QA — the seam between this suite and A2's implementation.
 * ============================================================================
 * WHAT THIS IS
 * ------------
 * The inventory backend (`src/lib/server/inventory/**`, owned by A2) is written
 * in parallel with this suite. A test that hard-imports a file that does not
 * exist yet fails to *collect*, taking the whole file down with it and losing
 * the 40 other assertions in it. So each suite resolves its dependency at
 * runtime, and:
 *
 *   • if the module is present, every assertion runs and is enforced;
 *   • if it is absent, the assertions are registered **skipped** and a loud
 *     `describe("AWAITING …")` block carries one `it.todo` per capability that
 *     names the exact export and the exact file it waits on.
 *
 * Nothing is ever registered as "passing" by assertion removal, and nothing is
 * silently skipped: `tests/inventory/unit/ids-and-reasons.test.ts` asserts that
 * the awaiting block exists whenever the engine is absent, so a suite cannot
 * quietly degrade into a no-op.
 *
 * WHY THE IMPORT SPECIFIER IS A VARIABLE
 * --------------------------------------
 * `await import("@/lib/server/inventory/stock-engine")` written as a literal is
 * resolved by Vite's import analysis at *transform* time. If the file is absent
 * the whole test module fails to load and every other test in it is lost — the
 * exact failure mode this file exists to avoid. A computed specifier plus
 * `@vite-ignore` defers resolution to runtime, where a missing module is a
 * catchable `Error` instead of a collection crash.
 *
 * THE CANONICAL EXPORT NAMES
 * --------------------------
 * `src/lib/inventory-types.ts` defines the *shapes*; it does not name the
 * functions. The canonical names below are this suite's request to A2 and are
 * reproduced verbatim in every `it.todo`. Aliases are accepted so a
 * near-miss does not leave the suite dark — a resolved alias is reported in the
 * run output rather than silently swallowed.
 * ============================================================================
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it } from "vitest";

import type {
  MovementDto,
  MovementRefusalReason,
  MovementQuery,
  PostMovementInput,
  PostMovementRejection,
  PostMovementResult,
  ProductAvailabilityDto,
  ProductDto,
  RecordCountInput,
  ReservationDto,
  ReserveInput,
  ReserveResult,
  ServiceAvailabilityDto,
  StockCountDto,
  StockCountStatusValue,
  StockLevelDto,
} from "@/lib/inventory-types";

// ── Paths ───────────────────────────────────────────────────────────────────

/** Absolute path to `src/`, resolved from this file rather than `process.cwd`. */
export const SRC_DIR = fileURLToPath(new URL("../../../src/", import.meta.url));

/** Absolute path to `prisma/schema.prisma`. */
export const SCHEMA_PATH = fileURLToPath(new URL("../../../prisma/schema.prisma", import.meta.url));

export function readRepoFile(relativeFromRepoRoot: string): string {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const path = join(root, relativeFromRepoRoot);
  if (!existsSync(path)) throw new Error(`expected repo file ${relativeFromRepoRoot} at ${path}`);
  return readFileSync(path, "utf8");
}

// ── The engine surface this suite assumes ───────────────────────────────────

/** Context every mutating call carries. Who is doing this, and why. */
export interface ActorContext {
  actorId?: string;
  actorName?: string;
  /** Injected clock. Every test pins one. */
  now?: Date;
}

export interface StockEngineSurface {
  postMovement(
    input: PostMovementInput,
    ctx?: ActorContext,
  ): Promise<PostMovementResult | PostMovementRejection>;
  reserveForBooking(input: ReserveInput, ctx?: ActorContext): Promise<ReserveResult>;
  releaseReservations(
    input: { bookingId: string; reason: string; statuses?: string[] },
    ctx?: ActorContext,
  ): Promise<{ released: number; reservations: ReservationDto[] }>;
  consumeReservations(
    bookingId: string,
    ctx?: ActorContext,
  ): Promise<{ consumed: ReservationDto[]; movements: MovementDto[] }>;
  expireReservations(
    now: Date,
    ctx?: ActorContext,
  ): Promise<{ expired: number; reservations: ReservationDto[] }>;
}

export interface AvailabilitySurface {
  getServiceAvailability(
    query: { serviceIds: string[] },
    opts?: { includeCost?: boolean },
  ): Promise<ServiceAvailabilityDto[]>;
  getProductAvailability(productIds: string[]): Promise<ProductAvailabilityDto[]>;
}

export interface ReorderSurface {
  getReorderList(opts?: { includeCost?: boolean }): Promise<{
    rows: Array<Record<string, unknown>>;
    stockouts: number;
  }>;
}

export interface AgeingSurface {
  getStockAgeing(
    now: Date,
  ): Promise<Array<{ productId: string; kind: string; ageDays: number | null; isNearExpiry: boolean }>>;
}

export interface CountSurface {
  createCount(
    input: { scope?: string; note?: string },
    ctx?: ActorContext,
  ): Promise<StockCountDto>;
  recordCountLine(input: RecordCountInput, ctx?: ActorContext): Promise<StockCountDto>;
  reviewCount(
    input: { countId: string; status: StockCountStatusValue },
    ctx?: ActorContext,
  ): Promise<StockCountDto>;
  postCount(
    input: { countId: string; reference?: string },
    ctx?: ActorContext,
  ): Promise<{ count: StockCountDto; movements: MovementDto[]; posted: number }>;
}

export interface LedgerSurface {
  listMovements(query: MovementQuery, opts?: { includeCost?: boolean }): Promise<{
    rows: MovementDto[];
    total: number;
  }>;
  readStockLevel(productId: string): Promise<StockLevelDto>;
  readProduct(productId: string, opts?: { includeCost?: boolean }): Promise<ProductDto>;
}

// ── Capability resolution ───────────────────────────────────────────────────

export interface Capability {
  /** The name this suite asks A2 for. Appears verbatim in the `it.todo`. */
  readonly name: string;
  /** Accepted alternatives, tried after the canonical name. */
  readonly aliases: readonly string[];
}

const isFn = (value: unknown): value is (...args: never[]) => unknown => typeof value === "function";

/**
 * Declares one capability this suite requires.
 *
 * `is` is a presence check only — whether an export of that name exists — not a
 * behavioural test. A structural type guard cannot be written before the
 * implementation exists, and pretending otherwise with `() => true` typed as a
 * guard is a lie the compiler is right to reject.
 */
export function capability<T = unknown>(
  name: string,
  aliases: readonly string[] = [],
  is: (value: unknown) => boolean = () => true,
): Capability & { is: (value: unknown) => boolean } {
  void (undefined as T | undefined);
  return { name, aliases, is };
}

export interface Resolved {
  /** True when every requested capability was found. */
  readonly ready: boolean;
  readonly mod: Readonly<Record<string, unknown>> | null;
  readonly specifier: string | null;
  /** `"exportName from specifier"` for each capability that was not found. */
  readonly missing: readonly string[];
  /** Non-fatal findings, e.g. an alias matched instead of the canonical name. */
  readonly notes: readonly string[];
}

async function tryImport(specifier: string): Promise<Record<string, unknown> | null> {
  try {
    return (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Loads EVERY specifier that resolves and looks for each capability across all of
 * them.
 *
 * Merging rather than first-match matters: the implementation is split across
 * `stock-engine.ts`, `reservations.ts`, `availability.ts`, `reporting.ts` and
 * `counts.ts`, and a resolver that stopped at the first importable module would
 * report every reservation function as "missing" when it exists one file over.
 *
 * Never throws: an absent dependency is a *reported* state, not an error.
 */
export async function resolveInventoryModule(
  specifiers: readonly string[],
  capabilities: readonly Capability[],
): Promise<Resolved> {
  const merged: Record<string, unknown> = {};
  const loaded: string[] = [];

  for (const specifier of specifiers) {
    const candidate = await tryImport(specifier);
    if (!candidate) continue;
    loaded.push(specifier);
    for (const [key, value] of Object.entries(candidate)) {
      // First module wins, so the canonical home of a function stays authoritative.
      if (!(key in merged)) merged[key] = value;
    }
  }

  const missing: string[] = [];
  const notes: string[] = [];

  if (loaded.length === 0) {
    for (const cap of capabilities) missing.push(`${cap.name} from ${specifiers[0] ?? "?"}`);
    notes.push(`no module resolved from ${specifiers.join(", ")}`);
    return { ready: false, mod: null, specifier: null, missing, notes };
  }

  for (const cap of capabilities) {
    if (merged[cap.name] !== undefined) continue;
    const alias = cap.aliases.find((candidate) => merged[candidate] !== undefined);
    if (alias) {
      // Expose the alias UNDER THE CANONICAL NAME, so a test calls
      // `engine.reserveForBooking(...)` regardless of whether the implementation
      // called it `reserve`. The rename is reported, never silent.
      merged[cap.name] = merged[alias];
      notes.push(`export "${alias}" found; this suite calls it "${cap.name}"`);
      continue;
    }
    missing.push(`${cap.name} from ${loaded.join(" or ")}`);
  }

  return { ready: missing.length === 0, mod: merged, specifier: loaded.join(", "), missing, notes };
}

/** Narrow a resolved module to a typed surface. The cast is the seam. */
export function surface<T>(resolved: Resolved): T {
  if (!resolved.mod) throw new Error(`inventory module not loaded: ${resolved.missing.join(", ")}`);
  return resolved.mod as unknown as T;
}

// ── describe helpers ────────────────────────────────────────────────────────

/** Runs the suite when the dependency is present, registers nothing when not. */
export function describeWhenReady(
  resolved: Resolved,
  title: string,
  body: () => void,
): void {
  if (resolved.ready) describe(title, body);
}

/**
 * The loud marker. Registered only when the dependency is absent, so a `.todo`
 * disappears from the report the moment the export lands.
 */
export function describeAwaiting(resolved: Resolved, title: string): void {
  if (resolved.ready) return;
  describe(title, () => {
    for (const entry of resolved.missing) {
      it.todo(`awaits \`${entry}\``);
    }
    if (resolved.specifier === null) {
      it.todo(
        "awaits the module itself: none of " +
          "`src/lib/server/inventory/*.ts` exists yet, so no assertion in this file ran",
      );
    }
  });
}

// ── Contract re-exports so test files import from one place ─────────────────

export type {
  MovementDto,
  MovementRefusalReason,
  MovementQuery,
  PostMovementInput,
  PostMovementRejection,
  PostMovementResult,
  ProductAvailabilityDto,
  ProductDto,
  RecordCountInput,
  ReservationDto,
  ReserveInput,
  ReserveResult,
  ServiceAvailabilityDto,
  StockCountDto,
  StockCountStatusValue,
  StockLevelDto,
};
