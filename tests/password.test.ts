import { describe, it, expect } from "vitest";
import { MIN_PASSWORD_LENGTH, generatePassword, validatePassword } from "@/lib/password";

// كلمة المرور تُنشأ في موضعين: إنشاء مشرف الجهة، وإعادة التعيين من بوابة المنصة.
// القاعدة واحدة، فتبقى هنا.

describe("validatePassword", () => {
  it("rejects a missing password", () => {
    expect(validatePassword("")).toBe("كلمة المرور مطلوبة");
    expect(validatePassword(null)).toBe("كلمة المرور مطلوبة");
    expect(validatePassword(undefined)).toBe("كلمة المرور مطلوبة");
  });

  it("rejects a password shorter than the minimum", () => {
    const short = "Aa1" + "x".repeat(MIN_PASSWORD_LENGTH - 4); // MIN-1 محرف
    expect(short).toHaveLength(MIN_PASSWORD_LENGTH - 1);
    expect(validatePassword(short)).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("rejects a password with no letter", () => {
    expect(validatePassword("1234567890")).toBe("كلمة المرور يجب أن تحتوي على حرف واحد على الأقل");
  });

  it("rejects a password with no digit", () => {
    expect(validatePassword("abcdefghijkl")).toBe("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل");
  });

  it("accepts a password that meets every rule", () => {
    expect(validatePassword("Nazaha@Test2026!")).toBeNull();
    expect(validatePassword("كلمةمرور2026")).toBeNull();
  });

  it("accepts exactly the minimum length", () => {
    const exact = "A".repeat(MIN_PASSWORD_LENGTH - 1) + "7";
    expect(exact).toHaveLength(MIN_PASSWORD_LENGTH);
    expect(validatePassword(exact)).toBeNull();
  });
});

describe("generatePassword", () => {
  it("never falls below the minimum length", () => {
    expect(generatePassword(4)).toHaveLength(MIN_PASSWORD_LENGTH);
    expect(generatePassword(24)).toHaveLength(24);
  });

  it("always satisfies the password policy", () => {
    for (let i = 0; i < 25; i++) {
      expect(validatePassword(generatePassword())).toBeNull();
    }
  });

  it("produces a different value on every call", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) seen.add(generatePassword());
    expect(seen.size).toBe(25);
  });

  it("contains a letter and a digit", () => {
    const pw = generatePassword();
    expect(pw).toMatch(/[A-Za-z]/);
    expect(pw).toMatch(/[0-9]/);
  });
});
