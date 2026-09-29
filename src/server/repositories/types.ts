import type { Client, ClientAccess } from "@/features/clients/schema";
import type { PortalEvent } from "@/features/events/schema";
import type { ClientIndex, ReportManifest, ReportType } from "@/features/reports/schema";
import type { ImportRecord } from "@/features/uploads/schema";
import type { StoredStream } from "@/lib/storage/types";

/**
 * Contratos de persistência. As implementações atuais usam documentos JSON no
 * StorageProvider; uma futura implementação em PostgreSQL/Supabase só precisa
 * respeitar estas interfaces — serviços, páginas e componentes não mudam.
 */
export interface ClientRepository {
  list(): Promise<Client[]>;
  get(clientId: string): Promise<Client | null>;
  getBySlug(slug: string): Promise<Client | null>;
  create(client: Client): Promise<Client>;
  update(clientId: string, mutate: (current: Client) => Client): Promise<Client>;
  saveLogo(clientId: string, extension: string, body: Buffer, contentType: string): Promise<string>;
  /** Exclusão definitiva: remove todos os dados do cliente e libera o slug. */
  delete(clientId: string): Promise<number>;
  getFileStream(path: string): Promise<StoredStream | null>;
}

export interface AccessRepository {
  get(clientId: string): Promise<ClientAccess | null>;
  update(clientId: string, mutate: (current: ClientAccess | null) => ClientAccess): Promise<ClientAccess>;
}

export interface ReportRepository {
  getIndex(clientId: string): Promise<ClientIndex>;
  updateIndex(clientId: string, mutate: (current: ClientIndex) => ClientIndex): Promise<ClientIndex>;
  getManifest(clientId: string, type: ReportType, reportId: string): Promise<ReportManifest | null>;
  /** Grava o manifest e sincroniza a entrada correspondente no índice. */
  saveManifest(manifest: ReportManifest): Promise<ReportManifest>;
  getData(manifest: ReportManifest): Promise<unknown | null>;
  saveData(clientId: string, type: ReportType, reportId: string, data: unknown): Promise<string>;
  saveOriginal(clientId: string, type: ReportType, reportId: string, extension: string, source: { copyFrom: string; contentType: string } | { body: Buffer; contentType: string }): Promise<string>;
  getOriginalStream(manifest: ReportManifest): Promise<StoredStream | null>;
  /** Reconstrói o índice a partir dos manifests (recuperação após falhas). */
  rebuildIndex(clientId: string): Promise<ClientIndex>;
}

export interface ImportRepository {
  get(importId: string): Promise<ImportRecord | null>;
  save(record: ImportRecord): Promise<ImportRecord>;
  update(importId: string, mutate: (current: ImportRecord) => ImportRecord): Promise<ImportRecord>;
  putFile(path: string, body: Buffer, contentType: string): Promise<void>;
  getFile(path: string): Promise<Buffer | null>;
  getFileStream(path: string): Promise<StoredStream | null>;
  deleteFiles(paths: string[]): Promise<void>;
  /** Remove o registro e os arquivos temporários de uma importação. */
  deleteImport(importId: string): Promise<number>;
}

export interface EventRepository {
  append(event: PortalEvent): Promise<void>;
  listRecent(options?: { months?: number; clientId?: string; limit?: number }): Promise<PortalEvent[]>;
}

export interface Repositories {
  clients: ClientRepository;
  access: AccessRepository;
  reports: ReportRepository;
  imports: ImportRepository;
  events: EventRepository;
}
