import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui";

/*
 * Scope note: this notice covers the *waitlist* only, i.e. the details a
 * gym gives us on casdey.com before the product exists. Processing of
 * member records is a separate matter, governed by the data processing
 * agreement each gym signs, and must get its own notice before any
 * gym is onboarded.
 *
 * Before this page goes live, Davide needs to fill in:
 *   - the legal/trading identity of the controller and a postal address
 *     (required by UK GDPR art. 13 and EU GDPR art. 13). Left out here rather
 *     than invented.
 *   - the confirmed list of sub-processors once waitlist storage and the
 *     sending path are finalised.
 */

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How casdey handles the details you give us when you join the waitlist.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "13 August 2026";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display mt-14 text-[1.5rem] text-ink">{children}</h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[1rem] leading-relaxed text-graphite">{children}</p>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="py-20 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <p className="label text-stone">last updated {LAST_UPDATED}</p>
            <h1 className="display mt-4 text-[clamp(2rem,5vw,3rem)] text-ink">
              Privacy notice
            </h1>
            <P>
              This notice covers the details you give us when you join the
              casdey waitlist. It does not cover member records. casdey does
              not hold any member data yet, and when it does, that processing
              will be governed by a separate data processing agreement with each
              gym.
            </P>

            <H2>Who we are</H2>
            <P>
              casdey is the controller of the information described here. You
              can reach us at{" "}
              <a
                href="mailto:info@casdey.com"
                className="text-teal underline decoration-ash underline-offset-4 hover:decoration-teal"
              >
                info@casdey.com
              </a>{" "}
              about anything on this page, including any of the rights listed
              below.
            </P>

            <H2>What we collect</H2>
            <P>
              Only what the waitlist form asks for: your gym name, your
              work email address, and optionally the gym software you use.
              We also record the date you joined. There is nothing else, no
              tracking pixels, no advertising cookies, and no analytics that
              profiles you.
            </P>

            <H2>Why we collect it</H2>
            <P>
              To email you when casdey is ready for your gym, and to decide
              which gym software to support first. Our lawful basis is your
              consent, given by submitting the form for that stated purpose. You
              can withdraw it at any time and we will delete your entry.
            </P>

            <H2>What we will not do with it</H2>
            <P>
              We will not sell it, rent it, share it with third parties for
              their own purposes, send you a newsletter, or use it to contact
              you about anything other than casdey&apos;s launch and the free
              first week.
            </P>

            <H2>How long we keep it</H2>
            <P>
              Until casdey launches and you have either become a customer or
              told us you are not interested, and in any case no longer than 24
              months from the day you joined. After that the entry is deleted.
            </P>

            <H2>Where it is kept, and who else sees it</H2>
            <P>
              Your entry is stored in a database hosted in the EU. Three
              providers process it on our behalf, under contract, and none of
              them may use it for anything of their own: Supabase, which hosts
              the database, Vercel, which serves this website, and Zoho, which
              sends the emails. That is the whole list, and we will tell you if
              it changes.
            </P>

            <H2>Your rights</H2>
            <P>
              You can ask us for a copy of what we hold about you, correct it,
              delete it, restrict or object to how we use it, or have it sent to
              you in a portable format. Email info@casdey.com and we will action
              it within one month, usually much faster. If you are unhappy with
              how we have handled it you can complain to your national data
              protection authority, which in the UK is the Information
              Commissioner&apos;s Office.
            </P>

            <H2>Changes</H2>
            <P>
              If this notice changes in a way that affects you, we will email
              everyone on the waitlist rather than quietly update the page.
            </P>

            <div className="mt-16 border-t border-ash pt-8">
              <Link
                href="/"
                className="text-[0.9375rem] text-teal underline decoration-ash underline-offset-4 hover:decoration-teal"
              >
                Back to casdey
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
