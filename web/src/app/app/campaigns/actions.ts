"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActiveGym } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { atRiskRuleFor, ruleFor } from "@/lib/lapse";
import {
  audienceSnapshot,
  buildAtRiskAudience,
  buildAudience,
  buildWhatsAppAudience,
  queueCampaign,
} from "@/lib/campaigns";
import { sendWhatsAppCampaign } from "@/lib/whatsapp/campaign-send";
import { whatsappProvider } from "@/lib/whatsapp/send";
import { normalizePhoneForCountry } from "@/lib/ingestion/csv";
import { capabilities } from "@/lib/plan";
import { isLanguageCode } from "@/lib/languages";
import { bookingUrl, emailProvider, unsubscribeUrl } from "@/lib/messaging";
import { sendingIdentity } from "@/lib/email/identity";
import { composeBody, contextFor, renderTemplate } from "@/lib/template";
import { ensureTestMember } from "@/lib/self-test";
import { isCancellationReason } from "@/lib/cancellation";
import type { CampaignKind, Channel } from "@/lib/types";

export type CampaignState = { error: string | null };

function parseKind(value: FormDataEntryValue | null): CampaignKind {
  return value === "at_risk" ? "at_risk" : "win_back";
}

function parseChannel(value: FormDataEntryValue | null): Channel {
  return value === "whatsapp" ? "whatsapp" : "email";
}

const CreateSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name.").max(120),
  subject: z.string().trim().min(3, "Write a subject line.").max(200),
  body: z
    .string()
    .trim()
    .min(20, "The message is too short to send to a member.")
    .max(5000),
  language: z
    .string()
    .refine(isLanguageCode, "Pick a language casdey supports.")
    .default("en"),
});

const CreateWhatsAppSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name.").max(120),
});

export async function createCampaignAction(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { gym, session } = await requireActiveGym();

  if (parseChannel(formData.get("channel")) === "whatsapp") {
    return createWhatsAppCampaign(gym, session, formData);
  }

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    language: formData.get("language") ?? "en",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const kind = parseKind(formData.get("kind"));
  const rawReason = formData.get("reasonFilter");
  // A reason filter only makes sense for win-back: at-risk members have not
  // cancelled, so there is nothing to filter by.
  const reasonFilter =
    kind === "win_back" && isCancellationReason(rawReason) ? rawReason : undefined;

  const audience =
    kind === "at_risk"
      ? await buildAtRiskAudience(gym.id, atRiskRuleFor(gym))
      : await buildAudience(gym.id, ruleFor(gym), new Date(), reasonFilter);

  if (audience.length === 0) {
    return {
      error:
        kind === "at_risk"
          ? "Nobody matches your at-risk window right now."
          : "Nobody matches right now. Either no member has gone quiet or cancelled, or none of them have an email address on file.",
    };
  }

  const { data, error } = await supabaseAdmin()
    .from("campaigns")
    .insert({
      gym_id: gym.id,
      created_by: session.userId,
      name: parsed.data.name,
      kind,
      channel: "email",
      subject: parsed.data.subject,
      body: parsed.data.body,
      language: parsed.data.language,
      status: "draft",
      audience: audienceSnapshot(gym, audience.length, { kind, reasonFilter }),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[campaign] create failed", error?.message);
    return { error: "We could not save that campaign. Try again." };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.created",
    target: data.id as string,
    meta: { audience: audience.length },
  });

  redirect(`/app/campaigns/${data.id}`);
}

/**
 * A WhatsApp campaign has no freeform copy: the opener is the gym's
 * Meta-approved template, frozen onto the campaign row so a later template
 * change in settings cannot rewrite what a sent campaign used. Win-back only
 * for V1. Both the switch (Settings → WhatsApp on) and the template SID must
 * be set, mirroring the client-side guard.
 */
