import Image from "next/image";

interface NazahaLogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { logo: 32, title: "text-sm",  subtitle: "text-xs" },
  md: { logo: 44, title: "text-base", subtitle: "text-xs" },
  lg: { logo: 56, title: "text-xl",  subtitle: "text-sm" },
};

export function NazahaLogo({ variant = "dark", size = "md" }: NazahaLogoProps) {
  const s = sizes[size];
  const isLight = variant === "light";
  const titleColor  = isLight ? "#FFFFFF" : "var(--color-primary-dark)";
  const subtitleColor = isLight ? "rgba(255,255,255,0.65)" : "var(--color-text-muted)";

  return (
    <div className="flex items-center gap-2.5" dir="rtl">
      {/* On dark surfaces the mark's own greens vanish into the background; the plate restores contrast. */}
      <span className={isLight ? "logo-plate logo-plate-sm" : "inline-flex"} style={{ flexShrink: 0 }}>
        <Image
          src="/nazaha-logo.png"
          alt="شعار نزاهة التوظيف"
          width={s.logo}
          height={s.logo}
          priority
          style={{ objectFit: "contain", flexShrink: 0, display: "block" }}
        />
      </span>
      <div>
        <p className={`font-bold leading-tight ${s.title} text-heading`}
          style={{ color: titleColor }}>
          نزاهة التوظيف
        </p>
        <p className={`leading-none mt-0.5 ${s.subtitle}`}
          style={{ color: subtitleColor, fontFamily: "'Inter', sans-serif", letterSpacing: "0.01em" }}>
          Nazaha Employment
        </p>
      </div>
    </div>
  );
}
