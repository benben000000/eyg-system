# BACKUP AND RECOVERY

**EYG Tire & Auto Care**

Bookings are the only data this business cannot recreate. Services and prices
can be retyped in an afternoon. Prices, hours and photos can be re-photographed.
**A booking that a customer made — and a customer who drove 1.5 hours to Balanga
on the strength of it — cannot be recreated at all.**

---

## 1. Objectives

| | Target | Why that number |
| --- | --- | --- |
| **RPO** (how much data you can lose) | **1 hour** | Hourly backups. The worst realistic case: a customer booked, then phoned to confirm, then the database was restored to before it. They arrive for a slot nobody knows about. |
| **RTO** (how long until you are back) | **4 hours** | Restoring a small database takes minutes. The 4 hours is the human: deciding, fetching the passphrase, verifying, re-entering anything lost. |
| **Retention** | 7 daily · 4 weekly · 90 days minimum | Enough to notice a slow corruption. Enough to satisfy a "what did we have in March" question. |
| **Encryption** | AES-256-GCM at rest | A dump contains every customer's name, phone number and vehicle. On a laptop or a cheap VPS that is a live breach risk. |

> **RTO in practice, on a good day: 15 minutes.** The 4-hour figure assumes
> someone has to be woken up. Test it and you will find the real number is
> dominated by "where is the passphrase", not by the restore.

---

## 2. Where backups live

**Three copies, two media, one off-site.** The 3-2-1 rule is not dogma; it is
the answer to the specific failure this shop would actually have:

| Failure | Which copy saves you |
| --- | --- |
| The database provider loses the instance | The off-site copy |
| Someone runs a bad migration | The most recent dump |
| A laptop is stolen | The off-site copy |
| Ransomware / a leaked credential encrypts the backups too | The off-site, differently-credentialed copy |
| Silent corruption discovered weeks later | The 90-day retention |

### Recommended layout

```bash
# LOCAL — fast, for "I need it right now"
BACKUP_DIR=/var/backups/eyg

# OFF-SITE — encrypted, versioned, not the same credential
#   Option A: a private S3 bucket / Backblaze B2 / Cloudflare R2
#   Option B: an encrypted repo on GitHub (see the warning)
#   Option C: the owner's Google Drive, via rclone
```

> **Do not put backups in a public repository, even a private one, without
> checking what the provider does with them.** GitHub's terms give them a
> licence to scan and host private repository content, including in AI
> training products. For customer PII, use object storage you control.

---

## 3. The passphrase

The backup passphrase is **separate from every other secret in the system** and
is never stored with the backups.

```bash
# Generate once
openssl rand -base64 48 > /etc/eyg/backup.key
chmod 600 /etc/eyg/backup.key
chown root:backup /etc/eyg/backup.key
```

**Store it in two physical places**, both of which are physically in the shop:

1. A sealed envelope with the shop's registration papers.
2. A password manager the owner controls, with a printed recovery kit.

The envelope matters because it survives the failure mode that actually happens:
the owner is unavailable, the password manager needs MFA, and the restore is
urgent.

**Never** store the passphrase in the repository, in `1Password` only, or in the
same bucket as the backups. Losing it makes every backup permanently
unreadable.

`db-backup.mjs` reads it from, in order:

| Source | Use | Note |
| --- | --- | --- |
| `BACKUP_PASSPHRASE_FILE` | **Everywhere, always** | A path to a 0600 file. Not in the environment. |
| `BACKUP_PASSPHRASE` | CI, as a masked secret | Acceptable — never on `argv`, so never in `ps` |

The passphrase is never printed, not even masked, and never passed as a command
argument.

---

## 4. The backup schedule

### 4.1 Locally

```bash
BACKUP_DIR=/var/backups/eyg BACKUP_PASSPHRASE_FILE=/etc/eyg/backup.key \
  node scripts/db-backup.mjs
```

### 4.2 As a cron job

```cron
# /etc/cron.d/eyg-backup
# 17 past 2am Manila time — deliberately off the hour, like every other
# scheduled thing here. Every backup in the world fires at :00.
#
# Note the TZ: this is a shop in the Philippines, not a server in Frankfurt.
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
TZ=Asia/Manila

# 02:17 daily
17 2 * * *   backup  eyg  node /srv/eyg/scripts/db-backup.mjs >> /var/log/eyg/backup.log 2>&1

# 03:23 Sundays — the weekly retention anchor
23 3 * * 0   backup  eyg  node /srv/eyg/scripts/db-backup.mjs --label=weekly >> /var/log/eyg/backup.log 2>&1
```

