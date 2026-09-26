"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

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

  const hasNew = messages.filter(m => !m.isRead && m.senderType === "CANDIDATE").length > 0;

  return (
    <Card
      flush
      className="mt-6"
      title={
        <span className="inline-flex items-center gap-2 flex-wrap">
          <Icon name="messages" size={24} label={false} style={{ color: "var(--green-700)" }} />
          قناة الاستعداد للمباشرة
          {hasNew && <Badge tone="brand" icon="notifications">جديد</Badge>}
        </span>
      }
      action={
        <button
          type="button"
          role="switch"
          aria-checked={bidirectional}
          onClick={toggleBidirectional}
          disabled={togglingBidi}
          title="تفعيل الاتصال ثنائي الاتجاه"
          className="inline-flex items-center gap-2 flex-none"
          style={{
            minHeight: "var(--tap-target-min)",
            background: "none",
            border: 0,
            padding: 0,
            cursor: togglingBidi ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
            color: bidirectional ? "var(--green-700)" : "var(--ink-muted)",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "relative",
              width: 36,
              height: 20,
              borderRadius: "var(--radius-full)",
              background: bidirectional ? "var(--green-700)" : "var(--surface-200)",
              border: "1px solid var(--border-100)",
              transition: "background-color var(--motion-quick) var(--ease-standard)",
              flex: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                insetInlineStart: 2,
                width: 14,
                height: 14,
                borderRadius: "var(--radius-full)",
                background: "var(--surface-000)",
                transform: bidirectional ? "translateX(-16px)" : "none",
                transition: "transform var(--motion-quick) var(--ease-standard)",
              }}
            />
          </span>
          {bidirectional ? "ثنائي الاتجاه" : "أحادي"}
        </button>
      }
    >
      {/* Messages */}
      <div
        className="flex flex-col gap-4 overflow-y-auto"
        style={{ minHeight: 180, maxHeight: 320, padding: "var(--space-16) var(--space-24)", borderTop: "1px solid var(--border-100)" }}
      >
        {messages.length === 0 && (
          <p className="ds-caption text-center" style={{ margin: 0, padding: "var(--space-32) 0", color: "var(--ink-muted)" }}>
            ابدأ التواصل مع {firstName} لتجهيز يومه الأول.
          </p>
        )}
        {messages.map((msg) => {
          const fromHR = msg.senderType === "HR";
          const readyReply = msg.type === "PING_RESPONSE";
          return (
            <div
              key={msg.id}
              className={`flex ${fromHR ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%]"
                style={{
                  padding: "var(--space-8) var(--space-16)",
                  borderRadius: "var(--radius-12)",
                  fontSize: 14,
                  background: fromHR ? "var(--green-700)" : "var(--surface-000)",
                  color: fromHR ? "var(--ink-invert)" : "var(--ink)",
                  border: fromHR ? "1px solid var(--green-700)" : `1px solid ${readyReply ? "var(--success-500)" : "var(--border-100)"}`,
                }}
              >
                {msg.type !== "TEXT" && (
                  <p className="ds-caption inline-flex items-center gap-2" style={{ margin: "0 0 4px", fontWeight: 600, opacity: 0.85 }}>
                    <Icon name={fromHR ? "messages" : "approved"} size={16} label={false} />
                    {msgTypeLabel[msg.type]}
                  </p>
                )}
                {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}
                <p
                  className="font-numeric"
                  style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.7, direction: "ltr", textAlign: "left" }}
                >
                  {new Date(msg.createdAt).toLocaleTimeString("ar-SA-u-nu-latn", { timeStyle: "short" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div
        className="flex gap-2 flex-wrap"
        style={{ padding: "var(--space-16) var(--space-24) 0", borderTop: "1px solid var(--border-100)" }}
      >
        <Button
          variant="secondary"
          size="sm"
          icon="notifications"
          onClick={() => sendMessage("PING", "نود التأكد من استعدادك التام للحضور في اليوم المحدد. هل أنت جاهز؟")}
          disabled={isPending}
          style={{ minHeight: "var(--tap-target-min)" }}
        >
          طلب تأكيد
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="documents"
          onClick={() => sendMessage("FILE_REQUEST", "يُرجى رفع الصورة الشخصية الرسمية قبل اليوم الأول.")}
          disabled={isPending}
          style={{ minHeight: "var(--tap-target-min)" }}
        >
          طلب ملف
        </Button>
      </div>

      {/* Text input */}
      <div className="flex items-end gap-2" style={{ padding: "var(--space-16) var(--space-24) var(--space-24)" }}>
        <Input
          className="flex-1"
          aria-label="نص الرسالة"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) sendMessage("TEXT"); }}
          placeholder={`اكتب رسالة لـ ${firstName}...`}
        />
        <Button
          onClick={() => text.trim() && sendMessage("TEXT")}
          disabled={!text.trim()}
          loading={isPending}
          icon="messages"
          aria-label="إرسال الرسالة"
          style={{ paddingInline: "var(--space-16)" }}
        />
      </div>
    </Card>
  );
}
