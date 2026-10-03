/**
 * STRUCTURED LOGGER
 * ============================================================================
 * One JSON object per line. Designed for a Node process (Next.js route handlers,
 * cron jobs, webhooks). No dependency on any server module so it can be unit
 * tested in isolation.
 *
 * Guarantees
 * ----------
 * - `redact()` strips anything that looks like a phone number, email address,
 *   bearer/basic token, cookie or `Authorization` header before a value is
 *   ever serialised.
 * - Never logs a full request body — callers pass narrow field objects, and
 *   `SENSITIVE_KEY_RE` force-redacts whole keys regardless of their value.
 * - Every line is correlated with the incoming `x-request-id`. Next 15 makes
 *   `headers()` async, so `requestIdFromHeaders()` awaits it defensively and
 *   falls back to a generated id when called outside a request scope.
 * - Never throws. A logging failure must not take a booking down.
 *
 * `LOG_LEVEL` (debug | info | warn | error | silent) is read on every call so
 * tests can flip it at runtime.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED = "[redacted]";
const MAX_STRING = 256;
const MAX_DEPTH = 5;

/** Keys whose value is always secret, whatever it looks like. */
const SENSITIVE_KEY_RE =
  /(^|[^a-z])(pass(word|phrase)?|secret|token|api[-_]?key|apikey|auth|authorization|cookie|session|otp|pin|cvv|signature|credential|private[-_]?key|encryption[-_]?key|bearer|refresh|jwt)([^a-z]|$)/i;

/** Keys that hold PII and should be masked rather than dropped. */
const PII_KEY_RE = /(^|[^a-z])(phone|mobile|tel|msisdn|email|e-?mail|address|street|plate|vin|name)([^a-z]|$)/i;

/** Bare secrets: 32+ chars of hex / base64url. */
const LONG_SECRET_RE = /\b[A-Fa-f0-9]{32,}\b|\b[A-Za-z0-9_-]{40,}\b/g;

/** `Authorization: Bearer abc`, `Basic abc`, standalone `Bearer abc`. */
const AUTH_SCHEME_RE = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

/** Pragmatic email matcher — good enough to scrub logs. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * A phone-ish run. Anchored so it cannot eat part of a word, and protected
 * against ISO-8601 timestamps by `protectIso()` below.
 */
const PHONE_RE = /(?<![A-Za-z0-9_@$.-])(\+?\d[\d\s().-]{6,}\d)(?![A-Za-z0-9_@-])/g;

const ISO_RE = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g;

// ── Pure helpers (unit-testable, no I/O) ─────────────────────────────────────

