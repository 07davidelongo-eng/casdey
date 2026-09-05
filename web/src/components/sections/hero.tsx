import { MemberWall } from "../member-wall";
import { ButtonLink, Container } from "../ui";

const SOFTWARE = ["Mindbody", "Glofox", "TeamUp", "ABC Fitness"];

/**
 * The hero shows the problem instead of claiming it.
 *
 * Every version before this one put a headline beside a mocked-up product
 * card, which is the arrangement every B2B page uses and which asks the
 * visitor to take the premise on trust. The list itself is more persuasive
 * than any sentence about it: a gym owner recognises that shape immediately,
 * because it is their own export.
 */
export function Hero() {
  return (
    <section className="pb-16 pt-16 sm:pb-24 sm:pt-24">
      <Container>
        <h1 className="display max-w-[46rem] text-[clamp(2.15rem,4.4vw,3.45rem)] text-ink">
          Every gym has a quiet half.
          <span className="text-stone">
            {" "}
            casdey finds them, writes in your name, and books the ones who
            answer.
          </span>
        </h1>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/login?mode=signup">
            Start your free week
          </ButtonLink>
          <ButtonLink href="/#how-it-works" variant="quiet">
            See how it works
          </ButtonLink>
          <p className="label text-stone sm:ml-3">
            no card · no commitment
          </p>
        </div>

        <div className="mt-16 sm:mt-20">
          <p className="mb-10 max-w-[34rem] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
            Sort any gym list by time since last visit and this is the shape.
            Your gym software covers the left. Nothing covers the right.
          </p>
          <MemberWall />
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-ash/70 pt-8 sm:flex-row sm:items-center sm:gap-10">
          <p className="label shrink-0 text-stone">
            works with any gym software
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
