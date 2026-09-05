import type { NextRequest } from "next/server";

import {
  verifyTwilioSignatureForAnyUrl,
  webhookUrlCandidates,
} from "@/lib/whatsapp/signature";
import { continueConversation } from "@/lib/whatsapp/ai-agent";
import { siteUrl } from "@/lib/messaging";
import { supabaseAdmin, UNIQUE_VIOLATION } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import type { Gym, WhatsAppConversation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The AI reply loop calls Claude and then Twilio before responding; the
// default 10s can be tight for two outbound API calls back to back.
export const maxDuration = 30;

/**
 * Twilio's inbound webhook for the shared casdey WhatsApp number. Every reply
 * from every member of every gym arrives here.
 *
 * Follows the same three rules as ../stripe/webhook/route.ts, for the same
 * reasons:
 *
 *   1. Verify the signature against the raw body before trusting anything in
 *      it (Twilio signs the exact URL plus every POST param).
 *   2. Be idempotent. Twilio retries, and MessageSid is the id.
 *   3. Never fail loudly at Twilio for something that is our problem: log and
 *      200, do not 500 (a 500 makes Twilio retry, which cannot fix an
 *      internal error and risks a duplicate AI reply).
 *
 * STOP-style opt-out is handled here, not by the AI: it is the WhatsApp
 * equivalent of the unsubscribe link email uses (see ../../u/[token]/), and
 * must not depend on a model call succeeding. The keyword set covers the
 * languages casdey's UK + EU outreach actually reaches, not English alone.
 */

const STOP_KEYWORDS = new Set([
  // English
  "stop",
  "unsubscribe",
  "cancel",
  "opt out",
  "optout",
  "quit",
  "remove me",
  "no more",
  // German
  "stopp",
  "abbestellen",
  "abmelden",
  "keine nachrichten",
  // French
  "arret",
  "arrêt",
  "arreter",
  "arrêter",
  "annuler",
  "desabonner",
  "désabonner",
  // Spanish
  "parar",
  "baja",
  "cancelar",
  "no more mensajes",
  "dar de baja",
  // Portuguese
  "sair",
  "cancelar inscricao",
  "cancelar inscrição",
  // Italian
  "basta",
  "cancella",
  "annulla",
  "disiscrivimi",
  // Dutch
  "afmelden",
  "stoppen",
  "uitschrijven",
]);

export async function POST(request: NextRequest): Promise<Response> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[whatsapp] TWILIO_AUTH_TOKEN is not set");
    return new Response("Not configured", { status: 500 });
  }

  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const signature = request.headers.get("x-twilio-signature") ?? "";
  // Both hostname spellings, because Twilio signs whatever URL it was given
  // and casdey answers on the apex and www alike. See webhookUrlCandidates.
  const urls = webhookUrlCandidates(siteUrl(), request.url);

  if (!verifyTwilioSignatureForAnyUrl(urls, params, signature, authToken)) {
    console.error(
      "[whatsapp] signature verification failed; tried",
      urls.join(", "),
    );
    return new Response("Invalid signature", { status: 401 });
  }

  const messageSid = params.MessageSid || params.SmsMessageSid;
  if (!messageSid) return new Response("Missing MessageSid", { status: 400 });

  // Claim the event. A duplicate delivery loses the race and stops here,
  // same pattern as public.stripe_events.
  const { error: claimError } = await supabaseAdmin()
    .from("whatsapp_events")
    .insert({ id: messageSid });

  if (claimError) {
    if (claimError.code === UNIQUE_VIOLATION) {
      return Response.json({ received: true, duplicate: true });
    }
    console.error("[whatsapp] could not record event", claimError.message);
    // Ask Twilio to retry: without the idempotency record we might otherwise
    // process this twice.
    return new Response("Storage unavailable", { status: 503 });
  }

  try {
    await handle(params);
  } catch (error) {
    console.error(
      "[whatsapp] handling inbound message failed",
      error instanceof Error ? error.message : error,
    );
    // Deliberately a 200. The event is recorded, so a retry would be dropped
    // as a duplicate anyway. Failures here need a human, not another delivery.
  }

  return Response.json({ received: true });
}

async function handle(params: Record<string, string>): Promise<void> {
  const from = normalizePhone(params.From);
  const body = (params.Body ?? "").trim();
  if (!from) return;

  const client = supabaseAdmin();

  // Which gym was written TO. Each gym now sends from its own number
  // (gyms.whatsapp_from, migration 0017), so the destination identifies the
  // gym exactly. That closes the ambiguity the shared-number design had: a
  // member of two gyms used to have their reply attached to whichever gym had
  // messaged them most recently, because the phone number was the only signal.
  const to = normalizePhone(params.To);

  let gymId: string | null = null;
  if (to) {
    const { data: gymRow } = await client
      .from("gyms")
      .select("id")
      .eq("whatsapp_from", to)
      .maybeSingle();
    gymId = (gymRow as { id: string } | null)?.id ?? null;
  }

  // Scoped to the gym when we know it. The unscoped branch is the fallback for
  // a conversation started before per-gym senders existed, and keeps the old
  // most-recently-active behaviour rather than dropping the reply.
  let query = client.from("whatsapp_conversations").select("*").eq("phone", from);
  if (gymId) query = query.eq("gym_id", gymId);

  const { data: conversationRow } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversationRow) {
    // Nobody casdey has ever WhatsApped is writing in. There is no safe
    // conversation or gym to attach this to, so it is dropped rather than
    // guessed at.
    console.log("[whatsapp] inbound message from an unknown number, ignored");
    return;
  }

  const conversation = conversationRow as WhatsAppConversation;

  const { data: gymRow } = await client
    .from("gyms")
    .select("*")
    .eq("id", conversation.gym_id)
    .maybeSingle();

  if (!gymRow) return;
  const gym = gymRow as Gym;

  const now = new Date().toISOString();
  const isOptOut = STOP_KEYWORDS.has(body.toLowerCase());

  await client.from("whatsapp_messages").insert({
    conversation_id: conversation.id,
    gym_id: gym.id,
    direction: "in",
    body,
  });

  if (isOptOut) {
    await client.from("whatsapp_suppressions").upsert(
      { gym_id: gym.id, phone: from, reason: "unsubscribed" },
      { onConflict: "gym_id,phone" },
    );

    await client
      .from("members")
      .update({ status: "opted_out" })
      .eq("id", conversation.member_id);

    await client
      .from("whatsapp_conversations")
      .update({ status: "opted_out", last_inbound_at: now })
      .eq("id", conversation.id);

    await client.from("member_events").insert({
      gym_id: gym.id,
      member_id: conversation.member_id,
      type: "opted_out",
      meta: { channel: "whatsapp" },
    });

    await recordAudit({
      gymId: gym.id,
      action: "member.unsubscribed",
      target: conversation.member_id,
      meta: { channel: "whatsapp" },
    });

    return;
  }

  await client
    .from("whatsapp_conversations")
    .update({ last_inbound_at: now })
    .eq("id", conversation.id);

  await client.from("member_events").insert({
    gym_id: gym.id,
    member_id: conversation.member_id,
    type: "replied",
    meta: { channel: "whatsapp" },
  });

  await continueConversation(gym, conversation);
}

/** Twilio addresses WhatsApp numbers as "whatsapp:+447700900123". */
function normalizePhone(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/^whatsapp:/, "");
}
