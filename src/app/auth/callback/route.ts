import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safe-url";
import { COMPLETE_REGISTRATION_COOKIE, CONVERSION_SIGNAL_MAX_AGE_SECONDS } from "@/lib/conversion-signals";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/dashboard");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const result = supabase ? await supabase.auth.exchangeCodeForSession(code) : null;
    if (result && !result.error) {
      const response = NextResponse.redirect(new URL(next, origin));
      /*
       * קישור האימות מהמייל הוא הדרך השנייה להשלים הרשמה. משתמש שנוצר בשעה
       * האחרונה נחשב הרשמה חדשה; כניסה רגילה בקישור לא תיספר.
       */
      const user = result.data.user;
      const createdAt = user?.created_at ? Date.parse(user.created_at) : 0;
      if (user && Date.now() - createdAt < 60 * 60 * 1000) {
        response.cookies.set(COMPLETE_REGISTRATION_COOKIE, user.id, {
          maxAge: CONVERSION_SIGNAL_MAX_AGE_SECONDS,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
      return response;
    }
  }
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("קישור ההתחברות אינו תקין או שפג תוקפו")}`, origin));
}
