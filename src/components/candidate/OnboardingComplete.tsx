"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Star } from "lucide-react";

interface Props {
  candidateName: string;
  jobTitle: string;
  organization: string;
}

// Confetti particle — pure CSS animation, no external lib
function Confetti() {
  const particles = Array.from({ length: 28 });
  const colors = [
    "var(--color-gold)",
    "var(--color-primary)",
    "#A8D5B8",
    "#F9C74F",
    "#90E0EF",
    "#FFB4A2",
  ];
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
            borderRadius: i % 2 === 0 ? "50%" : 2,
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
    <div
      className={`relative rounded-2xl overflow-hidden mb-6 transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      style={{ background: "linear-gradient(135deg, #195C30 0%, var(--color-primary) 60%, #2D7A50 100%)" }}
    >
      <Confetti />

      <div className="relative z-10 px-6 py-8 text-center">
        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)" }}
        >
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-1.5 mb-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              className="w-5 h-5"
              fill="var(--color-gold)"
              style={{ color: "var(--color-gold)", animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          مبروك يا {candidateName.split(" ")[0]}! 🎉
        </h2>
        <p className="text-sm mb-1" style={{ color: "#C8E8D4" }}>
          أتممت جميع متطلبات التأهيل بنجاح
        </p>
        <p className="text-sm font-medium" style={{ color: "#A8D5B8" }}>
          {jobTitle} · {organization}
        </p>

        <div
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          <CheckCircle className="w-4 h-4" />
          جاهز لليوم الأول
        </div>
      </div>
    </div>
  );
}
