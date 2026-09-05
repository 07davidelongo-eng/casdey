import { IconShield } from "../marks/icons";
import { ButtonLink, Container } from "../ui";

/**
 * One surface, three facts.
 *
 * This was a grey card, a solid gold card and a cream card stacked in a row,
 * which put four different backgrounds on screen at once and made the offer
 * look more complicated than it is. Everything now sits on a single white
 * panel divided by hairlines, and gold appears only at label size. The one
 * colour break left on the page is the closing band, which is the point of
 * having it.
 */
export function Offer() {
  return (
    <section id="pricing" className="scroll-mt-24 pb-24 sm:pb-32">
      <Container>
        <div className="max-w-[34rem]">
          <h2 className="display text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink">
            Free for a week. Then free until you say otherwise.
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-relaxed text-graphite text-pretty">
            No card to start, and no bill when the week ends. You only pay when
            you have seen what casdey found in your own list.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-[20px] border border-ash bg-white">
          <div className="grid sm:grid-cols-2">
            <div className="border-b border-ash p-8 sm:border-b-0 sm:border-r sm:p-10">
              <p className="label text-stone">The first week</p>
              <p className="display mt-4 text-[2.25rem] leading-none text-ink">
                Free
              </p>
              <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-graphite">
                Everything casdey does, with no card, no setup fee and no
                commitment at the end of it.
              </p>
            </div>

            <div className="p-8 sm:p-10">
              <p className="label text-stone">After the week</p>
              <p className="display mt-4 text-[2.25rem] leading-none text-ink">
                Still free
              </p>
              <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-graphite">
                Your account drops to the Free plan, not a bill. Upgrade
                whenever it earns it, and starting now locks a lifetime
                discount for when you do.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 border-t border-ash p-8 sm:flex-row sm:items-start sm:gap-7 sm:p-10">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ash text-teal">
              <IconShield className="h-5 w-5" />
            </span>
            <div>
              <p className="label text-teal">The guarantee</p>
              <p className="display mt-2 text-[1.5rem] leading-tight text-ink">
                Profit or nothing.
              </p>
              <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-graphite">
                If casdey does not recover more than it costs, you do not pay.
                No ad budget and no agency retainer stacked on top, just the
                subscription, backed by that.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ButtonLink
            href="/login?mode=signup"
            className="px-4 py-2.5 text-[0.875rem]"
          >
            Start your free week
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
