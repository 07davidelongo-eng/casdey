import { requireGym } from "@/lib/dal";
import { PageHeader } from "@/components/app/ui";
import { OfferBuilder } from "./builder";

export const metadata = { title: "Your offer" };

export default async function OfferPage() {
  const { gym } = await requireGym();

  return (
    <div className="max-w-[42rem] space-y-6">
      <PageHeader
        eyebrow="Offer"
        title="Give them a reason to come back"
        lede="casdey writes the message. This is the part that decides whether anyone answers it: what they actually get for walking back in. Five questions, then some offers worth sending."
      />

      <OfferBuilder
        current={{
          id: gym.offer_id,
          text: gym.offer_text,
          expiresAt: gym.offer_expires_at,
        }}
      />
    </div>
  );
}