function truncateString(value: string, max = MAX_STRING): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(+${value.length - max})`;
}

/**
 * Removes ISO-8601 date/times from a string so the phone heuristic cannot
 * mistake `2026-10-02` for a phone number.
 */
export function protectIso(value: string): { text: string; restore: (s: string) => string } {
  const held: string[] = [];
  const text = value.replace(ISO_RE, (m) => {
    held.push(m);
    return `\u0000${held.length - 1}\u0000`;
  });
  return {
    text,
    restore: (s: string) => s.replace(/\u0000(\d+)\u0000/g, (m, n: string) => held[Number(n)] ?? m),
  };
}

/** Redacts PII and secrets inside a single string. */
export function redactString(input: string): string {
  if (input.length === 0) return input;
  const iso = protectIso(input);
  let out = iso.text;
  out = out.replace(AUTH_SCHEME_RE, (_m, scheme: string) => `${scheme} ${REDACTED}`);
  out = out.replace(EMAIL_RE, `[redacted:email]`);
  out = out.replace(PHONE_RE, `[redacted:phone]`);
  out = out.replace(LONG_SECRET_RE, `[redacted:secret]`);
  out = out.replace(/\b(eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,})\b/g, `[redacted:jwt]`);
  return truncateString(iso.restore(out));
}

/**
 * Deep-redacts an arbitrary value. Handles objects, arrays, `Map`, `Set`,
 * `Date`, `Error`, `BigInt`, and cycles. Never throws.
 */
export function redactValue(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value ?? null;

  switch (typeof value) {
    case "string":
      return redactString(value);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "bigint":
      return `${value.toString()}n`;
    case "boolean":
      return value;
    case "function":
      return "[redacted:function]";
    case "symbol":
      return value.toString();
    default:
      break;
  }

  const obj = value as object;
  if (seen.has(obj)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[depth-limit]";
  seen.add(obj);

  try {
    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof Error) {
      return { name: obj.name, message: redactString(obj.message) };
    }
    if (obj instanceof Map) {
      const out: Record<string, unknown> = {};
      let i = 0;
      for (const [k, v] of obj) {
        out[String(k).slice(0, 64) || `key${i}`] = redactValue(v, depth + 1, seen);
        i += 1;
      }
      return out;
    }
    if (obj instanceof Set) {
      return [...obj].map((v) => redactValue(v, depth + 1, seen));
    }
    if (Array.isArray(obj)) {
      const head = obj.slice(0, 25).map((v) => redactValue(v, depth + 1, seen));
      return obj.length > 25 ? [...head, `…(+${obj.length - 25})`] : head;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) out[k] = REDACTED;
      else if (PII_KEY_RE.test(k) && typeof v === "string") out[k] = maskPiiString(k, v);
      else out[k] = redactValue(v, depth + 1, seen);
    }
    return out;
  } catch {
    return "[unserialisable]";
  } finally {
    seen.delete(obj);
  }
}

/**
 * Keeps a PII string useful for support (last 2 digits of a phone) without
 * leaking it. Emails become `j***@e***.ph`.
 */
export function maskPiiString(key: string, value: string): string {
  if (EMAIL_RE.test(value)) {
    EMAIL_RE.lastIndex = 0;
    return value.replace(EMAIL_RE, (m) => {
      const at = m.indexOf("@");
      if (at <= 0) return REDACTED;
      const local = m.slice(0, at);
      const domain = m.slice(at + 1);
      const dot = domain.lastIndexOf(".");
      const tld = dot > 0 ? domain.slice(dot) : "";
      return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${domain.slice(0, 1)}${"*".repeat(
        Math.max(2, dot > 0 ? dot - 1 : 3),
      )}${tld}`;
    });
  }
  if (PHONE_RE.test(value)) {
    PHONE_RE.lastIndex = 0;
    return value.replace(PHONE_RE, (m) => `[phone…${m.replace(/\D/g, "").slice(-2)}]`);
  }
  return `${value.slice(0, 1)}${"*".repeat(Math.max(2, value.length - 1))}${value.slice(-1)}`;
}

/** Redacts a flat field bag, preserving key names. Always returns a new object. */
export function redactFields(fields: LogFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactValue(v);
  }
  return out;
}

// ── Level handling ───────────────────────────────────────────────────────────

export function parseLogLevel(raw: string | undefined): LogLevel | "silent" {
  const v = (raw ?? "info").trim().toLowerCase();
  if (v === "silent" || v === "off" || v === "none") return "silent";
  if (v === "warn" || v === "warning") return "warn";
  if (v === "error" || v === "fatal") return "error";
  if (v === "debug" || v === "trace" || v === "verbose") return "debug";
  return "info";
}

export function currentLogLevel(): LogLevel | "silent" {
  try {
    return parseLogLevel(process.env.LOG_LEVEL);
  } catch {
    return "info";
  }
}

export function shouldLog(level: LogLevel, min: LogLevel | "silent"): boolean {
  if (min === "silent") return false;
  return LEVEL_ORDER[level] >= LEVEL_ORDER[min];
}

// ── Request correlation ──────────────────────────────────────────────────────

interface RequestStore {
  requestId: string;
}

const requestStore = new AsyncLocalStorage<RequestStore>();

/** Runs `fn` with a correlation id attached to every log line it emits. */
export function withRequestContext<T>(requestId: string, fn: () => T): T {
  return requestStore.run({ requestId }, fn);
}

/** Correlation id of the in-flight request, or `undefined` outside a request. */
export function currentRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}

