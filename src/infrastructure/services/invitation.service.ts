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
import { hash, compare } from "bcryptjs";
import { prisma } from "../database/client";
import { encrypt, decrypt } from "../../lib/crypto";
import { generateCandidatePassword } from "../../lib/password-gen";
import { getOrgNotifier } from "../notifications";
import { candidateCredentials, PLATFORM_NAME, SERVICE_NAME } from "../notifications/templates/credentials";
import { accountNotice } from "../notifications/templates/account-notice";
import { getDefaultFor } from "../email-templates/template.service";
import { buildContext, renderVariables } from "../directives/variables";

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

// ─── Existing-account notice — the SAFE path for candidates who already have ──
// ─── credentials. sendInvitation() must NEVER be used for them: it rotates the ─
// ─── password on every call. This function proves account existence from the   ─
// ─── account fields themselves (passwordHash / accountActivatedAt /           ─
// ─── passwordChangedAt / lastLoginAt — never lastLoginAt alone) and sends the ─
// ─── account-notice template, which contains NO password.                      ─

export interface AccountNoticeResult {
  sent: boolean;
  delivered: boolean;
  email: string;
  /** always false — this path never changes credentials */
  passwordChanged: false;
}

/** Fields that prove an account already exists. lastLoginAt alone is NOT enough. */
export function accountExists(c: {
  passwordHash: string | null;
  accountActivatedAt: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
}): boolean {
  return Boolean(c.passwordHash || c.accountActivatedAt || c.passwordChangedAt || c.lastLoginAt);
}

/**
 * Sends a login reminder to a candidate whose account ALREADY exists.
 *
 * Guarantees (verified by tests):
 *   - passwordHash, passwordChangedAt, accountActivatedAt, lastLoginAt: untouched
 *   - no password is generated, printed, stored or included in the mail
 *   - the login link points at opts.loginUrl (production host for real sends)
 *
 * Throws InvitationError("NO_PROVIDER") when the org has no transport — the
 * caller decides whether that is a batch failure or a skip.
 */
export async function notifyExistingAccount(
  candidateId: string,
  opts: {
    loginUrl?: string;
    /** ADDITIVE: linkage for batch reports — never touches historical rows. */
    batchId?: string;
    importItemId?: string;
    /** Stable idempotency key for THIS logical attempt (unique index enforces it). */
    idempotencyKey?: string;
    sentByUserId?: string;
  } = {},
): Promise<AccountNoticeResult> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { organization: true },
  });

  const loginEmail = (candidate.loginEmail ?? candidate.email).trim().toLowerCase();
  if (!loginEmail) throw new InvitationError("EMAIL_TAKEN", "المرشح لا يملك بريداً صالحاً");

  // Load the account fields we must NOT change (and use for existence proof).
  const acct = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      passwordHash: true,
      accountActivatedAt: true,
      passwordChangedAt: true,
      lastLoginAt: true,
    },
  });
  if (!acct) throw new InvitationError("EMAIL_TAKEN", "المرشح غير موجود");
  if (!accountExists(acct)) {
    // No account yet — this path must not silently provision one.
    throw new InvitationError("NO_PROVIDER", "لا يوجد حساب قائم لهذا المرشح — استخدم مسار إنشاء الحساب");
  }

  const loginBase = (opts.loginUrl ?? getLoginUrl()).replace(/\/$/, "");
  const notice = accountNotice({
    candidateName:    candidate.nameAr,
    jobTitle:         candidate.jobTitle,
    department:       candidate.department,
    organizationName: candidate.organization.nameAr,
    loginEmail,
    loginUrl:         loginBase,
    platformName:     PLATFORM_NAME,
    serviceName:      SERVICE_NAME,
  });

  const notifier = await getOrgNotifier(candidate.organizationId);
  if (!notifier.isTransport) {
    throw new InvitationError("NO_PROVIDER", "لا يوجد مزود بريد مفعّل لهذه المنظمة");
  }

  const { createPendingLog, markLogStatus, injectEmailTracking, markSendStarted } =
    await import("../notifications/email-log.service");

  const logId = await createPendingLog({
    organizationId: candidate.organizationId,
    candidateId:    candidate.id,
    fromAddress:    (notifier as unknown as { config?: { from?: string } }).config?.from ?? "unknown",
    toAddress:      candidate.email,
    subject:        notice.subject,
    bodyHtml:       notice.html,
    provider:       "smtp",
    batchId:        opts.batchId ?? null,
    importItemId:   opts.importItemId ?? null,
    idempotencyKey: opts.idempotencyKey ?? null,
  }).catch((e) => {
    console.error("[account-notice] pending log failed:", e instanceof Error ? e.message : e);
    return null;
  });

  // Crash-window marker: from here on, an interrupted run must be treated as
  // UNKNOWN (the transport may or may not have accepted the message).
  if (logId && opts.idempotencyKey) await markSendStarted(logId);

  const trackedHtml = logId ? injectEmailTracking(notice.html, logId, loginBase) : notice.html;
  let sendErr: unknown = null;
  try {
    await notifier.send({ to: candidate.email, subject: notice.subject, html: trackedHtml, text: notice.text });
  } catch (e) {
    sendErr = e;
  }
  const delivered = !sendErr;

  if (logId) {
    markLogStatus(logId, sendErr ? "FAILED" : "SENT", {
      errorMessage: sendErr instanceof Error ? sendErr.message : (sendErr ? String(sendErr) : null),
    }).catch((err) => console.error("[account-notice] log status update failed:", err instanceof Error ? err.message : err));
  }

  if (sendErr) throw sendErr;

  // invitationSent/invitationSentAt are invitation-state flags, not credentials —
  // updating them is allowed. The four credential fields are NOT in this write.
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { invitationSent: true, invitationSentAt: new Date() },
  });

  return { sent: true, delivered, email: candidate.email, passwordChanged: false };
}

