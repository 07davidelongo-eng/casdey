/**
 * Screens an AI reply before it is sent over WhatsApp in a gym's name.
 *
 * Kept out of ./ai-agent.ts (and free of "server-only") so it can be unit
 * tested directly, same split as ./signature.ts.
 *
 * Deliberately conservative: a missed automated reply is recoverable (a human
 * sees the still-open thread on the member's page), a bad one sent in the
 * gym's name is not. Returns the reply unchanged when it looks safe, or ""
 * to send nothing.
 */
export function sanitizeReply(raw: string): string {
  const reply = raw.trim();
  if (!reply) return "";
  if (reply.length > 700) return "";

  const lower = reply.toLowerCase();

  // Specifics the agent is told never to state: a concrete time, or a price.
  const inventsTime =
    /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(reply) ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^.?!]*\b(at|from)\b/i.test(
      reply,
    );
  const inventsPrice = /(?:[£$€]\s?\d)|\b\d+\s?(?:pounds|euros|dollars)\b/i.test(
    reply,
  );

  // Training / injury / medical advice it must not give.
  const givesAdvice =
    /\b(you should (?:take|do|try|stretch|rest|ice)|i'?d recommend (?:taking|doing|resting|stretching)|for your (?:injury|knee|back|shoulder|pain))\b/i.test(
      lower,
    );

  if (inventsTime || inventsPrice || givesAdvice) return "";

  return reply;
}
