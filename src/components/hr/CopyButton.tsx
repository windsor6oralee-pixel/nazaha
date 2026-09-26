"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

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
    <Button
      variant="secondary"
      onClick={copy}
      aria-live="polite"
      className={className}
      leading={copied
        ? <Icon name="approved" size={20} label={false} style={{ color: "var(--success-500)" }} />
        : <Copy size={20} strokeWidth={1.75} aria-hidden />}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
