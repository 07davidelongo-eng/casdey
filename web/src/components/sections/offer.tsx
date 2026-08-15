import Link from "next/link";
import { IconShield } from "../marks/icons";
import { ArrowUpRight, Container, Eyebrow } from "../ui";

export function Offer() {
  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <div className="text-center">
          <Eyebrow>The offer</Eyebrow>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Link
            href="/login?mode=signup"
            className="lift group flex min-h-[290px] flex-col justify-between rounded-[22px] bg-mist p-8 sm:p-10"
          >
            <div>
              <h3 className="display text-[1.75rem] text-ink">
                The first week
              </h3>
              <p className="mt-3 max-w-xs text-[0.9375rem] leading-relaxed text-graphite">
                No card, no setup fee, and no commitment at the end of it.
              </p>
            </div>
            <div className="mt-10 flex items-end justify-between gap-4">
              <p className="display text-[2.5rem] leading-none text-ink">Free</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink transition-transform duration-200 group-hover:-translate-y-0.5">
                <ArrowUpRight />
              </span>
            </div>
          </Link>

          <Link
            href="/login?mode=signup"
            className="lift group flex min-h-[290px] flex-col justify-between rounded-[22px] bg-teal p-8 sm:p-10"
          >
            <div>
              <h3 className="display text-[1.75rem] text-white">
                After the week
              </h3>
              <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-shallow">
                Your account drops to a Free plan, not a bill. Upgrade
                whenever you want, and joining now locks in a lifetime
                discount for when you do.
              </p>
            </div>
            <div className="mt-10 flex items-end justify-between gap-4">
              <p className="display text-[2.5rem] leading-none text-white">
                Free plan
              </p>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-teal transition-transform duration-200 group-hover:-translate-y-0.5">
                <ArrowUpRight />
              </span>
            </div>
          </Link>
        </div>

        <div className="mt-5 flex flex-col items-start gap-6 rounded-[22px] border border-teal/20 bg-shallow p-8 sm:flex-row sm:items-center sm:gap-8 sm:p-10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-teal shadow-raised">
            <IconShield className="h-7 w-7" />
          </div>
          <div>
            <Eyebrow>The guarantee</Eyebrow>
            <p className="display mt-2 text-[1.75rem] leading-tight text-ink sm:text-[2rem]">
              Profit or nothing.
            </p>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-graphite">
              If casdey does not recover more than it costs, you do not pay.
              No ad budget, no agency retainer stacked on top, just the
              subscription, backed by that.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
