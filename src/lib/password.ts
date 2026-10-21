/*
 * سياسة كلمة المرور.
 *
 * القاعدة واحدة في الموضعين: إنشاء مشرف الجهة (provisioning) وإعادة تعيين
 * كلمة المرور من بوابة المنصة. لذلك تعيش هنا بدل أن تتكرر في الواجهة.
 */

/** الحد الأدنى لطول كلمة المرور. */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * يتحقق من قوة كلمة المرور.
 * يعيد رسالة خطأ عربية، أو null إذا كانت مقبولة.
 */
export function validatePassword(password: string | null | undefined): string | null {
  if (!password) return "كلمة المرور مطلوبة";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`;
  }
  if (!/[A-Za-z\u0600-\u06FF]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل";
  }
  if (!/[0-9]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
  }
  return null;
}

// بلا أحرف متشابهة (l/1/I/O/0) — تقلّل أخطاء النسخ اليدوي.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";

/** اختيار محايد التحيّز من مصفوفة بايتات عشوائية. */
function pick(bytes: Uint8Array, cursor: { i: number }, set: string): string {
  const limit = 256 - (256 % set.length);
  while (cursor.i < bytes.length) {
    const v = bytes[cursor.i++];
    if (v >= limit) continue; // يُرفض حتى لا يميل التوزيع
    return set[v % set.length];
  }
  return set[0];
}

/**
 * يولّد كلمة مرور عشوائية قوية.
 * تُعرض مرة واحدة لمشغّل المنصة لنسخها وتسليمها لصاحب الحساب.
 */
export function generatePassword(length = 16): string {
  const size = Math.max(length, MIN_PASSWORD_LENGTH);
  const bytes = new Uint8Array(size * 4);
  globalThis.crypto.getRandomValues(bytes);
  const cursor = { i: 0 };

  const chars: string[] = [];
  // حرف ورقم أولاً حتى تستوفي السياسة دائماً مهما كان التوليد.
  chars.push(pick(bytes, cursor, LETTERS));
  chars.push(pick(bytes, cursor, DIGITS));
  while (chars.length < size) chars.push(pick(bytes, cursor, ALPHABET));

  // خلط المواضع حتى لا يكون أول حرفين ثابتين.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
