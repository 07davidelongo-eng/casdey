import "server-only";

import { supabaseAdmin } from "../supabase";
import type { RawPatient } from "./types";

/**
 * Writing parsed patients into the database.
 *
 * Uses the service-role client because this runs as a batch and needs to upsert
 * thousands of rows without a round trip per row. The practice id is pinned by
 * the caller from a verified session and is never read from the request body:
 * that is the only thing standing between this and a cross-tenant write, so it
 * does not move.
 *
 * Repeat imports update rather than duplicate. A practice re-exporting their
 * list every month is the normal case, not the exception.
 */

const BATCH_SIZE = 500;
/** Enough for the practice to see which records to fix, not a copy of the file. */
const MAX_FAILURES = 50;

/** One record the upsert could not write, with something the practice can act on. */
export type UpsertFailure = { ref: string; reason: string };

export type UpsertResult = {
  imported: number;
  updated: number;
  failed: number;
  /** Ids of patients created by this run, for the timeline. */
  newPatientIds: string[];
  /** Per-record reasons for any failures, so a bad row is diagnosable. */
  failures: UpsertFailure[];
};

type Row = {
  practice_id: string;
  import_id: string;
  external_ref: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  last_visit_at: string;
  visit_count: number;
  source: string;
};

function toRow(
  patient: RawPatient,
  practiceId: string,
  importId: string,
  source: string,
): Row {
  return {
    practice_id: practiceId,
    import_id: importId,
    external_ref: patient.externalRef,
    first_name: patient.firstName,
    last_name: patient.lastName,
    email: patient.email,
    phone: patient.phone,
    last_visit_at: patient.lastVisitAt,
    visit_count: patient.visitCount,
    source,
  };
}

/**
 * There are two ways a patient can already exist: by the practice's own
 * reference, or by email. Rows are split so each batch upserts against exactly
 * one conflict target, because Postgres takes one per statement.
 *
 * An upsert only writes the columns given here, so a patient's status,
 * contacted_at and reactivated_at survive a re-import untouched. Re-importing
 * must never resurrect somebody who unsubscribed.
 */
export async function upsertPatients(
  patients: RawPatient[],
  options: { practiceId: string; importId: string; source: string },
): Promise<UpsertResult> {
  const withRef = patients.filter((p) => p.externalRef);
  const withoutRef = patients.filter((p) => !p.externalRef && p.email);

  const result: UpsertResult = {
    imported: 0,
    updated: 0,
    failed: 0,
    newPatientIds: [],
    failures: [],
  };

  await run(withRef, "practice_id,external_ref", options, result);
  await run(withoutRef, "practice_id,email", options, result);

  return result;
}

/**
 * Collapses rows that share a conflict key so a single statement never tries to
 * touch the same target row twice (Postgres rejects the whole batch otherwise).
 * The last occurrence wins, matching the "re-import updates" contract: a later
 * row in the file is the more recent data.
 */
function dedupeByConflictKey(
  patients: RawPatient[],
  keyOf: (p: RawPatient) => string,
): RawPatient[] {
  const byKey = new Map<string, RawPatient>();
  for (const patient of patients) byKey.set(keyOf(patient), patient);
  return [...byKey.values()];
}

async function run(
  patients: RawPatient[],
  onConflict: string,
  options: { practiceId: string; importId: string; source: string },
  result: UpsertResult,
): Promise<void> {
  const client = supabaseAdmin();
  const keyOf: (p: RawPatient) => string = onConflict.endsWith("email")
    ? (p) => (p.email ?? "").toLowerCase()
    : (p) => p.externalRef ?? "";
  const deduped = dedupeByConflictKey(patients, keyOf);

  for (let start = 0; start < deduped.length; start += BATCH_SIZE) {
    const slice = deduped.slice(start, start + BATCH_SIZE);
    const rows = slice.map((patient) =>
      toRow(patient, options.practiceId, options.importId, options.source),
    );

    const { data, error } = await client
      .from("patients")
      .upsert(rows, { onConflict, ignoreDuplicates: false })
      .select("id, created_at, updated_at");

    if (error) {
      // A whole batch failing usually means one offending row (a row that
      // collides with the *other* unique index, e.g. an external-ref row whose
      // email already belongs to a different patient). Retry the slice one row
      // at a time so a single bad record can't drop the other 499, and record
      // which record failed and why instead of a silent aggregate.
      console.error("[import] batch failed, retrying row by row", error.code);
      await runRowByRow(client, slice, onConflict, options, result);
      continue;
    }

    // Postgres does not report insert-versus-update on a conflict. A row whose
    // updated_at still equals its created_at was created by this statement, and
    // the touch_updated_at trigger guarantees an updated row moves on.
    for (const row of data ?? []) {
      if (row.created_at === row.updated_at) {
        result.imported += 1;
        result.newPatientIds.push(row.id as string);
      } else {
        result.updated += 1;
      }
    }
  }
}

/** Fallback for a batch that errored: isolate each row so one can't sink many. */
async function runRowByRow(
  client: ReturnType<typeof supabaseAdmin>,
  slice: RawPatient[],
  onConflict: string,
  options: { practiceId: string; importId: string; source: string },
  result: UpsertResult,
): Promise<void> {
  for (const patient of slice) {
    const row = toRow(patient, options.practiceId, options.importId, options.source);
    const { data, error } = await client
      .from("patients")
      .upsert(row, { onConflict, ignoreDuplicates: false })
      .select("id, created_at, updated_at")
      .maybeSingle();

    if (error) {
      result.failed += 1;
      if (result.failures.length < MAX_FAILURES) {
        result.failures.push({
          ref: patient.externalRef ?? patient.email ?? "(no reference)",
          reason:
            error.code === "23505"
              ? "email already belongs to another patient in this practice"
              : error.message,
        });
      }
      continue;
    }

    if (data) {
      if (data.created_at === data.updated_at) {
        result.imported += 1;
        result.newPatientIds.push(data.id as string);
      } else {
        result.updated += 1;
      }
    }
  }
}

/**
 * Gives every newly created patient a starting point on their timeline.
 *
 * Only new ones: a practice re-uploading the same list every month would
 * otherwise stack an "imported" event on every patient every time, and the
 * timeline stops meaning anything.
 *
 * Best effort. An import that stored patients correctly must not be reported as
 * failed because its timeline rows did not write.
 */
export async function recordImportEvents(
  practiceId: string,
  importId: string,
  patientIds: string[],
): Promise<void> {
  if (patientIds.length === 0) return;
  const client = supabaseAdmin();

  for (let start = 0; start < patientIds.length; start += BATCH_SIZE) {
    const events = patientIds.slice(start, start + BATCH_SIZE).map((id) => ({
      practice_id: practiceId,
      patient_id: id,
      type: "imported",
      meta: { import_id: importId },
    }));

    const { error } = await client.from("patient_events").insert(events);
    if (error) {
      console.error("[import] events failed", error.message);
      return;
    }
  }
}
