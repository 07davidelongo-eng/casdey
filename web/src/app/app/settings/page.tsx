import { requireGym } from "@/lib/dal";
import { countryName } from "@/lib/countries";
import { Notice } from "@/components/app/ui";
import { SettingsForm } from "./form";

export const metadata = { title: "Gym settings" };

export default async function GymSettingsPage() {
  const { gym, role } = await requireGym();

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the gym owner can change these. You can read them.
        </Notice>
      ) : null}

      <SettingsForm gym={gym} readOnly={role !== "owner"} />

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
