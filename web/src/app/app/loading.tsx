/**
 * Instant loading state for every /app page.
 *
 * Next wraps page.tsx and everything below it in a Suspense boundary with this
 * as the fallback, so a client-side navigation paints this immediately instead
 * of leaving the previous page frozen while the server render (auth + the
 * gym's data) completes. It is also what Next prefetches on link hover.
 *
 * Deliberately generic: one shape that reads as "a page is loading" for the
 * dashboard, Members, Campaigns and Settings alike. A per-section skeleton is
 * not worth the drift.
 *
 * Transform/opacity only, and it stops entirely under prefers-reduced-motion,
 * per the brand guide.
 */

function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-mist motion-safe:animate-pulse ${className}`}
    />
  );
}

export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="motion-reduce:opacity-70">
      {/* Header */}
      <div className="mb-8">
        <Bar className="h-3 w-16" />
        <Bar className="mt-3 h-7 w-64 max-w-[70%]" />
        <Bar className="mt-3 h-4 w-96 max-w-[85%]" />
      </div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-5">
            <Bar className="h-3 w-14" />
            <Bar className="mt-3 h-8 w-12" />
            <Bar className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Wide cards */}
      <div className="mt-4 card p-6">
        <Bar className="h-3 w-24" />
        <Bar className="mt-3 h-10 w-40" />
        <Bar className="mt-4 h-3 w-full max-w-lg" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-6">
            <Bar className="h-4 w-40" />
            <Bar className="mt-4 h-32 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
