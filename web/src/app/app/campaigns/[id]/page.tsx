import Link from "next/link";
import { notFound } from "next/navigation";

import { requireGym } from "@/lib/dal";
import { CampaignKindPill, CampaignPill } from "@/components/app/campaign-pill";
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
  const { gym, session } = await requireGym();

  const { data } = await session.supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!data) notFound();
  const campaign = data as Campaign;

  // members!inner(is_test) + the eq below excludes the self-test send's own
  // message row (see /app/campaigns/[id]/test-send-form.tsx): without it, the
  // synthetic member's one-off "sent" row gets counted alongside the real
  // audience and these stats stop matching the "will go to N members" count
  // shown before approval.
  const { data: messages } = await session.supabase
    .from("campaign_messages")
    .select("status, members!inner(is_test)")
    .eq("campaign_id", campaign.id)
    .eq("members.is_test", false);

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

  const isWhatsApp = campaign.channel === "whatsapp";

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
          actions={
            <div className="flex gap-2">
              <CampaignKindPill kind={campaign.kind} />
              <CampaignPill status={campaign.status} />
            </div>
          }
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

      {campaign.status !== "draft" && isWhatsApp ? (
        <div className="mb-6">
          <Stat
            label="Openers sent"
            value={campaign.audience?.memberCount ?? 0}
            tone="teal"
            hint="replies and the hand-off show on each member's page"
          />
        </div>
      ) : null}

      {isWhatsApp ? (
        <Card>
          <CardTitle>The opener</CardTitle>
          <p className="mt-2 text-[0.9375rem] text-graphite">
            The first message is your Meta-approved template{" "}
            <span className="literal">{campaign.whatsapp_template_name}</span>,
            sent with your gym name filled in. After a member replies,
            casdey&apos;s assistant continues the conversation and hands it to
            you when they ask to book.
          </p>
        </Card>
      ) : (
        <Card>
          <CardTitle>The message</CardTitle>
          <div className="mt-4 rounded-[14px] border border-ash bg-paper p-5">
            <p className="mb-4 border-b border-ash pb-3 text-[0.9375rem] font-semibold text-ink">
              {campaign.subject}
            </p>
            <pre className="font-[family-name:var(--font-inter)] text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-graphite">
              {campaign.body}
            </pre>
          </div>
          <p className="field-hint">
            Merge fields are filled in per member, and the unsubscribe line is
            added to every message.
          </p>
        </Card>
      )}

      <div className="mt-6">
        {isWhatsApp ? (
          <WhatsAppTestForm
            campaignId={campaign.id}
            whatsappEnabled={gym.whatsapp_enabled}
          />
        ) : (
          <TestSendForm campaignId={campaign.id} email={session.email} />
        )}
      </div>

      <div className="mt-6">
        <CampaignControls
          campaignId={campaign.id}
          status={campaign.status}
          audienceCount={campaign.audience?.memberCount ?? 0}
          dailyCap={gym.daily_send_cap}
        />
      </div>
    </div>
  );
}
