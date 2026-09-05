import Link from "next/link";

import { requireGym } from "@/lib/dal";
import type { AuditAction } from "@/lib/audit";
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

/**
 * Plain English for every audited action.
 *
 * Typed against AuditAction rather than string on purpose: this page is what
 * a gym, or a regulator, reads to see who did what, and an unlabelled action
 * shows up there as a raw database key. Eleven of them were doing exactly that
 * — booking.booked, gym.services_updated, both of the sending.* ones — because
 * a Record<string, string> lets a new action ship with no label and say
 * nothing about it. Now the compiler refuses.
 */
const ACTION_LABEL: Record<AuditAction, string> = {
  "gym.created": "Gym set up",
  "gym.updated": "Settings changed",
  "gym.services_updated": "Service prices changed",
  "processing.agreed": "Data protection terms accepted",
  "members.imported": "Members imported",
  "member.deleted": "A member was erased",
  "member.return_undone": "A member's return was undone",
  "member.cancelled": "A member was marked cancelled",
  "members.purged": "All member data deleted",
  "members.exported": "Member data exported",
  "campaign.created": "Campaign created",
  "campaign.test_sent": "Sent a test of a campaign to yourself",
  "campaign.approved": "Campaign approved and started",
  "campaign.paused": "Campaign paused",
  "campaign.cancelled": "Campaign cancelled",
  "member.unsubscribed": "A member unsubscribed",
  "whatsapp.settings_updated": "WhatsApp settings changed",
  "booking.settings_updated": "Booking settings changed",
  "calendar.connected": "Google Calendar connected",
  "calendar.disconnected": "Google Calendar disconnected",
  "sending.domain_connected": "Sending domain connected",
  "sending.domain_disconnected": "Sending domain disconnected",
  "booking.booked": "A member booked a time",
  "booking.cancelled": "A booking was cancelled",
  "billing.started": "Billing set up",
  "billing.updated": "Billing changed",
  "guarantee.claimed": "Guarantee refund claimed",
};

export default async function DataSettingsPage() {
  const { gym, session, role } = await requireGym();

  const { data } = await session.supabase
    .from("audit_log")
    .select("id, created_at, action, actor_email, meta")
    .eq("gym_id", gym.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const entries = (data ?? []) as AuditRow[];

  const { count: memberCount } = await session.supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gym.id)
    .eq("is_test", false);

  return (
    <div className="max-w-[42rem] space-y-6">
      <Card>
        <CardTitle>Where your member data lives</CardTitle>
        <ul className="mt-4 space-y-2.5 text-[0.9375rem] text-graphite">
          <li>
            Stored in Ireland, in the EU, encrypted at rest and in transit.
          </li>
          <li>
            {gym.name} is the data controller. casdey is the processor, and
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
        {gym.processing_agreed_at ? (
          <p className="field-hint">
            Terms accepted{" "}
            <span className="literal">
              {formatDate(gym.processing_agreed_at)}
            </span>
            .
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Take your data with you</CardTitle>
        <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
          Everything casdey holds about your members, as a CSV you can open
          anywhere. Downloading it is recorded below.
        </p>
        <a
          href="/api/export"
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-ash bg-white px-4 py-2.5 text-[0.9375rem] font-semibold text-ink transition-[transform,border-color] duration-200 hover:-translate-y-px hover:border-stone"
        >
          Download member data
        </a>
      </Card>

      <Card>
        <CardTitle>Delete everything</CardTitle>
        <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
          Permanently erases all{" "}
          <span className="literal font-medium text-ink">
            {memberCount ?? 0}
          </span>{" "}
          member records, their history, and anything still queued to send.
          This cannot be undone and we cannot recover it for you.
        </p>
        <PurgeForm
          gymName={gym.name}
          canPurge={role === "owner"}
          memberCount={memberCount ?? 0}
        />
      </Card>

      <section>
        <h2 className="display mb-1 text-[1.25rem]">Who did what</h2>
        <p className="mb-4 text-[0.9375rem] text-graphite">
          Every action touching member data, kept for 24 months. This log
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
                    <td>{ACTION_LABEL[entry.action as AuditAction] ?? entry.action}</td>
                    <td className="literal text-[0.8125rem]">
                      {entry.actor_email ?? "the member"}
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
