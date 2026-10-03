/**
 * EYG — BOOKING STEP 4: CONTACT & CONFIRM
 * ============================================================================
 * Name, PH phone, optional email, the vehicle summary, notes, and the consent
 * checkboxes — with the consent copy written out **in full readable English**.
 * "I agree" with the actual terms hidden is the single most common way a site
 * like this loses a booking at the last step, and it is not worth the conversion.
 *
 * Validation is PH-focused: `normalisePhone` / `isValidPhPhone` from
 * `@/lib/utils`, so `0917 123 4567`, `+639171234567` and `9171234567` all pass
 * and `12345` does not.
 * ============================================================================
 */

import * as React from "react";
import { isValidEmail, isValidPhPhone, normalisePhone, formatPhPhone } from "@/lib/utils";
import { BUSINESS, LINKS } from "@/config/site";
import { Checkbox, Field, Input, Textarea, describedBy } from "@/components/pages/_shims";
import { Check, MessageCircle, Phone, Send, ShieldCheck } from "@/components/pages/_icons";
import { PRIMARY_PHONE_UNCONFIRMED } from "@/components/pages/_shared";
import type { ContactDraft, VehicleDraft } from "@/components/pages/booking/types";
import { vehicleSummaryOf } from "@/components/pages/booking/VehicleStep";

export interface ContactStepProps {
  contact: ContactDraft;
  onChange: (next: ContactDraft) => void;
  vehicle: VehicleDraft;
  slotLabel: string | null;
  dateLabel: string | null;
  /** Honeypot: stays empty for humans. */
  website: string;
  onWebsiteChange: (v: string) => void;
  fieldErrors: Record<string, string[]>;
  pending: boolean;
  /** Disables the submit while a 429 countdown is running. */
  locked: boolean;
}

/** Local, live validation so the customer is not told what is wrong on submit. */
export function validateContactStep(contact: ContactDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (contact.name.trim().length < 2) {
    errors["name"] = "Please put a name we can call you by.";
  }
  if (!isValidPhPhone(contact.phone)) {
    errors["phone"] = "That does not look like a PH mobile number. Try 0917 123 4567.";
  }
  if (contact.email.trim() && !isValidEmail(contact.email)) {
    errors["email"] = "Check the email address — it looks incomplete.";
  }
  if (!contact.consentSms) {
    errors["consentSms"] =
      "We need your permission to text you the confirmation, otherwise the booking cannot be completed.";
  }
  return errors;
}

