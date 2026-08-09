import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Cron endpoints authenticate with CRON_SECRET themselves — cookie auth would
  // 307 them to /login and silently break push delivery + weekly reports.
  const { pathname } = request.nextUrl;
  if (pathname === '/api/push' || pathname === '/api/report' || pathname === '/api/risk') {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  // Fast path: validate the JWT locally (ES256 + cached JWKS — no network).
  // Fallback: full getUser() round-trip, which also refreshes expired sessions.
  let authed = false;
  try {
    const { data } = await (supabase.auth as any).getClaims();
    authed = !!data?.claims;
  } catch { /* older client or opaque token — fall through */ }
  if (!authed) {
    const { data: { user } } = await supabase.auth.getUser();
    authed = !!user;
  }

  const isLogin = request.nextUrl.pathname.startsWith('/login');
  if (!authed && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (authed && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)']
};
