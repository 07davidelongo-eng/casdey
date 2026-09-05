import { AppShot } from "../app-shot";
import { Reveal, TiltWindow } from "../motion";
import { ButtonLink, Container } from "../ui";
import Link from "next/link";

const SOFTWARE = ["Mindbody", "Glofox", "TeamUp", "ABC Fitness"];

/**
 * Centred, short, and the product straight away.
 *
 * The two versions before this one both led with type: a huge left-aligned
 * headline carrying a whole paragraph at display size, which is a wall of
 * text pretending to be a hero. Here the headline is one line, the sentence
 * under it is body size, and the object below is the thing being sold.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden pt-14 sm:pt-20">
      <div
        aria-hidden="true"
        className="grain pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,color-mix(in_srgb,var(--teal-bright)_16%,transparent),transparent_72%),radial-gradient(ellipse_50%_40%_at_85%_10%,color-mix(in_srgb,var(--amber)_8%,transparent),transparent_70%)]"
      />

      <Container className="relative text-center">
        <Reveal>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-2 rounded-full border border-ash bg-white/70 px-3.5 py-1.5 text-[13px] text-graphite transition-colors duration-200 hover:border-stone hover:text-ink"
          >
            Free first week, no card
            <span aria-hidden="true" className="text-teal">
              &rarr;
            </span>
          </Link>
        </Reveal>

        <Reveal delay={70}>
          <h1 className="display mx-auto mt-7 max-w-[19ch] text-[clamp(1.9rem,3.4vw,2.9rem)] text-ink">
            Win back the members who stopped coming.
          </h1>
        </Reveal>

        <Reveal delay={140}>
          <p className="mx-auto mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
            casdey finds them in your own records, writes to each one in your
            gym&apos;s name, and books the ones who answer.
          </p>
        </Reveal>

        <Reveal delay={210}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/login?mode=signup" size="sm">
              Start your free week
            </ButtonLink>
            <ButtonLink href="/#what-it-does" variant="quiet" size="sm">
              See how it works
            </ButtonLink>
          </div>
        </Reveal>
      </Container>

      <Container className="relative mt-14 sm:mt-16">
        <TiltWindow>
          <div className="relative">
            <AppShot view="members" />

            {/* The moment the product is sold on, floated over the list the
              way the good software sites layer one panel over another.
              Hidden below md, where it would cover the table it is meant to
              be commenting on. */}
            <div className="absolute -bottom-7 left-6 hidden w-[268px] rounded-[14px] border border-ash bg-white p-4 shadow-float md:block lg:left-10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber" />
                <span className="text-[12px] font-medium text-amber">
                  Returned
                </span>
              </div>
              <p className="display mt-2 text-[1.375rem] leading-none text-ink tabular-nums">
                Tue 14:30
              </p>
              <p className="mt-1.5 text-[12px] text-stone">
                J. Okafor · PT session, 45 min
              </p>
            </div>
          </div>
        </TiltWindow>
        <p className="mt-12 text-center text-[12px] text-stone md:mt-14">
          Illustrative. casdey holds no member data of its own.
        </p>
      </Container>

      <Container className="relative mt-16 sm:mt-20">
        <div className="flex flex-col items-center gap-5 border-t border-ash/70 pt-8 sm:flex-row sm:justify-center sm:gap-10">
          <p className="label text-stone">Works with any gym software</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
            {SOFTWARE.map((name) => (
              <li
                key={name}
                className="display text-[1.25rem] font-semibold text-graphite"
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
