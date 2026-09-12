/**
 * Storage factory — reads STORAGE_PROVIDER from env and returns the
 * correct adapter. Add a new case here (and a new adapter file) to
 * support a new provider without touching any other code.
 */
import type { StorageProvider } from "./storage.interface";
import { LocalAdapter } from "./local.adapter";

let _instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (_instance) return _instance;

  const provider = process.env.STORAGE_PROVIDER ?? "local";
  const localPath = process.env.STORAGE_LOCAL_PATH ?? "./storage";

  switch (provider) {
    case "local":
      _instance = new LocalAdapter(localPath);
      break;

    // case "s3":
    //   _instance = new S3Adapter({
    //     endpoint: process.env.STORAGE_S3_ENDPOINT!,
    //     bucket: process.env.STORAGE_S3_BUCKET!,
    //     accessKey: process.env.STORAGE_S3_ACCESS_KEY!,
    //     secretKey: process.env.STORAGE_S3_SECRET_KEY!,
    //   });
    //   break;

    default:
      throw new Error(`Unknown STORAGE_PROVIDER: "${provider}"`);
  }

  return _instance;
}

export type { StorageProvider, StorageFile } from "./storage.interface";
