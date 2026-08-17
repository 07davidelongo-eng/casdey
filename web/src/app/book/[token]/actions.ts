"use server";

import { supabaseAdmin, UNIQUE_VIOLATION } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { emailProvider, siteUrl } from "@/lib/messaging";
import { buildIcs } from "@/lib/calendar/ics";
import { practiceOpenSlots } from "@/lib/calendar/practice-slots";
import { calendarFor } from "@/lib/calendar/provider";
import type { Practice } from "@/lib/types";

export type BookState = {
  booked: boolean;
  error: string | null;
  confirmedStartAt: string | null;
};

/**
 * Books a slot for the patient behind this token.
 *
 * No login: same reasoning as /u/[token] (the token itself is the only
 * credential a patient needs). Everything the patient submits is re-checked
 * against the database rather than trusted, because the browser could be
 * stale (a slot picked ten minutes ago that someone else has since taken) or
 * simply wrong:
 *
 *   1. The token resolves to a real patient whose practice has booking on.
 *   2. The submitted time is still one of the practice's actually-open slots,
 *      recomputed fresh, not read back from a hidden field.
 *   3. The insert itself is guarded by the appointments_slot_idx unique
 *      index, so even two people submitting the same slot in the same instant
 *      cannot both win.
 *
 * On success this reuses the exact reactivation signal a staff member sets by
 * hand (status='reactivated'), so the dashboard and the profit-or-nothing
 * guarantee count a self-serve booking automatically, no extra wiring.
 */
export async function bookSlotAction(
  _previous: BookState,
  formData: FormData,
): Promise<BookState> {
  const token = String(formData.get("token") ?? "");
  const startAtRaw = String(formData.get("startAt") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "") || null;

  const notValid = { booked: false, error: "That link is not valid.", confirmedStartAt: null };
  if (!token || !startAtRaw) return notValid;

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) {
    return { booked: false, error: "Pick a time to continue.", confirmedStartAt: null };
  }

  const client = supabaseAdmin();

  const { data: patient } = await client
    .from("patients")
    .select("id, practice_id, first_name, last_name, email")
    .eq("booking_token", token)
    .maybeSingle();

  if (!patient) return notValid;

  const { data: practiceRow } = await client
    .from("practices")
    .select("*")
    .eq("id", patient.practice_id)
    .maybeSingle();

  const practice = practiceRow as Practice | null;
  if (!practice || !practice.booking_enabled) {
    return {
      booked: false,
      error: "Booking is not available for this practice right now.",
      confirmedStartAt: null,
    };
  }

  // Recompute fresh: the slot the patient picked must still be open. This is
  // the same engine the page used to show it, so a slot the page offered a
  // moment ago is trusted only as far as this recheck confirms it still holds.
  const stillOpen = (await practiceOpenSlots(practice)).some(
    (slot) => slot.start.getTime() === startAt.getTime(),
  );
  if (!stillOpen) {
    return {
      booked: false,
      error: "That time is no longer available. Pick another.",
      confirmedStartAt: null,
    };
  }

  const endAt = new Date(
    startAt.getTime() + practice.booking_slot_minutes * 60_000,
  );

  let valueMinor: number | null = practice.appointment_value_minor;
  let serviceName: string | null = null;
  if (serviceId) {
    const { data: service } = await client
      .from("practice_services")
      .select("name, price_minor")
      .eq("id", serviceId)
      .eq("practice_id", practice.id)
      .maybeSingle();
    if (service) {
      valueMinor = service.price_minor;
      serviceName = service.name as string;
    }
  }

  const { data: appointment, error: insertError } = await client
    .from("appointments")
    .insert({
      practice_id: practice.id,
      patient_id: patient.id,
      service_id: serviceId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: "booked",
      value_minor: valueMinor,
      created_via: "self_serve",
    })
    .select("id, booking_token")
    .single();

  if (insertError || !appointment) {
    // The double-book guard: two people submitting the same slot at once, one
    // loses the unique index race. Everyone else is a real failure.
    if (insertError?.code === UNIQUE_VIOLATION) {
      return {
        booked: false,
        error: "That time was just taken. Pick another.",
        confirmedStartAt: null,
      };
    }
    console.error("[booking] insert failed", insertError?.message);
    return {
      booked: false,
      error: "We could not book that. Try again.",
      confirmedStartAt: null,
    };
  }

  // Mirror into Google Calendar when connected. Best-effort: casdey's own
  // record is the source of truth, so a Google failure must not undo a real
  // booking the patient was just told succeeded.
  try {
    const calendar = await calendarFor(practice.id);
    if (calendar) {
      const summary = serviceName
        ? `${serviceName} with ${patientLabel(patient)}`
        : `Appointment with ${patientLabel(patient)}`;
      const { eventId } = await calendar.createEvent({
        summary,
        description: "Booked automatically by casdey.",
        start: startAt,
        end: endAt,
        attendeeEmail: patient.email,
      });
      await client
        .from("appointments")
        .update({ google_event_id: eventId })
        .eq("id", appointment.id);
    }
  } catch (error) {
    console.error("[booking] google mirror failed", error);
  }

  const now = new Date().toISOString();

  // Always moves forward, same as markRebookedAction: a patient already
  // reactivated by an earlier booking simply gets a fresher reactivated_at.
  await client
    .from("patients")
    .update({ status: "reactivated", reactivated_at: now })
    .eq("id", patient.id);

  await client.from("patient_events").insert({
    practice_id: practice.id,
    patient_id: patient.id,
    type: "booked",
    meta: { appointment_id: appointment.id },
  });

  await recordAudit({
    practiceId: practice.id,
    action: "appointment.booked",
    target: appointment.id,
    meta: { created_via: "self_serve" },
  });

  await sendConfirmationAndNotice({
    practice,
    patient,
    startAt,
    endAt,
    serviceName,
    appointmentBookingToken: appointment.booking_token,
  }).catch((error) => {
    // The booking itself already succeeded and is the record that matters;
    // a failed confirmation email must not roll that back or read as a
    // failure to the patient who is looking at a "you're booked" screen.
    console.error("[booking] confirmation send failed", error);
  });

  return { booked: true, error: null, confirmedStartAt: startAt.toISOString() };
}

