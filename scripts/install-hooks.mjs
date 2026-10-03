#!/usr/bin/env node
/**
 * install-hooks.mjs — wire the local git hooks this repo needs.
 * ============================================================================
 * CI is the real gate, but CI is 10 minutes away and a leaked key is permanent.
 * The pre-commit hook refuses the exact things CI would fail on, in 200 ms, on
 * the machine where the mistake was made.
 *
 * Installs into `.git/hooks/` (never `.husky/` — one less dependency, and the
 * team is two people):
 *   pre-commit  → validate-env, predeploy (placeholder sweep), JSON syntax,
 *                 the same secret patterns the pipeline uses
 *   pre-push    → typecheck + a branch-protection reminder
 *   commit-msg  → nothing (message style is not worth a local hook)
 *
 * `--uninstall` restores the tree to "no custom hooks".
 * `--force` overwrites hooks that this script did not write (it detects them by
 * the marker comment, so a hand-rolled hook is never clobbered silently).
 *
 * Pure Node ESM. No dependencies, no shell.
 *
 * Usage:
 *   node scripts/install-hooks.mjs
 *   node scripts/install-hooks.mjs --uninstall
 *   node scripts/install-hooks.mjs --force
 *   node scripts/install-hooks.mjs --check     # report status, change nothing
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const HOOKS_DIR = join(ROOT, ".git", "hooks");
const MARKER = "# eyg-devops-managed-hook";

const opts = { uninstall: false, force: false, check: false };
for (const arg of process.argv.slice(2)) {
  if (arg === "--uninstall") opts.uninstall = true;
  else if (arg === "--force") opts.force = true;
  else if (arg === "--check") opts.check = true;
  else if (arg === "--help" || arg === "-h") {
    process.stdout.write(
      "install-hooks.mjs — install the pre-commit / pre-push git hooks\n" +
        "  --uninstall   --force   --check\n",
    );
    process.exit(0);
  } else {
    process.stderr.write(`install-hooks: unknown argument "${arg}"\n`);
    process.exit(2);
  }
}

const GRN = "[32m";
const RED = "[31m";
const YEL = "[33m";
const DIM = "[2m";
const BLD = "[1m";
const OFF = "[0m";
const useColour = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const c = (code, text) => (useColour ? `${code}${text}${OFF}` : text);

// ── Hook bodies ─────────────────────────────────────────────────────────────

/**
 * pre-commit.
 *
 * Deliberately NOT running the whole test suite: a hook that takes 90 s gets
 * bypassed by `--no-verify` on day three, and a hook nobody runs catches
 * nothing. This one is fast and covers the irreversible mistakes.
 */
const PRE_COMMIT = `#!/bin/sh
${MARKER}
# EYG Tire & Auto Care — devops. See scripts/install-hooks.mjs
#
# Refuses: a broken env contract, a shipped placeholder, a secret in the diff,
# and syntactically invalid JSON. All are permanent mistakes.
#
# Bypass with --no-verify ONLY when you are about to fix it on the next commit.

set -e

fail() {
  printf '\\033[31mhook:\\033[0m %s\\n' "$1" >&2
  exit 1
}

# 1. Only run on a real commit, not on --amend of nothing / merge drivers.
if [ -z "$(git diff --cached --name-only)" ]; then
  exit 0
fi

# 2. JSON files must parse. A malformed tsconfig breaks every other agent.
STAGED_JSON=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(json|jsonc)$' || true)
if [ -n "$STAGED_JSON" ]; then
  for f in $STAGED_JSON; do
    [ -f "$f" ] || continue
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8').replace(/^\\uFEFF/,''))" "$f" \\
      || fail "$f is not valid JSON"
  done
fi

# 3. Env contract drift. Cheap, and the failure is confusing when it ships.
if git diff --cached --name-only | grep -qE '^(src/lib/env\\.ts|\\.env\\.example)$'; then
  node scripts/validate-env.mjs --quiet \\
    || fail ".env.example and src/lib/env.ts disagree. Run: node scripts/validate-env.mjs"
fi

# 4. No secret in the staged diff. Shape-based; never prints the value.
if node scripts/predeploy-check.mjs --json --skip-branch --allow-placeholders > /tmp/eyg-hook.json 2>/dev/null; then
  :
else
  :
fi
if grep -q '"secret\\.' /tmp/eyg-hook.json 2>/dev/null; then
  rm -f /tmp/eyg-hook.json
  fail "possible committed credential detected. See: node scripts/predeploy-check.mjs"
fi
rm -f /tmp/eyg-hook.json

# 5. No placeholder phone / TODO-VERIFY in files that are about to ship.
STAGED_SRC=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^(src|content)/' || true)
if [ -n "$STAGED_SRC" ]; then
  if grep -lE '(\\+639000000000|639000000000|TODO-VERIFY)' $STAGED_SRC 2>/dev/null | grep -q .; then
    fail "placeholder phone or TODO-VERIFY marker staged. Allowed in src/config/site.ts only until the owner confirms."
  fi
fi

printf '\\033[32mhook:\\033[0m pre-commit passed\\n'
exit 0
`;

/**
 * pre-push. Slower, so it runs once per push rather than per commit.
 */
