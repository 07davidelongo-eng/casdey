import { MemberJourney } from "../member-journey";
import { Container, Eyebrow, SectionHeading } from "../ui";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24 sm:py-32">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <SectionHeading className="mt-5 text-ink">
              Three steps, and the one that eats your time is ours.
            </SectionHeading>
          </div>
          <p className="text-[1.0625rem] leading-relaxed text-graphite text-pretty lg:pt-10">
            Below is one member, from the last time they came in to the session
            they book on the way back. Your gym does the first step and the
            last. casdey does the long bit in the middle, the one nobody at the
            front desk has time for.
          </p>
        </div>

        <div className="mt-16">
          <MemberJourney />
        </div>
      </Container>
    </section>
  );
}
