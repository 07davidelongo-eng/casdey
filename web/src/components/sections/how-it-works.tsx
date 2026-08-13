import { Container, Eyebrow, SectionHeading } from "../ui";

/**
 * Numbered because this genuinely is a sequence: nothing in step two can happen
 * before step one. The ghost numerals carry the order so the headings do not
 * have to.
 */
const STEPS = [
  {
    n: "1",
    title: "Connect your records",
    body: "casdey reads your patient list from the software the practice already runs on, plus your calendar so it can book the patients who come back. Nothing clinical is ever in scope.",
  },
  {
    n: "2",
    title: "casdey finds them and writes",
    body: "It picks out the patients who drifted, works out who is worth contacting, and sends each one a short message in your practice's name.",
  },
  {
    n: "3",
    title: "casdey books them in",
    body: "It handles the reply and puts the appointment straight into your calendar. You see who came back and what it was worth, and nothing else needs doing.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="on-deep scroll-mt-24 bg-deep py-20 sm:py-28"
    >
      <Container>
        <Eyebrow className="text-teal-bright">How it works</Eyebrow>
        <SectionHeading className="mt-4 max-w-2xl text-white">
          Three steps, and all three are ours.
        </SectionHeading>

        <ol className="mt-14 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-[20px] border border-deep-line bg-deep-raised p-7"
            >
              <span
                aria-hidden="true"
                className="display block text-[3.5rem] leading-none text-white/15"
              >
                {step.n}
              </span>
              <h3 className="mt-5 text-[1.0625rem] font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-sea">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