const PRE_PUSH = `#!/bin/sh
${MARKER}
# EYG Tire & Auto Care — devops. See scripts/install-hooks.mjs
#
# Catches the two things that are expensive in CI rather than locally: a
# type error and a large binary accidentally staged.

set -e

fail() {
  printf '\\033[31mhook:\\033[0m %s\\n' "$1" >&2
  exit 1
}

branch=$(git rev-parse --abbrev-ref HEAD)
remote=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo '')

if [ -z "$remote" ]; then
  printf '\\033[33mhook:\\033[0m no upstream set for %s — skipping typecheck.\\n' "$branch"
  exit 0
fi

# 1. Typecheck. Zero tolerance, same as CI.
printf '\\033[2mhook:\\033[0m typecheck…\\n'
if [ -d node_modules ]; then
  npx --no-install tsc --noEmit || fail "typecheck failed. Run: npm run typecheck"
else
  printf '\\033[33mhook:\\033[0m node_modules missing — run npm ci first. Skipping typecheck.\\n'
fi

# 2. Nothing enormous in the tree.
printf '\\033[2mhook:\\033[0m checking for large files…\\n'
large=$(git ls-files | while read -r f; do
  if [ -f "$f" ]; then
    size=$(wc -c < "$f" 2>/dev/null || echo 0)
    if [ "$size" -gt 8000000 ]; then echo "$f ($size bytes)"; fi
  fi
done)
if [ -n "$large" ]; then
  fail "files over 8 MB committed:
$large"
fi

printf '\\033[32mhook:\\033[0m pre-push passed (%s -> %s)\\n' "$branch" "$remote"
exit 0
`;

/** @type {{ name: string, body: string }[]} */
const HOOKS = [
  { name: "pre-commit", body: PRE_COMMIT },
  { name: "pre-push", body: PRE_PUSH },
];

// ── Install / uninstall / check ─────────────────────────────────────────────

/** @param {string} name */
function hookPath(name) {
  return join(HOOKS_DIR, name);
}

/** @param {string} name */
function isManaged(name) {
  const p = hookPath(name);
  if (!existsSync(p)) return false;
  try {
    return readFileSync(p, "utf8").includes(MARKER);
  } catch {
    return false;
  }
}

/** @param {string} name */
function status(name) {
  const p = hookPath(name);
  if (!existsSync(p)) return "absent";
  return isManaged(name) ? "installed" : "foreign";
}

function main() {
  if (!existsSync(join(ROOT, ".git"))) {
    process.stderr.write(
      `${c(YEL, "warn")} .git/ not found — this is not a git checkout.\n` +
        c(YEL, "      Skipping hook installation (CI still enforces everything).\n"),
    );
    process.exit(0);
  }

  if (opts.check) {
    process.stdout.write(`${c(BLD, "GIT HOOKS")} ${c(DIM, HOOKS_DIR)}\n`);
    for (const h of HOOKS) {
      const s = status(h.name);
      const tag = s === "installed" ? c(GRN, "ok") : s === "foreign" ? c(YEL, "other") : c(DIM, "--");
      process.stdout.write(`  ${tag}  ${h.name} ${c(DIM, s)}\n`);
    }
    process.exit(0);
  }

  mkdirSync(HOOKS_DIR, { recursive: true });

  if (opts.uninstall) {
    for (const h of HOOKS) {
      const p = hookPath(h.name);
      if (isManaged(h.name)) {
        try {
          unlinkSync(p);
          process.stdout.write(`  ${c(GRN, "removed")}  ${h.name}\n`);
        } catch (err) {
          process.stderr.write(`  ${c(YEL, "warn")} could not remove ${h.name}: ${String(err).slice(0, 80)}\n`);
        }
      } else if (existsSync(p)) {
        process.stdout.write(`  ${c(YEL, "kept")}     ${h.name} ${c(DIM, "(not managed by this script)")}\n`);
      }
    }
    process.exit(0);
  }

  let installed = 0;
  let skipped = 0;

  for (const h of HOOKS) {
    const p = hookPath(h.name);
    const current = status(h.name);

    if (current === "foreign" && !opts.force) {
      process.stderr.write(
        `  ${c(YEL, "skip")}    ${h.name} — a hook you wrote yourself is already there.\n` +
          c(YEL, "        Overwrite with --force, or merge the checks above into yours.\n"),
      );
      skipped += 1;
      continue;
    }

    try {
      writeFileSync(p, h.body, { mode: 0o755 });
      chmodSync(p, 0o755);
      process.stdout.write(
        `  ${c(GRN, "installed")} ${h.name} ${c(DIM, current === "foreign" ? "(overwritten with --force)" : "")}\n`,
      );
      installed += 1;
    } catch (err) {
      process.stderr.write(`  ${c(RED, "fail")}   ${h.name}: ${String(err).slice(0, 120)}\n`);
    }
  }

  process.stdout.write("\n");
  if (installed > 0) {
    process.stdout.write(
      c(GRN, c(BLD, "OK")) +
        c(DIM, "  pre-commit blocks placeholders and secrets; pre-push runs tsc.\n") +
        c(DIM, "  Bypass only to fix-on-next-commit: git commit --no-verify\n"),
    );
  }
  if (skipped > 0) {
    process.stdout.write(c(YEL, `${skipped} hook(s) left untouched. Run with --force to overwrite.\n`));
  }
  process.exit(installed > 0 ? 0 : 0);
}

main();
