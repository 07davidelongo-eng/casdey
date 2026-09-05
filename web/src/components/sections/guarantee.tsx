import { IconShield } from "../marks/icons";

/**
 * The guarantee, given the room it is worth.
 *
 * It used to be one line in a pricing table cell and one answer buried in the
 * FAQ, which is a strange way to treat the only thing on the page a competitor
 * cannot copy without taking the same risk. It gets weight here from scale and
 * position, sitting directly under the figures, rather than from a new surface
 * colour: the page deliberately runs one white panel per section, and the
 * previous version of this site was worse for having four.
 *
 * Every claim here is checked against lib/guarantee.ts. It is a promise about
 * money, so the copy cannot drift from the code that pays it.
 */

const MECHANICS = [
  {
    term: "Who decides",
    def: "You do. The claim is a button on your own billing page, and it pays on the first click. Nobody at casdey reviews it, and there is nothing to argue about.",
  },
  {
    term: "What is measured",
    def: "What casdey recovered over the window, against what casdey charged you over the same window. Not traffic, not opens, not replies.",
  },
  {
    term: "How often",
    def: "Once per gym, ever. One 30-day window, opened by your first campaign after your first payment. It can never be re-armed, which is exactly why it needs no review.",
  },
];

export function Guarantee() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-ash bg-white">
      <div className="flex flex-col gap-6 p-8 sm:flex-row sm:items-start sm:gap-8 sm:p-10">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-shallow text-teal">
          <IconShield className="h-6 w-6" />
        </span>
        <div>
          <p className="label text-teal">Profit or nothing, on Pro</p>
          <p className="display mt-3 max-w-[20ch] text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.15] text-ink text-balance">
            If it does not make you more than it costs, you do not pay.
          </p>
          <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
            Every other tool in this category asks you to carry the risk of it
            not working. On Pro, casdey carries it instead, in writing and in
            one click.
          </p>
        </div>
      </div>

      <dl className="grid divide-y divide-ash border-t border-ash sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {MECHANICS.map((m) => (
          <div key={m.term} className="p-8 sm:p-9">
            <dt className="text-[1.0625rem] font-medium text-ink">{m.term}</dt>
            <dd className="mt-2.5 text-[0.9375rem] leading-relaxed text-graphite">
              {m.def}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
