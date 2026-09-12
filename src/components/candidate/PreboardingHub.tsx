"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { CheckCircle, Loader2, Bell, Upload, Paperclip, Send } from "lucide-react";

interface Message {
  id: string;
  senderType: "HR" | "CANDIDATE";
  type: "TEXT" | "FILE" | "PING" | "PING_RESPONSE" | "FILE_REQUEST";
  content: string | null;
  fileName: string | null;
  isRead: boolean;
  createdAt: string;
}

interface PreboardingHubProps {
  applicationId: string;
  firstName: string;
}

export function PreboardingHub({ applicationId, firstName }: PreboardingHubProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [bidirectional, setBidirectional] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchMessages() {
    const res = await fetch(`/api/preboarding/${applicationId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
    setChannelReady(!!data.channel);
    if (data.channel) setBidirectional(data.channel.bidirectional);
  }

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [applicationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(type: string, content?: string, fileName?: string) {
    startTransition(async () => {
      await fetch(`/api/preboarding/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content: content ?? text, fileName }),
      });
      setText("");
      await fetchMessages();
    });
  }

  async function respondToPing(msg: Message) {
    await sendMessage("PING_RESPONSE", `${firstName} يؤكد استعداده التام للحضور.`);
  }

  // Check if there's an unanswered FILE_REQUEST
  const pendingFileRequest = messages.find(
    (m) =>
      m.senderType === "HR" &&
      m.type === "FILE_REQUEST" &&
      !messages.some(
        (r) => r.senderType === "CANDIDATE" && r.type === "FILE" && r.createdAt > m.createdAt
      )
  );

  // Check if there's an unanswered PING
  const pendingPing = messages.find(
    (m) =>
      m.senderType === "HR" &&
      m.type === "PING" &&
      !messages.some(
        (r) =>
          r.senderType === "CANDIDATE" &&
          r.type === "PING_RESPONSE" &&
          r.createdAt > m.createdAt
      )
  );

  if (!channelReady) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{ borderColor: "var(--color-border)", background: "white" }}
      >
        <Bell className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>
          {firstName}، لم تبدأ إجراءات المباشرة بعد
        </p>
        <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
          سيتواصل معك فريق الموارد البشرية قريباً لتجهيز يومك الأول.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--color-border)", background: "white" }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center gap-2 border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-green-muted, #E8F3ED)" }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--color-primary)" }}
        />
        <p className="text-sm font-bold" style={{ color: "var(--color-dark)" }}>
          قناة الاستعداد للمباشرة
        </p>
        <p className="text-xs mr-auto" style={{ color: "var(--color-text-muted)" }}>
          الموارد البشرية
        </p>
      </div>

      {/* Pending Ping action */}
      {pendingPing && (
        <div
          className="mx-4 mt-4 p-4 rounded-xl border text-center"
          style={{ borderColor: "var(--color-gold)", background: "#FFFBEB" }}
        >
          <Bell className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--color-gold)" }} />
          <p className="text-sm font-bold mb-1" style={{ color: "#92400E" }}>
            {firstName}، طلب تأكيد جاهزيتك
          </p>
          <p className="text-xs mb-3" style={{ color: "#78350F" }}>
            {pendingPing.content}
          </p>
          <button
            onClick={() => respondToPing(pendingPing)}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: "var(--color-primary)" }}
          >
            <CheckCircle className="w-4 h-4" />
            نعم، أنا جاهز
          </button>
        </div>
      )}

      {/* Pending File Request action */}
      {pendingFileRequest && (
        <div
          className="mx-4 mt-4 p-4 rounded-xl border"
          style={{ borderColor: "var(--color-border)", background: "var(--color-beige)" }}
        >
          <div className="flex items-start gap-2">
            <Paperclip className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
            <div className="flex-1">
              <p className="text-xs font-bold mb-1" style={{ color: "var(--color-dark)" }}>
                {firstName}، مطلوب منك رفع ملف
              </p>
              <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
                {pendingFileRequest.content}
              </p>
              <input ref={fileRef} type="file" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // For now send as text message with filename — full upload wired via existing upload API
                await sendMessage("FILE", `أرفق الملف: ${file.name}`, file.name);
              }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium"
                style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", background: "var(--color-primary-muted)" }}
              >
                <Upload className="w-3.5 h-3.5" />
                رفع الملف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="p-4 space-y-3 overflow-y-auto" style={{ minHeight: 160, maxHeight: 280 }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderType === "CANDIDATE" ? "justify-end" : "justify-start"}`}
          >
            {(msg.type === "TEXT" || msg.type === "PING_RESPONSE" || msg.type === "FILE") && (
              <div
                className="rounded-xl px-3 py-2 max-w-[85%] text-xs"
                style={{
                  background: msg.senderType === "CANDIDATE"
                    ? "var(--color-primary)"
                    : "var(--color-surface-alt)",
                  color: msg.senderType === "CANDIDATE" ? "white" : "var(--color-dark)",
                }}
              >
                {msg.type === "PING_RESPONSE" && (
                  <p className="font-bold mb-0.5 opacity-75">✅ تأكيد الجاهزية</p>
                )}
                {msg.content && <p>{msg.content}</p>}
                <p className="opacity-50 mt-0.5" style={{ direction: "ltr", textAlign: "left" }}>
                  {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { timeStyle: "short" })}
                </p>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Candidate reply (only if bidirectional) */}
      {bidirectional && (
        <div
          className="px-4 pb-4 flex gap-2 border-t pt-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) sendMessage("TEXT"); }}
            placeholder="اكتب ردك..."
            className="flex-1 text-sm rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: "var(--color-border)", color: "var(--color-dark)" }}
          />
          <button
            onClick={() => text.trim() && sendMessage("TEXT")}
            disabled={!text.trim() || isPending}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: text.trim() && !isPending ? "var(--color-primary)" : "var(--color-border)",
              color: "white",
            }}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" style={{ transform: "scaleX(-1)" }} />}
          </button>
        </div>
      )}
    </div>
  );
}
