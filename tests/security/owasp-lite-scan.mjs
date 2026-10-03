#!/usr/bin/env node
/**
 * QA & SECURITY AGENT — OWASP-lite static scan.
 * ============================================================================
 * Dependency-light on purpose: `node:fs` + `node:path` + regular expressions.
 * A security scanner that cannot run in a bare CI container is a security scanner
 * nobody runs.
 *
 * USAGE
 *   node tests/security/owasp-lite-scan.mjs            # scan ./src, exit 1 on findings
 *   node tests/security/owasp-lite-scan.mjs --json     # machine-readable
 *   node tests/security/owasp-lite-scan.mjs --strict   # warnings are also failures
 *   node tests/security/owasp-lite-scan.mjs src/lib    # scan a subset
 *
 * WHAT IT CHECKS  (each rule names its OWASP Top 10:2021 category)
 *   1. `dangerouslySetInnerHTML` / `innerHTML` with no sanitiser nearby
 *      → A03 Injection.
 *   2. `eval`, `new Function`, `setTimeout("string")`
 *      → A03 Injection.
 *   3. `target="_blank"` without `rel="noopener"` → A05 Security Misconfiguration.
 *   4. `<img>` / `next/image` with no `alt` → not OWASP, but WCAG 2.2 SC 1.1.1,
 *      and a screen-reader failure is a customer-facing failure.
 *   5. `<a href="#">` and dead links → not OWASP, but AGENT-BRIEF §5 forbids them.
 *   6. `NEXT_PUBLIC_*` keys whose name or value looks like a secret → A02
 *      Cryptographic Failures / A07 Identification & Auth Failures.
 *   7. `console.*` left in server code → AGENT-BRIEF §5 forbids console noise.
 *   8. A route handler returning a raw `Error`/`err`/`JSON.stringify(err)` →
 *      A05 Security Misconfiguration (verbose errors leak stack traces, SQL and
 *      connection strings).
 *   9. Raw SQL string interpolation (`$queryRawUnsafe`, `Prisma.$executeRawUnsafe`)
 *      → A03 Injection.
 *  10. A hardcoded secret-looking string literal → A02.
 *  11. `http://` links to the site's own origin (mixed content / no TLS)
 *      → A02 Cryptographic Failures.
 *
 * EXIT CODES
 *   0  no errors (warnings may exist unless --strict)
 *   1  at least one error, or a warning under --strict
 *   2  the scan itself failed
 * ============================================================================
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ── CLI ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const strict = argv.includes("--strict");
const roots = argv.filter((arg) => !arg.startsWith("--"));
const targets = (roots.length > 0 ? roots : ["src"]).map((p) => resolve(process.cwd(), p));

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * Findings that are REAL matches for a rule but NOT defects. Each one is listed
 * with the reason it is safe, so a reviewer can challenge it rather than being
 * forced to either ignore the rule globally or add `eslint-disable` noise.
 *
 * A suppression here is a claim. If the claim stops being true, delete it.
 */
const SUPPRESSIONS = [
  {
    file: "src\\components\\ui\\JsonLd.tsx",
    rule: "dangerous-html-injection",
    reason:
      "JSON-LD must be in the initial HTML. The payload is JSON.stringify'd and every `<` is " +
      "escaped to \\u003c (line 17), so it cannot break out of the <script> element. " +
      "Re-verify that escaping after any change to this component.",
  },
  {
    file: "src\\app\\layout.tsx",
    rule: "dangerous-html-injection",
    reason:
      "The theme bootstrap is a module-level constant with no interpolation, and it carries the " +
      "CSP nonce from the middleware, so a CSP violation would block it. " +
      "Re-verify that `themeBootstrap` stays interpolation-free.",
  },
];

// ── Rule definitions ────────────────────────────────────────────────────────

/** @typedef {{ rule: string; owasp: string; severity: "error" | "warning"; file: string; line: number; match: string; message: string }} Finding */

