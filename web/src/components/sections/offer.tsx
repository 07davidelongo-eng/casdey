import Link from "next/link";
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
            href="/waitlist"
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
            href="/waitlist"
            className="lift group flex min-h-[290px] flex-col justify-between rounded-[22px] bg-teal p-8 sm:p-10"
          >
            <div>
              <h3 className="display text-[1.75rem] text-white">
                After the week
              </h3>
              <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-shallow">
                No per-patient fees and no commission on bookings. We walk you
                through the number before the free week ends, not after it.
              </p>
            </div>
            <div className="mt-10 flex items-end justify-between gap-4">
              <p className="display text-[2.5rem] leading-none text-white">
                One flat price
              </p>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-teal transition-transform duration-200 group-hover:-translate-y-0.5">
                <ArrowUpRight />
              </span>
            </div>
          </Link>
        </div>

        <p className="mt-8 text-center text-[0.9375rem] leading-relaxed text-graphite">
          Profit or nothing: if casdey does not recover more than it costs,
          you do not pay. No ad budget, no agency retainer, just the
          subscription.
        </p>
      </Container>
    </section>
  );
}
