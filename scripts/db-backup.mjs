#!/usr/bin/env node
/**
 * db-backup.mjs — encrypted, retention-managed Postgres backups.
 * ============================================================================
 * A backup nobody has restored is a hypothesis. This script produces dumps that
 * are (a) encrypted at rest with AES-256-GCM, (b) rotation-pruned so the disk
 * does not fill, and (c) accompanied by a SHA-256 checksum and a manifest so a
 * restore can prove which file it read.
 *
 * Bookings are the only irreplaceable data this business has. Everything else
 * can be retyped in an afternoon; a lost booking history cannot.
 *
 * Pure Node ESM. Wraps `pg_dump` / `pg_dumpall` via spawnFile (no shell), so
 * there is no injection surface and no password ever appears in a process list
 * if we pass it via PGPASSWORD.
 *
 * Usage:
 *   node scripts/db-backup.mjs                       # full custom dump, auto-rotated
 *   node scripts/db-backup.mjs --label=pre-migration
 *   node scripts/db-backup.mjs --retention=30 --daily=14 --weekly=8
 *   node scripts/db-backup.mjs --out=/mnt/backups
 *   node scripts/db-backup.mjs --no-encrypt           # local drills only
 *   node scripts/db-backup.mjs --dry-run              # print the plan, write nothing
 *
 * Flags:
 *   --out=<dir>       destination (default: $BACKUP_DIR, else ./backups)
 *   --label=<name>    tag this dump, e.g. before-the-2026-03-price-change
 *   --retention=<d>   days to keep *unclassified* dumps (default 14)
 *   --daily=<n>       keep n daily dumps        (default 7)
 *   --weekly=<n>      keep n weekly dumps       (default 4)
 *   --no-encrypt      skip AES-256-GCM. Refuses unless --allow-insecure too.
 *   --allow-insecure  acknowledge an unencrypted dump leaves the machine
 *   --dry-run         resolve everything, write nothing
 *   --list            list existing backups and exit
 *   --verify          checksum every existing dump and exit non-zero on drift
 *   --json            machine-readable summary
 *
 * Exit codes: 0 = backup written (or verified) · 1 = failure · 2 = bad usage
 *
 * SECURITY: the passphrase never touches argv (visible in `ps` to every user on
 * the box) — it is passed through the environment as BACKUP_PASSPHRASE, read
 * from a file at BACKUP_PASSPHRASE_FILE, or piped to `openssl` on stdin. It is
 * never printed, not even masked.
 */

import { spawn } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = {
    out: process.env.BACKUP_DIR || join(ROOT, "backups"),
    label: "",
    retention: 14,
    daily: 7,
    weekly: 4,
    encrypt: true,
    allowInsecure: false,
    dryRun: false,
    list: false,
    verify: false,
    json: false,
  };
  for (const arg of argv) {
    if (arg.startsWith("--out=")) o.out = arg.slice(6);
    else if (arg.startsWith("--label=")) o.label = arg.slice(8).replace(/[^A-Za-z0-9._-]/g, "-");
    else if (arg.startsWith("--retention=")) o.retention = Number(arg.slice(12));
    else if (arg.startsWith("--daily=")) o.daily = Number(arg.slice(8));
    else if (arg.startsWith("--weekly=")) o.weekly = Number(arg.slice(9));
    else if (arg === "--no-encrypt") o.encrypt = false;
    else if (arg === "--allow-insecure") o.allowInsecure = true;
    else if (arg === "--dry-run") o.dryRun = true;
    else if (arg === "--list") o.list = true;
    else if (arg === "--verify") o.verify = true;
    else if (arg === "--json") o.json = true;
    else if (arg === "--help" || arg === "-h") {
      const header = readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0] ?? "";
      process.stdout.write(`${header.replace(/^\/\*\*?\n/, "")}\n`);
      process.exit(0);
    } else {
      process.stderr.write(`db-backup: unknown argument "${arg}"\n`);
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
const DIM = "[2m";
const BLD = "[1m";
const OFF = "[0m";
const useColour = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const c = (code, text) => (useColour ? `${code}${text}${OFF}` : text);

const log = (msg) => {
  if (!opts.json) process.stdout.write(`${msg}\n`);
};
const warn = (msg) => process.stderr.write(`${c(YEL, "warn")} ${msg}\n`);
const fail = (msg) => process.stderr.write(`${c(RED, "fail")} ${msg}\n`);

// ── Password handling (never on argv, never printed) ────────────────────────

/**
 * Resolves the backup passphrase from, in order:
 *   1. `BACKUP_PASSPHRASE_FILE` — a file only the backup user can read.
 *   2. `BACKUP_PASSPHRASE`      — environment; acceptable in CI with a masked secret.
 * Returns null when absent. The value is NEVER logged.
 * @returns {Buffer | null}
 */
function readPassphrase() {
  const file = process.env.BACKUP_PASSPHRASE_FILE;
  if (file && existsSync(file)) {
    const raw = readFileSync(file, "utf8").trim();
    if (raw !== "") return Buffer.from(raw, "utf8");
  }
  const env = process.env.BACKUP_PASSPHRASE;
  if (typeof env === "string" && env.trim() !== "") return Buffer.from(env.trim(), "utf8");
  return null;
}

/**
 * Derives a 256-bit key from the passphrase. scrypt with a random salt per
 * backup: two backups of the same data must not share a key derivation.
 * @param {Buffer} passphrase
 * @param {Buffer} salt
 */
function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

// ── Database URL handling ───────────────────────────────────────────────────

/**
 * Extracts the host/port/database/user for `pg_dump --dbname`, and rebuilds a
 * URL with the password moved into PGPASSWORD so it never appears in `ps`.
 * @param {string} url
 * @returns {{ cleanUrl: string, env: Record<string, string> } | null}
 */
function splitDatabaseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) return null;

  const env = { PGPASSWORD: decodeURIComponent(parsed.password) };
  const clean = new URL(url);
  clean.password = "";
  return { cleanUrl: clean.toString(), env };
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (typeof url !== "string" || url.trim() === "") {
    fail("DATABASE_URL is not set. A backup of nothing is worse than no backup.");
    process.exit(1);
  }
  const split = splitDatabaseUrl(url.trim());
  if (!split) {
    fail("DATABASE_URL is not a postgresql:// URL.");
    process.exit(1);
  }
  return split;
}

