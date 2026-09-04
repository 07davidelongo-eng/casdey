"use server";

import {
  EXCLUSION_VIOLATION,
  supabaseAdmin,
  UNIQUE_VIOLATION,
} from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { emailProvider, siteUrl } from "@/lib/messaging";
import { sendingIdentity } from "@/lib/email/identity";
import { buildIcs } from "@/lib/calendar/ics";
import { gymOpenSlots, CalendarUnavailableError } from "@/lib/calendar/gym-slots";
import { calendarFor } from "@/lib/calendar/provider";
import type { Gym } from "@/lib/types";

export type BookState = {
  booked: boolean;
  error: string | null;
  confirmedStartAt: string | null;
};

/**
 * Books a slot for the member behind this token.
 *
 * No login: same reasoning as /u/[token] (the token itself is the only
 * credential a member needs). Everything the member submits is re-checked
 * against the database rather than trusted, because the browser could be
 * stale (a slot picked ten minutes ago that someone else has since taken) or
 * simply wrong:
 *
 *   1. The token resolves to a real member whose gym has booking on.
 *   2. The submitted time is still one of the gym's actually-open slots,
 *      recomputed fresh, not read back from a hidden field.
 *   3. The insert itself is guarded by the bookings_slot_idx unique
 *      index, so even two people submitting the same slot in the same instant
 *      cannot both win.
 *
 * On success this reuses the exact reactivation signal a staff member sets by
 * hand (status='returned'), so the dashboard and the profit-or-nothing
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

  const { data: member } = await client
    .from("members")
    .select("id, gym_id, first_name, last_name, email")
    .eq("booking_token", token)
    .maybeSingle();

  if (!member) return notValid;

  const { data: gymRow } = await client
    .from("gyms")
    .select("*")
    .eq("id", member.gym_id)
    .maybeSingle();

  const gym = gymRow as Gym | null;
  if (!gym || !gym.booking_enabled) {
    return {
      booked: false,
      error: "Booking is not available for this gym right now.",
      confirmedStartAt: null,
    };
  }

  // Recompute fresh: the slot the member picked must still be open. This is
  // the same engine the page used to show it, so a slot the page offered a
  // moment ago is trusted only as far as this recheck confirms it still holds.
  let openNow;
  try {
    openNow = await gymOpenSlots(gym);
  } catch (error) {
    // The gym's calendar cannot be read right now, so we cannot confirm this
    // slot is genuinely free. Refuse rather than book blind: booking a slot
    // that turns out to clash is worse than asking the member to reach out.
    if (error instanceof CalendarUnavailableError) {
      return {
        booked: false,
        error:
          "We could not confirm that time against the gym's calendar. Reply to the message you received and we will book you in.",
        confirmedStartAt: null,
      };
    }
    throw error;
  }

  const stillOpen = openNow.some(
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
    startAt.getTime() + gym.booking_slot_minutes * 60_000,
  );

  let valueMinor: number | null = gym.booking_value_minor;
  let serviceName: string | null = null;
  if (serviceId) {
    const { data: service } = await client
      .from("services")
      .select("name, price_minor")
      .eq("id", serviceId)
      .eq("gym_id", gym.id)
      .maybeSingle();
    if (service) {
      valueMinor = service.price_minor;
      serviceName = service.name as string;
    }
  }

  const { data: booking, error: insertError } = await client
    .from("bookings")
    .insert({
      gym_id: gym.id,
      member_id: member.id,
      service_id: serviceId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: "booked",
      value_minor: valueMinor,
      buffer_minutes: gym.booking_buffer_minutes,
      created_via: "self_serve",
    })
    .select("id, booking_token")
    .single();

  if (insertError || !booking) {
    // The double-book guard: two people submitting the same or an overlapping
    // slot at once, one loses. The identical-start case trips the unique index
    // (23505); an overlap or a hit inside the buffer trips bookings_no_overlap
    // (23P01). Both mean the same thing to the member. Everyone else is a real
    // failure.
    if (
      insertError?.code === UNIQUE_VIOLATION ||
      insertError?.code === EXCLUSION_VIOLATION
    ) {
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
  // booking the member was just told succeeded.
  try {
    const calendar = await calendarFor(gym.id);
    if (calendar) {
      const summary = serviceName
        ? `${serviceName} with ${memberLabel(member)}`
        : `Booking with ${memberLabel(member)}`;
      const { eventId } = await calendar.createEvent({
        summary,
        description: "Booked automatically by casdey.",
        start: startAt,
        end: endAt,
        attendeeEmail: member.email,
      });
      await client
        .from("bookings")
        .update({ google_event_id: eventId })
        .eq("id", booking.id);
    }
  } catch (error) {
    console.error("[booking] google mirror failed", error);
  }

  const now = new Date().toISOString();

  // Always moves forward, same as markReturnedAction: a member already
  // returned by an earlier booking simply gets a fresher returned_at.
  await client
    .from("members")
    .update({ status: "returned", returned_at: now })
    .eq("id", member.id);

  await client.from("member_events").insert({
    gym_id: gym.id,
    member_id: member.id,
    type: "booked",
    meta: { booking_id: booking.id },
  });

  await recordAudit({
    gymId: gym.id,
    action: "booking.booked",
    target: booking.id,
    meta: { created_via: "self_serve" },
  });

  await sendConfirmationAndNotice({
    gym,
    member,
    startAt,
    endAt,
    serviceName,
    bookingBookingToken: booking.booking_token,
  }).catch((error) => {
    // The booking itself already succeeded and is the record that matters;
    // a failed confirmation email must not roll that back or read as a
    // failure to the member who is looking at a "you're booked" screen.
    console.error("[booking] confirmation send failed", error);
  });

  return { booked: true, error: null, confirmedStartAt: startAt.toISOString() };
}

function memberLabel(member: {
  first_name: string | null;
  last_name: string | null;
}): string {
  return [member.first_name, member.last_name].filter(Boolean).join(" ").trim() || "Member";
}

async function sendConfirmationAndNotice(opts: {
  gym: Gym;
  member: { id: string; first_name: string | null; last_name: string | null; email: string | null };
  startAt: Date;
  endAt: Date;
  serviceName: string | null;
  bookingBookingToken: string;
}): Promise<void> {
  const { gym, member, startAt, endAt, serviceName, bookingBookingToken } = opts;
  const provider = emailProvider();
  const identity = sendingIdentity(gym);

  const whenText = formatWhen(startAt, gym.timezone);
  const manageUrl = `${siteUrl()}/book/${bookingBookingToken}/manage`;

  // Two independent sends, two independent failures. A bad member address
  // (or a provider hiccup) must not also swallow the gym's own new-
  // booking notice, and the gym's notification going astray must not be
  // blamed on the member's confirmation. Each is caught on its own; the
  // caller's outer catch is just a last line of defence.
  if (member.email) {
    try {
      const ics = buildIcs({
        uid: `casdey-booking-${startAt.getTime()}@casdey.com`,
        start: startAt,
        end: endAt,
        summary: serviceName
          ? `${serviceName} at ${gym.name}`
          : `Booking at ${gym.name}`,
        description: "Booked through casdey.",
      });

      await provider.send({
        to: member.email,
        subject: `You're booked in at ${gym.name}`,
        text: [
          `Hi ${member.first_name?.trim() || "there"},`,
          "",
          `You're booked in at ${gym.name} for ${whenText}${serviceName ? ` (${serviceName})` : ""}.`,
          "",
          "A calendar invite is attached to this email.",
          "",
          "Need to change or cancel? Use this link:",
          manageUrl,
          "",
          gym.name,
        ].join("\n"),
        fromName: identity.name,
        fromAddress: identity.address,
        replyTo: gym.reply_to_email,
        attachment: {
          filename: "booking.ics",
          content: Buffer.from(ics, "utf8").toString("base64"),
          contentType: "text/calendar",
        },
      });
    } catch (error) {
      console.error("[booking] member confirmation send failed", error);
    }
  }

  const gymInbox = gym.reply_to_email ?? gym.contact_email;
  if (gymInbox) {
    try {
      await provider.send({
        to: gymInbox,
        subject: `New booking: ${memberLabel(member)}`,
        text: [
          `${memberLabel(member)} booked ${whenText}${serviceName ? ` (${serviceName})` : ""} through casdey.`,
          "",
          "This was a returning member your list flagged as lapsed.",
        ].join("\n"),
        fromName: "casdey",
        replyTo: null,
      });
    } catch (error) {
      console.error("[booking] gym notice send failed", error);
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