async function createWhatsAppCampaign(
  gym: Awaited<ReturnType<typeof requireActiveGym>>["gym"],
  session: Awaited<ReturnType<typeof requireActiveGym>>["session"],
  formData: FormData,
): Promise<CampaignState> {
  // The WhatsApp channel is a Pro feature (the trial grants it too). Standard
  // and Free are email-only. See src/lib/plan.ts / SAAS_V1_PLAN.md §F0.
  if (!capabilities(gym).canUseWhatsApp) {
    return {
      error:
        "The WhatsApp channel is on the Pro plan. Upgrade from Settings → Billing to send over WhatsApp; email campaigns work on your current plan.",
    };
  }
  // whatsapp_from belongs in this gate as much as the template does. The
  // provider cannot be built without a sender, so a campaign created here
  // would build its whole audience and then fail on the first send, which is
  // the worst place to discover a missing setting.
  if (
    !gym.whatsapp_enabled ||
    !gym.whatsapp_template_name ||
    !gym.whatsapp_from
  ) {
    return {
      error:
        "WhatsApp is not fully set up. Turn it on, connect your gym's own WhatsApp number, and add your approved template SID in Settings → WhatsApp.",
    };
  }

  const parsed = CreateWhatsAppSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const audience = await buildWhatsAppAudience(gym.id, ruleFor(gym));
  if (audience.length === 0) {
    return {
      error:
        "Nobody matches right now. Either no member has gone quiet or cancelled, or none of them have a phone number on file and WhatsApp consent.",
    };
  }

  const { data, error } = await supabaseAdmin()
    .from("campaigns")
    .insert({
      gym_id: gym.id,
      created_by: session.userId,
      name: parsed.data.name,
      kind: "win_back",
      channel: "whatsapp",
      subject: null,
      body: null,
      whatsapp_template_name: gym.whatsapp_template_name,
      language: "en",
      status: "draft",
      audience: audienceSnapshot(gym, audience.length, { kind: "win_back" }),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[campaign] whatsapp create failed", error?.message);
    return { error: "We could not save that campaign. Try again." };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.created",
    target: data.id as string,
    meta: { audience: audience.length, channel: "whatsapp" },
  });

  redirect(`/app/campaigns/${data.id}`);
}

export type TestSendState = { error: string | null; sentTo: string | null };

/**
 * Roadmap #4: the gym can walk through the member's side of a campaign
 * before anyone real gets it. This sends the exact message a member would
 * get, through the exact same code the real sender uses (composeBody, the
 * configured provider, a real unsubscribe token), to the signed-in user's own
 * inbox. It rides on a synthetic member row (see ./self-test.ts) rather than
 * a real one, and never touches the send queue, so it cannot be mistaken for
 * a real send and cannot count against anyone's daily cap.
 *
 * Available on a campaign in any status, not only drafts: re-checking what
 * already went out is just as useful as previewing what is about to.
 */
export async function sendTestAction(
  _previous: TestSendState,
  formData: FormData,
): Promise<TestSendState> {
  const { gym, session } = await requireActiveGym();
  const campaignId = String(formData.get("campaignId") ?? "");

  if (!session.email) {
    return {
      error: "Your account has no email address to send the test to.",
      sentTo: null,
    };
  }

  const client = supabaseAdmin();

  const { data: campaign } = await client
    .from("campaigns")
    .select("id, subject, body")
    .eq("id", campaignId)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!campaign) {
    return { error: "That campaign no longer exists.", sentTo: null };
  }

  // The self-test member is always freshly created (see ensureTestMember
  // below) and never has a cancellation on file, so {{reason}} previews as
  // its fallback phrase in a test send. That is expected, not a bug.

  let member;
  try {
    member = await ensureTestMember(gym, session.email);
  } catch (error) {
    console.error("[campaign] test member failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "We could not prepare a test send. Try again.";
    return { error: message, sentTo: null };
  }

  const { data: message, error: messageError } = await client
    .from("campaign_messages")
    .upsert(
      {
        gym_id: gym.id,
        campaign_id: campaignId,
        member_id: member.id,
        to_email: session.email,
        status: "queued",
      },
      { onConflict: "campaign_id,member_id" },
    )
    .select("id, unsubscribe_token")
    .single();

  if (messageError || !message) {
    console.error("[campaign] test message failed", messageError?.message);
    return {
      error: "We could not prepare a test send. Try again.",
      sentTo: null,
    };
  }

  const provider = emailProvider();
  const identity = sendingIdentity(gym);
  const context = contextFor(
    {
      first_name: member.first_name,
      last_visit_at: member.last_visit_at,
      cancellation_reason: null,
    },
    gym,
    new Date(),
    gym.booking_enabled ? bookingUrl(member.booking_token) : null,
  );

  try {
    await provider.send({
      to: session.email,
      subject: `[Test] ${renderTemplate(campaign.subject, context)}`,
      text: composeBody({
        body: campaign.body,
        context,
        unsubscribeUrl: unsubscribeUrl(message.unsubscribe_token),
        replyTo: gym.reply_to_email,
        providerCanSetReplyTo: provider.canSetReplyTo,
      }),
      fromName: identity.name,
      fromAddress: identity.address,
      replyTo: gym.reply_to_email,
    });
  } catch (sendError) {
    console.error("[campaign] test send failed", sendError);
    return {
      error: "The test message could not be sent. Try again shortly.",
      sentTo: null,
    };
  }

  await client
    .from("campaign_messages")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", message.id);

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.test_sent",
    target: campaignId,
  });

  return { error: null, sentTo: session.email };
}