```bash
chmod 644 /etc/cron.d/eyg-backup
```

### 4.3 On Vercel

`/api/cron/backup` runs at 02:13 and calls the same script. It needs
`BACKUP_PASSPHRASE` set as a masked secret in the `production` environment.

**Vercel's filesystem is ephemeral and has no persistence plan.** A dump written
to the local disk disappears with the function. It must be uploaded to object
storage inside the same invocation, or it does not exist. See
[RUNBOOK.md](RUNBOOK.md) §9.

### 4.4 Retention

`db-backup.mjs` enforces it automatically:

| Tier | Count | Implementation |
| --- | --- | --- |
| Daily | 7 | The 7 most recent dumps. |
| Weekly | 4 | The newest dump in each of the 4 most recent ISO weeks. |
| Unclassified | `--retention` days, default 14 | Everything inside the window. |
| Minimum floor | **90 days** | Hard-coded. `--retention` cannot go below it. |
| Labelled dumps | Forever | `--label=` dumps are decision records and are never pruned. |

Three safety rails that cannot be configured off:

1. The newest dump is never pruned.
2. Nothing from the last 90 days is pruned.
3. A labelled dump is never pruned.

**Pruning is a destructive operation. It is not reversible. Read the output
before you accept it:**

```bash
node scripts/db-backup.mjs --list
node scripts/db-backup.mjs --dry-run      # shows what it WOULD delete
```

---

## 5. What a backup looks like

```
/var/backups/eyg/
├── eyg-2026-03-01_02-17-00.dump.enc        # the encrypted payload
├── eyg-2026-03-01_02-17-00.dump.enc.sha256 # checksum of the ciphertext
├── eyg-2026-03-01_02-17-00.dump.enc.json   # manifest
└── PRE_RESTORE_2026-03-08_14-02-11.dump     # taken by db-restore before it touches anything
```

### The encryption format

Self-describing, so a restore never needs out-of-band information:

```
EYGBACKUP1
salt=<base64>
iv=<base64>
tag=<base64>
plain_sha256=<hex of the UNENCRYPTED dump>
plain_bytes=<n>
---
<ciphertext>
```

| Property | Value |
| --- | --- |
| Cipher | AES-256-GCM |
| KDF | scrypt, N=16384, r=8, p=1 |
| Salt | 16 random bytes, **per backup** |
| IV | 12 random bytes, per backup |
| Auth tag | 16 bytes — a wrong passphrase fails loudly, it does not decrypt garbage |

AES-GCM is authenticated: a truncated or tampered file fails to decrypt with a
clear error rather than restoring a corrupted database. That is the entire
reason to use GCM over AES-CBC here.

### The manifest

```json
{
  "name": "eyg-2026-03-01_02-17-00.dump.enc",
  "createdAt": "2026-03-01T02:17:00.000Z",
  "label": null,
  "encrypted": true,
  "cipher": "aes-256-gcm",
  "kdf": "scrypt(N=16384,r=8,p=1)",
  "plainSha256": "9f2c…",
  "plainBytes": 8123456,
  "cipherBytes": 8124001,
  "format": "pg_dump custom",
  "tool": "scripts/db-backup.mjs"
}
```

`plainSha256` is the checksum of the *unencrypted* dump. It survives encryption,
so a restore can prove the payload is the one that was backed up.

---

## 6. The restore drill

> **A backup you have never restored is a hypothesis.**
>
> Run this **monthly**, in the first week. It takes about 15 minutes and it is
> the only thing in this document that proves any of the rest is true.

### 6.1 The drill

```bash
# 1. Create a scratch database
docker compose exec postgres createdb -U eyg eyg_restore_drill

# 2. Look at what you are about to restore
node scripts/db-restore.mjs --latest --dir=/var/backups/eyg --list-only

# 3. Dry run — decrypts and describes, writes nothing
BACKUP_PASSPHRASE_FILE=/etc/eyg/backup.key \
  node scripts/db-restore.mjs --latest --dir=/var/backups/eyg \
    --target=postgresql://eyg:eyg_dev_password@localhost:5432/eyg_restore_drill \
    --dry-run

# 4. Restore for real
BACKUP_PASSPHRASE_FILE=/etc/eyg/backup.key \
  node scripts/db-restore.mjs --latest --dir=/var/backups/eyg \
    --target=postgresql://eyg:eyg_dev_password@localhost:5432/eyg_restore_drill

# 5. Read the VERIFY block. It prints:
#      bookings   142
#      tables     24
#      newest     2026-03-01T04:00:00+08:00
#    If `tables` is under 10 the dump is partial. If `bookings` is 0 on a
#    database that should have history, stop.

# 6. Confirm with SQL — do not trust the summary alone
docker compose exec postgres psql -U eyg -d eyg_restore_drill -c \
  'SELECT reference, "customerName", "startAt" FROM "Booking" ORDER BY "startAt" DESC LIMIT 5;'

docker compose exec postgres psql -U eyg -d eyg_restore_drill -c \
  'SELECT count(*) FROM "Booking" WHERE status = '"'"'CONFIRMED'"'"' AND "startAt" > now();'

# 7. Drop the drill database
docker compose exec postgres dropdb -U eyg eyg_restore_drill

# 8. Record the result
echo "Drill $(date -I) — PASS — 142 bookings, 24 tables, restored in 42s" >> /var/log/eyg/restore-drills.log
```

