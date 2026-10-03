import { readFileSync, readdirSync } from "node:fs";

/**
 * Every secret stub in the workflows must satisfy the validator in src/lib/env.ts.
 *
 * ---------------------------------------------------------------------------
 * WHY A STUB THAT IS ONE CHARACTER SHORT IS WORTH A GATE
 *
 * The container was launched with `-e WEBHOOK_SIGNING_SECRET="ci-runtime-stub"`
 * — 15 characters, against `secret(16)`. The app booted, validated, and refused:
 *
 *     Error: EYG Tire & Auto Care - invalid environment
 *     WEBHOOK_SIGNING_SECRET: must be at least 16 characters
 *
 * No job questioned the value, because nothing had ever launched a container.
 *
 * ---------------------------------------------------------------------------
 * AND THE BUG THIS CHECK ITSELF HAD
 *
 * The first version collected secrets into a Map keyed by variable name, per
 * file, and reported one value per variable. But a single workflow legitimately
 * declares different stubs for different jobs — ci.yml carries the general CI
 * env, the docker-run `-e` overrides, and the lighthouse job's own env. The map
 * kept whichever was parsed last, so the lighthouse job's 15-character
 * `lighthouse-stub` was silently replaced by a 28-character value from another
 * job, and the check reported green while a real job failed on it.
 *
 * One value per variable is the wrong shape. Every declaration is collected, with
 * its line number, and every one is checked.
 * ---------------------------------------------------------------------------
 */
const MINIMUMS = {};
{
  const env = readFileSync("src/lib/env.ts", "utf8");
  for (const m of env.matchAll(/([A-Z][A-Z0-9_]*)\s*:\s*secret\((\d+)\)/g)) {
    MINIMUMS[m[1]] = Number(m[2]);
  }
}

console.log("=== minimum lengths declared in src/lib/env.ts ===");
for (const [k, v] of Object.entries(MINIMUMS).sort()) console.log(`  ${k.padEnd(28)} >= ${v}`);

const files = readdirSync(".github/workflows")
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .map((f) => `.github/workflows/${f}`);

/** Every `NAME: "value"` and `-e NAME="value"` declaration, with its line. */
function declarations(text) {
  const found = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, i) => {
    // A YAML env block entry or a shell assignment.
    const assign = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]{3,})\s*[:=]\s*("[^"]*"|'[^']*'|[^\s#\\]+)/.exec(raw);
    if (assign) {
      found.push({ name: assign[1], value: assign[2].replace(/^["']|["']$/g, ""), line: i + 1, raw });
    }
    // A `docker run -e NAME=value` anywhere on the line.
    for (const m of raw.matchAll(/-e\s+([A-Z][A-Z0-9_]{3,})=("[^"]*"|'[^']*'|\S+)/g)) {
      found.push({ name: m[1], value: m[2].replace(/^["']|["']$/g, ""), line: i + 1, raw });
    }
  });

  return found;
}

console.log("\n=== every secret stub declared in the workflows ===");
let bad = 0;
let checked = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");

  for (const d of declarations(text)) {
    const min = MINIMUMS[d.name];
    if (typeof min !== "number") continue;

    // Not a stub — a shell or Actions expression that expands at run time.
    // `$AUTH_SECRET` is 12 characters of text and 43 characters of secret, and
    // counting the source reports a pass as a failure.
    if (/^\$\{?\w+\}?$/.test(d.value) || d.value.startsWith("${{")) {
      console.log(`  --   ${file} ${String(d.line).padStart(4)}  ${d.name} (expression)`);
      continue;
    }

    // A line that is entirely a comment, quoting a bad example in its prose.
    if (/^\s*#/.test(d.raw)) continue;

    checked += 1;
    const ok = d.value.length >= min;
    if (!ok) bad += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${file} ${String(d.line).padStart(4)}  ${d.name.padEnd(24)} ${String(d.value.length).padStart(3)} chars (need >= ${min})`,
    );
    if (!ok) console.log(`            L${d.line}  ${d.raw.trim()}`);
  }
}

console.log(`\n  ${checked} literal stub(s) checked`);
console.log(
  bad === 0
    ? "OK  every secret stub in the workflows satisfies its declared minimum"
    : `FAIL  ${bad} stub(s) too short for their validator`,
);
process.exitCode = bad === 0 ? 0 : 1;
