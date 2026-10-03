/**
 * EYG — /terms  ·  TERMS OF USE
 * ============================================================================
 * Plain-English terms a shop owner would recognise as fair.
 *
 * The honesty clause is the centre of this document: estimates on this website are
 * indicative, the final price is confirmed after inspection, and nothing is done
 * that you have not approved. That clause exists to protect the customer and the
 * shop equally — without it, an online estimate is a trap for both sides.
 *
 * Governing law: the Republic of the Philippines. Venue: the proper courts in
 * Bataan, with the Regional Trial Court of the Province of Bataan named as the
 * venue, because that is where both parties are.
 * ============================================================================
 */

import type { Metadata } from "next";
import { BUSINESS, BOOKING, TIMEZONE } from "@/config/site";
import { pageSeo } from "@/lib/seo";
import {
  LegalContactBlock,
  LegalPage,
  type LegalSection,
} from "@/components/pages/legal/LegalPage";
import { Container, ButtonLink } from "@/components/pages/_shims";
import { ShieldCheck } from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "Terms of Use",
  description:
    "The terms for using the EYG Tire & Auto Care website, booking an appointment, and how pricing, cancellation and liability work.",
  path: "/terms",
});

const LAST_UPDATED = "2026-10-02";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "about-these-terms",
    heading: "About these terms",
    summary: "These terms cover your use of this website and the bookings you make through it.",
    body: (
      <>
        <p>
          These terms apply to everyone who uses this website and to every booking made
          through it. By using the site or pressing Confirm on a booking, you accept
          them.
        </p>
        <p>
          These terms are written for a real customer to read. Where a phrase needs to be
          precise, it is precise, but we have tried not to hide behind precision. Nothing
          here is a trick and nothing here is one-sided.
        </p>
        <p>
          We may update these terms. The date at the top tells you which version you are
          reading, and the version that applied is the one that applied at the time you
          booked.
        </p>
      </>
    ),
  },
  {
    id: "estimates",
    heading: "Prices on this website are estimates, not quotes",
    summary: "The most important clause on this page. Read it before you rely on any figure here.",
    body: (
      <>
        <p>
          <strong>
            Every peso figure on this website is an estimate. It is indicative. The final
            price is confirmed with you after a technician inspects your vehicle, before
            any work starts.
          </strong>
        </p>
        <p>
          We publish ranges rather than single numbers because a single number would have
          to assume a specific vehicle, engine and parts condition. When we print a range,
          what moves it is:
        </p>
        <ul>
          <li>
            <strong>Vehicle size</strong> — an SUV or a light commercial van needs more
            bay time, bigger tyres and a longer alignment than a hatchback.
          </li>
          <li>
            <strong>Oil and consumable grade</strong> — fully synthetic sits above
            conventional; platinum and iridium plugs above copper.
          </li>
          <li>
            <strong>The condition of the parts we find</strong> — brake discs, tie-rod
            ends and bushings wear on their own schedule, and we measure rather than
            assume.
          </li>
          <li>
            <strong>Anything we cannot price honestly from a web page</strong> — a job
            marked &ldquo;ask us&rdquo; on the services page is priced after we have seen
            the vehicle. We will not put a number on it over the phone that we cannot
            stand behind.
          </li>
        </ul>
        <p>
          If the final price differs from the estimate, we stop and tell you before doing
          anything. You can accept it or decline it. If you decline, the vehicle goes
          back together and you pay for the inspection only.
        </p>
        <p>
          Nothing is added to your invoice that you did not agree to on the spot, and a
          discount is never something that appears only at the till. If an offer is
          described on this site or on our Facebook page, it is applied before the work
          starts.
        </p>
      </>
    ),
  },
  {
    id: "booking",
    heading: "Booking an appointment",
    summary: "What a booking does and does not commit you to. It reserves bay time, it does not reserve a specific mechanic.",
    body: (
      <>
        <h3>What a booking does</h3>
        <p>
          It reserves bay time for the date and slot you chose, and it tells us what to
          have out so we are not scrambling when you arrive. You will receive a text
          message with a booking reference, usually within a minute.
        </p>

        <h3>What a booking does not do</h3>
        <p>
          It does not reserve a specific mechanic. On a busy morning we may run slightly
          behind. If we are more than about thirty minutes late, we will tell you and
          reschedule at your convenience rather than let you wait in silence.
        </p>
        <p>
          It does not commit you to any spend. No payment is taken at booking. The work
          and the price are agreed with you at the counter, and you are free to change
          your mind about the work at that point.
        </p>

        <h3>Accuracy of what you submit</h3>
        <p>
          Please give us the right vehicle details. If you book a service that needs a
          part we cannot fit because the model year is wrong, we will have to charge for
          the time or reschedule you, and we will tell you before we start. We cannot
          undo a wasted bay visit.
        </p>

        <h3>Lead time and horizon</h3>
        <p>
          We ask for at least {Math.round(BOOKING.minLeadMinutes / 60)} hour&rsquo;s
          notice, and bookings can be taken up to {BOOKING.horizonDays} days ahead. A
          minimum notice exists so that we can gather the parts and the bay, not to make
          you jump through a hoop. If you need same-day help, call — that is exactly
          what the phone is for.
        </p>

        <h3>Limits on a single booking</h3>
        <p>
          A single booking can cover up to {BOOKING.maxServicesPerBooking} services. If
          you need more than that, call us and we will plan it over two visits — which is
          usually cheaper for you than cramming everything into one bay slot.
        </p>
      </>
    ),
  },
  {
    id: "cancellation",
    heading: "Changing or cancelling",
    summary: "Tell us as early as you can. We try hard to re-fit anyone who cancels, and that only works if we know.",
    body: (
      <>
        <p>
          Life in Bataan involves the EGSA. If you need to change or cancel, reply to
          your confirmation text or call us. As early as you can, please.
        </p>
        <ul>
          <li>
            <strong>More than 24 hours before</strong> — no problem at all. Reply to the
            text or call. We will release the bay and re-book you whenever suits.
          </li>
          <li>
            <strong>Less than 24 hours before</strong> — tell us anyway. We will do our
            best. No charge, because we have not bought your parts yet.
          </li>
          <li>
            <strong>No-show, same day, no message</strong> — this is the one that costs
            us. The bay is held, the parts are out, and somebody else was turned away. We
            may charge a fee to cover it, which we will explain to you honestly and
            without drama.
          </li>
        </ul>
        <p>
          We are not going to charge you for a late cancellation caused by traffic on the
          expressway, and we are not going to make you argue about it. Tell us what
          happened.
        </p>
        <p>
          If we have to cancel on our side — a parts delay, an equipment problem, an
          emergency — we will tell you as soon as we know, offer you the next slot or a
          full refund of anything you paid, and apologise without a paragraph of
          corporate wording.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    heading: "Availability, prices and promotions can change",
    summary: "A booking request is not a guarantee of a slot, and an offer can end on the day it said it would.",
    body: (
      <>
        <p>
          The availability shown on this website reflects our current bay capacity. It is
          accurate when it loads, and it is not a guarantee: by the time you press
          Confirm, another customer may have taken the slot. If that happens we tell you
          immediately, keep everything you have entered, and show you the times that are
          still free.
        </p>
        <p>
          Promotions run for the dates published alongside them and end on those dates.
          We do not extend an offer quietly and we do not create fake scarcity. If an
          offer has ended, the page says it ended and tells you when. Prices and tyre
          availability can change without notice — tyre stock in particular moves daily —
          and we will always confirm the current price with you before committing to it.
        </p>
        <p>
          Any discount code is subject to its own published terms, which appear in full
          on the offer itself. We do not have hidden conditions, and we do not apply a
          discount retroactively to work already invoiced.
        </p>
      </>
    ),
  },
  {
    id: "your-responsibilities",
    heading: "What we ask of you",
    summary: "Four reasonable things. The last one matters most.",
    body: (
      <>
        <ul>
          <li>
            <strong>Give us accurate details</strong> — vehicle, contact number and what
            the car is doing.
          </li>
          <li>
            <strong>Answer the phone number you gave us.</strong> If we cannot reach you
            about your booking, we will have to release the bay.
          </li>
          <li>
            <strong>Remove your personal belongings.</strong> Cars contain documents,
            phones, tools and loose change. We are not liable for items left in a vehicle
            while it is with us. Please take them with you.
          </li>
          <li>
            <strong>Tell us about existing damage before we start</strong> — on the
            panelwork, the wheels or the glass. It is the only fair way to handle a
            question about a mark that was there when the car came in.
          </li>
        </ul>
        <p>
          A booking made by someone else on your behalf is still your booking. Whoever
          fills in the form is responsible for the accuracy of what they submit.
        </p>
      </>
    ),
  },
  {
    id: "warranty",
    heading: "Warranty on our workmanship",
    summary: "We stand behind the work we do. Parts carry their own manufacturer's warranty, which is theirs.",
    body: (
      <>
        <p>
          If something we fitted or adjusted fails because of the work rather than the
          part, we will put it right at no charge. We currently stand behind{" "}
          <strong>{BUSINESS.trust.workmanshipGuaranteeDays} days</strong> of workmanship
          on the work itself. Ask us for the terms in writing and you will get them.
        </p>
        <p>
          Three honest limits on that:
        </p>
        <ul>
          <li>
            <strong>Parts are not ours to warrant.</strong> A tyre, battery or shock
            absorber carries the manufacturer&rsquo;s own warranty. We will help you claim
            it, and we will not pretend our guarantee extends the life of a part.
          </li>
          <li>
            <strong>Tyres we did not sell are not warranted by us.</strong> We will fit
            and balance a customer-supplied tyre — that is normal work — but we cannot
            promise its lifespan.
          </li>
          <li>
            <strong>Wear is not a defect.</strong> Tyres wear out, pads wear down, and
            undercoating thins with use. That is what the service intervals are for.
          </li>
        </ul>
        <p>
          We also do not warrant work that has been altered, adjusted or worked on by
          somebody else after we finished it. If you want a second opinion or another
          garage has had the car, tell us — we will still look at it, we will just be
          honest about what we can and cannot stand behind.
        </p>
      </>
    ),
  },
  {
    id: "site-use",
    heading: "Using this website",
    summary: "Look at it, read it, print it. Do not scrape it, attack it, or pretend to be us.",
    body: (
      <>
        <p>You are welcome to:
        </p>
        <ul>
          <li>read the pages, prices, terms and opening hours;</li>
          <li>print any page for your own reference;</li>
          <li>share a link to any page with anyone you like;</li>
          <li>use the booking form and the contact form as intended.</li>
        </ul>
        <p>You may not:
        </p>
        <ul>
          <li>
            copy, republish or scrape the whole site or its content for a competing
            business, or reproduce it as your own;
          </li>
          <li>
            interfere with the site, probe it for vulnerabilities without telling us
            first, or attempt to gain access to anything that is not yours;
          </li>
          <li>
            submit false bookings, misleading enquiries, or content that is unlawful or
            abusive;
          </li>
          <li>
            use our name, logo, photographs or trade marks in a way that suggests you
            are us or that we endorse you, without our written permission.
          </li>
        </ul>
        <p>
          We may block access where a request looks automated or abusive. That is to keep
          the booking system working for actual customers, not to shut anyone out.
        </p>
      </>
    ),
  },
  {
    id: "content-accuracy",
    heading: "Accuracy of the information on this site",
    summary: "We try hard to be right and we correct things. We cannot promise the site is perfect at all times.",
    body: (
      <>
        <p>
          We check opening hours, prices and terms before publishing, and we correct them
          when they change. But this is a small shop website, not a live system wired to
          our stock ledger, and things do go out of date.
        </p>
        <p>
          In particular:
        </p>
        <ul>
          <li>
            <strong>Opening hours</strong> are published for planning. A public holiday or
            an emergency closure is announced on Facebook first.
          </li>
          <li>
            <strong>Tyre stock and sizes</strong> move daily. We do not advertise a size
            we cannot fit that day, but we cannot guarantee it until we have confirmed it
            with you.
          </li>
          <li>
            <strong>Service descriptions</strong> describe what a job normally involves.
            Your vehicle may need something different, and only an inspection tells us
            which.
          </li>
          <li>
            <strong>Photographs</strong> on the gallery page are of our own work once
            they are published. Until then we show a clear placeholder rather than
            borrowing somebody else&rsquo;s pictures.
          </li>
        </ul>
        <p>
          If you find something wrong on this site, tell us and we will fix it. That
          includes our own mistakes — we would rather be told.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    heading: "Limits of our liability",
    summary: "What we are responsible for, what we are not, and the one cap that applies.",
    body: (
      <>
        <h3>What we are responsible for</h3>
        <p>
          We are responsible for doing the work we agreed to do, competently and with
          reasonable care, for the workmanship guarantee above, and for telling you the
          price before starting.
        </p>

        <h3>What we are not responsible for</h3>
        <ul>
          <li>
            <strong>Consequential loss.</strong> If your car is in the bay and you miss a
            meeting, we are not liable for the cost of the meeting. If a fault causes
            damage to your property, our liability is limited to putting it right.
          </li>
          <li>
            <strong>Pre-existing faults.</strong> We are not liable for damage caused by a
            problem that existed before the work, or by work somebody else did.
          </li>
          <li>
            <strong>Parts we did not supply</strong>, and their fitment to a vehicle whose
            details were given incorrectly.
          </li>
          <li>
            <strong>Items left in the vehicle</strong> while it is with us.
          </li>
          <li>
            <strong>Delays caused by circumstances outside our control</strong> — a parts
            shortage, a power cut, a road closure. We will tell you and we will try to
            help, but we cannot guarantee a completion time we do not control.
          </li>
          <li>
            <strong>Our website</strong>, to the extent permitted by law. We keep it up
            and we test it, but we do not warrant that it will be available at every
            moment or error-free. If the site is down, phone us — we can still take your
            booking.
          </li>
        </ul>

        <h3>The cap</h3>
        <p>
          Except where Philippine law does not allow it to be limited — including
          liabilities that cannot lawfully be excluded, and anything arising from our
          wilful misconduct — our total liability to you in connection with any single
          vehicle and any single visit is limited to{" "}
          <strong>the amount you paid us for that visit</strong>, or{" "}
          <strong>₱10,000</strong>, whichever is greater.
        </p>
        <p>
          That is not a way of avoiding responsibility. It is there so that a small
          business can survive one bad day. If something has gone wrong and you think we
          are wrong about it, come and talk to us first — we will put it right if we are
          at fault, without you having to threaten a lawyer.
        </p>
      </>
    ),
  },
  {
    id: "third-party",
    heading: "Third-party links and services",
    summary: "Links to Google Maps, Waze, Facebook and WhatsApp are to services we do not control.",
    body: (
      <>
        <p>
          This site links to Google Maps, Waze, Facebook, WhatsApp and Messenger, and it
          embeds a Google map. Those are third-party services. Once you follow a link or
          load a map, you are on somebody else&rsquo;s platform under their own terms and
          their own privacy notice, not ours.
        </p>
        <p>
          We are not responsible for the content, accuracy or availability of those
          services, and we do not control what they do with your data once you are there.
          We have chosen to link only to services a Filipino driver already uses, and we
          have kept the map behind a button so nothing is requested from Google until you
          ask for it.
        </p>
        <p>
          We are also not responsible for the content of any other website that links to
          ours, or for any arrangement you enter into with a third party.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    heading: "Intellectual property",
    summary: "Our name, logo, photographs and copy belong to us. You may read and share them; you may not resell them.",
    body: (
      <>
        <p>
          The EYG name, the logo and lockup, the photographs of our work, the written copy
          on this site and the layout of the pages belong to {BUSINESS.legalName} or to
          our licensors. They are protected by the Intellectual Property Code of the
          Philippines (Republic Act No. 8292) and by copyright generally.
        </p>
        <p>
          You may read, print and share our pages for your own use, and you may quote a
          sentence from them — for example, when you are telling somebody else what we
          charge for a job. Credit us when you do.
        </p>
        <p>
          You may not reproduce substantial parts of the site, republish it, use it to
          build a competing listing, or remove any credit or trade mark from it.
        </p>
        <p>
          Third-party names, including tyre brands, service terms and the automotive
          vocabulary locals use, belong to their respective owners and are used here to
          describe the work accurately. Their appearance on this site is not a claim of a
          commercial relationship, and we will remove any mark on request from a rights
          holder.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    heading: "Indemnity",
    summary: "One narrow, mutual obligation.",
    body: (
      <p>
        You agree to indemnify us against loss arising from your unlawful use of this
        website, from a misrepresentation you make in a booking or enquiry that causes us
        to order the wrong parts or waste bay time, or from your breach of these terms. We
        agree to be equally straightforward about our own breaches.
      </p>
    ),
  },
  {
    id: "law",
    heading: "Governing law and venue",
    summary: "The law of the Philippines, and the courts in Bataan.",
    body: (
      <>
        <p>
          These terms are governed by and construed in accordance with the laws of the
          Republic of the Philippines, without regard to any conflict-of-laws principle
          that would apply foreign law.
        </p>
        <p>
          The parties submit to the exclusive jurisdiction of the courts of the Province
          of Bataan, Philippines — in particular the Regional Trial Court of Bataan, and
          the Municipal Trial Courts of the City of Balanga where appropriate — for any
          dispute arising out of or in connection with these terms or with any work we do
          on your vehicle.
        </p>
        <p>
          We chose Bataan because it is where we are and where you are, and because
          neither of us should have to travel to Manila to argue. You retain any right to
        proceed in the court of your residence that cannot lawfully be waived.
        </p>
        <p>
          Before either of us goes to court, we will both try to settle it the way
          sensible people in the same province do: at the counter, in person, with the
          paperwork on the table. That is not a legal dodge. It is genuinely the fastest
          way to get to a fair answer.
        </p>
      </>
    ),
  },
  {
    id: "general",
    heading: "General",
    summary: "If part of this turns out to be unenforceable, the rest still stands.",
    body: (
      <>
        <p>
          If any provision of these terms is held to be unenforceable, the rest remains
          in force. If we do not enforce a provision, that is not a waiver of it later.
          A change to these terms applies from the date shown at the top of this page and
          does not affect bookings made before it.
        </p>
        <p>
          You may not assign your rights under these terms to somebody else. We may
          update these terms as our business or the law changes, as described above.
        </p>
        <p>
          Nothing in these terms limits your rights under the Data Privacy Act of 2012,
          or under any consumer protection law that applies to you as a consumer in the
          Philippines. If a clause here would take away a right you have by law, that
          clause does not apply.
        </p>
      </>
    ),
  },
] as const;

export default function TermsPage(): React.ReactElement {
  return (
    <LegalPage
      path="/terms"
      breadcrumbName="Terms of Use"
      eyebrow="Legal"
      title="Terms of Use"
      lede={`The terms for using this website and booking with us. The important one is in section 2: prices on this site are estimates, and the final figure is confirmed with you after an inspection, before any work starts.`}
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      after={
        <>
          <LegalContactBlock
            heading="Questions about these terms"
            intro="If any of this is unclear, ask before you book rather than after. We would far rather explain it at the counter than have a disagreement later."
          />
          <Container className="mt-8 print:hidden">
            <div className="flex flex-wrap items-center gap-3 rounded-panel border-2 border-border-strong bg-surface-muted p-5">
              <ShieldCheck aria-hidden="true" className="size-6 shrink-0 text-brand-500" />
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
                The one to remember:{" "}
                <strong className="text-foreground">
                  we confirm the price with you before the work starts, and you decide.
                </strong>{" "}
                Everything else on this page follows from that.
              </p>
              <ButtonLink href="/book" variant="cta" size="md">
                Book a bay
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              All times referred to in these terms are {TIMEZONE} (UTC+8).
            </p>
          </Container>
        </>
      }
    />
  );
}
