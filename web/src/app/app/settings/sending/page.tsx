import { requireGym } from "@/lib/dal";
import { Notice } from "@/components/app/ui";
import { SendingSettingsForm } from "./form";

export const metadata = { title: "Sending" };

export default async function SendingSettingsPage() {
  const { gym, role } = await requireGym();

  // Read here rather than in the client component: the shared fallback address
  // is server config, and the page only needs to show it, not depend on it.
  const sharedFrom =
    process.env.CASDEY_SENDING_ADDRESS ?? "no-reply@mail.casdey.com";

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the gym owner can change these. You can read them.
        </Notice>
      ) : null}

      <SendingSettingsForm
        gym={gym}
        readOnly={role !== "owner"}
        sharedFrom={sharedFrom}
      />
    </div>
  );
}
