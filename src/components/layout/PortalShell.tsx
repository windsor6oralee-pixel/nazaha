import type { ReactNode } from "react";
import { AppShell, type NavGroup } from "@/components/layout/AppShell";
import { OnlineBadge } from "@/components/hr/OnlineBadge";
import { WhatsAppContact } from "@/components/candidate/WhatsAppContact";
import { getOrganizationBranding } from "@/infrastructure/services/organization.service";
import type { TenantContext } from "@/infrastructure/tenant";

const ADMIN_ROLES = ["admin", "hr_manager"];

// Server wrapper: resolves tenant branding once per request and feeds the client shell.
// Candidates see the org's name and logo only; the sidebar colour is an HR-portal affordance.
// The context arrives from the layout, which already resolved it — asking for it again
// here would repeat the liveness query on every page.
export async function PortalShell({
  type,
  ctx,
  children,
}: {
  type: "candidate" | "hr";
  ctx: TenantContext;
  children: ReactNode;
}) {
  const branding = await getOrganizationBranding(ctx.organizationId);
  const showAdmin = type === "hr" && ctx.kind === "hr" && ADMIN_ROLES.includes(ctx.role);

  const nav: NavGroup[] =
    type === "hr"
      ? [
          {
            items: [
              { href: "/hr", label: "لوحة التحكم", icon: "dashboard", exact: true },
              { href: "/hr/candidates", label: "المرشحون", icon: "candidates" },
              { href: "/hr/reports", label: "التقارير", icon: "reports" },
            ],
          },
          ...(showAdmin
            ? [
                {
                  label: "الإدارة",
                  items: [
                    { href: "/admin", label: "الإعدادات", icon: "settings", exact: true },
                    { href: "/admin/organization", label: "هوية الجهة", icon: "profile" },
                    { href: "/admin/candidate-fields", label: "الحقول المخصصة", icon: "filter" },
                    { href: "/admin/contracts", label: "قوالب العقود", icon: "justice" },
                    { href: "/admin/settings", label: "خادم البريد", icon: "messages" },
                    { href: "/admin/audit", label: "سجل التدقيق", icon: "integrity" },
                  ],
                } satisfies NavGroup,
              ]
            : []),
        ]
      : [
          {
            items: [
              { href: "/candidate", label: "رحلتي", icon: "dashboard", exact: true },
              { href: "/candidate/documents", label: "المستندات", icon: "documents" },
              { href: "/candidate/contract", label: "العقد", icon: "justice" },
            ],
          },
        ];

  return (
    <AppShell
      nav={nav}
      homeHref={type === "hr" ? "/hr" : "/candidate"}
      signOutUrl={type === "hr" ? "/auth/login" : "/auth/candidate"}
      userName={ctx.nameAr}
      orgName={branding?.nameAr}
      orgLogoUrl={branding?.logoUrl ?? null}
      sideColor={type === "hr" ? branding?.primaryColor ?? null : null}
      headerEnd={type === "hr" ? <OnlineBadge /> : undefined}
      asideExtra={
        // زر واتساب للمرشح فقط — يظهر بعد دخوله برمز الدعوة، برقم جهة المرشح.
        type === "candidate" ? (
          <WhatsAppContact
            phone={branding?.contactPhone ?? null}
            orgName={branding?.nameAr ?? null}
            candidateName={ctx?.nameAr ?? null}
            variant="pill"
          />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
