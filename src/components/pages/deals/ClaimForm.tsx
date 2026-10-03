/**
 * EYG — PROMO CLAIM FORM
 * ============================================================================
 * Name + phone → `POST /api/promos/[slug]/claim`, per promotion.
 *
 * The form exists so the re-engagement lane has a phone number it is allowed to
 * contact. It does NOT create a booking — the success copy routes to `/book`
 * with the promo pre-applied, which is Lane C in the funnel brief.
 *
 * Every state the brief demands is here: idle, pending, success, field errors,
 * rate-limited, spam rejection, offline, and a server error. Plus a honeypot, and
 * a captcha slot that is only rendered if the endpoint says it is required.
 * ============================================================================
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { isValidPhPhone, normalisePhone } from "@/lib/utils";
import { Alert, Button, Field, Input, describedBy } from "@/components/pages/_shims";
import { Spinner } from "@/components/ui/Spinner";
import { LINKS } from "@/config/site";
import { PRIMARY_PHONE_UNCONFIRMED } from "@/components/pages/_shared";
import { ArrowRight, Check, Tag, TriangleAlert } from "@/components/pages/_icons";
import { FUNNEL_EVENTS, trackFunnel } from "@/components/pages/_telemetry";

type Phase = "idle" | "pending" | "success" | "error";

interface ClaimState {
  phase: Phase;
  /** Headline for the error/success region. */
  title: string;
  message: string;
  fields: Record<string, string[]>;
  /** The shop's captcha requirement, echoed from the API. */
  captchaRequired: boolean;
  captchaQuestion: string | null;
}

const IDLE: ClaimState = {
  phase: "idle",
  title: "",
  message: "",
  fields: {},
  captchaRequired: false,
  captchaQuestion: null,
};

export interface ClaimFormProps {
  slug: string;
  promoCode: string | null;
  /** Compact rendering inside a promo card grid. */
  compact?: boolean;
  idPrefix: string;
}

