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

/**
 * The six casdey starts a gym off with (#46).
 *
 * Seed data now, not a fixed set. They are written into cancellation_reasons
 * the first time a gym looks at its reasons, and from then on the gym owns
 * them: rename, reword, delete. Keeping the keys identical to what 0013
 * enumerated is what makes that safe, because members recorded months ago
 * still point at the same rows.
 */
export type ResolvedReason = {
  value: string;
  label: string;
  /** How it reads inside {{reason}}, in a sentence, to the member who gave it. */
  phrase: string;
};

export const DEFAULT_REASONS: ResolvedReason[] = REASON_OPTIONS.map(
  (option) => ({
    value: option.value,
    label: option.label,
    phrase: REASON_LABELS[option.value],
  }),
);

/** What staff see. Falls back to the raw key rather than showing nothing. */
export function labelForReason(
  reasons: ResolvedReason[],
  key: string | null,
): string | null {
  if (!key) return null;
  return reasons.find((r) => r.value === key)?.label ?? key;
}

/**
 * What the member reads inside {{reason}}.
 *
 * Falls back to the gentle catch-all rather than to the raw key: a member must
 * never receive a sentence containing "since it was mostly about
 * shift_pattern". This is the path a deleted reason takes, so it is not an
 * edge case, it is the designed behaviour for one.
 */
export function phraseForReason(
  reasons: ResolvedReason[],
  key: string | null,
): string | null {
  if (!key) return null;
  return reasons.find((r) => r.value === key)?.phrase ?? REASON_LABELS.other;
}

/** Whether this key is one this gym can actually use. */
export function isKnownReason(
  reasons: ResolvedReason[],
  value: unknown,
): value is string {
  return typeof value === "string" && reasons.some((r) => r.value === value);
}

/** The shape the database will accept. Mirrors migration 0031. */
export const REASON_KEY_PATTERN = /^[a-z][a-z0-9_]{1,38}$/;

/**
 * A key from what the gym typed, so they never have to think about slugs.
 * "Childcare fell through" becomes "childcare_fell_through".
 */
export function reasonKeyFrom(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 39);
  return REASON_KEY_PATTERN.test(slug) ? slug : "";
}
