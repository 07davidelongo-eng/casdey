import "server-only";

import { supabaseAdmin } from "./supabase";
import { bookingUrl, emailProvider, unsubscribeUrl } from "./messaging";
import { composeBody, contextFor, renderTemplate } from "./template";
import { capabilities } from "./plan";
import type { Gym } from "./types";

/**
 * Drains the send queue.
 *
 * Called on a schedule rather than in a request, because sending a campaign
 * takes minutes to days and nobody is going to hold a browser tab open for it.
 *
 * Every message passes four checks before it leaves, in this order, because
 * each one is a different way of emailing somebody we must not email:
 *
 *   1. The gym is still paying. A cancelled account stops sending.
 *   2. The campaign is still approved and running.
 *   3. The address is not suppressed. Checked here and not only at queue time,
 *      because somebody can unsubscribe in between.
 *   4. The member still exists and still consents.
 */

const BATCH_LIMIT = 25;

export type SendReport = {
  sent: number;
  failed: number;
  suppressed: number;
  skipped: number;
};

type QueuedMessage = {
  id: string;
  gym_id: string;
  campaign_id: string;
  member_id: string;
  to_email: string;
  unsubscribe_token: string;
  attempts: number;
};

export async function drainQueue(
  limit: number = BATCH_LIMIT,
): Promise<SendReport> {
  const client = supabaseAdmin();
  const report: SendReport = { sent: 0, failed: 0, suppressed: 0, skipped: 0 };

  // Snapshot the cutoff once so the same value gates both the initial read and
  // the per-row claim below.
  const nowIso = new Date().toISOString();
  // How long a claimed row is hidden from other drains while this one works it.
  // Comfortably longer than a send (the cron route caps at ~60s); if this run
  // crashes mid-send the row simply becomes due again after the lease.
  const leaseUntil = new Date(Date.now() + 10 * 60_000).toISOString();

  const { data, error } = await client
    .from("campaign_messages")
    .select(
      "id, gym_id, campaign_id, member_id, to_email, unsubscribe_token, attempts",
    )
    .eq("status", "queued")
    .lte("send_after", nowIso)
    .order("send_after", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`queue read failed: ${error.message}`);

  const messages = (data ?? []) as QueuedMessage[];
  if (messages.length === 0) return report;

  const provider = emailProvider();

  // Cached per run: a batch is usually one or two gyms and one campaign.
  const gyms = new Map<string, Gym | null>();
  const campaigns = new Map<
    string,
    { status: string; subject: string; body: string; approved_at: string | null } | null
  >();
  const sentToday = new Map<string, number>();

  for (const message of messages) {
    // Atomically claim the row before doing anything with it. Two overlapping
    // drains (the hourly cron and a manual trigger, or a Vercel retry) both read
    // the same queued rows; without this the same member gets emailed twice.
    // The claim moves send_after to the lease, and the `.lte(send_after, nowIso)`
    // guard is what makes it exclusive: whichever drain commits first bumps the
    // value out of range, so the other claims nothing and skips the row.
    const { data: claimed } = await client
      .from("campaign_messages")
      .update({ send_after: leaseUntil })
      .eq("id", message.id)
      .eq("status", "queued")
      .lte("send_after", nowIso)
      .select("id")
      .maybeSingle();

    if (!claimed) continue; // another drain already took this message

    const gym = await cached(gyms, message.gym_id, async () => {
      const { data: row } = await client
        .from("gyms")
        .select("*")
        .eq("id", message.gym_id)
        .maybeSingle();
      return (row as Gym) ?? null;
    });

    if (!gym || !capabilities(gym).canSendCampaigns) {
      await hold(message.id, "Plan does not allow sending");
      report.skipped += 1;
      continue;
    }

    const campaign = await cached(campaigns, message.campaign_id, async () => {
      const { data: row } = await client
        .from("campaigns")
        .select("status, subject, body, approved_at")
        .eq("id", message.campaign_id)
        .maybeSingle();
      return row as {
        status: string;
        subject: string;
        body: string;
        approved_at: string | null;
      } | null;
    });

    if (!campaign || !campaign.approved_at || campaign.status !== "sending") {
      await hold(message.id, "Campaign is not running");
      report.skipped += 1;
      continue;
    }

    // Per-gym daily ceiling, counted fresh so a restart cannot double it.
    const used = await cached(sentToday, message.gym_id, async () => {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const { count } = await client
        .from("campaign_messages")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", message.gym_id)
        .eq("status", "sent")
        .gte("sent_at", since.toISOString());
      return count ?? 0;
    });

    if (used >= gym.daily_send_cap) {
      report.skipped += 1;
      continue;
    }

    const { data: suppression } = await client
      .from("suppressions")
      .select("email")
      .eq("gym_id", message.gym_id)
      .eq("email", message.to_email.toLowerCase())
      .maybeSingle();

    if (suppression) {
      await client
        .from("campaign_messages")
        .update({ status: "suppressed" })
        .eq("id", message.id);
      report.suppressed += 1;
      continue;
    }

    const { data: member } = await client
      .from("members")
      .select("id, first_name, last_visit_at, consent_email, status, booking_token")
      .eq("id", message.member_id)
      .maybeSingle();

    if (!member || !member.consent_email || member.status === "opted_out") {
      await client
        .from("campaign_messages")
        .update({ status: "suppressed" })
        .eq("id", message.id);
      report.suppressed += 1;
      continue;
    }

    const context = contextFor(
      { first_name: member.first_name, last_visit_at: member.last_visit_at },
      gym,
      new Date(),
      gym.booking_enabled ? bookingUrl(member.booking_token) : null,
    );

    try {
      await provider.send({
        to: message.to_email,
        subject: renderTemplate(campaign.subject, context),
        text: composeBody({
          body: campaign.body,
          context,
          unsubscribeUrl: unsubscribeUrl(message.unsubscribe_token),
          replyTo: gym.reply_to_email,
          providerCanSetReplyTo: provider.canSetReplyTo,
        }),
        fromName: gym.sender_name ?? gym.name,
        replyTo: gym.reply_to_email,
      });

      const now = new Date().toISOString();

      await client
        .from("campaign_messages")
        .update({ status: "sent", sent_at: now, attempts: message.attempts + 1 })
        .eq("id", message.id);

      // Only ever moves someone forward. A member already marked returned
      // must not be dragged back to "contacted" by a later send.
      await client
        .from("members")
        .update({ status: "contacted", contacted_at: now })
        .eq("id", member.id)
        .eq("status", "active");

      await client.from("member_events").insert({
        gym_id: message.gym_id,
        member_id: member.id,
        type: "message_sent",
        meta: { campaign_id: message.campaign_id },
      });

      sentToday.set(message.gym_id, used + 1);
      report.sent += 1;
    } catch (sendError) {
      const detail =
        sendError instanceof Error ? sendError.message : String(sendError);
      console.error("[send] failed", message.id, detail);

      const attempts = message.attempts + 1;
      // Three goes, then it stops. A permanently bad address should not be
      // retried forever, and a real outage will have cleared inside three runs.
      await client
        .from("campaign_messages")
        .update({
          attempts,
          status: attempts >= 3 ? "failed" : "queued",
          error: detail.slice(0, 500),
          send_after: new Date(Date.now() + 15 * 60_000).toISOString(),
        })
        .eq("id", message.id);

      if (attempts >= 3) {
        await client.from("member_events").insert({
          gym_id: message.gym_id,
          member_id: message.member_id,
          type: "message_failed",
          meta: { campaign_id: message.campaign_id },
        });
        report.failed += 1;
      }
    }
  }

  await closeFinishedCampaigns();
  return report;
}

/** Pushes a message back without burning an attempt. */
async function hold(messageId: string, reason: string): Promise<void> {
  await supabaseAdmin()
    .from("campaign_messages")
    .update({
      error: reason,
      send_after: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    })
    .eq("id", messageId);
}

async function cached<T>(
  store: Map<string, T>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const existing = store.get(key);
  if (existing !== undefined) return existing;
  const value = await load();
  store.set(key, value);
  return value;
}

/** A campaign with nothing left queued is finished. */
async function closeFinishedCampaigns(): Promise<void> {
  const client = supabaseAdmin();

  const { data: running } = await client
    .from("campaigns")
    .select("id")
    .eq("status", "sending");

  for (const campaign of running ?? []) {
    const { count } = await client
      .from("campaign_messages")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "queued");

    if ((count ?? 0) === 0) {
      await client
        .from("campaigns")
        .update({ status: "sent", completed_at: new Date().toISOString() })
        .eq("id", campaign.id);
    }
  }
}
