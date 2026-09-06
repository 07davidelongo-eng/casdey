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
type Integration = {
  name: string;
  /** Where it stands with casdey, in one line. */
  status: string;
  /** What the gym can do about it right now. */
  state: "request" | "csv";
  /** The vendor's own page for getting the export or the credentials. Their
   *  documentation, not casdey's: it stays right when they change their UI,
   *  and it is what a gym owner will recognise. */
  href: string;
  hrefLabel: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: mindbodySource.label,
    status:
      "A direct sync is possible but needs Mindbody to approve casdey as a partner and you to switch it on for your studio. Ask us and we will start it.",
    state: "request",
    href: "https://support.mindbodyonline.com/s/article/Exporting-client-data",
    hrefLabel: "How to export your clients",
  },
  {
    name: "TeamUp",
    status:
      "TeamUp gives you your own API key from your dashboard, at no cost, so this is the sync casdey can build fastest. Ask us and it moves to the front.",
    state: "request",
    href: "https://support.goteamup.com/en/articles/1794325-exporting-your-data",
    hrefLabel: "How to export your customers",
  },
  {
    name: "Glofox",
    status:
      "No self-serve API for member lists. Export from Glofox and casdey reads it.",
    state: "csv",
    href: "https://support.glofox.com/hc/en-us/sections/360002216procedure",
    hrefLabel: "Glofox support",
  },
  {
    name: "LegitFit",
    status:
      "Publishes no API, and its Zapier app can only report bookings from now on, never the members who already lapsed. The export is the only way in.",
    state: "csv",
    href: "https://help.legitfit.com/",
    hrefLabel: "LegitFit help centre",
  },
  {
    name: "PushPress",
    status: "Export your members and casdey reads it.",
    state: "csv",
    href: "https://help.pushpress.com/",
    hrefLabel: "PushPress help centre",
  },
  {
    name: "Wodify",
    status:
      "Its API covers workouts rather than membership, so the member list comes from an export.",
    state: "csv",
    href: "https://help.wodify.com/hc/en-us",
    hrefLabel: "Wodify help centre",
  },
  {
    name: "ABC Fitness, Zen Planner, Virtuagym and the rest",
    status:
      "casdey reads any CSV with a name, an email address and a last visit date. Nothing else is required.",
    state: "csv",
    href: "/contact",
    hrefLabel: "Tell us what you use",
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

      <PastImports runs={runs} canUndo={role === "owner"} />

      <section className="mt-10">
        <h2 className="display mb-1 text-[1.25rem]">Where else it can come from</h2>
        <p className="mb-4 max-w-[52rem] text-[0.9375rem] text-graphite">
          A direct sync means never exporting again. Whether one is possible
          depends on your software, so here is where each stands and how to get
          your list out today. Nothing here is switched on yet: where it says
          sync on request, ask us and we will build that one next.
        </p>
        <Card className="!p-0 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Software</th>
                <th>Where it stands</th>
                <th>Getting your list out</th>
              </tr>
            </thead>
            <tbody>
              {INTEGRATIONS.map((row) => (
                <tr key={row.name}>
                  <td className="font-medium whitespace-nowrap text-ink">
                    {row.name}
                  </td>
                  <td>
                    <span className="mb-1 block">
                      <span
                        className={
                          row.state === "request"
                            ? "pill pill-teal"
                            : "pill pill-quiet"
                        }
                      >
                        {row.state === "request"
                          ? "Sync on request"
                          : "CSV export"}
                      </span>
                    </span>
                    {row.status}
                  </td>
                  <td>
                    <a
                      href={row.href}
                      target={row.href.startsWith("http") ? "_blank" : undefined}
                      rel={
                        row.href.startsWith("http")
                          ? "noreferrer noopener"
                          : undefined
                      }
                      className="whitespace-nowrap text-teal underline underline-offset-4"
                    >
                      {row.hrefLabel}
                    </a>
                  </td>
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

    </>
  );
}
