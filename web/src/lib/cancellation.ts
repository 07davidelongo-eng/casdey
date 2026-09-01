/**
 * Why a member left, and how to say it back to them naturally.
 *
 * Kept separate from lapse.ts on purpose: lapse math is about visit
 * recency, this is a fact staff record about one member. Mirrors the
 * check constraint on members.cancellation_reason (see
 * supabase/migrations/0013_cancellation_reason.sql) — when one changes,
 * change both.
 */

export const CANCELLATION_REASONS = [
  "price",
  "relocation",
  "dissatisfaction",
  "health",
  "no_time",
  "other",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export function isCancellationReason(
  value: unknown,
): value is CancellationReason {
  return (
    typeof value === "string" &&
    (CANCELLATION_REASONS as readonly string[]).includes(value)
  );
}

/** For the staff-facing reason picker. */
export const REASON_OPTIONS: { value: CancellationReason; label: string }[] = [
  { value: "price", label: "Price" },
  { value: "relocation", label: "Moved away" },
  { value: "dissatisfaction", label: "Not happy with the gym" },
  { value: "health", label: "Health or injury" },
  { value: "no_time", label: "No time to go" },
  { value: "other", label: "Something else" },
];

/**
 * For {{reason}} in a member-facing message: a short phrase that reads
 * naturally in a sentence, e.g. "since it was mostly about the price".
 * Deliberately gentle, this is read by the member who gave the reason.
 */
export const REASON_LABELS: Record<CancellationReason, string> = {
  price: "the price",
  relocation: "moving away",
  dissatisfaction: "not being happy with how things were",
  health: "a health or injury reason",
  no_time: "not having the time",
  other: "your own reasons",
};
