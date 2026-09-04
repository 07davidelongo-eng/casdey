/**
 * The casdey identity, v4.
 *
 * The mark is a ring with a piece missing and a gold arc putting it back. It
 * is not decoration: the ring is the membership, the gap is the member who
 * lapsed, and the gold is the only thing casdey claims to do. Read as a
 * letterform it is the "c" of casdey, which is why the mark and the wordmark
 * can sit together without one explaining the other.
 *
 * Rules this component exists to enforce:
 *  - lowercase, always, even mid-sentence, even in a headline
 *  - set in Outfit, never re-kerned, stretched or condensed
 *  - the gold arc is the only colour in the mark, and it never changes
 *  - no shadow, outline or gradient
 *
 * Wordmark colour comes from the parent, so the same component works on Chalk
 * and reversed out of the inverted plane. Clearspace is the caller's job: it
 * depends on the surrounding layout.
 */

/** The mark on its own. Sized in em so it tracks whatever type it sits with. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`h-[0.95em] w-[0.95em] shrink-0 ${className}`}
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      {/* The ring, open on the right. */}
      <path
        d="M23.07 7.57A11 11 0 1 0 23.07 24.43"
        stroke="currentColor"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      {/* The piece put back. Never inherits colour. */}
      <path
        d="M24.67 22.77A11 11 0 0 0 24.67 9.23"
        stroke="var(--teal)"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
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
    <span className={`inline-flex items-center gap-[0.42em] ${className}`}>
      <Mark />
      <Wordmark />
    </span>
  );
}
