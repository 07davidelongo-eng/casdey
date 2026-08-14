"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePractice, requireActivePractice } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { ruleFor } from "@/lib/dormancy";
import { audienceSnapshot, buildAudience, queueCampaign } from "@/lib/campaigns";
import { capabilities } from "@/lib/plan";
import { generateCampaignDraft } from "@/lib/ai";
import { isLanguageCode } from "@/lib/languages";

export type CampaignState = { error: string | null };

const CreateSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name.").max(120),
  subject: z.string().trim().min(3, "Write a subject line.").max(200),
  body: z
    .string()
    .trim()
    .min(20, "The message is too short to send to a patient.")
    .max(5000),
  language: z
    .string()
    .refine(isLanguageCode, "Pick a language casdey supports.")
    .default("en"),
});

export type DraftResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; error: string };

/**
 * Drafts a message with AI. Available to any signed-in practice: drafting is
 * part of building a campaign, which every plan can do. Sending is the gated
 * step, and that gate is on approval, not here.
 */
export async function generateDraftAction(input: {
  language: string;
  guidance?: string;
}): Promise<DraftResult> {
  const { practice } = await requirePractice();

  const language = isLanguageCode(input.language) ? input.language : "en";
  const guidance =
    typeof input.guidance === "string" ? input.guidance.slice(0, 2000) : undefined;

  try {
    const draft = await generateCampaignDraft({
      practiceName: practice.name,
      rule: ruleFor(practice),
      language,
      guidance,
    });
    return { ok: true, ...draft };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The draft could not be generated.";
    return { ok: false, error: message };
  }
}

export async function createCampaignAction(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { practice, session } = await requireActivePractice();

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    language: formData.get("language") ?? "en",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const audience = await buildAudience(practice.id, ruleFor(practice));

  if (audience.length === 0) {
    return {
      error:
        "Nobody matches right now. Either no patient has gone quiet, or none of them have an email address on file.",
    };
  }

  const { data, error } = await supabaseAdmin()
    .from("campaigns")
    .insert({
      practice_id: practice.id,
      created_by: session.userId,
      name: parsed.data.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
      language: parsed.data.language,
      status: "draft",
      audience: audienceSnapshot(practice, audience.length),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[campaign] create failed", error?.message);
    return { error: "We could not save that campaign. Try again." };
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.created",
    target: data.id as string,
    meta: { audience: audience.length },
  });

  redirect(`/app/campaigns/${data.id}`);
}

/**
 * Approval is the point of no return, so it is a deliberate, separate act by a
 * person at the practice. Nothing casdey does sends a patient an email that
 * somebody there has not read first.
 */
export async function approveCampaignAction(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { practice, session } = await requireActivePractice();
  const campaignId = String(formData.get("campaignId") ?? "");

  if (!capabilities(practice).canSendCampaigns) {
    return {
      error:
        "Sending is a Premium feature. Upgrade from billing to send this campaign. You can keep building it in the meantime.",
    };
  }

  const client = supabaseAdmin();

  const { data: campaign } = await client
    .from("campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (!campaign) return { error: "That campaign no longer exists." };
  if (campaign.status !== "draft") {
    return { error: "That campaign has already been approved." };
  }

  // Rebuilt now rather than reusing the count from when the draft was written:
  // patients may have been imported, deleted or unsubscribed since.
  const audience = await buildAudience(practice.id, ruleFor(practice));
  if (audience.length === 0) {
    return { error: "Nobody matches any more, so there is nothing to send." };
  }

  let queued = 0;
  try {
    queued = await queueCampaign({
      campaignId,
      practiceId: practice.id,
      audience,
      dailyCap: practice.daily_send_cap,
    });
  } catch (error) {
    console.error("[campaign] queue failed", error);
    return { error: "We could not build the send queue. Try again." };
  }

  const { error } = await client
    .from("campaigns")
    .update({
      status: "sending",
      approved_at: new Date().toISOString(),
      approved_by: session.userId,
      started_at: new Date().toISOString(),
      audience: audienceSnapshot(practice, audience.length),
    })
    .eq("id", campaignId)
    .eq("practice_id", practice.id);

  if (error) {
    console.error("[campaign] approve failed", error.message);
    return { error: "We could not start that campaign. Try again." };
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.approved",
    target: campaignId,
    meta: { queued },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}

/** Stops the queue without losing it. The sender only touches "sending" campaigns. */
export async function setCampaignStatusAction(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { practice, session } = await requireActivePractice();
  const campaignId = String(formData.get("campaignId") ?? "");
  const next = String(formData.get("status") ?? "");

  if (next !== "paused" && next !== "sending" && next !== "cancelled") {
    return { error: "Unknown action." };
  }

  const client = supabaseAdmin();

  const { error } = await client
    .from("campaigns")
    .update({ status: next })
    .eq("id", campaignId)
    .eq("practice_id", practice.id)
    .in("status", ["sending", "paused"]);

  if (error) {
    console.error("[campaign] status failed", error.message);
    return { error: "We could not change that. Try again." };
  }

  // Cancelling means the unsent ones never go, not that they wait.
  if (next === "cancelled") {
    await client
      .from("campaign_messages")
      .update({ status: "cancelled" })
      .eq("campaign_id", campaignId)
      .eq("status", "queued");
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: next === "cancelled" ? "campaign.cancelled" : "campaign.paused",
    target: campaignId,
    meta: { status: next },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}
