import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import type { SessionType } from "@/types/next-auth";
import { prisma } from "@/infrastructure/database/client";

// Credential verification lives here (not inside the NextAuth config) so it can be
// unit-tested directly. Each verifier returns the session principal or null; it never
// throws for a wrong credential.

export interface AuthPrincipal {
  id: string;
  email: string;
  nameAr: string;
  role: string;
  sessionType: SessionType;
  organizationId: string;
  applicationId?: string;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000; // 15 minutes

export async function verifyHRCredentials(email: string, password: string): Promise<AuthPrincipal | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { role: true, organization: { select: { isActive: true } } },
  });
  if (!user || !user.isActive || !user.organization.isActive) return null;

  // Lockout check — return null without revealing whether the account exists
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorType: "USER", action: "user.login", resource: "User", resourceId: user.id, userId: user.id },
  });

  return {
    id: user.id,
    email: user.email,
    nameAr: user.nameAr,
    role: user.role.name,
    sessionType: "hr_user",
    organizationId: user.organizationId,
  };
}

export async function verifyCandidateToken(rawToken: string): Promise<AuthPrincipal | null> {
  const token = await prisma.verificationToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { candidate: { include: { organization: { select: { isActive: true } } } } },
  });
  if (!token || token.usedAt || token.expiresAt < new Date()) return null;

  const candidate = token.candidate;
  if (!candidate.organization.isActive) return null;

  const application = await prisma.application.findFirst({
    where: { candidateId: candidate.id, status: { notIn: ["COMPLETED", "WITHDRAWN", "REJECTED"] } },
    orderBy: { createdAt: "desc" },
  });

  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.candidate.update({ where: { id: candidate.id }, data: { lastAccessAt: new Date() } }),
  ]);
  await prisma.auditLog.create({
    data: {
      actorType: "CANDIDATE", action: "candidate.login", resource: "Candidate",
      resourceId: candidate.id, candidateId: candidate.id, applicationId: application?.id,
    },
  });

  return {
    id: candidate.id,
    email: candidate.email,
    nameAr: candidate.nameAr,
    role: "candidate",
    sessionType: "candidate",
    organizationId: candidate.organizationId,
    applicationId: application?.id,
  };
}

export async function verifyPlatformCredentials(email: string, password: string): Promise<AuthPrincipal | null> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!admin || !admin.isActive) return null;

  if (admin.lockedUntil && admin.lockedUntil > new Date()) return null;

  const passwordOk = await compare(password, admin.passwordHash);
  if (!passwordOk) {
    const attempts = admin.failedLoginAttempts + 1;
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    return null;
  }

  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorType: "SYSTEM", action: "platform_admin.login", resource: "PlatformAdmin", resourceId: admin.id },
  });

  return {
    id: admin.id,
    email: admin.email,
    nameAr: admin.nameAr,
    role: "platform_admin",
    sessionType: "platform_admin",
    organizationId: "",
  };
}

// ── Per-request liveness ─────────────────────────────────────────────────────
// JWT sessions outlive database state, so tenant context re-checks that both the
// organization and (for staff) the user are still active. Cached briefly to keep the
// cost to one lightweight query per minute per principal.

const TTL_MS = 60_000;
const liveness = new Map<string, { active: boolean; until: number }>();

export function resetLivenessCache() {
  liveness.clear();
}

export async function isPrincipalActive(principal: { sessionType: SessionType; id: string; organizationId: string }): Promise<boolean> {
  if (principal.sessionType === "platform_admin") return true;
  const key = `${principal.sessionType}:${principal.id}`;
  const cached = liveness.get(key);
  if (cached && cached.until > Date.now()) return cached.active;

  let active = false;
  if (principal.sessionType === "hr_user") {
    const u = await prisma.user.findUnique({
      where: { id: principal.id },
      select: { isActive: true, organizationId: true, organization: { select: { isActive: true } } },
    });
    active = !!u && u.isActive && u.organization.isActive && u.organizationId === principal.organizationId;
  } else {
    const c = await prisma.candidate.findUnique({
      where: { id: principal.id },
      select: { organizationId: true, organization: { select: { isActive: true } } },
    });
    active = !!c && c.organization.isActive && c.organizationId === principal.organizationId;
  }

  liveness.set(key, { active, until: Date.now() + TTL_MS });
  return active;
}
