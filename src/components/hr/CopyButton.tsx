"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

/** Copies `value` to the clipboard with a short confirmation state. */
export function CopyButton({ value, label = "نسخ", copiedLabel = "تم النسخ", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API unavailable (insecure context / old browser): fall back to a selection copy.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${className}`}
      style={{
        background: copied ? "var(--color-success-bg)" : "var(--color-primary)",
        color: copied ? "var(--color-success)" : "#fff",
        transition: "background var(--motion-quick) var(--ease-standard), color var(--motion-quick) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)",
        cursor: "pointer",
        minHeight: 36,
        minWidth: 0,
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
