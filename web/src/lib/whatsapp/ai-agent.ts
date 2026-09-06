import "server-only";

import { supabaseAdmin } from "../supabase";
import { whatsappProvider } from "./send";
import { sanitizeReply } from "./sanitize";
import {
  CANCELLATION_REASONS,
  isCancellationReason,
  type CancellationReason,
} from "../cancellation";
import type { Gym, WhatsAppConversation } from "../types";

/**
 * The responsive part of the WhatsApp channel (Track E1): a real
 * back-and-forth with the member, not a single templated send.
 *
 * This carries a standing per-use LLM cost, the exact thing dropped for
 * AI-assisted campaign drafting for being a cost with no real demand. The
 * difference here is structural: a live conversation cannot be pre-templated
 * the way a single outbound message can, so there is no cheaper way to do it
 * at all. Guardrails keep the cost bounded:
 *
 *   - History sent to the model is capped (HISTORY_LIMIT), so token cost per
 *     reply cannot grow without bound as a conversation runs long.
 *   - Each conversation gets a hard cap on total AI replies
 *     (WHATSAPP_AI_MAX_TURNS), claimed atomically in the database
 *     (claim_whatsapp_ai_turn) so two racing webhook deliveries cannot both
 *     slip past it. Past the cap the conversation closes; a human takes over.
 *   - The model's reply is screened (sanitizeReply) before it is ever sent:
 *     an answer that invents a time, price, or availability, or strays into
 *     injury/medical/training advice, is dropped rather than delivered.
 *
 * Raw fetch to the Anthropic Messages API, no SDK dependency, matching the
 * project's established preference (Resend and Twilio are both called the
 * same way).
 */

const MODEL = process.env.CASDEY_WHATSAPP_AI_MODEL ?? "claude-haiku-4-5-20251001";
const HISTORY_LIMIT = 20;
export const WHATSAPP_AI_MAX_TURNS = 20;

const MARK_BOOKING_TOOL = {
  name: "mark_booking_requested",
  description:
    "Call this the moment the member clearly says they want to come in or book a session. Only call it once they have actually said yes, not when they are just considering it or asking what is involved.",
  input_schema: { type: "object", properties: {}, required: [] },
};

const RECORD_REASON_TOOL = {
  name: "record_reason",
  description:
    "Call this when the member says, in their own words, why they stopped coming. Record what they actually said, not what you infer from silence or from them being busy in general. Do not ask for a reason more than once, and never push if they do not want to say.",
  input_schema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        enum: [...CANCELLATION_REASONS],
        description:
          "price: too expensive. relocation: moved away. dissatisfaction: unhappy with the gym itself. health: injury or illness. no_time: could not fit it in. other: a real reason that is none of these.",
      },
    },
    required: ["reason"],
  },
};

function systemPrompt(gymName: string): string {
  return `You are messaging on behalf of ${gymName}, a gym, over WhatsApp. You are re-engaging a member who has not been in for a while.

Rules:
- Stay warm, brief, and human. These are WhatsApp messages, not emails: a sentence or two, no headers, no signature.
- Your one goal is finding out whether they would like to come back in. Do not chase beyond a couple of exchanges if they are not interested; a polite decline ends the conversation.
- Never give training, nutrition, injury, or medical advice of any kind. If asked, say a coach at the gym can go through that with them directly.
- Never invent class times, prices, availability, or membership terms. You cannot book anything yourself.
- The moment the member clearly says they want to book, call mark_booking_requested and send one short reply confirming the gym will be in touch to arrange a time. Do not negotiate times yourself.
- If the member tells you why they stopped coming, call record_reason once with what they said. Ask at most once, gently, and only if it comes up naturally. Never press somebody who does not want to say, and never guess.
- Reply in whatever language the member is writing in.`;
}

type ClaudeReply = {
  reply: string;
  bookingRequested: boolean;
  reason: CancellationReason | null;
};

async function callClaude(
  gym: Gym,
  history: { direction: "in" | "out"; body: string }[],
): Promise<ClaudeReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  // Anthropic requires the first message to be role "user". The opening
  // template send is logged as an outbound ("assistant") message, so a
  // conversation's history can start with one or more assistant turns before
  // the member has replied. Drop any leading assistant messages so the array
  // the API sees always begins with the member.
  const trimmed = [...history];
  while (trimmed.length && trimmed[0].direction === "out") trimmed.shift();

  const messages = trimmed.slice(-HISTORY_LIMIT).map((message) => ({
    role: message.direction === "in" ? "user" : "assistant",
    content: message.body,
  }));

  if (messages.length === 0) {
    return { reply: "", bookingRequested: false, reason: null };
  }

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
      system: systemPrompt(gym.name),
      messages,
      tools: [MARK_BOOKING_TOOL, RECORD_REASON_TOOL],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude API failed: ${response.status} ${detail.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    content: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: unknown;
    }>;
  };

  let reply = "";
  let bookingRequested = false;
  let reason: CancellationReason | null = null;
  for (const block of json.content ?? []) {
    if (block.type === "text" && block.text) reply += block.text;
    if (block.type !== "tool_use") continue;
    if (block.name === "mark_booking_requested") bookingRequested = true;
    if (block.name === "record_reason") {
      // The enum is declared to the model, and the model is still the one
      // filling it in, so it is checked here rather than trusted: an
      // unrecognised value would fail the check constraint on the column and
      // take the whole reply down with it.
      const given = (block.input as { reason?: unknown } | undefined)?.reason;
      if (isCancellationReason(given)) reason = given;
    }
  }

  return { reply: sanitizeReply(reply), bookingRequested, reason };
}

