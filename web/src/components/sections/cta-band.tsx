import { Reveal } from "../motion";
import { ButtonLink, Container, Eyebrow } from "../ui";
import { paidTrialEnabled } from "@/lib/plan";
import { startCta, trialPriceDisplay } from "@/lib/offer-copy";

export function CtaBand() {
  const paidTrial = paidTrialEnabled();

  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <Reveal>
          <div className="on-deep rounded-[28px] bg-deep p-10 sm:p-14">
            <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <Eyebrow className="text-teal-bright">Try it first</Eyebrow>
                <h2 className="display mt-4 max-w-lg text-[clamp(1.75rem,3.2vw,2.4rem)] text-ink text-balance">
                  Ready to work the quiet half of your list?
                </h2>
                <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-sea">
                  {paidTrial
                    ? `${trialPriceDisplay()} buys your first week. Import your list and see casdey find who has gone quiet before you decide anything.`
                    : "Start with a free week, no card. Import your list and see casdey find who has gone quiet before you decide anything."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:justify-end">
                <ButtonLink href="/login?mode=signup" variant="brightOnDeep">
                  {startCta(paidTrial)}
                </ButtonLink>
                <ButtonLink href="/#what-it-does" variant="onDeep">
                  How it works
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
