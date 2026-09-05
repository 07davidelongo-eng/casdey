import { Container, Eyebrow, SectionHeading } from "../ui";

/**
 * The competitive answer, which the page did not have before.
 *
 * This section used to be three white cards under the heading "What makes it
 * different", and none of them answered the question a gym owner is actually
 * asking, which is what this does that the software they already pay for
 * does not. Two of the three also became duplicates once the hero and the
 * journey landed: the tail chart repeated the hero wall at a quarter of the
 * size, and the icon flow repeated the timeline.
 *
 * The split below is the argument, and the type does the work: the covered
 * column is set in the muted role, the uncovered one in ink.
 */

const COVERED = [
  "Class timetables and bookings",
  "Payments, renewals and failed cards",
  "Who is in the building today",
  "A churn number, after they have gone",
];

const UNCOVERED = [
  "Who stopped coming, and how long ago",
  "What that half of the list is worth at your own prices",
  "A message to each of them, in your gym's name",
  "The reply, answered and put in your calendar",
];

export function WhyCasdey() {
  return (
    <section id="why-casdey" className="scroll-mt-24 py-24 sm:py-32">
      <Container>
        <div className="max-w-[36rem]">
          <Eyebrow>Why casdey</Eyebrow>
          <SectionHeading className="mt-5 text-ink">
            Your gym software runs the people who turn up.
          </SectionHeading>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-16">
            <p className="label text-stone">already covered</p>
            <ul className="mt-6 list-none">
              {COVERED.map((item) => (
                <li
                  key={item}
                  className="border-t border-ash py-4 text-[1.0625rem] text-stone"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:border-l lg:border-ash lg:pl-16">
            <p className="label text-teal">covered by nothing</p>
            <ul className="mt-6 list-none">
              {UNCOVERED.map((item) => (
                <li
                  key={item}
                  className="border-t border-ash py-4 text-[1.0625rem] text-ink"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-16 max-w-[38rem] border-t border-ash pt-8 text-[1.0625rem] leading-relaxed text-graphite text-pretty">
          Your first week costs nothing and takes no card. If casdey has not
          done something useful for your gym by the end of it, you walk away.
        </p>
      </Container>
    </section>
  );
}
