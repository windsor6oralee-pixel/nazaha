"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Megaphone, Send, Check, Loader2, Info, AlertTriangle, CalendarClock } from "lucide-react";

type DirectiveType = "INFO" | "URGENT" | "APPOINTMENT";

interface Directive {
  id: string;
  type: DirectiveType;
  title: string;
  body: string;
  allowReply: boolean;
  notifyByEmail: boolean;
  candidateReply: string | null;
  candidateReadAt: string | null;
  candidateRepliedAt: string | null;
  createdByName: string;
  updatedAt: string;
}

const TONE: Record<DirectiveType, { accent: string; chipBg: string; Icon: typeof Info; label: string; gradient: string }> = {
  INFO:        { accent: "#013A2B", chipBg: "#E6F0E9", Icon: Megaphone,     label: "رسالة",       gradient: "linear-gradient(135deg,#F0F7F2 0%,#FFFFFF 60%)" },
  URGENT:      { accent: "#A83A30", chipBg: "#FAECEB", Icon: AlertTriangle, label: "عاجل",         gradient: "linear-gradient(135deg,#FBEDEC 0%,#FFFFFF 60%)" },
  APPOINTMENT: { accent: "#C9A94A", chipBg: "#FBF6E4", Icon: CalendarClock, label: "موعد / تذكير",  gradient: "linear-gradient(135deg,#FBF6E4 0%,#FFFFFF 60%)" },
};

/**
 * Prominent "current instruction" card at the very top of the candidate
 * dashboard. Polls every 30 s; when a NEW or UPDATED directive lands and the
 * tab is backgrounded, fires a browser Notification (uses the permission the
 * PushPermissionBanner already asked for — no service-worker required).
 */
export function HRDirectiveCard() {
  const [directive, setDirective] = useState<Directive | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const notify = (d: Directive) => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        new Notification(`${TONE[d.type].label} — ${d.title}`, {
          body: d.body.slice(0, 140),
          icon: "/nazaha-logo.png",
          tag: `directive-${d.id}`,
        });
      } catch {}
    };
    const load = async () => {
      try {
        const res = await fetch("/api/candidate/directive", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const d = json.directive as Directive | null;
        setDirective(d);
        if (d) {
          const key = `${d.id}:${d.updatedAt}`;
          const first = lastSeenRef.current === null;
          if (!first && lastSeenRef.current !== key && document.visibilityState !== "visible") {
            notify(d);
          }
          lastSeenRef.current = key;
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  function send() {
    setErr(null);
    if (!reply.trim()) return;
    startSend(async () => {
      const res = await fetch("/api/candidate/directive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.error ?? "فشل إرسال الرد"); return; }
      setDirective(json.directive);
      setReply("");
    });
  }

  if (!directive) return null;
  const tone = TONE[directive.type];
  const Icon = tone.Icon;
  const already = !!directive.candidateReply;

  return (
    <div className="rounded-2xl border p-5" style={{
      borderColor: `${tone.accent}66`,
      background: tone.gradient,
    }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: tone.accent, color: "white" }}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
              style={{ background: tone.chipBg, color: tone.accent }}>
              {tone.label}
            </span>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              من {directive.createdByName}
            </p>
          </div>
          <h2 className="text-base font-bold mt-1.5" style={{ color: tone.accent }}>
            {directive.title}
          </h2>
          <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed" style={{ color: "#4A4A4A" }}>
            {directive.body}
          </p>
          <p className="text-[11px] mt-3" style={{ color: "var(--color-text-muted)" }}>
            آخر تحديث: {new Date(directive.updatedAt).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" })}
          </p>

          {directive.allowReply && (
            already ? (
              <div className="mt-4 rounded-xl p-3" style={{ background: "var(--color-primary-muted)", border: "1px solid rgba(25,92,48,0.25)" }}>
                <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--color-primary-dark)" }}>
                  <Check className="w-3.5 h-3.5" /> ردك مُرسَل
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-dark)" }}>{directive.candidateReply}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <label className="text-xs font-medium" style={{ color: "var(--color-dark)" }}>ردك</label>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={2000}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
                {err && <p className="text-xs" style={{ color: "var(--color-error)" }}>{err}</p>}
                <div className="flex items-center justify-end">
                  <button type="button" onClick={send} disabled={sending || !reply.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: sending ? "#6B9E82" : tone.accent, color: "white", cursor: sending ? "not-allowed" : "pointer" }}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    إرسال
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
