import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/features/auth/session-token";

/**
 * Primeira barreira das rotas administrativas. Páginas e ações também chamam
 * `requireAdmin()` — o proxy sozinho nunca é tratado como autorização suficiente.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/c/")) {
    const res = NextResponse.next();
    // O token faz parte da URL: nunca enviar como Referer, nunca indexar, nunca cachear.
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const isLogin = pathname === "/adm/login";
  const isAdminArea = pathname === "/adm" || pathname.startsWith("/adm/") || pathname.startsWith("/api/adm/");
  if (!isAdminArea || isLogin) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (session) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/adm/login";
  url.search = pathname !== "/adm" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/adm/:path*", "/adm", "/api/adm/:path*", "/c/:path*"],
};
