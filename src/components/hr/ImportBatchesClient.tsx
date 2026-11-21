"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { parseCsvRecords } from "@/lib/csv";

interface BatchRow {
  id: string;
  reference: string;
  status: string;
  sourceFileName: string | null;
  totalRows: number;
  validRows: number;
  importedCount: number;
  failedCount: number;
  createdAt: string;
  finishedAt: string | null;
}

export const BATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: "مرفوعة",
  VALIDATING: "قيد التحقق",
  READY: "جاهزة للاعتماد",
  APPROVED: "معتمدة",
  EXECUTING: "قيد التنفيذ",
  COMPLETED: "مكتملة",
  PARTIAL: "مكتملة جزئياً",
  FAILED: "فشلت",
  CANCELLED: "ملغاة",
  ARCHIVED: "مؤرشفة",
};

const TERMINAL = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED", "ARCHIVED"];

function statusChip(status: string): React.CSSProperties {
  const done = TERMINAL.includes(status);
  const active = status === "EXECUTING" || status === "VALIDATING" || status === "APPROVED";
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: done ? "#EFEFEF" : active ? "#E7F2EE" : "#F4F2EC",
    color: done ? "#6B7280" : active ? "#013A2B" : "#5B4A1F",
    border: "1px solid #E6E2D8",
  };
}

function parseCsvRows(text: string): Record<string, string>[] {
  return parseCsvRecords(text);
}

function toRowInput(o: Record<string, string>, i: number) {
  return {
    itemKey: o["itemkey"] ?? o["key"] ?? `row-${i + 1}`,
    nameAr: o["namear"] ?? o["name"] ?? o["الاسم"] ?? "",
    email: o["email"] ?? o["بريد"] ?? "",
    password: o["password"] ?? o["كلمة المرور"] ?? o["كلمة سر"] ?? "",
    nationalId: o["nationalid"] ?? o["id"] ?? o["الهوية"] ?? "",
    jobTitle: o["jobtitle"] ?? o["المسمى"] ?? "",
    department: o["department"] ?? o["الإدارة"] ?? "",
    acceptanceDate: o["acceptancedate"] ?? o["التاريخ"] ?? "",
  };
}

export function ImportBatchesClient() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch without touching state — shared by the effect (initial load) and the
  // manual refresh (which additionally flips the loading flag).
  const fetchBatches = useCallback(async (): Promise<BatchRow[]> => {
    const res = await fetch("/api/hr/import-batches");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "فشل الجلب");
    return json.batches ?? [];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBatches(await fetchBatches());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الجلب");
    } finally {
      setLoading(false);
    }
  }, [fetchBatches]);

  // Initial load: `loading` already starts true, so this only needs to settle
  // state after the fetch resolves (never synchronously in the effect body).
  useEffect(() => {
    let cancelled = false;
    fetchBatches()
      .then((b) => { if (!cancelled) { setBatches(b); setError(null); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "فشل الجلب"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [fetchBatches]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function handleCreate() {
    setCreateError(null);
    const rows = parseCsvRows(csv).map(toRowInput);
    if (!rows.length) {
      setCreateError("لا توجد صفوف صالحة — الصق CSV يبدأ بصف عناوين");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/hr/import-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, sourceFileName: fileName || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "فشل الإنشاء");
      setCsv("");
      setFileName("");
      router.push(`/hr/import-batches/${json.batch.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "فشل الإنشاء");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Create card */}
      <section
        className="rounded-2xl p-5 sm:p-6"
        style={{ background: "var(--color-surface, #fff)", border: "1px solid #E6E2D8" }}
      >
        <h2 className="text-lg font-bold mb-1" style={{ color: "var(--color-dark)" }}>رفع دفعة جديدة</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          الأعمدة المطلوبة: <code>name</code> و<code>email</code> و<code>password</code> — والاختيارية:
          <code> nationalid</code> و<code>jobtitle</code> و<code>department</code> و<code>acceptancedate</code>.
          كلمة المرور تُخزَّن مشفَّرة حتى تنفيذ الدفعة، فتُضبط لكل مرشح وتفعَّل حسابه فوراً — بلا إرسال رسائل.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          className="block w-full text-sm mb-3"
          dir="ltr"
          style={{ color: "var(--color-text-muted)" }}
        />
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          placeholder={"name,email,password,nationalid,jobtitle,department\nأحمد علي,ahmed@example.com,Sirr123456,1098765432,مهندس,الهندسة"}
          className="w-full rounded-xl px-3 py-2 text-sm font-mono"
          style={{ border: "1px solid #E6E2D8", background: "#FBFAF7", color: "var(--color-dark)" }}
          dir="ltr"
        />
        {createError && (
          <p role="alert" className="text-xs mt-2" style={{ color: "var(--danger-500, #B42318)" }}>{createError}</p>
        )}
        <div className="mt-4">
          <Button icon="upload" onClick={handleCreate} loading={creating}>
            {creating ? "جارٍ الرفع..." : "رفع الدفعة"}
          </Button>
        </div>
      </section>

      {/* List */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-dark)" }}>الدفعات</h2>
          <Button variant="ghost" size="sm" onClick={() => void load()} loading={loading}>تحديث</Button>
        </div>

        {error && <p role="alert" className="text-sm" style={{ color: "var(--danger-500, #B42318)" }}>{error}</p>}
        {!error && loading && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>جارٍ التحميل...</p>}

        {!loading && !error && batches.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد دفعات بعد.</p>
        )}

        {batches.length > 0 && (
          <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid #E6E2D8" }}>
            <table className="w-full text-sm" style={{ background: "#fff" }}>
              <thead>
                <tr style={{ background: "#F4F2EC", color: "var(--color-dark)" }}>
                  <th className="text-right px-4 py-3 font-semibold">المرجع</th>
                  <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                  <th className="text-right px-4 py-3 font-semibold">الصفوف</th>
                  <th className="text-right px-4 py-3 font-semibold">صالحة</th>
                  <th className="text-right px-4 py-3 font-semibold">مستوردة</th>
                  <th className="text-right px-4 py-3 font-semibold">فشلت</th>
                  <th className="text-right px-4 py-3 font-semibold">الإنشاء</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid #EFECE4" }}>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr" style={{ color: "var(--color-dark)" }}>
                      {b.reference}
                      {b.sourceFileName && (
                        <span className="block text-[11px]" style={{ color: "var(--color-text-muted)" }}>{b.sourceFileName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><span style={statusChip(b.status)}>{BATCH_STATUS_LABELS[b.status] ?? b.status}</span></td>
                    <td className="px-4 py-3" style={{ color: "var(--color-text-muted)" }}>{b.totalRows}</td>
                    <td className="px-4 py-3" style={{ color: "var(--color-text-muted)" }}>{b.validRows}</td>
                    <td className="px-4 py-3" style={{ color: "#013A2B", fontWeight: 600 }}>{b.importedCount}</td>
                    <td className="px-4 py-3" style={{ color: b.failedCount ? "var(--danger-500, #B42318)" : "var(--color-text-muted)" }}>{b.failedCount}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(b.createdAt).toLocaleString("ar-SA")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/hr/import-batches/${b.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "var(--color-primary)" }}
                      >
                        فتح <Icon name="chevron" size={16} label={false} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
