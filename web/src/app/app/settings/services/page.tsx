import { requirePractice } from "@/lib/dal";
import { Notice } from "@/components/app/ui";
import { practiceCurrency } from "@/lib/money";
import type { PracticeService } from "@/lib/types";
import { ServicesForm } from "./form";

export const metadata = { title: "Service prices" };

export default async function ServicesSettingsPage() {
  const { practice, session, role } = await requirePractice();

  const { data } = await session.supabase
    .from("practice_services")
    .select("*")
    .eq("practice_id", practice.id)
    .order("position", { ascending: true });

  const services = (data ?? []) as PracticeService[];

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the practice owner can change these. You can read them.
        </Notice>
      ) : null}

      <ServicesForm
        services={services}
        currency={practiceCurrency(practice)}
        readOnly={role !== "owner"}
      />
    </div>
  );
}
