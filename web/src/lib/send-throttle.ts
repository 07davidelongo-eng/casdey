/**
 * Telling "the provider is busy" apart from "this message is bad".
 *
 * Kept out of ./sender.ts, and deliberately free of "server-only", so it can
 * be unit tested directly. Same reasoning as ./whatsapp/signature.ts and
 * ./template.ts.
 *
 * Why it matters: a failed send burns one of three attempts, and after the
 * third the message is retired as failed. That is right for a dead address and
 * badly wrong for a provider ceiling, which has nothing to do with the address
 * and will hit every other message in the run just the same. On Vercel Hobby
 * the queue drains once a day, so three throttled days would quietly retire a
 * whole campaign's worth of perfectly good addresses.
 *
 * Matched on the message text because the provider layer throws a formatted
 * string ("Resend failed: 429 …") rather than a typed error.
 */
export function isProviderThrottled(detail: string): boolean {
  const text = detail.toLowerCase();
  return (
    text.includes("429") ||
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("quota") ||
    text.includes("too many requests")
  );
}
