"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import type { CampaignStatus, Channel } from "@/lib/types";
import {
  approveCampaignAction,
  setCampaignStatusAction,
  type CampaignState,
} from "../actions";

const INITIAL: CampaignState = { error: null };

export function CampaignControls({
  campaignId,
  status,
  channel,
  audienceCount,
  dailyCap,
}: {
  campaignId: string;
  status: CampaignStatus;
  channel: Channel;
  audienceCount: number;
  dailyCap: number;
}) {
  const isWhatsApp = channel === "whatsapp";
  const [approveState, approve, approving] = useActionState(
    approveCampaignAction,
    INITIAL,
  );
  const [statusState, changeStatus, changing] = useActionState(
    setCampaignStatusAction,
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  const error = approveState.error ?? statusState.error;
  const days = Math.ceil(audienceCount / Math.max(1, dailyCap));

  if (status === "draft") {
    return (
      <Card>
        <CardTitle>Send it</CardTitle>
        <p className="mt-1 mb-5 text-[0.9375rem] text-graphite">
          {isWhatsApp ? (
            <>
              This sends the opening template to roughly{" "}
              <span className="literal font-medium text-ink">
                {audienceCount}
              </span>{" "}
              {audienceCount === 1 ? "member" : "members"} in one go. The exact
              list is rebuilt when you approve, so anyone imported or opted out
              since is accounted for. After a member replies, casdey&apos;s
              assistant takes over.
            </>
          ) : (
            <>
              This writes to roughly{" "}
              <span className="literal font-medium text-ink">
                {audienceCount}
              </span>{" "}
              {audienceCount === 1 ? "member" : "members"} over about{" "}
              <span className="literal font-medium text-ink">{days}</span>{" "}
              {days === 1 ? "day" : "days"}. The exact list is rebuilt when you
              approve, so anyone imported or unsubscribed since is accounted
              for. You can pause at any point.
            </>
          )}
        </p>

        {!confirming ? (
          <Button onClick={() => setConfirming(true)}>
            {isWhatsApp ? "Approve and send" : "Approve and start sending"}
          </Button>
        ) : (
          <form action={approve} className="flex flex-wrap gap-2">
            <input type="hidden" name="campaignId" value={campaignId} />
            <Button type="submit" disabled={approving}>
              {approving
                ? isWhatsApp
                  ? "Sending"
                  : "Starting"
                : isWhatsApp
                  ? "Yes, send now"
                  : "Yes, start sending"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Not yet
            </Button>
          </form>
        )}

        {error ? (
          <p role="alert" className="notice notice-error mt-4">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  if (status === "sent" || status === "cancelled") {
    return (
      <Card>
        <p className="text-[0.9375rem] text-graphite">
          {status === "sent"
            ? "This campaign has finished. Nothing more will go out from it."
            : "This campaign was cancelled. Nothing further was sent."}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>{status === "paused" ? "Paused" : "Sending"}</CardTitle>
      <p className="mt-1 mb-5 text-[0.9375rem] text-graphite">
        {status === "paused"
          ? "Nothing is going out. The queue is intact, so resuming picks up where it stopped."
          : "Messages are going out at your daily pace. Pausing stops it immediately."}
      </p>

      <div className="flex flex-wrap gap-2">
        <form action={changeStatus}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input
            type="hidden"
            name="status"
            value={status === "paused" ? "sending" : "paused"}
          />
          <Button type="submit" variant="quiet" disabled={changing}>
            {status === "paused" ? "Resume sending" : "Pause"}
          </Button>
        </form>

        <form action={changeStatus}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="status" value="cancelled" />
          <Button type="submit" variant="danger" disabled={changing}>
            Cancel the rest
          </Button>
        </form>
      </div>

      {error ? (
        <p role="alert" className="notice notice-error mt-4">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
