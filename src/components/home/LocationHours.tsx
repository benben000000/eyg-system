import type { ReactElement } from "react";
import { Banknote, CalendarDays, MapPin, Navigation, Wallet } from "lucide-react";
import { BUSINESS, LINKS } from "@/config/site";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { OpenStatusPill } from "@/components/layout/OpenStatusPill";
import { PAYMENT_METHODS } from "@/components/layout/business";
import { formatSchedule, type OpenStatus } from "@/components/layout/hours";
import { TrackedCta } from "@/components/providers/TrackedCta";

/**
 * Location & hours. Everything on this section comes from `site.ts` — the
 * landmark line there is the one confirmed detail from the official page.
 */
export function LocationHours({ status }: { status: OpenStatus }): ReactElement {
  const schedule = formatSchedule();

  return (
    <Section labelledBy="location-title" tone="muted">
      <SectionHeading
        id="location-title"
        eyebrow="Find us"
        title="Right on the EGSA Fourlanes stretch in Tuyo"
        description="Easy to spot from the main road. If you are coming from Manila, take the exit to Balanga and keep going toward the four-lanes."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* ── Address + directions ─────────────────────────────────────── */}
        <Card tone="surface" padding="lg">
          <h3 className="flex items-center gap-2 text-h3 font-extrabold">
            <MapPin aria-hidden="true" className="size-6 text-brand-500" />
            {BUSINESS.legalName}
          </h3>

          <address className="mt-4 not-italic leading-relaxed">
            <span className="block text-lg font-bold text-foreground">
              {BUSINESS.address.street}
            </span>
            <span className="block text-muted-foreground">
              {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
              {BUSINESS.address.postalCode}, {BUSINESS.address.countryName}
            </span>
          </address>

          <p className="mt-4 text-sm text-muted-foreground">{BUSINESS.address.landmark}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <TrackedCta
              href={LINKS.directionsGoogle}
              event="directions_clicked"
              params={{ provider: "google" }}
              variant="accent"
              size="md"
              leadingIcon={<Navigation aria-hidden="true" className="size-5" />}
            >
              Get directions
            </TrackedCta>
            <TrackedCta
              href={LINKS.directionsWaze}
              event="directions_clicked"
              params={{ provider: "waze" }}
              variant="outline"
              size="md"
              leadingIcon={<Navigation aria-hidden="true" className="size-5" />}
            >
              Open in Waze
            </TrackedCta>
          </div>
        </Card>

        {/* ── Hours + payment ──────────────────────────────────────────── */}
        <Card tone="surface" padding="lg">
          <h3 className="flex items-center gap-2 text-h3 font-extrabold">
            <CalendarDays aria-hidden="true" className="size-6 text-brand-500" />
            Opening hours
          </h3>

          <div className="mt-4">
            <OpenStatusPill initial={status} variant="soft" />
          </div>

          <table className="mt-5 w-full text-sm">
            <caption className="sr-only">Weekly opening hours</caption>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.day} className="border-b border-border last:border-b-0">
                  <th scope="row" className="py-1.5 text-left font-semibold text-foreground">
                    {row.day}
                  </th>
                  <td className="py-1.5 text-right tabular text-muted-foreground">{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="eyg-eyebrow mt-6 flex items-center gap-2 text-muted-foreground">
            <Banknote aria-hidden="true" className="size-4" />
            We accept
          </h4>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method.id}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-muted px-2.5 py-1 text-eyebrow text-muted-foreground"
              >
                <Wallet aria-hidden="true" className="size-3.5" />
                {method.label}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/contact" variant="outline" size="md">
          Full contact details
        </LinkButton>
        <LinkButton href="/book" variant="primary" size="md">
          Book a bay online
        </LinkButton>
      </div>
    </Section>
  );
}
