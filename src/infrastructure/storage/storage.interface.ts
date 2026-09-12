/**
 * StorageProvider — the only interface the rest of the application touches.
 * Swap the adapter in storage/index.ts; nothing else changes.
 */
export interface StorageFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageProvider {
  /**
   * Persist a file and return the storage key (used to build download URLs).
   * The key is opaque — callers must not parse it.
   */
  save(key: string, file: StorageFile): Promise<void>;

  /** Remove a previously saved file. Silently succeeds if not found. */
  delete(key: string): Promise<void>;

  /** Stream a file for download. Returns null if not found. */
  stream(key: string): Promise<{ stream: NodeJS.ReadableStream; mimeType?: string } | null>;
}
