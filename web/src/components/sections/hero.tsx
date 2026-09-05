import { AppShot } from "../app-shot";
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
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,color-mix(in_srgb,var(--teal-bright)_16%,transparent),transparent_72%),radial-gradient(ellipse_50%_40%_at_85%_10%,color-mix(in_srgb,var(--amber)_8%,transparent),transparent_70%)]"
      />

      <Container className="relative text-center">
        <Link
          href="/login?mode=signup"
          className="inline-flex items-center gap-2 rounded-full border border-ash bg-white/70 px-3.5 py-1.5 text-[13px] text-graphite transition-colors duration-200 hover:border-stone hover:text-ink"
        >
          Free first week, no card
          <span aria-hidden="true" className="text-teal">
            &rarr;
          </span>
        </Link>

        <h1 className="display mx-auto mt-7 max-w-[19ch] text-[clamp(1.9rem,3.4vw,2.9rem)] text-ink">
          Win back the members who stopped coming.
        </h1>

        <p className="mx-auto mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
          casdey finds them in your own records, writes to each one in your
          gym&apos;s name, and books the ones who answer.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink
            href="/login?mode=signup"
            className="px-4 py-2.5 text-[0.875rem]"
          >
            Start your free week
          </ButtonLink>
          <ButtonLink
            href="/#what-it-does"
            variant="quiet"
            className="px-4 py-2.5 text-[0.875rem]"
          >
            See how it works
          </ButtonLink>
        </div>
      </Container>

      <Container className="relative mt-14 sm:mt-16">
        <AppShot view="members" />
        <p className="mt-3 text-center text-[12px] text-stone">
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
