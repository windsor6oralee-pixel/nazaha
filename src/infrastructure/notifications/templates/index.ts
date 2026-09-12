const APP_NAME = "نزاهة التوظيف";
const BRAND_COLOR = "#013A2B";

function base(content: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: Tahoma, Arial, sans-serif; background:#F4F2EC; margin:0; padding:24px; color:#1A1A1A; direction:rtl; }
  .card { background:#fff; border-radius:20px; max-width:560px; margin:0 auto; overflow:hidden; border:1px solid #DDD9CE; }
  .header { background:${BRAND_COLOR}; padding:24px 28px; position:relative; }
  .header-bar { position:absolute; top:0; left:0; right:0; height:4px; background:#C9A94A; }
  .header h1 { color:#E8D27A; margin:0; font-size:20px; font-weight:700; }
  .header p { color:rgba(255,255,255,0.55); margin:4px 0 0; font-size:12px; }
  .body { padding:28px; font-size:15px; line-height:1.75; }
  .highlight { background:#E6F0E9; border-right:4px solid ${BRAND_COLOR}; border-radius:8px; padding:12px 16px; margin:16px 0; }
  .reason { background:#FAECEB; border-right:4px solid #A83A30; border-radius:8px; padding:12px 16px; margin:16px 0; }
  .footer { margin-top:0; padding:16px 28px; font-size:11px; color:#9E9E9E; text-align:center; border-top:1px solid #DDD9CE; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="header-bar"></div>
    <h1>${APP_NAME}</h1>
    <p>منصة إدارة التوظيف الحكومي</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">هذا البريد آلي — يُرجى عدم الرد عليه مباشرةً</div>
</div>
</body>
</html>`;
}

// ── Candidate notifications ─────────────────────────────────

export function documentApproved(data: {
  candidateName: string;
  documentName: string;
}): { subject: string; html: string } {
  return {
    subject: `✅ تمت الموافقة على مستندك — ${data.documentName}`,
    html: base(`
      <p>عزيزي/عزيزتي <strong>${data.candidateName}</strong>،</p>
      <p>يسعدنا إبلاغك بأن فريق الموارد البشرية قد راجع واعتمد المستند التالي:</p>
      <div class="highlight"><strong>${data.documentName}</strong></div>
      <p>استمر في رفع المستندات المتبقية لإتمام إجراءات التوظيف.</p>
    `),
  };
}

export function documentRejected(data: {
  candidateName: string;
  documentName: string;
  reason: string;
}): { subject: string; html: string } {
  return {
    subject: `❗ بحاجة إلى مراجعة — ${data.documentName}`,
    html: base(`
      <p>عزيزي/عزيزتي <strong>${data.candidateName}</strong>،</p>
      <p>قام فريق الموارد البشرية بمراجعة المستند وتبيّن أنه يحتاج إلى إعادة الرفع:</p>
      <div class="highlight"><strong>${data.documentName}</strong></div>
      <p><strong>سبب الرفض:</strong></p>
      <div class="reason">${data.reason}</div>
      <p>يُرجى تصحيح المستند وإعادة رفعه في أقرب وقت ممكن.</p>
    `),
  };
}

export function allDocumentsApproved(data: {
  candidateName: string;
  jobTitle: string;
}): { subject: string; html: string } {
  return {
    subject: "🎉 اكتملت مستنداتك — ملفك قيد المراجعة النهائية",
    html: base(`
      <p>عزيزي/عزيزتي <strong>${data.candidateName}</strong>،</p>
      <p>تهانينا! لقد اعتمد فريق الموارد البشرية جميع مستنداتك لوظيفة <strong>${data.jobTitle}</strong>.</p>
      <div class="highlight">ملفك الآن في مرحلة <strong>المراجعة النهائية</strong>. سنتواصل معك قريباً.</div>
      <p>شكراً لتعاونك وحسن استجابتك.</p>
    `),
  };
}

export function contractSigned(data: {
  candidateName: string;
  jobTitle: string;
  signedAt: string;
}): { subject: string; html: string } {
  return {
    subject: `✍️ وقّع ${data.candidateName} على عقد العمل — اتخذ إجراء`,
    html: base(`
      <p>وقّع المرشح على عقد العمل وهو جاهز للخطوة التالية.</p>
      <div class="highlight">
        <p><strong>المرشح:</strong> ${data.candidateName}</p>
        <p><strong>المسمى الوظيفي:</strong> ${data.jobTitle}</p>
        <p><strong>وقت التوقيع:</strong> ${new Date(data.signedAt).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</p>
      </div>
      <p>يمكنك الآن بدء إجراءات الاستعداد للمباشرة والتواصل مع المرشح عبر منصة نزاهة.</p>
    `),
  };
}

export function documentUploaded(data: {
  candidateName: string;
  documentName: string;
}): { subject: string; html: string } {
  return {
    subject: `📄 مستند جديد بانتظار المراجعة — ${data.candidateName}`,
    html: base(`
      <p>تم رفع مستند جديد يحتاج إلى مراجعتك:</p>
      <div class="highlight">
        <p><strong>المرشح:</strong> ${data.candidateName}</p>
        <p><strong>المستند:</strong> ${data.documentName}</p>
      </div>
      <p>يُرجى تسجيل الدخول إلى المنصة لمراجعة المستند والبت فيه.</p>
    `),
  };
}

export { candidateInvitation } from "./invitation";
