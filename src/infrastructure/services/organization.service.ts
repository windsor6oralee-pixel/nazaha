import type { OrgType } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";

export interface OrganizationProfile {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  type: OrgType;
  officialNameAr: string | null;
  authorizedSignerName: string | null;
  authorizedSignerTitle: string | null;
  commercialRegNo: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
}

export type OrganizationProfileInput = Partial<
  Pick<
    OrganizationProfile,
    | "nameAr" | "nameEn" | "type" | "officialNameAr" | "authorizedSignerName"
    | "authorizedSignerTitle" | "commercialRegNo" | "address" | "contactEmail"
    | "contactPhone" | "primaryColor"
  >
>;

// Minimal branding shown in both portals — data only, never behaviour.
export interface OrganizationBranding {
  nameAr: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

const profileSelect = {
  id: true, slug: true, nameAr: true, nameEn: true, type: true,
  officialNameAr: true, authorizedSignerName: true, authorizedSignerTitle: true,
  commercialRegNo: true, address: true, contactEmail: true, contactPhone: true,
  primaryColor: true, logoPath: true,
} as const;

function toProfile(row: { logoPath: string | null } & Omit<OrganizationProfile, "logoUrl">): OrganizationProfile {
  const { logoPath, ...rest } = row;
  return { ...rest, logoUrl: logoPath ? `/api/organization/logo?v=${encodeURIComponent(logoPath)}` : null };
}

export async function getOrganizationProfile(organizationId: string): Promise<OrganizationProfile | null> {
  const row = await prisma.organization.findUnique({ where: { id: organizationId }, select: profileSelect });
  return row ? toProfile(row) : null;
}

export async function getOrganizationBranding(organizationId: string): Promise<OrganizationBranding> {
  const row = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { nameAr: true, logoPath: true, primaryColor: true },
  });
  return {
    nameAr: row?.nameAr ?? "",
    logoUrl: row?.logoPath ? `/api/organization/logo?v=${encodeURIComponent(row.logoPath)}` : null,
    primaryColor: row?.primaryColor ?? null,
  };
}

export async function updateOrganizationProfile(
  organizationId: string,
  input: OrganizationProfileInput
): Promise<OrganizationProfile> {
  const row = await prisma.organization.update({
    where: { id: organizationId },
    data: input,
    select: profileSelect,
  });
  return toProfile(row);
}

export async function getOrganizationLogoPath(organizationId: string): Promise<string | null> {
  const row = await prisma.organization.findUnique({ where: { id: organizationId }, select: { logoPath: true } });
  return row?.logoPath ?? null;
}

export async function setOrganizationLogo(organizationId: string, logoPath: string | null) {
  await prisma.organization.update({ where: { id: organizationId }, data: { logoPath } });
}
