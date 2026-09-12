import { requireGym } from "@/lib/dal";
import { countryName } from "@/lib/countries";
import { hasChosenLapseRule, ruleFor } from "@/lib/lapse";
import { lapsePreview } from "@/lib/lapse-preview";
import { Notice } from "@/components/app/ui";
import { SettingsForm } from "./form";

export const metadata = { title: "Gym settings" };

export default async function GymSettingsPage() {
  const { gym, role, session } = await requireGym();

  // What each window catches, in this gym's own members. Skipped entirely
  // when the list is empty: a table of five zeroes teaches nothing, and the
  // checklist is already sending them to import first.
  const { count: memberCount } = await session.supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gym.id)
    .eq("is_test", false);

  const preview =
    (memberCount ?? 0) > 0
      ? await lapsePreview(session.supabase, gym.id, ruleFor(gym))
      : null;

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the gym owner can change these. You can read them.
        </Notice>
      ) : null}

      {/* Not keyed. Keying it here re-mounted the form on every save that
          changed anything, which threw away the action's own result along with
          it, so the gym pressed Save and saw nothing at all. The form syncs
          itself to new props instead: see syncToGym in form.tsx. */}
      <SettingsForm
        gym={gym}
        readOnly={role !== "owner"}
        ruleChosen={hasChosenLapseRule(gym)}
        preview={preview}
      />

      <p className="text-[0.875rem] text-stone">
        Registered in{" "}
        <span className="literal text-graphite">
          {countryName(gym.country)}
        </span>
        . Country sets your billing currency and cannot be changed here, because
        it would change what you are charged. Email{" "}
        <span className="literal">info@casdey.com</span> and we will move it.
      </p>
    </div>
  );
}
