import { supabaseAdmin } from "@/lib/supabase";
import { CancelForm } from "./form";

import "@/styles/product.css";

export const metadata = {
  title: "Manage your booking",
  robots: { index: false, follow: false },
};

type BookingRow = {
  id: string;
  start_at: string;
  status: string;
  gyms: { name: string; timezone: string } | { name: string; timezone: string }[] | null;
};

/**
 * Where the "change or cancel" link in a booking confirmation goes.
 *
 * A separate token namespace from /book/[token]: that one is the member's
 * standing link for booking a new time, this one is single-booking and
 * only ever sent in the confirmation for that booking. Public, same reasoning
 * as /u/[token] and /book/[token]: the token is the only credential a member
 * needs.
 */
export default async function ManageBookingPage(
  props: PageProps<"/book/[token]/manage">,
) {
  const { token } = await props.params;

  const { data } = await supabaseAdmin()
    .from("bookings")
    .select("id, start_at, status, gyms ( name, timezone )")
    .eq("booking_token", token)
    .maybeSingle();

  const booking = data as BookingRow | null;

  if (!booking) {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">This link is not valid</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          It may already have been used, or belong to an older booking.
        </p>
      </Shell>
    );
  }

  const gymField = booking.gyms;
  const gym = Array.isArray(gymField) ? gymField[0] : gymField;
  const gymName = gym?.name ?? "the gym";
  const when = gym
    ? formatWhen(new Date(booking.start_at), gym.timezone)
    : booking.start_at;

  if (booking.status === "cancelled") {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">Already cancelled</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          This booking with {gymName} has already been cancelled.
        </p>
      </Shell>
    );
  }

  if (booking.status !== "booked") {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">Nothing to change</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          This booking has already happened, so there is nothing left to
          cancel.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="display text-[1.375rem]">Your booking</h1>
      <p className="mt-3 text-[0.9375rem] text-graphite">
        {when} at {gymName}.
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
