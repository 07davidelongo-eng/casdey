import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST only, on purpose. A GET sign-out can be triggered by any image tag or
 * link prefetch on any site, which logs people out at random.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();

  // 303 so the browser follows with GET rather than repeating the POST.
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
