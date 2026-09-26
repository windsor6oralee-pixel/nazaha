"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Card, EmptyState, Alert } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
      setChannelReady(!!data.channel);
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

  async function sendMessage(type: string, content?: string, fileName?: string) {
    startTransition(async () => {
      await fetch(`/api/preboarding/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content: content ?? text, fileName }),
      });
      setText("");
      setRefreshTick((t) => t + 1);
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
      <Card plain>
        <EmptyState icon="notifications" title={`${firstName}، لم تبدأ إجراءات المباشرة بعد`}>
          سيتواصل معك فريق الموارد البشرية قريباً لتجهيز يومك الأول.
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card plain flush>
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b border-border-100 bg-surface-100"
        style={{ padding: "var(--space-16) var(--space-24)" }}
      >
        <span
          aria-hidden
          className="bg-green-700"
          style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", flex: "none" }}
        />
        <p className="text-ink" style={{ margin: 0, fontWeight: 600 }}>
          قناة الاستعداد للمباشرة
        </p>
        <p className="text-ink-muted" style={{ margin: 0, marginInlineStart: "auto", fontSize: 13 }}>
          الموارد البشرية
        </p>
      </div>

      {/* Pending Ping action */}
      {pendingPing && (
        <div style={{ padding: "var(--space-16) var(--space-16) 0" }}>
          <Alert tone="gold" icon="notifications" title={`${firstName}، طلب تأكيد جاهزيتك`}>
            {pendingPing.content && <p style={{ margin: 0 }}>{pendingPing.content}</p>}
            <div style={{ marginTop: "var(--space-16)" }}>
              <Button icon="approved" onClick={() => respondToPing(pendingPing)} disabled={isPending}>
                نعم، أنا جاهز
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Pending File Request action */}
      {pendingFileRequest && (
        <div style={{ padding: "var(--space-16) var(--space-16) 0" }}>
          <Alert tone="info" icon="documents" title={`${firstName}، مطلوب منك رفع ملف`}>
            {pendingFileRequest.content && <p style={{ margin: 0 }}>{pendingFileRequest.content}</p>}
            <input ref={fileRef} type="file" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              // For now send as text message with filename — full upload wired via existing upload API
              await sendMessage("FILE", `أرفق الملف: ${file.name}`, file.name);
            }} />
            <div style={{ marginTop: "var(--space-16)" }}>
              <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()} disabled={isPending}>
                رفع الملف
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex flex-col gap-2 overflow-y-auto"
        style={{ padding: "var(--space-16)", minHeight: 160, maxHeight: 280 }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderType === "CANDIDATE" ? "justify-end" : "justify-start"}`}
          >
            {(msg.type === "TEXT" || msg.type === "PING_RESPONSE" || msg.type === "FILE") && (
              <div
                className={`rounded-12 text-ink ${msg.senderType === "CANDIDATE" ? "bg-gold-200" : "bg-surface-100 border border-border-100"}`}
                style={{ padding: "var(--space-8) var(--space-16)", maxWidth: "85%", fontSize: 14 }}
              >
                {msg.type === "PING_RESPONSE" && (
                  <p className="inline-flex items-center gap-2" style={{ margin: "0 0 4px", fontWeight: 600 }}>
                    <Icon name="approved" size={16} label={false} />
                    تأكيد الجاهزية
                  </p>
                )}
                {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}
                <p className="font-numeric" style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.7, direction: "ltr", textAlign: "left" }}>
                  {new Date(msg.createdAt).toLocaleTimeString("ar-SA-u-nu-latn", { timeStyle: "short" })}
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
          className="flex items-end gap-2 border-t border-border-100"
          style={{ padding: "var(--space-16)" }}
        >
          <Input
            className="flex-1 min-w-0"
            label="ردك على الموارد البشرية"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) sendMessage("TEXT"); }}
            placeholder="اكتب ردك..."
          />
          <Button
            onClick={() => text.trim() && sendMessage("TEXT")}
            disabled={!text.trim()}
            loading={isPending}
            icon="messages"
          >
            إرسال الرد
          </Button>
        </div>
      )}
    </Card>
  );
}
