import "server-only";

/**
 * Rotas de upload recebem requisições do próprio painel: exige Origin igual ao
 * host (defesa extra contra CSRF, além do cookie SameSite=Lax).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
