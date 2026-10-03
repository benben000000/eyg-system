/**
 * EYG — /privacy  ·  DATA PRIVACY NOTICE
 * ============================================================================
 * A genuine Data Privacy Act 2012 (RA 10173) compliant notice.
 *
 * It is written for a real customer, not for a compliance auditor: short
 * sentences, named processors, and the specific rights the Act actually grants.
 * The sections follow the Act's own logic — what we collect, why, the lawful
 * basis, how long, who else sees it, what you can demand, cookies, children.
 *
 * ⚠️  ACTION REQUIRED BEFORE LAUNCH — the owner, not a developer:
 *   1. Register this notice with the National Privacy Commission and put the
 *      registration number in the section below. RA 10173 requires notification;
 *      the placeholder below is deliberately NOT a number.
 *   2. Insert the real DPO / contact person's name and designation.
 *   3. Confirm the named processors actually process EYG data (listed in §7).
 *   4. Sign this off in the same week the phone number in `site.ts` is confirmed.
 * ============================================================================
 */

import type { Metadata } from "next";
import { BUSINESS } from "@/config/site";
import { pageSeo } from "@/lib/seo";
import {
  LegalContactBlock,
  LegalPage,
  type LegalSection,
} from "@/components/pages/legal/LegalPage";
import { Container, ButtonLink } from "@/components/pages/_shims";
import { ShieldCheck } from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "Privacy Notice",
  description:
    "How EYG Tire & Auto Care collects, uses, stores and shares your personal data under the Data Privacy Act 2012, and how to exercise your rights.",
  path: "/privacy",
});

