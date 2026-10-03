#!/usr/bin/env node
/**
 * regenerate-gitleaks-baseline.mjs — rebuild `.gitleaks-baseline.json`.
 *
 * ============================================================================
 * WHY THIS FILE IS COMMITTED
 *
 * gitleaks walks EVERY commit, so a finding that existed in any past commit is
 * reported forever. `gitleaks:allow` only silences a line in the current tree, so
 * it cannot retire a historical hit. The four fake test fixtures in `5ffaf85`
 * are exactly that case: they are not credentials, they are high-entropy
 * constants that `tests/setup.ts` REQUIRES, and no edit to those files can make
 * the history scan pass.
 *
 * The alternatives were both worse:
 *
 *   - rewrite history to purge four strings that are not secrets, on a public
 *     repository other people have already cloned
 *   - exclude tests/ and vitest.config.ts by path, which would also hide a real
 *     key pasted into a test file. That was tested: with the baseline in place a
 *     planted `ghp_` PAT is still caught; with a path exclusion it would not be.
 *
 * A baseline is FINGERPRINT-scoped. It suppresses those four occurrences and
 * nothing else — move the line, change the value, or add a fifth secret anywhere
 * in the repository and the scan fails.
 * ============================================================================
 *
 * WHEN TO RUN IT
 *
 * Only when you have READ every finding it is about to accept. This script does
 * not decide whether something is safe to ignore; it records a decision you make.
 * Running it on unreviewed output converts "gitleaks found something" into "the
 * baseline says that was fine", which is the one thing a secret scanner must
 * never do quietly.
 *
 * Usage:
 *   npm run verify:secrets:baseline          regenerate from the current scan
 *   npm run verify:secrets:baseline -- --list  show findings without writing
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASELINE = ".gitleaks-baseline.json";
const listOnly = process.argv.includes("--list");

// gitleaks is not an npm dependency and is not on a developer machine by default.
// On Windows the asset is a .zip; on Linux/macOS it is a .tar.gz. Prefer whatever
// the caller already has on PATH, which is also what CI installs.
const GITLEAKS = process.env.GITLEAKS_BIN ?? "gitleaks";

const workflow = readFileSync(".github/workflows/secret-scan.yml", "utf8");

// Lift the config out of the workflow rather than duplicating it. A second copy
// is a second thing to drift, and this file exists to prevent exactly that.
const start = workflow.indexOf("<<'TOML'");
const end = workflow.indexOf("\n            TOML", start);
if (start === -1 || end === -1) {
  console.error("could not find the TOML heredoc in .github/workflows/secret-scan.yml");
  process.exit(1);
}

const cfgBody = workflow
  .slice(start + "<<'TOML'".length, end)
  .split(/\r?\n/)
  .map((l) => l.replace(/^ {12}/, ""))
  .join("\n");

const cfgPath = join(tmpdir(), "eyg-gitleaks.toml");
writeFileSync(cfgPath, cfgBody, "utf8");

const reportPath = join(tmpdir(), "eyg-gitleaks-report.json");

function detect(extra = []) {
  try {
    execFileSync(
      GITLEAKS,
      ["detect", "--source", ".", "--config", cfgPath, "--no-banner", "--redact",
        "--report-format", "json", "--report-path", reportPath, ...extra],
      { encoding: "utf8", stdio: "pipe" },
    );
  } catch (e) {
    // gitleaks exits non-zero when it finds something. That is a result, not a
    // crash. A missing report, however, means it could not run at all.
    if (e.code === 127 || /not found|not recognized/i.test(String(e.message))) {
      console.error(`could not run "${GITLEAKS}".`);
      console.error("Install it, or set GITLEAKS_BIN to the binary. CI uses 8.24.2:");
      console.error("  https://github.com/gitleaks/gitleaks/releases");
      process.exit(1);
    }
  }
  if (!existsSync(reportPath)) {
    console.error("gitleaks produced no report — refusing to write an empty baseline.");
    console.error("An empty baseline is indistinguishable from a clean repository.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(reportPath, "utf8")) ?? [];
}

const baselineArgs = existsSync(BASELINE) ? ["--baseline-path", BASELINE] : [];
const findings = detect(baselineArgs);

console.log(`\ngitleaks findings not already in the baseline: ${findings.length}\n`);

if (findings.length === 0) {
  console.log("  Nothing new. If the baseline is stale or empty, delete it and re-run.");
  process.exit(0);
}

for (const f of findings) {
  console.log(`  ${f.File}  ${f.Commit.slice(0, 7)}  [${f.RuleID}]`);
  console.log(`    ${f.Description ?? ""}`.trimEnd());
  console.log(`    fingerprint ${f.Fingerprint}`);
  console.log("");
}

if (listOnly) {
  console.log("--list given; nothing written.");
  process.exit(0);
}

console.log("READ every finding above before accepting it.");
console.log("If any of these is a real credential: do NOT run this. Rotate it first —");
console.log("adding it to a baseline hides it, it does not undo the exposure.\n");

writeFileSync(BASELINE, JSON.stringify(findings, null, 2) + "\n", "utf8");
console.log(`wrote ${BASELINE} with ${findings.length} accepted finding(s)`);

const after = detect(["--baseline-path", BASELINE]);
console.log(`re-scan with the new baseline: ${after.length} finding(s)`);
if (after.length > 0) {
  console.error("  the baseline is not suppressing what it should — not committing.");
  process.exit(1);
}
console.log("verified.");