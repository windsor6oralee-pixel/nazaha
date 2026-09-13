"use client";

import { useState, useTransition } from "react";
import { Bell, X, Loader2 } from "lucide-react";

interface Props {
  candidateId: string;
}

export function SendAlertButton({ candidateId }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH">("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setBody("");
    setPriority("NORMAL");
    setError(null);
    setSuccess(false);
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const res = await fetch(`/api/hr/candidates/${candidateId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleAr: title.trim(), bodyAr: body.trim(), priority }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "حدث خطأ");
        return;
      }
      setSuccess(true);
      setTimeout(() => setOpen(false), 1500);
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 text-sm font-medium px-4 rounded-xl border transition-colors"
        style={{
          minHeight: 40,
          background: "var(--color-primary-muted)",
          color: "var(--color-primary)",
          borderColor: "var(--color-primary)",
          cursor: "pointer",
        }}
      >
        <Bell className="w-4 h-4" />
        إرسال تنبيه
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(3px)",
            padding: "1rem",
          }}
        >
          <div
            dir="rtl"
            style={{
              background: "white",
              borderRadius: 20,
              maxWidth: 480,
              width: "100%",
              padding: "1.75rem",
              boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-dark)", margin: 0 }}>
                إرسال رسالة / تنبيه
              </h2>
              <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-success, #166534)", fontWeight: 600 }}>
                ✓ تم الإرسال بنجاح
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Priority toggle */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-dark)", display: "block", marginBottom: 6 }}>
                    نوع الرسالة
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["NORMAL", "HIGH"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          borderRadius: 10,
                          border: "1.5px solid",
                          borderColor: priority === p
                            ? (p === "HIGH" ? "#DC2626" : "var(--color-primary)")
                            : "var(--color-border)",
                          background: priority === p
                            ? (p === "HIGH" ? "#FEE2E2" : "var(--color-primary-muted)")
                            : "white",
                          color: priority === p
                            ? (p === "HIGH" ? "#DC2626" : "var(--color-primary)")
                            : "var(--color-text-muted)",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {p === "HIGH" ? "⚠ عاجل" : "عادي"}
                      </button>
                    ))}
                  </div>
                  {priority === "HIGH" && (
                    <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>
                      الرسالة العاجلة ستظهر كنافذة إلزامية ولا يمكن للمرشح تجاهلها
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-dark)", display: "block", marginBottom: 6 }}>
                    العنوان
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={120}
                    placeholder="مثال: طلب وثيقة ناقصة"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid var(--color-border)",
                      fontSize: 14,
                      color: "var(--color-dark)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Body */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-dark)", display: "block", marginBottom: 6 }}>
                    نص الرسالة
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    maxLength={800}
                    rows={4}
                    placeholder="اكتب تفاصيل الرسالة هنا..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid var(--color-border)",
                      fontSize: 14,
                      color: "var(--color-dark)",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {error && (
                  <p style={{ fontSize: 13, color: "#DC2626", margin: 0 }}>{error}</p>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
                  <button
                    type="submit"
                    disabled={isPending}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      borderRadius: 10,
                      border: "none",
                      background: priority === "HIGH" ? "#DC2626" : "var(--color-primary)",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.7 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isPending ? "جارٍ الإرسال..." : "إرسال"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    style={{
                      padding: "12px 20px",
                      borderRadius: 10,
                      border: "1.5px solid var(--color-border)",
                      background: "white",
                      color: "var(--color-text-muted)",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
