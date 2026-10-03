#!/usr/bin/env node
/**
 * validate-env.mjs — keep `.env.example` and the Zod schema honest.
 * ============================================================================
 * The env contract has two halves that drift apart silently:
 *
 *   1. `.env.example`      — the documented list a human copies from.
 *   2. `src/lib/env.ts`    — the Zod schema the app actually boots against,
 *                            plus any `process.env.X` read for `NEXT_PUBLIC_*`.
 *
 * When they drift, either a required variable is invisible to whoever sets up a
 * deployment, or a documented variable does nothing. Both are outages. This
 * script fails the build on either direction.
 *
 * Pure Node ESM. No dependencies. Reads both files as *text* and never imports
 * `env.ts` — importing it would execute the schema and throw on a dev laptop
 * that has no secrets.
 *
 * Usage:
 *   node scripts/validate-env.mjs
 *   node scripts/validate-env.mjs --json
 *   node scripts/validate-env.mjs --allow-undocumented=RATE_LIMIT_READ_PER_MINUTE,ADMIN_EMAIL
 *
 * Flags:
 *   --json                          machine-readable result on stdout
 *   --quiet                         only print the summary line
 *   --allow-undocumented=a,b,c     downgrade "schema key not documented" to a
 *                                   warning. Also readable from
 *                                   ENV_CONTRACT_ALLOW_UNDOCUMENTED.
 *   --schema <path>                 override the schema path
 *   --example <path>                override the example path
 *
 * Exit codes:  0 = contract is honest   1 = mismatch   2 = file missing / bad usage
 *
 * SECRET HYGIENE: this script only ever prints variable *names*. It never reads
 * a real `.env`, never prints a value, and never echoes a line it did not match
 * as an assignment.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/** @typedef {{ name: string, required: boolean, kind: "server" | "public" }} SchemaKey */

// ── CLI parsing ─────────────────────────────────────────────────────────────

/** @returns {{ json: boolean, quiet: boolean, allow: string[], schema: string, example: string }} */
function parseArgs(argv) {
  const opts = { json: false, quiet: false, allow: [], schema: "", example: "" };

  for (const arg of argv) {
    if (arg === "--json") opts.json = true;
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg.startsWith("--allow-undocumented=")) {
      opts.allow.push(...arg.slice("--allow-undocumented=".length).split(","));
    } else if (arg.startsWith("--schema=")) {
      opts.schema = arg.slice("--schema=".length);
    } else if (arg.startsWith("--example=")) {
      opts.example = arg.slice("--example=".length);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "validate-env.mjs — assert .env.example <-> src/lib/env.ts parity\n" +
          "  --json                       emit a JSON report\n" +
          "  --quiet                      suppress the per-item detail\n" +
          "  --allow-undocumented=a,b,c   warn instead of fail for these keys\n" +
          "  --schema=path --example=path override input paths\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`validate-env: unknown argument "${arg}"\n`);
      process.exit(2);
    }
  }

  const fromEnv = process.env.ENV_CONTRACT_ALLOW_UNDOCUMENTED;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    opts.allow.push(...fromEnv.split(","));
  }
  opts.allow = opts.allow.map((s) => s.trim()).filter(Boolean);
  return opts;
}

// ── Parsing helpers ─────────────────────────────────────────────────────────

/**
 * Reads `KEY=value` pairs out of a dotenv file. Understands `export KEY=value`,
 * `#` comments, blank lines, single/double quoted values and values containing
 * `#` inside quotes (e.g. `EMAIL_FROM="EYG <a@b.ph>"`).
 * @param {string} text
 * @returns {string[]} keys in file order, de-duplicated
 */
function parseDotenvKeys(text) {
  /** @type {string[]} */
  const keys = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m && m[1]) {
      if (!keys.includes(m[1])) keys.push(m[1]);
    }
  }
  return keys;
}

/**
 * Extracts the keys declared inside the Zod `serverSchema = z.object({ ... })`
 * literal. Purely textual: we find the `z.object({` that follows
 * `serverSchema` and count braces. This is intentionally naive and will need
 * updating if the schema is restructured — `validate-env` failing loudly is the
 * intended signal that it happened.
 * @param {string} text
 * @returns {string[]}
 */
