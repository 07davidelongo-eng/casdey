import { HeroMockup } from "../marks/hero-mockup";
import { Container, Eyebrow, SectionHeading } from "../ui";

/**
 * The one place on the page that shows the actual product.
 *
 * The wall and the timeline are both abstractions, and a page that never
 * shows the software is asking a gym owner to buy on description alone.
 * This is the zoom-in: one row of that list, opened.
 */
export function MemberRecord() {
  return (
    <section className="py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_auto] lg:gap-20">
          <div className="max-w-[34rem]">
            <Eyebrow>One member</Eyebrow>
            <SectionHeading className="mt-5 text-ink">
              Every line in that list opens.
            </SectionHeading>
            <p className="mt-6 text-[1.0625rem] leading-relaxed text-graphite text-pretty">
              When they last came in, how long the gap has run, what casdey
              sent in your name, and the session they booked on the way back.
              You see the whole of it before you approve a single message.
            </p>
          </div>

          <div className="lg:justify-self-end">
            <HeroMockup />
          </div>
        </div>
      </Container>
    </section>
  );
}
