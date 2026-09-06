import { requireGym } from "@/lib/dal";
import { PageHeader } from "@/components/app/ui";
import { gymReasons } from "@/lib/reasons";
import { parseVariants } from "@/lib/offers/variants";
import { OfferBuilder } from "./builder";
import { OwnOfferForm } from "./own-offer-form";
import { OfferVariantsForm } from "./variants-form";
import { SavedOffers, type SavedOffer } from "./saved-offers";
import { ReasonsForm } from "./reasons-form";

export const metadata = { title: "Your offer" };

export default async function OfferPage() {
  const { gym, session } = await requireGym();

  // The gym's reasons, casdey's six plus its own (#33).
  const reasons = await gymReasons(gym.id);

  // How many members casdey actually holds a reason for, so the gym can see
  // whether an offer written for one is going to reach anybody.
  const counts = await Promise.all(
    reasons.map(async (reason) => {
      const { count } = await session.supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gym.id)
        .eq("is_test", false)
        .eq("cancellation_reason", reason.value);
      return [reason.value, count ?? 0] as const;
    }),
  );
  const reasonCounts = Object.fromEntries(counts);

  const { data: savedOffers } = await session.supabase
    .from("gym_offers")
    .select("id, name, body, expires_at, created_at")
    .eq("gym_id", gym.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-[42rem] space-y-6">
      <PageHeader
        eyebrow="Offer"
        title="Give them a reason to come back"
        lede="casdey writes the message and sends it. What a member gets for walking back in has to come from you, because only you know what you can afford to give away, and that is what this page is for. Answer five questions and casdey suggests offers that fit, or write your own. Keep as many as you like, switch between them, and write a different one for each reason members leave."
      />

      {/* Reasons before offers, because an offer written for a reason casdey
          does not know about can never reach anybody. */}
      <ReasonsForm
        custom={reasons
          .filter((reason) => !reason.builtIn)
          .map((reason) => ({
            key: reason.value,
            label: reason.label,
            phrase: reason.phrase,
          }))}
        counts={reasonCounts}
      />

      <OfferBuilder
        current={{
          id: gym.offer_id,
          text: gym.offer_text,
          expiresAt: gym.offer_expires_at,
        }}
      />

      <OwnOfferForm />

      <SavedOffers
        offers={(savedOffers ?? []) as SavedOffer[]}
        currentBody={gym.offer_text}
      />

      <OfferVariantsForm
        reasons={reasons}
        variants={parseVariants(gym.offer_variants)}
        reasonCounts={reasonCounts}
        hasDefault={Boolean(gym.offer_text)}
      />
    </div>
  );
}
