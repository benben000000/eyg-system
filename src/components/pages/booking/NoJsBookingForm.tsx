/**
 * EYG — NO-JAVASCRIPT BOOKING FALLBACK — FORM
 * ============================================================================
 * The hard rule from the brief: **a stranded customer must never hit a wall on
 * this page.**
 *
 * A four-step React wizard is inherently client-side, so this is the honest
 * counterpart: a genuine `<form>` driven by a **Server Action** through
 * `useActionState`. With JavaScript disabled the browser performs a real POST,
 * the action runs on the server, and React re-renders the page with the result.
 * Nothing here degrades to a dead end.
 *
 * It asks for the four things a person at the counter genuinely needs — name,
 * PH phone, preferred day, and what the car needs — and posts them to
 * `POST /api/leads` with `kind: "contact"`. A person then calls or texts back.
 * The copy says exactly that, rather than implying a bay is already held.
 * ============================================================================
 */

"use client";

import * as React from "react";
import { BUSINESS, BUSINESS_HOURS, LINKS } from "@/config/site";
import { Button, Field, Input, Textarea, describedBy } from "@/components/pages/_shims";
import { Divider } from "@/components/ui/Divider";
import { Spinner } from "@/components/ui/Spinner";
import { formatMinutes } from "@/components/pages/_hours";
import { PRIMARY_PHONE_UNCONFIRMED } from "@/components/pages/_shared";
import { Check, MessageCircle, Phone, Send, TriangleAlert } from "@/components/pages/_icons";
import {
  INITIAL_FALLBACK_STATE,
  type SubmitFallbackState,
} from "@/components/pages/booking/NoJsBookingState";
import { submitBookingFallback } from "@/components/pages/booking/NoJsBookingAction";

export interface NoJsBookingFormProps {
  /** Pre-computed open days, so the client bundle carries no date logic. */
  strip: ReadonlyArray<{ isoDate: string; fullLabel: string; closed: boolean; isToday: boolean }>;
  /** Set when the action previously failed, so the heading can be honest. */
  initialState?: SubmitFallbackState;
}

