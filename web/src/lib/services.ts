import type { Service } from "./types";

/**
 * What a gym sells, and how it is charged.
 *
 * A price with no billing period is not a price. "€89" means one thing against
 * a monthly membership and something completely different against a 10-class
 * pack, and casdey used to store both as a bare number, which makes any
 * revenue figure built on them meaningless the moment a gym sells both.
 */

export const BILLING_PERIODS = [
  "one_off",
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "biannual",
  "annual",
] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return (
    typeof value === "string" &&
    (BILLING_PERIODS as readonly string[]).includes(value)
  );
}

export const BILLING_PERIOD_OPTIONS: {
  value: BillingPeriod;
  label: string;
  /** How the price reads next to it, e.g. "€89 a month". */
  suffix: string;
}[] = [
  { value: "one_off", label: "One off", suffix: "" },
  { value: "weekly", label: "Every week", suffix: "a week" },
  { value: "fortnightly", label: "Every two weeks", suffix: "every 2 weeks" },
  { value: "monthly", label: "Every month", suffix: "a month" },
  { value: "quarterly", label: "Every three months", suffix: "a quarter" },
  { value: "biannual", label: "Every six months", suffix: "every 6 months" },
  { value: "annual", label: "Every year", suffix: "a year" },
];

export function periodSuffix(period: BillingPeriod): string {
  return (
    BILLING_PERIOD_OPTIONS.find((o) => o.value === period)?.suffix ?? ""
  );
}

/** The singular unit, for saying "every 5 months" rather than "every 5 monthly". */
const PERIOD_UNIT: Record<BillingPeriod, string> = {
  one_off: "",
  weekly: "week",
  fortnightly: "2 weeks",
  monthly: "month",
  quarterly: "quarter",
  biannual: "6 months",
  annual: "year",
};

/**
 * How this price reads to a person, at whatever rhythm it is actually charged.
 *
 * Interval 1 keeps the phrasing a gym would use out loud ("a month"), because
 * "every 1 month" is how software talks and not how anyone else does. Anything
 * above 1 says the number, which is the whole point of having it.
 */
export function periodLabel(
  period: BillingPeriod,
  interval: number = 1,
): string {
  if (period === "one_off") return "";
  if (interval <= 1) return periodSuffix(period);
  return `every ${interval} ${PERIOD_UNIT[period]}${
    PERIOD_UNIT[period].endsWith("s") ? "" : "s"
  }`;
}

export function isRecurring(period: BillingPeriod): boolean {
  return period !== "one_off";
}

/**
 * Roughly what one sale of this is worth over a year.
 *
 * Deliberately an annualised estimate and labelled as one wherever it is
 * shown. A recovered member on a €89 monthly membership is not worth €89, and
 * pretending otherwise understates the whole point of win-back; but nobody can
 * promise they stay twelve months either, so this is never used to pay a
 * guarantee. It exists to put the recurring half of recovered revenue in
 * proportion, and nothing more.
 */
const PER_YEAR: Record<BillingPeriod, number> = {
  one_off: 1,
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  biannual: 2,
  annual: 1,
};

export function annualisedMinor(service: {
  price_minor: number;
  billing_period: BillingPeriod;
  billing_interval?: number | null;
}): number {
  // Charged every 5 months means 12/5 times a year, not 12. Rounded, because a
  // fraction of a cent in an estimate that is already labelled an estimate is
  // false precision, and the figure feeds a display, never a refund.
  const interval = Math.max(1, service.billing_interval ?? 1);
  return Math.round(
    (service.price_minor * PER_YEAR[service.billing_period]) / interval,
  );
}

/**
 * The slot shape a service actually books at, falling back to the gym's own
 * default when the service says nothing. Null on a service means "whatever the
 * gym does normally", which is what most gyms want and all of them start with.
 */
export function slotShape(
  service: Pick<Service, "duration_minutes" | "buffer_minutes"> | null,
  gymDefaults: { slotMinutes: number; bufferMinutes: number },
): { slotMinutes: number; bufferMinutes: number } {
  return {
    slotMinutes: service?.duration_minutes ?? gymDefaults.slotMinutes,
    bufferMinutes: service?.buffer_minutes ?? gymDefaults.bufferMinutes,
  };
}

/**
 * A booking is exclusive when it takes the gym's diary on its own.
 *
 * One seat means one thing happening: a PT session blocks the room, and so
 * does a booking with no service attached, because casdey has no idea what it
 * is and the safe assumption is that it occupies somebody. More than one seat
 * is a class, and a class is supposed to have several people in it.
 */
export function isExclusive(service: Pick<Service, "capacity"> | null): boolean {
  return (service?.capacity ?? 1) <= 1;
}
