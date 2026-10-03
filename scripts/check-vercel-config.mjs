#!/usr/bin/env node
import fs from "node:fs";

/**
 * `vercel.json` is validated by Vercel's own schema, and the failure is blunt:
 * the whole deploy is refused with `should NOT have additional property '//cron'`.
 *
 * That is not hypothetical. A comment key was added here to carry a note about the
 * cron schedule, JSON has no comment syntax, and it looked harmless because most
 * JSON tooling ignores unknown keys. Vercel does not. The deploy failed.
 *
 * So this validates the file the way Vercel does: against the schema Vercel
 * publishes at the `$schema` URL in the file itself. Any unknown top-level key
 * fails the build here, in seconds, instead of at deploy time.
 *
 * The schema is fetched rather than vendored, because a vendored copy of
 * "properties Vercel accepts" goes stale the moment Vercel ships a key, and a
 * stale allowlist that rejects a valid key is its own outage. If the fetch fails
 * the check degrades to parsing plus a vendored floor instead of pretending to
 * have validated something it did not.
 */
const FILE = "vercel.json";

/**
 * Keys this file is allowed to use, as a fallback and as a floor. Kept
 * deliberately short: it exists to catch a stray comment key, not to mirror
 * Vercel's schema. `undefined` means "not checked in this pass".
 */
const KNOWN = new Set([
  "$schema",
  "framework",
  "installCommand",
  "buildCommand",
  "devCommand",
  "outputDirectory",
  "cleanUrls",
  "trailingSlash",
  "regions",
  "functions",
  "crons",
  "headers",
  "redirects",
  "rewrites",
  "images",
  "env",
  "build",
  "ignoreCommand",
  "frameworkVersion",
  "public",
  "git",
]);

const failures = [];

let raw;
let config;
try {
  raw = fs.readFileSync(FILE, "utf8");
  config = JSON.parse(raw);
} catch (e) {
  console.error(`  FAIL  ${FILE} is not valid JSON: ${e.message}`);
  process.exit(1);
}
console.log(`  ok    ${FILE} parses (${raw.length} bytes)`);

// A comment key is the exact failure that prompted this, and it is invisible in a
// JSON parser's output, so scan the raw text as well.
const commentKeys = [...raw.matchAll(/"(\/\/[^"]*)"\s*:/g)].map((m) => m[1]);
if (commentKeys.length) {
  failures.push(
    [
      `${FILE} contains JSON-comment keys: ${commentKeys.map((k) => `"${k}"`).join(", ")}`,
      "  JSON has no comments. Vercel rejects the entire deploy with",
      "  `should NOT have additional property`. Use a key that exists in the schema,",
      "  and put the note in docs/inventory-decision-log.md.",
    ].join("\n"),
  );
}

const keys = Object.keys(config);
console.log(`  ok    ${keys.length} top-level keys: ${keys.join(", ")}`);

const schemaUrl = config.$schema;
let schema = null;
if (schemaUrl) {
  try {
    const res = await fetch(schemaUrl, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      schema = await res.json();
      console.log(`  ok    fetched the published schema from ${schemaUrl}`);
    } else {
      console.log(`  warn  schema fetch returned HTTP ${res.status} — falling back to the vendored key list`);
    }
  } catch (e) {
    console.log(`  warn  could not fetch the schema (${e.message}) — falling back to the vendored key list`);
  }
} else {
  console.log(`  warn  no $schema in ${FILE} — falling back to the vendored key list`);
}

if (schema) {
  // The published document nests the real object under allOf/oneOf in some
  // revisions, so collect every `properties` block it mentions.
  const allowed = new Set();
  const collect = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.properties && typeof node.properties === "object") {
      for (const k of Object.keys(node.properties)) allowed.add(k);
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === "object") collect(v);
    }
  };
  collect(schema);
  const unknown = keys.filter((k) => k !== "$schema" && !allowed.has(k));
  if (allowed.size) {
    if (unknown.length) {
      failures.push(
        [
          `these keys are not in Vercel's schema: ${unknown.join(", ")}`,
          "  the deploy will be refused before anything is built.",
          "  remove them, or move the note into docs/inventory-decision-log.md.",
        ].join("\n"),
      );
    } else {
      console.log(`  ok    every key appears in the schema (${allowed.size} properties published)`);
    }
  }
} else {
  const unknown = keys.filter((k) => !KNOWN.has(k));
  if (unknown.length) {
    failures.push(
      [
        `these keys are not recognised: ${unknown.join(", ")}`,
        "  the published schema was unreachable, so this is the vendored floor, not",
        "  a full validation. Treat it as suspect.",
      ].join("\n"),
    );
  } else {
    console.log(`  ok    every key is on the vendored list (not a full schema validation)`);
  }
}

// The cron is the one setting in this file that silently changed meaning, so it
// is asserted rather than assumed.
const crons = config.crons ?? [];
for (const cron of crons) {
  if (!cron.path) failures.push(`a cron entry has no "path": ${JSON.stringify(cron)}`);
  if (!cron.schedule) failures.push(`cron "${cron.path}" has no "schedule"`);
  const perDay = typeof cron.schedule === "string" && /^(\*|\*\/\d+|\d+) (\*|\*\/\d+|\d+) \* \* \*$/.test(cron.schedule);
  if (perDay) {
    console.log(`  ok    cron "${cron.path}" runs ${cron.schedule} — at most once a day, so Vercel Hobby accepts it`);
  } else {
    console.log(`  ok    cron "${cron.path}" runs ${cron.schedule} — more than daily, so this needs Vercel Pro`);
  }
}

if (failures.length === 0) {
  console.log("\n  vercel.json would pass Vercel's schema validation.");
  process.exit(0);
}
for (const f of failures) console.error(`\n  FAIL  ${f}`);
console.error(`\n  ${failures.length} problem(s). Vercel refuses the whole deploy on any of these.`);
process.exit(1);
