import { Pill } from "./ui";
import type { CampaignStatus } from "@/lib/types";

export function CampaignPill({ status }: { status: CampaignStatus }) {
  if (status === "sending") return <Pill tone="teal">Sending</Pill>;
  if (status === "sent") return <Pill tone="teal">Finished</Pill>;
  if (status === "paused") return <Pill>Paused</Pill>;
  if (status === "cancelled") return <Pill>Cancelled</Pill>;
  return <Pill>Draft, not sent</Pill>;
}
