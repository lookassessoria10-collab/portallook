/**
 * Erro com mensagem pensada para o usuário final. Qualquer outro erro é tratado
 * como falha técnica: vai para o log e o usuário recebe uma mensagem genérica.
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly code: string = "user_error",
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class NotFoundError extends UserFacingError {
  constructor(message = "Registro não encontrado.") {
    super(message, "not_found");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends UserFacingError {
  constructor(message = "Este registro foi alterado por outra pessoa. Recarregue a página e tente novamente.") {
    super(message, "conflict");
    this.name = "ConflictError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function toUserMessage(error: unknown, fallback = "Algo deu errado. Tente novamente em instantes."): string {
  if (error instanceof UserFacingError) return error.message;
  return fallback;
}

/** Registra falhas técnicas sem vazar detalhes para a interface. */
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  if (error instanceof UserFacingError) return;
  console.error(`[portal-look] ${context}`, error instanceof Error ? { message: error.message, stack: error.stack } : error, extra ?? "");
}

export function actionError(error: unknown, context: string): { ok: false; error: string } {
  logError(context, error);
  return { ok: false, error: toUserMessage(error) };
}
