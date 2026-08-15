"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActivePractice } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { ruleFor } from "@/lib/dormancy";
import { audienceSnapshot, buildAudience, queueCampaign } from "@/lib/campaigns";
import { capabilities } from "@/lib/plan";
import { isLanguageCode } from "@/lib/languages";
import { emailProvider, unsubscribeUrl } from "@/lib/messaging";
import { composeBody, contextFor, renderTemplate } from "@/lib/template";
import { ensureTestPatient, ensureTestWhatsAppPatient } from "@/lib/self-test";
import { sendWhatsAppCampaign } from "@/lib/whatsapp/campaign-send";
import { whatsappProvider } from "@/lib/whatsapp/send";
import type { Channel } from "@/lib/types";

export type CampaignState = { error: string | null };

const CreateSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("email"),
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
  }),
  z.object({
    channel: z.literal("whatsapp"),
    name: z.string().trim().min(2, "Give the campaign a name.").max(120),
    language: z
      .string()
      .refine(isLanguageCode, "Pick a language casdey supports.")
      .default("en"),
  }),
]);

export async function createCampaignAction(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { practice, session } = await requireActivePractice();

  const channel = formData.get("channel") === "whatsapp" ? "whatsapp" : "email";

  const parsed = CreateSchema.safeParse({
    channel,
    name: formData.get("name"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    language: formData.get("language") ?? "en",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  if (parsed.data.channel === "whatsapp") {
    if (!practice.whatsapp_enabled) {
      return {
        error:
          "WhatsApp is not turned on for this practice yet. Turn it on from Settings first.",
      };
    }
    if (!practice.whatsapp_template_name) {
      return {
        error:
          "No approved WhatsApp template is configured yet. Add one from Settings before creating a WhatsApp campaign.",
      };
    }
  }

  const audience = await buildAudience(practice.id, ruleFor(practice), parsed.data.channel);

  if (audience.length === 0) {
    return {
      error:
        parsed.data.channel === "whatsapp"
          ? "Nobody matches right now. Either no patient has gone quiet, or none of them have a phone number on file."
          : "Nobody matches right now. Either no patient has gone quiet, or none of them have an email address on file.",
    };
  }

  const { data, error } = await supabaseAdmin()
    .from("campaigns")
    .insert(
      parsed.data.channel === "whatsapp"
        ? {
            practice_id: practice.id,
            created_by: session.userId,
            name: parsed.data.name,
            channel: "whatsapp",
            whatsapp_template_name: practice.whatsapp_template_name,
            language: parsed.data.language,
            status: "draft",
            audience: audienceSnapshot(practice, audience.length),
          }
        : {
            practice_id: practice.id,
            created_by: session.userId,
            name: parsed.data.name,
            channel: "email",
            subject: parsed.data.subject,
            body: parsed.data.body,
            language: parsed.data.language,
            status: "draft",
            audience: audienceSnapshot(practice, audience.length),
          },
    )
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
    meta: { audience: audience.length, channel: parsed.data.channel },
  });

  redirect(`/app/campaigns/${data.id}`);
}

export type TestSendState = { error: string | null; sentTo: string | null };

/**
 * Roadmap #4: the practice can walk through the patient's side of a campaign
 * before anyone real gets it. This sends the exact message a patient would
 * get, through the exact same code the real sender uses (composeBody, the
 * configured provider, a real unsubscribe token), to the signed-in user's own
 * inbox. It rides on a synthetic patient row (see ./self-test.ts) rather than
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
  const { practice, session } = await requireActivePractice();
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
    .select("id, channel, subject, body")
    .eq("id", campaignId)
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (!campaign) {
    return { error: "That campaign no longer exists.", sentTo: null };
  }
  if (campaign.channel !== "email") {
    return {
      error: "This is a WhatsApp campaign. Use the WhatsApp test below instead.",
      sentTo: null,
    };
  }

  let patient;
  try {
    patient = await ensureTestPatient(practice, session.email);
  } catch (error) {
    console.error("[campaign] test patient failed", error);
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
        practice_id: practice.id,
        campaign_id: campaignId,
        patient_id: patient.id,
        to_email: session.email,
        status: "queued",
      },
      { onConflict: "campaign_id,patient_id" },
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
  const context = contextFor(
    { first_name: patient.first_name, last_visit_at: patient.last_visit_at },
    practice,
  );

  try {
    await provider.send({
      to: session.email,
      subject: `[Test] ${renderTemplate(campaign.subject, context)}`,
      text: composeBody({
        body: campaign.body,
        context,
        unsubscribeUrl: unsubscribeUrl(message.unsubscribe_token),
        replyTo: practice.reply_to_email,
        providerCanSetReplyTo: provider.canSetReplyTo,
      }),
      fromName: practice.sender_name ?? practice.name,
      replyTo: practice.reply_to_email,
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
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "campaign.test_sent",
    target: campaignId,
  });

  return { error: null, sentTo: session.email };
}

export type WhatsAppTestState = { error: string | null; sentTo: string | null };

/**
 * The WhatsApp side of roadmap #4. Same intent as sendTestAction above, but
 * WhatsApp has no single obvious "my own address" to default to (unlike
 * email, where the signed-in user's own inbox is right there), so the
 * practice types a number. It rides on ensureTestWhatsAppPatient (see
 * ./self-test.ts) and the real template configured for this campaign, so
 * once the practice replies, it goes through the exact same webhook -> AI
 * loop -> hand-off path a real patient's reply would.
 */
export async function sendWhatsAppTestAction(
  _previous: WhatsAppTestState,
  formData: FormData,
): Promise<WhatsAppTestState> {
  const { practice, session } = await requireActivePractice();
  const campaignId = String(formData.get("campaignId") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();

  if (!practice.whatsapp_enabled) {
    return { error: "WhatsApp is not turned on for this practice.", sentTo: null };
  }
  if (!phone) {
    return { error: "Enter a WhatsApp number to send the test to.", sentTo: null };
  }

  const client = supabaseAdmin();

  const { data: campaign } = await client
    .from("campaigns")
    .select("id, channel, whatsapp_template_name")
    .eq("id", campaignId)
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (!campaign) {
    return { error: "That campaign no longer exists.", sentTo: null };
  }
  if (campaign.channel !== "whatsapp" || !campaign.whatsapp_template_name) {
    return { error: "This is not a WhatsApp campaign.", sentTo: null };
  }

  let patient;
  try {
    patient = await ensureTestWhatsAppPatient(practice, phone);
  } catch (error) {
    console.error("[campaign] whatsapp test patient failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "We could not prepare a test send. Try again.";
    return { error: message, sentTo: null };
  }

  const { data: conversation, error: conversationError } = await client
    .from("whatsapp_conversations")
    .upsert(
      {
        practice_id: practice.id,
        patient_id: patient.id,
        phone,
        status: "active",
      },
      { onConflict: "practice_id,patient_id" },
    )
    .select("id")
    .single();

  if (conversationError || !conversation) {
    console.error(
      "[campaign] whatsapp test conversation failed",
      conversationError?.message,
    );
    return { error: "We could not prepare a test send. Try again.", sentTo: null };
  }

  try {
    const result = await whatsappProvider().sendTemplate({
      to: phone,
      templateSid: campaign.whatsapp_template_name,
      params: { "1": practice.name },
    });

    await client.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      practice_id: practice.id,
      direction: "out",
      body: `[Test] [template ${campaign.whatsapp_template_name}: ${practice.name}]`,
      provider_message_id: result.providerMessageId,
      ai_generated: false,
    });

    await client
      .from("whatsapp_conversations")
      .update({ last_outbound_at: new Date().toISOString() })
      .eq("id", conversation.id);
  } catch (sendError) {
    console.error("[campaign] whatsapp test send failed", sendError);
    return {
      error: "The test message could not be sent. Try again shortly.",
      sentTo: null,
    };
  }

  await recordAudit({
    practiceId: practice.id,
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
 * person at the practice. Nothing casdey does sends a patient an email that
 * somebody there has not read first.
 *
 * Email and WhatsApp diverge here: email queues (see ../lib/campaigns.ts) and
 * a cron drains it over days; WhatsApp has no queue and sends its whole batch
 * of template messages synchronously (see ../lib/whatsapp/campaign-send.ts),
 * so it goes straight to "sent" rather than "sending".
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
    .select("id, status, channel, whatsapp_template_name")
    .eq("id", campaignId)
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (!campaign) return { error: "That campaign no longer exists." };
  if (campaign.status !== "draft") {
    return { error: "That campaign has already been approved." };
  }

  const channel = (campaign.channel ?? "email") as Channel;

  if (channel === "whatsapp") {
    if (!practice.whatsapp_enabled) {
      return { error: "WhatsApp has been turned off for this practice since this was drafted." };
    }
    if (!campaign.whatsapp_template_name) {
      return { error: "This campaign has no WhatsApp template configured." };
    }

    const audience = await buildAudience(practice.id, ruleFor(practice), "whatsapp");
    if (audience.length === 0) {
      return { error: "Nobody matches any more, so there is nothing to send." };
    }

    let report;
    try {
      report = await sendWhatsAppCampaign({
        practice,
        audience,
        templateSid: campaign.whatsapp_template_name,
      });
    } catch (error) {
      console.error("[campaign] whatsapp send failed", error);
      return { error: "We could not send that campaign. Try again." };
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
      meta: { channel: "whatsapp", sent: report.sent, failed: report.failed },
    });

    revalidatePath("/app", "layout");
    return { error: null };
  }

  // Rebuilt now rather than reusing the count from when the draft was written:
  // patients may have been imported, deleted or unsubscribed since.
  const audience = await buildAudience(practice.id, ruleFor(practice), "email");
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
