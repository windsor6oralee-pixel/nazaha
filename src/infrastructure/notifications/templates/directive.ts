/**
 * Candidate directive e-mail — a thin wrapper that mirrors the three directive
 * types (info / urgent / appointment) with matching accent colors and copy.
 */

export type DirectiveTypeCode = "INFO" | "URGENT" | "APPOINTMENT";

interface Args {
  candidateName: string;
  organizationName: string;
  type: DirectiveTypeCode;
  title: string;
  body: string;
  loginUrl: string;
}

const PALETTE: Record<DirectiveTypeCode, { label: string; accent: string; subject: string }> = {
  INFO:        { label: "تنبيه",         accent: "#013A2B", subject: "تنبيه من" },
  URGENT:      { label: "عاجل",          accent: "#A83A30", subject: "⚠️ عاجل —" },
  APPOINTMENT: { label: "موعد / تذكير",   accent: "#C9A94A", subject: "📅 تذكير —" },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function candidateDirective(data: Args): { subject: string; html: string } {
  const p = PALETTE[data.type] ?? PALETTE.INFO;
  const loginPage = `${data.loginUrl.replace(/\/$/, "")}/auth/candidate`;

  return {
    subject: `${p.subject} ${data.organizationName} — ${data.title}`,
    html: `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>تنبيه — ${escapeHtml(data.organizationName)}</title>
<style>
  body { margin:0; padding:0; background:#F4F2EC; font-family:'Segoe UI',Tahoma,Arial,sans-serif; direction:rtl; color:#1A1A1A; }
  .wrapper { max-width:600px; margin:32px auto; padding:0 16px 48px; }
  .header { background:${p.accent}; border-radius:20px 20px 0 0; padding:24px 32px; position:relative; overflow:hidden; }
  .header-bar { position:absolute; top:0; left:0; right:0; height:4px; background:#C9A94A; }
  .header-brand { color:#FFFFFF; font-size:20px; font-weight:700; margin:0; }
  .header-tag   { color:rgba(255,255,255,0.75); font-size:12px; margin:4px 0 0; font-weight:600; }
  .card { background:#FFFFFF; border-radius:0 0 20px 20px; padding:28px 32px; border:1px solid #DDD9CE; border-top:none; }
  .divider { width:48px; height:3px; background:${p.accent}; border-radius:9999px; margin-bottom:16px; }
  h1 { font-size:22px; font-weight:700; color:${p.accent}; margin:0 0 12px; }
  .lead { font-size:14px; color:#4A4A4A; margin:0 0 20px; }
  .body-text { font-size:15px; line-height:1.75; color:#1A1A1A; white-space:pre-wrap; margin:0 0 24px; }
  .cta-wrap { text-align:center; margin:20px 0; }
  .cta-btn { display:inline-block; background:${p.accent}; color:#FFFFFF !important; text-decoration:none; font-size:15px; font-weight:700; padding:12px 36px; border-radius:12px; }
  .footer { text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid #DDD9CE; font-size:11px; color:#9E9E9E; line-height:1.8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="header-bar"></div>
    <p class="header-brand">نزاهة التوظيف</p>
    <p class="header-tag">${p.label} — ${escapeHtml(data.organizationName)}</p>
  </div>
  <div class="card">
    <div class="divider"></div>
    <p class="lead">عزيزي/عزيزتي <strong>${escapeHtml(data.candidateName)}</strong>،</p>
    <h1>${escapeHtml(data.title)}</h1>
    <p class="body-text">${escapeHtml(data.body)}</p>
    <div class="cta-wrap">
      <a href="${loginPage}" class="cta-btn">فتح بوابتي ←</a>
    </div>
    <p style="font-size:12px; color:#6E7673; text-align:center; margin:16px 0 0;">
      هذه الرسالة ظاهرة أيضاً في أعلى بوابتك على المنصة وتبقى حتى تُغيّرها الموارد البشرية.
    </p>
  </div>
  <div class="footer">
    <p>بريد آلي — يُرجى عدم الرد عليه مباشرةً.</p>
    <p style="color:#C9A94A;">نزاهة · ثقة · كفاءة · انطلاقة</p>
  </div>
</div>
</body>
</html>`,
  };
}
