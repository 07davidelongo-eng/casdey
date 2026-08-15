import "server-only";

import { supabaseAdmin } from "./supabase";
import { dormancyCutoff, type DormancyRule } from "./dormancy";
import type { Channel, Practice } from "./types";

/**
 * Turning a dormancy rule into an actual list of people to write to, and then
 * into a queue.
 *
 * Two rules that do not bend:
 *
 *   - A campaign writes to a patient once. The unique constraint on
 *     (campaign_id, patient_id) makes a double-queue impossible even if this
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
};

/**
 * Everyone dormant, reachable on the given channel, and not on that channel's
 * do-not-contact list.
 *
 * Uses the service-role client because it runs as a batch, with practice_id
 * pinned by the caller from a verified session. Excludes the practice's own
 * self-test patient (see ./self-test.ts): a real send must never write to it.
 *
 * Email and WhatsApp have independent consent flags and independent
 * suppression lists (public.suppressions vs public.whatsapp_suppressions), so
 * the same patient can be reachable on one channel and blocked on the other.
 */
export async function buildAudience(
  practiceId: string,
  rule: DormancyRule,
  channel: Channel = "email",
  now: Date = new Date(),
): Promise<AudienceMember[]> {
  const client = supabaseAdmin();

  // Built as two full, separate queries rather than one base query mutated
  // by a conditional .eq()/.not() tail: chaining a reassigned builder through
  // a ternary blows up Supabase's generated filter-builder type (TS2589,
  // "Type instantiation is excessively deep") even though both branches are
  // simple. Some duplication, but it type-checks.
  const { data, error } =
    channel === "whatsapp"
      ? await client
          .from("patients")
          .select("id, email, phone, first_name, last_visit_at")
          .eq("practice_id", practiceId)
          .eq("is_test", false)
          .neq("status", "opted_out")
          .lte("visit_count", rule.maxVisits)
          .lte("last_visit_at", dormancyCutoff(rule, now))
          .eq("consent_whatsapp", true)
          .not("phone", "is", null)
          .order("last_visit_at", { ascending: true })
      : await client
          .from("patients")
          .select("id, email, phone, first_name, last_visit_at")
          .eq("practice_id", practiceId)
          .eq("is_test", false)
          .neq("status", "opted_out")
          .lte("visit_count", rule.maxVisits)
          .lte("last_visit_at", dormancyCutoff(rule, now))
          .eq("consent_email", true)
          .not("email", "is", null)
          .order("last_visit_at", { ascending: true });

  if (error) {
    throw new Error(`audience query failed: ${error.code} ${error.message}`);
  }

  const candidates = (data ?? []) as AudienceMember[];
  if (candidates.length === 0) return [];

  if (channel === "whatsapp") {
    const { data: suppressed } = await client
      .from("whatsapp_suppressions")
      .select("phone")
      .eq("practice_id", practiceId);

    const blocked = new Set((suppressed ?? []).map((row) => String(row.phone)));
    return candidates.filter((patient) => !blocked.has(patient.phone ?? ""));
  }

  const { data: suppressed } = await client
    .from("suppressions")
    .select("email")
    .eq("practice_id", practiceId);

  const blocked = new Set(
    (suppressed ?? []).map((row) => String(row.email).toLowerCase()),
  );

  return candidates.filter(
    (patient) => !blocked.has((patient.email ?? "").toLowerCase()),
  );
}

/**
 * Writes the queue. Email only: WhatsApp campaigns send immediately, batched
 * synchronously, in ./whatsapp/campaign-send.ts, rather than through this
 * queue (see that file for why a drip queue is the wrong shape for a
 * template send).
 *
 * Sends are spread over days rather than fired at once. A few hundred near
 * identical emails leaving one domain in a minute is what gets a sender
 * filtered, and a filtered sender means every later practice suffers for this
 * one campaign.
 */
export async function queueCampaign(options: {
  campaignId: string;
  practiceId: string;
  audience: AudienceMember[];
  dailyCap: number;
  startAt?: Date;
}): Promise<number> {
  const client = supabaseAdmin();
  const start = options.startAt ?? new Date();
  const cap = Math.max(1, options.dailyCap);

  // buildAudience(..., "email") only ever returns members with an email, but
  // the shared AudienceMember type allows null (WhatsApp members carry no
  // email at all). Anything without one here would mean a caller passed the
  // wrong audience in, so it is dropped rather than queued with a null address.
  const withEmail = options.audience.filter(
    (patient): patient is AudienceMember & { email: string } =>
      patient.email !== null,
  );

  const rows = withEmail.map((patient, index) => {
    const dayOffset = Math.floor(index / cap);
    // Within a day the cron paces them further; this just decides which day.
    const sendAfter = new Date(start.getTime() + dayOffset * 86_400_000);

    return {
      practice_id: options.practiceId,
      campaign_id: options.campaignId,
      patient_id: patient.id,
      to_email: patient.email,
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
      // A patient already queued for this campaign is left alone rather than
      // duplicated, which is what makes re-running this safe.
      .upsert(slice, {
        onConflict: "campaign_id,patient_id",
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
  practice: Practice,
  count: number,
): {
  dormantAfterMonths: number;
  maxVisits: number;
  builtAt: string;
  patientCount: number;
} {
  return {
    dormantAfterMonths: practice.dormant_after_months,
    maxVisits: practice.max_visits,
    builtAt: new Date().toISOString(),
    patientCount: count,
  };
}
