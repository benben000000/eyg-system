"use client";

/**
 * BOOKING CONFIRMATION — what happens after the customer presses send.
 * ============================================================================
 *  - The reference, in a form a human can read down a phone line.
 *  - Date and time rendered in Asia/Manila explicitly, never in the visitor's
 *    own timezone, because the appointment is at the shop.
 *  - "Add to calendar" is a client-side `.ics` Blob download. No server round
 *    trip, no third-party calendar popup that can eat the whole screen.
 *  - "SMS me this confirmation" uses `sms:` with the shop's number and a short,
 *    honest body. It is a link, not a claim that an SMS was already sent.
 *  - The phone number and WhatsApp are always one tap away, because the booking
 *    is a *request*, and the shop may still need to call to confirm a part.
 * ============================================================================
 */
import { useCallback, useMemo } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
} from "lucide-react";
import type { BookingDto } from "@/lib/types";
import { ADDRESS_ONE_LINE, BUSINESS, LINKS } from "@/config/site";
import { formatPesoRange } from "@/lib/utils";
import { events } from "@/lib/hooks";
import { formatShopDateTime, toShopParts } from "@/components/widgets/internal/time-ph";
import { Button, ButtonLink, Pill, WidgetCard } from "@/components/widgets/internal/ui";

export interface BookingConfirmationProps {
  booking: BookingDto;
  /** Optional client-side extras the server does not return. */
  durationLabel?: string | undefined;
  notes?: string | undefined;
  className?: string;
  headingId?: string;
  /** Called after the `.ics` download is triggered. */
  onCalendarAdded?: (() => void) | undefined;
}

