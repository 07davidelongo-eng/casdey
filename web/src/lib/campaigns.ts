import "server-only";

import { supabaseAdmin } from "./supabase";
import {
  atRiskCutoff,
  lapseCutoff,
  type AtRiskRule,
  type LapseRule,
} from "./lapse";
import type { CancellationReason } from "./cancellation";
import type { CampaignKind, Gym } from "./types";

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

const AUDIENCE_COLUMNS =
  "id, email, phone, first_name, last_visit_at, booking_token";

/**
 * Win-back audience: everyone lapsed by visit recency, plus anyone staff
 * have explicitly marked cancelled (see src/lib/cancellation.ts) regardless
 * of how recently they last visited, since a formal cancellation is a
 * stronger, more immediate signal than waiting for the visit-recency cutoff
 * to catch up. The two are separate queries merged and de-duplicated by id,
 * rather than one combined filter, so each branch stays easy to read and
 * test on its own.
 *
 * Uses the service-role client because it runs as a batch, with gym_id
 * pinned by the caller from a verified session. Excludes the gym's own
 * self-test member (see ./self-test.ts): a real send must never write to it.
 *
 * reasonFilter narrows to members who cancelled for that one reason,
 * dropping the lapse branch entirely, for a gym that wants to run a
 * reason-specific campaign (e.g. a price-sensitive win-back).
 */
export async function buildAudience(
  gymId: string,
  rule: LapseRule,
  now: Date = new Date(),
  reasonFilter?: CancellationReason,
): Promise<AudienceMember[]> {
  const client = supabaseAdmin();

  type AudienceResult = {
    data: AudienceMember[] | null;
    error: { code: string; message: string } | null;
  };

  // Awaited and re-packed into a plain object on each branch, rather than
  // returning the Supabase query builder itself, which is what was sending
  // the compiler into an excessively-deep instantiation once two
  // differently-shaped filter chains needed a common array element type.
  async function lapsedBranch(): Promise<AudienceResult> {
    const { data, error } = await client
      .from("members")
      .select(AUDIENCE_COLUMNS)
      .eq("gym_id", gymId)
      .eq("is_test", false)
      .eq("consent_email", true)
      .not("email", "is", null)
      .neq("status", "opted_out")
      .lte("visit_count", rule.maxVisits)
      .lte("last_visit_at", lapseCutoff(rule, now));
    return { data: data as AudienceMember[] | null, error };
  }

  async function cancelledBranch(
    reason?: CancellationReason,
  ): Promise<AudienceResult> {
    const base = client
      .from("members")
      .select(AUDIENCE_COLUMNS)
      .eq("gym_id", gymId)
      .eq("is_test", false)
      .eq("consent_email", true)
      .not("email", "is", null)
      .neq("status", "opted_out")
      .neq("status", "returned");

    const { data, error } = reason
      ? await base.eq("cancellation_reason", reason)
      : await base.not("cancellation_reason", "is", null);
    return { data: data as AudienceMember[] | null, error };
  }

  const results: AudienceResult[] = reasonFilter
    ? [await cancelledBranch(reasonFilter)]
    : await Promise.all([lapsedBranch(), cancelledBranch()]);

  const byId = new Map<string, AudienceMember>();

  for (const { data, error } of results) {
    if (error) {
      throw new Error(`audience query failed: ${error.code} ${error.message}`);
    }
    for (const member of data ?? []) {
      byId.set(member.id, member);
    }
  }

  if (byId.size === 0) return [];

  const { data: suppressed } = await client
    .from("suppressions")
    .select("email")
    .eq("gym_id", gymId);

  const blocked = new Set(
    (suppressed ?? []).map((row) => String(row.email).toLowerCase()),
  );

  return [...byId.values()]
    .filter((member) => !blocked.has((member.email ?? "").toLowerCase()))
    .sort((a, b) => (a.last_visit_at ?? "").localeCompare(b.last_visit_at ?? ""));
}

/**
 * The WhatsApp win-back audience (Track E1). Same lapsed + cancelled logic as
 * buildAudience, but gated on a phone number and consent_whatsapp instead of
 * an email address and consent_email, and suppressed against
 * whatsapp_suppressions (phone-keyed) instead of suppressions (email-keyed).
 * WhatsApp campaigns are win-back only for V1: no at-risk variant, no
 * reason-scoped filter.
 */
