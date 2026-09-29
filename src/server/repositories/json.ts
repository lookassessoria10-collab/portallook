import "server-only";
import { ClientAccessSchema, ClientSchema, type Client } from "@/features/clients/schema";
import { EventSchema, type PortalEvent } from "@/features/events/schema";
import { emptyIndex, toIndexEntry, upsertReportEntry } from "@/features/reports/index-entry";
import { ClientIndexSchema, ReportManifestSchema, type ReportManifest, type ReportType } from "@/features/reports/schema";
import { ImportRecordSchema, type ImportRecord } from "@/features/uploads/schema";
import { UserFacingError } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { readJSON, updateJSON, writeJSON } from "@/lib/storage/json";
import { paths } from "@/lib/storage/paths";
import { StorageAlreadyExistsError, type StorageProvider } from "@/lib/storage/types";
import { z } from "zod";
import type { AccessRepository, ClientRepository, EventRepository, ImportRepository, ReportRepository, Repositories } from "./types";

const SlugDocSchema = z.object({ clientId: z.string(), slug: z.string() });

const nowISO = () => new Date().toISOString();

class JsonClientRepository implements ClientRepository {
  constructor(private readonly storage: StorageProvider) {}

  async list(): Promise<Client[]> {
    const folders = await this.storage.listFolders(paths.clientsPrefix());
    const ids = folders.map((f) => f.replace(/^clients\//, "").replace(/\/$/, "")).filter((id) => isValidId(id, "cl"));
    const clients = await Promise.all(ids.map((id) => this.get(id)));
    return clients.filter((c): c is Client => c !== null).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async get(clientId: string): Promise<Client | null> {
    if (!isValidId(clientId, "cl")) return null;
    const doc = await readJSON(this.storage, paths.client(clientId), ClientSchema);
    return doc?.data ?? null;
  }

  async getBySlug(slug: string): Promise<Client | null> {
    let slugPath: string;
    try {
      slugPath = paths.slug(slug);
    } catch {
      return null;
    }
    const doc = await readJSON(this.storage, slugPath, SlugDocSchema);
    if (!doc) return null;
    const client = await this.get(doc.data.clientId);
    return client && client.slug === slug ? client : null;
  }

  private async reserveSlug(slug: string, clientId: string) {
    try {
      await writeJSON(this.storage, paths.slug(slug), { clientId, slug }, { ifNotExists: true });
    } catch (e) {
      if (e instanceof StorageAlreadyExistsError) throw new UserFacingError(`O endereço "${slug}" já está em uso por outro cliente.`, "slug_taken");
      throw e;
    }
  }

  async create(client: Client): Promise<Client> {
    const valid = ClientSchema.parse(client);
    await this.reserveSlug(valid.slug, valid.id);
    try {
      await writeJSON(this.storage, paths.client(valid.id), valid, { ifNotExists: true });
    } catch (e) {
      await this.storage.delete(paths.slug(valid.slug)).catch(() => undefined);
      throw e;
    }
    return valid;
  }

  async update(clientId: string, mutate: (current: Client) => Client): Promise<Client> {
    const before = await this.get(clientId);
    if (!before) throw new UserFacingError("Cliente não encontrado.", "not_found");
    let reservedSlug: string | null = null;
    try {
      const next = await updateJSON(this.storage, paths.client(clientId), ClientSchema, (current) => {
        if (!current) throw new UserFacingError("Cliente não encontrado.", "not_found");
        return { ...mutate(current), id: current.id, createdAt: current.createdAt, updatedAt: nowISO(), version: current.version + 1 };
      });
      // Reserva o novo slug depois de validar; em conflito, desfaz a alteração.
      if (next.slug !== before.slug) {
        try {
          await this.reserveSlug(next.slug, clientId);
          reservedSlug = next.slug;
        } catch (e) {
          await writeJSON(this.storage, paths.client(clientId), { ...next, slug: before.slug });
          throw e;
        }
        await this.storage.delete(paths.slug(before.slug)).catch(() => undefined);
      }
      return next;
    } catch (e) {
      if (reservedSlug) await this.storage.delete(paths.slug(reservedSlug)).catch(() => undefined);
      throw e;
    }
  }

  async saveLogo(clientId: string, extension: string, body: Buffer, contentType: string) {
    const p = paths.clientLogo(clientId, extension);
    await this.storage.put(p, body, { contentType });
    return p;
  }

  getFileStream(path: string) {
    return this.storage.getStream(path);
  }
}

class JsonAccessRepository implements AccessRepository {
  constructor(private readonly storage: StorageProvider) {}

  async get(clientId: string) {
    if (!isValidId(clientId, "cl")) return null;
    const doc = await readJSON(this.storage, paths.access(clientId), ClientAccessSchema);
    return doc?.data ?? null;
  }

  update(clientId: string, mutate: Parameters<AccessRepository["update"]>[1]) {
    return updateJSON(this.storage, paths.access(clientId), ClientAccessSchema, (current) => mutate(current));
  }
}

class JsonReportRepository implements ReportRepository {
  constructor(private readonly storage: StorageProvider) {}

  async getIndex(clientId: string) {
    const doc = await readJSON(this.storage, paths.clientIndex(clientId), ClientIndexSchema);
    return doc?.data ?? emptyIndex(clientId, nowISO());
  }

  updateIndex(clientId: string, mutate: Parameters<ReportRepository["updateIndex"]>[1]) {
    return updateJSON(this.storage, paths.clientIndex(clientId), ClientIndexSchema, (current) => mutate(current ?? emptyIndex(clientId, nowISO())));
  }

  async getManifest(clientId: string, type: ReportType, reportId: string) {
    if (!isValidId(clientId, "cl") || !isValidId(reportId, "rp")) return null;
    const doc = await readJSON(this.storage, paths.reportManifest(clientId, type, reportId), ReportManifestSchema);
    return doc?.data ?? null;
  }

  async saveManifest(manifest: ReportManifest) {
    const valid = ReportManifestSchema.parse(manifest);
    await writeJSON(this.storage, paths.reportManifest(valid.clientId, valid.type, valid.id), valid);
    await this.updateIndex(valid.clientId, (index) => upsertReportEntry(index, toIndexEntry(valid), nowISO()));
    return valid;
  }

  async getData(manifest: ReportManifest) {
    if (!manifest.dataPath) return null;
    const obj = await this.storage.get(manifest.dataPath);
    if (!obj) return null;
    return JSON.parse(obj.body.toString("utf8")) as unknown;
  }

  async saveData(clientId: string, type: ReportType, reportId: string, data: unknown) {
    const p = paths.reportData(clientId, type, reportId);
    await writeJSON(this.storage, p, data);
    return p;
  }

  async saveOriginal(
    clientId: string,
    type: ReportType,
    reportId: string,
    extension: string,
    source: { copyFrom: string; contentType: string } | { body: Buffer; contentType: string },
  ) {
    const p = paths.reportOriginal(clientId, type, reportId, extension);
    if ("copyFrom" in source) await this.storage.copy(source.copyFrom, p, source.contentType);
    else await this.storage.put(p, source.body, { contentType: source.contentType });
    return p;
  }

  async getOriginalStream(manifest: ReportManifest) {
    if (!manifest.source?.path) return null;
    return this.storage.getStream(manifest.source.path);
  }

  async rebuildIndex(clientId: string) {
    const files = await this.storage.list(paths.reportsPrefix(clientId));
    const manifests = await Promise.all(
      files
        .filter((f) => f.path.endsWith("/manifest.json"))
        .map(async (f) => (await readJSON(this.storage, f.path, ReportManifestSchema))?.data ?? null),
    );
    return this.updateIndex(clientId, (index) => {
      let next = { ...index, reports: [] as typeof index.reports };
      for (const m of manifests) if (m) next = upsertReportEntry(next, toIndexEntry(m), nowISO());
      return next;
    });
  }
}

class JsonImportRepository implements ImportRepository {
  constructor(private readonly storage: StorageProvider) {}

  async get(importId: string) {
    if (!isValidId(importId, "im")) return null;
    const doc = await readJSON(this.storage, paths.importRecord(importId), ImportRecordSchema);
    return doc?.data ?? null;
  }

  async save(record: ImportRecord) {
    const valid = ImportRecordSchema.parse(record);
    await writeJSON(this.storage, paths.importRecord(valid.id), valid);
    return valid;
  }

  update(importId: string, mutate: (current: ImportRecord) => ImportRecord) {
    return updateJSON(this.storage, paths.importRecord(importId), ImportRecordSchema, (current) => {
      if (!current) throw new UserFacingError("Importação não encontrada.", "not_found");
      return { ...mutate(current), updatedAt: nowISO() };
    });
  }

  async putFile(path: string, body: Buffer, contentType: string) {
    await this.storage.put(path, body, { contentType });
  }

  async getFile(path: string) {
    return (await this.storage.get(path))?.body ?? null;
  }

  getFileStream(path: string) {
    return this.storage.getStream(path);
  }

  async deleteFiles(list: string[]) {
    if (list.length) await this.storage.delete(list);
  }
}

class JsonEventRepository implements EventRepository {
  constructor(private readonly storage: StorageProvider) {}

  async append(event: PortalEvent) {
    const valid = EventSchema.parse(event);
    await writeJSON(this.storage, paths.event(new Date(valid.at), valid.id, valid.clientId), valid, { ifNotExists: true });
  }

  async listRecent(options: { months?: number; clientId?: string; limit?: number } = {}) {
    const months = options.months ?? 2;
    const limit = options.limit ?? 30;
    const now = new Date();
    const prefixes: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      prefixes.push(paths.eventsPrefix(d.getUTCFullYear(), d.getUTCMonth() + 1));
    }
    const listings = (await Promise.all(prefixes.map((p) => this.storage.list(p)))).flat();
    const filtered = listings
      .filter((l) => l.path.endsWith(".json"))
      .filter((l) => !options.clientId || l.path.includes(`_${options.clientId}_`))
      .sort((a, b) => (a.path < b.path ? 1 : -1))
      .slice(0, limit);
    const events = await Promise.all(filtered.map(async (l) => (await readJSON(this.storage, l.path, EventSchema).catch(() => null))?.data ?? null));
    return events.filter((e): e is PortalEvent => e !== null);
  }
}

export function createJsonRepositories(storage: StorageProvider): Repositories {
  return {
    clients: new JsonClientRepository(storage),
    access: new JsonAccessRepository(storage),
    reports: new JsonReportRepository(storage),
    imports: new JsonImportRepository(storage),
    events: new JsonEventRepository(storage),
  };
}
