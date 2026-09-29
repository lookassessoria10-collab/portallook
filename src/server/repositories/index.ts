import "server-only";
import { getStorage } from "@/lib/storage";
import { createJsonRepositories } from "./json";
import type { Repositories } from "./types";

let repos: Repositories | null = null;

/** Ponto único de composição. Para trocar JSON por banco, altere apenas aqui. */
export function getRepositories(): Repositories {
  if (!repos) repos = createJsonRepositories(getStorage());
  return repos;
}

export function resetRepositoriesForTesting() {
  repos = null;
}

export type { Repositories } from "./types";
