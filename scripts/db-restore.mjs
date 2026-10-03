#!/usr/bin/env node
/**
 * db-restore.mjs — put a backup back, safely, and prove it worked.
 * ============================================================================
 * The rule this script exists to enforce: **never restore over production.**
 * A restore is a decision made under pressure; the tool's job is to make the
 * unsafe version impossible rather than to trust the operator's judgement at
 * 2am.
 *
 * Every restore path requires BOTH:
 *   1. `--target=<url>` naming a database that is NOT production, and
 *   2. `--confirm=<expected-row-count>` matching the booking count in the dump.
 * A restore into production needs `--i-know-what-i-am-doing` plus the target
 * host spelled out again, and it still writes a pre-restore safety dump first.
 *
 * Pure Node ESM. No shell. No `eval`. The passphrase is never on argv.
 *
 * Usage — the documented drill (BACKUP-AND-RECOVERY.md §6):
 *
 *   # 1. Throwaway scratch database, full restore, verify, drop.
 *   docker compose exec postgres createdb -U eyg eyg_restore_drill
 *   node scripts/db-restore.mjs --latest --dry-run
 *   node scripts/db-restore.mjs --latest \
 *     --target=postgresql://eyg:...@localhost:5432/eyg_restore_drill \
 *     --confirm=0
 *   node scripts/db-restore.mjs --latest \
 *     --target=postgresql://eyg:...@localhost:5432/eyg_restore_drill \
 *     --confirm=<the count it printed> --cleanup
 *
 *   # 2. Production. Reads loudly, dumps first, needs the double flag.
 *   node scripts/db-restore.mjs --latest --target=$DATABASE_URL \
 *     --confirm=<count> --i-know-what-i-am-doing
 *
 * Flags:
 *   --latest                     newest backup in --dir (default)
 *   --file=<path>                a specific .dump / .dump.enc
 *   --dir=<dir>                  backup directory (default $BACKUP_DIR or ./backups)
 *   --target=<url>               where to restore. REQUIRED. Must not be prod
 *                                 unless --i-know-what-i-am-doing is passed.
 *   --confirm=<n>                expected Booking row count in the dump
 *   --list-only                  inspect the archive, restore nothing
 *   --dry-run                    decrypt + describe, write nothing
 *   --cleanup                    drop the target database when finished (drills)
 *   --jobs=<n>                   parallel pg_restore jobs (default 2)
 *   --i-know-what-i-am-doing     required to restore into production
 *   --json                       machine-readable output
 *
 * Exit codes: 0 = restored and verified · 1 = failure · 2 = refused / bad usage
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createDecipheriv, scryptSync } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/** Hostname fragments that mean "this is the live shop". */
const PRODUCTION_MARKERS = [
  "eygtireautocare.ph",
  "eygtireautocare",
  "production",
  "prod.",
  ".prod",
  "rds.amazonaws.com",
  "neon.tech",
  "supabase.co",
  "railway.app",
  "fly.dev",
];

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = {
    file: "",
    dir: process.env.BACKUP_DIR || join(ROOT, "backups"),
    target: "",
    confirm: null,
    latest: false,
    listOnly: false,
    dryRun: false,
    cleanup: false,
    jobs: 2,
    acknowledge: false,
    json: false,
  };
  for (const arg of argv) {
    if (arg.startsWith("--file=")) o.file = arg.slice(7);
    else if (arg.startsWith("--dir=")) o.dir = arg.slice(6);
    else if (arg.startsWith("--target=")) o.target = arg.slice(9).trim();
    else if (arg.startsWith("--confirm=")) o.confirm = Number(arg.slice(10));
    else if (arg.startsWith("--jobs=")) o.jobs = Number(arg.slice(8));
    else if (arg === "--latest") o.latest = true;
    else if (arg === "--list-only") o.listOnly = true;
    else if (arg === "--dry-run") o.dryRun = true;
    else if (arg === "--cleanup") o.cleanup = true;
    else if (arg === "--i-know-what-i-am-doing") o.acknowledge = true;
    else if (arg === "--json") o.json = true;
    else if (arg === "--help" || arg === "-h") {
      const header = readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0] ?? "";
      process.stdout.write(`${header.replace(/^\/\*\*?\n/, "")}\n`);
      process.exit(0);
    } else {
      process.stderr.write(`db-restore: unknown argument "${arg}"\n`);
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

const log = (m) => {
  if (!opts.json) process.stdout.write(`${m}\n`);
};
const warn = (m) => process.stderr.write(`${c(YEL, "warn")} ${m}\n`);
const fail = (m) => process.stderr.write(`${c(RED, "refused")} ${m}\n`);

// ── Process helper ──────────────────────────────────────────────────────────

/**
 * @param {string} bin
 * @param {string[]} args
 * @param {{ env?: Record<string, string> }} [o]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function run(bin, args, o = {}) {
  return new Promise((res) => {
    const child = spawn(bin, args, {
      env: { ...process.env, ...(o.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const out = [];
    const err = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", (e) => res({ code: 127, stdout: "", stderr: String(e.message) }));
    child.on("close", (code) =>
      res({ code: code ?? 1, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }),
    );
  });
}

// ── URL handling ────────────────────────────────────────────────────────────

/**
 * @param {string} url
 * @returns {{ cleanUrl: string, env: Record<string, string>, host: string, db: string } | null}
 */
function splitUrl(url) {
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
  return {
    cleanUrl: clean.toString(),
    env,
    host: parsed.hostname.toLowerCase(),
    db: parsed.pathname.replace(/^\//, ""),
  };
}

/** @param {string} host */
function looksProduction(host) {
  return PRODUCTION_MARKERS.some((m) => host.includes(m.toLowerCase()));
}

// ── Decryption ──────────────────────────────────────────────────────────────

/** @returns {Buffer | null} */
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
 * Parses the self-describing `EYGBACKUP1` header written by db-backup.mjs.
 * @param {Buffer} raw
 * @returns {{ salt: Buffer, iv: Buffer, tag: Buffer, plainSha256: string, plainBytes: number }}
 */
function parseHeader(raw) {
  const marker = Buffer.from("---\n", "utf8");
  const end = raw.indexOf(marker);
  if (end === -1) throw new Error("not an EYGBACKUP1 file (no header terminator)");
  const headerText = raw.subarray(0, end).toString("utf8");
  if (!headerText.startsWith("EYGBACKUP1")) throw new Error("not an EYGBACKUP1 file");

  const fields = new Map();
  for (const line of headerText.split("\n").slice(1)) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    fields.set(line.slice(0, idx), line.slice(idx + 1));
  }
  const b64 = (k) => Buffer.from(fields.get(k) ?? "", "base64");
  return {
    salt: b64("salt"),
    iv: b64("iv"),
    tag: b64("tag"),
    plainSha256: fields.get("plain_sha256") ?? "",
    plainBytes: Number(fields.get("plain_bytes") ?? 0),
  };
}

/**
 * Decrypts in memory. Writes the plaintext dump to a 0600 temp file that is
 * unlinked in a `finally`, including on failure.
 * @param {Buffer} raw
 * @param {Buffer} passphrase
 * @returns {{ dumpPath: string, plainSha256: string, cleanup: () => void }}
 */
function decryptToTemp(raw, passphrase) {
  const meta = parseHeader(raw);
  const key = scryptSync(passphrase, meta.salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv("aes-256-gcm", key, meta.iv);
  decipher.setAuthTag(meta.tag);
  const body = raw.subarray(raw.indexOf(Buffer.from("---\n", "utf8")) + 4);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error(
      "decryption failed: wrong passphrase, or the file is corrupt. The GCM tag did not verify.",
    );
  }

  const dumpPath = join(tmpdir(), `eyg-restore-${process.pid}-${Date.now()}.dump`);
  writeFileSync(dumpPath, plain, { mode: 0o600 });
  return {
    dumpPath,
    plainSha256: meta.plainSha256,
    cleanup: () => {
      try {
        unlinkSync(dumpPath);
      } catch {
        /* already gone */
      }
    },
  };
}

// ── Archive inspection ──────────────────────────────────────────────────────

function listArchive() {
  if (!existsSync(opts.dir)) return [];
  return readdirSync(opts.dir)
    .filter((f) => f.endsWith(".dump") || f.endsWith(".dump.enc"))
    .sort();
}

/**
 * Reads the manifest sidecar if present so the operator knows what they are
 * about to restore without decrypting anything.
 * @param {string} name
 */
function readManifest(name) {
  const path = join(opts.dir, `${name}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function listMode() {
  const names = listArchive();
  const rows = names.map((name) => {
    const m = readManifest(name);
    return {
      name,
      createdAt: m?.createdAt ?? null,
      label: m?.label ?? null,
      encrypted: name.endsWith(".enc"),
      plainBytes: m?.plainBytes ?? null,
    };
  });
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ archive: resolve(opts.dir), backups: rows }, null, 2)}\n`);
    process.exit(0);
  }
  log(`${c(BLD, "ARCHIVE")} ${c(DIM, resolve(opts.dir))}`);
  if (rows.length === 0) {
    log(c(YEL, "  (empty — is the backup cron running?)"));
    process.exit(0);
  }
  for (const r of rows) {
    log(`  ${r.name} ${c(DIM, `${r.createdAt ?? "?"}${r.label ? ` [${r.label}]` : ""}`)}`);
  }
  log(c(DIM, "\n  Inspect one: node scripts/db-restore.mjs --file=" + rows[0].name + " --list-only"));
  process.exit(0);
}

