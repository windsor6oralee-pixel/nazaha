"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BATCH_STATUS_LABELS } from "./ImportBatchesClient";

interface ItemRow {
  id: string;
  itemKey: string;
  nationalId: string | null;
  email: string | null;
  nameAr: string;
  jobTitle: string | null;
  status: string;
  errorMessage: string | null;
  matchedBy: string | null;
  candidateId: string | null;
  applicationId: string | null;
}

interface BatchDetail {
  id: string;
  reference: string;
  status: string;
  sourceFileName: string | null;
  totalRows: number;
  validRows: number;
  importedCount: number;
  failedCount: number;
  approvedAt: string | null;
  executedAt: string | null;
  resultSummary: unknown;
  createdAt: string;
  finishedAt: string | null;
  items: ItemRow[];
  counts: Record<string, number>;
}

interface AttemptRow {
  id: string;
  toAddress: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  idempotencyKey: string | null;
  sendStartedAt: string | null;
  createdAt: string;
}

interface UnknownRow {
  id: string;
  importItemId: string | null;
  itemKey: string | null;
  toAddress: string;
  status: string;
  sendStartedAt: string | null;
  createdAt: string;
}

interface DispatchResponse {
  byOutcome: Record<string, number>;
  unknown: Array<{ itemId: string; itemKey: string; attempt: number; error?: string }>;
  results: Array<{ itemKey: string; outcome: string; attempt: number; error?: string }>;
}

const ITEM_LABELS: Record<string, string> = {
  PENDING: "مرفوع", VALID: "صالح", INVALID: "غير صالح", DUPLICATE: "مكرر",
  MATCHED_NEW: "جديد", MATCHED_EXISTING: "موجود مسبقاً", CONFLICT: "تعارض",
  READY: "بانتظار التنفيذ", EXECUTING: "قيد التنفيذ",
  DONE: "تم", FAILED: "فشل", SKIPPED: "تم التخطي",
};

const EMAIL_LABELS: Record<string, string> = {
  QUEUED: "في الطابور", SENT: "أُرسلت", FAILED: "فشلت",
  BOUNCED: "مرفوضة", DELIVERED: "وصلت", UNKNOWN: "غير مؤكدة",
};

function itemChip(status: string): React.CSSProperties {
  const good = status === "DONE" || status === "VALID" || status === "MATCHED_NEW" || status === "MATCHED_EXISTING";
  const bad = status === "FAILED" || status === "INVALID" || status === "CONFLICT";
  return {
    display: "inline-block", padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: good ? "#E7F2EE" : bad ? "#FDECEA" : "#F4F2EC",
    color: good ? "#013A2B" : bad ? "#B42318" : "#5B4A1F",
    border: "1px solid #E6E2D8",
  };
}