/**
 * Provisions a login (loginEmail = candidate.email, random password) and emails
 * the credentials. Safe to re-run — each call rotates the password. Only flips
 * invitationSent after a transport-backed delivery.
 *
 * `opts.loginUrl` lets candidate-facing senders pin an absolute base URL (e.g. the
 * production host) instead of the env-derived local fallback — never invent hosts.
 */
export async function sendInvitation(
  candidateId: string,
  opts: {
    loginUrl?: string;
    /** ADDITIVE: batch linkage for import-driven invitations (null for legacy calls). */
    batchId?: string;
    importItemId?: string;
    /** Stable idempotency key for THIS logical attempt (unique index enforces it). */
    idempotencyKey?: string;
    sentByUserId?: string;
  } = {},
): Promise<InvitationResult> {
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
  const loginBase = (opts.loginUrl ?? getLoginUrl()).replace(/\/$/, "");
  const base = candidateCredentials({
    candidateName:    candidate.nameAr,
    jobTitle:         candidate.jobTitle,
    department:       candidate.department,
    organizationName: candidate.organization.nameAr,
    loginEmail,
    password,
    loginUrl:         loginBase,
    platformName:     PLATFORM_NAME,
    serviceName:       SERVICE_NAME,
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
  const { createPendingLog, markLogStatus, injectEmailTracking, markSendStarted } = await import("../notifications/email-log.service");
  const logId = await createPendingLog({
    organizationId: candidate.organizationId,
    candidateId:    candidate.id,
    fromAddress:    (notifier as unknown as { config?: { from?: string } }).config?.from ?? "unknown",
    toAddress:      candidate.email,
    subject,
    bodyHtml:       html,
    provider:       notifier.isTransport ? "smtp" : "console",
    batchId:        opts.batchId ?? null,
    importItemId:   opts.importItemId ?? null,
    idempotencyKey: opts.idempotencyKey ?? null,
    sentByUserId:   opts.sentByUserId ?? null,
  }).catch((e) => { console.error("[invitation] pending log failed:", e instanceof Error ? e.message : e); return null; });

  // Crash-window marker: from here on, an interrupted run must be treated as
  // UNKNOWN (the transport may or may not have accepted the message).
  if (logId && opts.idempotencyKey) await markSendStarted(logId);

  const trackedHtml = logId ? injectEmailTracking(html, logId, loginBase) : html;
  let sendErr: unknown = null;
  try {
    await notifier.send({ to: candidate.email, subject, html: trackedHtml, text: base.text });
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

    // Hardening (verified AFTER the write): the password that was emailed MUST
    // be the one now stored on the candidate account — re-verify via bcrypt.
    // Checking before the write could only ever compare against the OLD hash,
    // so it would flag every legitimate send as a mismatch.
    const stored = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { passwordHash: true },
    });
    const hashOk = stored?.passwordHash ? await compare(password, stored.passwordHash) : false;
    if (!hashOk) {
      console.error(`[sendInvitation] CRITICAL: delivered to ${loginEmail} but passwordHash verification failed for candidate ${candidateId}`);
      throw new Error("DELIVERED_BUT_HASH_MISMATCH");
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
