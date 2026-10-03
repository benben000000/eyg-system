/**
 * EYG — LIVE SHOP STATUS
 * ============================================================================
 * Server-computed from `BUSINESS_HOURS` in `Asia/Manila`.
 *
 * The single most expensive mistake on a shop site is getting this wrong: a page
 * that says "Closed" at 10 AM on a Tuesday loses the customer and teaches them
 * not to trust the site. The maths lives in `@/components/pages/_hours`, which
 * goes through `Intl.DateTimeFormat` with an explicit `timeZone` rather than
 * reading the server's own clock — the server is almost certainly on UTC.
 *
 * Colour is never the only signal: every state carries an icon AND a sentence.
 * `aria-live` is deliberately NOT set — the value is correct on first paint, so
 * announcing it on hydration would be noise.
 * ============================================================================
 */

import { cn } from "@/lib/utils";
import { BUSINESS_HOURS, TIMEZONE } from "@/config/site";
import type { ShopStatus } from "@/components/pages/_hours";
import { Clock, Moon, Sun, Sunrise, Sunset } from "@/components/pages/_icons";

export interface ShopStatusBadgeProps {
  status: ShopStatus;
  className?: string;
  /** `band` for the full hazard treatment, `chip` for inline use. */
  size?: "chip" | "band";
}

const ICON_FOR_TONE = {
  open: Sun,
  "closing-soon": Sunset,
  "opens-soon": Sunrise,
  closed: Moon,
} as const;

/**
 * BRAND RULE: flat fills, no translucent colour wash.
 * `dark:bg-pit-900/40` was a 40%-opacity wash on near-black, which reads as a
 * halo. Solid planes keep the status legible and on-brand; the brand yellow is
 * reserved for the state the shop actually wants to advertise.
 */
const TONE_CLASSES = {
  open: "border-brand-500 bg-brand-500 text-ink-950",
  "closing-soon": "border-brand-700 bg-brand-100 text-brand-900",
  "opens-soon": "border-ink-400 bg-ink-100 text-ink-950",
  closed: "border-border-strong bg-surface-muted text-foreground",
} as const;

const DARK_TONE_CLASSES = {
  open: "dark:border-brand-500 dark:bg-brand-500 dark:text-ink-950",
  "closing-soon": "dark:border-brand-600 dark:bg-ink-900 dark:text-brand-300",
  "opens-soon": "dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200",
  closed: "dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300",
} as const;

export function ShopStatusBadge({
  status,
  className,
  size = "chip",
}: ShopStatusBadgeProps): React.ReactElement {
  const Icon = ICON_FOR_TONE[status.tone];
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-card border-2 font-bold",
        size === "chip" ? "px-4 py-3 text-sm" : "px-5 py-4 text-base",
        TONE_CLASSES[status.tone],
        DARK_TONE_CLASSES[status.tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>
        <span className="block">{status.label}</span>
        <span className="mt-0.5 block text-sm font-normal opacity-90">{status.detail}</span>
      </span>
    </p>
  );
}

/** The hazard-hatch variant, used only for the "closing soon" urgency state. */
export function ClosingSoonBand({ status }: { status: ShopStatus }): React.ReactElement | null {
  if (status.tone !== "closing-soon") return null;
  return (
    <div className="relative overflow-hidden rounded-panel border-2 border-brand-500">
      <div aria-hidden="true" className="eyg-hazard h-2.5 w-full" />
      <div className="space-y-1 p-4">
        <p className="font-display text-sm font-extrabold uppercase tracking-wide">
          Closing soon
        </p>
        <p className="text-sm text-muted-foreground">
          {status.detail} Booked customers get priority on a freed bay, but call first
          so we know you are coming.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOURS TABLE
// ─────────────────────────────────────────────────────────────────────────────

export interface HoursTableProps {
  rows: ReadonlyArray<{
    key: string;
    dayLabel: string;
    shortLabel: string;
    opensText: string;
    closesText: string;
    closed: boolean;
    status: "today" | "upcoming";
  }>;
}

/**
 * The next seven days, computed in Manila local time.
 * `<caption>` + `scope` headers, and `aria-current="date"` on today — not a bold
 * row, which a screen reader would skip past.
 */
export function HoursTable({ rows }: HoursTableProps): React.ReactElement {
  const closedDays = rows.filter((r) => r.closed).map((r) => r.dayLabel);
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="border-b border-border bg-surface-muted px-5 py-3 text-left text-sm font-bold">
          Opening hours for the next seven days, Manila time ({TIMEZONE}).
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-5 py-2.5 font-display text-eyebrow uppercase tracking-widest text-muted-foreground">
              Day
            </th>
            <th scope="col" className="px-5 py-2.5 text-right font-display text-eyebrow uppercase tracking-widest text-muted-foreground">
              Hours
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.key} className={row.status === "today" ? "bg-brand-50 dark:bg-brand-900/20" : undefined}>
              <th
                scope="row"
                className="px-5 py-3 font-normal"
                aria-current={row.status === "today" ? "date" : undefined}
              >
                <span className="font-bold">{row.dayLabel}</span>
                {row.status === "today" ? (
                  <span className="ml-2 rounded-pill bg-brand-500 px-2 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-widest text-ink-950">
                    Today
                  </span>
                ) : null}
              </th>
              <td className="tabular px-5 py-3 text-right">
                {row.closed ? (
                  <span className="font-bold text-muted-foreground">Closed</span>
                ) : (
                  <span>
                    {row.opensText} – {row.closesText}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex items-start gap-2 border-t border-border px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {closedDays.length > 0
            ? `Closed ${closedDays.join(" and ")}. `
            : "Open every day listed. "}
          Public holidays and shop-wide shutdowns are posted on Facebook ahead of time.
          Times are {TIMEZONE} (UTC+8), which is the shop&rsquo;s own clock.
        </span>
      </p>
    </div>
  );
}

/**
 * A one-line summary of the whole schedule, for the meta description and for
 * the header of the page.
 */
export function hoursSummary(): string {
  const open = BUSINESS_HOURS.filter((d) => !d.closed);
  const closed = BUSINESS_HOURS.filter((d) => d.closed);
  if (open.length === 7) return "Open 8:00 AM to 5:00 PM, every day";
  const mins = open[0]?.opens ?? 0;
  const maxes = open[0]?.closes ?? 0;
  return `Open ${format12(mins)} to ${format12(maxes)}${
    closed.length > 0 ? `, closed ${closed.map((d) => `${d.label}s`).join(" and ")}` : ""
  }`;
}

function format12(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}:00 ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
