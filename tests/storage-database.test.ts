import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import { DatabaseAdapter } from "@/infrastructure/storage/database.adapter";

// STORAGE_PROVIDER=database must behave exactly like the local adapter from the
// application's point of view: save → stream (same bytes, same mime) → delete → null.

const KEY = `test/storage/${Date.now()}.pdf`;
const adapter = new DatabaseAdapter();

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

afterAll(async () => {
  await prisma.storedFile.deleteMany({ where: { key: { startsWith: "test/storage/" } } });
  await prisma.$disconnect();
});

describe("DatabaseAdapter", () => {
  const payload = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from([0, 255, 128, 7, 13, 10])]);

  it("round-trips bytes and mime type", async () => {
    await adapter.save(KEY, { buffer: payload, originalName: "x.pdf", mimeType: "application/pdf", sizeBytes: payload.length });
    const result = await adapter.stream(KEY);
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("application/pdf");
    expect((await readAll(result!.stream)).equals(payload)).toBe(true);
  });

  it("overwrites on the same key", async () => {
    const next = Buffer.from("second version");
    await adapter.save(KEY, { buffer: next, originalName: "x.pdf", mimeType: "application/pdf", sizeBytes: next.length });
    const result = await adapter.stream(KEY);
    expect((await readAll(result!.stream)).toString()).toBe("second version");
    expect(await prisma.storedFile.count({ where: { key: KEY } })).toBe(1);
  });

  it("returns null for unknown keys and deletes silently", async () => {
    expect(await adapter.stream("test/storage/does-not-exist")).toBeNull();
    await adapter.delete(KEY);
    await adapter.delete(KEY);
    expect(await adapter.stream(KEY)).toBeNull();
  });
});
