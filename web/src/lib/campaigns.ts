import "server-only";

import { supabaseAdmin } from "./supabase";
import { lapseCutoff, type LapseRule } from "./lapse";
import type { Gym } from "./types";

/**
 * Turning a lapse rule into an actual list of people to write to, and then
 * into a queue.
 *
 * Two rules that do not bend:
 *
 *   - A campaign writes to a member once. The unique constraint on
 *     (campaign_id, member_id) makes a double-queue impossible even if this
 *     code is called twice.
 *   - Suppressed addresses never enter the queue, and are checked again at send
 *     time. Someone who unsubscribed between building and sending must not
 *     receive it.
 */

export type AudienceMember = {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_visit_at: string | null;
  booking_token: string;
};

/**
 * Everyone lapsed, reachable by email, and not on the do-not-contact list.
 *
 * Uses the service-role client because it runs as a batch, with gym_id
 * pinned by the caller from a verified session. Excludes the gym's own
 * self-test member (see ./self-test.ts): a real send must never write to it.
 */
export async function buildAudience(
  gymId: string,
  rule: LapseRule,
  now: Date = new Date(),
): Promise<AudienceMember[]> {
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("members")
    .select("id, email, phone, first_name, last_visit_at, booking_token")
    .eq("gym_id", gymId)
    .eq("is_test", false)
    .neq("status", "opted_out")
    .lte("visit_count", rule.maxVisits)
    .lte("last_visit_at", lapseCutoff(rule, now))
    .eq("consent_email", true)
    .not("email", "is", null)
    .order("last_visit_at", { ascending: true });

  if (error) {
    throw new Error(`audience query failed: ${error.code} ${error.message}`);
  }

  const candidates = (data ?? []) as AudienceMember[];
  if (candidates.length === 0) return [];

  const { data: suppressed } = await client
    .from("suppressions")
    .select("email")
    .eq("gym_id", gymId);

  const blocked = new Set(
    (suppressed ?? []).map((row) => String(row.email).toLowerCase()),
  );

  return candidates.filter(
    (member) => !blocked.has((member.email ?? "").toLowerCase()),
  );
}

/**
 * Writes the queue.
 *
 * Sends are spread over days rather than fired at once. A few hundred near
 * identical emails leaving one domain in a minute is what gets a sender
 * filtered, and a filtered sender means every later gym suffers for this
 * one campaign.
 */
export async function queueCampaign(options: {
  campaignId: string;
  gymId: string;
  audience: AudienceMember[];
  dailyCap: number;
  startAt?: Date;
}): Promise<number> {
  const client = supabaseAdmin();
  const start = options.startAt ?? new Date();
  const cap = Math.max(1, options.dailyCap);

  // buildAudience only ever returns members with an email, but the
  // AudienceMember type allows null. Anything without one here would mean a
  // caller passed the wrong audience in, so it is dropped rather than queued
  // with a null address.
  const withEmail = options.audience.filter(
    (member): member is AudienceMember & { email: string } =>
      member.email !== null,
  );

  const rows = withEmail.map((member, index) => {
    const dayOffset = Math.floor(index / cap);
    // Within a day the cron paces them further; this just decides which day.
    const sendAfter = new Date(start.getTime() + dayOffset * 86_400_000);

    return {
      gym_id: options.gymId,
      campaign_id: options.campaignId,
      member_id: member.id,
      to_email: member.email,
      status: "queued",
      send_after: sendAfter.toISOString(),
    };
  });

  let queued = 0;
  const BATCH = 500;

  for (let start_ = 0; start_ < rows.length; start_ += BATCH) {
    const slice = rows.slice(start_, start_ + BATCH);
    const { data, error } = await client
      .from("campaign_messages")
      // A member already queued for this campaign is left alone rather than
      // duplicated, which is what makes re-running this safe.
      .upsert(slice, {
        onConflict: "campaign_id,member_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      throw new Error(`queue failed: ${error.code} ${error.message}`);
    }
    queued += data?.length ?? 0;
  }

  return queued;
}

export function audienceSnapshot(
  gym: Gym,
  count: number,
): {
  lapsedAfterMonths: number;
  maxVisits: number;
  builtAt: string;
  memberCount: number;
} {
  return {
    lapsedAfterMonths: gym.lapsed_after_months,
    maxVisits: gym.max_visits,
    builtAt: new Date().toISOString(),
    memberCount: count,
  };
}
