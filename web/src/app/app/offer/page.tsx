import { requireGym } from "@/lib/dal";
import { PageHeader } from "@/components/app/ui";
import { CANCELLATION_REASONS } from "@/lib/cancellation";
import { parseVariants } from "@/lib/offers/variants";
import { OfferBuilder } from "./builder";
import { OwnOfferForm } from "./own-offer-form";
import { OfferVariantsForm } from "./variants-form";

export const metadata = { title: "Your offer" };

export default async function OfferPage() {
  const { gym, session } = await requireGym();

  // How many members casdey actually holds a reason for, so the gym can see
  // whether an offer written for one is going to reach anybody.
  const counts = await Promise.all(
    CANCELLATION_REASONS.map(async (reason) => {
      const { count } = await session.supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gym.id)
        .eq("is_test", false)
        .eq("cancellation_reason", reason);
      return [reason, count ?? 0] as const;
    }),
  );

  return (
    <div className="max-w-[42rem] space-y-6">
      <PageHeader
        eyebrow="Offer"
        title="Give them a reason to come back"
        lede="This page builds the offer, and the offer is what decides whether anybody answers. casdey writes the message and sends it; what a member gets for walking back in has to come from you, because only you know what you can afford to give away. Answer five questions and casdey suggests offers that fit, or write your own."
      />

      <OfferBuilder
        current={{
          id: gym.offer_id,
          text: gym.offer_text,
          expiresAt: gym.offer_expires_at,
        }}
      />

      <OwnOfferForm />

      <OfferVariantsForm
        variants={parseVariants(gym.offer_variants)}
        reasonCounts={Object.fromEntries(counts)}
        hasDefault={Boolean(gym.offer_text)}
      />
    </div>
  );
}