### 6.2 What the drill is actually testing

| Step | What a failure means |
| --- | --- |
| The dump exists | The cron is not running. Everything else is irrelevant. |
| It decrypts | The passphrase is wrong, or the file is corrupt. |
| `pg_restore` succeeds | The dump format or the schema is inconsistent. |
| The booking count is right | **The backup is complete.** This is the assertion that matters. |
| The newest booking date is plausible | Silent truncation. A restore that "succeeded" but is three weeks stale is worse than a loud failure. |
| The table count is ≥ 10 | A partial restore. |

### 6.3 Restore-drill log

Keep it. "We have backups" is a claim; a dated log is evidence.

```
2025-11-03 — PASS — 87 bookings, 24 tables, 38s
2025-12-01 — PASS — 104 bookings, 24 tables, 41s
2026-01-05 — PASS — 119 bookings, 24 tables, 40s
2026-02-02 — FAIL — passphrase file missing on the runner. Fixed, re-ran, PASS.
2026-03-01 — PASS — 142 bookings, 24 tables, 42s
```

A FAIL is the most useful line in the file. It means the drill caught a real
problem while it was still hypothetical.

---

## 7. Handling database loss without losing bookings

The export-first policy, in full.

### 7.1 Before anything risky

Before a migration, before a deploy you are unsure about, before touching
production data manually, before any change you cannot reverse:

```bash
node scripts/db-backup.mjs --label=before-whatever-i-am-about-to-do
node scripts/db-restore.mjs --latest --dir=/var/backups/eyg --list-only
```

The label makes it a permanent, unprunable decision record. Two minutes, every
time.

### 7.2 When the database is gone

**The order is not negotiable.**

```bash
# 1. STOP. Do not run migrate deploy. Do not run db push. Do not start the app.
#    A booting app against an empty database will run its migrations and create
#    an empty schema, which is then a migration conflict when you try to restore.

# 2. Provision a NEW empty database. Do not reuse the broken instance.
#    If the instance is corrupted, restoring into it can fail halfway and leave
#    you with neither the old data nor the new.

# 3. Find the newest dump you can actually READ
node scripts/db-backup.mjs --list --dir=/var/backups/eyg

# 4. Restore
BACKUP_PASSPHRASE_FILE=/etc/eyg/backup.key \
  node scripts/db-restore.mjs \
    --file=eyg-2026-03-01_02-17-00.dump.enc \
    --dir=/var/backups/eyg \
    --target=postgresql://user:pass@NEW-HOST:5432/eyg \
    --confirm=<the count it printed in the dry run> \
    --cleanup

# 5. Verify BEFORE pointing the site at it
#    - Booking count matches
#    - Newest booking date is what you expect
#    - Table count >= 10
#    - Spot-check a customer's details against what you remember

# 6. Only now: point DATABASE_URL at the new database and redeploy.

# 7. THEN reconcile by hand.
```

### 7.3 The window you cannot close

Between the last backup and the failure, some bookings exist only in a customer's
memory and on a phone call. **This is what the 1-hour RPO bounds.**

Reconcile:

```sql
-- What was in the last backup
SELECT MAX("createdAt") AS last_known FROM "Booking";
```

Then ask the owner for anything after that time. The SMS confirmation contains
the reference (`EYG-XXXXXX`), so a customer with a text message is a booking you
can reconstruct exactly. Ask for the reference, not for the personal details —
less to write down, less to store.

Reconstruct with `channel = PHONE`, and a `BookingEvent` with a note saying it
was reconstructed. Honest history beats tidy history.

### 7.4 Do not use `prisma migrate reset`

```bash
npx prisma migrate reset    # ❌ drops the schema and re-seeds. Data loss.
```

If migrations are genuinely out of sync and you have a verified backup, the
correct path is a **baseline**, not a reset:

