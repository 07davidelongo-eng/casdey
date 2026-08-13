import { HeroEmailCapture } from "../hero-email-capture";
import { HeroMockup } from "../marks/hero-mockup";
import { Container } from "../ui";

const SOFTWARE = ["SOE Exact", "Dentally", "R4", "Carestream"];

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-20">
      {/* A single wash of the shallow tint, set off the right edge, so the hero
          sits slightly forward of the paper without becoming a coloured band. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-56 h-[620px] w-[620px] rounded-full bg-shallow/60 blur-3xl"
      />

      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <h1 className="display text-[clamp(2.5rem,5.4vw,4rem)] text-ink">
              Win back the patients
              <br />
              who quietly
              <br />
              stopped coming.
            </h1>

            <p className="mt-7 max-w-lg text-[1.0625rem] leading-relaxed text-graphite text-pretty">
              casdey finds the patients your practice has not seen in years,
              writes to them in your name, and books them straight back onto
              your calendar. No chasing, no ad spend.
            </p>

            <div className="mt-9">
              <HeroEmailCapture />
            </div>

            <p className="label mt-4 text-stone">
              free first week · no card · no commitment
            </p>
          </div>

          <div className="lg:justify-self-end">
            <HeroMockup />
          </div>
        </div>

        <div className="mt-20 flex flex-col gap-5 border-t border-ash/70 pt-8 sm:flex-row sm:items-center sm:gap-10">
          <p className="label shrink-0 text-stone">
            being built to connect with
          </p>
          <ul className="flex flex-wrap items-center gap-x-9 gap-y-3">
            {SOFTWARE.map((name) => (
              <li
                key={name}
                className="display text-[1.35rem] font-semibold text-graphite"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
