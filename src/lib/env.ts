import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas uma única vez.
 * Nenhuma credencial possui valor padrão: sem configuração, as funções que
 * dependem dela falham com mensagem clara (ver `requireSecret`).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STORAGE_DRIVER: z.enum(["local", "vercel-blob"]).optional(),
  LOCAL_STORAGE_DIR: z.string().default(".data"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  PORTAL_TOKEN_SECRET: z.string().optional(),
  PUBLIC_BASE_URL: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  UPLOAD_MAX_MB: z.coerce.number().min(1).max(500).default(25),
  SERVER_UPLOAD_MAX_MB: z.coerce.number().min(0.5).max(4.5).default(4),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
});

export type ServerEnv = z.infer<typeof EnvSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Variáveis de ambiente inválidas: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export class MissingConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`Configuração ausente: defina ${variable} (veja .env.example).`);
    this.name = "MissingConfigError";
  }
}

export function requireSecret(name: "SESSION_SECRET" | "PORTAL_TOKEN_SECRET"): string {
  const value = env()[name];
  if (!value || value.length < 32) throw new MissingConfigError(name);
  return value;
}

export function storageDriver(): "local" | "vercel-blob" {
  const e = env();
  if (e.STORAGE_DRIVER) return e.STORAGE_DRIVER;
  return e.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "local";
}

export const isProduction = () => env().NODE_ENV === "production";
