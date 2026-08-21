"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type SettingsState = { error: string | null; saved: boolean };

const Schema = z.object({
  name: z.string().trim().min(2, "Add your gym name.").max(200),
  senderName: z
    .string()
    .trim()
    .min(2, "Members need a name to recognise on the email.")
    .max(120),
  replyToEmail: z.email("That reply-to address does not look right.").max(320),
  lapsedAfterMonths: z.coerce
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
  bookingValue: z
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
  const { gym, session } = await requireOwner();

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    senderName: formData.get("senderName"),
    replyToEmail: formData.get("replyToEmail"),
    lapsedAfterMonths: formData.get("lapsedAfterMonths"),
    maxVisits: formData.get("maxVisits"),
    dailySendCap: formData.get("dailySendCap"),
    bookingValue: formData.get("bookingValue"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form.",
      saved: false,
    };
  }

  const value = parsed.data;

  // Kept in minor units in the database; entered in whole currency in the form.
  const bookingValueMinor =
    value.bookingValue === null
      ? null
      : Math.round(value.bookingValue * 100);

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      name: value.name,
      sender_name: value.senderName,
      reply_to_email: value.replyToEmail.toLowerCase(),
      lapsed_after_months: value.lapsedAfterMonths,
      max_visits: value.maxVisits,
      daily_send_cap: value.dailySendCap,
      booking_value_minor: bookingValueMinor,
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[settings] update failed", error.message);
    return { error: "We could not save that. Try again.", saved: false };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "gym.updated",
    meta: {
      lapsed_after_months: value.lapsedAfterMonths,
      max_visits: value.maxVisits,
    },
  });

  // The lapse window feeds every count on the dashboard and the members
  // list, so those pages are stale the moment this saves.
  revalidatePath("/app", "layout");

  return { error: null, saved: true };
}
