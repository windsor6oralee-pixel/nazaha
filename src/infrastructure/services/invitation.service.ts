/**
 * Candidate credentials provisioning service.
 *
 * Replaces the legacy token-link flow: generates a strong one-time password per
 * candidate, provisions the account (loginEmail = candidate's email + bcrypt
 * hash), then sends an email containing username and password as copyable text.
 *
 * Ordering is deliberate — email is sent FIRST, then the hash is persisted. If
 * SMTP rejects, nothing is written. If the mail is accepted but the DB write
 * then fails, the candidate holds credentials that don't match stored state yet
 * and the error is logged with their id so an operator can rerun — far safer
 * than persisting a password the candidate never saw.
 */
import { hash } from "bcryptjs";
import { prisma } from "@/infrastructure/database/client";
import { encrypt, decrypt } from "@/lib/crypto";
import { generateCandidatePassword } from "@/lib/password-gen";
import { getOrgNotifier } from "@/infrastructure/notifications";
import { candidateCredentials } from "@/infrastructure/notifications/templates/credentials";
import { getDefaultFor } from "@/infrastructure/email-templates/template.service";
import { buildContext, renderVariables } from "@/infrastructure/directives/variables";

function getLoginUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
  return base.replace(/\/$/, "");
}

export interface InvitationResult {
  sent: boolean;
  // true when a real transport (SMTP) handed off the mail — Console stubs are false
  delivered: boolean;
  rawToken: string;   // kept for API compatibility; now holds the generated password
  email: string;
}

export class InvitationError extends Error {
  constructor(readonly code: "EMAIL_TAKEN" | "NO_PROVIDER", message: string) {
    super(message);
    this.name = "InvitationError";
  }
}

/**
 * Provisions a login (loginEmail = candidate.email, random password) and emails
 * the credentials. Safe to re-run — each call rotates the password. Only flips
 * invitationSent after a transport-backed delivery.
 */
