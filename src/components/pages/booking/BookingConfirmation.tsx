/**
 * EYG — BOOKING CONFIRMATION
 * ============================================================================
 * The screen a customer sees once the booking exists. It answers, in order, the
 * four questions somebody has in their head immediately after pressing Confirm:
 *
 *   1. Did it actually go through?      → the reference, stated plainly
 *   2. When exactly?                    → full date, time, and duration
 *   3. Where do I go, and how?          → address + one-tap directions
 *   4. What happens next?               → numbered steps, no surprises
 *
 * The phone number is rendered through the same unconfirmed-number guard as the
 * rest of the site, so a `tel:` link to the `TODO-VERIFY` placeholder can never
 * appear here either.
 * ============================================================================
 */

import { formatPeso } from "@/lib/utils";
import { BUSINESS, LINKS } from "@/config/site";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";
import { Button, ButtonLink, Card, CardContent, CardHeader, CardTitle } from "@/components/pages/_shims";
import { DirectionsLinks, PRIMARY_PHONE_UNCONFIRMED } from "@/components/pages/_shared";
import {
  Calendar,
  Check,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  Sparkles,
  TriangleAlert,
} from "@/components/pages/_icons";

export interface ConfirmationView {
  reference: string;
  status: string;
  startAt: string;
  customerName: string;
  customerPhone: string;
  vehicleSummary: string;
  items: ReadonlyArray<{ name: string; quantity: number }>;
  estimateMin: number | null;
  estimateMax: number | null;
}

export interface BookingConfirmationProps {
  booking: ConfirmationView;
  /** Re-book, or go back to services. Rendered as real navigation. */
  onStartOver: () => void;
}

