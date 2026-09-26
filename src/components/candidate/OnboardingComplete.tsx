"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface Props {
  candidateName: string;
  jobTitle: string;
  organization: string;
}

// Confetti particle — pure CSS animation, no external lib (reduced motion hides it in globals.css)
function Confetti() {
  const particles = Array.from({ length: 28 });
  const colors = ["var(--green-700)", "var(--gold-500)", "var(--gold-200)"];
  return (
    <div className="confetti-container" aria-hidden>
      {particles.map((_, i) => (
        <span
          key={i}
          className="confetti-particle"
          style={{
            left: `${(i / particles.length) * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i * 0.07).toFixed(2)}s`,
            animationDuration: `${1.2 + (i % 4) * 0.3}s`,
            width: i % 3 === 0 ? 10 : 7,
            height: i % 3 === 0 ? 10 : 14,
            borderRadius: i % 2 === 0 ? "var(--radius-full)" : 2,
          }}
        />
      ))}
    </div>
  );
}

export function OnboardingComplete({ candidateName, jobTitle, organization }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Small delay so the animation runs after the DOM is painted
    const t = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-20 bg-green-900 text-ink-invert"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(16px)",
        transition: "opacity var(--motion-slow) var(--ease-enter), transform var(--motion-slow) var(--ease-enter)",
      }}
    >
      <Confetti />

      <div className="relative text-center" style={{ zIndex: 1, padding: "var(--space-48) var(--space-24)" }}>
        {/* Success icon */}
        <div
          className="flex items-center justify-center mx-auto text-gold-500"
          style={{
            width: 80,
            height: 80,
            borderRadius: "var(--radius-full)",
            border: "2px solid var(--gold-500)",
            marginBottom: "var(--space-24)",
          }}
        >
          <Icon name="approved" size={48} label={false} />
        </div>

        <h2 className="ds-heading" style={{ margin: "0 0 var(--space-8)", color: "var(--ink-invert)" }}>
          مبروك يا {candidateName.split(" ")[0]}!
        </h2>
        <p style={{ margin: 0, opacity: 0.85 }}>أتممت جميع متطلبات التأهيل بنجاح</p>
        <p style={{ margin: 0, fontWeight: 500, opacity: 0.85 }}>
          {jobTitle} · {organization}
        </p>

        <div
          className="inline-flex items-center gap-2 bg-gold-200 text-ink"
          style={{
            marginTop: "var(--space-24)",
            padding: "var(--space-8) var(--space-16)",
            borderRadius: "var(--radius-full)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <Icon name="approved" size={16} label={false} />
          جاهز لليوم الأول
        </div>
      </div>
    </section>
  );
}
