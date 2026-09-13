"use client";

import { useEffect, useRef } from "react";
import {
  FileText, PenLine, ShieldCheck, MessagesSquare, BarChart3, FileSignature, CheckCircle2,
} from "lucide-react";

/**
 * Landing "why Nazaha" section as a Bento grid. Motion is CSS-only: cards reveal
 * once when they scroll into view (IntersectionObserver toggles a class), hover
 * lifts them, and the illustrations loop softly. Honors prefers-reduced-motion via globals.css.
 */
export function BentoShowcase() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) { cards.forEach((c) => c.classList.add("is-visible")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section id="platform" ref={root} className="bento-section" aria-labelledby="bento-title">
      <div className="bento-inner">
        <div className="bento-head" data-reveal>
          <span className="bento-eyebrow">لماذا نزاهة التوظيف؟</span>
          <h2 id="bento-title" className="bento-title text-heading">منصة واحدة لرحلة ما بعد القبول كاملة</h2>
          <p className="bento-lead">
            من لحظة القبول إلى يوم المباشرة: مستندات، عقود، توقيع، وتواصل، في مكان واحد آمن ومعزول لكل جهة.
          </p>
        </div>

        <div className="bento-grid">
          {/* 1 — documents (large) */}
          <article className="bento-card bento-span-2 bento-row-2" data-reveal style={{ "--i": 0 } as React.CSSProperties}>
            <div className="bento-icon"><FileText /></div>
            <h3>تتبع المستندات لحظة بلحظة</h3>
            <p>يرفع المرشح مستنداته، وتراجعها الموارد البشرية باعتماد أو رفض مسبّب، مع حالة واضحة لكل ملف.</p>
            <ul className="bento-docs" aria-hidden>
              {[
                { n: "الهوية الوطنية", w: 100, ok: true },
                { n: "الشهادة الجامعية", w: 100, ok: true },
                { n: "شهادة الخبرة", w: 62, ok: false },
                { n: "الحساب البنكي (IBAN)", w: 28, ok: false },
              ].map((d, i) => (
                <li key={d.n} style={{ "--i": i } as React.CSSProperties}>
                  <span className="bento-doc-name">{d.ok && <CheckCircle2 />}{d.n}</span>
                  <span className="bento-bar"><span className="bento-bar-fill" style={{ "--w": `${d.w}%` } as React.CSSProperties} /></span>
                </li>
              ))}
            </ul>
          </article>

          {/* 2 — e-signature */}
          <article className="bento-card" data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <div className="bento-icon"><PenLine /></div>
            <h3>توقيع إلكتروني موثّق</h3>
            <p>يُجمَّد نص العقد ببصمة رقمية، ويسجَّل كل توقيع بوقته ومصدره.</p>
            <div className="bento-sign" aria-hidden><span className="bento-sign-stroke" /></div>
          </article>

          {/* 3 — isolation */}
          <article className="bento-card" data-reveal style={{ "--i": 2 } as React.CSSProperties}>
            <div className="bento-icon"><ShieldCheck /></div>
            <h3>عزل تام بين الجهات</h3>
            <p>كل جهة ترى بياناتها فقط، بحماية على مستوى قاعدة البيانات لا على مستوى الواجهة.</p>
            <div className="bento-shield" aria-hidden><span /><span /><span /></div>
          </article>

          {/* 4 — preboarding hub (wide) */}
          <article className="bento-card bento-span-2" data-reveal style={{ "--i": 3 } as React.CSSProperties}>
            <div className="bento-icon"><MessagesSquare /></div>
            <h3>مركز ما قبل المباشرة</h3>
            <p>قناة تواصل مباشرة بين المرشح والموارد البشرية قبل اليوم الأول: أسئلة، ملفات، وتذكيرات.</p>
            <div className="bento-chat" aria-hidden>
              <span className="bento-bubble bento-bubble-hr">أهلاً بك! تبقّى مستند واحد قبل المباشرة.</span>
              <span className="bento-bubble bento-bubble-cand">تم رفعه الآن، شكراً لكم.</span>
              <span className="bento-bubble bento-bubble-hr">اعتُمد. نراك الأحد القادم.</span>
            </div>
          </article>

          {/* 5 — reports */}
          <article className="bento-card" data-reveal style={{ "--i": 4 } as React.CSSProperties}>
            <div className="bento-icon"><BarChart3 /></div>
            <h3>تقارير وتحليلات</h3>
            <p>نسب الإنجاز، المستندات المتأخرة، والحقول المخصصة لجهتك في تقارير قابلة للتصدير.</p>
            <div className="bento-chart" aria-hidden>
              {[38, 64, 52, 86, 70].map((h, i) => <span key={i} style={{ "--h": `${h}%`, "--i": i } as React.CSSProperties} />)}
            </div>
          </article>

          {/* 6 — contract templates */}
          <article className="bento-card" data-reveal style={{ "--i": 5 } as React.CSSProperties}>
            <div className="bento-icon"><FileSignature /></div>
            <h3>عقود من قوالب جهتك</h3>
            <p>قوالب عقود بهوية الجهة وحقولها، تُولَّد للمرشح بضغطة واحدة.</p>
            <div className="bento-lines" aria-hidden><span /><span /><span /></div>
          </article>
        </div>
      </div>
    </section>
  );
}
