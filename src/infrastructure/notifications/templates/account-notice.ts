/**
 * Existing-account notice — sent when a candidate ALREADY has credentials.
 *
 * Hard rule (this module exists to enforce it): this e-mail NEVER contains a
 * password, and sending it NEVER rotates one. The platform only stores bcrypt
 * hashes, so the current password is not recoverable — the notice therefore
 * carries the username + the login page only, and tells the candidate what to
 * do if they no longer remember the password (contact HR for a reset — there
 * is deliberately no self-service reset in this flow).
 *
 * Institutional identity hierarchy matches the credentials template:
 *   - الجهة الحكومية : وزارة المالية            (organizationName)
 *   - المنصة الرئيسية: منصة القبول والنزاهة      (platformName)
 *   - الخدمة          : منصة نزاهة للتوظيف      (serviceName)
 */
import { PLATFORM_NAME, SERVICE_NAME } from "./credentials";

export { PLATFORM_NAME, SERVICE_NAME };

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param data.loginUrl absolute base URL of the platform (never localhost for
 *   candidate-facing sends — callers pass the production host explicitly).
 */
export function accountNotice(data: {
  candidateName: string;
  jobTitle: string;
  department: string;
  organizationName: string;
  loginEmail: string;
  loginUrl: string;
  platformName?: string;
  serviceName?: string;
}): { subject: string; html: string; text: string } {
  const siteUrl   = data.loginUrl.replace(/\/$/, "");
  const loginPage = `${siteUrl}/auth/candidate`;
  const platform  = data.platformName?.trim() || PLATFORM_NAME;
  const service   = data.serviceName?.trim() || SERVICE_NAME;

  const subject = "بيانات الدخول إلى حسابك – منصة نزاهة";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:0; background:#F4F2EC; font-family:'Segoe UI',Tahoma,Arial,'Noto Sans Arabic',sans-serif; direction:rtl; color:#1A1A1A; }
  .wrapper { max-width:600px; margin:32px auto; padding:0 16px 48px; width:100%; }
  .header { background:#013A2B; border-radius:20px 20px 0 0; padding:28px 32px; color:#fff; }
  .header h1 { margin:0 0 6px; font-size:22px; }
  .header p { margin:0; font-size:13px; opacity:.85; }
  .body { background:#fff; border-radius:0 0 20px 20px; padding:28px 32px; border:1px solid #E6E2D8; border-top:none; }
  .body p { line-height:1.9; font-size:15px; margin:0 0 14px; }
  .cred-label { font-size:12px; color:#6B7280; margin-bottom:4px; }
  .cred-value { background:#F4F2EC; border:1px dashed #C9C4B6; border-radius:10px; padding:10px 14px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:14px; direction:ltr; text-align:left; user-select:all; margin-bottom:16px; word-break:break-all; }
  .btn { display:inline-block; background:#013A2B; color:#fff; text-decoration:none; padding:12px 26px; border-radius:10px; font-size:15px; margin:8px 0 16px; }
  .note { background:#FFF8E6; border:1px solid #F0E3BC; border-radius:10px; padding:12px 16px; font-size:13px; line-height:1.8; color:#5B4A1F; }
  .footer { text-align:center; font-size:12px; color:#6B7280; margin-top:20px; line-height:1.8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>${escapeHtml(data.organizationName)}</h1>
    <p>${escapeHtml(platform)} — ${escapeHtml(service)}</p>
  </div>
  <div class="body">
    <p>السلام عليكم،</p>
    <p>
      نُعلمكم أن <strong>${escapeHtml(data.candidateName)}</strong>
      (${escapeHtml(data.jobTitle)} — ${escapeHtml(data.department)})
      يملك حساباً مسجلاً بالفعل على ${escapeHtml(service)}. هذه رسالة تذكير
      ببيانات الدخول، <strong>دون تغيير أي بيانات دخول سابقة</strong>.
    </p>

    <div class="cred-label">اسم المستخدم (البريد الإلكتروني)</div>
    <div class="cred-value">${escapeHtml(data.loginEmail)}</div>

    <p style="text-align:center">
      <a class="btn" href="${escapeHtml(loginPage)}">تسجيل الدخول إلى الحساب</a>
    </p>

    <div class="note">
      كلمة المرور الحالية لحسابك ما زالت كما هي ولم تتغيّر. إذا لم تعد تتذكرها،
      يرجى التواصل مع إدارة الموارد البشرية في جهتك لتععيدها — لا توجد إعادة تعيين
      ذاتية في هذه الرسالة.
    </div>
  </div>
  <div class="footer">
    هذه رسالة آلية من ${escapeHtml(platform)} ولا يُرجى الرد عليها.<br>
    ${escapeHtml(service)}
  </div>
</div>
</body>
</html>`;

  const text = [
    subject,
    "",
    `السلام عليكم،`,
    ``,
    `${data.candidateName} (${data.jobTitle} — ${data.department}) يملك حساباً مسجلاً بالفعل على ${service}.`,
    `هذه رسالة تذكير ببيانات الدخول دون تغيير أي بيانات دخول سابقة.`,
    ``,
    `اسم المستخدم: ${data.loginEmail}`,
    `رابط الدخول: ${loginPage}`,
    ``,
    `كلمة المرور الحالية لحسابك ما زالت كما هي ولم تتغيّر. إذا لم تعد تتذكرها، تواصل مع إدارة الموارد البشرية في جهتك لتععيدها.`,
    ``,
    `— ${platform} / ${service}`,
  ].join("\n");

  return { subject, html, text };
}
