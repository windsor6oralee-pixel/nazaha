import { NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { isPrincipalActive } from "@/infrastructure/auth/credentials.service";

export interface HRContext {
  kind: "hr";
  userId: string;
  organizationId: string;
  role: string;
  nameAr: string;
  email: string | null;
}

export interface CandidateContext {
  kind: "candidate";
  candidateId: string;
  organizationId: string;
  applicationId: string | null;
  nameAr: string;
  email: string | null;
}

// Platform admins have NO tenant context by design; they never satisfy requireHR/requireAuth.
export interface PlatformContext {
  kind: "platform";
  adminId: string;
  nameAr: string;
  email: string | null;
}

export type TenantContext = HRContext | CandidateContext;

export function deny(status: 401 | 403 | 404, message?: string) {
  const fallback = status === 401 ? "غير مصرح" : status === 403 ? "صلاحيات غير كافية" : "غير موجود";
  return NextResponse.json({ error: message ?? fallback }, { status });
}

// A valid JWT is necessary but not sufficient: the organization (and, for staff, the
// user) must still be active right now. Suspension therefore takes effect within the
// liveness cache TTL, not at token expiry.
export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.organizationId) return null;
  if (u.sessionType !== "hr_user" && u.sessionType !== "candidate") return null;

  if (!(await isPrincipalActive({ sessionType: u.sessionType, id: u.id, organizationId: u.organizationId }))) {
    return null;
  }

  if (u.sessionType === "hr_user") {
    return {
      kind: "hr",
      userId: u.id,
      organizationId: u.organizationId,
      role: u.role ?? "",
      nameAr: u.nameAr,
      email: u.email ?? null,
    };
  }
  return {
    kind: "candidate",
    candidateId: u.id,
    organizationId: u.organizationId,
    applicationId: u.applicationId ?? null,
    nameAr: u.nameAr,
    email: u.email ?? null,
  };
}

export async function getPlatformContext(): Promise<PlatformContext | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || u.sessionType !== "platform_admin") return null;
  return { kind: "platform", adminId: u.id, nameAr: u.nameAr, email: u.email ?? null };
}

export async function requireAuth(): Promise<TenantContext | NextResponse> {
  return (await getTenantContext()) ?? deny(401);
}

export async function requireHR(opts?: { roles?: string[] }): Promise<HRContext | NextResponse> {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") return deny(401);
  if (opts?.roles && !opts.roles.includes(ctx.role)) return deny(403);
  return ctx;
}

export async function requireCandidate(): Promise<CandidateContext | NextResponse> {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "candidate") return deny(401);
  return ctx;
}

export async function requirePlatformAdmin(): Promise<PlatformContext | NextResponse> {
  return (await getPlatformContext()) ?? deny(401);
}
