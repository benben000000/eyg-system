import * as React from "react";
import Link from "next/link";
import {
  CloudOff,
  Construction,
  Home,
  Lock,
  Phone,
  SearchX,
  ServerCrash,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Divider } from "@/components/ui/Divider";
import { BUSINESS } from "@/config/site";
import { RetryCountdown } from "./RetryCountdown";
import {
  CONTACT_PENDING_NOTE,
  MESSENGER_HREF,
  PHONE_DISPLAY,
  PHONE_HREF,
  WHATSAPP_HREF,
} from "@/components/layout/business";

export type ErrorViewKind =
  | "not-found"
  | "server-error"
  | "rate-limited"
  | "offline"
  | "maintenance"
  | "forbidden"
  | "unknown";

export interface ErrorViewAction {
  label: string;
  href: string;
  /** Track as a CTA when clicked. */
  cta?: string;
}

interface StateConfig {
  icon: LucideIcon;
  /** Spoken first so the state is never colour-only. */
  code: string;
  title: string;
  body: React.ReactNode;
  primary: ErrorViewAction;
  secondary: ErrorViewAction;
  tone: "neutral" | "warning" | "danger";
}

const STATES: Record<ErrorViewKind, StateConfig> = {
  "not-found": {
    icon: SearchX,
    code: "Page not found (404)",
    title: "That page is not on our shelf.",
    body: (
      <>
        <p>
          The link may be old, or the page may have moved. Nothing is lost — here is where everything
          lives now.
        </p>
      </>
    ),
    primary: { label: "Book a service bay", href: "/book", cta: "book_bay" },
    secondary: { label: "Browse services", href: "/services" },
    tone: "neutral",
  },
  "server-error": {
    icon: ServerCrash,
    code: "Something broke on our side (500)",
    title: "Our end failed, not yours.",
    body: (
      <p>
        We hit an unexpected error loading this page. Your booking was not lost. Try again, or call
        the shop — a person will pick up and finish the job for you.
      </p>
    ),
    primary: { label: "Back to the homepage", href: "/", cta: "home" },
    secondary: { label: "See services", href: "/services" },
    tone: "danger",
  },
  "rate-limited": {
    icon: Timer,
    code: "Too many requests (429)",
    title: "Slow down a moment.",
    body: (
      <p>
        We are getting more requests than we can answer. Wait a minute and try again — or just call
        the shop, which is always faster than a form.
      </p>
    ),
    primary: { label: "Back to the homepage", href: "/", cta: "home" },
    secondary: { label: "Book a service bay", href: "/book" },
    tone: "warning",
  },
  offline: {
    icon: CloudOff,
    code: "No connection",
    title: "You are offline.",
    body: (
      <p>
        The page needs a connection to load. Pages you already visited stay in your browser, and
        anything you already booked is safe — it will still be here when you are back.
      </p>
    ),
    primary: { label: "Try again", href: "/", cta: "home" },
    secondary: { label: "Book a service bay", href: "/book" },
    tone: "warning",
  },
  maintenance: {
    icon: Construction,
    code: "Shop closed for maintenance",
    title: "We are working on the bay.",
    body: (
      <p>
        The shop is temporarily closed while we service the equipment. Call ahead to check when we
        reopen, or leave a message and we will confirm your slot.
      </p>
    ),
    primary: { label: "Back to the homepage", href: "/", cta: "home" },
    secondary: { label: "See our services", href: "/services" },
    tone: "warning",
  },
  forbidden: {
    icon: Lock,
    code: "Staff area (403)",
    title: "That area is for the shop staff only.",
    body: (
      <p>
        The page you asked for is behind the counter. If you are a customer looking for your booking,
        call or message us and we will confirm it for you.
      </p>
    ),
    primary: { label: "Back to the homepage", href: "/", cta: "home" },
    secondary: { label: "Contact us", href: "/contact" },
    tone: "neutral",
  },
  unknown: {
    icon: TriangleAlert,
    code: "Unexpected error",
    title: "We hit something we did not expect.",
    body: (
      <p>
        This is not a page you should be on. Head back to the homepage, or call the shop if you were
        in the middle of a booking.
      </p>
    ),
    primary: { label: "Back to the homepage", href: "/", cta: "home" },
    secondary: { label: "Book a service bay", href: "/book" },
    tone: "danger",
  },
};

/**
 * THEME-AWARE, ON-BRAND ERROR CARDS.
 *
 * These were hard-coded light-mode tints (`bg-racing-50 text-racing-900`).
 * The site ships dark by default, so the 500 page rendered a cream card with
 * dark-theme foreground colours on top — white text on cream, effectively
 * invisible, on the one page a stranded customer is guaranteed to read.
 *
 * `racing-*` is also the wrong colour here by the brand's own rule: red is
 * reserved for errors, and a failed render should not shout. The card is a
 * flat ink plane with a red keyline and an ink-foreground body, so the copy is
 * always legible in either theme.
 */
const TONE_CARD: Record<StateConfig["tone"], string> = {
  neutral: "border-border bg-surface text-foreground",
  warning: "border-brand-600 bg-surface text-foreground dark:bg-ink-900 dark:text-ink-100",
  danger: "border-racing-600 bg-surface text-foreground dark:bg-ink-900 dark:text-ink-100",
};

const TONE_ICON: Record<StateConfig["tone"], string> = {
  neutral: "text-brand-500",
  // Darkened on light surfaces: brand yellow is 1.59:1 on white (A11Y-001).
  warning: "text-brand-700 dark:text-brand-400",
  danger: "text-racing-700 dark:text-racing-400",
};

