import { requirePractice } from "@/lib/dal";
import { Notice } from "@/components/app/ui";
import { WhatsAppSettingsForm } from "./form";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppSettingsPage() {
  const { practice, role } = await requirePractice();

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the practice owner can change these. You can read them.
        </Notice>
      ) : null}

      <WhatsAppSettingsForm practice={practice} readOnly={role !== "owner"} />
    </div>
  );
}