/** Generates a short, sortable, URL-safe id. */
export function newRequestId(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuv";
  const bytes = new Uint8Array(16);
  try {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
  } catch {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const time = Date.now().toString(36);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += alphabet[(bytes[i] as number) % alphabet.length];
  return `${time}-${out}`;
}

/**
 * Reads `x-request-id` from the incoming request. `headers()` is async in
 * Next 15 and throws outside a request scope, so this is fully guarded.
 */
export async function requestIdFromHeaders(): Promise<string> {
  try {
    const mod = await import("next/headers");
    const h = await mod.headers();
    const v = h.get("x-request-id");
    if (v && v.length > 0 && v.length <= 128 && /^[\w.:-]+$/.test(v)) return v;
  } catch {
    // not in a request scope (cron, script, unit test) — fall through
  }
  return newRequestId();
}

/** Convenience: derive the id, set the context, and run `fn` inside it. */
export async function withIncomingRequest<T>(fn: (requestId: string) => Promise<T>): Promise<T> {
  const requestId = await requestIdFromHeaders();
  return withRequestContext(requestId, () => fn(requestId));
}

// ── The logger ───────────────────────────────────────────────────────────────

function serialiseError(error: unknown): unknown {
  if (error === null || error === undefined) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactString(error.message),
      ...(typeof error.cause === "string" ? { cause: redactString(error.cause) } : {}),
    };
  }
  return redactValue(error);
}

export interface LogMeta {
  requestId?: string;
  /** Route or module the line came from, e.g. "api/leads". */
  scope?: string;
  durationMs?: number;
  err?: unknown;
}

export interface Logger {
  debug(event: string, fields?: LogFields, meta?: LogMeta): void;
  info(event: string, fields?: LogFields, meta?: LogMeta): void;
  warn(event: string, fields?: LogFields, meta?: LogMeta): void;
  error(event: string, fields?: LogFields, meta?: LogMeta): void;
  /** Returns a logger that merges `base` into every line. */
  child(base: LogFields): Logger;
  /** Pure formatter — exposed for tests. */
  format(level: LogLevel, event: string, fields?: LogFields, meta?: LogMeta): string;
}

function write(level: LogLevel, line: string): void {
  try {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } catch {
    /* logging must never throw */
  }
}

export function createLogger(base: LogFields = {}, baseMeta: LogMeta = {}): Logger {
  const format: Logger["format"] = (level, event, fields, meta) => {
    const merged: LogFields = { ...base, ...(fields ?? {}) };
    const redacted = redactFields(merged);
    const payload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      event,
      ...(baseMeta.scope ? { scope: baseMeta.scope } : {}),
      requestId: meta?.requestId ?? baseMeta.requestId ?? currentRequestId() ?? "system",
      ...redacted,
    };
    if (meta?.durationMs !== undefined) payload["durationMs"] = Math.round(meta.durationMs);
    const err = serialiseError(meta?.err);
    if (err !== undefined) payload["err"] = err;
    try {
      return JSON.stringify(payload);
    } catch {
      return JSON.stringify({ ts: payload["ts"], level, event, note: "unserialisable-fields" });
    }
  };

  const emit = (level: LogLevel) => (event: string, fields?: LogFields, meta?: LogMeta): void => {
    try {
      if (!shouldLog(level, currentLogLevel())) return;
      write(level, format(level, event, fields, meta));
    } catch {
      /* never throw */
    }
  };

  return {
    format,
    debug: emit("debug"),
    info: emit("info"),
    warn: emit("warn"),
    error: emit("error"),
    child: (extra: LogFields) => createLogger({ ...base, ...extra }, baseMeta),
  };
}

/** Process-wide default logger. */
export const log: Logger = createLogger({}, { scope: "app" });

/**
 * Alias kept for callers that prefer the noun form
 * (`import { logger } from "@/lib/logger"`). Same instance.
 */
export const logger: Logger = log;

/** Scoped logger factory: `const log = scoped("api/leads")`. */
export function scoped(scope: string, base: LogFields = {}): Logger {
  return createLogger(base, { scope });
}
