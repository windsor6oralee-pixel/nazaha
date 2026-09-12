import { NextResponse } from "next/server";
import { getSmtpConfig, saveSmtpConfig, deleteSmtpConfig } from "@/infrastructure/notifications/smtp-config.service";
import { requireHR, tenantPrisma } from "@/infrastructure/tenant";

const ADMIN_ROLES = ["admin", "hr_manager"];

/** GET /api/admin/smtp — returns current config (password masked) */
export async function GET() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const orgId = ctx.organizationId;

  const config = await getSmtpConfig(orgId);
  if (!config) return NextResponse.json({ configured: false });

  return NextResponse.json({
    configured: true,
    host:      config.host,
    port:      config.port,
    secure:    config.secure,
    user:      config.user,
    fromEmail: config.fromEmail,
    fromName:  config.fromName,
    // password is never returned — only masked indicator
    passSet:   true,
  });
}

/** POST /api/admin/smtp — save or update SMTP config */
export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const orgId = ctx.organizationId;
  const db = tenantPrisma(orgId);
  const body = await req.json();

  const { host, port, secure, user, pass, fromEmail, fromName } = body;
  if (!host || !user) {
    return NextResponse.json({ error: "host و user مطلوبان" }, { status: 400 });
  }

  // If no new password provided, keep existing encrypted one
  let passEnc: string | undefined;
  if (!pass) {
    const rows = await db.systemSetting.findFirst({ where: { key: "smtp_pass_enc" } });
    passEnc = rows?.value;
    if (!passEnc) {
      return NextResponse.json({ error: "كلمة المرور مطلوبة عند الإعداد الأول" }, { status: 400 });
    }
  }

  await saveSmtpConfig(orgId, {
    host,
    port:      Number(port ?? 587),
    secure:    Boolean(secure),
    user,
    fromEmail: fromEmail ?? user,
    fromName:  fromName ?? "نزاهة التوظيف",
    ...(pass ? { pass } : { passEnc }),
  });

  return NextResponse.json({ success: true });
}

/** DELETE /api/admin/smtp — remove config */
export async function DELETE() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  await deleteSmtpConfig(ctx.organizationId);
  return NextResponse.json({ success: true });
}
