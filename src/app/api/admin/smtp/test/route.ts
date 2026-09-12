import { NextResponse } from "next/server";
import { getSmtpConfig } from "@/infrastructure/notifications/smtp-config.service";
import { SmtpAdapter } from "@/infrastructure/notifications/smtp.adapter";
import { requireHR } from "@/infrastructure/tenant";

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;

  const orgId = ctx.organizationId;
  const body = await req.json().catch(() => ({}));

  // Use inline values if provided (pre-save test), otherwise load from DB
  let config: Awaited<ReturnType<typeof getSmtpConfig>>;

  if (body.host && body.user && body.pass) {
    config = {
      host:      body.host,
      port:      Number(body.port ?? 587),
      secure:    Boolean(body.secure),
      user:      body.user,
      pass:      body.pass,
      fromEmail: body.fromEmail ?? body.user,
      fromName:  body.fromName ?? "نزاهة التوظيف",
    };
  } else {
    config = await getSmtpConfig(orgId);
  }

  if (!config) {
    return NextResponse.json({ error: "لم يتم إعداد SMTP بعد" }, { status: 400 });
  }

  const testEmail = body.testEmail ?? ctx.email;
  if (!testEmail) {
    return NextResponse.json({ error: "بريد الاختبار مطلوب" }, { status: 400 });
  }

  try {
    const adapter = new SmtpAdapter({
      host:   config.host,
      port:   config.port,
      secure: config.secure,
      user:   config.user,
      pass:   config.pass,
      from:   `${config.fromName} <${config.fromEmail}>`,
    });

    await adapter.send({
      to:      testEmail,
      subject: "✅ اختبار إعدادات البريد — نزاهة التوظيف",
      html: `<!DOCTYPE html><html dir="rtl" lang="ar"><body style="font-family:Tahoma,Arial;background:#F4F2EC;padding:24px;direction:rtl">
        <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DDD9CE">
          <div style="background:#013A2B;padding:20px 24px;border-top:4px solid #C9A94A">
            <p style="color:#E8D27A;font-size:18px;font-weight:700;margin:0">نزاهة التوظيف</p>
          </div>
          <div style="padding:24px;font-size:15px;color:#1A1A1A;line-height:1.75">
            <p>✅ <strong>الاتصال ناجح!</strong></p>
            <p>إعدادات SMTP تعمل بشكل صحيح. يمكنك الآن إرسال رموز الدعوة للمرشحين.</p>
            <div style="background:#E6F0E9;border-right:4px solid #013A2B;border-radius:8px;padding:12px 16px;margin:16px 0">
              <p style="margin:0"><strong>الخادم:</strong> ${config.host}:${config.port}</p>
              <p style="margin:4px 0 0"><strong>المُرسِل:</strong> ${config.fromName} &lt;${config.fromEmail}&gt;</p>
            </div>
          </div>
        </div>
      </body></html>`,
    });

    return NextResponse.json({ success: true, sentTo: testEmail });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل الاتصال بخادم البريد" },
      { status: 500 }
    );
  }
}
