import { NextRequest, NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import { getStorage } from "@/infrastructure/storage";
import {
  validateUploadedFile,
  mimeToExtension,
} from "@/infrastructure/storage/file-validation";
import { getNotifier, templates } from "@/infrastructure/notifications";
import { requireAuth, tenantPrisma, deny } from "@/infrastructure/tenant";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Auth ────────────────────────────────────────────────
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  const { id: documentId } = await params;

  // ── 2. Fetch document and authorize ────────────────────────
  const document = await db.document.findUnique({
    where: {
      id: documentId,
      ...(ctx.kind === "candidate" ? { application: { candidateId: ctx.candidateId } } : {}),
    },
    include: {
      application: {
        select: {
          candidateId: true,
          id: true,
          candidate: { select: { nameAr: true } },
        },
      },
    },
  });

  if (!document) return deny(404, "المستند غير موجود");

  // ── 3. Parse multipart form ────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── 4. Validate ────────────────────────────────────────────
  const validation = validateUploadedFile(buffer, file.name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  // ── 5. Delete old file if replacing ───────────────────────
  const storage = getStorage();
  if (document.filePath) {
    await storage.delete(document.filePath).catch(() => null);
  }

  // ── 6. Save new file ───────────────────────────────────────
  const ext = mimeToExtension(validation.mimeType);
  const storageKey = `${document.application.id}/${document.type.toLowerCase()}/${randomUUID()}.${ext}`;

  await storage.save(storageKey, {
    buffer,
    originalName: file.name,
    mimeType: validation.mimeType,
    sizeBytes: buffer.length,
  });

  // ── 7. Compute checksum ───────────────────────────────────
  const checksum = createHash("sha256").update(buffer).digest("hex");

  // ── 8. Update document record ─────────────────────────────
  const updated = await db.document.update({
    where: { id: documentId },
    data: {
      filePath: storageKey,
      fileName: file.name,
      fileSize: buffer.length,
      mimeType: validation.mimeType,
      checksum,
      status: "UPLOADED",
      uploadedAt: new Date(),
    },
    select: { id: true, status: true, filePath: true, uploadedAt: true },
  });

  // ── 9. Audit log ──────────────────────────────────────────
  await db.auditLog.create({
    data: {
      actorType: ctx.kind === "candidate" ? "CANDIDATE" : "USER",
      action: "document.uploaded",
      resource: "Document",
      resourceId: documentId,
      applicationId: document.application.id,
      candidateId: document.application.candidateId,
      userId: ctx.kind === "hr" ? ctx.userId : undefined,
      metadata: { mimeType: validation.mimeType, sizeBytes: buffer.length },
    },
  });

  // ── 10. Notify HR officers in this organization (fire-and-forget) ──
  db.user.findMany({
    where: { isActive: true },
    select: { email: true },
  }).then((hrUsers) => {
    const notifier = getNotifier();
    for (const hr of hrUsers) {
      notifier.send({
        to: hr.email,
        ...templates.documentUploaded({
          candidateName: document.application.candidate.nameAr,
          documentName: document.nameAr,

        }),
      }).catch(() => null);
    }
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    document: updated,
    fileUrl: `/api/files/${storageKey}`,
  });
}
