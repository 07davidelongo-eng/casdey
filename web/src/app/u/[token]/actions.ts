"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type UnsubscribeState = { done: boolean; error: string | null };

/**
 * Takes a member off the list, for good.
 *
 * No login: the person clicking this is a member, not a casdey user, and
 * making them prove who they are before they can be left alone would be
 * indefensible. The random per-message token is the only credential, which is
 * why it is 24 bytes and never reused.
 *
 * Four things happen, and the suppression is the one that matters most: it
 * survives the member record, so a re-import of the gym's list months
 * later cannot quietly put them back in a campaign.
 */
export async function unsubscribeAction(
  _previous: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { done: false, error: "That link is not valid." };

  const client = supabaseAdmin();

  const { data: message } = await client
    .from("campaign_messages")
    .select("gym_id, member_id, to_email")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!message) {
    return { done: false, error: "That link is not valid or has expired." };
  }

  const email = String(message.to_email).toLowerCase();

  const { error } = await client.from("suppressions").upsert(
    {
      gym_id: message.gym_id,
      email,
      reason: "unsubscribed",
    },
    { onConflict: "gym_id,email" },
  );

  if (error) {
    console.error("[unsubscribe] failed", error.message);
    return {
      done: false,
      error:
        "Something went wrong. Email info@casdey.com and we will take you off by hand.",
    };
  }

  await client
    .from("members")
    .update({ status: "opted_out" })
    .eq("id", message.member_id);

  // Anything already queued for them, across every campaign, stops now.
  await client
    .from("campaign_messages")
    .update({ status: "cancelled" })
    .eq("gym_id", message.gym_id)
    .eq("to_email", message.to_email)
    .eq("status", "queued");

  await client.from("member_events").insert({
    gym_id: message.gym_id,
    member_id: message.member_id,
    type: "opted_out",
    meta: {},
  });

  await recordAudit({
    gymId: message.gym_id,
    action: "member.unsubscribed",
    target: message.member_id,
  });

  return { done: true, error: null };
}
