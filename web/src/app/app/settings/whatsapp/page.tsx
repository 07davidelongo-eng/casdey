import { requireGym } from "@/lib/dal";
import { Notice } from "@/components/app/ui";
import { WhatsAppSettingsForm } from "./form";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppSettingsPage() {
  const { gym, role } = await requireGym();

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the gym owner can change these. You can read them.
        </Notice>
      ) : null}

      <WhatsAppSettingsForm gym={gym} readOnly={role !== "owner"} />
    </div>
  );
}
