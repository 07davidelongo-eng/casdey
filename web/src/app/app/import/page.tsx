import { requireGym } from "@/lib/dal";
import { ImportWizard } from "@/components/app/import-wizard";
import { ProcessingAgreement } from "./agreement";
import { Card, PageHeader } from "@/components/app/ui";
import { PastImports } from "./past-imports";
import { mindbodySource } from "@/lib/ingestion/mindbody";
import type { ImportRun } from "@/lib/types";

export const metadata = { title: "Import members" };

/**
 * Where a direct sync actually stands, per platform (D1 walkthrough #31).
 *
 * Written from what each vendor publishes, because "coming soon" over a single
 * logo was telling every gym the same thing and it was not true for any of
 * them. The three cases are genuinely different:
 *
 *   - Mindbody has a real, documented API, and four gates in front of it:
 *     Mindbody's own review of casdey as a partner, a card on file, a metered
 *     per-call charge, and an activation code that each individual studio has
 *     to turn on from its own Manager Tools. Buildable, and not a small job.
 *   - TeamUp gives a gym its own API credentials from Settings, at no cost and
 *     with nobody's approval. This is the one that is genuinely easy, and it
 *     is first when a gym on TeamUp actually asks for it.
 *   - LegitFit publishes no developer API at all. Its Zapier app is
 *     trigger-only, so it can tell casdey about a booking that happens from now
 *     on and can never hand over the members who already lapsed, which is the
 *     entire list casdey needs. CSV is not a stopgap there, it is the only way.
 */
const INTEGRATIONS: { name: string; status: string }[] = [
  {
    name: mindbodySource.label,
    status:
      "Has an API, but casdey needs Mindbody's approval as a partner and each studio has to switch it on. Not connected yet.",
  },
  {
    name: "TeamUp",
    status:
      "Gives you your own API key from your TeamUp settings, free. The most likely first sync casdey builds.",
  },
  {
    name: "LegitFit",
    status:
      "Publishes no API, and its Zapier app can only report bookings from now on, never your existing members. CSV is the way in.",
  },
  {
    name: "Glofox, Wodify, PushPress and the rest",
    status: "CSV export. It works today and casdey reads all of them.",
  },
];

export default async function ImportPage() {
  const { gym, session, role } = await requireGym();

  const { data } = await session.supabase
    .from("imports")
    .select("*")
    .eq("gym_id", gym.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const runs = (data ?? []) as ImportRun[];

  return (
    <>
      <PageHeader
        eyebrow="Import"
        title="Bring your member list in"
        lede="casdey reads a CSV export from any gym software. Your list stays in the EU and is never shared with anyone."
      />

      {/* Importing and seeing who is lapsed is open to every plan, including
          Free. Sending is where a paid plan is required, and that gate lives on
          the campaigns side. */}
      {!gym.processing_agreed_at ? (
        <ProcessingAgreement
          gymName={gym.name}
          canAgree={role === "owner"}
        />
      ) : (
        <ImportWizard />
      )}

      <section className="mt-10">
        <h2 className="display mb-1 text-[1.25rem]">Where else it can come from</h2>
        <p className="mb-4 max-w-[46rem] text-[0.9375rem] text-graphite">
          A direct sync would mean no exporting each month. Whether that is
          possible depends entirely on your software, and the honest answer
          differs by platform, so here is where each one stands rather than a
          promise that covers none of them.
        </p>
        <Card className="!p-0 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Software</th>
                <th>Where it stands</th>
              </tr>
            </thead>
            <tbody>
              {INTEGRATIONS.map((row) => (
                <tr key={row.name}>
                  <td className="font-medium text-ink">{row.name}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 max-w-[46rem] text-[0.875rem] text-stone">
          Until one of these is live, the CSV export above does the same job and
          works with every one of them. If your software is not listed, export a
          CSV and casdey will read it.
        </p>
      </section>

      <PastImports runs={runs} canUndo={role === "owner"} />
    </>
  );
}
