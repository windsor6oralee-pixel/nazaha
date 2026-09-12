import { cn } from "@/lib/utils";
import type React from "react";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ children, className, style }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        className
      )}
      style={{
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
        transition: "background 200ms var(--ease-standard), color 200ms var(--ease-standard)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