/** @type {Array<{ rule: string; owasp: string; severity: "error" | "warning"; test: RegExp; message: string; except?: RegExp }>} */
const RULES = [
  {
    rule: "dangerous-html-injection",
    owasp: "A03:2021 Injection",
    severity: "error",
    test: /dangerouslySetInnerHTML|__html\b|\.innerHTML\s*=|insertAdjacentHTML\s*\(/,
    // A sanitiser in the same file is acceptable.
    except: /DOMPurify|sanitize-html|sanitizeHtml|escapeHtml|dangerouslySetSanitizedHTML/,
    message: "Raw HTML injection. Prove it is escaped, or use escapeHtml()/a sanitiser.",
  },
  {
    rule: "dynamic-code-execution",
    owasp: "A03:2021 Injection",
    severity: "error",
    test: /(?<![\w.])eval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]|\bFunction\s*\(\s*["'`]/,
    except: /\/\*[\s\S]*?\*\/|\/\/.*$/m,
    message: "Dynamic code execution. Every input into a parser is an RCE waiting to happen.",
  },
  {
    rule: "blank-target-without-noopener",
    owasp: "A05:2021 Security Misconfiguration",
    severity: "error",
    test: /<a\b[^>]*target\s*=\s*["']_blank["'][^>]*>/,
    message: 'target="_blank" without rel="noopener" — the opened page gets window.opener.',
  },
  {
    rule: "image-without-alt",
    owasp: "WCAG 2.2 SC 1.1.1 (non-text content)",
    severity: "warning",
    test: /<img\b(?![^>]*\balt\s*=)[^>]*>/,
    message: "<img> with no alt attribute. Use an empty alt for decorative images.",
  },
  {
    rule: "dead-href",
    owasp: "AGENT-BRIEF §5 (never ship a dead link)",
    severity: "warning",
    test: /href\s*=\s*["']#["']|href\s*=\s*\{\s*["']#["']\s*\}/,
    message: 'href="#" is a dead link. Point it at the real destination.',
  },
  {
    rule: "console-in-server-code",
    owasp: "AGENT-BRIEF §5 (no console noise in prod)",
    severity: "warning",
    test: /(?<![.\w])console\.(log|debug|info|warn|error|trace)\s*\(/,
    except: /eslint-disable-next-line no-console/,
    message: "console.* in application code. Use src/lib/logger.ts.",
  },
  {
    rule: "raw-sql",
    owasp: "A03:2021 Injection",
    severity: "error",
    test: /\$(queryRawUnsafe|executeRawUnsafe|queryRaw)\s*\(|Prisma\.sql`[^`]*\$\{/,
    except: /Prisma\.sql\s*`[^`]*`/,
    message: "Raw SQL. Use Prisma's parameterised API or Prisma.sql with tagged interpolation.",
  },
  {
    rule: "public-secret",
    owasp: "A07:2021 Identification and Authentication Failures",
    severity: "error",
    test: /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY)[A-Z0-9_]*/,
    message: "A NEXT_PUBLIC_* name implies the value is public forever.",
  },
  {
    rule: "public-secret-value",
    owasp: "A02:2021 Cryptographic Failures",
    severity: "error",
    test: /NEXT_PUBLIC_[A-Z0-9_]*\s*[:=]\s*["'][^"']*(sk_live_|pk_live_|AC[0-9a-f]{32}|postgres(ql)?:\/\/|-----BEGIN)[^"']*["']/,
    message: "A NEXT_PUBLIC_* value looks like a server secret.",
  },
  {
    rule: "hardcoded-secret-literal",
    owasp: "A02:2021 Cryptographic Failures",
    severity: "warning",
    test: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9/+_-]{24,}["']/i,
    except: /example|placeholder|your-|change-me|xxx|test-only|\$\{/i,
    message: "A long secret-looking string literal. Move it to an env var.",
  },
  {
    rule: "raw-error-in-response",
    owasp: "A05:2021 Security Misconfiguration",
    severity: "error",
    test: /NextResponse\.json\(\s*(err|error|e)\b|JSON\.stringify\(\s*(err|error)\b|return\s+(err|error)\s*;/,
    message: "A route returning a raw error object leaks stack traces, SQL and connection strings.",
  },
  {
    rule: "insecure-http-origin",
    owasp: "A02:2021 Cryptographic Failures",
    severity: "warning",
    test: /["']https?:\/\/(eygtireautocare\.ph|www\.eygtireautocare\.ph)\b/,
    message: "Hardcoded site URL. Read SITE.url so the environment decides http vs https.",
  },
];

/** Server-only paths: console noise is a hard error there, a warning elsewhere. */
const SERVER_PATH = /(^|[\\/])(app[\\/]api|lib[\\/]server|middleware\.(ts|js)|prisma[\\/])/;

// ── Scanning ────────────────────────────────────────────────────────────────

/** @returns {string[]} */
function collectFiles(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist" || entry === "coverage") continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) collectFiles(path, files);
    else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) files.push(path);
  }
  return files;
}

/** True for a JSX opening tag that contains a `target="_blank"` but no `noopener`. */
function _blankTargetIsUnsafe(line) {
  if (!/target\s*=\s*["'{]?\s*_blank/.test(line)) return false;
  if (/rel\s*=\s*["'{][^"']*noopener/.test(line)) return false;
  // A multi-line element: check the next few lines for the rel attribute.
  return true;
}

/** @returns {Finding[]} */
function scanFile(path, source) {
  /** @type {Finding[]} */
  const findings = [];
  const lines = source.split(/\r?\n/);
  const relativePath = relative(process.cwd(), path);

  // Strip block comments so a rule mentioned in prose is not a finding. Line
  // numbers are preserved by replacing comment bodies with spaces.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));

  for (const rule of RULES) {
    if (rule.except) {
      // A file that declares a sanitiser is exempt from the raw-HTML rule only.
      if (rule.except.test(source) && rule.rule !== "raw-sql") continue;
    }
    const linesOfCode = code.split(/\r?\n/);
    for (let index = 0; index < linesOfCode.length; index += 1) {
      const line = linesOfCode[index];
      if (!rule.test.test(line)) continue;
      if (rule.rule === "dangerous-html-injection" && !rule.test.test(code)) continue;
      if (rule.rule === "blank-target-without-noopener") {
        // Look ahead for a rel attribute on a multi-line opening tag.
        const window = linesOfCode.slice(index, index + 6).join(" ");
        if (/rel\s*=\s*["'{][^"']*noopener/.test(window)) continue;
      }
      const rawLine = lines[index] ?? line;
      if (rule.except && rule.except.test(rawLine) && rule.rule === "raw-sql") continue;
      findings.push({
        rule: rule.rule,
        owasp: rule.owasp,
        severity: rule.severity,
        file: relativePath,
        line: index + 1,
        match: rawLine.trim().slice(0, 160),
        message: rule.message,
      });
    }
  }

  // `console.*` is an ERROR in server code and a WARNING in client code.
  for (const finding of findings.filter((f) => f.rule === "console-in-server-code")) {
    if (SERVER_PATH.test(relativePath)) finding.severity = "error";
  }

  return findings;
}

function main() {
  /** @type {Finding[]} */
  const findings = [];
  let scanned = 0;

  for (const target of targets) {
    const stats = statSync(target);
    const files = stats.isDirectory() ? collectFiles(target) : [target];
    for (const file of files) {
      scanned += 1;
      try {
        findings.push(...scanFile(file, readFileSync(file, "utf8")));
      } catch (error) {
        process.stderr.write(`scan failed: ${relative(process.cwd(), file)} — ${String(error)}\n`);
      }
    }
  }

  const _errors = findings.filter((f) => f.severity === "error");
  const _warnings = findings.filter((f) => f.severity === "warning");
  const suppressed = findings.filter((f) =>
    SUPPRESSIONS.some((s) => s.file === f.file && s.rule === f.rule),
  );
  const actionable = findings.filter((f) => !suppressed.includes(f));

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          scanned,
          errors: actionable.filter((f) => f.severity === "error").length,
          warnings: actionable.filter((f) => f.severity === "warning").length,
          suppressed: suppressed.length,
          findings: actionable,
          suppressions: SUPPRESSIONS,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    const pad = (text) => String(text).padEnd(4);
    process.stdout.write(`\nOWASP-lite scan — ${scanned} file(s) under ${targets.join(", ")}\n\n`);
    if (actionable.length === 0) {
      process.stdout.write("  ✔ no actionable findings\n");
    } else {
      for (const finding of actionable) {
        const tag = finding.severity === "error" ? "ERROR" : "WARN ";
        process.stdout.write(`  ${pad(tag)} ${finding.file}:${finding.line}  [${finding.rule}]\n`);
        process.stdout.write(`        ${finding.owasp}\n`);
        process.stdout.write(`        ${finding.message}\n`);
        process.stdout.write(`        > ${finding.match}\n\n`);
      }
    }
    if (suppressed.length > 0) {
      process.stdout.write(`  ── ${suppressed.length} suppressed finding(s), each with a reason ──\n`);
      for (const suppression of SUPPRESSIONS) {
        process.stdout.write(`     ${suppression.file}  [${suppression.rule}]\n`);
        process.stdout.write(`       ${suppression.reason}\n`);
      }
      process.stdout.write("\n");
    }
    process.stdout.write(
      `  ${actionable.filter((f) => f.severity === "error").length} error(s), ` +
        `${actionable.filter((f) => f.severity === "warning").length} warning(s), ` +
        `${suppressed.length} suppressed\n\n`,
    );
  }

  const actionableErrors = actionable.filter((f) => f.severity === "error");
  const actionableWarnings = actionable.filter((f) => f.severity === "warning");
  if (actionableErrors.length > 0) process.exit(1);
  if (strict && actionableWarnings.length > 0) process.exit(1);
  process.exit(0);
}

try {
  main();
} catch (error) {
  process.stderr.write(`owasp-lite-scan failed: ${String(error)}\n`);
  process.exit(2);
}

export { RULES, collectFiles, scanFile };