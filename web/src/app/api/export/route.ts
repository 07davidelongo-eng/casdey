import { requireGym } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { isLapsed, monthsSince, ruleFor } from "@/lib/lapse";
import type { Member } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The gym's own data, back in their hands.
 *
 * Portability is a GDPR right, and the gym is the controller here, so this
 * is not a favour. It returns everything casdey holds about their members in
 * the format they gave it to us in, plus what casdey worked out.
 *
 * The download is logged. A full export of member data leaving the system is
 * exactly the event an audit trail exists to record.
 */

const COLUMNS = [
  "member_reference",
  "first_name",
  "last_name",
  "email",
  "phone",
  "last_visit",
  "visit_count",
  "months_away",
  "lapsed",
  "status",
  "contacted_at",
  "returned_at",
];

/** RFC 4180: quote everything, double any internal quote. Never guess. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET(): Promise<Response> {
  const { gym, session } = await requireGym();

  const { data, error } = await supabaseAdmin()
    .from("members")
    .select("*")
    .eq("gym_id", gym.id)
    .eq("is_test", false)
    .order("last_visit_at", { ascending: true });

  if (error) {
    console.error("[export] failed", error.message);
    return new Response("Export failed", { status: 503 });
  }

  const members = (data ?? []) as Member[];
  const rule = ruleFor(gym);

  const lines = [COLUMNS.join(",")];
  for (const member of members) {
    lines.push(
      [
        member.external_ref,
        member.first_name,
        member.last_name,
        member.email,
        member.phone,
        member.last_visit_at,
        member.visit_count,
        monthsSince(member.last_visit_at),
        isLapsed(member, rule) ? "yes" : "no",
        member.status,
        member.contacted_at,
        member.returned_at,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "members.exported",
    meta: { rows: members.length },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  // The BOM is what stops Excel mangling accented names in a UTF-8 CSV.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casdey-members-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
