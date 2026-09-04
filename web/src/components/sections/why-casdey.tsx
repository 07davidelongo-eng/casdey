import { LapsedChart } from "../marks/lapsed-chart";
import { IconFind, IconMessage } from "../marks/icons";
import { Wordmark } from "../wordmark";
import { Container, Eyebrow, SectionHeading } from "../ui";

function Flow() {
  const arrow = (
    <svg
      viewBox="0 0 40 8"
      aria-hidden="true"
      className="h-2 w-5 shrink-0 text-ash sm:w-8"
    >
      <path
        d="M0 4h34m0 0-4-3m4 3-4 3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-ash bg-white sm:h-14 sm:w-14 text-stone">
        <IconFind className="h-5 w-5" />
      </div>
      {arrow}
      <div className="on-deep flex h-12 shrink-0 items-center justify-center rounded-[14px] bg-deep px-3 sm:h-14 sm:px-4 text-ink">
        <Wordmark className="text-[1.05rem]" />
      </div>
      {arrow}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-ash bg-white sm:h-14 sm:w-14 text-teal">
        <IconMessage className="h-5 w-5" />
      </div>
    </div>
  );
}

export function WhyCasdey() {
  return (
    <section id="why-casdey" className="scroll-mt-24 py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Why casdey</Eyebrow>
          <SectionHeading className="mt-4 text-ink">
            What makes it different.
          </SectionHeading>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          <div className="flex flex-col justify-between rounded-[22px] border border-ash/60 bg-white p-6 sm:p-10 lg:col-span-5">
            <p className="display text-[clamp(3.25rem,7vw,4.5rem)] text-teal">
              7 days
            </p>
            <p className="mt-6 max-w-xs text-[1.0625rem] leading-relaxed text-graphite">
              Your first week costs nothing. If casdey has not done something
              useful for your gym by the end of it, you walk away.
            </p>
          </div>

          <div className="flex flex-col justify-between gap-10 rounded-[22px] border border-ash/60 bg-white p-6 sm:p-10 lg:col-span-7">
            <h3 className="display max-w-sm text-[1.65rem] text-ink">
              Nothing for your team to run.
            </h3>
            <Flow />
            <p className="max-w-md text-[0.9375rem] leading-relaxed text-graphite">
              casdey reads your records, decides who is worth contacting, and
              writes to each one in your name. When a member says yes, the
              reply lands with your front desk, so the only thing your team
              touches is the booking itself.
            </p>
          </div>

          <div className="grid items-center gap-8 rounded-[22px] border border-ash/60 bg-white p-6 sm:p-10 lg:col-span-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <div>
              <h3 className="display text-[1.65rem] text-ink">
                The tail is the opportunity.
              </h3>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-graphite">
                Sort any gym list by time since last visit and the same
                shape appears. Your gym software covers the active left. Nothing
                covers the lapsed right.
              </p>
            </div>
            <div className="rounded-[16px] bg-paper p-6 sm:p-8">
              <LapsedChart />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
