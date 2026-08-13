/**
 * The shape every patient source produces.
 *
 * There are two sources planned: a CSV export, which every practice can produce
 * from any software, and a direct Dentally sync. They agree on this type so
 * that dormancy detection, campaigns and the dashboard never learn where a
 * patient came from. Adding SOE Exact, R4 or Carestream later means writing one
 * more adapter, not touching anything downstream.
 */

export type RawPatient = {
  /** The practice's own id for this patient, when their export carries one. */
  externalRef: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** ISO date, YYYY-MM-DD. Never a locale string by this point. */
  lastVisitAt: string;
  visitCount: number;
};

/** Which column in the practice's file holds which field. */
export type ColumnMapping = {
  externalRef?: string;
  firstName?: string;
  lastName?: string;
  /** Some exports carry one "Patient" column instead of two name columns. */
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
 * both parse without error. Guessing wrong shifts a patient's last visit by up
 * to eleven months, which silently moves them in or out of every campaign. The
 * practice picks, and the preview shows them the result before anything is
 * written.
 */
export type DateFormat = "iso" | "dmy" | "mdy";

export type RowIssue = {
  row: number;
  field: string;
  reason: string;
};

export type ParseResult =
  | { ok: true; patient: RawPatient }
  | { ok: false; issue: RowIssue };

export type SourceId = "csv" | "dentally";

/**
 * A patient source. `fetchPatients` yields in batches so a large list never has
 * to sit in memory in full.
 */
export type PatientSource = {
  id: SourceId;
  label: string;
  /** False when the integration exists but has no credentials on this install. */
  isConfigured(): boolean;
};
