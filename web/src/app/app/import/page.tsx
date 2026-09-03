import { requireGym } from "@/lib/dal";
import { ImportWizard } from "@/components/app/import-wizard";
import { ProcessingAgreement } from "./agreement";
import { Card, PageHeader, formatDate } from "@/components/app/ui";
import { mindbodySource } from "@/lib/ingestion/mindbody";
import type { ImportRun } from "@/lib/types";

export const metadata = { title: "Import members" };

export default async function ImportPage() {
  const { gym, session, role } = await requireGym();

  const { data } = await session.supabase
    .from("imports")
    .select("*")
    .eq("gym_id", gym.id)
    .order("created_at", { ascending: false })
    .limit(10);

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
        <p className="mb-4 text-[0.9375rem] text-graphite">
          A direct sync means no exporting each month.
        </p>
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.9375rem] font-semibold text-ink">
              {mindbodySource.label}
            </p>
            <p className="text-[0.875rem] text-stone">
              Not connected yet. Until it is, the CSV export above does the same
              job.
            </p>
          </div>
          <span className="pill pill-quiet">Coming</span>
        </Card>
      </section>

      {runs.length > 0 ? (
        <section className="mt-10">
          <h2 className="display mb-4 text-[1.25rem]">Past imports</h2>
          <Card className="!p-0 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>File</th>
                  <th>Added</th>
                  <th>Updated</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="literal text-[0.8125rem]">
                      {formatDate(run.created_at)}
                    </td>
                    <td className="max-w-[16rem] truncate">
                      {run.filename ?? run.source}
                    </td>
                    <td className="literal">{run.imported_count}</td>
                    <td className="literal">{run.updated_count}</td>
                    <td className="literal">{run.skipped_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ) : null}
    </>
  );
}
