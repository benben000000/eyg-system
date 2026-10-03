/**
 * PII ENCRYPTION AT REST (AES-256-GCM, auth-style envelope)
 * ============================================================================
 * The `Lead` sink stores names, phone numbers, emails and message bodies. Those
 * columns are encrypted with `PII_ENCRYPTION_KEY` before they hit Postgres.
 *
 * Envelope format (self-describing, so a row can be detected and decrypted
 * without out-of-band metadata):
 *
 *     pii.v1.<iv-b64url>.<tag-b64url>.<ciphertext-b64url>
 *
 * `tag` is kept separate from the ciphertext — the "auth" style, i.e. the
 * GCM authentication tag is not prepended to the ciphertext. That lets us fail
 * closed on tampering instead of silently decrypting to garbage.
 *
 * Key handling
 * ------------
 * - Accepted: 64 hex chars, base64 of 32 bytes, or a 32-byte UTF-8 string.
 * - Any other length throws `PiiKeyError`. A wrong-length key is a config bug
 *   and must not degrade to "unencrypted" silently.
 * - **Key absent in development** → `encryptPii` is a no-op passthrough (the
 *   site must be usable with a blank `.env.local`), logged once per process.
 * - **Key absent in production** → also a passthrough so the site stays up,
 *   but logged at `error` on every call. The operator sees it in the log
 *   stream; the site does not go down. This is called out as an owner action
 *   item in `docs/ops/INTEGRATIONS.md`.
 *
 * Deterministic search on encrypted columns is intentionally NOT supported
 * (AES-GCM is randomised). If a unique lookup on a phone number is ever needed,
 * store a keyed HMAC `phone_hash` column alongside.
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { log } from "@/lib/logger";
import { isProduction, piiEncryptionKey } from "./env";

const logger = log.child({ scope: "integrations/crypto" });

const ALGORITHM = "aes-256-gcm";
const PREFIX = "pii.v1";
const IV_BYTES = 12; // 96-bit nonce, the GCM-recommended size
const KEY_BYTES = 32;

export class PiiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PiiKeyError";
  }
}

let warnedPassthrough = false;
let cachedKey: Buffer | null | undefined;

const b64url = (buf: Buffer): string => buf.toString("base64url");

/** Decodes `PII_ENCRYPTION_KEY` into 32 raw bytes, or `null` when unset. */
export function resolvePiiKey(raw: string | undefined = piiEncryptionKey()): Buffer | null {
  if (!raw) return null;
  const value = raw.trim();

  if (/^[A-Fa-f0-9]{64}$/.test(value)) return Buffer.from(value, "hex");

  if (/^[A-Za-z0-9+/=_-]+$/.test(value) && value.length >= 40) {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === KEY_BYTES) return decoded;
  }

  const utf8 = Buffer.from(value, "utf8");
  if (utf8.length === KEY_BYTES) return utf8;

  throw new PiiKeyError(
    `PII_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (64 hex chars, or base64 of 32 bytes). Got ${utf8.length} bytes.`,
  );
}

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  try {
    cachedKey = resolvePiiKey();
  } catch (error) {
    logger.error("pii.invalid_key", {}, { err: error });
    cachedKey = null;
  }
  return cachedKey;
}

/** True when PII is genuinely encrypted (not passing through). */
export function isPiiEncryptionActive(): boolean {
  return getKey() !== null;
}

/** Test/rotation hook — forget the memoised key. */
export function resetPiiKeyCache(): void {
  cachedKey = undefined;
}

function notePassthrough(event: string): void {
  if (isProduction()) {
    logger.error("pii.passthrough_in_production", {
      event,
      action: "set PII_ENCRYPTION_KEY — PII is being stored in cleartext",
    });
  } else if (!warnedPassthrough) {
    warnedPassthrough = true;
    logger.warn("pii.passthrough_in_development", {
      event,
      note: "PII_ENCRYPTION_KEY is not set; values are stored in cleartext (dev only)",
    });
  }
}

/** True when `value` looks like one of our envelopes. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}.`) && value.split(".").length === 5;
}

/**
 * Encrypts a single value.
 *
 * Returns the input unchanged when no key is configured (see header). Empty
 * input returns empty input — do not turn `null` into a ciphertext.
 */
export function encryptPii(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return plain ?? null;
  if (isEncrypted(plain)) return plain;

  const key = getKey();
  if (!key) {
    notePassthrough("encrypt");
    return plain;
  }

  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [PREFIX, b64url(iv), b64url(tag), b64url(ct)].join(".");
  } catch (error) {
    // Fail closed for a *write*: a corrupt key must not silently persist
    // cleartext PII into a column that a reader will trust as ciphertext.
    logger.error("pii.encrypt_failed", { action: "value NOT stored" }, { err: error });
    throw error;
  }
}

/** Encrypts each field, dropping empty entries. */
export function encryptPiiFields<T extends Record<string, string | null | undefined>>(fields: T): T {
  const out = { ...fields };
  for (const key of Object.keys(out) as Array<keyof T>) {
    const v = out[key];
    if (typeof v === "string") {
      out[key] = encryptPii(v) as T[keyof T];
    }
  }
  return out;
}

/**
 * Decrypts a value. Plaintext input (no key when it was written, or a
 * pre-encryption row) is returned as-is, which keeps older rows readable
 * after the key is added.
 */
export function decryptPii(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return value ?? null;
  if (!isEncrypted(value)) return value;

  const key = getKey();
  if (!key) {
    notePassthrough("decrypt");
    return value;
  }

  const parts = value.split(".");
  const ivPart = parts[2];
  const tagPart = parts[3];
  const ctPart = parts[4];
  if (!ivPart || !tagPart || !ctPart) {
    logger.error("pii.malformed_envelope", {});
    return null;
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ctPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext. Never surface the ciphertext.
    logger.error("pii.decrypt_failed", { note: "wrong key or tampered value" });
    return null;
  }
}

export function decryptPiiFields<T extends Record<string, string | null | undefined>>(fields: T): T {
  const out = { ...fields };
  for (const key of Object.keys(out) as Array<keyof T>) {
    const v = out[key];
    if (typeof v === "string") {
      out[key] = decryptPii(v) as T[keyof T];
    }
  }
  return out;
}

/**
 * Keyed, non-reversible lookup hash for a normalised value. Lets us answer
 * "have we already messaged this number?" without storing a searchable
 * plaintext column. Not a substitute for encryption.
 */
export function blindIndex(value: string, raw: string | undefined = piiEncryptionKey()): string {
  const key = resolvePiiKey(raw);
  if (!key) return "";
  return createHmac("sha256", key).update(value.trim().toLowerCase(), "utf8").digest("base64url");
}

/** Constant-time string comparison. Length differences are not secret here. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Still burn a comparison so the timing profile is flat.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
