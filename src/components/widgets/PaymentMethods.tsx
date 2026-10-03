import { Banknote, CalendarDays, CreditCard, Smartphone, Wallet } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { BUSINESS } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * PAYMENT METHODS — icon AND text label, always together.
 * ============================================================================
 * RULES ENFORCED HERE
 *  - Never an icon alone. A row of unlabelled logos is a logo wall, and a logo
 *    wall is not information. Every method renders its `label` as visible text.
 *  - Only methods that are actually present and non-placeholder render. A
 *    `TODO-VERIFY`, empty string or `example.com` value is dropped, and if
 *    nothing survives this renders `null` rather than an empty section.
 *  - Server Component — there is no interaction to hydrate.
 *
 * `BUSINESS.paymentMethods[].icon` vocabulary (from `src/config/site.ts`):
 *   "banknote" | "smartphone" | "wallet" | "credit-card" | "calendar"
 * Anything unknown falls back to a neutral card glyph, still labelled.
 * ============================================================================
 */

const ICONS: Readonly<Record<string, ComponentType<SVGProps<SVGSVGElement>>>> = {
  banknote: Banknote,
  smartphone: Smartphone,
  wallet: Wallet,
  "credit-card": CreditCard,
  calendar: CalendarDays,
};

const FALLBACK_ICON = CreditCard;

export interface PaymentMethodItem {
  id: string;
  label: string;
  icon?: string | null;
}

/** Drops blank values and anything still flagged as unconfirmed. */
function isUsable(method: PaymentMethodItem): boolean {
  const label = method.label?.trim() ?? "";
  if (label.length < 2) return false;
  if (/todo/i.test(label)) return false;
  if (/example\.com|placeholder|tbd/i.test(label)) return false;
  return true;
}

export interface PaymentMethodsProps {
  /** Defaults to `BUSINESS.paymentMethods`. */
  methods?: readonly PaymentMethodItem[];
  heading?: string;
  headingId?: string;
  className?: string;
  /** Compact single-row list for the footer / trust strip. */
  compact?: boolean;
}

export default function PaymentMethods({
  methods = BUSINESS.paymentMethods,
  heading,
  headingId,
  className,
  compact = false,
}: PaymentMethodsProps) {
  const usable = methods.filter(isUsable);
  if (usable.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {heading ? (
        <p id={headingId} className="eyg-eyebrow text-muted-foreground">
          {heading}
        </p>
      ) : null}
      <ul className="flex flex-wrap items-center gap-2" aria-labelledby={heading ? headingId : undefined}>
        {usable.map((method) => {
          const Icon = ICONS[method.icon ?? ""] ?? FALLBACK_ICON;
          return (
            <li
              key={method.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-card border border-border-strong bg-surface",
                compact ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "shrink-0 text-muted-foreground",
                  compact ? "size-3.5" : "size-4",
                )}
                focusable="false"
              />
              <span className="font-semibold text-foreground">{method.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Named export for the barrel, matching the default. */
export { PaymentMethods };