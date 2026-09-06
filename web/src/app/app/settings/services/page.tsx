import { requireGym } from "@/lib/dal";
import { Notice } from "@/components/app/ui";
import { gymCurrency } from "@/lib/money";
import type { Service } from "@/lib/types";
import { ServicesForm } from "./form";

export const metadata = { title: "Services" };

export default async function ServicesSettingsPage() {
  const { gym, session, role } = await requireGym();

  const { data } = await session.supabase
    .from("services")
    .select("*")
    .eq("gym_id", gym.id)
    .order("position", { ascending: true });

  const services = (data ?? []) as Service[];

  return (
    <div className="max-w-[46rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the gym owner can change these. You can read them.
        </Notice>
      ) : null}

      <ServicesForm
        services={services}
        currency={gymCurrency(gym)}
        readOnly={role !== "owner"}
        gymDefaults={{
          slotMinutes: gym.booking_slot_minutes,
          bufferMinutes: gym.booking_buffer_minutes,
        }}
      />
    </div>
  );
}
