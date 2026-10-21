import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  formatPhoneDisplay,
  normalizeWhatsappNumber,
  whatsappGreeting,
  whatsappLink,
} from "@/lib/whatsapp";

/*
 * تواصل المرشح عبر واتساب.
 *
 * الرقم يخص الجهة (tenant) ويقرأ من `Organization.contactPhone`، فلا يتسرب بين
 * الجهات. يظهر هذا العنصر بعد دخول المرشح بحسابه فقط — لا على صفحة
 * الدخول العامة.
 */

const WHATSAPP_GREEN = "#25D366";
const WHATSAPP_DARK = "#128C7E";

interface Props {
  /** رقم التواصل كما أدخلته الجهة. */
  phone: string | null | undefined;
  orgName?: string | null;
  candidateName?: string | null;
  /** card: بطاقة كاملة في الصفحة. pill: زر مختصر في القائمة الجانبية. */
  variant?: "card" | "pill";
}

export function WhatsAppContact({ phone, orgName, candidateName, variant = "card" }: Props) {
  const digits = normalizeWhatsappNumber(phone);
  // الجهة التي لم تسجل رقما لا يظهر لها الزر — لا رابط مكسور ولا رقم فارغ.
  if (!digits) return null;

  const href = whatsappLink(digits, {
    message: whatsappGreeting({ candidateName, orgName }),
  })!;

  if (variant === "pill") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors"
        style={{
          background: "rgba(37,211,102,0.14)",
          color: "#B8F5D0",
          border: "1px solid rgba(37,211,102,0.35)",
        }}
      >
        <MessageCircle size={16} aria-hidden style={{ color: WHATSAPP_GREEN, flexShrink: 0 }} />
        <span>تواصل عبر واتساب</span>
      </a>
    );
  }

  return (
    <Card
      className="nz-whatsapp"
      title={
        <span className="inline-flex items-center gap-2">
          <MessageCircle size={22} aria-hidden style={{ color: WHATSAPP_DARK }} />
          تواصل معنا عبر واتساب
        </span>
      }
      description={
        orgName
          ? `تواصل مباشرةً مع فريق ${orgName} لأي استفسار عن إجراءات الانضمام والمسندات.`
          : "تواصل مباشرةً مع فريق الموارد البشرية لأي استفسار عن إجراءات الانضمام والمسندات."
      }
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.01]"
        style={{
          background: WHATSAPP_GREEN,
          color: "#05340F",
          minHeight: 52,
          boxShadow: "0 2px 10px rgba(37,211,102,0.35)",
        }}
      >
        <MessageCircle size={20} aria-hidden />
        <span>افتح المحادثة على واتساب</span>
      </a>

      <p
        dir="ltr"
        className="text-center mt-3 text-xs"
        style={{ color: "var(--ink-muted)", fontFamily: "var(--font-latin)", letterSpacing: "0.06em" }}
      >
        {formatPhoneDisplay(digits)}
      </p>
    </Card>
  );
}
