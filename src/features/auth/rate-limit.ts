/**
 * Limite simples de tentativas de login, em memória (por instância). Em ambiente
 * serverless é uma proteção parcial — suficiente para o MVP com um único ADM.
 * Para produção com mais tráfego, trocar por Upstash/Redis.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, now = Date.now()): boolean {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailure(key: string, now = Date.now()) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count++;
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
  }
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
