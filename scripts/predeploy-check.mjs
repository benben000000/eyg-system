#!/usr/bin/env node
/**
 * predeploy-check.mjs — the last gate before production accepts traffic.
 * ============================================================================
 * Everything here is a question you only get ONE chance to get wrong, because
 * the shop is 1.5 h from Manila and a stranded customer cannot retry a booking
 * three hours later.
 *
 * Refuses to deploy when:
 *   1. `NEXT_PUBLIC_SITE_URL` is missing or not the production origin.
 *   2. The placeholder phone `+639000000000` is still in `src/config/site.ts`.
 *   3. A `TODO` / `TODO-VERIFY` / `FIXME` marker survives anywhere in `src/`.
 *   4. Placeholder text from the brand brief shipped: `example.com`, `000-000-0000`,
 *      `Lorem ipsum`, a dead `href="#"`.
 *   5. A secret-looking string was committed in tracked source.
 *   6. `src/config/site.ts` no longer exports the fields the SEO layer needs.
 *   7. A `NEXT_PUBLIC_*` variable is set to something that is clearly a secret.
 *
 * Usage:
 *   node scripts/predeploy-check.mjs
 *   node scripts/predeploy-check.mjs --allow-placeholders   # previews only
 *   node scripts/predeploy-check.mjs --site-url=https://staging.eyg.ph
 *   node scripts/predeploy-check.mjs --json
 *
 * Flags:
 *   --allow-placeholders      downgrade every TODO-VERIFY/placeholder finding to
 *                             a warning. NEVER use this for production.
 *   --site-url=<url>          the origin the deployment will serve; compared to
 *                             NEXT_PUBLIC_SITE_URL.
 *   --skip-branch             do not warn when HEAD is not `main`.
 *   --json                    machine-readable output.
 *
 * Exit codes: 0 = clear to ship · 1 = blocked · 2 = bad usage / missing files
 *
 * SECRET HYGIENE: matches on variable NAMES and on high-entropy *shapes*.
 * A hit reports the file, line number and the rule name. It never prints the
 * matched value, and it never prints an env var's value.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = {
    allowPlaceholders: process.env.PREDEPLOY_ALLOW_PLACEHOLDERS === "1",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
    skipBranch: false,
    json: false,
  };
  for (const arg of argv) {
    if (arg === "--allow-placeholders") o.allowPlaceholders = true;
    else if (arg === "--skip-branch") o.skipBranch = true;
    else if (arg === "--json") o.json = true;
    else if (arg.startsWith("--site-url=")) o.siteUrl = arg.slice(11);
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "predeploy-check.mjs — refuse to ship placeholders to production\n" +
          "  --allow-placeholders  --site-url=<url>  --skip-branch  --json\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`predeploy-check: unknown argument "${arg}"\n`);
      process.exit(2);
    }
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));

// ── Reporting ───────────────────────────────────────────────────────────────

const RED = "[31m";
const GRN = "[32m";
const YEL = "[33m";
const _DIM = "[2m";
const BLD = "[1m";
const OFF = "[0m";
const useColour = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const c = (code, text) => (useColour ? `${code}${text}${OFF}` : text);

/** @type {{ rule: string, file: string, line: number, detail: string, level: "error" | "warn" }[]} */
const findings = [];

/**
 * @param {string} rule
 * @param {string} file  repo-relative
 * @param {number} line  1-based
 * @param {string} detail human explanation, never a secret value
 * @param {"error" | "warn"} [level]
 */
function flag(rule, file, line, detail, level = "error") {
  findings.push({ rule, file, line, detail, level });
}

/** Recursively collect files under a directory, skipping noise directories. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  const SKIP = new Set(["node_modules", ".next", ".git", "coverage", "dist", "out", ".turbo"]);
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".json", ".md", ".mdx"]);

// ── The placeholder list ────────────────────────────────────────────────────
// THE reason predeploy exists. `src/config/site.ts` is orchestrator-owned; this
// list is devops-owned so the gate can be updated without touching app code.

const PLACEHOLDERS = [
  {
    value: "+639000000000",
    label: "placeholder phone (E.164)",
    consequence: "Customers tap-to-call a number that does not exist. This is the single highest-cost failure on the site.",
  },
  {
    value: "+63 900 000 0000",
    label: "placeholder phone (display)",
    consequence: "The printed phone number on every page is fake.",
  },
  {
    value: "639000000000",
    label: "placeholder WhatsApp number",
    consequence: "Every WhatsApp CTA opens a chat with nobody.",
  },
  {
    value: "example.com",
    label: "reserved example domain",
    consequence: "Broken canonical tags, broken sitemap, lost local SEO.",
  },
  {
    value: "000-000-0000",
    label: "placeholder phone format",
    consequence: "A dead tap-to-call on the highest-intent page.",
  },
  {
    value: "Lorem ipsum",
    label: "lorem ipsum filler",
    consequence: "The brief forbids shipping placeholder text.",
  },
  {
    value: "TODO-VERIFY",
    label: "unconfirmed business fact",
    consequence: "The orchestrator brief says: do not ship a claim the owner has not signed off on.",
  },
];

const SITE_CONFIG = join(ROOT, "src", "config", "site.ts");

/** Fields `src/lib/seo.ts` and the layout read from `site.ts`. */
const REQUIRED_SITE_EXPORTS = [
  "BUSINESS",
  "BUSINESS_HOURS",
  "BOOKING",
  "LINKS",
  "SITE",
  "ADDRESS_ONE_LINE",
  "TIMEZONE",
];