export function NoJsBookingForm({
  strip,
  initialState,
}: NoJsBookingFormProps): React.ReactElement {
  const [state, formAction, pending] = React.useActionState(
    submitBookingFallback,
    initialState ?? INITIAL_FALLBACK_STATE,
  );

  const hasResult = state.outcome !== "error" || state.fields.name !== "" || state.name !== "";
  const openDays = strip.filter((d) => !d.closed);
  const firstOpen = openDays[0] ?? null;
  const hasSubmitted = state !== INITIAL_FALLBACK_STATE;

  return (
    <section
      aria-labelledby="fallback-heading"
      className="rounded-panel border-2 border-border-strong bg-surface p-6"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 id="fallback-heading" className="text-h3">
            Or just tell us and we will call you back
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This form sends your number to the shop. A person will text or call you
            during working hours to agree a time. It is the same bay and the same
            price — it just takes one extra message.
          </p>
        </div>

        {hasSubmitted && hasResult ? (
          <FallbackResult state={state} firstOpenLabel={firstOpen?.fullLabel ?? null} />
        ) : null}

        <Divider variant="dashed" inset="sm" />

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              htmlFor="fb-name"
              label="Your name"
              required
              error={state.fields["name"]}
            >
              <Input
                id="fb-name"
                name="name"
                autoComplete="name"
                required
                defaultValue={state.name}
                invalid={Boolean(state.fields["name"])}
                aria-describedby={describedBy("fb-name", {
                  error: Boolean(state.fields["name"]),
                })}
              />
            </Field>

            <Field
              htmlFor="fb-phone"
              label="Mobile number"
              required
              hint="PH mobile, e.g. 0917 123 4567."
              error={state.fields["phone"]}
            >
              <Input
                id="fb-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="0917 123 4567"
                defaultValue={state.phone}
                invalid={Boolean(state.fields["phone"])}
                aria-describedby={describedBy("fb-phone", {
                  hint: true,
                  error: Boolean(state.fields["phone"]),
                })}
                className="tabular"
              />
            </Field>
          </div>

          <Field
            htmlFor="fb-day"
            label="Preferred day"
            hint="We will confirm the exact time with you. If today is open, we will offer you the first free bay."
          >
            <select
              id="fb-day"
              name="day"
              defaultValue={state.day}
              className="w-full min-h-12 rounded-card border-2 border-border-strong bg-surface px-3.5 py-2.5 text-base text-foreground focus-visible:border-brand-500 focus-visible:outline-none"
              aria-describedby={describedBy("fb-day", { hint: true })}
            >
              <option value="">Earliest available — just contact me</option>
              {openDays.map((d) => (
                <option key={d.isoDate} value={d.isoDate}>
                  {d.fullLabel}
                  {d.isToday ? " (today)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field
            htmlFor="fb-message"
            label="What does the car need?"
            hint="For example: &ldquo;PMS, and the front left tyre is losing pressure.&rdquo; A good place for the plate number too."
          >
            <Textarea
              id="fb-message"
              name="message"
              rows={3}
              maxLength={500}
              defaultValue={state.message}
              aria-describedby={describedBy("fb-message", { hint: true })}
              placeholder="PMS, front left tyre losing pressure, plate ABC 1234"
            />
          </Field>

          {/* Honeypot: real input, hidden from humans. */}
          <div
            aria-hidden="true"
            className="absolute left-[-9999px] top-[-9999px] h-px w-px overflow-hidden"
          >
            <label htmlFor="fb-website">Leave this field empty</label>
            <input
              id="fb-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <Button type="submit" variant="cta" size="lg" fullWidth disabled={pending} aria-busy={pending || undefined}>
            {pending ? <Spinner size="sm" /> : <Send aria-hidden="true" className="size-4" />}
            {pending ? "Sending…" : "Send my details"}
          </Button>
          {pending ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Sending your details — please wait a moment.
            </p>
          ) : null}
        </form>

        <Divider variant="dashed" inset="sm" />

        <div className="space-y-3">
          <p className="eyg-eyebrow text-muted-foreground">Or skip the form entirely</p>
          <p className="text-sm text-muted-foreground">
            Open{" "}
            {BUSINESS_HOURS.filter((d) => !d.closed)
              .map(
                (d) =>
                  `${d.label.slice(0, 3)} ${formatMinutes(d.opens)}–${formatMinutes(d.closes)}`,
              )
              .join(", ")}
            . Closed {BUSINESS_HOURS.filter((d) => d.closed).map((d) => d.label).join(", ")}.
          </p>
          <ul className="flex flex-wrap gap-2">
            {PRIMARY_PHONE_UNCONFIRMED ? (
              <li className="flex items-center gap-2 rounded-card border-2 border-dashed border-border-strong bg-surface-muted px-4 py-3 text-sm font-bold">
                <TriangleAlert aria-hidden="true" className="size-4 text-brand-500" />
                Phone number being confirmed — use Messenger or email
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
          </ul>
          <p className="text-xs text-muted-foreground">
            We are at {BUSINESS.address.street}, {BUSINESS.address.district}.{" "}
            {BUSINESS.address.landmark}
          </p>
        </div>
      </div>
    </section>
  );
}

function FallbackResult({
  state,
  firstOpenLabel,
}: {
  state: SubmitFallbackState;
  firstOpenLabel: string | null;
}): React.ReactElement {
  if (state.outcome === "sent") {
    return (
      <div
        role="status"
        className="flex gap-3 rounded-card border-2 border-pit-600 bg-pit-100 p-4 text-pit-900 dark:text-pit-100"
      >
        <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide">
            We have your details
          </p>
          <p className="text-sm leading-relaxed">
            {state.name ? <strong>{state.name}, </strong> : null}we will text or call the
            number you gave us during working hours to agree a time. Nothing is booked
            yet and nothing is charged — we agree the work and the price with you
            first.
          </p>
        </div>
      </div>
    );
  }

  if (state.outcome === "ratelimited") {
    return (
      <div
        role="alert"
        className="flex gap-3 rounded-card border-2 border-brand-700 bg-brand-100 p-4 text-brand-900 dark:text-brand-100"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide">
            Too many messages from this device
          </p>
          <p className="text-sm leading-relaxed">
            We paused the form for a few minutes so nobody else gets locked out. Wait
            a moment and press Send again, or just call or WhatsApp us — it takes a
            minute either way.
          </p>
        </div>
      </div>
    );
  }

  if (state.outcome === "invalid") {
    return (
      <div
        role="alert"
        className="flex gap-3 rounded-card border-2 border-destructive bg-racing-100 p-4 text-destructive"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide">
            We need one more detail
          </p>
          <p className="text-sm leading-relaxed">
            {state.fields["name"] ??
              state.fields["phone"] ??
              "The details above need fixing. Everything you typed is still there."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-card border-2 border-destructive bg-racing-100 p-4 text-destructive"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-display text-sm font-extrabold uppercase tracking-wide">
          That did not send
        </p>
        <p className="text-sm leading-relaxed">
          Our booking system did not accept the request. Nothing was saved. Please try
          again, or call the shop —{" "}
          {firstOpenLabel ? `we are open ${firstOpenLabel}.` : "we are open during working hours."}
        </p>
      </div>
    </div>
  );
}
