/**
 * register-server-only.cjs — make Next's `server-only` guard a no-op for scripts.
 *
 * ============================================================================
 * WHY
 *
 * `src/lib/server/inventory/stock-engine.ts` opens with `import "server-only"`.
 * That package exists so a bundler ERRORS if a Client Component ever reaches a
 * module that touches the database. Inside Next.js that guard is correct and
 * load-bearing.
 *
 * Outside Next.js — in a `tsx` seed script, a cron worker, a maintenance
 * command — the guard throws anyway, because the package's only content is an
 * unconditional `throw`. So `npm run db:seed` failed with:
 *
 *     Error: This module cannot be imported from a Client Component module.
 *
 * …for anyone who ran it, which is the opposite of what a seed script should do.
 *
 * WHAT THIS DOES
 *
 * Maps the `server-only` specifier to an empty module, and nothing else. The
 * guard is only ever meaningful when a BUNDLER is deciding what to put in a
 * browser bundle. A plain Node script running `prisma migrate`-style work is
 * server-side by definition, so there is nothing to guard against and the
 * protection is pure friction.
 *
 * This deliberately does NOT disable any other safety check. It resolves one
 * exact specifier and returns everything else untouched.
 *
 * USED BY
 *   npm run db:seed
 * ============================================================================
 */

const Module = require("node:module");

// An empty CommonJS module. Requiring it is a no-op.
const STUB = require.resolve("./server-only-noop.cjs");

const originalResolve = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, ...rest) {
  if (request === "server-only") return STUB;
  return originalResolve.call(this, request, ...rest);
};