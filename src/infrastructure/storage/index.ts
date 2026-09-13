/**
 * Storage factory — reads STORAGE_PROVIDER from env and returns the
 * correct adapter. Add a new case here (and a new adapter file) to
 * support a new provider without touching any other code.
 */
import type { StorageProvider } from "./storage.interface";
import { LocalAdapter } from "./local.adapter";
import { DatabaseAdapter } from "./database.adapter";

let _instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (_instance) return _instance;

  const provider = process.env.STORAGE_PROVIDER ?? "local";
  const localPath = process.env.STORAGE_LOCAL_PATH ?? "./storage";

  switch (provider) {
    case "local":
      _instance = new LocalAdapter(localPath);
      break;

    // Stateless hosts (Vercel): bytes live in PostgreSQL next to their metadata.
    case "database":
      _instance = new DatabaseAdapter();
      break;

    default:
      throw new Error(`Unknown STORAGE_PROVIDER: "${provider}"`);
  }

  return _instance;
}

export type { StorageProvider, StorageFile } from "./storage.interface";
