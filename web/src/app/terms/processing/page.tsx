import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui";

/*
 * The member-data counterpart to /privacy, which covers the waitlist only and
 * says explicitly that member records are governed by a separate agreement.
 * This is that agreement.
 *
 * Processor identity (updated 2026-09-01): stated as "casdey, operated by the
 * casdey team" with info@casdey.com as the contact. A registered legal/trading
 * entity and postal address are deliberately deferred until casdey registers one
 * (no P.IVA yet), Davide's explicit early-stage call. The residency line under
 * "Where it is held" was also corrected: it previously asserted member data is
 * "not transferred outside the UK or EEA", which is only true once the Vercel
 * function region is pinned to the EU (Dublin). Until that is confirmed, the doc
 * states only where the data is stored (EU/Ireland), which is true regardless.
 * Restore the stronger EEA-only claim once the Vercel region is set to dub1.
 *
 * Still deferred, not invented:
 *   - a signed copy, if a gym asks for one on paper. This page is the
 *     online version of the same terms.
 */

export const metadata: Metadata = {
  title: "Data processing terms",
  description:
    "How casdey processes member data on behalf of a gym or studio, and what each side is responsible for.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "1 September 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-14 text-[1.5rem] text-ink">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[1rem] leading-relaxed text-graphite">{children}</p>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-[1rem] leading-relaxed text-graphite">
          <span
            aria-hidden="true"
            className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProcessingTermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="py-20 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <p className="label text-stone">last updated {LAST_UPDATED}</p>
            <h1 className="display mt-4 text-[clamp(2rem,5vw,3rem)] text-ink">
              Data processing terms
            </h1>
            <P>
              These terms cover member data. They apply from the moment a
              gym uploads its first member list and sit alongside the{" "}
              <Link
                href="/privacy"
                className="text-teal underline underline-offset-4"
              >
                privacy notice
              </Link>
              , which covers only the details a gym gives us about itself.
            </P>

            <H2>Who is responsible for what</H2>
            <P>
              The gym is the data controller. It decides which members are
              uploaded, what is said to them, and when. casdey, operated by the
              casdey team and reachable at info@casdey.com, is the processor: it
              acts on the gym&apos;s instructions and does nothing with member
              data that the gym has not asked for.
            </P>
            <P>
              A gym confirms this, and confirms it has a lawful basis to
              contact these members about their membership, before casdey will
              accept a single record. The product refuses the upload otherwise.
            </P>

            <H2>What casdey holds</H2>
            <List
              items={[
                "Member name, email address and phone number, as given in the gym's own export.",
                "The date of their last visit and how many visits are on record.",
                "The gym's own reference for that member, where their software provides one.",
                "What casdey has done: which messages were sent and when, whether a member unsubscribed, and whether the gym recorded them as having returned.",
              ]}
            />
            <P>
              casdey does not hold health records, training or medical notes,
              images or payment details, and has no way to receive them.
            </P>

            <H2>What it is used for</H2>
            <P>
              One purpose: identifying members who have not been seen for a
              while and contacting them on the gym&apos;s behalf to invite
              them back. Member data is never sold, never shared with another
              gym, never used for advertising, and never used to train any
              model.
            </P>

            <H2>Where it is held</H2>
            <P>
              Your member data is stored in the European Union, in Ireland,
              encrypted in transit and at rest.
            </P>

            <H2>Who else touches it</H2>
            <P>
              casdey uses these sub-processors, and no others. Each is bound by
              equivalent terms.
            </P>
            <List
              items={[
                <>
                  <strong className="font-semibold text-ink">Supabase</strong>,
                  EU region, for storage and accounts.
                </>,
                <>
                  <strong className="font-semibold text-ink">Vercel</strong>,
                  for running the application.
                </>,
                <>
                  <strong className="font-semibold text-ink">Stripe</strong>,
                  for the gym&apos;s own subscription payments. Stripe
                  never receives member data.
                </>,
                <>
                  <strong className="font-semibold text-ink">
                    Zoho Mail, or Resend where configured
                  </strong>
                  , for delivering messages. These receive a member&apos;s
                  email address and the message text, and nothing else.
                </>,
                <>
                  <strong className="font-semibold text-ink">
                    Google Calendar
                  </strong>
                  , only if the gym chooses to connect one, for writing bookings
                  into the gym&apos;s own calendar. It receives the booked
                  member&apos;s name and email address, and is processed by
                  Google in the United States. A gym that does not connect a
                  calendar shares nothing with Google.
                </>,
                <>
                  <strong className="font-semibold text-ink">Twilio</strong>,
                  only if the gym turns on the WhatsApp channel, for sending and
                  receiving WhatsApp messages. It receives the member&apos;s
                  phone number and the message text, and processes them in the
                  United States. A gym that leaves WhatsApp off shares nothing
                  with Twilio.
                </>,
                <>
                  <strong className="font-semibold text-ink">Anthropic</strong>,
                  only for the WhatsApp channel, to write the replies in a
                  conversation once a member has answered. It receives the text
                  of that conversation and the gym&apos;s name, processes them in
                  the United States, and is contractually barred from training
                  on them. Not used for email.
                </>,
              ]}
            />

            <H2>How long it is kept</H2>
            <List
              items={[
                "Member records: for as long as the gym keeps its account, then deleted within 30 days of it closing.",
                "Immediately, and permanently, whenever the gym deletes a member or asks casdey to delete everything. Both are buttons in the product, not a support request.",
                "Unsubscribe records: kept indefinitely, and deliberately. They hold an email address and nothing else, and deleting them would mean somebody who asked to be left alone could be contacted again after the next import.",
                "The activity log: 24 months.",
              ]}
            />

            <H2>Member rights</H2>
            <P>
              A member&apos;s rights are exercised against the gym, which
              is their controller. casdey will help a gym answer any
              request, at no charge and without delay. Every message casdey
              sends carries a working unsubscribe link, and using it stops all
              contact from that gym through casdey immediately, including
              anything already queued.
            </P>

            <H2>If something goes wrong</H2>
            <P>
              casdey will tell the affected gym about any personal data
              breach without undue delay and in any case within 24 hours of
              becoming aware of it, with what is known at the time, and will
              keep the gym updated. Reporting to a supervisory authority is
              the gym&apos;s decision to make as controller, and casdey
              will provide whatever it needs to make it.
            </P>

            <H2>Ending the arrangement</H2>
            <P>
              A gym can export everything at any time and delete everything
              at any time, both from within the product. On account closure,
              member data is deleted within 30 days without needing to be
              asked.
            </P>

            <H2>Getting in touch</H2>
            <P>
              Questions about any of this go to{" "}
              <a
                href="mailto:info@casdey.com"
                className="text-teal underline underline-offset-4"
              >
                info@casdey.com
              </a>
              , and reach a person rather than a queue.
            </P>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
