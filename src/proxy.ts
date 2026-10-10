import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/utils/safe-next";

const PUBLIC_PATHS = new Set(["/", "/auth", "/auth/callback"]);

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  // Cheap cookie-based session check for redirects (auto-refreshes if the
  // token is expired). Verified claims are resolved once in the (app) layout;
  // RLS remains the real security boundary.
  const { data } = await supabase.auth.getSession();
  const isSignedIn = Boolean(data?.session);

  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!isSignedIn && !isPublic) {
    const params = new URLSearchParams({ mode: "login", next: pathname + search });
    return NextResponse.redirect(new URL(`/auth?${params}`, request.url));
  }

  if (isSignedIn && pathname === "/auth") {
    const target = safeNext(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(target === "/auth" ? "/dashboard" : target, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
