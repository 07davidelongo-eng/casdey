import Link from "next/link";

import { requireGym } from "@/lib/dal";
import {
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  formatDate,
} from "@/components/app/ui";
import {
  CampaignChannelPill,
  CampaignKindPill,
  CampaignPill,
} from "@/components/app/campaign-pill";
import type { Campaign } from "@/lib/types";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { gym, session } = await requireGym();

  const { data } = await session.supabase
    .from("campaigns")
    .select("*")
    .eq("gym_id", gym.id)
    .order("created_at", { ascending: false });

  const campaigns = (data ?? []) as Campaign[];

  return (
    <>
      <PageHeader
        eyebrow="Campaigns"
        title="Getting them back"
        lede="A campaign writes once to everyone who has gone quiet, then stops. Nothing sends until you approve it."
        actions={<ButtonLink href="/app/campaigns/new">New campaign</ButtonLink>}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          body="Once your member list is in, a campaign is three fields and a read-through before anything goes out."
          action={
            <ButtonLink href="/app/campaigns/new">
              Build your first one
            </ButtonLink>
          }
        />
      ) : (
        <Card className="!p-0 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Members</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="font-medium text-ink">
                    <Link
                      href={`/app/campaigns/${campaign.id}`}
                      className="hover:text-teal hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td>
                    <CampaignChannelPill channel={campaign.channel} />
                  </td>
                  <td>
                    <CampaignKindPill kind={campaign.kind} />
                  </td>
                  <td>
                    <CampaignPill status={campaign.status} />
                  </td>
                  <td className="literal text-[0.8125rem]">
                    {campaign.audience?.memberCount ?? 0}
                  </td>
                  <td className="literal text-[0.8125rem]">
                    {formatDate(campaign.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
