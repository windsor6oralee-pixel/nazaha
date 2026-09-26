"use client";

import { useState, useRef, useTransition } from "react";
import {
  Upload, FileText, CheckCircle, XCircle, Loader2,
  Download, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react";

interface ParsedRow {
  row: number;
  name: string;
  email: string;
  nationalId?: string;
  jobTitle?: string;
  department?: string;
  acceptanceDate?: string;
  _error?: string;
}

interface ImportResult {
  row: number;
  name: string;
  email: string;
  status: "success" | "error";
  error?: string;
}

interface ImportResponse {
  succeeded: number;
  failed: number;
  results: ImportResult[];
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line, i) => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => { obj[h] = vals[j] ?? ""; });
    return {
      row: i + 2,
      name:           obj["name"] || obj["الاسم"] || obj["اسم"] || "",
      email:          obj["email"] || obj["البريد"] || obj["بريد"] || "",
      nationalId:     obj["nationalid"] || obj["national_id"] || obj["رقم الهوية"] || obj["هوية"] || undefined,
      jobTitle:       obj["jobtitle"] || obj["job_title"] || obj["المسمى الوظيفي"] || obj["وظيفة"] || undefined,
      department:     obj["department"] || obj["القسم"] || obj["قسم"] || undefined,
      acceptanceDate: obj["acceptancedate"] || obj["acceptance_date"] || obj["تاريخ القبول"] || undefined,
      _error: (!obj["email"] && !obj["البريد"] && !obj["بريد"]) ? "لا يوجد بريد إلكتروني" : undefined,
    };
  }).filter(r => r.name || r.email);
}

const CHUNK = 50;

