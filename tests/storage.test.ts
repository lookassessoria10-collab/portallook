import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { LocalFileStorageProvider } from "@/lib/storage/local";
import { assertSafePath, StorageAlreadyExistsError, StoragePreconditionError } from "@/lib/storage/types";
import { readJSON, updateJSON, writeJSON } from "@/lib/storage/json";
import { paths } from "@/lib/storage/paths";
import { ConflictError } from "@/lib/errors";

let dir: string;
let storage: LocalFileStorageProvider;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "portal-look-"));
  storage = new LocalFileStorageProvider(dir);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("LocalFileStorageProvider", () => {
  it("grava, lê, lista e remove", async () => {
    await storage.put("clients/cl_abc123def456/client.json", '{"a":1}', { contentType: "application/json" });
    await storage.put("clients/cl_zzz999yyy888/client.json", '{"a":2}', { contentType: "application/json" });
    expect((await storage.get("clients/cl_abc123def456/client.json"))?.body.toString()).toBe('{"a":1}');
    expect(await storage.listFolders("clients/")).toHaveLength(2);
    expect((await storage.list("clients/")).map((l) => l.path)).toContain("clients/cl_abc123def456/client.json");
    await storage.delete("clients/cl_zzz999yyy888/client.json");
    expect(await storage.get("clients/cl_zzz999yyy888/client.json")).toBeNull();
  });

  it("respeita ifNotExists e ifMatch (concorrência otimista)", async () => {
    const p = "slugs/teste.json";
    await storage.put(p, "1", { contentType: "application/json", ifNotExists: true });
    await expect(storage.put(p, "2", { contentType: "application/json", ifNotExists: true })).rejects.toBeInstanceOf(StorageAlreadyExistsError);
    const current = await storage.get(p);
    await expect(storage.put(p, "3", { contentType: "application/json", ifMatch: "etag-velho" })).rejects.toBeInstanceOf(StoragePreconditionError);
    await storage.put(p, "4", { contentType: "application/json", ifMatch: current!.etag });
    expect((await storage.get(p))?.body.toString()).toBe("4");
  });

  it("bloqueia path traversal e caminhos estranhos", async () => {
    for (const bad of ["../etc/passwd", "/abs/path", "a/../b", "a\\b", "a//b", "a/b\u0000", "clients/%2e%2e/x"]) {
      expect(() => assertSafePath(bad)).toThrow();
    }
    await expect(storage.get("../fora.json")).rejects.toThrow();
    expect(() => paths.client("../../x")).toThrow();
    expect(() => paths.slug("A B")).toThrow();
    expect(() => paths.reportOriginal("cl_abc123def456", "commercial", "rp_abc123def456", "../x")).toThrow();
  });

  it("updateJSON aplica a alteração e valida o schema", async () => {
    const schema = z.object({ count: z.number() });
    const p = "clients/cl_abc123def456/index.json";
    await updateJSON(storage, p, schema, (c) => ({ count: (c?.count ?? 0) + 1 }));
    await updateJSON(storage, p, schema, (c) => ({ count: (c?.count ?? 0) + 1 }));
    expect((await readJSON(storage, p, schema))?.data.count).toBe(2);
    await expect(updateJSON(storage, p, schema, () => ({ count: "x" }) as unknown as { count: number })).rejects.toThrow();
  });

  it("updateJSON desiste com ConflictError se o documento muda o tempo todo", async () => {
    const schema = z.object({ n: z.number() });
    const p = "clients/cl_abc123def456/hot.json";
    await writeJSON(storage, p, { n: 0 });
    // Outra escrita sempre "ganha": toda gravação condicional falha.
    const racing = Object.create(storage) as LocalFileStorageProvider;
    racing.put = async (path, body, options) => {
      if (options.ifMatch) throw new StoragePreconditionError(path);
      return storage.put(path, body, options);
    };
    await expect(updateJSON(racing, p, schema, (c) => ({ n: (c?.n ?? 0) + 1 }), { retries: 2 })).rejects.toBeInstanceOf(ConflictError);
  });
});
