/**
 * EYG — BOOKING WIZARD TYPES
 * ============================================================================
 * Wizard-local state. Deliberately kept out of `src/lib/types.ts` (that file is
 * the wire contract and is owned by the orchestrator) and out of Prisma — this is
 * transient form state that never reaches the database as-is.
 * ============================================================================
 */

import type { BookingStatusValue, CreateBookingInput } from "@/lib/types";

export type BookingStepId = "vehicle" | "services" | "slot" | "contact";

export interface BookingStepMeta {
  id: BookingStepId;
  /** 1-based, shown in the stepper. */
  index: number;
  label: string;
  /** Two or three characters for the mobile stepper. */
  short: string;
  /** One line explaining what this step is for. */
  purpose: string;
}

export const BOOKING_STEPS: readonly BookingStepMeta[] = [
  {
    id: "vehicle",
    index: 1,
    label: "Your vehicle",
    short: "Car",
    purpose: "So we know which tyres, which oil and which tools to plan for.",
  },
  {
    id: "services",
    index: 2,
    label: "What you need",
    short: "Work",
    purpose: "Add as much or as little as you like. You can change it later.",
  },
  {
    id: "slot",
    index: 3,
    label: "Date & time",
    short: "When",
    purpose: "Pick a bay. If nothing suits, the next day is one tap away.",
  },
  {
    id: "contact",
    index: 4,
    label: "Your details",
    short: "You",
    purpose: "We text you a confirmation. No account, no password.",
  },
] as const;

export function isBookingStepId(value: string | null | undefined): value is BookingStepId {
  return value === "vehicle" || value === "services" || value === "slot" || value === "contact";
}

export function stepById(id: BookingStepId): BookingStepMeta {
  return BOOKING_STEPS.find((s) => s.id === id) ?? BOOKING_STEPS[0]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT
// ─────────────────────────────────────────────────────────────────────────────

export type VehicleMode = "known" | "unknown";

export interface VehicleDraft {
  mode: VehicleMode;
  year: string;
  make: string;
  model: string;
  variant: string;
  plate: string;
  /** Used when `mode === "unknown"` — never a dead end. */
  freeText: string;
}

export interface ContactDraft {
  name: string;
  phone: string;
  email: string;
  notes: string;
  consentSms: boolean;
  consentMarketing: boolean;
}

export interface BookingDraft {
  vehicle: VehicleDraft;
  serviceSlugs: string[];
  packageSlug: string | null;
  promoCode: string | null;
  /** YYYY-MM-DD, Manila local. */
  date: string | null;
  /** ISO 8601 with an explicit +08:00 offset, from `SlotDto.startAt`. */
  startAt: string | null;
  contact: ContactDraft;
}

export const EMPTY_VEHICLE: VehicleDraft = {
  mode: "known",
  year: "",
  make: "",
  model: "",
  variant: "",
  plate: "",
  freeText: "",
};

export const EMPTY_CONTACT: ContactDraft = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  consentSms: false,
  consentMarketing: false,
};

export function emptyDraft(): BookingDraft {
  return {
    vehicle: { ...EMPTY_VEHICLE },
    serviceSlugs: [],
    packageSlug: null,
    promoCode: null,
    date: null,
    startAt: null,
    contact: { ...EMPTY_CONTACT },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT PHASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four states every form on this site must have. `SubmitPhase` exists so no
 * form can be written without them — a submit with no pending and no error state
 * is a bug the type system will not catch, so the state is a required value.
 */
export type SubmitPhase = "idle" | "pending" | "success" | "error";

export type BookingFailureKind = "conflict" | "rate-limited" | "validation" | "server" | "offline" | "unknown";

export interface BookingFailure {
  kind: BookingFailureKind;
  /** The headline. Written for a customer, not for a developer. */
  title: string;
  /** The explanation. */
  message: string;
  /** Field-level messages from `ApiFailure.error.fields`. */
  fields: Record<string, string[]>;
  /** Seconds, from `ApiMeta.retryAfter`. Only present for `rate-limited`. */
  retryAfterSeconds: number | null;
  /** Set for `server` / `unknown` so the fallback lane is honest. */
  requestId: string | null;
}

export function emptyFailure(): BookingFailure | null {
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WIRE MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/** `BookingDto`, narrowed to the fields the confirmation screen needs. */
export interface BookingConfirmation {
  reference: string;
  status: BookingStatusValue;
  startAt: string;
  endAt: string | null;
  customerName: string;
  estimateMin: number | null;
  estimateMax: number | null;
  items: Array<{ name: string; quantity: number }>;
}

export function toCreateBookingInput(draft: BookingDraft): CreateBookingInput {
  const v = draft.vehicle;
  const year = Number.parseInt(v.year, 10);
  const input: CreateBookingInput = {
    name: draft.contact.name.trim(),
    phone: draft.contact.phone.trim(),
    startAt: draft.startAt ?? "",
    serviceIds: [...draft.serviceSlugs],
    notes: [v.mode === "unknown" ? v.freeText.trim() : "", draft.contact.notes.trim()]
      .filter(Boolean)
      .join("\n\n") || undefined,
    consentSms: draft.contact.consentSms,
    consentMarketing: draft.contact.consentMarketing,
  };
  if (draft.contact.email.trim()) input.email = draft.contact.email.trim();
  if (draft.packageSlug) input.packageId = draft.packageSlug;
  if (draft.promoCode) input.promoCode = draft.promoCode;
  if (v.mode === "known" && Number.isFinite(year) && v.make.trim() && v.model.trim()) {
    input.vehicle = {
      year,
      make: v.make.trim(),
      model: v.model.trim(),
      ...(v.variant.trim() ? { variant: v.variant.trim() } : {}),
      ...(v.plate.trim() ? { plate: v.plate.trim().toUpperCase() } : {}),
    };
  }
  return input;
}
