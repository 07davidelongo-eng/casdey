/**
 * The shape every member source produces.
 *
 * There are two sources planned: a CSV export, which every gym can produce
 * from any software, and a direct Mindbody sync. They agree on this type so
 * that lapse detection, campaigns and the dashboard never learn where a
 * member came from. Adding Glofox, ABC Fitness or another platform later means
 * writing one more adapter, not touching anything downstream.
 */

export type RawMember = {
  /** The gym's own id for this member, when their export carries one. */
  externalRef: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** ISO date, YYYY-MM-DD. Never a locale string by this point. */
  lastVisitAt: string;
  visitCount: number;
};

/** Which column in the gym's file holds which field. */
export type ColumnMapping = {
  externalRef?: string;
  firstName?: string;
  lastName?: string;
  /** Some exports carry one "Member" column instead of two name columns. */
  fullName?: string;
  email?: string;
  phone?: string;
  lastVisitAt: string;
  visitCount?: string;
};

/**
 * Asked for explicitly rather than guessed.
 *
 * 03/04/2024 is the 3rd of April in the UK and the 4th of March in the US, and
 * both parse without error. Guessing wrong shifts a member's last visit by up
 * to eleven months, which silently moves them in or out of every campaign. The
 * gym picks, and the preview shows them the result before anything is
 * written.
 */
export type DateFormat = "iso" | "dmy" | "mdy";

export type RowIssue = {
  row: number;
  field: string;
  reason: string;
};

export type ParseResult =
  | { ok: true; member: RawMember }
  | { ok: false; issue: RowIssue };

export type SourceId = "csv" | "mindbody";

/**
 * A member source. `fetchMembers` yields in batches so a large list never has
 * to sit in memory in full.
 */
export type MemberSource = {
  id: SourceId;
  label: string;
  /** False when the integration exists but has no credentials on this install. */
  isConfigured(): boolean;
};
