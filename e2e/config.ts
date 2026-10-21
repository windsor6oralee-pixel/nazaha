import path from "node:path";

/**
 * إعدادات مشتركة لاختبارات المتصفح.
 *
 * لا كلمة مرور افتراضية هنا عمداً: كلمة مرور حسابات الاختبار تُمرَّر من
 * البيئة دائماً (`TEST_PASSWORD`)، فلا تُحفظ في المستودع ولا في سجلات CI.
 */

/** متغيّر إلزامي — لا قيمة افتراضية. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — the e2e suite never ships a default password. ` +
        `Set it in your shell (or .env.local) and re-run.`
    );
  }
  return value;
}

/** الوجهة التي تُختبر عليها — خادم محلي افتراضياً. */
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3002";

/** مجلد لقطات الشاشة. */
export const OUT_DIR = path.resolve(process.env.E2E_OUT_DIR ?? "screenshots/roles");

/** كلمة المرور المشتركة لحسابات الاختبار — من البيئة فقط. */
export const PASSWORD = required("TEST_PASSWORD");

/**
 * كلمة مرور مشغّل المنصة.
 *
 * قد تكون منفصلة عن كلمة مرور موظفي الجهات: كلمة مرور المشغّل تُسلَّم
 * لصاحبه وتُدوَّر وحدها، فلا يُفترض أن تساوي كلمة موظف.
 */
export const PLATFORM_PASSWORD = process.env.TEST_PLATFORM_PASSWORD ?? PASSWORD;

/** كلمة مرور موظفي الجهات. */
export const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD ?? PASSWORD;

/**
 * حساب المرشح.
 *
 * المرشح يدخل بحساب دائم (بريد + كلمة مرور)، فلم يعد له رمز دعوة في الاختبار.
 * كلمة مروره قد تكون منفصلة — كغيره من الأدوار.
 */
export const CANDIDATE_EMAIL =
  process.env.TEST_CANDIDATE_EMAIL ?? "ahmed.omari@example.com";

export const CANDIDATE_PASSWORD = process.env.TEST_CANDIDATE_PASSWORD ?? PASSWORD;

/** حساب مشغّل المنصة. */
export const PLATFORM_EMAIL = process.env.TEST_PLATFORM_EMAIL ?? "platform@nazaha.sa";

/** حساب موظف جهة (مدير النظام). */
export const HR_EMAIL = process.env.HR_EMAIL ?? "admin@mof.gov.sa";

/** المرشح الذي تدور عليه اختبارات البوابة. */
export const CANDIDATE_NAME = "أحمد محمد العمري";