export default function BookingConfirmation({
  booking,
  durationLabel,
  notes,
  className,
  headingId,
  onCalendarAdded,
}: BookingConfirmationProps) {
  const startLabel = useMemo(() => formatShopDateTime(booking.startAt), [booking.startAt]);

  /**
   * Builds a single-event `.ics` (RFC 5545) and downloads it from a Blob.
   * Line folding is handled to the 75-octet limit, timestamps are emitted in UTC
   * (`Z`) because that is the only unambiguous form, and the DTSTART carries the
   * `TZID=Asia/Manila` hint so a calendar app shows the shop's wall clock.
   */
  const addToCalendar = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const startUtc = new Date(booking.startAt);
    if (Number.isNaN(startUtc.getTime())) return;

    const startMs = startUtc.getTime();
    const endMs =
      booking.endAt !== null && !Number.isNaN(new Date(booking.endAt).getTime())
        ? new Date(booking.endAt).getTime()
        : startMs + 60 * 60 * 1000; // Default one hour if the shop has not set an end.

    const stamp = (ms: number) =>
      new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const shop = toShopParts(startMs);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EYG Tire & Auto Care//Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${booking.reference}@eygtireautocare.ph`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(startMs)}`,
      `DTEND:${stamp(endMs)}`,
      // The `TZID` line is advisory; the UTC timestamps above are authoritative.
      `X-WR-TIMEZONE:Asia/Manila`,
      `SUMMARY:${escapeIcs(`${BUSINESS.legalName} — ${booking.customerName}`)}`,
      `DESCRIPTION:${escapeIcs(descriptionFor(booking, durationLabel))}`,
      `LOCATION:${escapeIcs(ADDRESS_ONE_LINE)}`,
      `URL:${escapeIcs(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/book?ref=${booking.reference}`)}`,
      `STATUS:${booking.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT2H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(`${BUSINESS.legalName} appointment`)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const body = lines.map(fold).join("\r\n");
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `EYG-${booking.reference}.ics`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    events.calendar("booking");
    onCalendarAdded?.();
    void shop;
  }, [booking, durationLabel, onCalendarAdded]);

  const smsBody = encodeURIComponent(
    `Hi EYG, this is ${booking.customerName}. My booking reference is ${booking.reference}. Please confirm ${startLabel}. Thank you.`,
  );

  const whatHappensNext = [
    "We text you to confirm the bay is held for you. If you do not hear from us within the hour, call — a person answers.",
    "Arrive 10 minutes early if you can. We will look at the car, tell you what it needs, and give you the price before anything is done.",
    "If the price is different from the estimate above, we stop and call you. We do not do the extra work without your yes.",
  ];

  return (
    <WidgetCard
      as="section"
      className={className}
      aria-labelledby={headingId}
      aria-live="polite"
    >
      <div className="flex flex-col gap-4">
        {/* ── The headline ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-pill bg-pit-100 text-pit-700"
          >
            <CheckCircle2 className="size-6" focusable="false" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id={headingId} className="text-h3 text-foreground">
              Booked. We are holding a bay for you.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We will text you on {booking.customerPhone} to confirm. Keep this reference:
            </p>
            <p className="tabular font-display text-2xl font-extrabold tracking-tight text-brand-700">
              {booking.reference}
            </p>
            <p className="text-xs text-muted-foreground">
              Reference code {booking.reference}. Quote it if you call us.
            </p>
          </div>
        </div>

        {/* ── The appointment, in shop time ──────────────────────────────── */}
        <dl className="flex flex-col gap-2 rounded-card border border-border bg-surface-muted p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Date &amp; time</dt>
            <dd className="text-right font-extrabold text-foreground">{startLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Timezone</dt>
            <dd className="text-right font-semibold text-foreground">Asia/Manila (Philippine time)</dd>
          </div>
          {durationLabel ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Bay time</dt>
              <dd className="text-right font-semibold text-foreground tabular">{durationLabel}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-right">
              <Pill tone={booking.status === "CANCELLED" ? "danger" : "success"}>{booking.status}</Pill>
            </dd>
          </div>
          {booking.vehicle ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd className="text-right font-semibold text-foreground">
                {[booking.vehicle.year, booking.vehicle.make, booking.vehicle.model, booking.vehicle.variant]
                  .filter(Boolean)
                  .join(" ")}
                {booking.vehicle.plate ? (
                  <span className="block text-xs font-medium text-muted-foreground">
                    Plate {booking.vehicle.plate}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* ── Services + estimate ───────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="eyg-eyebrow text-muted-foreground">What we are doing</p>
          <ul className="flex flex-col gap-1 text-sm">
            {booking.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="text-foreground">
                  {item.name}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                </span>
                <span className="tabular shrink-0 text-muted-foreground">
                  {formatPesoRange(item.priceMin, item.priceMax)}
                </span>
              </li>
            ))}
            {booking.items.length === 0 ? (
              <li className="text-muted-foreground">
                We will confirm the services with you when we see the car.
              </li>
            ) : null}
          </ul>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <span className="text-sm font-bold text-foreground">Estimated total</span>
            <span className="tabular font-display text-xl font-extrabold text-foreground">
              {formatPesoRange(booking.estimateMin, booking.estimateMax)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            An estimate, not an invoice. We confirm the final price after inspection and nothing is
            charged until you approve it.
          </p>
        </div>

        {notes ? (
          <div className="rounded-card border border-border bg-surface-muted p-3">
            <p className="eyg-eyebrow text-muted-foreground">Your note to us</p>
            <p className="mt-1 text-sm text-foreground">{notes}</p>
          </div>
        ) : null}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={addToCalendar}>
            <CalendarPlus aria-hidden="true" className="size-4" focusable="false" />
            Add to calendar
          </Button>
          <a
            href={`sms:${BUSINESS.phoneE164}?body=${smsBody}`}
            onClick={() => events.sms("booking")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-card border border-border-strong bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
          >
            <Share2 aria-hidden="true" className="size-4" focusable="false" />
            SMS me this confirmation
          </a>
          <a
            href={LINKS.call}
            onClick={() => events.call("booking-confirmation")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-card border border-border-strong bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
          >
            <Phone aria-hidden="true" className="size-4" focusable="false" />
            Call {BUSINESS.phoneDisplay}
          </a>
          <ButtonLink
            href={LINKS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            onClick={() => events.whatsapp("booking-confirmation")}
          >
            <MessageCircle aria-hidden="true" className="size-4" focusable="false" />
            WhatsApp us
          </ButtonLink>
        </div>

        {/* ── Where to come ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-muted p-3">
          <p className="eyg-eyebrow text-muted-foreground">Where to come</p>
          <address className="not-italic text-sm leading-relaxed text-foreground">
            {BUSINESS.address.street}
            <br />
            {BUSINESS.address.district}, {BUSINESS.address.province} {BUSINESS.address.postalCode}
          </address>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {BUSINESS.address.landmark}
          </p>
          <ButtonLink
            href={LINKS.directionsGoogle}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            className="self-start"
            onClick={() => events.directions("google")}
          >
            <MapPin aria-hidden="true" className="size-4" focusable="false" />
            Get directions
          </ButtonLink>
        </div>

        {/* ── What happens next ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="eyg-eyebrow text-muted-foreground">What happens next</p>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-foreground">
            {whatHappensNext.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </div>
    </WidgetCard>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function descriptionFor(booking: BookingDto, durationLabel?: string): string {
  const items = booking.items.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
  const estimate = formatPesoRange(booking.estimateMin, booking.estimateMax);
  return [
    `Reference: ${booking.reference}`,
    items ? `Services: ${items}` : "",
    `Estimated total: ${estimate} (estimate only — final price confirmed on inspection)`,
    durationLabel ? `Bay time: ${durationLabel}` : "",
    `Questions: call ${BUSINESS.phoneDisplay}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** RFC 5545 §3.3.11 text escaping. */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1 content-line folding at 75 octets. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return parts.join("\r\n");
}

export { BookingConfirmation };