import { IconShield } from "../marks/icons";
import { Container } from "../ui";

/**
 * The trust section, on the same panel as the two around it.
 *
 * It used to centre three enormous gold words and finish on a cream box,
 * which put a fourth surface colour on the page and gave the quietest
 * section the loudest type. The facts have not changed; they are now a
 * label, an answer and a sentence, and the gold sits at label size where the
 * rest of the page keeps it.
 */

const FACTS = [
  {
    label: "Where it lives",
    value: "UK and EU",
    body: "Where your member data is stored and processed. It does not leave without a lawful basis.",
  },
  {
    label: "What casdey writes to",
    value: "Your calendar",
    body: "The only thing casdey ever writes to, and only to book a member back in. Member records stay read-only, always.",
  },
  {
    label: "What it never touches",
    value: "Nothing sensitive",
    body: "No health records, payment details or card numbers. Names, visit dates and membership prices only.",
  },
];

export function MemberData() {
  return (
    <section id="member-data" className="scroll-mt-24 pb-24 sm:pb-32">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <h2 className="display text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink text-balance">
            Built to protect your members&apos; data from the first line of
            code.
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-graphite text-pretty lg:pt-2">
            casdey handles your members&apos; personal data, so protecting it is
            not something bolted on later. These are the rules it is built on.
            We would rather you hold us to them now than find out afterwards.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-[20px] border border-ash bg-white">
          <dl className="grid divide-y divide-ash sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {FACTS.map((fact) => (
              <div key={fact.value} className="p-8 sm:p-9">
                <dt className="label text-teal">{fact.label}</dt>
                <dd>
                  <p className="display mt-3 text-[1.5rem] leading-tight text-ink">
                    {fact.value}
                  </p>
                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
                    {fact.body}
                  </p>
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-5 border-t border-ash p-8 sm:flex-row sm:items-start sm:gap-7 sm:p-9">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ash text-teal">
              <IconShield className="h-5 w-5" />
            </span>
            <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-graphite">
              You stay the data controller and casdey acts as your processor,
              under a written agreement. When casdey books a member in, that
              calendar access is scoped to creating bookings, nothing else. An
              opt-out is permanent, and ending the contract deletes the
              records. UK GDPR, EU GDPR and PECR all apply, and we will send
              you the detail before you commit to anything.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
