/**
 * A7 · CI/CD & QA — deterministic interleaving control for the concurrency suite.
 * ============================================================================
 * WHY THIS EXISTS
 * ---------------
 * `Promise.all([reserveA(), reserveB()])` interleaves *nondeterministically*. It
 * reproduces a race some of the time, which is the worst possible property for a
 * test: a race test that only fails when the scheduler feels like it is a race
 * test that will be green the day it matters.
 *
 * This module makes the interleaving a **declared input**. A test names the
 * operations that must rendezvous; every actor arriving at one of those
 * operations waits until all of them have arrived, so "A reads, B reads, A
 * writes, B writes" is a schedule the suite *chooses* rather than one it hopes
 * for.
 *
 * WHERE THE YIELD POINT GOES
 * --------------------------
 * `fake-prisma` awaits the hook at the top of every call, *before* it evaluates
 * a predicate or applies a write. That ordering is deliberate: the hook is the
 * only suspension point, so predicate-evaluation and write stay in one
 * uninterrupted synchronous block and each fake call remains as atomic as a
 * single SQL statement.
 *
 * DETERMINISM WITHOUT A WALL CLOCK
 * --------------------------------
 * A barrier has two exits: every party arrived, or the event loop went idle.
 * The second is detected by counting consecutive `setImmediate` turns with no
 * new arrival, so a partial barrier (one actor refused before reaching it)
 * releases promptly instead of hanging. No timers, no `Date.now()`, no flake.
 * A suite that only ever takes the "all arrived" path does so with no waiting
 * at all; `timedOut` is asserted `false` wherever both actors must participate.
 * ============================================================================
 */

const IDLE_TURNS_BEFORE_RELEASE = 12;

export interface Rendezvous {
  /** Install on a `fake-prisma` database. */
  install: (db: {
    setYieldHook: (
      hook: (phase: string, op: string, args: unknown, result?: unknown) => Promise<void>,
    ) => void;
  }) => void;  /** Ops that reached a barrier, in the order they arrived. The schedule. */
  readonly arrivals: readonly string[];
  /** Ops allowed straight through because they are not barrier ops. */
  readonly bypassed: readonly string[];
  /** True if a barrier ever had to release on the idle path. */
  readonly timedOut: boolean;
  /** How many times a barrier group was released by all parties arriving. */
  readonly releases: number;
}

export interface RendezvousHandle extends Rendezvous {
  /** Composable hook, in case a test needs its own instrumentation. */
  hook: (phase: string, op: string) => Promise<void>;
}

/**
 * @param barrierOps `"<phase>:<table>:<verb>"` keys, e.g. `post:stockLevel:read`.
 *                   An actor arriving at one waits until every expected actor has
 *                   arrived at a barrier op.
 * @param parties    How many actors make up a generation. Defaults to 2 — the
 *                   two simultaneous callers whose race this suite exists for.
 */
export function createRendezvous(barrierOps: readonly string[], parties = 2): RendezvousHandle {
  const barriers = new Set(barrierOps);
  const arrivals: string[] = [];
  const bypassed: string[] = [];
  let waiting = 0;
  let releases = 0;
  let idleTurns = 0;
  let timedOut = false;

  /**
   * Every parked party, not just the last one.
   *
   * A single `settle` slot looks sufficient for `parties = 2` and deadlocks
   * immediately for `parties > 2`: the second and third arrivals overwrite the
   * first's resolver, so that actor waits for a release that will never name it.
   * The N-caller tests found this the hard way.
   */
  const parked = new Set<() => void>();

  const flush = (): void => {
    const waiting_ = [...parked];
    parked.clear();
    idleTurns = 0;
    for (const resolve of waiting_) resolve();
  };

  const hook = async (phase: string, op: string): Promise<void> => {
    const key = `${phase}:${op}`;
    if (!barriers.has(key)) {
      bypassed.push(key);
      return;
    }
    arrivals.push(key);
    waiting += 1;
    if (waiting >= parties) {
      waiting = 0;
      releases += 1;
      flush();
      return;
    }
    // One party is short — most likely because it already refused, or because a
    // losing caller is re-reading. Wait for a latecomer across a bounded number
    // of idle event-loop turns only.
    await new Promise<void>((resolve) => {
      parked.add(resolve);
      const tick = (): void => {
        if (!parked.has(resolve)) return;
        idleTurns += 1;
        if (idleTurns >= IDLE_TURNS_BEFORE_RELEASE) {
          timedOut = true;
          flush();
          return;
        }
        setImmediate(tick);
      };
      setImmediate(tick);
    });
  };

  return {
    install(db) {
      db.setYieldHook(async (phase, op) => {
        await hook(phase, op);
      });
    },
    arrivals,
    bypassed,
    timedOut,
    get releases(): number {
      return releases;
    },
    hook,
  };
}

/**
 * Starts every actor before awaiting any of them, so neither can complete
 * before the others reach a barrier point. Order of *start* is fixed; order of
 * *arrival* at a barrier is then decided by the schedule, not the scheduler.
 *
 * Overloaded so a two-actor race destructures to a definite pair. Under
 * `noUncheckedIndexedAccess` a plain `T[]` makes `const [a, b] = await race(…)`
 * give `a: T | undefined`, and a caller that has to re-narrow it has lost the
 * point of the helper.
 */
export function race<A, B>(
  actors: readonly [{ run: () => Promise<A> }, { run: () => Promise<B> }],
): Promise<[A, B]>;
export function race<T>(actors: ReadonlyArray<{ run: () => Promise<T> }>): Promise<T[]>;
export function race<T>(actors: ReadonlyArray<{ run: () => Promise<T> }>): Promise<T[]> {
  const started = actors.map((actor) => actor.run());
  return Promise.all(started);
}
