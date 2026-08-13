"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type UnsubscribeState = { done: boolean; error: string | null };

/**
 * Takes a patient off the list, for good.
 *
 * No login: the person clicking this is a patient, not a casdey user, and
 * making them prove who they are before they can be left alone would be
 * indefensible. The random per-message token is the only credential, which is
 * why it is 24 bytes and never reused.
 *
 * Four things happen, and the suppression is the one that matters most: it
 * survives the patient record, so a re-import of the practice's list months
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
    .select("practice_id, patient_id, to_email")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!message) {
    return { done: false, error: "That link is not valid or has expired." };
  }

  const email = String(message.to_email).toLowerCase();

  const { error } = await client.from("suppressions").upsert(
    {
      practice_id: message.practice_id,
      email,
      reason: "unsubscribed",
    },
    { onConflict: "practice_id,email" },
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
    .from("patients")
    .update({ status: "opted_out" })
    .eq("id", message.patient_id);

  // Anything already queued for them, across every campaign, stops now.
  await client
    .from("campaign_messages")
    .update({ status: "cancelled" })
    .eq("practice_id", message.practice_id)
    .eq("to_email", message.to_email)
    .eq("status", "queued");

  await client.from("patient_events").insert({
    practice_id: message.practice_id,
    patient_id: message.patient_id,
    type: "opted_out",
    meta: {},
  });

  await recordAudit({
    practiceId: message.practice_id,
    action: "patient.unsubscribed",
    target: message.patient_id,
  });

  return { done: true, error: null };
}
