import type { NextRequest } from "next/server";
import Papa from "papaparse";
import { z } from "zod";

import { requireActiveGym } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { normalizeRow } from "@/lib/ingestion/csv";
import { recordImportEvents, upsertMembers } from "@/lib/ingestion/upsert";
import type {
  ColumnMapping,
  DateFormat,
  RawMember,
  RowIssue,
} from "@/lib/ingestion/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Takes a gym's member export and turns it into member rows.
 *
 * The browser has already parsed the header locally to build the mapping UI,
 * but the file is parsed again here and the mapping re-applied server-side.
 * Nothing the client computed is trusted: it chooses which column means what,
 * it does not get to decide what ends up in the table.
 *
 * This is the single most sensitive endpoint in the app. Everything it writes
 * is health-adjacent personal data belonging to the gym, not to casdey.
 */

// Comfortably larger than a full member list from a single gym, small
// enough that a mistaken upload cannot exhaust the function's memory.
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_ROWS = 100_000;
/** Enough for the gym to see the pattern, not a second copy of the file. */
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
  const { gym, session } = await requireActiveGym();

  // The gym has to confirm it is the controller and has a lawful basis
  // before any member data is accepted. This is not a formality: casdey is the
  // processor, and processing without that confirmation is the gym's
  // liability and ours.
  if (!gym.processing_agreed_at) {
    return fail(
      "Confirm the data protection terms before importing members.",
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

  // Decode explicitly rather than via file.text(), which assumes UTF-8 and
  // silently turns invalid bytes into replacement characters. An older PMS or an
  // Excel "CSV (MS-DOS)" export is Windows-1252, so a name like "François" would
  // otherwise import as "FranÃ§ois" and go out verbatim in a live campaign. Try
  // strict UTF-8 first (the common, correct case) and fall back to Windows-1252
  // only when the bytes are not valid UTF-8.
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  // Drop a UTF-8 BOM so it can't contaminate the first header name.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

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

  const members: RawMember[] = [];
  const issues: RowIssue[] = [];
  let skipped = 0;

  // Surface CSV syntax problems instead of trusting Papa's best-effort recovery.
  // A row with an unescaped quote or stray delimiter is emitted mis-aligned (a
  // phone number sliding into the email column); at least tell the gym the
  // file itself was malformed rather than importing corrupted rows quietly.
  for (const parseError of parsed.errors ?? []) {
    if (issues.length >= MAX_REPORTED_ISSUES) break;
    issues.push({
      row: typeof parseError.row === "number" ? parseError.row + 2 : 0,
      field: "format",
      reason: parseError.message,
    });
  }

  rows.forEach((row, index) => {
    // +2: one for the header line, one because people count from 1.
    const result = normalizeRow(row, mapping, dateFormat, index + 2, gym.country);
    if (result.ok) {
      members.push(result.member);
    } else {
      skipped += 1;
      if (issues.length < MAX_REPORTED_ISSUES) issues.push(result.issue);
    }
  });

  if (members.length === 0) {
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
      gym_id: gym.id,
      created_by: session.userId,
      source: "csv",
      // A filename can carry a member's name. Kept short and never displayed
      // outside the gym's own import history.
      filename: file.name.slice(0, 200),
      row_count: rows.length,
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error("[import] could not open run", runError?.message);
    return fail("We could not start the import. Try again.", 503);
  }

  const result = await upsertMembers(members, {
    gymId: gym.id,
    importId: run.id as string,
    source: "csv",
  });

  await recordImportEvents(gym.id, run.id as string, result.newMemberIds);

  // Records the row-by-row fallback could not write are real, actionable
  // failures (usually a shared email), not silent drops. Put them where the
  // gym already looks for problems.
  for (const failure of result.failures) {
    if (issues.length >= MAX_REPORTED_ISSUES) break;
    issues.push({
      row: 0,
      field: "record",
      reason: `${failure.ref}: ${failure.reason}`,
    });
  }

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
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "members.imported",
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