```bash
# 1. Restore to a scratch database first. Verify. Then:
# 2. On the real database:
npx prisma migrate resolve --applied 0_init          # or the specific migration
npx prisma migrate resolve --applied 20260301120000_add_tyre_size
npx prisma migrate status
```

Procedure in [DEPLOYMENT.md](DEPLOYMENT.md) §6.4.

### 7.5 If the backups are also gone

1. **Stop.** Everything else is a guess.
2. Provider-level snapshots: Neon, Supabase and RDS all keep them, and they are
   usually faster than your own backups. Check before assuming.
3. The provider's own PITR, if it was enabled.
4. **Then** accept the loss and reconstruct what you can. This is why the
   customer reference appears in the SMS: it is the only durable link between a
   booking and a person.

### 7.6 A leak, not a loss

If a dump containing customer PII is exposed (committed to a repo, sent to the
wrong person), that is a **breach**, not a restore problem. See
[INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) §SEV1-SEC.

---

## 8. `PII_ENCRYPTION_KEY` and restoring

Restoring a database whose PII columns were encrypted with a key you no longer
have gives you a schema full of ciphertext. The booking metadata survives; the
names, phones and vehicle details do not.

**If the key is lost:**

- The data is not recoverable by any means. There is no backdoor in AES.
- The bookings are still *countable* and their *dates* are still there, so the
  business can still run.
- Reconstruct contact details from SMS confirmations where customers have them.

**Before rotating the key:**

```bash
# 1. Back up first. Always.
node scripts/db-backup.mjs --label=before-pii-key-rotation

# 2. Confirm you have the PHYSICAL copy of the current key, not just the
#    environment variable.

# 3. Rotate.
# 4. Re-encrypt. This requires a migration that reads with the old key and
#    writes with the new one — coordinate with the backend agent.
# 5. Verify by reading a known row back.
```

**Store the key physically.** See [DEPLOYMENT.md](DEPLOYMENT.md) §4.5.

---

## 9. Verifying integrity

```bash
# Checksum every dump
node scripts/db-backup.mjs --verify --dir=/var/backups/eyg

# Confirm the newest dump is recent enough
node scripts/db-backup.mjs --list --dir=/var/backups/eyg
```

**Expected:** the newest dump is under 25 hours old, and every `ok`.

**A dump that fails its checksum is worse than no dump**, because a monitoring
system that reports "backups are fine" while the bytes are corrupt is lying. If
`--verify` fails, treat the backup as failed and find out why before the next
cycle.

### Alert on backup failure

The single most important alert in this system. A booking is a promise; the
backup is the only way to keep it if the database disappears.

```yaml
# Suggested rule — see OBSERVABILITY.md §5
- alert: BackupStale
  expr: time() - eyg_backup_last_success_timestamp_seconds > 90000  # 25 hours
  for: 1h
  labels:
    severity: page

- alert: BackupFailed
  expr: eyg_backup_failures_total > 0
  labels:
    severity: page
```

Until that exists, check manually — §10.

---

## 10. Manual backup checklist

Until automated alerting is configured, this is a human check. Once a week:

```bash
node scripts/db-backup.mjs --list                 # newest is under 25h old?
node scripts/db-backup.mjs --verify               # everything matches?
```

Once a month:

- [ ] The full restore drill (§6.1)
- [ ] `tail -5 /var/log/eyg/backup.log` — no silent failures
- [ ] Off-site copy: does the newest dump actually exist there?
- [ ] The passphrase envelope still exists and still works
- [ ] The retention window is behaving — not 400 dumps, not 3

---

## 11. Quick reference

```bash
# Back up
BACKUP_PASSPHRASE_FILE=/etc/eyg/backup.key node scripts/db-backup.mjs
node scripts/db-backup.mjs --label=before-the-price-change

# List / verify
node scripts/db-backup.mjs --list
node scripts/db-backup.mjs --verify

# Restore to a scratch database (the drill)
node scripts/db-restore.mjs --latest \
  --target=postgresql://eyg:pw@localhost:5432/eyg_restore_drill \
  --cleanup

# Restore production (refuses without the double flag)
node scripts/db-restore.mjs --latest \
  --target="$DATABASE_URL" --confirm=<count> --i-know-what-i-am-doing
```

**Exit codes:** `0` success · `1` failure · `2` refused (production target, no
`--target`, missing passphrase).

---

## Related

| Document | Read it when |
| --- | --- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Migrations, environment variables |
| [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | A leaked secret, a lost database |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Setting up the backup alert |
| [RUNBOOK.md](RUNBOOK.md) | Exporting bookings |