export function CandidateImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows,      setRows]      = useState<ParsedRow[]>([]);
  const [fileName,  setFileName]  = useState("");
  const [response,  setResponse]  = useState<ImportResponse | null>(null);
  const [progress,  setProgress]  = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    setFileName(file.name);
    setResponse(null);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file, "utf-8");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function downloadTemplate() {
    const csv = "name,email,jobTitle,department,acceptanceDate\nمحمد العمري,m.omari@example.com,محلل مالي,المالية,2026-01-01\n";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "candidates-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const valid = rows.filter(r => !r._error);
    if (!valid.length) return;

    startTransition(async () => {
      const chunks: ParsedRow[][] = [];
      for (let i = 0; i < valid.length; i += CHUNK)
        chunks.push(valid.slice(i, i + CHUNK));

      const allResults: ImportResult[] = [];
      let done = 0;

      for (const chunk of chunks) {
        const res = await fetch("/api/hr/candidates/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });
        const json: ImportResponse = await res.json();
        allResults.push(...json.results);
        done += chunk.length;
        setProgress(Math.round((done / valid.length) * 100));
      }

      const succeeded = allResults.filter(r => r.status === "success").length;
      const failed    = allResults.filter(r => r.status === "error").length;
      setResponse({ succeeded, failed, results: allResults });
    });
  }

  const validRows   = rows.filter(r => !r._error);
  const invalidRows = rows.filter(r => r._error);
  const errorResults = response?.results.filter(r => r.status === "error") ?? [];

  const inputStyle = { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" };

  return (
    <div className="space-y-6">

      {/* Download template */}
      <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>قالب CSV جاهز للتحميل</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            أعمدة مطلوبة: <span dir="ltr">name, email</span> — بدون رقم هوية
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-primary)", cursor: "pointer" }}
        >
          <Download className="w-3.5 h-3.5" /> تحميل القالب
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors"
        style={{ borderColor: fileName ? "var(--color-primary)" : "var(--color-border)", background: fileName ? "var(--color-primary-muted)" : "var(--color-surface)" }}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--color-surface-alt)" }}>
          {fileName ? <FileText className="w-6 h-6" style={{ color: "var(--color-primary)" }} /> : <Upload className="w-6 h-6" style={{ color: "var(--color-text-muted)" }} />}
        </div>
        {fileName ? (
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>{fileName}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              {rows.length} سجل · {validRows.length} صالح · {invalidRows.length} به خطأ
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>اسحب ملف CSV هنا أو انقر للاختيار</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>يدعم ملفات .csv فقط · حتى 1000 سجل</p>
          </div>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && !response && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--color-surface-alt)", borderBottom: "1px solid var(--color-border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>معاينة البيانات</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1" style={{ color: "var(--color-success)" }}><CheckCircle className="w-3.5 h-3.5" />{validRows.length} صالح</span>
              {invalidRows.length > 0 && <span className="flex items-center gap-1" style={{ color: "var(--color-error)" }}><XCircle className="w-3.5 h-3.5" />{invalidRows.length} به خطأ</span>}
            </div>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr style={{ background: "var(--color-surface-alt)", borderBottom: "1px solid var(--color-border)" }}>
                  {["#", "الاسم", "البريد الإلكتروني", "المسمى الوظيفي", "الحالة"].map(h => (
                    <th key={h} className="px-4 py-2 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map(r => (
                  <tr key={r.row} style={{ borderBottom: "1px solid var(--color-border)", background: r._error ? "var(--color-error-bg)" : undefined }}>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>{r.row}</td>
                    <td className="px-4 py-2">{r.name || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                    <td className="px-4 py-2" dir="ltr">{r.email || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>{r.jobTitle || "موظف"}</td>
                    <td className="px-4 py-2">
                      {r._error
                        ? <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-error)" }}><XCircle className="w-3 h-3" />{r._error}</span>
                        : <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-success)" }}><CheckCircle className="w-3 h-3" />صالح</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 100 && (
              <p className="text-center text-xs py-2" style={{ color: "var(--color-text-muted)" }}>يظهر أول 100 سجل فقط في المعاينة</p>
            )}
          </div>
        </div>
      )}

      {/* Progress */}
      {isPending && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
            <span className="flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الاستيراد وإرسال الدعوات...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--color-primary)" }} />
          </div>
        </div>
      )}

      {/* Results */}
      {response && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border text-center" style={{ borderColor: "rgba(34,122,78,0.3)", background: "var(--color-success-bg)" }}>
              <p className="text-3xl font-bold" style={{ color: "var(--color-success)" }}>{response.succeeded}</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-success)" }}>تم استيرادهم وإرسال الدعوات</p>
            </div>
            <div className="p-4 rounded-xl border text-center" style={{ borderColor: "rgba(168,58,48,0.3)", background: "var(--color-error-bg)" }}>
              <p className="text-3xl font-bold" style={{ color: "var(--color-error)" }}>{response.failed}</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-error)" }}>فشل استيرادهم</p>
            </div>
          </div>

          {errorResults.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(168,58,48,0.3)" }}>
              <button
                onClick={() => setShowErrors(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
                style={{ background: "var(--color-error-bg)", color: "var(--color-error)", cursor: "pointer", border: "none" }}
              >
                <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />السجلات التي فشلت ({errorResults.length})</span>
                {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showErrors && (
                <div className="divide-y" style={{ borderColor: "rgba(168,58,48,0.15)" }}>
                  {errorResults.map(r => (
                    <div key={r.row} className="px-4 py-2 text-xs" style={{ background: "var(--color-surface)" }}>
                      <span className="font-medium" style={{ color: "var(--color-dark)" }}>سطر {r.row}: {r.name}</span>
                      <span dir="ltr" className="mx-2" style={{ color: "var(--color-text-muted)" }}>{r.email}</span>
                      <span style={{ color: "var(--color-error)" }}>— {r.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => { setRows([]); setFileName(""); setResponse(null); setProgress(0); if (fileRef.current) fileRef.current.value = ""; }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-primary)", cursor: "pointer" }}
          >
            استيراد ملف آخر
          </button>
        </div>
      )}

      {/* Import button */}
      {rows.length > 0 && !response && (
        <button
          onClick={handleImport}
          disabled={isPending || validRows.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: (isPending || validRows.length === 0) ? "var(--color-border)" : "var(--color-primary)",
            color: (isPending || validRows.length === 0) ? "var(--color-text-muted)" : "white",
            cursor: (isPending || validRows.length === 0) ? "not-allowed" : "pointer",
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          }}
        >
          {isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الاستيراد...</>
            : <><Upload className="w-4 h-4" /> استيراد {validRows.length} مرشح وإرسال الدعوات</>}
        </button>
      )}
    </div>
  );
}