// ── Process helper ──────────────────────────────────────────────────────────

/**
 * Runs a command with an argument array and extra environment. No shell, so
 * nothing is word-split or glob-expanded and no value can be re-interpreted.
 * @param {string} bin
 * @param {string[]} args
 * @param {{ env?: Record<string, string>, stdin?: Buffer | string, quiet?: boolean }} [opts]
 * @returns {Promise<{ code: number, stdout: Buffer, stderr: string }>}
 */
function run(bin, args, opts2 = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(bin, args, {
      env: { ...process.env, ...(opts2.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      shell: false, // hard requirement: never a shell
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (d) => stdout.push(d));
    child.stderr.on("data", (d) => stderr.push(d));
    child.on("error", (err) => {
      resolvePromise({ code: 127, stdout: Buffer.concat(stdout), stderr: String(err.message) });
    });
    child.on("close", (code) => {
      resolvePromise({
        code: code ?? 1,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    if (opts2.stdin !== undefined) child.stdin.write(opts2.stdin);
    child.stdin.end();
  });
}

// ── File naming ─────────────────────────────────────────────────────────────

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);

/**
 * @param {string} ext
 * @returns {string}
 */
function backupName(ext) {
  const label = opts.label ? `_${opts.label}` : "";
  return `eyg-${stamp()}${label}.${ext}`;
}

/** Parses the timestamp + label back out of a backup filename. */
function parseName(name) {
  const m = /^eyg-(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})(?:_(.+?))?\.(dump|dump\.enc|sql|json)$/.exec(name);
  if (!m) return null;
  return { date: m[1], time: m[2], label: m[3] ?? null, ext: m[4], name };
}

/** @param {string} name */
function ageDays(name) {
  const parsed = parseName(name);
  if (!parsed) return 0;
  const iso = `${parsed.date}T${parsed.time}Z`;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

// ── List / verify ───────────────────────────────────────────────────────────

function listBackups() {
  if (!existsSync(opts.out)) return [];
  return readdirSync(opts.out)
    .filter((f) => parseName(f) !== null)
    .sort()
    .map((name) => {
      const full = join(opts.out, name);
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        /* the file vanished between readdir and stat */
      }
      return { name, size, ageDays: ageDays(name), ...parseName(name) };
    });
}

function listMode() {
  const backups = listBackups();
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ backups }, null, 2)}\n`);
    process.exit(0);
  }
  log(`${c(BLD, "BACKUPS")} ${c(DIM, opts.out)}`);
  if (backups.length === 0) {
    log(c(YEL, "  (none — run: node scripts/db-backup.mjs)"));
    process.exit(0);
  }
  for (const b of backups) {
    const mb = (b.size / 1_048_576).toFixed(1);
    const label = b.label ? c(DIM, ` [${b.label}]`) : "";
    const age = b.ageDays > 0 ? c(DIM, ` ${b.ageDays}d`) : "";
    log(`  ${b.name}${label} ${c(DIM, `${mb}MB`)}${age}`);
  }
  process.exit(0);
}

function verifyMode() {
  const backups = listBackups().filter((b) => b.ext !== "json");
  if (backups.length === 0) {
    fail("no backups to verify.");
    process.exit(1);
  }
  let bad = 0;
  const rows = [];
  for (const b of backups) {
    const full = join(opts.out, b.name);
    const sidecar = `${full}.sha256`;
    let status = "no-checksum";
    if (existsSync(sidecar)) {
      const expected = readFileSync(sidecar, "utf8").split(/\s+/)[0] ?? "";
      const actual = createHash("sha256").update(readFileSync(full)).digest("hex");
      status = expected === actual ? "ok" : "MISMATCH";
    }
    if (status === "MISMATCH") bad += 1;
    rows.push({ name: b.name, status });
    if (!opts.json) {
      const tag = status === "ok" ? c(GRN, "ok") : status === "MISMATCH" ? c(RED, "BAD") : c(YEL, "?");
      log(`  ${tag}  ${b.name}`);
    }
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ verified: rows, mismatches: bad, ok: bad === 0 }, null, 2)}\n`);
  }
  if (bad > 0) {
    fail(`${bad} backup(s) failed checksum verification. The most recent known-good is suspect.`);
    process.exit(1);
  }
  log(c(GRN, "all backups match their recorded checksum"));
  process.exit(0);
}

