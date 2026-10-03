/**
 * A7 · CI/CD & QA — the mock that lets the inventory engine run against the fake.
 * ============================================================================
 * `src/lib/server/inventory/**` imports `prisma`, `withSerializableRetry` and
 * `Prisma` from `@/lib/server/db`. Mocking that module is the only way to point
 * the engine at an in-memory database, and it is the same seam
 * `tests/integration/api-booking.test.ts` already uses — so this is the house
 * pattern, not a new one.
 *
 * WHY A SWAPPABLE "CURRENT" DATABASE
 * ----------------------------------
 * `vi.mock` factories are hoisted above every other statement in the file, so
 * they cannot close over a `const` declared later. The house pattern works
 * because its fake is created at module scope and mutated in place. Inventory
 * tests need a FRESH database per test (a stock level from the previous test is
 * a stock level this test cannot reason about), and they need two at once — one
 * serialisable and one not.
 *
 * So the mock exports a stable object whose every property is looked up on the
 * database installed for the current test, at CALL time. `vi.mock` hoisting stops
 * mattering, `beforeEach` stays ordinary, and no state leaks between tests.
 * ============================================================================
 */

import { vi } from "vitest";

import {
  createFakeDb,
  PrismaClientKnownRequestError,
  prismaSqlTag,
  type FakeDb,
  type FakeTx,
} from "./fake-prisma";

/** The database the mocked `prisma` currently talks to. */
let current: FakeDb = createFakeDb({ now: () => new Date("2026-03-11T09:00:00+08:00") });

export function useFakeDatabase(next: FakeDb): FakeDb {
  current = next;
  return next;
}

export function currentFakeDatabase(): FakeDb {
  return current;
}

/**
 * Every property is resolved on `current` at access time, and every method is
 * bound to it, so `const { prisma } = await import("@/lib/server/db")` at module
 * scope still talks to whichever database the current test installed.
 *
 * Typed explicitly rather than inferred: a `Proxy` whose handler refers to the
 * proxy is a circular inference, and TypeScript's answer to that is `any`.
 */
const liveProxy: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
  get(_target: Record<string, unknown>, prop: string | symbol): unknown {
    const source = current as unknown as Record<string, unknown>;
    const value = Reflect.get(source, prop);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(source)
      : value;
  },
  has(_target: Record<string, unknown>, prop: string | symbol): boolean {
    return prop in (current as unknown as Record<string, unknown>);
  },
  ownKeys(): ArrayLike<string | symbol> {
    return Reflect.ownKeys(current as unknown as Record<string, unknown>);
  },
  getOwnPropertyDescriptor(): PropertyDescriptor {
    return { configurable: true, enumerable: true };
  },
});

vi.mock("@/lib/server/db", () => ({
  prisma: liveProxy,
  default: liveProxy,
  withSerializableRetry: <T>(fn: (tx: FakeTx) => Promise<T>, opts?: { attempts?: number }): Promise<T> =>
    current.withSerializableRetry(fn, opts),
  /**
   * Only what the engine actually uses. `Prisma.sql` builds the guarded
   * statement; `TransactionIsolationLevel.Serializable` is what
   * `withSerializableRetry` passes; `PrismaClientKnownRequestError` is what the
   * engine's `instanceof` checks against when it catches a `P2002`. The real
   * client is not booted, so no connection is opened and no query engine loads.
   */
  Prisma: {
    sql: prismaSqlTag,
    TransactionIsolationLevel: { Serializable: "Serializable", ReadCommitted: "ReadCommitted" },
    PrismaClientKnownRequestError,
    PrismaClientValidationError: class PrismaClientValidationError extends Error {},
  },
}));
