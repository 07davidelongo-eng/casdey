"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type SettingsState = { error: string | null; saved: boolean };

const Schema = z.object({
  name: z.string().trim().min(2, "Add your practice name.").max(200),
  senderName: z
    .string()
    .trim()
    .min(2, "Patients need a name to recognise on the email.")
    .max(120),
  replyToEmail: z.email("That reply-to address does not look right.").max(320),
  dormantAfterMonths: z.coerce
    .number()
    .int()
    .min(3, "Three months is the shortest window casdey will use.")
    .max(60, "Five years is the longest window casdey will use."),
  maxVisits: z.coerce
    .number()
    .int()
    .min(1, "At least one visit.")
    .max(20, "Twenty visits is the most casdey will treat as a drop-off."),
  dailySendCap: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000, "A thousand a day is the ceiling."),
  // Entered in major units (whole pounds/euros and pence/cents), blank allowed.
  // "" means "not set" and is stored as null, not zero.
  appointmentValue: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1_000_000),
      "Enter the value as a number, like 120.",
    ),
});

export async function saveSettingsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { practice, session } = await requireOwner();

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    senderName: formData.get("senderName"),
    replyToEmail: formData.get("replyToEmail"),
    dormantAfterMonths: formData.get("dormantAfterMonths"),
    maxVisits: formData.get("maxVisits"),
    dailySendCap: formData.get("dailySendCap"),
    appointmentValue: formData.get("appointmentValue"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form.",
      saved: false,
    };
  }

  const value = parsed.data;

  // Kept in minor units in the database; entered in whole currency in the form.
  const appointmentValueMinor =
    value.appointmentValue === null
      ? null
      : Math.round(value.appointmentValue * 100);

  const { error } = await supabaseAdmin()
    .from("practices")
    .update({
      name: value.name,
      sender_name: value.senderName,
      reply_to_email: value.replyToEmail.toLowerCase(),
      dormant_after_months: value.dormantAfterMonths,
      max_visits: value.maxVisits,
      daily_send_cap: value.dailySendCap,
      appointment_value_minor: appointmentValueMinor,
    })
    .eq("id", practice.id);

  if (error) {
    console.error("[settings] update failed", error.message);
    return { error: "We could not save that. Try again.", saved: false };
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "practice.updated",
    meta: {
      dormant_after_months: value.dormantAfterMonths,
      max_visits: value.maxVisits,
    },
  });

  // The dormancy window feeds every count on the dashboard and the patients
  // list, so those pages are stale the moment this saves.
  revalidatePath("/app", "layout");

  return { error: null, saved: true };
}
