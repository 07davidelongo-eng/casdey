/**
 * The casdey wordmark.
 *
 * Brand rules this component exists to enforce:
 *  - lowercase, always, even mid-sentence, even in a headline
 *  - set in Raleway Light, never re-kerned, stretched or condensed
 *  - Ink on Paper/White, or Paper reversed out of the petrol ground
 *  - no shadow, outline or gradient
 *
 * Colour comes from the parent so the same component works on both grounds.
 * Clearspace is the caller's job: it depends on the surrounding layout.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`wordmark ${className}`}>casdey</span>;
}