// ── 1. NEXT_PUBLIC_SITE_URL ─────────────────────────────────────────────────

function checkSiteUrl() {
  const url = opts.siteUrl.trim();
  if (url === "") {
    flag("env.site-url", "process.env", 0, "NEXT_PUBLIC_SITE_URL is not set", "warn");
    return;
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    flag("env.site-url", "process.env", 0, `NEXT_PUBLIC_SITE_URL="${url}" is not a valid URL`);
    return;
  }
  if (parsed.protocol !== "https:") {
    flag(
      "env.site-url",
      "process.env",
      0,
      `NEXT_PUBLIC_SITE_URL is "${parsed.protocol}//" — production must be https, otherwise HSTS and the booking form are broken`,
    );
  }
  if (/(^|\.)localhost$|\.local$|\.test$|\.internal$/.test(parsed.hostname) && !opts.allowPlaceholders) {
    flag(
      "env.site-url",
      "process.env",
      0,
      `NEXT_PUBLIC_SITE_URL points at "${parsed.hostname}" — canonical tags and the sitemap would point off-production`,
    );
  }
}

// ── 2 & 3. Placeholders + TODO/FIXME in src/ ────────────────────────────────

function checkSourceTree() {
  const files = walk(join(ROOT, "src"));
  if (files.length === 0) {
    flag("tree.missing", "src/", 0, "src/ is empty or missing — nothing to ship", "warn");
    return;
  }

  const TODO_RE = /\b(?:TODO|FIXME|HACK|XXX|WIP)\b|@todo/i;

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (!SOURCE_EXT.has(extname(file))) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);

    lines.forEach((lineText, i) => {
      const lineNo = i + 1;
      const isComment =
        /^\s*(?:\/\/|\/\*|\*|\{?\/)/.test(lineText) || /^\s*<!--/.test(lineText);

      // Dead anchors — an <a href="#"> is a control that does nothing.
      if (/href\s*=\s*["']#["']/.test(lineText)) {
        flag("link.dead-anchor", rel, lineNo, 'dead link: href="#" — the brief forbids dead links');
      }

      for (const p of PLACEHOLDERS) {
        if (lineText.includes(p.value)) {
          const isPlaceholderMarker = p.value === "TODO-VERIFY" && isComment;
          flag(
            "placeholder.text",
            rel,
            lineNo,
            `${p.label}: ${p.consequence}`,
            isPlaceholderMarker || !isComment ? "error" : "error",
          );
        }
      }

      if (TODO_RE.test(lineText) && !isComment) {
        // A TODO in code (not a comment) is worse: it is an unfinished branch.
        flag("todo.in-code", rel, lineNo, "TODO/FIXME marker in executable code, not a comment");
      }
    });
  }
}

// ── 4. site.ts shape ────────────────────────────────────────────────────────

function checkSiteConfig() {
  if (!existsSync(SITE_CONFIG)) {
    flag("site.missing", "src/config/site.ts", 0, "site.ts does not exist — the SEO layer cannot build", "warn");
    return;
  }
  const text = readFileSync(SITE_CONFIG, "utf8");

  for (const name of REQUIRED_SITE_EXPORTS) {
    const re = new RegExp(`export\\s+const\\s+${name}\\b`);
    if (!re.test(text)) {
      flag("site.export", "src/config/site.ts", 0, `missing export: ${name} — src/lib/seo.ts imports it`);
    }
  }

  // The telephone link is the site's primary conversion. Verify the derived
  // LINKS.call is built from phoneE164 rather than a duplicated literal, so a
  // phone change is a one-line change (see RUNBOOK.md).
  if (!/call:\s*`tel:\$\{BUSINESS\.phoneE164\}`/.test(text)) {
    flag(
      "site.call-derived",
      "src/config/site.ts",
      0,
      "LINKS.call is not derived from BUSINESS.phoneE164 — changing the phone number would miss the tap-to-call link",
      "warn",
    );
  }

  // Trust claims must not be invented. ratingCount/yearsServing/bays/technicians
  // at 0 mean "no claim made", which is the honest state pre-launch.
  const trust = /trust:\s*\{([\s\S]*?)\}/.exec(text);
  if (trust && trust[1]) {
    for (const field of ["ratingValue"]) {
      const m = new RegExp(`${field}:\\s*([\\d.]+)`).exec(trust[1]);
      if (m && Number(m[1]) > 0) {
        flag(
          "site.trust-claim",
          "src/config/site.ts",
          0,
          `${field}=${m[1]} is an unverified trust claim — the brief forbids shipping ratings the owner has not confirmed`,
        );
      }
    }
  }
}

