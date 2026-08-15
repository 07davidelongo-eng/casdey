import Link from "next/link";

import { requirePractice } from "@/lib/dal";
import { Card, CardTitle, formatDate } from "@/components/app/ui";
import { PurgeForm } from "./purge-form";

export const metadata = { title: "Data and privacy" };

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  actor_email: string | null;
  meta: Record<string, unknown>;
};

const ACTION_LABEL: Record<string, string> = {
  "practice.created": "Practice set up",
  "practice.updated": "Settings changed",
  "processing.agreed": "Data protection terms accepted",
  "patients.imported": "Patients imported",
  "patient.deleted": "A patient was erased",
  "patients.purged": "All patient data deleted",
  "patients.exported": "Patient data exported",
  "campaign.created": "Campaign created",
  "campaign.test_sent": "Sent a test of a campaign to yourself",
  "campaign.approved": "Campaign approved and started",
  "campaign.paused": "Campaign paused",
  "campaign.cancelled": "Campaign cancelled",
  "patient.unsubscribed": "A patient unsubscribed",
  "billing.started": "Billing set up",
  "billing.updated": "Billing changed",
  "guarantee.claimed": "Guarantee refund claimed",
};

export default async function DataSettingsPage() {
  const { practice, session, role } = await requirePractice();

  const { data } = await session.supabase
    .from("audit_log")
    .select("id, created_at, action, actor_email, meta")
    .eq("practice_id", practice.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const entries = (data ?? []) as AuditRow[];

  const { count: patientCount } = await session.supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("practice_id", practice.id)
    .eq("is_test", false);

  return (
    <div className="max-w-[42rem] space-y-6">
      <Card>
        <CardTitle>Where your patient data lives</CardTitle>
        <ul className="mt-4 space-y-2.5 text-[0.9375rem] text-graphite">
          <li>
            Stored in Ireland, in the EU, encrypted at rest and in transit.
          </li>
          <li>
            {practice.name} is the data controller. casdey is the processor, and
            only ever acts on your instructions.
          </li>
          <li>
            Never sold, never shared with anyone else, never used to train
            anything.
          </li>
          <li>
            Deleted within 30 days of your account closing, or the moment you
            ask, whichever is first.
          </li>
          <li>
            The full terms are in the{" "}
            <Link
              href="/terms/processing"
              className="text-teal underline underline-offset-4"
            >
              data processing terms
            </Link>{" "}
            and the{" "}
            <Link
              href="/privacy"
              className="text-teal underline underline-offset-4"
            >
              privacy notice
            </Link>
            .
          </li>
        </ul>
        {practice.processing_agreed_at ? (
          <p className="field-hint">
            Terms accepted{" "}
            <span className="literal">
              {formatDate(practice.processing_agreed_at)}
            </span>
            .
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Take your data with you</CardTitle>
        <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
          Everything casdey holds about your patients, as a CSV you can open
          anywhere. Downloading it is recorded below.
        </p>
        <a
          href="/api/export"
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-ash bg-white px-4 py-2.5 text-[0.9375rem] font-semibold text-ink transition-[transform,border-color] duration-200 hover:-translate-y-px hover:border-stone"
        >
          Download patient data
        </a>
      </Card>

      <Card>
        <CardTitle>Delete everything</CardTitle>
        <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
          Permanently erases all{" "}
          <span className="literal font-medium text-ink">
            {patientCount ?? 0}
          </span>{" "}
          patient records, their history, and anything still queued to send.
          This cannot be undone and we cannot recover it for you.
        </p>
        <PurgeForm
          practiceName={practice.name}
          canPurge={role === "owner"}
          patientCount={patientCount ?? 0}
        />
      </Card>

      <section>
        <h2 className="display mb-1 text-[1.25rem]">Who did what</h2>
        <p className="mb-4 text-[0.9375rem] text-graphite">
          Every action touching patient data, kept for 24 months. This log
          cannot be edited or deleted, including by us.
        </p>

        {entries.length === 0 ? (
          <Card>
            <p className="text-[0.9375rem] text-graphite">Nothing recorded yet.</p>
          </Card>
        ) : (
          <Card className="!p-0 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Who</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="literal text-[0.8125rem] whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </td>
                    <td>{ACTION_LABEL[entry.action] ?? entry.action}</td>
                    <td className="literal text-[0.8125rem]">
                      {entry.actor_email ?? "the patient"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
