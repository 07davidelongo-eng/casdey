import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePractice } from "@/lib/dal";
import { CampaignPill } from "@/components/app/campaign-pill";
import { CampaignControls } from "./controls";
import { TestSendForm } from "./test-send-form";
import { WhatsAppTestForm } from "./whatsapp-test-form";
import {
  Card,
  CardTitle,
  PageHeader,
  Stat,
  formatDate,
} from "@/components/app/ui";
import type { Campaign, MessageStatus } from "@/lib/types";

export default async function CampaignPage(
  props: PageProps<"/app/campaigns/[id]">,
) {
  const { id } = await props.params;
  const { practice, session } = await requirePractice();

  const { data } = await session.supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (!data) notFound();
  const campaign = data as Campaign;
  const isWhatsApp = campaign.channel === "whatsapp";

  // patients!inner(is_test) + the eq below excludes the self-test send's own
  // message row (see /app/campaigns/[id]/test-send-form.tsx): without it, the
  // synthetic patient's one-off "sent" row gets counted alongside the real
  // audience and these stats stop matching the "will go to N patients" count
  // shown before approval.
  const { data: messages } = await session.supabase
    .from("campaign_messages")
    .select("status, patients!inner(is_test)")
    .eq("campaign_id", campaign.id)
    .eq("patients.is_test", false);

  const counts = (messages ?? []).reduce<Record<string, number>>(
    (totals, row) => {
      const status = row.status as MessageStatus;
      totals[status] = (totals[status] ?? 0) + 1;
      return totals;
    },
    {},
  );

  const queued = counts.queued ?? 0;
  const sent = counts.sent ?? 0;

  return (
    <div className="max-w-[44rem]">
      <Link
        href="/app/campaigns"
        className="text-[0.875rem] text-graphite underline underline-offset-4 hover:text-ink"
      >
        Back to campaigns
      </Link>

      <div className="mt-4">
        <PageHeader
          title={campaign.name}
          lede={
            campaign.status === "draft"
              ? "Read it through. Nothing has been sent, and nothing will be until you approve it."
              : `Approved ${formatDate(campaign.approved_at)}.`
          }
          actions={<CampaignPill status={campaign.status} />}
        />
      </div>

      {campaign.status !== "draft" && !isWhatsApp ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Sent" value={sent} tone="teal" />
          <Stat label="Still queued" value={queued} />
          <Stat
            label="Not delivered"
            value={(counts.failed ?? 0) + (counts.suppressed ?? 0)}
            hint="failed, or unsubscribed before we got there"
          />
        </div>
      ) : null}

      <Card>
        <CardTitle>{isWhatsApp ? "The opening template" : "The message"}</CardTitle>
        <div className="mt-4 rounded-[14px] border border-ash bg-paper p-5">
          {isWhatsApp ? (
            <p className="literal text-[0.875rem] text-graphite">
              Template: {campaign.whatsapp_template_name ?? "not configured"}
            </p>
          ) : (
            <>
              <p className="mb-4 border-b border-ash pb-3 text-[0.9375rem] font-semibold text-ink">
                {campaign.subject}
              </p>
              <pre className="font-[family-name:var(--font-inter)] text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-graphite">
                {campaign.body}
              </pre>
            </>
          )}
        </div>
        <p className="field-hint">
          {isWhatsApp
            ? "Once a patient replies, casdey's assistant carries the conversation from here and hands off the moment they show interest in booking."
            : "Merge fields are filled in per patient, and the unsubscribe line is added to every message."}
        </p>
      </Card>

      <div className="mt-6">
        {isWhatsApp ? (
          <WhatsAppTestForm
            campaignId={campaign.id}
            whatsappEnabled={practice.whatsapp_enabled}
          />
        ) : (
          <TestSendForm campaignId={campaign.id} email={session.email} />
        )}
      </div>

      <div className="mt-6">
        <CampaignControls
          campaignId={campaign.id}
          status={campaign.status}
          channel={campaign.channel}
          audienceCount={campaign.audience?.patientCount ?? 0}
          dailyCap={practice.daily_send_cap}
        />
      </div>
    </div>
  );
}
