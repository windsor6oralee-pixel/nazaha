import { describe, it, expect } from "vitest";
import {
  DEFAULT_COUNTRY_CODE,
  formatPhoneDisplay,
  normalizeWhatsappNumber,
  whatsappGreeting,
  whatsappLink,
} from "@/lib/whatsapp";

// رقم التواصل يُدخله موظف الجهة بأي صيغة، لكن wa.me يحتاج رقما دوليا بلا رموز.

describe("normalizeWhatsappNumber", () => {
  it.each([
    ["0501234567", "966501234567"],          // جوال محلي بصفر
    ["+966501234567", "966501234567"],       // دولي جاهز
    ["966 50 123 4567", "966501234567"],     // دولي بشرطات
    ["00966501234567", "966501234567"],      // بادئة 00
    ["050 123 4567", "966501234567"],        // محلي بشرطات
    ["(050) 123-4567", "966501234567"],      // محلي بأقواس
    [" 0501234567 ", "966501234567"],        // مسافات
    ["0114567890", "966114567890"],          // أرضي
  ])("normalises %j", (raw, expected) => {
    expect(normalizeWhatsappNumber(raw)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "   ",
    "abc",
    "123",              // أقصر من الحد الأدنى
    "1234567890123456789", // أطول من الحد الأقصى
  ])("rejects %j", (bad) => {
    expect(normalizeWhatsappNumber(bad)).toBeNull();
  });

  it("uses the default Saudi country code", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("966");
    expect(normalizeWhatsappNumber("0501234567")).toBe("966501234567");
  });

  it("honours another country code", () => {
    expect(normalizeWhatsappNumber("0501234567", "971")).toBe("971501234567");
    expect(normalizeWhatsappNumber("+971501234567", "971")).toBe("971501234567");
  });
});

describe("whatsappLink", () => {
  it("builds a plain link", () => {
    expect(whatsappLink("0501234567")).toBe("https://wa.me/966501234567");
  });

  it("encodes the prefilled message", () => {
    const link = whatsappLink("0501234567", { message: "السلام عليكم" });
    expect(link).toBe(`https://wa.me/966501234567?text=${encodeURIComponent("السلام عليكم")}`);
  });

  it("returns null for an invalid number", () => {
    expect(whatsappLink("abc")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });
});

describe("formatPhoneDisplay", () => {
  it("formats the international number for display", () => {
    expect(formatPhoneDisplay("966501234567")).toBe("+966 50 123 4567");
  });

  it("does not duplicate the country code", () => {
    expect(formatPhoneDisplay("966501234567")).not.toContain("966966");
  });
});

describe("whatsappGreeting", () => {
  it("mentions the candidate and the organisation", () => {
    const msg = whatsappGreeting({ candidateName: "أحمد العمري", orgName: "وزارة المالية" });
    expect(msg).toContain("أحمد العمري");
    expect(msg).toContain("وزارة المالية");
  });

  it("works without a name or organisation", () => {
    const msg = whatsappGreeting({ candidateName: null, orgName: null });
    expect(msg).toContain("مرشح");
    expect(msg.length).toBeGreaterThan(0);
  });
});
