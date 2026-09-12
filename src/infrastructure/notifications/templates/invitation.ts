/**
 * Candidate invitation email — official Nazaha brand.
 * Dark green header #013A2B, gold accent #C9A94A.
 */

export function candidateInvitation(data: {
  candidateName: string;
  jobTitle: string;
  department: string;
  organizationName: string;
  rawToken: string;
  loginUrl: string;
  expiresInDays?: number;
}): { subject: string; html: string } {
  const days = data.expiresInDays ?? 30;

  return {
    subject: `مرحباً ${data.candidateName} — دعوة الانضمام إلى ${data.organizationName}`,
    html: `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>دعوة الانضمام — نزاهة التوظيف</title>
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
  .header-brand {
    color: #FFFFFF;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin: 0;
  }
  .header-sub {
    color: rgba(255,255,255,0.55);
    font-size: 12px;
    margin: 4px 0 0;
    font-family: Arial, sans-serif;
    direction: ltr;
    text-align: right;
  }

  /* Card */
  .card {
    background: #FFFFFF;
    border-radius: 0 0 20px 20px;
    padding: 36px 32px;
    border: 1px solid #DDD9CE;
    border-top: none;
  }

  /* Gold divider */
  .divider {
    width: 48px; height: 3px;
    background: #C9A94A;
    border-radius: 9999px;
    margin-bottom: 20px;
  }

  .greeting {
    font-size: 24px;
    font-weight: 700;
    color: #013A2B;
    margin: 0 0 8px;
  }
  .body-text {
    font-size: 15px;
    line-height: 1.75;
    color: #4A4A4A;
    margin: 0 0 24px;
  }

  /* Info box */
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

  /* Token box */
  .token-label {
    font-size: 13px;
    font-weight: 600;
    color: #013A2B;
    margin-bottom: 10px;
  }
  .token-box {
    background: #013A2B;
    border-radius: 12px;
    padding: 20px 24px;
    text-align: center;
    margin-bottom: 8px;
    position: relative;
    overflow: hidden;
  }
  .token-box::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(to right, #C9A94A, #E8D27A, #C9A94A);
  }
  .token-value {
    font-family: 'Courier New', Courier, monospace;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 4px;
    color: #E8D27A;
    direction: ltr;
    word-break: break-all;
  }
  .token-hint {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    margin-top: 8px;
    direction: rtl;
  }

  /* CTA Button */
  .cta-wrap { text-align: center; margin: 28px 0 24px; }
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
  .steps-title {
    font-size: 14px;
    font-weight: 700;
    color: #013A2B;
    margin-bottom: 12px;
  }
  .step {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  .step-num {
    width: 24px; height: 24px; flex-shrink: 0;
    background: #C9A94A;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #013A2B;
  }
  .step-text { font-size: 13px; color: #4A4A4A; line-height: 1.6; padding-top: 3px; }

  /* Warning */
  .warning {
    background: #FBF6E4;
    border: 1px solid rgba(196,143,30,0.3);
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 12px;
    color: #7A5500;
    margin-top: 24px;
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

  <!-- Header -->
  <div class="header">
    <div class="header-bar"></div>
    <p class="header-brand">نزاهة التوظيف</p>
    <p class="header-sub">Nazaha Employment Platform</p>
  </div>

  <!-- Card -->
  <div class="card">
    <div class="divider"></div>
    <h1 class="greeting">مرحباً، ${data.candidateName}</h1>
    <p class="body-text">
      يسرّنا إعلامك بقبول طلبك الوظيفي في <strong>${data.organizationName}</strong>.
      تم إنشاء ملفك الرقمي على منصة نزاهة التوظيف لإتمام إجراءات الانضمام خطوةً بخطوة.
    </p>

    <!-- Job info -->
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">المسمى الوظيفي</span>
        <span class="info-value">${data.jobTitle}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الإدارة / القسم</span>
        <span class="info-value">${data.department}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الجهة</span>
        <span class="info-value">${data.organizationName}</span>
      </div>
    </div>

    <!-- Token -->
    <p class="token-label">🔑 رمز الدخول الخاص بك</p>
    <div class="token-box">
      <div class="token-value">${data.rawToken}</div>
      <div class="token-hint">انسخ هذا الرمز والصقه في صفحة الدخول</div>
    </div>

    <!-- CTA -->
    <div class="cta-wrap">
      <a href="${data.loginUrl}" class="cta-btn">الدخول إلى ملفي ←</a>
    </div>

    <!-- Steps -->
    <p class="steps-title">كيف تبدأ؟</p>
    <div class="step">
      <div class="step-num">١</div>
      <div class="step-text">افتح الرابط أعلاه أو اذهب إلى <strong>${data.loginUrl.replace(/\?.*/, "")}</strong></div>
    </div>
    <div class="step">
      <div class="step-num">٢</div>
      <div class="step-text">الصق رمز الدخول في الحقل المخصص واضغط «الدخول إلى ملفي»</div>
    </div>
    <div class="step">
      <div class="step-num">٣</div>
      <div class="step-text">اتبع الخطوات لرفع مستنداتك وإتمام إجراءات الانضمام</div>
    </div>

    <!-- Warning -->
    <div class="warning">
      ⏳ هذا الرمز صالح لمدة <strong>${days} يوماً</strong> — يُرجى الدخول في أقرب وقت ممكن.
      إذا انتهت صلاحيته، تواصل مع الموارد البشرية في جهتك للحصول على رمز جديد.
    </div>
  </div>

  <!-- Footer -->
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