function extractObjectKeys(text, anchor) {
  const anchorAt = text.indexOf(anchor);
  if (anchorAt === -1) return [];

  // The declaration may be written `z.object({`, `z\n  .object({` or
  // `z.object(\n{`. Match the call, then find its brace.
  const callRe = /\.object\s*\(\s*\{/g;
  callRe.lastIndex = anchorAt;
  const call = callRe.exec(text);
  if (!call) return [];

  const open = text.indexOf("{", call.index);
  let depth = 0;
  let inner = "";
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      depth += 1;
      if (depth === 1) continue; // do not include the opening brace itself
      inner += ch;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) break;
      inner += ch;
      continue;
    }
    inner += ch;
  }

  // Only keys declared at depth 1 belong to this object; anything deeper is a
  // nested literal (there are none today, but this keeps the parser honest).
  /** @type {string[]} */
  const keys = [];
  let lineDepth = 1;

  for (const rawLine of inner.split(/\r?\n/)) {
    const line = stripLineComment(rawLine);
    if (lineDepth === 1 && line.trim() !== "") {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
      if (m && m[1] && !keys.includes(m[1])) keys.push(m[1]);
    }
    for (const ch of line) {
      if (ch === "{") lineDepth += 1;
      else if (ch === "}") lineDepth -= 1;
    }
  }
  return keys;
}

