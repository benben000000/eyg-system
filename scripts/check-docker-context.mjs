import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, resolve as resolvePath } from "node:path";

/**
 * Every relative import in the Docker build context must resolve to a file that
 * is ALSO in the build context.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `.dockerignore` removed `vitest.config.ts` but not `vitest.inventory.config.ts`,
 * which imports it. `tsconfig.json` includes every `.ts` file in the project, so
 * `next build` type-checked the survivor and failed:
 *
 *     Type error: Cannot find module './vitest.config' or its corresponding
 *     type declarations.
 *
 * Nothing on a workstation could see it: both files are present in the checkout.
 * The image is a different filesystem, and this is the only place the difference
 * is visible before the build fails.
 *
 * The general failure is "a file is excluded from the image, and something still
 * in the image refers to it". That is what this checks.
 * ---------------------------------------------------------------------------
 *
 * TWO THINGS THIS CHECK GOT WRONG FIRST, both kept in mind here:
 *
 *   1. Resolving against the worktree instead of the context. `existsSync` finds
 *      `vitest.config.ts` on disk and declares victory — reproducing the exact
 *      blindness it exists to remove.
 *   2. Testing the un-suffixed target against the file list, so every finding was
 *      labelled "absent from the worktree" when the file was really there and
 *      merely excluded. A diagnostic that mislabels its cause sends the reader
 *      looking in the wrong place.
 *
 * The check is proven in both directions: reverting `.dockerignore` to exact
 * names makes it report the dangling edge and exit 1.
 *
 * Not a replacement for building the image. It is a cheap, deterministic check
 * for the specific class that a build cannot see coming.
 */
const root = process.cwd();

/** Walk the worktree, skipping what Docker would not have anyway. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** `pat` -> matcher over a path segment. Only `*` is supported, as Docker does. */
function segmentMatcher(pat) {
  if (!pat.includes("*")) return null;
  const last = pat.split("/").pop();
  const rx = new RegExp(
    "^" +
      last
        .split("*")
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
  );
  return (rel) => rel.split("/").some((seg) => rx.test(seg));
}

/** Apply .dockerignore: last matching pattern wins, `!` negates. */
function buildContext() {
  const patterns = readFileSync(".dockerignore", "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const all = walk(root).map((f) => relative(root, f).split("\\").join("/"));

  const kept = all.filter((rel) => {
    let ignored = false;
    for (const raw of patterns) {
      const negate = raw.startsWith("!");
      const pat = (negate ? raw.slice(1) : raw).replace(/\/+$/, "");
      const glob = segmentMatcher(pat);
      const hit = rel === pat || rel.startsWith(`${pat}/`) || (glob ? glob(rel) : false);
      if (hit) ignored = !negate;
    }
    return !ignored;
  });

  return { all, kept, patterns };
}

const { all, kept, patterns } = buildContext();
const keptSet = new Set(kept);
const allSet = new Set(all);

console.log(`worktree files   : ${all.length}`);
console.log(`build-context    : ${kept.length}`);
console.log(`excluded         : ${all.length - kept.length}`);
console.log(`.dockerignore    : ${patterns.length} patterns`);

// ── Resolve every relative import in the context ────────────────────────────
const EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".d.ts", "/index.ts", "/index.tsx"];

const SPECIMEN = [
  /(?:^|[\s;])(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

let edges = 0;
let scanned = 0;
const dangling = [];

for (const rel of kept) {
  if (!/\.(ts|tsx)$/.test(rel)) continue;
  scanned += 1;

  const abs = join(root, rel);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    continue;
  }

  const specs = new Set();
  for (const re of SPECIMEN) {
    for (const m of text.matchAll(re)) specs.add(m[1]);
  }

  for (const spec of specs) {
    // Bare and aliased specifiers resolve through node_modules or tsconfig
    // paths, neither of which this check models. Only relative edges are
    // answerable from the file list alone.
    if (!spec.startsWith(".")) continue;
    edges += 1;

    const target = resolvePath(dirname(abs), spec);

    // Against the CONTEXT, not the filesystem.
    const candidates = EXTS.map((e) => relative(root, target + e).split("\\").join("/"));
    if (candidates.some((c) => keptSet.has(c))) continue;

    // Label the cause from the candidates, which carry the extension.
    const inWorktree = candidates.find((c) => allSet.has(c));
    dangling.push({
      from: rel,
      spec,
      asRel: inWorktree ?? relative(root, target).split("\\").join("/"),
      excluded: Boolean(inWorktree),
    });
  }
}

console.log(`ts/tsx scanned   : ${scanned}`);
console.log(`relative edges   : ${edges}`);

if (dangling.length === 0) {
  console.log("\nOK  every relative import in the build context resolves inside the context");
  process.exit(0);
}

console.log(`\nFAIL  ${dangling.length} relative import(s) in the build context do not resolve:`);
for (const d of dangling) {
  console.log(`\n  ${d.from}`);
  console.log(`      imports "${d.spec}"`);
  console.log(`      target  ${d.asRel}`);
  console.log(
    d.excluded
      ? "      reason  present in the repository, EXCLUDED by .dockerignore"
      : "      reason  no such file in the repository either",
  );
}
console.log(
  "\nEither drop the referring file from the image, or stop excluding its target.\n" +
    "Excluding a test config while tsconfig still type-checks the project is the\n" +
    "usual way this happens.",
);
process.exit(1);
