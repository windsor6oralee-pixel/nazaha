import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { getStorage } from "@/infrastructure/storage";
import { detectMimeType, mimeToExtension } from "@/infrastructure/storage/file-validation";
import { prisma } from "@/infrastructure/database/client";
import { setOrganizationLogo } from "@/infrastructure/services/organization.service";

const ADMIN_ROLES = ["admin", "hr_manager"];
const LOGO_MIME = new Set(["image/png", "image/jpeg"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return NextResponse.json({ error: "الملف فارغ" }, { status: 422 });
  if (buffer.length > MAX_LOGO_BYTES) return NextResponse.json({ error: "حجم الشعار يتجاوز 2 ميغابايت" }, { status: 422 });

  const mime = detectMimeType(buffer);
  if (!mime || !LOGO_MIME.has(mime)) return NextResponse.json({ error: "الشعار يجب أن يكون PNG أو JPEG" }, { status: 422 });

  const storage = getStorage();
  const current = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { logoPath: true } });
  if (current?.logoPath) await storage.delete(current.logoPath).catch(() => null);

  const key = `orgs/${ctx.organizationId}/logo-${Date.now()}.${mimeToExtension(mime)}`;
  await storage.save(key, { buffer, originalName: file.name, mimeType: mime, sizeBytes: buffer.length });
  await setOrganizationLogo(ctx.organizationId, key);

  return NextResponse.json({ ok: true, logoUrl: `/api/organization/logo?v=${encodeURIComponent(key)}` });
}

export async function DELETE() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const current = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { logoPath: true } });
  if (current?.logoPath) await getStorage().delete(current.logoPath).catch(() => null);
  await setOrganizationLogo(ctx.organizationId, null);

  return NextResponse.json({ ok: true });
}
