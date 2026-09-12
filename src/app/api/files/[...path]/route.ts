import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/infrastructure/storage";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";

const MIME_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // ── 1. Auth ────────────────────────────────────────────────
  const ctx = await getTenantContext();
  if (!ctx) return new NextResponse("غير مصرح", { status: 401 });
  const db = tenantPrisma(ctx.organizationId);

  const { path: segments } = await params;
  const storageKey = segments.join("/");

  // ── 2. Find document by filePath (tenant-scoped; candidates must own it) ──
  const document = await db.document.findFirst({
    where: {
      filePath: storageKey,
      ...(ctx.kind === "candidate" ? { application: { candidateId: ctx.candidateId } } : {}),
    },
    select: { id: true },
  });

  if (!document) return new NextResponse("الملف غير موجود", { status: 404 });

  // ── 3. Stream file ─────────────────────────────────────────
  const storage = getStorage();
  const result = await storage.stream(storageKey);

  if (!result) {
    return new NextResponse("الملف غير موجود في التخزين", { status: 404 });
  }

  const ext = storageKey.split(".").pop() ?? "";
  const contentType = MIME_CONTENT_TYPES[ext] ?? "application/octet-stream";

  // Convert Node.js ReadableStream to Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      result.stream.on("data", (chunk) => controller.enqueue(chunk));
      result.stream.on("end", () => controller.close());
      result.stream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${storageKey.split("/").pop()}"`,
    },
  });
}
