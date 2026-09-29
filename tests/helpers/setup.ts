import { setStorageForTesting } from "@/lib/storage";
import { resetRepositoriesForTesting } from "@/server/repositories";
import { MemoryStorageProvider } from "./memory-storage";

export function useMemoryStorage(): MemoryStorageProvider {
  const storage = new MemoryStorageProvider();
  setStorageForTesting(storage);
  resetRepositoriesForTesting();
  return storage;
}