export interface ErrorViewProps {
  kind: ErrorViewKind;
  /** Retry handler. When given, the primary button becomes "Try again". */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra copy under the body (e.g. a maintenance ETA). */
  note?: React.ReactNode;
  /** Show the phone escape hatch. Default true — a stranded customer must
   *  never be trapped on an error page. */
  showCall?: boolean;
  /** Seconds remaining, rendered as a live countdown (rate-limited only). */
  retryAfterSeconds?: number;
  /** Technical digest. Rendered in development only. */
  digest?: string;
  className?: string;
  /** Heading level. 404/500 pages use h1; nested error views use h2. */
  headingLevel?: "h1" | "h2";
}

/**
 * The single component behind every error and status page.
 *
 * Each state gets its OWN icon, code, headline, body, primary action and
 * secondary action, so the seven states are genuinely distinguishable and never
 * communicated by colour alone. The phone escape hatch is on every one of them.
 */
export function ErrorView({
  kind,
  onRetry,
  retryLabel = "Try again",
  note,
  showCall = true,
  retryAfterSeconds,
  digest,
  className,
  headingLevel = "h1",
}: ErrorViewProps): React.ReactElement {
  const state = STATES[kind];
  const Glyph = state.icon;
  const Heading = headingLevel;

  return (
    <div className={cn("bg-background py-14 sm:py-20", className)}>
      <Container size="prose">
        <div
          role="alert"
          aria-labelledby={`error-${kind}-title`}
          className={cn("rounded-panel border p-6 sm:p-8", TONE_CARD[state.tone])}
        >
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className={cn("shrink-0", TONE_ICON[state.tone])}>
              <Glyph className="size-10 sm:size-12" />
            </span>
            <div className="min-w-0">
              <p className="eyg-eyebrow text-muted-foreground">{state.code}</p>
              <Heading id={`error-${kind}-title`} className="mt-1 text-h1 text-foreground">
                {state.title}
              </Heading>
            </div>
          </div>

          <div className="mt-5 text-body-lg text-foreground/85">{state.body}</div>

          {kind === "rate-limited" && typeof retryAfterSeconds === "number" ? (
            <RetryCountdown seconds={retryAfterSeconds} />
          ) : null}

          {note ? <div className="mt-4 text-sm text-foreground/80">{note}</div> : null}

          <div className="mt-7 flex flex-wrap gap-3">
            {onRetry ? (
              <Button type="button" variant="accent" size="lg" onClick={onRetry}>
                {retryLabel}
              </Button>
            ) : (
              <LinkButton href={state.primary.href} variant="accent" size="lg">
                {state.primary.label}
              </LinkButton>
            )}
            <LinkButton href={state.secondary.href} variant="outline" size="lg">
              {state.secondary.label}
            </LinkButton>
          </div>

          {digest && process.env.NODE_ENV === "development" ? (
            <p className="mt-4 font-mono text-xs text-foreground/60">digest: {digest}</p>
          ) : null}
        </div>

        {showCall ? <PhoneEscapeHatch /> : null}
      </Container>
    </div>
  );
}

/**
 * The escape hatch. A stranded customer must never be trapped on an error
 * page, so the phone (or, while the number is unconfirmed, Messenger and
 * WhatsApp) is one tap away on every state.
 */
function PhoneEscapeHatch(): React.ReactElement {
  return (
    <div className="mt-8">
      <Divider variant="checker" inset="sm" />
      <div className="mt-6 rounded-panel border border-ink-800 bg-ink-950 p-6 text-white">
        <h2 className="text-h3 font-extrabold">
          <Phone aria-hidden="true" className="mr-2 inline size-6 text-brand-500" />
          Need help right now?
        </h2>
        <p className="mt-2 text-ink-200">
          {BUSINESS.address.street}, {BUSINESS.address.district}. We are at the EGSA Fourlanes
          stretch in Tuyo.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {PHONE_HREF ? (
            <Button asChild variant="accent" size="lg">
              <a href={PHONE_HREF}>
                <Phone aria-hidden="true" className="size-5" />
                Call {PHONE_DISPLAY}
              </a>
            </Button>
          ) : (
            <span
              data-unverified="true"
              className="eyg-eyebrow inline-flex min-h-12 cursor-not-allowed items-center gap-2 rounded-eyebrow border border-white/25 px-4 text-white/60"
            >
              <Phone aria-hidden="true" className="size-5" />
              Number being confirmed
            </span>
          )}

          {WHATSAPP_HREF ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/40 text-white hover:border-white hover:bg-white/10"
            >
              <a href={WHATSAPP_HREF}>WhatsApp</a>
            </Button>
          ) : null}

          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-white/40 text-white hover:border-white hover:bg-white/10"
          >
            <a href={MESSENGER_HREF}>Messenger</a>
          </Button>
        </div>

        {!PHONE_HREF ? (
          <p className="mt-4 text-sm text-ink-300">{CONTACT_PENDING_NOTE}</p>
        ) : null}

        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-300">
          <li>
            <Link href="/book" className="underline underline-offset-4 hover:text-white">
              Book a bay online
            </Link>
          </li>
          <li>
            <Link href="/services" className="underline underline-offset-4 hover:text-white">
              Services &amp; prices
            </Link>
          </li>
          <li>
            <Link href="/" className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-white">
              <Home aria-hidden="true" className="size-4" />
              Homepage
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
