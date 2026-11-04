"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle, XCircle, Loader2, Send, Users, Variable, Mail, Megaphone } from "lucide-react";
import { AVAILABLE_VARIABLES } from "@/infrastructure/directives/variables";

type DirectiveType = "INFO" | "URGENT" | "APPOINTMENT";
type Mode = "directive" | "invitation";
type EngagementChip =
  | "all"                     // every row
  | "no_invite"               // no invitation sent yet
  | "sent_not_opened"         // invite sent, email never opened
  | "opened_not_logged_in"    // email opened/clicked but never logged in
  | "logged_in_in_progress"   // logged in but journey not completed
  | "completed";              // finished

interface CandidateRow {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  status: string;
  invitationSent?: boolean;
  invitationSentAt?: string | null;
  lastLoginAt?: string | null;
  firstOpenedAt?: string | null;
  firstClickedAt?: string | null;
}

interface Template { id: string; title: string; body: string; type: DirectiveType }

interface Props {
  candidates: CandidateRow[];
  templates: Template[];
  departments: string[];
  initialMode?: Mode;
}

const ENGAGEMENT_CHIPS: Array<{ key: EngagementChip; label: string; hint: string }> = [
  { key: "all",                   label: "الكل",                 hint: "كل المرشحين المرئيين" },
  { key: "no_invite",             label: "لم تُرسَل دعوتهم",       hint: "لم يُرسَل لهم بريد بيانات الدخول بعد" },
  { key: "sent_not_opened",       label: "أُرسِلت ولم تُفتَح",      hint: "وصلت الدعوة لكن البريد لم يُفتح" },
  { key: "opened_not_logged_in",  label: "فتحوا ولم يسجّلوا دخول", hint: "فتحوا البريد (أو نقروا) ولم يدخلوا المنصة" },
  { key: "logged_in_in_progress", label: "دخلوا وتفاعلوا",         hint: "سجّلوا الدخول ورحلتهم لم تكتمل بعد" },
  { key: "completed",             label: "اكتملت رحلتهم",          hint: "انتهت رحلة الانضمام" },
];

function matchesChip(c: CandidateRow, chip: EngagementChip): boolean {
  const opened   = !!(c.firstOpenedAt || c.firstClickedAt);
  const loggedIn = !!c.lastLoginAt;
  const sent     = !!c.invitationSent;
  const status   = c.status;
  switch (chip) {
    case "all":                   return true;
    case "no_invite":             return !sent;
    case "sent_not_opened":       return sent && !opened;
    case "opened_not_logged_in":  return sent && opened && !loggedIn;
    case "logged_in_in_progress": return loggedIn && status !== "completed";
    case "completed":             return status === "completed";
  }
}

const STATUSES = ["approved", "pending", "in_progress", "under_review", "completed", "rejected"] as const;
const STATUS_LABEL: Record<string, string> = {
  approved: "مقبول", pending: "بانتظار القبول", in_progress: "قيد الإنجاز",
  under_review: "تحت المراجعة", completed: "مكتمل", rejected: "مرفوض",
};
const TYPE_TONE: Record<DirectiveType, { ar: string; color: string }> = {
  INFO:        { ar: "معلومة", color: "#013A2B" },
  URGENT:      { ar: "عاجل",   color: "#A83A30" },
  APPOINTMENT: { ar: "موعد",   color: "#C9A94A" },
};

