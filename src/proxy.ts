import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_SECONDS, attributionFromParams } from "@/lib/attribution";

/** מקור ההגעה (utm) נשמר בעוגייה, כדי שיירשם על המשתמש כשיירשם. */
function rememberAttribution(request: NextRequest, response: NextResponse) {
  if (request.method !== "GET") return response;
  const attribution = attributionFromParams(request.nextUrl.searchParams);
  if (!attribution) return response;
  response.cookies.set(ATTRIBUTION_COOKIE, JSON.stringify(attribution), {
    maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return rememberAttribution(request, NextResponse.next({ request }));
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return rememberAttribution(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
