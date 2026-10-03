/**
 * EYG — CONTACT CHANNELS
 * ============================================================================
 * Every direct line a customer can use, as a proper `tel:` / `https://wa.me/` /
 * `mailto:` link.
 *
 * THE RULE: if `BUSINESS.phoneE164` is still the `TODO-VERIFY` placeholder
 * (`+639000000000`), NO `tel:` link is rendered. The channel is shown disabled
 * with an honest "number being confirmed" note. A dead `tel:` link on a shop
 * website is worse than no number at all — the customer taps it, hears nothing,
 * and concludes the shop does not answer.
 * ============================================================================
 */

import { BUSINESS, LINKS } from "@/config/site";
import { phoneIsUnconfirmed } from "@/components/pages/_shared";
import { Mail, MessageCircle, Phone, TriangleAlert, paymentIcon } from "@/components/pages/_icons";

interface Channel {
  id: string;
  label: string;
  value: string;
  /** `null` means the fact is unconfirmed, so no link is rendered at all. */
  href: string | null;
  icon: typeof Phone;
  note: string;
}

export function ContactChannels({ className }: { className?: string }): React.ReactElement {
  const phoneUnconfirmed = phoneIsUnconfirmed(BUSINESS.phoneE164);
  const whatsappUnconfirmed = phoneIsUnconfirmed(BUSINESS.whatsappNumber);
  const landline = BUSINESS.phoneLandline;

  const channels: Channel[] = [
    {
      id: "phone",
      label: "Call the shop",
      value: BUSINESS.phoneDisplay,
      href: phoneUnconfirmed ? null : LINKS.call,
      icon: Phone,
      note: "Fastest for anything urgent. A person answers during working hours.",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      value: whatsappUnconfirmed ? "Number being confirmed" : `+${BUSINESS.whatsappNumber}`,
      href: whatsappUnconfirmed ? null : LINKS.whatsapp,
      icon: MessageCircle,
      note: "Send a photo of the tyre sidewall or the dashboard warning light — it saves a whole trip.",
    },
    {
      id: "messenger",
      label: "Messenger",
      value: "m.me/EYGTireAutoCare",
      href: BUSINESS.social.messenger,
      icon: MessageCircle,
      note: "The fastest way to reach us if you are on Facebook anyway.",
    },
    {
      id: "email",
      label: "Email",
      value: BUSINESS.email,
      href: `mailto:${BUSINESS.email}`,
      icon: Mail,
      note: "Best for anything that needs a document, a receipt or a long explanation.",
    },
  ];

  // A landline only appears once it is a real number, for the same reason.
  if (landline && !phoneIsUnconfirmed(landline)) {
    channels.push({
      id: "landline",
      label: "Landline",
      value: landline,
      href: `tel:${landline.replace(/[^+\d]/g, "")}`,
      icon: Phone,
      note: "Shop floor extension.",
    });
  }

  return (
    <ul className={className ?? "grid gap-3 sm:grid-cols-2"}>
      {channels.map((c) => {
        const Icon = c.icon;
        return (
          <li key={c.id}>
            {c.href === null ? (
              <div
                role="note"
                className="flex h-full items-start gap-3 rounded-card border-2 border-dashed border-border-strong bg-surface-muted p-4"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-card bg-surface text-muted-foreground"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <TriangleAlert aria-hidden="true" className="size-3.5 text-brand-500" />
                    {c.label} — number being confirmed
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    We are not showing a number we have not verified. Use Messenger or
                    email below and we will get back to you.
                  </p>
                </div>
              </div>
            ) : (
              <a
                href={c.href}
                className="flex h-full items-start gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-brand-500"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-card bg-surface-muted text-brand-500 ring-1 ring-border-strong"
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-sm font-bold underline decoration-2 underline-offset-4">
                    {c.label}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{c.value}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {c.note}
                  </span>
                </span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The accepted payment methods, from `BUSINESS.paymentMethods`.
 * Rendered as a labelled icon row — the label is always visible, because a grid
 * of unlabelled payment logos is useless to a screen-reader user and ambiguous
 * to everyone else.
 */
export function PaymentMethods({ className }: { className?: string }): React.ReactElement {
  return (
    <ul
      className={
        className ?? "flex flex-wrap items-center gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3"
      }
    >
      {BUSINESS.paymentMethods.map((m) => {
        const Icon = paymentIcon(m.icon);
        return (
          <li
            key={m.id}
            className="flex min-h-11 items-center gap-2.5 rounded-card border border-border bg-surface px-3.5 py-2.5"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0 text-brand-500" />
            <span className="text-sm font-bold">{m.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRACTICAL NOTE
// ─────────────────────────────────────────────────────────────────────────────

export interface DriveOverNoteProps {
  /** The id of the heading this block is labelled by — wire it to the `<Section>`. */
  headingId: string;
  rows: ReadonlyArray<{ title: string; body: string; icon: typeof Phone }>;
}

/**
 * "Before you drive over". Practical, specific, and only ever states what the
 * shop actually knows — parking, what to bring, and whether to call ahead.
 */
export function DriveOverNote({ headingId, rows }: DriveOverNoteProps): React.ReactElement {
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-h3">
        Before you drive over
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ title, body, icon: Icon }) => (
          <li key={title} className="space-y-2 rounded-card border border-border bg-surface p-4">
            <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
              <Icon aria-hidden="true" className="size-4 text-brand-500" />
              {title}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
