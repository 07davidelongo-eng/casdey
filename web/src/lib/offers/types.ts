/**
 * The win-back offer builder.
 *
 * casdey sells recovered revenue, and on Pro it refunds itself when that
 * revenue does not appear. But a win-back message only works if there is
 * something worth coming back FOR, and until now casdey wrote the wording and
 * left the offer itself entirely to the gym. A gym that sends "we miss you,
 * come back" recovers nobody, concludes casdey does not work, and on Pro that
 * failure is casdey's to pay for.
 *
 * So this is not a content feature bolted on the side. It is the part that
 * decides whether the product works, and it protects the guarantee's own
 * economics.
 *
 * The offers are a curated library rather than something an LLM improvises per
 * gym (see SAAS_V1_PLAN.md H2): no standing per-use cost, output casdey can
 * vouch for on a page that drives a refundable guarantee, and offers that can
 * later be reordered by which ones actually recovered members — which an
 * improvised offer can never tell us.
 */

/** What kind of place this is. Different rooms, different economics. */
export type GymType =
  | "crossfit_box"
  | "general_gym"
  | "boutique_studio"
  | "pt_studio";

/**
 * Why members tend to leave. The gym answers this from what it hears at the
 * front desk, and `members.cancellation_reason` may already know.
 */
export type LapseReason =
  | "price"
  | "time"
  | "motivation"
  | "intimidation"
  | "injury"
  | "moved"
  | "unknown";

/**
 * What the gym can actually afford to give. This is the constraint that decides
 * everything: a free class at an empty hour costs a gym almost nothing, while a
 * discounted membership costs real margin every month it runs.
 */
export type OfferBudget =
  | "capacity_only" // Free spots at quiet times. Costs almost nothing.
  | "small_giveaway" // A session or two, a assessment, some kit.
  | "real_discount"; // Money off the membership. Costs margin.

export type OfferInputs = {
  gymType: GymType;
  reason: LapseReason;
  budget: OfferBudget;
  /** Whether there are genuinely quiet hours to fill. */
  hasOffPeakCapacity: boolean;
  /** How long the offer stays open. An offer with no end is not an offer. */
  deadlineDays: number;
};

export type Offer = {
  id: string;
  /** What the gym sees when choosing. */
  name: string;
  /**
   * The offer as a member reads it, with {{deadline}} left for the sender to
   * fill so the date is always real rather than a number of days.
   */
  memberFacing: string;
  /** Why this one works, in plain terms, so the gym can disagree with it. */
  rationale: string;
  /**
   * Whether this offer expires. Almost all do, because an offer with no end is
   * not an offer. The honest check-in deliberately does not: it asks a question
   * rather than making a promise, and a deadline on a question is a sales
   * tactic pretending to be a conversation.
   */
  dated: boolean;
  /** What it actually costs the gym to honour. */
  cost: string;
  /** Which situations this is written for. */
  fits: {
    gymTypes: GymType[];
    reasons: LapseReason[];
    budgets: OfferBudget[];
    needsOffPeak?: boolean;
  };
};
