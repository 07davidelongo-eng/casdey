import type { Offer } from "./types";

/**
 * The curated win-back offers.
 *
 * Written up front rather than accumulated from customers, so gym number one
 * gets the same quality as gym number one hundred. What customers will add
 * later is evidence: once these have run, casdey can see which actually
 * recovered members and reorder by that. The library does not depend on it.
 *
 * Three principles run through all of them:
 *
 *   1. **Remove the reason they left, do not just discount.** Someone who left
 *      because the 6am class terrified them is not persuaded by 20% off that
 *      same class. Price is the answer to a price objection and to almost
 *      nothing else.
 *   2. **Spend capacity before margin.** An empty spot at 2pm on a Tuesday
 *      costs a gym nothing to give and is worth the same to the member as one
 *      that costs the gym money.
 *   3. **Ask for a small yes.** A lapsed member will not re-sign a twelve-month
 *      membership from an email. They will book one session. The membership is
 *      the second conversation, in the room, with a coach.
 */
export const OFFERS: Offer[] = [
  {
    id: "free_week_no_card",
    name: "A free week back, no card needed",
    memberFacing:
      "Come back for a full week on us, no card and no commitment. Pick any classes you like between now and {{deadline}}.",
    dated: true,
    rationale:
      "The lowest-friction way back in. It asks for no money and no decision, which is the point: the decision that matters happens in the room, not in an inbox. Works best when nothing was actually wrong with the gym and life simply got in the way.",
    cost: "Spare capacity only, if you cap it to classes that are not full.",
    fits: {
      gymTypes: ["crossfit_box", "general_gym", "boutique_studio", "pt_studio"],
      reasons: ["time", "motivation", "unknown"],
      budgets: ["capacity_only", "small_giveaway", "real_discount"],
      needsOffPeak: true,
    },
  },
  {
    id: "comeback_rate",
    name: "A comeback rate for the first months",
    memberFacing:
      "Come back at half price for your first two months, then the normal rate. No joining fee, and you can stop whenever you like. Open until {{deadline}}.",
    dated: true,
    rationale:
      "The pattern every subscription business converges on, and the one your members already recognise from Spotify and Netflix. It works because the obstacle is rarely the monthly price itself, it is restarting a payment they once decided to stop. A discounted run-in makes restarting feel reversible, and by the time it ends the habit is doing the work instead of the discount. Make it deep enough to be worth acting on: a token ten percent reads as an insult to someone who already left.",
    cost: "Real margin, for a fixed and known number of months, on a member currently worth nothing at all.",
    fits: {
      gymTypes: ["general_gym", "crossfit_box", "boutique_studio", "pt_studio"],
      reasons: ["price", "time", "motivation", "unknown"],
      budgets: ["real_discount"],
    },
  },
  {
    id: "one_session_with_coach",
    name: "One session, one coach, no class",
    memberFacing:
      "Come in for a one-to-one session with one of our coaches, free, before {{deadline}}. No class, no crowd, just you and someone who will show you where to start again.",
    dated: true,
    rationale:
      "Written for the member who quietly stopped coming because they felt out of their depth. A class invitation asks them to be seen struggling in front of people; this removes the audience entirely, which is the actual barrier.",
    cost: "One coach hour per member who takes it.",
    fits: {
      gymTypes: ["crossfit_box", "boutique_studio", "pt_studio", "general_gym"],
      reasons: ["intimidation", "motivation"],
      budgets: ["small_giveaway", "real_discount"],
    },
  },
  {
    id: "off_peak_membership",
    name: "A cheaper off-peak membership",
    memberFacing:
      "We have a quieter, cheaper way to train with us: off-peak access at a lower monthly price. If the full membership stopped making sense, this might. Open until {{deadline}}.",
    dated: true,
    rationale:
      "For the member who left on price and is not coming back at the old one. Rather than discounting the full membership, which trains everyone to wait for a discount, this sells a genuinely different, cheaper product that happens to fill your dead hours.",
    cost: "Real margin, but at a price you set, on hours you were not selling anyway.",
    fits: {
      gymTypes: ["general_gym", "crossfit_box"],
      reasons: ["price", "time"],
      budgets: ["real_discount"],
      needsOffPeak: true,
    },
  },
  {
    id: "no_joining_fee_return",
    name: "Come back without paying to join again",
    memberFacing:
      "If you want to come back, you will not pay to join again. Your old membership picks up where it left off, any time before {{deadline}}.",
    dated: true,
    rationale:
      "Removes a barrier most lapsed members assume is there whether or not it is. Costs nothing if you were not going to charge them anyway, and turns a vague intention into a specific, dated permission.",
    cost: "Nothing, unless you genuinely charge returning members to rejoin.",
    fits: {
      gymTypes: ["general_gym", "crossfit_box", "boutique_studio"],
      reasons: ["price", "time", "unknown"],
      budgets: ["capacity_only", "small_giveaway", "real_discount"],
    },
  },
  {
    id: "bring_someone",
    name: "Come back, and bring someone",
    memberFacing:
      "Come back for a session and bring a friend, both free, before {{deadline}}. Easier than walking in on your own, and you get to show someone what you liked about it.",
    dated: true,
    rationale:
      "Community gyms lose people who lose their training partner, not their interest. This rebuilds the reason they came in the first place, and it costs one extra spot to maybe gain two members.",
    cost: "Two spare spots per member who takes it, and a real chance of a second member.",
    fits: {
      gymTypes: ["crossfit_box", "boutique_studio"],
      reasons: ["motivation", "intimidation", "unknown"],
      budgets: ["capacity_only", "small_giveaway", "real_discount"],
      needsOffPeak: true,
    },
  },
  {
    id: "return_after_injury",
    name: "A way back that works around the injury",
    memberFacing:
      "If something was hurting, we can work around it. Come in for a free session where a coach builds you something that avoids it, any time before {{deadline}}.",
    dated: true,
    rationale:
      "People who stop training through injury usually do not decide to quit, they just never find the moment to return, and they assume returning means going straight back to what hurt them. Naming the injury is what makes this credible.",
    cost: "One coach hour, and the coaching judgement to actually scale it.",
    fits: {
      gymTypes: ["crossfit_box", "pt_studio", "boutique_studio", "general_gym"],
      reasons: ["injury"],
      budgets: ["small_giveaway", "real_discount"],
    },
  },
  {
    id: "short_commitment_block",
    name: "A short block instead of a membership",
    memberFacing:
      "Not ready to commit again? Take a four-week block instead of a membership. It ends by itself, no cancelling, no rolling payment. Starts any time before {{deadline}}.",
    dated: true,
    rationale:
      "The obstacle is often the open-ended commitment rather than the money or the training. A block that ends on its own removes the fear of another subscription they have to remember to cancel, and four weeks is long enough for the habit to restart.",
    cost: "A lower price per week than a membership, on a customer you currently have at zero.",
    fits: {
      gymTypes: ["general_gym", "boutique_studio", "pt_studio", "crossfit_box"],
      reasons: ["price", "time", "motivation"],
      budgets: ["real_discount", "small_giveaway"],
    },
  },
  {
    id: "pick_your_time",
    name: "Tell us the hour that works",
    memberFacing:
      "If the timetable stopped fitting, tell us the hour that would work and we will tell you honestly whether we can make it work. Free session either way, before {{deadline}}.",
    dated: true,
    rationale:
      "For members who left over scheduling, which no discount solves. It also does something the others do not: it gets the member replying about their own constraint, which is a conversation rather than a coupon.",
    cost: "A session, plus the honesty to say no when the hour does not exist.",
    fits: {
      gymTypes: ["general_gym", "boutique_studio", "pt_studio", "crossfit_box"],
      reasons: ["time"],
      budgets: ["capacity_only", "small_giveaway", "real_discount"],
    },
  },
  {
    id: "progress_check",
    name: "A free check of where you are now",
    memberFacing:
      "Come in for a free assessment before {{deadline}} and see exactly where you are now. No session, no class, no pressure. Just numbers, and what to do about them.",
    dated: true,
    rationale:
      "Sells information rather than exercise, which is a much smaller ask of someone who has been away long enough to feel behind. It also gives a coach something concrete to build the next conversation on.",
    cost: "Twenty minutes of a coach's time.",
    fits: {
      gymTypes: ["general_gym", "pt_studio", "boutique_studio"],
      reasons: ["motivation", "unknown", "intimidation"],
      budgets: ["capacity_only", "small_giveaway", "real_discount"],
    },
  },
  {
    id: "honest_check_in",
    name: "No offer, just an honest question",
    memberFacing:
      "We noticed you have not been in for a while, and we would rather ask than guess: was it us, the timetable, or just life? Reply and tell us. If there is something we can do about it, we will.",
    dated: false,
    rationale:
      "Deliberately has no offer in it. For gyms with nothing to give away yet, and for lists where a discount would read as desperate. It recovers fewer members than a real offer, but it recovers the reason people left, which is worth more on the second campaign.",
    cost: "Nothing but the willingness to read the replies and act on them.",
    fits: {
      gymTypes: ["crossfit_box", "general_gym", "boutique_studio", "pt_studio"],
      reasons: ["unknown", "moved", "price", "time", "motivation", "intimidation", "injury"],
      budgets: ["capacity_only", "small_giveaway", "real_discount"],
    },
  },
];
