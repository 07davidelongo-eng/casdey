import "server-only";

import { supabaseAdmin } from "../supabase";
import { whatsappProvider } from "./send";
import type { AudienceMember } from "../campaigns";
import type { Gym } from "../types";

/**
 * Sends a WhatsApp campaign.
 *
 * Deliberately not a queue like email's campaign_messages. A WhatsApp
 * template send at the volumes a single gym's lapsed list runs at (tens to
 * low hundreds) does not need the day-offset drip email uses to protect
 * domain reputation, and template sends are the one-shot opener of a
 * conversation, not a resend-with-backoff shape a queue exists for. Each
 * recipient gets one attempt; a failure is just logged and counted, not
 * retried, so a gym never gets a stray duplicate first message.
 *
 * Every recipient also gets (or reuses) a whatsapp_conversations row here,
 * because that thread is what the inbound webhook and AI reply loop
 * (./ai-agent.ts) attach to when the member eventually replies.
 */

export type WhatsAppCampaignReport = { sent: number; failed: number };

export async function sendWhatsAppCampaign(options: {
  gym: Gym;
  audience: AudienceMember[];
  templateSid: string;
}): Promise<WhatsAppCampaignReport> {
  const client = supabaseAdmin();
  const provider = whatsappProvider(options.gym.whatsapp_from);
  const report: WhatsAppCampaignReport = { sent: 0, failed: 0 };

  for (const member of options.audience) {
    if (!member.phone) {
      report.failed += 1;
      continue;
    }

    // One conversation thread per member, reused across every campaign that
    // ever contacts them. Unique on (gym_id, member_id): see
    // supabase/migrations/0014_whatsapp_channel_gym.sql.
    const { data: conversation, error: conversationError } = await client
      .from("whatsapp_conversations")
      .upsert(
        {
          gym_id: options.gym.id,
          member_id: member.id,
          phone: member.phone,
          status: "active",
        },
        { onConflict: "gym_id,member_id" },
      )
      .select("id")
      .single();

    if (conversationError || !conversation) {
      console.error(
        "[whatsapp] conversation upsert failed",
        member.id,
        conversationError?.message,
      );
      report.failed += 1;
      continue;
    }

    try {
      const result = await provider.sendTemplate({
        to: member.phone,
        templateSid: options.templateSid,
        // {{1}} in casdey's registered templates is always the gym name.
        params: { "1": options.gym.name },
      });

      const now = new Date().toISOString();

      await client.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        gym_id: options.gym.id,
        direction: "out",
        body: `[template ${options.templateSid}: ${options.gym.name}]`,
        provider_message_id: result.providerMessageId,
        ai_generated: false,
      });

      await client
        .from("whatsapp_conversations")
        .update({ last_outbound_at: now })
        .eq("id", conversation.id);

      // Only ever moves someone forward, same rule as the email queue in
      // ../sender.ts: a member already returned must not be dragged back.
      await client
        .from("members")
        .update({ status: "contacted", contacted_at: now })
        .eq("id", member.id)
        .eq("status", "active");

      await client.from("member_events").insert({
        gym_id: options.gym.id,
        member_id: member.id,
        type: "message_sent",
        meta: { channel: "whatsapp" },
      });

      report.sent += 1;
    } catch (sendError) {
      const detail =
        sendError instanceof Error ? sendError.message : String(sendError);
      console.error("[whatsapp] send failed", member.id, detail);
      report.failed += 1;
    }
  }

  return report;
}
