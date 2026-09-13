/**
 * Candidate invitation service.
 * Creates/refreshes a VerificationToken and sends the invitation email.
 */
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/infrastructure/database/client";
import { encrypt, decrypt } from "@/lib/crypto";
import { getOrgNotifier } from "@/infrastructure/notifications";
import { candidateInvitation } from "@/infrastructure/notifications/templates/invitation";

const TOKEN_EXPIRY_DAYS = 30;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generateToken(): string {
  // 32 random bytes → 64 hex chars — compact, URL-safe, unguessable
  return randomBytes(32).toString("hex");
}

function getLoginUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
  return base.replace(/\/$/, "");
}

export interface InvitationResult {
  sent: boolean;
  rawToken: string; // always returned for dev/log purposes
  email: string;
}

/**
 * Creates (or refreshes) a VerificationToken for `candidateId`
 * and sends the invitation email using the org's SMTP config.
 *
 * Safe to call multiple times — always invalidates old tokens first
 * by overwriting with the new hash.
 */
export async function sendInvitation(candidateId: string): Promise<InvitationResult> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { organization: true },
  });

  const rawToken = generateToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Invalidate existing active token (mark used) then create fresh one
  await prisma.verificationToken.updateMany({
    where: { candidateId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.verificationToken.create({
    data: { tokenHash, candidateId, expiresAt, tokenCiphertext: encrypt(rawToken) },
  });

  // Build email
  const loginUrl = getLoginUrl();
  const { subject, html } = candidateInvitation({
    candidateName:    candidate.nameAr,
    jobTitle:         candidate.jobTitle,
    department:       candidate.department,
    organizationName: candidate.organization.nameAr,
    rawToken,
    loginUrl,
    expiresInDays:    TOKEN_EXPIRY_DAYS,
  });

  // Send via org SMTP (falls back to console in dev if not configured)
  const notifier = await getOrgNotifier(candidate.organizationId);
  await notifier.send({ to: candidate.email, subject, html });

  return { sent: true, rawToken, email: candidate.email };
}

export type InvitationStatus = "active" | "used" | "expired";

export interface InvitationCode {
  code: string | null;   // null when the row predates encrypted storage
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * The most recent invitation for a candidate, decrypted for display in the HR
 * profile. Callers must already have authorized access to the candidate row
 * (tenant-scoped lookup); this helper deliberately does not re-check tenancy.
 */
export async function getLatestInvitation(candidateId: string): Promise<InvitationCode | null> {
  const row = await prisma.verificationToken.findFirst({
    where: { candidateId, purpose: "LOGIN" },
    orderBy: { createdAt: "desc" },
    select: { tokenCiphertext: true, createdAt: true, expiresAt: true, usedAt: true },
  });
  if (!row) return null;

  const status: InvitationStatus = row.usedAt ? "used" : row.expiresAt < new Date() ? "expired" : "active";
  let code: string | null = null;
  if (row.tokenCiphertext) {
    try { code = decrypt(row.tokenCiphertext); } catch { code = null; } // key rotated → unreadable, not fatal
  }
  return { code, status, createdAt: row.createdAt, expiresAt: row.expiresAt, usedAt: row.usedAt };
}
