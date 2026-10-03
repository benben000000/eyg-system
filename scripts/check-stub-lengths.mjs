import { readFileSync, readdirSync } from "node:fs";

/**
 * Every stub secret in the workflows must satisfy the validator in src/lib/env.ts.
 *
 * The container was launched with
 *
 *     -e WEBHOOK_SIGNING_SECRET="ci-runtime-stub"
 *
 * which is 15 characters, against `WEBHOOK_SIGNING_SECRET: secret(16)`. The app
 * refused to boot, correctly, and the job failed at "wait for healthy" — which
 * reads like a container problem and is actually a configuration one.
 *
 * The minimums are read from the schema rather than restated here. A copy of the
 * numbers is a second thing to drift, and this file exists to stop that.
 */
const MINIMUMS = {};
{
  const env = readFileSync("src/lib/env.ts", "utf8");
  // `NAME: secret(N),`
  for (const m of env.matchAll(/([A-Z][A-Z0-9_]*)\s*:\s*secret\((\d+)\)/g)) {
    MINIMUMS[m[1]] = Number(m[2]);
  }
  // Any other shape, recorded so an unparsed validator is visible rather than
  // silently skipped.
  for (const m of env.matchAll(/([A-Z][A-Z0-9_]*)\s*:\s*(?!secret\()([a-zA-Z][\w]*)\(/g)) {
    if (!MINIMUMS[m[1]]) MINIMUMS[m[1]] = `?(${m[2]})`;
  }
}

console.log("=== minimum lengths declared in src/lib/env.ts ===");
for (const [k, v] of Object.entries(MINIMUMS).sort()) {
  console.log(`  ${k.padEnd(28)} ${typeof v === "number" ? `>= ${v}` : v}`);
}

const tracked = [];
for (const f of readdirSync(".github/workflows")) {
  if (f.endsWith(".yml") || f.endsWith(".yaml")) tracked.push(`.github/workflows/${f}`);
}

console.log("\n=== every secret-shaped value in the workflows ===");
let bad = 0;

for (const file of tracked) {
  const text = readFileSync(file, "utf8");
  const found = new Map();

  // YAML env blocks:  VAR: "value"
  for (const m of text.matchAll(/^\s*([A-Z][A-Z0-9_]{3,}):\s*"?([^"\n#]+)"?\s*$/gm)) {
    found.set(m[1], m[2].trim());
  }
  // docker run -e:  -e VAR="value"
  for (const m of text.matchAll(/-e\s+([A-Z][A-Z0-9_]{3,})=("[^"]*"|\S+)/g)) {
    found.set(m[1], m[2].replace(/^"|"$/g, ""));
  }
  // env-file style:  VAR=value  inside a run block
  for (const m of text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]{3,})=(\S+)\s*$/gm)) {
    found.set(m[1], m[2].replace(/^["']|["']$/g, ""));
  }

  for (const [name, value] of found) {
    const min = MINIMUMS[name];
    if (typeof min !== "number") continue;

    // Not a stub — a shell or Actions expression that expands at run time.
    // `$AUTH_SECRET` is 12 characters of text and 43 characters of secret, and
    // counting the source is how this check reported a pass as a failure.
    if (/^\$\{?\w+\}?$/.test(value) || /^\$\{\{/.test(value)) {
      console.log(`  --   ${file.padEnd(38)} ${name.padEnd(26)} (expression, not a literal)`);
      continue;
    }

    const len = value.length;
    const ok = len >= min;
    if (!ok) bad += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${file.padEnd(38)} ${name.padEnd(26)} ${String(len).padStart(3)} chars (need >= ${min})`,
    );
    if (!ok) console.log(`          value: ${JSON.stringify(value)}`);
  }
}

console.log(
  bad === 0
    ? "\nOK  every secret stub in the workflows satisfies its declared minimum"
    : `\nFAIL  ${bad} stub(s) too short for their validator`,
);
process.exitCode = bad === 0 ? 0 : 1;