export type WhatsAppTestState = { error: string | null; sentTo: string | null };

/**
 * The WhatsApp side of the client self-test. Unlike the email test there is no
 * single obvious "my own address" to default to, so the gym types the number
 * to test with. What lands there is the real approved template, and replying
 * to it rides the exact same webhook → AI loop → hand-off path a real
 * member's reply would. It reuses the synthetic self-test member for the
 * conversation FK, so it never touches a real member or a real audience.
 */
export async function sendWhatsAppTestAction(
  _previous: WhatsAppTestState,
  formData: FormData,
): Promise<WhatsAppTestState> {
  const { gym, session } = await requireActiveGym();
  const campaignId = String(formData.get("campaignId") ?? "");
  const rawPhone = String(formData.get("phone") ?? "").trim();

  if (!gym.whatsapp_enabled || !gym.whatsapp_template_name) {
    return { error: "WhatsApp is not set up for this gym.", sentTo: null };
  }
  if (!session.email) {
    return {
      error: "Your account has no email address, which the test member needs.",
      sentTo: null,
    };
  }
  if (!rawPhone) {
    return { error: "Enter the number to test with.", sentTo: null };
  }

  const phone = normalizePhoneForCountry(rawPhone, gym.country);
  const client = supabaseAdmin();

  const { data: campaign } = await client
    .from("campaigns")
    .select("id, channel")
    .eq("id", campaignId)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!campaign || campaign.channel !== "whatsapp") {
    return { error: "That WhatsApp campaign no longer exists.", sentTo: null };
  }

  let member;
  try {
    member = await ensureTestMember(gym, session.email);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not prepare a test send.";
    return { error: message, sentTo: null };
  }

  const { data: conversation, error: conversationError } = await client
    .from("whatsapp_conversations")
    .upsert(
      {
        gym_id: gym.id,
        member_id: member.id,
        phone,
        status: "active",
      },
      { onConflict: "gym_id,member_id" },
    )
    .select("id")
    .single();

  if (conversationError || !conversation) {
    console.error("[campaign] wa test conversation failed", conversationError?.message);
    return { error: "Could not prepare a test send. Try again.", sentTo: null };
  }

  try {
    const result = await whatsappProvider(gym.whatsapp_from).sendTemplate({
      to: phone,
      templateSid: gym.whatsapp_template_name,
      params: { "1": gym.name },
    });

    await client.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      gym_id: gym.id,
      direction: "out",
      body: `[template ${gym.whatsapp_template_name}: ${gym.name}]`,
      provider_message_id: result.providerMessageId,
      ai_generated: false,
    });

    await client
      .from("whatsapp_conversations")
      .update({ last_outbound_at: new Date().toISOString(), phone })
      .eq("id", conversation.id);
  } catch (sendError) {
    console.error("[campaign] wa test send failed", sendError);
    return {
      error:
        "The test could not be sent. WhatsApp sending may not be configured for this environment yet.",
      sentTo: null,
    };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.test_sent",
    target: campaignId,
    meta: { channel: "whatsapp" },
  });

  return { error: null, sentTo: phone };
}

/**
 * Approval is the point of no return, so it is a deliberate, separate act by a
 * person at the gym. Nothing casdey does sends a member an email that
 * somebody there has not read first. Email queues (see ../lib/campaigns.ts) and
 * a cron drains it over days.
 */
