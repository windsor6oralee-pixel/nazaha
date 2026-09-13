"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
  Send, Bell, FolderOpen, ToggleLeft, ToggleRight,
  Loader2, MessageSquare,
} from "lucide-react";

interface Message {
  id: string;
  senderType: "HR" | "CANDIDATE";
  type: "TEXT" | "FILE" | "PING" | "PING_RESPONSE" | "FILE_REQUEST";
  content: string | null;
  fileName: string | null;
  isRead: boolean;
  createdAt: string;
}

interface HRPreboardingPanelProps {
  applicationId: string;
  candidateName: string;
}

export function HRPreboardingPanel({ applicationId, candidateName }: HRPreboardingPanelProps) {
  const firstName = candidateName.split(" ")[0];
  const [messages, setMessages] = useState<Message[]>([]);
  const [bidirectional, setBidirectional] = useState(false);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [togglingBidi, setTogglingBidi] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Bumped to force a reload (e.g. right after sending); the effect owns all fetching.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/preboarding/${applicationId}/messages`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setMessages(data.messages ?? []);
      if (data.channel) setBidirectional(data.channel.bidirectional);
    };
    load();
    pollRef.current = setInterval(load, 5000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [applicationId, refreshTick]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(type: "TEXT" | "PING" | "FILE_REQUEST", content?: string) {
    startTransition(async () => {
      await fetch(`/api/preboarding/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content: content ?? text }),
      });
      setText("");
      setRefreshTick((t) => t + 1);
    });
  }

  async function toggleBidirectional() {
    setTogglingBidi(true);
    const res = await fetch(`/api/preboarding/${applicationId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bidirectional: !bidirectional }),
    });
    if (res.ok) {
      const data = await res.json();
      setBidirectional(data.bidirectional);
    }
    setTogglingBidi(false);
  }

  const msgTypeLabel: Record<Message["type"], string> = {
    TEXT: "",
    FILE: "ملف",
    PING: "طلب تأكيد جاهزية",
    PING_RESPONSE: "رد تأكيد الجاهزية",
    FILE_REQUEST: "طلب ملف من المرشح",
  };

  return (
    <div
      className="mt-4 bg-white rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-beige)" }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--color-dark)" }}>
            قناة الاستعداد للمباشرة
          </span>
          {messages.filter(m => !m.isRead && m.senderType === "CANDIDATE").length > 0 && (
            <span
              className="text-xs rounded-full px-1.5 py-0.5 font-bold"
              style={{ background: "var(--color-error)", color: "white" }}
            >
              جديد
            </span>
          )}
        </div>
        <button
          onClick={toggleBidirectional}
          disabled={togglingBidi}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: bidirectional ? "var(--color-primary)" : "var(--color-text-muted)" }}
          title="تفعيل الاتصال ثنائي الاتجاه"
        >
          {bidirectional
            ? <ToggleRight className="w-5 h-5" />
            : <ToggleLeft className="w-5 h-5" />}
          {bidirectional ? "ثنائي الاتجاه" : "أحادي"}
        </button>
      </div>

      {/* Messages */}
      <div
        className="p-4 space-y-3 overflow-y-auto"
        style={{ minHeight: 180, maxHeight: 320 }}
      >
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              ابدأ التواصل مع {firstName} لتجهيز يومه الأول.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderType === "HR" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="rounded-xl px-3 py-2 max-w-[85%] text-xs"
              style={{
                background: msg.senderType === "HR"
                  ? "var(--color-primary)"
                  : msg.type === "PING_RESPONSE"
                  ? "#D1FAE5"
                  : "var(--color-surface-alt)",
                color: msg.senderType === "HR" ? "white" : "var(--color-dark)",
                border: msg.type === "PING_RESPONSE" ? "1px solid #6EE7B7" : "none",
              }}
            >
              {msg.type !== "TEXT" && (
                <p className="text-xs font-bold mb-1 opacity-75">
                  {msg.senderType === "HR" ? "📋 " : "✅ "}{msgTypeLabel[msg.type]}
                </p>
              )}
              {msg.content && <p>{msg.content}</p>}
              <p
                className="text-xs mt-1 opacity-60"
                style={{ direction: "ltr", textAlign: "left" }}
              >
                {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { timeStyle: "short" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div
        className="px-4 pt-2 pb-2 flex gap-2 border-t"
        style={{ borderColor: "var(--color-border-light, var(--color-border))" }}
      >
        <button
          onClick={() => sendMessage("PING", "نود التأكد من استعدادك التام للحضور في اليوم المحدد. هل أنت جاهز؟")}
          disabled={isPending}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
          style={{
            borderColor: "var(--color-gold)",
            color: "var(--color-gold)",
            background: "var(--color-gold-muted, #FDF6DC)",
          }}
        >
          <Bell className="w-3.5 h-3.5" />
          طلب تأكيد
        </button>
        <button
          onClick={() => sendMessage("FILE_REQUEST", "يُرجى رفع الصورة الشخصية الرسمية قبل اليوم الأول.")}
          disabled={isPending}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          طلب ملف
        </button>
      </div>

      {/* Text input */}
      <div
        className="px-4 pb-4 flex gap-2"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) sendMessage("TEXT"); }}
          placeholder={`اكتب رسالة لـ ${firstName}...`}
          className="flex-1 text-sm rounded-xl border px-3 py-2 outline-none"
          style={{ borderColor: "var(--color-border)", color: "var(--color-dark)" }}
        />
        <button
          onClick={() => text.trim() && sendMessage("TEXT")}
          disabled={!text.trim() || isPending}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          style={{
            background: text.trim() && !isPending ? "var(--color-primary)" : "var(--color-border)",
            color: "white",
          }}
        >
          {isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" style={{ transform: "scaleX(-1)" }} />}
        </button>
      </div>
    </div>
  );
}
