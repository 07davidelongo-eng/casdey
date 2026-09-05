"use server";

import { requireGym } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/zoho-mail";

export type FeedbackState = { error: string | null; sent: boolean };

const MAX_LENGTH = 4000;

/** Where feedback is read the same day. Not the shared info@ group: this is
 *  product feedback, and it needs to reach the person who decides what gets
 *  built, not a support queue. */
const FEEDBACK_TO = process.env.FEEDBACK_NOTIFY_TO ?? "davide@casdey.com";

/**
 * What a gym tells casdey from the support widget (Track H1).
 *
 * Two destinations on purpose. The table is the durable copy, because feedback
 * is the raw material for deciding what casdey builds next and an inbox is
 * where things get read once and then buried. The email is so it is actually
 * read today.
 *
 * The write wins and the email is best effort: a gym that took the trouble to
 * type something must never be told it failed because a mail API was down. The
 * row is already saved by then, and it is the copy that matters.
 *
 * Sends over Zoho rather than Resend deliberately. Resend's plan is capped at
 * 100 emails a day and the live cold outreach is already eating 75 of them, so
 * casdey's own internal notifications must not compete with a gym's actual
 * campaign for that allowance.
 */
export async function sendFeedbackAction(
  _previous: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const { gym, session } = await requireGym();

  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    return { error: "Write something first and we will read it.", sent: false };
  }
  if (message.length > MAX_LENGTH) {
    return {
      error: `That is longer than we can take. Keep it under ${MAX_LENGTH} characters.`,
      sent: false,
    };
  }

  // Which page they were on when they said it. A complaint about import is a
  // different signal from the same words on the billing page, and asking the
  // gym to tell us would be asking them to do our work for us.
  const rawPath = String(formData.get("path") ?? "").trim();
  const path = rawPath.startsWith("/app") ? rawPath.slice(0, 200) : null;

  const { error } = await supabaseAdmin().from("feedback").insert({
    gym_id: gym.id,
    author_id: session.userId,
    author_email: session.email,
    path,
    message,
  });

  if (error) {
    console.error("[feedback] insert failed", error.message);
    return { error: "We could not send that. Try again.", sent: false };
  }

  try {
    await sendMail({
      to: FEEDBACK_TO,
      subject: `Feedback: ${gym.name}`,
      text: [
        message,
        "",
        "---",
        `Gym: ${gym.name}`,
        `From: ${session.email}`,
        `Page: ${path ?? "not recorded"}`,
        `Sent: ${new Date().toISOString()}`,
        "",
        `Reply to ${session.email} directly. They are expecting an answer.`,
      ].join("\n"),
    });
  } catch (mailError) {
    // Logged, not surfaced. The row is saved, so nothing was lost.
    console.error(
      "[feedback] notification email failed",
      mailError instanceof Error ? mailError.message : mailError,
    );
  }

  return { error: null, sent: true };
}