export async function buildWhatsAppAudience(
  gymId: string,
  rule: LapseRule,
  now: Date = new Date(),
): Promise<AudienceMember[]> {
  const client = supabaseAdmin();

  type AudienceResult = {
    data: AudienceMember[] | null;
    error: { code: string; message: string } | null;
  };

  async function lapsedBranch(): Promise<AudienceResult> {
    const { data, error } = await client
      .from("members")
      .select(AUDIENCE_COLUMNS)
      .eq("gym_id", gymId)
      .eq("is_test", false)
      .eq("consent_whatsapp", true)
      .not("phone", "is", null)
      .neq("status", "opted_out")
      .lte("visit_count", rule.maxVisits)
      .lte("last_visit_at", lapseCutoff(rule, now));
    return { data: data as AudienceMember[] | null, error };
  }

  async function cancelledBranch(): Promise<AudienceResult> {
    const { data, error } = await client
      .from("members")
      .select(AUDIENCE_COLUMNS)
      .eq("gym_id", gymId)
      .eq("is_test", false)
      .eq("consent_whatsapp", true)
      .not("phone", "is", null)
      .neq("status", "opted_out")
      .neq("status", "returned")
      .not("cancellation_reason", "is", null);
    return { data: data as AudienceMember[] | null, error };
  }

  const results = await Promise.all([lapsedBranch(), cancelledBranch()]);

  const byId = new Map<string, AudienceMember>();
  for (const { data, error } of results) {
    if (error) {
      throw new Error(`whatsapp audience query failed: ${error.code} ${error.message}`);
    }
    for (const member of data ?? []) byId.set(member.id, member);
  }

  if (byId.size === 0) return [];

  const { data: suppressed } = await client
    .from("whatsapp_suppressions")
    .select("phone")
    .eq("gym_id", gymId);

  const blocked = new Set((suppressed ?? []).map((row) => String(row.phone)));

  return [...byId.values()]
    .filter((member) => member.phone !== null && !blocked.has(member.phone))
    .sort((a, b) => (a.last_visit_at ?? "").localeCompare(b.last_visit_at ?? ""));
}

/**
 * At-risk audience: still-active members whose last visit fell inside the
 * gym's at-risk window but hasn't yet crossed the lapse cutoff. See
 * isAtRisk in src/lib/lapse.ts for why these two ranges never overlap, and
 * for why this one, unlike the lapsed audiences above, has no visit cap.
 */
export async function buildAtRiskAudience(
  gymId: string,
  rule: AtRiskRule,
  now: Date = new Date(),
): Promise<AudienceMember[]> {
  const client = supabaseAdmin();

  // Spelled out rather than routed through applyAtRiskFilter (used for the
  // dashboard's count query in stats.ts): chaining that generic helper onto
  // a full-row .select() here sent the compiler into an excessively-deep
  // instantiation. isAtRisk in lapse.ts stays the one place this logic is
  // defined in prose; this and applyAtRiskFilter must be kept in step by hand.
  const { data, error } = await client
    .from("members")
    .select(AUDIENCE_COLUMNS)
    .eq("gym_id", gymId)
    .eq("is_test", false)
    .eq("consent_email", true)
    .not("email", "is", null)
    .eq("status", "active")
    .gt("last_visit_at", lapseCutoff(rule, now))
    .lte("last_visit_at", atRiskCutoff(rule, now))
    .order("last_visit_at", { ascending: true });

  if (error) {
    throw new Error(`at-risk audience query failed: ${error.code} ${error.message}`);
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
  options: { kind?: CampaignKind; reasonFilter?: CancellationReason } = {},
): {
  kind: CampaignKind;
  lapsedAfterMonths: number;
  maxVisits: number;
  atRiskAfterDays?: number;
  reasonFilter?: CancellationReason;
  builtAt: string;
  memberCount: number;
} {
  const kind = options.kind ?? "win_back";
  return {
    kind,
    lapsedAfterMonths: gym.lapsed_after_months,
    maxVisits: gym.max_visits,
    ...(kind === "at_risk" ? { atRiskAfterDays: gym.at_risk_after_days } : {}),
    ...(options.reasonFilter ? { reasonFilter: options.reasonFilter } : {}),
    builtAt: new Date().toISOString(),
    memberCount: count,
  };
}
