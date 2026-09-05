import { Reveal } from "../motion";
import { Container } from "../ui";

/**
 * The competitive answer, on the same surface as the pricing panel.
 *
 * The first version of this was three white cards under "What makes it
 * different", which answered nothing. The second was two bare lists of text,
 * which answered the question but looked like a draft. This keeps the
 * argument and gives it a container: one white panel, one hairline, and the
 * whole difference carried by the type colour rather than by a second
 * background.
 */

const COVERED = [
  "Class timetables and bookings",
  "Payments, renewals and failed cards",
  "Who is in the building today",
  "A churn number, once they have gone",
];

const UNCOVERED = [
  "Who stopped coming, and when",
  "What that half of your list is worth",
  "A message to each of them, as you",
  "The reply, answered and booked",
];

function Column({
  heading,
  note,
  items,
  quiet,
}: {
  heading: string;
  note: string;
  items: string[];
  quiet?: boolean;
}) {
  return (
    <div className="p-8 sm:p-10">
      <p className={quiet ? "label text-stone" : "label text-teal"}>
        {heading}
      </p>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-graphite">
        {note}
      </p>
      <ul className="mt-7 list-none">
        {items.map((item) => (
          <li
            key={item}
            className={
              "flex items-start gap-3 border-t border-ash py-3.5 text-[1.0625rem] " +
              (quiet ? "text-stone" : "text-ink")
            }
          >
            <span
              aria-hidden="true"
              className={
                "mt-[0.6em] h-px w-3 shrink-0 " + (quiet ? "bg-ash" : "bg-teal")
              }
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhyCasdey() {
  return (
    <section id="why-casdey" className="scroll-mt-24 pb-24 sm:pb-32">
      <Container>
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <h2 className="display text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink text-balance">
              Everything your gym software does starts with someone walking in.
            </h2>
            <p className="text-[1.0625rem] leading-relaxed text-graphite text-pretty lg:pt-2">
              It runs the members who are already showing up, and it runs them
              well. The ones who stopped are not a problem it solves badly, they
              are simply absent from it. On most lists that is the larger half.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[20px] border border-ash bg-white">
            <div className="grid divide-y divide-ash sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <Column
                quiet
                heading="Your gym software"
                note="Everything downstream of a member turning up."
                items={COVERED}
              />
              <Column
                heading="casdey"
                note="Everything that happens once they stop."
                items={UNCOVERED}
              />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