export function BulkDirectiveForm({ candidates, templates, departments, initialMode = "directive" }: Props) {
  const [filterDept, setFilterDept]     = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [chip, setChip]                 = useState<EngagementChip>("all");

  const [mode, setMode]                   = useState<Mode>(initialMode);

  // Pacing — HR can override the backend defaults when a run needs to be gentler.
  const [concurrency, setConcurrency]     = useState<number>(2);
  const [minGapMs, setMinGapMs]           = useState<number>(500);
  const [type, setType]                   = useState<DirectiveType>("INFO");
  const [title, setTitle]                 = useState("");
  const [body, setBody]                   = useState("");
  const [allowReply, setAllowReply]       = useState(false);
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [skipActivated, setSkipActivated] = useState(true);

  const [status, setStatus]   = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport]   = useState<{ succeeded: number; failed: number; skipped?: number } | null>(null);
  const [busy, start]         = useTransition();

  const filtered = useMemo(() => candidates.filter((c) => {
    if (filterDept && c.department !== filterDept) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (search && !c.name.includes(search) && !c.jobTitle.includes(search)) return false;
    if (!matchesChip(c, chip)) return false;
    return true;
  }), [candidates, filterDept, filterStatus, search, chip]);

  // Chip counts reflect the search/dept/status scope — so HR sees how many rows
  // each engagement bucket holds within the slice they're currently browsing.
  const scoped = useMemo(() => candidates.filter((c) => {
    if (filterDept && c.department !== filterDept) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (search && !c.name.includes(search) && !c.jobTitle.includes(search)) return false;
    return true;
  }), [candidates, filterDept, filterStatus, search]);
  const chipCount = useMemo(() => {
    const m = new Map<EngagementChip, number>();
    for (const def of ENGAGEMENT_CHIPS) m.set(def.key, 0);
    for (const c of scoped) for (const def of ENGAGEMENT_CHIPS) if (matchesChip(c, def.key)) m.set(def.key, (m.get(def.key) ?? 0) + 1);
    return m;
  }, [scoped]);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAllFiltered() {
    const allIn = filtered.every((c) => selected.has(c.id));
    setSelected((prev) => {
      const n = new Set(prev);
      for (const c of filtered) { if (allIn) n.delete(c.id); else n.add(c.id); }
      return n;
    });
  }

  function applyTemplate(tpl: Template) {
    setTitle(tpl.title); setBody(tpl.body); setType(tpl.type); setStatus(null);
  }

  function submit() {
    setStatus(null); setReport(null);
    if (!selected.size) { setStatus({ ok: false, text: "اختر مرشحاً واحداً على الأقل" }); return; }

    if (mode === "directive") {
      if (!title.trim() || !body.trim()) { setStatus({ ok: false, text: "العنوان والنص مطلوبان" }); return; }
      if (!confirm(`سيُرسَل التوجيه لـ ${selected.size} مرشحاً. متابعة؟`)) return;
      start(async () => {
        const res = await fetch("/api/hr/directives/bulk", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateIds: Array.from(selected),
            type, title, body, allowReply, notifyByEmail,
            concurrency, minGapMs,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الإرسال" }); return; }
        setReport({ succeeded: json.succeeded, failed: json.failed });
        setStatus({ ok: true, text: `تم — نجح ${json.succeeded} وفشل ${json.failed}` });
        setSelected(new Set());
      });
      return;
    }

    // mode === "invitation"
    const confirmMsg = skipActivated
      ? `سيُعاد إرسال بيانات الدخول لـ ${selected.size} مرشحاً (باستثناء من سجّل دخوله مسبقاً). كل إرسال يُولّد كلمة مرور جديدة. متابعة؟`
      : `سيُعاد إرسال بيانات الدخول لـ ${selected.size} مرشحاً (حتى من سجّل دخوله مسبقاً — سيُستبدل كلمة مروره الحالية). متابعة؟`;
    if (!confirm(confirmMsg)) return;
    start(async () => {
      const res = await fetch("/api/hr/invitations/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: Array.from(selected), skipActivated, concurrency, minGapMs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الإرسال" }); return; }
      setReport({ succeeded: json.succeeded, failed: json.failed, skipped: json.skipped });
      setStatus({
        ok: true,
        text: `تم — نجح ${json.succeeded}${json.skipped ? ` · تخطّي ${json.skipped}` : ""} · فشل ${json.failed}`,
      });
      setSelected(new Set());
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم / الوظيفة"
              className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "var(--color-border)" }} />
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "var(--color-border)" }}>
              <option value="">كل الأقسام</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "var(--color-border)" }}>
              <option value="">كل الحالات</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div className="flex flex-wrap gap-1.5">
            {ENGAGEMENT_CHIPS.map((def) => {
              const active = chip === def.key;
              const count  = chipCount.get(def.key) ?? 0;
              return (
                <button key={def.key} type="button" title={def.hint}
                  onClick={() => setChip(def.key)}
                  className="text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5"
                  style={{
                    borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                    background:  active ? "var(--color-primary-muted)" : "var(--color-surface-alt)",
                    color:       active ? "var(--color-primary-dark)" : "var(--color-text)",
                    cursor: "pointer",
                  }}>
                  <span>{def.label}</span>
                  <span className="text-[10px] font-semibold opacity-75">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
              {filtered.length} مرشح مطابق · <span style={{ color: "var(--color-primary-dark)" }}>{selected.size} محدَّد</span>
            </span>
            <button type="button" onClick={toggleAllFiltered}
              className="text-xs px-2.5 py-1 rounded-md border"
              style={{ borderColor: "var(--color-border)", cursor: "pointer", color: "var(--color-text)" }}>
              {filtered.length && filtered.every((c) => selected.has(c.id)) ? "إلغاء التحديد" : "تحديد الكل"}
            </button>
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y" style={{ borderColor: "var(--color-border)" }}>
            {filtered.length === 0
              ? <p className="p-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>لا نتائج</p>
              : filtered.map((c) => {
                const opened   = !!(c.firstOpenedAt || c.firstClickedAt);
                const loggedIn = !!c.lastLoginAt;
                const sent     = !!c.invitationSent;
                return (
                <label key={c.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--color-surface-alt)]">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      {c.jobTitle} · {c.department} · {STATUS_LABEL[c.status] ?? c.status}
                    </p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {!sent ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                          style={{ borderColor: "rgba(168,58,48,0.3)", background: "var(--color-error-bg)", color: "var(--color-error)" }}>
                          لم تُرسَل الدعوة
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                            style={{ borderColor: "rgba(34,122,78,0.3)", background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                            أُرسِلت
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                            style={{
                              borderColor: opened ? "rgba(34,122,78,0.3)" : "var(--color-border)",
                              background:  opened ? "var(--color-success-bg)" : "var(--color-surface-alt)",
                              color:       opened ? "var(--color-success)"    : "var(--color-text-muted)",
                            }}>
                            {opened ? "فُتِحت" : "لم تُفتَح"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                            style={{
                              borderColor: loggedIn ? "rgba(34,122,78,0.3)" : "var(--color-border)",
                              background:  loggedIn ? "var(--color-success-bg)" : "var(--color-surface-alt)",
                              color:       loggedIn ? "var(--color-success)"    : "var(--color-text-muted)",
                            }}>
                            {loggedIn ? "دخل" : "لم يدخل"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </label>
                );
              })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {status && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
            style={{
              background: status.ok ? "var(--color-success-bg)" : "var(--color-error-bg)",
              color:      status.ok ? "var(--color-success)"    : "var(--color-error)",
              border: `1px solid ${status.ok ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
            }}>
            {status.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {status.text}
          </div>
        )}

        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          {/* Mode switch — directive vs invitation (resend login credentials). */}
          <div role="tablist" aria-label="نوع الإرسال" className="grid grid-cols-2 gap-2">
            {([
              { key: "directive",  Icon: Megaphone, label: "توجيه" },
              { key: "invitation", Icon: Mail,      label: "دعوة دخول" },
            ] as const).map(({ key, Icon, label }) => {
              const active = mode === key;
              return (
                <button key={key} type="button" role="tab" aria-selected={active}
                  onClick={() => { setMode(key); setStatus(null); setReport(null); }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold"
                  style={{
                    borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                    background:  active ? "var(--color-primary-muted)" : "var(--color-surface-alt)",
                    color:       active ? "var(--color-primary-dark)" : "var(--color-text)",
                    cursor: "pointer",
                  }}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              );
            })}
          </div>

          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-dark)" }}>
            <Users className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
            {mode === "directive" ? "محتوى التوجيه" : "إعادة إرسال بيانات الدخول"}
          </p>

          {mode === "invitation" && (
            <div className="text-[12px] leading-relaxed rounded-xl p-3 border"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text)" }}>
              يُرسَل بريد يحتوي اسم المستخدم (البريد) وكلمة مرور جديدة لكل مرشّح مختار.
              كل إرسال يُولّد كلمة مرور جديدة ويُلغي السابقة فور نجاح الإرسال.
              <label className="flex items-center gap-2 text-xs mt-2 cursor-pointer" style={{ color: "var(--color-dark)" }}>
                <input type="checkbox" checked={skipActivated} onChange={(e) => setSkipActivated(e.target.checked)} />
                تخطّي من سجّل دخوله مسبقاً (حفاظاً على كلمة مروره الحالية)
              </label>
            </div>
          )}

          {mode === "directive" && (
          <div className="flex items-center gap-1 flex-wrap">
            {(["INFO", "URGENT", "APPOINTMENT"] as DirectiveType[]).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className="text-xs px-2 py-1 rounded-md border"
                style={{
                  borderColor: type === t ? TYPE_TONE[t].color : "var(--color-border)",
                  background:  type === t ? `${TYPE_TONE[t].color}1A` : "var(--color-surface-alt)",
                  color: TYPE_TONE[t].color, cursor: "pointer",
                }}>{TYPE_TONE[t].ar}</button>
            ))}
          </div>
          )}

          {mode === "directive" && templates.length > 0 && (
            <div>
              <p className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>قوالب جاهزة:</p>
              <div className="flex flex-wrap gap-1">
                {templates.map((tpl) => (
                  <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                    className="text-[11px] px-2 py-1 rounded-md border"
                    style={{ borderColor: "var(--color-border)", color: TYPE_TONE[tpl.type].color, cursor: "pointer" }}>
                    {tpl.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "directive" && (
            <>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" maxLength={200}
                className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "var(--color-border)" }} />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} placeholder="النص (يُدعم المتغيّرات مثل {{candidate.firstName}})"
                className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "var(--color-border)" }} />

              <details className="rounded-md border p-2 text-[11px]" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                <summary className="cursor-pointer inline-flex items-center gap-1" style={{ color: "var(--color-primary-dark)" }}>
                  <Variable className="w-3 h-3" /> المتغيّرات المتاحة
                </summary>
                <div className="flex flex-wrap gap-1 mt-2">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <code key={v.key} dir="ltr" title={v.labelAr}
                      className="font-mono px-1.5 py-0.5 rounded border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                      {`{{${v.key}}}`}
                    </code>
                  ))}
                </div>
              </details>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-dark)" }}>
                  <input type="checkbox" checked={allowReply} onChange={(e) => setAllowReply(e.target.checked)} />
                  السماح بالرد
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-dark)" }}>
                  <input type="checkbox" checked={notifyByEmail} onChange={(e) => setNotifyByEmail(e.target.checked)} />
                  إرسال بريد
                </label>
              </div>
            </>
          )}

          <button type="button" onClick={submit}
            disabled={busy || !selected.size || (mode === "directive" && (!title.trim() || !body.trim()))}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: busy ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: busy || !selected.size ? "not-allowed" : "pointer" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {mode === "directive" ? `إرسال التوجيه لـ ${selected.size} مرشح` : `إرسال بيانات الدخول لـ ${selected.size} مرشح`}
          </button>

          {report && (
            <div className="rounded-md p-2 text-[11px]" style={{ background: "var(--color-primary-muted)", color: "var(--color-dark)" }}>
              نتائج: نجح <b>{report.succeeded}</b>
              {typeof report.skipped === "number" && report.skipped > 0 ? <> · تخطّي <b>{report.skipped}</b></> : null}
              {" "}· فشل <b>{report.failed}</b>
            </div>
          )}

          {/* Pacing — controls applied on top of backend defaults. */}
          <details className="rounded-md border p-2 text-[11px]"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <summary className="cursor-pointer inline-flex items-center gap-1 font-semibold" style={{ color: "var(--color-primary-dark)" }}>
              إعدادات سرعة الإرسال
            </summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="flex flex-col gap-1" style={{ color: "var(--color-dark)" }}>
                <span className="text-[11px]">عدد المتزامن (1–5)</span>
                <input type="number" min={1} max={5} value={concurrency}
                  onChange={(e) => setConcurrency(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                  className="px-2 py-1 rounded-md border text-sm" style={{ borderColor: "var(--color-border)" }} />
              </label>
              <label className="flex flex-col gap-1" style={{ color: "var(--color-dark)" }}>
                <span className="text-[11px]">الفارق بين إرسالَين (ms)</span>
                <input type="number" min={0} max={10000} step={50} value={minGapMs}
                  onChange={(e) => setMinGapMs(Math.max(0, Math.min(10000, Number(e.target.value) || 0)))}
                  className="px-2 py-1 rounded-md border text-sm" style={{ borderColor: "var(--color-border)" }} />
              </label>
            </div>
            <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>
              افتراضي ٢ بالتوازي و٥٠٠ ms بين إرسالَين. ارفع الفارق أو اخفض التوازي لو مزوّد البريد يرفض الدفعات السريعة.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