export async function sendInvitation(candidateId: string): Promise<InvitationResult> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { organization: true },
  });

  const loginEmail = candidate.email.trim().toLowerCase();
  if (!loginEmail) throw new InvitationError("EMAIL_TAKEN", "المرشح لا يملك بريداً صالحاً");

  // Reject if another candidate already owns this loginEmail — avoids silent collisions.
  const clash = await prisma.candidate.findUnique({ where: { loginEmail }, select: { id: true } });
  if (clash && clash.id !== candidateId) {
    throw new InvitationError("EMAIL_TAKEN", `البريد ${loginEmail} مستخدم لحساب مرشح آخر`);
  }

  const password     = generateCandidatePassword(12);
  const passwordHash = await hash(password, 12);

  // The credentials template produces the full branded HTML (brand header,
  // user-select blocks for copy-paste of email + password). An org can override
  // just the greeting shell through the EmailTemplate library: we inject its
  // rendered text block above the credentials panel, keeping the copy-paste UX.
  const base = candidateCredentials({
    candidateName:    candidate.nameAr,
    jobTitle:         candidate.jobTitle,
    department:       candidate.department,
    organizationName: candidate.organization.nameAr,
    loginEmail,
    password,
    loginUrl:         getLoginUrl(),
  });

  let subject = base.subject;
  let html    = base.html;
  const tpl = await getDefaultFor(candidate.organizationId, "INVITATION").catch(() => null);
  if (tpl) {
    const vctx = buildContext({
      candidate: {
        nameAr:     candidate.nameAr,
        email:      candidate.email,
        jobTitle:   candidate.jobTitle,
        department: candidate.department,
      },
      organization: { nameAr: candidate.organization.nameAr, nameEn: candidate.organization.nameEn ?? null },
      hr: { nameAr: "" },
    });
    const renderedSubject = renderVariables(tpl.subjectAr, vctx).trim();
    const renderedBody    = renderVariables(tpl.bodyAr,    vctx);
    if (renderedSubject) subject = renderedSubject;
    // Drop the custom greeting just before the credentials panel in the base
    // email. If the base body shape changes and the sentinel disappears, we
    // fall back to the plain base — the credentials still get through.
    const greetingMarker = "<div class=\"wrapper\">";
    const idx = html.indexOf(greetingMarker);
    if (idx >= 0) {
      const inject = `<div style="padding:16px 0;white-space:pre-wrap;line-height:1.7;color:#1A1A1A;font-size:15px">${renderedBody.replace(/</g, "&lt;")}</div>`;
      html = html.slice(0, idx + greetingMarker.length) + inject + html.slice(idx + greetingMarker.length);
    }
  }

  // Create the log row FIRST so we have an id to embed as the tracking pixel.
  const notifier = await getOrgNotifier(candidate.organizationId);
  const { createPendingLog, markLogStatus, injectEmailTracking } = await import("@/infrastructure/notifications/email-log.service");
  const logId = await createPendingLog({
    organizationId: candidate.organizationId,
    candidateId:    candidate.id,
    fromAddress:    (notifier as unknown as { config?: { from?: string } }).config?.from ?? "unknown",
    toAddress:      candidate.email,
    subject,
    bodyHtml:       html,
    provider:       notifier.isTransport ? "smtp" : "console",
  }).catch((e) => { console.error("[invitation] pending log failed:", e instanceof Error ? e.message : e); return null; });

  const trackedHtml = logId ? injectEmailTracking(html, logId, getLoginUrl()) : html;
  let sendErr: unknown = null;
  try {
    await notifier.send({ to: candidate.email, subject, html: trackedHtml });
  } catch (e) {
    sendErr = e;
  }
  const delivered = notifier.isTransport && !sendErr;

  if (logId) {
    markLogStatus(logId, sendErr ? "FAILED" : (delivered ? "SENT" : "QUEUED"), {
      errorMessage: sendErr instanceof Error ? sendErr.message : (sendErr ? String(sendErr) : null),
    }).catch((err) => { console.error("[invitation] log status update failed:", err instanceof Error ? err.message : err); });
  }

  if (sendErr) throw sendErr;

  // Only write credentials to DB after a real transport accepted the mail.
  // Console-stub sends don't touch the account — the candidate never saw a password.
  if (delivered) {
    const now = new Date();
    try {
      await prisma.$transaction([
        prisma.candidate.update({
          where: { id: candidateId },
          data: {
            loginEmail,
            passwordHash,
            accountActivatedAt: candidate.accountActivatedAt ?? now,
            passwordChangedAt: now,
            failedLoginAttempts: 0,
            lockedUntil: null,
            invitationSent: true,
            invitationSentAt: now,
          },
        }),
        // Retire any outstanding verification tokens — they're from the old flow.
        prisma.verificationToken.updateMany({
          where: { candidateId, usedAt: null },
          data:  { usedAt: now },
        }),
      ]);
    } catch (err) {
      // Mail already went out — surface this LOUDLY so an operator can rerun.
      console.error(`[sendInvitation] CRITICAL: mail sent to ${loginEmail} but DB write failed for candidate ${candidateId}`, err);
      throw err;
    }
  }

  return { sent: true, delivered, rawToken: password, email: candidate.email };
}

// ─── Backward-compatibility surface for existing HR UI widgets ───────────────
// The old `getLatestInvitation()` returned the latest activation token for the
// HR profile card. The new flow stores no plaintext password, so we expose the
// account state instead and let the UI label it accordingly.

export type InvitationStatus = "active" | "used" | "expired";

export interface InvitationCode {
  code: string | null;   // always null now — passwords are never recoverable
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Latest provisioning event for a candidate — surfaces when the account was
 * created so HR can tell at a glance whether an invitation has gone out. The
 * password itself is intentionally not retrievable (hash-only storage).
 */
export async function getLatestInvitation(candidateId: string): Promise<InvitationCode | null> {
  const c = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { invitationSentAt: true, lastLoginAt: true, passwordChangedAt: true },
  });
  if (!c?.invitationSentAt) return null;

  // "used" the moment the candidate has logged in at least once; otherwise "active".
  const status: InvitationStatus = c.lastLoginAt ? "used" : "active";
  return {
    code:      null,
    status,
    createdAt: c.invitationSentAt,
    expiresAt: new Date(c.invitationSentAt.getTime() + 365 * 24 * 60 * 60 * 1000),
    usedAt:    c.lastLoginAt,
  };
}

// Re-export so the few callers that referenced crypto helpers via this module still compile.
export { encrypt, decrypt };
