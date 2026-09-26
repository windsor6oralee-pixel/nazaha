import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* شريط التقدم: مسار surface-200 بارتفاع 8 بكسل وتعبئة green-700، التحديث 400ms. */
export function Progress({
  value, label, showValue = true, className,
}: { value: number; label?: ReactNode; showValue?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="nz-progress__row">
          <span>{label}</span>
          {showValue && <span className="nz-progress__val">{v}%</span>}
        </div>
      )}
      <div className="nz-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={typeof label === "string" ? label : "نسبة الإنجاز"}>
        <div className="nz-progress__bar" style={{ transform: `scaleX(${v / 100})` }} />
      </div>
    </div>
  );
}

/* هيكل التحميل: surface-200 مع لمعان أفقي 1200ms. */
export function Skeleton({
  width = "100%", height = 16, radius, className, style,
}: { width?: CSSProperties["width"]; height?: CSSProperties["height"]; radius?: CSSProperties["borderRadius"]; className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn("nz-skel", className)} style={{ width, height, borderRadius: radius, ...style }} />;
}