export function ContactStep({
  contact,
  onChange,
  vehicle,
  slotLabel,
  dateLabel,
  website,
  onWebsiteChange,
  fieldErrors,
  pending,
  locked,
}: ContactStepProps): React.ReactElement {
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const set = <K extends keyof ContactDraft>(key: K, v: ContactDraft[K]) =>
    onChange({ ...contact, [key]: v });

  const local = validateContactStep(contact);
  const errorFor = (key: string) => fieldErrors[key]?.[0] ?? (touched[key] ? local[key] : undefined);
  const blur = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  return (
    <fieldset disabled={pending} className="space-y-6">
      <legend className="sr-only">Your details</legend>

      {/* ── What happens next, stated plainly and up front ──────────────── */}
      <div className="flex gap-3 rounded-card border-2 border-pit-600 bg-pit-100 p-4 text-pit-900 dark:text-pit-100">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1.5 text-sm">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide">
            What happens after you press Confirm
          </p>
          <p>
            We will text you a confirmation within a minute, with your booking
            reference and the exact time. Nothing is charged now, and nothing is
            charged later without your approval at the counter.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="booking-name" label="Your name" required error={errorFor("name")}>
          <Input
            id="booking-name"
            name="name"
            autoComplete="name"
            enterKeyHint="next"
            value={contact.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={() => blur("name")}
            invalid={Boolean(errorFor("name"))}
            aria-describedby={describedBy("booking-name", { error: Boolean(errorFor("name")) })}
          />
        </Field>

        <Field
          htmlFor="booking-phone"
          label="Mobile number"
          required
          hint="PH mobile, e.g. 0917 123 4567. We text this number — it must be one you answer."
          error={errorFor("phone")}
        >
          <Input
            id="booking-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            placeholder="0917 123 4567"
            value={contact.phone}
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => blur("phone")}
            invalid={Boolean(errorFor("phone"))}
            aria-describedby={describedBy("booking-phone", { hint: true, error: Boolean(errorFor("phone")) })}
            className="tabular"
          />
        </Field>
      </div>

      {contact.phone.trim() && isValidPhPhone(contact.phone) ? (
        <p className="-mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Check aria-hidden="true" className="size-4 text-pit-500" />
          We will send the confirmation to{" "}
          <span className="tabular font-bold text-foreground">{formatPhPhone(contact.phone)}</span>
        </p>
      ) : null}

      <Field
        htmlFor="booking-email"
        label="Email"
        hint="Only if you would like a copy. We do not add you to anything without asking."
        error={errorFor("email")}
      >
        <Input
          id="booking-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="next"
          value={contact.email}
          onChange={(e) => set("email", e.target.value)}
          onBlur={() => blur("email")}
          invalid={Boolean(errorFor("email"))}
          aria-describedby={describedBy("booking-email", { hint: true, error: Boolean(errorFor("email")) })}
        />
      </Field>

      {/* ── Read-back of what they are booking ───────────────────────────── */}
      <div className="space-y-2 rounded-card border border-border bg-surface-muted p-4">
        <p className="eyg-eyebrow text-muted-foreground">Booking so far</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="font-bold">{vehicleSummaryOf(vehicle)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">When</dt>
            <dd className="font-bold">
              {dateLabel ? `${dateLabel}${slotLabel ? ` at ${slotLabel}` : ""}` : "Not chosen"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Not right? Use the step buttons above — nothing is lost by going back.
        </p>
      </div>

      <Field
        htmlFor="booking-notes"
        label="Anything we should know"
        hint="The noise it makes, the tyre size on your sidewall, when you are free to drop it off. Optional, and it genuinely helps."
      >
        <Textarea
          id="booking-notes"
          name="notes"
          rows={4}
          maxLength={600}
          value={contact.notes}
          onChange={(e) => set("notes", e.target.value)}
          aria-describedby={describedBy("booking-notes", { hint: true })}
          placeholder="Grinding when I brake below 40 km/h. Free all afternoon if it helps."
        />
        <p className="text-xs text-muted-foreground">{contact.notes.length}/600</p>
      </Field>

      {/* ── Consent, in full ─────────────────────────────────────────────── */}
      <fieldset className="space-y-4 rounded-card border-2 border-border-strong p-5">
        <legend className="px-1 font-display text-sm font-extrabold uppercase tracking-wide">
          Before you confirm
        </legend>

        <Checkbox
          name="consentSms"
          checked={contact.consentSms}
          required
          invalid={Boolean(errorFor("consentSms"))}
          onChange={(e) => set("consentSms", e.target.checked)}
          label="Yes, you may text me about this booking."
          description="We will send you a confirmation with the reference, the date and the time, and a reminder on the morning of your appointment. This is a transactional message about a booking you have asked us for — it is not marketing, and you can stop it at any time by replying STOP or asking us."
        />
        {errorFor("consentSms") ? (
          <p className="text-xs font-bold text-destructive">{errorFor("consentSms")}</p>
        ) : null}

        <Checkbox
          name="consentMarketing"
          checked={contact.consentMarketing}
          onChange={(e) => set("consentMarketing", e.target.checked)}
          label="Yes, you may send me offers and reminders about tyres, PMS and undercoating."
          description="Occasional messages — a promo before it ends, a seasonal reminder such as tyre checks before the rainy season, and nothing else. You can opt out any time with one reply, and opting out never affects a booking you have made."
        />
      </fieldset>

      {/* ── Honeypot ─────────────────────────────────────────────────────── */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="booking-website">Leave this field empty</label>
        <input
          id="booking-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => onWebsiteChange(e.target.value)}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Pressing Confirm sends a booking request. It is not a payment and it does not
        commit you to spending anything — we confirm the work and the price with you
        first.
      </p>

      {locked ? (
        <p className="rounded-card border-2 border-brand-500 bg-brand-50 p-4 text-sm font-bold text-brand-900 dark:bg-brand-900/25 dark:text-brand-100">
          Waiting for the rate limit to clear before you can press Confirm again. Your
          details are saved.
        </p>
      ) : null}

      <SubmitButton pending={pending} locked={locked} />
    </fieldset>
  );
}

function SubmitButton({ pending, locked }: { pending: boolean; locked: boolean }): React.ReactElement {
  return (
    <button
      type="submit"
      disabled={pending || locked}
      // `aria-busy` + `aria-disabled` together: screen readers get the state, and
      // a click during the pending window cannot double-submit.
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-eyebrow bg-accent px-7 font-display text-base font-extrabold uppercase tracking-wide text-accent-foreground shadow-cta transition-transform active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          Sending your booking…
        </>
      ) : (
        <>
          <Send aria-hidden="true" className="size-5" />
          Confirm booking
        </>
      )}
      {pending ? <span className="sr-only">Please wait, we are sending your booking.</span> : null}
    </button>
  );
}

/** The direct-contact lane shown on every failure state. */
export function DirectContactLane(): React.ReactElement {
  return (
    <ul className="flex flex-wrap gap-2">
      {PRIMARY_PHONE_UNCONFIRMED ? (
        <li className="flex items-center gap-2 rounded-card border-2 border-dashed border-border-strong bg-surface-muted px-4 py-3 text-sm font-bold">
          Phone number being confirmed — use Messenger meanwhile
        </li>
      ) : (
        <li>
          <a
            href={LINKS.call}
            className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow border-2 border-border-strong bg-surface px-5 font-display text-sm font-extrabold uppercase tracking-wide"
          >
            <Phone aria-hidden="true" className="size-4" />
            Call {BUSINESS.phoneDisplay}
          </a>
        </li>
      )}
      <li>
        <a
          href={LINKS.whatsapp}
          className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow border-2 border-border-strong bg-surface px-5 font-display text-sm font-extrabold uppercase tracking-wide"
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          WhatsApp
        </a>
      </li>
      <li>
        <a
          href={LINKS.messenger}
          className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow border-2 border-border-strong bg-surface px-5 font-display text-sm font-extrabold uppercase tracking-wide"
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          Messenger
        </a>
      </li>
    </ul>
  );
}

/** Normalises the phone before it goes on the wire, so `0917…` becomes `+63917…`. */
export function normaliseForWire(phone: string): string {
  return normalisePhone(phone);
}