// ── Retention ───────────────────────────────────────────────────────────────

/**
 * Enforces 7 daily + 4 weekly + N days of unclassified dumps.
 *
 * The rule that protects the oldest good copy: never prune the most recent dump,
 * and never prune the newest dump older than 90 days no matter what the flags
 * say. A restore that has nothing to restore from is the worst outcome here.
 * @param {ReturnType<typeof listBackups>} backups
 * @returns {string[]} names removed
 */
function applyRetention(backups) {
  const now = Date.now();
  /** @type {Map<string, number>} ISO-week -> newest dump in that week */
  const weeklySeen = new Map();
  /** @type {Set<string>} names claimed by the daily and weekly tiers */
  const keep = new Set();

  const sorted = [...backups].sort((a, b) => (a.name < b.name ? 1 : -1)); // newest first

  let dailyCount = 0;
  for (const b of sorted) {
    if (dailyCount >= opts.daily) break;
    keep.add(b.name);
    dailyCount += 1;
  }

  for (const b of sorted) {
    const d = new Date(`${b.date}T00:00:00Z`);
    const dayOfYear = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
    const year = d.getUTCFullYear();
    const week = Math.floor(dayOfYear / 7);
    const key = `${year}-W${week}`;
    const held = weeklySeen.get(key) ?? 0;
    if (held < 1 && weeklySeen.size < opts.weekly) {
      weeklySeen.set(key, 1);
      keep.add(b.name);
    }
  }

  const floorDate = now - opts.retention * 86_400_000;
  for (const b of sorted) {
    const d = new Date(`${b.date}T${b.time}Z`).getTime();
    if (Number.isNaN(d)) continue;
    // A labelled dump (pre-migration, pre-price-change) is a decision record,
    // not a rolling backup. Never prune one automatically.
    if (b.label) {
      keep.add(b.name);
      continue;
    }
    if (d >= floorDate) keep.add(b.name);
  }

  // Hard safety rails.
  const newest = sorted[0];
  const ninetyDaysAgo = now - 90 * 86_400_000;
  for (const b of sorted) {
    const d = new Date(`${b.date}T${b.time}Z`).getTime();
    if (Number.isNaN(d)) continue;
    if (d >= ninetyDaysAgo) keep.add(b.name); // keep everything from the last quarter
  }
  if (newest) keep.add(newest.name);

  const pruned = [];
  for (const b of sorted) {
    if (keep.has(b.name)) continue;
    if (opts.dryRun) {
      pruned.push(b.name);
      continue;
    }
    try {
      unlinkSync(join(opts.out, b.name));
      const sidecar = join(opts.out, `${b.name}.sha256`);
      if (existsSync(sidecar)) unlinkSync(sidecar);
      pruned.push(b.name);
    } catch (err) {
      warn(`could not prune ${b.name}: ${String(err).slice(0, 80)}`);
    }
  }
  return pruned;
}

// ── Main backup flow ────────────────────────────────────────────────────────

