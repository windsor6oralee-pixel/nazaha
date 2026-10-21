import { KeyRound, ShieldCheck, UserCog, Users, UserRound } from "lucide-react";
import { getPlatformContext } from "@/infrastructure/tenant";
import { listPlatformAdmins, listTenantUsers, listCandidateAccounts } from "@/infrastructure/platform/account.service";
import { ResetPasswordControl } from "@/components/platform/ResetPasswordControl";

/*
 * حسابات الدخول — منظور مشغّل المنصة.
 *
 * هنا يستطيع المشغّل ضبط كلمة مرور أي حساب في المنصة: حسابه هو، وحسابات
 * مشغّلي المنصة الآخرين، وحسابات موظفي كل جهة. العملية تُسجَّل في سجل التدقيق
 * وتُبطل جلسات الحساب المعني.
 */

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(d);
}

function isLocked(lockedUntil: Date | null): boolean {
  return !!lockedUntil && lockedUntil.getTime() > Date.now();
}

export default async function PlatformAccountsPage() {
  const ctx = await getPlatformContext();
  const [admins, users, candidates] = await Promise.all([
    listPlatformAdmins(),
    listTenantUsers(),
    listCandidateAccounts(),
  ]);

  // تجميع موظفي الجهة تحت جهتهم.
  const byOrg = new Map<string, { nameAr: string; users: typeof users }>();
  for (const u of users) {
    const entry = byOrg.get(u.organizationId) ?? { nameAr: u.organizationName, users: [] };
    entry.users.push(u);
    byOrg.set(u.organizationId, entry);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-gold)" }}>إدارة المنصة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>حسابات الدخول</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          ضبط كلمات المرور لكل حسابات المنصة. تغيير كلمة المرور يُبطل جلسات الحساب المفتوحة فوراً، ويُسجَّل في سجل التدقيق.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── حساب المشغّل الحالي ── */}
        {ctx && (
          <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
              <KeyRound className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>حسابي</span>
            </div>
            <div className="p-4 flex flex-wrap items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-primary-muted)" }}>
                <ShieldCheck className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{ctx.nameAr}</p>
                <p dir="ltr" className="text-[11px] font-mono text-right mt-0.5" style={{ color: "var(--color-text-muted)" }}>{ctx.email}</p>
              </div>
              <ResetPasswordControl kind="admin" id={ctx.adminId} email={ctx.email ?? ""} isSelf />
            </div>
          </section>
        )}

        {/* ── مشغّلو المنصة ── */}
        <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
              <ShieldCheck className="w-4 h-4" style={{ color: "var(--color-gold)" }} /> مشغّلو المنصة
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{admins.length} حساب</span>
          </div>
          {admins.length === 0 ? (
            <p className="p-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد حسابات</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {admins.map((a) => (
                <li key={a.id} className="p-4 flex flex-wrap items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.isActive ? "var(--color-primary-muted)" : "var(--color-surface-alt)" }}>
                    <ShieldCheck className="w-5 h-5" style={{ color: a.isActive ? "var(--color-primary)" : "var(--color-text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{a.nameAr}</p>
                      {ctx?.adminId === a.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-gold-muted)", color: "var(--color-gold)" }}>أنت</span>
                      )}
                      {!a.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>معطّل</span>
                      )}
                      {isLocked(a.lockedUntil) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>مقفول</span>
                      )}
                    </div>
                    <p dir="ltr" className="text-[11px] font-mono mt-0.5 text-right" style={{ color: "var(--color-text-muted)" }}>{a.email}</p>
                  </div>
                  <div className="hidden lg:block text-[11px] text-left" style={{ color: "var(--color-text-muted)" }}>
                    <p>آخر دخول: {fmtDate(a.lastLoginAt)}</p>
                    <p>تغيير كلمة المرور: {fmtDate(a.passwordChangedAt)}</p>
                  </div>
                  <ResetPasswordControl kind="admin" id={a.id} email={a.email} isSelf={ctx?.adminId === a.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── موظفو الجهات ── */}
        <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
              <Users className="w-4 h-4" style={{ color: "var(--color-gold)" }} /> موظفو الجهات
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{users.length} حساب</span>
          </div>
          {byOrg.size === 0 ? (
            <p className="p-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد حسابات موظفين</p>
          ) : (
            [...byOrg.entries()].map(([orgId, org]) => (
              <div key={orgId}>
                <div className="px-5 py-2 border-b flex items-center gap-2" style={{ borderColor: "var(--color-border)" }}>
                  <UserCog className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>{org.nameAr}</span>
                  <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{org.users.length} حساب</span>
                </div>
                <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                  {org.users.map((u) => (
                    <li key={u.id} className="px-5 py-3.5 flex flex-wrap items-center gap-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: u.isActive ? "var(--color-primary-muted)" : "var(--color-surface-alt)" }}>
                        <UserCog className="w-4 h-4" style={{ color: u.isActive ? "var(--color-primary)" : "var(--color-text-muted)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{u.nameAr}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>{u.roleName}</span>
                          {!u.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>معطّل</span>
                          )}
                          {isLocked(u.lockedUntil) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>مقفول</span>
                          )}
                        </div>
                        <p dir="ltr" className="text-[11px] font-mono mt-0.5 text-right" style={{ color: "var(--color-text-muted)" }}>{u.email}</p>
                      </div>
                      <div className="hidden lg:block text-[11px] text-left" style={{ color: "var(--color-text-muted)" }}>
                        <p>آخر دخول: {fmtDate(u.lastLoginAt)}</p>
                        <p>تغيير كلمة المرور: {fmtDate(u.passwordChangedAt)}</p>
                      </div>
                      <ResetPasswordControl kind="user" id={u.id} email={u.email} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* ── حسابات المرشحين ── */}
        <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
              <UserRound className="w-4 h-4" style={{ color: "var(--color-gold)" }} /> حسابات المرشحين
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {candidates.filter((c) => c.hasAccount).length} حساب مفعّل
            </span>
          </div>
          {candidates.length === 0 ? (
            <p className="p-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>لا يوجد مرشحون</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {candidates.map((c) => (
                <li key={c.id} className="px-5 py-3.5 flex flex-wrap items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.hasAccount ? "var(--color-primary-muted)" : "var(--color-surface-alt)" }}>
                    <UserRound className="w-4 h-4" style={{ color: c.hasAccount ? "var(--color-primary)" : "var(--color-text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{c.nameAr}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>{c.organizationName}</span>
                      {c.hasAccount ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>مفعّل</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>بلا حساب</span>
                      )}
                      {isLocked(c.lockedUntil) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>مقفول</span>
                      )}
                    </div>
                    <p dir="ltr" className="text-[11px] font-mono mt-0.5 text-right" style={{ color: "var(--color-text-muted)" }}>
                      {c.loginEmail ?? c.contactEmail}
                    </p>
                  </div>
                  <div className="hidden lg:block text-[11px] text-left" style={{ color: "var(--color-text-muted)" }}>
                    <p>آخر دخول: {fmtDate(c.lastLoginAt)}</p>
                    <p>تغيير كلمة المرور: {fmtDate(c.passwordChangedAt)}</p>
                  </div>
                  <ResetPasswordControl
                    kind="candidate"
                    id={c.id}
                    email={c.loginEmail ?? c.contactEmail}
                    label={c.hasAccount ? "ضبط كلمة المرور" : "إنشاء حساب"}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
