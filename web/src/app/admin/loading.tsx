/**
 * Instant loading state for /admin.
 *
 * The founder view fans out to Stripe (live MRR), PostHog (HogQL) and a couple
 * of dozen Supabase aggregates, so the server render is the slowest in the
 * product. Without this, opening it or changing the period left the previous
 * screen frozen for a second or two. Same generic skeleton as /app.
 */

function Bar({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-md bg-mist motion-safe:animate-pulse ${className}`} />
  );
}

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="motion-reduce:opacity-70">
      <div className="mb-8">
        <Bar className="h-3 w-20" />
        <Bar className="mt-3 h-7 w-72 max-w-[70%]" />
      </div>

      {Array.from({ length: 3 }).map((_, section) => (
        <section key={section} className="mt-8 first:mt-0">
          <Bar className="mb-4 h-4 w-32" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5">
                <Bar className="h-3 w-16" />
                <Bar className="mt-3 h-8 w-14" />
                <Bar className="mt-3 h-3 w-24" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
