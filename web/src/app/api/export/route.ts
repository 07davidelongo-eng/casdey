import { requirePractice } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { isDormant, monthsSince, ruleFor } from "@/lib/dormancy";
import type { Patient } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The practice's own data, back in their hands.
 *
 * Portability is a GDPR right, and the practice is the controller here, so this
 * is not a favour. It returns everything casdey holds about their patients in
 * the format they gave it to us in, plus what casdey worked out.
 *
 * The download is logged. A full export of patient data leaving the system is
 * exactly the event an audit trail exists to record.
 */

const COLUMNS = [
  "patient_reference",
  "first_name",
  "last_name",
  "email",
  "phone",
  "last_visit",
  "visit_count",
  "months_away",
  "dormant",
  "status",
  "contacted_at",
  "rebooked_at",
];

/** RFC 4180: quote everything, double any internal quote. Never guess. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET(): Promise<Response> {
  const { practice, session } = await requirePractice();

  const { data, error } = await supabaseAdmin()
    .from("patients")
    .select("*")
    .eq("practice_id", practice.id)
    .eq("is_test", false)
    .order("last_visit_at", { ascending: true });

  if (error) {
    console.error("[export] failed", error.message);
    return new Response("Export failed", { status: 503 });
  }

  const patients = (data ?? []) as Patient[];
  const rule = ruleFor(practice);

  const lines = [COLUMNS.join(",")];
  for (const patient of patients) {
    lines.push(
      [
        patient.external_ref,
        patient.first_name,
        patient.last_name,
        patient.email,
        patient.phone,
        patient.last_visit_at,
        patient.visit_count,
        monthsSince(patient.last_visit_at),
        isDormant(patient, rule) ? "yes" : "no",
        patient.status,
        patient.contacted_at,
        patient.reactivated_at,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "patients.exported",
    meta: { rows: patients.length },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  // The BOM is what stops Excel mangling accented names in a UTF-8 CSV.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casdey-patients-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
