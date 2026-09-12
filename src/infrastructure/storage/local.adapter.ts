import { createReadStream, existsSync } from "fs";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, resolve, dirname } from "path";
import type { StorageProvider, StorageFile } from "./storage.interface";

/**
 * LocalAdapter — stores files on the local filesystem.
 * Used when STORAGE_PROVIDER=local.
 *
 * Files are written to:  <basePath>/<key>
 * They are served through: GET /api/files/<key>
 *
 * The basePath must never be inside the Next.js public/ directory
 * so files are NOT directly accessible without going through the API
 * (which enforces authentication).
 */
export class LocalAdapter implements StorageProvider {
  private readonly basePath: string;

  constructor(basePath: string) {
    // Resolve relative paths from the project root (process.cwd())
    this.basePath = resolve(process.cwd(), basePath);
  }

  private fullPath(key: string): string {
    // Prevent path traversal: strip leading slashes and resolve relative segments
    const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
    const full = join(this.basePath, safe);
    // Double-check the resolved path is still inside basePath
    if (!full.startsWith(this.basePath)) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async save(key: string, file: StorageFile): Promise<void> {
    const dest = this.fullPath(key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, file.buffer);
  }

  async delete(key: string): Promise<void> {
    const dest = this.fullPath(key);
    try {
      await unlink(dest);
    } catch {
      // Silently ignore if file doesn't exist
    }
  }

  async stream(key: string): Promise<{ stream: NodeJS.ReadableStream; mimeType?: string } | null> {
    const dest = this.fullPath(key);
    if (!existsSync(dest)) return null;
    return { stream: createReadStream(dest) };
  }
}
