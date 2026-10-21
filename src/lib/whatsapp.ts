/*
 * روابط واتساب.
 *
 * Each tenant stores its own contact number on `Organization.contactPhone` in
 * whatever format its staff typed it (0501234567, +966 50 123 4567, 00966501234567…).
 * wa.me needs a digits-only international number, so it is normalised here —
 * once — instead of at every call site.
 */

/** رمز الدولة الافتراضي (السعودية). */
export const DEFAULT_COUNTRY_CODE = "966";

/** WhatsApp يقبل أرقاما دولية من 8 إلى 15 رقما. */
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/**
 * يحوّل أي صيغة هاتفية إلى رقم دولي بلا رموز.
 * يعيد null إذا لم يكن الرقم صالحا للواتساب.
 */
export function normalizeWhatsappNumber(
  raw: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!raw) return null;

  const cc = countryCode.replace(/\D/g, "") || DEFAULT_COUNTRY_CODE;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // 00966… → 966…
  if (digits.startsWith("00")) digits = digits.slice(2);

  // رقم دولي جاهز؟ لا نلمسه. غير ذلك نضيف رمز الدولة ونزيل الصفر المحلي.
  if (!(digits.startsWith(cc) && digits.length >= 10)) {
    digits = digits.startsWith("0") ? cc + digits.slice(1) : cc + digits;
  }

  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? digits : null;
}

/**
 * يبني رابط wa.me مع رسالة جاهزة.
 * يعيد null إذا كان الرقم غير صالح.
 */
export function whatsappLink(
  raw: string | null | undefined,
  options: { message?: string; countryCode?: string } = {},
): string | null {
  const digits = normalizeWhatsappNumber(raw, options.countryCode);
  if (!digits) return null;

  const message = options.message?.trim();
  return message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`;
}

/** صيغة للعرض فقط: ‎+966 50 123 4567. */
export function formatPhoneDisplay(digits: string, countryCode: string = DEFAULT_COUNTRY_CODE): string {
  const cc = countryCode.replace(/\D/g, "") || DEFAULT_COUNTRY_CODE;
  const rest = digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  if (!rest) return `+${cc}`;
  // تجميع سعودي: 2 ثم 3 ثم الباقي.
  return `+${cc} ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`.trim();
}

/** الرسالة الافتتاحية التي تُرسل تلقائيا مع محادثة المرشح. */
export function whatsappGreeting(opts: { candidateName?: string | null; orgName?: string | null }): string {
  const who = opts.candidateName?.trim() ? `أنا ${opts.candidateName.trim()}` : "أنا مرشح";
  const org = opts.orgName?.trim() ? ` في ${opts.orgName.trim()}` : "";
  return `السلام عليكم، ${who}${org}. أود الاستفسار عن إجراءات الانضمام للعمل والمسندات المطلوبة.`;
}
