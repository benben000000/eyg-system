#!/usr/bin/env node
/**
 * GUARD: `"use client"` on every module that uses a React hook.
 *
 * WHY THIS EXISTS
 * ---------------
 * `OpenStatusPill.tsx` was rewritten without its `"use client"` directive while
 * it was being restyled. `next build` still succeeded, `tsc` was clean, and the
 * unit tests all passed. The homepage 500'd in the browser with
 *
 *     TypeError: w.useState is not a function or its return value is not iterable
 *
 * because `Hero.tsx` is a Server Component, so a hook in the module it imports
 * has no React runtime to hang off. That failure only appears at RUNTIME, and
 * only on the route that imports it — the worst possible time to find out.
 *
 * Run by `.github/workflows/ci.yml` and available locally as
 *   node scripts/check-client-boundaries.mjs
 * Exits non-zero when a hook-bearing module is missing the directive.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const SRC = join(ROOT, "src");

const HOOKS =
  /\b(useState|useEffect|useLayoutEffect|useRef|useCallback|useMemo|useReducer|useContext|useId|useSyncExternalStore|useTransition|useDeferredValue|useImperativeHandle|useActionState)\s*\(/;

/** Strip block and line comments so the first real statement can be found. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const offenders = [];
let examined = 0;

for (const file of walk(SRC)) {
  const raw = readFileSync(file, "utf8");
  if (!HOOKS.test(raw)) continue;
  examined += 1;

  const firstStatement = stripComments(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);

  if (!/^["']use client["'];?/.test(firstStatement ?? "")) {
    offenders.push({
      file: relative(ROOT, file).split(sep).join("/"),
      first: (firstStatement ?? "(empty)").slice(0, 70),
    });
  }
}

console.log(`client-boundary guard: ${examined} hook-bearing module(s) examined`);

if (offenders.length === 0) {
  console.log("  all of them declare \"use client\"");
  process.exit(0);
}

console.error(`\n  ${offenders.length} module(s) use a React hook but are not client components:`);
for (const o of offenders) {
  console.error(`\n    ${o.file}`);
  console.error(`      first statement: ${o.first}`);
  console.error(`      fix: add "use client"; as the first line of the file.`);
}
console.error(
  `\n  A hook in a Server Component fails at RUNTIME with\n` +
    `    "w.useState is not a function or its return value is not iterable"\n` +
    `  and only on the route that imports it. Build and typecheck will not catch it.`,
);
process.exit(1);