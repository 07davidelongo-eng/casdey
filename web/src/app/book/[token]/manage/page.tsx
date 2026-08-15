import { supabaseAdmin } from "@/lib/supabase";
import { CancelForm } from "./form";

import "@/styles/product.css";

export const metadata = {
  title: "Manage your appointment",
  robots: { index: false, follow: false },
};

type AppointmentRow = {
  id: string;
  start_at: string;
  status: string;
  practices: { name: string; timezone: string } | { name: string; timezone: string }[] | null;
};

/**
 * Where the "change or cancel" link in a booking confirmation goes.
 *
 * A separate token namespace from /book/[token]: that one is the patient's
 * standing link for booking a new time, this one is single-appointment and
 * only ever sent in the confirmation for that booking. Public, same reasoning
 * as /u/[token] and /book/[token]: the token is the only credential a patient
 * needs.
 */
export default async function ManageBookingPage(
  props: PageProps<"/book/[token]/manage">,
) {
  const { token } = await props.params;

  const { data } = await supabaseAdmin()
    .from("appointments")
    .select("id, start_at, status, practices ( name, timezone )")
    .eq("booking_token", token)
    .maybeSingle();

  const appointment = data as AppointmentRow | null;

  if (!appointment) {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">This link is not valid</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          It may already have been used, or belong to an older appointment.
        </p>
      </Shell>
    );
  }

  const practiceField = appointment.practices;
  const practice = Array.isArray(practiceField) ? practiceField[0] : practiceField;
  const practiceName = practice?.name ?? "the practice";
  const when = practice
    ? formatWhen(new Date(appointment.start_at), practice.timezone)
    : appointment.start_at;

  if (appointment.status === "cancelled") {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">Already cancelled</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          This appointment with {practiceName} has already been cancelled.
        </p>
      </Shell>
    );
  }

  if (appointment.status !== "booked") {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">Nothing to change</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          This appointment has already happened, so there is nothing left to
          cancel.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="display text-[1.375rem]">Your appointment</h1>
      <p className="mt-3 text-[0.9375rem] text-graphite">
        {when} at {practiceName}.
      </p>
      <p className="mt-3 text-[0.9375rem] text-graphite">
        To change the time, use the booking link from your original message to
        pick a new one. You can cancel this one below.
      </p>
      <CancelForm token={token} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-5 py-14">
      <div className="w-full max-w-[30rem] card p-7">{children}</div>
    </div>
  );
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
