import { Sparkles } from "lucide-react";

interface WelcomeMessageProps {
  firstName: string;
  department: string;
  jobTitle: string;
}

export function WelcomeMessage({ firstName, department, jobTitle }: WelcomeMessageProps) {
  return (
    <div
      className="rounded-2xl p-5 mb-2"
      style={{
        background: "linear-gradient(135deg, var(--color-beige) 0%, #EEE8D8 100%)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-gold)", opacity: 0.9 }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold mb-1" style={{ color: "var(--color-dark)" }}>
            أهلاً بك يا {firstName}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            يسعدنا انضمامك إلى فريق <strong style={{ color: "var(--color-dark)" }}>{department}</strong>{" "}
            بوصفك <strong style={{ color: "var(--color-dark)" }}>{jobTitle}</strong>.
            نتطلع لبدء مسيرتك المهنية معنا — أكمل الخطوات أدناه للتجهيز ليومك الأول.
          </p>
          <p className="text-xs mt-2.5 font-medium" style={{ color: "var(--color-primary)" }}>
            — إدارة الموارد البشرية
          </p>
        </div>
      </div>
    </div>
  );
}