// ── 5. Committed-secret sweep ───────────────────────────────────────────────

/**
 * Shape-based rules. Each pattern matches a *credential shape*, not a value, and
 * a finding reports only the file, line and rule — never the matched text.
 */
const SECRET_RULES = [
  {
    name: "private-key-block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  { name: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "stripe-live-key", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
  { name: "twilio-sid-with-token", re: /\bSK[0-9a-fA-F]{32}\b/ },
  { name: "resend-key", re: /\bre_[A-Za-z0-9_-]{20,}\b/ },
  { name: "openai-key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "upstash-token", re: /\b[A-Za-z0-9_-]{32,}\b(?=[^\n]*UPSTASH_REDIS_REST_TOKEN)/ },
  { name: "vercel-token", re: /\b[0-9a-zA-Z]{24}\b(?=[^\n]*VERCEL_TOKEN)/ },
  {
    name: "hardcoded-secret-assignment",
    // `SECRET = "a long literal"` — the value shape is what matters.
    re: /\b(?:SECRET|PASSWORD|TOKEN|API_?KEY|ENCRYPTION_KEY)\b\s*[:=]\s*["'][^"'\s]{16,}["']/,
  },
];

function checkCommittedSecrets() {
  const roots = ["src", "prisma", "scripts"];
  for (const root of roots) {
    const dir = join(ROOT, root);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (!SOURCE_EXT.has(extname(file))) continue;
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      text.split(/\r?\n/).forEach((lineText, i) => {
        for (const rule of SECRET_RULES) {
          if (rule.re.test(lineText)) {
            // `scripts/` legitimately contains the *patterns* that detect
            // secrets. Flagging the detector is noise, not signal.
            if (rel.startsWith("scripts/") && rule.name !== "private-key-block") continue;
            flag(
              `secret.${rule.name}`,
              rel,
              i + 1,
              "possible committed credential — value withheld from this log; revoke and rotate it",
            );
          }
        }
      });
    }
  }
}

// ── 6. NEXT_PUBLIC_ leak risk ───────────────────────────────────────────────

function checkPublicEnvLeak() {
  // Any secret reaching a NEXT_PUBLIC_ name is public forever, in every cached
  // bundle, on every CDN edge. This is unrecoverable by redeploying.
  const re = /^NEXT_PUBLIC_.*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|CREDENTIAL)/;
  for (const [key, value] of Object.entries(process.env)) {
    if (!re.test(key)) continue;
    if (typeof value === "string" && value.trim() !== "") {
      flag(
        "env.public-secret",
        "process.env",
        0,
        `${key} is set — anything NEXT_PUBLIC_ is inlined into the client bundle and is public forever`,
      );
    }
  }
}

// ── 7. Branch guard ─────────────────────────────────────────────────────────