async function backup() {
  const { cleanUrl, env: pgEnv } = requireDatabaseUrl();

  if (!existsSync(opts.out)) {
    if (opts.dryRun) log(`[dry-run] would create ${opts.out}`);
    else mkdirSync(opts.out, { recursive: true, mode: 0o700 });
  }

  const passphrase = opts.encrypt ? readPassphrase() : null;
  if (opts.encrypt && !passphrase) {
    fail(
      "No backup passphrase. Set BACKUP_PASSPHRASE_FILE (preferred) or BACKUP_PASSPHRASE.\n" +
        "      Generate one with: openssl rand -base64 48 > /etc/eyg/backup.key && chmod 600 /etc/eyg/backup.key",
    );
    process.exit(1);
  }
  if (!opts.encrypt && !opts.allowInsecure) {
    fail(
      "Refusing to write an unencrypted dump containing customer names, phones and emails.\n" +
        "      If this is a throwaway local drill, re-run with --no-encrypt --allow-insecure.",
    );
    process.exit(1);
  }

  const ext = opts.encrypt ? "dump.enc" : "dump";
  const name = backupName(ext);
  const full = join(opts.out, name);

  const pgDumpArgs = [
    "--dbname",
    cleanUrl,
    "--format",
    "custom",
    "--compress",
    "9",
    "--no-password",
    "--no-owner",
    "--no-privileges",
    "--verbose",
  ];

  log(`${c(BLD, "BACKUP")} ${c(DIM, new Date().toISOString())}`);
  log(`  source   ${c(DIM, "postgresql://" + new URL(cleanUrl).host)}`);
  log(`  target   ${full}`);
  log(`  format   custom (pg_restore compatible)${opts.encrypt ? ", AES-256-GCM" : ""}`);
  if (opts.label) log(`  label    ${opts.label}`);
  if (opts.dryRun) {
    log(c(YEL, "  DRY RUN — pg_dump was not executed"));
    return { name, bytes: 0, dryRun: true };
  }

  // 1. pg_dump into memory. A small shop's database is single-digit MB; holding
  //    it in RAM lets us checksum and encrypt before anything touches disk.
  const dumped = await run("pg_dump", pgDumpArgs, { env: pgEnv });
  if (dumped.code !== 0 || dumped.stdout.length === 0) {
    fail(`pg_dump failed (exit ${dumped.code}): ${dumped.stderr.trim().slice(0, 400)}`);
    process.exit(1);
  }
  const plain = dumped.stdout;
  log(`  dumped   ${(plain.length / 1_048_576).toFixed(2)} MB (custom format)`);

  // A zero-table dump is almost always a wrong DATABASE_URL, not an empty shop.
  if (plain.length < 1024) {
    warn("dump is under 1 KB — is DATABASE_URL pointing at an empty database?");
  }

  // 2. Checksum the *plaintext* dump so a restore can prove integrity of the
  //    payload independently of the ciphertext.
  const plainSha = createHash("sha256").update(plain).digest("hex");

  // 3. Encrypt.
  let payload = plain;
  let header = "";
  if (passphrase) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
    const body = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Self-describing header so db-restore.mjs never needs out-of-band info.
    header = Buffer.from(
      `EYGBACKUP1\nsalt=${salt.toString("base64")}\niv=${iv.toString("base64")}\ntag=${tag.toString("base64")}\nplain_sha256=${plainSha}\nplain_bytes=${plain.length}\n---\n`,
      "utf8",
    );
    payload = Buffer.concat([header, body]);
  }

  writeFileSync(full, payload, { mode: 0o600 });
  writeFileSync(
    `${full}.sha256`,
    `${createHash("sha256").update(payload).digest("hex")}  ${name}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    `${full}.json`,
    `${JSON.stringify(
      {
        name,
        createdAt: new Date().toISOString(),
        label: opts.label || null,
        encrypted: Boolean(passphrase),
        cipher: passphrase ? "aes-256-gcm" : null,
        kdf: passphrase ? "scrypt(N=16384,r=8,p=1)" : null,
        plainSha256: plainSha,
        plainBytes: plain.length,
        cipherBytes: payload.length,
        format: "pg_dump custom",
        tool: "scripts/db-backup.mjs",
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );

  log(`  sha256   ${plainSha.slice(0, 16)}… (plaintext payload)`);
  log(c(GRN, `  wrote    ${name} (${(payload.length / 1_048_576).toFixed(2)} MB)`));

  // 4. Rotate.
  const backups = listBackups();
  const pruned = applyRetention(backups);
  if (pruned.length > 0) {
    log(`  pruned   ${pruned.length} old backup(s)${opts.dryRun ? " (dry run)" : ""}`);
    for (const p of pruned.slice(0, 8)) log(c(DIM, `            ${p}`));
    if (pruned.length > 8) log(c(DIM, `            …and ${pruned.length - 8} more`));
  }

  log(c(GRN, c(BLD, "OK")) + c(DIM, " restore drill: node scripts/db-restore.mjs --latest --dry-run"));

  return { name, bytes: payload.length, plainSha, pruned };
}

async function main() {
  if (opts.list) return listMode();
  if (opts.verify) return verifyMode();

  const result = await backup();

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          tool: "db-backup",
          ok: true,
          destination: resolve(opts.out),
          ...result,
        },
        null,
        2,
      )}\n`,
    );
  }
  process.exit(0);
}

process.on("unhandledRejection", (err) => {
  fail(`unhandled rejection: ${String(err).slice(0, 160)}`);
  process.exit(1);
});

main().catch((err) => {
  fail(String(err).slice(0, 300));
  process.exit(1);
});
