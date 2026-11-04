import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { listStaff } from "@/infrastructure/services/staff.service";
import { StaffManager } from "@/components/admin/StaffManager";

export default async function StaffPage() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") redirect("/auth/login");
  // إدارة الموظفين لمدير النظام وحده.
  if (ctx.role !== "admin") redirect("/admin");

  const users = await listStaff(ctx.organizationId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>الموظفون والصلاحيات</span>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>الإدارة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>الموظفون والصلاحيات</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          أضف فريق الموارد البشرية وحدد دور كل عضو. تعطيل الحساب أو تغيير دوره يُنهي جلساته المفتوحة فوراً.
        </p>
      </div>

      <StaffManager
        currentUserId={ctx.userId}
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          nameAr: u.nameAr,
          phone: u.phone,
          role: u.role,
          roleAr: u.roleAr,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          locked: u.isLocked,
        }))}
      />
    </div>
  );
}
