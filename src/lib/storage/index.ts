import "server-only";
import { env, storageDriver } from "@/lib/env";
import { LocalFileStorageProvider } from "./local";
import type { StorageProvider } from "./types";
import { VercelBlobStorageProvider } from "./vercel-blob";

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = storageDriver();
  if (driver === "vercel-blob") {
    instance = new VercelBlobStorageProvider(env().BLOB_READ_WRITE_TOKEN);
  } else {
    if (process.env.VERCEL) {
      console.warn("[portal-look] STORAGE_DRIVER=local na Vercel: os dados não persistem. Configure o Vercel Blob.");
    }
    instance = new LocalFileStorageProvider(env().LOCAL_STORAGE_DIR);
  }
  return instance;
}

/** Permite testes com um provider em memória. */
export function setStorageForTesting(provider: StorageProvider | null) {
  instance = provider;
}

export * from "./types";
