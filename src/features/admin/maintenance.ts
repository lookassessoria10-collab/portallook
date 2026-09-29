import "server-only";
import { UserFacingError, NotFoundError, logError } from "@/lib/errors";
import { logEvent } from "@/features/events/service";
import { upsertImportEntry } from "@/features/reports/index-entry";
import { reindexClient } from "@/features/reports/service";
import { importIndexEntry } from "@/features/uploads/service";
import { getRepositories } from "@/server/repositories";

/**
 * Reconstrói o índice do cliente (relatórios a partir dos manifests, uploads a
 * partir dos registros) e remove temporários de uploads já concluídos.
 */
export async function repairClientIndex(clientId: string): Promise<{ reports: number; imports: number }> {
  const repos = getRepositories();
  const reports = await reindexClient(clientId);
  const index = await repos.reports.getIndex(clientId);
  let imports = 0;
  for (const entry of index.imports) {
    const record = await repos.imports.get(entry.id);
    if (!record) continue;
    if (record.status === "imported" || record.status === "discarded") {
      await repos.imports.deleteFiles([record.stagingPath, ...(record.parsedPath ? [record.parsedPath] : [])]).catch((e) => logError("repair:cleanup", e));
    }
    await repos.reports.updateIndex(clientId, (i) => upsertImportEntry(i, importIndexEntry(record), new Date().toISOString()));
    imports++;
  }
  return { reports, imports };
}

/**
 * Exclusão DEFINITIVA de um cliente: relatórios, arquivos originais, logo, link
 * e uploads. Exige digitar o endereço (slug) do cliente como confirmação.
 */
export async function deleteClient(clientId: string, confirmation: string, actor: string | null): Promise<{ name: string; files: number }> {
  const repos = getRepositories();
  const client = await repos.clients.get(clientId);
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  if (confirmation.trim().toLowerCase() !== client.slug) {
    throw new UserFacingError(`Para confirmar, digite exatamente o endereço do cliente: ${client.slug}`);
  }
  const index = await repos.reports.getIndex(clientId);
  let files = 0;
  for (const i of index.imports) files += await repos.imports.deleteImport(i.id).catch(() => 0);
  files += await repos.clients.delete(clientId);
  await logEvent("client.deleted", { actor, summary: `Cliente ${client.name} (/${client.slug}) excluído definitivamente.`, meta: { clientId, files } });
  return { name: client.name, files };
}
