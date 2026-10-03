/**
 * EYG — GENERAL CONTACT FORM
 * ============================================================================
 * `POST /api/leads` with `kind: "contact"`, via a Server Action + `useActionState`.
 *
 * NO JAVASCRIPT FALLBACK: because this is a real form driven by a Server
 * Action, submitting it with scripting disabled performs a genuine POST and
 * re-renders the page with the result. The form is therefore the primary path,
 * not an enhancement — which is why the phone number sits directly beneath it.
 *
 * States: idle → pending → sent | invalid | ratelimited | offline | error.
 * Consent is a real, full-sentence checkbox. The honeypot is a real input that
 * only a bot fills in.
 * ============================================================================
 */

"use client";

import * as React from "react";
import { Alert, Button, Checkbox, Field, Input, Textarea, describedBy } from "@/components/pages/_shims";
import { Spinner } from "@/components/ui/Spinner";
import { LINKS } from "@/config/site";
import { PRIMARY_PHONE_UNCONFIRMED } from "@/components/pages/_shared";
import { Check, MessageCircle, Phone, Send, TriangleAlert, WifiOff } from "@/components/pages/_icons";
import { FUNNEL_EVENTS, trackFunnel } from "@/components/pages/_telemetry";
import { INITIAL_CONTACT_STATE } from "@/components/pages/contact/ContactState";
import { submitContactLead } from "@/components/pages/contact/ContactAction";

const TOPICS = [
  { value: "", label: "What is this about?" },
  { value: "quote", label: "A price for some work" },
  { value: "tyres", label: "Tyres — what size do I need?" },
  { value: "roadside", label: "Roadside help — I am stuck" },
  { value: "complaint", label: "Something is not right with work we did" },
  { value: "account", label: "An existing booking" },
  { value: "other", label: "Something else" },
];

