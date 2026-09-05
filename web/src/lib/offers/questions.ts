import type { GymType, LapseReason, OfferBudget } from "./types";

/**
 * The questions, one screen at a time.
 *
 * Deliberately five, and deliberately answerable without looking anything up.
 * A gym owner filling this in is between classes: every extra question is a
 * chance to abandon halfway and go back to sending "we miss you, come back".
 *
 * Each one earns its place by changing the answer. Nothing here is collected
 * because it would be interesting to know.
 */

export type Choice<T> = {
  value: T;
  label: string;
  /** What picking this actually means, in the gym's own terms. */
  hint: string;
};

export const GYM_TYPES: Choice<GymType>[] = [
  {
    value: "crossfit_box",
    label: "CrossFit or community box",
    hint: "Coached classes, people know each other's names.",
  },
  {
    value: "general_gym",
    label: "General gym",
    hint: "Mostly open floor, members train on their own schedule.",
  },
  {
    value: "boutique_studio",
    label: "Boutique studio",
    hint: "One discipline done well. Reformer, spin, yoga, boxing.",
  },
  {
    value: "pt_studio",
    label: "Personal training studio",
    hint: "One to one or very small groups, booked with a specific coach.",
  },
];

export const REASONS: Choice<LapseReason>[] = [
  {
    value: "price",
    label: "It cost too much",
    hint: "They said so, or they left when a price changed.",
  },
  {
    value: "time",
    label: "The times stopped working",
    hint: "New job, new baby, new commute. The gym was fine, the timetable was not.",
  },
  {
    value: "motivation",
    label: "They lost the habit",
    hint: "Missed a week, then a month, then it felt too late to walk back in.",
  },
  {
    value: "intimidation",
    label: "They felt out of their depth",
    hint: "Too advanced, too fit, too much of a room full of people who knew what they were doing.",
  },
  {
    value: "injury",
    label: "Something was hurting",
    hint: "They stopped to recover and never found the moment to start again.",
  },
  {
    value: "moved",
    label: "They moved away",
    hint: "Worth knowing: no offer wins these back, and pretending otherwise wastes your money.",
  },
  {
    value: "unknown",
    label: "Honestly, we do not know",
    hint: "The most common answer, and not a problem. casdey can ask them.",
  },
];

export const BUDGETS: Choice<OfferBudget>[] = [
  {
    value: "capacity_only",
    label: "Empty spots, nothing that costs money",
    hint: "Free places in classes that are not full. Costs you almost nothing.",
  },
  {
    value: "small_giveaway",
    label: "A session or two of a coach's time",
    hint: "A one to one, an assessment, a free week. Costs hours, not margin.",
  },
  {
    value: "real_discount",
    label: "Real money off the membership",
    hint: "A comeback rate or a cheaper tier. Costs margin every month it runs.",
  },
];

/**
 * How long the offer stays open.
 *
 * Short enough to be a reason to act now, long enough that someone who reads it
 * on holiday can still use it. Two weeks is the default because a lapsed member
 * checks their email less often than an active one.
 */
export const DEADLINE_CHOICES: Choice<number>[] = [
  { value: 7, label: "One week", hint: "Urgent. Best for a small, warm list." },
  {
    value: 14,
    label: "Two weeks",
    hint: "The usual choice. Long enough to catch people who check email rarely.",
  },
  {
    value: 30,
    label: "A month",
    hint: "Gentle, but a month reads as no deadline at all to most people.",
  },
];

/** Whether there are genuinely quiet hours worth filling. */
export const OFF_PEAK_CHOICES: Choice<boolean>[] = [
  {
    value: true,
    label: "Yes, we have quiet hours",
    hint: "Sessions with spare places most weeks. This is the cheapest thing you can give away.",
  },
  {
    value: false,
    label: "No, we are close to full",
    hint: "Then casdey will not suggest filling classes you cannot fill.",
  },
];

export const QUESTION_COUNT = 5;