function patientLabel(patient: {
  first_name: string | null;
  last_name: string | null;
}): string {
  return [patient.first_name, patient.last_name].filter(Boolean).join(" ").trim() || "Patient";
}

async function sendConfirmationAndNotice(opts: {
  practice: Practice;
  patient: { id: string; first_name: string | null; last_name: string | null; email: string | null };
  startAt: Date;
  endAt: Date;
  serviceName: string | null;
  appointmentBookingToken: string;
}): Promise<void> {
  const { practice, patient, startAt, endAt, serviceName, appointmentBookingToken } = opts;
  const provider = emailProvider();

  const whenText = formatWhen(startAt, practice.timezone);
  const manageUrl = `${siteUrl()}/book/${appointmentBookingToken}/manage`;

  // Two independent sends, two independent failures. A bad patient address
  // (or a provider hiccup) must not also swallow the practice's own new-
  // booking notice, and the practice's notification going astray must not be
  // blamed on the patient's confirmation. Each is caught on its own; the
  // caller's outer catch is just a last line of defence.
  if (patient.email) {
    try {
      const ics = buildIcs({
        uid: `casdey-appointment-${startAt.getTime()}@casdey.com`,
        start: startAt,
        end: endAt,
        summary: serviceName
          ? `${serviceName} at ${practice.name}`
          : `Appointment at ${practice.name}`,
        description: "Booked through casdey.",
      });

      await provider.send({
        to: patient.email,
        subject: `You're booked in at ${practice.name}`,
        text: [
          `Hi ${patient.first_name?.trim() || "there"},`,
          "",
          `You're booked in at ${practice.name} for ${whenText}${serviceName ? ` (${serviceName})` : ""}.`,
          "",
          "A calendar invite is attached to this email.",
          "",
          "Need to change or cancel? Use this link:",
          manageUrl,
          "",
          practice.name,
        ].join("\n"),
        fromName: practice.sender_name ?? practice.name,
        replyTo: practice.reply_to_email,
        attachment: {
          filename: "appointment.ics",
          content: Buffer.from(ics, "utf8").toString("base64"),
          contentType: "text/calendar",
        },
      });
    } catch (error) {
      console.error("[booking] patient confirmation send failed", error);
    }
  }

  const practiceInbox = practice.reply_to_email ?? practice.contact_email;
  if (practiceInbox) {
    try {
      await provider.send({
        to: practiceInbox,
        subject: `New booking: ${patientLabel(patient)}`,
        text: [
          `${patientLabel(patient)} booked ${whenText}${serviceName ? ` (${serviceName})` : ""} through casdey.`,
          "",
          "This was a returning patient your list flagged as dormant.",
        ].join("\n"),
        fromName: "casdey",
        replyTo: null,
      });
    } catch (error) {
      console.error("[booking] practice notice send failed", error);
    }
  }
}

function formatWhen(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