export function ContactForm(): React.ReactElement {
  const [state, formAction, pending] = React.useActionState(
    submitContactLead,
    INITIAL_CONTACT_STATE,
  );
  const [consent, setConsent] = React.useState(false);
  const submittedOnce = React.useRef(false);

  React.useEffect(() => {
    if (state.outcome !== "error" && !submittedOnce.current) {
      submittedOnce.current = true;
      if (state.outcome === "sent") {
        trackFunnel(FUNNEL_EVENTS.contactFormSucceeded, { topic: state.topic || "none" });
      } else {
        trackFunnel(FUNNEL_EVENTS.contactFormFailed, { outcome: state.outcome });
      }
    }
  }, [state]);

  const idPrefix = "contact";
  const nameId = `${idPrefix}-name`;
  const phoneId = `${idPrefix}-phone`;
  const emailId = `${idPrefix}-email`;
  const topicId = `${idPrefix}-topic`;
  const messageId = `${idPrefix}-message`;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 id="contact-form-heading" className="text-h2">
          Send us a message
        </h2>
        <p className="text-muted-foreground">
          Goes straight to the people at the counter. We reply during working hours —
          usually the same day.
        </p>
      </div>

      {state.outcome === "sent" ? (
        <Alert tone="success" title="Message sent" icon={<Check aria-hidden="true" className="size-5" />} live>
          <p className="leading-relaxed">
            Thank you{state.name ? `, ${state.name}` : ""}. We have your message and we
            will reply on the number you gave us. If it is urgent and we are open,
            calling is still faster — the phone is right below this form.
          </p>
        </Alert>
      ) : null}

      {state.outcome === "ratelimited" ? (
        <Alert tone="warning" title="Too many messages from this device" icon={<TriangleAlert className="size-5" />} live>
          <p className="leading-relaxed">
            We paused the form for a few minutes so nobody else gets locked out. Wait a
            moment and press Send again, or call or WhatsApp us and we will pick it up
            straight away.
          </p>
        </Alert>
      ) : null}

      {state.outcome === "offline" ? (
        <Alert tone="warning" title="You appear to be offline" icon={<WifiOff className="size-5" />} live>
          <p className="leading-relaxed">
            The message did not go through. Reconnect and press Send again — everything
            you typed is still here. If you are stuck on the road, calling works without
            any signal problems on our end.
          </p>
        </Alert>
      ) : null}

      {state.outcome === "error" ? (
        <Alert tone="danger" title="That did not send" icon={<TriangleAlert className="size-5" />} live>
          <p className="leading-relaxed">
            Something went wrong at our end and nothing was saved. Please try once more,
            or reach us on Messenger or WhatsApp — both are checked constantly.
          </p>
        </Alert>
      ) : null}

      {state.outcome === "invalid" && Object.keys(state.fields).length > 0 ? (
        <Alert tone="danger" title="Check the highlighted fields" icon={<TriangleAlert className="size-5" />} live>
          <p className="leading-relaxed">
            The fields marked below need a change. Everything you already typed is still
            there.
          </p>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor={nameId} label="Your name" required error={state.fields["name"]}>
            <Input
              id={nameId}
              name="name"
              autoComplete="name"
              required
              defaultValue={state.name}
              invalid={Boolean(state.fields["name"])}
              aria-describedby={describedBy(nameId, { error: Boolean(state.fields["name"]) })}
            />
          </Field>

          <Field
            htmlFor={phoneId}
            label="Mobile number"
            required
            hint="PH mobile, e.g. 0917 123 4567. This is how we reply."
            error={state.fields["phone"]}
          >
            <Input
              id={phoneId}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="0917 123 4567"
              defaultValue={state.phone}
              invalid={Boolean(state.fields["phone"])}
              aria-describedby={describedBy(phoneId, {
                hint: true,
                error: Boolean(state.fields["phone"]),
              })}
              className="tabular"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor={emailId}
            label="Email"
            hint="Only if you would like a written reply. We do not add you to anything."
            error={state.fields["email"]}
          >
            <Input
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={state.email}
              invalid={Boolean(state.fields["email"])}
              aria-describedby={describedBy(emailId, {
                hint: true,
                error: Boolean(state.fields["email"]),
              })}
            />
          </Field>

          <Field htmlFor={topicId} label="What is it about?">
            <select
              id={topicId}
              name="topic"
              defaultValue={state.topic}
              className="w-full min-h-12 rounded-card border-2 border-border-strong bg-surface px-3.5 py-2.5 text-base text-foreground focus-visible:border-brand-500 focus-visible:outline-none"
            >
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          htmlFor={messageId}
          label="Your message"
          required
          hint="The more specific you are, the more specific we can be. Tyre size, plate number, the noise, how long it has been doing it."
          error={state.fields["message"]}
        >
          <Textarea
            id={messageId}
            name="message"
            rows={5}
            required
            maxLength={1000}
            defaultValue={state.message}
            invalid={Boolean(state.fields["message"])}
            aria-describedby={describedBy(messageId, {
              hint: true,
              error: Boolean(state.fields["message"]),
            })}
            placeholder="Front left tyre keeps losing pressure overnight. Plate ABC 1234, 2019 Innova."
          />
        </Field>

        <Checkbox
          name="consentReply"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          label="Yes, you may contact me about this message."
          description="We will text or call you back about what you asked. That is all. We do not add your number to a marketing list, and you can ask us to delete it at any time — see our privacy notice."
        />

        {/* Honeypot: a real input, filled in only by bots. */}
        <div
          aria-hidden="true"
          className="absolute left-[-9999px] top-[-9999px] h-px w-px overflow-hidden"
        >
          <label htmlFor={`${idPrefix}-website`}>Leave this field empty</label>
          <input
            id={`${idPrefix}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        <Button
          type="submit"
          variant="cta"
          size="lg"
          fullWidth
          disabled={pending || !consent}
          aria-busy={pending || undefined}
        >
          {pending ? <Spinner size="sm" /> : <Send aria-hidden="true" className="size-4" />}
          {pending ? "Sending…" : "Send message"}
        </Button>

        {pending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Sending your message — please wait a moment.
          </p>
        ) : null}
        {!pending && !consent ? (
          <p className="text-sm text-muted-foreground">
            Tick the box above so we are allowed to reply to you, then the button
            becomes active.
          </p>
        ) : null}
      </form>

      {/* The no-JS lane, and the fastest lane, sit directly under the form. */}
      <div className="space-y-3 border-t border-border pt-5">
        <p className="eyg-eyebrow text-muted-foreground">Or reach us directly</p>
        <ul className="flex flex-wrap gap-2">
          {PRIMARY_PHONE_UNCONFIRMED ? (
            <li className="flex items-center gap-2 rounded-card border-2 border-dashed border-border-strong bg-surface-muted px-4 py-3 text-sm font-bold">
              <TriangleAlert aria-hidden="true" className="size-4 text-brand-500" />
              Phone number being confirmed — use Messenger or WhatsApp
            </li>
          ) : (
            <li>
              <a
                href={LINKS.call}
                className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground"
              >
                <Phone aria-hidden="true" className="size-4" />
                Call the shop
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
        <p className="text-xs leading-relaxed text-muted-foreground">
          This form works with JavaScript switched off too — it is a real form, not a
          simulation. Nothing you type is sent anywhere except to the shop&rsquo;s own
          inbox.
        </p>
      </div>
    </div>
  );
}
