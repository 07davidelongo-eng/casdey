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
  lapseWindow: z.coerce
    .number()
    .int()
    .min(1, "The window has to be at least one.")
    .max(1825, "Five years is the longest window casdey will use."),
  lapseUnit: z.enum(["months", "days"]),
  // Absent from the form data entirely when the box is unticked, which is how
  // an HTML checkbox reports "off". That absence is the off switch.
  capVisits: z
    .union([z.literal("on"), z.null(), z.undefined()])
    .transform((v) => v === "on"),
  // Arrives as null when the ceiling is switched off, because the field is
  // disabled and a disabled field is not submitted at all. So it cannot be
  // required here; the refine below requires it only when the box is ticked.
  maxVisits: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const raw = typeof v === "string" ? v.trim() : "";
      return raw === "" ? null : Number(raw);
    }),
  atRiskAfterDays: z.coerce
    .number()
    .int()
    .min(7, "A week is the shortest at-risk window casdey will use.")
    .max(180, "Six months is the longest at-risk window casdey will use."),
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
})
  .refine(
    (value) =>
      !value.capVisits ||
      (value.maxVisits !== null &&
        Number.isInteger(value.maxVisits) &&
        value.maxVisits >= 1 &&
        value.maxVisits <= 200),
    {
      message: "The visit ceiling has to be a whole number from 1 to 200.",
      path: ["maxVisits"],
    },
  )
  .refine(
    (value) => value.lapseUnit !== "months" || value.lapseWindow <= 60,
    {
      message: "Five years is the longest window casdey will use.",
      path: ["lapseWindow"],
    },
  )
  .refine(
    (value) => value.lapseUnit !== "days" || value.lapseWindow >= 7,
    {
      message: "A week is the shortest window casdey will use.",
      path: ["lapseWindow"],
    },
  )
  .refine(
    (value) =>
      value.atRiskAfterDays <
      (value.lapseUnit === "days"
        ? value.lapseWindow
        : value.lapseWindow * 30),
    {
      message: "The check-in window must be shorter than the lapse window.",
      path: ["atRiskAfterDays"],
    },
  );

export async function saveSettingsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { gym, session } = await requireOwner();

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    senderName: formData.get("senderName"),
    replyToEmail: formData.get("replyToEmail"),
    lapseWindow: formData.get("lapseWindow"),
    lapseUnit: formData.get("lapseUnit"),
    capVisits: formData.get("capVisits"),
    maxVisits: formData.get("maxVisits"),
    atRiskAfterDays: formData.get("atRiskAfterDays"),
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

  // Both window columns are always written. lapsed_after_days is the one the
  // app reads when it is set (see ruleFor() in src/lib/lapse.ts), and
  // lapsed_after_months is kept in step behind it because the deployed app
  // shares this database and still reads it. A days window rounds UP into the
  // months column: rounding down would make the stale reader's window shorter
  // than the gym asked for, which contacts people the gym did not mean to
  // contact. Too cautious is recoverable, too eager is not.
  const days = value.lapseUnit === "days" ? value.lapseWindow : null;
  const months =
    days === null ? value.lapseWindow : Math.max(3, Math.ceil(days / 30));

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      name: value.name,
      sender_name: value.senderName,
      reply_to_email: value.replyToEmail.toLowerCase(),
      lapsed_after_months: months,
      lapsed_after_days: days,
      max_visits: value.capVisits ? value.maxVisits : null,
      at_risk_after_days: value.atRiskAfterDays,
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
      lapse_window: `${value.lapseWindow} ${value.lapseUnit}`,
      max_visits: value.capVisits ? value.maxVisits : null,
    },
  });

  // The lapse window feeds every count on the dashboard and the members
  // list, so those pages are stale the moment this saves.
  revalidatePath("/app", "layout");

  return { error: null, saved: true };
}
