import { requireGym } from "@/lib/dal";
import { capabilities } from "@/lib/plan";
import { Notice } from "@/components/app/ui";
import { WhatsAppSettingsForm } from "./form";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppSettingsPage() {
  const { gym, role } = await requireGym();
  const canUseWhatsApp = capabilities(gym).canUseWhatsApp;

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the gym owner can change these. You can read them.
        </Notice>
      ) : null}

      {!canUseWhatsApp ? (
        <Notice tone="warn">
          WhatsApp is on the Pro plan, and this gym is not on it. You can set
          this up now, but campaigns cannot go out over WhatsApp until you
          upgrade. Worth knowing before you start: getting a template approved
          happens at Meta, under your own WhatsApp Business account, and takes
          days rather than minutes.
        </Notice>
      ) : null}
      <WhatsAppSettingsForm gym={gym} readOnly={role !== "owner"} />
    </div>
  );
}
