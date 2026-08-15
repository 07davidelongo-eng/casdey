import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui";

/*
 * The patient-data counterpart to /privacy, which covers the waitlist only and
 * says explicitly that patient records are governed by a separate agreement.
 * This is that agreement.
 *
 * Still to be filled in before a real practice is onboarded, and deliberately
 * left blank rather than invented:
 *   - the legal or trading identity of casdey and a postal address, required
 *     of a processor by UK GDPR art. 28 and EU GDPR art. 28. The same gap is
 *     already flagged on /privacy.
 *   - confirmation of the sub-processor list below once the sending path is
 *     settled. Resend is listed conditionally because it is only used when a
 *     key is configured.
 *   - a signed copy, if a practice asks for one on paper. This page is the
 *     online version of the same terms.
 */

export const metadata: Metadata = {
  title: "Data processing terms",
  description:
    "How casdey processes patient data on behalf of a dental practice, and what each side is responsible for.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "13 August 2026";

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
              These terms cover patient data. They apply from the moment a
              practice uploads its first patient list and sit alongside the{" "}
              <Link
                href="/privacy"
                className="text-teal underline underline-offset-4"
              >
                privacy notice
              </Link>
              , which covers only the details a practice gives us about itself.
            </P>

            <H2>Who is responsible for what</H2>
            <P>
              The practice is the data controller. It decides which patients are
              uploaded, what is said to them, and when. casdey is the processor:
              it acts on the practice&apos;s instructions and does nothing with
              patient data that the practice has not asked for.
            </P>
            <P>
              A practice confirms this, and confirms it has a lawful basis to
              contact these patients about their care, before casdey will accept
              a single record. The product refuses the upload otherwise.
            </P>

            <H2>What casdey holds</H2>
            <List
              items={[
                "Patient name, email address and phone number, as given in the practice's own export.",
                "The date of their last visit and how many visits are on record.",
                "The practice's own reference for that patient, where their software provides one.",
                "What casdey has done: which messages were sent and when, whether a patient unsubscribed, and whether the practice recorded them as having rebooked.",
              ]}
            />
            <P>
              casdey does not hold clinical records, treatment history, notes,
              images or payment details, and has no way to receive them.
            </P>

            <H2>What it is used for</H2>
            <P>
              One purpose: identifying patients who have not been seen for a
              while and contacting them on the practice&apos;s behalf to invite
              them back. Patient data is never sold, never shared with another
              practice, never used for advertising, and never used to train any
              model.
            </P>

            <H2>Where it is held</H2>
            <P>
              In the European Union, in Ireland, encrypted in transit and at
              rest. It is not transferred outside the UK or EEA.
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
                  for the practice&apos;s own subscription payments. Stripe
                  never receives patient data.
                </>,
                <>
                  <strong className="font-semibold text-ink">
                    Zoho Mail, or Resend where configured
                  </strong>
                  , for delivering messages. These receive a patient&apos;s
                  email address and the message text, and nothing else.
                </>,
              ]}
            />

            <H2>How long it is kept</H2>
            <List
              items={[
                "Patient records: for as long as the practice keeps its account, then deleted within 30 days of it closing.",
                "Immediately, and permanently, whenever the practice deletes a patient or asks casdey to delete everything. Both are buttons in the product, not a support request.",
                "Unsubscribe records: kept indefinitely, and deliberately. They hold an email address and nothing else, and deleting them would mean somebody who asked to be left alone could be contacted again after the next import.",
                "The activity log: 24 months.",
              ]}
            />

            <H2>Patient rights</H2>
            <P>
              A patient&apos;s rights are exercised against the practice, which
              is their controller. casdey will help a practice answer any
              request, at no charge and without delay. Every message casdey
              sends carries a working unsubscribe link, and using it stops all
              contact from that practice through casdey immediately, including
              anything already queued.
            </P>

            <H2>If something goes wrong</H2>
            <P>
              casdey will tell the affected practice about any personal data
              breach without undue delay and in any case within 24 hours of
              becoming aware of it, with what is known at the time, and will
              keep the practice updated. Reporting to a supervisory authority is
              the practice&apos;s decision to make as controller, and casdey
              will provide whatever it needs to make it.
            </P>

            <H2>Ending the arrangement</H2>
            <P>
              A practice can export everything at any time and delete everything
              at any time, both from within the product. On account closure,
              patient data is deleted within 30 days without needing to be
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
