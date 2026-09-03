import { Pill } from "./ui";
import type { CampaignKind, CampaignStatus, Channel } from "@/lib/types";

export function CampaignPill({ status }: { status: CampaignStatus }) {
  if (status === "sending") return <Pill tone="teal">Sending</Pill>;
  if (status === "sent") return <Pill tone="teal">Finished</Pill>;
  if (status === "paused") return <Pill>Paused</Pill>;
  if (status === "cancelled") return <Pill>Cancelled</Pill>;
  return <Pill>Draft, not sent</Pill>;
}

export function CampaignKindPill({ kind }: { kind: CampaignKind }) {
  return kind === "at_risk" ? <Pill>Check in early</Pill> : <Pill>Win back</Pill>;
}

export function CampaignChannelPill({ channel }: { channel: Channel }) {
  return channel === "whatsapp" ? (
    <Pill tone="teal">WhatsApp</Pill>
  ) : (
    <Pill>Email</Pill>
  );
}
