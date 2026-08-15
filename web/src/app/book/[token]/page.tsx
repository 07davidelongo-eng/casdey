import { supabaseAdmin } from "@/lib/supabase";
import { practiceOpenSlots } from "@/lib/calendar/practice-slots";
import { practiceCurrency } from "@/lib/money";
import type { Practice } from "@/lib/types";
import { BookingForm, type DayGroup, type ServiceOption } from "./form";

import "@/styles/product.css";

export const metadata = {
  title: "Book an appointment",
  robots: { index: false, follow: false },
};

/**
 * Where the booking link in a patient's message goes.
 *
 * Public by design, same reasoning as /u/[token]: the person here is a
 * patient, not a casdey user, and the per-patient token is the only
 * credential they need. Slots are computed fresh on every load (never
 * cached), because the whole point is that they reflect the practice's real
 * diary at the moment someone is looking.
 */
export default async function BookPage(props: PageProps<"/book/[token]">) {
  const { token } = await props.params;

  const { data: patient } = await supabaseAdmin()
    .from("patients")
    .select("id, practice_id, first_name")
    .eq("booking_token", token)
    .maybeSingle();

  if (!patient) {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">This link is not valid</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          It may be out of date. If you would still like to book, reply to the
          message you received and we will help.
        </p>
      </Shell>
    );
  }

  const { data: practiceRow } = await supabaseAdmin()
    .from("practices")
    .select("*")
    .eq("id", patient.practice_id)
    .maybeSingle();

  const practice = practiceRow as Practice | null;

  if (!practice || !practice.booking_enabled) {
    return (
      <Shell>
        <h1 className="display text-[1.375rem]">Booking is not available</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          {practice?.name ?? "This practice"} is not taking online bookings
          right now. Reply to the message you received and we will find you a
          time.
        </p>
      </Shell>
    );
  }

  const [slots, { data: services }] = await Promise.all([
    practiceOpenSlots(practice),
    supabaseAdmin()
      .from("practice_services")
      .select("id, name, price_minor")
      .eq("practice_id", practice.id)
      .order("position", { ascending: true }),
  ]);

  const days = groupSlotsByDay(
    slots.map((s) => s.start),
    practice.timezone,
  );

  const serviceOptions: ServiceOption[] = (services ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    priceMinor: s.price_minor as number,
  }));

  return (
    <Shell wide>
      <p className="label mb-2 text-teal">{practice.name}</p>
      <h1 className="display text-[1.75rem]">Book your appointment</h1>
      <p className="mt-2 text-[0.9375rem] text-graphite">
        Pick a time that works for you. It is confirmed the moment you choose
        it, no waiting to hear back.
      </p>

      {days.length === 0 ? (
        <p className="notice notice-warn mt-6">
          Nothing is open right now. Reply to the message you received and we
          will find you a time by hand.
        </p>
      ) : (
        <div className="mt-8">
          <BookingForm
            token={token}
            days={days}
            services={serviceOptions}
            currency={practiceCurrency(practice)}
            timezone={practice.timezone}
          />
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-1 items-start justify-center px-5 py-14">
      <div className={`w-full ${wide ? "max-w-[40rem]" : "max-w-[30rem]"} card p-7`}>
        {children}
      </div>
    </div>
  );
}

/** Groups slot start times into day buckets, labelled in the practice's own
 *  timezone so "today"/"tomorrow" and the date shown always match what the
 *  patient's clock will say when the appointment arrives. */
function groupSlotsByDay(starts: Date[], timeZone: string): DayGroup[] {
  const dayFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone }); // yyyy-mm-dd
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });

  const byKey = new Map<string, DayGroup>();
  for (const start of starts) {
    const key = keyFmt.format(start);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dayFmt.format(start), slots: [] };
      byKey.set(key, group);
    }
    group.slots.push({ iso: start.toISOString(), timeLabel: timeFmt.format(start) });
  }
  return Array.from(byKey.values());
}
