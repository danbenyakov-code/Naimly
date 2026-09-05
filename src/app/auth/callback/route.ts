import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safe-url";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/dashboard");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = supabase ? await supabase.auth.exchangeCodeForSession(code) : { error: new Error("not configured") };
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("קישור ההתחברות אינו תקין או שפג תוקפו")}`, origin));
}
