import { requireGym } from "@/lib/dal";
import { PageHeader } from "@/components/app/ui";
import { gymReasons } from "@/lib/reasons";
import { parseVariants } from "@/lib/offers/variants";
import { OfferBuilder } from "./builder";
import { OwnOfferForm } from "./own-offer-form";
import { SavedOffers, type SavedOffer } from "./saved-offers";
import { ReasonsAndOffers } from "./reasons-and-offers";

export const metadata = { title: "Your offer" };

export default async function OfferPage() {
  const { gym, session } = await requireGym();

  // Every reason this gym works with, casdey's original six included: they are
  // seeded as the gym's own rows on first read, so they can be renamed and
  // deleted like any other (#46). See src/lib/reasons.ts.
  const reasons = await gymReasons(gym.id);

  // How many members casdey actually holds each reason for, so the gym can see
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

  const offers = (savedOffers ?? []) as SavedOffer[];

  return (
    <div className="max-w-[46rem] space-y-6">
      <PageHeader
        eyebrow="Offer"
        title="Give them a reason to come back"
        lede="casdey writes the message and sends it. What a member gets for walking back in has to come from you, because only you know what you can afford to give away, and that is what this page is for. Answer five questions and casdey suggests offers that fit, or write your own. Keep as many as you like, switch between them, and give a different one to each reason members leave."
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
        offers={offers}
        currentBody={gym.offer_text}
        reasons={reasons.map((reason) => ({
          key: reason.value,
          label: reason.label,
        }))}
      />

      {/* Reasons and their offers are one section, not two. The reasons only
          exist so an offer can answer one of them, and having them in separate
          cards meant inventing a reason and writing its offer were two
          unrelated errands on the same page (#46). */}
      <ReasonsAndOffers
        reasons={reasons.map((reason) => ({
          key: reason.value,
          label: reason.label,
          phrase: reason.phrase,
        }))}
        variants={parseVariants(gym.offer_variants)}
        reasonCounts={reasonCounts}
        savedOffers={offers.map((offer) => ({
          id: offer.id,
          name: offer.name,
          body: offer.body,
        }))}
        hasDefault={Boolean(gym.offer_text)}
      />
    </div>
  );
}