export async function approveCampaignAction(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { gym, session } = await requireActiveGym();
  const campaignId = String(formData.get("campaignId") ?? "");

  if (!capabilities(gym).canSendCampaigns) {
    return {
      error:
        "Sending needs a paid plan. Choose Standard or Pro from billing to send this campaign. You can keep building it in the meantime.",
    };
  }

  const client = supabaseAdmin();

  const { data: campaign } = await client
    .from("campaigns")
    .select("id, status, kind, channel, whatsapp_template_name, audience")
    .eq("id", campaignId)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!campaign) return { error: "That campaign no longer exists." };
  if (campaign.status !== "draft") {
    return { error: "That campaign has already been approved." };
  }

  if (campaign.channel === "whatsapp") {
    return approveWhatsAppCampaign(gym, session, campaignId, campaign);
  }

  // Rebuilt now rather than reusing the count from when the draft was written:
  // members may have been imported, deleted or unsubscribed since. Must
  // rebuild with the same kind (and reason filter, if any) the campaign was
  // created with, or an at-risk/reason-scoped campaign would get queued
  // against the wrong audience.
  const kind: CampaignKind = campaign.kind === "at_risk" ? "at_risk" : "win_back";
  const storedReason = (campaign.audience as { reasonFilter?: string } | null)
    ?.reasonFilter;
  const reasonFilter = isCancellationReason(storedReason) ? storedReason : undefined;

  const audience =
    kind === "at_risk"
      ? await buildAtRiskAudience(gym.id, atRiskRuleFor(gym))
      : await buildAudience(gym.id, ruleFor(gym), new Date(), reasonFilter);
  if (audience.length === 0) {
    return { error: "Nobody matches any more, so there is nothing to send." };
  }

  let queued = 0;
  try {
    queued = await queueCampaign({
      campaignId,
      gymId: gym.id,
      audience,
      dailyCap: gym.daily_send_cap,
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
      audience: audienceSnapshot(gym, audience.length, { kind, reasonFilter }),
    })
    .eq("id", campaignId)
    .eq("gym_id", gym.id);

  if (error) {
    console.error("[campaign] approve failed", error.message);
    return { error: "We could not start that campaign. Try again." };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.approved",
    target: campaignId,
    meta: { queued },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}

/**
 * A WhatsApp campaign is not a drip queue: it is a batch of template openers
 * sent in one pass (see src/lib/whatsapp/campaign-send.ts), because the
 * volumes are low and a template send is a one-shot conversation opener, not
 * a resend shape. So approval sends it right here and the campaign lands in
 * "sent", not "sending". The audience is rebuilt now, same reasoning as the
 * email path.
 */
async function approveWhatsAppCampaign(
  gym: Awaited<ReturnType<typeof requireActiveGym>>["gym"],
  session: Awaited<ReturnType<typeof requireActiveGym>>["session"],
  campaignId: string,
  campaign: { whatsapp_template_name: string | null },
): Promise<CampaignState> {
  if (!campaign.whatsapp_template_name) {
    return { error: "This campaign has no approved template on file." };
  }
  // Re-check the tier: a gym could have built this on Pro/trial and dropped to
  // Standard before approving.
  if (!capabilities(gym).canUseWhatsApp) {
    return {
      error:
        "The WhatsApp channel is on the Pro plan. Upgrade from Settings → Billing to send this campaign.",
    };
  }
  if (!gym.whatsapp_enabled) {
    return { error: "WhatsApp is turned off for this gym. Turn it back on to send." };
  }

  const client = supabaseAdmin();
  const audience = await buildWhatsAppAudience(gym.id, ruleFor(gym));
  if (audience.length === 0) {
    return { error: "Nobody matches any more, so there is nothing to send." };
  }

  let report: { sent: number; failed: number };
  try {
    report = await sendWhatsAppCampaign({
      gym,
      audience,
      templateSid: campaign.whatsapp_template_name,
    });
  } catch (error) {
    console.error("[campaign] whatsapp send failed", error);
    return {
      error:
        "We could not send that WhatsApp campaign. It may be that WhatsApp sending is not configured for this environment yet.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from("campaigns")
    .update({
      status: "sent",
      approved_at: now,
      approved_by: session.userId,
      started_at: now,
      completed_at: now,
      audience: audienceSnapshot(gym, audience.length, { kind: "win_back" }),
    })
    .eq("id", campaignId)
    .eq("gym_id", gym.id);

  if (error) {
    console.error("[campaign] whatsapp approve update failed", error.message);
    return { error: "The messages were sent but we could not update the campaign." };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.approved",
    target: campaignId,
    meta: { channel: "whatsapp", sent: report.sent, failed: report.failed },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}

/** Stops the queue without losing it. The sender only touches "sending" campaigns. */
export async function setCampaignStatusAction(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { gym, session } = await requireActiveGym();
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
    .eq("gym_id", gym.id)
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
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: next === "cancelled" ? "campaign.cancelled" : "campaign.paused",
    target: campaignId,
    meta: { status: next },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}
