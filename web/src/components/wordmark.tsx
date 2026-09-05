/**
 * The casdey identity, v4.
 *
 * The mark is four bars pinwheeled around an open centre, one of them gold.
 * It is deliberately abstract: it does not spell the name and it does not
 * illustrate lapsed members. An earlier mark tried to do both (a ring with a
 * gap and a gold arc closing it) and paid for it twice, because the story only
 * survived in two colours and the whole thing collapsed into a plain ring the
 * moment it was printed in one.
 *
 * What the form has to earn instead is legibility. Four bars of real weight
 * with a 10-unit gap at every corner read as a square at 16px, which is the
 * size that actually decides whether a mark works.
 *
 * Rules this component exists to enforce:
 *  - lowercase, always, even mid-sentence, even in a headline
 *  - set in Outfit, never re-kerned, stretched or condensed
 *  - exactly one bar is gold, and it is Leaf, the fill value, never Struck Gold
 *  - the mark is never rotated: the gold bar sits at the top
 *  - no shadow, outline or gradient
 *
 * The black bars are currentColor, so the mark reverses out of the inverted
 * plane with the text around it. The gold bar does not: Leaf is 8.6:1 on the
 * dark ground and needs no swap, which is why it is pinned rather than taken
 * from --teal (that token becomes Leaf inside .on-deep and Struck Gold outside
 * it, and a mark that changes gold depending on its background is two marks).
 *
 * Clearspace is the caller's job: it depends on the surrounding layout.
 */

/** The mark on its own. Sized in em so it tracks whatever type it sits with. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`h-[0.92em] w-[0.92em] shrink-0 ${className}`}
      role="presentation"
      aria-hidden="true"
      fill="currentColor"
    >
      {/* The one gold bar. Pinned to Leaf, see the note above. */}
      <rect x="12" y="12" width="44" height="22" rx="11" fill="var(--teal-bright)" />
      <rect x="12" y="12" width="44" height="22" rx="11" transform="rotate(90 50 50)" />
      <rect x="12" y="12" width="44" height="22" rx="11" transform="rotate(180 50 50)" />
      <rect x="12" y="12" width="44" height="22" rx="11" transform="rotate(270 50 50)" />
    </svg>
  );
}

/** The wordmark on its own, for places that already carry the mark. */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`wordmark ${className}`}>casdey</span>;
}

/** Mark plus wordmark, the default lockup. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.38em] ${className}`}>
      <Mark />
      <Wordmark />
    </span>
  );
}
