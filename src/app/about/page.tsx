/**
 * EYG — /about  ·  THE SHOP, THE PEOPLE, THE GUARANTEES
 * ============================================================================
 * ⚠️  THE MOST IMPORTANT FILE ON THE SITE, BECAUSE OF WHAT IT REFUSES TO SAY.
 *
 * `BUSINESS.trust.yearsServing`, `.technicians` and `.bays` are all `0` and
 * flagged `TODO-VERIFY` in `src/config/site.ts`. So this page:
 *
 *   • does NOT print a founding story with a made-up year
 *   • does NOT print a staff count
 *   • does NOT print "serving Balanga since 20XX"
 *   • does NOT print a star rating (and `ratingCount` is 0, so there is nothing
 *     honest to average)
 *   • does NOT claim certification, licensing or dealership status we cannot show
 *
 * Instead, every unverified number is either omitted or rendered through a
 * visible "we will confirm this" chip, and the copy is written so that it is
 * TRUE both with a placeholder and with a confirmed figure. Each placeholder is
 * marked inline with a `PLACEHOLDER:` comment for the owner.
 *
 * The guarantees ARE stated — because a shop that will not commit to anything
 * written down is the problem this page exists to answer.
 * ============================================================================
 */

import type { Metadata } from "next";
import { BUSINESS } from "@/config/site";
import { pageSeo, breadcrumbJsonLd } from "@/lib/seo";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink, Container, Eyebrow, Section } from "@/components/pages/_shims";
import { Divider } from "@/components/ui/Divider";
import { JsonLd } from "@/components/ui/JsonLd";
import { Breadcrumb, CtaBand, PageHeader } from "@/components/pages/_shared";
import {
  Eye,
  Gauge,
  Handshake,
  ListChecks,
  Lock,
  MapPin,
  ShieldCheck,
  Tag,
  ThumbsUp,
  TriangleAlert,
  Wrench,
} from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "About EYG Tire & Auto Care",
  description:
    "Who we are in Tuyo, Balanga City: the bay, the equipment, the guarantees we put in writing, and the things we will tell you can wait.",
  path: "/about",
  keywords: [
    "EGS Tire Auto Care about",
    "auto care Balanga shop",
    "trusted mechanic Balanga City",
    "PMS Balanga honest mechanic",
  ],
});

/** `true` while any trust figure in `site.ts` is still unconfirmed. */
const YEARS_UNCONFIRMED = BUSINESS.trust.yearsServing === 0;
const TECHICIANS_UNCONFIRMED = BUSINESS.trust.technicians === 0;
const BAYS_UNCONFIRMED = BUSINESS.trust.bays === 0;
/** `ratingCount === 0` means there is no honest average to print. */
const RATING_PUBLISHABLE = BUSINESS.trust.ratingCount > 0;

