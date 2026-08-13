import { redirect } from "next/navigation";

import { getPracticeContext, requireSession } from "@/lib/dal";
import { OnboardingForm } from "./form";

export const metadata = { title: "Set up your practice" };

export default async function OnboardingPage() {
  const session = await requireSession();

  // Already set up. Nothing to do here.
  const context = await getPracticeContext();
  if (context) redirect("/app");

  return (
    <div className="mx-auto max-w-[34rem] py-4">
      <p className="label mb-2 text-teal">Step 1 of 2</p>
      <h1 className="display text-[2rem]">Set up your practice</h1>
      <p className="mt-2 mb-8 text-[0.9375rem] text-graphite">
        Four things, then your free week starts. You can change any of them
        later.
      </p>

      <OnboardingForm defaultEmail={session.email} />
    </div>
  );
}