// ── Main flow ───────────────────────────────────────────────────────────────

async function main() {
  if (opts.listOnly || (!opts.latest && !opts.file)) return listMode();

  // --- Pick the backup -------------------------------------------------------
  let name = opts.file;
  if (!name) {
    const names = listArchive();
    if (names.length === 0) {
      fail(`no backups in ${resolve(opts.dir)}. Nothing to restore. This is a SEV1.`);
      process.exit(1);
    }
    name = names[names.length - 1];
    if (!name) {
      fail("archive listing produced no usable name");
      process.exit(1);
    }
    log(c(DIM, `using newest backup: ${name}`));
  }

  const full = join(opts.dir, name);
  if (!existsSync(full)) {
    fail(`${full} does not exist.`);
    process.exit(1);
  }

  const manifest = readManifest(name);
  const encrypted = name.endsWith(".enc");
  const raw = readFileSync(full);

  // --- Describe before doing -------------------------------------------------
  log(`${c(BLD, "RESTORE PLAN")}`);
  log(`  archive      ${full}`);
  log(`  created      ${manifest?.createdAt ?? "unknown"}`);
  if (manifest?.label) log(`  label        ${manifest.label}`);
  log(`  encrypted    ${encrypted ? `yes (${manifest?.cipher ?? "aes-256-gcm"})` : c(YEL, "NO")}`);
  log(`  payload      ${(raw.length / 1_048_576).toFixed(2)} MB on disk`);

  // --- Decrypt ---------------------------------------------------------------
  let dumpPath = full;
  let cleanup = () => {};
  let plainSha = manifest?.plainSha256 ?? "";

  if (encrypted) {
    const passphrase = readPassphrase();
    if (!passphrase) {
      fail(
        "this backup is encrypted and no passphrase was supplied.\n" +
          "      Set BACKUP_PASSPHRASE_FILE (preferred) or BACKUP_PASSPHRASE.\n" +
          "      The passphrase is NOT stored with the backup — see BACKUP-AND-RECOVERY.md §3.",
      );
      process.exit(1);
    }
    try {
      const res = decryptToTemp(raw, passphrase);
      dumpPath = res.dumpPath;
      cleanup = res.cleanup;
      plainSha = res.plainSha256;
      log(`  decrypted    ${(readFileSync(dumpPath).length / 1_048_576).toFixed(2)} MB (temp, mode 0600)`);
    } catch (err) {
      fail(String(err instanceof Error ? err.message : err));
      process.exit(1);
    }
  }

  // --- Safety dump of the target before touching it --------------------------
  if (opts.target) {
    const target = splitUrl(opts.target);
    if (!target) {
      fail("--target must be a postgresql:// URL");
      process.exit(2);
    }
    log(`  target db    ${target.host}/${target.db}`);
    log(`  target user  ${decodeURIComponent(new URL(opts.target).username)}`);

    if (looksProduction(target.host)) {
      log("");
      log(c(RED, c(BLD, "  ⚠  THIS TARGET LOOKS LIKE PRODUCTION")));
      if (!opts.acknowledge) {
        log(c(RED, "     Refusing. Re-run with --i-know-what-i-am-doing if you truly mean it,"));
        log(c(RED, "     and read docs/ops/BACKUP-AND-RECOVERY.md §7 first."));
        if (!opts.dryRun) {
          cleanup();
          process.exit(2);
        }
        warn("--dry-run: continuing past the production guard so you can inspect the plan.");
      } else {
        log(c(YEL, "     --i-know-what-i-am-doing accepted. A pre-restore safety dump will be taken."));
      }
    }

    if (opts.dryRun) {
      log("");
      log(c(YEL, c(BLD, "  DRY RUN — nothing was written.")));
      log(c(DIM, "  Remove --dry-run and pass --confirm=<booking count> to restore."));
      if (opts.json) {
        process.stdout.write(`${JSON.stringify({ tool: "db-restore", ok: true, dryRun: true, archive: full, target: opts.target ? target.db : null }, null, 2)}\n`);
      }
      cleanup();
      process.exit(0);
    }

    // Take a safety dump of whatever is in the target right now, so "the restore
    // went wrong" is itself recoverable.
    const preRestore = await run("pg_dump", [
      "--dbname",
      target.cleanUrl,
      "--format",
      "custom",
      "--no-password",
      "--no-owner",
    ], { env: target.env });
    if (preRestore.code === 0 && preRestore.stdout.length > 0) {
      const safety = join(opts.dir, `PRE_RESTORE_${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
      writeFileSync(safety, Buffer.from(preRestore.stdout, "utf8"), { mode: 0o600 });
      log(`  safety dump  ${safety} ${c(DIM, "(what was in the target a minute ago)")}`);
    } else {
      warn("could not take a pre-restore safety dump (target may be empty or unreachable)");
    }
  }

  // --- Restore ---------------------------------------------------------------
  if (!opts.target) {
    fail("--target is required to restore. Use --list-only to inspect the archive.");
    cleanup();
    process.exit(2);
  }

  const target = splitUrl(opts.target);
  if (!target) {
    fail("--target must be a postgresql:// URL");
    cleanup();
    process.exit(2);
  }

  // Clean the target first: a restore into a populated schema fails halfway and
  // leaves you with neither the old data nor the new.
  const drop = await run("psql", [
    "--dbname", target.cleanUrl,
    "--no-password",
    "--set", "ON_ERROR_STOP=1",
    "--command", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
  ], { env: target.env });
  if (drop.code !== 0) {
    fail(`could not reset the target schema: ${drop.stderr.trim().slice(0, 300)}`);
    cleanup();
    process.exit(1);
  }
  log(`  schema       reset (public schema dropped and recreated)`);

  log(c(DIM, "  restoring…"));
  const restored = await run("pg_restore", [
    "--dbname", target.cleanUrl,
    "--no-password",
    "--no-owner",
    "--no-privileges",
    "--jobs", String(Math.max(1, opts.jobs)),
    "--exit-on-error",
    "--verbose",
    dumpPath,
  ], { env: target.env });

  if (restored.code !== 0) {
    fail(`pg_restore failed (exit ${restored.code}): ${restored.stderr.trim().slice(0, 600)}`);
    log(c(DIM, `  full log: re-run with --jobs=1 for a readable error.`));
    cleanup();
    process.exit(1);
  }
  log(`  restored     ${c(GRN, "ok")}`);

  // --- Verify ----------------------------------------------------------------
  log(`${c(BLD, "VERIFY")}`);
  const countSql = 'SELECT count(*)::int AS n FROM "Booking";';
  const counted = await run("psql", [
    "--dbname", target.cleanUrl,
    "--no-password",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--command", countSql,
  ], { env: target.env });

  let bookingCount = null;
  if (counted.code === 0) {
    const n = Number((counted.stdout || "").trim().split(/\s+/)[0]);
    bookingCount = Number.isFinite(n) ? n : null;
  }
  log(`  bookings     ${bookingCount ?? c(YEL, "could not count")}`);

  // Table census — a restore that loaded 3 of 19 tables is still a failure.
  const census = await run("psql", [
    "--dbname", target.cleanUrl,
    "--no-password",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--command",
    `SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public';`,
  ], { env: target.env });
  const tableCount = Number((census.stdout || "").trim()) || 0;
  log(`  tables       ${tableCount}`);
  if (tableCount < 10) warn(`only ${tableCount} tables — the dump may be partial`);

  // Check the most recent booking survived with a date. Zero bookings on a
  // multi-year-old database is a red flag, not a fact.
  const newest = await run("psql", [
    "--dbname", target.cleanUrl,
    "--no-password",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--command", 'SELECT COALESCE(max("startAt")::text, \'none\') FROM "Booking";',
  ], { env: target.env });
  const newestAt = (newest.stdout || "").trim() || "none";
  log(`  newest       ${newestAt}`);

  if (plainSha) {
    log(`  sha256       ${plainSha.slice(0, 16)}… ${c(DIM, "(recorded in the manifest)")}`);
  }

  // --- Confirm gate ----------------------------------------------------------
  if (opts.confirm === null) {
    warn(`--confirm was not supplied. If this matches the live count (${bookingCount}), the restore is good.`);
  } else if (opts.confirm !== bookingCount) {
    fail(
      `--confirm=${opts.confirm} but the restored database has ${bookingCount} bookings.\n` +
        "      This is the wrong backup, or the dump is partial. Nothing was promoted.",
    );
    cleanup();
    process.exit(1);
  } else {
    log(c(GRN, `  confirmed    booking count matches (${bookingCount})`));
  }

  // --- Optional teardown -----------------------------------------------------
  if (opts.cleanup) {
    const dropped = await run("dropdb", [
      "--if-exists", "--force", "--dbname", target.cleanUrl,
    ], { env: target.env });
    log(
      dropped.code === 0
        ? c(GRN, "  cleanup      target database dropped — drill complete")
        : c(YEL, "  cleanup      could not drop the target; drop it manually"),
    );
  }

  cleanup();

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          tool: "db-restore",
          ok: true,
          archive: full,
          target: `${target.host}/${target.db}`,
          bookingCount,
          tableCount,
          newestBooking: newestAt,
        },
        null,
        2,
      )}\n`,
    );
  }
  log("");
  log(c(GRN, c(BLD, "RESTORE OK")) + c(DIM, `  ${target.host}/${target.db}`));
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