/**
 * Called by the inbound webhook after logging the member's message. Loads the
 * thread, asks Claude for the next reply, sends it, and persists the result.
 * Never throws: a failure here should not make the webhook return a 500
 * (Twilio would retry and could double-send), it should just mean the member
 * does not get an automated reply this round. Logged either way.
 */
export async function continueConversation(
  gym: Gym,
  conversation: WhatsAppConversation,
): Promise<void> {
  const client = supabaseAdmin();

  // opted_out / closed: never auto-reply again. booking_requested: staff has
  // the hand-off, the AI stops talking so it cannot walk back what it already
  // told the member.
  if (conversation.status !== "active") return;

  // Claim one AI turn atomically. Null back means the cap is already reached
  // or the conversation is no longer active (a racing delivery got the last
  // turn, or an opt-out landed first): do not reply.
  const { data: claimedCount, error: claimError } = await client.rpc(
    "claim_whatsapp_ai_turn",
    { p_conversation_id: conversation.id, p_max_turns: WHATSAPP_AI_MAX_TURNS },
  );

  if (claimError) {
    console.error("[whatsapp] turn claim failed", claimError.message);
    return;
  }

  if (claimedCount == null) {
    // Cap reached: close the thread so the dashboard shows it needs a human.
    await client
      .from("whatsapp_conversations")
      .update({ status: "closed" })
      .eq("id", conversation.id)
      .eq("status", "active");
    console.log("[whatsapp] conversation at the AI turn cap", conversation.id);
    return;
  }

  // Newest-first from the database, then flipped back to chronological order.
  // Ordering ascending with a LIMIT returns the OLDEST rows, so a long
  // conversation never showed the model its recent messages.
  const { data: historyRows, error: historyError } = await client
    .from("whatsapp_messages")
    .select("direction, body, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT * 2);

  if (historyError) {
    console.error("[whatsapp] history read failed", historyError.message);
    return;
  }

  const history = ((historyRows ?? []) as {
    direction: "in" | "out";
    body: string;
  }[])
    .slice()
    .reverse();

  let result: ClaudeReply;
  try {
    result = await callClaude(gym, history);
  } catch (error) {
    console.error(
      "[whatsapp] AI reply failed",
      error instanceof Error ? error.message : error,
    );
    return;
  }

  if (!result.reply) return;

  try {
    const sendResult = await whatsappProvider(gym.whatsapp_from).sendFreeform({
      to: conversation.phone,
      body: result.reply,
    });

    await client.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      gym_id: gym.id,
      direction: "out",
      body: result.reply,
      provider_message_id: sendResult.providerMessageId,
      ai_generated: true,
    });

    await client
      .from("whatsapp_conversations")
      .update({
        last_outbound_at: new Date().toISOString(),
        status: result.bookingRequested ? "booking_requested" : "active",
      })
      .eq("id", conversation.id);

    if (result.bookingRequested) {
      await client.from("member_events").insert({
        gym_id: gym.id,
        member_id: conversation.member_id,
        type: "replied",
        meta: { channel: "whatsapp", booking_requested: true },
      });
    }

    // Why they left, in their own words, learned by asking them. This is the
    // one channel where casdey hears the answer at all: an email reply goes
    // straight to the gym's own inbox and casdey never sees it.
    //
    // Only ever fills a blank. Staff who recorded a reason at the front desk
    // heard it from the member in person, and a model reading a WhatsApp
    // thread does not get to overrule that.
    if (result.reason) {
      const { error: reasonError } = await client
        .from("members")
        .update({ cancellation_reason: result.reason })
        .eq("id", conversation.member_id)
        .is("cancellation_reason", null);

      if (reasonError) {
        console.error("[whatsapp] reason not recorded", reasonError.message);
      }
    }
  } catch (sendError) {
    console.error(
      "[whatsapp] reply send failed",
      sendError instanceof Error ? sendError.message : sendError,
    );
  }
}
