import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WaitlistForm } from "@/components/waitlist-form";
import { MemberTimeline } from "@/components/marks/member-timeline";
import { Container, Eyebrow } from "@/components/ui";

// Without its own openGraph/twitter blocks, this page inherits the root
// layout's, so a shared /waitlist link would preview with the homepage's URL
// and copy. Set them explicitly here. This link is what the cold-outreach
// emails point at, so the preview needs to be waitlist-specific.
const waitlistTitle = "Join the casdey waitlist";
const waitlistDescription =
  "Gyms and studios on the casdey waitlist get first access and a free first week, with no card and no commitment.";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description: waitlistDescription,
  alternates: { canonical: "/waitlist" },
  openGraph: {
    type: "website",
    siteName: "casdey",
    title: waitlistTitle,
    description: waitlistDescription,
    url: "/waitlist",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: waitlistTitle,
    description: waitlistDescription,
  },
};

const NEXT = [
  {
    n: "1",
    title: "You join",
    body: "Gym or studio name, work email, and the software you run. That is the whole form.",
  },
  {
    n: "2",
    title: "We build around you",
    body: "The systems gyms tell us about are the ones we connect to first.",
  },
  {
    n: "3",
    title: "You get the free week",
    body: "One email when casdey is ready for you, in the order gyms joined.",
  },
];

const QUESTIONS = [
  {
    q: "Which membership software does it work with?",
    a: "We are building around the systems gyms and studios actually run on. Tell us yours on the form and it moves up the order we connect to them in.",
  },
  {
    q: "Will members be able to tell it is automated?",
    a: "Messages go out in your gym's name, one member at a time, referring to that member's own history with you. There is no casdey branding on anything a member sees.",
  },
  {
    q: "What happens when a member replies?",
    a: "casdey handles it end to end, including the booking. It replies in your name, finds a slot in your class schedule, and confirms it with the member. Your team only sees a booked class, not a thread to manage.",
  },
  {
    q: "What does casdey need access to?",
    a: "Your member list, to find who has cancelled, and your calendar, to book them into a class. We also connect to your membership pricing, so what comes back can be measured against what was spent, which is how the profit-or-nothing guarantee gets checked.",
  },
  {
    q: "Does our team have to change how it works?",
    a: "No. Once it is connected, casdey reads your records and books straight into your class schedule. Nobody at the gym has to remember to do anything.",
  },
  {
    q: "What does it cost after the free week?",
    a: "Your account drops to a Free plan, not a bill: you keep importing your list and seeing who has cancelled at no cost. If you want casdey writing to them and booking them into a class, upgrade to Premium whenever you're ready, and joining the waitlist locks in a lifetime discount on that price for as long as you stay subscribed. Either way it is the only spend, no ad budget needed, and if it does not recover more than it costs, you do not pay.",
  },
  {
    q: "When does it launch?",
    a: "In the coming weeks. Waitlist gyms hear first, and the free week is attached to that email.",
  },
];

export default async function WaitlistPage({ searchParams }: PageProps<"/waitlist">) {
  // Carried over from the single field in the landing page hero.
  const params = await searchParams;
  const raw = params?.email;
  const defaultEmail = typeof raw === "string" ? raw.slice(0, 320) : "";

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden py-14 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-56 h-[620px] w-[620px] rounded-full bg-shallow/60 blur-3xl"
          />
          <Container className="relative">
            <div className="grid items-start gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <Eyebrow>Early access</Eyebrow>
                <h1 className="display mt-5 text-[clamp(2.25rem,4.6vw,3.25rem)] text-ink text-balance">
                  Get the free first week.
                </h1>
                <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-graphite text-pretty">
                  casdey is being built now, and the gyms and studios on the
                  waitlist are the ones it gets built around. Join and you get
                  first access, a free week with no card and no commitment,
                  and a direct say in what it does next.
                </p>

                <div className="mt-10 rounded-[20px] bg-white p-6 shadow-raised">
                  <MemberTimeline
                    gapLabel="cancelled 8 months ago"
                    endLabel="rejoined"
                  />
                </div>

                <ol className="mt-10 space-y-6">
                  {NEXT.map((step) => (
                    <li key={step.n} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-shallow font-mono text-[0.8125rem] font-medium text-teal"
                      >
                        {step.n}
                      </span>
                      <div>
                        <h2 className="text-[0.9375rem] font-semibold text-ink">
                          {step.title}
                        </h2>
                        <p className="mt-1 text-[0.9375rem] leading-relaxed text-graphite">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Sticky so the form stays reachable while the steps and the
                  questions below scroll past it. */}
              <div className="lg:sticky lg:top-24">
                <WaitlistForm defaultEmail={defaultEmail} />
              </div>
            </div>
          </Container>
        </section>

        <section id="questions" className="scroll-mt-24 pb-20 sm:pb-28">
          <Container>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="display mt-4 text-[clamp(1.75rem,3.2vw,2.4rem)] text-ink">
              Before you join.
            </h2>

            {/* Two columns on wide screens: a single column of six rows leaves
                half the page empty and pushes the footer a long way down. */}
            <div className="mt-10 grid gap-x-16 lg:grid-cols-2">
              {QUESTIONS.map((item) => (
                <details
                  key={item.q}
                  className="group border-b border-ash/70 first:border-t lg:[&:nth-child(2)]:border-t"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[1.0625rem] font-semibold text-ink">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-stone transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-6 text-[0.9375rem] leading-relaxed text-graphite">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
