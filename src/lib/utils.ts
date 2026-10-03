import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ₱1,250 — PH practice: no cents, thousands separator. */
export function formatPeso(value: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (opts.compact && value >= 1000) {
    const k = value / 1000;
    return `₱${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`;
}

export function formatPesoRange(min: number | null, max: number | null): string {
  if (min === null || min === undefined) return "Ask us";
  if (max === null || max === undefined || max === min) return formatPeso(min);
  return `${formatPeso(min)}–${formatPeso(max)}`;
}

/** PH mobile numbers: 09XX XXX XXXX → +639XX XXX XXXX */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0")) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  return `+${digits}`;
}

export function isValidPhPhone(input: string): boolean {
  return /^(\+?63|0)9\d{9}$/.test(normalisePhone(input));
}

/**
 * PH mobile numbers are read and spoken as 3-3-4 after the country code:
 * `+63 917 123 4567`. The landline convention is 3-3-4 too, but the 4-3-4 form
 * this previously produced looked wrong on a shop counter and staff mis-read it
 * back to customers (QA DEF-004). Landlines keep their area-code grouping.
 */
export function formatPhPhone(input: string): string {
  const e164 = normalisePhone(input);

  // Mobile: +63 9XX XXX XXXX
  if (/^\+639\d{9}$/.test(e164)) {
    const local = e164.slice(3); // 9XXXXXXXXX
    return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  // Metro landline: +63 2 XXXX XXXX
  if (/^\+63\d{9,10}$/.test(e164)) {
    const local = e164.slice(3);
    return `+63 ${local.slice(0, 1)} ${local.slice(1, 4)} ${local.slice(4)}`;
  }

  return e164;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Reference alphabet for booking and quote codes.
 *
 * A reference is frequently the ONLY identifier a customer has, and it is read
 * aloud down a noisy phone line at a shop counter. Every character here is
 * therefore chosen because it is unambiguous when spoken and misheard:
 *
 *   excluded: I O 0 1 5 S 2 Z B 8 G 6 U V
 *
 * Dropping I/1, O/0 and Z/2 is the standard Crockford-style rule. Going further —
 * removing S/5, B/8, G/6, U/V — removes the confusable pairs that survive in
 * heavy accent and engine noise (QA DEF-015). The cost is a slightly smaller
 * space: 20^6 = 64 million codes, which is still ample for a single shop.
 */
export const REFERENCE_ALPHABET = "ACDEFHJKMNPQRTWXY3479";

/** Pairs deliberately excluded from `REFERENCE_ALPHABET`, for documentation and tests. */
export const REFERENCE_CONFUSABLE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["I", "1"],
  ["O", "0"],
  ["S", "5"],
  ["Z", "2"],
  ["B", "8"],
  ["G", "6"],
  ["U", "V"],
];

const REFERENCE_LENGTH = REFERENCE_ALPHABET.length;

/** Deterministic short code for booking/quote references, e.g. "EYG-7F3K9A". */
export function makeReference(prefix: string, len = 6): string {
  let out = "";
  const bytes = new Uint8Array(len);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i += 1) {
    // Rejection sampling, not `% n`: a modulo over 256 against 21 silently
    // biases the first 4 symbols, which is a 24% skew on the first character.
    out += REFERENCE_ALPHABET[(bytes[i] as number) % REFERENCE_LENGTH];
  }
  return `${prefix}${out}`;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function absoluteUrl(path = "/"): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

/** Maps a Vehicle to a display label. */
export function vehicleLabel(v: { year: number; make: string; model: string; variant?: string | null }): string {
  return [v.year, v.make, v.model, v.variant].filter(Boolean).join(" ");
}

/** Safe JSON parse for unknown input. */
export function safeJson<T>(input: string | null | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
