import { IconFind, IconMessage, IconTrend } from "../marks/icons";
import { Container, Eyebrow, SectionHeading } from "../ui";

const FEATURES = [
  {
    Icon: IconFind,
    title: "Finds the drop-offs",
    body: "Separates patients who came once and never returned from patients who are simply due a routine recall. Only the first group is yours to win back.",
  },
  {
    Icon: IconMessage,
    title: "Writes in your name",
    body: "One patient, one reason to be contacted, one message. It goes out as your practice, not as a marketing campaign with your logo on it.",
  },
  {
    Icon: IconTrend,
    title: "Books them back in",
    body: "casdey handles the reply and puts the appointment straight into your calendar. You see who came back, when, and what it was worth.",
  },
];

export function Overview() {
  return (
    <section className="pb-6">
      <Container>
        <div className="rounded-[28px] bg-white p-8 shadow-raised sm:p-12 lg:p-14">
          <Eyebrow>The quiet list</Eyebrow>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <SectionHeading className="text-ink">
              The revenue already sitting in your records.
            </SectionHeading>
            <p className="text-[1.0625rem] leading-relaxed text-graphite text-pretty lg:pt-2">
              casdey works the part of your patient list that no recall system
              covers and nobody at the front desk has time for. The patients are
              already yours. They are just not being asked.
            </p>
          </div>

          <ul className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {FEATURES.map(({ Icon, title, body }) => (
              <li key={title}>
                <Icon className="h-7 w-7 text-teal" />
                <h3 className="mt-4 text-[1.0625rem] font-semibold text-ink">
                  {title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
