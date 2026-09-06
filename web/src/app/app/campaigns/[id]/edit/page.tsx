import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireGym } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { parseFollowUps } from "@/lib/follow-ups";
import { PageHeader } from "@/components/app/ui";
import { EditCampaignForm } from "./form";
import type { CampaignKind } from "@/lib/types";

export const metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({
  params,
}: PageProps<"/app/campaigns/[id]/edit">) {
  const { id } = await params;
  const { gym } = await requireGym();

  const { data: campaign } = await supabaseAdmin()
    .from("campaigns")
    .select(
      "id, gym_id, name, kind, channel, status, subject, body, language, personalise, follow_ups",
    )
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!campaign) notFound();

  // A campaign that has left the building is not editable, and sending someone
  // to a form that would refuse to save is worse than not offering it.
  if (campaign.status !== "draft") redirect(`/app/campaigns/${id}`);

  // WhatsApp openers are Meta-approved templates, so there is no freeform copy
  // to edit and no editor to show.
  if (campaign.channel === "whatsapp") redirect(`/app/campaigns/${id}`);

  return (
    <div className="max-w-[44rem]">
      <Link
        href={`/app/campaigns/${id}`}
        className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
      >
        Back to the campaign
      </Link>

      <div className="mt-4 mb-6">
        <PageHeader
          eyebrow="Draft"
          title="Edit before it goes out"
          lede="Nothing has been sent. Change whatever you like and save, or go back and approve it as it stands."
        />
      </div>

      <EditCampaignForm
        campaignId={campaign.id as string}
        kind={campaign.kind as CampaignKind}
        initial={{
          name: campaign.name as string,
          subject: (campaign.subject as string) ?? "",
          body: (campaign.body as string) ?? "",
          language: (campaign.language as string) ?? "en",
          personalise: Boolean(campaign.personalise),
          followUps: parseFollowUps(campaign.follow_ups),
        }}
      />
    </div>
  );
}
