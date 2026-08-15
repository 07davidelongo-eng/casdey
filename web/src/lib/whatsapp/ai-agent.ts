import "server-only";

import { supabaseAdmin } from "../supabase";
import { whatsappProvider } from "./send";
import type { Practice, WhatsAppConversation } from "../types";

/**
 * The responsive part of roadmap #2: a real back-and-forth with the patient,
 * not a single templated send.
 *
 * This reintroduces a standing per-use LLM cost, the exact thing dropped in
 * #1 (AI-assisted campaign drafting) for being a cost with no real demand.
 * The difference here is structural: a live conversation cannot be
 * pre-templated the way a single outbound message can, so there is no
 * cheaper way to do this at all. Two guardrails keep the cost bounded and
 * predictable rather than open-ended:
 *
 *   - History sent to the model is capped (HISTORY_LIMIT), so token cost per
 *     reply cannot grow without bound as a conversation runs long.
 *   - Each conversation gets a hard cap on total AI replies
 *     (WHATSAPP_AI_MAX_TURNS), persisted on whatsapp_conversations so it
 *     survives across separate webhook invocations. Past the cap the
 *     conversation closes and stops auto-replying; a human takes it from
 *     there.
 *
 * Raw fetch to the Anthropic Messages API, no SDK dependency, matching the
 * project's established preference (Resend and Twilio are both called the
 * same way) and deliberately not reintroducing @anthropic-ai/sdk, which #1's
 * revert removed for the same standing-cost reasoning being knowingly
 * accepted here.
 */

const MODEL = process.env.CASDEY_WHATSAPP_AI_MODEL ?? "claude-haiku-4-5-20251001";
const HISTORY_LIMIT = 20;
export const WHATSAPP_AI_MAX_TURNS = 20;

const MARK_BOOKING_TOOL = {
  name: "mark_booking_requested",
  description:
    "Call this the moment the patient clearly says they want to come in or book an appointment. Only call it once they have actually said yes, not when they are just considering it or asking what is involved.",
  input_schema: { type: "object", properties: {}, required: [] },
};

function systemPrompt(practiceName: string): string {
  return `You are messaging on behalf of ${practiceName}, a dental practice, over WhatsApp. You are re-engaging a patient who has not visited in a while.

Rules:
- Stay warm, brief, and human. These are WhatsApp messages, not emails: a sentence or two, no headers, no signature.
- Your one goal is finding out whether they would like to come back in. Do not chase beyond a couple of exchanges if they are not interested; a polite decline ends the conversation.
- Never give medical or clinical advice of any kind. If asked a clinical question, say the practice needs to answer that directly and suggest they call.
- Never invent appointment times, prices, or availability. You cannot book anything yourself.
- The moment the patient clearly says they want to book, call mark_booking_requested and send one short reply confirming the practice will be in touch to arrange a time. Do not negotiate times yourself.
- Reply in whatever language the patient is writing in.`;
}

type ClaudeReply = { reply: string; bookingRequested: boolean };

async function callClaude(
  practice: Practice,
  history: { direction: "in" | "out"; body: string }[],
): Promise<ClaudeReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const messages = history.slice(-HISTORY_LIMIT).map((message) => ({
    role: message.direction === "in" ? "user" : "assistant",
    content: message.body,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt(practice.name),
      messages,
      tools: [MARK_BOOKING_TOOL],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude API failed: ${response.status} ${detail.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    content: Array<{ type: string; text?: string; name?: string }>;
  };

  let reply = "";
  let bookingRequested = false;
  for (const block of json.content ?? []) {
    if (block.type === "text" && block.text) reply += block.text;
    if (block.type === "tool_use" && block.name === "mark_booking_requested") {
      bookingRequested = true;
    }
  }

  return { reply: reply.trim(), bookingRequested };
}

/**
 * Called by the inbound webhook after logging the patient's message. Loads
 * the thread, asks Claude for the next reply, sends it, and persists the
 * result. Never throws: a failure here should not make the webhook return a
 * 500 (Twilio would retry and could double-send), it should just mean the
 * patient does not get an automated reply this round. Logged either way so a
 * stuck conversation is visible.
 */
export async function continueConversation(
  practice: Practice,
  conversation: WhatsAppConversation,
): Promise<void> {
  const client = supabaseAdmin();

  // opted_out / closed: never auto-reply again. booking_requested: staff has
  // the hand-off, the AI stops talking so it cannot walk back what it
  // already told the patient.
  if (conversation.status !== "active") return;

  if (conversation.ai_turns_count >= WHATSAPP_AI_MAX_TURNS) {
    await client
      .from("whatsapp_conversations")
      .update({ status: "closed" })
      .eq("id", conversation.id);
    console.log("[whatsapp] conversation closed at the AI turn cap", conversation.id);
    return;
  }

  const { data: historyRows, error: historyError } = await client
    .from("whatsapp_messages")
    .select("direction, body")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT * 2);

  if (historyError) {
    console.error("[whatsapp] history read failed", historyError.message);
    return;
  }

  let result: ClaudeReply;
  try {
    result = await callClaude(
      practice,
      (historyRows ?? []) as { direction: "in" | "out"; body: string }[],
    );
  } catch (error) {
    console.error(
      "[whatsapp] AI reply failed",
      error instanceof Error ? error.message : error,
    );
    return;
  }

  if (!result.reply) return;

  try {
    const sendResult = await whatsappProvider().sendFreeform({
      to: conversation.phone,
      body: result.reply,
    });

    await client.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      practice_id: practice.id,
      direction: "out",
      body: result.reply,
      provider_message_id: sendResult.providerMessageId,
      ai_generated: true,
    });

    await client
      .from("whatsapp_conversations")
      .update({
        last_outbound_at: new Date().toISOString(),
        ai_turns_count: conversation.ai_turns_count + 1,
        status: result.bookingRequested ? "booking_requested" : "active",
      })
      .eq("id", conversation.id);

    if (result.bookingRequested) {
      await client.from("patient_events").insert({
        practice_id: practice.id,
        patient_id: conversation.patient_id,
        type: "replied",
        meta: { channel: "whatsapp", booking_requested: true },
      });
    }
  } catch (sendError) {
    console.error(
      "[whatsapp] reply send failed",
      sendError instanceof Error ? sendError.message : sendError,
    );
  }
}
