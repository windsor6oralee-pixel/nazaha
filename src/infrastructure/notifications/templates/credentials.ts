/**
 * Candidate credentials email — official Nazaha brand.
 * Delivers a ready-to-use username (email) + generated password instead of an
 * activation token. The two values sit in `user-select: all` blocks so a single
 * click/tap in any client selects the whole string for copy-paste.
 */

export function candidateCredentials(data: {
  candidateName: string;
  jobTitle: string;
  department: string;
  organizationName: string;
  loginEmail: string;
  password: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const siteUrl   = data.loginUrl.replace(/\/$/, "");
  const loginPage = `${siteUrl}/auth/candidate`;

  return {
    subject: `مرحباً ${data.candidateName} — بيانات دخولك إلى ${data.organizationName}`,
    html: `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>بيانات الدخول — نزاهة التوظيف</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    background: #F4F2EC;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    direction: rtl;
    color: #1A1A1A;
  }
  .wrapper { max-width: 600px; margin: 32px auto; padding: 0 16px 48px; }

  /* Header */
  .header {
    background: #013A2B;
    border-radius: 20px 20px 0 0;
    padding: 28px 32px;
    position: relative;
    overflow: hidden;
  }
  .header-bar {
    position: absolute; top: 0; left: 0; right: 0;
    height: 4px; background: #C9A94A;
  }
  .header-brand { color: #FFFFFF; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin: 0; }
  .header-sub   { color: rgba(255,255,255,0.55); font-size: 12px; margin: 4px 0 0; font-family: Arial, sans-serif; direction: ltr; text-align: right; }

  /* Card */
  .card {
    background: #FFFFFF;
    border-radius: 0 0 20px 20px;
    padding: 36px 32px;
    border: 1px solid #DDD9CE;
    border-top: none;
  }
  .divider { width: 48px; height: 3px; background: #C9A94A; border-radius: 9999px; margin-bottom: 20px; }

  .greeting  { font-size: 24px; font-weight: 700; color: #013A2B; margin: 0 0 8px; }
  .body-text { font-size: 15px; line-height: 1.75; color: #4A4A4A; margin: 0 0 24px; }

  /* Job info */
  .info-box {
    background: #E6F0E9;
    border: 1px solid rgba(25,92,48,0.2);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 28px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    padding: 5px 0;
    border-bottom: 1px solid rgba(25,92,48,0.1);
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #6E7673; }
  .info-value { color: #013A2B; font-weight: 600; }

  /* Credentials block */
  .creds-label {
    font-size: 13px; font-weight: 600; color: #013A2B;
    margin: 0 0 8px;
  }
  .cred-box {
    background: #013A2B;
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 10px;
    position: relative;
    overflow: hidden;
  }
  .cred-box::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(to right, #C9A94A, #E8D27A, #C9A94A);
  }
  .cred-caption {
    font-size: 11px;
    color: rgba(255,255,255,0.55);
    margin: 0 0 6px;
    direction: rtl;
  }
  .cred-value {
    font-family: 'Courier New', Courier, monospace;
    font-size: 18px;
    font-weight: 700;
    color: #E8D27A;
    direction: ltr;
    unicode-bidi: isolate;
    text-align: center;
    word-break: break-all;
    letter-spacing: 1px;
    /* One click/tap selects the entire string — easy copy-paste in any mail client. */
    -webkit-user-select: all;
    -moz-user-select: all;
    -ms-user-select: all;
    user-select: all;
    cursor: text;
  }
  .ltr-inline {
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
    text-align: left;
  }
  .copy-hint {
    font-size: 11px; color: #6E7673; margin: 0 0 20px; text-align: center;
  }

  /* CTA */
  .cta-wrap { text-align: center; margin: 20px 0 24px; }
  .cta-btn {
    display: inline-block;
    background: #195C30;
    color: #FFFFFF !important;
    text-decoration: none;
    font-size: 15px;
    font-weight: 700;
    padding: 14px 40px;
    border-radius: 12px;
    letter-spacing: 0.3px;
  }

  /* Steps */
  .steps-title { font-size: 14px; font-weight: 700; color: #013A2B; margin: 20px 0 12px; }
  .step        { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .step-num    { width: 24px; height: 24px; flex-shrink: 0; background: #C9A94A; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #013A2B; }
  .step-text   { font-size: 13px; color: #4A4A4A; line-height: 1.6; padding-top: 3px; }

  /* Warning */
  .warning {
    background: #FBF6E4;
    border: 1px solid rgba(196,143,30,0.3);
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 12px;
    color: #7A5500;
    margin-top: 24px;
    line-height: 1.6;
  }

  /* Footer */
  .footer {
    text-align: center;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid #DDD9CE;
    font-size: 11px;
    color: #9E9E9E;
    line-height: 1.8;
  }
  .footer a { color: #195C30; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <div class="header-bar"></div>
    <p class="header-brand">نزاهة التوظيف</p>
    <p class="header-sub">Nazaha Employment Platform</p>
  </div>

  <div class="card">
    <div class="divider"></div>
    <h1 class="greeting">مرحباً، ${data.candidateName}</h1>
    <p class="body-text">
      يسرّنا إعلامك بقبول طلبك الوظيفي في <strong>${data.organizationName}</strong>.
      أُنشئ لك حساب دخول على منصة نزاهة التوظيف، وفيما يلي بيانات الدخول الخاصة بك.
    </p>

    <div class="info-box">
      <div class="info-row"><span class="info-label">المسمى الوظيفي</span><span class="info-value">${escapeHtml(data.jobTitle)}</span></div>
      <div class="info-row"><span class="info-label">الإدارة / القسم</span><span class="info-value">${escapeHtml(data.department)}</span></div>
      <div class="info-row"><span class="info-label">الجهة</span><span class="info-value">${escapeHtml(data.organizationName)}</span></div>
    </div>

    <p class="creds-label">🔐 بيانات الدخول الخاصة بك</p>

    <div class="cred-box">
      <p class="cred-caption">اسم المستخدم (البريد)</p>
      <div class="cred-value" dir="ltr">${escapeHtml(data.loginEmail)}</div>
    </div>

    <div class="cred-box">
      <p class="cred-caption">كلمة المرور</p>
      <div class="cred-value" dir="ltr">${escapeHtml(data.password)}</div>
    </div>

    <p class="copy-hint">
      اضغط على البريد أو كلمة المرور لتحديدهما ثم انسخ (Ctrl/Cmd + C) والصق في صفحة الدخول.
    </p>

    <div class="cta-wrap">
      <a href="${loginPage}" class="cta-btn">فتح صفحة الدخول ←</a>
    </div>

    <p class="steps-title">كيف تدخل؟</p>
    <div class="step"><div class="step-num">١</div><div class="step-text">افتح صفحة الدخول: <strong class="ltr-inline">${loginPage}</strong></div></div>
    <div class="step"><div class="step-num">٢</div><div class="step-text">الصق البريد في «اسم المستخدم» وكلمة المرور في حقلها</div></div>
    <div class="step"><div class="step-num">٣</div><div class="step-text">اضغط «دخول» وتابع خطوات الانضمام في بوابتك</div></div>

    <div class="warning">
      🔒 هذه كلمة مرور مؤقتة أُنشئت لك خصيصاً. يُنصح بتغييرها من إعدادات حسابك فور أول دخول.
      لا تُشاركها مع أي شخص، ولن يطلبها منك موظف الموارد البشرية أو فريق الدعم.
    </div>
  </div>

  <div class="footer">
    <p>هذا البريد أُرسل تلقائياً من منصة نزاهة التوظيف — يُرجى عدم الرد عليه مباشرةً.</p>
    <p>في حال لم تكن تتوقع هذا البريد، يُرجى التواصل مع جهتك الحكومية.</p>
    <p style="margin-top:8px; color:#C9A94A;">نزاهة · ثقة · كفاءة · انطلاقة</p>
  </div>

</div>
</body>
</html>`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
