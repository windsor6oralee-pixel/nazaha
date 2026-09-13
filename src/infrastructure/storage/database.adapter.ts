import { Readable } from "node:stream";
import { prisma } from "@/infrastructure/database/client";
import type { StorageProvider, StorageFile } from "./storage.interface";

// Keeps file bytes in PostgreSQL. Chosen for stateless hosts (Vercel) where the
// local filesystem is ephemeral, without adding an object-storage dependency:
// the file and its metadata share one database, one backup, one transaction.
export class DatabaseAdapter implements StorageProvider {
  async save(key: string, file: StorageFile): Promise<void> {
    await prisma.storedFile.upsert({
      where: { key },
      update: { data: file.buffer, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
      create: { key, data: file.buffer, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
    });
  }

  async delete(key: string): Promise<void> {
    await prisma.storedFile.deleteMany({ where: { key } });
  }

  async stream(key: string) {
    const row = await prisma.storedFile.findUnique({ where: { key } });
    if (!row) return null;
    return { stream: Readable.from(Buffer.from(row.data)) as NodeJS.ReadableStream, mimeType: row.mimeType };
  }
}
