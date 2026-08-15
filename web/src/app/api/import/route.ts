import type { NextRequest } from "next/server";
import Papa from "papaparse";
import { z } from "zod";

import { requireActivePractice } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { normalizeRow } from "@/lib/ingestion/csv";
import { recordImportEvents, upsertPatients } from "@/lib/ingestion/upsert";
import type {
  ColumnMapping,
  DateFormat,
  RawPatient,
  RowIssue,
} from "@/lib/ingestion/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Takes a practice's patient export and turns it into patient rows.
 *
 * The browser has already parsed the header locally to build the mapping UI,
 * but the file is parsed again here and the mapping re-applied server-side.
 * Nothing the client computed is trusted: it chooses which column means what,
 * it does not get to decide what ends up in the table.
 *
 * This is the single most sensitive endpoint in the app. Everything it writes
 * is health-adjacent personal data belonging to the practice, not to casdey.
 */

// Comfortably larger than a full patient list from a single practice, small
// enough that a mistaken upload cannot exhaust the function's memory.
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_ROWS = 100_000;
/** Enough for the practice to see the pattern, not a second copy of the file. */
const MAX_REPORTED_ISSUES = 50;

const MappingSchema = z.object({
  externalRef: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  lastVisitAt: z.string().min(1),
  visitCount: z.string().optional(),
});

const DATE_FORMATS: DateFormat[] = ["iso", "dmy", "mdy"];

function fail(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const { practice, session } = await requireActivePractice();

  // The practice has to confirm it is the controller and has a lawful basis
  // before any patient data is accepted. This is not a formality: casdey is the
  // processor, and processing without that confirmation is the practice's
  // liability and ours.
  if (!practice.processing_agreed_at) {
    return fail(
      "Confirm the data protection terms before importing patients.",
      403,
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Malformed request.", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file was uploaded.", 400);
  if (file.size === 0) return fail("That file is empty.", 400);
  if (file.size > MAX_BYTES) {
    return fail(
      "That file is larger than 12 MB. Split it, or email us and we will handle it.",
      413,
    );
  }

  let mapping: ColumnMapping;
  try {
    mapping = MappingSchema.parse(
      JSON.parse(String(form.get("mapping") ?? "{}")),
    ) as ColumnMapping;
  } catch {
    return fail("Tell us which column holds the last visit date.", 400);
  }

  const rawFormat = String(form.get("dateFormat") ?? "");
  const dateFormat = DATE_FORMATS.includes(rawFormat as DateFormat)
    ? (rawFormat as DateFormat)
    : null;
  if (!dateFormat) return fail("Choose the date format used in your file.", 400);

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const rows = parsed.data;
  if (rows.length === 0) {
    return fail("We could not read any rows out of that file.", 400);
  }
  if (rows.length > MAX_ROWS) {
    return fail(`That file has more than ${MAX_ROWS} rows.`, 413);
  }

  const patients: RawPatient[] = [];
  const issues: RowIssue[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    // +2: one for the header line, one because people count from 1.
    const result = normalizeRow(row, mapping, dateFormat, index + 2, practice.country);
    if (result.ok) {
      patients.push(result.patient);
    } else {
      skipped += 1;
      if (issues.length < MAX_REPORTED_ISSUES) issues.push(result.issue);
    }
  });

  if (patients.length === 0) {
    return Response.json(
      {
        ok: false,
        error:
          "No rows could be read. Check the column mapping and the date format.",
        issues,
      },
      { status: 400 },
    );
  }

  const client = supabaseAdmin();

  const { data: run, error: runError } = await client
    .from("imports")
    .insert({
      practice_id: practice.id,
      created_by: session.userId,
      source: "csv",
      // A filename can carry a patient's name. Kept short and never displayed
      // outside the practice's own import history.
      filename: file.name.slice(0, 200),
      row_count: rows.length,
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error("[import] could not open run", runError?.message);
    return fail("We could not start the import. Try again.", 503);
  }

  const result = await upsertPatients(patients, {
    practiceId: practice.id,
    importId: run.id as string,
    source: "csv",
  });

  await recordImportEvents(practice.id, run.id as string, result.newPatientIds);

  await client
    .from("imports")
    .update({
      status: result.failed > 0 && result.imported + result.updated === 0
        ? "failed"
        : "completed",
      imported_count: result.imported,
      updated_count: result.updated,
      skipped_count: skipped + result.failed,
      report: { issues },
    })
    .eq("id", run.id);

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "patients.imported",
    target: run.id as string,
    meta: {
      rows: rows.length,
      imported: result.imported,
      updated: result.updated,
      skipped: skipped + result.failed,
    },
  });

  return Response.json({
    ok: true,
    imported: result.imported,
    updated: result.updated,
    skipped: skipped + result.failed,
    total: rows.length,
    issues,
  });
}
