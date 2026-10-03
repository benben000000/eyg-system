"use client";

/**
 * OPENING HOURS — the live open/closed status for the shop in Asia/Manila.
 * ============================================================================
 * TIMEZONE HANDLING is documented in `src/hooks/useOpenStatus.ts`. In short:
 * every conversion is `epochMs + 8h` read with `getUTC*`, so it is independent
 * of the host timezone and of the viewer's device timezone.
 *
 * HYDRATION
 *  The server renders the status for its own request time (`serverNowMs`),
 *  passed in by the page. The client then re-hydrates from the real device clock
 *  and recomputes on an interval and on tab visibility, so a page left open
 *  across closing time never shows a stale "Open now".
 *
 * EDGE CASES THAT ARE EXPLICITLY COVERED
 *  - 07:59 → "Closed · opens today at 8:00 AM"
 *  - 08:00 → "Open now · closes 5:00 PM"   (open edge is inclusive)
 *  - 16:00 → "Closing in 60 minutes · closes 5:00 PM"
 *  - 16:59 → "Closing in 1 min · closes 5:00 PM"
 *  - 17:00 → "Closed · opens tomorrow at 8:00 AM"  (close edge is exclusive)
 *  - 23:59 → same as 17:00 in terms of the next open window
 * ============================================================================
 */
import { Clock, Phone } from "lucide-react";
import { BUSINESS } from "@/config/site";
import { cn } from "@/lib/utils";
import { buildWeek, useOpenStatus } from "@/hooks/useOpenStatus";
import { Pill, WidgetCard } from "@/components/widgets/internal/ui";

export interface OpeningHoursProps {
  /** `Date.now()` from the server render. Strongly recommended. */
  serverNowMs?: number | undefined;
  className?: string;
  /** Hide the seven-day table (e.g. in a tight sidebar). */
  compact?: boolean;
  /** Render the "call us" fallback when closed. */
  showCallWhenClosed?: boolean;
  /** Disable the client interval for static pages / tests. */
  live?: boolean;
}

export default function OpeningHours({
  serverNowMs,
  className,
  compact = false,
  showCallWhenClosed = true,
  live = true,
}: OpeningHoursProps) {
  const status = useOpenStatus({ serverNowMs, live });
  const week = buildWeek(Date.now(), serverNowMs);

  return (
    <WidgetCard as="section" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2">
        <p className="eyg-eyebrow text-muted-foreground">Shop status</p>

        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={status.isOpen ? "success" : "danger"}>
            <Clock aria-hidden="true" className="size-3" focusable="false" />
            {/* Announced politely, and only when the state actually changes. */}
            <span aria-live="polite" aria-atomic="true">
              <span className="sr-only">{status.isOpen ? "Status: " : "Status: "}</span>
              <span aria-hidden="true">{status.isOpen ? "OPEN" : "CLOSED"}</span>
              <span className="sr-only">{status.spoken}</span>
            </span>
          </Pill>
          <span className="text-sm font-semibold text-foreground">{status.label}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Times are Philippine time ({status.timezone}). Update{" "}
          <span className="font-semibold">{status.todayYmd}</span> &middot;{" "}
          {status.isHydrated ? "live" : "as of page load"}.
        </p>
      </div>

      {!compact ? (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Opening hours for the next seven days</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Hours</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {week.map((row) => (
              <tr
                key={row.day}
                className={cn(
                  "border-b border-border last:border-b-0",
                  row.isToday && "font-bold",
                )}
              >
                <th scope="row" className="py-2 pr-3 text-left align-top">
                  {row.label}
                  {row.isToday ? <span className="ml-1 text-xs text-muted-foreground">(today)</span> : null}
                </th>
                <td className="py-2 pr-3 align-top tabular">
                  <span className={row.isClosed ? "text-muted-foreground" : ""}>{row.range}</span>
                </td>
                <td className="py-2 align-top text-right text-xs text-muted-foreground">
                  {row.isOpenNow ? (
                    <span className="font-semibold text-pit-700">{row.note}</span>
                  ) : row.isClosed ? (
                    <span>Closed</span>
                  ) : (
                    <span>{row.note}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {showCallWhenClosed && !status.isOpen ? (
        <p className="flex items-start gap-2 rounded-card border border-racing-300 bg-racing-50 p-3 text-sm text-racing-900">
          <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0" focusable="false" />
          <span>
            We are closed right now. If it is urgent — you are stranded or flat on the shoulder —
            call anyway and we will help.{" "}
            <a className="font-bold underline underline-offset-4" href={BUSINESS.phoneE164 ? `tel:${BUSINESS.phoneE164}` : undefined}>
              {BUSINESS.phoneDisplay}
            </a>
          </span>
        </p>
      ) : null}
    </WidgetCard>
  );
}

export { OpeningHours };