export function BookingConfirmation({
  booking,
  onStartOver,
}: BookingConfirmationProps): React.ReactElement {
  const when = formatSlotInstant(booking.startAt);
  const needsApproval = booking.status === "PENDING";

  return (
    <div className="space-y-8">
      {/* ── Headline ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-panel border-2 border-pit-600 bg-surface p-6 sm:p-10">
        <div aria-hidden="true" className="eyg-checker absolute inset-x-0 top-0 h-2" />
        <div className="space-y-4 pt-2">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-pill bg-pit-500 text-ink-950"
          >
            <CheckCircle2 className="size-7" />
          </span>
          <div className="space-y-2">
            <h2 className="text-h2" id="confirmation-heading">
              {needsApproval ? "Booking request received" : "You are booked in"}
            </h2>
            <p className="text-body-lg text-muted-foreground">
              {needsApproval
                ? "We are holding a bay for you. A text with your confirmation is on its way to your phone now."
                : "Your bay is reserved. A text with these details is on its way to your phone now."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="eyg-eyebrow text-muted-foreground">Booking reference</p>
            <p className="tabular rounded-pill bg-ink-950 px-4 py-2 font-display text-xl font-extrabold tracking-widest text-brand-500">
              {booking.reference}
            </p>
            <Badge tone={needsApproval ? "neutral" : "success"} size="md" dot>
              {needsApproval ? "Pending confirmation" : "Confirmed"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Quote that reference if you call the shop. It is the fastest way for us to
            find your booking.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        {/* ── What, when, where ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle level={2} className="flex items-center gap-2 text-xl">
                <Calendar aria-hidden="true" className="size-5 text-brand-500" />
                Your appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="eyg-eyebrow text-muted-foreground">Date</dt>
                  <dd className="mt-1 text-lg font-bold">{when.dateLabel}</dd>
                </div>
                <div>
                  <dt className="eyg-eyebrow text-muted-foreground">Arrival time</dt>
                  <dd className="tabular mt-1 text-lg font-bold">{when.timeLabel}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="eyg-eyebrow text-muted-foreground">Vehicle</dt>
                  <dd className="mt-1 font-bold">{booking.vehicleSummary}</dd>
                </div>
              </dl>

              <Divider variant="solid" inset="none" />

              <div className="space-y-2">
                <p className="eyg-eyebrow text-muted-foreground">Work booked</p>
                {booking.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No specific services were selected — we will go through it with you at
                    the counter. That is completely fine.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {booking.items.map((item) => (
                      <li key={item.name} className="flex items-start gap-2 text-sm">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pit-500" />
                        <span>
                          {item.name}
                          {item.quantity > 1 ? (
                            <span className="tabular ml-1.5 text-xs text-muted-foreground">
                              ×{item.quantity}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {booking.estimateMin !== null ? (
                <div className="space-y-1 rounded-card border border-brand-700 bg-brand-50 p-4 dark:bg-brand-900/25">
                  <p className="eyg-eyebrow text-brand-900 dark:text-brand-100">
                    Estimated total
                  </p>
                  <p className="tabular font-display text-2xl font-extrabold text-brand-900 dark:text-brand-100">
                    {formatPeso(booking.estimateMin)}
                    {booking.estimateMax !== null && booking.estimateMax !== booking.estimateMin
                      ? `–${formatPeso(booking.estimateMax)}`
                      : ""}
                  </p>
                  <p className="text-xs leading-relaxed text-brand-900/80 dark:text-brand-100/80">
                    This is an estimate, not a bill. The final price is confirmed with
                    you after the technician inspects the car, before any work starts.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle level={2} className="flex items-center gap-2 text-xl">
                <MapPin aria-hidden="true" className="size-5 text-brand-500" />
                Where to come
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <address className="text-base not-italic leading-relaxed">
                <span className="block font-bold">{BUSINESS.address.street}</span>
                <span className="block">
                  {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
                  {BUSINESS.address.postalCode}
                </span>
              </address>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {BUSINESS.address.landmark}
              </p>
              <DirectionsLinks />
            </CardContent>
          </Card>
        </div>

        {/* ── What happens next ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle level={2} className="flex items-center gap-2 text-xl">
                <Sparkles aria-hidden="true" className="size-5 text-brand-500" />
                What happens next
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {NEXT_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="tabular flex size-8 shrink-0 items-center justify-center rounded-pill border-2 border-brand-500 font-display text-sm font-extrabold text-brand-500"
                    >
                      {i + 1}
                    </span>
                    <div className="space-y-1">
                      <p className="font-display text-sm font-extrabold uppercase tracking-wide">
                        {step.title}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle level={2} className="flex items-center gap-2 text-xl">
                <Phone aria-hidden="true" className="size-5 text-brand-500" />
                Need to change something?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Reply to the confirmation text, or reach us directly. Quote your
                reference <span className="tabular font-bold">{booking.reference}</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_PHONE_UNCONFIRMED ? (
                  <p className="flex items-center gap-2 rounded-card border-2 border-dashed border-border-strong bg-surface-muted px-4 py-3 text-sm font-bold">
                    <TriangleAlert aria-hidden="true" className="size-4 text-brand-500" />
                    Phone number being confirmed — use Messenger for now
                  </p>
                ) : (
                  <ButtonLink href={LINKS.call} variant="primary" size="md">
                    <Phone aria-hidden="true" className="size-4" />
                    {BUSINESS.phoneDisplay}
                  </ButtonLink>
                )}
                <ButtonLink href={LINKS.whatsapp} variant="secondary" size="md">
                  <MessageCircle aria-hidden="true" className="size-4" />
                  WhatsApp
                </ButtonLink>
              </div>
              <p className="text-xs text-muted-foreground">
                Cancellations: as early as you can. We can almost always re-fit you
                into a freed bay, but a same-day no-show costs us a bay that somebody
                else could have used.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6 print:pt-0">
        <Button type="button" variant="secondary" size="md" onClick={onStartOver}>
          Book something else
        </Button>
        <ButtonLink href="/services" variant="ghost" size="md">
          Back to services &amp; pricing
        </ButtonLink>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground print:hidden">
          <Printer aria-hidden="true" className="size-3.5" />
          Keep the reference — you can print this page.
        </p>
      </div>
    </div>
  );
}

const NEXT_STEPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "A text lands within a minute",
    body: "It carries your reference, the date and the arrival time. If it has not arrived after ten minutes, check that you gave us a number you answer — then call us.",
  },
  {
    title: "A reminder the morning of",
    body: "One message on the day, so nobody drives across Bataan for nothing.",
  },
  {
    title: "Bring the car, and the lock key",
    body: "Nothing else is required. If you are having tyres done, the spare matters more than you think.",
  },
  {
    title: "We look, we write it down, we agree",
    body: "The technician inspects the car and tells you the final price. You approve it or you drive away. Nothing is done that you did not agree to.",
  },
];

export interface FormattedSlot {
  dateLabel: string;
  timeLabel: string;
}

const _DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const _MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Formats an ISO instant **in the shop's timezone**, not the viewer's.
 * A booking at 8:00 AM Manila time must read as 8:00 AM to somebody in another
 * country looking at the screen, or the whole confirmation is wrong.
 */
export function formatSlotInstant(iso: string): FormattedSlot {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return { dateLabel: "See the text we sent you", timeLabel: "" };

    const parts = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);

    const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
    return {
      dateLabel: `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`,
      timeLabel: `${get("hour")}:${get("minute")} ${get("dayPeriod")}`.replace(/\s+/g, " "),
    };
  } catch {
    return { dateLabel: "See the text we sent you", timeLabel: "" };
  }
}
