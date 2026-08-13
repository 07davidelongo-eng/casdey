import { IconReadOnly, IconShield } from "../marks/icons";
import { Container, Eyebrow, SectionHeading } from "../ui";

const FACTS = [
  {
    value: "UK & EU",
    label: "Where your patient data is stored and processed. It does not leave without a lawful basis.",
  },
  {
    value: "Calendar-only",
    label: "The one thing casdey can write to, to book a patient back in. Patient records stay read-only, always.",
  },
  {
    value: "Zero",
    label: "Clinical notes, treatment plans and medical history touched. Names, appointment dates and treatment prices only.",
  },
];

export function PatientData() {
  return (
    <section id="patient-data" className="scroll-mt-24 py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Patient data</Eyebrow>
          <SectionHeading className="mt-4 text-ink">
            Built for health data from the first line of code.
          </SectionHeading>
          <p className="mt-6 text-[1.0625rem] leading-relaxed text-graphite text-pretty">
            casdey handles health-adjacent personal data, so compliance is not
            something we intend to bolt on later. These are the rules the
            product is being built around. We would rather you hold us to them
            now than find out afterwards.
          </p>
        </div>

        <dl className="mt-16 grid gap-10 border-t border-ash/70 pt-12 sm:grid-cols-3 sm:gap-8">
          {FACTS.map((fact) => (
            <div key={fact.value} className="text-center">
              <dt className="display text-[clamp(2rem,4vw,2.75rem)] text-teal">
                {fact.value}
              </dt>
              <dd className="mx-auto mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-graphite">
                {fact.label}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 flex flex-col gap-4 rounded-[20px] bg-shallow p-7 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <div className="flex gap-4 text-teal">
            <IconShield className="shrink-0" />
            <IconReadOnly className="shrink-0" />
          </div>
          <p className="text-[0.9375rem] leading-relaxed text-graphite">
            You stay the data controller and casdey acts as your processor,
            under a written agreement. Calendar write-access is scoped to
            creating bookings, nothing else. An opt-out is permanent, and
            ending the contract deletes the records. UK GDPR, EU GDPR and
            PECR all apply, and we will send you the detail before you commit
            to anything.
          </p>
        </div>
      </Container>
    </section>
  );
}
