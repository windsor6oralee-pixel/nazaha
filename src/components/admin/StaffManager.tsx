"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { Table, Td } from "@/components/ui/Table";
import { generatePassword, validatePassword } from "@/lib/password";

export interface StaffRow {
  id: string;
  email: string;
  nameAr: string;
  phone: string | null;
  role: string;
  roleAr: string;
  isActive: boolean;
  lastLoginAt: string | null;
  locked: boolean;
}

const ROLE_OPTIONS = [
  { value: "hr_officer", label: "موظف الموارد البشرية", hint: "يضيف المرشحين ويراجع المستندات ويسجّل الانسحاب" },
  { value: "hr_manager", label: "مدير الموارد البشرية", hint: "يعتمد الملفات ويرفضها ويكمل الانضمام ويدير الإعدادات" },
  { value: "admin", label: "مدير النظام", hint: "كل الصلاحيات، ومنها إدارة الموظفين" },
];

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; user: StaffRow }
  | { kind: "password"; user: StaffRow }
  | null;

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error ?? "حدث خطأ";
}

export function StaffManager({ users, currentUserId }: { users: StaffRow[]; currentUserId: string }) {
  const router = useRouter();
  const formId = useId();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [nameAr, setNameAr] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("hr_officer");
  const [password, setPassword] = useState("");

  function open(next: Dialog) {
    setError(null);
    setNotice(null);
    setNameAr(next && next.kind !== "create" ? next.user.nameAr : "");
    setEmail("");
    setPhone(next && next.kind === "edit" ? next.user.phone ?? "" : "");
    setRole(next && next.kind === "edit" ? next.user.role : "hr_officer");
    setPassword(next && next.kind === "edit" ? "" : generatePassword());
    setDialog(next);
  }

  function run(task: () => Promise<string | null>, success: string) {
    setError(null);
    startTransition(async () => {
      const problem = await task();
      if (problem) {
        setError(problem);
        return;
      }
      setNotice(success);
      setDialog(null);
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    if (dialog.kind !== "edit") {
      const weak = validatePassword(password);
      if (weak) return setError(weak);
    }
    if (dialog.kind === "create") {
      run(() => send("/api/admin/users", "POST", { nameAr, email, phone: phone || null, role, password }),
        `أُنشئ حساب ${nameAr}. سلّمه كلمة المرور بقناة آمنة.`);
    } else if (dialog.kind === "edit") {
      run(() => send(`/api/admin/users/${dialog.user.id}`, "PATCH", { nameAr, phone: phone || null, role }),
        "حُفظت التعديلات");
    } else {
      run(() => send(`/api/admin/users/${dialog.user.id}`, "PATCH", { password }),
        `ضُبطت كلمة مرور ${dialog.user.nameAr} وأُنهيت جلساته المفتوحة.`);
    }
  }

  function toggleActive(user: StaffRow) {
    run(() => send(`/api/admin/users/${user.id}`, "PATCH", { isActive: !user.isActive }),
      user.isActive ? `عُطّل حساب ${user.nameAr}` : `فُعّل حساب ${user.nameAr}`);
  }

  const showPassword = dialog?.kind === "create" || dialog?.kind === "password";

  return (
    <>
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {error && !dialog && <Alert tone="error" className="mb-4">{error}</Alert>}

      <Card
        flush
        title={`${users.length} حساب`}
        description="الأدوار تحدد ما يستطيع كل موظف فعله في رحلة المرشح"
        action={<Button icon="candidates" size="sm" onClick={() => open({ kind: "create" })}>إضافة موظف</Button>}
      >
        <Table columns={["الموظف", { label: "الدور" }, { label: "آخر دخول", hideBelow: "md" }, "الحالة", { label: "", width: "1%" }]}>
          {users.map((u) => {
            const self = u.id === currentUserId;
            return (
              <tr key={u.id}>
                <Td>
                  <div style={{ fontWeight: 600, color: "var(--ink)" }}>{u.nameAr}{self && " (أنت)"}</div>
                  <div className="ds-caption" style={{ color: "var(--ink-muted)", direction: "ltr", textAlign: "right" }}>{u.email}</div>
                </Td>
                <Td>{u.roleAr}</Td>
                <Td hideBelow="md" numeric>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("ar-SA-u-nu-latn") : "لم يدخل بعد"}
                </Td>
                <Td>
                  <Badge tone={!u.isActive ? "rejected" : u.locked ? "review" : "done"}>
                    {!u.isActive ? "معطّل" : u.locked ? "مقفل مؤقتاً" : "نشط"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex gap-1 justify-end flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => open({ kind: "edit", user: u })}>تعديل</Button>
                    <Button variant="ghost" size="sm" onClick={() => open({ kind: "password", user: u })}>كلمة المرور</Button>
                    {!self && (
                      <Button variant={u.isActive ? "danger" : "secondary"} size="sm" loading={isPending} onClick={() => toggleActive(u)}>
                        {u.isActive ? "تعطيل" : "تفعيل"}
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.kind === "create" ? "إضافة موظف" : dialog?.kind === "edit" ? `تعديل ${dialog.user.nameAr}` : `ضبط كلمة مرور ${dialog?.user.nameAr ?? ""}`}
        actions={
          <>
            <Button type="submit" form={formId} loading={isPending}>حفظ</Button>
            <Button variant="secondary" onClick={() => setDialog(null)}>إلغاء</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          {dialog?.kind !== "password" && (
            <>
              <Input label="الاسم" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required minLength={2} maxLength={120} />
              {dialog?.kind === "create" && (
                <Input label="البريد الإلكتروني (اسم الدخول)" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
              )}
              <Input
                label="رقم واتساب الموظف"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                placeholder="+9665XXXXXXXX"
                hint="رقم دولي يبدأ بـ + — يُستخدم في بطاقة التواصل الظاهرة للمرشح على بوابته"
              />
              <Select
                label="الدور"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={dialog?.kind === "edit" && dialog.user.id === currentUserId}
                hint={ROLE_OPTIONS.find((r) => r.value === role)?.hint}
              >
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </>
          )}
          {showPassword && (
            <div className="flex gap-2 items-end">
              <Input
                label="كلمة المرور"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1"
                hint="10 أحرف على الأقل، منها حرف ورقم. تُعرض الآن فقط — انسخها قبل الحفظ."
              />
              <Button variant="secondary" onClick={() => setPassword(generatePassword())}>توليد</Button>
            </div>
          )}
          {error && <Alert tone="error">{error}</Alert>}
        </form>
      </Modal>
    </>
  );
}
