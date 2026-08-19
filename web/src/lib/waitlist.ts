import { supabaseAdmin, UNIQUE_VIOLATION } from "./supabase";
import { sendMail } from "./zoho-mail";

/**
 * Waitlist capture.
 *
 * Storage is Postgres on Supabase, in an EU region, which is also where the SaaS
 * will keep its data. Schema and the reasoning behind the RLS setup are in
 * `supabase/migrations/0001_waitlist.sql`.
 *
 * Business contact details only: gym/studio name, work email, and which
 * software they run. No member data ever touches this table.
 */

export type WaitlistInput = {
  email: string;
  practice: string;
  software: string;
};

/** Deliberately permissive. Rejecting valid-but-unusual addresses costs signups. */
const EMAIL_RE = /^[^\s@]+@[^\s@,]+\.[^\s@,]{2,}$/;

export function validate(input: {
  email?: unknown;
  practice?: unknown;
  software?: unknown;
}): { ok: true; value: WaitlistInput } | { ok: false; error: string } {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const practice =
    typeof input.practice === "string" ? input.practice.trim() : "";
  const software =
    typeof input.software === "string" ? input.software.trim() : "";

  if (!practice) return { ok: false, error: "Add your gym or studio name." };
  if (practice.length > 200)
    return { ok: false, error: "That name is too long." };
  if (!email || !EMAIL_RE.test(email) || email.length > 320)
    return { ok: false, error: "That email address does not look right." };
  if (software.length > 200)
    return { ok: false, error: "That software name is too long." };

  return { ok: true, value: { email: email.toLowerCase(), practice, software } };
}

/** Returns whether this was a repeat signup, so the emails are not sent twice. */
export async function addToWaitlist(
  input: WaitlistInput,
): Promise<{ duplicate: boolean }> {
  const { error } = await supabaseAdmin().from("waitlist_signups").insert({
    practice_name: input.practice,
    email: input.email,
    practice_software: input.software || null,
    source: "casdey.com",
  });

  if (!error) return { duplicate: false };

  // Already on the list. Treated as a success so the endpoint never reveals
  // whether an address is on file.
  if (error.code === UNIQUE_VIOLATION) return { duplicate: true };

  throw new Error(`Supabase insert failed: ${error.code} ${error.message}`);
}

/** Tells Davide and Abhi that someone joined. Best effort, never blocks a signup. */
export async function notifyTeam(input: WaitlistInput): Promise<void> {
  await sendMail({
    to: process.env.WAITLIST_NOTIFY_TO ?? "info@casdey.com",
    subject: `Waitlist: ${input.practice}`,
    text: [
      `${input.practice} joined the waitlist.`,
      "",
      `Email: ${input.email}`,
      `Practice software: ${input.software || "not given"}`,
      `Joined: ${new Date().toISOString()}`,
    ].join("\n"),
  });
}

/** Confirms to the practice that they are on the list. Best effort. */
export async function confirmToPractice(input: WaitlistInput): Promise<void> {
  await sendMail({
    to: input.email,
    subject: "You are on the casdey waitlist",
    text: [
      `Thanks for joining, ${input.practice}.`,
      "",
      "casdey is being built now. When it is ready for gyms and studios like yours, you will get an email from me with the free first week attached. No card and no commitment, and nothing else from us in the meantime.",
      "",
      "If you have a question before then, just reply to this message. It comes straight to me.",
      "",
      "If you would rather come off the list, reply and say so and I will remove you.",
      "",
      "Davide @casdey",
    ].join("\n"),
  });
}