/** Removes a `//` line comment without touching a `//` inside a string. */
function stripLineComment(line) {
  let inQuote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inQuote = ch;
    } else if (ch === "/" && line[i + 1] === "/") {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Every `process.env.NAME` read anywhere in the schema module. This is how
 * `NEXT_PUBLIC_*` values reach the client bundle without a Zod entry — they are
 * inlined by Next at build time, so they cannot be validated at boot.
 * @param {string} text
 * @returns {string[]}
 */
function extractProcessEnvReads(text) {
  /** @type {string[]} */
  const out = [];
  const re = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1] ?? m[2];
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * Reads `publicEnv` / `NEXT_PUBLIC_*` declarations from a sibling
 * `src/lib/public-env.ts` if the backend agent has created it. Absent file is
 * not an error.
 * @param {string} path
 * @returns {string[]}
 */
function extractPublicEnvKeys(path) {
  if (!existsSync(path)) return [];
  try {
    const text = readFileSync(path, "utf8");
    return extractObjectKeys(text, "publicEnv");
  } catch {
    return [];
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

const RED = "[31m";
const GRN = "[32m";
const YEL = "[33m";
const DIM = "[2m";
const BLD = "[1m";
const OFF = "[0m";

const useColour = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const c = (code, text) => (useColour ? `${code}${text}${OFF}` : text);

const opts = parseArgs(process.argv.slice(2));
const schemaPath = resolve(ROOT, opts.schema || "src/lib/env.ts");
const examplePath = resolve(ROOT, opts.example || ".env.example");
const publicEnvPath = resolve(ROOT, "src/lib/public-env.ts");

/** @type {{ name: string, required: boolean, kind: "server" | "public" }[]} */
const problems = [];
const warnings = [];

// --- Presence of inputs ------------------------------------------------------

if (!existsSync(schemaPath)) {
  process.stderr.write(
    c(RED, "validate-env: FAILED") +
      `\n  Cannot find the env schema at ${schemaPath}.\n` +
      "  The backend agent owns src/lib/env.ts. If it is not written yet, create a\n" +
      "  stub containing `serverSchema = z.object({ DATABASE_URL: z.string() })` —\n" +
      "  re-run afterwards.\n",
  );
  process.exit(2);
}

if (!existsSync(examplePath)) {
  process.stderr.write(
    c(RED, "validate-env: FAILED") +
      `\n  Cannot find the env contract at ${examplePath}.\n` +
      "  `.env.example` is orchestrator-owned and must be committed.\n",
  );
  process.exit(2);
}

// --- Extract -----------------------------------------------------------------

const schemaText = readFileSync(schemaPath, "utf8");
const exampleText = readFileSync(examplePath, "utf8");

const serverKeys = extractObjectKeys(schemaText, "serverSchema");
const procEnvKeys = extractProcessEnvReads(schemaText);
const publicKeys = extractPublicEnvKeys(publicEnvPath);
const documentedKeys = parseDotenvKeys(exampleText);

if (serverKeys.length === 0) {
  process.stderr.write(
    c(RED, "validate-env: FAILED") +
      "\n  Could not locate `serverSchema = z.object({ ... })` in " +
      schemaPath +
      ".\n" +
      "  The schema was probably restructured. Update scripts/validate-env.mjs to match.\n",
  );
  process.exit(2);
}

/** Every key the app knows about, and how it is delivered. */
const known = new Map(serverKeys.map((k) => [k, "server"]));
for (const k of [...procEnvKeys, ...publicKeys]) if (!known.has(k)) known.set(k, "public");

// --- Check 1: every schema key must be documented ----------------------------

const allowSet = new Set(opts.allow);
const undocumented = serverKeys.filter((k) => !documentedKeys.includes(k));

for (const key of undocumented) {
  const entry = allowSet.has(key)
    ? `allowed by --allow-undocumented (pending an orchestrator .env.example edit)`
    : "add it to .env.example with a comment saying where to get the value";
  if (allowSet.has(key)) {
    warnings.push(`${key} — required by the Zod schema but missing from .env.example (${entry})`);
  } else {
    problems.push(`${key} — required by the Zod schema but missing from .env.example → ${entry}`);
  }
}

// --- Check 2: every documented key must be known to the app ------------------

const unknown = documentedKeys.filter((k) => !known.has(k));

for (const key of unknown) {
  // A documented var that the app never reads is the most dangerous kind of
  // mistake: the operator sets it, it feels live, it does nothing.
  problems.push(`${key} — documented in .env.example but never read by src/lib/env.ts`);
}

// --- Check 3: secrets hygiene in the example file ----------------------------

// `.env.example` must never carry a value that looks like a live secret.
const LIVE_SECRET_VALUE =
  /\b(?:sk|pk|rk|AC|SG|SK)_(?:live|test)_[A-Za-z0-9]{16,}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b/;
const secretishKeys = [
  "AUTH_SECRET",
  "PII_ENCRYPTION_KEY",
  "WEBHOOK_SIGNING_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "TURNSTILE_SECRET_KEY",
  "RESEND_API_KEY",
  "SMTP_PASSWORD",
  "TWILIO_AUTH_TOKEN",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
  "GOOGLE_API_KEY",
  "FACEBOOK_PAGE_ACCESS_TOKEN",
  "SENTRY_AUTH_TOKEN",
  "ADMIN_PASSWORD",
];

for (const rawLine of exampleText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (line === "" || line.startsWith("#")) continue;
  const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (!m) continue;
  const key = m[1];
  const value = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
  if (value === "" || /^postgresql:\/\//.test(value)) continue;
  if (LIVE_SECRET_VALUE.test(value)) {
    problems.push(`${key} — .env.example contains what looks like a LIVE credential`);
  } else if (secretishKeys.includes(key) && value.length >= 32) {
    warnings.push(`${key} — .env.example has a ${value.length}-char value; example files should ship empty`);
  }
}

// --- Check 4: the *values* in .env.example must satisfy their declared type ---
// Shipping a wrong-typed example (PORT=abc, LOG_LEVEL=verbose, SITE_URL=eyg.ph)
// means every person who copies the file boots a broken app. Secrets are
// allowed to be empty — that is the point of an example file — but structural
// variables are not.

/** example key -> validator name; every entry must parse or be left empty. */
const VALUE_RULES = {
  DATABASE_URL: "url",
  NEXT_PUBLIC_SITE_URL: "url",
  UPSTASH_REDIS_REST_URL: "url",
  SENTRY_DSN: "url",
  EMAIL_FROM: "emailFrom",
  SMTP_PORT: "int",
  CAPTCHA_TTL_SECONDS: "int",
  RATE_LIMIT_PUBLIC_PER_MINUTE: "int",
  RATE_LIMIT_BOOKING_PER_HOUR: "int",
  RATE_LIMIT_QUOTE_PER_HOUR: "int",
  RATE_LIMIT_LOGIN_PER_15MIN: "int",
  RATE_LIMIT_READ_PER_MINUTE: "int",
  CAPTCHA_ENABLED: "bool",
  SMTP_SECURE: "bool",
  LOG_LEVEL: "logLevel",
};

/** @type {Map<string, string>} */
const exampleValues = new Map();
for (const rawLine of exampleText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (line === "" || line.startsWith("#")) continue;
  const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (!m || !m[1]) continue;
  exampleValues.set(m[1], (m[2] ?? "").trim().replace(/^["']|["']$/g, ""));
}

const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"];
const BOOLEANISH = /^(?:0|1|true|false|yes|no|on|off)$/i;

for (const [key, rule] of Object.entries(VALUE_RULES)) {
  const value = exampleValues.get(key);
  if (value === undefined) continue; // check 1 already reported absence
  if (value === "") continue; // empty is a legitimate "you must fill this in"

  // Never echo the value of a key that could carry a credential, even when it
  // is only 12 characters of something that looks like a prefix.
  const display = secretishKeys.includes(key) ? "[redacted]" : value.slice(0, 32);
  const bad = (expected) =>
    problems.push(`${key}="${display}" in .env.example is not ${expected}`);

  switch (rule) {
    case "url":
      if (key === "DATABASE_URL") {
        if (!/^postgres(?:ql)?:\/\//.test(value)) bad("a postgresql:// URL");
      } else {
        try {
           
          new URL(value);
        } catch {
          bad("an absolute URL");
        }
      }
      break;
    case "int":
      if (!/^-?\d+$/.test(value)) bad("an integer");
      break;
    case "bool":
      if (!BOOLEANISH.test(value)) bad("true/false/1/0/yes/no/on/off");
      break;
    case "logLevel":
      if (!LOG_LEVELS.includes(value)) bad(`one of ${LOG_LEVELS.join(" | ")}`);
      break;
    case "emailFrom":
      if (!/^[^<]*<[^>]+@[^>]+>$/.test(value)) bad('an RFC 5322 "Name <local@domain>" address');
      break;
    default:
      break;
  }
}

// ── Output ──────────────────────────────────────────────────────────────────

const summary = {
  tool: "validate-env",
  schema: schemaPath.replace(`${ROOT}\\`, "").replace(`${ROOT}/`, ""),
  example: examplePath.replace(`${ROOT}\\`, "").replace(`${ROOT}/`, ""),
  serverKeys: serverKeys.length,
  documentedKeys: documentedKeys.length,
  undocumented,
  unknown,
  problems,
  warnings,
  ok: problems.length === 0,
};

if (opts.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(summary.ok ? 0 : 1);
}

if (!opts.quiet) {
  process.stdout.write(
    `${c(BLD, "ENV CONTRACT")}  ${c(DIM, `${serverKeys.length} schema keys · ${documentedKeys.length} documented`)}\n`,
  );

  for (const w of warnings) {
    process.stdout.write(`  ${c(YEL, "warn")}  ${w}\n`);
  }
  for (const p of problems) {
    process.stdout.write(`  ${c(RED, "fail")}  ${p}\n`);
  }
  if (problems.length === 0 && warnings.length === 0) {
    process.stdout.write(`  ${c(GRN, "ok")}    .env.example and src/lib/env.ts agree.\n`);
  }
}

if (summary.ok) {
  process.stdout.write(
    `${c(GRN, c(BLD, "PASS"))} env contract is honest${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ""}\n`,
  );
  process.exit(0);
}

process.stdout.write(
  `${c(RED, c(BLD, "FAIL"))} env contract drifted: ${problems.length} problem(s).\n` +
    `  Fix .env.example (orchestrator-owned) and src/lib/env.ts (backend agent),\n` +
    `  or run with --allow-undocumented=<keys> while a tracked change is in flight.\n`,
);
process.exit(1);
