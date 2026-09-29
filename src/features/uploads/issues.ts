import type { ValidationIssue } from "@/features/reports/schema";

type Location = ValidationIssue["location"];

/**
 * Coleta de problemas da importação. ERRO impede importar; AVISO permite
 * continuar. Mensagens sempre em linguagem humana, com aba/linha/coluna.
 */
export class IssueCollector {
  readonly items: ValidationIssue[] = [];
  private seen = new Set<string>();

  error(code: string, message: string, location?: Location) {
    this.push({ level: "error", code, message, location });
  }

  warn(code: string, message: string, location?: Location) {
    this.push({ level: "warning", code, message, location });
  }

  private push(issue: ValidationIssue) {
    const key = `${issue.level}|${issue.message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    // Evita listas enormes: muitas linhas com o mesmo problema viram um resumo.
    const sameCode = this.items.filter((i) => i.code === issue.code && i.level === issue.level).length;
    if (sameCode === 8) {
      this.items.push({ level: issue.level, code: issue.code, message: "Há mais linhas com o mesmo problema. Corrija as indicadas acima e envie novamente." });
      return;
    }
    if (sameCode > 8) return;
    this.items.push(issue);
  }

  get errors() {
    return this.items.filter((i) => i.level === "error");
  }

  get warnings() {
    return this.items.filter((i) => i.level === "warning");
  }

  get hasErrors() {
    return this.items.some((i) => i.level === "error");
  }
}

export function lineRef(sheet: string, line?: number, column?: string): string {
  const parts = [`aba ${sheet}`];
  if (line) parts.push(`linha ${line}`);
  if (column) parts.push(`coluna "${column}"`);
  return parts.join(", ");
}