export function ClaimForm({ slug, promoCode, compact = false, idPrefix }: ClaimFormProps): React.ReactElement {
  const [state, setState] = React.useState<ClaimState>(IDLE);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [captchaAnswer, setCaptchaAnswer] = React.useState("");
  const lockRef = React.useRef(false);

  React.useEffect(() => {
    trackFunnel(FUNNEL_EVENTS.dealClaimStarted, { promo: slug });
  }, [slug]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lockRef.current) return;

    const localFields: Record<string, string[]> = {};
    if (name.trim().length < 2) localFields["name"] = ["Please put a name we can call you by."];
    if (!isValidPhPhone(phone)) {
      localFields["phone"] = ["That does not look like a PH mobile number. Try 0917 123 4567."];
    }
    if (Object.keys(localFields).length > 0) {
      setState({ ...IDLE, phase: "error", title: "Two details first", message: "The fields below need filling in.", fields: localFields });
      return;
    }

    lockRef.current = true;
    setState((s) => ({ ...s, phase: "pending", title: "", message: "", fields: {} }));

    try {
      const res = await fetch(`/api/promos/${encodeURIComponent(slug)}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          phone: normalisePhone(phone.trim()),
          website,
        }),
      });

      const body: unknown = await res.json().catch(() => null);

      if (res.ok && typeof body === "object" && body !== null && (body as { ok?: unknown }).ok === true) {
        setState({
          ...IDLE,
          phase: "success",
          title: "Claimed — we have your number",
          message:
            promoCode
              ? `We will text you about ${promoCode}. If you want a bay booked now rather than later, pick a slot and the offer comes with you.`
              : "We will text you about this offer. If you want a bay booked now, pick a slot.",
          fields: {},
        });
        trackFunnel(FUNNEL_EVENTS.dealClaimSucceeded, { promo: slug });
        return;
      }

      // ── Every failure below is explained in plain language ─────────────
      const err =
        typeof body === "object" && body !== null
          ? ((body as { error?: { code?: string; message?: string; fields?: Record<string, string[]> } }).error ??
            null)
          : null;
      const code = err?.code ?? "INTERNAL_ERROR";
      const fields = err?.fields ?? {};
      const captchaRequired = code === "CAPTCHA_FAILED" || code === "CAPTCHA_REQUIRED";
      const challenge = (body as { data?: { question?: string } } | null)?.data?.question ?? null;

      if (res.status === 429) {
        setState({
          ...IDLE,
          phase: "error",
          title: "Too many claims from this device",
          message: "We paused the form for a few minutes so nobody gets locked out. Try again shortly, or just call or WhatsApp us.",
          fields: {},
        });
      } else if (res.status === 409) {
        setState({
          ...IDLE,
          phase: "error",
          title: "That offer has just ended",
          message: "The window closed while this page was open. Have a look at what is live now — and the evergreen services are always there.",
          fields: {},
        });
      } else if (captchaRequired) {
        setState({
          ...IDLE,
          phase: "error",
          title: "One quick check",
          message: "We need to confirm you are a person. Answer the small sum below and press Claim again.",
          fields,
          captchaRequired: true,
          captchaQuestion: challenge,
        });
      } else if (code === "SPAM_REJECTED") {
        setState({
          ...IDLE,
          phase: "error",
          title: "We could not accept that submission",
          message: "Our filter stopped the request before anything was sent. Nothing was claimed and nothing is charged. Please try again, or reach us on Messenger.",
          fields,
        });
      } else if (Object.keys(fields).length > 0) {
        setState({
          ...IDLE,
          phase: "error",
          title: "Check the highlighted details",
          message: "Everything you typed is still there.",
          fields,
        });
      } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setState({
          ...IDLE,
          phase: "error",
          title: "You appear to be offline",
          message: "The claim needs a connection. Reconnect and press Claim again, or call or WhatsApp us and we will note it down.",
          fields: {},
        });
      } else {
        setState({
          ...IDLE,
          phase: "error",
          title: "That did not go through",
          message: "Nothing was claimed and nothing is charged. Please try once more, or message us on Messenger and we will sort it.",
          fields,
        });
      }
      trackFunnel(FUNNEL_EVENTS.dealClaimFailed, { promo: slug, code });
    } catch {
      setState({
        ...IDLE,
        phase: "error",
        title: "We could not reach the server",
        message: "The connection dropped before your claim was sent. Nothing was claimed. Try again, or reach us on Messenger or WhatsApp.",
        fields: {},
      });
      trackFunnel(FUNNEL_EVENTS.dealClaimFailed, { promo: slug, code: "NETWORK" });
    } finally {
      lockRef.current = false;
      setState((s) => (s.phase === "pending" ? IDLE : s));
    }
  }

  const pending = state.phase === "pending";
  const nameId = `${idPrefix}-name`;
  const phoneId = `${idPrefix}-phone`;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {state.phase === "success" ? (
        <div
          role="status"
          className="space-y-3 rounded-card border-2 border-pit-600 bg-pit-100 p-4 text-pit-900 dark:text-pit-100"
        >
          <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
            <Check aria-hidden="true" className="size-4" />
            {state.title}
          </p>
          <p className="text-sm leading-relaxed">{state.message}</p>
          <ButtonLinkToBook promoCode={promoCode} />
        </div>
      ) : null}

      {state.phase === "error" ? (
        <Alert
          tone="danger"
          title={state.title}
          icon={<TriangleAlert aria-hidden="true" className="size-5" />}
          live
        >
          <p className="leading-relaxed">{state.message}</p>
          {Object.entries(state.fields).map(([field, messages]) => (
            <p key={field} className="mt-1 text-sm">
              <span className="font-bold">{FIELD_LABELS[field] ?? field}</span>: {messages.join(" ")}
            </p>
          ))}
        </Alert>
      ) : null}

      {state.phase !== "success" ? (
        <form onSubmit={onSubmit} noValidate className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              htmlFor={nameId}
              label="Your name"
              required
              error={state.fields["name"]?.[0]}
            >
              <Input
                id={nameId}
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                invalid={Boolean(state.fields["name"])}
                aria-describedby={describedBy(nameId, { error: Boolean(state.fields["name"]) })}
              />
            </Field>
            <Field
              htmlFor={phoneId}
              label="Mobile number"
              required
              hint="PH mobile, e.g. 0917 123 4567."
              error={state.fields["phone"]?.[0]}
            >
              <Input
                id={phoneId}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0917 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                invalid={Boolean(state.fields["phone"])}
                aria-describedby={describedBy(phoneId, {
                  hint: true,
                  error: Boolean(state.fields["phone"]),
                })}
                className="tabular"
              />
            </Field>
          </div>

          {state.captchaRequired ? (
            <Field
              htmlFor={`${idPrefix}-captcha`}
              label={state.captchaQuestion ?? "Quick sum check"}
              required
              hint="Only needed because our filter asked for it."
            >
              <Input
                id={`${idPrefix}-captcha`}
                name="captchaAnswer"
                type="text"
                inputMode="numeric"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
              />
            </Field>
          ) : null}

          {/* Honeypot */}
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
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <Button type="submit" variant="cta" size="md" fullWidth disabled={pending} aria-busy={pending || undefined}>
            {pending ? (
              <>
                <Spinner size="sm" />
                Claiming…
              </>
            ) : (
              <>
                <Tag aria-hidden="true" className="size-4" />
                Claim this offer
              </>
            )}
          </Button>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Claiming gets you a text from the shop about this offer. It does not book a
            bay and it does not charge anything. If you would rather not give us your
            number,{" "}
            <a
              href={PRIMARY_PHONE_UNCONFIRMED ? LINKS.messenger : LINKS.call}
              className="font-bold underline decoration-2 underline-offset-4"
            >
              {PRIMARY_PHONE_UNCONFIRMED ? "message us on Messenger" : "just call the shop"}
            </a>{" "}
            and we will honour the same price.
          </p>
        </form>
      ) : null}
    </div>
  );
}

function ButtonLinkToBook({ promoCode }: { promoCode: string | null }): React.ReactElement {
  return (
    <Link
      href={promoCode ? `/book?promo=${encodeURIComponent(promoCode)}` : "/book"}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground"
    >
      Book with the offer
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "Your name",
  phone: "Mobile number",
  email: "Email address",
  captchaAnswer: "The sum",
};
