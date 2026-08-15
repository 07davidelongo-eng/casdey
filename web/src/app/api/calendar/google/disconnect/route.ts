import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { revokeToken } from "@/lib/calendar/google";
import { decryptToken } from "@/lib/calendar/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Disconnects the practice's Google Calendar.
 *
 * POST, because it is a destructive change made from a form, same shape as the
 * other settings mutations. The refresh token is revoked at Google (best
 * effort) and the connection row is deleted, so no stale token lingers. Past
 * appointments keep their google_event_id as a record; casdey simply stops
 * being able to touch the calendar.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { practice, session } = await requireOwner();
  const origin = request.nextUrl.origin;

  const { data: connection } = await supabaseAdmin()
    .from("calendar_connections")
    .select("id, refresh_token_enc")
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (connection) {
    if (connection.refresh_token_enc) {
      try {
        await revokeToken(decryptToken(connection.refresh_token_enc));
      } catch {
        // Decrypt/revoke failures must not block the local disconnect.
      }
    }

    await supabaseAdmin()
      .from("calendar_connections")
      .delete()
      .eq("practice_id", practice.id);

    // Booking cannot run without a connected calendar, so turn it off too rather
    // than leave a booking link that would fail when a patient clicks it.
    await supabaseAdmin()
      .from("practices")
      .update({ booking_enabled: false })
      .eq("id", practice.id);

    await recordAudit({
      practiceId: practice.id,
      actorId: session.userId,
      actorEmail: session.email,
      action: "calendar.disconnected",
      meta: { provider: "google" },
    });
  }

  const back = new URL("/app/settings/booking", origin);
  back.searchParams.set("disconnected", "1");
  return NextResponse.redirect(back, 303);
}
