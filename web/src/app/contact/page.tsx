import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Container, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach casdey directly: email info@casdey.com or message @casdey.co on Instagram. A person answers, usually the same day.",
  alternates: { canonical: "/contact" },
};

/**
 * Deliberately not a contact form.
 *
 * A form is the right pattern when the volume is high enough that routing
 * matters. casdey is small, and a gym owner deciding whether to trust it
 * with a member list is better served by seeing who they would be writing
 * to than by dropping a message into a queue.
 */

const CHANNELS = [
  {
    label: "Email",
    value: "info@casdey.com",
    href: "mailto:info@casdey.com",
    body: "Comes to a person, not a queue. Answered the same day, usually.",
  },
  {
    label: "Instagram",
    value: "@casdey.co",
    href: "https://instagram.com/casdey.co",
    body: "Fine for a quick question, and the fastest way to get hold of us on a weekend.",
  },
  {
    label: "Already using casdey",
    value: "The help panel",
    href: "/app",
    body: "Bottom right of every screen in the product. It answers most things on the spot and reaches us when it cannot.",
  },
];


export default function ContactPage() {
  return (
    <>
      <SiteHeader sections={false} />
      <main>
        <section className="relative overflow-hidden py-14 sm:py-20">
          <div
            aria-hidden="true"
            className="grain pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,color-mix(in_srgb,var(--teal-bright)_13%,transparent),transparent_72%)]"
          />

          <Container className="relative">
            <Eyebrow>Contact</Eyebrow>
            <h1 className="display mt-5 max-w-[18ch] text-[clamp(1.9rem,3.4vw,2.9rem)] text-ink text-balance">
              Ask us anything. A person reads every message.
            </h1>
            <p className="mt-6 max-w-[54ch] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
              No ticket number, no chatbot, no form that goes nowhere. Ask
              about the product, your own list, or what happens to your
              members&apos; data. If casdey is not right for your gym we will
              tell you that too.
            </p>

            <div className="mt-12 overflow-hidden rounded-[20px] border border-ash bg-white">
              <dl className="grid divide-y divide-ash sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {CHANNELS.map((c) => (
                  <div key={c.label} className="p-8 sm:p-9">
                    <dt className="label text-teal">{c.label}</dt>
                    <dd>
                      <a
                        href={c.href}
                        className="display mt-3 block text-[1.375rem] leading-tight text-ink underline decoration-ash underline-offset-[6px] transition-colors duration-200 hover:decoration-teal"
                      >
                        {c.value}
                      </a>
                      <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
                        {c.body}
                      </p>
                    </dd>
                  </div>
                ))}
              </dl>

            </div>

            <p className="mt-8 max-w-[54ch] text-[0.8125rem] leading-relaxed text-stone">
              casdey is run from Italy and serves gyms across the UK and the EU.
              For anything about your members&apos; data specifically, including
              a request to delete it, the{" "}
              <a
                href="/privacy"
                className="text-teal underline decoration-ash underline-offset-4 transition-colors duration-200 hover:decoration-teal"
              >
                privacy notice
              </a>{" "}
              says who is responsible for what.
            </p>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