export function ImportBatchDetailClient({ initial }: { initial: BatchDetail }) {
  const [batch, setBatch] = useState<BatchDetail>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Panels (lazy)
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [unknownRows, setUnknownRows] = useState<UnknownRow[] | null>(null);
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null);
  const [provision, setProvision] = useState(false);

  // Item expansion
  const [expanded, setExpanded] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Record<string, AttemptRow[]>>({});

  const reload = useCallback(async () => {
    const res = await fetch(`/api/hr/import-batches/${initial.id}`);
    if (!res.ok) return;
    const json = await res.json();
    setBatch(json.batch);
  }, [initial.id]);

  async function action(name: string, path: string, body?: unknown): Promise<boolean> {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "فشل التنفيذ");
        return false;
      }
      return true;
    } catch {
      setError("تعذّر الاتصال بالخادم");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function runValidate() {
    if (await action("validate", `/api/hr/import-batches/${initial.id}/validate`)) {
      setNotice("اكتمل التحقق — راجع الصفوف ثم اعرض المطابقة.");
      await reload();
    }
  }
  async function runPreview() {
    const okAction = await action("preview", `/api/hr/import-batches/${initial.id}/preview`);
    if (okAction) {
      await reload();
      setNotice("اكتملت المطابقة — راجع التوزيع ثم اعتمد الدفعة.");
    }
  }
  async function runApprove() {
    if (await action("approve", `/api/hr/import-batches/${initial.id}/approve`)) {
      setNotice("اعتُمدت الدفعة — يمكن تنفيذها الآن.");
      await reload();
    }
  }
  async function runExecute() {
    if (!confirm("سيتم إنشاء المرشحين الجدد وضبط بيانات دخولهم من الملف (البريد + كلمة المرور كما هي) وتفعيل حساباتهم فوراً، وتحديث حسابات الموجودين بالقائمة نفسها. لا تُرسل أي رسالة. متابعة؟")) return;
    if (await action("execute", `/api/hr/import-batches/${initial.id}/execute`)) {
      setNotice("اكتمل التنفيذ — حسابات المقبولين جاهزة للدخول.");
      await reload();
    }
  }
  async function runCancel() {
    if (!confirm("إلغاء الدفعة قبل التنفيذ؟")) return;
    if (await action("cancel", `/api/hr/import-batches/${initial.id}/cancel`)) {
      setNotice("أُلغيت الدفعة.");
      await reload();
    }
  }
  async function runArchive() {
    if (await action("archive", `/api/hr/import-batches/${initial.id}/archive`)) {
      setNotice("أُرشفت الدفعة — حالتها مجمّدة.");
      await reload();
    }
  }
  async function runDispatch() {
    if (!confirm(
      provision
        ? "سيتم إرسال الدعوات وإنشاء حسابات للمرشحين بلا حساب. متابعة؟"
        : "سيتم إرسال إشعارات الحسابات القائمة فقط (بلا تغيير أي كلمة مرور). متابعة؟"
    )) return;
    setBusy("dispatch");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/hr/import-batches/${initial.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provisionNewAccounts: provision }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "فشل الإرسال");
        return;
      }
      setDispatchResult(json as DispatchResponse);
      setNotice("اكتملت جولة الإرسال — راجع الحالات أدناه.");
      await reload();
      await loadUnknown();
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setBusy(null);
    }
  }

  async function loadUnknown() {
    const res = await fetch(`/api/hr/import-batches/unknown?batchId=${initial.id}`);
    if (res.ok) {
      const json = await res.json();
      setUnknownRows(json.rows ?? []);
    }
  }
  async function loadReport() {
    const res = await fetch(`/api/hr/import-batches/${initial.id}/report`);
    if (res.ok) {
      const json = await res.json();
      setReport(json);
    }
  }

  async function reconcile(logId: string, resolution: "SENT" | "NOT_SENT") {
    const label = resolution === "SENT" ? "مؤكَّد أنها أُرسلت فعلاً" : "مؤكَّد أنها لم تُرسل";
    if (!confirm(`تأكيد: ${label}؟`)) return;
    const okAction = await action(`rec-${logId}`, "/api/hr/import-batches/unknown", {
      emailLogId: logId,
      resolution,
    });
    if (okAction) await loadUnknown();
  }

  async function toggleItem(itemId: string) {
    if (expanded === itemId) { setExpanded(null); return; }
    setExpanded(itemId);
    if (attempts[itemId]) return;
    const res = await fetch(`/api/hr/import-batches/${initial.id}/items/${itemId}`);
    if (res.ok) {
      const json = await res.json();
      setAttempts((m) => ({ ...m, [itemId]: json.attempts ?? [] }));
    }
  }

  // Initial scan for uncertain attempts (panel refreshes on demand after that).
  useEffect(() => { void loadUnknown(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = batch.status;
  const conflicts = batch.counts["CONFLICT"] ?? 0;
  const counts = Object.entries(batch.counts).filter(([, n]) => n > 0);

  return (
    <div className="space-y-8">
      {/* Header card */}
      <section className="rounded-2xl p-5 sm:p-6" style={{ background: "#fff", border: "1px solid #E6E2D8" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold font-mono" dir="ltr" style={{ color: "var(--color-dark)" }}>{batch.reference}</h1>
              <span
                style={{
                  padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: "#F4F2EC", border: "1px solid #E6E2D8", color: "#013A2B",
                }}
              >
                {BATCH_STATUS_LABELS[s] ?? s}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              {batch.sourceFileName ?? "إدخال يدوي"} — {batch.totalRows} صف
              {batch.approvedAt && ` — اُعتمدت ${new Date(batch.approvedAt).toLocaleString("ar-SA")}`}
              {batch.executedAt && ` — نُفذت ${new Date(batch.executedAt).toLocaleString("ar-SA")}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {s === "PENDING" || s === "VALIDATING" ? (
              <Button icon="approved" onClick={runValidate} loading={busy === "validate"}>تحقق من الصفوف</Button>
            ) : null}
            {s === "READY" ? (
              <>
                <Button variant="secondary" icon="review" onClick={runPreview} loading={busy === "preview"}>معاينة المطابقة</Button>
                <Button icon="approved" onClick={runApprove} loading={busy === "approve"} disabled={conflicts > 0}>
                  اعتماد الدفعة
                </Button>
                <Button variant="danger" onClick={runCancel} loading={busy === "cancel"}>إلغاء</Button>
              </>
            ) : null}
            {s === "APPROVED" || s === "EXECUTING" ? (
              <>
                <Button icon="upload" onClick={runExecute} loading={busy === "execute"}>تنفيذ الاستيراد</Button>
                {s === "APPROVED" && (
                  <Button variant="danger" onClick={runCancel} loading={busy === "cancel"}>إلغاء</Button>
                )}
              </>
            ) : null}
            {s === "COMPLETED" || s === "PARTIAL" ? (
              <Button variant="gold" icon="messages" onClick={runDispatch} loading={busy === "dispatch"}>
                إرسال الدعوات
              </Button>
            ) : null}
            {["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(s) ? (
              <Button variant="secondary" icon="documents" onClick={runArchive} loading={busy === "archive"}>أرشفة</Button>
            ) : null}
          </div>
        </div>

        {/* Counts */}
        <div className="flex flex-wrap gap-2 mt-4">
          {counts.map(([k, n]) => (
            <span key={k} style={itemChip(k)}>
              {ITEM_LABELS[k] ?? k}: {n}
            </span>
          ))}
        </div>

        {conflicts > 0 && (
          <p role="alert" className="mt-3 text-sm rounded-xl px-4 py-3" style={{ background: "#FDECEA", border: "1px solid #F5C2C0", color: "#B42318" }}>
            يوجد {conflicts} عنصر بتعارض — لا يمكن اعتماد الدفعة قبل مراجعتها وحلّها يدوياً.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm" style={{ color: "var(--danger-500, #B42318)" }}>{error}</p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm" style={{ color: "#013A2B" }}>{notice}</p>
        )}
      </section>

      {/* Items */}
      <section>
        <h2 className="text-lg font-bold mb-3" style={{ color: "var(--color-dark)" }}>عناصر الدفعة</h2>
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid #E6E2D8" }}>
          <table className="w-full text-sm" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: "#F4F2EC" }}>
                <th className="text-right px-4 py-3 font-semibold">#</th>
                <th className="text-right px-4 py-3 font-semibold">الاسم</th>
                <th className="text-right px-4 py-3 font-semibold">البريد / الهوية</th>
                <th className="text-right px-4 py-3 font-semibold">المطابقة</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {batch.items.map((it) => (
                <Fragment key={it.id}>
                  <tr style={{ borderTop: "1px solid #EFECE4" }}>
                    <td className="px-4 py-2 font-mono text-xs" dir="ltr" style={{ color: "var(--color-text-muted)" }}>{it.itemKey}</td>
                    <td className="px-4 py-2" style={{ color: "var(--color-dark)" }}>{it.nameAr}</td>
                    <td className="px-4 py-2 text-xs" dir="ltr" style={{ color: "var(--color-text-muted)", textAlign: "right" }}>
                      {it.email ?? "—"} / {it.nationalId ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {it.matchedBy ?? "—"}
                      {it.errorMessage && (
                        <span className="block" style={{ color: "#B42318" }}>{it.errorMessage}</span>
                      )}
                    </td>
                    <td className="px-4 py-2"><span style={itemChip(it.status)}>{ITEM_LABELS[it.status] ?? it.status}</span></td>
                    <td className="px-4 py-2">
                      <button
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-primary)" }}
                        onClick={() => void toggleItem(it.id)}
                      >
                        {expanded === it.id ? "إخفاء" : "المحاولات"}
                      </button>
                    </td>
                  </tr>
                  {expanded === it.id && (
                    <tr key={`${it.id}-attempts`}>
                      <td colSpan={6} style={{ background: "#FBFAF7", borderTop: "1px solid #EFECE4" }}>
                        <div className="px-4 py-3">
                          {(attempts[it.id] ?? []).length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              لا توجد محاولات إرسال لهذا العنصر بعد.
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="text-right py-1 font-semibold">الحالة</th>
                                  <th className="text-right py-1 font-semibold">المفتاح</th>
                                  <th className="text-right py-1 font-semibold">بداية الإرسال</th>
                                  <th className="text-right py-1 font-semibold">الوقت</th>
                                  <th className="text-right py-1 font-semibold">خطأ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(attempts[it.id] ?? []).map((a) => (
                                  <tr key={a.id} style={{ borderTop: "1px solid #EFECE4" }}>
                                    <td className="py-1">{EMAIL_LABELS[a.status] ?? a.status}</td>
                                    <td className="py-1 font-mono text-[11px]" dir="ltr" style={{ textAlign: "right" }}>{a.idempotencyKey ?? "—"}</td>
                                    <td className="py-1" dir="ltr" style={{ textAlign: "right" }}>
                                      {a.sendStartedAt ? new Date(a.sendStartedAt).toLocaleString("ar-SA") : "—"}
                                    </td>
                                    <td className="py-1">{new Date(a.createdAt).toLocaleString("ar-SA")}</td>
                                    <td className="py-1" style={{ color: "#B42318" }}>{a.errorMessage ?? ""}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dispatch */}
      {(s === "COMPLETED" || s === "PARTIAL" || s === "ARCHIVED") && (
        <section className="rounded-2xl p-5 sm:p-6" style={{ background: "#fff", border: "1px solid #E6E2D8" }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--color-dark)" }}>مرحلة الدعوات</h2>
          <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
            منفصلة تماماً عن الاستيراد: الحسابات القائمة تُستلم رسالة تذكير بلا أي تغيير في كلمة المرور،
            والمرشحون بلا حساب لا يُنشأ لهم شيء ما لم تُفعّل الخيار أدناه صراحةً.
          </p>
          <label className="flex items-center gap-2 text-sm mb-4" style={{ color: "var(--color-dark)" }}>
            <input type="checkbox" checked={provision} onChange={(e) => setProvision(e.target.checked)} />
            إنشاء حسابات وإرسال بيانات دخول للمرشحين بلا حساب
          </label>
          <Button variant="gold" icon="messages" onClick={runDispatch} loading={busy === "dispatch"}>
            إرسال الدعوات
          </Button>

          {dispatchResult && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(dispatchResult.byOutcome).map(([k, n]) => (
                <span key={k} style={itemChip(k.startsWith("SENT") ? "DONE" : k.includes("UNKNOWN") ? "CONFLICT" : "PENDING")}>
                  {k}: {n}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* UNKNOWN reconciliation */}
      <section className="rounded-2xl p-5 sm:p-6" style={{ background: "#fff", border: "1px solid #E6E2D8" }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-dark)" }}>المحاولات غير المؤكدة</h2>
          <Button variant="ghost" size="sm" onClick={() => void loadUnknown()}>تحديث</Button>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          رسائل انقطع سجلها أثناء الإرسال — لا تُعاد تلقائياً أبداً؛ راجعها يدوياً وقرّر حالتها.
        </p>
        {!unknownRows && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>جارٍ الفحص...</p>}
        {unknownRows && unknownRows.length === 0 && (
          <p className="text-sm" style={{ color: "#013A2B" }}>لا توجد محاولات غير مؤكدة ✓</p>
        )}
        {unknownRows && unknownRows.length > 0 && (
          <div className="space-y-3">
            {unknownRows.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
                   style={{ background: "#FFF8E6", border: "1px solid #F0E3BC" }}>
                <div className="text-xs">
                  <span className="font-mono" dir="ltr" style={{ color: "var(--color-dark)" }}>{u.toAddress}</span>
                  <span className="mx-2" style={{ color: "var(--color-text-muted)" }}>
                    {u.itemKey ? `(${u.itemKey})` : ""} — {EMAIL_LABELS[u.status] ?? u.status}
                    {u.sendStartedAt && ` — بدأ ${new Date(u.sendStartedAt).toLocaleTimeString("ar-SA")}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void reconcile(u.id, "SENT")} loading={busy === `rec-${u.id}`}>
                    أُرسلت فعلاً
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void reconcile(u.id, "NOT_SENT")} loading={busy === `rec-${u.id}`}>
                    لم تُرسل
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Report */}
      <section className="rounded-2xl p-5 sm:p-6" style={{ background: "#fff", border: "1px solid #E6E2D8" }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-dark)" }}>التقرير</h2>
          <Button variant="ghost" size="sm" onClick={() => void loadReport()}>تحميل التقرير</Button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
          النتيجة المجمّدة تُعرض كما حُفظت وقت الانتهاء، والحالة الحيّة تُعرض منفصلاً — لا تُعاد كتابة التاريخ.
        </p>
        {!report && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>اضغط «تحميل التقرير».</p>}
        {report && <ReportView report={report} />}
      </section>
    </div>
  );
}

function ReportView({ report }: { report: Record<string, unknown> }) {
  const batch = report["batch"] as Record<string, unknown> | undefined;
  const frozen = report["resultSummary"];
  const live = report["live"] as Record<string, unknown> | undefined;
  const attempts = (report["attempts"] as AttemptRow[] | undefined) ?? [];
  const counts = (report["itemStatusCounts"] as Record<string, number> | undefined) ?? {};

  const emailByStatus: Record<string, number> = {};
  for (const a of attempts) emailByStatus[a.status] = (emailByStatus[a.status] ?? 0) + 1;

  return (
    <div className="space-y-5 text-sm">
      <div className="rounded-xl px-4 py-3" style={{ background: "#F4F2EC", border: "1px solid #E6E2D8" }}>
        <p className="text-xs font-bold mb-2" style={{ color: "#013A2B" }}>1+2) اللقطة المجمّدة والنتيجة النهائية (كما حُفظت)</p>
        <p className="text-xs font-mono" dir="ltr" style={{ color: "var(--color-dark)" }}>
          {batch ? `${batch["reference"]} — ${batch["status"]} — total=${batch["totalRows"]} imported=${batch["importedCount"]} failed=${batch["failedCount"]}` : "—"}
        </p>
        <pre className="text-[11px] mt-2 overflow-x-auto" dir="ltr" style={{ color: "var(--color-text-muted)" }}>
          {JSON.stringify(frozen ?? null, null, 2)}
        </pre>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(counts).map(([k, n]) => (
            <span key={k} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#fff", border: "1px solid #E6E2D8" }}>
              {k}: {n}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl px-4 py-3" style={{ background: "#E7F2EE", border: "1px solid #CBE3DA" }}>
        <p className="text-xs font-bold mb-2" style={{ color: "#013A2B" }}>3+4) الحالة الحيّة الآن (مرشحون وطلبات مربوطة)</p>
        <p style={{ color: "var(--color-dark)" }}>
          مرشحون مربوطون: <strong>{String(live?.["candidatesLinked"] ?? 0)}</strong>
          <span className="mx-3">طلبات مربوطة: <strong>{String(live?.["applicationsLinked"] ?? 0)}</strong></span>
        </p>
        <p className="text-xs mt-1" style={{ color: "#47645A" }}>
          هذه أرقام حيّة قد تتغير لاحقاً — لا تُستخدم لتحديث النتيجة المجمّدة.
        </p>
      </div>

      <div className="rounded-xl px-4 py-3" style={{ background: "#FFF8E6", border: "1px solid #F0E3BC" }}>
        <p className="text-xs font-bold mb-2" style={{ color: "#5B4A1F" }}>5) كل محاولات البريد ({attempts.length})</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {Object.entries(emailByStatus).map(([k, n]) => (
            <span key={k} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#fff", border: "1px solid #E6E2D8" }}>
              {EMAIL_LABELS[k] ?? k}: {n}
            </span>
          ))}
        </div>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="text-right py-1">الحالة</th>
                <th className="text-right py-1">المفتاح</th>
                <th className="text-right py-1">المستلم</th>
                <th className="text-right py-1">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid #F0E3BC" }}>
                  <td className="py-1">{EMAIL_LABELS[a.status] ?? a.status}</td>
                  <td className="py-1 font-mono" dir="ltr" style={{ textAlign: "right" }}>{a.idempotencyKey ?? "—"}</td>
                  <td className="py-1 font-mono" dir="ltr" style={{ textAlign: "right" }}>{a.toAddress}</td>
                  <td className="py-1">{new Date(a.createdAt).toLocaleString("ar-SA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
