import { Navbar } from "@/components/layout/Navbar";
import { getTenantContext } from "@/infrastructure/tenant";
import { getOrganizationBranding } from "@/infrastructure/services/organization.service";

const ADMIN_ROLES = ["admin", "hr_manager"];

// Server wrapper: resolves tenant branding once per request and feeds the client Navbar.
// Candidates see the org's name and logo only; the header colour is an HR-portal affordance.
export async function PortalNavbar({ type }: { type: "candidate" | "hr" }) {
  const ctx = await getTenantContext();
  const branding = ctx ? await getOrganizationBranding(ctx.organizationId) : null;

  return (
    <Navbar
      type={type}
      userName={ctx?.nameAr}
      orgName={branding?.nameAr}
      orgLogoUrl={branding?.logoUrl ?? null}
      headerColor={type === "hr" ? branding?.primaryColor ?? null : null}
      showAdmin={type === "hr" && ctx?.kind === "hr" && ADMIN_ROLES.includes(ctx.role)}
    />
  );
}
