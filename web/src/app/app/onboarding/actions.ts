"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getPracticeContext, requireSession } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { COUNTRIES, timezoneFor } from "@/lib/countries";
import {
  TRIAL_DAYS,
  earlyAdopterProgramActive,
  trialEnabledForNewSignups,
} from "@/lib/plan";

export type OnboardingState = { error: string | null };

const Schema = z.object({
  name: z.string().trim().min(2, "Add your practice name.").max(200),
  country: z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]], {
    message: "Choose the country your practice is in.",
  }),
  contactEmail: z
    .email("That email address does not look right.")
    .max(320),
  replyToEmail: z
    .email("That reply-to address does not look right.")
    .max(320),
});

/**
 * Creates the practice and makes the signed-in user its owner.
 *
 * Both rows are written by one Postgres function so they cannot come apart: a
 * practice with no members is unreachable by every RLS policy in the schema,
 * which would mean a paying customer locked out of their own data.
 */
export async function createPracticeAction(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await requireSession();

  // Someone who already has a practice does not belong here. The database
  // enforces this too, this just gives a sane redirect instead of an error.
  const existing = await getPracticeContext();
  if (existing) redirect("/app");

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    country: formData.get("country"),
    contactEmail: formData.get("contactEmail"),
    replyToEmail: formData.get("replyToEmail"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const { name, country, contactEmail, replyToEmail } = parsed.data;

  const { data: practiceId, error } = await supabaseAdmin().rpc("create_practice", {
    p_user_id: session.userId,
    p_name: name,
    p_country: country,
    p_timezone: timezoneFor(country),
    p_contact_email: contactEmail.toLowerCase(),
    // Patients see the practice's own name on the email, not casdey's.
    p_sender_name: name,
    p_reply_to_email: replyToEmail.toLowerCase(),
  });

  if (error) {
    if (error.code === "23505") redirect("/app");
    console.error("[onboarding] create_practice failed", error.message);
    return {
      error: "We could not set up your practice. Try again in a moment.",
    };
  }

  // The id comes back from the function itself. Re-reading through
  // getPracticeContext() here would return null: it is wrapped in React
  // `cache`, and it was already called (and memoised) earlier in this request.
  if (typeof practiceId === "string") {
    // Start the free week and flag the early-adopter discount, both governed by
    // the V1 flags. No card is taken: the trial is casdey's to give, and the
    // account simply drops to Free when it ends. In V2 (trial flag off) a new
    // practice starts on Free straight away.
    const trialEnabled = trialEnabledForNewSignups();
    const trialEndsAt = trialEnabled
      ? new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
      : null;

    await supabaseAdmin()
      .from("practices")
      .update({
        trial_ends_at: trialEndsAt,
        early_adopter: earlyAdopterProgramActive(),
      })
      .eq("id", practiceId);

    await recordAudit({
      practiceId,
      actorId: session.userId,
      actorEmail: session.email,
      action: "practice.created",
      meta: { country, trial: trialEnabled },
    });
  }

  // Straight into the product. The free week is already running; upgrading to
  // Premium happens later, from billing, when they hit the Free plan's limits.
  redirect("/app?welcome=1");
}