const LAST_UPDATED = "2026-10-02";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are and what this covers",
    summary: "This is the privacy notice for the EYG website and for data we hold about customers.",
    body: (
      <>
        <p>
          This notice explains what personal data {BUSINESS.legalName} collects when you
          use this website, when you book with us, when you contact us, and when you
          bring your vehicle into the shop. It also explains what we do with that data
          and what you can require us to do with it.
        </p>
        <p>
          We are the data controller for that information. We are a tyre and auto care
          shop in {BUSINESS.address.district}, {BUSINESS.address.province}, not a
          software company, so there is no data team behind this page — there is a
          person at the counter who answers your questions.
        </p>
        <p>
          It applies to this website, our Facebook page, our WhatsApp and Messenger
          conversations, and the records we keep when we work on your vehicle. It does
          not cover a third-party website you visit from ours, or a brand whose
          website you use to research tyres — those have their own notices.
        </p>
        <p>
          We have deliberately written this in ordinary language. If a sentence here is
          unclear, ask us and we will explain it properly, in Taglish if that helps.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    heading: "What personal data we collect",
    summary: "The short list: your name, your phone number, your email if you give it, and your vehicle's details.",
    body: (
      <>
        <h3>Contact details you give us</h3>
        <ul>
          <li>
            <strong>Your name</strong> — so we know who to look for when you arrive and
            who to address on a written estimate.
          </li>
          <li>
            <strong>Your mobile number</strong> — to send your booking confirmation, a
            reminder on the day, and to reply when you ask us something. This is the one
            we genuinely cannot run a booking without.
          </li>
          <li>
            <strong>Your email address</strong> — only if you ask for a written reply or
            a copy of a document. It is optional on every form on this site.
          </li>
          <li>
            <strong>Your Facebook profile</strong> — if you message us on Facebook or
            WhatsApp instead of filling in a form. We then hold whatever you chose to
            send us.
          </li>
        </ul>

        <h3>Vehicle and job details</h3>
        <ul>
          <li>
            <strong>Your vehicle&apos;s year, make, model, variant and plate number</strong> —
            so we fit the right tyres and oil, and so we can look up what we last did to
            your car.
          </li>
          <li>
            <strong>Your odometer reading and the work you booked</strong> — so we know
            what the car needs and when it is next due.
          </li>
          <li>
            <strong>What you tell us about a fault</strong> — in your own words, in a
            booking note, or in a message. This is often the most useful thing you send
            us.
          </li>
          <li>
            <strong>Photographs of your vehicle or its paperwork</strong> — only the ones
            you choose to send us, for example a photo of a tyre sidewall to read the
            size.
          </li>
        </ul>

        <h3>Technical data, collected automatically</h3>
        <ul>
          <li>
            <strong>Basic server logs</strong> — your browser&apos;s user agent, the page you
            requested, and the time. This is standard web hosting behaviour and it keeps
            the site up and secure.
          </li>
          <li>
            <strong>Nothing else is collected automatically.</strong> We do not run
            advertising trackers, we do not build a profile of your browsing, and we do
            not sell data to anyone.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "why",
    heading: "Why we collect it, and the lawful basis",
    summary: "We collect it because you asked us to do a job, and because our lawful basis is your consent or our legitimate interest in running the business.",
    body: (
      <>
        <p>
          Under the Data Privacy Act of 2012 (Republic Act No. 10173), we must tell you
          the lawful basis for processing your data. Ours are the following.
        </p>

        <h3>Consent</h3>
        <p>
          When you book, we ask you to tick a box giving permission for us to text you
          about that booking. That is consent, and it is specific: it covers the
          confirmation, the reminder and any message we send about that job. It does
          <em> not</em> cover marketing. Marketing is a separate, unticked-by-default
          box, and you can opt out of it at any time.
        </p>
        <p>
          You may withdraw consent at any time. Withdrawing it does not make the
          processing we did before you withdrew it unlawful, and it does not affect a
          booking you have already made — we will still need a way to reach you about
          that booking.
        </p>

        <h3>Legitimate interest</h3>
        <p>
          We also rely on our legitimate interest in operating a working shop. That
          covers keeping the service history of your vehicle, so that next time you come
          in we can tell you when the last oil change was instead of guessing. It covers
          invoicing and keeping receipts, because tax law requires it. It covers replying
          to you when you ask us something. It covers keeping the site secure.
        </p>
        <p>
          Where we rely on legitimate interest, we have decided that your interests do
          not outweigh ours, and that the impact on you is low — because the data is
          about your own car and your own enquiry. If you think that is wrong, tell us
          and we will consider it.
        </p>

        <h3>Contract</h3>
        <p>
          Some processing is necessary to perform a contract with you — if you book a PMS,
          we need your contact details in order to perform the service and bill you
          correctly. This is not optional, and it is not a consent we can talk you out of.
        </p>
      </>
    ),
  },
  {
    id: "how-long",
    heading: "How long we keep it",
    summary: "Service records for as long as you own the vehicle and then a while longer. Marketing consent until you withdraw it. Everything else only as long as we need it.",
    body: (
      <>
        <h3>Vehicle service history</h3>
        <p>
          We keep service records for as long as you own the vehicle and for{" "}
          <strong>five years</strong> after the last work we did, because that is the
          window within which a manufacturer warranty or a defect claim can surface. After
          that we delete them.
        </p>

        <h3>Bookings and quotes</h3>
        <p>
          Booking records are kept for <strong>three years</strong> from the appointment.
          That covers disputes, warranty questions and the tax records we are required to
          keep. After three years they are deleted.
        </p>

        <h3>Invoices and receipts</h3>
        <p>
          Kept for <strong>ten years</strong>, because the Bureau of Internal Revenue
          requires financial records to be retained for that period. We cannot delete
          these on request, and we will tell you so rather than pretend otherwise.
        </p>

        <h3>Marketing consent</h3>
        <p>
          Kept until you withdraw it. The moment you opt out, we stop sending offers and
          we record the opt-out so we do not accidentally re-add you.
        </p>

        <h3>Unsuccessful enquiries</h3>
        <p>
          If you send us a message about work you never booked, we keep it for{" "}
          <strong>twelve months</strong> and then delete it. We are not going to hold a
          quote request forever.
        </p>

        <h3>Server logs</h3>
        <p>
          Rotated automatically by our hosting provider, typically within{" "}
          <strong>ninety days</strong>.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Who else sees your data",
    summary: "A short list of processors — the companies that deliver our texts, host the site, and run the accounts you already have.",
    body: (
      <>
        <p>
          We do not sell your data. We do not trade it. We do not pass it to advertisers.
          We share it only with the companies that have to be involved to deliver a
          service you asked for. Those companies are processors, and they are not allowed
          to use your data for their own purposes.
        </p>
        <ul>
          <li>
            <strong>SMS and messaging providers</strong> — the service that delivers your
            booking confirmation and your reminders. They see your number and the
            message content.
          </li>
          <li>
            <strong>Our email provider</strong> — the service that delivers anything we
            send you by email.
          </li>
          <li>
            <strong>Google</strong> — Google Maps is used on the contact page, and if you
            press &ldquo;show the map&rdquo; or tap a directions link, Google receives
            your request and may use your location. We do not load the map until you ask
            for it, and we do not run Google Analytics on this site.
          </li>
          <li>
            <strong>Meta (Facebook and Messenger)</strong> — if you contact us that way,
            and if you see or interact with our Facebook page.
          </li>
          <li>
            <strong>Our web host and email host</strong> — the infrastructure that serves
            this site and holds our inbox.
          </li>
          <li>
            <strong>Government agencies</strong> — if we are legally required to disclose
            something. We will tell you that we have done so, unless we are forbidden to.
          </li>
        </ul>
        <p>
          Some of these companies store data outside the Philippines. Where they do, we
          rely on the standard contractual protections those providers put in place, and
          we have chosen providers that publish their own data-handling commitments.
        </p>
        <p>
          If we ever change who processes your data in a way that materially affects you,
          we will update this page and, where the change is significant, tell you
          directly.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    heading: "Who might see your data inside the shop",
    summary: "The mechanic working on your car, and whoever is on the counter when you come in.",
    body: (
      <p>
        This one is obvious but worth writing down. If you bring your car in, the
        technician working on it and the person at the counter will see your details and
        the job card. That is unavoidable and it is necessary. We do not discuss your
        vehicle or your bill with anyone else, and we do not use customer stories, names
        or photographs on this website or on Facebook without asking you first.
      </p>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights",
    summary: "Access, correction, deletion, portability, objection, and withdrawing consent. The Act gives you all six, and we do not make them difficult.",
    body: (
      <>
        <p>
          The Data Privacy Act gives you specific rights over your personal data. You do
          not need to give a reason, you do not need a lawyer, and you do not need to
          fill in a form we invented. A text or an email is enough to start.
        </p>

        <h3>Right to be informed</h3>
        <p>
          You can ask what data we hold about you, where it came from, how we use it, and
          who we share it with. That is what this notice is — and if you want the version
          specific to you, ask.
        </p>

        <h3>Right to access</h3>
        <p>
          You can ask for a copy of the personal data we hold about you. We will give it
          to you in a form you can actually read, normally by email. We may ask you to
          confirm your identity first so we do not send your file to the wrong person.
        </p>

        <h3>Right to correct</h3>
        <p>
          If something is wrong — a misspelled name, a plate number from an old car, a
          phone number you no longer use — tell us and we will correct it. This also
          applies to a third party who gave us the wrong information about you.
        </p>

        <h3>Right to delete</h3>
        <p>
          You can ask us to erase your data. We will do it, with three honest exceptions
          where we cannot: invoices and receipts, which tax law requires us to keep for
          ten years; a booking that is still live, which we need in order to honour it;
          and anything we would be required to retain to establish or defend a legal
          claim. Where an exception applies, we will tell you exactly which one and why,
          and we will delete everything else.
        </p>

        <h3>Right to portability</h3>
        <p>
          You can ask us to give you your data in a structured, commonly used,
          machine-readable format so you can move it to another provider or keep it. We
          will use CSV or JSON.
        </p>

        <h3>Right to object</h3>
        <p>
          You can object to processing we are doing on the basis of legitimate interest
          — for example, being contacted about an offer. If you object, we will stop,
          unless there is a compelling reason not to, and we will explain that reason if
          there is one.
        </p>

        <h3>Right to withdraw consent</h3>
        <p>
          If you gave consent, you can take it back at any time, in the same way you gave
          it. Reply to a message with the word STOP, or tell us at the counter, or email
          us. Withdrawing marketing consent does not touch your booking, and withdrawing
          your booking consent does not cancel work we have already agreed — it just means
          we will stop texting you.
        </p>

        <h3>Right to be compensated</h3>
        <p>
          If you suffer damage because we mishandled your data, you may claim
          compensation. We would rather resolve a genuine complaint directly than make you
          go to a regulator to do it, so please tell us first.
        </p>
      </>
    ),
  },
  {
    id: "how-to-exercise",
    heading: "How to exercise a right",
    summary: "Email us or come into the shop. There is no form and no portal, because we are a shop and not a bank.",
    body: (
      <>
        <p>
          Send an email to{" "}
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> with the word
          &ldquo;privacy&rdquo; in the subject, or come into the shop during opening
          hours and ask for the person on the counter. That is genuinely all.
        </p>
        <p>Useful things to include:</p>
        <ul>
          <li>Which right you are exercising — access, correction, deletion, and so on.</li>
          <li>Your name and the plate number or mobile number we would have you under.</li>
          <li>Enough for us to be confident we have found the right person. We will ask for
            identification if the request would release information about somebody else.</li>
        </ul>
        <p>
          We will respond within <strong>fifteen days</strong>. If we need longer,
          because the request is genuinely complex, we will tell you why and when we will
          come back. We do not charge for a reasonable request, and we do not make you
          explain why you are asking.
        </p>
        <p>
          Postal correspondence is also welcome at the address at the end of this notice.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies, analytics and advertising",
    summary: "The site sets what it needs to work and nothing else. No advertising cookies, no cross-site tracking, no cookie wall.",
    body: (
      <>
        <p>
          We keep this simple on purpose. The website sets only the cookies and similar
          storage that are technically necessary for it to operate.
        </p>
        <ul>
          <li>
            <strong>Session and preference storage</strong> — so the booking wizard can
            hold your selections between steps. This is on your own device and it is
            cleared when you close the tab.
          </li>
          <li>
            <strong>Rate limiting</strong> — a temporary marker that stops one device
            from flooding our booking endpoint. It expires quickly and it contains
            nothing identifiable.
          </li>
          <li>
            <strong>No advertising or analytics cookies.</strong> We do not run Google
            Analytics, Meta Pixel, or any advertising tracker. There is no cookie banner
            on this site because there is nothing to consent to.
          </li>
        </ul>
        <p>
          If we ever introduce analytics, we will update this section, explain what it is
          for, and — because some of our customers are on metered mobile data — let you
          decline it without losing the ability to book. We will not put a wall in front
          of the booking form to force a decision.
        </p>
        <p>
          Your browser can delete cookies at any time. Doing so may mean the booking
          wizard forgets your in-progress selections, but it will not stop you booking.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children's data",
    summary: "This is a shop website. We do not knowingly collect data from anyone under eighteen.",
    body: (
      <>
        <p>
          Our services are for vehicles and their owners, and the person booking must be
          able to enter a contract, so in practice that means adults. We do not knowingly
          collect personal data from anyone under eighteen.
        </p>
        <p>
          If you are under eighteen and you have sent us something — for example a
          message about a car in your household — tell us and we will delete it and not
          use it for anything.
        </p>
        <p>
          If you are a parent or guardian and you believe a child has sent us personal
          data, contact us and we will remove it.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "How we protect it",
    summary: "The practical list, with the honest caveat that no small business can promise perfection.",
    body: (
      <>
        <p>
          We take reasonable and appropriate steps to protect your data:
        </p>
        <ul>
          <li>The website is served over HTTPS, so data in transit is encrypted.</li>
          <li>Access to booking records is limited to the people who need it to do their
            job.</li>
          <li>We use reputable providers for hosting, email and messaging rather than
            rolling our own.</li>
          <li>We do not store card details. Payment is taken in person at the counter, and
            we never ask for a card number over the phone, by text or through this site.</li>
        </ul>
        <p>
          We will be straight with you: a small shop is not a bank, and we cannot promise
          that no breach will ever happen. What we will promise is that if something does
          go wrong, we will find out, we will fix it, and we will tell the affected
          customers and the National Privacy Commission as the law requires — rather than
          hoping nobody noticed.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this notice",
    summary: "We will date every change and keep the old version available on request.",
    body: (
      <>
        <p>
          We may update this notice when our systems, our processors or the law change.
          The date at the top of this page tells you which version you are reading.
        </p>
        <p>
          If a change materially affects how we use your data, we will tell you directly
          — by text or email, not only by quietly editing a web page. You can ask us for
          any previous version at any time.
        </p>
      </>
    ),
  },
  {
    id: "registration",
    heading: "Registration and contact",
    summary: "The details the Act requires us to publish, including the registration number we are required to hold.",
    body: (
      <>
        <p>
          Under the Data Privacy Act of 2012, a personal information controller that
          processes personal data for profit or commercial purposes must register with the
          National Privacy Commission and record its registration in its privacy notice.
        </p>
        <p>
          <strong>
            National Privacy Commission registration number: to be inserted once
            registered.
          </strong>{" "}
          <span className="text-muted-foreground">
            We have left this blank rather than print a number that does not exist. A
            fabricated registration number in a privacy notice is a serious problem, not
            a formatting oversight — the owner must complete the registration before this
            page is published, and this line must then be filled in with the real number.
          </span>
        </p>
        <p>
          The National Privacy Commission is at the CyberOne Eastwood building in Quezon
          City. Its public contact details are on{" "}
          <a href="https://privacy.gov.ph" rel="noopener noreferrer" target="_blank">
            privacy.gov.ph
          </a>
          .
        </p>
      </>
    ),
  },
] as const;

export default function PrivacyPage(): React.ReactElement {
  return (
    <LegalPage
      path="/privacy"
      breadcrumbName="Privacy Notice"
      eyebrow="Legal"
      title="Privacy Notice"
      lede="What we collect when you book with us, why we collect it, who else sees it, and what you can require us to do about it. Written plainly, because you should be able to read this without a lawyer."
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      after={
        <>
          <LegalContactBlock />
          <Container className="mt-8 print:hidden">
            <div className="flex flex-wrap items-center gap-3 rounded-panel border-2 border-border-strong bg-surface-muted p-5">
              <ShieldCheck aria-hidden="true" className="size-6 shrink-0 text-brand-500" />
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
                Read enough? The practical version: we hold your name, your number and
                your car&rsquo;s details so we can do the work and text you back. We do
                not sell any of it, and one email deletes the lot.
              </p>
              <ButtonLink href="/book" variant="cta" size="md">
                Book a bay
              </ButtonLink>
            </div>
          </Container>
        </>
      }
    />
  );
}