export default async function AboutPage(): Promise<React.ReactElement> {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} id="ld-breadcrumb-about" />

      <PageHeader
        eyebrow="About EYG"
        title="A small shop that would rather be right than impressive"
        lede={
          <>
            EYG Tire &amp; Auto Care is a tyre and auto care shop on the EGSA
            Fourlanes stretch in Tuyo, Balanga City. We are not a franchise and we do
            not pretend to be a dealership. We are a bay, some equipment, and people who
            would rather tell you something can wait than sell you a job.
          </>
        }
        actions={
          <>
            <ButtonLink href="/book" variant="cta" size="lg">
              Book a bay
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary" size="lg">
              Find us &amp; opening hours
            </ButtonLink>
          </>
        }
        footnote="We opened our doors in 2025 and we are still a young shop. We would rather say that than pretend to be an institution."
      />

      <Container className="pt-6">
        <Breadcrumb trail={crumbs} />
      </Container>

      {/* ── The story, told only as far as we can prove ──────────────────── */}
      <Section labelledBy="story-heading" space="md">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <div className="max-w-prose space-y-5">
              <Eyebrow>Who we are</Eyebrow>
              <h2 id="story-heading" className="text-h2">
                Built for the way people actually drive in Bataan
              </h2>
              <p>
                Most of our customers come off the EGSA stretch with a car that is
                tired, and they are often on the way to or from Manila with a schedule
                behind them. That single fact shapes everything about how this shop
                works.
              </p>
              <p>
                It means the first thing we do is ask what is actually wrong rather than
                what you think should be done. It means we keep the phones answered
                during working hours. It means we tell you honestly how long it will
                take, including when the answer is &ldquo;longer than you hoped&rdquo;.
                And it means we will hand you back the keys and send you on your way if
                what your car needs is not urgent.
              </p>
              <p>
                EYG opened our doors in 2025 on the Fourlanes stretch in Tuyo, Balanga
                City. Most of the people who walk in were referred by somebody they
                already know, which is the only marketing that has ever really worked
                for us.
              </p>
              <p className="flex gap-3 rounded-card border-2 border-border-strong bg-surface-muted p-4 text-sm leading-relaxed">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-500" />
                <span>
                  We are a young shop and we say so. You will not find a heritage
                  paragraph here about a legacy we do not have, because there is not one.
                  What we do have is the work in front of us and the people who brought
                  their car in.
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-panel border border-border bg-surface p-5">
                <h3 className="eyg-eyebrow mb-4 text-muted-foreground">The shop in numbers</h3>
                <FactRow
                  label="Where"
                  value={`${BUSINESS.address.street}, ${BUSINESS.address.district}`}
                  icon={MapPin}
                />
                <FactRow
                  label="Speciality"
                  value="Tyres, PMS, alignment, brakes, undercoating, car aircon"
                  icon={Wrench}
                />
                <FactRow
                  label="Open since"
                  value="2025"
                  icon={Gauge}
                  unconfirmed={false}
                />
                {/* PLACEHOLDER: `BUSINESS.trust.yearsServing` is 0 / TODO-VERIFY.
                    Once the owner confirms it, this renders the real figure and the
                    "confirming" chip disappears automatically. */}
                <FactRow
                  label="Years serving Balanga"
                  value={
                    YEARS_UNCONFIRMED
                      ? "Being confirmed with the owner — ask us and we will tell you straight"
                      : String(BUSINESS.trust.yearsServing)
                  }
                  icon={Handshake}
                  unconfirmed={YEARS_UNCONFIRMED}
                />
                {/* PLACEHOLDER: `BUSINESS.trust.bays` is 0 / TODO-VERIFY. */}
                <FactRow
                  label="Service bays"
                  value={
                    BAYS_UNCONFIRMED
                      ? "Not published yet — count them yourself when you arrive"
                      : String(BUSINESS.trust.bays)
                  }
                  icon={Gauge}
                  unconfirmed={BAYS_UNCONFIRMED}
                />
                {/* PLACEHOLDER: `BUSINESS.trust.technicians` is 0 / TODO-VERIFY. */}
                <FactRow
                  label="Technicians"
                  value={
                    TECHICIANS_UNCONFIRMED
                      ? "We will not put a headcount on a website. Ask who will be working on it."
                      : String(BUSINESS.trust.technicians)
                  }
                  icon={ThumbsUp}
                  unconfirmed={TECHICIANS_UNCONFIRMED}
                />
                {/* PLACEHOLDER: `ratingCount === 0`, so there is no honest average.
                    Nothing is printed rather than printing a 4.9 with no reviews
                    behind it, which is exactly the kind of claim that gets a small
                    shop in trouble. */}
                {!RATING_PUBLISHABLE ? (
                  <p className="mt-4 flex gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                    <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      We do not print a star rating here. A rating with no reviews behind
                      it is decoration, and we would rather you read the Facebook page —
                      which has real people in the comments.
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="rounded-panel border border-border bg-surface p-5">
                <h3 className="eyg-eyebrow mb-3 text-muted-foreground">
                  The bay and the equipment
                </h3>
                <ul className="space-y-2">
                  {EQUIPMENT.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed">
                      <ListChecks
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-pit-500"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      {/* ── Guarantees ───────────────────────────────────────────────────── */}
      <Section labelledBy="guarantees-heading" space="md" tone="muted">
        <Container className="space-y-10">
          <div className="max-w-prose space-y-3">
            <Eyebrow>In writing</Eyebrow>
            <h2 id="guarantees-heading" className="text-h2">
              What we promise, and what it costs us
            </h2>
            <p className="text-body-lg text-muted-foreground">
              A promise nobody would mind breaking is not a promise. These are the four
              commitments we hold ourselves to, stated plainly enough that you could hold
              us to them.
            </p>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2">
            {GUARANTEES.map(({ icon: Icon, title, body, tone }) => (
              <li
                key={title}
                className={
                  tone === "accent"
                    ? "space-y-3 rounded-panel border-2 border-brand-500 bg-surface p-6"
                    : "space-y-3 rounded-panel border border-border bg-surface p-6"
                }
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-card bg-surface-muted text-brand-500 ring-1 ring-border-strong"
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="text-h3">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                {tone === "accent" ? (
                  <Badge tone="brand" size="sm" dot>
                    The main one
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      {/* ── Brands ───────────────────────────────────────────────────────── */}
      <Section labelledBy="brands-heading" space="md">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
            <div className="space-y-3">
              <Eyebrow>What we carry</Eyebrow>
              <h2 id="brands-heading" className="text-h2">
                Tyre brands we carry
              </h2>
              <p className="text-body-lg text-muted-foreground">
                We stock and fit these. If your tyre is not on this list, ask anyway —
                we can usually get a size in, and we will tell you honestly how long
                that takes.
              </p>
            </div>

            <div className="space-y-5">
              <ul className="flex flex-wrap gap-2.5">
                {BUSINESS.tireBrands.map((brand) => (
                  <li
                    key={brand}
                    className="flex min-h-11 items-center rounded-card border border-border bg-surface px-4 font-display text-sm font-extrabold uppercase tracking-wide"
                  >
                    {brand}
                  </li>
                ))}
              </ul>

              {/* The authorisation caveat is mandatory, per the brief. Rendered
                  in full, not as a footnote. */}
              <p className="flex gap-3 rounded-card border-2 border-brand-700 bg-brand-50 p-4 text-sm leading-relaxed text-brand-900 dark:bg-brand-900/25 dark:text-brand-100">
                <Tag aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <span>
                  <strong className="block">We list a brand only if we genuinely carry
                  it.</strong>
                  These are the names on our shelf and in our fitment bay. We do not
                  describe ourselves as an authorised dealer for any brand unless the
                  brand has confirmed it in writing — and we will not put a logo on this
                  page to imply a relationship we do not have. If you want a specific
                  brand, ring us first and we will tell you whether we can fit it that
                  day.
                </span>
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      {/* ── What we do / what we don't ──────────────────────────────────── */}
      <Section labelledBy="scope-heading" space="md" tone="muted">
        <Container>
          <div className="max-w-prose space-y-3">
            <Eyebrow>Scope, honestly</Eyebrow>
            <h2 id="scope-heading" className="text-h2">
              What we do, and what we will hand to somebody else
            </h2>
            <p className="text-body-lg text-muted-foreground">
              A shop that claims to do everything has either a very large bay or a very
              loose definition of quality. This is ours, in two columns.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-panel border-2 border-pit-600 bg-surface p-6">
              <h3 className="flex items-center gap-2 text-h3">
                <ThumbsUp aria-hidden="true" className="size-5 text-pit-600" />
                What we do
              </h3>
              <ul className="space-y-2">
                {WE_DO.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed">
                    <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pit-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 rounded-panel border-2 border-border-strong bg-surface p-6">
              <h3 className="flex items-center gap-2 text-h3">
                <Eye aria-hidden="true" className="size-5 text-brand-500" />
                What we will not do
              </h3>
              <ul className="space-y-2">
                {WE_DONT.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-center font-bold">
                      –
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand
        title="Judge us on the next job"
        body="Everything on this page is a claim. The only thing that settles it is the work we do on your car, and whether you would send somebody you know to us. Book a slot, or walk in and ask a question first."
        primary={{ label: "Book a bay", href: "/book" }}
        secondary={{ label: "See services & honest prices", href: "/services" }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function FactRow({
  label,
  value,
  icon: Icon,
  unconfirmed = false,
}: {
  label: string;
  value: string;
  icon: typeof MapPin;
  /** `true` renders the honest "being confirmed" treatment. */
  unconfirmed?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="eyg-eyebrow text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">
          {value}
          {unconfirmed ? (
            <Badge tone="neutral" size="sm" className="ml-2 align-middle">
              <TriangleAlert aria-hidden="true" className="size-3" />
              Not confirmed
            </Badge>
          ) : null}
        </p>
      </div>
    </div>
  );
}

const EQUIPMENT: readonly string[] = [
  "Tyre-changing and balancing equipment, so a tyre is mounted properly rather than levered on",
  "Computerised four-wheel alignment rack, front and rear, with a printed report you keep",
  "Two-post lift for anything underneath — brakes, suspension, oil, undercoating",
  "Diagnostic scan tool that reads fault codes before we order a single part",
  "Battery load tester, because a voltage reading alone does not tell you if it will start tomorrow",
  "Refrigerant recovery machine for aircon, so we do not vent your Freon into the street",
];

const GUARANTEES: ReadonlyArray<{
  icon: typeof ShieldCheck;
  title: string;
  body: string;
  tone?: "accent" | "plain";
}> = [
  {
    icon: ShieldCheck,
    title: "Workmanship guarantee",
    body: `If something we fitted or adjusted fails because of the work rather than the part, we put it right at no charge. We currently stand behind ${BUSINESS.trust.workmanshipGuaranteeDays} days of workmanship on the work itself — ask us for the terms in writing and you will get them. Parts carry their own manufacturer's warranty, which is theirs and not ours to promise.`,
    tone: "accent",
  },
  {
    icon: Tag,
    title: "Price confirmed before the work",
    body: "You get a written estimate before we start and a final price before we do anything. If the job turns out to need more than we quoted, we stop and ask. Nobody at this shop has ever added a line to your invoice that you did not agree to on the spot.",
  },
  {
    icon: ListChecks,
    title: "The written list is yours",
    body: "Every inspection ends with a list you keep, sorted into &ldquo;do now&rdquo;, &ldquo;watch it&rdquo; and &ldquo;nothing to worry about&rdquo;. It belongs to you, we do not hold it hostage, and you can take it to another shop for a second opinion.",
  },
  {
    icon: Handshake,
    title: "We will tell you what can wait",
    body: "A large part of what we find on a first inspection is not urgent. We will say so, and we will not push it. If we think a job is genuinely unsafe we will say that too, in plain words, and explain what happens if you drive away.",
  },
];

const WE_DO: readonly string[] = [
  "Tyres: changeovers, mounting, balancing, rotation, puncture repair done from the inside",
  "Wheel alignment, front and rear, with a printed before-and-after report",
  "Preventive maintenance service — PMS A, B and C, and the brake fluid flush most people skip",
  "Brakes: pads, discs, fluid, and the measurement written down before anything comes off",
  "Suspension work: shock absorbers, CVL, bushings — diagnosed before quoted",
  "Undercoating for coastal roads, flood-prone streets and the talahiban",
  "Car aircon: diagnosis, regas, belt, compressor — with a measured vent temperature afterwards",
  "Batteries, and the charging system that killed the last one",
  "Roadside help anywhere in Bataan, including mobile tyre changes",
];

const WE_DONT: readonly string[] = [
  "Engine rebuilds, head gasket work, or anything we would need to strip the engine twice",
  "Bodywork and paint. We are not a panel shop and pretending otherwise wastes your week",
  "Airbag, SRS and body-electronics specialist faults. We will tell you who does that properly locally",
  "Electrical rewiring jobs on modern vehicles. We diagnose, we do not rewire",
  "Fabricating a part to fit a fault instead of replacing the part",
  "Anything that needs a part we cannot source honestly — we will say &ldquo;we cannot get that&rdquo;",
];
