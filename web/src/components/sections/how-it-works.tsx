import { Container, Eyebrow, SectionHeading } from "../ui";

/**
 * Numbered because this genuinely is a sequence: nothing in step two can happen
 * before step one. The ghost numerals carry the order so the headings do not
 * have to.
 */
const STEPS = [
  {
    n: "1",
    title: "Bring in your list",
    body: "casdey reads your patient list from a file your practice software exports. Nothing clinical is ever in scope, and you see the estimated value of the quiet part before anything is sent.",
  },
  {
    n: "2",
    title: "casdey finds them and writes",
    body: "It picks out the patients who drifted, works out who is worth contacting, and sends each one a short message in your practice's name. You approve the first send before it goes out.",
  },
  {
    n: "3",
    title: "They reply to your front desk",
    body: "Because it sends as your practice, a patient's reply to book lands in your reception inbox, not with us. You see who is being reached and what the list is worth.",
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
        <SectionHeading className="mt-4 max-w-2xl text-ink">
          Three steps, and the one that eats your time is ours.
        </SectionHeading>

        <ol className="mt-14 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-[20px] border border-deep-line bg-deep-raised p-7"
            >
              <span
                aria-hidden="true"
                className="display block text-[3.5rem] leading-none text-ink/15"
              >
                {step.n}
              </span>
              <h3 className="mt-5 text-[1.0625rem] font-semibold text-ink">
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