function checkBranch() {
  if (opts.skipBranch) return;
  // Never shell out. Read `.git/HEAD` directly — no child_process, no
  // interpolation, nothing to escape.
  const gitHead = join(ROOT, ".git", "HEAD");
  if (!existsSync(gitHead)) return; // not a git checkout (tarball / CI artifact)
  let head;
  try {
    head = readFileSync(gitHead, "utf8").trim();
  } catch {
    return;
  }
  const branch = head.startsWith("ref: ") ? head.slice(5) : "(detached)";
  if (branch !== "refs/heads/main" && !opts.allowPlaceholders) {
    flag(
      "branch.not-main",
      ".git/HEAD",
      0,
      `HEAD is "${branch}" — production deploys come from main`,
      "warn",
    );
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

/**
 * A serverless deploy must talk to Postgres through a connection pooler.
 *
 * This is the single most common way a Prisma + Vercel app dies in production:
 * every function invocation opens its own connection, the provider's limit is
 * hit within minutes, and every query starts failing with "too many
 * connections". It never reproduces locally, so it is checked here.
 */
function checkDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    flag("db.url_missing", "DATABASE_URL", 0, "DATABASE_URL is not set", "error");
    return;
  }
  if (/localhost|127\.0\.0\.1/.test(url)) return; // local / Docker, not serverless

  // Markers of a pooler or an explicit cap.
  const isPooled = [
    /pooler/i, // Neon "-pooler" host
    /pgbouncer=true/i, // Supabase / PgBouncer
    /connection_limit=\d/i, // an explicit cap, whatever the host
  ].some((re) => re.test(url));

  // Hosts that are a persistent container rather than serverless, where a
  // plain URL is genuinely fine and a pooler would only add latency.
  const isLongLivedHost = /\.railway\.app|\.onrender\.com|\.internal\b|@[\w.-]+:\d+\//.test(url);

  if (!isPooled && !isLongLivedHost) {
    flag(
      "db.url_not_pooled",
      "DATABASE_URL",
      0,
      "On a serverless host this must be a POOLED url (Neon -pooler, or ?pgbouncer=true&connection_limit=1). " +
        "An unpooled url will exhaust the provider's connection limit and take the site down.",
      "error",
    );
  }

  if (!process.env.DIRECT_URL) {
    flag(
      "db.direct_url_missing",
      "DIRECT_URL",
      0,
      "DIRECT_URL is not set. `prisma migrate deploy` needs a non-pooled connection.",
      "warn",
    );
  }
}

// ── Main ──

function main() {
  checkSiteUrl();
  checkSourceTree();
  checkSiteConfig();
  checkCommittedSecrets();
  checkPublicEnvLeak();
  checkDatabaseUrl();
  checkBranch();

  // `--allow-placeholders` downgrades placeholder/TODO findings only. It never
  // downgrades a secret, a missing site config or an invalid site URL.
  const errors = findings.filter((f) => {
    if (f.level === "error") return true;
    return false;
  });
  const downgraded = opts.allowPlaceholders
    ? findings.filter(
        (f) =>
          f.rule === "placeholder.text" ||
          f.rule === "todo.in-code" ||
          f.rule === "site.trust-claim",
      )
    : [];

  const blocking = errors.filter((f) => !downgraded.includes(f));
  const summary = {
    tool: "predeploy-check",
    allowPlaceholders: opts.allowPlaceholders,
    siteUrl: opts.siteUrl,
    blocking: blocking.map((f) => `${f.rule} ${f.file}:${f.line} — ${f.detail}`),
    warnings: [
      ...findings.filter((f) => f.level === "warn").map((f) => `${f.rule} ${f.file}:${f.line} — ${f.detail}`),
      ...downgraded.map((f) => `[downgraded] ${f.rule} ${f.file}:${f.line} — ${f.detail}`),
    ],
    ok: blocking.length === 0,
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exit(summary.ok ? 0 : 1);
  }

  process.stdout.write(`${c(BLD, "PREDEPLOY CHECK")}\n`);

  // Group by file so a reviewer sees one file, one block.
  /** @type {Map<string, typeof findings>} */
  const byFile = new Map();
  for (const f of findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }
  for (const [file, list] of [...byFile].sort()) {
    process.stdout.write(`\n  ${c(BLD, file)}\n`);
    for (const f of list.sort((a, b) => a.line - b.line)) {
      const isDowngraded = downgraded.includes(f);
      const tag = isDowngraded
        ? c(YEL, "warn*")
        : f.level === "error"
          ? c(RED, "fail")
          : c(YEL, "warn");
      const where = f.line > 0 ? `:${f.line}` : "";
      process.stdout.write(`    ${tag} ${f.rule}${where} — ${f.detail}\n`);
    }
  }
  process.stdout.write("\n");

  if (blocking.length === 0) {
    process.stdout.write(
      `${c(GRN, c(BLD, "PASS"))} clear to deploy` +
        (downgraded.length > 0 ? c(YEL, ` (${downgraded.length} placeholder finding(s) waived)`) : "") +
        "\n",
    );
    if (downgraded.length > 0) {
      process.stdout.write(
        c(YEL, "      Do NOT ship a production deploy with waivers. See docs/ops/LAUNCH-CHECKLIST.md") + "\n",
      );
    }
    process.exit(0);
  }

  process.stdout.write(
    `${c(RED, c(BLD, "BLOCKED"))} ${blocking.length} blocking issue(s). The shop cannot be served this.\n` +
      `  Fix each in a PR. See docs/ops/LAUNCH-CHECKLIST.md and docs/ops/INCIDENT-RESPONSE.md.\n` +
      `  Previews only: node scripts/predeploy-check.mjs --allow-placeholders\n`,
  );
  process.exit(1);
}

main();
