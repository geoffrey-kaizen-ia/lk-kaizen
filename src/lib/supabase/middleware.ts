import { NextResponse, type NextRequest } from "next/server";

// Verifie la presence du cookie de session Supabase sans appeler supabase-js
// (incompatible Edge Runtime a cause de process.version).
// La verification reelle de la session se fait dans les server components via createClient().
function hasSession(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) =>
    c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );
}

export async function updateSession(request: NextRequest) {
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  const loggedIn = hasSession(request);

  if (!loggedIn && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (loggedIn && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/agents";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
